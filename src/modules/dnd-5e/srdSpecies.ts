/**
 * SRD 5.2.1 SPECIES — the traits and the movement a character has for being what they are.
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
 * ─── ⚠ 5.2.1, WHICH IS THE VERSION THIS APP MAY REDISTRIBUTE ────────────────────────────────
 *
 * `srdContent` pins SRD 5.2.1 and carries the CC-BY-4.0 attribution that lets the app ship SRD
 * text at all. The 2014 Basic Rules the live sheets were typed from are a DIFFERENT document under
 * a different licence, so the wording here is 5.2.1's — a Wood Elf's speed 35 arrives through the
 * Elven Lineage rather than through "Fleet of Foot", and "Mask of the Wild" is not a 5.2.1 trait
 * and is therefore absent. A sheet that already carries the 2014 wording keeps it: applying a
 * species ADDS what is missing and never deletes what a DM typed.
 */

import type { DamageResponse } from "../../core/encounter-band/damageResponsePricing";
import { SRD_VERSION } from "./srdContent";

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
    name: "Elf",
    match: /\belf\b|\belves\b|\beladrin\b|\bdrow\b/i,
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
    name: "Orc",
    match: /\borc\b/i,
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
export function resolveSpecies(race: string | undefined): ResolvedSpecies | undefined {
  const text = String(race ?? "").trim();
  if (!text) return undefined;
  const species = SRD_SPECIES.find(s => s.match.test(text));
  if (!species) return undefined;
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
    source: lineage ? `${lineage.name} · SRD ${SRD_VERSION}` : `${species.name} · SRD ${SRD_VERSION}`,
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
