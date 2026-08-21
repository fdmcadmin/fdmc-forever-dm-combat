/**
 * Encounter Library — DM localStorage manager for encounter definitions
 *
 * An encounter = a named composition of monster templates with spawn settings.
 * The library is DM-local. Loading an encounter spawns live instances into the
 * combat roster (monsterCandidates state in App.tsx).
 */

import type { MainMonsterTemplate, MainEncounterMonsterInstance, MainMonsterVisibilityState, MonsterClassification, MonsterArchetype, MonsterBond } from "./runtime/mainMonsterRuntime";
import { createEncounterMonsterInstance } from "./runtime/mainMonsterRuntime";
import { actTagForId } from "../campaign/actTags";
import { materializeTemplateBody } from "./actionSetPicks";
import { hpForPartySize, BASELINE_PARTY_SIZE } from "../encounter-band/partyCurveV2";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EncounterMonsterEntry = {
  templateId: string;
  count: number;
  startingVisibility: MainMonsterVisibilityState;
  hiddenNameOverride?: string;
  /**
   * @deprecated Per-creature party-size band. The band is a property of the FIGHT (Lever 1
   * of ENCOUNTER-BALANCE-RULES), not of each body in it — authoring it per row allowed a
   * boss scaled for 5 players to stand next to its adds scaled for 3, and let the HP side
   * of the estimate disagree with the party size driving party DPR.
   *
   * Retained only so encounters already saved to localStorage still parse. Nothing reads it:
   * scaling now comes from `hpForPartySize(base, partySize)` applied to the whole encounter.
   */
  hpVariant?: "standard" | "low" | "high";
  /**
   * THE BODIES BUILT FROM A TEMPLATE ENTRY.
   *
   * Christopher: *"the bodies arent generated because a DM has to set those in the 'campaign
   * encounter' so it would save the local copy when they edit the mirror encounter because it
   * would give them the 5 with the locked stats and only the choices of the templet."*
   *
   * So a template entry does NOT spawn anonymous copies. Editing the encounter is where the DM
   * builds each body — the stats stay locked to the template (a mirror is always AC 15 / 90 HP)
   * and only the template's own CHOICES are open. The result saves with the encounter, in the
   * DM's local copy, so the same five mirrors come back next session.
   *
   * Absent on an ordinary entry, where `count` alone says how many identical bodies to make.
   */
  bodies?: TemplateBodyChoice[];
};

/**
 * One body built from a template creature, as authored in the encounter.
 *
 * ⚠ CHOICES ONLY. There is deliberately no AC, HP or speed here — those belong to the template
 * and a per-body override would let two mirrors in one fight disagree about what a mirror is.
 * What varies between bodies is exactly what the template left open.
 */
export type TemplateBodyChoice = {
  /** Stable id within the entry, so edits and reorders do not swap bodies around. */
  id: string;
  /**
   * What this body is called — "Mirror of Thayla". The mirrors are named for the characters
   * they stand against, which is what makes the fight read as a mirror match.
   */
  name: string;
  /**
   * Which PC this body mirrors, when the DM wants the link recorded. Cosmetic and optional.
   *
   * ⚠ IT DOES NOT DECIDE THE BOND. Christopher: *"those bonds are not locked to the current
   * party."* A Mirror of Thayla need not carry Thayla's bond — the DM picks any legal one, and
   * deriving it from the mirrored character would quietly remove that choice.
   */
  mirrorsActorId?: string;
  /** The archetype this body was built with — reshapes the template's scores. */
  archetype?: MonsterArchetype;
  /** Which candidates fill each of the template's action sets, by set id. */
  actionPicks?: Record<string, (string | null)[]>;
  /** This body's bond and its permanent path. */
  bond?: MonsterBond;
};

