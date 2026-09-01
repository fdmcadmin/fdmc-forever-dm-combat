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
import { classifyTrait, classifyTraits, classifyTraitAll } from "../src/core/encounter-band/traitClassifier";
import { pricingModelOf, PRICING_MODEL_LABEL, TRAIT_RULES, traitRule, resolveTraitRule } from "../src/core/encounter-band/compactImport";
import { monsterFormulaVars, monsterProficiency } from "../src/core/monsters/resolveMonsterFormulaVars";
import { auditCoverage, mechanicsOf } from "../src/core/encounter-band/coverageGate";
import { creatureProfile, rosterFromTemplates, type RosterAssumption } from "../src/core/encounter-band/rosterFromLibrary";
import { estimateCreature } from "../src/core/encounter-band/creatureEstimator";
import { effectiveHpPerBody } from "../src/core/encounter-band/checkerV2";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";

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
    /**
     * ⚠ ALL THE RULES THE TRAIT NAMES, NOT JUST THE FIRST. A trait may honestly do two things —
     * the Darkmane is obscurement AND, while solo, Magic Resistance — and reading only the first
     * match made the gate call an accurate authored rule a disagreement, which stopped a publish.
     * The author is right if the rule they named is among the ones the trait actually reads as.
     */
    /**
     * ⚠ NO TRAIT FOUND MEANS NOTHING TO GRADE — it does NOT mean "grade the note instead".
     *
     * The fallback to `d.note` was already caught once, when it read the Darkmane note's phrase
     * "first attack" and flipped the matcher that note existed to justify. Making the lookup
     * case-insensitive fixed that instance and left the fallback in place.
     *
     * It fails again on a RECEIVED effect. The Veilwood Crone carries "Inside Darkmane (obscured)"
     * and "Shadow Shroud (from Darkmare)" — both real, both calibrated, and neither is a trait on
     * her block: they are the Mare's aura and the Mare's action, landing on her. There is no prose
     * of hers to read, so the classifier got the note and disagreed with a row that is correct.
     *
     * A trait this gate cannot find is a MISS, which costs the author nothing. Grading commentary
     * is how a gate ends up arguing with the thing it is meant to protect.
     */
    if (!row) { missed++; console.log(`  miss      ${t.name} · ${d.name}  (authored ${d.rule}; no trait of that name on this block — received effect or campaign-named row)`); continue; }
    const all = classifyTraitAll(row.name, row.text);
    if (all.length === 0) { missed++; console.log(`  miss      ${t.name} · ${d.name}  (authored ${d.rule})`); continue; }
    const hit = all.find(m => m.label === d.rule);
    if (hit) {
      agree++;
      const also = all.filter(m => m !== hit).map(m => m.label);
      console.log(`  agree     ${t.name} · ${d.name}  ->  ${hit.label}`
        + (also.length ? `   (also reads: ${also.join(", ")} — a second row would price it)` : ""));
    } else {
      disagree++;
      problems.push(`${t.name} · ${d.name}: authored "${d.rule}", read ${all.map(m => `"${m.label}" on [${m.evidence}]`).join(" and ")}`);
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

/**
 * ── A CREATURE'S OWN ATTACK BONUS IS EVIDENCE ABOUT ITS PROFICIENCY ─────────────────────────
 *
 * Christopher, 2026-09-01: *"tell me how the Wendigo wight is marked wrong for its dc check."*
 * It was not marked wrong by its author — it was marked wrong by this app.
 *
 * `monsterProficiency` reads `stats.proficiencyBonus`, then falls back to CR, then to a floor of
 * +2. The Wendigo Wight carried NEITHER field while its block prints "Challenge 9 · Proficiency
 * Bonus +4", so every `@DC`, `@DCxxx` and `@ATK` on it resolved two low — and its four authored
 * DCs, every one of them an exact `8 + ability + PB`, all reported as matching no token.
 *
 * ⚠ THE CREATURE CONTRADICTS ITSELF, WHICH IS WHAT MAKES THIS CHECKABLE. A block printing
 * "+8 to hit" on a STR attack with STR +4 is stating a proficiency of +4 in a second place. When
 * that disagrees with the resolved bonus, one of the two is wrong and the app should say so
 * rather than quietly using the smaller number in every formula the creature owns.
 */
{
  let pbGaps = 0;
  for (const t of L) {
    const vars = monsterFormulaVars(t);
    const pb = monsterProficiency(t.stats);
    const main = Number(String(vars.MAIN).replace("+", ""));
    // Only literal rolls: a formula-authored bonus is derived and cannot contradict its source.
    const printed = (t.actions ?? [])
      .map(a => a.roll)
      .filter((r): r is string => Boolean(r) && !/@/.test(r!))
      .map(r => Number((r.match(/1d20\s*\+\s*(\d+)/) ?? [])[1] ?? NaN))
      .filter(n => Number.isFinite(n));
    if (printed.length === 0) continue;
    const best = Math.max(...printed);
    // The best attack is at most main + PB. More than that and the stated proficiency is too low.
    if (best > main + pb) {
      pbGaps++;
      problems.push(`${t.name}: proficiency resolves to +${pb}, but its own "+${best} to hit" with @MAIN ${vars.MAIN} needs +${best - main}. `
        + `Set stats.proficiencyBonus (or cr) — every @DC and @ATK on this creature is currently ${best - main - pb} too low.`);
      disagree++;
    }
  }
  console.log(`\n  proficiency cross-check: ${pbGaps === 0 ? "every creature's attacks agree with its stated proficiency" : `${pbGaps} disagree`}`);
}

/**
 * ── THE ESTIMATOR AND THE CHECKER MUST REPORT THE SAME CREATURE ─────────────────────────────
 *
 * Christopher, 2026-09-01: *"why would the estimator and the checker not agree, this is already a
 * problem for me, if i say this creature has X ehp from the estimator but then the checker says nah
 * it only has X then how would that math work."*
 *
 * They now share `creatureProfile`, so they agree by construction. This proves it, and fails if a
 * future edit gives either one its own arithmetic again — which is exactly how they drifted the
 * first time: the checker grew an AC term, a four-round trace and damage-mix-priced typed
 * responses, and the estimator kept none of them.
 *
 * ⚠ THE LAIR CREATURES ARE ALLOWED TO DIFFER, AND ONLY THEM. A lair's control is applied to its
 * host by `rosterFromTemplates` because a lair exists in an ENCOUNTER, not on a creature standing
 * by itself. Rating the Veil-Torn Dragon alone should not include the terrain it fights in. The
 * exemption is named per creature so it cannot quietly widen.
 */
{
  const LEVEL = 7;
  const d = partyDefenceAt(LEVEL, "wotcStandard");
  const target = {
    ac: d.ac, saveBonus: (d.str + d.dex + d.con + d.int + d.wis + d.cha) / 6,
    saves: { str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha },
    partySize: 4,
  };
  const LAIR_EXEMPT = new Set(["Veil-Torn Dragon", "Thought Harrower"]);
  let same = 0, exempt = 0;
  for (const t of L.filter(x => !x.isTemplate)) {
    const noted: RosterAssumption[] = [];
    const p = creatureProfile(t, LEVEL, target as never, noted);
    const est = estimateCreature({
      rawHp: p.baseHp, ac: Number.isFinite(p.ac) ? (p.ac as number) : 15,
      ehpMultiplier: p.acMultiplier * p.traitMultiplier / p.damageUptime,
      ehpAdjustment: 0, acAdjustment: 0,
      r1Dpr: p.dpr.round1, r2PlusDpr: p.dpr.round4Plus,
      offenseBasis: p.attackBonus > 0 ? "attack" : "saveDc",
      attackBonus: p.attackBonus, saveDc: p.saveDc,
    });
    const built = rosterFromTemplates([{ template: t, quantity: 1 }], LEVEL, target as never);
    const row = built.roster.find(g => g.id === t.templateId);
    if (!row) continue;
    const chk = effectiveHpPerBody(row, 4);
    if (Math.abs(chk - est.effectiveHp) < 0.01) { same++; continue; }
    if (t.lair && LAIR_EXEMPT.has(t.name)) { exempt++; continue; }
    problems.push(`${t.name}: estimator says ${est.effectiveHp.toFixed(2)} EHP, checker prices ${chk.toFixed(2)}. `
      + `They share \`creatureProfile\` — a gap means one of them grew its own arithmetic again.`);
    disagree++;
  }
  console.log(`\n  estimator/checker agreement: ${same} identical, ${exempt} lair-exempt`);
  if (same === 0) {
    problems.push("no creature was compared, so this check proves nothing");
    disagree++;
  }
}

if (disagree) {
  console.error(`\nFAILED — ${disagree} disagreement(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`\nPASS — no disagreements, and an app-authored attack prices as an attack.`);