/**
 * THE ARCHETYPE GATE — all six packages, and the budget they are not allowed to move.
 *
 * Run: npm run check:reshape
 *
 * Christopher, 2026-08-28: *"there should already be tests on how all 6 elemental packages
 * operate."* There were tests on the Elemental Mirror — its one-body-per-PC scaling
 * (`check:monsters`), its six per-ability save DCs (`check:savedcs`), its damage resolution
 * (`check:formulas`) — but NONE on the Reshape itself, which is the thing that produces the six
 * packages. MASTER records it as "verified 6 of 6" at 0.8.0; that was a hand check, and a hand
 * check does not survive the next edit.
 *
 * ⚠ THE INVARIANT IS THE BUDGET. `redistributeScores` deals the SAME six numbers high→low into an
 * archetype's priority order: swapping archetype changes a creature's SHAPE, never its total. If
 * that ever stops holding, every creature built through the creator silently regrades — the
 * estimator prices an ability spread it was never given.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. See MASTER on `check:summons`.
 */

import {
  ABILITY_ORDER, ARCHETYPES, archetypeInfo, redistributeScores, redistributeAbilityEntries,
} from "../src/core/monsters/creator/monsterCreatorModel";
import type { MonsterArchetype } from "../src/core/monsters/runtime/mainMonsterRuntime";

type AbilityLabel = (typeof ABILITY_ORDER)[number];

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** The Elemental Mirror's own ABS row — the array MASTER records the six packages against. */
const ABS_ROW = [18, 16, 14, 12, 12, 10];
const asScores = (nums: number[]): Record<AbilityLabel, number> =>
  Object.fromEntries(ABILITY_ORDER.map((l, i) => [l, nums[i]])) as Record<AbilityLabel, number>;

const sorted = (ns: number[]) => [...ns].sort((a, b) => b - a);
const poolOf = (s: Record<AbilityLabel, number>) => sorted(ABILITY_ORDER.map(l => s[l]));

console.log(`Archetype reshape — ${ARCHETYPES.length} packages, ABS row ${ABS_ROW.join("/")}\n`);

/* ── The six packages exist and are well-formed ─────────────────────────────────────────── */
console.log("The six packages");
ok("there are exactly six", ARCHETYPES.length === 6, ARCHETYPES.map(a => a.id).join(", "));

for (const a of ARCHETYPES) {
  const covers = new Set(a.priority);
  ok(`${a.id}: priority covers all six abilities exactly once`,
    a.priority.length === 6 && covers.size === 6 && ABILITY_ORDER.every(l => covers.has(l)),
    a.priority.join(">"));
  ok(`${a.id}: its primary is first in priority`, a.priority[0] === a.primary,
    `primary ${a.primary}, first ${a.priority[0]}`);
}

const primaries = new Set(ARCHETYPES.map(a => a.primary));
ok("the six primaries are the six abilities — one package per ability",
  primaries.size === 6 && ABILITY_ORDER.every(l => primaries.has(l)),
  [...primaries].join(","));

/* ── THE BUDGET IS PRESERVED ────────────────────────────────────────────────────────────── */
console.log("\nReshape changes shape, never budget");
{
  const start = asScores(ABS_ROW);
  const wanted = sorted(ABS_ROW);

  for (const a of ARCHETYPES) {
    const out = redistributeScores(start, a.id as MonsterArchetype);
    ok(`${a.id}: same six numbers`, JSON.stringify(poolOf(out)) === JSON.stringify(wanted),
      ABILITY_ORDER.map(l => `${l} ${out[l]}`).join(" "));
    ok(`${a.id}: the highest score lands on ${a.primary}`,
      out[a.primary as AbilityLabel] === wanted[0],
      `${a.primary} ${out[a.primary as AbilityLabel]}`);
  }
}

/* ── Reshaping is a function of the POOL, not of the previous shape ─────────────────────── */
console.log("\nReshape is not path-dependent");
{
  const start = asScores(ABS_ROW);
  for (const a of ARCHETYPES) {
    const direct = redistributeScores(start, a.id as MonsterArchetype);
    // Route through every other package first — the answer must not change.
    let hopped = start;
    for (const via of ARCHETYPES) hopped = redistributeScores(hopped, via.id as MonsterArchetype);
    hopped = redistributeScores(hopped, a.id as MonsterArchetype);
    ok(`${a.id}: reached the same spread after routing through all six`,
      JSON.stringify(direct) === JSON.stringify(hopped));
  }
}

/* ── Ties do not lose a number ───────────────────────────────────────────────────────────── */
console.log("\nTied scores");
{
  // The ABS row has a tie (12/12) on purpose. A sort that dropped one would show up as a
  // duplicated or missing value rather than as an error.
  const out = redistributeScores(asScores(ABS_ROW), "guardian");
  const counts = new Map<number, number>();
  for (const l of ABILITY_ORDER) counts.set(out[l], (counts.get(out[l]) ?? 0) + 1);
  ok("the 12/12 tie survives as two twelves", counts.get(12) === 2);
  ok("no score appears that was not in the pool",
    ABILITY_ORDER.every(l => ABS_ROW.includes(out[l])));
}

/* ── A flat pool is unchanged by any package ────────────────────────────────────────────── */
console.log("\nA flat spread has no shape to change");
{
  const flat = asScores([12, 12, 12, 12, 12, 12]);
  ok("every package returns the flat spread untouched",
    ARCHETYPES.every(a => ABILITY_ORDER.every(l => redistributeScores(flat, a.id as MonsterArchetype)[l] === 12)));
}

/* ── The formatted-entry wrapper agrees with the raw one ────────────────────────────────── */
console.log("\nThe entry wrapper the editor and actionSetPicks both call");
{
  const entries = ABILITY_ORDER.map((l, i) => ({ label: l, value: String(ABS_ROW[i]) }));
  for (const a of ARCHETYPES) {
    const out = redistributeAbilityEntries(entries, a.id as MonsterArchetype);
    ok(`${a.id}: returns all six labels in ABILITY_ORDER`,
      out.length === 6 && out.every((e, i) => e.label === ABILITY_ORDER[i]));
    const raw = redistributeScores(asScores(ABS_ROW), a.id as MonsterArchetype);
    ok(`${a.id}: entry values match the raw reshape`,
      out.every(e => String(raw[e.label as AbilityLabel]) === String(e.value).match(/-?\d+/)?.[0]),
      out.map(e => `${e.label} ${e.value}`).join(" "));
  }
}

/* ── An unknown package does not invent a spread ────────────────────────────────────────── */
console.log("\nAn unknown archetype");
{
  const fallback = archetypeInfo("not-a-package" as MonsterArchetype);
  ok("falls back to a real package rather than undefined", Boolean(fallback?.id));
  const out = redistributeScores(asScores(ABS_ROW), "not-a-package" as MonsterArchetype);
  ok("and still preserves the budget",
    JSON.stringify(poolOf(out)) === JSON.stringify(sorted(ABS_ROW)));
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
