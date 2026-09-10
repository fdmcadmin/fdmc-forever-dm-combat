#!/usr/bin/env node
/**
 * WRITE THE NINE WEAPON RIDERS INTO THE HAND-AUTHORED SEED.
 *   node scripts/seed-item-riders.mjs
 *
 * ⚠ WHY THE SEED AND NOT THE FOLD — AND THIS WAS LEARNED THE HARD WAY, TODAY.
 *
 * The riders were folded into the authored layer at 0.8.40.3 and were GONE an hour later. The
 * author published from the app at 21:19Z; their local library still had Rimecleaver with no
 * riders, because the build carrying them had not deployed yet; equipment merges by id, so their
 * older copy replaced the newer fold. Measured after: `riders: []`.
 *
 * That is `mergeById` working exactly as designed — a publish updates the authored set — pointed
 * at the one case it cannot get right, where the FOLD was the newer edit and the publish was the
 * stale one. Re-folding would lose the same race again on the next publish.
 *
 * The seed is the way out. `seedCampaignEquipmentLibrary` re-seeds every campaign item whenever
 * the seed fingerprint changes, so writing them here pushes them INTO the author's library, and
 * their next export carries them back rather than overwriting them. Content that ships belongs in
 * the tree; the authored layer is for what the author changes.
 *
 * ⚠ THIS EDITS HAND-AUTHORED SOURCE, WHICH THE FOLD SCRIPT IS FORBIDDEN TO DO. That rule exists
 * so a generated blob cannot rewrite the tree. This is not a generated blob — it is a one-time
 * authoring pass, run deliberately, whose result is reviewable in the diff.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve("src/data/broken-chain/equipmentLibrary.ts");

/**
 * Keyed by authored id. Cadence is the DOCUMENT'S — every one of these prints "Once per round",
 * so `perRound`, not the `perTurn` the eight Gift chassis riders happen to use.
 */
const RIDERS = {
  "tbc-frostmarrow-spear": [
    { id: "frostmarrow-bite", label: "Frostmarrow", cadence: "perRound",
      condition: "On a hit: DC 13 Constitution save or its Speed drops by 10 ft until the end of its next turn." },
  ],
  "tbc-rimecleaver-versatile-thrown-handaxe-equivalent-1-no-attunement": [
    { id: "rimecleaver-rimebite", label: "Rimebite", formula: "1d6", damageType: "Cold", cadence: "perRound" },
    { id: "rimecleaver-step", label: "Cleaving Step", cadence: "perRound",
      condition: "When a hit with this weapon drops a creature to 0 HP: move up to 10 ft without provoking." },
  ],
  "tbc-splitfrost-blade": [
    { id: "splitfrost-split", label: "Splitfrost", cadence: "perRound",
      condition: "On a hit: that creature's first attack roll against you before the start of your next turn has disadvantage." },
  ],
  "tbc-coldsnap-bow": [
    { id: "coldsnap-bite", label: "Coldsnap", formula: "1d4", damageType: "Cold", cadence: "perRound" },
  ],
  "tbc-lake-ice-blade": [
    { id: "lake-ice-bite", label: "Lake-Ice", formula: "1d6", damageType: "Cold", cadence: "perRound" },
  ],
  "tbc-shattered-vigil": [
    { id: "shattered-vigil-bite", label: "Shattered Vigil", formula: "1d8", damageType: "Cold", cadence: "perRound" },
    { id: "shattered-vigil-topple", label: "Vigil Broken", cadence: "shortRest",
      condition: "On a hit: DC 14 Strength save or knocked prone. Once per short or long rest." },
  ],
  "tbc-hollow-fang": [
    { id: "hollow-fang-bite", label: "Hollow Fang", formula: "1d6", damageType: "Cold", cadence: "perRound",
      condition: "If you are at or below half your HP maximum when this lands, you regain 1d4 HP. Not against a Construct or Undead." },
  ],
  "tbc-starvation-brand": [
    { id: "starvation-brand-bite", label: "Starvation", formula: "1d6", damageType: "Cold", cadence: "perRound",
      condition: "Until the start of your next turn, that creature regains only half as many HP from any healing, rounding down." },
  ],
  "tbc-voidtempered-blade-versatile-longsword": [
    { id: "voidtempered-bite", label: "Voidtempered", formula: "1d8", damageType: "Cold", cadence: "perRound",
      condition: "Only on a turn you also cast a spell." },
  ],
};

let text = readFileSync(FILE, "utf8");
const applied = [];
const missing = [];

for (const [id, riders] of Object.entries(RIDERS)) {
  const idLine = `    "id": "${id}",`;
  const at = text.indexOf(idLine);
  if (at < 0) { missing.push(id); continue; }
  if (text.slice(at, at + 3000).includes('"riders"')) { applied.push(`${id} (already present, skipped)`); continue; }
  // Insert directly after the id line so the riders read beside the identity they belong to.
  const insertAt = at + idLine.length;
  const block = "\n    \"riders\": " + JSON.stringify(riders, null, 2).split("\n").map((l, i) => i === 0 ? l : "    " + l).join("\n") + ",";
  text = text.slice(0, insertAt) + block + text.slice(insertAt);
  applied.push(`${id} — ${riders.length} rider(s)`);
}

if (missing.length) {
  console.error(`FATAL: ${missing.length} id(s) not found in the seed:`);
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

writeFileSync(FILE, text, "utf8");
console.log(`Wrote riders into ${FILE}\n`);
applied.forEach(a => console.log(`  ${a}`));
