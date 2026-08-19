/**
 * MULTICLASS — levels belong to classes; the character's level is their sum.
 *
 * Paladin 5 / Sorcerer 1 is a level 6 character with 5 levels of Paladin and 1 of Sorcerer,
 * and almost every rule that matters cares about the second number, not the first. Storing
 * only "Paladin / Sorcerer" plus a total meant every per-class rule had to read the total and
 * over-count: a Fighter 4 / Wizard 6 was drawing 10th-level Fighter weapon masteries.
 *
 * Proficiency bonus is the exception that proves it — that one genuinely comes from the total,
 * which is why it stays where it is and reads `characterLevel`.
 */

import type { Actor } from "../types/actor";

export type ClassLevel = { name: string; level: number; hitDie?: string; castingAbility?: CastingAbility };

/** Default hit die by class, used when a class row does not name one. */
const CLASS_HIT_DIE: Record<string, string> = {
  barbarian: "d12",
  fighter: "d10", paladin: "d10", ranger: "d10",
  artificer: "d8", bard: "d8", cleric: "d8", druid: "d8",
  monk: "d8", rogue: "d8", warlock: "d8",
  sorcerer: "d6", wizard: "d6",
};

export function hitDieForClass(name: string): string | undefined {
  return CLASS_HIT_DIE[name.trim().toLowerCase()];
}

export type CastingAbility = "str" | "dex" | "con" | "int" | "wis" | "cha";

/**
 * Spellcasting ability by class — DERIVED, exactly like the hit die above.
 *
 * Deriving it means a per-action casting stat needs NO new field on any class row and no
 * migration of existing sheets: name the class, get the ability. The alternative was adding a
 * casting-ability column to every character in the party.
 *
 * ⚠ Half-casters are here too (paladin CHA, ranger WIS, artificer INT) because they cast; the
 * table answers "which stat", not "how many slots".
 */
const CLASS_CASTING_ABILITY: Record<string, CastingAbility> = {
  bard: "cha", sorcerer: "cha", warlock: "cha", paladin: "cha",
  cleric: "wis", druid: "wis", ranger: "wis", monk: "wis",
  wizard: "int", artificer: "int",
};

export function castingAbilityForClass(name: string): CastingAbility | undefined {
  return CLASS_CASTING_ABILITY[name.trim().toLowerCase()];
}

/** Every class row, normalised. Empty for a single-class character. */
export function classLevels(actor: Pick<Actor, "classes">): ClassLevel[] {
  return (actor.classes ?? [])
    .map(c => ({
      name: String(c.name ?? "").trim(),
      level: Math.max(0, Math.floor(Number(c.level) || 0)),
      hitDie: c.hitDie?.trim() || hitDieForClass(String(c.name ?? "")),
      // An explicit choice always beats the name lookup.
      castingAbility: c.castingAbility ?? castingAbilityForClass(String(c.name ?? "")),
    }))
    .filter(c => c.name && c.level > 0);
}

/**
 * The character's level.
 *
 * The sum of the class levels when they are present, and the stored `level` otherwise. Always
 * go through this rather than reading `actor.level`, or a sheet where someone edited one and
 * not the other will quietly disagree with itself.
 */
export function characterLevel(actor: Pick<Actor, "classes" | "level">): number {
  const rows = classLevels(actor);
  if (rows.length === 0) return Math.max(1, actor.level);
  return Math.max(1, rows.reduce((n, c) => n + c.level, 0));
}

/** "Paladin 5 / Sorcerer 1" — for display where a full breakdown IS wanted. */
export function formatClassLevels(actor: Pick<Actor, "classes" | "className" | "level">): string {
  const rows = classLevels(actor);
  if (rows.length === 0) return [actor.className, actor.level].filter(Boolean).join(" ");
  return rows.map(c => `${c.name} ${c.level}`).join(" / ");
}

/**
 * Hit dice as pools, one per class.
 *
 * A Paladin 5 / Sorcerer 1 has 5d10 and 1d6 — not six of anything, which is exactly what a
 * single "Hit Dice (d10)" resource was forced to claim. Returns one entry per DIE SIZE, so two
 * d8 classes merge into one pool rather than two rows the player has to add up.
 */
export function hitDicePools(actor: Pick<Actor, "classes" | "className" | "level">): { die: string; count: number }[] {
  const rows = classLevels(actor);
  if (rows.length === 0) {
    const die = hitDieForClass(actor.className ?? "");
    return die ? [{ die, count: Math.max(1, actor.level) }] : [];
  }
  const byDie = new Map<string, number>();
  for (const c of rows) {
    if (!c.hitDie) continue;
    byDie.set(c.hitDie, (byDie.get(c.hitDie) ?? 0) + c.level);
  }
  // Biggest die first — that is the one a player spends when they need the most back.
  return [...byDie.entries()]
    .map(([die, count]) => ({ die, count }))
    .sort((a, b) => (Number(b.die.slice(1)) || 0) - (Number(a.die.slice(1)) || 0));
}

/**
 * Parse the editor's two free-text fields into class rows.
 *
 *   "Paladin / Sorcerer" + "5 / 1" → [Paladin 5, Sorcerer 1]
 *
 * A single class with no level split returns nothing, so a normal character never grows an
 * array saying what `className` and `level` already say. A missing level is a real gap and is
 * dropped rather than guessed at — half a multiclass is worse than none.
 */
export function parseClassLevels(className: string, levels: string): ClassLevel[] {
  const names = className.split("/").map(s => s.trim()).filter(Boolean);
  if (names.length < 2) return [];
  const nums = levels.split("/").map(s => Number.parseInt(s.trim(), 10));
  return names
    // castingAbility too — classLevels() derives it, and this parallel builder did not, so a
    // multiclass sheet came back with every row saying it casts on nothing.
    .map((name, i) => ({ name, level: nums[i], hitDie: hitDieForClass(name), castingAbility: castingAbilityForClass(name) }))
    .filter(c => Number.isFinite(c.level) && c.level > 0);
}
