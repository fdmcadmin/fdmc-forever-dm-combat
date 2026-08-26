/**
 * TYPED RESISTANCE PRICES ITSELF, from the published formula.
 *   npx tsx scripts/check-damage-responses.ts
 *
 * `pricing_contract.rules.21.formula`: "Weight by the opposing side's actual eligible damage-type
 * share and bypass rules; immunity passes 0 eligible damage, resistance 0.5, vulnerability 2.0."
 */
import { priceDamageResponses, describeDamageResponses, PASS_FRACTION } from "../src/core/encounter-band/damageResponsePricing";
import { partyDamageMixFromActors } from "../src/core/encounter-band/partyDamageMix";

const problems: string[] = [];
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

console.log("the published multipliers:", JSON.stringify(PASS_FRACTION));

// The Veilbound Drake Guard from the stat block: immune to cold, vulnerable to radiant.
const drake = [
  { type: "cold", response: "immune" as const, share: 0.15 },
  { type: "radiant", response: "vulnerable" as const, share: 0.10 },
];
const p = priceDamageResponses(drake);
console.log(`\n${describeDamageResponses(drake)}`);
console.log(`   cold 15% removed outright, radiant 10% doubled`);
console.log(`   pass fraction ${p.passFraction.toFixed(4)} · effective HP x${p.multiplier.toFixed(4)}`);
// 1 - [0.15x(1-0) + 0.10x(1-2)] = 1 - [0.15 - 0.10] = 0.95
if (!near(p.passFraction, 0.95)) problems.push(`drake pass fraction ${p.passFraction}, expected 0.95`);

const cases: Array<[string, Parameters<typeof priceDamageResponses>[0], number]> = [
  ["immune to cold at 15%", [{ type: "cold", response: "immune", share: 0.15 }], 0.85],
  ["resistant to cold at 15%", [{ type: "cold", response: "resistant", share: 0.15 }], 0.925],
  ["vulnerable to radiant at 20%", [{ type: "radiant", response: "vulnerable", share: 0.20 }], 1.20],
  ["immune to everything", [{ type: "all", response: "immune", share: 1 }], 0.05],
];
console.log(`\n  case                            pass    effective HP`);
for (const [label, rs, wantPass] of cases) {
  const r = priceDamageResponses(rs);
  console.log(`  ${label.padEnd(30)} ${r.passFraction.toFixed(4)}  x${r.multiplier.toFixed(4)}`);
  if (!near(r.passFraction, wantPass)) problems.push(`${label}: pass ${r.passFraction}, expected ${wantPass}`);
}

// With NO party to read, an unweighted response records and prices at nothing rather than
// inventing a share. This is the FALLBACK, not the normal path — see below.
const unweighted = priceDamageResponses([{ type: "fire", response: "immune" }]);
console.log(`
  no party at all, unweighted "immune to fire": x${unweighted.multiplier.toFixed(4)}, reported as ${unweighted.unweighted.length} needing a share`);
if (unweighted.multiplier !== 1) problems.push("an unweighted response with no party moved effective HP — it must price at nothing");
if (unweighted.unweighted.length !== 1) problems.push("an unweighted response with no party was not reported");

/**
 * ⚠ THE SHARE COMES FROM THE PARTY'S ACTIONS. Christopher: *"i shouldnt need to weight how much
 * fire damage the party has for this to be a resistance it has."* Twelve campaign creatures resist
 * fire and every one of them priced at ZERO while this was an input. It is DERIVED now, and this
 * is the regression that keeps it derived.
 *
 * A two-action party, so the arithmetic is checkable by eye: 30 fire and 10 cold is a 75% fire
 * share, and resistance halves it — pass 1 - 0.75x0.5 = 0.625, effective HP x1.6.
 */
