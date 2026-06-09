/**
 * Encounter Library — DM localStorage manager for encounter definitions
 *
 * An encounter = a named composition of monster templates with spawn settings.
 * The library is DM-local. Loading an encounter spawns live instances into the
 * combat roster (monsterCandidates state in App.tsx).
 */

import type { MainMonsterTemplate, MainEncounterMonsterInstance, MainMonsterVisibilityState } from "./runtime/mainMonsterRuntime";
import { createEncounterMonsterInstance } from "./runtime/mainMonsterRuntime";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EncounterMonsterEntry = {
  templateId: string;
  count: number;
  hpVariant: "standard" | "low" | "high";
  startingVisibility: MainMonsterVisibilityState;
  hiddenNameOverride?: string;
};

export type EncounterDefinition = {
  id: string;
  name: string;
  actTag?: string;
  order?: number;
  notes?: string;
  dmNotes?: string;
  entries: EncounterMonsterEntry[];
  /** Which library this encounter belongs to */
  owner?: EncounterLibraryOwner;
  /**
   * Loot pool tag for this encounter. The pool is the set of equipment items whose
   * `sourceEncounter` matches this tag. Defaults to the encounter's own `name` when
   * unset, so a fresh boss/merchant automatically owns a loot pool of the same name.
   */
  lootPool?: string;
};

// ─── Library ownership ────────────────────────────────────────────────────────

export type EncounterLibraryOwner = "campaign" | "dm";

// ─── Storage keys ─────────────────────────────────────────────────────────────

/** Campaign library — seeded from bundled templates, module-locked */
const CAMPAIGN_LIBRARY_KEY = "fdmc.dm.encounterLibrary.campaign.v1";
/** DM custom library — personal encounters, no module lock required */
const DM_LIBRARY_KEY = "fdmc.dm.encounterLibrary.custom.v1";
/** Unused/archived encounters — moved here on delete, never hard deleted */
const UNUSED_LIBRARY_KEY = "fdmc.dm.encounterLibraryUnused.v1";
/** Legacy key — migrated on first load */
const ENCOUNTER_LIBRARY_KEY = "fdmc.dm.encounterLibrary.v1";
const ENCOUNTER_LIBRARY_SEED_KEY = "fdmc.dm.encounterLibrary.seedVersion";
const ENCOUNTER_LIBRARY_SEED_VERSION = "0.6.0-act2-broken-chain";

// ─── Storage operations ───────────────────────────────────────────────────────

function keyForOwner(owner: EncounterLibraryOwner): string {
  return owner === "campaign" ? CAMPAIGN_LIBRARY_KEY : DM_LIBRARY_KEY;
}

export function loadEncounterLibrary(owner?: EncounterLibraryOwner): EncounterDefinition[] {
  if (owner) {
    try {
      const raw = window.localStorage.getItem(keyForOwner(owner));
      const items = raw ? JSON.parse(raw) as EncounterDefinition[] : [];
      return items.map(e => ({ ...e, owner }));
    } catch {
      return [];
    }
  }
  // Load both, campaign first
  const campaign = loadEncounterLibrary("campaign");
  const dm = loadEncounterLibrary("dm");
  // Migrate legacy key if needed
  try {
    const legacy = window.localStorage.getItem(ENCOUNTER_LIBRARY_KEY);
    if (legacy) {
      const items = JSON.parse(legacy) as EncounterDefinition[];
      // Migrate to campaign library
      const campaignLib = loadEncounterLibrary("campaign");
      for (const item of items) {
        if (!campaignLib.find(e => e.id === item.id)) {
          campaignLib.push({ ...item, owner: "campaign" });
        }
      }
      saveEncounterLibrary(campaignLib, "campaign");
      window.localStorage.removeItem(ENCOUNTER_LIBRARY_KEY);
    }
  } catch { /* ok */ }
  return [...campaign, ...dm];
}

export function saveEncounterLibrary(library: EncounterDefinition[], owner: EncounterLibraryOwner): void {
  try {
    window.localStorage.setItem(keyForOwner(owner), JSON.stringify(library));
  } catch {
    // localStorage unavailable
  }
}

export function upsertEncounter(encounter: EncounterDefinition, owner?: EncounterLibraryOwner): void {
  const target = owner ?? encounter.owner ?? "dm";
  const library = loadEncounterLibrary(target);
  const idx = library.findIndex(e => e.id === encounter.id);
  const tagged = { ...encounter, owner: target };
  if (idx === -1) library.push(tagged);
  else library[idx] = tagged;
  saveEncounterLibrary(library, target);
}

export function loadUnusedEncounters(): EncounterDefinition[] {
  try {
    const raw = window.localStorage.getItem(UNUSED_LIBRARY_KEY);
    return raw ? JSON.parse(raw) as EncounterDefinition[] : [];
  } catch {
    return [];
  }
}

function saveUnusedEncounters(library: EncounterDefinition[]): void {
  try {
    window.localStorage.setItem(UNUSED_LIBRARY_KEY, JSON.stringify(library));
  } catch { /* ok */ }
}

