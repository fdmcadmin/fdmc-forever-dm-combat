import type { ActionCost } from "./actionEconomy";
import type { TabId } from "./tabs";

export type CombatLogEntryTone = "combat" | "table-note" | "system";

/**
 * Structured facts behind a log line, so the same event can be RENDERED as a sentence in
 * the tracker and AGGREGATED into the encounter summary. A flat message string can be read
 * but never re-totalled, which is why the summary stats were not previously computable.
 *
 * All optional and purely additive — every existing addEntry call still works.
 */
export type CombatLogFacts = {
  /** Stable id of whoever ACTED. Names collide and get renamed; totals need an id. */
  actorId?: string;
  /** Which side acted. The summary groups by this so "who carried the fight" is a party
   *  question and is not won by the boss simply because it swung the hardest. */
  actorSide?: "party" | "monster";
  targetId?: string;
  targetName?: string;
  /** Damage dealt, healing done, or resource points spent — always POSITIVE. */
  amount?: number;
  /** Which total this feeds. `hp-change` alone cannot tell damage from healing. */
  category?: "damage" | "healing" | "resource" | "roll" | "flow";
  /**
   * Which economy it came from. Reactions and legendary actions interject into someone
   * else's turn — this is what stops them being credited to the turn owner.
   */
  sourceKind?: "action" | "bonus" | "reaction" | "legendary" | "free";
  /** Whose turn it happened during, recorded only when that differs from the actor. */
  turnOwnerId?: string;
  turnOwnerName?: string;
  /** "attributed" = came from a known card's button. "inferred" = derived from the
   *  active turn, so a summary can report it as such rather than overstating a total. */
  attribution?: "attributed" | "inferred";
  /** Round it happened in — lets an export segment a fight by round. */
  round?: number;
  /** For attack lines: the natural d20 and what it came to. */
  naturalRoll?: number;
  /** hit / miss / crit / fumble / save-made / save-failed — drives the sentence. */
  outcome?: string;
  /** Damage type, spell slot level, and any riders that fired, for the full sentence. */
  damageType?: string;
  slotLevel?: number;
  riders?: string[];
};

export type CombatLogEntry = {
  id: string;
  actorName: string;
  actionName: string;
  message: string;
  rollResult?: string;
  timestamp: string;
  tabId?: TabId | "pinned" | "system";
  actionCosts?: ActionCost[];
  pendingKey?: string;
  tone?: CombatLogEntryTone;
} & CombatLogFacts;

export type AddCombatLogEntryInput = {
  actorName: string;
  actionName: string;
  message?: string;
  rollResult?: string;
  tabId?: TabId | "pinned" | "system";
  actionCosts?: ActionCost[];
  pendingKey?: string;
  supersedePendingKeys?: string[];
  tone?: CombatLogEntryTone;
} & CombatLogFacts;
