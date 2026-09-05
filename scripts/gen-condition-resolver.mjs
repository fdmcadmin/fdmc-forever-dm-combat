/**
 * Generate the D&D mod's CONDITION RESOLVER from the V3.0 feat-pricing recovery workbook.
 *
 * The sheet's own closing line is the rule it exists to enforce: *"Condition names are aliases.
 * Price the decomposed consequences; never use a universal condition multiplier."* A condition is
 * not a number. Frightened is an attack penalty AND a reachability restriction; Paralyzed is lost
 * actions AND advantage against AND a critical rider. Anything that prices "Frightened" as one
 * multiplier has already lost the parts.
 *
 * ⚠ GENERATED, NEVER HAND-EDITED — the rule gen-feats.mjs, gen-primitives.js and
 * gen-short-rest-rules.mjs all carry, for the same reason.
 *
 * ⚠ AND THE WORKBOOK ITSELF NEVER SHIPS. Five machine columns only: the condition, its primary
 * channel, the combat consequence, the primitive decomposition and the context each needs. No
 * spell text, no stat block, no third-party prose.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────────────────────
 *   node scripts/gen-condition-resolver.mjs <unzipped-xlsx-dir> <out.ts>
 */
import fs from "node:fs";
import path from "node:path";

const [, , DIR, OUT] = process.argv;
if (!DIR || !OUT) {
  console.error("usage: node scripts/gen-condition-resolver.mjs <unzipped-xlsx-dir> <out.ts>");
  process.exit(1);
}

const SHEET_NAME = "Condition Resolver";

