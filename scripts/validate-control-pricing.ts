/**
 * VALIDATION — deterministic control pricing against the v7 contract.
 *
 * Run: npm run validate:control
 *
 * Every assertion below cites the contract clause it is checking. This is the "and validate them
 * now" half of Christopher's instruction — an implementation nobody exercised is a claim, not a
 * result.
 */

import {
  withAdvantage, withDisadvantage, withRerollOnFail, applySwing, combineSwings,
  conditionEffect, pHitVsProne, proneIncomingSwing, conditionsImposedBy,
} from "../src/core/encounter-band/controlPricing";
import {
  spaceForSize, edgeGapFromCentres, isReachable, priceProne, priceGrappled,
  priceForcedMovement, priceFrightened, reachOfFeature, DEFAULT_MELEE_REACH_FT,
} from "../src/core/encounter-band/reachability";
import type { ParsedFeature } from "../src/core/encounter-band/featureResolver";
import { parseReachFt, parseRangeFt, parseForcedMovementFt, parseCreature } from "../src/core/encounter-band/parseCreature";
import { isMultiattackAction, multiattackCountFromText } from "../src/core/monsters/multiattackText";

let passed = 0;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  const a = typeof actual === "number" ? Number(actual.toFixed(6)) : actual;
  const e = typeof expected === "number" ? Number(expected.toFixed(6)) : expected;
  if (JSON.stringify(a) === JSON.stringify(e)) { passed++; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}\n         expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`); }
}

const melee = (reach = 5): ParsedFeature => ({ name: "Claw", attackBonus: 7, damage: "2d6+4", reachFt: reach });
const ranged = (range: number): ParsedFeature => ({ name: "Bolt", attackBonus: 7, damage: "2d8", rangeFt: range });

console.log("\n── d20 order statistics (contract: 'Advantage / disadvantage on attacks', auto=YES)");
check("advantage at p=0.50 → 0.75", withAdvantage(0.5), 0.75);
check("disadvantage at p=0.50 → 0.25", withDisadvantage(0.5), 0.25);
// The whole reason a flat modifier is wrong: the same advantage is worth a quarter at the middle
// and a tenth at the top.
check("advantage at p=0.90 → 0.99 (worth +0.09, not +0.25)", withAdvantage(0.9), 0.99);
check("reroll-on-fail equals advantage", withRerollOnFail(0.6), withAdvantage(0.6));
check("advantage + disadvantage CANCEL (5e rule, never additive)", combineSwings("advantage", "disadvantage"), "none");
check("two advantages do not stack", combineSwings("advantage", "advantage"), "advantage");
check("applySwing none is identity", applySwing(0.42, "none"), 0.42);

console.log("\n── Restrained (contract: three separate effects)");
const restrained = conditionEffect("restrained")!;
check("its attacks at disadvantage", restrained.outgoingAttacks, "disadvantage");
check("attacks against it at advantage", restrained.incomingAttacks, "advantage");
check("saves at disadvantage", restrained.saves, "disadvantage");
check("…DEX saves ONLY", restrained.savesDexOnly, true);

console.log("\n── Stunned / Incapacitated (contract: auto=YES)");
check("stunned loses actions", conditionEffect("stunned")!.actionsLost, true);
check("stunned speed 0", conditionEffect("stunned")!.speedZero, true);
check("stunned grants attackers advantage", conditionEffect("stunned")!.incomingAttacks, "advantage");
check("incapacitated loses actions", conditionEffect("incapacitated")!.actionsLost, true);
check("incapacitated does NOT grant advantage", conditionEffect("incapacitated")!.incomingAttacks, "none");

console.log("\n── Prone (contract: '≤5 ft advantage, >5 ft disadvantage')");
check("melee attacker gains advantage", proneIncomingSwing(5), "advantage");
check("ranged attacker suffers disadvantage", proneIncomingSwing(30), "disadvantage");
// An all-melee party and an all-ranged party get opposite answers from the same condition.
check("all-melee party vs prone (p=0.6)", pHitVsProne(0.6, 1), withAdvantage(0.6));
check("all-ranged party vs prone (p=0.6)", pHitVsProne(0.6, 0), withDisadvantage(0.6));
check("50/50 party sits between them", pHitVsProne(0.6, 0.5), (withAdvantage(0.6) + withDisadvantage(0.6)) / 2);

console.log("\n── Footprints (reference: size_space_ft)");
check("Medium 5x5", spaceForSize("Medium"), 5);
check("Large 10x10", spaceForSize("Large"), 10);
check("Huge 15x15", spaceForSize("Huge"), 15);
check("Gargantuan 20x20", spaceForSize("Gargantuan"), 20);
check("Tiny 2.5x2.5", spaceForSize("Tiny"), 2.5);
check("unstated size falls back to a PC space", spaceForSize(undefined), 5);
// Size shortens the GAP; it never lengthens the reach.
// 20 − half of 15 − half of 5 = 10. The footprints eat 10 ft of the centre distance.
check("Huge vs Medium at 20 ft centres → 10 ft edge gap", edgeGapFromCentres(20, "Huge", "Medium"), 10);
check("size is NOT reach: a Huge creature's 5-ft claw still reaches 5 ft", reachOfFeature(melee(5)), 5);
check("unprinted reach uses the ruleset default", reachOfFeature({ name: "Slam" }), DEFAULT_MELEE_REACH_FT);
check("10 ft reach does not cover an 11 ft gap", isReachable(11, 10), false);
check("10 ft reach covers exactly 10 ft", isReachable(10, 10), true);

console.log("\n── Prone reachability (reference: prone.pricing_sequence)");
// Speed 30, standing costs 15, leaving 15 to close a 30 ft gap → still 15 ft out, and a 5-ft
// claw does not cover 15 ft. This is the contract's DPR = 0 case.
const pr1 = priceProne([melee(5)], 30, 30);
check("standing halves speed, leaving the melee out of reach", pr1.allOutOfReach, true);
check("…gap closes from 30 ft to 15 ft, still beyond a 5-ft claw", pr1.effectiveSeparationFt, 15);
// A 20 ft gap with the same 15 ft of movement lands exactly at 5 — reach 5 covers a 5 ft gap,
// so the melee survives. The boundary is inclusive per creature_to_creature_test.
check("…but a 20 ft gap closes to exactly 5 ft and the claw still reaches", priceProne([melee(5)], 20, 30).allOutOfReach, false);
// Same creature, same 30 ft gap, but it also has a bolt: it is NOT disarmed.
const pr2 = priceProne([melee(5), ranged(60)], 30, 30);
check("a ranged option survives the same standing cost", pr2.allOutOfReach, false);
check("…and it is the bolt that survives", pr2.reachable.map(f => f.name), ["Bolt"]);
// 40 ft speed leaves 20 after standing — enough to close the whole gap.
check("faster creature closes and keeps its melee", priceProne([melee(5)], 30, 60).allOutOfReach, false);

console.log("\n── Grappled (contract: 'Speed becomes 0. Do not remove actions.')");
const gr = priceGrappled([melee(5), ranged(60)], 30);
check("melee cannot reach a 30 ft gap at speed 0", gr.reachable.map(f => f.name), ["Bolt"]);
check("…but the creature is NOT zeroed — it still has the bolt", gr.allOutOfReach, false);
check("grapple zeroes a melee-only creature held away", priceGrappled([melee(10)], 30).allOutOfReach, true);
check("grapple does NOT zero a melee creature held in reach", priceGrappled([melee(10)], 5).allOutOfReach, false);

console.log("\n── Forced movement (contract: 'no blanket tax')");
// Pushed 20 from 5 → 25 ft gap; 30 speed closes it entirely, so there is NO DPR loss.
check("push a fast creature: it walks back, no loss", priceForcedMovement([melee(5)], 5, 20, 30).allOutOfReach, false);
// Same push against a slow creature: 25 ft gap, 10 speed → still 15 ft short.
check("push a slow creature: melee is lost", priceForcedMovement([melee(5)], 5, 20, 10).allOutOfReach, true);
// A pull is priced too — it can strand a long-ranged creature's positioning just as a push can.
check("a pull closes the gap (negative displacement)", priceForcedMovement([melee(5)], 25, -20, 0).effectiveSeparationFt, 5);

console.log("\n── Frightened (reference: price the non-approach routine, do not force 0)");
check("frightened caster keeps its ranged routine", priceFrightened([melee(5), ranged(120)], 40).reachable.map(f => f.name), ["Bolt"]);
check("frightened melee brute at 40 ft is zeroed", priceFrightened([melee(5)], 40).allOutOfReach, true);
check("frightened brute already in reach still swings", priceFrightened([melee(5)], 5).allOutOfReach, false);
check("no restriction when the source is not visible", priceFrightened([melee(5)], 40, { sourceVisible: false }).allOutOfReach, false);

console.log("\n── Parsing (printed values only)");
check("'reach 10 ft.' → 10", parseReachFt("Melee Weapon Attack: reach 10 ft., one target."), 10);
check("'range 80/320 ft.' → normal range 80", parseRangeFt("Ranged Weapon Attack: range 80/320 ft."), 80);
check("'within 30 feet' → 30", parseRangeFt("Each creature within 30 feet must save."), 30);
check("'60-foot cone' → 60", parseRangeFt("The dragon exhales fire in a 60-foot cone."), 60);
check("no printed reach → undefined, never guessed", parseReachFt("The creature slams its target."), undefined);
check("'pushed 15 feet' → +15", parseForcedMovementFt("the target is pushed 15 feet away"), 15);
check("'pulled 20 feet' → -20", parseForcedMovementFt("the target is pulled 20 feet toward it"), -20);
check("conditions read from prose when unauthored", conditionsImposedBy({ text: "the target is restrained until the end of its next turn" }), ["restrained"]);
check("authored conditions outrank prose", conditionsImposedBy({ conditions: ["stunned"], text: "restrained" }), ["stunned"]);
// Caught against the live library: Pack Tactics mentions "incapacitated" inside a negation, and a
// bare word match zeroed every Thornfang Wolf's damage with its own advantage trait.
check("negated mention is NOT an imposition (Pack Tactics)", conditionsImposedBy({ text: "has advantage on an attack roll if at least one of its allies is within 5 feet of the target and the ally isn't incapacitated" }), []);
check("'unless' prerequisite is not an imposition", conditionsImposedBy({ text: "unless the target is restrained, it may move freely" }), []);
check("'immune to' is not an imposition", conditionsImposedBy({ text: "the creature is immune to the frightened condition" }), []);
check("a real imposition still reads", conditionsImposedBy({ text: "the target is knocked prone" }), ["prone"]);
check("negation earlier in the sentence does not mask a later imposition", conditionsImposedBy({ text: "the ally isn't incapacitated. On a failed save the target is restrained" }), ["restrained"]);

console.log("\n── Multiattack (contract: auto=YES, 'resolve the printed legal sequence')");
check("'makes three slam attacks' → 3", multiattackCountFromText("The brute makes three slam attacks."), 3);
check("'attacks twice' → 2", multiattackCountFromText("It attacks twice with its claws."), 2);
check("'makes two claw attacks' → 2", multiattackCountFromText("Makes two claw attacks."), 2);
// ⚠ A PRINTED COUNT BEATS THE COMPONENT LIST. This assertion used to expect 3 — it encoded the
// bug rather than the rule. The action list is the menu of legal options; "makes two attacks"
// means two, whether the creature has three attacks to choose from or ten.
check("a printed count beats the component list", multiattackCountFromText("The dragon makes two attacks.", ["Claw", "Bite", "Tail"]), 2);
// With no printed count, the named sequence IS the count — and each name carries its quantifier.
check("named sequence with no count → counted by name", multiattackCountFromText("It makes a Bite attack and a Claw attack.", ["Bite", "Claw"]), 2);
check("…and a quantified component counts fully", multiattackCountFromText("It makes a Bite attack and two Claw attacks.", ["Bite", "Claw"]), 3);
check("a component not mentioned is not counted", multiattackCountFromText("It makes a Bite attack.", ["Bite", "Claw", "Tail"]), 1);
check("unreadable sequence returns undefined, never a guess", multiattackCountFromText("It attacks in a manner beyond description."), undefined);
// Caught against the live library — and the SECOND time this exact negation bug was written.
check("'no multiattack' is NOT a Multiattack (Frozen Husk)", isMultiattackAction("Rime Claw", "Its only attack — no multiattack, no rider."), false);
check("a real Multiattack is still detected", isMultiattackAction("Multiattack", "The brute makes three slam attacks."), true);
// End to end: a block that prints its sequence is priced at that sequence, not at one attack.
const brute = { name: "T", stats: { ac: 15, maxHp: 80, speed: "30 ft." },
  actions: [{ name: "Multiattack", text: "The brute makes three slam attacks." },
            { name: "Slam", roll: "1d20 + 7", damage: "2d6 + 4" }] } as never;
check("printed Multiattack drives the Action budget end to end", parseCreature(brute).attacksPerTurn, 3);
const vague = { name: "T", stats: { ac: 15, maxHp: 80, speed: "30 ft." },
  actions: [{ name: "Multiattack", text: "It attacks strangely." },
            { name: "Slam", roll: "1d20 + 7", damage: "2d6 + 4" }] } as never;
const vagueParsed = parseCreature(vague);
check("unreadable Multiattack falls back to 1…", vagueParsed.attacksPerTurn, 1);
check("…and says so as NEEDS DM INPUT, not a silent estimate",
  vagueParsed.assumptions.find(a => a.field === "action_cost")?.flag, "NEEDS DM INPUT");

console.log(`\n${failures.length === 0 ? "ALL PASS" : "FAILURES"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) { failures.forEach(f => console.log(`  - ${f}`)); process.exit(1); }
