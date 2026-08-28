/**
 * Generate the D&D mod's feat pricing table FROM the workbook.
 *
 * Christopher: *"implement the workbook as the authoritative pricing contract, rather than merely
 * 'learn the averages'."*
 *
 * ⚠ GENERATED, NEVER HAND-EDITED — the same rule `gen-primitives.js` carries and for the same
 * reason: RULE 1A makes the workbook the law, and a hand-maintained copy of 117 feats drifts from
 * it on the first edit. A drifted copy is worse than none, because the app would then report a
 * price the workbook never gave.
 *
 * ⚠ AND THE WORKBOOK ITSELF NEVER SHIPS. *"the workbook is never moved into the app [...] because
 * the workbook has 3rd party creatures traits and other things we would need licensing and approval
 * to use."* This reads tab 17 only: feat NAMES and the pricing EXPRESSIONS for them. No stat block,
 * no creature, no third-party prose travels into the bundle.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────────────────────
 *   node scripts/gen-feats.mjs <unzipped-xlsx-dir> <out.ts>
 */
import fs from "node:fs";
import path from "node:path";

const [, , DIR, OUT] = process.argv;
if (!DIR || !OUT) {
  console.error("usage: node scripts/gen-feats.mjs <unzipped-xlsx-dir> <out.ts>");
  process.exit(1);
}

