/**
 * ONE PROFICIENCY BONUS, AND EVERY READER GIVES THE SAME ANSWER.
 *   npx tsx scripts/check-proficiency-readers.ts
 *
 * Christopher, 2026-09-12: *"the brandwing is at +7 to hit the baseline is a +9 (+5 from dex and +4
 * from PB) […] i have to go through every single creature and put the actual cr into the boxes
 * because the prof bonus box you have set is not being counted"*, and: *"the difference in the
 * brandwing from me putting the actual cr in should not happen."*
 *
 * ⚠ THIS IS THE FOURTH PLACE THE SAME BUG HAS LIVED, WHICH IS WHY IT IS NOW A GATE.
 *
 *   `resolveMonsterFormulaVars`   fixed earlier — its own comment records the identical fault:
 *                                 *"their SAVES used the recovered +4 while every [formula] +2.
 *                                 One creature, two proficiency bonuses, exactly the drift this
 *                                 codebase keeps warning about."*
 *   `creatureSaveModifier`        already took the whole `stats` object
 *   `creatureSaves`               already took the whole `stats` object
 *   `creatureSaveDisplay`         took `cr` ALONE — the editor's own save column
 *
 * Every Act 3 creature prints a bonus and states NO CR, so with the CR box empty that last one
 * fell to `Math.max(1, cr ?? 1)` = 1 → +2. Brandwing's DEX 20 read **save +7** beside a box saying
 * 4 and a caption reading *"using +4 as printed"*. The panel's own caption was the honest half.
 *
 * ⚠ AND THE WORKAROUND WAS WORSE THAN THE BUG. Typing a CR to make the display agree edits a
 * creature that already stated its bonus; "correcting" the +7 by hand writes an explicit save,
 * which `inferSaveProficiency` then reads back as a deliberate override. Both silently change the
 * creature to satisfy a reader that was wrong.
 */
import {
  creatureProficiencyBonus, creatureSaveDisplay, creatureSaveModifier, creatureSaves,
} from "../src/core/monsters/creator/monsterCreatorModel";
import { monsterProficiency } from "../src/core/monsters/resolveMonsterFormulaVars";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("One proficiency bonus, and every reader gives the same answer\n");

/** Brandwing as authored: DEX 20, proficient, printed +4, and NO CR — the Act 3 shape. */
const DEX = { label: "DEX", value: "20", saveProficient: true };
const PRINTED_NO_CR = { proficiencyBonus: 4 };

console.log("1. a printed bonus with no CR");
{
  ok("the resolver takes the printed figure", creatureProficiencyBonus(PRINTED_NO_CR) === 4);
  ok("the save modifier agrees", creatureSaveModifier(DEX, PRINTED_NO_CR) === 9,
    String(creatureSaveModifier(DEX, PRINTED_NO_CR)));
  ok("the six-save map agrees", creatureSaves([DEX] as never, PRINTED_NO_CR).dex === 9,
    String(creatureSaves([DEX] as never, PRINTED_NO_CR).dex));

  /**
   * ⚠ THE ONE THAT WAS WRONG. +7 here is the shipped bug: DEX +5 plus a CR-1 bonus of +2.
   */
  ok("the EDITOR's save column agrees", creatureSaveDisplay(DEX, PRINTED_NO_CR).save === 9,
    String(creatureSaveDisplay(DEX, PRINTED_NO_CR).save));

  ok("...and so does the formula resolver behind @PROF",
    monsterProficiency(PRINTED_NO_CR as never) === 4, String(monsterProficiency(PRINTED_NO_CR as never)));
}

