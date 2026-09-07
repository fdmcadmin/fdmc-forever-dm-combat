/**
 * A TYPED RESISTANCE IS WORTH SOMETHING EVEN WITH NO PARTY CHOSEN.
 *   npm run check:neutralmix
 *
 * A creature's resistance is only worth what it actually stops, so the workbook weights a typed
 * response by the party's SHARE of that damage type. With no actors readable the app had no share
 * and priced every typed response at ZERO — a Gate II mirror resistant to bludgeoning, piercing and
 * slashing came out worth nothing, and the panel asked the DM to type a share in by hand.
 *
 * `broken_chain_checker_runtime_v3_3_slot_resource_budget.xlsx` publishes that share on
 * `Neutral Damage Profile`. Christopher, 2026-09-07: *"it should only list damage types not names
 * of spells actions and classes"* — which is exactly what makes it generalisable, and is asserted
 * here rather than assumed.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { NEUTRAL_DAMAGE_PROFILE, neutralDamageMix } from "../src/modules/dnd-5e/neutralDamageProfile";
import { priceDamageResponses } from "../src/core/encounter-band/damageResponsePricing";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** The thirteen 5e damage types. Anything else in the profile is a name that should not be there. */
const DAMAGE_TYPES = new Set([
  "bludgeoning", "piercing", "slashing", "fire", "cold", "lightning", "force",
  "radiant", "necrotic", "psychic", "acid", "poison", "thunder",
]);

console.log("The published typed mix prices a resistance when no party is chosen\n");

console.log("It is a profile of damage TYPES and nothing else");
{
  const keys = Object.keys(NEUTRAL_DAMAGE_PROFILE);
  const strays = keys.filter(k => !DAMAGE_TYPES.has(k));
  ok("every entry is a damage type — no spell, action or class names", strays.length === 0,
    strays.join(", ") || `${keys.length} types`);
  const sum = Object.values(NEUTRAL_DAMAGE_PROFILE).reduce((a, b) => a + b, 0);
  ok("the shares sum to 1.00", Math.abs(sum - 1) < 1e-9, sum.toFixed(4));
  ok("no share is negative or above 1",
    Object.values(NEUTRAL_DAMAGE_PROFILE).every(v => v >= 0 && v <= 1));
}

console.log("\nA typed response prices against it instead of at nothing");
{
  const resp = [{ type: "bludgeoning", response: "resistant" }] as never;
  const withNone = priceDamageResponses(resp, undefined);
  const withNeutral = priceDamageResponses(resp, neutralDamageMix() as never);

  ok("reproduced: with no mix at all it is unweighted",
    withNone.unweighted.length === 1 && withNone.multiplier === 1,
    `multiplier ${withNone.multiplier}`);
  ok("with the published mix it prices", withNeutral.unweighted.length === 0 && withNeutral.multiplier > 1,
    `multiplier ${withNeutral.multiplier.toFixed(4)}`);
  ok("...at the published share for that type",
    Math.abs((withNeutral.derived?.[0]?.share ?? 0) - NEUTRAL_DAMAGE_PROFILE.bludgeoning) < 1e-9,
    `${((withNeutral.derived?.[0]?.share ?? 0) * 100).toFixed(1)}%`);
}

console.log("\nAnd a real party still outranks it");
{
  /** A party whose damage is mostly radiant should NOT be priced as 14% bludgeoning. */
  const actorMix = {
    shares: { radiant: 0.9, bludgeoning: 0.1 }, typedTotal: 100, coverage: 1,
    usable: true, untyped: [], sources: [], source: "actors" as const,
  };
  const resp = [{ type: "bludgeoning", response: "resistant" }] as never;
  const fromActors = priceDamageResponses(resp, actorMix as never);
  const fromNeutral = priceDamageResponses(resp, neutralDamageMix() as never);
  ok("an actor-read share is used in preference and differs",
    Math.abs((fromActors.derived?.[0]?.share ?? 0) - 0.1) < 1e-9
    && Math.abs((fromActors.derived?.[0]?.share ?? 0) - (fromNeutral.derived?.[0]?.share ?? 0)) > 1e-9,
    `actors ${(fromActors.derived?.[0]?.share ?? 0) * 100}% vs published ${(fromNeutral.derived?.[0]?.share ?? 0) * 100}%`);
  ok("the mix says which one it is",
    neutralDamageMix().source === "published-neutral" && actorMix.source === "actors");
}

console.log("\nA CHOSEN party whose damage is untyped falls back too");
{
  /**
   * ⚠ THE FALLBACK WAS `damageMix ?? neutral`, WHICH ONLY CAUGHT "NO ACTORS".
   *
   * A chosen party whose sheets state no damage types produces a mix that is PRESENT and
   * `usable: false` — not undefined — so the fallback never fired and every mirror resistance came
   * back "carries no published share either, so it prices at nothing" on a screen with five
   * characters selected. Christopher, 2026-09-07: *"i thought we just discussed that this should
   * not show since it should be priced against the baseline."*
   *
   * This asserts the SHAPE that broke it, in the roster path that produces the message.
   */
  const unusable = {
    shares: {}, typedTotal: 0, coverage: 0, usable: false,
    untyped: [{ actor: "A", label: "Longsword", amount: 8 }], sources: [], source: "actors" as const,
  };
  const template = {
    templateId: "t", name: "Mirror",
    stats: { kind: "construct", ac: 15, maxHp: 90, speed: "30 ft.", attacksPerTurn: 1,
      size: "Medium", classification: "elite", proficiencyBonus: 3, defenses: [],
      damageResponses: [{ type: "bludgeoning", response: "resistant" }] },
    abilities: [], actions: [{ name: "Slam", kind: "attack", roll: "1d20+6", damage: "2d8+4 bludgeoning" }],
    traits: [], reactions: [],
  };
  const target = { ac: 16, saveBonus: 3, partySize: 5,
    saves: { str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 } };

  const withUnusable = rosterFromTemplates(
    [{ template: template as never, quantity: 1 }], 7,
    { ...target, damageMix: unusable as never }, [template as never]);
  const gaps = withUnusable.assumptions.filter(a => /carries no published share/.test(a.detail));
  ok("an untyped chosen party no longer prices a resistance at nothing",
    gaps.length === 0, gaps.map(g => g.detail).join(" | "));
  ok("...it uses the published neutral profile and says so",
    withUnusable.assumptions.some(a => /published neutral profile/.test(a.detail)
      && /state no damage type/.test(a.detail)),
    withUnusable.assumptions.map(a => a.detail.slice(0, 70)).join(" | "));

  /** ⚠ MUTATION: a party whose damage IS typed must still outrank the published profile. */
  const typed = {
    shares: { bludgeoning: 0.9, fire: 0.1 }, typedTotal: 100, coverage: 1, usable: true,
    untyped: [], sources: [], source: "actors" as const,
  };
  const withTyped = rosterFromTemplates(
    [{ template: template as never, quantity: 1 }], 7,
    { ...target, damageMix: typed as never }, [template as never]);
  ok("mutation: a readable party is read, not replaced by the published profile",
    withTyped.assumptions.some(a => /read from their actions/.test(a.detail)),
    withTyped.assumptions.map(a => a.detail.slice(0, 60)).join(" | "));
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
