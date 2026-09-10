/**
 * AUTHOR THE NINE WEAPON RIDERS THE LOOT DOCUMENT PRINTS.
 *   npx tsx scripts/build-item-riders-payload.ts
 *
 * Christopher, 2026-09-10: *"author all 9 and ensure that they match the cadence of the loot
 * document."*
 *
 * ─── ⚠ THE CADENCE IS THE DOCUMENT'S, NOT THE HOUSE HABIT ───────────────────────────────────
 *
 * All eight Gift chassis riders in the library are `perTurn`, and copying that here would have
 * been the easy wrong answer. Every one of these nine prints **"Once per round"**, so they are
 * `perRound` — a different question with a different reset, and the two are not interchangeable
 * at a table where an opportunity attack lands on somebody else's turn.
 *
 * Shattered Vigil prints a SECOND rider at "Once per short or long rest", so it gets `shortRest`.
 * That one deliberately does not appear in the card's per-turn claim chip: a rest-cadence rider
 * has a different reset, and showing it there would hand the table a once-a-rest effect every
 * round.
 *
 * ─── ⚠ WHAT IS NOT AUTHORED, AND WHY ────────────────────────────────────────────────────────
 *
 * The Lake-Ice Flail's on-kill splash — *"when you reduce a creature to 0 hit points, each other
 * creature of your choice within 10 feet takes 1d6 cold damage"* — states NO cadence. Guessing one
 * would be inventing a limit the document does not impose, or removing one it means to. It is
 * reported instead. Same rule as everywhere else: never infer data from prose.
 *
 * A rider with no `formula` is not a mistake. Frostmarrow's speed drop and Splitfrost's imposed
 * disadvantage are riders that deal nothing — the app tracks the cadence and the table rules on
 * the effect, which is exactly what `ItemRider.condition` is for.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = resolve("authoring/current.json");
const OUT = resolve("authoring/item-riders.json");

type Rider = { id: string; label: string; formula?: string; damageType?: string; cadence: string; condition?: string };

/** Keyed by the item's authored NAME, because the ids are long and the document names them. */
const RIDERS: Record<string, Rider[]> = {
  "Frostmarrow Spear": [
    { id: "frostmarrow-bite", label: "Frostmarrow", cadence: "perRound",
      condition: "On a hit: DC 13 Constitution save or its Speed drops by 10 ft until the end of its next turn." },
  ],
  "Rimecleaver": [
    { id: "rimecleaver-rimebite", label: "Rimebite", formula: "1d6", damageType: "Cold", cadence: "perRound" },
    { id: "rimecleaver-step", label: "Cleaving Step", cadence: "perRound",
      condition: "When a hit with this weapon drops a creature to 0 HP: move up to 10 ft without provoking." },
  ],
  "Splitfrost Blade": [
    { id: "splitfrost-split", label: "Splitfrost", cadence: "perRound",
      condition: "On a hit: that creature's first attack roll against you before the start of your next turn has disadvantage." },
  ],
  "Coldsnap Bow": [
    { id: "coldsnap-bite", label: "Coldsnap", formula: "1d4", damageType: "Cold", cadence: "perRound" },
  ],
  "Lake-Ice Flail": [
    { id: "lake-ice-bite", label: "Lake-Ice", formula: "1d6", damageType: "Cold", cadence: "perRound" },
  ],
  "Shattered Vigil": [
    { id: "shattered-vigil-bite", label: "Shattered Vigil", formula: "1d8", damageType: "Cold", cadence: "perRound" },
    { id: "shattered-vigil-topple", label: "Vigil Broken", cadence: "shortRest",
      condition: "On a hit: DC 14 Strength save or knocked prone. Once per short or long rest." },
  ],
  "Hollow Fang": [
    { id: "hollow-fang-bite", label: "Hollow Fang", formula: "1d6", damageType: "Cold", cadence: "perRound",
      condition: "If you are at or below half your HP maximum when this lands, you regain 1d4 HP. Not against a Construct or Undead." },
  ],
  "Starvation Brand": [
    { id: "starvation-brand-bite", label: "Starvation", formula: "1d6", damageType: "Cold", cadence: "perRound",
      condition: "Until the start of your next turn, that creature regains only half as many HP from any healing, rounding down." },
  ],
  "Voidtempered Blade": [
    { id: "voidtempered-bite", label: "Voidtempered", formula: "1d8", damageType: "Cold", cadence: "perRound",
      condition: "Only on a turn you also cast a spell." },
  ],
};

const payload = JSON.parse(readFileSync(SOURCE, "utf8")) as {
  schema: string; exportedAt: string; digest?: string;
  monsters: unknown[]; equipment: Array<Record<string, unknown>>; encounters: unknown[];
};

const applied: string[] = [];
const missing: string[] = [];
const equipment = payload.equipment.map(item => {
  const riders = RIDERS[String(item.name)];
  if (!riders) return item;
  applied.push(`${String(item.name).padEnd(22)} ${riders.map(r => `${r.label} [${r.cadence}]${r.formula ? ` ${r.formula} ${r.damageType}` : " (no dice)"}`).join("  ·  ")}`);
  return { ...item, riders };
});
for (const name of Object.keys(RIDERS)) {
  if (!payload.equipment.some(i => i.name === name)) missing.push(name);
}
if (missing.length) {
  console.error(`FATAL: ${missing.length} item(s) named here are not in the payload:`);
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

// No digest: the fold computes and stamps its own — see the Act 3 payload for the reasoning.
writeFileSync(OUT, JSON.stringify({
  schema: payload.schema,
  exportedAt: new Date().toISOString(),
  monsters: payload.monsters,
  equipment,
  encounters: payload.encounters,
}, null, 1) + "\n", "utf8");

console.log(`Item rider payload -> ${OUT}\n`);
applied.forEach(a => console.log(`  ${a}`));
console.log(`\n  ${applied.length} item(s) given riders · ${equipment.length} item(s) carried through`);
console.log(`  NOT authored: the Lake-Ice Flail's on-kill splash states no cadence — reported, not guessed.`);
