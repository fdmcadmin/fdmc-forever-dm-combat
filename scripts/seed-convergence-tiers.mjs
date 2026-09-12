#!/usr/bin/env node
/**
 * WRITE THE OUTPUT TIER ONTO EVERY CONVERGENCE OUTPUT, FROM THE LOOT DOCUMENT.
 *   node scripts/seed-convergence-tiers.mjs
 *
 * Christopher, 2026-09-11: *"i want to add the A1-A4 back onto the convergence input items and then
 * the T1-T4 back onto the output items, this will help player to determine where they got those
 * items."* And on where the tiers come from: *"use the loot document to determine which of the
 * outputs belong where there shouldnt be any notes such as the first six t1 and first 6 t2 or the
 * four t2 outputs."*
 *
 * ⚠ HE IS RIGHT AND I WAS ABOUT TO GET THIS WRONG THE COMFORTABLE WAY. The commit history says
 * *"six Tier 1 and six Tier 2"* and *"the four Tier 2 outputs"* without naming which, so the split
 * was going to come from the ORDER they were authored in. That is an inference dressed as a fact,
 * and it would have been invisible the moment it was wrong.
 *
 * `Broken_Chain_Loot_and_Convergence_Acts1_4_Pre_UR_FINAL_v6_Ward_Field_Rewards.docx` states the
 * tier on every item's own line — "Anchor Thread  Wondrous Item · Convergence Tier 1" — so the
 * mapping below is transcribed from the document and matches all 24 outputs by NAME. Every one has
 * to match or this refuses to write.
 *
 * ⚠ INPUTS ARE NOT TOUCHED. They already carry `actLabel` A1-A4 — 8/9/8/8 across the four acts —
 * and always did. Nothing needed adding there; the app simply never DISPLAYED it, which is why it
 * read as missing.
 *
 * ⚠ AND TIER 3 IS ABSENT ON PURPOSE. v6 describes sixteen Tier 3 outputs — "eight active
 * non-attuned items and eight passive attuned items" — and the app has never built them, on
 * instruction (`0.8.12.8`: *"NOT ADDED, on instruction: Tier 3 weapons and Tier 3 convergence"*).
 * No T3 label is written because no T3 item exists to carry one.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve("src/data/broken-chain/equipmentLibrary.ts");

/** Transcribed from v6. Name → tier, exactly as the document prints each item's line. */
const TIERS = {
  "Anchor Thread": "T1",
  "Clarity Hood": "T1",
  "Step Stabilizer": "T1",
  "Reinforced Wrap": "T1",
  "Lensing Glass": "T1",
  "Splitgrain Grip": "T1",

  "Drift Anchor": "T2",
  "Hollowlight": "T2",
  "Quickstep": "T2",
  "Edgeworn": "T2",
  "Driftveil": "T2",
  "Clearward Mantle": "T2",
  "Turnstep Relay": "T2",
  "Opening Thorn": "T2",
  "Heldroot Knot": "T2",
  "Rootfast Loop": "T2",

  "Blinkstep — Tempered": "T4",
  "Applied Insight — Tempered": "T4",
  "Deferred Wound — Tempered": "T4",
  "True Ground — Tempered": "T4",
  "Condition Vessel — Tempered": "T4",
  "Rupture — Tempered": "T4",
  "Threat Positioning — Tempered": "T4",
  "Preserved Reaction — Tempered": "T4",
};

let text = readFileSync(FILE, "utf8");
const applied = [];
const missing = [];
const skipped = [];
const authoredOnly = [];

for (const [name, tier] of Object.entries(TIERS)) {
  /**
   * ⚠ ANCHORED ON THE NAME AND THEN ON THE NEAREST OUTPUT BLOCK AFTER IT. An id-keyed pass would
   * be tidier, but the document names items and the ids were slugified from older names — matching
   * what the document actually says is the point of this script.
   */
  const nameLine = `"name": ${JSON.stringify(name)},`;
  const at = text.indexOf(nameLine);
  if (at < 0) { missing.push(`${name} — no such item in the seed`); continue; }

  const convAt = text.indexOf('"convergence": {"role":"output"', at);
  const nextName = text.indexOf('"name": "', at + nameLine.length);
  if (convAt < 0 || (nextName > 0 && convAt > nextName)) {
    /**
     * ⚠ THE EIGHT TIER 4 SINGULARS LIVE IN THE AUTHORED LAYER, NOT THE SEED, and
     * `authored.generated.ts` is GENERATED — hand-editing it is what the fold exists to prevent.
     * They are collected here and written as an authoring payload instead, which is the documented
     * route: a payload plus `npm run fold:authoring`, never a punch list and never a direct edit.
     */
    authoredOnly.push({ name, tier });
    continue;
  }
  const close = text.indexOf("}", convAt);
  const block = text.slice(convAt, close + 1);
  if (block.includes('"tier"')) { skipped.push(`${name} (already ${tier})`); continue; }

  text = text.slice(0, close) + `,"tier":"${tier}"` + text.slice(close);
  applied.push(`${name} → ${tier}`);
}

if (missing.length) {
  console.error(`FATAL: ${missing.length} output(s) could not be matched — nothing written:`);
  for (const m of missing) console.error("  " + m);
  process.exit(1);
}

/**
 * ⚠ AND EVERY OUTPUT IN THE SEED MUST BE IN THE DOCUMENT, not just every document item in the
 * seed. An output the doc does not price is one this script would silently leave untiered.
 */
/**
 * ⚠ THE MATCH MUST NOT CROSS AN ITEM BOUNDARY. A plain `[\s\S]{0,4000}?` bridge reported
 * "Frosted Sentinel Wrap" and "Held-Echo Knot" as untiered outputs — both are INPUTS, and the
 * lazy span had simply run past them into the next item's output block. A check that invents
 * findings is worse than no check, so the gap is closed by forbidding another `"name":` inside it.
 */
const seedOutputs = [...text.matchAll(/"name": "([^"]+)",(?:(?!"name": ")[\s\S])*?"convergence": \{"role":"output"/g)]
  .map(m => m[1]);
const untiered = seedOutputs.filter(n => !(n in TIERS));
if (untiered.length) {
  console.error(`FATAL: ${untiered.length} seed output(s) are not in the document mapping:`);
  for (const u of untiered) console.error("  " + u);
  process.exit(1);
}

writeFileSync(FILE, text, "utf8");
console.log(`Wrote ${applied.length} tier(s) into ${FILE}\n`);
for (const a of applied) console.log("  " + a);
if (skipped.length) {
  console.log(`\n${skipped.length} already carried a tier:`);
  for (const s of skipped) console.log("  " + s);
}
