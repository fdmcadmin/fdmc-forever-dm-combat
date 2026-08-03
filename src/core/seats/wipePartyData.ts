/**
 * Party-character wipe — a clean slate for re-importing the party.
 *
 * WHY THIS EXISTS: import MERGES (`{...currentLibrary, ...imported}`), and several layers
 * are keyed by ACTOR ID. Re-importing a party that reuses the same ids (lights-stone,
 * ripsnarl, …) therefore inherits whatever the old build left behind:
 *   - resource counters keyed `actorId → resourceActionId` (Rage stuck at 1/3)
 *   - live HP / temp / coins in room metadata, keyed by actorId
 *   - action economy, committed rolls, notes, session state
 * Deleting the actors alone does NOT clear any of that. This wipes every PC-owned layer
 * so a fresh import starts genuinely clean.
 *
 * DELIBERATELY PRESERVED — this is a PARTY wipe, not a factory reset:
 *   monsters, encounters, equipment libraries, the module unlock, seat configuration
 *   (seats re-bind by actor id, so an import reusing the same ids lands back in its seats).
 */

const PARTY_LOCAL_KEYS = [
  "fdmc.dm.actorLibrary.v1",          // the actors themselves
  "fdmc.dm.actorOverrides.v1",        // per-actor overrides layered on the library
  "fdmc.dm.actorLibrary.seedVersion", // else the bundled party silently re-seeds
  "fdmc.resource.counters.v1",        // spell slots / Rage / Channel Divinity counts
  "fdmc.player.actorCache.v1",        // player-side copy pushed over the seat channel
  "fdmc.actor.liveState.v1",          // legacy local live-state mirror
  "fdmc.pending.actor.v1",            // half-finished actor drafts
  "forever-dm-combat:action-economy-state:v1",
  "forever-dm-combat:committed-roll-state:v1",
  "forever-dm-combat:actor-card-session-state:v1",
  "forever-dm-combat.actor-notes.v0.3.0b",
  "forever-dm-combat.actor-notes.v0.3.0a",
] as const;

export type PartyWipeReport = {
  /** Storage keys actually present and removed. */
  cleared: string[];
  /** Actor ids removed from the library. */
  actorIds: string[];
  /** True once the room-metadata live state was cleared too. */
  liveStateCleared: boolean;
};

/**
 * Clear every LOCAL party layer. Returns what was actually removed so the UI can report
 * it honestly rather than claiming success blindly.
 *
 * NOTE: room metadata (live HP/coins/initiative) is NOT local — clear it via
 * `buildClearedActorLiveState` below, which the caller publishes.
 */
export function wipePartyLocalData(): PartyWipeReport {
  const cleared: string[] = [];
  let actorIds: string[] = [];

  try {
    const raw = window.localStorage.getItem("fdmc.dm.actorLibrary.v1");
    if (raw) actorIds = Object.keys(JSON.parse(raw) as Record<string, unknown>);
  } catch { /* unreadable library — still wipe it below */ }

  for (const key of PARTY_LOCAL_KEYS) {
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        cleared.push(key);
      }
    } catch { /* storage unavailable — nothing to clear */ }
  }

  return { cleared, actorIds, liveStateCleared: false };
}

/**
 * The room live state with every ACTOR-owned entry emptied — live HP, temp HP, coins,
 * initiative, status trackers and conditions — while monsters, seats and combat phase are
 * left untouched. Publish the result to wipe the shared layer.
 */
export function buildClearedActorLiveState<T extends { actorLiveState: Record<string, unknown> }>(state: T): T {
  return { ...state, actorLiveState: {} };
}
