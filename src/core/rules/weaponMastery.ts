/**
 * WEAPON MASTERY — how many a character gets, and which ones they have chosen today.
 *
 * The 2024 rules give a martial class a number of mastery properties it can have active, and
 * that set is re-chosen when you finish a Long Rest. So mastery is not a feature to author on
 * a sheet — it is a CHOICE with a cadence, the same shape as a prepared spell list. Authoring
 * it as static "Weapon Mastery - Vex (Handaxe)" feature entries, as the library currently
 * does, freezes a decision the rules expect to be revisited and adds a row per weapon that
 * nobody can change at the table.
 *
 * Module-level, not system-level: these are D&D 2024 numbers and belong with the other
 * D&D rules, so a different system can supply its own without touching the card.
 */

/** The eight mastery properties. Any of them may be chosen — the weapon decides which applies. */
export const MASTERY_PROPERTIES = [
  "Cleave", "Graze", "Nick", "Push", "Sap", "Slow", "Topple", "Vex",
] as const;
export type MasteryProperty = typeof MASTERY_PROPERTIES[number];

export const MASTERY_BLURB: Record<MasteryProperty, string> = {
  Cleave: "On a melee hit, make one attack against a second creature within 5 ft. of the first. Once per turn.",
  Graze: "On a miss, the target still takes damage equal to the ability modifier used for the attack.",
  Nick: "The extra Light-property attack is part of the Attack action, not a Bonus Action. Once per turn.",
  Push: "On a hit, push the target up to 10 ft. straight away if it is Large or smaller.",
  Sap: "On a hit, the target has Disadvantage on its next attack roll before the start of your next turn.",
  Slow: "On a hit, reduce the target's Speed by 10 ft. until the start of your next turn.",
  Topple: "On a hit, the target makes a Con save against your spell save DC or has the Prone condition.",
  Vex: "On a hit, you have Advantage on your next attack roll against that target before the end of your next turn.",
};

/**
 * How many masteries a class has active, by class level.
 *
 * 2024 breakpoints. Fighter and Barbarian scale; Paladin, Ranger and Rogue are fixed at 2 and
 * never grow. Everyone else starts at zero and only ever gets there through a feat.
 */
const MASTERY_TABLE: Record<string, { level: number; count: number }[]> = {
  fighter: [{ level: 1, count: 3 }, { level: 4, count: 4 }, { level: 10, count: 5 }, { level: 16, count: 6 }],
  barbarian: [{ level: 1, count: 2 }, { level: 4, count: 3 }, { level: 10, count: 4 }],
  paladin: [{ level: 1, count: 2 }],
  ranger: [{ level: 1, count: 2 }],
  rogue: [{ level: 1, count: 2 }],
};

/** Classes that get masteries at all. Anything else is a caster/non-martial: zero. */
export const MASTERY_CLASSES = Object.keys(MASTERY_TABLE);

function countForSingleClass(className: string, level: number): number {
  // "Paladin 5" is how a person writes a class, so strip a trailing level rather than failing
  // to find a class by that name and silently reporting zero masteries.
  const rows = MASTERY_TABLE[className.trim().toLowerCase().replace(/\s+\d+$/, "")];
  if (!rows) return 0;
  let count = 0;
  for (const row of rows) {
    if (level >= row.level) count = row.count;
  }
  return count;
}

/**
 * Base mastery count from class and level, before any feat.
 *
 * `classLevels` is the honest input: a Fighter 4 / Wizard 6 gets FOUR levels of Fighter, so
 * three masteries, not the five that reading total character level would hand them. Pass it
 * whenever the character is multiclassed.
 *
 * Without it, "Paladin / Sorcerer" in one string still resolves — each name is looked up at
 * total level and the BEST entitlement wins, since masteries do not stack across classes. That
 * over-counts, which is exactly why the array exists.
 *
 * An unrecognised class returns 0 rather than guessing. A Sorcerer with a mastery should be a
 * visible authoring decision — a feat — never something the app inferred from a name.
 */
export function masteryCountForClass(
  className: string | undefined,
  level: number,
  classLevels?: readonly { name: string; level: number }[],
): number {
  if (classLevels && classLevels.length > 0) {
    return classLevels.reduce((best, c) => Math.max(best, countForSingleClass(c.name, c.level)), 0);
  }
  const raw = (className ?? "").trim();
  if (!raw) return 0;
  return raw.split("/").reduce((best, part) => Math.max(best, countForSingleClass(part, level)), 0);
}

/**
 * Total masteries a character may have active.
 *
 * `featGrants` is how a non-martial gets one at all — the Weapon Master feat grants a single
 * mastery, and it stacks onto a martial's class count rather than replacing it.
 */
export function masteryCount(opts: {
  className?: string;
  level: number;
  featGrants?: number;
  /** Per-class levels when multiclassed — the accurate input. */
  classLevels?: readonly { name: string; level: number }[];
}): number {
  return masteryCountForClass(opts.className, opts.level, opts.classLevels)
    + Math.max(0, opts.featGrants ?? 0);
}

/** Keep only real mastery names, deduped, and never more than the character is owed. */
export function normalizeMasteryChoices(chosen: unknown, limit: number): MasteryProperty[] {
  const list = Array.isArray(chosen) ? chosen : [];
  const seen = new Set<MasteryProperty>();
  for (const raw of list) {
    const match = MASTERY_PROPERTIES.find(p => p.toLowerCase() === String(raw).trim().toLowerCase());
    if (match) seen.add(match);
  }
  return [...seen].slice(0, Math.max(0, limit));
}
