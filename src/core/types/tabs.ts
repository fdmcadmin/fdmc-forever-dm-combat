import type { ActionCost } from "./actionEconomy";

export type TabId =
  | "main"
  | "bonus"
  | "spells"
  | "bond"
  | "checks"
  | "features"   // rendered as "Class Actions" (P-SHEET)
  | "feats"      // P-SHEET — feats (mechanical effects feed derived stats)
  | "status"
  | "equipment"
  | "resources"
  | "outOfCombat" // back-compat only; no longer rendered as its own tab (P-SHEET)
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
  | "additive"
  | "reference";

// F05 — resource kind determines rest reset behavior
export type ResourceKind = "spellSlot" | "pactSlot" | "freeCast" | "pool" | "toggle" | "counter";

// F02 — spell casting time type
export type CastingTimeType = "action" | "bonus" | "reaction" | "ritual" | "special";

export type ActorActionMetadata = {
  attack?: string;
  damage?: string;
  /** Damage type for the damage formula — standard D&D type or a custom free-text value. */
  damageType?: string;
  crit?: string;
  saveDc?: string;
  range?: string;
  cost?: string;
  slotCost?: string;
  spellLevel?: number;
  details?: string;
  concentration?: string;
  /** How long the effect lasts, e.g. "1 minute", "Concentration, up to 10 min", "Instantaneous". Display only. */
  duration?: string;
  withModifier?: string;
  additive?: string;
  critThreshold?: number;
  attackUses?: number;
  /**
   * Multi-roll spells — ONE cast, ONE slot, but several separate attack rolls that are each
   * resolved hit/miss with their own damage. Scorching Ray is the canonical case: 3 rays at
   * L2, each its own ranged spell attack. Eldritch Blast, Eldritch Spear, Hail of Thorns and
   * every "make N attacks" spell use the same shape.
   *
   * This is NOT `attackUses` (weapon Extra Attack) — that scales off the actor and grants
   * repeat uses of the Attack ACTION. A ray count belongs to the spell and must never let the
   * cast spend its slot more than once.
   *
   * `attackRolls` is the count at the spell's BASE level; `attackRollsPerLevel` is how many
   * more rays each slot level above base adds (Scorching Ray: 3 and 1).
   */
  attackRolls?: number;
  attackRollsPerLevel?: number;
  /**
   * Upcast rider: what ONE extra slot level adds to this spell's damage (or healing).
   *
   * Authored once — "1d6" for Fireball, "2d8" for Cure Wounds — and multiplied by how far
   * above its base level the spell is actually cast. This replaces authoring a separate card
   * per level: the base formula stays the base, and the level picker decides the rider.
   *
   * Leave blank when a spell upcasts by something OTHER than damage — Scorching Ray adds a
   * ray (`attackRollsPerLevel`), not dice; setting both would double-count.
   */
  upcastDamage?: string;
  diceLabel?: string;
  initiativeBonus?: number;
  /** Equipment-tab items only: false = carried but NOT equipped (its stat effects /
   *  AC / spell-focus bonuses stop applying). undefined/true = equipped. Lets a player
   *  unequip an item without removing it from the character. */
  equipped?: boolean;
  /** F05 — resource kind for rest reset behavior */
  resourceKind?: ResourceKind;
  /**
   * How much of this pool comes back on a SHORT rest.
   *
   * D&D is full of "N per Long Rest, regain ONE after a Short Rest" — Channel Divinity
   * (PHB-2024 p.110), Rage, Bardic Inspiration, Superiority Dice. The reset used to be
   * binary (short OR long), so partial recovery could not be expressed at all: authoring it
   * as Long under-restored, and as Short over-restored to full.
   *
   *   undefined → nothing on a short rest (unless the legacy `cost` prose says "short")
   *   a number  → regain that many, capped at max
   *   "all"     → full reset, same as a long rest
   *
   * The LONG rest always restores fully, which is true of every D&D resource that recovers
   * at all — so there is deliberately no `longRestRegain` counterpart.
   */
  shortRestRegain?: number | "all";
  /** F02 — spell slot mode: which resource pool this spell uses.
   *  "freeCast" = class-feature spell: spends a dedicated named resource (not a spell
   *  slot), tracked in the resource list. See classFeatureUses. */
  spellSlotMode?: "standard" | "pact" | "freeCast" | "none";
  /** Class-feature spell: number of uses per long rest. Drives the auto-generated
   *  dedicated resource (pool = this value, reset = Long Rest). */
  classFeatureUses?: number;
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
  /** Spellcasting focus bonuses carried from an EquipmentItem — added to the spells cast
   *  through it (clickable additive on spell attack / damage rolls). */
  spellFocusAttack?: string;
  spellFocusDamage?: string;
  /** Weapon-buff rider (e.g. Hungering Blade): when this spell/ability is toggled on, the
   *  formula is added to the actor's WEAPON attack damage (clickable persistent additive). */
  weaponBuffDamage?: string;
  /** Activated ATTACK-roll rider — the counterpart to weaponBuffDamage, for abilities that
   *  buff to-hit rather than damage (Sacred Weapon +CHA, Bless-style bonuses). Using the
   *  action arms a persistent chip that rides weapon attack rolls until cleared or End
   *  Combat. An ability may set both fields to buff attack and damage together. */
  weaponBuffAttack?: string;
  /**
   * CONJURED-WEAPON spells: casting this ARMS a reusable attack for the spell's duration.
   *
   * Flame Blade, Shadow Blade, finger guns, a Storm cleric holding a spell it may re-cast
   * free — they all share one shape the app could not express. The CAST and the ATTACK are
   * different actions with different costs, and the attack repeats for the duration without
   * spending the resource again:
   *
   *   click the spell  → pay `economyCost` (usually bonus) + its resource → arm the chip
   *   click the chip   → pay `grantsArmedAttack.cost` (usually the Magic action) → roll
   *   chip persists    → until concentration drops or End Combat clears it
   *
   * Authoring it as one card with an attack on it (which is what Flame Blade does today)
   * conflates the two: the bonus action appears to buy the attack, which is right only on
   * the turn it is cast and wrong on every turn after.
   *
   * The armed attack is NOT a weapon attack. It never inherits `attacksPerAction`, never
   * benefits from Extra Attack, and can never be the second Light weapon that enables Nick —
   * it is the specific action the spell grants, not the Attack action.
   */
  grantsArmedAttack?: {
    /** Defaults to the spell's own label. */
    label?: string;
    attack: string;
    damage: string;
    damageType?: string;
    crit?: string;
    range?: string;
    /** What each USE costs. Usually ["main"] — the Magic action. */
    cost?: ActionCost[];
    /** Free-text duration for the chip, e.g. "Concentration, up to 10 min". */
    duration?: string;
  };
  /** Fighting style (Archery, Two-Weapon, Great Weapon): a clickable toggle adding a bonus
   *  to matching weapon attacks. target gates which attacks it rides. */
  combatStyleAttack?: string;
  combatStyleDamage?: string;
  combatStyleTarget?: "ranged" | "melee" | "weapon" | "two-handed";
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
