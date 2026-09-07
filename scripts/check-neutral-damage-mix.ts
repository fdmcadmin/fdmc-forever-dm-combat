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

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
