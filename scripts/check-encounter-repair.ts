/**
 * A STORED CAMPAIGN FIGHT WHOSE CREATURES WERE REPLACED MUST REPAIR ITSELF.
 *   npx tsx scripts/check-encounter-repair.ts
 *
 * This is the failure that stopped the author button: a browser seeded before the v3.23 rebuild
 * held The Last Court pointing at `walking-court` and `hushrunner`, so every export carried dead
 * references and `fold-authoring` refused it — correctly, since folding would have shipped two
 * Act 3 fights EMPTY. Re-exporting could not help, because it produced the same dead references.
 *
 * The check simulates exactly that browser and proves three things: the dead entries go, the
 * current creatures arrive, and an edit to an entry that still resolves survives untouched.
 */
import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import { seedEncounterLibraryFromTemplates, loadEncounterLibrary, saveEncounterLibrary } from "../src/core/monsters/encounterLibrary";

const known = new Set(L.map(t => t.templateId));
const problems: string[] = [];

// Seed once so the browser is ALREADY seeded — the real case. Without this the second call
// takes the first-boot path and re-derives everything, which is not what we are testing.
seedEncounterLibraryFromTemplates(L);

// A pre-rebuild campaign library: Last Court still on its old roster, plus an EDITED count on a
// fight whose creatures are all still live.
saveEncounterLibrary([
  {
    id: "act3-e7-the-last-court", name: "Act 3 - The Last Court", actTag: "Act 3", owner: "campaign",
    entries: [
      { templateId: "broken-chain:act3:walking-court:v1", count: 1, startingVisibility: "hp-bar" },
      { templateId: "broken-chain:act3:hushrunner:v1", count: 1, startingVisibility: "hp-bar" },
      { templateId: "broken-chain:act3:brandwing:v1", count: 1, startingVisibility: "hp-bar" },
    ],
  },
  {
    id: "act1-thornfang-pack", name: "A1 The Split Treeline", actTag: "Act 1", owner: "campaign",
    // A DM edit: four wolves, not the seeded two. Nothing here is stale.
    entries: [
      { templateId: "broken-chain:act1:thornfang-wolf:v1", count: 4, startingVisibility: "hp-bar" },
      { templateId: "broken-chain:act1:thornfang-packlord:v1", count: 1, startingVisibility: "hp-bar" },
    ],
  },
] as never, "campaign");

seedEncounterLibraryFromTemplates(L);
const after = loadEncounterLibrary("campaign");

const court = after.find(e => e.id === "act3-e7-the-last-court");
const dangling = (court?.entries ?? []).filter(e => !known.has(e.templateId));
console.log(`The Last Court after repair: ${(court?.entries ?? []).map(e => e.templateId.split(":")[2]).join(", ")}`);
if (dangling.length) problems.push(`still references missing creatures: ${dangling.map(e => e.templateId).join(", ")}`);
for (const want of ["blackbough-reeve", "gloam-harrow", "brandwing"]) {
  if (!(court?.entries ?? []).some(e => e.templateId.includes(want))) problems.push(`${want} was not restored`);
}

const pack = after.find(e => e.id === "act1-thornfang-pack");
const wolves = (pack?.entries ?? []).find(e => e.templateId.includes("thornfang-wolf"));
console.log(`A1 edited wolf count after repair: ${wolves?.count} (authored 4, seed says 2)`);
if (wolves?.count !== 4) problems.push(`a DM edit on a healthy fight was reset: wolf count ${wolves?.count}, expected 4`);

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — dead entries dropped, current creatures restored, unrelated DM edits untouched.`);
