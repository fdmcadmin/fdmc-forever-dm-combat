/**
 * THE v5 BROAD READER LIBRARY — imported, not transcribed.
 *
 *   node scripts/gen-broad-readers.mjs <unzipped Broken_Chain_..._Pricer_v5_108_Broad_Readers xlsx dir> \
 *     src/core/encounter-band/broadReaders.generated.ts
 *
 * Christopher, 2026-09-13: *"updated pricer"* — the v5 workbook, and the scope he chose for it: *"Reader
 * layer first."* v5 prices nothing new for Act 3 ("Numeric packet values remain as authored"); what it
 * changes is the architecture. Every authored clause is composed from 108 broad readers in seven
 * families, every lasting state names a duration reader and an endpoint, and a clause no composition
 * represents is NEEDS_INPUT — never a silent zero.
 *
 * Reads, from the workbook:
 *   Broad Reader Library     108 readers — id, family, name, detection cues, pricing rule, inputs
 *   Reader Variables         the dictionary the pricing rules are written in
 *   Final Effect Catalog     36 endpoint patterns
 *   Reader Compositions      the worked recipes, as reader/endpoint id lists
 *   Source Pricing Library   the 82 legacy primitive ids → the broad readers they alias
 *   Parser Coverage Gate     the workbook's own expected counts, so the gate checks the import against them
 *
 * ⚠ THE WORKBOOK NEVER SHIPS. Read at development time; the generated file is the input.
 */
import fs from "node:fs";
import path from "node:path";

const [DIR, OUT] = process.argv.slice(2);
if (!DIR || !OUT) {
  console.error("usage: node scripts/gen-broad-readers.mjs <xlsx-dir> <out.ts>");
  process.exit(1);
}

