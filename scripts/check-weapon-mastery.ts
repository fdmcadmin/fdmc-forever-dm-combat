/**
 * WEAPON MASTERY IS A WEAPON CHOICE, NOT A PROPERTY CHOICE.
 *   npm run check:mastery
 *
 * The card used to offer the eight mastery properties — Cleave, Graze, Nick, Push, Sap, Slow,
 * Topple, Vex — and ask the player to choose two. That is backwards, and it loses the only fact
 * that matters. Christopher: *"you have to choose a weapon for that mastery not the type so
 * someone could have vex but it be on a short sword instead of a short bow."*
 *
 * ⚠ THE OLD PICKER COULD NOT BE WRONG, WHICH IS WHY IT LOOKED FINE. It recorded "this character
 * has Vex" — true of eight different weapons — and nothing downstream could act on it, because
 * nothing could tell which weapon it was on. The mark on the swing is the whole deliverable.
 *
 * This gate holds three things:
 *   1. the rule — options come from the BAG, dedupe by FORM, and drop picks that went stale;
 *   2. the derivation — the property is read off BASE_WEAPONS and never chosen;
 *   3. the wiring — the card actually stamps both rows, and the property picker is gone.
 */
import {
  activeMasteryByItemId, masteryCount, masteryCountForClass,
  masteryWeaponOptions, normalizeMasteryWeapons,
} from "../src/core/rules/weaponMastery";
import { BASE_WEAPONS } from "../src/core/constants/baseWeapons";
import { WEAPON_MASTERIES } from "../src/core/constants/weaponMastery";
import { readFileSync } from "node:fs";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** An equipment row as the card holds it: a seeded base weapon attached directly. */
const baseRow = (formId: string, label: string) => ({ id: `equip-${formId}`, label });
/** A chassis item that has had its form chosen — a Gift shaped into a handaxe. */
const chassisRow = (itemId: string, label: string, formId: string) =>
  ({ id: `equip-${itemId}`, label, metadata: { chassis: { formId } } });

const card = readFileSync("src/core/ui/ActorCard.tsx", "utf8");
const button = readFileSync("src/core/ui/ActionButton.tsx", "utf8");
const rules = readFileSync("src/core/rules/weaponMastery.ts", "utf8");

console.log("Weapon Mastery picks a WEAPON\n");

console.log("1. the options come from the bag");
{
  const bag = [baseRow("base-shortsword", "Shortsword"), baseRow("base-shortbow", "Shortbow")];
  const options = masteryWeaponOptions(bag);
  ok("a carried base weapon is pickable", options.length === 2);
  /**
   * ⚠ THE WHOLE POINT, IN ONE ASSERT. Vex is on both a shortsword and a shortbow, so the old
   * property picker recorded a choice that could not distinguish them. Two options, same
   * property, different weapons.
   */
  ok("...and Vex on a shortsword is a different option from Vex on a shortbow",
    options.every(o => o.mastery === "Vex") && new Set(options.map(o => o.formId)).size === 2);

  ok("an empty bag offers nothing", masteryWeaponOptions([]).length === 0);
  /**
   * ⚠ A WONDROUS ITEM IS NOT A WEAPON TYPE. Nothing resolves it to a row in the 2024 table, so
   * there is no property to read and no mastery to have. Offering it would be inventing one.
   */
  ok("a homebrew with no base form is not pickable",
    masteryWeaponOptions([{ id: "equip-shattered-vigil", label: "Shattered Vigil" }]).length === 0);
  ok("an UNFORMED chassis is not pickable",
    masteryWeaponOptions([{ id: "equip-gift", label: "Winter's Mercy", metadata: { chassis: {} } }]).length === 0);
  /** Unarmed Strike is in the table and carries no mastery — it must not become an option. */
  ok("Unarmed Strike is not pickable",
    masteryWeaponOptions([baseRow("base-unarmed-strike", "Unarmed Strike")]).length === 0);

  /**
   * ⚠ A STOWED WEAPON STILL COUNTS. The set is re-chosen on a Long Rest, when nothing is in
   * hand — gating the picker on `equipped` would make it unusable at the moment it is used.
   */
  ok("a stowed weapon is still pickable",
    masteryWeaponOptions([{ id: "equip-base-handaxe", label: "Handaxe", metadata: { equipped: false } as never }]).length === 1);
}

