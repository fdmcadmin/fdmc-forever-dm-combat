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

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — the author export imports everywhere its content belongs, and single-purpose exports still work.`);
