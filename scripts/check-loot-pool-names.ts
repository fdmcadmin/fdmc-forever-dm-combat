/**
 * A STALE LOOT POOL MUST NOT SURVIVE A BOOT — and a boot must not put one back.
 *   npx tsx scripts/check-loot-pool-names.ts
 *
 * Christopher: *"why am i still seeing loot tables that i cant get rid of."*
 *
 * Because they were being PUT BACK, once per load. A pool is not an object — it is the STRING in
 * an item's `sourceEncounter` — so there is nothing to delete, and the boot sequence ran
 * `migrateEncounterNames()` BEFORE `seedCampaignEquipmentLibrary()`. Clean the tags, then re-write
 * them from the seed, every time. And since the migration stamps itself done, it never got a
 * second chance.
 *
 * This simulates a browser that already ran the old migration, boots it in the CURRENT order, and
 * asserts nothing is tagged with a name no encounter carries.
 */
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS } from "../src/data/broken-chain/equipmentLibrary";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { seedCampaignEquipmentLibrary, loadEquipmentLibrary } from "../src/core/ui/EquipmentBagEditor";
import { seedEncounterLibraryFromTemplates, loadEncounterLibrary } from "../src/core/monsters/encounterLibrary";
import { migrateEncounterNames } from "../src/core/campaign/migrateEncounterNames";
import { BROKEN_CHAIN_ENCOUNTER_RENAMES } from "../src/modules/the-broken-chain/content/encounterRenames";

const problems: string[] = [];

// A browser mid-life: encounters seeded, equipment seeded, then the app boots.
seedEncounterLibraryFromTemplates(BROKEN_CHAIN_MONSTER_LIBRARY);
seedCampaignEquipmentLibrary(BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS);
migrateEncounterNames(true);

// Boot twice more in the CURRENT order. A converging sequence changes nothing on the second pass.
for (let boot = 0; boot < 2; boot++) {
  seedCampaignEquipmentLibrary(BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS);
  migrateEncounterNames(true);
}

const encounterNames = new Set(loadEncounterLibrary().map(e => e.name.trim()));
/**
 * Pool names that are deliberately not fights — merchants, quest rewards, base weapons.
 *
 * ⚠ `merchant` ADDED 2026-09-01. The v6 loot document's last purchasing window is the
 * "END-OF-ACT 2 TAVERN MERCHANT", and the pattern already excused every OTHER merchant by
 * accident — Northgate and Aldric both happen to be called a "STOCK". A window that sells things
 * is not a fight whichever noun it is named with, and the gate should not depend on the author
 * reaching for the one word it recognises.
 */
const NOT_A_FIGHT = /stock|reward|cottage|base weapon|convergence|merchant/i;

const pools = new Map<string, number>();
for (const owner of ["campaign", "dm"] as const) {
  for (const it of loadEquipmentLibrary(owner)) {
    for (const raw of [it.sourceEncounter, ...(it.sourceEncounters ?? [])]) {
      const k = raw?.trim();
      if (k) pools.set(k, (pools.get(k) ?? 0) + 1);
    }
  }
}

console.log(`loot pools after three boots (${pools.size} distinct):\n`);
for (const [name, n] of [...pools].sort()) {
  const live = encounterNames.has(name) || NOT_A_FIGHT.test(name);
  console.log(`   ${live ? "live  " : "ORPHAN"} ${String(n).padStart(3)}   "${name}"`);
  if (!live) problems.push(`"${name}" tags ${n} item(s) but no encounter carries that name`);
}

// And no pool may still be tagged with a name the rename map says is retired.
const retired = new Set(BROKEN_CHAIN_ENCOUNTER_RENAMES.flatMap(r => r.fromPools.map(p => p.trim())));
for (const name of pools.keys()) {
  if (retired.has(name)) problems.push(`"${name}" is a RETIRED pool name and is still in use — the migration did not reach it`);
}

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — every loot pool names a live encounter, and no retired name survives a boot.`);
