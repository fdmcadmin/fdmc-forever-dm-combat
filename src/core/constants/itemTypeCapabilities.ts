/**
 * WHAT EACH ITEM TYPE IS ALLOWED TO CARRY — one table, read by BOTH item editors.
 *
 * Christopher, 2026-08-17: *"each gear type should only allow the editing of fields that would
 * effect those types… right now the long scroll of creating any item is too much."*
 *
 * ⚠ ONE TABLE ON PURPOSE. There are two item editors — `EquipmentBagEditor` (player-reachable
 * through level-up) and the library's standalone `ItemForm` — and a field added or gated in one
 * has three times been left unreachable in the other. Both import this. A new capability is a
 * row here, not an `if` in a component.
 *
 * The rulings this encodes, in his words:
 *   · *"weapons are weapons, armor is armor with armor type, gear is a tag for items like tools
 *      and traps"*
 *   · *"magic is a type of item, this is why wonderous items are listed here, magical as a
 *      weapon would be a weapon and is magical which would be true if +1 is ever part of it"* —
 *      so `magic` means WONDROUS. A +1 sword is a `weapon`; being magical is a property of the
 *      item, never its type.
 *   · *"you shouldnt be able to add convergence on weapons and armor, this is why they are
 *      wonderous items"* — convergence is wondrous-only.
 *   · *"you shouldnt be able to add a AC on anything except armor, and magical items"*
 *   · *"charge is one of the only fields that should be possible on any item"*
 *   · *"passive at this point is nothing"* — retired below.
 */

export type ItemType =
  | "weapon" | "armor" | "shield" | "consumable" | "gear" | "magic" | "tool"
  /** @deprecated Dead — nothing uses it and only one editor ever offered it. Kept so existing
   *  records still parse; never offer it as a choice. */
  | "passive";

/** The types a DM may actually choose. `passive` is deliberately absent. */
export const SELECTABLE_ITEM_TYPES: ItemType[] = [
  "weapon", "armor", "shield", "consumable", "gear", "magic", "tool",
];

/** One line each, so the editor can say what a type is FOR rather than leaving it to be guessed. */
export const ITEM_TYPE_BLURB: Record<ItemType, string> = {
  weapon: "Rolls to hit. A magical weapon is still a weapon — the +1 is a property, not a type.",
  armor: "Worn body armour. Carries an armour type and sets AC.",
  shield: "Held. Adds to AC.",
  consumable: "Used up. Carries a count of how many are held.",
  gear: "Mundane kit — rope, traps, spending lines. The catch-all.",
  magic: "A wondrous item. This is the only type that can be Convergence.",
  tool: "A tool set or kit used with a proficiency.",
  passive: "Retired — nothing uses this.",
};

export type ItemCapability =
  /**
   * A TO-HIT ROLL: 1d20 attack + damage + crit, and the chassis that generates them.
   * Only things that swing. A wondrous item never has this.
   */
  | "attackDice"
  /**
   * DICE THAT ARE NOT AN ATTACK — the shape almost every Convergence item actually is.
   *
   * ⚠ THIS IS THE CORRECTION TO MY OWN GATING. I gave wondrous items no dice at all, on the
   * reasoning that they make no attack roll. True, and not the same thing: the A3/T3/T4 packet
   * (2026-08-17) has every item as a Rider, Reaction, Bonus Action, Magic Action or Passive, and
   * several of them ROLL —
   *     Thornwake Splinter   "when you deal damage with an attack, deal +2d8"   (rider)
   *     Bloodbriar Seed      "the first allied hit … deals +2d8"                (rider, ally's hit)
   *     T4 rider             "when you hit, deal +2d10"                         (rider)
   *     deferred-damage T4   "roll 2d8, reduce the triggering damage"           (REDUCTION)
   *     ability-check T4     "add 1d10, potentially succeeding"                 (a check bonus)
   * — so they need a die to roll and no to-hit to roll it behind.
   *
   * Note this is NOT necessarily damage: three of the campaign's convergence dice are damage
   * REDUCTION and one is added to a saving throw. MASTER already records that the outcome
   * vocabulary has no mode for "roll this, it is not damage"; that gap is still open, and this
   * field at least gives the dice somewhere to live rather than forcing them into `damage`.
   */
  | "effectDice"
  /** Reach or range. */
  | "range"
  /** Weapon category + mastery. Mastery is INHERITED when the item resolves to a base weapon. */
  | "mastery"
  /** An AC value — "16", "14 + DEX (max 2)", or "+2" for a shield. */
  | "ac"
  /** Light / medium / heavy, which decides how DEX applies. */
  | "armorType"
  /** How many are carried. */
  | "count"
  /** A save DC the target rolls against. */
  | "saveDc"
  /** Spellcasting focus: supplies @SPELL, plus the item's own extra. */
  | "spellFocus"
  /** Convergence input/output role. WONDROUS ONLY. */
  | "convergence"
  /** Requires attunement — competes for the limit of three. */
  | "attunement"
  /** A charge pool. Allowed on EVERYTHING, by ruling. */
  | "charges"
  /** Arbitrary stat effects (+1 STR, +5 HP…). */
  | "statEffects";