export type EncounterDefinition = {
  id: string;
  name: string;
  actTag?: string;
  order?: number;
  notes?: string;
  dmNotes?: string;
  /**
   * TARGET tier for this FIGHT — what it should COST, per `EXPECTED_LETHALITY` in
   * `encounter-band/encounterChecker.ts` (0.7.7.3: a tier is a price in characters, not a
   * clock; the difficulty panel is judged on lethality, not on round length).
   *
   * This is deliberately a property of the encounter, NOT of its creatures. The Frozen
   * Hollow is an elite fight made of a Zombie, a Ghoul and a Hollow Mourner: nothing in
   * it is elite, but their combined HP pushes the round count into the elite band. Tagging
   * the Ghoul "elite" to force that would then mis-rate the same Ghoul everywhere else.
   *
   * Unset = fall back to the strongest creature's own `stats.classification`, which is the
   * right answer for a solo boss dropped into an ad-hoc fight.
   */
  classification?: MonsterClassification;
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
// Bumped 2026-08-14: Act 1 rebuilt to the Archetype Pass v4 doc (HP/AC/tiers), the Mosshide
// Cub added, and authored roster COUNTS moved into the seed. A DM's own edits to campaign rows
// are re-seeded by design — the doc is the truth document and the app data was code-built.
const ENCOUNTER_LIBRARY_SEED_VERSION = "0.7.8.7-act1-archetype-pass-v4";

/**
 * TARGET tier per campaign fight (Christopher, 2026-07-17) — the round band each Act 2
 * encounter should land in. The checker reports a completion round and a lethal round; it does
 * not grade a fight against a band.
 *
 * These are FIGHT targets, not creature ratings: the Frozen Hollow is elite purely because
 * the stacked HP of its chaff pushes the round count into the elite band — which is also
 * why it is a LOW elite (it should sit at the bottom of 3.25-4.5, not the top).
 *
 * The low/solid/high notes below are where inside the band each fight is meant to land.
 * That is an OUTCOME of HP, not a setting — the model reports it, so use these as the
 * tuning intent when the panel disagrees.
 */
/**
 * AUTHORED ROSTER COUNTS — how many of each body the fight actually fields.
 *
 * The seed used to write `count: 1` for every template, so a freshly seeded library
 * understated every multi-body fight until a DM fixed it by hand. The counts are authored
 * data (the Act 1 Archetype Pass v4 and Act 2 4P Baseline encounter tables), so they belong
 * in the seed rather than in one browser's localStorage.
 *
 * Act 1 totals these reproduce at 4P: Thornfang Pack 26+2×11 = 48 · Greenwood Raider Band
 * 2×16 = 32 · Mosshide Owlbear 59+2×5 = 69 · Threadbare Spider Nest 4×26 = 104 · Swamp Ambush
 * 4×16 = 64 · Bandit Fort 65+65+33 = 163 · Mirage Stalker 100.
 */
const ENCOUNTER_ROSTER: Record<string, Record<string, number>> = {
  "act1-thornfang-pack": {
    "broken-chain:act1:thornfang-wolf:v1": 2,   // "Fixed two in F1"
    "broken-chain:act1:thornfang-packlord:v1": 1,
  },
  "act1-greenwood-reaver": { "broken-chain:act1:greenwood-reaver:v1": 2 },
  "act1-mosshide-owlbear": {
    "broken-chain:act1:mosshide-owlbear:v1": 1,
    "broken-chain:act1:mosshide-cub:v1": 2,     // both cubs active at every party size
  },
  "act1-threadbare-spider-nest": { "broken-chain:act1:threadbare-spider:v1": 4 },
  "act1-swamp-ambush": { "broken-chain:act1:swamp-ambusher:v1": 4 },
  // Act 2 — the only multi-body counts its table publishes.
  "act2-s1-e1-hollow-pack": { "broken-chain:act2-s1:pack-hunter:v1": 2 },
  "act2-s2-e2-last-directive": { "broken-chain:act2-s2:grave-light:v1": 3 },
  "act2-s3-village-defense": { "broken-chain:act2:lesser-wendigo:v1": 2 },
};

const ENCOUNTER_CLASSIFICATION: Record<string, MonsterClassification> = {
  // Act 1 ladder, in play order — from the Archetype Pass v4 "Pressure" column. These were
  // MISSING entirely, so every Act 1 fight (including its boss) fell back to its strongest
  // creature and was judged against "normal", which expects nobody to go down.
  "act1-thornfang-pack": "normal",
  "act1-greenwood-reaver": "normal",
  "act1-mosshide-owlbear": "mid-boss",         // GATE -> Lvl 2
  "act1-threadbare-spider-nest": "normal",
  "act1-swamp-ambush": "normal",
  "fort-cervan-band": "elite",                 // Bandit Fort, "Elite (no gate)"
  "act1-boss": "act-boss",                     // Mirage Stalker, GATE -> Lvl 3
  // Act 2 ladder, in play order.
  "act2-s1-e1-hollow-pack": "strong",        // first fight of the act (Stalker 75 + 2x Pack Hunter 26)
  // ELITE because the Corrupted Hunter (Wight chassis, 82 HP, elite-classed) is a genuine
  // elite body in the roster — NOT because chaff HP happens to lift it. The fight is
  // Icebound Zombie + Hollow Mourner + Corrupted Hunter (the Ghoul it replaced is dormant).
  "act2-s1-e2-frozen-hollow": "elite",
  // "act2-s2-e1-corrupted-hunters" — voided: the Corrupted Hunter moved into Frozen Hollow,
  // leaving this standalone encounter with no creatures, so it no longer seeds.
  "act2-s2-e2-last-directive": "elite",      // SOLID elite
  "act2-s3-village-defense": "mid-boss",     // the Lesser Wendigo — the act's mid boss
  // HIGH elite, both. Fought fresh at L5 / pseudo L6 — set the panel to level 6 for these,
  // not 5. The Sentinels sit at the top of the band on purpose: it is the first time the
  // party faces three spellcasters at once.
  "act2-s4-frozen-sentinels": "elite",
  "act2-s4-pale-drifter": "elite",
  "act2-s5-wendigo-wight": "act-boss",       // act boss
};

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
 * One-time repair for browsers polluted by earlier builds.
 *
 * A previous seed merge copied DM-owned encounters into the CAMPAIGN storage key.
 * That made a DM "New Encounter" surface in BOTH "My Library" and the unlocked
 * "Broken Chain Library" with duplicate React keys. Strip any DM-owned entries
 * (owner "dm", or ids like "dm-…" / "custom-…") back out of the campaign key.
 * No-op once the key is clean, so it's safe to call on every load.
 */
function cleanCampaignLibraryPollution(): void {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_LIBRARY_KEY);
    if (!raw) return;
    const items = JSON.parse(raw) as EncounterDefinition[];
    const cleaned = items.filter(
      e => e.owner !== "dm" && !e.id.startsWith("dm-") && !e.id.startsWith("custom-")
    );
    if (cleaned.length !== items.length) {
      saveEncounterLibrary(cleaned, "campaign");
    }
  } catch { /* ok */ }
}

