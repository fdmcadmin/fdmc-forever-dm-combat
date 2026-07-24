// Weapon Mastery (2024 / "5.5e" rules). The 2014 rules have no mastery system —
// the 2014 "Weapon Master" feat only grants proficiencies and is unrelated.
//
// A mastery is NOT active just because you are proficient with the weapon: the
// character needs a feature that unlocks Weapon Mastery for it. The card shows the
// property as reference text on the attack; whether it is unlocked stays a table call.
//
// Source: DnD_5e_5.5e_Weapon_Mastery_Reference.docx (effects paraphrased, not verbatim).

export type WeaponMasteryName =
  | "Cleave" | "Graze" | "Nick" | "Push" | "Sap" | "Slow" | "Topple" | "Vex";

export type WeaponMastery = {
  name: WeaponMasteryName;
  /** One-line rules summary, shown under Information on the attack. */
  summary: string;
  /** The official 2024 weapons that carry this mastery. */
  weapons: string[];
};

export const WEAPON_MASTERIES: Record<WeaponMasteryName, WeaponMastery> = {
  Cleave: {
    name: "Cleave",
    summary:
      "On a melee hit, make one additional attack against a second creature within 5 ft. of the first and within your reach. The second hit deals weapon damage without a positive ability modifier. Once per turn.",
    weapons: ["Greataxe", "Halberd"],
  },
  Graze: {
    name: "Graze",
    summary:
      "When the attack misses, the target still takes damage equal to the ability modifier used for the attack, of the weapon's damage type.",
    weapons: ["Glaive", "Greatsword"],
  },
  Nick: {
    name: "Nick",
    summary:
      "The extra attack from the Light property can be made as part of the Attack action instead of costing a Bonus Action. Still once per turn.",
    weapons: ["Dagger", "Light Hammer", "Sickle", "Scimitar"],
  },
  Push: {
    name: "Push",
    summary: "On a hit, you can move a Large-or-smaller target up to 10 ft. straight away from you.",
    weapons: ["Greatclub", "Pike", "Warhammer", "Heavy Crossbow"],
  },
  Sap: {
    name: "Sap",
    summary: "On a hit, the target has Disadvantage on its next attack roll before the start of your next turn.",
    weapons: ["Mace", "Spear", "Flail", "Longsword", "Morningstar", "War Pick"],
  },
  Slow: {
    name: "Slow",
    summary:
      "On a hit that deals damage, reduce the target's Speed by 10 ft. until the start of your next turn. Multiple Slow weapons do not stack past 10 ft.",
    weapons: ["Club", "Javelin", "Light Crossbow", "Sling", "Whip", "Longbow", "Musket"],
  },
  Topple: {
    name: "Topple",
    summary:
      "On a hit, force a Constitution save (DC 8 + attack ability modifier + proficiency bonus). On a failure the target is Prone.",
    weapons: ["Quarterstaff", "Battleaxe", "Lance", "Maul", "Trident"],
  },
  Vex: {
    name: "Vex",
    summary:
      "On a hit that deals damage, you gain Advantage on your next attack roll against that same creature before the end of your next turn.",
    weapons: ["Handaxe", "Dart", "Shortbow", "Rapier", "Shortsword", "Blowgun", "Hand Crossbow", "Pistol"],
  },
};

export const WEAPON_MASTERY_NAMES = Object.keys(WEAPON_MASTERIES) as WeaponMasteryName[];

/** Every official 2024 weapon → its mastery, built from the tables above. */
export const WEAPON_MASTERY_INDEX: Record<string, WeaponMasteryName> = Object.fromEntries(
  WEAPON_MASTERY_NAMES.flatMap(m => WEAPON_MASTERIES[m].weapons.map(w => [w.toLowerCase(), m])),
);

// ─── Weapon categories ────────────────────────────────────────────────────────
// Melee splits three ways (a Versatile weapon can be swung in one or two hands);
// ranged only ever needs the hand count.

export const WEAPON_CATEGORIES = [
  "Melee One-Handed",
  "Melee Two-Handed",
  "Melee Versatile",
  "Ranged One-Handed",
  "Ranged Two-Handed",
] as const;

export type WeaponCategory = (typeof WEAPON_CATEGORIES)[number];

// Deliberately NO auto-assignment from weapon name. A mastery is only live when the
// character has a feature unlocking it for that weapon, and a Fighter's longsword and a
// Wizard's longsword are not the same case — so it is always an explicit choice on the
// item. WEAPON_MASTERY_INDEX stays as reference for what each official weapon carries.

/** The reference line appended under Information on an attack. */
export function masteryInfoLine(mastery: WeaponMasteryName | undefined): string | undefined {
  if (!mastery || !WEAPON_MASTERIES[mastery]) return undefined;
  return `Mastery — ${mastery}: ${WEAPON_MASTERIES[mastery].summary}`;
}
