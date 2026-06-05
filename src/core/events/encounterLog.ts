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
const ENCOUNTER_LOG_MAX = 150;

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