/** Archive an encounter to the unused list instead of hard deleting it. */
export function deleteEncounter(id: string, owner?: EncounterLibraryOwner): void {
  // Find the encounter before removing it
  const all = loadEncounterLibrary();
  const encounter = all.find(e => e.id === id);

  // Remove from active libraries
  if (owner) {
    saveEncounterLibrary(loadEncounterLibrary(owner).filter(e => e.id !== id), owner);
  } else {
    saveEncounterLibrary(loadEncounterLibrary("campaign").filter(e => e.id !== id), "campaign");
    saveEncounterLibrary(loadEncounterLibrary("dm").filter(e => e.id !== id), "dm");
  }

  // Archive to unused — don't add duplicates
  if (encounter) {
    const unused = loadUnusedEncounters();
    if (!unused.find(e => e.id === encounter.id)) {
      saveUnusedEncounters([...unused, encounter]);
    }
  }
}

/** Restore an archived encounter back to the active library. */
export function restoreEncounter(id: string): void {
  const unused = loadUnusedEncounters();
  const encounter = unused.find(e => e.id === id);
  if (!encounter) return;
  // Move out of unused
  saveUnusedEncounters(unused.filter(e => e.id !== id));
  // Put back in the correct active library
  upsertEncounter(encounter, encounter.owner ?? "dm");
}

/** Permanently remove an archived encounter from the unused list (cannot be restored). */
export function permanentlyDeleteEncounter(id: string): void {
  saveUnusedEncounters(loadUnusedEncounters().filter(e => e.id !== id));
}

// ─── Seed from bundled Act 2 data ────────────────────────────────────────────

/**
 * Seeds the encounter library from the bundled monster library on first boot.
 * Groups templates by encounterId.
 */
export function seedEncounterLibraryFromTemplates(templates: MainMonsterTemplate[]): EncounterDefinition[] {
  const stored = window.localStorage.getItem(ENCOUNTER_LIBRARY_SEED_KEY);
  const existing = loadEncounterLibrary();

  if (stored === ENCOUNTER_LIBRARY_SEED_VERSION && existing.length > 0) {
    return existing;
  }

  // Group templates by encounterId
  const byEncounter = new Map<string, MainMonsterTemplate[]>();
  for (const template of templates) {
    if (!template.encounterId) continue;
    if (!byEncounter.has(template.encounterId)) byEncounter.set(template.encounterId, []);
    byEncounter.get(template.encounterId)!.push(template);
  }

  const seeded: EncounterDefinition[] = [];

  for (const [encounterId, encounterTemplates] of byEncounter) {
    const first = encounterTemplates[0];
    seeded.push({
      id: encounterId,
      name: first.encounterLabel ?? encounterId,
      actTag: encounterId.startsWith("act1") ? "Act 1" : encounterId.startsWith("act2") ? "Act 2" : undefined,
      entries: encounterTemplates.map(t => ({
        templateId: t.templateId,
        count: 1,
        hpVariant: "standard",
        startingVisibility: t.visibility.defaultState,
        hiddenNameOverride: t.visibility.hiddenName,
      })),
    });
  }

  // Merge with existing (don't overwrite user edits)
  const merged = [...seeded];
  for (const existing of loadEncounterLibrary()) {
    if (!merged.find(e => e.id === existing.id)) merged.push(existing);
  }

  saveEncounterLibrary(merged, "campaign");
  try { window.localStorage.setItem(ENCOUNTER_LIBRARY_SEED_KEY, ENCOUNTER_LIBRARY_SEED_VERSION); } catch { /* ok */ }
  return merged;
}

// ─── Spawn instances from encounter ──────────────────────────────────────────

export function spawnEncounterInstances(
  encounter: EncounterDefinition,
  library: MainMonsterTemplate[]
): MainEncounterMonsterInstance[] {
  const instances: MainEncounterMonsterInstance[] = [];

  for (const entry of encounter.entries) {
    const template = library.find(t => t.templateId === entry.templateId);
    if (!template) continue;

    for (let i = 0; i < entry.count; i++) {
      const instance = createEncounterMonsterInstance(template);

      // Apply HP variant
      if (entry.hpVariant === "low") {
        const low = Math.max(1, Math.floor(instance.maxHp * 0.75));
        instance.currentHp = low;
        instance.maxHp = low;
      } else if (entry.hpVariant === "high") {
        const high = Math.floor(instance.maxHp * 1.25);
        instance.currentHp = high;
        instance.maxHp = high;
      }

      instance.visibilityState = entry.startingVisibility;
      instance.isNameRevealed = entry.startingVisibility === "full";
      if (entry.hiddenNameOverride) instance.hiddenName = entry.hiddenNameOverride;

      // Number multiple instances: "Worg A", "Worg B"
      if (entry.count > 1) {
        const suffix = String.fromCharCode(65 + i); // A, B, C...
        instance.displayName = `${template.name} ${suffix}`;
        instance.revealedName = `${template.visibility.revealedName || template.name} ${suffix}`;
      }

      instances.push(instance);
    }
  }

  return instances;
}