/**
 * ⚠ `charges` IS ON EVERY ROW BY RULING, not by oversight — *"charge is one of the only fields
 * that should be possible on any item."* If a row ever loses it, that is a bug.
 */
export const ITEM_TYPE_CAPABILITIES: Record<ItemType, readonly ItemCapability[]> = {
  weapon: ["attackDice", "range", "mastery", "saveDc", "spellFocus", "attunement", "charges", "statEffects"],
  armor: ["ac", "armorType", "attunement", "charges", "statEffects"],
  shield: ["ac", "attunement", "charges", "statEffects"],
  // A thrown vial swings; a drunk potion does not. Both shapes are allowed here.
  consumable: ["count", "attackDice", "effectDice", "saveDc", "range", "charges"],
  gear: ["count", "charges"],
  /**
   * Wondrous. The ONLY type that may be Convergence, and the only non-armour that may set AC.
   * `effectDice` WITHOUT `attackDice` is the whole shape of a Convergence item: it rolls, and
   * what it rolls rides someone else's hit, reduces damage, or lifts a check.
   */
  magic: ["ac", "effectDice", "saveDc", "spellFocus", "convergence", "attunement", "charges", "statEffects"],
  tool: ["count", "charges"],
  passive: ["charges"],
};

/** Does this item type carry this field? */
export function itemTypeAllows(type: ItemType | undefined, capability: ItemCapability): boolean {
  if (!type) return false;
  return (ITEM_TYPE_CAPABILITIES[type] ?? []).includes(capability);
}

/** Armour types, and what each does with DEX. Display/derivation reference for the editor. */
export const ARMOR_TYPES = [
  { id: "light", label: "Light", note: "Full DEX applies." },
  { id: "medium", label: "Medium", note: "DEX applies, capped at +2." },
  { id: "heavy", label: "Heavy", note: "No DEX. May set a Strength requirement." },
] as const;

export type ArmorTypeId = (typeof ARMOR_TYPES)[number]["id"];

/**
 * WHAT A SET OF EFFECT DICE MEANS. Christopher, 2026-08-17: *"kind should be- damage, healing,
 * temp, reduction."*
 *
 * ⚠ THE MODE IS SHARED; THE KIND IS NOT. Healing, temp HP and reduction all resolve through the
 * `healing` outcome mode — they are all HP the bearer keeps, so none of them may be announced as
 * damage dealt. But they are three different things at the table, and collapsing them into one
 * word is why I mistakenly reported the vocabulary as missing a mode for "roll this, it is not
 * damage". It was not missing. It was unlabelled.
 */
export const EFFECT_KINDS = [
  { id: "damage", label: "Damage", mode: "damage-only", rollLabel: "Roll Damage",
    note: "Damage dealt — including a rider on someone else's hit." },
  { id: "healing", label: "Healing", mode: "healing", rollLabel: "Roll Healing",
    note: "HP restored to a creature." },
  { id: "temp", label: "Temp HP", mode: "healing", rollLabel: "Roll Temp HP",
    note: "Temporary HP granted. Does not stack with itself." },
  { id: "reduction", label: "Reduction", mode: "healing", rollLabel: "Roll Reduction",
    note: "Damage PREVENTED, not dealt. Never logged as harm done." },
] as const;

export type EffectKind = (typeof EFFECT_KINDS)[number]["id"];

/** The outcome mode a kind resolves through. Three of the four share `healing`. */
export function outcomeModeForEffectKind(kind: EffectKind | undefined): "damage-only" | "healing" {
  return (EFFECT_KINDS.find(k => k.id === kind)?.mode ?? "damage-only") as "damage-only" | "healing";
}

/** The button text, so a reduction never reads "Roll Damage". */
export function rollLabelForEffectKind(kind: string | undefined): string | undefined {
  return EFFECT_KINDS.find(k => k.id === kind)?.rollLabel;
}
