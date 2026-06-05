import type { HitPoints } from "../types/actor";
import type { MonsterVisibilityMode } from "../types/monsterTypes";

// ─── Seat types ───────────────────────────────────────────────────────────────

export type FdmcSeat = {
  seatId: string;
  label: string;
  seatMode: "player" | "viewer";
  actorIds: string[];
  primaryActorId: string;
};

export type FdmcSeatBinding = {
  seatId: string;
  viewerSeatKey: string;
  boundAt: string;
};

// ─── Live actor state ─────────────────────────────────────────────────────────

export type FdmcStatusTracker = {
  current: number;
  max: number;
  label: string;
};

export type FdmcActorLiveState = {
  hp: HitPoints;
  initiative: number | null;
  statusTrackers: Record<string, FdmcStatusTracker>;
  activeConditions: string[];
};

// ─── Live monster state ───────────────────────────────────────────────────────

export type FdmcMonsterLiveState = {
  instanceId: string;
  initiative: number | null;
  hp?: { current: number; max: number; temp: number };
};

// ─── Recent event ring buffer ─────────────────────────────────────────────────

export type FdmcRecentEventSlot = {
  i: number;       // 1–7
  actorId: string;
  type: string;
  code: string;
  val: number;
  round: number;
};

export type FdmcRecentEvents = {
  slots: FdmcRecentEventSlot[];
  nextSlot: number;
};

// ─── Root live state ──────────────────────────────────────────────────────────

export type FdmcCombatPhase = "setup" | "initiative" | "combat";

