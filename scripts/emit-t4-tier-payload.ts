/**
 * EMIT AN AUTHORING PAYLOAD CARRYING THE TIER 4 TIER LABELS.
 *   npx tsx scripts/emit-t4-tier-payload.ts
 *   npm run fold:authoring -- authoring/convergence-tiers.json
 *
 * ⚠ THE EIGHT TIER 4 SINGULARS LIVE IN THE AUTHORED LAYER, and `authored.generated.ts` carries
 * "Do not hand-edit" for the reason the fold exists: a generated blob must not be rewritten by
 * hand or the next fold silently reverts it. `seed-convergence-tiers.mjs` writes the sixteen that
 * live in the SEED and hands these eight here, which is the documented route —
 * `the-fold-is-mine-to-drive`: a payload plus `fold:authoring`, never a punch list.
 *
 * ⚠ AND IT CARRIES EACH ITEM WHOLE, not a patch. `mergeById` merges equipment by id and the folded
 * entry REPLACES the authored one, so an item emitted with only its tier would arrive having lost
 * everything else it said. Read the merged library, add one field, write the item back.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY as LIB } from "../src/data/broken-chain/equipmentLibrary";
import { AUTHORED_ENCOUNTERS } from "../src/data/broken-chain/authored.generated";

/**
 * ⚠ ALL TWENTY-FOUR, NOT JUST THE EIGHT — AND THE FIRST RUN PROVED WHY.
 *
 * `seed-convergence-tiers.mjs` wrote the sixteen ordinary outputs into the SEED and the merged
 * library still read `(NO TIER)` for every one of them. `mergeAuthored` lets the AUTHORED copy
 * shadow the seed, and all sixteen exist in both — the same shape as the nine weapon riders at
 * 0.8.40.5, arriving from the other direction.
 *
 * So the seed keeps its copy (it is what a re-seed pushes into the author's own library, and the
 * durable home for content that ships) and the fold carries every output, because that is the one
 * that decides what the app actually reads today.
 *
 * Transcribed from v6, which states the tier on each item's own line.
 */
const TIERS: Record<string, string> = {
  "Anchor Thread": "T1", "Clarity Hood": "T1", "Step Stabilizer": "T1",
  "Reinforced Wrap": "T1", "Lensing Glass": "T1", "Splitgrain Grip": "T1",

  "Drift Anchor": "T2", "Hollowlight": "T2", "Quickstep": "T2", "Edgeworn": "T2",
  "Driftveil": "T2", "Clearward Mantle": "T2", "Turnstep Relay": "T2",
  "Opening Thorn": "T2", "Heldroot Knot": "T2", "Rootfast Loop": "T2",

  "Blinkstep — Tempered": "T4", "Applied Insight — Tempered": "T4",
  "Deferred Wound — Tempered": "T4", "True Ground — Tempered": "T4",
  "Condition Vessel — Tempered": "T4", "Rupture — Tempered": "T4",
  "Threat Positioning — Tempered": "T4", "Preserved Reaction — Tempered": "T4",
};
const T4_NAMES = Object.keys(TIERS);

type Conv = { role?: string; tier?: string } & Record<string, unknown>;

const items = [];
const missing: string[] = [];

for (const name of T4_NAMES) {
  const item = LIB.find(i => i.name === name);
  if (!item) { missing.push(name); continue; }
  const conv = (item as unknown as { convergence?: Conv }).convergence;
  if (conv?.role !== "output") { missing.push(`${name} (not an output)`); continue; }
  items.push({ ...item, convergence: { ...conv, tier: TIERS[name] } });
}

if (missing.length) {
  console.error(`FATAL: ${missing.length} Tier 4 item(s) not found — nothing written:`);
  for (const m of missing) console.error("  " + m);
  process.exit(1);
}

const out = resolve("authoring/convergence-tiers.json");
mkdirSync(dirname(out), { recursive: true });
/**
 * ⚠ THE ENCOUNTERS HAVE TO RIDE ALONG, AND LEAVING THEM OUT COST ME THE WHOLE SET.
 *
 * `fold-authoring.mjs`: *"Older exports predate encounters. Absent is legal and folds to an empty
 * array"* — creatures and equipment MERGE by id, encounters REPLACE. So an equipment-only payload
 * is fine for equipment and silently writes `AUTHORED_ENCOUNTERS = []`. The first run of this
 * script deleted all 24 authored encounters — 587 lines — and `check:pools` caught it one command
 * later, which is the only reason it was a scare rather than a loss.
 *
 * They are passed through VERBATIM from the current authored file: this payload changes equipment
 * and must not restate anything else.
 */
writeFileSync(out, JSON.stringify({
  schema: "fdmc.campaign-authoring.v1",
  exportedAt: new Date().toISOString(),
  note: "Convergence output tier labels T1-T4, transcribed from loot doc v6. Encounters carried through unchanged.",
  equipment: items,
  encounters: AUTHORED_ENCOUNTERS,
}, null, 2), "utf8");

console.log(`Wrote ${items.length} Tier 4 item(s) to ${out}`);
for (const i of items) console.log(`  ${i.name} → ${TIERS[i.name]}`);
console.log("\nNow run: npm run fold:authoring -- authoring/convergence-tiers.json");
