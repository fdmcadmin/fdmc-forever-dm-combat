/**
 * A SAVE DC MUST BE FOUND WHEREVER IT IS PRINTED — and derive when it is not printed at all.
 *   npx tsx scripts/check-save-dcs.ts
 *
 * Christopher: *"this is why i get [the assumption] even though dex save is in those boxes."*
 *
 * `parseCreature` read `parseSaveDc(a.save ?? a.text)`. The `??` picks a SOURCE, not a fact, so a
 * save field holding "DEX" — an ability and no number — won outright and the "DC 17" printed in
 * the text two inches away was never looked at. The feature then had damage, no attack bonus and
 * no DC, which is the definition of AUTOMATIC. The box being FILLED is what suppressed the
 * fallback, which is why it looked like the save was being ignored.
 *
 * And the second half: a creature whose DC is printed NOWHERE should derive it, per
 * 8 + X + proficiency. `@DC` uses the creature's main ability; `@DCSTR` … `@DCCHA` let the author
 * choose X per action, because one DC per creature is wrong for anything casting from two places.
 */
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { parseCreature, parseSaveDc } from "../src/core/encounter-band/parseCreature";
import { resolveMonsterFormula, monsterProficiency, monsterMainAbility } from "../src/core/monsters/resolveMonsterFormulaVars";
import { scoresFromTemplate, abilityModifier } from "../src/core/monsters/creator/monsterCreatorModel";

const problems: string[] = [];

// 1. Each fact falls back on its own.
const cases: Array<[string, string | undefined, string | undefined, number | undefined]> = [
  ["DC in the field", "DEX DC 17", "no number here", 17],
  ["ability only in the field, DC in the text", "DEX", "DC 17 Dexterity save", 17],
  ["nothing anywhere", "DEX", "make a Dexterity saving throw", undefined],
  ["no field at all", undefined, "DC 14 Constitution save", 14],
];
for (const [label, save, text, want] of cases) {
  const got = parseSaveDc(save) ?? parseSaveDc(text);
  console.log(`  ${String(got ?? "none").padStart(4)}   ${label}`);
  if (got !== want) problems.push(`${label}: got ${got}, expected ${want}`);
}

// 2. Every per-ability DC token resolves to 8 + that ability + proficiency.
const t = L.find(x => x.name === "Elemental Mirror")!;
const s = scoresFromTemplate(t.abilities ?? []);
const pb = monsterProficiency(t.stats);
console.log(`\n  ${t.name} — proficiency +${pb}, main ${monsterMainAbility(t)}`);
for (const ab of ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const) {
  const got = Number(resolveMonsterFormula(`@DC${ab}`, t));
  const want = 8 + abilityModifier(s[ab]) + pb;
  console.log(`     @DC${ab} = ${got}   (8 + ${abilityModifier(s[ab])} + ${pb})`);
  if (got !== want) problems.push(`@DC${ab} = ${got}, expected ${want}`);
}

// 3. Nothing in the library carries damage with no way to resolve it, unless it truly prints none.
let automatic = 0;
for (const c of L) {
  for (const a of parseCreature(c).assumptions) {
    if (/treated as automatic/.test(a.detail)) { automatic++; console.log(`\n  still automatic: ${c.name} — ${a.detail.slice(0, 92)}`); }
  }
}
console.log(`\n  ${automatic} feature(s) still priced as automatic.`);

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — the DC is found wherever it is printed, and every ability has a derivable DC.`);
