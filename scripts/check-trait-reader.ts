/**
 * DOES READING A TRAIT FIND THE SAME RULE A PERSON PICKED?
 *   npx tsx scripts/check-trait-reader.ts
 *
 * The library's own authored `rule` fields are the answer key: 11 defences where someone chose a
 * calibrated rule by hand. This asks the classifier to reach the same answer from the prose.
 *
 * ⚠ THE NUMBER THAT MATTERS IS DISAGREEMENTS, AND IT MUST BE ZERO. A miss costs the author a
 * dropdown, which is where they were already. A DISAGREEMENT prices a creature as something it
 * does not do, and does it while looking confident. This fails on disagreement, never on a miss.
 */
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { classifyTrait, classifyTraits } from "../src/core/encounter-band/traitClassifier";
import { pricingModelOf, PRICING_MODEL_LABEL, TRAIT_RULES, traitRule, resolveTraitRule } from "../src/core/encounter-band/compactImport";
import { auditCoverage, mechanicsOf } from "../src/core/encounter-band/coverageGate";

let agree = 0, disagree = 0, missed = 0;
const problems: string[] = [];
for (const t of L) {
  const readable = [...(t.traits ?? []), ...(t.reactions ?? []), ...(t.actions ?? [])];
  for (const d of t.stats.defenses ?? []) {
    if (!d.rule) continue;
    /**
     * ⚠ CASE-INSENSITIVE, OR THE FALLBACK CLASSIFIES THE NOTE INSTEAD OF THE TRAIT.
     *
     * The Darkmare's defence is "Darkmane (constant obscurement)" and its trait is "Darkmane
     * (Constant)" — one capital letter apart, so `includes` missed it, `row` came back undefined,
     * and the classifier was handed `d.note`. A note that DISCUSSES the pricing then gets read AS
     * the trait: this one says the effect is *not* a "first incoming attack only" effect, and the
     * word "first attack" in that sentence flipped the very matcher the note exists to justify.
     *
     * A gate that reads prose about a trait when it cannot find the trait will eventually grade
     * commentary. Find the trait.
     */
    const key = d.name.toLowerCase();
    const row = readable.find(x => (x.name ?? "").toLowerCase() === key)
      ?? readable.find(x => x.name && key.includes(x.name.toLowerCase()));
    const m = classifyTrait(row?.name ?? d.name, row?.text ?? d.note);
    if (!m) { missed++; console.log(`  miss      ${t.name} · ${d.name}  (authored ${d.rule})`); continue; }
    if (m.label === d.rule) { agree++; console.log(`  agree     ${t.name} · ${d.name}  ->  ${m.label}`); }
    else {
      disagree++;
      problems.push(`${t.name} · ${d.name}: authored "${d.rule}", read "${m.label}" on [${m.evidence}]`);
    }
  }
}
console.log(`\n  agree ${agree} · MISS ${missed} · DISAGREE ${disagree}`);

// What the reader finds that nobody has authored yet — the reason this exists.
console.log(`\nUnpriced creatures whose prose names a calibrated rule:`);
let found = 0;
for (const t of L) {
  const authored = new Set((t.stats.defenses ?? []).map(d => d.rule).filter(Boolean));
  for (const m of classifyTraits(t)) {
    if (authored.has(m.label)) continue;
    const priced = (t.stats.defenses ?? []).some(d => (d.ehpMultiplier ?? 1) !== 1);
    if (priced) continue;
    // A rule with no multiplier is priced by a MODEL, not by nothing — see pricingModelOf.
    const pricedAs = m.rule.multiplier != null ? `x${m.rule.multiplier.toFixed(6)}` : PRICING_MODEL_LABEL[pricingModelOf(m.rule)];
    console.log(`  ${t.name} · ${m.traitName} (${m.from})  ->  ${m.label} ${pricedAs}   [${m.evidence}]`);
    found++;
  }
}
console.log(`  ${found} found.`);

/**
 * ─── AND AN APP-AUTHORED ATTACK MUST REACH THE PACKET PATH ──────────────────────────────────
 *
 * Same failure, one layer over: reading a claim out of PROSE while ignoring the field that holds
 * it. The coverage gate's packet test looked for "+7 to hit" in the text — which a pasted stat
 * block contains and an app-authored action does not, because the bonus is the `roll` FIELD and
 * the text carries only the Hit line.
 *
 * So the Veilbound Drake Guard's Bite and Claw — two ordinary attacks — reported as sentences
 * reaching no workbook resolver, and the estimator refused to call the creature ready.
 * Christopher: *"how can i estimate a creature if 1 of the 3 damage abilities are reading."*
 *
 * The fixture is authored the way the app authors: fields for the numbers, prose for the effect.
 */
const authoredLikeTheApp = {
  actions: [
    { name: "Bite", roll: "1d20 + 7", damage: "2d6 + 4", text: "Hit: 9 (2d6 + 2) piercing damage." },
    { name: "Veil Breath", save: "DEX", damage: "4d6", text: "Each creature in a 20-foot cone takes 14 (4d6) fire." },
  ],
};
const report = auditCoverage(mechanicsOf(authoredLikeTheApp as never));
console.log(`
app-authored attack + save: ${report.packets.length} packet(s), ${report.blocked.length} blocked`);
if (report.packets.length !== 2) {
  problems.push(`an app-authored attack and save produced ${report.packets.length} damage packet(s), expected 2 — the gate is reading prose and ignoring the fields`);
  disagree++;
}
if (report.blocked.length !== 0) {
  problems.push(`an ordinary app-authored attack was reported as unpriceable: ${report.blocked.map(b => b.source.name).join(", ")}`);
  disagree++;
}



