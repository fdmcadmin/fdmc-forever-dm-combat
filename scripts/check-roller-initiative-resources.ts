/**
 * WHO ROLLED IT, ADVANTAGE ON INITIATIVE, AND GETTING A RESOURCE BACK.
 *   npm run check:rollerinit
 *
 * Four things Christopher asked for on 2026-10-25, each of which had a silent hole behind it:
 *
 *   1. *"there is no indicator of which character the dm rolls from or if a player is controlling
 *      multiple characters."* Log entries and dice requests carried `actorName` — WHICH CHARACTER
 *      — and nothing about WHO. Worse, `createEntry` listed the fields it copied one by one, so
 *      every `CombatLogFacts` field a caller passed was dropped on the floor: a 215-entry export
 *      came back with `combatants: []` and `rounds: 0` because the structured half never arrived.
 *
 *   2. *"the monsters turns are now showing combat actions but [should] show character reactions
 *      and damage taken."* HP changes were not logged AT ALL — the card's control went straight to
 *      `setActorHp` — so the most important thing on a monster's turn left no trace. A monster's
 *      turn also ENDED as the anonymous "Monster turn ends." while it had started under its name.
 *
 *   3. *"there needs to be a setting on the character sheet that you can check for advantage on
 *      initiative or a button next to the roll that can be toggled."*
 *
 *   4. *"i need all resources to be able to have a increase or spend … then a long rest doesnt have
 *      to be taken to be able to fix the issue"*, and *"the reroll button should be giving the
 *      resource back if the roll wasnt commited to hit or miss"* — the resource meant being *"not
 *      the reroll resource but the resource that was used to commit the action in the first
 *      place."*
 */
import { readFileSync } from "node:fs";
import type { Actor } from "../src/core/types/actor";
import { initiativeRollFormula, getActorInitiativeAdvantage } from "../src/core/state/initiative";
import { describeRoller } from "../src/core/combat-log/logIdentity";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const read = (p: string) => readFileSync(p, "utf8");

const actor = (tabs: Record<string, unknown[]>): Actor => ({
  id: "init-pc", name: "Init PC", kind: "player", level: 5, className: "Fighter",
  stats: { ac: 16, hp: { max: 40, current: 40 }, speed: "30 ft." },
  abilityScores: { str: { score: 10 }, dex: { score: 16 }, con: { score: 14 }, int: { score: 10 }, wis: { score: 12 }, cha: { score: 8 } },
  tabs: { main: [], resources: [], equipment: [], ...tabs },
} as never);

