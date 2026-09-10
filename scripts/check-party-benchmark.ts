/**
 * THE MIDPOINT IS DRAWN FOR THE PARTY THAT IS STANDING ON IT.
 *   npm run check:benchmark
 *
 * `midpointFor` read the FOUR-PLAYER row always, while the current side is the party's own
 * size-scaled profile. A five-player table was therefore measured against a four-player line and
 * read permanently over it — by the 5P/4P ratio and nothing else.
 *
 * Christopher, 2026-09-07, at L7 / 5P / Broken Chain: *"there is no way my currenty party is this
 * strong above the line"*, and *"it shows them able to do 165 per round, which is way too high."*
 * The 165 is not the app's invention — it is the certified 5P L7 BC R1 to three decimals. What was
 * wrong was the line it was being held against.
 *
 * ⚠ THE FIRST ASSERTION IS THE BUG, REPRODUCED. A gate that only checked the fixed behaviour would
 * pass just as well against a midpoint that ignored size in the other direction.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { midpointFor, partyBenchmark } from "../src/core/encounter-band/partyBenchmark";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PARTY_CURVE_V2 } from "../src/core/encounter-band/partyCurveV2";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

const L = 7;
const MODE = "brokenChain" as const;
const row: any = PARTY_CURVE_V2.find((r: any) => r.level === L)!;
const four = row[MODE];
const five = row.bySize?.[5]?.[MODE];

console.log("The midpoint follows the party's size\n");

console.log("The curve certifies each size independently");
{
  ok("L7 has a certified 5P row", Boolean(five), five ? `R1 ${five.round1.toFixed(3)}` : "missing");
  ok("...and it is not the 4P row", Boolean(five) && !near(five.round1, four.round1, 0.001),
    `5P ${five?.round1.toFixed(3)} vs 4P ${four.round1.toFixed(3)}`);
}

console.log("\nThe line is drawn for the size asked for");
{
  const mid4: any = midpointFor(L, MODE, 4);
  const mid5: any = midpointFor(L, MODE, 5);
  ok("asking for 4P gives the 4P row", near(mid4.round1, four.round1, 0.001), mid4.round1.toFixed(3));
  ok("asking for 5P gives the 5P row", near(mid5.round1, five.round1, 0.001), mid5.round1.toFixed(3));
  ok("...and says it is size-certified", mid5.sizeCertified === true);

  // A size the table does not certify still gets an answer — the published 4P line.
  const mid9: any = midpointFor(L, MODE, 9);
  ok("an uncertified size falls back to the published 4P line",
    near(mid9.round1, four.round1, 0.001) && mid9.sizeCertified === false, mid9.round1.toFixed(3));

  const midNone: any = midpointFor(L, MODE);
  ok("omitting the size keeps the old published-4P behaviour",
    near(midNone.round1, four.round1, 0.001) && midNone.sizeCertified === false);
}

console.log("\nA party standing exactly on its own curve reads as ON the line");
{
  const current = {
    round1: five.round1, round2: five.round2, round3: five.round3,
    round4Plus: five.round4Plus, sustain: five.sustain,
  };

  /**
   * ⚠ THE BUG, REPRODUCED. Without a size the 5P party is held against the 4P line and reads
   * over it by the ratio — which is what the panel was showing and what was reported.
   */
  const unsized: any = partyBenchmark({ level: L, mode: MODE, current })!;
  const r1Unsized = unsized.rows.find((r: any) => r.key === "round1");
  const susUnsized = unsized.rows.find((r: any) => r.key === "sustain");
  ok("reproduced: unsized, a 5P party reads far over the line",
    r1Unsized.percent > 0.3 && susUnsized.percent > 0.4,
    `R1 +${r1Unsized.delta.toFixed(1)} (${(r1Unsized.percent * 100).toFixed(0)}%), `
    + `Sustain +${susUnsized.delta.toFixed(1)} (${(susUnsized.percent * 100).toFixed(0)}%)`);
  ok("...and that excess is exactly the size ratio, not strength",
    near(r1Unsized.delta, five.round1 - four.round1, 0.01)
    && near(susUnsized.delta, five.sustain - four.sustain, 0.01));

  const sized: any = partyBenchmark({ level: L, mode: MODE, partySize: 5, current })!;
  for (const r of sized.rows) {
    ok(`${r.label} sits on the line`, near(r.delta, 0, 0.01),
      `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)}`);
  }
}

console.log("\nAnd a real difference still shows");
{
  const current = {
    round1: five.round1 + 20, round2: five.round2, round3: five.round3,
    round4Plus: five.round4Plus, sustain: five.sustain,
  };
  const b: any = partyBenchmark({ level: L, mode: MODE, partySize: 5, current })!;
  const r1 = b.rows.find((r: any) => r.key === "round1");
  ok("a party genuinely 20 DPR over its line reads +20", near(r1.delta, 20, 0.01),
    `+${r1.delta.toFixed(2)}`);
}

/* ── ONE SUSTAIN, TWO READERS ─────────────────────────────────────────────────────────────── */
console.log("\nThe rated party and the simulated party are the same party");
{
  /**
   * ⚠ THEY WERE NOT, AND IT IS WHY A PROJECTED DOWN READ AS UNBELIEVABLE.
   *
   * The difficulty row rated a party at `certified x resistance + feat EHP + read healing`, while
   * the simulation beside it ran on `certified x resistance` alone. Every survivor count, clear
   * round and margin therefore came out of a party with strictly LESS sustain than the row above
   * them described — feats and a healer's whole output silently absent from the fight.
   *
   * This is the sustain half of the fault fixed for DPR at 0.8.36.0: *"explain why the R1 shows
   * 138 damage, but the party shows able to do only 94.3."* Two parties, one screen.
   *
   * ⚠ THE ASSERTION IS ON THE SOURCE because the panel is a component and the defect is which
   * expression each call site reads. A value test cannot see two call sites agreeing by accident.
   */
  const panel = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..",
    "src/core/encounter-band/EncounterDifficultyPanel.tsx"), "utf8");
  const code = panel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  ok("the panel derives ONE party sustain", /const partySustain = useMemo/.test(code));
  const readers = code.match(/sustain: partySustain\b/g) ?? [];
  ok("...and both the benchmark and the simulation read it", readers.length === 2,
    `${readers.length} reader(s)`);

  /**
   * ⚠ AND NEITHER REBUILDS IT. `profile.sustain * …` beside a `sustain:` key is the shape that
   * diverged; the two copies drifted the moment one gained a term the other did not.
   */
  const rebuilt = /sustain:\s*profile\.sustain\s*\*/.exec(code);
  ok("neither call site recomputes the expression", rebuilt === null,
    rebuilt ? `found ${JSON.stringify(rebuilt[0])}` : "");
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
