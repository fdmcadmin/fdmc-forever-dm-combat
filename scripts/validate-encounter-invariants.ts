/**
 * ENCOUNTER INVARIANTS — section 8 of the v7 Checker Implementation Audit.
 *
 * Run: npm run validate:invariants
 *
 * ⚠ THESE ARE SYNTHETIC ON PURPOSE. The audit is explicit: *"Create small synthetic tests rather
 * than using campaign encounters as expected-answer tests… These tests should have mathematically
 * derivable answers from the v7 rules and should pass before campaign encounters are examined."*
 * Nothing here is tuned to make an Act 3 fight land on a number.
 *
 * A FAILING TEST HERE IS THE POINT. This file is written to state what v7 requires, not to agree
 * with what the app currently does — so a red line is a finding, and the engine moves to meet it
 * rather than the test being softened to meet the engine.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ⚠ THE RULE THESE TESTS ENFORCE, AND THE ONE THE ENGINE CURRENTLY BREAKS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * v7 runtime → `campaign_semantics.whole_body_attrition`:
 *
 *     "A living creature retains its full legal output until its body reaches 0 HP.
 *      Do not linearly reduce a singleton's DPR as its HP is chipped."
 *
 * `checkerV2.encounterDprAt` does precisely what that forbids. It multiplies each group's DPR by
 * `remainingGroupFraction` — a continuous 0–1 ratio of damage taken — so a creature at 60% HP
 * deals 60% damage. The code comment above it calls this "⚠ CONTINUOUS DEPLETION … replaces the
 * old attritionFactor outright", which means it was a deliberate app decision taken against an
 * explicit workbook rule. Under RULE ZERO-B the workbook wins.
 *
 * The consequence is not small and it is not symmetrical:
 *   · A SINGLETON is under-counted from round ONE. Two 100-EHP bodies deal 36 in round 1 where
 *     the rule says 40 — nothing has died, so nothing should be reduced.
 *   · The error compounds every round, so a boss fight reads easier the longer it runs.
 *   · Both Fight 10 creatures are singletons, which is why F10 is the fight where it shows.
 *
 * A GROUP of N bodies is a different case: bodies die one at a time, so output falls in STEPS of
 * one body's DPR, not smoothly. Test 8.4 pins that.
 */

import { simulateEncounter } from "../src/core/encounter-band/checkerV2";
import type { RosterGroup } from "../src/core/encounter-band/checkerV2";

let passed = 0;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  const a = typeof actual === "number" ? Number(actual.toFixed(4)) : actual;
  const e = typeof expected === "number" ? Number(expected.toFixed(4)) : expected;
  if (JSON.stringify(a) === JSON.stringify(e)) { passed++; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}\n         expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`); }
}
function report(label: string, value: unknown) { console.log(`  ..   ${label}: ${JSON.stringify(value)}`); }

/** A body with a flat DPR and a flat EHP — every number below is hand-checkable. */
function body(id: string, dpr: number, ehp: number, quantity = 1): RosterGroup {
  return {
    id, creature: id, quantity,
    baseHp: ehp, dprUptime: 1,
    dpr: { round1: dpr, round2: dpr, round3: dpr, round4Plus: dpr },
  } as unknown as RosterGroup;
}

const party = { size: 4, sustain: 400, dpr: { round1: 40, round2: 40, round3: 40, round4Plus: 40 } };
const run = (roster: RosterGroup[], allocation: "focus_fire" | "spread_evenly" = "focus_fire") =>
  simulateEncounter({ party, roster, settings: { damageAllocation: allocation } });

console.log("\n── 8.1 Single body: partial damage must not alter unrelated behaviour");
{
  // One body, 200 EHP, 20 DPR. Party deals 40/round, so it dies during round 5.
  const r = run([body("solo", 20, 200)]);
  check("completes on the round cumulative party damage reaches EHP", r.completionRound, 5);
  report("round-by-round monster damage", r.rounds.map(x => Number(x.monsterDamage.toFixed(2))));
}

console.log("\n── 8.2 Two bodies: killing one must remove THAT body's future actions only");
{
  /**
   * Two bodies of 100 EHP, 20 DPR each; the party deals 40 a round.
   *
   *   end of R1  cumulative 40  → body A at 60/100. NOBODY IS DEAD.
   *   start R2   both alive     → offence must be 20 + 20 = 40
   *   end of R3  cumulative 120 → body A dies, 20 spills onto B
   *
   * So the FIRST round with reduced offence is R4. A body is binary: it fights at full output
   * until it drops. An earlier version of this test expected 20 at R2, which was my arithmetic
   * error, not an engine finding — the derivation above is the authority.
   */
  const r = run([body("a", 20, 100), body("b", 20, 100)]);
  report("monster damage by round", r.rounds.map(x => Number(x.monsterDamage.toFixed(2))));
  check("R2 offence is BOTH bodies — neither has died yet", Number((r.rounds[1]?.monsterDamage ?? 0).toFixed(2)), 40);
  check("R1 offence is both bodies at full output", Number((r.rounds[0]?.monsterDamage ?? 0).toFixed(2)), 40);
}

console.log("\n── 8.3 Kill ORDER must change the trace (high-offense first vs low-offense first)");
{
  // Same total EHP and DPR, but the offence is lopsided: killing the 30-DPR body first should
  // cut incoming damage far faster than killing the 10-DPR body first.
  const glass = body("glass-cannon", 30, 100);
  const tank = body("low-threat", 10, 100);
  const killCannonFirst = run([glass, tank]);
  const killTankFirst = run([tank, glass]);
  const a = killCannonFirst.rounds.reduce((s, x) => s + x.monsterDamage, 0);
  const b = killTankFirst.rounds.reduce((s, x) => s + x.monsterDamage, 0);
  report("total incoming, cannon killed first", Number(a.toFixed(2)));
  report("total incoming, low-threat killed first", Number(b.toFixed(2)));
  check("the two orders produce DIFFERENT totals", a !== b, true);
  check("killing the high-offense body first takes LESS damage", a < b, true);
}

console.log("\n── 8.4 A dead body contributes nothing (no fractional ghost)");
{
  // Four bodies of 25 EHP / 10 DPR. Party 40/round removes 1.6 bodies of EHP in round 1 —
  // but a body is a BODY: 1 dead and 1 damaged still means 3 alive, so round 2 offence is 30.
  const r = run([body("mob", 10, 25, 4)]);
  report("monster damage by round", r.rounds.map(x => Number(x.monsterDamage.toFixed(2))));
  check("round 2 offence reflects whole bodies, not a fraction", Number((r.rounds[1]?.monsterDamage ?? 0).toFixed(2)), 30);
}

console.log("\n── 8.5 Damage allocation is a party-side projection, not a monster-side one");
{
  const focus = run([body("x", 20, 200)], "focus_fire");
  const spread = run([body("x", 20, 200)], "spread_evenly");
  const fd = focus.rounds.map(x => Number(x.monsterDamage.toFixed(3)));
  const sd = spread.rounds.map(x => Number(x.monsterDamage.toFixed(3)));
  // v7 `aggregate_audit_rule`: allocation governs DOWNS, which are aggregate projections. It must
  // not change how much damage the monsters deal.
  check("allocation does not change monster output", JSON.stringify(fd), JSON.stringify(sd));
  report("focus-fire downs at completion", focus.downsAtCompletion);
  report("spread-evenly downs at completion", spread.downsAtCompletion);
}

console.log(`\n${failures.length === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.log(`  - ${f}`)); process.exit(1); }
