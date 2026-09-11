/**
 * SRD CLASSES — the twelve, and the one subclass each that the SRD publishes.
 *
 * ⚠ GENERATED from the official SRD PDFs by `scripts/import-srd-classes.mjs`. Do not hand-edit.
 *
 * ⚠ MOD CONTENT, NOT ENGINE. A class is a 5e concept; the engine must not learn what one is. Same
 * split `featPricing.generated.ts` and `srdSpecies.ts` carry.
 *
 * ⚠ WHAT IT DOES NOT CONTAIN, AND WHY. Features by level are NOT here. The Core Traits table is
 * the one part of a class chapter with a fixed shape; everything after Starting Equipment is prose
 * with its tables flattened into it, and a reader that took feature rows out of that would be
 * guessing at levels. Pools stay in `classResources.ts` where they are stated by hand and can be
 * checked, and recovery stays in `shortRestRules.generated.ts` where the workbook is the authority.
 *
 * SRD content under CC-BY-4.0 — see `SRD_ATTRIBUTION` in `srdContent.ts`.
 *
 * 12 rows · no exceptions

 */

export type SrdClass = {
  ruleset: "5.2.1" | "5.1";
  name: string;
  primaryAbility: string;
  hitDie: string;
  savingThrows: string[];
  skillChoiceCount: number;
  skillChoices: string;
  weaponTraining: string;
  toolTraining: string;
  armorTraining: string;
  /** The single subclass the SRD publishes for this class. */
  subclass: string;
};

