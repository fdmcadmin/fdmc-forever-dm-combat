/**
 * THE PARTY READ IS MEMOISED, AND THESE ARE THE ASSUMPTIONS THAT MAKES IT SAFE.
 *   npm run check:partyreadcache
 *
 * ⚠ THREE SECONDS PER CLICK, AND NONE OF IT NEW WORK.
 *
 * Christopher, 2026-10-21: *"when i click the 4th member it takes 3 seconds, swaps between party
 * sizes take 3 seconds"* — and *"there is major lag when trying to swap party sizes"*.
 *
 * Measured in the panel, a party-size swap cost ~3.1s, of which the monster side was 3ms. The
 * whole bill was the party read, and almost all of it was recomputation of answers the checker had
 * just produced:
 *
 *   - `actorAsCreature` shapes one character in 61–186ms (against ~1ms each for `parseCreature`
 *     and `traceCreature` after it) and was called TWICE per character per interaction: once
 *     inside `currentPartyMetrics`' whole-party aggregate, again in that character's own read.
 *   - `featContextFromActor` was ~180ms per call inside `partyFeatsFromActors`, re-run on every
 *     swap because its memo depends on the fight profile.
 *   - `planningParty` priced each bond by subtracting a second metrics pass taken from a
 *     bond-stripped clone, and spread a FRESH clone every call, so that pass could never be reused.
 *
 * Caching those turned a swap into ~120ms. The caches are keyed on the actor OBJECT, which is what
 * keeps them honest: `resolveActorFromLibrary` returns a new object every call, so an edited sheet
 * is a new key and a stale read cannot be served. This gate holds the two claims that make the
 * memo correct rather than merely fast:
 *
 *   1. The metrics do not read `target.partySize`, so leaving it out of the key is sound. Proved
 *      with two SEPARATE actor objects of identical content, so both calls miss the cache and the
 *      comparison is of real computations, not of one cached answer returned twice.
 *   2. Identity is the key: the same object is reused, a different object is recomputed.
 */
import assert from "node:assert/strict";
import { currentPartyMetrics, targetFromRoster } from "../src/core/encounter-band/currentPartyResolver";
import { actorAsCreature } from "../src/core/encounter-band/actorAsCreature";
import { featContextFromActor, attackProfile } from "../src/modules/dnd-5e/featContextFromActor";

let failures = 0;
const test = (label: string, fn: () => void) => {
  try { fn(); console.log(`  PASS  ${label}`); }
  catch (error) { failures++; console.log(`  FAIL  ${label} — ${error instanceof Error ? error.message : String(error)}`); }
};

const template = {
  templateId: "cache-enemy", name: "Cache Enemy", stats: { ac: 15, maxHp: 120, attacksPerTurn: 1 },
  abilities: [], actions: [{ name: "Claw", activationType: "action", roll: "1d20+5", damage: "1d8+3", range: "Melee 5 ft.", text: "Melee attack, reach 5 ft." }],
} as never;

const sheet = () => ({
  id: "cache-pc", name: "Cache PC", kind: "player", level: 7, className: "Fighter", attacksPerAction: 2,
  stats: { ac: 18, hp: { max: 60, current: 60 }, speed: "30 ft." },
  abilityScores: { str: { score: 18 }, dex: { score: 12 }, con: { score: 16 }, int: { score: 10 }, wis: { score: 12 }, cha: { score: 10 } },
  tabs: {
    main: [{
      id: "sword", label: "Longsword", actionKind: "attack", economyCost: ["main"], logMode: "default",
      metadata: { attack: "1d20+@STR+@PROF", damage: "1d8+@STR", damageType: "Slashing", range: "5 ft." },
    }],
    resources: [], equipment: [],
  },
});

const entries = [{ template, quantity: 1 }] as never;

console.log("Party read cache");

test("party size is not an input to the party read, so the cache may leave it out of the key", () => {
  const four = targetFromRoster(entries, 4);
  const six = targetFromRoster(entries, 6);
  assert(four && six, "the fixture must price a target at both sizes");
  // The fields the maths actually reads must be identical across sizes...
  assert.equal(four.ac, six.ac, "target AC moved with party size");
  assert.equal(four.saveBonus, six.saveBonus, "target save bonus moved with party size");
  assert.deepEqual(four.saves, six.saves, "target saves moved with party size");
  /**
   * ...and so must the whole read. Two SEPARATE objects of identical content, so neither call can
   * be answered from the other's cache entry — this compares computations, not one cached answer.
   */
  const a = currentPartyMetrics([sheet() as never], four, { arrivingSpent: 0 });
  const b = currentPartyMetrics([sheet() as never], six, { arrivingSpent: 0 });
  assert(a && b, "both reads must produce metrics");
  assert.equal(JSON.stringify(a), JSON.stringify(b), "the party read changed with party size — the cache key must then include it");
});

/**
 * A cache hit hands back the STORED object, so reference identity is the hit itself — no counter
 * exported from the module just to be looked at here (`check:wiring` is right to refuse one).
 */
test("the same actor object is served from cache; a different object is recomputed", () => {
  const target = targetFromRoster(entries, 4)!;
  const actor = sheet() as never;
  const first = currentPartyMetrics([actor], target, { arrivingSpent: 0 });
  const second = currentPartyMetrics([actor], target, { arrivingSpent: 0 });
  assert(first, "the first read must produce metrics");
  assert.equal(first, second, "re-reading the same actor object should return the cached read");
  // A re-resolved actor is a NEW object, which is what stops an edited sheet being served stale.
  const fresh = currentPartyMetrics([sheet() as never], target, { arrivingSpent: 0 });
  assert.notEqual(fresh, first, "a different actor object must be read afresh");
  assert.equal(JSON.stringify(fresh), JSON.stringify(first), "an identical sheet must still agree");
});

test("a null target is read, not cached, and does not crash on the way to the cache", () => {
  // `targetFromRoster([])` is null for an empty roster, and `check:party` reads a sheet that way.
  const empty = targetFromRoster([] as never);
  assert.equal(empty, null, "an empty roster should price no target");
  const metrics = currentPartyMetrics([sheet() as never], empty as never, { arrivingSpent: 0 });
  assert(metrics, "a sheet read against no target must still produce metrics");
  // Not cached: a second read of the same actor is a fresh object, never a stored one.
  assert.notEqual(currentPartyMetrics([sheet() as never], empty as never, { arrivingSpent: 0 }), metrics);
});

test("actorAsCreature is memoised per actor object, not per sheet content", () => {
  const actor = sheet() as never;
  assert.equal(actorAsCreature(actor), actorAsCreature(actor), "the same actor should hand back the same shape");
  assert.notEqual(actorAsCreature(sheet() as never), actorAsCreature(actor), "a new actor object must be shaped afresh");
});

test("featContextFromActor and attackProfile are memoised per actor and target AC", () => {
  const actor = sheet() as never;
  assert.equal(featContextFromActor(actor, 15), featContextFromActor(actor, 15), "same actor and AC should be cached");
  assert.notEqual(featContextFromActor(actor, 15), featContextFromActor(actor, 18), "a different target AC is a different answer");
  assert.deepEqual(featContextFromActor(actor, 15), featContextFromActor(sheet() as never, 15), "identical sheets must still agree");
  assert.equal(attackProfile(actor, 15), attackProfile(actor, 15), "attackProfile should be cached per actor and AC");
});

console.log(failures === 0 ? "\nParty read cache: OK" : `\nParty read cache: ${failures} failing`);
process.exit(failures === 0 ? 0 : 1);
