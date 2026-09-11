/**
 * GENERATE — the corrected rest-recovery registry, classes AND species, short AND long.
 *
 *   node scripts/gen-recovery-registry.mjs <unzipped-xlsx-dir> <out.ts>
 *
 * Christopher, 2026-09-10: *"also ensure the recovery from the workbooks is in the app since it
 * under represents what each class and subclass could be recovered on short."*
 *
 * ⚠ WHAT THE APP HAD, AND WHY IT UNDER-REPRESENTED. `shortRestRules.generated.ts` came from an
 * older workbook and answers ONE question — what comes back on a short rest — for 16 classes and
 * 135 subclasses, most of them recording "none". It carries no long-rest column and no species at
 * all, so a Dragonborn's Breath Weapon and an Aasimar's Healing Hands were invisible to it.
 *
 * The `..._v4_Recovery_Corrected` workbook publishes two sheets that fix both halves:
 *
 *   Class Recovery         Ruleset · Class · Subclass · Feature/Pool · Min Level · Hit Die ·
 *                          Capacity Basis · Short Rest Mode + Amount · Long Rest Mode + Amount ·
 *                          Once-per-LR gate · Engine Kind · Notes · Source URL
 *   Race Species Recovery  the same shape, keyed by race/species, for BOTH terminologies
 *
 * ⚠ AND IT IS STRICTLY EDITION-KEYED, WHICH IS THE POINT OF THE CORRECTION. The 5.1 Dragonborn
 * Breath Weapon refreshes on a short OR long rest; the 5.2.1 one does not. A registry that flattened
 * the two would hand one of those editions a free recharge every hour.
 *
 * ⚠ THE WORKBOOK NEVER SHIPS. This reads two sheets at DEVELOPMENT time and emits a generated file,
 * the same rule `gen-short-rest-rules.mjs` states: *"the workbook has 3rd party creatures traits and
 * other things we would need licensing and approval to use."*
 */

import fs from "node:fs";
import path from "node:path";

const [, , DIR, OUT] = process.argv;
if (!DIR || !OUT) {
  console.error("usage: node scripts/gen-recovery-registry.mjs <unzipped-xlsx-dir> <out.ts>");
  process.exit(1);
}

