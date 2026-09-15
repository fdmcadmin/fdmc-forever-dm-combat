/**
 * A SPELL THAT GRANTS AN ATTACK GETS A BUTTON, AND A REACTION SPELL CAN BE FOCUSED.
 *   npx tsx scripts/check-temp-actions.ts
 *
 * Christopher, 2026-09-10: *"it needs to be a button like the OA, and then when the spell is
 * created we simply let the field like scorching ray handle the counts we just put a 2 there and
 * when the spell is recast each time it can be used that many times"*, and *"make there be a check
 * on spell reactions that lets it be a focused reaction and using that reaction still works as if
 * clicking the spell."*
 *
 * ⚠ NEITHER HALF NEEDED A NEW MECHANISM, and that is the point of this gate.
 *
 *   · the swing count is `spellAttackRollCount` — the SAME field that gives Scorching Ray its
 *     rays, so an upcast scales the swings and nothing here knows what a ray is
 *   · a focused reaction is `pinReaction`, which `getActionForReadiedKey` already resolves back
 *     to the FULL source action, so firing it rolls and spends exactly as the card does
 *
 * What was missing was a count on the chip, a row to click, and a tick to set the flag.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spellAttackRollCount } from "../src/core/types/spellSlots";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const codeOf = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

console.log("A granted attack is a button, with the swings the spell says\n");

console.log("1. the count comes from the ray field");
{
  // Finger guns: put a 2 in "attack rolls per cast".
  ok("a 2 in the field is two swings",
    spellAttackRollCount({ attackRolls: 2, spellLevel: 1, selectedCastLevel: 1 }) === 2,
    String(spellAttackRollCount({ attackRolls: 2, spellLevel: 1, selectedCastLevel: 1 })));
  // Flame Blade leaves it blank: one swing.
  ok("blank is one swing", spellAttackRollCount({ spellLevel: 2, selectedCastLevel: 2 }) === 1);
  /**
   * ⚠ AND AN UPCAST SCALES IT FOR FREE, because this is the ray rule and not a new one. Three at
   * base with one per level, cast two levels up, is five.
   */
  ok("an upcast adds the per-level rolls",
    spellAttackRollCount({ attackRolls: 3, attackRollsPerLevel: 1, spellLevel: 2, selectedCastLevel: 4 }) === 5,
    String(spellAttackRollCount({ attackRolls: 3, attackRollsPerLevel: 1, spellLevel: 2, selectedCastLevel: 4 })));
}

console.log("\n2. the card arms that many, spends one a swing, and refills on a recast");
{
  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("the armed attack carries a per-cast count", /usesTotal\?: number;/.test(card) && /usesLeft\?: number;/.test(card));
  ok("...set from the spell's own ray count", /spellAttackRollCount\(\{[\s\S]{0,120}selectedCastLevel: getCastLevel\(action\)/.test(card));
  ok("...spent one per swing", /usesLeft: armed\.usesLeft - 1/.test(card));
  ok("...and refused at zero", /armed\.usesLeft <= 0/.test(card));
  /**
   * ⚠ REFILL IS `upsertArmedEffect` REPLACING BY ID, not a separate reset — one cast, that many
   * uses, every time. If the chip were appended rather than replaced this would silently stack.
   */
  ok("a recast replaces the chip rather than stacking one",
    /const withoutExisting = currentEffects\.filter\(\(item\) => item\.id !== effect\.id\)/.test(card));
}

console.log("\n3. it is a row of its own, not a chip button");
{
  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("a Temporary Actions panel exists", /function renderTemporaryActionsPanel/.test(card));
  ok("...it is rendered", /\{renderTemporaryActionsPanel\(\)\}/.test(card));
  ok("...and it primes the SAME attack the chip did",
    /renderTemporaryActionsPanel[\s\S]{0,2200}primeArmedAttack\(effect\)/.test(card));
}

console.log("\n4. a reaction spell can be focused");
{
  const spells = codeOf("src/core/ui/SpellTableEditor.tsx");
  ok("the spell editor carries the tick", /focusedReaction: boolean;/.test(spells));
  ok("...reads it back off the action", /focusedReaction: Boolean\(action\.pinReaction\)/.test(spells));
  ok("...and writes pinReaction", /pinReaction: true/.test(spells));
  /**
   * ⚠ ONLY ON A REACTION. `isPinnedReactionAction` needs the flag AND a reaction cost, so writing
   * it onto an Action-cost spell would be a tick that does nothing.
   */
  ok("...only when the spell IS a reaction",
    /row\.focusedReaction && row\.economyCost === "reaction"/.test(spells));

  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("firing a pinned shortcut resolves back to the full source action",
    /reaction\.sourceTabId && reaction\.sourceActionId/.test(card));
  /**
   * ⚠ STILL A REACTION COST — WITH ONE NAMED EXCEPTION, AND IT IS NOT A SPELL.
   * 0.8.59.0 lets a `pinReaction` row that costs the BOND pin too: Guardian's Intercept fires off-turn and
   * its text says "This does not use your reaction". A spell never costs the bond, so an Action-cost spell
   * ticked as a focused reaction still pins nothing — the intent this assertion was written for.
   */
  ok("...and the pin gate still requires a reaction cost",
    /if \(!\(action\.pinned \|\| action\.pinReaction\)\) return false;/.test(card)
    && /return costs\.includes\("reaction"\) \|\| Boolean\(action\.pinReaction && costs\.includes\("bond"\)\);/.test(card));
  ok("...whose only exception is a pinReaction row on the BOND slot — never main or bonus",
    !/costs\.includes\("(main|bonus)"\)/.test(card.slice(card.indexOf("function isPinnedReactionAction"), card.indexOf("function actionToPinnedReaction"))));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
