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
 * ⚠ THE RULE THESE TESTS ENFORCE — BROKEN BY THE ENGINE UNTIL 0.7.10.52, NOW FIXED
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * v7 runtime → `campaign_semantics.whole_body_attrition`:
 *
 *     "A living creature retains its full legal output until its body reaches 0 HP.
 *      Do not linearly reduce a singleton's DPR as its HP is chipped."
 *
 * `checkerV2.encounterDprAt` used to do precisely what that forbids: it multiplied each group's
 * DPR by `remainingGroupFraction`, a continuous 0–1 ratio of damage taken, so a creature at 60%
 * HP dealt 60% damage. The comment above it read "⚠ CONTINUOUS DEPLETION … replaces the old
 * attritionFactor outright" — a deliberate app decision taken against an explicit workbook rule.
 * Under RULE ZERO-B the workbook wins, and `livingBodies` now counts whole bodies.
 *
 * The consequence is not small and it is not symmetrical:
 *   · A SINGLETON is under-counted from round ONE. Two 100-EHP bodies deal 36 in round 1 where
 *     the rule says 40 — nothing has died, so nothing should be reduced.
 *   · The error compounds every round, so a boss fight reads easier the longer it runs.
 *   · Both Fight 10 creatures are singletons, which is why F10 is the fight where it showed.
 *
 * A SECOND violation sat beside it. v7 `campaign_semantics.final_round` forbids "an extra
 * completion-round damage discount on top of midpoint/whole-body attrition", and the simulator
 * multiplied the midpoint by `completionRoundMonsterFraction` (0.5) in the deciding round.
 *
 * A GROUP of N bodies is a different case: bodies die one at a time, so output falls in STEPS of
 * one body's DPR, not smoothly. Test 8.4 pins that.
 */

import { simulateEncounter } from "../src/core/encounter-band/checkerV2";
import type { RosterGroup } from "../src/core/encounter-band/checkerV2";
import { diagnoseEncounter } from "../src/core/encounter-band/encounterDiagnostics";

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
  /**
   * Four bodies of 25 EHP / 10 DPR; the party deals 40 a round. Round 2, step by step:
   *
   *   start  cumulative 40 → floor(40/25) = 1 dead → 3 alive → 30
   *   end    cumulative 80 → floor(80/25) = 3 dead → 1 alive → 10
   *   midpoint (30 + 10) / 2 = 20
   *
   * ⚠ 20 IS THE WHOLE-BODY ANSWER; the old continuous model gave 16 (24 → 8). That gap is the
   * fix. A third arithmetic slip of mine lived here: I first expected 30, which is the START of
   * round figure — it contradicts the midpoint model v7 `final_round` endorses and that 8.1 and
   * 8.2 already rely on. Deriving both ends and halving is the rule; reading one end is not.
   */
  const r = run([body("mob", 10, 25, 4)]);
  report("monster damage by round", r.rounds.map(x => Number(x.monsterDamage.toFixed(2))));
  check("R2 is the midpoint of whole-body output, 30 → 10", Number((r.rounds[1]?.monsterDamage ?? 0).toFixed(2)), 20);
  // The step is what matters: bodies leave one at a time, so R1 loses exactly one of four.
  check("R1 midpoint reflects losing exactly ONE body (40 → 30)", Number((r.rounds[0]?.monsterDamage ?? 0).toFixed(2)), 35);
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

console.log("\n── §3 Damage allocation: what it governs, and what it must not");
{
  // Audit §3 asks what Focus Fire and Spread Evenly actually do. The answer, from the engine:
  // they govern ONLY the projection of monster damage across PCs. Party damage against monsters
  // is always sequential in kill order, whichever is selected.
  const roster = [body("a", 20, 100), body("b", 20, 100)];
  const focus = run(roster, "focus_fire");
  const spread = run(roster, "spread_evenly");
  check("completion round is identical under both", focus.completionRound, spread.completionRound);
  check("party damage per round is identical under both",
    JSON.stringify(focus.rounds.map(r => r.partyDamage)), JSON.stringify(spread.rounds.map(r => r.partyDamage)));
  // ⚠ And they MUST differ where v7 says they differ — downs are the aggregate projection.
  const hardParty = { size: 4, sustain: 100, dpr: { round1: 10, round2: 10, round3: 10, round4Plus: 10 } };
  const hard = (alloc: "focus_fire" | "spread_evenly") =>
    simulateEncounter({ party: hardParty, roster: [body("big", 30, 400)], settings: { damageAllocation: alloc } });
  const hf = hard("focus_fire"), hs = hard("spread_evenly");
  report("focus-fire downs by round", hf.rounds.map(r => r.downs));
  report("spread-evenly downs by round", hs.rounds.map(r => r.downs));
  check("focus fire drops PCs one at a time, spread drops none until all fall",
    hf.rounds.some(r => r.downs > 0 && r.downs < 4) && hs.rounds.every(r => r.downs === 0 || r.downs === 4), true);
}

