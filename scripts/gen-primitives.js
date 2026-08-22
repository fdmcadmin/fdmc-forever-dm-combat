/**
 * Generate the app's pricing-primitive registry FROM the workbook.
 *
 * ⚠ THE GENERATED FILE IS NEVER HAND-EDITED. RULE 1A: the workbook is the law for the checker and
 * the estimator. A hand-maintained copy of 90 primitives drifts from it on the first edit, and a
 * drifted copy is worse than none — the app would then report a price the workbook never gave.
 *
 * That cuts both ways, and it caught me: the id-phrase matching in `lookupPrimitive` was first
 * written by editing the GENERATED file directly, which meant the next run of this script would
 * have silently deleted it. Anything that belongs in the output belongs in the template below.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────────────────────
 *   node scripts/gen-primitives.js <unzipped-xlsx-dir> <output.ts>
 *
 * The xlsx is a zip; unzip it and point at the directory holding `xl/`. Tab 5 is the Pricing
 * Resolver, tab 10 the Parser Alias & Coverage Gate.
 *
 * ESM, because the package is `"type": "module"`. (`scripts/gen-bond-templates.js` is still
 * CommonJS and would throw if run today — it predates that switch.)
 */
import fs from "node:fs";
import path from "node:path";

const [, , WORKBOOK_DIR, OUT] = process.argv;
if (!WORKBOOK_DIR || !OUT) {
  console.error("usage: node scripts/gen-primitives.js <unzipped-xlsx-dir> <output.ts>");
  process.exit(1);
}

