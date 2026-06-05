/**
 * generateActorExport.ts
 *
 * Generates a private actor library JSON from the bundled source actor files.
 * Run: npx tsx scripts/generateActorExport.ts
 *
 * Output: fdmc-actor-library-export.json in the project root (NOT dist).
 * This file is your private backup — import it via Edit Actors → ↑ Import.
 *
 * The private/ folder and this output file should NEVER be committed to a
 * public repository or deployed to Cloudflare.
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { klydon } from "../src/private/klydon";
import { kolakanathi } from "../src/private/kolakanathi";
import { lightsStone } from "../src/private/lights_stone";
import { lyrielleNew } from "../src/private/lyrielle_new";
import { vaelithNew } from "../src/private/vaelith_new";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const actors = [klydon, kolakanathi, lightsStone, lyrielleNew, vaelithNew];

const exportData = {
  schema: "fdmc.actor-library-export.v1",
  exportedAt: new Date().toISOString(),
  version: "0.6.0",
  actors: Object.fromEntries(actors.map(a => [a.id, a])),
  overrides: {},
  equipment: [],
};

const outputPath = resolve(__dirname, "../fdmc-actor-library-export.json");
writeFileSync(outputPath, JSON.stringify(exportData, null, 2), "utf8");

console.log(`✓ Exported ${actors.length} actors to: ${outputPath}`);
actors.forEach(a => console.log(`  · ${a.name} — ${a.className} Level ${a.level}`));
console.log("\nImport this file via Edit Actors → ↑ Import → pick the file → ↺ Sync Library.");
