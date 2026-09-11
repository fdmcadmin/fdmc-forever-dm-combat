/**
 * IMPORT — the SRD's twelve classes and their subclasses, from the official PDFs.
 *
 *   node scripts/import-srd-classes.mjs <SRD_CC_v5.2.1.pdf> <SRD_CC_v5.1.pdf> <out.ts>
 *
 * Christopher, 2026-09-10: *"using the 2 srd make sure the classes subclasses and all the races are
 * in the dnd mod."*
 *
 * ⚠ SAME PIPELINE AS THE CREATURES, FOR THE SAME REASONS. `import-srd.mjs` reads the official PDF
 * at DEVELOPMENT time and emits a generated file; nothing in the shipped bundle reads a PDF and no
 * third-party document travels with the app. The SRD is CC-BY-4.0, which is why this import is
 * allowed at all — the attribution lives in `SRD_ATTRIBUTION`.
 *
 * ⚠ AND IT EXTRACTS THE CORE TRAITS TABLE, NOT THE PROSE. Every class prints one, and it is the
 * one part of a class chapter with a fixed shape:
 *
 *   Core <Class> Traits Primary Ability<X> Hit Point Die D<N> per <Class> level
 *   Saving Throw <A> and <B> Choose <n>: <skills> … Armor Training<…> Starting Equipment…
 *
 * Everything after Starting Equipment is narrative with tables flattened into it, and a reader that
 * tried to take features-by-level out of it would be guessing. What it CAN say exactly is what a
 * sheet asks: the hit die, the primary ability, the two saves, the skill choice, the weapon and
 * armour training, and which subclass the SRD publishes. `NEEDS_INPUT` rather than a guess — the
 * exceptions list at the end names anything that did not extract.
 */

import fs from "node:fs";
import zlib from "node:zlib";

const [, , PDF_521, PDF_51, OUT] = process.argv;
if (!PDF_521 || !PDF_51 || !OUT) {
  console.error("usage: node scripts/import-srd-classes.mjs <5.2.1.pdf> <5.1.pdf> <out.ts>");
  process.exit(1);
}

/* ── PDF -> text, lifted verbatim from import-srd.mjs ─────────────────────────────────────── */
const SRC = fs.readFileSync(new URL("./import-srd.mjs", import.meta.url), "utf8");
const PDFTEXT = SRC.slice(SRC.indexOf("function pdfText(file)"), SRC.indexOf("/* ── 2. text"));
const pdfText = new Function("fs", "zlib", `${PDFTEXT}; return pdfText;`)(fs, zlib);

/**
 * ⚠ HYPHENATION IS THE EXTRACTOR'S ONLY REAL ENEMY HERE. The PDF breaks words across lines and the
 * reader keeps the hyphen: "Na - ture", "Persua - sion", "Investi - gation". Joining them back is
 * safe because a genuine hyphenated skill name does not exist in the list.
 */
function normalize(text) {
  return text
    .replace(/\r/g, "")
    .replace(/([A-Za-z])\s*-\s*\n?\s*([a-z])/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n");
}

const CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard",
];

const ABIL = "Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma";

