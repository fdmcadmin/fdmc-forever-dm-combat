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
import { seedCampaignEquipmentLibrary, loadEquipmentLibrary, saveEquipmentLibrary } from "../src/core/ui/EquipmentBagEditor";
import { safeStorage } from "../src/core/utils/safeStorage";
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

/**
 * ⚠ A BROWSER THAT ALREADY SEEDED MUST STILL RECEIVE NEW ITEMS.
 *
 * `CAMPAIGN_EQUIPMENT_SEED_VERSION` was a hand-typed literal that had not changed since the initial
 * commit, and the seed returns early when the stored key matches it. So 0.8.12.6 added the v6
 * document's ten items — all seven Ward Field Rewards among them — and not one reached a DM who
 * had ever opened the app before. Christopher: *"i cant find the flask for the mending."* The
 * Fieldwork Flask had been in `equipmentLibrary.ts` for four versions.
 *
 * This asserts the thing that was actually broken: seed a store stamped with ANY older version and
 * every library item arrives. It fails the moment the version stops tracking the content again.
 */
{
  const KEY = "fdmc.dm.equipmentLibrary.campaign.seeded.v1";
  /**
   * ⚠ `safeStorage()`, NOT `globalThis.localStorage` — and the first version of this check used
   * the latter, which is UNDEFINED under node. The stale stamp was never written, the seed ran as
   * if on a fresh browser, and the gate passed against the original bug when I deliberately
   * restored it. A gate that cannot fail is worse than no gate: it converts an unknown into a
   * false assurance. The app writes through `safeStorage()`; so must anything measuring it.
   */
  const storage = safeStorage();
  const setKey = (v: string) => { try { storage.setItem(KEY, v); } catch { /* ignore */ } };

  /**
   * ⚠ THE STORE MUST BE EMPTIED FIRST, and leaving it full is how the SECOND version of this check
   * also failed to fail. The boot simulation at the top of this file already seeded 164 items, so
   * asserting "the items are present" after re-seeding proved nothing — they were present before
   * the call. Restoring the original bug still passed.
   *
   * A browser stuck on the old version is a store that DID NOT RECEIVE the new items. Emptying it
   * and stamping the old literal reproduces exactly that: with the bug, the guard returns early and
   * the store stays empty; with the fix, the fingerprint differs and everything arrives.
   */
  saveEquipmentLibrary([], "campaign");
  setKey("tbc-acts1-4-v5-focus-all-three");           // the literal that shipped for four versions
  seedCampaignEquipmentLibrary(BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS);
  const seeded = loadEquipmentLibrary("campaign");
  const missing = BROKEN_CHAIN_EQUIPMENT_LIBRARY
    .filter(i => !seeded.some(s => s.id === i.id))
    .map(i => i.name);
  console.log(`\nSeed after a stale version stamp: ${seeded.length} campaign items`);
  if (missing.length) {
    problems.push(`a browser on an older seed version never receives ${missing.length} item(s): ${missing.slice(0, 6).join(", ")}`);
  }

  // The seven the DM could not find. Named, so a regression says WHICH.
  for (const n of ["Sentry’s Knot", "Sighter’s Wrap", "Fieldwork Flask", "Hardedge Cord",
    "Reading Stone", "Pack-Sign Token", "Unspent Mark"]) {
    if (!seeded.some(i => i.name === n)) problems.push(`Ward Field Reward "${n}" did not reach the seeded library`);
  }

  // ...and it must not re-seed on every boot once current, or an unlock shadow is dropped each time.
  const stamped = (() => { try { return storage.getItem(KEY); } catch { return null; } })();
  seedCampaignEquipmentLibrary(BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS);
  const after = (() => { try { return storage.getItem(KEY); } catch { return null; } })();
  if (stamped !== null && stamped !== after) problems.push("the seed re-runs on every boot — the guard no longer holds");
}

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — every loot pool names a live encounter, no retired name survives a boot, and a browser on an older seed version receives every item.`);
