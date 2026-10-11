/**
 * THE MODE DECIDES WHAT IS ASKED — NOT WHAT IS POSSIBLE.
 *   npm run check:actioncaps
 *
 * Christopher, 2026-10-11: *"the current builder has too much options for both new DMs and
 * players who are not used to working with it."* The design note it arrived with names the fault
 * exactly: the app *"asks players to understand its entire mechanical system before they've even
 * described what their ability does."*
 *
 * ⚠ THE FAILURE MODE THIS GATE EXISTS TO CATCH IS OVER-CORRECTION. It is easy to make a form
 * tidy by deleting capability, and that is explicitly NOT what was asked for: *"We're simplifying
 * creation, not reducing what the app can do."* So most of what follows checks that things are
 * still REACHABLE and still SAVED — that hidden means folded, not gone, and that a value a mode
 * ignores is kept and named rather than destroyed or buried.
 */
import {
  ACTION_CAPABILITIES, ALL_ACTION_CAPABILITIES, MODE_AGNOSTIC_FIELDS, advancedSummaryText,
  actionModeAllows, capabilityLabel, strandedCapabilities,
  type ActionCapability,
} from "../src/core/constants/actionCapabilities";
import type { PcRollMode } from "../src/core/ui/pcActionTypes";
import { readFileSync } from "node:fs";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const actionTab = readFileSync("src/core/ui/ActorEditorActionTab.tsx", "utf8");
const spellTab = readFileSync("src/core/ui/SpellTableEditor.tsx", "utf8");

console.log("The mode decides what is asked\n");

console.log("1. every mode is answered, and none over-answers");
{
  const modes: PcRollMode[] = ["attack", "save", "check", "damageOnly", "healing", "triggered", "additive", "utility", "passive", "reference"];
  ok("every PcRollMode has a row", modes.every(m => ACTION_CAPABILITIES[m] !== undefined));
  /**
   * ⚠ A MODE WITH NO ROW WOULD EMPTY THE WHOLE FORM. `actionModeAllows` returns false for
   * everything it does not find, so a missing key does not throw — it silently hides every
   * field and the author is left with a name box.
   */
  ok("an unknown mode hides everything rather than throwing",
    !actionModeAllows("nonsense" as PcRollMode, "damageFormula"));
  ok("an undefined mode is handled", !actionModeAllows(undefined, "damageFormula"));
}

console.log("\n2. the cases from the report");
{
  /**
   * ⚠ CURE WOUNDS IS THE WHOLE BRIEF: *"A player creating Cure Wounds shouldn't have to navigate
   * attack formulas, damage dice, saving throw abilities, weapon buffs, reroll settings, or
   * critical-hit behavior."*
   */
  ok("healing asks for NO attack formula", !actionModeAllows("healing", "attackFormula"));
  ok("healing asks for NO save DC", !actionModeAllows("healing", "saveDc"));
  ok("healing asks for NO crit", !actionModeAllows("healing", "critDamage"));
  /** Nothing is being typed, so there is no damage type to pick. */
  ok("healing asks for NO damage type", !actionModeAllows("healing", "damageType"));
  ok("healing DOES ask for healing dice", actionModeAllows("healing", "healingFormula"));
  ok("...and a range", actionModeAllows("healing", "range"));

  ok("an attack asks for its to-hit, dice, type and crit",
    ["attackFormula", "damageFormula", "damageType", "critDamage"].every(c => actionModeAllows("attack", c as ActionCapability)));
  /** Only a save can "save-end" — there is no save for the target to repeat otherwise. */
  ok("only a save offers ongoing damage",
    actionModeAllows("save", "ongoingDamage")
    && !actionModeAllows("attack", "ongoingDamage")
    && !actionModeAllows("healing", "ongoingDamage"));
  /** An additive rides a later roll, so it has no delivery of its own. */
  ok("an additive has no range", !actionModeAllows("additive", "range"));
  ok("a passive rolls nothing at all", (ACTION_CAPABILITIES.passive ?? []).length === 0);
}

console.log("\n3. the shared boxes stay honest");
{
  /**
   * ⚠ ONE FIELD, TWO QUESTIONS. Healing and damage are stored in the same draft key, and the
   * form asked "Damage Formula" of everyone — which is how it taught a player writing Cure
   * Wounds that the app had nothing for them.
   */
  ok("healing dice are LABELLED healing", capabilityLabel("healingFormula") === "Healing Amount");
  ok("damage dice are labelled damage", capabilityLabel("damageFormula") === "Damage Formula");
  ok("every capability has a label", ALL_ACTION_CAPABILITIES.every(c => capabilityLabel(c).length > 0));

  ok("the action editor relabels the shared box", /capabilityLabel\(isHealingDice \? "healingFormula" : "damageFormula"\)/.test(actionTab));
  ok("...and so does the spell editor", /capabilityLabel\(row\.outcomeMode === "healing" \? "healingFormula" : "damageFormula"\)/.test(spellTab));
}

