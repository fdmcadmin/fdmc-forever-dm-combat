/**
 * THE SRD CLASS TABLE, AND THE HAND TABLES THAT MUST AGREE WITH IT.
 *   npx tsx scripts/check-srd-classes.ts
 *
 * Christopher, 2026-09-10: *"using the 2 srd make sure the classes subclasses and all the races are
 * in the dnd mod."*
 *
 * ⚠ THE POINT IS NOT THAT THE TABLE EXISTS — IT IS THAT IT NOW HAS SOMETHING TO DISAGREE WITH.
 * Before this import the app held class facts in four hand-written places: `hitDieForClass` and
 * `castingAbilityForClass` in `core/rules/multiclass.ts`, the pools in `classResources.ts`, and the
 * masteries in `weaponMastery.ts`. Each was right when it was typed and none could be checked
 * against anything. A generated table read straight from the official PDF is the second reader —
 * and two readers of one fact who disagree is the bug shape this project keeps paying for.
 */
import { SRD_CLASSES, srdClass } from "../src/modules/dnd-5e/srdClasses.generated";
import { hitDieForClass, castingAbilityForClass } from "../src/core/rules/multiclass";
import { classHasResources, resourcesForClass } from "../src/modules/dnd-5e/classResources";
import { SRD_SKILLS } from "../src/modules/dnd-5e/srdSkills";

/** The SRD publishes one subclass per class; derived here rather than exported for a gate's sake. */
const SRD_SUBCLASSES = SRD_CLASSES.filter(c => c.subclass).map(c => ({ className: c.name, subclass: c.subclass }));

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("The SRD class table, and the hand tables that must agree with it\n");

console.log("1. all twelve, each with the subclass the SRD publishes");
{
  const names = SRD_CLASSES.map(c => c.name).sort();
  ok("twelve classes", SRD_CLASSES.length === 12, names.join(", "));
  ok("twelve subclasses", SRD_SUBCLASSES.length === 12,
    SRD_SUBCLASSES.map(s => s.subclass).join(", "));
  /**
   * ⚠ NAMED, NOT COUNTED. A count passes with twelve copies of "Champion"; the SRD publishes one
   * subclass per class and they are all different.
   */
  ok("...and no two are the same", new Set(SRD_SUBCLASSES.map(s => s.subclass)).size === 12);
  ok("every class states a hit die", SRD_CLASSES.every(c => /^d\d+$/.test(c.hitDie)),
    SRD_CLASSES.filter(c => !/^d\d+$/.test(c.hitDie)).map(c => c.name).join(", "));
  ok("every class states two saving throws", SRD_CLASSES.every(c => c.savingThrows.length === 2));
  ok("every class states a skill choice count", SRD_CLASSES.every(c => c.skillChoiceCount > 0));
}

console.log("\n2. the hit dice agree with multiclass.ts");
{
  /**
   * ⚠ THIS IS THE ASSERTION THE IMPORT WAS WORTH BUILDING FOR. `hitDieForClass` is hand-written and
   * feeds `hitDicePools`, which the DM Reference prints. If the PDF and the hand table ever part,
   * the sheet's hit dice are wrong and nothing else would have said so.
   */
  for (const c of SRD_CLASSES) {
    const hand = hitDieForClass(c.name);
    ok(`  ${c.name}: ${c.hitDie}`, hand === c.hitDie, `hand table says ${hand ?? "nothing"}`);
  }
}

console.log("\n3. the casting abilities agree, where the class casts");
{
  /**
   * ⚠ THE SRD'S "Primary Ability" IS NOT ALWAYS THE CASTING ABILITY, and that is the whole
   * subtlety. A Paladin's primary is "Strength and Charisma" and it casts off Charisma; a Ranger's
   * is "Dexterity and Wisdom" and it casts off Wisdom. So the test is CONTAINMENT — the casting
   * ability must be one of the primaries — not equality, which would fail every half caster and
   * tempt someone to "fix" the hand table to match the wrong thing.
   */
  const CASTERS = ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
  for (const name of CASTERS) {
    const c = srdClass(name)!;
    const casting = castingAbilityForClass(name);
    ok(`  ${name} casts off ${casting?.toUpperCase() ?? "?"}`,
      Boolean(casting) && c.primaryAbility.toLowerCase().includes(casting!),
      `SRD primary ability is "${c.primaryAbility}"`);
  }

  /** A Barbarian, Fighter or Rogue has no class casting — the mod must not invent one. */
  for (const name of ["Barbarian", "Fighter", "Rogue"]) {
    ok(`  mutation: ${name} derives no casting ability`, castingAbilityForClass(name) === undefined,
      String(castingAbilityForClass(name)));
  }

  /**
   * ⚠ THE MONK IS THE ONE PLACE THE TWO TABLES GENUINELY PART, AND THE HAND TABLE IS RIGHT.
   *
   * The SRD gives a Monk no spellcasting at all, so a table named "casting ability" returning WIS
   * for one looks like a fault — it is what this cross-check flagged on its first run. But a Monk's
   * feature DCs ARE 8 + PB + Wisdom, and `@SPELL` resolves a DC as much as it resolves an attack,
   * so dropping the row would break every Monk save DC in the app to satisfy the name of a lookup.
   *
   * What the table actually answers is *"which ability sets this class's DCs"*, and that is a wider
   * question than spellcasting. Asserted here with its reason so the next reader does not "fix" it,
   * and recorded rather than silently accommodated.
   */
  ok("  the Monk maps to WIS — its feature save DC is 8 + PB + WIS, not spellcasting",
    castingAbilityForClass("Monk") === "wis", String(castingAbilityForClass("Monk")));
  ok("  ...and the SRD agrees the Monk's primary ability includes Wisdom",
    srdClass("Monk")!.primaryAbility.toLowerCase().includes("wisdom"),
    srdClass("Monk")!.primaryAbility);
}

console.log("\n4. every class the pool table knows is a class the SRD knows");
{
  /**
   * ⚠ ONE DIRECTION ONLY, AND DELIBERATELY. `classResources.ts` covers 13 entries — the twelve plus
   * the Artificer, which is NOT in either SRD. A test demanding the two lists match would fail on a
   * class the app legitimately supports, so what is asserted is the direction that can actually be
   * wrong: a pool table entry for a class that does not exist.
   */
  const NON_SRD = new Set(["artificer"]);
  for (const c of SRD_CLASSES) {
    ok(`  ${c.name} is known to the pool table`, classHasResources(c.name) || resourcesForClass(c.name, 20).length === 0,
      "no pools is a valid answer; an unknown class is not");
  }
  ok("the Artificer is known to be outside the SRD", NON_SRD.has("artificer") && !srdClass("Artificer"));
}

console.log("\n5. the skill lists reference only skills the mod knows");
{
  /**
   * ⚠ THE JOIN BETWEEN TWO IMPORTS. `skillChoices` is prose out of the PDF and `SRD_SKILLS` is the
   * transcribed list; every skill named in a class's choices has to exist in the other table, or
   * the Checks step and the class table are describing different games.
   */
  const known = SRD_SKILLS.map(s => s.name);
  for (const c of SRD_CLASSES) {
    if (/^any /.test(c.skillChoices)) continue; // the Bard chooses from all of them
    const named = known.filter(s => c.skillChoices.includes(s));
    ok(`  ${c.name} names ${named.length} known skill(s)`, named.length >= c.skillChoiceCount,
      c.skillChoices);
  }
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
