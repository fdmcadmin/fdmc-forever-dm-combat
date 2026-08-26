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
 * This sweep reports, in three buckets:
 *
 *   MISMATCH   the item's own text says one thing and the authored field says another (or the
 *              field has never been set) — the ones to fix
 *   UNSTATED   neither the text nor the field says what it costs — a real gap, but one only the
 *              author can close, because the item does not say
 *   AGREED     counted, not listed
 *
 * ⚠ IT DOES NOT WRITE THE FIELD. The item's rules text is prose, and tagging from prose is the
 * rule this codebase keeps having to un-break. The reading is offered in the editor; the author
 * confirms it.
 *
 * It FAILS on nothing today — the whole library predates the field, so every usable item would be
 * a finding and a red gate nobody can turn green is a gate that gets ignored. What it does fail on
 * is a MISMATCH: an item that has been given an activation which contradicts its own text.
 */
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY } from "../src/data/broken-chain/equipmentLibrary";
import { AUTHORED_EQUIPMENT, mergeAuthored } from "../src/data/broken-chain/authored.generated";
import { sweepItemActivation, isUsableItem, ITEM_ACTIVATION_LABEL } from "../src/core/ui/itemActivation";
import type { EquipmentItem } from "../src/core/ui/EquipmentBagEditor";

const problems: string[] = [];

// The library as it actually SHIPS — authored items merged over the hand-written seed by id.
const library = mergeAuthored(
  BROKEN_CHAIN_EQUIPMENT_LIBRARY as EquipmentItem[],
  AUTHORED_EQUIPMENT as EquipmentItem[],
  i => i.id,
);

const usable = library.filter(isUsableItem);
const findings = sweepItemActivation(library as never);
const mismatch = findings.filter(f => f.kind === "mismatch");
const unstated = findings.filter(f => f.kind === "unstated");

console.log(`${library.length} items · ${usable.length} usable · ${usable.length - findings.length} already agree\n`);

if (mismatch.length) {
  console.log(`── ${mismatch.length} that do NOT use the action they describe ──`);
  for (const f of mismatch) {
    const says = f.reads ? ITEM_ACTIVATION_LABEL[f.reads] : "—";
    const has = f.authored ? ITEM_ACTIVATION_LABEL[f.authored] : "(never set)";
    const charge = f.charges ? ` +${f.charges} charge${f.charges === 1 ? "" : "s"}` : "";
    console.log(`  ${f.name.padEnd(30)} text says ${says.padEnd(13)} field says ${has}${charge}`);
    console.log(`      "${f.evidence.replace(/\s+/g, " ").slice(0, 110)}"`);
  }
  console.log();
}

if (unstated.length) {
  console.log(`── ${unstated.length} usable items that say nothing about what they cost ──`);
  console.log(`   Only the author can close these: the item does not state a cost, so nothing may infer one.`);
  for (const f of unstated) {
    console.log(`  ${f.name}${f.charges ? `  (${f.charges} charge${f.charges === 1 ? "" : "s"})` : ""}`);
  }
  console.log();
}

/**
 * ⚠ THE ONE HARD FAILURE: a field that CONTRADICTS the item's own text. An unset field is work
 * still to do; a set one that disagrees is a wrong answer already shipped, and it will cost a
 * player their turn at the table.
 */
const contradictions = mismatch.filter(f => f.authored !== undefined);
if (contradictions.length) {
  for (const f of contradictions) {
    problems.push(`${f.name} is authored as ${ITEM_ACTIVATION_LABEL[f.authored!]} but its own text says ${ITEM_ACTIVATION_LABEL[f.reads!]}`);
  }
}

if (problems.length) { console.error(`FAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`PASS — no item is authored with an activation that contradicts its own rules text.`);
