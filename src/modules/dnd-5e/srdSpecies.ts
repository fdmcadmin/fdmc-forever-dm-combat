/**
 * SRD SPECIES — the traits and the movement a character has for being what they are.
 *
 * Christopher, 2026-09-07, over a screenshot of a hand-typed Wood Elf trait block: *"the baseline
 * class traits and such should be in the SRD already and should be set to automatically add the
 * traits and movement, the same could be done with health but its fine to have to enter it."*
 *
 * He is right, and Lyrielle's sheet is the evidence: one feature row reading *"Darkvision 60 ft.
 * Keen Senses… Fey Ancestry… Trance… Fleet of Foot (35 ft speed). Mask of the Wild…"*, typed by
 * hand, with `speed: "35 ft"` typed separately beside it. Two hand-copies of the same published
 * fact, either of which can be wrong on its own.
 *
 * ─── ⚠ WHAT THIS IS AND IS NOT ──────────────────────────────────────────────────────────────
 *
 * It is a SPECIES table: level-independent facts, ten of them, hand-transcribed. It is NOT a class
 * progression database — that is a permanent Do-Not-Build, and the difference is that a species
 * grants what it grants on the day you make the character while a class grants a different thing
 * at every one of twenty levels. HP is deliberately absent: Christopher said entering it is fine,
 * and Dwarven Toughness is stated as a trait rather than added to a number.
 *
 * ⚠ AND IT IS THE ONE PLACE THESE FACTS LIVE. `classDamageResponses` used to carry its own copy of
 * "a Dwarf resists poison"; it now reads this table, so a lineage cannot resist poison for the
 * checker and something else for the character sheet.
 *
 * ─── ⚠ BOTH DOCUMENTS SHIP, AND BOTH ARE CC-BY-4.0 ─────────────────────────────────────────
 *
 * `srdContent` pins 5.2.1 as the app default and carries its attribution. SRD 5.1 was released
 * under the SAME Creative Commons licence in January 2023 and carries its own — I previously said
 * it was "a different licence", which was wrong. Both tables are below, because the two genuinely
 * disagree: a 5.1 Wood Elf has Mask of the Wild and Fleet of Foot where a 5.2.1 one has Druidcraft
 * and an Elven Lineage, and a 5.1 Dwarf walks 25 feet where a 5.2.1 Dwarf walks 30. `srdRuleset`
 * on the sheet says which, and a race only one document publishes resolves there regardless.
 */

import type { DamageResponse } from "../../core/encounter-band/damageResponsePricing";
import { SRD_VERSION, SRD_51_VERSION } from "./srdContent";

/**
 * WHICH SRD A SHEET IS BUILT ON.
 *
 * ⚠ BOTH ARE CC-BY-4.0 AND BOTH MAY SHIP. Wizards released SRD 5.1 under Creative Commons in
 * January 2023; I previously called it "a different licence" and that was wrong. The two documents
 * genuinely disagree about species — 5.1 has Wood Elf as a SUBRACE with Mask of the Wild and Fleet
 * of Foot, 5.2.1 folds it into the Elven Lineage — so a sheet has to say which one it is built on
 * rather than the app guessing. Christopher: *"the srd is suppose to be both 5.1 and 5.2.1 because
 * wood elf is the class she has."*
 */
export type SrdRuleset = "5.1" | "5.2.1";

/** Both, newest first — the same two strings `srdContent` pins, not a second copy. */
export const SRD_RULESETS: readonly SrdRuleset[] = [SRD_VERSION, SRD_51_VERSION];

/**
 * A typed response a species or lineage grants, carrying the TRAIT that grants it.
 *
 * ⚠ THE FEATURE NAME IS NOT DECORATION. Every derived number in this app has to be able to say
 * where it came from; "Aasimar · Celestial Resistance" is answerable and "Aasimar" is not.
 */
export type SpeciesDamageResponse = DamageResponse & { feature: string };

