import { useCallback, useEffect, useRef, useState } from "react";
import type { Actor, HitPoints } from "../types/actor";
import {
  FDMC_ROOM_LIVE_STATE_KEY,
} from "../table-state/sharedTableState";
import {
  createEmptyRoomLiveState,
  normalizeFdmcRoomLiveState,
  patchActorHp,
  patchActorGold,
  patchActorCoins,
  grantActorCoin,
  getActorCoins as coinsOf,
  getActorCopper as copperOf,
  patchActorInitiative,
  patchActorTracker,
  patchActorConditions,
  estimateRoomLiveStateBytes,
  type FdmcActorLiveState,
  type FdmcRoomLiveState,
  type FdmcStatusTracker,
} from "../table-state/fdmcRoomLiveState";
import { spendCopper, type Coins, type CoinType } from "../currency/currency";
import {
  readFdmcRoomStateKey,
  publishFdmcRoomStateKey,
  subscribeFdmcRoomStateKey,
} from "../table-state/roomStateBridge";
import { safeStorage } from "../utils/safeStorage";

// ─── Local storage fallback ───────────────────────────────────────────────────

const LOCAL_KEY = "fdmc.actor.liveState.v1";

function readLocalFallback(): FdmcRoomLiveState | null {
  try {
    const raw = safeStorage().getItem(LOCAL_KEY);
    return raw ? normalizeFdmcRoomLiveState(JSON.parse(raw)) ?? null : null;
  } catch {
    return null;
  }
}