// ── 3. Advantage on initiative ───────────────────────────────────────────────
console.log("\nAdvantage on initiative");
{
  const plain = actor({});
  ok("a plain sheet rolls one d20", initiativeRollFormula(plain) === "1d20+3", initiativeRollFormula(plain));
  ok("...and reports no standing grant", getActorInitiativeAdvantage(plain) === false);

  // The situational half: the ⚡ toggle beside the tracker's die.
  ok("the per-roll toggle gives advantage", initiativeRollFormula(plain, true) === "2d20kh1+3",
    initiativeRollFormula(plain, true));

  // The standing half: a feature on the sheet that grants it permanently.
  const granted = actor({ features: [{ id: "f1", label: "Vigilant", metadata: { initiativeAdvantage: true } }] });
  ok("a sheet that grants it permanently has it without the toggle",
    initiativeRollFormula(granted) === "2d20kh1+3", initiativeRollFormula(granted));
  ok("...and reports the standing grant", getActorInitiativeAdvantage(granted) === true);

  /**
   * ⚠ IT IS AN OR, NOT AN OVERRIDE. Passing `false` is the ABSENCE of a situational grant, not an
   * instruction to cancel a standing one — a caller that simply never pressed ⚡ must not strip
   * advantage from the character whose feature grants it.
   */
  ok("omitting the toggle cannot cancel a standing grant",
    initiativeRollFormula(granted, false) === "2d20kh1+3", initiativeRollFormula(granted, false));

  // The bonus still applies, and advantage is not confused for one.
  const both = actor({ features: [{ id: "f1", label: "Alert", metadata: { initiativeBonus: 5, initiativeAdvantage: true } }] });
  ok("a bonus and advantage coexist", initiativeRollFormula(both) === "2d20kh1+8", initiativeRollFormula(both));

  // Both entry points exist in the UI, or the rule is unreachable.
  const editor = read("src/core/ui/ActorEditorActionTab.tsx");
  ok("the action editor offers the checkbox", editor.includes("Advantage on Initiative")
    && editor.includes('set("initiativeAdvantage"'));
  const tracker = read("src/core/ui/CombatTracker.tsx");
  ok("the tracker offers the per-roll toggle", tracker.includes("setInitiativeAdvantage"));
  ok("...and passes it to the roll", /onRollInitiative\(combatant\.id, adv\)/.test(tracker));
  /**
   * The local fallback has to honour it too, or turning advantage on would silently do nothing
   * whenever the Dice+ bridge is down — the case a DM is least able to diagnose.
   */
  ok("...and the no-bridge fallback keeps the higher of two",
    /adv \? Math\.max\(d20\(\), d20\(\)\) : d20\(\)/.test(tracker));
  ok("the app's own fallback does too", /rolledWithAdvantage \? Math\.max\(d20\(\), d20\(\)\) : d20\(\)/.test(read("src/App.tsx")));
}

// ── 1. Who rolled it ─────────────────────────────────────────────────────────
console.log("\nRoller attribution");
{
  ok("an unidentified window claims nobody", describeRoller({ role: "unknown" }) === undefined);
  ok("a DM is named as one", describeRoller({ role: "dm", name: "Chris" }) === "Chris — DM");
  ok("a player's seat is what tells two characters apart",
    describeRoller({ role: "player", name: "Sam", seatLabel: "Seat 2" }) === "Sam — player, Seat 2",
    String(describeRoller({ role: "player", name: "Sam", seatLabel: "Seat 2" })));
  // A seat named after the person adds nothing; printing it twice is noise.
  ok("a seat label that repeats the name is not printed twice",
    describeRoller({ role: "player", name: "Sam", seatLabel: "Sam" }) === "Sam — player");

  /**
   * ⚠ THE FACTS WERE BEING DISCARDED. This is the regression that mattered most: the type
   * promised "all optional and purely additive — every existing addEntry call still works", and
   * the sink silently dropped every one of them.
   */
  const hook = read("src/core/combat-log/useCombatLog.ts");
  ok("createEntry spreads the caller's facts instead of listing fields", /\.\.\.facts,/.test(hook));
  ok("...and stamps the roller", hook.includes("rolledByRole: input.rolledByRole ?? roller.role"));
  ok("...from the window's own identity", hook.includes("currentLogRoller"));

  const bridge = read("src/core/integrations/useOwlbearDiceBridge.ts");
  ok("the dice bridge stamps the roller at the sink", bridge.includes("const withRoller"));
  ok("...on both senders", (bridge.match(/withRoller\(rawRequest\)/g) ?? []).length === 2,
    String((bridge.match(/withRoller\(rawRequest\)/g) ?? []).length));
  ok("...and tells the dice mod which character it is for", bridge.includes("characterName: request.actorName"));
  ok("the log renders who rolled", read("src/core/combat-log/CombatLog.tsx").includes("rolled by"));
}

