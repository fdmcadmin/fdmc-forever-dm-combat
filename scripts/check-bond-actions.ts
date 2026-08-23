/**
 * Bond ladder -> clickable rows, every bond at every stage.
 *
 * Not a unit test suite: a printed proof that the generator reads the v13 templates rather than
 * guessing at them. Run it after any change to `bondActions.ts` or a re-extraction of the bonds.
 *   npx tsx scripts/check-bond-actions.ts
 */
import { generatedBondActions } from "../src/core/rules/bondActions";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../src/modules/the-broken-chain/content/bondTemplates";
import { BROKEN_CHAIN_BOND_GATES } from "../src/modules/the-broken-chain/content/bondGates";
import { TBC_MILESTONE } from "../src/modules/the-broken-chain/content/bondGates";

const LEVELS = [1, 3, 6, 9, 13];
let rows = 0;
let missingDice = 0;
const problems: string[] = [];

for (const tpl of BROKEN_CHAIN_BOND_TEMPLATES) {
  console.log(`\n=== ${tpl.name} (${tpl.id})${tpl.actor === "companion" ? " [companion]" : ""} ===`);
  for (const level of LEVELS) {
    for (const path of (level >= 6 ? [0, 1] : [undefined])) {
      const actions = generatedBondActions(
        tpl,
        { templateId: tpl.id, ...(path === undefined ? {} : { chosenPathIndex: path as 0 | 1 }) },
        { level, gates: BROKEN_CHAIN_BOND_GATES, milestones: [TBC_MILESTONE.act3BossDefeated] },
        { characterActorId: "pc-1", companionName: "Faelar" },
      );
      const tag = `L${level}${path === undefined ? "" : ` path${path}`}`;
      for (const a of actions) {
        rows++;
        const dice = a.metadata?.damage ?? "-";
        const kind = a.metadata?.effectKind ?? "-";
        if (a.metadata?.outcomeMode !== "passive" && dice === "-") missingDice++;
        console.log(`  ${tag.padEnd(12)} ${a.label.padEnd(28)} ${dice.padEnd(12)} ${kind.padEnd(10)} ${(a.tags ?? []).join(",")}`);
        if (/^[a-z]/.test(a.label)) problems.push(`${tpl.id} ${tag}: label starts lowercase -> "${a.label}"`);
        if (a.label.length > 40) problems.push(`${tpl.id} ${tag}: label too long -> "${a.label}"`);
      }
      if (actions.length === 0) problems.push(`${tpl.id} ${tag}: produced NO rows`);
    }
  }
}

// The gate: level 13 with the Act 3 boss still standing must hold at Metamorphosis.
const held = generatedBondActions(
  BROKEN_CHAIN_BOND_TEMPLATES[0],
  { templateId: BROKEN_CHAIN_BOND_TEMPLATES[0].id, chosenPathIndex: 0 },
  { level: 13, gates: BROKEN_CHAIN_BOND_GATES, milestones: [] },
);
console.log("\n=== gate: L13, Act 3 boss alive ===");
for (const a of held) console.log(`  ${a.label} | ${(a.tags ?? []).join(",")} | ${a.metadata?.damage ?? "-"}`);
if (!held.some(a => a.label.startsWith("Held at"))) problems.push("gate: no held-at note at L13 with the milestone unearned");
if (!held.some(a => (a.tags ?? []).some(t => t.includes("Metamorphosis")))) problems.push("gate: L13 did not hold at Metamorphosis");

console.log(`\nrows: ${rows} | rows with no dice (non-note): ${missingDice}`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log(" - " + p);
  process.exit(1);
}
console.log("OK");