export const SRD_CLASSES: readonly SrdClass[] = [
  {
    ruleset: "5.2.1",
    name: "Barbarian",
    primaryAbility: "Strength",
    hitDie: "d12",
    savingThrows: ["Strength","Constitution"],
    skillChoiceCount: 2,
    skillChoices: "Animal Handling, Athletics, Intimidation, Nature, Perception, or Survival",
    weaponTraining: "Simple and Martial weapons",
    toolTraining: "",
    armorTraining: "Light and Medium armor and Shields",
    subclass: "Path of the Berserker",
  },
  {
    ruleset: "5.2.1",
    name: "Bard",
    primaryAbility: "Charisma",
    hitDie: "d8",
    savingThrows: ["Dexterity","Charisma"],
    skillChoiceCount: 3,
    skillChoices: "any 3 skills (see “Playing the Game”)",
    weaponTraining: "Simple weapons",
    toolTraining: "Choose 3 Musical Instruments (see “Equipment”)",
    armorTraining: "Light armor",
    subclass: "College of Lore",
  },
  {
    ruleset: "5.2.1",
    name: "Cleric",
    primaryAbility: "Wisdom",
    hitDie: "d8",
    savingThrows: ["Wisdom","Charisma"],
    skillChoiceCount: 2,
    skillChoices: "History, Insight, Medicine, Persuasion, or Religion",
    weaponTraining: "Simple weapons",
    toolTraining: "",
    armorTraining: "Light and Medium armor and Shields",
    subclass: "Life Domain",
  },
  {
    ruleset: "5.2.1",
    name: "Druid",
    primaryAbility: "Wisdom",
    hitDie: "d8",
    savingThrows: ["Intelligence","Wisdom"],
    skillChoiceCount: 2,
    skillChoices: "Animal Handling, Arcana, Insight, Medicine, Nature, Perception, Religion, or Survival",
    weaponTraining: "Simple weapons",
    toolTraining: "Herbalism Kit",
    armorTraining: "Light armor and Shields",
    subclass: "Circle of the Land",
  },
  {
    ruleset: "5.2.1",
    name: "Fighter",
    primaryAbility: "Strength or Dexterity",
    hitDie: "d10",
    savingThrows: ["Strength","Constitution"],
    skillChoiceCount: 2,
    skillChoices: "Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Persuasion, Perception, or Survival",
    weaponTraining: "Simple and Martial weapons",
    toolTraining: "",
    armorTraining: "Light, Medium, and Heavy armor and Shields",
    subclass: "Champion",
  },
  {
    ruleset: "5.2.1",
    name: "Monk",
    primaryAbility: "Dexterity and Wisdom",
    hitDie: "d8",
    savingThrows: ["Strength","Dexterity"],
    skillChoiceCount: 2,
    skillChoices: "Acrobatics, Athletics, History, Insight, Religion, or Stealth",
    weaponTraining: "Simple weapons and Martial weapons that have the Light property",
    toolTraining: "Choose one type of Artisan’s Tools or Musical Instrument (see “Equipment”)",
    armorTraining: "None",
    subclass: "Warrior of the Open Hand",
  },
  {
    ruleset: "5.2.1",
    name: "Paladin",
    primaryAbility: "Strength and Charisma",
    hitDie: "d10",
    savingThrows: ["Wisdom","Charisma"],
    skillChoiceCount: 2,
    skillChoices: "Athletics, Insight, Intimidation, Medicine, Persuasion, or Religion",
    weaponTraining: "Simple and Martial weapons",
    toolTraining: "",
    armorTraining: "Light, Medium, and Heavy armor and Shields",
    subclass: "Oath of Devotion",
  },
  {
    ruleset: "5.2.1",
    name: "Ranger",
    primaryAbility: "Dexterity and Wisdom",
    hitDie: "d10",
    savingThrows: ["Strength","Dexterity"],
    skillChoiceCount: 3,
    skillChoices: "Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, or Survival",
    weaponTraining: "Simple and Martial weapons",
    toolTraining: "",
    armorTraining: "Light and Medium armor and Shields",
    subclass: "Hunter",
  },
  {
    ruleset: "5.2.1",
    name: "Rogue",
    primaryAbility: "Dexterity",
    hitDie: "d8",
    savingThrows: ["Dexterity","Intelligence"],
    skillChoiceCount: 4,
    skillChoices: "Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Persuasion, Sleight of Hand, or Stealth",
    weaponTraining: "Simple weapons and Martial weapons that have the Finesse or Light property",
    toolTraining: "Thieves’ Tools",
    armorTraining: "Light armor",
    subclass: "Thief",
  },
  {
    ruleset: "5.2.1",
    name: "Sorcerer",
    primaryAbility: "Charisma",
    hitDie: "d6",
    savingThrows: ["Constitution","Charisma"],
    skillChoiceCount: 2,
    skillChoices: "Arcana, Deception, Insight, Intimidation, Persuasion, or Religion",
    weaponTraining: "Simple weapons",
    toolTraining: "",
    armorTraining: "None",
    subclass: "Draconic Sorcery",
  },
  {
    ruleset: "5.2.1",
    name: "Warlock",
    primaryAbility: "Charisma",
    hitDie: "d8",
    savingThrows: ["Wisdom","Charisma"],
    skillChoiceCount: 2,
    skillChoices: "Arcana, Deception, History, Intimidation, Investigation, Nature, or Religion",
    weaponTraining: "Simple weapons",
    toolTraining: "",
    armorTraining: "Light armor",
    subclass: "Fiend Patron",
  },
  {
    ruleset: "5.2.1",
    name: "Wizard",
    primaryAbility: "Intelligence",
    hitDie: "d6",
    savingThrows: ["Intelligence","Wisdom"],
    skillChoiceCount: 2,
    skillChoices: "Arcana, History, Insight, Investigation, Medicine, Nature, or Religion",
    weaponTraining: "Simple weapons",
    toolTraining: "",
    armorTraining: "None",
    subclass: "Evoker",
  },
];

const BY_NAME = new Map(SRD_CLASSES.map(c => [c.name.toLowerCase(), c]));

/** The SRD row for a class name, or undefined when the document does not cover it. */
export function srdClass(name: string | undefined): SrdClass | undefined {
  return BY_NAME.get((name ?? "").trim().toLowerCase());
}
