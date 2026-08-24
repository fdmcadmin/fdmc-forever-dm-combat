import { safeStorage } from "../utils/safeStorage";
/**
 * FDMC OBR broadcast channel names.
 *
 * Centralized so every context (DM window, player window, popouts) agrees on the
 * exact wire string — a typo in one copy silently breaks a feature with no error.
 *
 * Authority note: these channels carry only compact, player-safe payloads
 * (rosters, summaries, request signals). They never move full character/actor
 * bodies — DM-owned character truth stays in DM-local storage (see P0 model).
 *
 * Seat/actor-data broadcasts live on `FDMC_SEAT_BROADCAST_CHANNEL`
 * (`core/seats/seatTypes.ts`) and are intentionally kept next to their payload
 * types; this module covers the channels that were otherwise duplicated inline
 * across `App.tsx` and `dm-panel.tsx`.
 */
export const FDMC_CHANNELS = {
  /** DM library changed → other DM windows reload from safeStorage(). */
  dmLibraryUpdated: "forever-dm-combat:dm-library-updated:v1",
  /** Monster popover → main DM window: pull the staged encounter from safeStorage(). */
  encounterLoadRequest: "forever-dm-combat:encounter-load-request:v1",
  /** DM → players: player-safe monster roster snapshot. */
  monsterRoster: "forever-dm-combat:monster-roster:v1",
  /** DM ↔ viewer: player-safe party summary. */
  viewerParty: "forever-dm-combat:viewer-party:v1",
  /** DM ↔ players: player-safe party combatant roster (names + HP) for the shared combat
   * tracker, so every PC (esp. healers) can see ally HP. Monster HP is never in here. */
  partyTracker: "forever-dm-combat:party-tracker:v1",
} as const;
