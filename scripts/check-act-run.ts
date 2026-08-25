/**
 * The Act Run's sustain carry — the one rule the run owns.
 *   npx tsx scripts/check-act-run.ts
 *
 * The run prices nothing itself; the checker does that. What the run decides is how spent the party
 * is when it walks into the next fight, and that is `nextArrivalSpent`. A LONG rest is defined by
 * v7 and applied here; a SHORT rest is NOT published anywhere in the bundle, so it is a DM input and
 * this proves the default gives back nothing rather than a plausible-looking constant.
 */
import { nextArrivalSpent, resolveActRun, restBlocks, runLevelGates, normalizeRun, type ActRunStep } from "../src/core/encounter-band/actRun";

const problems: string[] = [];
/** Numbers compare with a tolerance — 0.4 + 0.2 is 0.6000000000000001 in binary floating point,
 *  and a run's carry is a chain of such additions. Exact equality here tests the IEEE spec, not
 *  the rule. */
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = typeof got === "number" && typeof want === "number"
    ? Math.abs(got - want) < 1e-9
    : JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `   got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  if (!ok) problems.push(label);
};

console.log("act run — sustain carry:");
eq("fresh party, no rest, carries the cost", nextArrivalSpent(0, 0.3, "None"), 0.3);
eq("costs accumulate across a block", nextArrivalSpent(0.3, 0.25, "None"), 0.55);
eq("LONG rest resets to zero", nextArrivalSpent(0.8, 0.15, "Long"), 0);
eq("SHORT rest returns NOTHING by default", nextArrivalSpent(0.4, 0.2, "Short"), 0.6);
eq("SHORT rest returns what the DM says", nextArrivalSpent(0.4, 0.2, "Short", 0.25), Math.min(1, 0.6 - 0.25));
eq("a short rest cannot over-recover below zero", nextArrivalSpent(0.1, 0.05, "Short", 0.9), 0);
eq("spent never exceeds a full pool", nextArrivalSpent(0.9, 0.9, "None"), 1);
eq("a negative cost cannot refund the party", nextArrivalSpent(0.5, -0.4, "None"), 0.5);

console.log("\nact run — sequencing:");
const step = (id: string, seq: number, level: number, rest: ActRunStep["restType"], status: ActRunStep["restStatus"], def: ActRunStep["restDefault"], levelAfter = level): ActRunStep =>
  ({ id, sequence: seq, encounterId: "e-" + id, name: "Fight " + seq, partyLevel: level, restType: rest, restStatus: status, restDefault: def, levelAfter });

const steps = [
  step("a", 1, 9, "Short", "Set", "Take"),
  step("b", 2, 9, "None", "—", "Skip"),
  step("c", 3, 9, "Long", "Safe", "Take", 10),
  step("d", 4, 10, "Short", "Threatened", "Take"),
];
const resolved = resolveActRun(steps);
eq("guaranteed short rest is taken", resolved[0].restTaken, "Short");
eq("...and is not flagged risky", resolved[0].assumedRisky, false);
eq("no rest stays none", resolved[1].restTaken, "None");
eq("safe long rest is taken", resolved[2].restTaken, "Long");
eq("THREATENED rest is not silently completed", resolved[3].restTaken, "None");
eq("blocks split on the long rest", restBlocks(resolved).map(b => b.fights), [3, 1]);
eq("level gate is reported", runLevelGates(steps).map(g => `${g.from}->${g.to}`), ["9->10"]);
eq("normalize carries level forward", normalizeRun(steps).map(s => s.partyLevel), [9, 9, 9, 10]);

// The whole point: a run's arrival state depends on where the long rest falls.
const walk = (rests: ActRunStep["restType"][], cost = 0.3) => {
  let spent = 0;
  return rests.map(r => { const at = spent; spent = nextArrivalSpent(spent, cost, r); return Math.round(at * 100); });
};
console.log("\nact run — arrival depends on rest placement:");
eq("no rests: the party gets steadily worse", walk(["None", "None", "None", "None"]), [0, 30, 60, 90]);
eq("a long rest mid-run resets it", walk(["None", "Long", "None", "None"]), [0, 30, 0, 30]);

console.log(problems.length ? `\nFAILED: ${problems.join(", ")}` : "\nALL PASS");
process.exit(problems.length ? 1 : 0);
