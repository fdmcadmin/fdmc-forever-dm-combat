/**
 * A SUMMONED BODY ARRIVES, ACTS FOR ITS DURATION, AND LEAVES.
 *   npx tsx scripts/check-timed-bodies.ts
 *
 * The workbook's `child_entities` family — five primitives, one shared anti-double-count rule:
 *
 *   "Add each created body as a timed roster entry with its own HP, initiative/action schedule,
 *    duration."
 *
 * ⚠ `encounterEhp` WAS A CONSTANT, SUMMED BEFORE ROUND 1, so a body arriving on round 3 had
 * nowhere to arrive. It either counted from the start — the party chipping at something not yet
 * on the field — or not at all. Both are wrong, and the second is the one that silently
 * underprices a fight with reinforcements.
 *
 * Four things have to hold, and each fails in its own direction:
 *   · a body deals NO damage before it arrives          (or the fight has output it never had)
 *   · its HP is not in the pool before it arrives       (or the party "clears" a body it never met)
 *   · a duration ends its damage                        (`temporary_body_duration`)
 *   · a `split_body` adds NO HP                         (`split_body`: "never duplicate parent HP")
 */
import { prepareRoster, encounterEhpAt, encounterDprAt, groupPresentIn, simulateEncounter, type RosterGroup } from "../src/core/encounter-band/checkerV2";

const problems: string[] = [];
const eq = (what: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}${ok ? "" : `   got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) problems.push(what);
};

const flat = (n: number) => ({ round1: n, round2: n, round3: n, round4Plus: n });

// A boss that is there from the start, and a summon it calls on round 2 (so the body acts on 3).
const boss: RosterGroup = { id: "boss", name: "Summoner", quantity: 1, baseHp: 100, dpr: flat(10) };
const summoned: RosterGroup = {
  id: "called", name: "Called Body", quantity: 2, baseHp: 20, dpr: flat(5),
  arrivesRound: 3,
};
const prepared = prepareRoster([boss, summoned], 4);

console.log("A boss (100 HP, 10 dpr) and 2 bodies (20 HP, 5 dpr each) arriving on round 3\n");
for (const round of [1, 2, 3, 4]) {
  console.log(`  round ${round}: ehp on field ${encounterEhpAt(prepared, round)} · dpr ${encounterDprAt(prepared, 0, round)}`);
}

// ── 1. NO DAMAGE BEFORE IT ARRIVES ──────────────────────────────────────────────────────────
eq("round 1 dpr is the boss alone", encounterDprAt(prepared, 0, 1), 10);
eq("round 2 dpr is still the boss alone", encounterDprAt(prepared, 0, 2), 10);
eq("round 3 dpr adds both bodies", encounterDprAt(prepared, 0, 3), 20);

// ── 2. NO HP IN THE POOL BEFORE IT ARRIVES ──────────────────────────────────────────────────
const bossEhp = encounterEhpAt(prepared, 1);
eq("round 1 pool is the boss alone", encounterEhpAt(prepared, 2), bossEhp);
eq("round 3 pool includes the arrived bodies", encounterEhpAt(prepared, 3) > bossEhp, true);

// ── 3. A DURATION ENDS ITS DAMAGE ───────────────────────────────────────────────────────────
{
  const temporary: RosterGroup = {
    id: "bond", name: "Bond-Creature", quantity: 1, baseHp: 16, dpr: flat(6),
    arrivesRound: 2, expiresAfterRound: 3,      // the Covenant "lasts 2 turns"
  };
  const p = prepareRoster([boss, temporary], 4);
  const dpr = [1, 2, 3, 4].map(r => encounterDprAt(p, 0, r));
  console.log(`\n  a 2-turn body called on round 1: dpr by round ${dpr.join(" · ")}`);
  eq("it is absent on round 1", dpr[0], 10);
  eq("it acts on rounds 2 and 3", [dpr[1], dpr[2]], [16, 16]);
  eq("it is gone on round 4", dpr[3], 10);
  eq("present() agrees with the window", [1, 2, 3, 4].map(r => groupPresentIn(temporary, r)), [false, true, true, false]);
  /**
   * ⚠ ITS HP STAYS COUNTED ONCE IT HAS ARRIVED. The party spent damage on it while it was there;
   * removing its pool retroactively would hand that damage back and let a fight "complete" on
   * arithmetic that never happened.
   */
  eq("its HP stays in the pool after it leaves", encounterEhpAt(p, 4), encounterEhpAt(p, 3));
}

// ── 4. A SPLIT BODY ADDS NO HP ──────────────────────────────────────────────────────────────
{
  const split: RosterGroup = {
    id: "halves", name: "Split Halves", quantity: 2, baseHp: 50, dpr: flat(5),
    arrivesRound: 2, replacesParent: true,
  };
  const p = prepareRoster([boss, split], 4);
  console.log(`\n  a split body: pool round 1 ${encounterEhpAt(p, 1)} · round 2 ${encounterEhpAt(p, 2)}`);
  eq("a split body adds nothing to the pool — it inherits the parent's", encounterEhpAt(p, 2), encounterEhpAt(p, 1));
  eq("but it still deals its damage once it is there", encounterDprAt(p, 0, 2) > encounterDprAt(p, 0, 1), true);
}

// ── 5. NOTHING MOVES FOR A FIGHT WITH NO TIMED BODIES ───────────────────────────────────────
{
  const plain = [
    { id: "a", name: "A", quantity: 2, baseHp: 40, dpr: flat(8) },
    { id: "b", name: "B", quantity: 1, baseHp: 60, dpr: flat(12) },
  ] as RosterGroup[];
  const p = prepareRoster(plain, 4);
  const total = p.reduce((s, g) => s + g.groupEhp, 0);
  console.log(`\n  an ordinary fight: pool is ${total} in every round`);
  eq("every round sees the whole pool", [1, 2, 3, 4].map(r => encounterEhpAt(p, r)), [total, total, total, total]);
  const sim = simulateEncounter({ party: { size: 4, sustain: 200, dpr: flat(40) }, roster: plain });
  eq("and it still completes", sim.completionRound !== null, true);
}

if (problems.length) { console.error(`\nFAILED — ${problems.length}:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — a body arrives, acts for its duration, and leaves; a split adds no HP; ordinary fights are untouched.`);