const decode = s => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#10;/g, " ").replace(/&#8217;/g, "’").replace(/&#8594;/g, "->")
  .replace(/&#8212;/g, "—").replace(/&#8211;/g, "–").replace(/&#183;/g, "·")
  .replace(/&#8230;/g, "…").replace(/&amp;/g, "&");

/**
 * ⚠ SHARED STRINGS, NOT RAW `<v>`. This workbook writes text through the shared-string table, so a
 * text cell's `<v>` is an INDEX. Reading it as the value would emit "37" where the class name goes.
 */
const sharedXml = fs.readFileSync(path.join(DIR, "xl", "sharedStrings.xml"), "utf8");
const SHARED = [...sharedXml.matchAll(/<x:si>([\s\S]*?)<\/x:si>/g)].map(([, si]) =>
  decode([...si.matchAll(/<x:t[^>]*>([\s\S]*?)<\/x:t>/g)].map(m => m[1]).join("")));

/** Sheet name -> rId -> worksheet file. The rIds in this workbook are opaque, not rId1..rIdN. */
function sheetFileFor(name) {
  const wb = fs.readFileSync(path.join(DIR, "xl", "workbook.xml"), "utf8");
  const rels = fs.readFileSync(path.join(DIR, "xl", "_rels", "workbook.xml.rels"), "utf8");
  const wanted = name.replace(/&/g, "&amp;");
  const hit = [...wb.matchAll(/<x:sheet name="([^"]*)"[^>]*r:id="([^"]*)"/g)]
    .find(([, n]) => decode(n) === name || n === wanted);
  if (!hit) throw new Error(`sheet not found: ${name}`);
  // ⚠ ATTRIBUTE ORDER IS NOT GUARANTEED. This writer emits Type, Target, Id — matching
  // `Id=...Target=` finds nothing and would silently look like "sheet missing".
  const rel = [...rels.matchAll(/<Relationship\b[^>]*\/>/g)]
    .map(([tag]) => ({
      id: (tag.match(/\bId="([^"]*)"/) || [])[1],
      target: (tag.match(/\bTarget="([^"]*)"/) || [])[1],
    }))
    .find(r => r.id === hit[2]);
  if (!rel?.target) throw new Error(`relationship not found for ${hit[2]}`);
  return path.join(DIR, "xl", rel.target.replace(/^\/?xl\//, ""));
}

function rowsOf(file) {
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<x:row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/x:row>/g)].map(([, rn, body]) => {
    const cells = {};
    for (const c of body.matchAll(/<x:c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/x:c>/g)) {
      const [, col, attrs, inner] = c;
      const raw = (inner.match(/<x:v>([\s\S]*?)<\/x:v>/) || [])[1];
      if (raw === undefined) continue;
      cells[col] = /t="s"/.test(attrs) ? (SHARED[+raw] ?? "") : decode(raw);
    }
    return { r: +rn, cells };
  });
}

const rows = rowsOf(sheetFileFor(SHEET_NAME));

const dash = v => {
  const s = (v ?? "").trim();
  return s === "" || s === "—" || s === "-" ? null : s;
};

/**
 * ⚠ ONLY REAL CONDITION ROWS. The sheet opens with a title and closes with the aliases warning,
 * both of which occupy column A. A row counts only when every machine column is present.
 */
const conditions = rows
  .map(r => ({
    condition: (r.cells.A ?? "").trim(),
    channel: (r.cells.B ?? "").trim(),
    consequence: (r.cells.C ?? "").trim(),
    decomposition: (r.cells.D ?? "").trim(),
    requiredContext: (r.cells.E ?? "").trim(),
  }))
  .filter(c => c.condition && c.channel && c.consequence && c.decomposition
    && c.condition.toLowerCase() !== "condition / state");

if (conditions.length === 0) throw new Error("no conditions parsed - the sheet shape changed");

const channels = [...new Set(conditions.map(c => c.channel))].sort();

const out = `/**
 * CONDITION RESOLVER - the D&D mod's copy of the workbook's condition decomposition.
 *
 * ⚠ GENERATED from \`Broken_Chain_V3_0_Feat_Pricing_Recovery.xlsx\` (sheet "${SHEET_NAME}")
 * by \`scripts/gen-condition-resolver.mjs\`. Do not hand-edit.
 *
 * ⚠ THIS IS MOD CONTENT, NOT ENGINE. Conditions are a 5e concept.
 *
 * ── THE RULE THIS TABLE EXISTS TO ENFORCE ───────────────
 *   *"Condition names are aliases. Price the decomposed consequences; never use a universal
 *   condition multiplier."*
 *
 * Frightened is an attack penalty AND a reachability restriction. Paralyzed is lost actions AND
 * advantage against AND a critical rider. A single "Frightened multiplier" has already thrown the
 * parts away, and the parts are what the runtime resolves against real bodies.
 *
 * ── COVERAGE ─────────────────────
 *   ${conditions.length} conditions · channels: ${channels.join(", ")}
 */

export type ConditionRule = {
  /** The condition as the ruleset names it. */
  condition: string;
  /** Where its cost lands first - attack, targeting, lost actions, movement, legality. */
  channel: string;
  /** What it actually does in a fight, in the workbook's words. */
  consequence: string;
  /** The primitive IDs it decomposes into. This is what a pricer resolves, never the name. */
  decomposition: string;
  /** What must be known before any of it can be priced. Missing context is NEEDS_INPUT. */
  requiredContext: string;
};

export const CONDITION_RULES: readonly ConditionRule[] = ${JSON.stringify(conditions, null, 2)
    .replace(/"(condition|channel|consequence|decomposition|requiredContext)":/g, "$1:")};

/*
 * ⚠ ONE LOOKUP SHIPS, AND ONLY BECAUSE SOMETHING CALLS IT. A resolveCondition(name) was
 * written here and removed again when check:wiring failed it as a NEW ORPHAN EXPORT - the same
 * rule that took knownShortRestClass out of gen-short-rest-rules and only let it back when
 * shortRestRecovery needed it. Add it back WITH the code that needs it, not before.
 */
/** Every condition named anywhere in a piece of authored text, in the order the table lists them. */
export function conditionsNamedIn(text: string): ConditionRule[] {
  const hay = String(text ?? "").toLowerCase();
  if (!hay) return [];
  return CONDITION_RULES.filter(r => hay.includes(r.condition.toLowerCase()));
}
`;

fs.writeFileSync(OUT, out);
console.log(`Wrote ${OUT}: ${conditions.length} conditions, channels: ${channels.join(", ")}`);