/** One published trait, as it is printed. */
export type SpeciesTrait = {
  name: string;
  text: string;
};

/**
 * A lineage/legacy CHOICE inside a species — Elven Lineage, Fiendish Legacy, Gnomish Lineage,
 * Draconic Ancestry.
 *
 * ⚠ THE CHOICE IS THE REASON THESE ARE SEPARATE. A species grants its own traits to every member;
 * a lineage grants different ones depending on a decision the player made. The sheet states the
 * decision in the race string ("Wood Elf"), so it is matched there — and when it states none, the
 * species traits still apply and the lineage's do not, which is the honest reading of "Elf".
 */
export type SpeciesLineage = {
  name: string;
  /** Matched against the stated race string, whole word. */
  match: RegExp;
  /** Overrides the species walking speed when the lineage changes it. */
  speedFt?: number;
  /** Overrides the species darkvision when the lineage extends it. */
  darkvisionFt?: number;
  traits: readonly SpeciesTrait[];
  damageResponses?: readonly SpeciesDamageResponse[];
};

export type SrdSpecies = {
  /** Which document this entry is transcribed from. */
  ruleset: SrdRuleset;
  name: string;
  /** Matched against the stated race string. Subraces are matched by the species word inside. */
  match: RegExp;
  size: "Small" | "Medium" | "Small or Medium";
  /** Walking speed in feet — the number the sheet's `stats.speed` should read. */
  speedFt: number;
  darkvisionFt?: number;
  traits: readonly SpeciesTrait[];
  /** Typed responses the species grants outright. A lineage's are on the lineage. */
  damageResponses?: readonly SpeciesDamageResponse[];
  lineages?: readonly SpeciesLineage[];
};

/**
 * The ten SRD 5.2.1 species.
 *
 * ⚠ TRANSCRIBED, NOT GENERATED, and deliberately short of the full printed text — each trait
 * carries what it DOES, which is what a sheet needs, rather than the full paragraph. Anything with
 * a number the checker reads (speed, darkvision, a resistance, a save advantage) states that number
 * exactly.
 */
