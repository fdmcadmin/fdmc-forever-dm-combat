/**
 * ENCOUNTER RENAME MIGRATION — move a fight and its loot pool together.
 *
 * ⚠ WHY THIS IS ONE OPERATION AND NOT TWO.
 *
 * A loot pool IS its name. Every item is tied to a fight by the literal string in
 * `sourceEncounter` / `sourceEncounters`, and the library groups by matching that string. So
 * renaming an encounter WITHOUT re-tagging its loot does not move the loot — it orphans it. The
 * items still exist, still name a fight that no longer goes by that name, and appear under a pool
 * heading nothing else belongs to. The Gifts are the sharp case: eight items tagged
 * "Act 3 - Gate II: The Mirrors" all vanish from Gate II the moment it becomes "Open Clearing".
 *
 * Runs once, keyed by version, the same way `repairEquipmentLibraries` does.
 */

import { loadEncounterLibrary, saveEncounterLibrary } from "../monsters/encounterLibrary";
import { loadEquipmentLibrary, saveEquipmentLibrary } from "../ui/EquipmentBagEditor";
import { BROKEN_CHAIN_ENCOUNTER_RENAMES } from "../../modules/the-broken-chain/content/encounterRenames";

const RENAME_KEY = "fdmc.encounterNames.migration.v1";
const RENAME_VERSION = "0.7.27-acts1-3-named-scenes";

export type RenameReport = { encounters: number; items: number; pools: string[] };

export function migrateEncounterNames(force = false): RenameReport {
  const report: RenameReport = { encounters: 0, items: 0, pools: [] };
  try {
    if (!force && window.localStorage.getItem(RENAME_KEY) === RENAME_VERSION) return report;
  } catch { return report; }

  /**
   * Old pool name -> new pool name. Built from every `fromPools` entry, plus the encounter's
   * CURRENT name, because a library that has already been half-renamed by hand still needs its
   * loot moved and the current name is the only thing those items can be tagged with.
   */
  const poolMap = new Map<string, string>();

  // ── 1. Encounters ─────────────────────────────────────────────────────────
  for (const owner of ["campaign", "dm"] as const) {
    const lib = loadEncounterLibrary(owner);
    let changed = false;
    const next = lib.map(enc => {
      const rule = BROKEN_CHAIN_ENCOUNTER_RENAMES.find(r => r.id === enc.id);
      if (!rule) return enc;
      // Whatever it is called right now also has to be re-tagged, not just the authored old names.
      for (const from of [...rule.fromPools, enc.name]) {
        if (from && from !== rule.to) poolMap.set(from.trim(), rule.to);
      }
      if (enc.name === rule.to) return enc;      // already migrated
      changed = true;
      report.encounters++;
      report.pools.push(`${enc.name} → ${rule.to}`);
      return { ...enc, name: rule.to };
    });
    if (changed) saveEncounterLibrary(next, owner);
  }

  // ── 2. The loot that points at them ───────────────────────────────────────
  for (const owner of ["campaign", "dm"] as const) {
    const lib = loadEquipmentLibrary(owner);
    let changed = false;
    const next = lib.map(item => {
      const primary = item.sourceEncounter?.trim();
      const extras = item.sourceEncounters ?? [];
      const newPrimary = primary && poolMap.get(primary);
      const newExtras = extras.map(e => poolMap.get(e.trim()) ?? e);
      const extrasChanged = newExtras.some((e, i) => e !== extras[i]);
      if (!newPrimary && !extrasChanged) return item;
      changed = true;
      report.items++;
      return {
        ...item,
        ...(newPrimary ? { sourceEncounter: newPrimary } : {}),
        // De-duplicate: a rename can collapse a primary and an extra onto the same name, and an
        // item listed twice in one pool shows twice in that pool.
        ...(extrasChanged
          ? { sourceEncounters: [...new Set(newExtras)].filter(e => e !== (newPrimary ?? primary)) }
          : {}),
      };
    });
    if (changed) saveEquipmentLibrary(next, owner);
  }

  try { window.localStorage.setItem(RENAME_KEY, RENAME_VERSION); } catch { /* ok */ }
  return report;
}
