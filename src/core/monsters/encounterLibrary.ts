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
import { applySlotPicks, type SlotPicks } from "./spellSlotPicks";
import { resolveMonsterActionFormulas } from "./resolveMonsterFormulaVars";
import { hpForPartySize, BASELINE_PARTY_SIZE } from "../encounter-band/partyCurveV2";
import { AUTHORED_ENCOUNTERS, AUTHORED_DIGEST } from "../../data/broken-chain/authored.generated";
import { safeStorage } from "../utils/safeStorage";

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
  /**
   * WHICH SPELLS THIS CREATURE BROUGHT, filled per slot at the moment the fight is built.
   *
   * Christopher: *"i build all the spells hale and the UR have just like a character, then we make
   * the generater have a picker for each of the slots at X Level."* The library entry stays
   * generic — every spell marked `slotCandidate` in the creature editor is a spell it COULD
   * prepare — and the encounter records which ones it actually did.
   *
   * ⚠ ON THE ENTRY, NOT ON EACH BODY. The pool is a property of the CREATURE as this fight fields
   * it; three Hales in one encounter are the same Hale, and per-body picks would let them
   * disagree about what a Hale prepared. It is the same shape as the party-size band, which is
   * also a fact about the fight rather than about each figure in it.
   *
   * Absent on every creature that has no candidates, which is almost all of them — a fixed spell
   * list needs no decision and must not raise an empty picker (`needsSlotPicks`).
   */
  spellPicks?: SlotPicks;
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
/**
 * DELETED SEEDED FIGHTS — the ids the seeder must not put back.
 *
 * ⚠ WITHOUT THIS, DELETING A CAMPAIGN FIGHT LASTED UNTIL THE NEXT PUBLISH. The seed loop below
 * INFERS an encounter from every creature carrying an `encounterId`, and `ENCOUNTER_LIBRARY_SEED_VERSION`
 * embeds `AUTHORED_DIGEST` — which changes on every fold. So each publish re-seeded, and each
 * re-seed re-derived every fight the author had deleted. Christopher, after deleting the same one
 * repeatedly: *"i have had both the deleted mirror fight and the Wyrmling reseed"*, and *"loot
 * pools i cant remove, encounter that arent here."*
 *
 * The archive could not answer this on its own: `permanentlyDeleteEncounter` empties it, and an
 * id purged from the archive would start coming back again — the opposite of what "permanently"
 * means. So the tombstone is its own list, and the three verbs read correctly against it:
 *
 *   delete    → archived AND tombstoned   — gone from the library, restorable, stays gone
 *   restore   → tombstone lifted          — comes back, and keeps coming back
 *   permanent → archive row dropped, tombstone KEPT — never comes back
 */
const RETIRED_ENCOUNTER_KEY = "fdmc.dm.encounterLibraryRetired.v1";

function loadRetiredEncounterIds(): Set<string> {
  try {
    const raw = safeStorage().getItem(RETIRED_ENCOUNTER_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

function saveRetiredEncounterIds(ids: Set<string>): void {
  try { safeStorage().setItem(RETIRED_ENCOUNTER_KEY, JSON.stringify([...ids])); } catch { /* ok */ }
}
/** Legacy key — migrated on first load */
const ENCOUNTER_LIBRARY_KEY = "fdmc.dm.encounterLibrary.v1";
const ENCOUNTER_LIBRARY_SEED_KEY = "fdmc.dm.encounterLibrary.seedVersion";
// Bumped 2026-08-14: Act 1 rebuilt to the Archetype Pass v4 doc (HP/AC/tiers), the Mosshide
// Cub added, and authored roster COUNTS moved into the seed. A DM's own edits to campaign rows
// are re-seeded by design — the doc is the truth document and the app data was code-built.
/**
 * ⚠ THE AUTHORED DIGEST IS PART OF THE SEED VERSION.
 *
 * The seed early-returns when the stored version matches, so folding new authored encounters
 * would otherwise land in the build and never reach a browser that had already seeded — the
 * author would push a fight and see nothing change. Folding changes the digest, which changes
 * this string, which re-seeds. No manual bump, no "why is my encounter missing".
 */
const ENCOUNTER_LIBRARY_SEED_VERSION = `0.7.8.7-act1-archetype-pass-v4+${AUTHORED_DIGEST || "none"}`;

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
  /**
   * Act 3 — the ONLY multi-body count in the act. Verified against the campaign authoring export
   * of 2026-08-25 (digest fnv1a-03c7c9fe-82581): all 24 encounters, every entry, every count and
   * every classification agree with this seed apart from this one line. Christopher: *"the only
   * change to body count that the library needed was 2 wyrmlings every thing else was correct."*
   *
   * It matters more than one body suggests — Gate III is 253 EHP with one wyrmling and 294 with
   * two, and round-1 incoming goes 76 -> 108.
   */
  "act3-e9-gate-iii-veil-torn-dragon": { "broken-chain:act3:veil-torn-wyrmling:v1": 2 },
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
      const raw = safeStorage().getItem(keyForOwner(owner));
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
    const legacy = safeStorage().getItem(ENCOUNTER_LIBRARY_KEY);
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
      safeStorage().removeItem(ENCOUNTER_LIBRARY_KEY);
    }
  } catch { /* ok */ }
  return [...campaign, ...dm];
}

