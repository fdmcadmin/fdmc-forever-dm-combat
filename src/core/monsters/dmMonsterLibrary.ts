/**
 * DM Monster Library — localStorage manager for MainMonsterTemplate[]
 *
 * Monsters built through MonsterJconBuilder are saved here.
 * The library is DM-local only — never written to room metadata.
 * Staged monsters (ready to enter combat) are a separate list.
 */

import type { MainMonsterTemplate } from "./runtime/mainMonsterRuntime";
import { MONSTER_KINDS, type MonsterKind } from "./runtime/mainMonsterRuntime";
import type { NormalizedMonsterActor, MonsterAction as NMonsterAction } from "../types/monsterTypes";
import type { MonsterReaderAction } from "./MonsterJconScanner";
import { SYSTEM_MONSTER_TEMPLATES } from "../../modules/monsterSourceRoster";
import { safeStorage } from "../utils/safeStorage";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const MONSTER_LIBRARY_KEY = "fdmc.dm.monsterLibrary.v1";
/**
 * CAMPAIGN-AUTHORED CREATURES — the mod author's own store.
 *
 * Christopher: *"i am only building this creature for my library which defeats the purpose of the
 * campaign creation on creatures, right now i am unable to create a creature for the campaign
 * without you doing it and that is a limitation for if i wanted to do any for the act 4."*
 *
 * He is right, and it was a hard stop. Encounters have had a campaign/DM target since 0.6; monster
 * templates never did — `upsertMonsterTemplate` wrote to ONE key, so every creature a DM built was
 * "My Library" whatever they intended. Authoring Act 4 was impossible without me editing source.
 *
 * The two stores are separate for the same reason the equipment ones are: a campaign creature is
 * content that SHIPS (via the author export), while a DM's own creature is theirs alone.
 */
const CAMPAIGN_MONSTER_LIBRARY_KEY = "fdmc.campaign.monsterLibrary.v1";

export type MonsterLibraryOwner = "campaign" | "dm";

function monsterKeyFor(owner: MonsterLibraryOwner): string {
  return owner === "campaign" ? CAMPAIGN_MONSTER_LIBRARY_KEY : MONSTER_LIBRARY_KEY;
}
const MONSTER_STAGED_KEY = "fdmc.dm.monsterStaged.v1";

// ─── Library operations ───────────────────────────────────────────────────────

/**
 * Load a monster store. No argument = BOTH, campaign first, DM winning on a shared id — the same
 * resolution `loadEquipmentLibrary()` uses, so an author editing their own campaign creature sees
 * their edit rather than two rows.
 */
export function loadMonsterLibrary(owner?: MonsterLibraryOwner): MainMonsterTemplate[] {
  if (owner) {
    try {
      const raw = safeStorage().getItem(monsterKeyFor(owner));
      return raw ? JSON.parse(raw) as MainMonsterTemplate[] : [];
    } catch {
      return [];
    }
  }
  const campaign = loadMonsterLibrary("campaign");
  const dm = loadMonsterLibrary("dm");
  const dmIds = new Set(dm.map(t => t.templateId));
  return [...campaign.filter(t => !dmIds.has(t.templateId)), ...dm];
}

export function saveMonsterLibrary(library: MainMonsterTemplate[], owner: MonsterLibraryOwner = "dm"): void {
  try {
    safeStorage().setItem(monsterKeyFor(owner), JSON.stringify(library));
  } catch {
    // localStorage unavailable
  }
}

