/**
 * P8 — Encounter Log
 * DM-local localStorage log of all combat events in the current encounter.
 * Max ENCOUNTER_LOG_MAX entries (see the constant), oldest trimmed. Cleared when a new encounter loads.
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

  // ── Attribution (0.6.8.3) ──────────────────────────────────────────────────
  // The summary stats — most damage dealt, damage taken, healing, resources — are only
  // as good as who each entry is credited to, and "whoever's turn it is" is WRONG for a
  // whole class of events.

  /**
   * Which economy the entry came from. Reactions and legendary actions interject into
   * SOMEONE ELSE'S turn, so this is what stops them being credited to the turn owner.
   */
  sourceKind?: "action" | "bonus" | "reaction" | "legendary" | "free";
  /**
   * Whose turn this happened during, when that differs from `actorId`. A PC's opportunity
   * attack on the boss's turn is actorId = the PC, turnOwnerId = the boss — the damage is
   * the PC's, the turn is not.
   */
  turnOwnerId?: string;
  turnOwnerName?: string;
  /**
   * How confident the credit is.
   *   "attributed" — the event came from a known card's action, so the actor is exact.
   *                  Every reaction is attributed, because it is committed from a button.
   *   "inferred"   — derived from the active turn (a manual HP adjustment with no roll
   *                  behind it). Exports should be able to show this, rather than
   *                  silently overstating someone's total.
   */
  attribution?: "attributed" | "inferred";
  /** Bucket for the summary stats. `hp-change` alone cannot tell damage from healing. */
  category?: "damage" | "healing" | "resource" | "roll" | "flow";
};

/**
 * Credit an event to the right actor.
 *
 * A reaction or legendary action fires during another creature's turn, so the turn owner
 * is NOT the actor — crediting by turn would hand a PC's opportunity-attack damage to the
 * monster it interrupted. Anything committed from a card carries its own actor and is
 * exact; only a bare HP adjustment has to fall back to the active turn, and that case is
 * marked "inferred" so it can be reported as such rather than trusted silently.
 */
export function attributeEvent(input: {
  /** The card that acted, when the event came from one. */
  cardActorId?: string;
  cardActorName?: string;
  /** Whose turn it currently is. */
  turnOwnerId?: string;
  turnOwnerName?: string;
  sourceKind?: EncounterLogEntry["sourceKind"];
}): Pick<EncounterLogEntry, "actorId" | "actorName" | "turnOwnerId" | "turnOwnerName" | "sourceKind" | "attribution"> {
  const interjected = input.sourceKind === "reaction" || input.sourceKind === "legendary";
  if (input.cardActorId) {
    return {
      actorId: input.cardActorId,
      actorName: input.cardActorName ?? "",
      // Only record the turn owner when it is someone else — that is the interesting case.
      turnOwnerId: interjected || input.turnOwnerId !== input.cardActorId ? input.turnOwnerId : undefined,
      turnOwnerName: interjected || input.turnOwnerId !== input.cardActorId ? input.turnOwnerName : undefined,
      sourceKind: input.sourceKind,
      attribution: "attributed",
    };
  }
  return {
    actorId: input.turnOwnerId ?? "",
    actorName: input.turnOwnerName ?? "Unknown",
    turnOwnerId: input.turnOwnerId,
    turnOwnerName: input.turnOwnerName,
    sourceKind: input.sourceKind,
    attribution: "inferred",
  };
}

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
 *   rounds          8   (a long fight; the checker reports its own completion round)
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