export function saveEncounterLibrary(library: EncounterDefinition[], owner: EncounterLibraryOwner): void {
  try {
    safeStorage().setItem(keyForOwner(owner), JSON.stringify(library));
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
    const raw = safeStorage().getItem(UNUSED_LIBRARY_KEY);
    return raw ? JSON.parse(raw) as EncounterDefinition[] : [];
  } catch {
    return [];
  }
}

function saveUnusedEncounters(library: EncounterDefinition[]): void {
  try {
    safeStorage().setItem(UNUSED_LIBRARY_KEY, JSON.stringify(library));
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

  // And record the intent, so the next re-seed does not undo it.
  const retired = loadRetiredEncounterIds();
  retired.add(id);
  saveRetiredEncounterIds(retired);
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
  // Asking for it back means asking the seeder to stop suppressing it.
  const retired = loadRetiredEncounterIds();
  if (retired.delete(id)) saveRetiredEncounterIds(retired);
}

/**
 * Permanently remove an archived encounter from the unused list (cannot be restored).
 *
 * The TOMBSTONE stays. Dropping it here would let the next re-seed re-derive the fight, which is
 * the one outcome the word "permanently" rules out.
 */
export function permanentlyDeleteEncounter(id: string): void {
  saveUnusedEncounters(loadUnusedEncounters().filter(e => e.id !== id));
  const retired = loadRetiredEncounterIds();
  retired.add(id);
  saveRetiredEncounterIds(retired);
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
    const raw = safeStorage().getItem(CAMPAIGN_LIBRARY_KEY);
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
 * A STORED CAMPAIGN FIGHT CAN OUTLIVE THE CREATURES IT WAS BUILT FROM. Repair it in place.
 *
 * This is why the author button failed. A browser seeded before the v3.23 rebuild still holds
 * The Last Court pointing at `walking-court` and `hushrunner`, and The Occupied Acre pointing at
 * `siege-saint`, `ashstep` and `rift-scribe` — five creatures the rebuild replaced. Nothing ever
 * revisited those rows, so the export carried them, and `fold-authoring` refused it: folding
 * would have shipped two rebuilt Act 3 fights EMPTY, because an authored encounter replaces the
 * seeded one by id.
 *
 * The refusal was right. The stale data was the fault, and the DM could not fix it by
 * re-exporting because re-exporting produced the same dead references.
 *
 * ⚠ SURGICAL, NOT A RE-SEED. Bumping the seed version would also repair this — and would reset
 * every campaign encounter the DM had edited, because all of them exist in the seed and the merge
 * prefers the seeded row. So this touches ONLY entries whose creature is gone: it drops those and
 * adds whatever the seed now says belongs to that fight. Counts, visibility and bodies on entries
 * that still resolve are left exactly as authored.
 *
 * DM-owned encounters are not touched at all. They live in their own key, their creatures are the
 * DM's own, and a missing one there is a question for the DM rather than a stale seed.
 */
function repairDanglingCampaignEntries(templates: MainMonsterTemplate[]): void {
  try {
    const known = new Set(templates.map(t => t.templateId));
    const campaign = loadEncounterLibrary("campaign");
    if (campaign.length === 0) return;

    // What the current templates say each fight should contain.
    const seededFor = new Map<string, EncounterMonsterEntry[]>();
    for (const t of templates) {
      if (!t.encounterId) continue;
      const list = seededFor.get(t.encounterId) ?? [];
      list.push({
        templateId: t.templateId,
        count: ENCOUNTER_ROSTER[t.encounterId]?.[t.templateId] ?? 1,
        startingVisibility: t.visibility.defaultState,
        hiddenNameOverride: t.visibility.hiddenName,
      });
      seededFor.set(t.encounterId, list);
    }

    let repaired = 0;
    const fixed = campaign.map(encounter => {
      const live = encounter.entries.filter(e => known.has(e.templateId));
      if (live.length === encounter.entries.length) return encounter;
      const replacements = (seededFor.get(encounter.id) ?? [])
        .filter(s => !live.some(e => e.templateId === s.templateId));
      repaired++;
      return { ...encounter, entries: [...live, ...replacements] };
    });
    if (repaired > 0) saveEncounterLibrary(fixed, "campaign");
  } catch { /* a browser that cannot read its own library has a bigger problem than this */ }
}

/**
 * Seeds the encounter library from the bundled monster library on first boot.
 * Groups templates by encounterId.
 */
export function seedEncounterLibraryFromTemplates(templates: MainMonsterTemplate[]): EncounterDefinition[] {
  // Repair already-polluted browsers BEFORE the early-return path below, otherwise
  // a previously polluted campaign key would keep duplicating DM encounters.
  cleanCampaignLibraryPollution();

  // A stored campaign fight can outlive the creatures it was built from. Repair before the
  // early return, or a browser seeded pre-rebuild never sees the fix.
  repairDanglingCampaignEntries(templates);

  const stored = safeStorage().getItem(ENCOUNTER_LIBRARY_SEED_KEY);
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

  /**
   * AUTHORED ENCOUNTERS REPLACE THE DERIVED ONES.
   *
   * The loop above INFERS a fight from the creatures tagged into it: one entry per template, the
   * authored roster count, nothing else. That is a reasonable default and it is not what a DM
   * built — it has no act ORDER, no loot pool, and critically no BODIES for a template creature.
   * An authored encounter carries all of that, so where both exist the authored one wins.
   */
  const authoredById = new Map(AUTHORED_ENCOUNTERS.map(e => [e.id, { ...e, owner: "campaign" as const }]));
  const seededWithAuthored = seeded.map(e => authoredById.get(e.id) ?? e);
  for (const [id, e] of authoredById) {
    if (!seededWithAuthored.some(x => x.id === id)) seededWithAuthored.push(e);
  }

  // Merge with existing CAMPAIGN encounters only (preserve user edits to campaign
  // rows). DM-owned encounters live in their own key — copying them in here writes
  // dm-* ids into the campaign key, which duplicates them across both libraries.
  const merged = [...seededWithAuthored];
  for (const existingCampaign of loadEncounterLibrary("campaign")) {
    if (!merged.find(e => e.id === existingCampaign.id)) merged.push(existingCampaign);
  }

  /**
   * ⚠ A DELETION IS AUTHORING TOO, AND THE SEEDER USED TO OVERRULE IT.
   *
   * Everything above re-derives the campaign library from the bundle. Applied unfiltered that
   * re-creates every fight the author deliberately removed — and because the seed version carries
   * `AUTHORED_DIGEST`, it re-ran on every single publish. Deleting the Gate II mirrors fight and
   * then pushing the change put it straight back, which is why it kept being reported as deleted
   * and still present.
   *
   * Filtered LAST, so it also catches an authored row and a surviving stored row, not just the
   * derived ones. `restoreEncounter` lifts the tombstone, so this suppresses only what is still
   * meant to be gone.
   */
  const retired = loadRetiredEncounterIds();
  const kept = retired.size > 0 ? merged.filter(e => !retired.has(e.id)) : merged;

  saveEncounterLibrary(kept, "campaign");
  try { safeStorage().setItem(ENCOUNTER_LIBRARY_SEED_KEY, ENCOUNTER_LIBRARY_SEED_VERSION); } catch { /* ok */ }
  return kept;
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
    /**
     * ⚠ THE SPELL POOL COLLAPSES BEFORE ANYTHING ELSE READS THE TEMPLATE.
     *
     * A creature authored with `slotCandidate` spells carries every spell it COULD prepare. What
     * this fight fields is the DM's pick, so the pool is resolved here, once, and both spawn paths
     * below build from the collapsed copy. Doing it later would leave un-prepared spells in the
     * action list for the estimator to price and for the card to offer.
     *
     * `applySlotPicks` returns a COPY — the library entry stays generic, so the next encounter can
     * field the same creature with different spells.
     */
    const source = entry.spellPicks ? applySlotPicks(template, entry.spellPicks) : template;

    const bodies = entry.bodies ?? [];
    const perBody: MainMonsterTemplate[] = bodies.length > 0
      ? bodies.map(b => materializeTemplateBody(source, b))
      : source.isTemplate
        ? []
        // An ORDINARY creature resolves its own @vars too. Template bodies already did it in
        // materializeTemplateBody, after their archetype reshape.
        : Array.from({ length: entry.count }, () => ({
          ...source,
          actions: (source.actions ?? []).map(a => resolveMonsterActionFormulas(a, source)),
        }));

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

      /**
       * THE FIGHT THAT SPAWNED IT WINS over the fight its template is tagged into.
       *
       * They are the same id for every seeded encounter, and deliberately NOT for an authored
       * one that fields a creature from elsewhere — v3.21 reassigns Fight 7 to creatures the
       * library tags into other fights. What ends when combat ends is the encounter the DM
       * loaded, so that is the id a milestone must read.
       */
      if (encounter.id) instance.encounterId = encounter.id;

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
