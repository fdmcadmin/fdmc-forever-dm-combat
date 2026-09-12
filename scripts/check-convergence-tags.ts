/**
 * EVERY CONVERGENCE ITEM SAYS WHERE IT CAME FROM, AND THE LABEL SURVIVES THE TRIP.
 *   npx tsx scripts/check-convergence-tags.ts
 *
 * Christopher, 2026-09-11: *"i want to add the A1-A4 back onto the convergence input items and then
 * the T1-T4 back onto the output items, this will help player to determine where they got those
 * items as well as … because with the system that seems to be the biggest limitation of getting
 * players to understand convergence."*
 *
 * ⚠ THE INPUTS NEVER LOST THEIR LABEL — THE APP LOST IT IN TRANSIT. All 33 have carried `actLabel`
 * since 0.7.1.0. `itemToAction` copied role and mechanicalTag only, so the moment a component was
 * attached to a character its provenance was gone; the chip then showed what it DID and never
 * where it came from, which is the half a recipe actually needs.
 *
 * So this gate asserts the whole road, not the data: labelled in the library, carried onto the
 * action, carried home by `actionToItem`, and printed on the chip.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY as LIB } from "../src/data/broken-chain/equipmentLibrary";
import { itemToAction, type EquipmentItem } from "../src/core/ui/EquipmentBagEditor";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

type Conv = { role?: string; mechanicalTag?: string; actLabel?: string; tier?: string };
const conv = LIB.filter(i => (i as unknown as { convergence?: Conv }).convergence);
const convOf = (i: unknown) => (i as { convergence?: Conv }).convergence!;

console.log("Every convergence item says where it came from\n");

console.log("1. the library labels all of them");
{
  const inputs = conv.filter(i => convOf(i).role === "input");
  const outputs = conv.filter(i => convOf(i).role === "output");
  ok("33 inputs", inputs.length === 33, String(inputs.length));
  ok("24 outputs", outputs.length === 24, String(outputs.length));

  const unlabelledIn = inputs.filter(i => !/^A[1-4]$/.test(convOf(i).actLabel ?? ""));
  ok("every input carries A1-A4", unlabelledIn.length === 0,
    unlabelledIn.map(i => i.name).join(", "));

  const unlabelledOut = outputs.filter(i => !/^T[1-4]$/.test(convOf(i).tier ?? ""));
  ok("every output carries T1-T4", unlabelledOut.length === 0,
    unlabelledOut.map(i => i.name).join(", "));

  /**
   * ⚠ THE COUNTS ARE THE DOCUMENT'S, NOT A SHAPE TEST. v6 states six Tier 1, ten Tier 2 ("Tier 2
   * catalog complete: ten outputs") and eight Tier 4 Singulars. A tier that drifts by one is a
   * transcription error, and only a count catches it.
   */
  const tier = (t: string) => outputs.filter(i => convOf(i).tier === t).length;
  ok("six Tier 1", tier("T1") === 6, String(tier("T1")));
  ok("ten Tier 2 — the document calls this catalog complete", tier("T2") === 10, String(tier("T2")));
  ok("eight Tier 4 Singulars", tier("T4") === 8, String(tier("T4")));
  /** ⚠ TIER 3 IS ABSENT ON PURPOSE — v6 describes sixteen and the app has never built them. */
  ok("mutation: no Tier 3 exists to be labelled", tier("T3") === 0, String(tier("T3")));

  const acts = (a: string) => conv.filter(i => convOf(i).actLabel === a).length;
  ok("inputs across all four acts", [acts("A1"), acts("A2"), acts("A3"), acts("A4")].every(n => n > 0),
    `A1=${acts("A1")} A2=${acts("A2")} A3=${acts("A3")} A4=${acts("A4")}`);
}

console.log("\n2. the label reaches the attached action");
{
  const input = LIB.find(i => i.name === "Crosspath Token")! as EquipmentItem;
  const output = LIB.find(i => i.name === "Anchor Thread")! as EquipmentItem;

  const a = itemToAction(input, false) as unknown as { metadata?: { convergence?: Conv; details?: string } };
  ok("an input carries its act onto the action", a.metadata?.convergence?.actLabel === "A3",
    JSON.stringify(a.metadata?.convergence));
  ok("...and the chip prints it", /◈ Convergence · A3/.test(a.metadata?.details ?? ""),
    a.metadata?.details?.slice(0, 80));

  const b = itemToAction(output, false) as unknown as { metadata?: { convergence?: Conv; details?: string } };
  ok("an output carries its tier", b.metadata?.convergence?.tier === "T1");
  ok("...and the chip prints that", /◈ Convergence · T1/.test(b.metadata?.details ?? ""),
    b.metadata?.details?.slice(0, 80));
}

console.log("\n3. and opening the editor does not strip it");
{
  /**
   * ⚠ THE RIDERS SHIPPED WITH EXACTLY THIS HOLE. `actionToItem` reads an attached action back into
   * an item and saving writes that item down, so a field missing there is deleted by the act of
   * LOOKING at the character: *"it deletes it if i open up the character editor."*
   */
  /**
   * Asserted on the SOURCE because `actionToItem` is component-local — the same reason
   * `check-item-riders` reads it this way. The list has to stay complete; `charges`, `riders` and
   * `convergence` are already here and each was a bug first.
   */
  const equip = codeOf("src/core/ui/EquipmentBagEditor.tsx");
  const at = equip.indexOf("function actionToItem");
  const body = equip.slice(at, equip.indexOf("\n  }", at));
  ok("actionToItem carries the act home", /actLabel: m\.convergence\.actLabel/.test(body));
  ok("...and the tier with it", /tier: m\.convergence\.tier/.test(body));

  const card = codeOf("src/core/ui/ActorCard.tsx");
  /**
   * The card backfills a mark for items attached before the field existed; it has to backfill the
   * provenance too or an old item reads as "convergence, source unknown".
   */
  ok("the card's backfill carries the act and tier",
    /actLabel: item\.convergence\.actLabel/.test(card) && /tier: item\.convergence\.tier/.test(card));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
