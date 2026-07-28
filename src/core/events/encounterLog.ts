/**
 * P8 — Encounter Log
 * DM-local localStorage log of all combat events in the current encounter.
 * Max 150 entries, oldest trimmed. Cleared when a new encounter loads.
 * Used by post-combat summary export.
 */

export type EncounterLogEntry = {
  id: string;
  timestamp: string;
  round: number;
  type: "roll-attack" | "roll-damage" | "hp-change" | "tracker-change" | "tracker-max" | "condition" | "dm-note" | "turn-start" | "turn-end" | "boss-killed" | "system";
  code: string;        // short code: actor initials + action abbrev e.g. "LFD" = Life Drain
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  val: number;         // roll total, damage amount, tracker value
  message: string;
};

const ENCOUNTER_LOG_KEY = "fdmc.dm.encounterLog.v1";

/**
 * How many entries a combat may hold before the OLDEST are dropped.
 *
 * This was 150, which silently truncated exactly the fights it mattered most for. The
 * tracked window is [first initiative roll → End Combat], and one attack is already THREE
 * entries (attack roll, damage roll, HP change), so the count scales with action economy —
 * which is precisely where high-level combat gets blurred and the log is needed.
 *
 * Derivation of the worst realistic case, so this is a budget rather than a guess:
 *
 *   combatants     11   (a 5-6 PC party + companion, a boss and ~4 adds)
 *   rounds          8   (ABSOLUTE_ROUND_CAP in encounterRounds.ts)
 *   entries/turn   ~22  (turn-start, 3-6 attacks x 3 entries, a bonus action,
 *                        a reaction, a resource spend, turn-end)
 *   ---------------------------------------------------------------
 *   11 x 8 x 22   ~1,940, plus legendary actions (3/round x 8), initiative
 *                  rolls and system markers  ->  ~2,050
 *
 * 2500 clears that with headroom while staying bounded, so a runaway loop cannot fill
 * localStorage. At roughly 220 bytes an entry that is ~550KB against a ~5MB budget.
 */
const ENCOUNTER_LOG_MAX = 2500;

export function readEncounterLog(): EncounterLogEntry[] {
  try {
    const raw = window.localStorage.getItem(ENCOUNTER_LOG_KEY);
    return raw ? JSON.parse(raw) as EncounterLogEntry[] : [];
  } catch { return []; }
}

export function appendLogEntry(entry: EncounterLogEntry): void {
  try {
    const existing = readEncounterLog();
    const next = [entry, ...existing].slice(0, ENCOUNTER_LOG_MAX);
    window.localStorage.setItem(ENCOUNTER_LOG_KEY, JSON.stringify(next));
  } catch { /* ok */ }
}

export function clearEncounterLog(): void {
  try { window.localStorage.removeItem(ENCOUNTER_LOG_KEY); } catch { /* ok */ }
}

export function makeLogId(): string {
  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

/** Derive a short code from actor name + action (e.g. "Vaelith Dark Bargain" → "VDB") */
export function makeActionCode(actorName: string, actionName: string): string {
  const actorInitial = actorName.trim()[0]?.toUpperCase() ?? "?";
  const actionWords = actionName.trim().split(/\s+/).filter(Boolean);
  const actionCode = actionWords.map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 3);
  return `${actorInitial}${actionCode}`;
}
