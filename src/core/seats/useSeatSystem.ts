import { useCallback, useEffect, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import type { FdmcRoomLiveState } from "../table-state/fdmcRoomLiveState";
import {
  normalizeFdmcRoomLiveState,
  createEmptyRoomLiveState,
} from "../table-state/fdmcRoomLiveState";
import {
  readFdmcRoomStateKey,
  publishFdmcRoomStateKey,
  subscribeFdmcRoomStateKey,
} from "../table-state/roomStateBridge";
import { FDMC_ROOM_LIVE_STATE_KEY } from "../table-state/sharedTableState";
import {
  FDMC_SEAT_BROADCAST_CHANNEL,
  hashViewerId,
  isSeatClaimBroadcast,
  isActorDataBroadcast,
  isActorDataRequestBroadcast,
  isSeatAssignBroadcast,
  type FdmcSeat,
  type FdmcSeatBinding,
  type ActorDataBroadcast,
  type SeatClaimBroadcast,
} from "./seatTypes";
import { resolveActorsForSeat } from "./dmActorLibrary";
import { registerSeatColors } from "./seatColors";
import { cacheActors, loadCachedActors } from "./playerActorCache";
import type { ActorOverrideMap } from "../table-state/actorHydrationBoundary";
import { safeStorage } from "../utils/safeStorage";
import {
  createActorDataAssembler,
  createSeatSendLanes,
  isActorDataChunkBroadcast,
  sendActorData,
  type SeatSendReport,
} from "./seatTransport";

/**
 * The GM's seat sends, awaited and reported. Module-level so every hook instance in a window shares one
 * lane per seat — two pushes for the same seat never race each other to the player.
 */
const seatLanes = createSeatSendLanes(
  (payload) => sendActorData(
    (message) => OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, message, { destination: "REMOTE" }),
    payload,
  ),
  (report: SeatSendReport) => {
    if (!report.ok) {
      console.warn(`[FDMC seats] ${report.seatId}: character data did not send — ${report.sent}/${report.messages} messages, ${report.bytes} bytes: ${report.error}`);
    }
  },
);

async function isGmWindow(): Promise<boolean> {
  try {
    return (await OBR.player.getRole()) === "GM";
  } catch {
    return false;
  }
}

// ─── Seat storage (DM localStorage) ──────────────────────────────────────────

const DM_SEAT_CONFIG_KEY = "fdmc.dm.seatConfig.v1";

function loadSeatConfig(): Record<string, FdmcSeat> {
  try {
    const raw = safeStorage().getItem(DM_SEAT_CONFIG_KEY);
    return raw ? JSON.parse(raw) as Record<string, FdmcSeat> : {};
  } catch {
    return {};
  }
}

function saveSeatConfig(seats: Record<string, FdmcSeat>): void {
  try {
    safeStorage().setItem(DM_SEAT_CONFIG_KEY, JSON.stringify(seats));
  } catch {
    // localStorage unavailable
  }
}

// ─── Viewer key ───────────────────────────────────────────────────────────────

const VIEWER_KEY_CACHE = "fdmc.viewer.seatKey.v1";

async function getViewerSeatKey(): Promise<string> {
  const cached = safeStorage().getItem(VIEWER_KEY_CACHE);
  if (cached) return cached;

  if (!OBR.isAvailable) {
    const fallback = `vk-local-${Date.now().toString(36)}`;
    safeStorage().setItem(VIEWER_KEY_CACHE, fallback);
    return fallback;
  }

  try {
    const rawId = await OBR.player.getId();
    const key = hashViewerId(rawId);
    safeStorage().setItem(VIEWER_KEY_CACHE, key);
    return key;
  } catch {
    const fallback = `vk-err-${Date.now().toString(36)}`;
    safeStorage().setItem(VIEWER_KEY_CACHE, fallback);
    return fallback;
  }
}

// ─── DM seat system hook ──────────────────────────────────────────────────────

export type UseDmSeatSystemOptions = {
  actorLibrary: Record<string, Actor>;
  actorOverrides: ActorOverrideMap;
  roomLiveState: FdmcRoomLiveState;
  onRoomStateChange: (next: FdmcRoomLiveState) => void;
};

