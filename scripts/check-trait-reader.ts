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
import { auditCoverage, mechanicsOf } from "../src/core/encounter-band/coverageGate";

let agree = 0, disagree = 0, missed = 0;
const problems: string[] = [];
for (const t of L) {
  const readable = [...(t.traits ?? []), ...(t.reactions ?? []), ...(t.actions ?? [])];
  for (const d of t.stats.defenses ?? []) {
    if (!d.rule) continue;
    const row = readable.find(x => x.name === d.name)
      ?? readable.find(x => x.name && d.name.includes(x.name));
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
    console.log(`  ${t.name} · ${m.traitName} (${m.from})  ->  ${m.label} x${m.rule.multiplier?.toFixed(6) ?? "unpriced"}   [${m.evidence}]`);
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


if (disagree) {
  console.error(`\nFAILED — ${disagree} disagreement(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`\nPASS — no disagreements, and an app-authored attack prices as an attack.`);
