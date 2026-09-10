/**
 * A CREATURE'S HP PATCH SURVIVES THE TRIP — every field of it, at every call site.
 *   npx tsx scripts/check-monster-hp-patch.ts
 *
 * Christopher, 2026-09-10: *"when i click -25% -10% and +10% and +25% for the health of a creature
 * it removes the hp like it would be moving it down but then resnaps the max hp to the set
 * number."*
 *
 * ─── ⚠ THE BUG WAS A DROPPED FIELD, AND NOTHING COULD SEE IT ────────────────────────────────
 *
 * The Pace dial moves CURRENT AND MAX TOGETHER so the bar does not jump. Three separate handlers
 * each merged that patch onto the instance by hand, and all three wrote `max: instance.maxHp` —
 * so `currentHp` landed and `maxHp` was thrown away. The card then re-synced its local max from
 * the prop and snapped the bar back, leaving the creature genuinely damaged instead of rescaled.
 * A -25% click dealt 25% of the creature's hit points in real damage.
 *
 * A type error could not catch it: every value was a number and every property existed. Only the
 * ROUND TRIP shows it — what the card emits versus what the instance ends up holding.
 *
 * ⚠ AND THE SOURCE ASSERTIONS ARE THE POINT, not decoration. The merge being correct proves
 * nothing if a fourth call site writes its own; the bug WAS three correct-looking copies.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { monsterHpFromPatch } from "../src/core/monster-state/monsterHpPatch";
import type { MainEncounterMonsterInstance } from "../src/core/monsters/runtime/mainMonsterRuntime";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const eq = (label: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok(label, pass, pass ? "" : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const inst = (currentHp: number, maxHp: number, tempHp = 0) =>
  ({ currentHp, maxHp, tempHp }) as Pick<MainEncounterMonsterInstance, "currentHp" | "maxHp" | "tempHp">;

console.log("A creature's HP patch survives the trip\n");

/* ── 1. THE PACE DIAL — the control that was broken ───────────────────────────────────────── */
console.log("1. rescaling moves both numbers, so the bar does not move");
{
  /**
   * What the card emits for a 100/100 creature at -25%: `nextMax = round(100 * 0.75)` and
   * `nextHp = round(100 * 0.75)`. Both. The bar stays at 100%.
   */
  const before = inst(100, 100);
  const patch = { currentHp: 75, maxHp: 75 };
  const after = monsterHpFromPatch(before, patch);
  eq("max follows the patch", after.max, 75);
  eq("current follows the patch", after.current, 75);
  eq("...so the bar sits where it did", after.current / after.max, before.currentHp / before.maxHp);

  /**
   * ⚠ THE MUTATION, AND IT IS THE EXACT SHIPPED BUG: hardcode the instance's max. The creature is
   * then 75/100 — a quarter of its hit points gone — rather than rescaled.
   */
  const dropped = { max: before.maxHp, current: patch.currentHp };
  ok("mutation: dropping the patch's max leaves the creature DAMAGED, not rescaled",
    dropped.current / dropped.max !== before.currentHp / before.maxHp,
    `bar would move ${before.currentHp}/${before.maxHp} → ${dropped.current}/${dropped.max}`);
}

/* ── 2. A WOUNDED CREATURE KEEPS ITS FRACTION ─────────────────────────────────────────────── */
console.log("\n2. a creature already hurt keeps the share it had");
{
  // 40/100, rescaled to +25%: the card sends 50/125. Still two fifths.
  const after = monsterHpFromPatch(inst(40, 100), { currentHp: 50, maxHp: 125 });
  eq("both numbers move", [after.current, after.max], [50, 125]);
  eq("the fraction is unchanged", after.current / after.max, 0.4);
}

/* ── 3. EVERY OTHER FIELD STILL DEFAULTS ──────────────────────────────────────────────────── */
console.log("\n3. an omitted field leaves that number alone");
{
  eq("damage alone does not touch max",
    monsterHpFromPatch(inst(100, 100, 5), { currentHp: 82 }), { max: 100, current: 82, temp: 5 });
  eq("temp alone touches neither",
    monsterHpFromPatch(inst(90, 100, 0), { tempHp: 12 }), { max: 100, current: 90, temp: 12 });
  eq("an empty patch changes nothing",
    monsterHpFromPatch(inst(64, 90, 3), {}), { max: 90, current: 64, temp: 3 });
}

/* ── 4. LOWERING MAX ALONE CANNOT LEAVE A CREATURE ABOVE ITS OWN BAR ──────────────────────── */
console.log("\n4. current is clamped to the resulting max");
{
  eq("a DM lowering the ceiling pulls current down with it",
    monsterHpFromPatch(inst(100, 100), { maxHp: 60 }), { max: 60, current: 60, temp: 0 });
  eq("...and raising it does not heal anyone",
    monsterHpFromPatch(inst(40, 100), { maxHp: 140 }), { max: 140, current: 40, temp: 0 });
  eq("a creature at 0 stays at 0", monsterHpFromPatch(inst(0, 100), { maxHp: 75 }).current, 0);
}

/* ── 5. NO CALL SITE MERGES BY HAND ───────────────────────────────────────────────────────── */
console.log("\n5. the three call sites use the shared merge");
{
  const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
  /**
   * ⚠ COMMENTS ARE STRIPPED BEFORE THE SCAN. The first version of this gate failed on the comment
   * that EXPLAINS the bug — a note reading *"this used to hardcode `max: m.maxHp`"* is a record of
   * the fix, not the defect. A gate that cannot tell code from prose about code punishes writing
   * the explanation down, which is the last thing this codebase should discourage.
   */
  const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const sites = ["src/App.tsx", "src/combat-window.tsx", "src/monster-popout.tsx"];
  for (const p of sites) {
    const src = read(p);
    ok(`${p} imports the shared merge`, src.includes("monsterHpFromPatch"));
    /**
     * ⚠ THE SHAPE THAT CAUSED THIS, BANNED BY NAME. `max: <something>.maxHp` beside a patch is a
     * hand-written merge that has already thrown the patch's own max away once.
     */
    const handRolled = /max:\s*(?:m|monster|inst|enc)\.maxHp/.exec(codeOnly(src));
    ok(`${p} does not hardcode the instance's max`, handRolled === null,
      handRolled ? `found ${JSON.stringify(handRolled[0])}` : "");
  }
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
