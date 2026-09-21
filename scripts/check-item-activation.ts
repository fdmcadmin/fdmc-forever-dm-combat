/**
 * DO ITEMS USE THE ACTION THEY DESCRIBE?
 *   npx tsx scripts/check-item-activation.ts
 *
 * Christopher: *"do a full equipment library sweep to make sure the items use the action they
 * describe"*, after: *"what about items with a charge cost, something like the Ashwood Brigandine,
 * the Repulsion Shield, and then there is bonus action charge items like the Gloamstep Shard and
 * Hollow Lantern."*
 *
 * ⚠ AN ITEM HAS TWO COSTS AND THE APP TRACKED ONE. `EquipmentItem` carried `charges` and no
 * activation, so the adapters guessed by shape: the attack row hard-coded an Action, the equipment
 * row charged nothing. Every reaction item in the library therefore cost a full Action, and every
 * bonus-action item cost nothing at all.
 *
 * This sweep REPORTS, in three buckets:
 *
 *   MISMATCH   the item's own text says one thing and the authored field says another (or the
 *              field has never been set)
 *   UNSTATED   neither the text nor the field says what it costs
 *   AGREED     counted, not listed
 *
 * ⚠ IT DOES NOT WRITE THE FIELD. The item's rules text is prose, and tagging from prose is the
 * rule this codebase keeps having to un-break. The reading is offered in the editor; the author
 * confirms it.
 *
 * ⚠ AND IT NO LONGER FAILS ON THE LIBRARY — ONLY ON ITS OWN READER.
 *
 * It used to fail when an item's authored activation contradicted what the reader made of its
 * text. The reader is a heuristic over prose, and on 2026-09-21 it read v11's Turnstep Relay — "you
 * can take a Reaction … before the creature moves or takes an action" — as costing an Action, and
 * that stopped Christopher's publish: *"again i am unable to push because things like this."* A
 * guess about prose must never block the author's own content. The library findings are printed for
 * the author; what FAILS is the reader getting a known sentence wrong — section 1 — which is a bug
 * in this code, not in anyone's authoring.
 *
 * It also reads the library AS IT SHIPS. It used to re-merge the author export over the finished
 * library with no date, which undid every published revision (the report showed pre-v9 names) and
 * brought back items retired for good.
 */
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY } from "../src/data/broken-chain/equipmentLibrary";
import { sweepItemActivation, isUsableItem, readActivation, ITEM_ACTIVATION_LABEL, type ItemActivation } from "../src/core/ui/itemActivation";
import type { EquipmentItem } from "../src/core/ui/EquipmentBagEditor";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("1. the reader gets the known sentences right — THIS is what fails the check\n");
{
  const reads = (text: string) => readActivation(text).activation;
  const cases: Array<[string, string, ItemActivation | undefined]> = [
    ["Turnstep Relay — the bearer's Reaction, triggered by a hostile, beside the hostile's own action",
      "When a hostile creature you can see within 30 feet starts its turn, you can take a Reaction to move up to half your current Speed without provoking Opportunity Attacks. You move before the creature moves or takes an action.",
      "reaction"],
    ["Redwake Shuttle — an ALLY's Reaction is not the bearer's cost",
      "After you resolve an attack that hits a hostile creature, you can prevent that creature from taking Reactions until the start of your next turn. One willing ally you can see within 30 feet can immediately take a Reaction to move up to 10 feet.",
      undefined],
    ["Gift of First Light — 'whenever you take the Magic action' is a trigger, not a cost",
      "First Light. While holding this staff in both hands, whenever you take the Magic action, add 1d6 plus your Proficiency Bonus to each damage or healing roll you make as part of that action.",
      undefined],
    ["Ashwood Brigandine — a plain Reaction",
      "When an attack hits you, you can take a Reaction to reduce its damage to you by 1d6.",
      "reaction"],
    ["Gloamstep Shard — a Bonus Action",
      "While you are in Dim Light or Darkness, you can take a Bonus Action to teleport up to 10 feet.",
      "bonus"],
    ["Wendigo Ember Heart — a Magic Action",
      "As a Magic Action, choose one creature you can see within 30 feet.",
      "action"],
    ["a creature's action alone is nobody's cost", "You move before the creature moves or takes an action.", undefined],
  ];
  for (const [label, text, expected] of cases) {
    const got = reads(text);
    ok(label, got === expected, `read ${got ?? "nothing"}, expected ${expected ?? "nothing"}`);
  }
  ok("MUTATION GUARD: a hostile named in the sentence does not hide a Reaction the bearer takes",
    readActivation("When a hostile creature hits you, you can take a Reaction to halve the damage.").activation === "reaction");
}

console.log("\n2. the library as it ships — for the author, never a failure\n");
{
  const library = BROKEN_CHAIN_EQUIPMENT_LIBRARY as EquipmentItem[];
  const usable = library.filter(isUsableItem);
  const findings = sweepItemActivation(library as never);
  const mismatch = findings.filter(f => f.kind === "mismatch");
  const unstated = findings.filter(f => f.kind === "unstated");

  console.log(`${library.length} items · ${usable.length} usable · ${usable.length - findings.length} already agree\n`);

  const contradictions = mismatch.filter(f => f.authored !== undefined);
  if (contradictions.length) {
    console.log(`── ${contradictions.length} authored with a cost the reader does not see in the text — check these in the editor ──`);
    for (const f of contradictions) {
      console.log(`  ${f.name.padEnd(30)} authored ${ITEM_ACTIVATION_LABEL[f.authored!].padEnd(13)} text reads ${f.reads ? ITEM_ACTIVATION_LABEL[f.reads] : "—"}`);
      console.log(`      "${f.evidence.replace(/\s+/g, " ").slice(0, 110)}"`);
    }
    console.log();
  }

  const unset = mismatch.filter(f => f.authored === undefined);
  if (unset.length) {
    console.log(`── ${unset.length} whose text names a cost the field has never been given (for information) ──`);
    for (const f of unset) console.log(`  ${f.name.padEnd(30)} text reads ${f.reads ? ITEM_ACTIVATION_LABEL[f.reads] : "—"}`);
    console.log();
  }

  if (unstated.length) {
    console.log(`── ${unstated.length} usable items that say nothing about what they cost (for information) ──`);
    console.log(`   Nothing to fix unless you want the card to charge an action: the text states no cost.`);
    for (const f of unstated) {
      console.log(`  ${f.name}${f.charges ? `  (${f.charges} charge${f.charges === 1 ? "" : "s"})` : ""}`);
    }
    console.log();
  }
}

if (failures) { console.error(`\nFAILED (${failures}) — the activation READER is wrong, not the library.`); process.exit(1); }
console.log("\nPASS — the reader reads every known sentence right. The library lists above are for the author and never fail a publish.");