/**
 * Seeds the encounter library from the bundled monster library on first boot.
 * Groups templates by encounterId.
 */
export function seedEncounterLibraryFromTemplates(templates: MainMonsterTemplate[]): EncounterDefinition[] {
  // Repair already-polluted browsers BEFORE the early-return path below, otherwise
  // a previously polluted campaign key would keep duplicating DM encounters.
  cleanCampaignLibraryPollution();

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
      // Open-ended act tagging — the old hardcoded act1/act2 ternary left every Act 3+
      // encounter with NO act tag, so it fell out of act grouping entirely.
      actTag: actTagForId(encounterId),
      classification: ENCOUNTER_CLASSIFICATION[encounterId],
      entries: encounterTemplates.map(t => ({
        templateId: t.templateId,
        // Authored count, not a flat 1 — see ENCOUNTER_ROSTER.
        count: ENCOUNTER_ROSTER[encounterId]?.[t.templateId] ?? 1,
        startingVisibility: t.visibility.defaultState,
        hiddenNameOverride: t.visibility.hiddenName,
      })),
    });
  }

  // Merge with existing CAMPAIGN encounters only (preserve user edits to campaign
  // rows). DM-owned encounters live in their own key — copying them in here writes
  // dm-* ids into the campaign key, which duplicates them across both libraries.
  const merged = [...seeded];
  for (const existingCampaign of loadEncounterLibrary("campaign")) {
    if (!merged.find(e => e.id === existingCampaign.id)) merged.push(existingCampaign);
  }

  saveEncounterLibrary(merged, "campaign");
  try { window.localStorage.setItem(ENCOUNTER_LIBRARY_SEED_KEY, ENCOUNTER_LIBRARY_SEED_VERSION); } catch { /* ok */ }
  return merged;
}

// ─── Spawn instances from encounter ──────────────────────────────────────────

export function spawnEncounterInstances(
  encounter: EncounterDefinition,
  library: MainMonsterTemplate[],
  /**
   * The party actually fighting this — Lever 1. Defaults to the size the campaign is
   * AUTHORED against, so an un-passed call spawns the encounter exactly as written.
   */
  partySize: number = BASELINE_PARTY_SIZE,
): MainEncounterMonsterInstance[] {
  const instances: MainEncounterMonsterInstance[] = [];

  for (const entry of encounter.entries) {
    const template = library.find(t => t.templateId === entry.templateId);
    if (!template) continue;

    /**
     * A TEMPLATE ENTRY FIELDS ITS AUTHORED BODIES, not `count` anonymous copies.
     *
     * The DM built these in the encounter editor — each with its own name, archetype, action
     * picks and bond — so the fight spawns exactly those. `count` still governs an ordinary
     * entry, where every body genuinely is identical.
     *
     * An entry marked as a template with NO bodies authored yet spawns nothing rather than
     * silently dropping five identical un-chosen mirrors onto the map. The encounter editor is
     * where that gets fixed, and an empty fight is a visible prompt to go and fix it.
     */
    const bodies = entry.bodies ?? [];
    const perBody: MainMonsterTemplate[] = bodies.length > 0
      ? bodies.map(b => materializeTemplateBody(template, b))
      : template.isTemplate
        ? []
        : Array.from({ length: entry.count }, () => template);

    for (let i = 0; i < perBody.length; i++) {
      const instance = createEncounterMonsterInstance(perBody[i]);

      /**
       * Lever 1 — the party-size HP band, applied to the WHOLE encounter. The multiplier is
       * uniform, so scaling each body is the same total as scaling the sum, but the decision
       * is made once for the fight instead of once per row.
       *
       * ⚠ A TEMPLATE ENTRY IS THE ONE EXCEPTION, and it is stated as one. The Mirrors doc:
       * *"This is the sole body-count exception. Each mirror remains at 90 HP; use one mirror
       * per PC."* Party size is ALREADY expressed as how many bodies the DM authored, so
       * scaling their HP too would apply the same lever twice — three mirrors at 67 HP for a
       * 3-player party instead of three at 90.
       */
      const scaledHp = bodies.length > 0 ? instance.maxHp : hpForPartySize(instance.maxHp, partySize);
      const scaled = scaledHp;
      if (scaled !== instance.maxHp) {
        instance.currentHp = scaled;
        instance.maxHp = scaled;
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