export type SeatAssignmentInput = {
  seatId: string;
  label: string;
  seatMode: "player" | "viewer" | "co-dm";
  actorIds: string[];
  primaryActorId: string;
  /** Custom seat color (#rrggbb); undefined keeps the derived palette color. */
  color?: string;
};

export function useDmSeatSystem({
  actorLibrary,
  actorOverrides,
  roomLiveState,
  onRoomStateChange,
}: UseDmSeatSystemOptions) {
  const [seats, setSeats] = useState<Record<string, FdmcSeat>>(() => loadSeatConfig());
  // Seat colors may be customised per seat; keep the shared resolver in sync on load
  // so every getSeatColor() call site picks up the override.
  useEffect(() => { registerSeatColors(seats); }, [seats]);
  const [seatBindings, setSeatBindings] = useState<Record<string, FdmcSeatBinding>>({});
  const libraryRef = useRef(actorLibrary);
  const overridesRef = useRef(actorOverrides);
  const liveStateRef = useRef(roomLiveState);
  const seatsRef = useRef(seats);

  useEffect(() => { libraryRef.current = actorLibrary; }, [actorLibrary]);
  useEffect(() => { overridesRef.current = actorOverrides; }, [actorOverrides]);
  useEffect(() => { liveStateRef.current = roomLiveState; }, [roomLiveState]);
  useEffect(() => { seatsRef.current = seats; }, [seats]);

  // Load existing seat bindings from room metadata on mount
  useEffect(() => {
    void readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState).then(state => {
      if (state?.seatBindings) {
        setSeatBindings(state.seatBindings);
      }
    });
  }, []);

  // Subscribe to room metadata for seat binding updates
  useEffect(() => {
    return subscribeFdmcRoomStateKey(
      FDMC_ROOM_LIVE_STATE_KEY,
      normalizeFdmcRoomLiveState,
      (state) => {
        if (state.seatBindings) setSeatBindings(state.seatBindings);
      },
    );
  }, []);

  // Listen for seat-claim and actor-data-request broadcasts
  useEffect(() => {
    if (!OBR.isAvailable) return;

    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data;

      if (isSeatClaimBroadcast(msg) || isActorDataRequestBroadcast(msg)) void (async () => {
        const { seatId, viewerSeatKey } = msg;
        /**
         * ⚠ ONLY THE GM ANSWERS. This hook runs in every client's window, players included, and a player's
         * library is not the party — an answer from one would hand the claiming seat an empty or stale
         * roster and mark it ready. The GM is the single writer; a seat only ever asks.
         */
        if (!(await isGmWindow())) return;
        /**
         * ⚠ THE ROOM'S COPY OF THE SEAT COUNTS TOO. Seat definitions are kept in this browser's storage AND
         * in room metadata; a GM window whose storage lacks them (another browser, a cleared cache) used to
         * return here without a word and the player waited forever. The room's copy is the same seat.
         */
        const seat = seatsRef.current[seatId] ?? liveStateRef.current.seats?.[seatId];
        if (!seat) return;

        // Record the seat binding
        const binding: FdmcSeatBinding = { seatId, viewerSeatKey, boundAt: new Date().toISOString() };
        setSeatBindings(current => ({ ...current, [seatId]: binding }));

        // Write binding to room metadata
        void readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState).then(current => {
          const base = current ?? createEmptyRoomLiveState();
          const next: FdmcRoomLiveState = {
            ...base,
            revision: base.revision + 1,
            updatedAt: Date.now(),
            seatBindings: { ...base.seatBindings, [seatId]: binding },
            seats: { ...base.seats, [seatId]: seat },
          };
          void publishFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, next);
          onRoomStateChange(next);
        });

        // Broadcast actor data back to the seat
        const actors = resolveActorsForSeat(seat, libraryRef.current, overridesRef.current, liveStateRef.current);
        const payload: ActorDataBroadcast = {
          type: "fdmc:actor-data",
          seatId,
          actors,
          recentEventWindow: liveStateRef.current.recentEvents.slots,
        };
        // Chunked when it is past Owlbear's broadcast cap — see seatTransport.
        seatLanes(payload);
      })();
    });
  }, [onRoomStateChange]);

  // ── DM actions ───────────────────────────────────────────────────────────

  const assignSeat = useCallback(async (input: SeatAssignmentInput): Promise<void> => {
    const seat: FdmcSeat = {
      seatId: input.seatId,
      label: input.label,
      seatMode: input.seatMode ?? "player",
      actorIds: input.actorIds,
      primaryActorId: input.primaryActorId,
      color: input.color,
    };

    const nextSeats = { ...seatsRef.current, [input.seatId]: seat };
    registerSeatColors(nextSeats);
    setSeats(nextSeats);
    saveSeatConfig(nextSeats);

    // Write seat definition to room metadata
    const current = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
    const base = current ?? createEmptyRoomLiveState();
    const next: FdmcRoomLiveState = {
      ...base,
      revision: base.revision + 1,
      updatedAt: Date.now(),
      seats: { ...base.seats, [input.seatId]: seat },
    };
    await publishFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, next);
    onRoomStateChange(next);
  }, [onRoomStateChange]);

  type PushFreshData = {
    freshLibrary?: Record<string, Actor>;
    freshOverrides?: ActorOverrideMap;
  };

  const pushActorsToSeat = useCallback((seatId: string, fresh?: PushFreshData): void => {
    const localSeat = seatsRef.current[seatId];
    const seat = localSeat ?? liveStateRef.current.seats?.[seatId];
    if (!seat || !OBR.isAvailable) return;
    const lib = fresh?.freshLibrary ?? libraryRef.current;
    const overrides = fresh?.freshOverrides ?? overridesRef.current;
    const actors = resolveActorsForSeat(seat, lib, overrides, liveStateRef.current);
    const payload: ActorDataBroadcast = {
      type: "fdmc:actor-data",
      seatId,
      actors,
      recentEventWindow: liveStateRef.current.recentEvents.slots,
    };
    // A seat known only from the room is pushed by the GM alone — see the claim handler above.
    if (localSeat) seatLanes(payload);
    else void isGmWindow().then(gm => { if (gm) seatLanes(payload); });
  }, []);

  const pushActorsToAllSeats = useCallback((fresh?: PushFreshData): void => {
    const seatIds = new Set([...Object.keys(seatsRef.current), ...Object.keys(liveStateRef.current.seats ?? {})]);
    for (const seatId of seatIds) {
      pushActorsToSeat(seatId, fresh);
    }
  }, [pushActorsToSeat]);

  const purgeAllSeatMetadata = useCallback(async (): Promise<void> => {
    setSeats({});
    setSeatBindings({});
    saveSeatConfig({});

    const current = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
    const base = current ?? createEmptyRoomLiveState();
    const next: FdmcRoomLiveState = {
      ...base,
      revision: base.revision + 1,
      updatedAt: Date.now(),
      seats: {},
      seatBindings: {},
    };
    await publishFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, next);
    onRoomStateChange(next);
  }, [onRoomStateChange]);

  const removeSeat = useCallback(async (seatId: string): Promise<void> => {
    const nextSeats = { ...seatsRef.current };
    delete nextSeats[seatId];
    setSeats(nextSeats);
    saveSeatConfig(nextSeats);

    const current = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
    const base = current ?? createEmptyRoomLiveState();
    const nextBindings = { ...base.seatBindings };
    delete nextBindings[seatId];
    const next: FdmcRoomLiveState = {
      ...base,
      revision: base.revision + 1,
      updatedAt: Date.now(),
      seats: nextSeats,
      seatBindings: nextBindings,
    };
    await publishFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, next);
    onRoomStateChange(next);
  }, [onRoomStateChange]);

  // kickFromSeat: clear the binding only — seat definition stays, player returns to picker
  const kickFromSeat = useCallback(async (seatId: string): Promise<void> => {
    const current = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
    const base = current ?? createEmptyRoomLiveState();
    const nextBindings = { ...base.seatBindings };
    delete nextBindings[seatId];
    setSeatBindings(prev => { const n = { ...prev }; delete n[seatId]; return n; });
    const next: FdmcRoomLiveState = {
      ...base,
      revision: base.revision + 1,
      updatedAt: Date.now(),
      seatBindings: nextBindings,
    };
    await publishFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, next);
    onRoomStateChange(next);
  }, [onRoomStateChange]);

  return {
    seats,
    seatBindings,
    assignSeat,
    kickFromSeat,
    removeSeat,
    purgeAllSeatMetadata,
    pushActorsToSeat,
    pushActorsToAllSeats,
  };
}