/**
 * ─── A NULL MULTIPLIER IS A MODEL, NOT A GAP ────────────────────────────────────────────────
 *
 * ⚠ ONE WORD WAS DOING THE WORK OF FOUR ANSWERS. Eighteen of the fifty-eight calibrated rules
 * carry no multiplier and the app printed all of them as "unpriced" — which reads as "the
 * workbook has nothing to say about this" when it says something specific about each.
 *
 * Christopher, on the v10 workbook: *"null multiplier + formula/profile/tag_only/no_credit ≠
 * UNPRICED [...] the app is still using 'does this have a numeric multiplier?' as its definition
 * of priced, while the workbook's definition is 'does this mechanic have a supported resolution
 * model?' Those are no longer the same thing."*
 */
{
  const noMultiplier = TRAIT_RULES.filter(r => r.multiplier == null);
  const byModel = new Map<string, string[]>();
  for (const r of noMultiplier) {
    const m = pricingModelOf(r);
    byModel.set(m, [...(byModel.get(m) ?? []), r.label]);
  }
  console.log(`\n${noMultiplier.length} of ${TRAIT_RULES.length} rules carry no multiplier:`);
  for (const [model, labels] of [...byModel].sort()) {
    console.log(`  ${PRICING_MODEL_LABEL[model as never].padEnd(18)} ${labels.length}  — ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? ", …" : ""}`);
  }

  const stillUnpriced = byModel.get("unpriced") ?? [];
  if (stillUnpriced.length) {
    problems.push(`${stillUnpriced.length} rule(s) have no multiplier AND no recognised resolution model: ${stillUnpriced.join(", ")}`);
    disagree++;
  }
  // Rejuvenation is the one the workbook prices at a deliberate ZERO, and calling that "unpriced"
  // was the clearest case of the app disagreeing with the sheet it is built on.
  const rejuv = TRAIT_RULES.find(r => /rejuvenation/i.test(r.label));
  if (rejuv && pricingModelOf(rejuv) !== "no_credit") {
    problems.push(`Rejuvenation reads as "${pricingModelOf(rejuv)}" — the workbook prices it at 0 for the current encounter`);
    disagree++;
  }
  const condImm = TRAIT_RULES.find(r => /condition immunity/i.test(r.label));
  if (condImm && pricingModelOf(condImm) !== "conditional") {
    problems.push(`Condition immunity reads as "${pricingModelOf(condImm)}" — it is worth what the party's actual control makes it worth`);
    disagree++;
  }
}


/**
 * ── WHAT THE AUTHOR SEES MUST BE WHAT THE CHECKER COMPUTES ──────────────────────────────────
 *
 * Christopher, 2026-08-31, looking at the Darkmare's Defenses tab: three empty rows, UNPRICED,
 * *"Combined ×1.000 → effective HP 90"* — for a creature the checker prices at ×1.193 and 107.
 *
 * The editor resolved each row's rule with `traitRule(d.name)`, the workbook LABEL only, while
 * the checker uses `resolveTraitRule`, which reads the `rule` field first precisely because a
 * campaign trait carries a campaign name. 51 of the library's 60 defence rows are named for the
 * trait rather than the rule, so 51 rendered blank and 14 creatures showed a combined multiplier
 * that disagreed with the fight — the Wendigo Wight by 106 effective HP.
 *
 * ⚠ THAT IS ALMOST CERTAINLY HOW THE DEFENCES GOT LOST. A panel that shows ×1.000 for a priced
 * creature invites its author to fix something that was never broken.
 *
 * So this asserts the two agree, and asserts the case is REAL — a gate that passed because every
 * row happened to be named after its rule would prove nothing.
 */
{
  let campaignNamed = 0;
  for (const t of L) {
    for (const d of t.stats.defenses ?? []) {
      const byName = traitRule(d.name);
      const resolved = resolveTraitRule(d);
      if (!byName && resolved) campaignNamed++;
      const x = d.ehpMultiplier ?? 1;
      if (x === 1) continue;
      // A priced row must be explicable to the AUTHOR, not only to the checker.
      if (!resolved && !d.provenance) {
        problems.push(`${t.name} · "${d.name}" carries x${x} that the editor cannot explain — no resolvable rule and no provenance`);
        disagree++;
      }
    }
  }
  console.log(`\n  ${campaignNamed} defence row(s) are named for the TRAIT, not the workbook rule —`);
  console.log(`  the exact case a name-only lookup renders as an unpriced blank.`);
  if (campaignNamed === 0) {
    problems.push("no campaign-named defence rows exist, so this check proves nothing — it would pass on a name-only lookup too");
    disagree++;
  }
}

if (disagree) {
  console.error(`\nFAILED — ${disagree} disagreement(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`\nPASS — no disagreements, and an app-authored attack prices as an attack.`);