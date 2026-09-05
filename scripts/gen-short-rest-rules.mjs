/**
 * Generate the D&D mod's SHORT REST authority FROM the workbook.
 *
 * The sheet says what it is for, in its own header: *"The app reads this compact authority to
 * resolve the actual actor it is showing. The external party runtime applies these rules to live
 * state; the workbook does not simulate the 1,024 parties or substitute a generic 25% recovery."*
 *
 * The app IS that external runtime. Until this table existed here, it had no way to answer "what
 * does THIS Fighter get back on a short rest", so `partyResourceCurve.SHORT_REST_RECOVERY` stood
 * in for every party at a flat 25.5% of full sustain — the exact generic the sheet rules out, and
 * the reason a Warlock party and a Rogue party recovered identically.
 *
 * ⚠ GENERATED, NEVER HAND-EDITED — the rule `gen-feats.mjs` and `gen-primitives.js` both carry.
 * A hand-maintained copy of 174 class and subclass rows drifts on the first edit, and a drifted
 * copy is worse than none because the app would then report a recovery the workbook never gave.
 *
 * ⚠ AND THE WORKBOOK ITSELF NEVER SHIPS. This reads ONE sheet, and from it only the machine
 * columns: scope, class, subclass, rule id, resource name, earliest level, recovery token, timing,
 * use limit and registry status. No stat block, no spell text, no third-party prose travels into
 * the bundle — the same line `gen-feats.mjs` holds for feat names.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────────────────────
 *   node scripts/gen-short-rest-rules.mjs <unzipped-xlsx-dir> <out.ts>
 */
import fs from "node:fs";
import path from "node:path";

const [, , DIR, OUT] = process.argv;
if (!DIR || !OUT) {
  console.error("usage: node scripts/gen-short-rest-rules.mjs <unzipped-xlsx-dir> <out.ts>");
  process.exit(1);
}

const SHEET_NAME = "Short Rest Rules";

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

/** An em dash in the sheet means "not applicable", not a value. */
const dash = v => {
  const s = (v ?? "").trim();
  return s === "" || s === "—" || s === "-" ? null : s;
};

/**
 * ⚠ ONLY ROWS WITH A REAL RULE ID. The sheet's header block reuses column A for its title and
 * prose, and taking "every row with an A" would import the header sentence as a class rule.
 */
const rules = rows
  .filter(r => /^(class|subclass):/.test(r.cells.D ?? ""))
  .map(r => ({
    key: r.cells.D,
    scope: (r.cells.A ?? "").trim().toLowerCase() === "subclass" ? "subclass" : "class",
    className: (r.cells.B ?? "").trim(),
    subclassName: dash(r.cells.C),
    resource: (r.cells.E ?? "").trim(),
    earliestLevel: Number.isFinite(Number(dash(r.cells.F))) ? Number(dash(r.cells.F)) : null,
    recovery: dash(r.cells.G),
    timing: dash(r.cells.H),
    useLimit: dash(r.cells.I),
    registryStatus: (r.cells.K ?? "").trim(),
  }));

if (rules.length === 0) throw new Error("no rules parsed — the sheet shape changed");

const classes = [...new Set(rules.map(r => r.className))].sort();
const byScope = rules.reduce((a, r) => ((a[r.scope] = (a[r.scope] ?? 0) + 1), a), {});
const recoveries = [...new Set(rules.map(r => r.recovery).filter(Boolean))].sort();
const timings = [...new Set(rules.map(r => r.timing).filter(Boolean))].sort();

const q = s => (s === null ? "null" : JSON.stringify(s));