/** One class's Core Traits, from the block that starts at its heading. */
function coreTraits(text, cls) {
  const at = text.indexOf(`Core ${cls} Traits`);
  if (at < 0) return { missing: ["block not found"] };
  /**
   * ⚠ COLLAPSE THE WHITESPACE BEFORE MATCHING, NOT AFTER. Turning newlines into spaces leaves
   * DOUBLE spaces wherever a line broke mid-phrase — "Artisan's  Tools" — and every regex below
   * writes single ones. It cost the Monk's tool clause: the pattern matched for the Rogue, whose
   * line happened not to break there, and silently failed for the Monk, so "Simple weapons and
   * Martial weapons that have the Light propertyChoose one type of Artisan's Tools…" shipped as
   * weapon training. `tidy()` runs at the END and hid the cause by making the output look clean.
   */
  const block = text.slice(at, at + 900).replace(/\s+/g, " ");
  const missing = [];

  const primary = block.match(new RegExp(`Primary Ability\\s*((?:${ABIL})(?:\\s+(?:and|or)\\s+(?:${ABIL}))?)`));
  const die = block.match(new RegExp(`Hit Point Die\\s*D(\\d+) per ${cls} level`, "i"));
  const saves = block.match(new RegExp(`Saving Throw\\s*(${ABIL})\\s+and\\s+(${ABIL})`));
  /**
   * ⚠ THE BARD PRINTS "Choose any 3 skills", NOT A LIST. Treating the count and the list as one
   * capture dropped the "any 3" and left the parenthetical alone — a row reading
   * `skills (see "Playing the Game")` with a count of 3 and no skills, which is a true statement
   * rendered as a broken one.
   */
  const skills = block.match(/Choose (any )?(\d+)\s*:?\s*([^]*?)(?=Simple|Martial|Armor Training)/);
  const armor = block.match(/Armor Training\s*([^]*?)(?=Starting Equipment)/);
  /** Weapon training sits between the skill list and Armor Training, with no label of its own. */
  const weapons = block.match(/(Simple(?: weapons)?(?: and Martial weapons?)?[^]*?)(?=Armor Training)/);
  /**
   * ⚠ AND TOOL TRAINING RIDES IN THE SAME UNLABELLED RUN. The Bard's three instruments and the
   * Druid's Herbalism Kit sat inside `weaponTraining`, which then claimed a Bard is trained in
   * "Simple weaponsChoose 3 Musical Instruments". They are the same column in the printed table
   * and different facts on a sheet.
   */
  /**
   * ⚠ NOT ANCHORED TO THE END. The Monk's clause is followed by more of the same run, so a `$`
   * anchor matched nothing and left "Simple weapons and Martial weapons that have the Light
   * propertyChoose one type of Artisan's Tools…" as the weapon training. Found ANYWHERE in the run
   * and cut out of it, which is what "these are two columns printed as one" actually means.
   */
  const TOOL_CLAUSE = /(Choose \d+ Musical Instruments.*|Choose one type of Artisan['’]s Tools.*|Herbalism Kit.*|Thieves['’] Tools.*)/;
  const toolMatch = weapons?.[1]?.match(TOOL_CLAUSE);

  if (!primary) missing.push("primaryAbility");
  if (!die) missing.push("hitDie");
  if (!saves) missing.push("savingThrows");
  if (!skills) missing.push("skillChoices");
  if (!armor) missing.push("armorTraining");

  return {
    primaryAbility: primary?.[1]?.trim(),
    hitDie: die ? `d${die[1]}` : undefined,
    savingThrows: saves ? [saves[1], saves[2]] : undefined,
    skillChoiceCount: skills ? Number(skills[2]) : undefined,
    skillChoices: skills
      ? (skills[1] ? `any ${skills[2]} ${tidy(skills[3])}` : tidy(skills[3]))
      : undefined,
    weaponTraining: weapons
      ? tidy(toolMatch ? weapons[1].replace(TOOL_CLAUSE, "") : weapons[1])
      : undefined,
    toolTraining: toolMatch ? tidy(toolMatch[1]) : "",
    armorTraining: armor ? tidy(armor[1]) : undefined,
    missing,
  };
}

function tidy(s) {
  return s.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/^[\s:,]+|[\s.,]+$/g, "").trim();
}

/**
 * The SRD publishes exactly ONE subclass per class. Two layouts appear: "X Subclass: Name" on the
 * chapter page, and a bare heading where the colon form is broken across a line.
 */
const SUBCLASS_FALLBACK_521 = {
  Barbarian: "Path of the Berserker", Bard: "College of Lore", Cleric: "Life Domain",
  Druid: "Circle of the Land", Fighter: "Champion", Monk: "Warrior of the Open Hand",
  Paladin: "Oath of Devotion", Ranger: "Hunter", Rogue: "Thief",
  Sorcerer: "Draconic Sorcery", Warlock: "Fiend Patron", Wizard: "Evoker",
};

/**
 * ⚠ EXTRACTION ALONE CANNOT END THE NAME, AND THE FIRST RUN PROVED IT. A subclass heading is
 * immediately followed by its tagline with no separator the reader can see, so the regex produced
 * "Path of the BerserkerChannel", "ChampionPursue Physical", "EvokerCreate Explosive Elemental
 * Effects" — and truncated "Warrior of the Open Hand" to "Warrior of the Open".
 *
 * So the CANDIDATE is the published name and the DOCUMENT is the check: the name must appear
 * verbatim in the text, and the extraction must agree with it as a prefix. A candidate the PDF
 * does not contain is reported as an exception and written nowhere — which is the difference
 * between confirming a name and inventing one.
 */
