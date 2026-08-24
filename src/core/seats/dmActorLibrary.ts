import type { Actor } from "../types/actor";
import { resolveActor, buildActorLibraryFromBundled, type ActorOverrideMap } from "../table-state/actorHydrationBoundary";
import { createEmptyRoomLiveState, type FdmcRoomLiveState } from "../table-state/fdmcRoomLiveState";
import type { FdmcSeat } from "./seatTypes";
import { safeStorage } from "../utils/safeStorage";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const ACTOR_LIBRARY_KEY = "fdmc.dm.actorLibrary.v1";
const ACTOR_OVERRIDES_KEY = "fdmc.dm.actorOverrides.v1";
// Bump this when bundled actor source changes to force a re-seed
const ACTOR_LIBRARY_SEED_VERSION = "0.6.0-p5-actors-encoding-fix";
const ACTOR_LIBRARY_SEED_VERSION_KEY = "fdmc.dm.actorLibrary.seedVersion";

// ─── Library storage ──────────────────────────────────────────────────────────

export function loadActorLibrary(): Record<string, Actor> {
  try {
    const raw = safeStorage().getItem(ACTOR_LIBRARY_KEY);
    return raw ? JSON.parse(raw) as Record<string, Actor> : {};
  } catch {
    return {};
  }
}

export function saveActorLibrary(library: Record<string, Actor>): void {
  try {
    safeStorage().setItem(ACTOR_LIBRARY_KEY, JSON.stringify(library));
  } catch {
    // localStorage unavailable — in-memory only
  }
}

// ─── Override storage ─────────────────────────────────────────────────────────

export function loadActorOverrides(): ActorOverrideMap {
  try {
    const raw = safeStorage().getItem(ACTOR_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) as ActorOverrideMap : {};
  } catch {
    return {};
  }
}