export function upsertMonsterTemplate(template: MainMonsterTemplate, owner: MonsterLibraryOwner = "dm"): void {
  const library = loadMonsterLibrary(owner);
  const idx = library.findIndex(t => t.templateId === template.templateId);
  if (idx === -1) {
    library.push(template);
  } else {
    library[idx] = template;
  }
  saveMonsterLibrary(library, owner);
  /**
   * Saving to one store REMOVES the id from the other. A creature promoted from My Library to the
   * campaign must not leave a stale twin behind — the resolver has the DM copy winning by id, so
   * the leftover would shadow the campaign version and every later edit would appear to do nothing.
   */
  const other: MonsterLibraryOwner = owner === "campaign" ? "dm" : "campaign";
  const otherLib = loadMonsterLibrary(other);
  const pruned = otherLib.filter(t => t.templateId !== template.templateId);
  if (pruned.length !== otherLib.length) saveMonsterLibrary(pruned, other);
}

// ─── Library resolution — the one place the precedence rule lives ────────────

/**
 * WHICH VERSION OF A CREATURE IS THE REAL ONE.
 *
 * ⚠ THIS RULE USED TO LIVE INSIDE A COMPONENT, so only that component obeyed it. The encounter
 * checker and the creature estimator were handed `BROKEN_CHAIN_MONSTER_LIBRARY` — the bundled
 * constant — which meant a DM could edit a creature and then watch the checker price the SHIPPED
 * one. That is the same fault 0.7.32 answered a layer down: *"if i go in a change every library
 * entry [...] and the encounter checker still show what was there before instead of what is there
 * now then isnt not working correctly."*
 *
 * THE PRECEDENCE, in one place, for every caller — and it is now one sentence:
 *
 *   A STORED COPY WINS. Always. The bundled creature is what you get when nothing is stored.
 *
 * ⚠ IT USED TO HAVE FOUR RULES AND THE LAST ONE THREW AWAY EDITS. Rule 4 read an unstamped stored
 * copy as a STALE SEED and returned the bundled creature instead — written when the app seeded
 * these stores with copies of the bundled library, so an unmarked copy really was a leftover.
 * That has not been true for a long time: `upsertMonsterTemplate` is the only writer, and import
 * routes by ownership since 0.7.51.0. Every stored copy on a current build is there because
 * somebody saved it.
 *
 * It cost real work twice over. First silently, through the campaign store —
 * `handleSaveMonsterTemplate` is explicit that *"a campaign save is NOT a DM edit, so it carries
 * no `dmEdited` stamp"*, which is right, and rule 4 then discarded exactly that artefact:
 *
 *   Christopher, on renaming the Veil-Torn Wyrmling: *"the wyrmlings are back vs them being
 *   changed to the drake guard"*, and *"nothing is saving with the app."*
 *
 * And then, once that was patched, through the remaining unstamped cases — which is the worse
 * failure, because it was CONDITIONAL and invisible:
 *
 *   *"i am tired of editing a monster and then turning the app off and back on only for it to be
 *   the same seeded monster, there should never be a seeded monster that overrides my authored
 *   monster [...] because i never know when the edit has gone through, i never know when my
 *   submit instead reverts to a seeded version."*
 *
 * A save that worked and a save that was discarded looked identical from the outside. A rule you
 * cannot predict is worse than no rule, and this one was protecting against a shape the app stopped
 * producing years of commits ago.
 *
 * ⚠ WHAT RULE 4 WAS REALLY FOR IS KEPT. A stored copy that disagrees with the shipped creature is
 * still reported — as a difference this table is RUNNING, with a revert button, rather than as a
 * correction already applied behind the DM's back. Nothing heals silently; it just no longer heals
 * by deleting the DM's work.
 *
 * That reporting is why this returns REPORTS as well as a list. The panel renders them as banners;
 * the checker ignores them. One merge, two consumers, no second implementation to drift.
 */
export type MonsterLibraryResolution = {
  /** The creatures as they actually are: DM creations, then campaign with edits applied. */
  library: MainMonsterTemplate[];
  /**
   * Campaign creatures running a stored copy rather than the bundled one — the copy IS in
   * `library`. `source` says which store it came from: `"campaign"` is authored content,
   * `"dm"` is a deliberate private override.
   */
  overridden: { id: string; name: string; mine: string; campaign: string; at?: string; source?: "campaign" | "dm" }[];
  /**
   * Stored copies whose HP or AC disagrees with the shipped creature. They are IN `library` —
   * this is what the table is running, not what was overruled.
   */
  shadowed: { id: string; name: string; was: string; now: string; signature: string }[];
};