export type FdmcRoomLiveState = {
  schema: "fdmc.room.live.v1";
  revision: number;
  updatedAt: number;
  tableId: string;
  gmControllerId: string | null;
  seats: Record<string, FdmcSeat>;
  seatBindings: Record<string, FdmcSeatBinding>;
  actorLiveState: Record<string, FdmcActorLiveState>;
  monsterLiveState: Record<string, FdmcMonsterLiveState>;
  combat: {
    phase: FdmcCombatPhase;
    activeActorId: string | null;
    round: number;
  };
  recentEvents: FdmcRecentEvents;
};

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createEmptyRoomLiveState(tableId = "unbound-table", gmControllerId: string | null = null): FdmcRoomLiveState {
  return {
    schema: "fdmc.room.live.v1",
    revision: 0,
    updatedAt: Date.now(),
    tableId,
    gmControllerId,
    seats: {},
    seatBindings: {},
    actorLiveState: {},
    monsterLiveState: {},
    combat: { phase: "setup", activeActorId: null, round: 1 },
    recentEvents: { slots: [], nextSlot: 1 },
  };
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function safeNumber(val: unknown, fallback: number): number {
  return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

function normalizeHp(val: unknown): { current: number; max: number; temp: number } {
  const h = (val && typeof val === "object" ? val : {}) as Partial<HitPoints>;
  const max = safeNumber(h.max, 1);
  const current = Math.max(0, Math.min(safeNumber(h.current, max), max));
  return { current, max, temp: Math.max(0, safeNumber(h.temp, 0)) };
}

function normalizeTracker(val: unknown): FdmcStatusTracker {
  const t = (val && typeof val === "object" ? val : {}) as Partial<FdmcStatusTracker>;
  return {
    current: safeNumber(t.current, 0),
    max: safeNumber(t.max, 0),
    label: typeof t.label === "string" ? t.label : "Tracker",
  };
}

function normalizeActorLiveState(val: unknown): FdmcActorLiveState {
  const a = (val && typeof val === "object" ? val : {}) as Partial<FdmcActorLiveState>;
  const rawTrackers = (a.statusTrackers && typeof a.statusTrackers === "object" ? a.statusTrackers : {}) as Record<string, unknown>;
  const conditions = Array.isArray(a.activeConditions) ? a.activeConditions.filter((c): c is string => typeof c === "string") : [];
  return {
    hp: normalizeHp(a.hp),
    initiative: typeof a.initiative === "number" && Number.isFinite(a.initiative) ? a.initiative : null,
    statusTrackers: Object.fromEntries(Object.entries(rawTrackers).map(([k, v]) => [k, normalizeTracker(v)])),
    activeConditions: conditions,
  };
}

function normalizeMonsterLiveState(val: unknown): FdmcMonsterLiveState | null {
  if (!val || typeof val !== "object") return null;
  const m = val as Partial<FdmcMonsterLiveState>;
  if (typeof m.instanceId !== "string" || !m.instanceId) return null;
  return {
    instanceId: m.instanceId,
    initiative: typeof m.initiative === "number" && Number.isFinite(m.initiative) ? m.initiative : null,
  };
}

export function normalizeFdmcRoomLiveState(val: unknown): FdmcRoomLiveState | undefined {
  if (!val || typeof val !== "object") return undefined;
  const s = val as Partial<FdmcRoomLiveState>;
  if (s.schema !== "fdmc.room.live.v1") return undefined;

  const rawActors = (s.actorLiveState && typeof s.actorLiveState === "object" ? s.actorLiveState : {}) as Record<string, unknown>;
  const rawMonsters = (s.monsterLiveState && typeof s.monsterLiveState === "object" ? s.monsterLiveState : {}) as Record<string, unknown>;
  const rawSeats = (s.seats && typeof s.seats === "object" ? s.seats : {}) as Record<string, unknown>;
  const rawBindings = (s.seatBindings && typeof s.seatBindings === "object" ? s.seatBindings : {}) as Record<string, unknown>;
  const rawEvents = (s.recentEvents && typeof s.recentEvents === "object" ? s.recentEvents : {}) as Partial<FdmcRecentEvents>;

  const monsterLiveState: Record<string, FdmcMonsterLiveState> = {};
  for (const [k, v] of Object.entries(rawMonsters)) {
    const normalized = normalizeMonsterLiveState(v);
    if (normalized) monsterLiveState[k] = normalized;
  }

  const combat = s.combat && typeof s.combat === "object" ? s.combat : {};
  const combatObj = combat as Partial<FdmcRoomLiveState["combat"]>;
  const phase: FdmcCombatPhase =
    combatObj.phase === "initiative" ? "initiative" :
    combatObj.phase === "combat" ? "combat" : "setup";

  return {
    schema: "fdmc.room.live.v1",
    revision: safeNumber(s.revision, 0),
    updatedAt: safeNumber(s.updatedAt, Date.now()),
    tableId: typeof s.tableId === "string" ? s.tableId : "unbound-table",
    gmControllerId: typeof s.gmControllerId === "string" ? s.gmControllerId : null,
    seats: Object.fromEntries(
      Object.entries(rawSeats).map(([k, v]) => {
        const seat = (v && typeof v === "object" ? v : {}) as Partial<FdmcSeat>;
        return [k, {
          seatId: typeof seat.seatId === "string" ? seat.seatId : k,
          label: typeof seat.label === "string" ? seat.label : k,
          seatMode: seat.seatMode === "viewer" ? "viewer" : "player",
          actorIds: Array.isArray(seat.actorIds) ? seat.actorIds.filter((id): id is string => typeof id === "string") : [],
          primaryActorId: typeof seat.primaryActorId === "string" ? seat.primaryActorId : "",
        }];
      })
    ),
    seatBindings: Object.fromEntries(
      Object.entries(rawBindings).map(([k, v]) => {
        const b = (v && typeof v === "object" ? v : {}) as Partial<FdmcSeatBinding>;
        return [k, {
          seatId: typeof b.seatId === "string" ? b.seatId : k,
          viewerSeatKey: typeof b.viewerSeatKey === "string" ? b.viewerSeatKey : "",
          boundAt: typeof b.boundAt === "string" ? b.boundAt : new Date().toISOString(),
        }];
      })
    ),
    actorLiveState: Object.fromEntries(Object.entries(rawActors).map(([k, v]) => [k, normalizeActorLiveState(v)])),
    monsterLiveState,
    combat: {
      phase,
      activeActorId: typeof combatObj.activeActorId === "string" ? combatObj.activeActorId : null,
      round: Math.max(1, safeNumber(combatObj.round, 1)),
    },
    recentEvents: {
      slots: Array.isArray(rawEvents.slots) ? rawEvents.slots.filter((s): s is FdmcRecentEventSlot => Boolean(s && typeof s === "object")) : [],
      nextSlot: Math.max(1, Math.min(7, safeNumber(rawEvents.nextSlot, 1))),
    },
  };
}

// ─── Patch helpers ────────────────────────────────────────────────────────────

function stamp(state: FdmcRoomLiveState): FdmcRoomLiveState {
  return { ...state, revision: state.revision + 1, updatedAt: Date.now() };
}

export function patchActorHp(state: FdmcRoomLiveState, actorId: string, hp: HitPoints): FdmcRoomLiveState {
  const current = state.actorLiveState[actorId] ?? { hp, initiative: null, statusTrackers: {}, activeConditions: [] };
  return stamp({
    ...state,
    actorLiveState: {
      ...state.actorLiveState,
      [actorId]: { ...current, hp: { current: hp.current, max: hp.max, temp: hp.temp ?? 0 } },
    },
  });
}

export function patchActorInitiative(state: FdmcRoomLiveState, actorId: string, initiative: number | null): FdmcRoomLiveState {
  const current = state.actorLiveState[actorId] ?? { hp: { current: 1, max: 1, temp: 0 }, initiative: null, statusTrackers: {}, activeConditions: [] };
  return stamp({
    ...state,
    actorLiveState: { ...state.actorLiveState, [actorId]: { ...current, initiative } },
  });
}

export function patchActorTracker(state: FdmcRoomLiveState, actorId: string, trackerId: string, current: number): FdmcRoomLiveState {
  const actorState = state.actorLiveState[actorId];
  if (!actorState) return state;
  const tracker = actorState.statusTrackers[trackerId];
  if (!tracker) return state;
  return stamp({
    ...state,
    actorLiveState: {
      ...state.actorLiveState,
      [actorId]: {
        ...actorState,
        statusTrackers: { ...actorState.statusTrackers, [trackerId]: { ...tracker, current } },
      },
    },
  });
}

export function patchActorConditions(state: FdmcRoomLiveState, actorId: string, conditions: string[]): FdmcRoomLiveState {
  const actorState = state.actorLiveState[actorId];
  if (!actorState) return state;
  return stamp({
    ...state,
    actorLiveState: { ...state.actorLiveState, [actorId]: { ...actorState, activeConditions: conditions } },
  });
}

// Monster initiative only — full monster data stays in DM localStorage, not room metadata
export function patchMonsterHp(state: FdmcRoomLiveState, instanceId: string, hp: { current: number; max: number; temp: number }): FdmcRoomLiveState {
  const existing = state.monsterLiveState[instanceId] ?? { instanceId, initiative: null };
  return stamp({
    ...state,
    monsterLiveState: {
      ...state.monsterLiveState,
      [instanceId]: { ...existing, hp },
    },
  });
}

export function patchMonsterInitiative(state: FdmcRoomLiveState, instanceId: string, initiative: number | null): FdmcRoomLiveState {
  return stamp({
    ...state,
    monsterLiveState: {
      ...state.monsterLiveState,
      [instanceId]: { instanceId, initiative },
    },
  });
}

export function deregisterMonsterInstance(state: FdmcRoomLiveState, instanceId: string): FdmcRoomLiveState {
  const next = { ...state.monsterLiveState };
  delete next[instanceId];
  return stamp({ ...state, monsterLiveState: next });
}

export function patchCombat(state: FdmcRoomLiveState, patch: Partial<FdmcRoomLiveState["combat"]>): FdmcRoomLiveState {
  return stamp({ ...state, combat: { ...state.combat, ...patch } });
}

const RING_SIZE = 7;

export function pushRecentEvent(
  state: FdmcRoomLiveState,
  event: Omit<FdmcRecentEventSlot, "i">
): FdmcRoomLiveState {
  const slot: FdmcRecentEventSlot = { ...event, i: state.recentEvents.nextSlot };
  const slots = state.recentEvents.slots.filter(s => s.i !== slot.i);
  slots.push(slot);
  const nextSlot = (state.recentEvents.nextSlot % RING_SIZE) + 1;
  return stamp({ ...state, recentEvents: { slots, nextSlot } });
}

export function estimateRoomLiveStateBytes(state: FdmcRoomLiveState): number {
  try { return JSON.stringify(state).length; } catch { return 0; }
}
