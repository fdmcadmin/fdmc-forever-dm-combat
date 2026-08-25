/**
 * EVERY LIBRARY CREATURE'S SIX SAVES, AS THE APP RESOLVES THEM.
 *   npx tsx scripts/check-monster-saves.ts --record   write the baseline
 *   npx tsx scripts/check-monster-saves.ts            fail if any save moved
 *
 * The library's saves were 55 hand-typed numbers. Converting them to proficiency ticks is only
 * safe if every save still resolves to exactly the number it replaced — a conversion that shifts
 * a save is not a conversion, it is a silent edit to a creature.
 *
 * ⚠ THIS IS SEPARATE FROM check:baseline ON PURPOSE. That one tracks EHP and DPR; a save moving
 * by one would not register there at all, because a monster's own saves do not feed the checker.
 * They feed the card and the table, which is exactly where a wrong number is hardest to notice.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { creatureSaves, creatureProficiencyBonus } from "../src/core/monsters/creator/monsterCreatorModel";

const FILE = "scripts/monster-saves.json";
const record = process.argv.includes("--record");

const now: Record<string, string> = {};
const bonuses: Record<string, number> = {};
for (const t of L) {
  const saves = creatureSaves(t.abilities ?? [], t.stats);
  // ⚠ THE SIX SAVES ONLY. Recording the proficiency bonus alongside them made an INTENDED bonus
  // change look identical to a save moving, which is the one thing this exists to separate. The
  // bonus is printed for context and never compared.
  now[t.name] = (["str", "dex", "con", "int", "wis", "cha"] as const).map(k => `${k}${saves[k]}`).join(" ");
  bonuses[t.name] = creatureProficiencyBonus(t.stats);
}

if (record || !existsSync(FILE)) {
  writeFileSync(FILE, JSON.stringify(now, null, 1) + "\n");
  console.log(`Recorded ${Object.keys(now).length} creatures' saves.`);
  process.exit(0);
}

const was = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, string>;
const moved: string[] = [];
for (const name of Object.keys(now)) {
  if (!(name in was)) { console.log(`  new creature: ${name} -> ${now[name]}`); continue; }
  if (was[name] !== now[name]) moved.push(`${name}\n      was ${was[name]}\n      now ${now[name]}`);
}
for (const name of Object.keys(was)) if (!(name in now)) console.log(`  creature gone: ${name}`);

if (moved.length) {
  console.error(`\nFAILED — ${moved.length} creature(s) whose saves MOVED:\n`);
  for (const m of moved) console.error(`  ${m}`);
  console.error(`\nA save changing value is a silent edit to a creature. If it was intended,\nre-record with: npx tsx scripts/check-monster-saves.ts --record`);
  process.exit(1);
}
const withBonus = Object.values(bonuses).filter(b => b > 2).length;
console.log(`PASS — all ${Object.keys(now).length} creatures resolve to the same six saves.`);
console.log(`       ${withBonus} of them now carry a recovered proficiency bonus above the +2 floor.`);