export const SRD_SPECIES: readonly SrdSpecies[] = [
  {
    ruleset: "5.2.1",
    name: "Aasimar",
    match: /\baasimar\b/i,
    size: "Small or Medium",
    speedFt: 30,
    darkvisionFt: 60,
    damageResponses: [
      { type: "necrotic", response: "resistant", feature: "Celestial Resistance" },
      { type: "radiant", response: "resistant", feature: "Celestial Resistance" },
    ],
    traits: [
      { name: "Celestial Resistance", text: "You have Resistance to Necrotic damage and Radiant damage." },
      { name: "Darkvision", text: "You have Darkvision with a range of 60 feet." },
      { name: "Healing Hands", text: "As a Magic action, you touch a creature and roll a number of d4s equal to your Proficiency Bonus. The creature regains a number of Hit Points equal to the total rolled. Once used, you can't use it again until you finish a Long Rest." },
      { name: "Light Bearer", text: "You know the Light cantrip. Charisma is your spellcasting ability for it." },
      { name: "Celestial Revelation", text: "At character level 3, choose Heavenly Wings, Inner Radiance, or Necrotic Shroud. As a Bonus Action you transform for 1 minute, once per Long Rest, adding your Proficiency Bonus in extra damage once per turn." },
    ],
  },
  {
    ruleset: "5.2.1",
    name: "Dragonborn",
    match: /\bdragonborn\b/i,
    size: "Medium",
    speedFt: 30,
    darkvisionFt: 60,
    /**
     * ⚠ NO RESISTANCE HERE, AND THAT IS DELIBERATE. A Dragonborn resists the damage type of their
     * Draconic Ancestry, and the sheet's race string does not say which ancestry that is. It is a
     * CHOICE, so it belongs in the entered `damageResponses` field where the DM can name it — the
     * one thing this table must never do is pick it for them.
     */
    traits: [
      { name: "Draconic Ancestry", text: "Choose a dragon from the Draconic Ancestors table. Your Breath Weapon and Damage Resistance are determined by that dragon's damage type. ENTER that damage type as a resistance on the Profile tab — the app cannot know which ancestry you chose." },
      { name: "Breath Weapon", text: "When you take the Attack action, you can replace one attack with an exhalation in a 15-foot Cone or a 30-foot Line. Each creature makes a Dexterity save (DC 8 + Con modifier + Proficiency Bonus), taking 1d10 damage of your ancestry's type on a failure, half as much on a success. The die grows to 2d10 at level 5, 3d10 at 11, and 4d10 at 17. You can use it Proficiency Bonus times per Long Rest." },
      { name: "Damage Resistance", text: "You have Resistance to the damage type determined by your Draconic Ancestry." },
      { name: "Darkvision", text: "You have Darkvision with a range of 60 feet." },
      { name: "Draconic Flight", text: "At character level 5, as a Bonus Action you sprout spectral wings for 10 minutes, gaining a Fly Speed equal to your Speed. Once per Long Rest." },
    ],
  },
  {
    ruleset: "5.2.1",
    name: "Dwarf",
    match: /\bdwarf\b|\bdwarven\b|\bduergar\b/i,
    size: "Medium",
    speedFt: 30,
    darkvisionFt: 120,
    damageResponses: [{ type: "poison", response: "resistant", feature: "Dwarven Resilience" }],
    traits: [
      { name: "Darkvision", text: "You have Darkvision with a range of 120 feet." },
      { name: "Dwarven Resilience", text: "You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition." },
      { name: "Dwarven Toughness", text: "Your Hit Point maximum increases by 1, and it increases by 1 again whenever you gain a level. (Enter the result in HP Max — the app does not compute hit points.)" },
      { name: "Stonecunning", text: "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes, usable only on a stone surface. You can use this Proficiency Bonus times per Long Rest." },
    ],
  },
  {
    ruleset: "5.2.1",
    name: "Elf",
    /**
     * ⚠ A NEGATIVE LOOKBEHIND, BECAUSE "Half-Elf" CONTAINS "Elf" AS A WHOLE WORD. The hyphen is a
     * word boundary, so a bare match claimed every Half-Elf for the parent species and handed
     * them full Elf darkvision, Trance and Keen Senses. `check:species` caught the Orc twin of
     * this; the Elf one survived a version because nothing asserted it.
     */
    match: /(?<!half[- ])\belf\b|\belves\b|\beladrin\b|\bdrow\b/i,
    size: "Medium",
    speedFt: 30,
    darkvisionFt: 60,
    traits: [
      { name: "Darkvision", text: "You have Darkvision with a range of 60 feet." },
      { name: "Fey Ancestry", text: "You have Advantage on saving throws you make to avoid or end the Charmed condition." },
      { name: "Keen Senses", text: "You have proficiency in the Insight, Perception, or Survival skill." },
      { name: "Trance", text: "You don't need to sleep, and magic can't put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation." },
    ],
    lineages: [
      {
        name: "Wood Elf",
        match: /\bwood\b/i,
        speedFt: 35,
        traits: [
          { name: "Elven Lineage — Wood Elf", text: "Your Speed increases to 35 feet. You know the Druidcraft cantrip. At character level 3 you always have Longstrider prepared, and at level 5, Pass without Trace. You can cast each of those once per Long Rest without a spell slot, and you can also cast them with slots. Wisdom, Intelligence, or Charisma is your spellcasting ability for them." },
        ],
      },
      {
        name: "High Elf",
        match: /\bhigh\b/i,
        traits: [
          { name: "Elven Lineage — High Elf", text: "You know the Prestidigitation cantrip and can swap it whenever you finish a Long Rest. At character level 3 you always have Detect Magic prepared, and at level 5, Misty Step, each castable once per Long Rest without a slot." },
        ],
      },
      {
        name: "Drow",
        match: /\bdrow\b|\bdark elf\b/i,
        darkvisionFt: 120,
        traits: [
          { name: "Elven Lineage — Drow", text: "Your Darkvision range increases to 120 feet. You know the Dancing Lights cantrip. At character level 3 you always have Faerie Fire prepared, and at level 5, Darkness, each castable once per Long Rest without a slot." },
        ],
      },
    ],
  },
  {
    ruleset: "5.2.1",
    name: "Gnome",
    match: /\bgnome\b/i,
    size: "Small",
    speedFt: 30,
    darkvisionFt: 60,
    traits: [
      { name: "Darkvision", text: "You have Darkvision with a range of 60 feet." },
      { name: "Gnomish Cunning", text: "You have Advantage on Intelligence, Wisdom, and Charisma saving throws." },
    ],
    lineages: [
      { name: "Forest Gnome", match: /\bforest\b/i,
        traits: [{ name: "Gnomish Lineage — Forest Gnome", text: "You know the Minor Illusion cantrip. You always have Speak with Animals prepared and can cast it without a slot a number of times equal to your Proficiency Bonus per Long Rest." }] },
      { name: "Rock Gnome", match: /\brock\b/i,
        traits: [{ name: "Gnomish Lineage — Rock Gnome", text: "You know the Mending and Prestidigitation cantrips. As a Bonus Action you can create a Tiny clockwork device that produces one of several minor effects." }] },
    ],
  },
  {
    ruleset: "5.2.1",
    name: "Goliath",
    match: /\bgoliath\b/i,
    size: "Medium",
    speedFt: 35,
    traits: [
      { name: "Giant Ancestry", text: "Choose one supernatural boon from the Giant Ancestry table (Cloud's Jaunt, Fire's Burn, Frost's Chill, Hill's Tumble, Stone's Endurance, or Storm's Thunder). You can use it Proficiency Bonus times per Long Rest." },
      { name: "Large Form", text: "At character level 5, as a Bonus Action you become Large for 10 minutes, gaining Advantage on Strength checks and +10 feet of Speed. Once per Long Rest." },
      { name: "Powerful Build", text: "You have Advantage on saves you make to end the Grappled condition, and you count as one size larger for carrying capacity." },
    ],
  },
  {
    ruleset: "5.2.1",
    name: "Halfling",
    match: /\bhalfling\b/i,
    size: "Small",
    speedFt: 30,
    traits: [
      { name: "Brave", text: "You have Advantage on saving throws you make to avoid or end the Frightened condition." },
      { name: "Halfling Nimbleness", text: "You can move through the space of any creature that is a size larger than you, but you can't stop in that space." },
      { name: "Luck", text: "When you roll a 1 on the d20 of a D20 Test, you can reroll the die and must use the new roll." },
      { name: "Naturally Stealthy", text: "You can take the Hide action even when you are obscured only by a creature that is at least one size larger than you." },
    ],
  },
  {
    ruleset: "5.2.1",
    name: "Human",
    match: /\bhuman\b/i,
    size: "Small or Medium",
    speedFt: 30,
    traits: [
      { name: "Resourceful", text: "You gain Heroic Inspiration whenever you finish a Long Rest." },
      { name: "Skillful", text: "You gain proficiency in one skill of your choice." },
      { name: "Versatile", text: "You gain an Origin feat of your choice." },
    ],
  },
  {
    ruleset: "5.2.1",
    /**
     * WARN A NEGATIVE LOOKBEHIND, BECAUSE "Half-Orc" CONTAINS "Orc" AS A WHOLE WORD. The hyphen is
     * a word boundary, so a bare match claimed every Half-Orc and Half-Elf for the parent species
     * and handed them the wrong traits and the wrong darkvision. check:species caught it.
     */
    name: "Orc",
    match: /(?<!half[- ])\borc\b/i,
    size: "Medium",
    speedFt: 30,
    darkvisionFt: 120,
    traits: [
      { name: "Adrenaline Rush", text: "You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus. You can use this Proficiency Bonus times per Short or Long Rest." },
      { name: "Darkvision", text: "You have Darkvision with a range of 120 feet." },
      { name: "Relentless Endurance", text: "When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once per Long Rest." },
    ],
  },
  {
    ruleset: "5.2.1",
    name: "Tiefling",
    match: /\btiefling\b/i,
    size: "Small or Medium",
    speedFt: 30,
    darkvisionFt: 60,
    /** The resistance is on the LEGACY, because which one it is depends on the legacy chosen. */
    traits: [
      { name: "Darkvision", text: "You have Darkvision with a range of 60 feet." },
      { name: "Otherworldly Presence", text: "You know the Thaumaturgy cantrip. Intelligence, Wisdom, or Charisma is your spellcasting ability for it." },
    ],
    lineages: [
      { name: "Abyssal Tiefling", match: /\babyssal\b/i,
        damageResponses: [{ type: "poison", response: "resistant", feature: "Fiendish Legacy — Abyssal" }],
        traits: [{ name: "Fiendish Legacy — Abyssal", text: "You have Resistance to Poison damage. You know the Poison Spray cantrip; at level 3 you always have Ray of Sickness prepared, and at level 5, Hold Person." }] },
      { name: "Chthonic Tiefling", match: /\bchthonic\b/i,
        damageResponses: [{ type: "necrotic", response: "resistant", feature: "Fiendish Legacy — Chthonic" }],
        traits: [{ name: "Fiendish Legacy — Chthonic", text: "You have Resistance to Necrotic damage. You know the Chill Touch cantrip; at level 3 you always have False Life prepared, and at level 5, Ray of Enfeeblement." }] },
      { name: "Infernal Tiefling", match: /\binfernal\b/i,
        damageResponses: [{ type: "fire", response: "resistant", feature: "Fiendish Legacy — Infernal" }],
        traits: [{ name: "Fiendish Legacy — Infernal", text: "You have Resistance to Fire damage. You know the Fire Bolt cantrip; at level 3 you always have Hellish Rebuke prepared, and at level 5, Darkness." }] },
    ],
  },
];

