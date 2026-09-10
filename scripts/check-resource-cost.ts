/**
 * AN ACTION SPENDS WHAT IT COSTS, NOT ONE — the round trip the editor never completed.
 *   npx tsx scripts/check-resource-cost.ts
 *
 * Christopher, 2026-09-10: *"meta magic: quicken spell consume 2 point vs the only 1 i can set as
 * the spender."*
 *
 * ⚠ THE PRICE WAS HONOURED EVERYWHERE AND WRITTEN NOWHERE. `metadata.resourceCost` has been read
 * by the spend path since Lay on Hands needed it — `consumeNamedResource(..., resourceCost ?? 1)`
 * — and by the checker's `actorAsCreature`. The editor offered only WHICH pool, never HOW MANY, so
 * every action spent exactly one whatever it really costs: Quicken 2, Purify Poison 5, both 1.
 *
 * The assertions follow the value through the two hops it has to survive: draft -> metadata, and
 * metadata -> the amount handed to the pool.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptPcActionToActorAction } from "../src/core/ui/pcActionAdapters";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("An action spends what it costs\n");

const draft = (over: Record<string, unknown>) => ({
  id: "a1", label: "Quicken Spell", tab: "actions", economyCost: ["bonus"], ...over,
}) as never;

console.log("1. the price survives every hop out of the editor");
{
  const two: any = adaptPcActionToActorAction(draft({ slotCost: "Sorcery Points", resourceCost: 2 }));
  ok("a cost of 2 is written", two.metadata?.resourceCost === 2, String(two.metadata?.resourceCost));

  const five: any = adaptPcActionToActorAction(draft({ slotCost: "Lay on Hands", resourceCost: 5 }));
  ok("...and so is 5", five.metadata?.resourceCost === 5, String(five.metadata?.resourceCost));

  // 1 is the default, so it stays unwritten rather than cluttering every action.
  const one: any = adaptPcActionToActorAction(draft({ slotCost: "Sorcery Points", resourceCost: 1 }));
  ok("a cost of 1 is left unwritten (it is the default)", one.metadata?.resourceCost === undefined,
    String(one.metadata?.resourceCost));

  /**
   * ⚠ A PRICE WITH NO POOL IS NOT A PRICE. Writing `resourceCost` without `slotCost` would leave a
   * number aimed at nothing, which reads as authored intent that the spend path can never honour.
   */
  const orphan: any = adaptPcActionToActorAction(draft({ resourceCost: 3 }));
  ok("mutation: a cost with no pool is not written", orphan.metadata?.resourceCost === undefined,
    String(orphan.metadata?.resourceCost));
}

console.log("\n2. the editor asks for it");
{
  const src = readFileSync(resolve(ROOT, "src/core/ui/ActorEditorActionTab.tsx"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ok("the action editor reads resourceCost onto its draft", /resourceCost: action\.metadata\?\.resourceCost/.test(code));
  ok("...and writes it back", /set\("resourceCost"/.test(code));
  ok("...and only offers it once a pool is chosen", /draft\.slotCost && \(/.test(code));
}

console.log("\n3. the spend path still reads it");
{
  const src = readFileSync(resolve(ROOT, "src/core/state/consumeActionResources.ts"), "utf8");
  ok("consumeActionResources hands the pool the authored amount",
    /resourceCost \?\? 1/.test(src));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
