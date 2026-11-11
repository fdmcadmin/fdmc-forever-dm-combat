/**
 * THE LAIR TAKES A TURN — initiative 20, losing ties, one option a round.
 *   npm run check:lair
 *
 * ⚠ IT WAS AUTHORED, PRICED, AND UNPLAYABLE.
 *
 * Christopher, 2026-11-10: *"we need to make sure the lair for the dragon fight is working as
 * intended or there is a entry for it that locks it at initiative 20 with the built-in effects
 * from the encounter sheet."* It was not working. The Veil-Torn Dragon has carried a complete
 * `lair` since lair support landed — `initiative: 20`, `noRepeatConsecutive`, three options with
 * their saves and printed text — and `encounter-band/lairRoster.ts` has been pricing it for the
 * checker all along. The TRACKER had no row: nothing acted on 20, and `legalLairOptions` (the
 * no-repeat rule, written for precisely this) had no caller anywhere in the app. The library note
 * still read "not yet playable from the tracker", years after the summon mechanism it was waiting
 * on shipped.
 *
 * This gate holds the three things that make the row correct rather than merely present: the lair
 * is one row per PLACE, it loses ties, and it cannot repeat an option.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lairRowsFor, lairRowId, isLairRowId } from "../src/core/monsters/lairCombatants";
import { legalLairOptions, type LairSpec } from "../src/core/monsters/lair";
import { sortCombatants, type Combatant } from "../src/core/ui/CombatTracker";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const lair: LairSpec = {
  initiative: 20,
  noRepeatConsecutive: true,
  options: [
    { name: "Ground Remembers Wrong", effect: "forced_movement", save: "STR DC 17", text: "…" },
    { name: "Branches Close", effect: "obscure", text: "…" },
    { name: "Borrowed Sky", effect: "forced_movement", save: "STR DC 17", text: "…" },
  ],
};

const body = (instanceId: string, templateId: string, extra: Record<string, unknown> = {}) =>
  ({ instanceId, templateId, name: "Veil-Torn Dragon", revealedName: "Veil-Torn Dragon", ...extra }) as never;

console.log("\nThe dragon's lair is authored");
{
  // The fixture above is a stand-in; THIS is the real thing the table will field.
  const dragon = BROKEN_CHAIN_MONSTER_LIBRARY.find(m => /veil-torn dragon/i.test(m.name));
  assert(dragon, "the Veil-Torn Dragon must exist in the campaign library");
  ok("the dragon carries a lair", Boolean(dragon.lair));
  ok("...locked to initiative 20", dragon.lair?.initiative === 20, String(dragon.lair?.initiative));
  ok("...that cannot repeat an option", dragon.lair?.noRepeatConsecutive === true);
  ok("...with the three options from the encounter sheet", (dragon.lair?.options.length ?? 0) === 3,
    (dragon.lair?.options ?? []).map(o => o.name).join(" / "));
  // Every option carries the text the DM reads out; a row that names an option it cannot quote
  // is worse than no row.
  ok("...each with its printed text", (dragon.lair?.options ?? []).every(o => o.text.trim().length > 0));
}

console.log("\nOne row per lair, and it leaves with its creature");
{
  const rows = lairRowsFor([body("d1", "veil-torn-dragon", { lair })]);
  ok("a lair-carrying creature produces a row", rows.length === 1);
  ok("...locked at the spec's count", rows[0]?.initiative === 20, String(rows[0]?.initiative));
  ok("...with an id that is not a creature's", isLairRowId(rows[0]?.id ?? "") && rows[0]?.id === lairRowId("veil-torn-dragon"));
  ok("...named after the creature", rows[0]?.name === "Veil-Torn Dragon's Lair", rows[0]?.name);

  /**
   * ⚠ A LAIR BELONGS TO THE PLACE. Two bodies of one template is still one clearing, and a row
   * each would hand the DM two initiative-20 turns for one environment.
   */
  const twoBodies = lairRowsFor([body("d1", "veil-torn-dragon", { lair }), body("d2", "veil-torn-dragon", { lair })]);
  ok("two bodies of one creature are still ONE lair", twoBodies.length === 1, String(twoBodies.length));

  // A creature with no lair contributes nothing — most of the bestiary.
  ok("a creature with no lair produces no row", lairRowsFor([body("g1", "gloam-harrow")]).length === 0);

  // The ground stops arguing once its creature is down.
  const allDown = lairRowsFor([body("d1", "veil-torn-dragon", { lair })], () => true);
  ok("a lair whose creature is down does not act", allDown.length === 0);
  const oneUp = lairRowsFor(
    [body("d1", "veil-torn-dragon", { lair }), body("d2", "veil-torn-dragon", { lair })],
    id => id === "d1",
  );
  ok("...but one body still standing keeps it", oneUp.length === 1);
}

