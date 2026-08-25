/**
 * WHAT CHANGED SINCE THE LAST VERSION — the guard the other checks cannot be.
 *   npx tsx scripts/check-baseline.ts            compare against the committed baseline
 *   npx tsx scripts/check-baseline.ts --accept   record the current numbers as the new baseline
 *
 * Christopher: *"did we do the change for the current vs last version that can keep bugs and app
 * breaking changes from going through."* We had not. This is it.
 *
 * ⚠ WHY THE EXISTING CHECKS DO NOT COVER THIS. `check:bonds`, `check:storage`, `check:slots`,
 * `check:monsters` and `check:actrun` assert INVARIANTS — things that must be true of any build.
 * They pass happily while a number quietly moves. tsc catches shapes, the encoding scan catches
 * bytes, and neither has any idea what the Veil-Torn Dragon hit for yesterday.
 *
 * Every fault this session was of that shape. A rider printed in prose but missing from the
 * damage field cost the Gate III boss 7 points of Bite damage. The Mirror priced at a quarter of
 * its size. A trait lookup that matched on the flavour name reported calibrated figures as
 * guesses. Every one of them type-checked, every one passed every check, and every one would
 * have shown up here as a line that moved.
 *
 * ⚠ THIS CHECK FAILING IS NOT A BUG REPORT. It says a published number moved. Read the diff: if
 * the move is the change you meant, run --accept and commit the new baseline alongside it. The
 * value is that the move cannot happen SILENTLY, and that the baseline diff lands in the same
 * commit as the code that caused it.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { seedEncounterLibraryFromTemplates } from "../src/core/monsters/encounterLibrary";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { resolvePartyProfile, effectiveHpPerBody } from "../src/core/encounter-band/checkerV2";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";

const BASELINE = "scripts/baseline.json";
const accept = process.argv.includes("--accept");
const r2 = (n: number) => Math.round(n * 100) / 100;

/** A fixed probe party, so a curve change shows up as a curve change and not as noise. */
const LEVEL = 8, SIZE = 4;
const defence = partyDefenceAt(LEVEL, "brokenChain");
const target = {
  ac: defence.ac, partySize: SIZE,
  saveBonus: (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6,
  saves: { str: defence.str, dex: defence.dex, con: defence.con, int: defence.int, wis: defence.wis, cha: defence.cha },
};

type Snapshot = Record<string, number | string>;
const now: Snapshot = {};

// ─── Creatures: what each one is worth, both ways ─────────────────────────────
for (const template of BROKEN_CHAIN_MONSTER_LIBRARY) {
  const key = `creature/${template.templateId}`;
  try {
    const parsed = parseCreature(template);
    const built = rosterFromTemplates([{ template, quantity: 1 }], LEVEL, target as never);
    const group = built.roster[0];
    const trace = traceCreature(parsed, target, 4);
    now[`${key}/ehp`] = r2(effectiveHpPerBody(group, SIZE));
    now[`${key}/dpr1`] = r2(trace.rounds[0]?.totalExpectedDamage ?? 0);
    now[`${key}/dpr4`] = r2(trace.rounds[3]?.totalExpectedDamage ?? 0);
    now[`${key}/assumptions`] = built.assumptions.length;
  } catch (err) {
    now[key] = `THREW: ${(err as Error).message}`;
  }
}

// ─── Encounters: bodies, raw HP, and whether every entry still resolves ───────
const seed = seedEncounterLibraryFromTemplates(BROKEN_CHAIN_MONSTER_LIBRARY);
const byId = new Map(BROKEN_CHAIN_MONSTER_LIBRARY.map(t => [t.templateId, t]));
for (const e of seed) {
  const bodies = e.entries.reduce((s, x) => s + x.count, 0);
  const rawHp = e.entries.reduce((s, x) => s + x.count * (byId.get(x.templateId)?.stats.maxHp ?? 0), 0);
  const missing = e.entries.filter(x => !byId.has(x.templateId)).map(x => x.templateId);
  now[`encounter/${e.id}/bodies`] = bodies;
  now[`encounter/${e.id}/rawHp`] = rawHp;
  /**
   * ⚠ AN ENCOUNTER POINTING AT A CREATURE THAT NO LONGER EXISTS IS THE APP-BREAKING CASE.
   * The checker filters unresolvable entries, so the fight goes quiet rather than loud.
   */
  if (missing.length) now[`encounter/${e.id}/DANGLING`] = missing.join(",");
}

// ─── The party curve, both modes, every level it publishes ────────────────────
for (const mode of ["wotcStandard", "brokenChain"] as const) {
  for (let level = 1; level <= 20; level++) {
    try {
      const p = resolvePartyProfile({ level, size: 4, equipmentMode: mode });
      now[`curve/${mode}/${level}/r1`] = r2(p.dpr.round1);
      now[`curve/${mode}/${level}/sustain`] = r2(p.sustain);
    } catch { /* level not published — absence is itself part of the snapshot */ }
  }
}

// ─── Compare ──────────────────────────────────────────────────────────────────
if (!existsSync(BASELINE) || accept) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 1) + "\n");
  console.log(`${existsSync(BASELINE) ? "Recorded" : "Created"} baseline: ${Object.keys(now).length} tracked values.`);
  process.exit(0);
}

const was = JSON.parse(readFileSync(BASELINE, "utf8")) as Snapshot;
const added: string[] = [], removed: string[] = [], changed: string[] = [];
for (const k of Object.keys(now)) {
  if (!(k in was)) added.push(`  + ${k} = ${now[k]}`);
  else if (was[k] !== now[k]) changed.push(`  ~ ${k}   ${was[k]}  ->  ${now[k]}`);
}
for (const k of Object.keys(was)) if (!(k in now)) removed.push(`  - ${k} (was ${was[k]})`);

const dangling = Object.keys(now).filter(k => k.endsWith("/DANGLING"));
const threw = Object.keys(now).filter(k => String(now[k]).startsWith("THREW:"));

if (dangling.length || threw.length) {
  console.error("\nAPP-BREAKING:");
  for (const k of dangling) console.error(`  ${k.replace("/DANGLING", "")} references a creature that does not exist: ${now[k]}`);
  for (const k of threw) console.error(`  ${k} ${now[k]}`);
}

if (!added.length && !removed.length && !changed.length) {
  console.log(`Baseline matches: ${Object.keys(now).length} values unchanged.`);
  process.exit(dangling.length || threw.length ? 1 : 0);
}

console.log(`\nCHANGED SINCE THE LAST ACCEPTED BASELINE — ${changed.length} moved, ${added.length} added, ${removed.length} removed\n`);
for (const line of [...changed, ...added, ...removed]) console.log(line);
console.log(`\nIf every line above is a change you meant, record it:\n  npm run baseline:accept\nand commit scripts/baseline.json with the change that caused it.`);
process.exit(1);