// ─── Player seat system hook ──────────────────────────────────────────────────

/**
 * Where a seat's character data is while the player waits for it. `problem` is set once the wait has gone
 * on long enough that it is not just a slow table — the screen says what is wrong instead of spinning.
 */
export type SeatSyncState = {
  /** Requests sent for this claim, the first one included. */
  attempts: number;
  /** Pieces of a chunked transfer in so far. */
  receiving?: { received: number; count: number };
  problem?: string;
};

/** Ask again when nothing has arrived for this long… */
export const SEAT_RETRY_MS = 5_000;
/** …and after this many unanswered requests, say so. */
export const SEAT_PROBLEM_AFTER_ATTEMPTS = 3;
/** Past the first few, keep asking — but slowly, a GM window may open at any moment. */
export const SEAT_SLOW_RETRY_MS = 15_000;

export type UsePlayerSeatSystemResult = {
  viewerSeatKey: string | null;
  claimedSeatId: string | null;
  seatActors: Actor[];
  seatStatus: "loading" | "no-seat" | "claiming" | "ready" | "viewer";
  seatSync: SeatSyncState;
  /** True when player explicitly chose to browse seats — shows picker even if seatActors cached */
  isBrowsing: boolean;
  requestActorData: () => void;
  manualClaim: (seatId: string, seat?: FdmcSeat) => void;
  claimViewerSeat: () => void;
  /** Release current seat/viewer and return to the seat picker */
  releaseSeat: () => void;
};