console.log("\nIt loses ties");
{
  const row = (id: string, kind: Combatant["kind"], initiative: number): Combatant => ({
    id, name: id, kind, initiative, initiativeBonus: 0,
    hp: { current: 1, max: 1 }, isActive: false, isDead: false,
  });
  /**
   * ⚠ EVERY CAMPAIGN LAIR PRINTS "losing ties". Sorting on the number alone left a PC who rolled
   * 20 and the lair in whatever order the roster happened to build them — the one ordering the
   * sheet explicitly rules out.
   */
  const sorted = sortCombatants([row("lair:x", "lair", 20), row("pc", "actor", 20), row("boss", "monster", 22)]);
  ok("a higher count still goes first", sorted[0]?.id === "boss", sorted.map(c => c.id).join(" > "));
  ok("a PC tied at 20 acts BEFORE the lair", sorted[1]?.id === "pc" && sorted[2]?.id === "lair:x",
    sorted.map(c => c.id).join(" > "));
  // And the rule must not fire when the counts differ.
  const below = sortCombatants([row("lair:x", "lair", 20), row("pc", "actor", 12)]);
  ok("...and losing ties never demotes it below a LOWER count", below[0]?.id === "lair:x",
    below.map(c => c.id).join(" > "));
}

console.log("\nOne option a round, and never twice running");
{
  ok("every option is on the table with nothing fired yet", legalLairOptions(lair, undefined).length === 3);
  const after = legalLairOptions(lair, "Branches Close");
  ok("last round's option is off the table", !after.some(o => o.name === "Branches Close"),
    after.map(o => o.name).join(" / "));
  ok("...and the rest remain", after.length === 2);

  // A one-option lair cannot alternate with anything, and the rule must not silence it.
  const single: LairSpec = { options: [lair.options[0]], noRepeatConsecutive: true };
  ok("a one-option lair is never silenced by the rule",
    legalLairOptions(single, lair.options[0].name).length === 1);
}

console.log("\nThe row is wired, not just built");
{
  const tracker = readFileSync("src/core/ui/CombatTracker.tsx", "utf8");
  const app = readFileSync("src/App.tsx", "utf8");
  ok("the tracker offers the options on the lair's turn", tracker.includes("legalLairOptions("));
  ok("...and remembers which fired, for the no-repeat rule", tracker.includes("setLastLairOption"));
  ok("...with no HP cell, because a lair has no body", tracker.includes('combatant.kind !== "lair" && <div'));
  ok("...and no rollable initiative", tracker.includes('combatant.kind === "lair" ? ('));
  ok("the app logs the option that fired", app.includes("onLairAction={"));
  /**
   * ⚠ A LAIR IS NOT A MONSTER. The turn-advance branch was an `else` that assumed it was, which
   * would reset an economy keyed to an instance id no creature owns.
   */
  ok("the turn advance treats it as neither actor nor monster", app.includes('} else if (nextCombatant.kind === "lair") {'));
  ok("and its count is locked against every write path", app.includes("if (isLairRowId(combatantId)) return;"));
}

console.log(failures === 0
  ? "\nOK — the lair acts on 20, loses ties, and cannot repeat itself"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
