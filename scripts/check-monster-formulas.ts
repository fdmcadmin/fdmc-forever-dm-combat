/**
 * CREATURE FORMULA VARIABLES, END TO END — authored, resolved, and READ BY THE CHECKER.
 *   npx tsx scripts/check-monster-formulas.ts
 *
 * Christopher: *"i cant check a encounter if i use the @ATK or @STR, also we had discussed
 * changing all the actions on creatures to this method."*
 *
 * The vocabulary is only adoptable if every consumer sees the same number. Three ways it failed:
 *
 *   1. `parseCreature` read the RAW string, so `@ATK` reached the checker literally. A feature
 *      with damage and no readable bonus is priced as AUTOMATIC — the Elemental Mirror billed 42
 *      undodgeable damage a round off a formula nothing had resolved.
 *   2. `parseAttackBonus` read only the LAST flat term, so a resolved `1d20+4+3` parsed as +3.
 *      Multi-term formulas are the normal shape once variables are in use.
 *   3. `monsterProficiency` read only `cr`, so the 25 creatures carrying a recovered
 *      `proficiencyBonus` resolved `@PB` at the +2 floor while their saves used +4.
 */
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { parseCreature, parseAttackBonus } from "../src/core/encounter-band/parseCreature";
import { monsterProficiency, resolveMonsterFormula } from "../src/core/monsters/resolveMonsterFormulaVars";
import { creatureProficiencyBonus } from "../src/core/monsters/creator/monsterCreatorModel";

const problems: string[] = [];

// 1. One proficiency bonus per creature, whichever side asks.
let disagree = 0;
for (const t of L) if (monsterProficiency(t.stats) !== creatureProficiencyBonus(t.stats)) disagree++;
console.log(`proficiency bonus agrees between formulas and saves on ${L.length - disagree}/${L.length} creatures`);
if (disagree) problems.push(`${disagree} creature(s) resolve @PB differently from their saves`);

// 2. Multi-term bonuses sum.
const cases: Array<[string, number | undefined]> = [
  ["1d20 + 7", 7], ["1d20+4+3", 7], ["1d20+@ATK", undefined], ["1d20 - 1", -1],
  ["1d20 + 5 + 1d4", 5], ["1d20+9", 9], ["1d20", undefined],
];
for (const [input, want] of cases) {
  const got = parseAttackBonus(input);
  console.log(`  parseAttackBonus("${input}") = ${got}`);
  if (got !== want) problems.push(`parseAttackBonus("${input}") = ${got}, expected ${want}`);
}

// 3. No creature reaches the checker with an unresolved variable, and none is priced as
//    automatic for want of a bonus its formula actually states.
let literal = 0, autoFromFormula = 0;
for (const t of L) {
  for (const a of [...(t.actions ?? []), ...(t.reactions ?? [])]) {
    const resolved = resolveMonsterFormula(a.roll, t) + " " + resolveMonsterFormula(a.damage, t);
    if (/@[A-Z]+/i.test(resolved)) { literal++; problems.push(`${t.name} · ${a.name}: unresolved token in "${resolved.trim()}"`); }
  }
  const parsed = parseCreature(t);
  for (const f of parsed.features) {
    const authored = [...(t.actions ?? []), ...(t.reactions ?? [])].find(a => a.name === f.name);
    // A feature whose AUTHORED roll carries a variable must come out with a readable bonus.
    if (authored?.roll && /@/.test(authored.roll) && f.attackBonus === undefined) {
      autoFromFormula++;
      problems.push(`${t.name} · ${f.name}: authored "${authored.roll}" but the checker read no attack bonus`);
    }
  }
}
console.log(`\nunresolved tokens reaching the checker: ${literal}`);
console.log(`formula-bearing attacks the checker cannot read: ${autoFromFormula}`);

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — one proficiency bonus per creature, multi-term bonuses sum, no variable reaches the checker unresolved.`);
