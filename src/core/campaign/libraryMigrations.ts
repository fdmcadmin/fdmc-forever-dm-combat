/**
 * THE LIBRARY SEEDS AND MIGRATIONS — LOADED ON DEMAND, NEVER ON THE WAY TO A SEAT.
 *
 * Christopher, 2026-09-15: *"this needs to be on the player side for the size because the issue is they get
 * stuck on loading the seat"* — a player on a desktop with a slower connection and an older PC.
 *
 * These ran in `App`'s first render, so their DATA was a static import of the main window: the Broken Chain
 * equipment library and its authored items (~330KB) and the whole monster library with the SRD (~1.1MB).
 * Every byte had to download and parse before the app mounted, and the app has to mount before a player can
 * claim a seat. A player waited on the GM's monster catalogue to sit down.
 *
 * Each step is idempotent and version-keyed, exactly as before; only WHEN changes. `App` imports this module
 * with `import()` after its first render. The monster-library repair is the GM's alone (it repairs creatures
 * the GM saved) and loads its data only when the viewer is the GM.
 *
 * ⚠ THE ORDER INSIDE IS UNCHANGED: repair, seed, base weapons, rename, feats. Seed first, then migrate what the
 * seed just wrote — see the note this replaced in App.tsx.
 */
import { repairEquipmentLibraries, seedCampaignEquipmentLibrary, seedBaseWeapons } from "../ui/EquipmentBagEditor";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS } from "../../data/broken-chain/equipmentLibrary";
import { migrateEncounterNames } from "./migrateEncounterNames";
import { migrateFeatsIntoFeatures } from "./migrateFeatsIntoFeatures";
import { loadActorLibrary, saveActorLibrary } from "../seats/dmActorLibrary";

export type LibraryMigrationReport = { featsMoved: number };

/** Everything every viewer's storage needs: the equipment catalogue, encounter names, the feats tab. */
export function runLibraryMigrations(): LibraryMigrationReport {
  repairEquipmentLibraries();
  seedCampaignEquipmentLibrary(BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS);
  seedBaseWeapons();
  migrateEncounterNames();
  const feats = migrateFeatsIntoFeatures(loadActorLibrary, saveActorLibrary);
  return { featsMoved: feats.moved };
}

/**
 * ⚠ A FIX TO THE SHIPPED LIBRARY DOES NOT REACH A CREATURE THE DM HAS SAVED.
 *
 * 0.7.60.7 removed a resistance row that was being counted twice. A stored copy outranks the shipped template
 * by design, so every creature the DM had already edited kept the doubled row. This removes ONE row and leaves
 * every other edit alone. GM only: a player's storage holds no creatures, and loading 1.1MB to learn that is
 * the cost this module exists to stop paying.
 */
export async function runGmMonsterRepairs(): Promise<void> {
  const [{ repairDuplicateResistance }, { BROKEN_CHAIN_MONSTER_LIBRARY }] = await Promise.all([
    import("./repairDuplicateResistance"),
    import("../../data/broken-chain/monsterLibrary"),
  ]);
  repairDuplicateResistance(BROKEN_CHAIN_MONSTER_LIBRARY);
}