export function usePlayerSeatSystem(roomLiveState: FdmcRoomLiveState): UsePlayerSeatSystemResult {
  const [viewerSeatKey, setViewerSeatKey] = useState<string | null>(null);
  const [claimedSeatId, setClaimedSeatId] = useState<string | null>(null);
  const [seatActors, setSeatActors] = useState<Actor[]>(() => loadCachedActors());
  const [seatStatus, setSeatStatus] = useState<"loading" | "no-seat" | "claiming" | "ready" | "viewer">("loading");
  const claimedRef = useRef<string | null>(null);
  // Set true when player explicitly chooses to browse seats — prevents auto-reclaim
  const browsingRef = useRef(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [seatSync, setSeatSync] = useState<SeatSyncState>({ attempts: 0 });
  const assemblerRef = useRef(createActorDataAssembler());
  /** Last time anything for our seat arrived — a chunk counts, so a slow transfer is not re-requested. */
  const lastProgressRef = useRef(0);
  const attemptsRef = useRef(0);

  // Derive viewer seat key on mount — also restore viewer choice if they previously chose it
  useEffect(() => {
    /**
     * ⚠ A REJECTED PROMISE HERE STRANDED THE PLAYER ON "syncing…" FOREVER.
     *
     * `getViewerSeatKey` read `window.localStorage` on its very first line, outside any try. Under
     * Firefox's Enhanced Tracking Protection that access THROWS — FDMC runs inside OBR's iframe, so
     * Firefox treats the origin as third-party — and `void promise.then(...)` with no `.catch()`
     * swallowed it. `viewerSeatKey` stayed null, which is the early-return guard in BOTH the
     * auto-claim effect and `manualClaim`, so the seat sat at "claiming" and clicking a seat did
     * nothing at all. The card looked like it was validating and never finished.
     *
     * The storage call now goes through `safeStorage()`, and the key itself falls back to a
     * generated one rather than nothing, so a seat can always be claimed even if every store is
     * blocked.
     */
    void getViewerSeatKey()
      .then(setViewerSeatKey)
      .catch(() => setViewerSeatKey(`vk-fallback-${Date.now().toString(36)}`));
    try {
      const lastChoice = safeStorage().getItem("fdmc.player.seatChoice.v1");
      if (lastChoice === "viewer") {
        setSeatStatus("viewer");
        setClaimedSeatId("viewer");
      }
    } catch { /* ok */ }
  }, []);

  // When we have a key and room state, find matching seat binding and claim
  useEffect(() => {
    if (!viewerSeatKey) return;
    // Already in viewer mode — don't overwrite with no-seat
    if (claimedSeatId === "viewer") return;
    // Player explicitly chose to browse seats — don't auto-reclaim until they pick
    if (browsingRef.current) return;

    const matchingSeatId = Object.values(roomLiveState.seatBindings).find(
      b => b.viewerSeatKey === viewerSeatKey
    )?.seatId ?? null;

    if (!matchingSeatId) {
      setSeatStatus("no-seat");
      return;
    }

    if (claimedRef.current === matchingSeatId) return;
    claimedRef.current = matchingSeatId;
    setClaimedSeatId(matchingSeatId);
    setSeatStatus("claiming");
    attemptsRef.current = 1;
    lastProgressRef.current = Date.now();
    setSeatSync({ attempts: 1 });

    // Broadcast seat-claim to trigger DM actor data response
    if (OBR.isAvailable) {
      const claim: SeatClaimBroadcast = {
        type: "fdmc:seat-claim",
        seatId: matchingSeatId,
        viewerSeatKey,
      };
      void OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, claim, { destination: "REMOTE" });
    }
  }, [viewerSeatKey, roomLiveState.seatBindings]);

  // Listen for actor data broadcast addressed to our seat
  useEffect(() => {
    if (!OBR.isAvailable) return;

    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data;

      if (isActorDataBroadcast(msg) && msg.seatId === claimedRef.current) {
        cacheActors(msg.actors);
        setSeatActors(msg.actors);
        setSeatStatus("ready");
        setSeatSync({ attempts: 0 });
      }

      // A seat past Owlbear's broadcast cap arrives in pieces — see seatTransport.
      if (isActorDataChunkBroadcast(msg) && msg.seatId === claimedRef.current) {
        lastProgressRef.current = Date.now();
        const result = assemblerRef.current.accept(msg);
        if (result.payload) {
          cacheActors(result.payload.actors);
          setSeatActors(result.payload.actors);
          setSeatStatus("ready");
          setSeatSync({ attempts: 0 });
        } else if (result.error) {
          lastProgressRef.current = 0;   // ask again on the next tick rather than waiting out the retry
          setSeatSync(current => ({ ...current, receiving: undefined, problem: `Your characters arrived damaged (${result.error}). Asking the GM again…` }));
        } else {
          setSeatSync(current => ({ ...current, receiving: { received: result.received, count: result.count } }));
        }
      }

      if (isSeatAssignBroadcast(msg) && msg.viewerSeatKey === viewerSeatKey) {
        // DM assigned us to a seat — trigger claim
        claimedRef.current = null; // reset so the effect fires again
        setClaimedSeatId(null);
      }
    });
  }, [viewerSeatKey]);

  // Player manually selects a seat from the seat list
  const manualClaim = useCallback((seatId: string, seat?: FdmcSeat): void => {
    if (!viewerSeatKey) return;
    // Player chose a seat — clear browsing guard
    browsingRef.current = false;
    setIsBrowsing(false);

    // Viewer-mode seat — skip broadcast, go straight to viewer state
    if (seat?.seatMode === "viewer") {
      setSeatStatus("viewer");
      setClaimedSeatId("viewer");
      try { safeStorage().setItem("fdmc.player.seatChoice.v1", "viewer"); } catch { /* ok */ }
      return;
    }

    // Set claimed state immediately so actor data response is captured
    claimedRef.current = seatId;
    setClaimedSeatId(seatId);
    setSeatStatus("claiming");
    attemptsRef.current = 1;
    lastProgressRef.current = Date.now();
    setSeatSync({ attempts: 1 });

    // Broadcast seat-claim — DM receives, writes binding, sends actor data
    if (OBR.isAvailable) {
      void OBR.broadcast.sendMessage(
        FDMC_SEAT_BROADCAST_CHANNEL,
        { type: "fdmc:seat-claim", seatId, viewerSeatKey } satisfies SeatClaimBroadcast,
        { destination: "REMOTE" }
      );
    }
  }, [viewerSeatKey]);

  // Viewer seat — no broadcast, no actor data, read-only watch mode
  const claimViewerSeat = useCallback((): void => {
    browsingRef.current = false;
    setIsBrowsing(false);
    setSeatStatus("viewer");
    setClaimedSeatId("viewer");
    // Store viewer preference so refresh restores it
    try { safeStorage().setItem("fdmc.player.seatChoice.v1", "viewer"); } catch { /* ok */ }
  }, []);

  // Release current seat — returns to seat picker without page reload
  const releaseSeat = useCallback((): void => {
    claimedRef.current = null;
    browsingRef.current = true;
    setIsBrowsing(true);
    setClaimedSeatId(null);
    setSeatStatus("no-seat");
    try { safeStorage().removeItem("fdmc.player.seatChoice.v1"); } catch { /* ok */ }
  }, []);

  const requestActorData = useCallback((): void => {
    const seatId = claimedRef.current;
    if (!seatId || !viewerSeatKey || !OBR.isAvailable) return;
    void OBR.broadcast.sendMessage(
      FDMC_SEAT_BROADCAST_CHANNEL,
      { type: "fdmc:actor-data-request", seatId, viewerSeatKey },
      { destination: "REMOTE" }
    ).catch(() => undefined);
    attemptsRef.current += 1;
    lastProgressRef.current = Date.now();
    setSeatSync(current => ({ attempts: attemptsRef.current, problem: current.problem }));
    setSeatStatus("claiming");
  }, [viewerSeatKey]);

  /**
   * ⚠ ASK AGAIN — NEVER JUST WAIT. The claim is one message and so is the GM's answer; either can be lost
   * (no GM window open yet, a window that reloaded mid-send, a phone that slept). While the seat is
   * claiming and nothing for it has arrived in SEAT_RETRY_MS, request the data again; after
   * SEAT_PROBLEM_AFTER_ATTEMPTS unanswered requests, say what is wrong, and keep asking slowly.
   */
  useEffect(() => {
    if (seatStatus !== "claiming" || !viewerSeatKey || !OBR.isAvailable) return;
    const timer = window.setInterval(() => {
      const seatId = claimedRef.current;
      if (!seatId || seatId === "viewer") return;
      const waitMs = attemptsRef.current >= SEAT_PROBLEM_AFTER_ATTEMPTS ? SEAT_SLOW_RETRY_MS : SEAT_RETRY_MS;
      if (Date.now() - lastProgressRef.current < waitMs) return;
      void OBR.broadcast.sendMessage(
        FDMC_SEAT_BROADCAST_CHANNEL,
        { type: "fdmc:actor-data-request", seatId, viewerSeatKey },
        { destination: "REMOTE" }
      ).catch(() => undefined);
      const unanswered = attemptsRef.current;
      attemptsRef.current += 1;
      lastProgressRef.current = Date.now();
      setSeatSync({
        attempts: attemptsRef.current,
        ...(unanswered >= SEAT_PROBLEM_AFTER_ATTEMPTS
          ? { problem: `No GM window has answered ${unanswered} requests. The GM needs Forever DM Combat open (its main window or the DM panel). Still asking every ${SEAT_SLOW_RETRY_MS / 1000} seconds.` }
          : {}),
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [seatStatus, viewerSeatKey]);

  return { viewerSeatKey, claimedSeatId, seatActors, seatStatus, seatSync, isBrowsing, requestActorData, manualClaim, claimViewerSeat, releaseSeat };
}