const decode = s => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#10;/g, " ").replace(/&#8217;/g, "’").replace(/&#8594;/g, "->")
  .replace(/&#8212;/g, "—").replace(/&#183;/g, "·")
  .replace(/&amp;/g, "&");

function sheet(n) {
  const xml = fs.readFileSync(path.join(DIR, "xl", "worksheets", `sheet${n}.xml`), "utf8");
  return [...xml.matchAll(/<x:row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/x:row>/g)].map(([, rn, body]) => {
    const cells = {};
    for (const c of body.matchAll(/<x:c r="([A-Z]+)\d+"[^>]*?>([\s\S]*?)<\/x:c>/g)) {
      const v = (c[2].match(/<x:v>([\s\S]*?)<\/x:v>/) || [])[1];
      if (v !== undefined) cells[c[1]] = decode(v);
    }
    return { r: +rn, cells };
  });
}

const rows = sheet(17);

/**
 * ⚠ ONLY ROWS WITH A REAL LOOKUP KEY. Tab 17 continues past the feat table into the EXPRESSION
 * DICTIONARY, which reuses column A for variable names. Taking "every row with an A" would import
 * `hitChance` and `partySize` as feats — 39 of them, which is exactly the kind of silent garbage
 * that makes a generated file untrustworthy.
 */
const feats = rows
  .filter(r => r.r > 10 && /^(2014|2024):/.test(r.cells.A ?? ""))
  .map(r => ({
    key: r.cells.A,
    edition: r.cells.B,
    name: r.cells.C,
    category: r.cells.D,
    minLevel: Number(r.cells.E ?? 1) || 1,
    abilityIncrease: Number(r.cells.F ?? 0) || 0,
    channels: (r.cells.G ?? "NONE").split("|").map(s => s.trim()).filter(Boolean),
    dprRule: r.cells.H ?? "none",
    dpr: r.cells.I ?? "0",
    personalEhpRule: r.cells.J ?? "none",
    personalEhp: r.cells.K ?? "0",
    partyEhpRule: r.cells.L ?? "none",
    partyEhp: r.cells.M ?? "0",
    actionBudget: r.cells.N ?? "",
    trigger: r.cells.O ?? "",
    eligibility: r.cells.P ?? "",
    status: r.cells.Q ?? "",
    doubleCountGuard: r.cells.R ?? "",
    note: r.cells.T ?? "",
  }));

/** The dictionary rows below the table: the grammar the evaluator must implement. */
const dictionary = rows
  .filter(r => r.r > 10 && r.cells.A && !/^(2014|2024):/.test(r.cells.A) && r.cells.D)
  .map(r => ({ token: r.cells.A, meaning: r.cells.D }))
  .filter(d => d.token !== "lookup_key");

const byEdition = {};
for (const f of feats) byEdition[f.edition] = (byEdition[f.edition] ?? 0) + 1;
const byChannel = {};
for (const f of feats) for (const c of f.channels) byChannel[c] = (byChannel[c] ?? 0) + 1;

const out = `/**
 * FEAT PRICING — the D&D mod's copy of the workbook's feat contract.
 *
 * ⚠ GENERATED from \`broken_chain_encounter_checker_v12_feat_pricing.xlsx\` (tab 17) by
 * \`scripts/gen-feats.mjs\`. Do not hand-edit.
 *
 * ⚠ THIS IS MOD CONTENT, NOT ENGINE. Feats are a 5e concept; the engine must not learn what one is.
 * See \`core/content/contentScope.ts\` for the same split applied to creature libraries.
 *
 * ── THE CONTRACT, IN THE WORKBOOK'S OWN WORDS ───────────────────────────────────────────────
 *   Lookup            "edition:name; default missing edition to 2024"
 *   Resolved actor    "Do not re-add static ASI, attack bonus, AC, save, or max-HP benefits
 *                      already present on the character"
 *   Outputs           "dpr_delta + personal_ehp_delta + party_ehp_delta; utility/control remain
 *                      zero unless their stated exposure resolves"
 *   Action law        "One Action, Bonus Action, and Reaction budget per turn unless another
 *                      authored rule grants more; use/refresh limits are mandatory"
 *   Missing input     "If a required variable is absent, return NEEDS_INPUT for that channel;
 *                      never convert missing context to zero."
 *
 * ${feats.length} feats · ${Object.entries(byEdition).map(([k, v]) => `${k}: ${v}`).join(" · ")}
 * channels · ${Object.entries(byChannel).map(([k, v]) => `${k} ${v}`).join(" · ")}
 */

/** Which budget a feat's contribution lands on. Three, kept SEPARATE by contract. */
export type FeatChannel = "DPR" | "PERSONAL_EHP" | "PARTY_EHP" | "NONE";

export type FeatPricing = {
  /** \`edition:name\`, the exact match key. */
  key: string;
  edition: string;
  name: string;
  category: string;
  minLevel: number;
  abilityIncrease: number;
  channels: FeatChannel[];
  dprRule: string;
  /** Expression in the workbook's grammar. Evaluated, never executed as code. */
  dpr: string;
  personalEhpRule: string;
  personalEhp: string;
  partyEhpRule: string;
  partyEhp: string;
  /** What the feat costs on the turn. A delta is ZERO when its budget is unavailable. */
  actionBudget: string;
  trigger: string;
  eligibility: string;
  status: string;
  /** The anti-double-count rule. Read before adding a second contribution. */
  doubleCountGuard: string;
  note: string;
};

export const FEAT_PRICING: FeatPricing[] = ${JSON.stringify(feats, null, 2)};

/**
 * The grammar the evaluator must implement, straight from the workbook's dictionary rows.
 *
 * Kept in the generated file so the contract and the table cannot drift apart: an expression that
 * uses a token missing from here is a signal the workbook moved and the evaluator has not.
 */
export const FEAT_EXPRESSION_DICTIONARY: { token: string; meaning: string }[] =
${JSON.stringify(dictionary, null, 2)};

export const FEAT_BY_KEY = new Map(FEAT_PRICING.map(f => [f.key.toLowerCase(), f]));

/**
 * Resolve a feat by name, defaulting a missing edition to 2024.
 *
 * ⚠ THE DEFAULT IS THE WORKBOOK'S, NOT A CONVENIENCE. Tab 17: *"edition:name; default missing
 * edition to 2024"*. A 2014 feat and its 2024 rewrite are different prices under the same name, so
 * guessing the other way would silently misprice every unlabelled character sheet.
 */
export function featPricing(nameOrKey: string): FeatPricing | undefined {
  const raw = (nameOrKey ?? "").trim();
  if (!raw) return undefined;
  const direct = FEAT_BY_KEY.get(raw.toLowerCase());
  if (direct) return direct;
  return FEAT_BY_KEY.get(\`2024:\${raw}\`.toLowerCase());
}
`;

fs.writeFileSync(OUT, out);
console.log(`feats: ${feats.length} · dictionary tokens: ${dictionary.length}`);
console.log("editions:", Object.entries(byEdition).map(([k, v]) => `${k} ${v}`).join(" · "));
console.log("channels:", Object.entries(byChannel).map(([k, v]) => `${k} ${v}`).join(" · "));