console.log("\n2. the property is DERIVED, never chosen");
{
  const [handaxe] = masteryWeaponOptions([baseRow("base-handaxe", "Handaxe")]);
  ok("a handaxe is Vex because the table says so", handaxe.mastery === "Vex");
  ok("...and it reports the form it read it from", handaxe.formName === "Handaxe");

  /**
   * A chassis item takes its base weapon's mastery, not its own name's. A Thornback Hatchet on
   * a handaxe chassis is Vex because the handaxe is — the 0.7.9.14 ruling, held here too.
   */
  const [hatchet] = masteryWeaponOptions([chassisRow("thornback", "Thornback Hatchet", "base-handaxe")]);
  ok("a chassis item inherits its form's mastery", hatchet?.mastery === "Vex");
  ok("...and names the item AND the form, so the picker is recognisable",
    hatchet?.itemLabels[0] === "Thornback Hatchet" && hatchet?.formName === "Handaxe");

  /** Every option's property has to exist in the one rules table, or the tooltip reads blank. */
  const everyFormed = masteryWeaponOptions(
    BASE_WEAPONS.map(w => baseRow(w.id, w.name)),
  );
  ok("every pickable weapon's property has rules text",
    everyFormed.every(o => Boolean(WEAPON_MASTERIES[o.mastery]?.summary)),
    `${everyFormed.length} weapons`);
}

console.log("\n3. one pick per weapon TYPE, not per item");
{
  /**
   * ⚠ TWO DAGGERS ARE ONE PICK. Mastery in 2024 attaches to a weapon type, so a rogue holding a
   * pair of daggers has Nick on both for one choice. Charging two would silently cost them a
   * mastery they are owed — and Nick is exactly the two-weapon property.
   */
  const pair = [baseRow("base-dagger", "Dagger"), { id: "equip-dagger-2", label: "Dagger", metadata: { chassis: { formId: "base-dagger" } } }];
  const options = masteryWeaponOptions(pair);
  ok("two daggers are ONE option", options.length === 1);
  ok("...carrying both item ids", options[0].itemIds.length === 2);

  const live = activeMasteryByItemId(options, ["base-dagger"]);
  ok("...and one pick lights up BOTH", live.get("base-dagger") === "Nick" && live.get("dagger-2") === "Nick");
  ok("nothing picked lights up nothing", activeMasteryByItemId(options, []).size === 0);
}

console.log("\n4. the picks are capped and cannot go stale");
{
  const bag = [baseRow("base-handaxe", "Handaxe"), baseRow("base-longsword", "Longsword"), baseRow("base-longbow", "Longbow")];
  const options = masteryWeaponOptions(bag);

  ok("a legal pick survives", normalizeMasteryWeapons(["base-handaxe"], options, 2).length === 1);
  ok("the limit is enforced", normalizeMasteryWeapons(["base-handaxe", "base-longsword", "base-longbow"], options, 2).length === 2);
  ok("a duplicate pick is one pick", normalizeMasteryWeapons(["base-handaxe", "base-handaxe"], options, 2).length === 1);
  ok("a limit of zero keeps nothing", normalizeMasteryWeapons(["base-handaxe"], options, 0).length === 0);

  /**
   * ⚠ A PICK NAMING A WEAPON THAT LEFT THE BAG IS DROPPED. The choices live in local storage and
   * a weapon can be sold, given away or stowed into someone else's bag between sessions. Kept, it
   * would mark nothing forever while still spending one of the character's masteries.
   */
  ok("a pick for a weapon no longer carried is dropped",
    normalizeMasteryWeapons(["base-greataxe"], options, 2).length === 0);

  /**
   * ⚠ AND THIS IS WHAT RETIRES THE OLD SAVES. The stored value used to be a PROPERTY name, and
   * there is no honest conversion — Vex is on eight weapons, so choosing one for the player would
   * be inventing their decision. They fall out and the player re-picks once.
   */
  ok("an old PROPERTY save converts to nothing rather than a guess",
    normalizeMasteryWeapons(["Vex", "Graze"], options, 2).length === 0);
  ok("junk is ignored", normalizeMasteryWeapons("not an array", options, 2).length === 0);
}

