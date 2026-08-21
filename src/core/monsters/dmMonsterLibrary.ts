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
      const raw = window.localStorage.getItem(monsterKeyFor(owner));
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
    window.localStorage.setItem(monsterKeyFor(owner), JSON.stringify(library));
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
      upsertMonsterTemplate(t);
    }
    return { ok: true, added, updated, skipped, message: `Imported ${added + updated} monster${added + updated === 1 ? "" : "s"} (${added} new, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ""}).` };
  } catch (e) {
    return { ok: false, added: 0, updated: 0, skipped: 0, message: `Import failed: ${String(e)}` };
  }
}

// ─── Staged monsters ──────────────────────────────────────────────────────────

export function loadStagedMonsters(): MainMonsterTemplate[] {
  try {
    const raw = window.localStorage.getItem(MONSTER_STAGED_KEY);
    return raw ? JSON.parse(raw) as MainMonsterTemplate[] : [];
  } catch {
    return [];
  }
}

export function saveStagedMonsters(staged: MainMonsterTemplate[]): void {
  try {
    window.localStorage.setItem(MONSTER_STAGED_KEY, JSON.stringify(staged));
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