const out = `/**
 * SHORT REST RULES — the D&D mod's copy of the workbook's class and subclass recovery authority.
 *
 * ⚠ GENERATED from \`broken_chain_encounter_checker_V3_2_4096_actor_first_balanced_center.xlsx\`
 * (sheet "${SHEET_NAME}") by \`scripts/gen-short-rest-rules.mjs\`. Do not hand-edit.
 *
 * ⚠ THIS IS MOD CONTENT, NOT ENGINE. A short rest is a 5e concept; the engine must not learn what
 * one is. The SHAPE — a pool that refreshes on a named cadence — is engine, and lives in
 * \`core/types/tabs.ts\`. Same split \`featPricing.generated.ts\` and \`contentScope.ts\` carry.
 *
 * ── WHY IT EXISTS, IN THE SHEET'S OWN WORDS ─────────────────────────────────────────────────
 *   *"The app reads this compact authority to resolve the actual actor it is showing. The external
 *   party runtime applies these rules to live state; the workbook does not simulate the 1,024
 *   parties or substitute a generic 25% recovery."*
 *
 * The app is that external runtime. \`partyResourceCurve.SHORT_REST_RECOVERY\` is the generic that
 * sentence rules out, and Runtime Inputs B11 disables it outright: *"Short Rest Recovery | 0 |
 * Disabled generic fallback; resolve actual Hit Dice and named actor rules"*.
 *
 * ── COVERAGE ────────────────────────────────────────────────────────────────────────────────
 *   ${rules.length} rules · ${byScope.class ?? 0} class · ${byScope.subclass ?? 0} subclass · ${classes.length} classes
 *   recovery tokens: ${recoveries.join(", ")}
 *   timings: ${timings.join(", ")}
 */

/** Where the rule is attached. A subclass rule is additive to its class rules, never a override. */
export type ShortRestScope = "class" | "subclass";

export type ShortRestRule = {
  /** The workbook's own lookup key, e.g. \`class:Fighter:—:2\`. Stable across regenerations. */
  key: string;
  scope: ShortRestScope;
  className: string;
  /** null on a class-scoped rule. */
  subclassName: string | null;
  /** The pool as printed: "Action Surge", "Pact Magic slots", "Hit Point Dice". */
  resource: string;
  /** First class level that grants it; null where the sheet leaves it blank. */
  earliestLevel: number | null;
  /**
   * How much comes back. A token where the sheet gives one — \`all_expended_uses\`,
   * \`one_expended_use\`, \`up_to_half_class_level_rounded_down\` — and prose for Hit Point Dice,
   * whose amount is a player decision rather than a fixed quantity.
   */
  recovery: string | null;
  /** \`during_short_rest\` (spent as part of it) vs \`on_finish_short_rest\` (refreshed after). */
  timing: string | null;
  /** \`each_short_rest\`, \`each_legal_short_rest\`, \`once_per_long_rest\`. */
  useLimit: string | null;
  registryStatus: string;
};

/**
 * ⚠ A ROW SAYING "none" IS AN ANSWER, NOT A HOLE. Most subclasses grant no short-rest resource of
 * their own, and the sheet records that explicitly rather than omitting the row. Dropping them
 * would turn "this subclass was checked and has nothing" into "this subclass was never checked".
 */
export const SHORT_REST_RULES: readonly ShortRestRule[] = ${JSON.stringify(rules, null, 2)
    .replace(/"(key|scope|className|subclassName|resource|earliestLevel|recovery|timing|useLimit|registryStatus)":/g, "$1:")};

/*
 * ⚠ ONE CONVENIENCE LOOKUP CAME BACK, AND ONLY BECAUSE SOMETHING CALLS IT. knownShortRestClass was
 * written here, removed for want of a caller when check:wiring failed it as a NEW ORPHAN EXPORT,
 * and restored when shortRestRecovery.ts needed it to tell "this class has no Hit Dice" apart from
 * "this class is not in the registry". A classShortRestRules is still absent for the same reason:
 * add it back WITH the code that needs it, not before.
 */
/**
 * The rules that actually apply to one character: their class rules plus their subclass's own,
 * filtered to the levels they have reached.
 *
 * ⚠ SUBCLASS IS ADDITIVE. The sheet's own treatment column says a subclass "may add only its own
 * named asset recovery" — it never replaces what the class already grants, so both lists are
 * returned rather than the subclass shadowing the class.
 */
export function shortRestRulesFor(
  className: string,
  subclassName: string | null | undefined,
  level: number,
): ShortRestRule[] {
  const cls = className.trim().toLowerCase();
  const sub = (subclassName ?? "").trim().toLowerCase();
  return SHORT_REST_RULES.filter(r => {
    if (r.className.toLowerCase() !== cls) return false;
    if (r.scope === "subclass" && (!sub || (r.subclassName ?? "").toLowerCase() !== sub)) return false;
    if (r.earliestLevel !== null && level < r.earliestLevel) return false;
    return true;
  });
}


/**
 * Does the registry know this class at all?
 *
 * ⚠ THE DIFFERENCE THIS DRAWS IS THE WHOLE POINT. A class with no Hit Dice and a class the
 * registry has never heard of both produce nothing; only the second is a gap. Callers use this to
 * report the second instead of quietly recovering zero for it.
 */
export function knownShortRestClass(className: string): boolean {
  const want = className.trim().toLowerCase();
  return SHORT_REST_RULES.some(r => r.className.toLowerCase() === want);
}
`;

fs.writeFileSync(OUT, out);
console.log(`Wrote ${OUT}: ${rules.length} rules, ${byScope.class ?? 0} class / ${byScope.subclass ?? 0} subclass, ${classes.length} classes.`);
console.log(`  classes: ${classes.join(", ")}`);
console.log(`  recovery tokens: ${recoveries.join(", ")}`);