/** A creature belongs to the campaign if the bundle ships it, or it uses the reserved namespace. */
export function isCampaignTemplateId(id: string, bundled: MainMonsterTemplate[]): boolean {
  return bundled.some(t => t.templateId === id) || id.startsWith("broken-chain:");
}

export function resolveMonsterLibrary(
  bundled: MainMonsterTemplate[],
  opts: {
    /** Defaults to the stored library. Passed explicitly by callers that already hold it. */
    stored?: MainMonsterTemplate[];
    /** Campaign content is gated on the module unlock in the UI. Defaults to included. */
    includeCampaign?: boolean;
    /**
     * ⚠ THE THIRD SOURCE, AND IT DEFAULTS ON.
     *
     * Reference creatures a mod supplies — SRD 5.2.1 today. This function composed exactly TWO
     * sources (the bundled campaign library and the DM's stored one), and because EVERY
     * creature-listing surface resolves through here, one missing source meant the Encounter
     * Builder, the Estimator and creature search all came up empty at once.
     *
     * It defaults to INCLUDED rather than asking six call sites to opt in. An opt-in would have
     * been forgotten at one of them, and a source that reaches five surfaces out of six is a bug
     * that looks like a preference. Tests pass `system: []` to isolate.
     */
    includeSystem?: boolean;
    /** Override the reference set — tests pass `[]`, or a fixture. */
    system?: readonly MainMonsterTemplate[];
    /**
     * Which stored ids came from the CAMPAIGN store — rule 2. Defaults to reading it, because
     * every caller that passes `stored` passes the MERGED list and cannot tell them apart.
     */
    authoredIds?: ReadonlySet<string>;
  } = {},
): MonsterLibraryResolution {
  const stored = opts.stored ?? loadMonsterLibrary();
  const includeCampaign = opts.includeCampaign ?? true;
  const system = (opts.includeSystem ?? true) ? (opts.system ?? SYSTEM_MONSTER_TEMPLATES) : [];
  const authored = opts.authoredIds ?? new Set(loadMonsterLibrary("campaign").map(t => t.templateId));
  const isCampaign = (id: string) => isCampaignTemplateId(id, bundled);

  const overridden: MonsterLibraryResolution["overridden"] = [];
  const shadowed: MonsterLibraryResolution["shadowed"] = [];
  const shape = (t: MainMonsterTemplate) => `${t.stats.maxHp} HP / AC ${t.stats.ac}`;
  /**
   * The whole creature, key order made irrelevant — two copies that differ only in how JSON.stringify
   * happened to walk them are the same creature. `dmEdited` is a marker ABOUT the copy rather than
   * part of what the creature is, so it is excluded: a stamped copy of an unchanged creature is
   * still unchanged.
   */
  const signature = (t: MainMonsterTemplate) =>
    JSON.stringify(t, (k, v) => {
      if (k === "dmEdited") return undefined;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
      }
      return v;
    });

  const mine = stored.filter(t => !isCampaign(t.templateId));
  const campaign = includeCampaign
    ? bundled.map(t => {
      const copy = stored.find(m => m.templateId === t.templateId);
      if (!copy) return t;
      /**
       * ⚠ A COPY THAT MATCHES THE BUNDLE IS NOT AN OVERRIDE, AND CALLING IT ONE COST REAL WORK.
       *
       * Once a publish is folded, the shipped creature IS the author's edit — so the stored copy
       * and the bundled template agree exactly and the local copy has nothing left to say. The
       * banner announced it anyway, printing the same numbers on both sides:
       *
       *     Rift-Slick:       yours 59 HP / AC 12  -  campaign 59 HP / AC 12
       *     Blackbough Reeve: yours 86 HP / AC 16  -  campaign 86 HP / AC 16
       *
       * Christopher: *"i changed a trait and it reads you edited version, i publish it, then i
       * have to go in a 'remove' my campaign creatures for it to show the same thing."* Removing
       * them is exactly what the notice invited — and the export reads that store, so the NEXT
       * publish carried fewer creatures than the one before. That is how 17 authored creatures
       * became 4 and then 3.
       *
       * Nothing here heals silently: an identical copy is redundant by definition, so dropping it
       * from the report hides no disagreement. A copy that actually differs is still reported.
       *
       * ⚠ COMPARED WHOLE, NOT ON HP/AC. The banner's own summary is two numbers, which is why a
       * changed TRAIT looked identical on both sides while genuinely differing. `signature`
       * decides; `shape` only prints.
       */
      if (signature(copy) === signature(t)) return t;
      // Rule 2 then rule 3. An authored copy needs no stamp; a private one does.
      const isAuthored = authored.has(t.templateId);
      /**
       * ⚠ THE STORED COPY ALWAYS WINS. A SEEDED CREATURE NEVER OVERRIDES A SAVED ONE.
       *
       * Christopher: *"i am tired of editing a monster and then turning the app off and back on
       * only for it to be the same seeded monster, there should never be a seeded monster that
       * overrides my authored monster"* — and the reason it was unbearable rather than merely
       * wrong: *"because i never know when the edit has gone through, i never know when my submit
       * instead reverts to a seeded version."*
       *
       * This used to return the BUNDLED creature for a copy carrying no `dmEdited` stamp, on the
       * grounds that an unmarked copy was a stale seed from an older build. That was true when the
       * app seeded these stores with copies of the bundled library. It does not any more —
       * `upsertMonsterTemplate` is the only writer, and import routes by ownership since 0.7.51.0.
       * So on a current build every stored copy is there because somebody deliberately saved it,
       * and discarding one is discarding an edit.
       *
       * Worse, it was SILENT and conditional: it fired only when the stamp happened to be missing,
       * so a save that worked and a save that was thrown away looked identical from the outside.
       * A rule you cannot predict is worse than no rule.
       *
       * ⚠ THE VISIBILITY IT WAS PROTECTING IS KEPT, AND IS NOW HONEST. A copy that disagrees with
       * the shipped creature is still reported — as a difference the DM is running, with a revert
       * button, rather than as a correction already applied behind their back.
       */
      overridden.push({
        id: t.templateId, name: t.name, mine: shape(copy), campaign: shape(t),
        at: copy.dmEdited?.at, source: isAuthored ? "campaign" : "dm",
      });
      // Still reported when the headline numbers disagree — but as information, not a takeover.
      if (copy.stats.maxHp !== t.stats.maxHp || String(copy.stats.ac) !== String(t.stats.ac)) {
        shadowed.push({
          id: t.templateId,
          name: t.name,
          was: shape(t),        // what the build ships
          now: shape(copy),     // what this table is actually running
          // The signature carries the numbers, so acknowledging THIS divergence does not silence
          // a different one later — a fresh correction changes it and speaks up again.
          signature: `${t.templateId}|${copy.stats.maxHp}/${copy.stats.ac}|${t.stats.maxHp}/${t.stats.ac}`,
        });
      }
      return copy;
    })
    : [];

  /**
   * ⚠ REFERENCE CREATURES ARE APPENDED, NEVER MERGED.
   *
   * They take no part in the override/shadow logic above, because a DM cannot edit one: there is
   * no stored copy to outrank, nothing to report as diverging, and an id collision with a campaign
   * creature is impossible — SRD ids live in the reserved `dnd:srd521:` namespace. Running them
   * through that machinery would invent a conflict that cannot happen.
   *
   * They go LAST so a DM's own work and the campaign's content read first in every list.
   */
  return { library: [...mine, ...campaign, ...system], overridden, shadowed };
}

