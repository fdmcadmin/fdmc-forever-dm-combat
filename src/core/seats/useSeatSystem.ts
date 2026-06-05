import { useCallback, useEffect, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import type { FdmcRoomLiveState, FdmcRecentEventSlot } from "../table-state/fdmcRoomLiveState";
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
import { cacheActors, loadCachedActors } from "./playerActorCache";
import type { ActorOverrideMap } from "../table-state/actorHydrationBoundary";

// ─── Seat storage (DM localStorage) ──────────────────────────────────────────

const DM_SEAT_CONFIG_KEY = "fdmc.dm.seatConfig.v1";

function loadSeatConfig(): Record<string, FdmcSeat> {
  try {
    const raw = window.localStorage.getItem(DM_SEAT_CONFIG_KEY);
    return raw ? JSON.parse(raw) as Record<string, FdmcSeat> : {};
  } catch {
    return {};
  }
}

function saveSeatConfig(seats: Record<string, FdmcSeat>): void {
  try {
    window.localStorage.setItem(DM_SEAT_CONFIG_KEY, JSON.stringify(seats));
  } catch {
    // localStorage unavailable
  }
}

// ─── Viewer key ───────────────────────────────────────────────────────────────

const VIEWER_KEY_CACHE = "fdmc.viewer.seatKey.v1";

async function getViewerSeatKey(): Promise<string> {
  const cached = window.localStorage.getItem(VIEWER_KEY_CACHE);
  if (cached) return cached;

  if (!OBR.isAvailable) {
    const fallback = `vk-local-${Date.now().toString(36)}`;
    window.localStorage.setItem(VIEWER_KEY_CACHE, fallback);
    return fallback;
  }

  try {
    const rawId = await OBR.player.getId();
    const key = hashViewerId(rawId);
    window.localStorage.setItem(VIEWER_KEY_CACHE, key);
    return key;
  } catch {
    const fallback = `vk-err-${Date.now().toString(36)}`;
    window.localStorage.setItem(VIEWER_KEY_CACHE, fallback);
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
  seatMode: "player" | "viewer";
  actorIds: string[];
  primaryActorId: string;
};

export function useDmSeatSystem({
  actorLibrary,
  actorOverrides,
  roomLiveState,
  onRoomStateChange,
}: UseDmSeatSystemOptions) {
  const [seats, setSeats] = useState<Record<string, FdmcSeat>>(() => loadSeatConfig());
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

      if (isSeatClaimBroadcast(msg) || isActorDataRequestBroadcast(msg)) {
        const { seatId, viewerSeatKey } = msg;
        const seat = seatsRef.current[seatId];
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
        void OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, payload, { destination: "REMOTE" });
      }
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
    };

    const nextSeats = { ...seatsRef.current, [input.seatId]: seat };
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
    const seat = seatsRef.current[seatId];
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
    void OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, payload, { destination: "REMOTE" });
  }, []);

  const pushActorsToAllSeats = useCallback((fresh?: PushFreshData): void => {
    for (const seatId of Object.keys(seatsRef.current)) {
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

  return {
    seats,
    seatBindings,
    assignSeat,
    removeSeat,
    purgeAllSeatMetadata,
    pushActorsToSeat,
    pushActorsToAllSeats,
  };
}

// ─── Player seat system hook ──────────────────────────────────────────────────

export type UsePlayerSeatSystemResult = {
  viewerSeatKey: string | null;
  claimedSeatId: string | null;
  seatActors: Actor[];
  seatStatus: "loading" | "no-seat" | "claiming" | "ready" | "viewer";
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

  // Derive viewer seat key on mount — also restore viewer choice if they previously chose it
  useEffect(() => {
    void getViewerSeatKey().then(setViewerSeatKey);
    try {
      const lastChoice = window.localStorage.getItem("fdmc.player.seatChoice.v1");
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
      try { window.localStorage.setItem("fdmc.player.seatChoice.v1", "viewer"); } catch { /* ok */ }
      return;
    }

    // Set claimed state immediately so actor data response is captured
    claimedRef.current = seatId;
    setClaimedSeatId(seatId);
    setSeatStatus("claiming");

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
    try { window.localStorage.setItem("fdmc.player.seatChoice.v1", "viewer"); } catch { /* ok */ }
  }, []);

  // Release current seat — returns to seat picker without page reload
  const releaseSeat = useCallback((): void => {
    claimedRef.current = null;
    browsingRef.current = true;
    setIsBrowsing(true);
    setClaimedSeatId(null);
    setSeatStatus("no-seat");
    try { window.localStorage.removeItem("fdmc.player.seatChoice.v1"); } catch { /* ok */ }
  }, []);

  const requestActorData = useCallback((): void => {
    const seatId = claimedRef.current;
    if (!seatId || !viewerSeatKey || !OBR.isAvailable) return;
    void OBR.broadcast.sendMessage(
      FDMC_SEAT_BROADCAST_CHANNEL,
      { type: "fdmc:actor-data-request", seatId, viewerSeatKey },
      { destination: "REMOTE" }
    );
    setSeatStatus("claiming");
  }, [viewerSeatKey]);

  return { viewerSeatKey, claimedSeatId, seatActors, seatStatus, isBrowsing, requestActorData, manualClaim, claimViewerSeat, releaseSeat };
}
