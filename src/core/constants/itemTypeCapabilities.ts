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
  /** Attack / damage / crit dice, and the chassis that generates them. */
  | "dice"
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
  weapon: ["dice", "range", "mastery", "saveDc", "spellFocus", "attunement", "charges", "statEffects"],
  armor: ["ac", "armorType", "attunement", "charges", "statEffects"],
  shield: ["ac", "attunement", "charges", "statEffects"],
  consumable: ["count", "dice", "saveDc", "range", "charges"],
  gear: ["count", "charges"],
  // Wondrous. The ONLY type that may be Convergence, and the only non-armour that may set AC.
  magic: ["ac", "saveDc", "spellFocus", "convergence", "attunement", "charges", "statEffects"],
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