console.log("\n5. the entitlement still comes from class and level");
{
  ok("a Fighter 1 gets three", masteryCountForClass("fighter", 1) === 3);
  ok("a Fighter 16 gets six", masteryCountForClass("fighter", 16) === 6);
  ok("a Rogue never grows past two", masteryCountForClass("rogue", 20) === 2);
  ok("a Wizard gets none", masteryCountForClass("wizard", 20) === 0);
  ok("a Fighter 4 / Wizard 6 gets the Fighter's four, not a level-10 five",
    masteryCount({ level: 10, classLevels: [{ name: "fighter", level: 4 }, { name: "wizard", level: 6 }] }) === 4);
  /** A non-martial reaches one ONLY through an explicit feat grant, never from a feat's name. */
  ok("a feat grant stacks onto a caster", masteryCount({ className: "wizard", level: 5, featGrants: 1 }) === 1);
}

console.log("\n6. the wiring — the card stamps both rows");
{
  /**
   * ⚠ VERIFY THE WIRING, NOT JUST THE RULE. Correct code that is never reached has shipped here
   * before. The decorator has to be IN the chain that builds the rendered rows, and the badge has
   * to read the field the decorator writes.
   */
  ok("the card has the mark decorator", card.includes("function withMasteryMark"));
  ok("...and it is IN the activeActions chain", /withMasteryMark\(withConvergenceMark\(/.test(card));
  ok("...keyed off BOTH row prefixes, so the equipment entry and the swing both mark",
    /withMasteryMark[\s\S]{0,400}replace\(\/\^equip-\/[\s\S]{0,60}replace\(\/\^atk-\//.test(card));
  ok("...and activeMasteryItems is a dependency, so a new pick re-renders",
    /activeActions = useMemo\([\s\S]{0,2600}activeMasteryItems\]/.test(card));

  ok("the badge renders the active mastery", button.includes("action-label-mastery-flag")
    && button.includes("action.metadata?.masteryActive"));
  ok("...with the property's rules text in its tooltip", button.includes("masteryRulesLine"));

  ok("the resources tab offers WEAPONS", card.includes("chooseMasteryWeapon")
    && card.includes("— choose a weapon —"));
  ok("...and shows the derived property beside each", /chosen \? chosen\.mastery : "/.test(card));
  ok("...and says so plainly when the bag holds no base weapon",
    card.includes("No carried weapon resolves to a 2024 base weapon"));

  /**
   * THE OLD PICKER IS GONE, not left beside the new one. Two mastery controls on one card is
   * worse than the bug — the player cannot tell which one the app believes.
   */
  ok("the eight-property picker is GONE from the card",
    !card.includes("MASTERY_PROPERTIES") && !card.includes("toggleMastery"));
  ok("...and its exports are gone from the rules module",
    !/export const MASTERY_PROPERTIES/.test(rules) && !/export function normalizeMasteryChoices/.test(rules));
  /**
   * ⚠ AND NO SECOND BLURB TABLE. `MASTERY_BLURB` duplicated `WEAPON_MASTERIES` — two tables
   * saying what Vex does, which is the shape RULE 0 exists to stop.
   */
  ok("there is ONE table of mastery rules text", !/MASTERY_BLURB/.test(rules)
    && card.includes("WEAPON_MASTERIES"));
}

console.log(failures === 0
  ? "\nOK — the choice is a weapon, the property is derived, and the swing is marked"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
