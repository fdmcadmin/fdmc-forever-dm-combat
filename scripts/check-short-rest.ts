/**
 * A SHORT REST IS THIS PARTY'S OWN HIT DICE, AND A MULTICLASS SHEET IS STILL THIS PARTY.
 *   npm run check:shortrest
 *
 * The v8 runtime contract states the rule this enforces:
 *   *"Actor-specific Short Rest: spend each actor's own Hit Dice as needed, then recover only
 *   authored Short-Rest resources."*  (`runtimeExecutionContract.shortRest`)
 *
 * Two faults, reported together on 2026-09-07 as *"it says that the per class recovery isnt
 * there"*:
 *
 *   1. `shortRestRecoveryFromActors` rejected an actor whose `className` was not in the registry —
 *      checking the DISPLAY string BEFORE `hitDicePools` ever read the structured `classes` array.
 *      A multiclass PC reads "Paladin  / Sorcerer" there, which is in no registry, so every one of
 *      their Hit Dice vanished from the party's recovery.
 *   2. The Act Run control printed `run.shortRestRecovery ?? SHORT_REST_RECOVERY` — the override or
 *      the published median — and never the party-resolved figure the simulation had been using
 *      since 0.8.25.0. The number was there; the control was showing a different one.
 *
 * ⚠ THE ASSERTIONS ARE ABOUT THE FRACTION THAT COMES OUT, not about a field being present. A pool
 * that resolves and then contributes nothing is the same bug wearing a different shape.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { shortRestRecoveryFromActors } from "../src/modules/dnd-5e/shortRestRecovery";
import { SHORT_REST_RECOVERY } from "../src/core/encounter-band/partyResourceCurve";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const con = (score: number) => ({ abilityScores: { con: { score } } });

/** A multiclass sheet: the label is a heading, the `classes` array is the machine truth. */
const multi = {
  name: "Multi", level: 7, className: "Paladin  / Sorcerer",
  classes: [
    { name: "Paladin", level: 5, hitDie: "d10" },
    { name: "Sorcerer", level: 2, hitDie: "d6" },
  ],
  ...con(14),
};
const single = { name: "Single", level: 7, className: "Barbarian", classes: null, ...con(14) };
const companion = { name: "Beast", level: 7, className: undefined, classes: null, ...con(14) };

const SUSTAIN = 708.5;

console.log("A short rest is resolved from the party's own Hit Dice\n");

console.log("A multiclass sheet is read from its class rows, not its label");
{
  const r: any = shortRestRecoveryFromActors([multi] as never, SUSTAIN);
  ok("the multiclass actor resolves at all", Boolean(r) && r.perActor.length === 1,
    r ? `${r.perActor.length} resolved, ${r.unresolved.length} unresolved` : "null");
  const row = r?.perActor?.[0];
  ok("...with BOTH pools", String(row?.pools ?? "").includes("d10") && String(row?.pools ?? "").includes("d6"),
    String(row?.pools));
  ok("...summing every level as a die", row?.dice === 7, `${row?.dice} dice for a level 7 character`);
  ok("...and buying back a non-zero share", r.fraction > 0, `${(r.fraction * 100).toFixed(1)}%`);

  /**
   * ⚠ THE BUG, REPRODUCED FROM THE OTHER SIDE. A label that is not in the registry must not be
   * able to discard rows that are — but a sheet with NO structured rows and an unknown label is
   * still correctly unresolved, or the gate would pass on a check that never runs.
   */
  const nonsense = { name: "Nonsense", level: 7, className: "Cheesemonger", classes: null, ...con(14) };
  const r2: any = shortRestRecoveryFromActors([nonsense] as never, SUSTAIN);
  ok("an unknown class with no class rows is still reported, not counted",
    r2 === null || (r2.perActor.length === 0 && r2.unresolved.length === 1),
    r2 ? r2.unresolved[0]?.reason : "null");
}

console.log("\nThe party's fraction is the party's, not the published median");
{
  const party: any = shortRestRecoveryFromActors([multi, single] as never, SUSTAIN);
  ok("a two-PC party resolves both", party.perActor.length === 2);
  const alone: any = shortRestRecoveryFromActors([single] as never, SUSTAIN);
  ok("dropping the multiclass PC lowers the fraction — their dice were counted",
    party.fraction > alone.fraction,
    `${(party.fraction * 100).toFixed(1)}% with, ${(alone.fraction * 100).toFixed(1)}% without`);
  ok("...and the answer is not the published median",
    Math.abs(party.fraction - SHORT_REST_RECOVERY) > 0.001,
    `${(party.fraction * 100).toFixed(1)}% vs median ${(SHORT_REST_RECOVERY * 100).toFixed(1)}%`);
}

console.log("\nA companion has no Hit Dice of its own and is reported, never guessed");
{
  const r: any = shortRestRecoveryFromActors([single, companion] as never, SUSTAIN);
  ok("the companion is reported as unresolved", r.unresolved.some((u: any) => u.actor === "Beast"),
    r.unresolved.map((u: any) => u.actor).join(", "));
  const solo: any = shortRestRecoveryFromActors([single] as never, SUSTAIN);
  ok("...and contributes nothing to the fraction", Math.abs(r.fraction - solo.fraction) < 1e-9,
    `${(r.fraction * 100).toFixed(2)}% either way`);
}

console.log("\nAn empty party is a question, not a zero");
{
  ok("no actors returns null so the caller falls back and says so",
    shortRestRecoveryFromActors([] as never, SUSTAIN) === null);
  ok("no sustain returns null too",
    shortRestRecoveryFromActors([single] as never, 0) === null);
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
