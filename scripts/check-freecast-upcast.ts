/**
 * A 1/LONG-REST SPELL STILL UPCASTS — the picker refused what the spend path already did.
 *   npx tsx scripts/check-freecast-upcast.ts
 *
 * Christopher, 2026-09-10: *"why are 1/LR spells not showing the upcast boxes."*
 *
 * ⚠ TWO READERS OF ONE FACT, AND THE PICKER WAS THE WRONG ONE. `consumeActionResources` has
 * handled this since it was written — the base level comes out of the action's own named pool and
 * anything ABOVE it falls through and spends a real slot:
 *
 *     const upcast = castLevel !== undefined && authored > 0 && castLevel > authored;
 *     if (!upcast) { …spend the named pool… }
 *     // Upcast, or the pool is spent: branch 2 takes it from here and spends the slot.
 *
 * `castLevelOptionsFor` returned NOTHING for a free cast, on the reasoning that "a free cast
 * spends no slot at all" — true of the free one and false of every level above it. So the spend
 * path could take an upcast that the player had no way to choose.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { consumeActionResourcesOnCommit } from "../src/core/state/consumeActionResources";
import type { ActorAction } from "../src/core/types/tabs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/** A class-feature spell: free once per long rest, base level 1. */
const spell = {
  id: "shield-maidens-favor", label: "Shield Maiden's Favor", actionKind: "spell",
  metadata: { spellLevel: 1, spellSlotMode: "freeCast", classFeatureUses: 1 },
} as unknown as ActorAction;

function castAt(castLevel: number | undefined, poolLeft = 1) {
  const spent: string[] = [];
  consumeActionResourcesOnCommit({
    actorId: "a", actorName: "Tester", action: spell, castLevel,
    consumeSpellSlot: (_id, level) => { spent.push(`slot L${level}`); return { outcome: "spent", remaining: 1, max: 2, label: `Spell Slots L${level}` }; },
    consumeNamedResource: (_id, label) => {
      if (poolLeft <= 0) return { outcome: "empty", label, remaining: 0, max: 1 };
      spent.push(`pool ${label}`);
      return { outcome: "spent", label, remaining: 0, max: 1 };
    },
    consumeItemCharge: () => ({ outcome: "no-resource" }),
    log: () => undefined,
    resourceLabels: [{ id: "cf", label: "Shield Maiden's Favor" }],
  } as never);
  return spent;
}

console.log("A 1/Long Rest spell still upcasts\n");

console.log("1. what the spend path does");
{
  ok("cast at its own level spends the FREE use", JSON.stringify(castAt(1)) === JSON.stringify(["pool Shield Maiden's Favor"]), JSON.stringify(castAt(1)));
  ok("cast with no level stated spends the free use too", JSON.stringify(castAt(undefined)) === JSON.stringify(["pool Shield Maiden's Favor"]), JSON.stringify(castAt(undefined)));
  ok("UPCAST to L3 spends a level 3 slot, not the pool", JSON.stringify(castAt(3)) === JSON.stringify(["slot L3"]), JSON.stringify(castAt(3)));
  ok("...and never the base slot", !castAt(3).includes("slot L1"), JSON.stringify(castAt(3)));
  // The free use gone, a base-level cast falls through to its own level's slot.
  ok("with the pool spent, a base cast falls back to an L1 slot",
    JSON.stringify(castAt(1, 0)) === JSON.stringify(["slot L1"]), JSON.stringify(castAt(1, 0)));
}

console.log("\n2. and the picker offers those levels");
{
  const card = readFileSync(resolve(ROOT, "src/core/ui/ActorCard.tsx"), "utf8");
  const code = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  /**
   * ⚠ THE MUTATION IS THE SHIPPED LINE. `mode === "freeCast" || mode === "pact"` is what returned
   * an empty list, and restoring it puts the bug straight back.
   */
  ok("a free cast is no longer excluded from the upcast picker",
    !/mode === "freeCast" \|\| mode === "pact"/.test(code));
  ok("...while a pact slot still is, because it casts at ONE fixed level",
    /mode === "pact"/.test(code));
  ok("...and the base level reports the FREE pool rather than a slot count",
    /mode === "freeCast" && level === base/.test(code));
}

console.log("\n3. and the cost column belongs to the author");
{
  /**
   * ⚠ REPRODUCED LIVE, 2026-09-10. Find Steed's cost cleared, saved, editor reopened — back to
   * "1/Long Rest". Christopher: *"i remove the 1/LR but keep the 1 free cast and it is reverting
   * the cost back to 1/LR."*
   *
   * `rowToAction` recomputed the label from the uses box on every save, so the column could not be
   * retyped OR cleared: both roads ended at the same derived string. `formatSlotLabel` already has
   * the right precedence — typed wins, blank derives "L{level}" — and a class feature needed no
   * exception to it, because what makes it one is `spellSlotMode`, set from the uses box and never
   * from the label.
   */
  const src = readFileSync(resolve(ROOT, "src/core/ui/SpellTableEditor.tsx"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  ok("the cost label is no longer forced from the uses box",
    !/isClassFeature\s*\?\s*`\$\{cfUses\}\/Long Rest`/.test(code));
  ok("...it comes from the shared formatter, which lets a typed value win",
    /const slotLabel = formatSlotLabel\(row\)/.test(code));
  ok("...and blank still derives the level rather than a pool label",
    /if \(row\.slotCost\.trim\(\)\) return row\.slotCost\.trim\(\)/.test(code));

  /**
   * ⚠ AND CLEARING THE LABEL MUST NOT REMOVE THE FREE CAST. They are different fields answering
   * different questions: the uses box decides whether the spell is a class feature, the label only
   * decides what the column reads. "Keep the 1 free cast" is the other half of the request.
   */
  ok("the free cast still comes from the uses box, not the label",
    /isClassFeature \? \{ spellSlotMode: "freeCast" as const, classFeatureUses: cfUses \}/.test(code));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
