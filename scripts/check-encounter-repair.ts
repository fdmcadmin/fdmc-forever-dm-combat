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
import { seedEncounterLibraryFromTemplates, loadEncounterLibrary, saveEncounterLibrary, deleteEncounter, restoreEncounter } from "../src/core/monsters/encounterLibrary";
import { safeStorage } from "../src/core/utils/safeStorage";

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

/**
 * ─── A DELETION IS AUTHORING TOO ────────────────────────────────────────────────────────────
 *
 * ⚠ THE SEEDER USED TO OVERRULE IT, ONCE PER PUBLISH. The seed loop DERIVES an encounter from
 * every creature carrying an `encounterId`, and `ENCOUNTER_LIBRARY_SEED_VERSION` embeds
 * `AUTHORED_DIGEST` — which changes on every fold. So publishing anything re-seeded everything,
 * and every fight the author had deleted came back. Christopher, having deleted the same one
 * several times: *"i have had both the deleted mirror fight and the Wyrmling reseed"*, and
 * *"encounter that arent here."*
 *
 * Delete it, re-seed, and it must still be gone — then restore it and it must come back.
 *
 * ⚠ THE RE-SEED HAS TO BE FORCED, WHICH IS THE WHOLE POINT. `seedEncounterLibraryFromTemplates`
 * early-returns while the stored seed version matches, so calling it twice in a row does nothing
 * and a test that does that passes against the bug. In the app the version changes on its own —
 * it ENDS in `AUTHORED_DIGEST`, so every publish invalidates it. Clearing the key here is that
 * same event, reproduced.
 */
const forceReseed = () => {
  safeStorage().removeItem("fdmc.dm.encounterLibrary.seedVersion");
  seedEncounterLibraryFromTemplates(L);
};
const victim = after.find(e => e.entries.length > 0);
if (!victim) {
  problems.push("no seeded campaign encounter to test a deletion against");
} else {
  deleteEncounter(victim.id, "campaign");
  forceReseed();
  const stillGone = !loadEncounterLibrary("campaign").some(e => e.id === victim.id);
  console.log(`"${victim.name}" deleted, then re-seeded: ${stillGone ? "still gone" : "CAME BACK"}`);
  if (!stillGone) problems.push(`a deleted campaign fight was re-created by the seeder: ${victim.id}`);

  restoreEncounter(victim.id);
  forceReseed();
  const back = loadEncounterLibrary("campaign").some(e => e.id === victim.id);
  console.log(`"${victim.name}" restored, then re-seeded: ${back ? "back, and stays back" : "STILL SUPPRESSED"}`);
  if (!back) problems.push(`restoring a deleted fight did not lift its tombstone: ${victim.id}`);
}

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — dead entries dropped, current creatures restored, DM edits untouched, and a deletion survives a re-seed.`);
