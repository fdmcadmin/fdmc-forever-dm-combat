/**
 * DM Monster Library — localStorage manager for MainMonsterTemplate[]
 *
 * Monsters built through MonsterJconBuilder are saved here.
 * The library is DM-local only — never written to room metadata.
 * Staged monsters (ready to enter combat) are a separate list.
 */

import type { MainMonsterTemplate } from "./runtime/mainMonsterRuntime";
import type { NormalizedMonsterActor, MonsterAction as NMonsterAction } from "../types/monsterTypes";
import type { MonsterReaderAction } from "./MonsterJconScanner";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const MONSTER_LIBRARY_KEY = "fdmc.dm.monsterLibrary.v1";
const MONSTER_STAGED_KEY = "fdmc.dm.monsterStaged.v1";

// ─── Library operations ───────────────────────────────────────────────────────

export function loadMonsterLibrary(): MainMonsterTemplate[] {
  try {
    const raw = window.localStorage.getItem(MONSTER_LIBRARY_KEY);
    return raw ? JSON.parse(raw) as MainMonsterTemplate[] : [];
  } catch {
    return [];
  }
}

export function saveMonsterLibrary(library: MainMonsterTemplate[]): void {
  try {
    window.localStorage.setItem(MONSTER_LIBRARY_KEY, JSON.stringify(library));
  } catch {
    // localStorage unavailable
  }
}

export function upsertMonsterTemplate(template: MainMonsterTemplate): void {
  const library = loadMonsterLibrary();
  const idx = library.findIndex(t => t.templateId === template.templateId);
  if (idx === -1) {
    library.push(template);
  } else {
    library[idx] = template;
  }
  saveMonsterLibrary(library);
}

export function deleteMonsterTemplate(templateId: string): void {
  const library = loadMonsterLibrary().filter(t => t.templateId !== templateId);
  saveMonsterLibrary(library);
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
      kind: (monster.kind === "boss" ? "boss" : monster.kind === "npc" ? "npc" : "monster") as "monster" | "npc" | "boss",
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
