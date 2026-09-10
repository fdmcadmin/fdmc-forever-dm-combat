/**
 * BUILD THE ACT 3 v3.44 MERGE PAYLOAD — the authored layer brought up to the seed, keeping the
 * Mirror the author published.
 *   npx tsx scripts/build-act3-merge-payload.ts
 *
 * Christopher, 2026-09-10: *"merge your changes for act 3 with my authored payload of the mirrors
 * and send the changes with a payload."*
 *
 * ─── ⚠ WHAT WAS ACTUALLY WRONG, WHICH IS NOT WHAT I FIRST REPORTED ──────────────────────────
 *
 * I reported that the v3.44 conversion covered 9 of 25 creatures and stopped. It did not: 0.8.37.0
 * rebuilt ALL 25 in `monsterLibrary.ts`. What I measured was `BROKEN_CHAIN_MONSTER_LIBRARY`, which
 * is the seed with the AUTHORED LAYER MERGED OVER IT — and 17 authored copies were winning.
 *
 * They win because creatures MERGE by id and never expire. `fold-authoring` carries forward every
 * previously-authored creature whether or not the current export still holds it, which is the rule
 * that stops one browser's export from reverting the library:
 *
 *   *"no matter what i do when i push something it reverts to a seed that SHOULD NOT EXIST, my
 *   edits are the new seed."*
 *
 * Right rule, and this is its one blind spot: a copy authored BEFORE the seed moved keeps
 * shadowing it forever. The Veil-Torn Dragon fielded 195 HP with no reaction against v3.44's 244
 * with one; Darkmare 90 against 122. Sixteen creatures, all older than the rebuild.
 *
 * ─── ⚠ SO THE FIX IS A PUBLISH, NOT A DELETION ──────────────────────────────────────────────
 *
 * Retiring the authored copies would work and is the wrong instrument — it is the "seed reverts my
 * edit" shape, aimed the other way. Instead this REPUBLISHES those sixteen at their v3.44 values,
 * so the authored layer and the seed agree and nothing is shadowed by anything.
 *
 * ⚠ THE MIRROR IS CARRIED THROUGH UNTOUCHED, at the 115 HP the author published this morning —
 * newer than v3.44, and his: *"the authoured was by me for the mirrors, who else would have been
 * able to ship that."* The seed's 124 does NOT overwrite it.
 *
 * ⚠ AND EQUIPMENT AND ENCOUNTERS ARE COPIED VERBATIM from the live payload. This adds creatures to
 * an export; it does not get to have opinions about the rest of it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUNDLED_MONSTER_LIBRARY, BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";

const SOURCE = resolve("authoring/current.json");
const OUT = resolve("authoring/act3-v344-merge.json");
const MIRROR_ID = "broken-chain:act3:elemental-mirror:v1";

const payload = JSON.parse(readFileSync(SOURCE, "utf8")) as {
  schema: string; exportedAt: string; digest?: string;
  monsters: Array<Record<string, unknown>>;
  equipment: unknown[]; encounters: unknown[];
};

const bundled = BUNDLED_MONSTER_LIBRARY as Array<Record<string, unknown>>;
const merged = BROKEN_CHAIN_MONSTER_LIBRARY as Array<Record<string, unknown>>;

/** The comparison the authored layer is actually shadowing on. */
const shape = (t: Record<string, unknown> | undefined) => {
  if (!t) return "";
  const stats = (t.stats ?? {}) as Record<string, unknown>;
  const list = (k: string) => ((t[k] ?? []) as unknown[]).length;
  return JSON.stringify([stats.maxHp, stats.ac, list("actions"), list("reactions"), list("traits")]);
};

/**
 * Every Act 3 creature whose merged form disagrees with the seed — minus the Mirror, whose
 * disagreement is deliberate and current.
 */
const stale = bundled.filter(b => {
  const id = String(b.templateId);
  if (!/act3/i.test(id) || id === MIRROR_ID) return false;
  return shape(b) !== shape(merged.find(m => m.templateId === id));
});

const mirror = payload.monsters.find(m => m.templateId === MIRROR_ID);
if (!mirror) {
  console.error(`FATAL: ${SOURCE} does not carry the Mirror (${MIRROR_ID}).`);
  console.error("This payload exists to ADD to the author's Mirror, never to publish without it.");
  process.exit(1);
}

/**
 * ⚠ NO `digest` FIELD, AND THAT IS DELIBERATE. The fold refuses a payload whose STATED digest
 * disagrees with what it computes — a guard against a hand-edit between export and fold. This file
 * is not an app export, so stating a digest I calculated myself would be theatre dressed as a
 * check. Omitting it lets the fold compute and stamp the real one, which is the honest shape.
 */
const out = {
  schema: payload.schema,
  exportedAt: new Date().toISOString(),
  monsters: [mirror, ...stale],
  equipment: payload.equipment,
  encounters: payload.encounters,
};

writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");

console.log(`Act 3 v3.44 merge payload -> ${OUT}\n`);
console.log(`  carried through : ${String(mirror.name)} at ${(mirror.stats as Record<string, unknown>)?.maxHp} HP (the author's, untouched)`);
console.log(`  republished     : ${stale.length} creature(s) at their v3.44 seed values`);
for (const b of stale) {
  const m = merged.find(x => x.templateId === b.templateId);
  const hp = (t: Record<string, unknown> | undefined) => (t?.stats as Record<string, unknown>)?.maxHp;
  const cnt = (t: Record<string, unknown> | undefined, k: string) => ((t?.[k] ?? []) as unknown[]).length;
  console.log(`      ${String(b.name).padEnd(28)} hp ${String(hp(m)).padStart(4)} -> ${String(hp(b)).padStart(4)}`
    + `   reactions ${cnt(m, "reactions")} -> ${cnt(b, "reactions")}`
    + `   traits ${cnt(m, "traits")} -> ${cnt(b, "traits")}`);
}
console.log(`  equipment       : ${out.equipment.length} item(s) copied verbatim`);
console.log(`  encounters      : ${out.encounters.length} fight(s) copied verbatim`);
