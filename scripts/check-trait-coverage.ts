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
import { resolveTraitRule, traitRule } from "../src/core/encounter-band/compactImport";
import { classifyTraits } from "../src/core/encounter-band/traitClassifier";

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
 * ⚠ REWRITTEN: THE BUNDLED PRODUCT WAS THE WRONG QUESTION.
 *
 * Comparing authored against bundled asks "did this get cheaper than a copy we happen to ship",
 * and Christopher's four answers showed how weak that is. It flagged the Veilbound Drake Guard,
 * which has NO defensive traits at all, so its 1.0 is simply true. It flagged the Demonic Reaver,
 * whose "Blur" was correctly re-classified onto a calibrated rule. And it would have gone quiet
 * forever the moment the bundled copy was updated to match.
 *
 * The real question does not mention the bundled library: **does this creature have a defensive
 * trait that the workbook PRICES, which its defences do not record?** That is answerable from the
 * creature alone, it stays true as the library changes, and it is what actually went wrong — the
 * Grief Colossus still has Body Between, the Shardbound still has Shatter the Stake, and both
 * priced at nothing.
 *
 * ⚠ A DECIDED 1.0 WITH A REASON STILL WINS. The Veilwood Crone records *"the durability in that
 * fight belongs to the mare — the Crone is the damage and the control, and she is meant to be
 * reached."* That is an authoring decision with its rationale on the record, and a gate that
 * overrules it would be arguing with the author. Recording the stack group at 1.0 is how you say
 * "counted, and worth nothing here".
 */

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
const OPEN_AUDIT = new Set<string>([
  // EMPTY. The Frozen Cloak's Cold-Woven was the last entry; it is now entered as
  // `damageResponses` on the creature, which is where a typed response belongs, so the
  // resistance-family skip below covers it and no debt row is needed.
]);


const dropped: string[] = [];
const known: string[] = [];
for (const t of BROKEN_CHAIN_MONSTER_LIBRARY) {
  /**
   * ⚠ A DEFENCE RECORDED UNDER THE TRAIT'S OWN NAME COUNTS.
   *
   * Matching only on rule and stack group reported four creatures that were fine: the Mirage
   * Stalker records "Phantom Step", the Hollow Warden records "Bark-Ribbed", and both ARE the
   * trait, priced, just without a `rule` field. MASTER's own line for that field says a campaign
   * trait carries a campaign NAME — "Body Between" IS Fixed prevention - 12/round — so a gate that
   * insists on the workbook's label is making exactly the mistake `resolveTraitRule` exists to fix.
   *
   * A row whose name CONTAINS the trait name counts too: the Frozen Cloak files one row as
   * "Unfixed Shape + Fold Into the Cold", two traits assessed together.
   */
  const rows = t.stats.defenses ?? [];
  const recorded = new Set(rows.map(d => traitRule(d.rule ?? d.name)?.stack_group ?? d.name));
  const namesRecorded = rows.map(d => d.name.toLowerCase());
  const recordsTrait = (traitName: string): boolean => {
    const n = traitName.toLowerCase();
    return namesRecorded.some(r => r === n || r.includes(n));
  };
  /**
   * ⚠ A TYPED RESPONSE IS ALREADY PRICED, AND A DEFENCE ROW BESIDE IT DOUBLE-COUNTS.
   *
   * `traitFactorsFor` states this outright: a resistance recorded in `damageResponses` prices
   * itself against the party's real damage mix, and *"a hand-added 'Resistance - ~50% of opposing
   * damage' beside `resistant to Fire` prices the same resistance twice."* So a resistance-family
   * match on a creature that HAS typed responses is this gate misreading a correctly-priced
   * creature — it was reporting the Wendigo Wight's Bone Armor and two Frozen Cloak traits that
   * way on its first run.
   */
  const typed = (t.stats.damageResponses ?? []).some(r => (r.type ?? "").trim() !== "");
  const RESISTANCE_FAMILIES = new Set(["damage_resistance", "damage_vulnerability", "dynamic_resistance"]);

  for (const row of classifyTraits(t)) {
    const price = row.rule?.multiplier;
    if (price == null || price === 1) continue;         // unpriced rules have nothing to lose
    const group = row.rule.stack_group ?? row.label;
    if (typed && RESISTANCE_FAMILIES.has(group)) continue;
    if (recorded.has(group) || recorded.has(row.label) || recordsTrait(row.traitName)) continue;
    const line = `${t.name}: trait "${row.traitName}" prices as "${row.label}" (x${price.toFixed(6)}) — not recorded in its defences`;
    if (OPEN_AUDIT.has(`${t.name} :: ${row.traitName}`)) known.push(line);
    else dropped.push(line);
  }
}

if (known.length) {
  console.log(`\n  ${known.length} OPEN DEFENCE AUDIT — a trait the workbook prices, with nothing recorded for it.`);
  console.log(`  Each needs its own look before a number moves. Printed every run so it stays a decision`);
  console.log(`  rather than becoming the floor; anything NEW fails instead of quietly joining the list.`);
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