// Some shared strings arrive double-encoded ("&amp;amp;"), so the entity pass runs until it settles.
const decodeOnce = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#10;/g, " ").replace(/&amp;/g, "&");
const decode = s => { let prev; let cur = s; do { prev = cur; cur = decodeOnce(cur); } while (cur !== prev); return cur; };
const SHARED = [...fs.readFileSync(path.join(DIR, "xl", "sharedStrings.xml"), "utf8")
  .matchAll(/<(?:x:)?si>([\s\S]*?)<\/(?:x:)?si>/g)]
  .map(([, si]) => decode([...si.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map(m => m[1]).join("")));
const wb = fs.readFileSync(path.join(DIR, "xl", "workbook.xml"), "utf8");
const rels = fs.readFileSync(path.join(DIR, "xl", "_rels", "workbook.xml.rels"), "utf8");

function sheetRows(name) {
  const tag = [...wb.matchAll(/<(?:x:)?sheet [^>]*>/g)].map(m => m[0]).find(s => (s.match(/name="([^"]*)"/) || [])[1] === name);
  if (!tag) throw new Error(`sheet not found: ${name}`);
  const rid = (tag.match(/r:id="([^"]*)"/) || [])[1];
  const rel = [...rels.matchAll(/<Relationship[^>]*>/g)].map(m => m[0]).find(s => s.includes(`Id="${rid}"`));
  const xml = fs.readFileSync(path.join(DIR, "xl", (rel.match(/Target="([^"]*)"/) || [])[1].replace(/^\/?xl\//, "")), "utf8");
  const rows = [];
  for (const [, row] of xml.matchAll(/<(?:x:)?row[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
    const cells = [];
    for (const c of row.matchAll(/<(?:x:)?c r="([A-Z]+)\d+"(?:[^>]*?t="(\w+)")?[^>]*?(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g)) {
      const col = c[1].split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const inner = c[3] ?? "";
      const v = (inner.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/) || [])[1];
      cells[col] = c[2] === "s" ? SHARED[Number(v)] ?? ""
        : /<(?:x:)?is>/.test(inner) ? decode([...inner.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map(m => m[1]).join(""))
        : decode(v ?? "");
    }
    rows.push(Array.from(cells, x => (x ?? "").trim()));
  }
  return rows;
}
const ids = (text, re) => [...new Set(String(text).match(re) ?? [])];

// ── readers ───────────────────────────────────────────────────────────────────────────────────────
const readers = sheetRows("Broad Reader Library").filter(r => /^BR\d{3}$/.test(r[0])).map(r => ({
  id: r[0], family: r[1], name: r[2],
  cues: r[3].split(/\s*;\s*/).map(s => s.trim()).filter(Boolean),
  output: r[4], pricing: r[5], inputs: r[6], status: r[12] || "PASS",
}));

const variables = sheetRows("Reader Variables").filter(r => /^[A-Z][A-Z0-9_]+$/.test(r[0]) && r[1] && r[0] !== "Variable")
  .map(r => ({ name: r[0], meaning: r[1], unit: r[2] }));

const finals = sheetRows("Final Effect Catalog").filter(r => /^FE\d{2}$/.test(r[0])).map(r => ({
  id: r[0], pattern: r[1], resolution: r[2], pricing: r[3], typical: r[4],
}));

const compositions = sheetRows("Reader Compositions").filter(r => /^EX\d{2}$/.test(r[0])).map(r => ({
  id: r[0], pattern: r[1], readers: ids(r[2], /BR\d{3}/g), finals: ids(r[2], /FE\d{2}/g), interpretation: r[3],
}));

const aliasRows = sheetRows("Source Pricing Library");
const aliasHeader = aliasRows.find(r => r[0] === "Primitive ID");
const col = name => aliasHeader.indexOf(name);
const aliases = aliasRows.filter(r => /^[a-z][a-z0-9_]+$/.test(r[0]) && r[col("Broad Reader IDs")]).map(r => ({
  primitive: r[0], lane: r[col("Pricing Lane")], neutralScalar: r[col("Neutral Scalar?")],
  rule: r[col("Exact Pricing Rule")], readers: ids(r[col("Broad Reader IDs")], /BR\d{3}/g),
}));

// ── the workbook's own expected counts ──────────────────────────────────────────────────────────────
const gateRows = sheetRows("Parser Coverage Gate");
const expected = {};
for (const [label, key] of [["Broad readers", "readers"], ["Reader families", "families"], ["Legacy primitive aliases mapped", "aliases"],
  ["Concentration readers", "concentrationReaders"], ["Exactly-two-turn reader", "twoTurnReaders"], ["Final-effect endpoint patterns", "finals"],
  ["Current Profile Action rows mapped", "profileRows"]]) {
  const row = gateRows.find(r => r[0] === label);
  if (!row) throw new Error(`Parser Coverage Gate row missing: ${label}`);
  expected[key] = Number(row[1]);
}

// Runtime Contract r34 — the parse order, in the workbook's own words.
const contract = sheetRows("Runtime Contract");
const parseOrderRow = contract.find(r => r[0] === "Broad reader parse order");
if (!parseOrderRow) throw new Error("Runtime Contract: parse order row missing");

const families = [...new Set(readers.map(r => r.family))];
if (readers.length !== expected.readers) throw new Error(`readers ${readers.length} ≠ workbook ${expected.readers}`);
if (finals.length !== expected.finals) throw new Error(`finals ${finals.length} ≠ workbook ${expected.finals}`);
if (aliases.length !== expected.aliases) throw new Error(`aliases ${aliases.length} ≠ workbook ${expected.aliases}`);
if (families.length !== expected.families) throw new Error(`families ${families.length} ≠ workbook ${expected.families}`);

const j = v => JSON.stringify(v, null, 1).replace(/\n\s*/g, " ");
const out = `/**
 * ⚠ GENERATED by scripts/gen-broad-readers.mjs from
 * \`Broken_Chain_Act_Creature_and_Encounter_Pricer_v5_108_Broad_Readers.xlsx\` — do not edit by hand.
 *
 * The v5 pricing architecture: ${readers.length} composable readers in ${families.length} families, ${finals.length} endpoint patterns,
 * ${compositions.length} worked compositions, and the ${aliases.length} legacy primitive ids aliased into the readers.
 * Consumed by \`broadReaderGate.ts\`.
 */
export type BroadReader = { id: string; family: string; name: string; cues: string[]; output: string; pricing: string; inputs: string; status: string };
export type ReaderVariable = { name: string; meaning: string; unit: string };
export type FinalEffect = { id: string; pattern: string; resolution: string; pricing: string; typical: string };
export type ReaderComposition = { id: string; pattern: string; readers: string[]; finals: string[]; interpretation: string };
export type PrimitiveReaderAlias = { primitive: string; lane: string; neutralScalar: string; rule: string; readers: string[] };

/** Runtime Contract r34, verbatim: ${parseOrderRow[1]} */
export const READER_PARSE_ORDER_TEXT = ${JSON.stringify(parseOrderRow[1])};
export const READER_FAMILIES: readonly string[] = ${JSON.stringify(families)};
/** The workbook's Parser Coverage Gate "Expected" column. */
export const BROAD_READER_EXPECTED = ${JSON.stringify(expected)} as const;

export const BROAD_READERS: readonly BroadReader[] = [
${readers.map(r => "  " + j(r)).join(",\n")}
];

export const READER_VARIABLES: readonly ReaderVariable[] = [
${variables.map(r => "  " + j(r)).join(",\n")}
];

export const FINAL_EFFECTS: readonly FinalEffect[] = [
${finals.map(r => "  " + j(r)).join(",\n")}
];

export const READER_COMPOSITIONS: readonly ReaderComposition[] = [
${compositions.map(r => "  " + j(r)).join(",\n")}
];

export const PRIMITIVE_READER_ALIASES: readonly PrimitiveReaderAlias[] = [
${aliases.map(r => "  " + j(r)).join(",\n")}
];
`;
fs.writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${readers.length} readers / ${families.length} families / ${variables.length} variables / ${finals.length} finals / ${compositions.length} compositions / ${aliases.length} aliases`);
console.log(`families: ${families.join(" · ")}`);
