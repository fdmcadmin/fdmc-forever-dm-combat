import type { ActionCost } from "./actionEconomy";

export type TabId =
  | "main"
  | "bonus"
  | "spells"
  | "bond"
  | "checks"
  | "features"
  | "status"
  | "equipment"
  | "resources"
  | "outOfCombat"
  | "notes";

export type TabDefinition = {
  id: TabId;
  label: string;
};

export type ActionKind =
  | "attack"
  | "spell"
  | "bond"
  | "check"
  | "equipment"
  | "resource"
  | "feature"
  | "utility"
  | "note"
  | "reminder";

export type ActionLogMode = "default" | "table-note" | "silent";
export type ActionDisplayMode = "card" | "compact";

/**
 * Explicit outcome mode — overrides TabPanel's inference when set.
 *
 * attack-roll    : 1d20 attack → hold result → Hit / Miss / Crit
 * dc-check       : spell/ability targets make a save → Applies / No Effect
 * ability-check  : player rolls a skill/ability check → Pass / Fail
 * damage-only    : straight dice roll, no hit/miss resolution (healing, damage riders)
 * healing        : same as damage-only but logged as healing
 * triggered      : effect triggers, may roll formula, no hit/miss prompt
 * reference      : display text only, no roll button rendered ever
 */
export type ActionOutcomeMode =
  | "attack-roll"
  | "dc-check"
  | "ability-check"
  | "damage-only"
  | "healing"
  | "triggered"
  | "reference";

// F05 — resource kind determines rest reset behavior
export type ResourceKind = "spellSlot" | "pactSlot" | "freeCast" | "pool" | "toggle" | "counter";

// F02 — spell casting time type
export type CastingTimeType = "action" | "bonus" | "reaction" | "ritual" | "special";

export type ActorActionMetadata = {
  attack?: string;
  damage?: string;
  crit?: string;
  saveDc?: string;
  range?: string;
  cost?: string;
  slotCost?: string;
  spellLevel?: number;
  details?: string;
  concentration?: string;
  withModifier?: string;
  additive?: string;
  critThreshold?: number;
  attackUses?: number;
  diceLabel?: string;
  initiativeBonus?: number;
  /** F05 — resource kind for rest reset behavior */
  resourceKind?: ResourceKind;
  /** F02 — spell slot mode: which resource pool this spell uses */
  spellSlotMode?: "standard" | "pact" | "freeCast" | "none";
  /** F02 — level the spell is currently set to cast at */
  selectedCastLevel?: number | null;
  /** F02 — levels this spell can be cast at (empty = any level) */
  usableSpellLevels?: number[];
  /** F02 — casting time type */
  castingTimeType?: CastingTimeType;
  /** Explicit outcome mode — set this to skip inference and lock the roll behavior */
  outcomeMode?: ActionOutcomeMode;
  /** Charge tracking — carried from EquipmentItem for items with limited uses */
  charges?: { max: number; reset: "longRest" | "shortRest" | "manual" };
  /** Effect descriptor — carried from EquipmentItem for charge-gated effects */
  effect?: { type: string; label?: string; formula?: string; value?: string; condition?: string };
  /**
   * Passive stat effects baked in at attach time.
   * Includes both explicit statEffects from the library item AND synthesized AC effects
   * from the item's ac string (e.g. "14", "+2").
   * deriveActorStats reads these directly — no library lookup needed.
   * Actor records are self-contained: library changes don't silently affect equipped items.
   */
  statEffects?: Array<{ type: string; stat?: string; value: number; condition?: string }>;
  /** AC display string carried from item (e.g. "14", "+2", "11 + DEX") — for equipment tab display only */
  acDisplay?: string;
};

export type ActorAction = {
  id: string;
  label: string;
  description?: string;
  logMessage?: string;
  rollResult?: string;
  actionKind?: ActionKind;
  economyCost?: ActionCost[];
  logMode?: ActionLogMode;
  displayMode?: ActionDisplayMode;
  disabled?: boolean;
  category?: string;
  tags?: string[];
  metadata?: ActorActionMetadata;
  hasDefinedUse?: boolean;
  pinned?: boolean;
  pinReaction?: boolean;
  concentration?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
};

export type TabActionMap = Record<TabId, ActorAction[]>;
