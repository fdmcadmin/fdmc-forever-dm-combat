/**
 * THE COVERAGE GATE — where a trait multiplier is allowed to come from.
 *   npx tsx scripts/check-trait-coverage.ts
 *
 * `CLEANUP-V4-PLAN.md` retired `validate:parity`, the diff that once caught Frozen Sentinel,
 * Rime Wight and Frost-Weaver carrying three invented multipliers whose product was x1.867
 * against the workbook's x1.436. It named the replacement in the same breath:
 *
 *   *"The coverage gate now constrains WHERE a multiplier may come from (58 calibrated rules,
 *   `unpriced` when the workbook is silent), which is a stronger guarantee than a diff."*
 *
 * ⚠ IT SAID "NOW" AND IT WAS NOT BUILT. The plan described the gate as though it already
 * existed, `validate:parity` was deleted on that basis, and for the time in between there was
 * nothing at all stopping an invented multiplier — which is how nineteen of them accumulated
 * unchallenged. This is that gate.
 *
 * WHY THIS IS STRONGER THAN A DIFF. A diff tells you a number moved since last time; it is blind
 * to a wrong number that has always been wrong, and it goes quiet the moment you accept the
 * baseline. This reads the library and asks each multiplier to say where it came from. A number
 * with no answer fails, whether it arrived today or a year ago.
 *
 * FOUR LEGAL ANSWERS, and one of them is a debt rather than a source:
 *   rule            resolves to one of the 58 calibrated rules AND matches its contribution
 *   workbook-profile the workbook's own per-creature tm column
 *   interpolated    between two published rows, interpolation stated in the note
 *   derived         computed from the block, arithmetic shown in the note
 *   uncalibrated    hand-authored, pre-workbook, KNOWINGLY left — printed on every run
 *
 * Plus 1.0, which needs no provenance but does need a note: a decided non-contribution is an
 * answer, an undecided one is a gap.
 */
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { resolveTraitRule } from "../src/core/encounter-band/compactImport";

const TOLERANCE = 5e-6;
const failures: string[] = [];
const debt: string[] = [];
let calibrated = 0, decided = 0, declared = 0;

for (const template of BROKEN_CHAIN_MONSTER_LIBRARY) {
  for (const d of template.stats.defenses ?? []) {
    const where = `${template.name} · "${d.name}"`;
    const x = d.ehpMultiplier ?? 1;

    // A 1.0 is a decision, but only when someone says why.
    if (x === 1) {
      if (d.note) decided++;
      else failures.push(`${where} is 1.0 with NO NOTE — a decided non-contribution needs its reason, an undecided one is a gap.`);
      continue;
    }

    const rule = resolveTraitRule(d);
    if (rule && rule.contribution !== null) {
      if (Math.abs((1 + rule.contribution) - x) < TOLERANCE) { calibrated++; continue; }
      failures.push(
        `${where} names the rule "${rule.label}" but carries x${x} against its published x${(1 + rule.contribution).toFixed(6)}. `
        + `The rule is the source; the multiplier is derived from it, never the other way round.`);
      continue;
    }

    if (!d.provenance) {
      failures.push(
        `${where} carries x${x} with no calibrated rule and no declared provenance. `
        + `Give it a rule that resolves, or declare where the number came from.`);
      continue;
    }

    declared++;
    if (d.provenance === "uncalibrated") debt.push(`${where}  x${x}`);
    if (d.provenance !== "uncalibrated" && !d.note) {
      failures.push(`${where} declares provenance "${d.provenance}" with no note. That provenance is a claim about the arithmetic — show it.`);
    }
  }
}

console.log(`trait multiplier coverage`);
console.log(`  ${calibrated} from a calibrated rule (exact)`);
console.log(`  ${decided} decided at 1.0 with a stated reason`);
console.log(`  ${declared} with a declared provenance`);

if (debt.length) {
  console.log(`\n  ${debt.length} UNCALIBRATED — hand-authored, pre-workbook, awaiting recalibration.`);
  console.log(`  Not a failure: each is declared. It is a standing debt, and it is printed every run`);
  console.log(`  so that it stays a decision rather than becoming the floor.`);
  for (const line of debt) console.log(`     ${line}`);
}

if (failures.length) {
  console.error(`\nFAILED — ${failures.length} multiplier(s) with nowhere to have come from:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nPASS — every multiplier in the library can say where it came from.`);
