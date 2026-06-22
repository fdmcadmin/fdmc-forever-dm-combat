/**
 * levelPresets — player-authored level snapshots ("L4 preset", "L5 preset", …).
 *
 * NOT an automatic class-progression system: every preset is a full actor sheet the
 * player (working with the DM) builds by hand, exactly like the actor builder. The
 * level-up workspace lets a player set these up ahead of time and then "step through"
 * them — each step submits the next preset to the DM for the normal approval flow.
 *
 * Browser-local (localStorage), keyed by actorId then level. Presets are a convenience
 * for the player who authored them; the DM approval gate is unchanged.
 */

import type { Actor } from "../types/actor";

const STORAGE_KEY = "fdmc.level.presets.v1";

type PresetMap = Record<string, Record<string, Actor>>; // actorId -> { [level]: Actor }

export type LevelPreset = { level: number; actor: Actor };

function readAll(): PresetMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PresetMap) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: PresetMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — presets are a convenience, never fatal.
  }
}

/** All presets for an actor, ascending by level. */
export function loadLevelPresets(actorId: string): LevelPreset[] {
  const byLevel = readAll()[actorId] ?? {};
  return Object.entries(byLevel)
    .map(([level, actor]) => ({ level: Number(level), actor }))
    .filter(p => Number.isFinite(p.level))
    .sort((a, b) => a.level - b.level);
}

/** Save (or overwrite) the preset for the actor at its own level. */
export function saveLevelPreset(actorId: string, actor: Actor): LevelPreset[] {
  const map = readAll();
  const byLevel = { ...(map[actorId] ?? {}), [String(actor.level)]: actor };
  writeAll({ ...map, [actorId]: byLevel });
  return loadLevelPresets(actorId);
}

/** Remove the preset at a level. */
export function deleteLevelPreset(actorId: string, level: number): LevelPreset[] {
  const map = readAll();
  const byLevel = { ...(map[actorId] ?? {}) };
  delete byLevel[String(level)];
  writeAll({ ...map, [actorId]: byLevel });
  return loadLevelPresets(actorId);
}

/** The next authored preset above the current level, if any (the "step" target). */
export function nextLevelPreset(actorId: string, currentLevel: number): LevelPreset | undefined {
  return loadLevelPresets(actorId).find(p => p.level > currentLevel);
}
