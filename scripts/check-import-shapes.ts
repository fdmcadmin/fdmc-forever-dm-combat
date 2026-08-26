/**
 * THE ONE FILE A DM HAS MUST IMPORT EVERYWHERE ITS CONTENT BELONGS.
 *   npx tsx scripts/check-import-shapes.ts
 *
 * Christopher: *"when i try to import them and upload it they fail."*
 *
 * Three export formats name their payload three different ways — the equipment library writes
 * `items`, the monster library writes `monsters`, and the campaign author export writes all three
 * at once as `monsters` / `equipment` / `encounters`. The author export is the file a DM actually
 * has, so every importer has to read its own slice out of it. Equipment did not, and rejected it
 * for a key name.
 */
import { AUTHOR_EXPORT_SCHEMA } from "../src/core/campaign/authorExport";

const problems: string[] = [];

/** The exact shape `collectCampaignAuthoring` produces. */
const authorExport = {
  schema: AUTHOR_EXPORT_SCHEMA,
  exportedAt: new Date().toISOString(),
  digest: "fnv1a-test-1",
  monsters: [{ templateId: "t1", name: "Test" }],
  equipment: [{ id: "i1", name: "Test Item" }],
  encounters: [{ id: "e1", name: "Test Fight", entries: [] }],
};

/** What each importer looks for, mirrored here so a rename on either side fails loudly. */
const readers: Array<[string, (p: Record<string, unknown>) => unknown]> = [
  ["monster library", p => p.monsters ?? (Array.isArray(p) ? p : null)],
  ["equipment library", p => p.items ?? p.equipment ?? (Array.isArray(p) ? p : null)],
];

console.log(`author export keys: ${Object.keys(authorExport).join(", ")}\n`);
for (const [name, read] of readers) {
  const got = read(authorExport as unknown as Record<string, unknown>);
  const ok = Array.isArray(got) && got.length > 0;
  console.log(`  ${ok ? "reads" : "REJECTS"}   ${name}`);
  if (!ok) problems.push(`${name} cannot read the campaign author export`);
}

// And each importer must still accept its own single-purpose export unchanged.
const singles: Array<[string, Record<string, unknown>, (p: Record<string, unknown>) => unknown]> = [
  ["monster library export", { schema: "fdmc.monster-library.v1", monsters: [{ templateId: "x", name: "X" }] },
    p => p.monsters ?? null],
  ["equipment library export", { schema: "fdmc.equipment-library.v1", items: [{ id: "x", name: "X" }] },
    p => p.items ?? p.equipment ?? null],
];
console.log();
for (const [name, payload, read] of singles) {
  const got = read(payload);
  const ok = Array.isArray(got) && got.length > 0;
  console.log(`  ${ok ? "reads" : "REJECTS"}   its own ${name}`);
  if (!ok) problems.push(`${name} no longer reads its own format`);
}


/**
 * ─── THE ROUND TRIP, NOT JUST THE KEY NAME ──────────────────────────────────────────────────
 *
 * ⚠ THIS GATE PASSED THROUGHOUT THE FAILURE IT WAS WRITTEN FOR. Reading the right key is the
 * cheap half of "the one file a DM has must import everywhere its content belongs". The
 * expensive half is that importing it must not CHANGE what the content is — and it did:
 * `importMonsterLibrary` upserted with the default owner, which re-filed every campaign creature
 * as a private one and pruned the campaign copy. The export then could not see them.
 *
 * On 2026-08-26 that turned a 17-creature publish into a 6-creature one, two minutes later, with
 * no error anywhere. Christopher: *"why did none of my authored creatures move into the seed [...]
 * nothing is saving with the app."*
 *
 * So the gate is the round trip: export → import → export must return the same creatures. The
 * stores work in-process here — `safeStorage` falls back to an in-memory Storage when neither
 * browser store exists — so this exercises the real functions rather than a model of them.
 */
import { upsertMonsterTemplate, loadMonsterLibrary, importMonsterLibrary } from "../src/core/campaign/../monsters/dmMonsterLibrary";
import { collectCampaignAuthoring } from "../src/core/campaign/authorExport";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const creature = (templateId: string, name: string) => ({
  templateId, name,
  stats: { maxHp: 50, ac: 15 },
  abilities: [], actions: [],
  visibility: { defaultState: "hp-bar", hiddenName: name, revealedName: name },
} as unknown as MainMonsterTemplate);

const authored = creature("broken-chain:act9:round-trip-probe:v1", "Round Trip Probe");
const mine = creature("custom-round-trip-probe", "My Own Probe");

upsertMonsterTemplate(authored, "campaign");
upsertMonsterTemplate({ ...mine, dmEdited: { at: new Date().toISOString() } } as MainMonsterTemplate, "dm");

const firstExport = collectCampaignAuthoring();
const exportedIds = () => new Set(collectCampaignAuthoring().monsters.map(m => m.templateId));
console.log(`\n  exported before import: ${firstExport.monsters.length} creature(s)`);
if (!exportedIds().has(authored.templateId)) problems.push("a campaign creature was not in the export to begin with");

// The file the DM actually has — the whole author payload, handed back to the monster importer.
const file = new File([JSON.stringify(firstExport)], "fdmc-campaign-authoring.json", { type: "application/json" });
const result = await importMonsterLibrary(file);
console.log(`  re-imported: ${result.message}`);

const campaignIds = new Set(loadMonsterLibrary("campaign").map(t => t.templateId));
const after = exportedIds();
console.log(`  exported after import:  ${after.size} creature(s)`);

if (!campaignIds.has(authored.templateId)) {
  problems.push("importing the export moved a CAMPAIGN creature out of the campaign store — ownership must survive the round trip");
}
if (!after.has(authored.templateId)) {
  problems.push("a campaign creature vanished from the export after being re-imported — this is the 17-to-6 collapse");
}
if (!after.has(mine.templateId)) {
  problems.push("a DM creature vanished from the export after being re-imported");
}
if (after.size < firstExport.monsters.length) {
  problems.push(`the export SHRANK across a round trip: ${firstExport.monsters.length} -> ${after.size}`);
}

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — the author export imports everywhere its content belongs, single-purpose exports still work, and a creature's owner survives the round trip.`);