// ── 2. A monster's turn shows what it did ────────────────────────────────────
console.log("\nMonster turns");
{
  const app = read("src/App.tsx");
  ok("HP changes are logged", app.includes("function logActorHpChange"));
  ok("...from the card's own HP control", /onHpChange=\{\(nextHp\) => \{ logActorHpChange\(/.test(app));
  ok("...as damage or healing, not as prose only", app.includes('category: took ? "damage" : "healing"'));
  /**
   * The turn owner is what makes damage read as part of the MONSTER's turn rather than as
   * something the character did on its own.
   */
  ok("...attributed to whose turn it happened on", app.includes("turnOwnerId: owner!.id"));
  ok("a monster's turn ends under its own name", app.includes("allCombatants.find(c => c.id === currentId)")
    && !app.includes('message: "Monster turn ends."'));
}

// ── 4. Resources: both directions, and a refund ──────────────────────────────
console.log("\nResources and the reroll refund");
{
  const counters = read("src/core/state/useResourceCounterState.ts");
  ok("a pool can be given back", counters.includes("const restoreResource"));
  ok("...clamped at its own max", /Math\.min\(max, current \+ give\)/.test(counters));
  /**
   * ⚠ A SPEND THAT CANNOT SAY WHICH ROW IT HIT CANNOT BE UNDONE. Both consumers RESOLVE a row by
   * fuzzy match (a level, a label substring), so a refund that re-ran the guess could land
   * somewhere else.
   */
  ok("every spend reports the row it hit", (counters.match(/resourceId: matchingResource\.id/g) ?? []).length === 2
    && counters.includes("resourceId: resourceActionId"));

  const card = read("src/core/ui/ActorCard.tsx");
  ok("the card offers Give beside Spend", card.includes("Give"));
  /**
   * ⚠ THE KIND LIST SILENTLY EXCLUDED pactSlot — a Warlock's slots, the most spent-and-corrected
   * resource at the table, had neither button. The gate is now simply "does it have a count".
   */
  ok("...on every counted pool, not a hand-picked list of kinds",
    !/kind === "pool" \|\| kind === "counter" \|\| kind === "spellSlot" \|\| kind === "freeCast"/.test(card));

  const consume = read("src/core/state/consumeActionResources.ts");
  ok("a commit reports what it spent", consume.includes("ActionResourceSpend"));
  ok("...for an item's charge", consume.includes('kind: "itemCharge"'));
  ok("...and for a resource row, by id", consume.includes('kind: "resource", resourceId:'));

  const app = read("src/App.tsx");
  ok("the spend is remembered until the roll settles", app.includes("uncommittedSpendRef"));
  ok("...and handed back only when the roll was never committed",
    app.includes('if (!spend || settled === "committed") return;'));
  ok("the card reports both outcomes from one place",
    card.includes('onActionRollSettled?.(rolledAction, outcome === "reroll" ? "rerolled" : "committed")'));
  /**
   * A flip, an advantage die and a bonus die all KEEP the original d20, so the action was used
   * once and its cost stands. Only a true reroll discards the die.
   */
  ok("...and the reroll-source path refunds a real reroll too",
    card.includes('onActionRollSettled?.(rerolledAction, "rerolled")'));
}

// ── The editor must not shove stale equipped state back over a live equip ────
console.log("\nEquipped state");
{
  const editor = read("src/core/ui/ActorEditor.tsx");
  /**
   * ⚠ THE EDITOR WAS THE ONE THAT WAS WRONG. The card renders equipment through
   * `applyEquippedOverlay`; this editor read `actor.tabs` raw, so the moment a player equipped
   * anything in combat the two disagreed. Saving then called `syncOverlayToDocument`, which
   * broadcasts the DOCUMENT's values to every window — so a DM save of ANY field shoved the stale
   * state back over the player's live equip. Christopher: *"it keeps unequiping on save of the
   * library character screen"*, and the same on Ripsnarl.
   */
  ok("the editor's draft reads the worn-state overlay", editor.includes("applyEquippedOverlay(actor.tabs.equipment"));
  ok("...and still re-points the overlay at what it saved", editor.includes("syncOverlayToDocument(edited.id"));
}

console.log(failures === 0
  ? "\nOK — the log says who rolled, initiative can have advantage, and a resource can come back"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
