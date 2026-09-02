/**
 * THE INITIATIVE GATE — the body order decides how much lands, and the old model is its 0.5 case.
 *
 * Run: npm run check:initiative
 *
 * ⚠ THE ASSERTION THAT MATTERS IS THE REGRESSION ONE. `simulateEncounter` used a fixed midpoint,
 * `(start + end) / 2`, standing in for "half the roster acted before the party". That is now
 * `hostileFirst * start + (1 - hostileFirst) * end`, read from the bodies' own DEX against the
 * party's. If that generalisation is right, a roster whose initiative TIES the party must produce
 * the byte-identical fight it produced before — same rounds, same damage, same survivors. If it
 * does not, the change moved numbers it had no business moving, and this gate fails.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import {
  initiativeWinProbability, hostileFractionActingFirst, creatureInitiativeModifier,
  relativeHostileOrder,
} from "../src/core/encounter-band/initiativeOrder";
import { simulateEncounter, type RosterGroup } from "../src/core/encounter-band/checkerV2";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

console.log("Body-level initiative\n");

/* ── The probability itself ──────────────────────────────────────────────────────────────── */
console.log("Two d20s, and the modifier decides the lean");
ok("equal modifiers are a coin flip", near(initiativeWinProbability(0, 0), 0.5));
ok("...at every value, not just zero",
  near(initiativeWinProbability(7, 7), 0.5) && near(initiativeWinProbability(-3, -3), 0.5));
ok("a higher modifier wins more often", initiativeWinProbability(5, 0) > 0.5);
ok("a lower modifier wins less often", initiativeWinProbability(0, 5) < 0.5);
ok("the two are complementary — someone always goes first",
  near(initiativeWinProbability(5, 0) + initiativeWinProbability(0, 5), 1));
ok("it is monotonic in the modifier",
  [-4, -2, 0, 2, 4, 6].every((m, i, a) => i === 0 || initiativeWinProbability(m, 1) > initiativeWinProbability(a[i - 1], 1)));
/**
 * ⚠ THE GATE WAS WRONG HERE FIRST, AND THE FAILURE WAS THE USEFUL PART. It asserted "+20 is not
 * certainty — a d20 can still be beaten by a d20", which is false: the faster body's WORST roll
 * is 1 + 20 = 21 and the party's BEST is 20 + 0 = 20. A d20 spans 19 points, so a 19-point
 * modifier gap is already unbeatable once ties break to the higher modifier — which is the tie
 * rule a table uses, and the one this implements.
 */
ok("a 19-point gap IS certainty — a d20 only spans 19 points",
  near(initiativeWinProbability(19, 0), 1), initiativeWinProbability(19, 0).toFixed(4));
ok("...but 18 is not, because the tie is the only thing carrying it",
  initiativeWinProbability(18, 0) < 1 && initiativeWinProbability(18, 0) > 0.99,
  initiativeWinProbability(18, 0).toFixed(4));
ok("a tied TOTAL breaks to the higher modifier",
  initiativeWinProbability(1, 0) > initiativeWinProbability(0, 0));

/* ── Reading DEX off a creature ──────────────────────────────────────────────────────────── */
console.log("\nThe modifier is READ, never assigned");
ok("DEX 14 reads +2",
  creatureInitiativeModifier({ abilities: [{ label: "DEX", value: "14 (+2)" }] }) === 2);
ok("DEX 7 reads -2",
  creatureInitiativeModifier({ abilities: [{ label: "DEX", value: "7 (-2)" }] }) === -2);
ok("an explicit initiative wins over DEX",
  creatureInitiativeModifier({ initiative: 9, abilities: [{ label: "DEX", value: "10 (+0)" }] }) === 9);
ok("no abilities at all is 0, not a guess", creatureInitiativeModifier(undefined) === 0);

