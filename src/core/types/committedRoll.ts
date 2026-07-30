import type { ActionCost } from "./actionEconomy";
import type { TabId } from "./tabs";

export type CommittedRollPhase = "committed" | "result-held" | "awaiting-damage" | "awaiting-resolution";

export type CommittedRollOutcomeMode = "attack-roll" | "ability-check" | "dc-check" | "triggered";

export type CommittedRollOutcome = "hit" | "miss" | "reroll";

export type CommittedRollDamageChoice = "damage" | "crit";

export type CombatRulesProfileId = "dnd5e" | "dnd5e-2024" | "generic" | "custom";

export type CombatRulesProfile = {
  id: CombatRulesProfileId;
  label: string;
  naturalAttack20AutoHits: boolean;
  naturalAttack20Crits: boolean;
  naturalAttack1CriticalFailure: boolean;
};

export const DEFAULT_COMBAT_RULES_PROFILE: CombatRulesProfile = {
  id: "dnd5e",
  label: "D&D 5e / 5.5e",
  naturalAttack20AutoHits: true,
  naturalAttack20Crits: true,
  naturalAttack1CriticalFailure: true,
};

export type CommittedRollState = {
  readiedKey: string;
  actionId: string;
  actionLabel: string;
  sourceTabId: TabId | "pinned";
  costs: ActionCost[];
  phase: CommittedRollPhase;
  outcomeMode: CommittedRollOutcomeMode;
  rollResult: string;
  naturalRoll: number | null;
  isCrit: boolean;
  isCriticalFailure: boolean;
  critThreshold: number;
  rulesProfile: CombatRulesProfile;
  requiresRollResult: boolean;
  hasDamageChoice: boolean;
  hasCritDamageChoice: boolean;
  attackFormula?: string;
  saveDc?: string;
  damageFormula?: string;
  critDamageFormula?: string;
  outcome?: CommittedRollOutcome;
  damageChoice?: CommittedRollDamageChoice;
  rerollCount: number;
  bridgeRequestId: string;
  bridgeSentCount: number;
};

export type StartCommittedRollInput = {
  readiedKey: string;
  actionId: string;
  actionLabel: string;
  sourceTabId: TabId | "pinned";
  costs: ActionCost[];
  outcomeMode?: CommittedRollOutcomeMode;
  attackFormula?: string;
  saveDc?: string;
  damageFormula?: string;
  critDamageFormula?: string;
  critThreshold?: number;
  rulesProfile?: CombatRulesProfile;
  bridgeRequestId?: string;
  /**
   * This commit is a later roll of an action already in progress — ray 2+ of a multi-roll
   * spell, or swing 2+ of Extra Attack — not a new use of it.
   *
   * Resource spending hangs off this flag. Every committed roll normally spends the action's
   * resources, which is right for a weapon (it has none) and right for a single-roll spell.
   * A 3-ray Scorching Ray commits three times, so without this it would spend three slots for
   * one cast. One cast, one slot.
   */
  continuesMultiRoll?: boolean;
  /** The level a spell is being cast at, when the player upcast it. Absent = as authored. */
  castLevel?: number;
};

export type CommittedRollMap = Record<string, CommittedRollState | null>;
