/**
 * generateCampaignPacks.ts
 *
 * Emits the private campaign content packs from src/private (gitignored, NOT bundled
 * into dist) as importable JSON files:
 *   - fdmc-monster-pack.json    → DM imports via Monsters → "↑ Campaign Pack"
 *   - fdmc-equipment-pack.json  → DM imports via Equipment → "↑ Campaign Pack"
 *
 * Run: npx tsx scripts/generateCampaignPacks.ts   (or: npm run generate-packs)
 *
 * Output files are private campaign data — gitignored, never committed/deployed.
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/private/monsterLibrary";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY } from "../src/private/equipmentLibrary";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = (name: string) => resolve(__dirname, "..", name);

writeFileSync(
  out("fdmc-monster-pack.json"),
  JSON.stringify({ schema: "fdmc.monster-library.v1", exportedAt: new Date().toISOString(), monsters: BROKEN_CHAIN_MONSTER_LIBRARY }, null, 2),
  "utf8",
);
writeFileSync(
  out("fdmc-equipment-pack.json"),
  JSON.stringify({ schema: "fdmc.equipment-library.v1", exportedAt: new Date().toISOString(), items: BROKEN_CHAIN_EQUIPMENT_LIBRARY }, null, 2),
  "utf8",
);

console.log(`✓ fdmc-monster-pack.json   — ${BROKEN_CHAIN_MONSTER_LIBRARY.length} campaign monsters`);
console.log(`✓ fdmc-equipment-pack.json — ${BROKEN_CHAIN_EQUIPMENT_LIBRARY.length} campaign items`);
console.log("\nImport these in-app: Monsters / Equipment → ↑ Campaign Pack. Private — do not commit/deploy.");