console.log("\n2. entering the CR must not change a creature that already printed its bonus");
{
  /**
   * ⚠ THE ASSERTION IN CHRISTOPHER'S OWN WORDS: *"the difference in the brandwing from me putting
   * the actual cr in should not happen."* A printed bonus is a statement; a CR is a different
   * statement, and the printed one wins. If these two ever disagree the workaround is back.
   */
  const withCr = { proficiencyBonus: 4, cr: 9 };
  ok("the editor reads the same with and without a CR",
    creatureSaveDisplay(DEX, PRINTED_NO_CR).save === creatureSaveDisplay(DEX, withCr).save,
    `${creatureSaveDisplay(DEX, PRINTED_NO_CR).save} vs ${creatureSaveDisplay(DEX, withCr).save}`);
  ok("...and so does the checker",
    creatureSaveModifier(DEX, PRINTED_NO_CR) === creatureSaveModifier(DEX, withCr));

  /**
   * ⚠ AND A CR THAT CONTRADICTS THE PRINTED BONUS DOES NOT WIN. CR 1 implies +2; the block says
   * +4. Printed beats derived, or every Act 3 creature is wrong again.
   */
  const contradicting = { proficiencyBonus: 4, cr: 1 };
  ok("mutation: a contradicting CR does not override the printed bonus",
    creatureSaveDisplay(DEX, contradicting).save === 9,
    String(creatureSaveDisplay(DEX, contradicting).save));
}

console.log("\n3. with NO printed bonus the CR still feeds it");
{
  ok("CR 9 gives +4", creatureProficiencyBonus({ cr: 9 }) === 4);
  ok("...and the editor shows +9", creatureSaveDisplay(DEX, { cr: 9 }).save === 9);
  ok("CR 1 gives +2", creatureProficiencyBonus({ cr: 1 }) === 2);
  /** Nothing stated at all is the floor, and that is a real answer rather than a fault. */
  ok("nothing stated is the +2 floor", creatureSaveDisplay(DEX, {}).save === 7,
    String(creatureSaveDisplay(DEX, {}).save));
}

console.log("\n4. an explicit save is still read against the RIGHT bonus");
{
  /**
   * ⚠ `inferSaveProficiency` HAD NO WAY TO BE TOLD THE PRINTED BONUS EITHER. A save of +9 on a
   * creature printing +4 is "proficient"; read against a CR-1 +2 it is an arbitrary override, and
   * the editor would tick nothing and keep the number as explicit — quietly converting a derived
   * save into a hard-coded one.
   */
  const explicit = { label: "DEX", value: "20", save: 9 };
  const read = creatureSaveDisplay(explicit, PRINTED_NO_CR);
  ok("+9 on a +4 creature reads as PROFICIENT", read.proficient === true && read.explicit === false,
    JSON.stringify(read));
  const bare = creatureSaveDisplay({ label: "DEX", value: "20", save: 5 }, PRINTED_NO_CR);
  ok("+5 reads as the bare modifier, not proficient", bare.proficient === false && bare.explicit === false);
  const odd = creatureSaveDisplay({ label: "DEX", value: "20", save: 11 }, PRINTED_NO_CR);
  ok("mutation: a number matching neither stays explicit", odd.explicit === true, JSON.stringify(odd));
}

console.log("\n5. no reader is left taking the CR alone");
{
  /**
   * ⚠ THE SHAPE, NOT THE INSTANCE. This bug has recurred because each reader was fixed one at a
   * time; what fails here is any save reader whose signature can only see a CR.
   */
  const model = readFileSync(resolve(ROOT, "src/core/monsters/creator/monsterCreatorModel.ts"), "utf8");
  ok("creatureSaveDisplay takes the stats object",
    /export function creatureSaveDisplay\([\s\S]{0,200}?stats: \{ cr\?: number; proficiencyBonus\?: number \}/.test(model));
  const rules = readFileSync(resolve(ROOT, "src/core/rules/dnd5e.ts"), "utf8");
  ok("inferSaveProficiency accepts an explicit bonus", /explicitBonus\?: number;/.test(rules));
  ok("...and prefers it over the level", /typeof opts\.explicitBonus === "number"/.test(rules));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
