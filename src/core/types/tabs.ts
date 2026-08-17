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
 * Two questions decide the mode: DOES IT ROLL, and WHOSE ROLL IS IT?
 *
 *   attack-roll    : rolls 1d20 to hit → hold result → Hit / Miss / Crit
 *   dc-check       : the TARGET rolls against a DC → Applies / No Effect
 *   ability-check  : the PLAYER rolls a skill/ability check → Pass / Fail
 *   damage-only    : straight dice, no hit/miss step (a burst, a save rider's damage)
 *   healing        : same as damage-only, logged as healing
 *
 *   triggered      : rolls its OWN dice, standalone, with no hit/miss step. Fires and resolves
 *                    by itself. Second Wind is triggered — press it, roll 1d10+level, done.
 *
 *   additive       : rolls NOTHING by itself; it ARMS a rider that attaches to a LATER roll.
 *                    Hunter's Mark is additive — using it adds 1d6 to your next weapon hits.
 *                    The distinction from `triggered` is whose roll the dice land on: its own,
 *                    or somebody else's.
 *
 *   utility        : CLICKABLE, but rolls nothing and never will — no dice, no check. The
 *                    click is the whole action: it logs that the thing happened and spends its
 *                    economy. Relentless Endurance, Heavenly Wings, a stance you turn on.
 *
 *   passive        : NOT clickable. Display text only, and never renders a button. If it has an
 *                    action cost it is not passive — it is `utility`.
 */
export type ActionOutcomeMode =
  | "attack-roll"
  | "dc-check"
  | "ability-check"
  | "damage-only"
  | "healing"
  | "triggered"
  | "additive"
  | "utility"
  | "passive";

/**
 * LEGACY. "reference" meant two things at once — no dice AND (sometimes) not clickable — which
 * is why a bond tagged reference still spent the bond slot. It is split into `passive` and
 * `utility` and normalised away on read; nothing should author it any more.
 */
export type LegacyOutcomeMode = ActionOutcomeMode | "reference";

/**
 * "reference" -> passive. Anything that carried an action cost was never really passive, but
 * the old tag could not say so; those are the ones to re-author as `utility`.
 */
export function normalizeOutcomeMode(mode: LegacyOutcomeMode | undefined): ActionOutcomeMode | undefined {
  return mode === "reference" ? "passive" : mode;
}

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
  /** Equipment-tab items only: this item must be attuned to work. Carried on the action (not
   *  looked up in the library) so the card can count attunement without resolving items —
   *  the same reason statEffects are baked at attach time. Only EQUIPPED items count. */
  attunementRequired?: boolean;
  /** Equipment-tab items only: the worn slot, carried so the card can enforce exclusivity
   *  without a library lookup. Absent = carried, not worn. See EquipmentSlot. */
  slot?: string;
  /**
   * Equipment-tab items only: this item is part of the Convergence system.
   *
   * A player cannot CREATE a convergence item, but they have to be able to see that they are
   * holding one — otherwise the forge panel offers up inputs the player had no way to know
   * they owned. Authority and knowledge are different things: the lock is on authoring, not
   * on being told what the item is.
   *
   * Carried on the action rather than resolved from the library for the same reason as
   * `attunementRequired` and `slot` — the card must not need a library lookup to render.
   */
  convergence?: { role?: string; mechanicalTag?: string };
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
  /**
   * LEGACY — no longer written or read. Every spell is castable from its own level upward;
   * where a spell stops is `maxSpellLevel`, one number instead of a list. Kept on the type
   * only so actors saved before that change still parse.
   */
  usableSpellLevels?: number[];
  /**
   * Feats/features only: how many extra WEAPON MASTERY properties this grants.
   *
   * The Weapon Master feat gives a non-martial one mastery. An explicit number, never inferred
   * from the feat's name — "Weapon Master" is a title, and titles are not data.
   */
  masteryGrant?: number;
  /**
   * CANTRIP SCALING — the damage this cantrip deals at character levels 5, 11 and 17.
   *
   * A cantrip has no slot to upcast, so `upcastDamage` cannot describe it: it steps on
   * CHARACTER level, at three fixed points, and it REPLACES the base rather than adding to
   * it — Fire Bolt is 2d10 at 5th, not 1d10 + 1d10. Each tier is a whole damage expression
   * for that reason, and a blank tier simply means "no change yet".
   */
  cantripTiers?: { l5?: string; l11?: string; l17?: string };
  /**
   * A ONCE-PER-TURN rider this action arms rather than resolves.
   *
   * Two shapes, one mechanism: `extraAttack` arms "+1 attack available" (Hew, Distant Strike)
   * and `damage` arms a damage rider (the Tier 3 weapons). Both are claimed by clicking, both
   * are spent once, and both come back at the start of the character's turn.
   */
  turnRider?: { kind: "extraAttack" | "damage"; damage?: string; label?: string };
  /**
   * Highest slot level this spell may be cast at. Absent = up to 9th.
   *
   * For the few things that genuinely stop scaling — Divine Smite caps at a 5th-level slot,
   * so a 6th adds nothing and offering it only invites a wasted slot.
   */
  maxSpellLevel?: number;
  /** F02 — casting time type */
  castingTimeType?: CastingTimeType;
  /** Explicit outcome mode — set this to skip inference and lock the roll behavior */
  outcomeMode?: ActionOutcomeMode;
  /** Adaptive/chassis state, carried from EquipmentItem so the card can offer the grip switch
   *  and re-derive dice without a library lookup. `chassis.formId` is the chosen weapon form. */
  chassis?: { categories?: string[]; ability?: string; requireTags?: string[]; anyOfTags?: string[]; formId?: string };
  /** How a versatile chassis form is held right now. Changing it is free — see the grip switch. */
  grip?: "1h" | "2h";
  chassisBonus?: number;
  pbToDamage?: boolean;
  /** Player-toggled conditional extras carried from the item — see ItemRider. The app tracks
   *  the cadence and rolls the dice; the table rules on whether the trigger happened. */
  riders?: Array<{ id: string; label: string; formula?: string; damageType?: string; cadence: string; condition?: string }>;
  /** Charge tracking — carried from EquipmentItem for items with limited uses */
  charges?: { max: number; reset: "longRest" | "shortRest" | "encounter" | "manual"; note?: string };
  /** Live "remaining/max" for the item pool above, stamped at render by the card (the counter
   *  is state, not authored data). Shown as an always-visible chip on the action row. */
  chargeReadout?: string;
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
  /** Shift to the spell SAVE DC from the same focus ("+1"). The DC is a printed target, so
   *  this moves the number rather than appending a term to a roll. */
  spellFocusSaveDc?: string;
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
    /**
     * ⚠ ALWAYS write the explicit `+` — `1d20+@SPELL`, never `1d20@SPELL`. It is not
     * cosmetic. It guarantees the term is READ: in `1d20@STR@PROF+1` a var that fails to
     * resolve can swallow the segment and leave `1d20+1`. It is also what makes stacking
     * legible — `1d20+@SPELL+@CHA` with Sacred Weapon up, or a weapon's
     * `1d20+@PROF+@STR+1`. `normalizeRollFormula` already collapses `++`, so the separator
     * costs nothing and fails safe.
     *
     * Attack formula. OMIT IT — it defaults to `1d20+@SPELL`, which the card already knows:
     * `@SPELL` resolves to the spellcasting modifier plus proficiency, following the actor's
     * own class and any `spell-uses-*` tag that swaps the stat.
     *
     * Hard-coding a number here ("1d20+6") freezes the bonus at the level it was authored,
     * so it silently stops being right the moment the character levels or the stat changes.
     * Only set it for a spell that deliberately attacks off something other than the caster's
     * own spell attack bonus.
     */
    attack?: string;
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
