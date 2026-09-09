/**
 * A SUMMONED BODY REACHES THE COMBAT CHART — the assertion `check:summons` says it does not make.
 *   npx tsx scripts/check-summon-tracker.ts
 *
 * Christopher, 2026-09-08: *"look into the summons because these arent showing in the combat chart
 * for the divine stead and the eldritch cannon"*, and *"this has to be able to track rounds in
 * combat or the covenant creature would just always be on."*
 *
 * ─── ⚠ WHY A SECOND SUMMON GATE EXISTS ──────────────────────────────────────────────────────
 *
 * `check:summons` is green and has been for a long time. It says so itself, in its own words:
 *
 *     ⚠ WHAT IS ASSERTED IS THE ARITHMETIC, not that a body appeared.
 *
 * Every formula was right. `materializeSummon` resolved the Steed's `10+@SLOT`, the Cannon's
 * `5*@LEVEL` and the bond-creature's `@HITDIEMAX+@LEVEL` against a PC summoner, and none of it
 * ever became a row anyone could see. That is the four-times-over shape the wiring gate was
 * written for, and the arithmetic gate could not catch it because arithmetic was never the gap.
 *
 * So this file asserts the OTHER half, and only that half:
 *   · a casting becomes a body on the chart
 *   · the body carries the CASTER's numbers, not a template's defaults
 *   · `acts` decides whether it takes a turn or rides its summoner's
 *   · a duration ends it, on the round the table can see
 *   · and the app actually passes them in — the exits, not the model
 *
 * ⚠ EVERY ASSERTION HAS A MUTATION THAT FLIPS IT. A gate that cannot fail is worse than no gate.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Actor } from "../src/core/types/actor";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";
import { resolveActiveSummons, isStandingOn, withSummonRecord, type ActiveSummon } from "../src/core/state/activeSummons";
import { summonerContextFromActor } from "../src/core/state/summonFromActor";
import { buildCombatants } from "../src/core/ui/CombatTracker";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  ok(label, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got) === JSON.stringify(want) ? "" : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const vis = (name: string) => ({ defaultState: "hp-bar", hiddenName: "?", revealedName: name });

/* ── The three cases Christopher named, as they exist on real sheets ──────────────────────── */

/** The Steed the Paladin points at: a library creature whose whole profile is the slot. */
const STEED = {
  templateId: "srd:otherworldly-steed", name: "Otherworldly Steed",
  stats: { ac: "10+@SLOT", maxHp: "5+10*@SLOT", speed: "60 ft", kind: "celestial",
    str: 18, dex: 14, con: 16, int: 6, wis: 12, cha: 10 },
  abilities: [], traits: [], reactions: [],
  actions: [
    { name: "Otherworldly Slam", kind: "attack", roll: "1d20+@SPELL", damage: "1d8+@SLOT" },
  ],
  visibility: vis("Otherworldly Steed"),
} as unknown as MainMonsterTemplate;