const decode = s => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#10;/g, " ").replace(/&#8217;/g, "’").replace(/&#8212;/g, "—")
  .replace(/&#8211;/g, "–").replace(/&#183;/g, "·").replace(/&#8230;/g, "…")
  .replace(/&#8594;/g, "->").replace(/&amp;/g, "&");

const sharedXml = fs.readFileSync(path.join(DIR, "xl", "sharedStrings.xml"), "utf8");
const SHARED = [...sharedXml.matchAll(/<(?:x:)?si>([\s\S]*?)<\/(?:x:)?si>/g)].map(([, si]) =>
  decode([...si.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map(m => m[1]).join("")));

const wb = fs.readFileSync(path.join(DIR, "xl", "workbook.xml"), "utf8");
const rels = fs.readFileSync(path.join(DIR, "xl", "_rels", "workbook.xml.rels"), "utf8");

/**
 * ⚠ ATTRIBUTE ORDER IS NOT GUARANTEED. This workbook writes `Target` before `Id`, so the ordered
 * regex the older generator uses returns undefined here and the read dies on a null.
 */
function sheetRows(name) {
  const tag = [...wb.matchAll(/<(?:x:)?sheet [^>]*>/g)].map(m => m[0])
    .find(s => (s.match(/name="([^"]*)"/) || [])[1] === name);
  if (!tag) throw new Error(`sheet not found: ${name}`);
  const rid = (tag.match(/r:id="([^"]*)"/) || [])[1];
  const rel = [...rels.matchAll(/<Relationship[^>]*>/g)].map(m => m[0]).find(s => s.includes(`Id="${rid}"`));
  const target = (rel.match(/Target="([^"]*)"/) || [])[1];
  const xml = fs.readFileSync(path.join(DIR, "xl", target.replace(/^\/?xl\//, "")), "utf8");

  const rows = [];
  for (const [, row] of xml.matchAll(/<(?:x:)?row[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
    const cells = [...row.matchAll(
      /<(?:x:)?c r="([A-Z]+)\d+"(?:[^>]*?t="(\w+)")?[^>]*?(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g)];
    rows.push(cells.map(c => {
      const t = c[2], inner = c[3] ?? "";
      const v = (inner.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/) || [])[1];
      if (t === "s") return SHARED[Number(v)] ?? "";
      if (t === "inlineStr" || /<(?:x:)?is>/.test(inner)) {
        return decode([...inner.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map(m => m[1]).join(""));
      }
      return v ?? "";
    }));
  }
  return rows;
}

/** An em-dash is this workbook's "not applicable" and must not become a value. */
const cell = v => {
  const s = String(v ?? "").trim();
  return s === "—" || s === "-" ? "" : s;
};

/** "SRD 5.1" / "SRD 5.2.1" -> the ruleset ids the mod already uses. */
const ruleset = v => (cell(v).includes("5.2.1") ? "5.2.1" : cell(v).includes("5.1") ? "5.1" : "");

function headerIndex(rows) {
  const i = rows.findIndex(r => r.some(c => cell(c) === "Ruleset"));
  if (i < 0) throw new Error("header row not found");
  return i;
}

function readTable(name, map) {
  const rows = sheetRows(name);
  const h = headerIndex(rows);
  const cols = rows[h].map(cell);
  const idx = label => {
    const i = cols.indexOf(label);
    if (i < 0) throw new Error(`${name}: column not found: ${label}`);
    return i;
  };
  const out = [];
  for (const r of rows.slice(h + 1)) {
    if (!ruleset(r[idx("Ruleset")])) continue;
    out.push(map(r, idx));
  }
  return out;
}

const classRows = readTable("Class Recovery", (r, i) => ({
  ruleset: ruleset(r[i("Ruleset")]),
  scope: cell(r[i("Source Scope")]),
  className: cell(r[i("Class")]),
  subclassName: cell(r[i("Subclass")]),
  resource: cell(r[i("Feature / Pool")]),
  minLevel: Number(cell(r[i("Min Level")])) || 0,
  hitDie: cell(r[i("Hit Die")]),
  capacityBasis: cell(r[i("Capacity Basis")]),
  shortRestMode: cell(r[i("Short Rest Mode")]),
  shortRestAmount: cell(r[i("Short Rest Amount / Formula")]),
  longRestMode: cell(r[i("Long Rest Mode")]),
  longRestAmount: cell(r[i("Long Rest Amount / Formula")]),
  oncePerLongRest: /^y/i.test(cell(r[i("Once-per-LR Gate?")])),
  engineKind: cell(r[i("Engine Kind")]),
  notes: cell(r[i("Notes")]),
}));

const speciesRows = readTable("Race Species Recovery", (r, i) => ({
  ruleset: ruleset(r[i("Ruleset")]),
  terminology: cell(r[i("Terminology")]),
  species: cell(r[i("Race / Species")]),
  resource: cell(r[i("Feature / Pool")]),
  minLevel: Number(cell(r[i("Min Level")])) || 0,
  capacityBasis: cell(r[i("Capacity Basis")]),
  shortRestMode: cell(r[i("Short Rest Mode")]),
  shortRestAmount: cell(r[i("Short Rest Amount")]),
  longRestMode: cell(r[i("Long Rest Mode")]),
  longRestAmount: cell(r[i("Long Rest Amount")]),
  engineKind: cell(r[i("Engine Kind")]),
  notes: cell(r[i("Notes")]),
}));

const lit = o => "{ " + Object.entries(o)
  .map(([k, v]) => `${k}: ${typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v)}`)
  .join(", ") + " }";

const subclassCount = classRows.filter(r => r.subclassName).length;
const speciesPools = speciesRows.filter(r => r.engineKind && r.engineKind !== "none").length;

const src = `/**
 * REST RECOVERY REGISTRY — classes, subclasses and species; short rest AND long.
 *
 * ⚠ GENERATED from \`Broken_Chain_Act_Creature_and_Encounter_Pricer_v4_Recovery_Corrected.xlsx\`
 * (sheets "Class Recovery" and "Race Species Recovery") by \`scripts/gen-recovery-registry.mjs\`.
 * Do not hand-edit.
 *
 * ⚠ MOD CONTENT, NOT ENGINE. A rest is a 5e concept; the shape — a pool that refreshes on a named
 * cadence — is engine and lives in \`core/types/tabs.ts\`.
 *
 * ⚠ AND IT IS STRICTLY EDITION-KEYED. The workbook's own header: *"Strict edition lookup.
 * Long-Rest-only limited traits are retained when needed to prevent a false Short-Rest refresh."*
 * The 5.1 Dragonborn's Breath Weapon comes back on a short OR long rest and the 5.2.1 one does not;
 * flattening the two hands one edition a free recharge every hour.
 *
 * ⚠ THIS SUPERSEDES NOTHING YET. \`shortRestRules.generated.ts\` still carries the 135 subclass rows
 * that record "checked, grants nothing", which this sheet omits rather than contradicts — a row
 * saying "none" is an answer, and the two files answer different questions until they are
 * reconciled deliberately.
 *
 * ${classRows.length} class rows (${subclassCount} subclass-scoped) · ${speciesRows.length} species rows (${speciesPools} with a real pool)
 */

export type RecoveryMode = string;

export type ClassRecoveryRule = {
  ruleset: "5.2.1" | "5.1";
  scope: string;
  className: string;
  /** "" on a class-scoped rule. */
  subclassName: string;
  resource: string;
  minLevel: number;
  hitDie: string;
  capacityBasis: string;
  shortRestMode: RecoveryMode;
  shortRestAmount: string;
  longRestMode: RecoveryMode;
  longRestAmount: string;
  oncePerLongRest: boolean;
  engineKind: string;
  notes: string;
};

export type SpeciesRecoveryRule = {
  ruleset: "5.2.1" | "5.1";
  terminology: string;
  species: string;
  resource: string;
  minLevel: number;
  capacityBasis: string;
  shortRestMode: RecoveryMode;
  shortRestAmount: string;
  longRestMode: RecoveryMode;
  longRestAmount: string;
  engineKind: string;
  notes: string;
};

export const CLASS_RECOVERY: readonly ClassRecoveryRule[] = [
${classRows.map(r => "  " + lit(r) + ",").join("\n")}
];

export const SPECIES_RECOVERY: readonly SpeciesRecoveryRule[] = [
${speciesRows.map(r => "  " + lit(r) + ",").join("\n")}
];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Every recovery rule that applies to a class at a level, its subclass rules included.
 *
 * ⚠ A SUBCLASS RULE IS ADDITIVE, NEVER AN OVERRIDE — the same contract the older registry states.
 */
export function classRecoveryFor(
  ruleset: "5.2.1" | "5.1",
  className: string,
  subclassName: string | null | undefined,
  level: number,
): ClassRecoveryRule[] {
  const cls = norm(className);
  const sub = norm(subclassName);
  return CLASS_RECOVERY.filter(r =>
    r.ruleset === ruleset
    && norm(r.className) === cls
    && (!r.subclassName || norm(r.subclassName) === sub)
    && level >= r.minLevel);
}

/**
 * ⚠ POOLS ONLY. A row whose \`engineKind\` is "none" says the species was CHECKED and grants
 * nothing — an answer, not a hole — and must not surface as a pool the sheet is missing.
 */
export function speciesRecoveryFor(
  ruleset: "5.2.1" | "5.1",
  species: string | undefined,
  level: number,
): SpeciesRecoveryRule[] {
  const name = norm(species);
  if (!name) return [];
  return SPECIES_RECOVERY.filter(r =>
    r.ruleset === ruleset
    && norm(r.species) === name
    && level >= r.minLevel
    && r.engineKind !== ""
    && r.engineKind !== "none");
}
`;

fs.writeFileSync(OUT, src, "utf8");
console.log(`Wrote ${classRows.length} class rows (${subclassCount} subclass) and ${speciesRows.length} species rows (${speciesPools} with a pool) to ${OUT}`);