export function deleteMonsterTemplate(templateId: string): void {
  for (const owner of ["dm", "campaign"] as MonsterLibraryOwner[]) {
    const lib = loadMonsterLibrary(owner);
    const next = lib.filter(t => t.templateId !== templateId);
    if (next.length !== lib.length) saveMonsterLibrary(next, owner);
  }
}

// ─── Export / Import ─────────────────────────────────────────────────────────

export function exportMonsterLibrary(): void {
  const library = loadMonsterLibrary();
  if (library.length === 0) return;
  const blob = new Blob([JSON.stringify({ schema: "fdmc.monster-library.v1", exportedAt: new Date().toISOString(), monsters: library }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fdmc-monster-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type MonsterImportResult = {
  ok: boolean;
  added: number;
  updated: number;
  skipped: number;
  message: string;
};

/**
 * WHICH STORE AN IMPORTED CREATURE BELONGS IN.
 *
 * ⚠ THIS IS THE LINE THAT ATE ELEVEN AUTHORED CREATURES. Import called `upsertMonsterTemplate(t)`
 * with the DEFAULT owner — "dm" — and that function deliberately prunes the id out of the other
 * store, so importing a campaign creature DELETED the campaign copy and re-filed it as a private
 * one. Import adds no `dmEdited` stamp either, so the re-filed creature then failed the export's
 * "`dmEdited` or `custom-`" test and fell out of the payload entirely.
 *
 * The visible result, on 2026-08-26: the author published 17 creatures at 07:33, round-tripped the
 * file back through Import to check it, published again at 07:35 — and the payload had collapsed
 * to the 6 that happened to carry a stamp. The fold folded the 6. Christopher: *"why did none of my
 * authored creatures move into the seed [...] i have done these 4 or 5 times and nothing is saving
 * with the app."* Nothing warned, because every step did what it was told.
 *
 * A file does not change what a creature IS. The reserved namespace already answers the question,
 * so ownership survives the round trip: `broken-chain:` is campaign content, everything else is
 * the DM's own.
 */
function importOwnerFor(templateId: string): MonsterLibraryOwner {
  return templateId.startsWith("broken-chain:") ? "campaign" : "dm";
}

export async function importMonsterLibrary(file: File): Promise<MonsterImportResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as { monsters?: unknown[]; schema?: string };
    const monsters = parsed.monsters ?? (Array.isArray(parsed) ? parsed : null);
    if (!Array.isArray(monsters)) {
      return { ok: false, added: 0, updated: 0, skipped: 0, message: "Invalid file — expected { monsters: [...] } or a raw array." };
    }
    const existing = loadMonsterLibrary();
    const existingIds = new Set(existing.map(t => t.templateId));
    let added = 0, updated = 0, skipped = 0;
    for (const raw of monsters) {
      const t = raw as MainMonsterTemplate;
      if (!t.templateId || !t.name) { skipped++; continue; }
      if (existingIds.has(t.templateId)) updated++; else added++;
      upsertMonsterTemplate(t, importOwnerFor(t.templateId));
    }
    return { ok: true, added, updated, skipped, message: `Imported ${added + updated} monster${added + updated === 1 ? "" : "s"} (${added} new, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ""}).` };
  } catch (e) {
    return { ok: false, added: 0, updated: 0, skipped: 0, message: `Import failed: ${String(e)}` };
  }
}

// ─── Staged monsters ──────────────────────────────────────────────────────────

export function loadStagedMonsters(): MainMonsterTemplate[] {
  try {
    const raw = safeStorage().getItem(MONSTER_STAGED_KEY);
    return raw ? JSON.parse(raw) as MainMonsterTemplate[] : [];
  } catch {
    return [];
  }
}

export function saveStagedMonsters(staged: MainMonsterTemplate[]): void {
  try {
    safeStorage().setItem(MONSTER_STAGED_KEY, JSON.stringify(staged));
  } catch {
    // localStorage unavailable
  }
}

export function stageMonster(template: MainMonsterTemplate): void {
  const staged = loadStagedMonsters();
  if (!staged.find(t => t.templateId === template.templateId)) {
    staged.push(template);
    saveStagedMonsters(staged);
  }
}

export function unstageMonster(templateId: string): void {
  saveStagedMonsters(loadStagedMonsters().filter(t => t.templateId !== templateId));
}

export function clearStagedMonsters(): void {
  saveStagedMonsters([]);
}

// ─── NormalizedMonsterActor → MainMonsterTemplate adapter ────────────────────

function nActionToReaderAction(action: NMonsterAction): MonsterReaderAction {
  const validKinds = ["action", "attack", "reaction", "spell", "trait"] as const;
  const kind = validKinds.includes(action.kind as typeof validKinds[number])
    ? (action.kind as typeof validKinds[number])
    : "action";
  return {
    name: action.name,
    kind,
    text: [action.description, action.recharge ? `Recharge ${action.recharge}` : undefined].filter(Boolean).join(" ") || "",
    roll: action.attack ?? undefined,
    damage: action.damage ?? undefined,
    save: action.save ?? (action.dc !== undefined ? `DC ${action.dc}` : undefined),
    attackCount: action.attackCount,
  };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "monster";
}

export function normalizedToTemplate(
  monster: NormalizedMonsterActor,
  opts: { encounterId?: string; encounterLabel?: string } = {}
): MainMonsterTemplate {
  const templateId = monster.id?.trim()
    ? monster.id
    : `custom:${slugify(monster.name)}:${Date.now().toString(36)}`;

  const allActions: MonsterReaderAction[] = [
    ...monster.actions.map(nActionToReaderAction),
    ...monster.bonusActions.map(a => ({ ...nActionToReaderAction(a) })),
    ...monster.legendaryActions.map(a => ({ ...nActionToReaderAction(a) })),
  ];

  const reactions = monster.reactions.map(nActionToReaderAction);
  const traits = monster.traits.map(t => ({ name: t.name, kind: "trait" as const, text: t.description }));

  const abilities = (["str", "dex", "con", "int", "wis", "cha"] as const).map(id => {
    const ability = monster.abilities[id];
    const score = ability?.score ?? 10;
    const mod = ability?.modifier ?? Math.floor((score - 10) / 2);
    const signed = mod >= 0 ? `+${mod}` : `${mod}`;
    return { label: id.toUpperCase(), value: `${score} (${signed})` };
  });

  return {
    templateId,
    name: monster.name,
    encounterId: opts.encounterId,
    encounterLabel: opts.encounterLabel,
    stats: {
      // Legacy "monster"/"boss" said nothing about creature TYPE, so they cannot be
      // mapped to one — they become "unspecified" and surface as incomplete in the editor.
      kind: (MONSTER_KINDS as readonly string[]).includes(monster.kind as string)
        ? (monster.kind as MonsterKind)
        : "unspecified",
      ac: monster.defense.ac,
      maxHp: monster.defense.hp.max,
      speed: monster.defense.speed,
    },
    abilities,
    traits,
    actions: allActions,
    reactions,
    resources: monster.resources.map(r => ({
      id: r.id,
      name: r.name,
      current: r.current,
      max: r.max,
      reset: r.reset,
      note: r.note,
    })),
    notes: monster.notes ?? [],
    visibility: {
      defaultState: (monster.visibility.defaultMode ?? "hidden") as MainMonsterTemplate["visibility"]["defaultState"],
      hiddenName: monster.visibility.hiddenName ?? "Unknown creature",
      revealedName: monster.visibility.revealedName ?? monster.name,
    },
  };
}