/** The Cannon has no library entry and needs none — an inline body on one artificer's sheet. */
const CANNON = {
  templateId: "inline:eldritch-cannon", name: "Eldritch Cannon",
  stats: { ac: 18, maxHp: "5*@LEVEL", speed: "15 ft", kind: "construct",
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  abilities: [], traits: [], reactions: [],
  actions: [{ name: "Force Ballista", kind: "attack", roll: "1d20+@SPELL", damage: "2d8" }],
  visibility: vis("Eldritch Cannon"),
} as unknown as MainMonsterTemplate;

/** The Covenant bond-creature: two turns, and it acts on its caster's. */
const BOND_BODY = {
  templateId: "inline:covenant-call", name: "Bond-Creature",
  stats: { ac: 13, maxHp: "@HITDIEMAX+@LEVEL", speed: "30 ft", kind: "fey",
    str: 12, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
  abilities: [], traits: [], reactions: [],
  actions: [{ name: "Bond Strike", kind: "attack", roll: "1d20+@PROF", damage: "1d8+@MAIN" }],
  visibility: vis("Bond-Creature"),
} as unknown as MainMonsterTemplate;

const LIBRARY = [STEED];

/** A character who can call something, built the way a sheet actually is. */
const caster = (id: string, name: string, level: number, extras: Partial<Actor> = {}): Actor => ({
  id, kind: "player", name, subtitle: "", level,
  stats: { ac: 18, hp: { current: 52, max: 52 }, speed: "30 ft" },
  abilityScores: {
    str: { score: 16 }, dex: { score: 12 }, con: { score: 14 },
    int: { score: 10 }, wis: { score: 12 }, cha: { score: 18 },
  },
  pinnedReactions: [], tabs: {},
  ...extras,
} as unknown as Actor);

const paladin = caster("pc-lights-stone", "Lights Stone", 6);
const artificer = caster("pc-raphael", "Raphael", 6);

const record = (over: Partial<ActiveSummon> & Pick<ActiveSummon, "id" | "ownerId" | "actionId" | "spec">): ActiveSummon => ({
  summonedOnRound: 1,
  ...over,
} as ActiveSummon);

console.log("A summon reaches the combat chart\n");

/* ── 1. THE ADAPTER: A CHARACTER IS A SUMMONER ────────────────────────────────────────────── */
console.log("1. a character sheet resolves to a summoner context");
{
  const ctx = summonerContextFromActor(paladin, 2);
  eq("level is the character's", ctx.level, 6);
  eq("proficiency is derived from that level", ctx.proficiencyBonus, 3);
  eq("the main modifier is the highest score (CHA 18)", ctx.mainModifier, 4);
  eq("the slot rides with the CALL, not the caster", ctx.slotLevel, 2);

  /**
   * ⚠ MUTATION: a sheet that saved a BLANK proficiency as 0. `?? ` accepts it and the Steed
   * arrives at +0 to hit — a rules bug that is really a missing field.
   */
  const blank = summonerContextFromActor(caster("x", "Blank", 9, { proficiencyBonus: 0 } as Partial<Actor>));
  eq("mutation: a stored 0 proficiency is read as blank and derived", blank.proficiencyBonus, 4);
}

/* ── 2. A BODY APPEARS, WITH THE CASTER'S NUMBERS ─────────────────────────────────────────── */
console.log("\n2. the casting becomes a body");
{
  const steed = record({
    id: "s1", ownerId: paladin.id, actionId: "find-steed",
    spec: { templateId: "srd:otherworldly-steed", name: "Divine Steed", acts: "own-initiative" },
    slotLevel: 2,
  });
  const { summons, problems } = resolveActiveSummons([steed], [paladin], 1, LIBRARY);
  eq("one body stands", summons.length, 1);
  eq("nothing is unresolved", problems, []);
  // AC "10+@SLOT" at a 2nd-level slot. 12, not 10 — the fold that took three tries.
  eq("AC comes from the slot", String(summons[0]?.body.stats.ac), "12");
  eq("HP comes from the slot (5+10*2)", Number(summons[0]?.body.stats.maxHp), 25);

  /**
   * ⚠ MUTATION: drop the slot from the record. `materializeSummon` takes no slot parameter — it
   * reads `spec.slotLevel` — so a record that stores it beside the spec must fold it in. Without
   * the fold the Steed resolves `10+@SLOT` against nothing.
   */
  const noSlot = resolveActiveSummons([{ ...steed, slotLevel: undefined }], [paladin], 1, LIBRARY);
  ok("mutation: with no slot, the AC no longer reads 12",
    String(noSlot.summons[0]?.body.stats.ac) !== "12",
    `got ${String(noSlot.summons[0]?.body.stats.ac)}`);

  // An inline body needs no library at all — that is the Cannon's whole point.
  const cannon = resolveActiveSummons([record({
    id: "c1", ownerId: artificer.id, actionId: "arcane-cannon",
    spec: { inline: CANNON, name: "Eldritch Cannon", acts: "own-initiative" },
  })], [artificer], 1, []);
  eq("the Cannon resolves with an EMPTY library", cannon.summons.length, 1);
  eq("its HP is 5 x the artificer's level", Number(cannon.summons[0]?.body.stats.maxHp), 30);
}

/* ── 3. THE CHART — the assertion that did not exist ──────────────────────────────────────── */
console.log("\n3. the body is a row on the chart");
{
  const steed = record({
    id: "s1", ownerId: paladin.id, actionId: "find-steed",
    spec: { templateId: "srd:otherworldly-steed", name: "Divine Steed", acts: "own-initiative" },
    slotLevel: 2,
  });
  const { summons } = resolveActiveSummons([steed], [paladin], 1, LIBRARY);

  const without = buildCombatants([paladin], [], null, {}, {}, true, {});
  const with_ = buildCombatants([paladin], [], null, {}, {}, true, {}, summons);
  eq("without summons the chart is the party alone", without.length, 1);
  eq("with one summoned body the chart grows by one", with_.length, 2);

  const row = with_.find(c => c.id === "s1");
  ok("the body is on the chart under its own name", row?.name === "Divine Steed", row?.name);
  eq("it knows who called it", row?.ownerId, paladin.id);
  eq("its HP is the resolved body's, not a placeholder", row?.hp.max, 25);
  ok("it is marked as a summon, so the row can say so", Boolean(row?.summon));

  /**
   * ⚠ MUTATION: `own-initiative` must NOT nest. A body that takes a turn of its own belongs in
   * the order; hiding it under its caster is how a whole combatant's turn goes unnoticed.
   */
  eq("mutation: an own-initiative body is not nested under its caster",
    with_.find(c => c.id === paladin.id)?.companions, undefined);
}

/* ── 4. `acts` DECIDES THE SHAPE, AND IT IS A PRICE ───────────────────────────────────────── */
console.log("\n4. a body that acts on your turn does not take a turn of its own");
{
  const bond = record({
    id: "b1", ownerId: paladin.id, actionId: "covenant-call",
    spec: { inline: BOND_BODY, name: "Bond-Creature", acts: "summoner-turn", durationRounds: 2 },
    summonedOnRound: 3,
  });
  const { summons } = resolveActiveSummons([bond], [paladin], 3, []);
  const chart = buildCombatants([paladin], [], null, {}, {}, true, {}, summons);
  eq("it adds no row to the order", chart.length, 1);
  const nested = chart[0]?.companions ?? [];
  eq("it nests under its caster instead", nested.map(c => c.id), ["b1"]);
  eq("and the nested row carries the round it ends on", nested[0]?.summon?.expiresAfterRound, 4);

  /**
   * ⚠ MUTATION: read it as its own initiative and the party gains a free combatant every round —
   * exactly what `SummonSpec.acts` was written to prevent.
   */
  const flipped = resolveActiveSummons(
    [{ ...bond, spec: { ...bond.spec, acts: "own-initiative" } }], [paladin], 3, []);
  const flippedChart = buildCombatants([paladin], [], null, {}, {}, true, {}, flipped.summons);
  eq("mutation: flipped to own-initiative it DOES take a row", flippedChart.length, 2);
}

/* ── 5. ROUNDS — the Covenant creature does not "just always be on" ───────────────────────── */
console.log("\n5. a duration ends it, on a round the table can see");
{
  const bond = record({
    id: "b1", ownerId: paladin.id, actionId: "covenant-call",
    spec: { inline: BOND_BODY, name: "Bond-Creature", acts: "summoner-turn", durationRounds: 2 },
    summonedOnRound: 3,
  });
  const upOn = (round: number) => isStandingOn(bond, round);
  eq("not on the field before it was called (R2)", upOn(2), false);
  /**
   * ⚠ THE ARRIVAL ROUND COUNTS. "Lasts 2 turns" summoned on round 3 means rounds 3 and 4 —
   * counting the arrival as elapsed gives a two-round body one round of life, which is the
   * off-by-one that makes a DM stop trusting the tracker.
   */
  eq("up on the round it arrives (R3)", upOn(3), true);
  eq("up on its second round (R4)", upOn(4), true);
  eq("gone on R5", upOn(5), false);

  eq("and the chart is empty of it on R5",
    buildCombatants([paladin], [], null, {}, {}, true, {},
      resolveActiveSummons([bond], [paladin], 5, []).summons)[0]?.companions, undefined);

  /**
   * ⚠ MUTATION: a body with NO duration never expires — a Steed lasts until something kills it,
   * and reading "no duration" as "zero rounds" would delete it the moment it arrived.
   */
  const steedForever = record({
    id: "s1", ownerId: paladin.id, actionId: "find-steed",
    spec: { templateId: "srd:otherworldly-steed", acts: "own-initiative" }, slotLevel: 2,
    summonedOnRound: 1,
  });
  eq("mutation: a body with no duration is still up on R12", isStandingOn(steedForever, 12), true);

  /**
   * ⚠ AND EXPIRY IS A QUESTION, NOT A DELETION. Nothing is scheduled and nothing is deleted, so
   * rewinding the round un-expires the body instead of leaving it dead because a timer fired.
   */
  eq("rewinding to R4 brings it back", isStandingOn(bond, 4), true);
  eq("...and the chart shows it again on R4",
    (buildCombatants([paladin], [], null, {}, {}, true, {},
      resolveActiveSummons([bond], [paladin], 4, []).summons)[0]?.companions ?? []).length, 1);
}

/* ── 6. TWO BODIES, TWO HP POOLS ──────────────────────────────────────────────────────────── */
console.log("\n6. a call that brings three bodies is three rows");
{
  const many = record({
    id: "m1", ownerId: artificer.id, actionId: "swarm",
    spec: { inline: CANNON, name: "Cannon", count: 3, acts: "own-initiative" },
  });
  const { summons } = resolveActiveSummons([many], [artificer], 1, []);
  eq("one record, three bodies", summons[0]?.count, 3);
  const chart = buildCombatants([artificer], [], null, {}, {}, true, {}, summons);
  const rows = chart.filter(c => c.summon);
  eq("three rows on the chart", rows.length, 3);
  eq("each with its own id", new Set(rows.map(r => r.id)).size, 3);
  eq("each with its own HP pool", rows.map(r => r.hp.max), [30, 30, 30]);

  /**
   * ⚠ MUTATION: live HP is keyed per BODY. Damaging the first must not damage the other two —
   * one shared pool would let the table erase three bodies with one hit.
   */
  const hurt = buildCombatants([artificer], [], null, {}, {}, true,
    { "m1#1": { current: 4, max: 30 } }, summons);
  eq("mutation: damage lands on one body only",
    hurt.filter(c => c.summon).map(r => r.hp.current), [4, 30, 30]);
}

/* ── 7. FAILURE IS REPORTED, NOT SWALLOWED ────────────────────────────────────────────────── */
console.log("\n7. a broken record says so");
{
  const orphan = record({
    id: "o1", ownerId: "pc-who", actionId: "find-steed",
    spec: { templateId: "srd:otherworldly-steed" },
  });
  const r = resolveActiveSummons([orphan], [paladin], 1, LIBRARY);
  eq("a body with no caster in the fight produces no body", r.summons.length, 0);
  ok("...and is reported", r.problems.some(p => /no caster/i.test(p)), r.problems.join(" | "));

  const missing = resolveActiveSummons([record({
    id: "x1", ownerId: paladin.id, actionId: "find-steed",
    spec: { templateId: "srd:not-here", name: "Ghost Steed" },
  })], [paladin], 1, LIBRARY);
  eq("a template that does not exist produces no body", missing.summons.length, 0);
  ok("...and names the id it could not find",
    missing.problems.some(p => p.includes("srd:not-here")), missing.problems.join(" | "));
}

/* ── 8. RE-CASTING REPLACES; A SECOND SPELL DOES NOT ──────────────────────────────────────── */
console.log("\n8. one action, one body");
{
  const first = record({ id: "s1", ownerId: paladin.id, actionId: "find-steed", spec: { templateId: "srd:otherworldly-steed" }, summonedOnRound: 1 });
  const again = record({ id: "s1", ownerId: paladin.id, actionId: "find-steed", spec: { templateId: "srd:otherworldly-steed" }, summonedOnRound: 4 });
  const other = record({ id: "b1", ownerId: paladin.id, actionId: "covenant-call", spec: { inline: BOND_BODY } });

  const afterRecast = withSummonRecord([first], again);
  eq("re-casting the same action leaves ONE record", afterRecast.length, 1);
  eq("...and it is the new casting, so the duration restarts", afterRecast[0]?.summonedOnRound, 4);

  const afterSecond = withSummonRecord(afterRecast, other);
  eq("a DIFFERENT summon from the same caster stands beside it", afterSecond.length, 2);
}

/* ── 9. THE EXITS — does the APP actually pass any of this in? ────────────────────────────── */
console.log("\n9. the wiring, which is the half that was missing");
{
  const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
  const app = read("src/App.tsx");
  const win = read("src/combat-window.tsx");
  const card = read("src/core/ui/ActorCard.tsx");
  const popout = read("src/actor-popout.tsx");

  ok("App builds its chart WITH the standing summons", /liveHpByActorId,\s*\n?\s*activeSummons,/.test(app) || app.includes("liveHpByActorId, activeSummons)"));
  ok("the combat window does too", win.includes("activeSummons,") && win.includes("useActiveSummonsState"));
  ok("using an action with a summon calls the handler", card.includes("onSummonBody?.(action,"));
  ok("...and the App binds that handler", app.includes("onSummonBody={"));
  ok("...and so does the popout", popout.includes("onSummonBody={"));
  ok("ending combat clears every standing body", app.includes("clearSummons()"));

  /**
   * ⚠ THE SUMMON HOOK IS NOT THE RESOURCE HOOK. Hanging it off `onConsumeActionResources` is
   * what would quietly reintroduce the bug: that path is gated on the action not rolling its own
   * damage and on it naming a pool, so a Steed that rolls nothing but spends a slot is fine and a
   * Cannon that rolls IS NOT. Keep them separate.
   */
  ok("the summon hook fires independently of the resource spend",
    card.indexOf("onSummonBody?.(action,") < card.indexOf("const rollsItsOwn = actionRollsItsOwnDamage(action);"));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