/* ── The weighted fraction ───────────────────────────────────────────────────────────────── */
console.log("\nWeighted by OUTPUT, not by head count");
{
  const tied = [{ quantity: 3, initiativeMod: 2, weight: 10 }];
  ok("a roster tied with the party is exactly the old midpoint",
    near(hostileFractionActingFirst(tied, 2), 0.5));
  ok("an empty roster is the midpoint too — nothing changes for nothing",
    near(hostileFractionActingFirst([], 3), 0.5));
  ok("a weightless roster does not divide by zero",
    near(hostileFractionActingFirst([{ quantity: 4, initiativeMod: 9, weight: 0 }], 0), 0.5));

  // One dragon at +6 doing 100, six goblins at -1 doing 1 each. Head count says the goblins
  // decide the order; damage says the dragon does.
  const mixed = [
    { name: "dragon", quantity: 1, initiativeMod: 6, weight: 100 },
    { name: "goblins", quantity: 6, initiativeMod: -1, weight: 1 },
  ];
  const f = hostileFractionActingFirst(mixed, 1);
  const byHead = (initiativeWinProbability(6, 1) + 6 * initiativeWinProbability(-1, 1)) / 7;
  ok("the dragon's initiative dominates, not the goblins'", f > byHead + 0.1,
    `weighted ${f.toFixed(3)} vs head-count ${byHead.toFixed(3)}`);
  ok("and it sits above the midpoint because the dragon is faster", f > 0.5, f.toFixed(3));
}

/* ── Relative hostile order ──────────────────────────────────────────────────────────────── */
console.log("\nThe scheduler's 'relative hostile order' row");
{
  const order = relativeHostileOrder([
    { name: "slow", quantity: 1, initiativeMod: -1, weight: 5 },
    { name: "fast", quantity: 1, initiativeMod: 7, weight: 5 },
    { name: "mid", quantity: 1, initiativeMod: 3, weight: 5 },
  ]);
  ok("ranks the DM's own creatures against each other",
    order.map(o => o.name).join(",") === "fast,mid,slow", order.map(o => `${o.rank} ${o.name}`).join(" · "));
}

/* ── ⚠ THE REGRESSION: THE OLD MODEL IS THE TIED CASE ────────────────────────────────────── */
console.log("\nA tied roster reproduces the pre-initiative fight EXACTLY");
{
  const party = { size: 4, sustain: 300, dpr: { round1: 60, round2: 55, round3: 50, round4Plus: 45 } };
  const group = (initiativeMod: number): RosterGroup[] => ([{
    name: "body", quantity: 3, baseHp: 60, initiativeMod,
    dpr: { round1: 20, round2: 18, round3: 16, round4Plus: 15 },
  }]);

  // The party's own modifier, and a roster that matches it exactly.
  const tiedRun = simulateEncounter({ party: { ...party, initiative: 2 }, roster: group(2) });
  // The same fight with initiative never mentioned on either side.
  const silentRun = simulateEncounter({ party, roster: [{
    name: "body", quantity: 3, baseHp: 60,
    dpr: { round1: 20, round2: 18, round3: 16, round4Plus: 15 },
  }] });

  const shape = (r: ReturnType<typeof simulateEncounter>) => JSON.stringify({
    completion: r.completionRound, fatal: r.fatalRound,
    rounds: r.rounds.map(x => [x.round, +x.monsterDamage.toFixed(9), +x.cumulativeMonsterDamage.toFixed(9), x.standing]),
  });
  ok("a tied roster and an unstated one are the same fight", shape(tiedRun) === shape(silentRun));

  // Now make them faster and slower, and prove the fight actually MOVES.
  const fast = simulateEncounter({ party: { ...party, initiative: 0 }, roster: group(8) });
  const slow = simulateEncounter({ party: { ...party, initiative: 8 }, roster: group(0) });
  const took = (r: ReturnType<typeof simulateEncounter>) =>
    r.rounds.reduce((s, x) => s + x.monsterDamage, 0);
  ok("a faster roster lands MORE before the party can remove it",
    took(fast) > took(silentRun), `${took(fast).toFixed(1)} vs ${took(silentRun).toFixed(1)}`);
  ok("a slower roster lands LESS",
    took(slow) < took(silentRun), `${took(slow).toFixed(1)} vs ${took(silentRun).toFixed(1)}`);
  ok("and the tied case sits between them",
    took(slow) < took(silentRun) && took(silentRun) < took(fast));
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
