/**
 * THE REACTION IS A SHARED BUDGET — one per turn, and the others wait for the refresh.
 *
 * Run: npm run check:reaction-budget
 *
 * ⚠ THIS IS THE RUNTIME HALF. `check:reactions` audits AUTHORING — that a row whose text says
 * "use your Reaction" is tagged to cost one. It says nothing about what happens when a body owns
 * three of them, which is where the trace was wrong:
 *
 *     for (const b of otherChannels) { ... note: "Own budget — does not consume the Action." }
 *
 * Every non-action feature was scheduled every round. That note is true of the ACTION and false of
 * everything it was applied to — a creature carrying Shield, Counterspell and an opportunity attack
 * fired all three and the trace summed damage from a body that legally had one Reaction to spend.
 *
 * Christopher, 2026-09-02: *"Do not sum the expected value of every possible Reaction in the same
 * round. Once one is used, the others are unavailable until refresh."*
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { traceCreature } from "../src/core/encounter-band/actionTrace";
import type { ParsedCreature } from "../src/core/encounter-band/parseCreature";
import type { ParsedFeature } from "../src/core/encounter-band/featureResolver";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const TARGET = { ac: 16, saveBonus: 2, partySize: 4 };

const feat = (
  name: string,
  activationType: ParsedFeature["activationType"],
  damage: string,
  extra: Partial<ParsedFeature> = {},
): ParsedFeature => ({ name, activationType, damage, attackBonus: 7, ...extra });

const creature = (features: ParsedFeature[]): ParsedCreature => ({
  name: "Fixture", ac: 15, maxHp: 100, attacksPerTurn: 1, features, assumptions: [],
});

const round1 = (c: ParsedCreature) => traceCreature(c, TARGET, 4).rounds[0];
const scheduledOn = (c: ParsedCreature, channel: string) =>
  round1(c).scheduled.filter(s => s.channel === channel && s.expectedDamage > 0);

console.log("The Reaction budget — one per turn, shared by everything that costs one\n");

/* ── The defect this file exists for ─────────────────────────────────────────────────────── */
console.log("Three reactions, one Reaction");
{
  const c = creature([
    feat("Routine Swing", "action", "1d8+4"),
    feat("Shield Bash", "reaction", "2d6"),
    feat("Riposte", "reaction", "3d6"),
    feat("Opportunity Attack", "reaction", "1d10"),
  ]);
  const fired = scheduledOn(c, "reaction");
  ok("exactly ONE reaction resolves in a round", fired.length === 1,
    fired.map(f => f.feature).join(", ") || "none");
  ok("...and it is the STRONGEST one — expected value picks the slot",
    fired[0]?.feature === "Riposte", fired[0]?.feature ?? "none");

  /**
   * ⚠ THE LOSERS ARE REPORTED, NOT DROPPED. A Counterspell that never resolved because Shield
   * took the Reaction is a real tactical fact; omitting it silently looks the same as the
   * feature having been forgotten in authoring.
   */
  const shown = round1(c).scheduled.filter(s => s.channel === "reaction");
  ok("the ones that lost the slot are still listed, at zero", shown.length === 3,
    shown.map(s => `${s.feature}=${s.expectedDamage.toFixed(1)}`).join(" · "));
  ok("...and they say WHY they did not resolve",
    shown.filter(s => s.expectedDamage === 0).every(s => /already spent/i.test(s.note ?? "")));
}

/* ── The same rule for the Bonus Action ──────────────────────────────────────────────────── */
console.log("\nA turn has one Bonus Action too");
{
  const c = creature([
    feat("Routine Swing", "action", "1d8+4"),
    feat("Quick Jab", "bonus_action", "1d6"),
    feat("Flame Lash", "bonus_action", "4d6"),
  ]);
  const fired = scheduledOn(c, "bonus_action");
  ok("exactly ONE bonus action resolves", fired.length === 1, fired.map(f => f.feature).join(", "));
  ok("...and it is the stronger", fired[0]?.feature === "Flame Lash", fired[0]?.feature ?? "none");
}

/* ── What is NOT capped, and why ─────────────────────────────────────────────────────────── */
console.log("\nLegendary and lair actions are their OWN budgets, not this one");
{
  const c = creature([
    feat("Routine Swing", "action", "1d8+4"),
    feat("Legendary Strike", "legendary_action", "2d6", { uses: 3 }),
    feat("Legendary Move", "legendary_action", "1d6", { uses: 3 }),
    feat("Lair Pulse", "lair_action", "3d6"),
  ]);
  ok("both legendary actions still resolve — they spend a separate authored pool",
    scheduledOn(c, "legendary_action").length === 2);
  ok("the lair action resolves on its own initiative count",
    scheduledOn(c, "lair_action").length === 1);
}

/* ── The budget REFRESHES ────────────────────────────────────────────────────────────────── */
console.log("\nThe budget refreshes at the start of the actor's next turn");
{
  const c = creature([
    feat("Routine Swing", "action", "1d8+4"),
    feat("Riposte", "reaction", "3d6"),
    feat("Shield Bash", "reaction", "2d6"),
  ]);
  const t = traceCreature(c, TARGET, 4);
  const perRound = t.rounds.map(r => r.scheduled.filter(s => s.channel === "reaction" && s.expectedDamage > 0).length);
  ok("one reaction resolves in EVERY round, not one across the fight",
    perRound.every(n => n === 1), perRound.join(","));
  ok("...and it is the same best option each round — the budget refreshed, it did not run out",
    t.rounds.every(r => r.scheduled.some(s => s.channel === "reaction" && s.feature === "Riposte" && s.expectedDamage > 0)));
}

/* ── A limited-use reaction still runs out ───────────────────────────────────────────────── */
console.log("\nA reaction with printed uses is bounded by BOTH limits");
{
  const c = creature([
    feat("Routine Swing", "action", "1d8+4"),
    feat("One Shot Ward", "reaction", "6d6", { uses: 1 }),
    feat("Riposte", "reaction", "2d6"),
  ]);
  const t = traceCreature(c, TARGET, 3);
  const names = t.rounds.map(r =>
    r.scheduled.filter(s => s.channel === "reaction" && s.expectedDamage > 0).map(s => s.feature).join("+"));
  ok("the 1/day reaction takes round 1", names[0] === "One Shot Ward", names[0]);
  ok("...and once spent, the NEXT-best reaction takes the slot after that",
    names[1] === "Riposte" && names[2] === "Riposte", names.join(" | "));
  ok("never two in one round at any point", t.rounds.every(r =>
    r.scheduled.filter(s => s.channel === "reaction" && s.expectedDamage > 0).length === 1));
}

/* ── ⚠ THE SUM IS GONE: the whole point, stated as damage ────────────────────────────────── */
console.log("\nThe trace no longer bills a body for reactions it cannot take");
{
  const one = creature([feat("Routine Swing", "action", "1d8+4"), feat("Riposte", "reaction", "3d6")]);
  const three = creature([
    feat("Routine Swing", "action", "1d8+4"),
    feat("Riposte", "reaction", "3d6"),
    feat("Shield Bash", "reaction", "3d6"),
    feat("Opportunity Attack", "reaction", "3d6"),
  ]);
  const dmg = (c: ParsedCreature) => round1(c).totalExpectedDamage;
  ok("three identical reactions do not out-damage one",
    Math.abs(dmg(three) - dmg(one)) < 1e-9,
    `${dmg(three).toFixed(2)} vs ${dmg(one).toFixed(2)}`);
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