const decode = s => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#10;/g, " ").replace(/&#8217;/g, "’").replace(/&#8594;/g, "->")
  .replace(/&#8212;/g, "—").replace(/&#183;/g, "·")
  .replace(/&amp;/g, "&");                       // last, so "&amp;lt;" does not double-decode

function sheet(n) {
  const xml = fs.readFileSync(path.join(WORKBOOK_DIR, "xl", "worksheets", `sheet${n}.xml`), "utf8");
  return [...xml.matchAll(/<x:row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/x:row>/g)].map(([, rn, body]) => {
    const cells = {};
    for (const c of body.matchAll(/<x:c r="([A-Z]+)\d+"[^>]*?>([\s\S]*?)<\/x:c>/g)) {
      const v = (c[2].match(/<x:v>([\s\S]*?)<\/x:v>/) || [])[1];
      if (v !== undefined) cells[c[1]] = decode(v);
    }
    return { r: +rn, cells };
  });
}

// ── Pricing Resolver (tab 5) ────────────────────────────────────────────────────────────────
const prim = [];
for (const { r, cells } of sheet(5)) {
  if (r < 3 || !cells.A || !cells.B) continue;
  if (/^HARD GATE/.test(cells.A)) continue;          // the gate's own banner row, not a primitive
  prim.push({
    id: cells.A, channel: cells.B, family: cells.C, model: cells.D,
    priced: cells.E, inputs: cells.F, guard: cells.G, status: cells.H, source: cells.I,
  });
}

// ── Parser Alias & Coverage Gate (tab 10) ───────────────────────────────────────────────────
const alias = [];
for (const { r, cells } of sheet(10)) {
  if (r < 3 || !cells.A || !cells.B) continue;
  if (cells.D === "BLOCK") continue;                 // the catch-all row IS the gate, not an alias
  alias.push({ pattern: cells.A, primitive: cells.B, meaning: cells.C });
}

const channels = [...new Set(prim.map(p => p.channel))];

const out = `/**
 * WORKBOOK PRICING PRIMITIVES — the app's copy of the law.
 *
 * ⚠ GENERATED from \`broken_chain_encounter_checker_v7_7_claude_app_contract.xlsx\` by
 * \`scripts/gen-primitives.js\`. Do not hand-edit: RULE 1A makes the workbook the authority for the
 * checker and the estimator, and a hand-maintained copy of ${prim.length} primitives drifts from it on the
 * first edit. A drifted copy is worse than none, because the app would then report a price the
 * workbook never gave. Anything this file should contain belongs in the generator's template.
 *
 * ── THE CONTRACT THIS SERVES ────────────────────────────────────────────────────────────────
 * Runtime Contract, "Pricing boundary": *"The app parses imported mechanics into generic primitive
 * IDs + parameters."* Imported campaign data supplies authored FACTS — bodies, HP, actions, damage
 * packets. It never supplies pricing law. That lives here.
 *
 * ── THE HARD GATE ───────────────────────────────────────────────────────────────────────────
 * Coverage Gate, final row: *"<anything unmapped> → NEEDS PRICING PRIMITIVE — BLOCK: add a generic
 * resolver to this workbook before accepting the price."* And the Runtime Contract: *"Do not
 * ignore it, approximate from CR/tier, or invent a creature-specific exception."*
 *
 * That is the whole point of this file. An unmapped mechanic must be LOUD, because the failure it
 * replaces is silent — a creature priced from its CR reads as a working answer and is a guess.
 */

/** What kind of budget a primitive draws on. */
export type PrimitiveChannel = ${channels.map(c => JSON.stringify(c)).join(" | ")};

export type PricingPrimitive = {
  id: string;
  channel: PrimitiveChannel;
  /** The effect family it belongs to — several primitives share one. */
  family: string;
  /** The resolution model the workbook prices it with. */
  model: string;
  /** How the workbook says to price it. */
  priced: string;
  /** What the app must supply to price it. */
  inputs: string;
  /** The anti-double-count rule. Read this before adding a second contribution. */
  guard: string;
  /** SUPPORTED = workbook baseline. ADDED = extended for authored campaign content. */
  status: string;
  source: string;
};

export const PRICING_PRIMITIVES: PricingPrimitive[] = ${JSON.stringify(prim, null, 2)};

/**
 * Text patterns the workbook maps to a primitive.
 *
 * These are the workbook's OWN aliases, not a parser invented here — matching them is how a parsed
 * mechanic reaches a primitive without a creature-specific exception.
 */
export const PRIMITIVE_ALIASES: { pattern: string; primitive: string; meaning: string }[] =
${JSON.stringify(alias, null, 2)};

export const PRIMITIVE_BY_ID = new Map(PRICING_PRIMITIVES.map(p => [p.id, p]));

/** The gate's return value. Never silently absent, never a CR guess. */
export const NEEDS_PRICING_PRIMITIVE = "NEEDS PRICING PRIMITIVE" as const;

export type PrimitiveLookup =
  | { ok: true; primitive: PricingPrimitive; matchedBy: "id" | "alias"; pattern?: string }
  | { ok: false; reason: typeof NEEDS_PRICING_PRIMITIVE; text: string };

/**
 * Map one parsed mechanic to a primitive, or BLOCK.
 *
 * ⚠ NO FALLBACK. There is deliberately no "closest match", no family guess and no CR proxy: every
 * one of those returns a number that looks priced and is not. The workbook's instruction when this
 * blocks is to ADD A GENERIC RESOLVER TO THE WORKBOOK and rerun.
 */
export function lookupPrimitive(text: string): PrimitiveLookup {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return { ok: false, reason: NEEDS_PRICING_PRIMITIVE, text };

  const direct = PRIMITIVE_BY_ID.get(t.replace(/\\s+/g, "_"));
  if (direct) return { ok: true, primitive: direct, matchedBy: "id" };

  /**
   * A primitive ID IS a phrase. "difficult_terrain" is written "difficult terrain" in authored
   * prose, "damage_threshold_or_cap" as "damage threshold". Matching only the alias table missed
   * every mechanic the workbook named directly in its own ID — which is most of them.
   *
   * Longest first, so "attack_disadvantage_until_hit" is not swallowed by "attack_disadvantage".
   */
  for (const p of [...PRICING_PRIMITIVES].sort((a, b) => b.id.length - a.id.length)) {
    const phrase = p.id.replace(/_/g, " ");
    if (phrase.length > 5 && t.includes(phrase)) return { ok: true, primitive: p, matchedBy: "id" };
    // Also the distinctive head of a compound id: "legendary resistance", "death burst".
    const head = phrase.split(" ").slice(0, 2).join(" ");
    if (head.length > 8 && t.includes(head)) return { ok: true, primitive: p, matchedBy: "id" };
  }

  for (const a of PRIMITIVE_ALIASES) {
    // An alias row may list several spellings separated by "/" — each is its own pattern.
    const parts = a.pattern.toLowerCase().split(/\\s*\\/\\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.some(p => p.length > 2 && t.includes(p))) {
      const primitive = PRIMITIVE_BY_ID.get(a.primitive);
      if (primitive) return { ok: true, primitive, matchedBy: "alias", pattern: a.pattern };
    }
  }
  return { ok: false, reason: NEEDS_PRICING_PRIMITIVE, text };
}

/** Every primitive in a channel — used to check a body's scheduled output is fully priced. */
export function primitivesInChannel(channel: PrimitiveChannel): PricingPrimitive[] {
  return PRICING_PRIMITIVES.filter(p => p.channel === channel);
}
`;

fs.writeFileSync(OUT, out);
console.log(`primitives: ${prim.length} · aliases: ${alias.length}`);
const tally = key => {
  const g = {};
  for (const p of prim) g[p[key]] = (g[p[key]] ?? 0) + 1;
  return Object.entries(g).map(([k, v]) => `${k} ${v}`).join(" · ");
};
console.log("channels:", tally("channel"));
console.log("status  :", tally("status"));
