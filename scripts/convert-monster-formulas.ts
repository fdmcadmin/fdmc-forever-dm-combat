/**
 * CONVERT AUTHORED ATTACK NUMBERS TO FORMULA VARIABLES — only where they resolve exactly.
 *   npx tsx scripts/convert-monster-formulas.ts           dry run, changes nothing
 *   npx tsx scripts/convert-monster-formulas.ts --write   apply
 *
 * Christopher: *"make sure we dont invent failure, if a attack uses strength and X ABS and its is
 * not @ATCK or @main then it should be @X to resolve correctly."*
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────────────────────
 *
 * A printed `+9 to hit` is some ability's modifier plus the proficiency bonus. Find WHICH:
 *
 *   the creature's @MAIN ability   ->  `@ATK`          (@ATK is @MAIN + @PB, complete)
 *   any other ability X            ->  `@X+@PROF`      (named, because @MAIN is not it)
 *   nothing produces the number    ->  LEAVE IT ALONE
 *
 * That last line is the whole instruction. A creature whose printed bonus matches no ability is
 * not a conversion failure to be forced — it is a creature with an authored bonus that does not
 * follow the standard formula, and rewriting it would silently change what it hits for.
 *
 * ⚠ NOTHING IS CONVERTED THAT DOES NOT RESOLVE BACK TO THE SAME NUMBER. Every rewrite is checked
 * by resolving it against the creature and comparing to the original, before it is written.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { parseAttackBonus } from "../src/core/encounter-band/parseCreature";
import { resolveMonsterFormula, monsterProficiency, monsterMainAbility } from "../src/core/monsters/resolveMonsterFormulaVars";
import { ABILITY_ORDER, scoresFromTemplate, abilityModifier } from "../src/core/monsters/creator/monsterCreatorModel";

const PATH = "src/data/broken-chain/monsterLibrary.ts";
const write = process.argv.includes("--write");

type Change = { creature: string; action: string; field: "roll" | "damage"; from: string; to: string };
const changes: Change[] = [];
const skipped: string[] = [];

for (const t of L) {
  const scores = scoresFromTemplate(t.abilities ?? []);
  const pb = monsterProficiency(t.stats);
  const main = monsterMainAbility(t);
  /** Which ability's modifier equals n, preferring @MAIN so the common case reads as @ATK. */
  const abilityFor = (n: number) => {
    if (abilityModifier(scores[main]) === n) return main;
    return ABILITY_ORDER.find(a => abilityModifier(scores[a]) === n);
  };

  for (const a of [...(t.actions ?? []), ...(t.reactions ?? [])]) {
    // ── the to-hit ──────────────────────────────────────────────────────────
    if (a.roll && !/@/.test(a.roll)) {
      const bonus = parseAttackBonus(a.roll);
      if (bonus === undefined) {
        // No bonus printed at all — nothing to convert, and nothing wrong.
      } else {
        const ability = abilityFor(bonus - pb);
        if (!ability) {
          skipped.push(`${t.name} · ${a.name} roll: +${bonus} is no ability + PB(${pb}) — left as authored`);
        } else {
          const token = ability === main ? "@ATK" : `@${ability}+@PROF`;
          const next = a.roll.replace(/([+-])\s*\d+\s*$/, `+ ${token}`);
          if (parseAttackBonus(resolveMonsterFormula(next, t)) === bonus) {
            changes.push({ creature: t.name, action: a.name, field: "roll", from: a.roll, to: next });
          } else {
            skipped.push(`${t.name} · ${a.name} roll: "${next}" would resolve to ${parseAttackBonus(resolveMonsterFormula(next, t))}, not ${bonus}`);
          }
        }
      }
    }

    // ── the damage modifier ─────────────────────────────────────────────────
    // Only the FLAT term directly after the first die group, and only when it is exactly an
    // ability modifier. "2d10 + 5 piercing + 2d6 radiant" converts its 5 and leaves the rest.
    if (a.damage && !/@/.test(a.damage)) {
      const m = a.damage.match(/^(\s*\d*d\d+\s*)([+-])\s*(\d+)/);
      if (m) {
        const flat = (m[2] === "-" ? -1 : 1) * Number.parseInt(m[3], 10);
        const ability = abilityFor(flat);
        if (!ability) {
          skipped.push(`${t.name} · ${a.name} damage: +${flat} is no ability modifier — left as authored`);
        } else {
          const token = ability === main ? "@MAIN" : `@${ability}`;
          const next = a.damage.replace(/^(\s*\d*d\d+\s*)([+-])\s*(\d+)/, `$1+ ${token}`);
          // Resolve and compare the whole expression, not just the term.
          const before = a.damage.replace(/\s+/g, "");
          const after = resolveMonsterFormula(next, t).replace(/\s+/g, "");
          if (before === after) {
            changes.push({ creature: t.name, action: a.name, field: "damage", from: a.damage, to: next });
          } else {
            skipped.push(`${t.name} · ${a.name} damage: "${next}" resolves to "${after}", not "${before}"`);
          }
        }
      }
    }
  }
}

