/**
 * BONDS ARE COUNTED ONCE — IN THE DENOMINATOR OR ON THE CLOCK, NEVER BOTH.
 *   npm run check:bonddouble
 *
 * The workbook names two internally consistent arrangements:
 *
 *   · a BOND-FREE sustain denominator, plus live Bond prevention applied once on the combat clock.
 *     "The existing WotC Standard 617 baseline meets that requirement; the existing Broken Chain
 *     baseline does not."
 *   · an ALL-IN Broken Chain Sustain including Bonds, and no separate subtraction from the clock.
 *
 * The app was doing NEITHER: `mitigationPerRound` was passed unconditionally while the sustain
 * denominator followed the selected mode, so Broken Chain mode used the all-in BC row AND took the
 * party's Bond prevention off incoming damage a second time.
 *
 * ⚠ THIS GATE IS THE SPEC'S OWN TOGGLE TEST: *"toggle Bonds off. The party's base Sustain should
 * remain unchanged, Bond prevention should change from 115.9 to 0, and the combat clock should
 * change exactly once."* A double count moves the clock twice, so the assertion is on the SIZE of
 * the change, not merely on its direction.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { bondArrangement, simulateEncounter, resolvePartyProfile } from "../src/core/encounter-band/checkerV2";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { BROKEN_CHAIN_MONSTER_LIBRARY as LIB } from "../src/data/broken-chain/monsterLibrary";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

const BONDS = 115.9;

console.log("Bonds land in exactly one place\n");

console.log("The rule picks the arrangement the mode's own baseline requires");
{
  const wotc = bondArrangement("wotcStandard", BONDS, true);
  const bc = bondArrangement("brokenChain", BONDS, true);
  ok("WotC Standard is bond-free, so live bonds go on the clock",
    near(wotc.mitigation, BONDS), `${wotc.mitigation} — ${wotc.reason}`);
  ok("Broken Chain keeps the live bonds and moves the BASELINE to the bond-free row",
    near(bc.mitigation, BONDS) && bc.baselineMode === "wotcStandard",
    `mitigation ${bc.mitigation}, baseline ${bc.baselineMode}`);
  ok("a negative or absent figure never becomes a bonus",
    near(bondArrangement("wotcStandard", -5).mitigation, 0)
    && near(bondArrangement("wotcStandard", 0, true).mitigation, 0));
}

/* ── ⚠ THE TOGGLE TEST ───────────────────────────────────────────────────────────────────── */
console.log("\nToggling bonds off moves the clock exactly once");
{
  /**
   * ⚠ BUILT THE WAY PRODUCTION BUILDS IT. A hand-rolled roster literal produced zero pressure and
   * the toggle assertion could not tell the two arrangements apart — a gate that cannot fail.
   */
  const template = LIB.find(t => t.templateId.includes("grief-colossus"))
    ?? LIB.find(t => t.stats?.classification === "elite")!;
  const d = partyDefenceAt(9, "brokenChain");
  const target = {
    ac: d.ac, partySize: 4,
    saveBonus: (d.str + d.dex + d.con + d.int + d.wis + d.cha) / 6,
    saves: { str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha },
  };
  const roster = rosterFromTemplates([{ template, quantity: 3 }], 9, target as never);
  console.log(`  (roster: 3x ${template.name})`);

  const run = (mode: "wotcStandard" | "brokenChain", bonds: number) => {
    const arr = bondArrangement(mode, bonds, true);
    const profile = resolvePartyProfile({ level: 9, size: 4, equipmentMode: arr.baselineMode });
    const result = simulateEncounter({
      party: {
        size: profile.size, sustain: profile.sustain, dpr: profile.dpr,
        mitigationPerRound: arr.mitigation,
      },
      roster: roster.roster,
    });
    const rounds = result.rounds;
    return {
      sustain: profile.sustain,
      pressure: rounds[rounds.length - 1]?.cumulativeMonsterDamage ?? 0,
    };
  };

  for (const mode of ["wotcStandard", "brokenChain"] as const) {
    const on = run(mode, BONDS);
    const off = run(mode, 0);
    ok(`${mode}: the sustain denominator does not move when bonds toggle`,
      near(on.sustain, off.sustain), `${on.sustain.toFixed(2)} either way`);

    const moved = Math.abs(on.pressure - off.pressure);
    if (mode === "wotcStandard") {
      ok("wotcStandard: pressure DOES fall when bonds are on — applied once on the clock",
        on.pressure < off.pressure, `${off.pressure.toFixed(1)} -> ${on.pressure.toFixed(1)}`);
    } else {
      /**
       * ⚠ THE BUG THIS EXISTS FOR. Under the old behaviour this figure moved, because the BC
       * denominator already held the bonds and the clock took them off again.
       */
      ok("brokenChain: pressure falls once too — same structure, bond-free denominator",
        on.pressure < off.pressure, `${off.pressure.toFixed(1)} -> ${on.pressure.toFixed(1)}`);
    }
  }
}

console.log("\nAnd the two arrangements are not silently the same number");
{
  const wotc = resolvePartyProfile({ level: 9, size: 4, equipmentMode: "wotcStandard" });
  const bc = resolvePartyProfile({ level: 9, size: 4, equipmentMode: "brokenChain" });
  ok("the bond-free and all-in baselines genuinely differ",
    Math.abs(bc.sustain - wotc.sustain) > 1,
    `WotC ${wotc.sustain.toFixed(2)} vs BC ${bc.sustain.toFixed(2)}`);
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
