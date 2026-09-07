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

/* ── RECOVERY COVERS THE POOLS, NOT JUST THE DICE ────────────────────────────────────────── */
console.log("\nA short rest returns hit points AND everything that refreshes");
{
  /**
   * Christopher, 2026-09-07: *"the baseline recovery for X class … should cover everything from
   * health to charges on items."* The Short Rest Rules sheet says the same thing first: *"The
   * external party runtime applies these rules to live state; the workbook does not … substitute a
   * generic 25% recovery."*
   *
   * ⚠ TWO NUMBERS, NOT ONE AVERAGED. Hit Dice move the sustain clock and refreshed pools move the
   * damage one, and the whole point is that a party can be strong on one and empty on the other.
   */
  const pool = (id: string, label: string, kind: string, additive: number, regain?: number | "all") => ({
    id, label, actionKind: "resource", economyCost: [], logMode: "silent",
    metadata: { resourceKind: kind, additive: String(additive), ...(regain !== undefined ? { shortRestRegain: regain } : {}) },
  });

  /** A Warlock: their whole Pact suite back, on a sheet whose Hit Dice buy very little. */
  const warlock = {
    name: "Pact", kind: "player", className: "Warlock", level: 5,
    abilityScores: { con: { score: 10 } },
    stats: { ac: 14, hp: { current: 30, max: 30 }, speed: "30 ft." },
    tabs: { resources: [pool("pact", "Pact Magic L3", "spellSlot", 2, "all")] },
  } as never;
  const w = shortRestRecoveryFromActors([warlock], 400)!;
  ok("a Warlock's pact slots come back in full", Math.abs(w.resourceFraction - 0.5) < 1e-9,
    `${(w.resourceFraction * 100).toFixed(0)}% of the day's supply`);
  ok("...counted as uses, not guessed", w.resourcesBack === 2 && w.resourcesPerDay === 4,
    `${w.resourcesBack} of ${w.resourcesPerDay}`);
  ok("...and named, so the figure is answerable", w.resources[0]?.resource === "Pact Magic L3",
    w.resources.map(r => r.resource).join(", "));

  /** ⚠ "CHARGES ON ITEMS" — an item pool that resets on a short rest is part of this. */
  const withItem = {
    ...(warlock as unknown as Record<string, unknown>),
    tabs: {
      resources: [pool("pact", "Pact Magic L3", "spellSlot", 2, "all")],
      equipment: [{
        id: "atk-wand", label: "Wand of Sparks", actionKind: "attack", economyCost: ["main"], logMode: "default",
        metadata: { damage: "2d6", attack: "1d20+5", charges: { max: 3, reset: "shortRest" } },
      }],
    },
  } as never;
  const wi = shortRestRecoveryFromActors([withItem], 400)!;
  ok("an item's short-rest charges are counted too", wi.resourcesBack === 5,
    `${wi.resourcesBack} uses back`);
  ok("...and the item pool is named", wi.resources.some(r => r.resource === "Wand of Sparks"),
    wi.resources.map(r => r.resource).join(", "));

  /** ⚠ A POOL THAT RETURNS NOTHING STILL COUNTS IN THE DENOMINATOR — a share of nothing is a lie. */
  const wizard = {
    name: "Slots", kind: "player", className: "Wizard", level: 5,
    abilityScores: { con: { score: 10 } },
    stats: { ac: 12, hp: { current: 28, max: 28 }, speed: "30 ft." },
    tabs: { resources: [pool("s1", "Spell Slots L1", "spellSlot", 4)] },
  } as never;
  const wz = shortRestRecoveryFromActors([wizard], 400)!;
  ok("a party whose pools do not refresh recovers no resources", wz.resourceFraction === 0);
  ok("...but its pools still count as the day's supply", wz.resourcesPerDay === 4,
    `${wz.resourcesPerDay} uses in the day`);

  /** ⚠ MUTATION: take the short-rest regain away and the recovery must fall to zero. */
  const noRegain = {
    ...(warlock as unknown as Record<string, unknown>),
    tabs: { resources: [pool("pact", "Pact Magic L3", "spellSlot", 2)] },
  } as never;
  ok("mutation: without a short-rest regain the pool returns nothing",
    shortRestRecoveryFromActors([noRegain], 400)!.resourceFraction === 0);

  /** The two halves are genuinely different numbers, which is the reason there are two. */
  ok("the hit-point half is its own figure and is not the resource one",
    Math.abs(w.fraction - w.resourceFraction) > 1e-9,
    `HP ${(w.fraction * 100).toFixed(1)}% vs resources ${(w.resourceFraction * 100).toFixed(0)}%`);
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