console.log("\n4. a value the mode ignores is KEPT, and named");
{
  /**
   * ⚠ NOT DELETED. A mode switched by accident, or while someone is still working out what they
   * are building, must not destroy typed work. Christopher chose "keep, and warn".
   */
  const switched = { rollMode: "healing" as PcRollMode, damage: "2d8+@WIS", attackBonus: "1d20+@STR", critDamage: "4d6" };
  const stranded = strandedCapabilities(switched);
  ok("an attack formula left on a healing action is reported",
    stranded.includes("attackFormula"), stranded.map(capabilityLabel).join(", "));
  ok("...and so is the crit", stranded.includes("critDamage"));
  /** The dice are the SAME dice — a healing roll must not report its own healing as stranded. */
  ok("the shared dice box is NOT reported", !stranded.includes("damageFormula") && !stranded.includes("healingFormula"));

  ok("a clean healing action reports nothing",
    strandedCapabilities({ rollMode: "healing", damage: "2d8+@WIS", range: "Touch" }).length === 0);
  ok("a clean attack reports nothing",
    strandedCapabilities({ rollMode: "attack", attackBonus: "1d20+@STR", damage: "1d8", damageType: "slashing", critDamage: "2d8" }).length === 0);
  /** attackBonus is the d20 box for BOTH attack and check, so neither strands the other. */
  ok("a check does not strand the attack box",
    !strandedCapabilities({ rollMode: "check", attackBonus: "1d20+@WIS" }).includes("attackFormula"));
  ok("an empty draft reports nothing", strandedCapabilities({ rollMode: "attack" }).length === 0);

  /**
   * ⚠ ONE BOX IS COUNTED ONCE. Two capabilities can share a draft field, and when neither is
   * live both matched — so the warning named "Attack Roll, Check Formula" for a single input,
   * and told the author to go and look at two fields that do not exist separately.
   */
  ok("the shared d20 box is named ONCE",
    !strandedCapabilities(switched).includes("checkFormula"),
    strandedCapabilities(switched).map(capabilityLabel).join(", "));
  ok("...and so is the shared dice box",
    strandedCapabilities({ rollMode: "utility", damage: "2d6" })
      .filter(c => c === "damageFormula" || c === "healingFormula").length === 1);
}

console.log("\n5. nothing was REMOVED — hidden means folded");
{
  /**
   * ⚠ THE OVER-CORRECTION CHECK. Simplifying by deletion would be the wrong fix, and it is the
   * easy one to reach for. Every advanced control must still be present in the file and still
   * writing to its own draft field.
   */
  for (const field of ["armedAttackFormula", "weaponBuffDamage", "turnRider", "isRerollSource", "combatStyleAttack"]) {
    ok(`${field} is still authorable`, actionTab.includes(field));
  }
  ok("they are folded into an Advanced section", /<details open=\{hasAdvancedValues\}>/.test(actionTab)
    && actionTab.includes("ADVANCED — everything the chosen mode does not ask for"));
  /**
   * ⚠ AND IT OPENS WHEN IT IS DOING WORK. A collapsed section on an existing action would show
   * the author LESS than the card does — the editor disagreeing with the sheet.
   */
  ok("...which opens itself when any of it is set", /const hasAdvancedValues = Boolean\(/.test(actionTab));
  ok("mode-agnostic fields are an explicit list, not leftovers",
    MODE_AGNOSTIC_FIELDS.length > 0 && MODE_AGNOSTIC_FIELDS.includes("turnRider"));
  /**
   * ⚠ THE SUMMARY IS BUILT FROM THE LIST. A hand-typed one is a second copy that drifts the
   * first time a field is added, leaving a disclosure that promises five things and holds six.
   */
  ok("...and they BUILD the Advanced summary rather than being described beside it",
    actionTab.includes("advancedSummaryText()") && advancedSummaryText().includes("weapon buff"));
  /**
   * ⚠ A FEAT WITH AN ATTACK CAN STILL GRANT +1 AC. passiveBonuses is governed by the tab, not by
   * the outcome mode — listing it per-mode reported a perfectly good Dual Wielder as stranded.
   */
  ok("AC / initiative are NOT mode-gated", !ALL_ACTION_CAPABILITIES.includes("passiveBonuses" as ActionCapability)
    && MODE_AGNOSTIC_FIELDS.includes("passiveBonuses"));
}

console.log("\n6. the wiring — both editors read the ONE table");
{
  ok("the action editor reads it", actionTab.includes("actionModeAllows")
    && /const allows = \(c: ActionCapability\) => actionModeAllows\(draft\.rollMode, c\)/.test(actionTab));
  ok("...and its four hand-written booleans are gone",
    !/const showAttackFields = draft\.rollMode === "attack";/.test(actionTab));
  ok("the spell editor reads the SAME table", spellTab.includes("actionModeAllows")
    && /function spellAllows/.test(spellTab));
  /**
   * The spell editor never asked what a spell DOES — every spell in the game was authored
   * against the full combat vocabulary at once.
   */
  ok("a spell now carries an outcome mode", /outcomeMode: PcRollMode;/.test(spellTab));
  ok("...derived from STATED FIELDS for spells that predate it",
    /function deriveSpellMode/.test(spellTab) && spellTab.includes("NEVER FROM THE NAME"));
  ok("the stranded warning is rendered, with a one-click clear",
    actionTab.includes("a value this mode ignores") && /function clearStranded/.test(actionTab));
}

console.log(failures === 0
  ? "\nOK — the mode decides what is asked, and nothing was taken away"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