function writeLocalFallback(state: FdmcRoomLiveState) {
  try {
    safeStorage().setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {
    // keep going if storage blocked
  }
}

// ─── Seed initial actor live state from actor source objects ─────────────────

function seedActorLiveState(actors: Actor[], existing: FdmcRoomLiveState): FdmcRoomLiveState {
  let state = existing;
  for (const actor of actors) {
    const stored = state.actorLiveState[actor.id];
    const definedMax = actor.stats.hp.max;

    // Seed if missing, or repair if stored max HP is implausibly wrong
    // (e.g. 1/1 from stale room metadata when actor definition has hp.max > 1)
    const needsRepair = stored && stored.hp.max < 2 && definedMax > stored.hp.max;

    if (!stored || needsRepair) {
      // Preserve current ratio if repairing so a damaged actor doesn't fully heal
      const ratio = (stored && stored.hp.max > 0)
        ? stored.hp.current / stored.hp.max
        : 1;
      const repairedCurrent = Math.round(definedMax * ratio);
      state = {
        ...state,
        actorLiveState: {
          ...state.actorLiveState,
          [actor.id]: {
            ...(stored ?? { initiative: null, statusTrackers: {}, activeConditions: [] }),
            hp: { current: repairedCurrent, max: definedMax, temp: stored?.hp.temp ?? actor.stats.hp.temp ?? 0 },
          },
        },
      };
    }
  }
  return state;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActorLiveState(actors: Actor[]) {
  const [roomState, setRoomState] = useState<FdmcRoomLiveState>(() => {
    const local = readLocalFallback();
    const base = local ?? createEmptyRoomLiveState();
    return seedActorLiveState(actors, base);
  });

  const stateRef = useRef(roomState);
  const mountedRef = useRef(false);

  useEffect(() => { stateRef.current = roomState; }, [roomState]);

  // One-time pull from room metadata on mount
  useEffect(() => {
    mountedRef.current = true;
    void readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState).then((roomVal) => {
      if (!mountedRef.current) return;
      const base = roomVal ?? readLocalFallback() ?? createEmptyRoomLiveState();
      const seeded = seedActorLiveState(actors, base);
      writeLocalFallback(seeded);
      stateRef.current = seeded;
      setRoomState(seeded);
    });
    return () => { mountedRef.current = false; };
    // actors list identity is stable for the session — intentional dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to room metadata changes (other browsers writing HP)
  useEffect(() => {
    return subscribeFdmcRoomStateKey(
      FDMC_ROOM_LIVE_STATE_KEY,
      normalizeFdmcRoomLiveState,
      (incoming) => {
        const merged = seedActorLiveState(actors, incoming);
        writeLocalFallback(merged);
        stateRef.current = merged;
        setRoomState(merged);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Write helpers ────────────────────────────────────────────────────────────

  const commitState = useCallback(async (next: FdmcRoomLiveState) => {
    writeLocalFallback(next);
    stateRef.current = next;
    setRoomState(next);
    try {
      await publishFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, next);
    } catch {
      // local state already updated — room write failed silently
    }
  }, []);

  const setActorHp = useCallback(async (actorId: string, hp: HitPoints) => {
    const next = patchActorHp(stateRef.current, actorId, hp);
    await commitState(next);
  }, [commitState]);

  const setActorInitiative = useCallback(async (actorId: string, initiative: number | null) => {
    const next = patchActorInitiative(stateRef.current, actorId, initiative);
    await commitState(next);
  }, [commitState]);

  const setActorTracker = useCallback(async (actorId: string, trackerId: string, current: number) => {
    const next = patchActorTracker(stateRef.current, actorId, trackerId, current);
    await commitState(next);
  }, [commitState]);

  const setActorConditions = useCallback(async (actorId: string, conditions: string[]) => {
    const next = patchActorConditions(stateRef.current, actorId, conditions);
    await commitState(next);
  }, [commitState]);

  const setActorGold = useCallback(async (actorId: string, gold: number) => {
    const next = patchActorGold(stateRef.current, actorId, gold);
    await commitState(next);
  }, [commitState]);

  /** Add (or subtract, with a negative delta) gold; never drops below 0. */
  const adjustActorGold = useCallback(async (actorId: string, delta: number) => {
    const current = stateRef.current.actorLiveState[actorId]?.gold ?? 0;
    const next = patchActorGold(stateRef.current, actorId, current + delta);
    await commitState(next);
  }, [commitState]);

  // ── Multi-coin wallet ─────────────────────────────────────────────────────────
  /** Replace the whole wallet (player edits / merchant change). */
  const setActorCoins = useCallback(async (actorId: string, coins: Coins) => {
    await commitState(patchActorCoins(stateRef.current, actorId, coins));
  }, [commitState]);
  /** Add (or subtract) one coin type — DM grants, merchant payouts. */
  const grantActorCoinAmount = useCallback(async (actorId: string, type: CoinType, amount: number) => {
    await commitState(grantActorCoin(stateRef.current, actorId, type, amount));
  }, [commitState]);
  /** Pay a copper price from the wallet, auto-converting + making change. */
  const spendActorCopper = useCallback(async (actorId: string, copper: number) => {
    const next = patchActorCoins(stateRef.current, actorId, spendCopper(coinsOf(stateRef.current, actorId), copper));
    await commitState(next);
  }, [commitState]);
  const getActorCoins = useCallback((actorId: string): Coins => coinsOf(stateRef.current, actorId), []);
  const getActorCopper = useCallback((actorId: string): number => copperOf(stateRef.current, actorId), []);

  // ── Read helpers ─────────────────────────────────────────────────────────────

  const getActorHp = useCallback((actorId: string): HitPoints => {
    const live = stateRef.current.actorLiveState[actorId];
    if (live) return live.hp;
    const actor = actors.find(a => a.id === actorId);
    return actor ? actor.stats.hp : { current: 1, max: 1, temp: 0 };
  }, [actors]);

  const getActorInitiative = useCallback((actorId: string): number | null => {
    return stateRef.current.actorLiveState[actorId]?.initiative ?? null;
  }, []);

  const getActorTrackers = useCallback((actorId: string): Record<string, FdmcStatusTracker> => {
    return stateRef.current.actorLiveState[actorId]?.statusTrackers ?? {};
  }, []);

  const getActorConditions = useCallback((actorId: string): string[] => {
    return stateRef.current.actorLiveState[actorId]?.activeConditions ?? [];
  }, []);

  const getActorGold = useCallback((actorId: string): number => {
    return stateRef.current.actorLiveState[actorId]?.gold ?? 0;
  }, []);

  const getActorLiveState = useCallback((actorId: string): FdmcActorLiveState | undefined => {
    return stateRef.current.actorLiveState[actorId];
  }, []);

  const getRoomStateBytes = useCallback((): number => {
    return estimateRoomLiveStateBytes(stateRef.current);
  }, []);

  // Force a fresh pull from room metadata — used by player seat screen refresh button
  const refreshFromRoom = useCallback(async (): Promise<void> => {
    const roomVal = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
    if (!roomVal) return;
    const merged = seedActorLiveState(actors, roomVal);
    writeLocalFallback(merged);
    stateRef.current = merged;
    setRoomState(merged);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    roomLiveState: roomState,
    setActorHp,
    setActorInitiative,
    setActorTracker,
    setActorConditions,
    setActorGold,
    adjustActorGold,
    setActorCoins,
    grantActorCoinAmount,
    spendActorCopper,
    getActorCoins,
    getActorCopper,
    getActorHp,
    getActorInitiative,
    getActorTrackers,
    getActorConditions,
    getActorGold,
    getActorLiveState,
    getRoomStateBytes,
    commitRoomState: commitState,
    refreshFromRoom,
  };
}
