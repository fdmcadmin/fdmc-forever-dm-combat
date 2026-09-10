/**
 * A RIDER ON A PLAIN WEAPON REACHES THE SWING — three gates, one feature.
 *   npx tsx scripts/check-item-riders.ts
 *
 * Christopher, 2026-09-10: *"things like the rimecleaver and some of the wendigo wights cant be
 * built correctly because the per turn rider on weapons are only on the gift chassis not the
 * regular weapons"*, then: *"so you are saying i still cant add the riders on the equipment, why
 * was it stopped before it was corrected to where i could author these."*
 *
 * ⚠ THREE GATES STOOD IN FRONT OF ONE FEATURE, AND EACH ONE HID THE NEXT.
 *
 *   1. the editor could not WRITE a rider on a plain weapon — the control sat inside the chassis
 *      panel, behind `const on = Boolean(spec)`
 *   2. `itemToAttackAction` did not CARRY one onto the swing — it took attack, damage, crit,
 *      range and charges, and dropped riders
 *   3. the card did not READ one — `turnRiders` looked at `metadata.turnRider` and nothing else
 *
 * Fixing any ONE of them alone would have looked like it worked and changed nothing a player could
 * see, which is exactly why this gate asserts the whole road rather than any single hop.
 *
 * Measured before: 8 of 164 authored items carried a rider, and all eight were Gift chassis items.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { itemToAttackAction, itemToAction, type EquipmentItem } from "../src/core/ui/EquipmentBagEditor";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Rimecleaver as the document prints it: a plain greatsword, no chassis. */
const rimecleaver = {
  id: "rimecleaver", name: "Rimecleaver", type: "weapon", description: "",
  isUsable: true, attack: "1d20+@STR+@PROF+1", damage: "2d6+@STR+1",
  riders: [{ id: "rimebite", label: "Rimebite", formula: "1d6", damageType: "Cold", cadence: "perTurn" }],
} as unknown as EquipmentItem;

console.log("A rider on a plain weapon reaches the swing\n");

console.log("1. the editor can write one without a chassis");
{
  const chassis = codeOf("src/core/ui/ChassisFields.tsx");
  /**
   * ⚠ THE MUTATION IS THE SHIPPED SHAPE: the Riders block inside `{on && …}`. It is asserted by
   * POSITION — the block has to start after the chassis conditional closes.
   */
  const gateAt = chassis.indexOf("{on && (");
  const ridersAt = chassis.indexOf("set(\"riders\"");
  const closeAt = chassis.indexOf("      )}", gateAt);
  ok("the chassis panel is still gated on being a chassis", gateAt > 0);
  ok("...and the Riders control is OUTSIDE that gate", ridersAt > closeAt && closeAt > 0,
    `riders@${ridersAt} close@${closeAt}`);
}

console.log("\n2. the weapon's ATTACK action carries it");
{
  const swing = itemToAttackAction(rimecleaver, false) as unknown as { metadata?: Record<string, unknown> };
  const riders = (swing.metadata?.riders ?? []) as Array<{ formula?: string }>;
  ok("the swing carries the rider", riders.length === 1, JSON.stringify(riders));
  ok("...with its dice", riders[0]?.formula === "1d6", String(riders[0]?.formula));

  // The generic item-use action always carried them; it must keep doing so.
  const use = itemToAction(rimecleaver, false) as unknown as { metadata?: Record<string, unknown> };
  ok("the item-use action still carries it too", ((use.metadata?.riders ?? []) as unknown[]).length === 1);

  /**
   * ⚠ AND AN ITEM WITH NO RIDER GAINS NO EMPTY FIELD. An `riders: []` on every weapon would make
   * "has a rider" untestable everywhere downstream.
   */
  const plain = itemToAttackAction({ ...rimecleaver, riders: undefined } as EquipmentItem, false) as unknown as { metadata?: Record<string, unknown> };
  ok("mutation: no rider authored, no riders field", plain.metadata?.riders === undefined);
}

console.log("\n3. the card reads it, through the chip it already had");
{
  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("turnRiders reads equipment riders as well as authored ones",
    /a\.metadata\?\.riders \?\? \[\]/.test(card));
  ok("...keyed per RIDER, because a weapon may print two",
    /::rider::/.test(card));
  /**
   * ⚠ ONLY THE PER-TURN CADENCES. A shortRest or perEncounter rider has a different reset, and
   * treating it as per-turn would hand the table a once-a-rest effect every round.
   */
  ok("...and only the per-turn cadences are claimed here",
    /r\.cadence === "perTurn" \|\| r\.cadence === "perRound"/.test(card));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
