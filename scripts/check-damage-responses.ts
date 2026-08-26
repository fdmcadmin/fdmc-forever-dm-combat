/**
 * TYPED RESISTANCE PRICES ITSELF, from the published formula.
 *   npx tsx scripts/check-damage-responses.ts
 *
 * `pricing_contract.rules.21.formula`: "Weight by the opposing side's actual eligible damage-type
 * share and bypass rules; immunity passes 0 eligible damage, resistance 0.5, vulnerability 2.0."
 */
import { priceDamageResponses, describeDamageResponses, PASS_FRACTION } from "../src/core/encounter-band/damageResponsePricing";

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

// An unweighted response records and prices at nothing rather than inventing a share.
const unweighted = priceDamageResponses([{ type: "fire", response: "immune" }]);
console.log(`\n  unweighted "immune to fire": x${unweighted.multiplier.toFixed(4)}, reported as ${unweighted.unweighted.length} needing a share`);
if (unweighted.multiplier !== 1) problems.push("an unweighted response moved effective HP — it must price at nothing");
if (unweighted.unweighted.length !== 1) problems.push("an unweighted response was not reported");

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — responses price from the published formula, and an unweighted one prices at nothing.`);