/**
 * THE SRD 5.1 RACES — the document the campaign's characters are actually built on.
 *
 * ⚠ THE TWO DOCUMENTS DISAGREE, AND THAT IS THE WHOLE REASON BOTH ARE HERE. In 5.1 a Wood Elf is
 * a SUBRACE granting Mask of the Wild and Fleet of Foot; in 5.2.1 it is an Elven Lineage granting
 * spells and the same 35 ft. Lyrielle's sheet is the 5.1 one, and telling her she has Druidcraft
 * instead of Mask of the Wild would be the app rewriting a character it was asked to read.
 * Christopher, 2026-09-07: *"the srd is suppose to be both 5.1 and 5.2.1 because wood elf is the
 * class she has, and 5.1 has a SRD as well that can be used."*
 *
 * ⚠ 5.1 IS CC-BY-4.0 TOO — see `SRD_51_ATTRIBUTION`. Wizards released it under Creative Commons in
 * January 2023. My earlier claim that it was "a different licence" was simply wrong.
 *
 * ⚠ AND THE SPEEDS DIFFER, WHICH IS THE OTHER REASON A SHEET HAS TO SAY WHICH DOCUMENT IT USES. A
 * 5.1 Dwarf walks 25 feet and a 5.2.1 Dwarf walks 30. Guessing that wrong moves a number the
 * checker reads.
 */