console.log(`CONVERTIBLE — ${changes.length} field(s) that resolve back to exactly what they print\n`);
for (const c of changes.slice(0, 24)) {
  console.log(`  ${c.creature} · ${c.action} (${c.field})`);
  console.log(`      "${c.from}"  ->  "${c.to}"`);
}
if (changes.length > 24) console.log(`  … and ${changes.length - 24} more`);

console.log(`\nLEFT ALONE — ${skipped.length} field(s). These are not failures.\n`);
for (const s of skipped.slice(0, 20)) console.log(`  ${s}`);
if (skipped.length > 20) console.log(`  … and ${skipped.length - 20} more`);

if (!write) {
  console.log(`\n(dry run — nothing written. Re-run with --write to apply.)`);
  process.exit(0);
}

/**
 * ⚠ SCOPED TO THE CREATURE, THEN TO THE ACTION LINE.
 *
 * A global string replace cannot do this: `roll: "1d20 + 5"` appears on a dozen creatures, so an
 * exact-match-once guard refused 97 of 114 rewrites — correctly, since guessing which occurrence
 * is exactly how a conversion silently edits the wrong creature. The file is walked instead: find
 * the creature's `name:` line, take everything up to the next one, and rewrite the single line in
 * that window whose `name: "<action>"` matches.
 */
const lines = readFileSync(PATH, "utf8").split("\n");
const nameLines = lines
  .map((l, i) => ({ i, m: l.match(/^    name: "([^"]+)",$/) }))
  .filter(x => x.m)
  .map(x => ({ line: x.i, name: x.m![1] }));

let applied = 0;
const unapplied: string[] = [];
for (const c of changes) {
  const idx = nameLines.findIndex(n => n.name === c.creature);
  if (idx < 0) { unapplied.push(`${c.creature}: not found in the file`); continue; }
  const start = nameLines[idx].line;
  const end = idx + 1 < nameLines.length ? nameLines[idx + 1].line : lines.length;

  const hits: number[] = [];
  for (let k = start; k < end; k++) {
    if (!lines[k].includes(`name: "${c.action}"`)) continue;
    if (!lines[k].includes(`${c.field}: "${c.from}"`)) continue;
    hits.push(k);
  }
  if (hits.length !== 1) {
    unapplied.push(`${c.creature} · ${c.action} (${c.field}): ${hits.length} matching line(s) in its block`);
    continue;
  }
  lines[hits[0]] = lines[hits[0]].replace(`${c.field}: "${c.from}"`, `${c.field}: "${c.to}"`);
  applied++;
}
writeFileSync(PATH, lines.join("\n"));
console.log(`\nwrote ${applied} of ${changes.length} conversions.`);
if (unapplied.length) {
  console.log(`\n${unapplied.length} not applied — reported rather than guessed at:`);
  for (const u of unapplied) console.log(`  ${u}`);
}