const party = [{
  name: "Ember",
  actions: [
    { label: "Fireball", metadata: { damage: "30", damageType: "Fire" } },
    { label: "Ray of Frost", metadata: { damage: "10", damageType: "cold" } },
  ],
}];
const mix = partyDamageMixFromActors(party);
console.log(`
  party mix: ${Object.entries(mix.shares).map(([t, v]) => `${t} ${(v * 100).toFixed(0)}%`).join(", ")} · coverage ${(mix.coverage * 100).toFixed(0)}%`);
if (!near(mix.shares.fire ?? 0, 0.75)) problems.push(`fire share ${mix.shares.fire}, expected 0.75`);
if (!near(mix.coverage, 1)) problems.push(`coverage ${mix.coverage}, expected 1 — every action named its type`);

// ⚠ CASE VARIES BY WHOEVER TYPED IT. The library alone holds "Fire", "fire" and "FIre".
const derived = priceDamageResponses([{ type: "FIre", response: "resistant" }], mix);
console.log(`  "resistant to FIre" against that party: pass ${derived.passFraction.toFixed(4)} · x${derived.multiplier.toFixed(4)}`);
if (!near(derived.passFraction, 0.625)) problems.push(`derived pass ${derived.passFraction}, expected 0.625`);
if (derived.unweighted.length !== 0) problems.push("a response the party could weigh was still reported as needing a share");
if (derived.derived.length !== 1) problems.push("a derived response was not reported — a number the DM did not type must still be visible");

// A type nobody in the party deals is a real answer of ZERO, not a missing one.
const irrelevant = priceDamageResponses([{ type: "necrotic", response: "immune" }], mix);
console.log(`  "immune to necrotic" against a party that deals none: x${irrelevant.multiplier.toFixed(4)}`);
if (irrelevant.multiplier !== 1) problems.push("immunity to a type the party never deals must be worth nothing");
if (irrelevant.unweighted.length !== 0) problems.push("a party that deals no necrotic still ANSWERS the question — it must not report as unweighted");

/**
 * ⚠ AN INCOMPLETE SHEET MUST NOT ANSWER. Measured against the real party on 2026-08-26: of 20
 * damaging actions across six character sheets, five stated a damage type and all five were
 * Unarmed Strike. A mix built from that says the party deals 100% bludgeoning and 0% fire, so
 * every "resistant to fire" in Act 3 would price at exactly nothing — confidently, and wrongly.
 *
 * A confident wrong number is worse than the "I cannot price this" it replaced, so a mix with any
 * untyped damage is not usable and the response reports the GAP instead.
 */
const partial = [{
  name: "Half-filled",
  actions: [
    { label: "Unarmed Strike", metadata: { damage: "4 bludgeoning", damageType: "bludgeoning" } },
    { label: "Greataxe", metadata: { damage: "1d12+3" } },   // no type stated — the real case
  ],
}];
const partialMix = partyDamageMixFromActors(partial);
console.log(`
  half-filled sheet: coverage ${(partialMix.coverage * 100).toFixed(0)}% · usable ${partialMix.usable} · ${partialMix.untyped.length} action(s) with no type`);
if (partialMix.usable) problems.push("a mix with untyped damage was marked usable — an incomplete sheet must not answer");
if (partialMix.untyped.length !== 1) problems.push("the untyped action was not reported as the work item");

const onPartial = priceDamageResponses([{ type: "fire", response: "resistant" }], partialMix);
console.log(`  "resistant to fire" against it: x${onPartial.multiplier.toFixed(4)}, reported as ${onPartial.unweighted.length} needing a share`);
if (onPartial.multiplier !== 1) problems.push("an unusable mix still moved effective HP");
if (onPartial.unweighted.length !== 1) problems.push("an unusable mix must report the response, not silently zero it");


// An entered share still WINS, for a table whose damage is not in the app.
const overridden = priceDamageResponses([{ type: "fire", response: "resistant", share: 0.1 }], mix);
console.log(`  entered 10% share overrides the party's 75%: pass ${overridden.passFraction.toFixed(4)}`);
if (!near(overridden.passFraction, 0.95)) problems.push(`override pass ${overridden.passFraction}, expected 0.95`);

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — responses price from the published formula, weighted by the party's own damage.`);