export function saveActorOverride(actorId: string, override: Partial<Actor>): void {
  const overrides = loadActorOverrides();
  overrides[actorId] = { ...overrides[actorId], ...override };
  try {
    safeStorage().setItem(ACTOR_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // localStorage unavailable
  }
}

export function clearActorOverride(actorId: string): void {
  const overrides = loadActorOverrides();
  delete overrides[actorId];
  try {
    safeStorage().setItem(ACTOR_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // localStorage unavailable
  }
}

// ─── Seed on first boot ───────────────────────────────────────────────────────

/**
 * If the DM library is empty, seed it from the bundled actor source files.
 * This runs once on first launch. After that, the library is the source of truth
 * and the bundled files are the fallback only.
 */
export function seedLibraryFromBundled(bundledActors: Actor[]): Record<string, Actor> {
  // If no bundled actors provided, just load whatever exists in safeStorage().
  // This is the correct state when actors are built through the UI.
  if (bundledActors.length === 0) {
    return loadActorLibrary();
  }

  // Re-seed if library is empty OR if the bundled actor version has changed
  const storedVersion = safeStorage().getItem(ACTOR_LIBRARY_SEED_VERSION_KEY);
  const existing = loadActorLibrary();
  const needsReseed = Object.keys(existing).length === 0 || storedVersion !== ACTOR_LIBRARY_SEED_VERSION;

  if (!needsReseed) return existing;

  const seeded = buildActorLibraryFromBundled(bundledActors);
  saveActorLibrary(seeded);
  // Clear stale overrides only when reseeding to a new actor version
  if (storedVersion !== ACTOR_LIBRARY_SEED_VERSION) {
    try { safeStorage().removeItem(ACTOR_OVERRIDES_KEY); } catch { /* ok */ }
  }
  try { safeStorage().setItem(ACTOR_LIBRARY_SEED_VERSION_KEY, ACTOR_LIBRARY_SEED_VERSION); } catch { /* ok */ }
  return seeded;
}

// ─── Resolve helpers ──────────────────────────────────────────────────────────

/**
 * Resolve a single actor through the hydration boundary:
 * base (library) + override + live state = final actor
 */
export function resolveActorFromLibrary(
  actorId: string,
  library: Record<string, Actor>,
  overrides: ActorOverrideMap,
  liveState: FdmcRoomLiveState = createEmptyRoomLiveState(),
): Actor | undefined {
  return resolveActor(actorId, library, overrides, liveState);
}

/**
 * Resolve all actors assigned to a seat.
 * Used when DM responds to a seat-claim broadcast.
 */
export function resolveActorsForSeat(
  seat: FdmcSeat,
  library: Record<string, Actor>,
  overrides: ActorOverrideMap,
  liveState: FdmcRoomLiveState,
): Actor[] {
  return seat.actorIds.flatMap(id => {
    const actor = resolveActor(id, library, overrides, liveState);
    return actor ? [actor] : [];
  });
}

/**
 * Add or update an actor in the library.
 *
 * WRITES BOTH LAYERS, because only one of them is visible.
 *
 * A character is resolved as base + override, and tab merging replaces a tab WHOLESALE rather
 * than appending (`{ ...baseTabs, ...overrideTabs }` — see applyLevelUpApproval below). So an
 * override carrying `tabs.equipment` shadows the base array completely. Writing only the base
 * therefore SUCCEEDS AND THEN DISAPPEARS on the next resolve.
 *
 * That is what happened to bought loot, to a convergence output, and to anything else granted
 * by code rather than typed in the editor: the editor saves the override and sticks, while
 * every automated write went to the layer that loses. The DM's own copy showed nothing either,
 * so it read as the item having simply voided.
 *
 * Every caller passes a COMPLETE, already-resolved actor — the whole intended state, not a
 * patch — so mirroring its tabs into an existing override is exactly right: it makes the
 * winning layer agree with the base instead of contradicting it. A deliberate removal still
 * sticks, because the actor being written is the one that no longer has the item.
 *
 * An override is only UPDATED, never created. A character with no override has nothing
 * shadowing its base, and inventing one here would bake resolved state into a layer that never
 * asked for it.
 */
export function upsertActorInLibrary(actor: Actor): void {
  const library = loadActorLibrary();
  library[actor.id] = actor;
  saveActorLibrary(library);

  const override = loadActorOverrides()[actor.id];
  if (override?.tabs) {
    saveActorOverride(actor.id, { ...override, tabs: { ...override.tabs, ...actor.tabs } });
  }
}

/**
 * Apply a level-up approval from the DM.
 * Only the explicitly approved fields are written into the override.
 * Never overwrites live state (HP, initiative, trackers).
 */
export type LevelUpApprovalFields = {
  level?: number;
  hpMax?: number;
  ac?: number;
  tabPatches?: Partial<Actor["tabs"]>;
  classFeatureTracker?: Actor["classFeatureTracker"];
  subtitle?: string;
};

export function applyLevelUpApproval(actorId: string, approved: LevelUpApprovalFields): void {
  const library = loadActorLibrary();
  const overrides = loadActorOverrides();
  const base = library[actorId];
  if (!base) return;

  const existing = overrides[actorId] ?? {};

  const next: Partial<Actor> = { ...existing };

  if (typeof approved.level === "number") next.level = approved.level;
  if (typeof approved.subtitle === "string") next.subtitle = approved.subtitle;
  if (approved.classFeatureTracker) next.classFeatureTracker = approved.classFeatureTracker;

  if (typeof approved.hpMax === "number" || typeof approved.ac === "number") {
    const baseStats = base.stats;
    const overrideStats: Partial<typeof baseStats> = existing.stats ?? {};
    const baseHp = baseStats.hp;
    const overrideHp = overrideStats.hp ?? {};
    next.stats = {
      ...baseStats,
      ...overrideStats,
      ...(typeof approved.ac === "number" ? { ac: approved.ac } : {}),
      hp: {
        current: baseHp.current,
        max: baseHp.max,
        temp: baseHp.temp ?? 0,
        ...overrideHp,
        ...(typeof approved.hpMax === "number" ? { max: approved.hpMax } : {}),
      },
    };
  }

  if (approved.tabPatches) {
    const baseTabs = base.tabs;
    const overrideTabs = existing.tabs ?? {};
    next.tabs = { ...baseTabs, ...overrideTabs, ...approved.tabPatches };
  }

  saveActorOverride(actorId, next);
}