const SRD_51_SPECIES: readonly SrdSpecies[] = [
  {
    ruleset: "5.1",
    name: "Dwarf",
    match: /\bdwarf\b|\bdwarven\b/i,
    size: "Medium",
    speedFt: 25,
    darkvisionFt: 60,
    damageResponses: [{ type: "poison", response: "resistant", feature: "Dwarven Resilience" }],
    traits: [
      { name: "Darkvision", text: "Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light." },
      { name: "Dwarven Resilience", text: "You have advantage on saving throws against poison, and you have resistance against poison damage." },
      { name: "Dwarven Combat Training", text: "You have proficiency with the battleaxe, handaxe, light hammer, and warhammer." },
      { name: "Stonecunning", text: "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check." },
      { name: "Dwarven Speed", text: "Your base walking speed is 25 feet, and your speed is not reduced by wearing heavy armor." },
    ],
    lineages: [
      { name: "Hill Dwarf", match: /\bhill\b/i,
        traits: [{ name: "Dwarven Toughness", text: "Your hit point maximum increases by 1, and it increases by 1 every time you gain a level. (Enter the result in HP Max — the app does not compute hit points.)" }] },
      { name: "Mountain Dwarf", match: /\bmountain\b/i,
        traits: [{ name: "Dwarven Armor Training", text: "You have proficiency with light and medium armor." }] },
    ],
  },
  {
    ruleset: "5.1",
    name: "Elf",
    match: /(?<!half[- ])\belf\b|\belves\b|\bdrow\b/i,
    size: "Medium",
    speedFt: 30,
    darkvisionFt: 60,
    traits: [
      { name: "Darkvision", text: "Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light." },
      { name: "Keen Senses", text: "You have proficiency in the Perception skill." },
      { name: "Fey Ancestry", text: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
      { name: "Trance", text: "Elves don't need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day. After resting in this way, you gain the same benefit that a human does from 8 hours of sleep." },
    ],
    lineages: [
      {
        name: "Wood Elf",
        match: /\bwood\b/i,
        speedFt: 35,
        traits: [
          { name: "Elf Weapon Training", text: "You have proficiency with the longsword, shortsword, shortbow, and longbow." },
          { name: "Fleet of Foot", text: "Your base walking speed increases to 35 feet." },
          { name: "Mask of the Wild", text: "You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena." },
        ],
      },
      {
        name: "High Elf",
        match: /\bhigh\b/i,
        traits: [
          { name: "Elf Weapon Training", text: "You have proficiency with the longsword, shortsword, shortbow, and longbow." },
          { name: "Cantrip", text: "You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it." },
          { name: "Extra Language", text: "You can speak, read, and write one extra language of your choice." },
        ],
      },
      {
        name: "Dark Elf (Drow)",
        match: /\bdrow\b|\bdark elf\b/i,
        darkvisionFt: 120,
        traits: [
          { name: "Superior Darkvision", text: "Your darkvision has a radius of 120 feet." },
          { name: "Sunlight Sensitivity", text: "You have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight." },
          { name: "Drow Magic", text: "You know the Dancing Lights cantrip. At 3rd level you can cast Faerie Fire once per long rest; at 5th, Darkness. Charisma is your spellcasting ability for these." },
          { name: "Drow Weapon Training", text: "You have proficiency with rapiers, shortswords, and hand crossbows." },
        ],
      },
    ],
  },
  {
    ruleset: "5.1",
    name: "Halfling",
    match: /\bhalfling\b/i,
    size: "Small",
    speedFt: 25,
    traits: [
      { name: "Lucky", text: "When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll." },
      { name: "Brave", text: "You have advantage on saving throws against being frightened." },
      { name: "Halfling Nimbleness", text: "You can move through the space of any creature that is of a size larger than yours." },
    ],
    lineages: [
      { name: "Lightfoot Halfling", match: /\blightfoot\b/i,
        traits: [{ name: "Naturally Stealthy", text: "You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you." }] },
      { name: "Stout Halfling", match: /\bstout\b/i,
        damageResponses: [{ type: "poison", response: "resistant", feature: "Stout Resilience" }],
        traits: [{ name: "Stout Resilience", text: "You have advantage on saving throws against poison, and you have resistance against poison damage." }] },
    ],
  },
  {
    ruleset: "5.1",
    name: "Human",
    match: /\bhuman\b/i,
    size: "Medium",
    speedFt: 30,
    traits: [
      { name: "Ability Score Increase", text: "Your ability scores each increase by 1." },
      { name: "Extra Language", text: "You can speak, read, and write one extra language of your choice." },
    ],
  },
  {
    ruleset: "5.1",
    name: "Dragonborn",
    match: /\bdragonborn\b/i,
    size: "Medium",
    speedFt: 30,
    traits: [
      { name: "Draconic Ancestry", text: "You have draconic ancestry. Choose one type of dragon; your breath weapon and damage resistance are determined by the type. ENTER that damage type as a resistance on the Profile tab — the app cannot know which ancestry you chose." },
      { name: "Breath Weapon", text: "You can use your action to exhale destructive energy. Its size, shape and save are determined by your ancestry. The damage is 2d6, rising to 3d6 at 6th level, 4d6 at 11th, and 5d6 at 16th. After using it you can't do so again until you complete a short or long rest." },
      { name: "Damage Resistance", text: "You have resistance to the damage type associated with your draconic ancestry." },
    ],
  },
  {
    ruleset: "5.1",
    name: "Gnome",
    match: /\bgnome\b/i,
    size: "Small",
    speedFt: 25,
    darkvisionFt: 60,
    traits: [
      { name: "Darkvision", text: "Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light." },
      { name: "Gnome Cunning", text: "You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic." },
    ],
    lineages: [
      { name: "Rock Gnome", match: /\brock\b/i,
        traits: [
          { name: "Artificer's Lore", text: "Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus." },
          { name: "Tinker", text: "You have proficiency with artisan's tools (tinker's tools) and can construct a Tiny clockwork device." },
        ] },
    ],
  },
  {
    ruleset: "5.1",
    name: "Half-Elf",
    match: /\bhalf[- ]?elf\b/i,
    size: "Medium",
    speedFt: 30,
    darkvisionFt: 60,
    traits: [
      { name: "Darkvision", text: "Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light." },
      { name: "Fey Ancestry", text: "You have advantage on saving throws against being charmed, and magic can't put you to sleep." },
      { name: "Skill Versatility", text: "You gain proficiency in two skills of your choice." },
    ],
  },
  {
    ruleset: "5.1",
    name: "Half-Orc",
    match: /\bhalf[- ]?orc\b/i,
    size: "Medium",
    speedFt: 30,
    darkvisionFt: 60,
    traits: [
      { name: "Darkvision", text: "Thanks to your orc blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light." },
      { name: "Menacing", text: "You gain proficiency in the Intimidation skill." },
      { name: "Relentless Endurance", text: "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can't use this feature again until you finish a long rest." },
      { name: "Savage Attacks", text: "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage of the critical hit." },
    ],
  },
  {
    ruleset: "5.1",
    name: "Tiefling",
    match: /\btiefling\b/i,
    size: "Medium",
    speedFt: 30,
    darkvisionFt: 60,
    damageResponses: [{ type: "fire", response: "resistant", feature: "Hellish Resistance" }],
    traits: [
      { name: "Darkvision", text: "Thanks to your infernal heritage, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light." },
      { name: "Hellish Resistance", text: "You have resistance to fire damage." },
      { name: "Infernal Legacy", text: "You know the Thaumaturgy cantrip. At 3rd level you can cast Hellish Rebuke as a 2nd-level spell once per long rest; at 5th, Darkness. Charisma is your spellcasting ability for these." },
    ],
  },
];

/**
 * Both documents, 5.2.1 first so it wins a tie by default.
 *
 * ⚠ ORDER IS LOAD-BEARING. `resolveSpecies` prefers the requested ruleset and falls back to the
 * first match, so a race only one document publishes — Goliath in 5.2.1, Half-Orc in 5.1 — still
 * resolves rather than leaving a sheet with no traits for a reason unrelated to the character.
 */
const ALL_SPECIES: readonly SrdSpecies[] = [...SRD_SPECIES, ...SRD_51_SPECIES];

/** A species resolved against a stated race string, with its lineage folded in when one matched. */
export type ResolvedSpecies = {
  species: SrdSpecies;
  lineage?: SpeciesLineage;
  /** Walking speed in feet, lineage first. */
  speedFt: number;
  darkvisionFt?: number;
  /** Species traits then lineage traits, in printed order. */
  traits: SpeciesTrait[];
  damageResponses: SpeciesDamageResponse[];
  /** The species or lineage as it should be NAMED — "Wood Elf", "Aasimar". */
  name: string;
  /** Which document actually answered — not always the one requested. See `resolveSpecies`. */
  ruleset: SrdRuleset;
  /** What to show beside the numbers, so a derived value can always be traced. */
  source: string;
};

/**
 * Resolve the stated race string.
 *
 * ⚠ IT READS THE FIELD, NOT THE SHEET'S PROSE. "Wood Elf" is a stated value in `Actor.race`; a
 * trait paragraph that happens to mention an elf is not, and is never consulted. A race the SRD
 * does not cover — a Kobold, a homebrew lineage — resolves to undefined, which is the honest
 * answer and leaves whatever the DM typed alone.
 */
export function resolveSpecies(
  race: string | undefined,
  /**
   * Which document this sheet is built on. Defaults to 5.2.1 — the app's pinned version — and a
   * race that exists in only ONE of the two resolves there whatever this says, so the choice only
   * matters for the names both documents use.
   */
  ruleset: SrdRuleset = SRD_VERSION,
): ResolvedSpecies | undefined {
  const text = String(race ?? "").trim();
  if (!text) return undefined;
  const matches = ALL_SPECIES.filter(s => s.match.test(text));
  if (matches.length === 0) return undefined;
  /**
   * ⚠ THE REQUESTED RULESET WINS, AND A RACE ONLY ONE DOCUMENT HAS STILL RESOLVES.
   *
   * Goliath is 5.2.1-only and Half-Orc is 5.1-only, so refusing to cross the line would leave a
   * sheet with no traits for a reason that has nothing to do with the character. Falling back is
   * the honest behaviour and `ruleset` on the result says which document actually answered.
   */
  const species = matches.find(s => s.ruleset === ruleset) ?? matches[0];
  const lineage = species.lineages?.find(l => l.match.test(text));
  return {
    species,
    ...(lineage ? { lineage } : {}),
    speedFt: lineage?.speedFt ?? species.speedFt,
    ...((lineage?.darkvisionFt ?? species.darkvisionFt) !== undefined
      ? { darkvisionFt: lineage?.darkvisionFt ?? species.darkvisionFt }
      : {}),
    traits: [...species.traits, ...(lineage?.traits ?? [])],
    damageResponses: [...(species.damageResponses ?? []), ...(lineage?.damageResponses ?? [])],
    name: lineage?.name ?? species.name,
    ruleset: species.ruleset,
    source: `${lineage?.name ?? species.name} · SRD ${species.ruleset}`,
  };
}

/**
 * The id namespace for a trait row this table added.
 *
 * ⚠ IT EXISTS SO THE ROWS CAN BE REPLACED WITHOUT TOUCHING ANYTHING ELSE. Changing a character's
 * species has to remove the old species' rows and add the new ones, and doing that by NAME would
 * delete a DM's own row that happened to share a name. Only rows carrying this prefix are ever
 * removed — see `applySpeciesToTabs`.
 */
export const SPECIES_TRAIT_PREFIX = "srd-species:";

export function speciesTraitId(traitName: string): string {
  return SPECIES_TRAIT_PREFIX + traitName.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
