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
import { BROKEN_CHAIN_MONSTER_LIBRARY, BUNDLED_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { AUTHORED_MONSTERS } from "../src/data/broken-chain/authored.generated";
import { resolveTraitRule, traitRule } from "../src/core/encounter-band/compactImport";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

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

/**
 * ── ⚠ AND THE AUTHORED PAYLOAD MAY NOT SILENTLY DROP A PRICED DEFENCE ───────────────────────
 *
 * Christopher, 2026-08-31: *"this checker is wrong on the encounter and the darkmane."*
 *
 * The Darkmare carries two priced defences in the bundled library — the constant obscurement and
 * an interpolated +2 AC row for Shadow Shroud (x1.056615). The authored payload had ONE, and
 * `mergeAuthored` lets authored override bundled wholesale, so the live Mare was priced without
 * Shadow Shroud at all. Nothing said so: the coverage gate above only asks whether the multipliers
 * that ARE there can explain themselves, and a defence that is gone has no multiplier to check.
 *
 * ⚠ THIS IS NOT "AUTHORED IS WRONG". The authored library IS the truth for the Broken Chain, and
 * removing a defence is a decision the author is entitled to make. What it may not be is SILENT —
 * so the removal is cleared exactly the way this file already distinguishes a decided 1.0 from an
 * unassessed creature: record the row at 1.0 with a reason, and the gate passes.
 *
 * A diff would not have caught this either. The value never moved; it stopped existing.
 */
/**
 * ⚠ COMPARED AS A PRODUCT, NOT ROW BY ROW, AND BY templateId, NOT BY NAME.
 *
 * Row matching gave a false positive on the first run: the Demonic Reaver's bundled "Blur"
 * (x1.227798, no calibrated source) became the authored "All attacks at disadvantage - 1 round"
 * (x1.129416). Same effect, correctly re-classified onto a calibrated rule — a rename is not a
 * loss, and a gate that calls it one trains the author to ignore it. Names also move: the id
 * `veil-torn-wyrmling` is labelled "Veilbound Drake Guard" now, which is what authoring is for.
 *
 * What actually matters is whether the creature got CHEAPER, so that is what is measured.
 */
const DROP_TOLERANCE = 1e-4;
const bundledById = new Map(BUNDLED_MONSTER_LIBRARY.map(t => [t.templateId, t]));
const product = (t?: MainMonsterTemplate): number =>
  (t?.stats.defenses ?? []).reduce((p, d) => p * (d.ehpMultiplier || 1), 1);

/**
 * ⚠ A DECLARED DEBT, PRINTED EVERY RUN — the same device this file already uses for
 * `uncalibrated`, and for the same reason: *"so that it stays a decision rather than becoming the
 * floor."*
 *
 * These five creatures lost priced defences through the authoring round trip before the gate
 * existed, and restoring them is an AUTHORING decision that changes Act 3 balance — not mine to
 * take. They are listed so the gate can still fail on anything NEW while these await Christopher's
 * call. Deleting a line from here without restoring the defence is how this debt becomes invisible
 * again.
 */
const KNOWN_DROPS: Record<string, string> = {
  "broken-chain:act3:grief-colossus:v1":
    "Body Between (x1.232313 = Fixed prevention - 12/round) became \"Damage transfer / redirection\" at 1.0, which the workbook leaves UNPRICED. MASTER records that Body Between IS the prevention rule.",
  "broken-chain:act3:nail-saint:v1":
    "Claimed Line (x1.108348) — authored defences are EMPTY, so the creature also reports as unassessed.",
  "broken-chain:act3:shardbound:v1":
    "Shatter the Stake (x1.047749) — authored defences are EMPTY.",
  "broken-chain:act3:veilwood-crone:v1":
    "Control spellcasting (x1.108348) became a decided \"No notable defensive traits\" 1.0, which SUPPRESSES the unassessed flag. This is Gate I's other creature.",
  "broken-chain:act3:veil-torn-wyrmling:v1":
    "Moon-Slick Scales (x1.047749) — authored carries a decided \"No notable defensive traits\" 1.0. ⚠ THE RENAME HID THIS ONE: the id still says veil-torn-wyrmling and the creature is labelled \"Veilbound Drake Guard\", so a by-name comparison could not see it at all.",
  "broken-chain:act3:demonic-reaver:v1":
    "Blur x1.227798 -> x1.129416. A re-classification onto a calibrated rule, so probably CORRECT — listed because it is an 8% fall and should be confirmed, not because it is known wrong.",
};

const dropped: string[] = [];
const known: string[] = [];
for (const authored of AUTHORED_MONSTERS as MainMonsterTemplate[]) {
  const bundled = bundledById.get(authored.templateId);
  if (!bundled) continue;
  const before = product(bundled);
  const after = product(authored);
  if (after >= before - DROP_TOLERANCE) continue;
  const line = `${authored.name} (${authored.templateId}): defence product x${before.toFixed(6)} -> x${after.toFixed(6)}`;
  if (KNOWN_DROPS[authored.templateId]) known.push(`${line}\n       ${KNOWN_DROPS[authored.templateId]}`);
  else dropped.push(line);
}

if (known.length) {
  console.log(`\n  ${known.length} DECLARED DEFENCE DEBT — priced defences lost through the authoring round trip,`);
  console.log(`  awaiting an authoring decision. Printed every run so they stay a decision.`);
  for (const line of known) console.log(`     ${line}`);
}

if (dropped.length) {
  console.error(`\nFAILED — ${dropped.length} creature(s) got cheaper in the authored payload with no record:\n`);
  for (const line of dropped) console.error(`  ${line}`);
  console.error(`\n  The authored library IS the truth, so removing a defence is allowed — but not`);
  console.error(`  SILENTLY. Record it as a 1.0 row with a reason, the way a creature with no`);
  console.error(`  defensive traits is DECIDED rather than unassessed, or restore the defence.`);
  console.error(`  A diff would not catch this: the value did not move, it stopped existing.`);
  process.exit(1);
}

if (failures.length) {
  console.error(`\nFAILED — ${failures.length} multiplier(s) with nowhere to have come from:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nPASS — every multiplier in the library can say where it came from,`);
console.log(`       and the authored payload drops no priced defence without saying so.`);