function subclassName(text, cls, candidate) {
  if (!candidate) return { name: undefined, source: "NO CANDIDATE" };
  if (!text.includes(candidate)) return { name: undefined, source: "NOT IN THE DOCUMENT" };

  const m = text.match(new RegExp(`${cls} Subclass:?\\s*([A-Z][A-Za-z'’ ]{2,60})`));
  const extracted = m?.[1]?.trim();
  const agrees = extracted
    ? extracted.startsWith(candidate) || candidate.startsWith(extracted) || candidate.endsWith(extracted)
    : false;
  return {
    name: candidate,
    source: agrees ? "confirmed in the document, extraction agrees" : "confirmed in the document",
  };
}

const out = [];
const exceptions = [];

for (const [ruleset, file] of [["5.2.1", PDF_521], ["5.1", PDF_51]]) {
  const text = normalize(pdfText(file));
  for (const cls of CLASSES) {
    const traits = coreTraits(text, cls);
    /**
     * ⚠ 5.1 PRINTS NO "Core X Traits" TABLE — that shape is a 2024 invention. Its classes are
     * covered by the 5.2.1 rows, so a miss here is expected and is NOT an exception; recording it
     * as one would bury the twelve that matter.
     */
    if (traits.missing?.includes("block not found")) {
      if (ruleset === "5.2.1") exceptions.push(`${ruleset} ${cls}: Core Traits block not found`);
      continue;
    }
    const sub = subclassName(text, cls, SUBCLASS_FALLBACK_521[cls]);
    if (!sub.name) exceptions.push(`${ruleset} ${cls}: subclass name not found`);
    for (const m of traits.missing) exceptions.push(`${ruleset} ${cls}: ${m}`);
    out.push({ ruleset, name: cls, ...traits, subclass: sub.name, subclassSource: sub.source, missing: undefined });
  }
}

const body = out.map(c => `  {
    ruleset: ${JSON.stringify(c.ruleset)},
    name: ${JSON.stringify(c.name)},
    primaryAbility: ${JSON.stringify(c.primaryAbility ?? "")},
    hitDie: ${JSON.stringify(c.hitDie ?? "")},
    savingThrows: ${JSON.stringify(c.savingThrows ?? [])},
    skillChoiceCount: ${c.skillChoiceCount ?? 0},
    skillChoices: ${JSON.stringify(c.skillChoices ?? "")},
    weaponTraining: ${JSON.stringify(c.weaponTraining ?? "")},
    toolTraining: ${JSON.stringify(c.toolTraining ?? "")},
    armorTraining: ${JSON.stringify(c.armorTraining ?? "")},
    subclass: ${JSON.stringify(c.subclass ?? "")},
  },`).join("\n");

const header = `/**
 * SRD CLASSES — the twelve, and the one subclass each that the SRD publishes.
 *
 * ⚠ GENERATED from the official SRD PDFs by \`scripts/import-srd-classes.mjs\`. Do not hand-edit.
 *
 * ⚠ MOD CONTENT, NOT ENGINE. A class is a 5e concept; the engine must not learn what one is. Same
 * split \`featPricing.generated.ts\` and \`srdSpecies.ts\` carry.
 *
 * ⚠ WHAT IT DOES NOT CONTAIN, AND WHY. Features by level are NOT here. The Core Traits table is
 * the one part of a class chapter with a fixed shape; everything after Starting Equipment is prose
 * with its tables flattened into it, and a reader that took feature rows out of that would be
 * guessing at levels. Pools stay in \`classResources.ts\` where they are stated by hand and can be
 * checked, and recovery stays in \`shortRestRules.generated.ts\` where the workbook is the authority.
 *
 * SRD content under CC-BY-4.0 — see \`SRD_ATTRIBUTION\` in \`srdContent.ts\`.
 *
 * ${out.length} rows${exceptions.length ? ` · ${exceptions.length} exception(s), listed below` : " · no exceptions"}
${exceptions.map(e => ` *   ⚠ ${e}`).join("\n")}
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
${body}
];

const BY_NAME = new Map(SRD_CLASSES.map(c => [c.name.toLowerCase(), c]));

/** The SRD row for a class name, or undefined when the document does not cover it. */
export function srdClass(name: string | undefined): SrdClass | undefined {
  return BY_NAME.get((name ?? "").trim().toLowerCase());
}
`;

fs.writeFileSync(OUT, header, "utf8");
console.log(`Wrote ${out.length} class rows to ${OUT}`);
if (exceptions.length) {
  console.log(`\n${exceptions.length} exception(s):`);
  for (const e of exceptions) console.log("  " + e);
} else {
  console.log("No exceptions — every field extracted.");
}