console.log("\n── §6 Party Clock is downstream: monster damage must not read party sustain");
{
  // Same roster, same party size, WILDLY different sustain. If monster output changed with
  // sustain, the clock would be feeding the engine instead of reading it.
  const mk = (sustain: number) => simulateEncounter({
    party: { size: 4, sustain, dpr: { round1: 40, round2: 40, round3: 40, round4Plus: 40 } },
    roster: [body("x", 20, 200)], settings: { damageAllocation: "focus_fire" },
  });
  const lean = mk(120), fat = mk(4000);
  check("monster damage is identical regardless of party sustain",
    JSON.stringify(lean.rounds.slice(0, 3).map(r => Number(r.monsterDamage.toFixed(4)))),
    JSON.stringify(fat.rounds.slice(0, 3).map(r => Number(r.monsterDamage.toFixed(4)))));
  check("…and so is the encounter EHP the party must chew through", lean.encounterEhp, fat.encounterEhp);
}

console.log("\n── §4 Monster offense is built from individual creatures, not an encounter total");
{
  // Audit §4: "For each round, build monster offense from the legal actions of the individual
  // creatures that can act that round. Do not begin with an expected encounter damage result."
  // Two groups with different DPR: the encounter total must be the SUM of what each body does,
  // and each body's share must be independently identifiable — not a top-down split.
  const roster = [body("fast", 30, 60, 2), body("slow", 10, 200)];
  const r = run(roster);
  const d = diagnoseEncounter(r, roster, 4, 400);
  const r1 = d.rounds[0];
  const fast = r1.bodies.find(b => b.creature.includes("fast"))!;
  const slow = r1.bodies.find(b => b.creature.includes("slow"))!;
  // R1 start: 2 fast (60) + 1 slow (10) = 70. End: party deals 40 → kills nothing (60 EHP each,
  // 40 < 60), so still 70. Midpoint 70.
  check("round 1 total is the sum of the individual bodies", Number(r1.monsterDamage.toFixed(2)), 70);
  check("the fast pair's own share is identifiable", Number(fast.contribution.toFixed(2)), 60);
  check("the slow body's own share is identifiable", Number(slow.contribution.toFixed(2)), 10);
  check("shares sum to the total with nothing left over",
    Number((fast.contribution + slow.contribution).toFixed(6)), Number(r1.monsterDamage.toFixed(6)));
}

console.log("\n── §7 Diagnostic trace reconciles with the engine it describes");
{
  const roster = [body("front", 15, 120, 2), body("back", 25, 90)];
  const r = run(roster);
  const d = diagnoseEncounter(r, roster, 4, 400);
  // ⚠ The point of the check: the trace must be a VIEW of the engine, never a second engine.
  check("per-body contributions sum to the engine's own monster damage, every round", d.reconciles, true);
  check("worst discrepancy is zero", d.worstDiscrepancy < 1e-6, true);
  const r1 = d.rounds[0];
  check("round 1 has every body alive", r1.bodies.every(b => b.aliveAtStart === b.quantity), true);
  report("bodies alive at end of each round",
    d.rounds.map(x => x.bodies.map(b => b.aliveAtEnd).join("/")));
}

console.log("\n── §9 MER reads the fight's own damage, not its opening round");
{
  /**
   * Christopher, 2026-09-23: Act 3 fights headlined FALLS FIRST above a round table showing the party
   * surviving. MER was sustain / the roster's ROUND-ONE damage held flat for the whole fight, while PCER
   * walks the party's own ladder and the simulation beside it kills bodies.
   */
  const party = { size: 4, sustain: 400, dpr: { round1: 30, round2: 30, round3: 30, round4Plus: 30 } };
  const decaying: any = simulateEncounter({ party, roster: [body("a", 25, 25), body("b", 25, 25), body("c", 25, 25), body("d", 25, 25)] });
  const flat = party.sustain / decaying.startingEncounterDpr;
  check("a fight that never empties the pool reads at the fight's own rate", decaying.merBasis, "rate");
  check("...which is longer than the opening-round reading", decaying.mer > flat, true);
  check("...so the margin agrees with the round table beside it", decaying.safetyMargin > 0, true);
  report("decaying roster MER vs the old flat reading", `${decaying.mer.toFixed(2)} vs ${flat.toFixed(2)}`);
  // Nothing dies, so the roster's damage never decays and the fight's own rate IS its opening round.
  const constant: any = simulateEncounter({ party: { ...party, dpr: { round1: 1, round2: 1, round3: 1, round4Plus: 1 } }, roster: [body("solo", 100, 1000)] });
  check("with nothing dying, MER is the opening-round reading exactly", constant.mer, 4);
  check("...read off the round the pool empties", constant.merBasis, "fall");
  check("...and that round is the simulation's own fatal round", constant.fatalRound, Math.ceil(constant.mer));
  check("...with a negative margin, because the party does fall first", constant.safetyMargin < 0, true);
}

console.log(`\n${failures.length === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.log(`  - ${f}`)); process.exit(1); }
