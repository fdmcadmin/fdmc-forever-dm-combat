/**
 * CLASS RESOURCES — what each class tracks, by level.
 *
 * LAYER: D&D MOD. These are 5e's pools; another d20 system ships its own table and the engine
 * neither knows nor cares. The SHAPE — a pool with a max and a reset cadence — is engine.
 *
 * Built on the same pattern as `weaponMastery`: a table keyed by class, read by level, with the
 * multiclass case handled by asking each class row separately. A DM should not have to hand-type
 * "Second Wind, 2 uses, short rest" onto every Fighter when the rule is the same for all of them.
 *
 * ⚠ SPELL SLOTS ARE NOT HERE. They are their own system with their own progression, and a class
 * that casts already gets them elsewhere. This table is the OTHER pools — the ones that were
 * invisible unless somebody typed them in, which is why a class without spells looked as though
 * it had no resources at all.
 *
 * `formula` is resolved through the normal @-variable path, so a pool that scales writes itself:
 * Lay on Hands is `@MAIN*5`, not a number that has to be re-typed at every level.
 */

import type { ResourceKind } from "../types/tabs";

export type ClassResource = {
  label: string;
  /** Uses at this level. A string is a formula (`@MAIN*5`); a number is a flat count. */
  max: number | string;
  /** When it comes back. `shortRest` also restores on a long rest. */
  reset: "longRest" | "shortRest" | "encounter" | "manual";
  kind: ResourceKind;
  /** Level the class gains it. */
  level: number;
  note?: string;
};

/**
 * One entry per class, in level order. `max` may be a formula, and the highest entry at or below
 * the character's level in that class wins — so Second Wind is 2 uses at 4th and 3 at 10th
 * without three separate rows appearing on the sheet.
 */
const CLASS_RESOURCES: Record<string, ClassResource[]> = {
  barbarian: [
    { label: "Rage", max: 2, reset: "longRest", kind: "pool", level: 1, note: "Regain one on a short rest" },
    { label: "Rage", max: 3, reset: "longRest", kind: "pool", level: 3 },
    { label: "Rage", max: 4, reset: "longRest", kind: "pool", level: 6 },
    { label: "Rage", max: 5, reset: "longRest", kind: "pool", level: 12 },
    { label: "Rage", max: 6, reset: "longRest", kind: "pool", level: 17 },
  ],
  fighter: [
    { label: "Second Wind", max: 2, reset: "shortRest", kind: "pool", level: 1 },
    { label: "Second Wind", max: 3, reset: "shortRest", kind: "pool", level: 4 },
    { label: "Second Wind", max: 4, reset: "shortRest", kind: "pool", level: 10 },
    { label: "Action Surge", max: 1, reset: "shortRest", kind: "pool", level: 2 },
    { label: "Action Surge", max: 2, reset: "shortRest", kind: "pool", level: 17 },
    { label: "Indomitable", max: 1, reset: "longRest", kind: "pool", level: 9 },
    { label: "Indomitable", max: 2, reset: "longRest", kind: "pool", level: 13 },
    { label: "Indomitable", max: 3, reset: "longRest", kind: "pool", level: 17 },
  ],
  monk: [
    { label: "Focus Points", max: "@MAIN", reset: "shortRest", kind: "pool", level: 2 },
  ],
  paladin: [
    { label: "Lay on Hands", max: "@MAIN*5", reset: "longRest", kind: "pool", level: 1, note: "A pool of hit points, not uses" },
    { label: "Channel Divinity", max: 2, reset: "shortRest", kind: "pool", level: 3 },
    { label: "Channel Divinity", max: 3, reset: "shortRest", kind: "pool", level: 11 },
  ],
  rogue: [
    // Sneak Attack is not a pool — it is once per turn, which the rider system owns.
  ],
  ranger: [
    { label: "Favored Enemy", max: 2, reset: "longRest", kind: "freeCast", level: 1, note: "Hunter's Mark, no slot" },
  ],
  bard: [
    { label: "Bardic Inspiration", max: "@CASTMOD", reset: "shortRest", kind: "pool", level: 1 },
  ],
  cleric: [
    { label: "Channel Divinity", max: 2, reset: "shortRest", kind: "pool", level: 2 },
    { label: "Channel Divinity", max: 3, reset: "shortRest", kind: "pool", level: 6 },
    { label: "Channel Divinity", max: 4, reset: "shortRest", kind: "pool", level: 18 },
  ],
  druid: [
    { label: "Wild Shape", max: 2, reset: "shortRest", kind: "pool", level: 2 },
    { label: "Wild Shape", max: 3, reset: "shortRest", kind: "pool", level: 6 },
    { label: "Wild Shape", max: 4, reset: "shortRest", kind: "pool", level: 17 },
  ],
  sorcerer: [
    { label: "Sorcery Points", max: "@MAIN", reset: "longRest", kind: "pool", level: 2 },
  ],
  warlock: [
    // Pact slots are spell slots and belong to the slot system, not here.
  ],
  wizard: [
    { label: "Arcane Recovery", max: 1, reset: "longRest", kind: "pool", level: 1 },
  ],
  artificer: [
    { label: "Infusions", max: 4, reset: "longRest", kind: "pool", level: 2 },
    { label: "Infusions", max: 6, reset: "longRest", kind: "pool", level: 10 },
    { label: "Flash of Genius", max: "@CASTMOD", reset: "longRest", kind: "pool", level: 7 },
  ],
};

/** Does this class have a resource table at all? */
export function classHasResources(className: string): boolean {
  return Boolean(CLASS_RESOURCES[className.trim().toLowerCase()]?.length);
}

/**
 * The resources one class grants at a given level — the highest entry per label at or below it.
 *
 * Returning one row per LABEL is the point: a level 17 Fighter has Second Wind 4, not four Second
 * Wind rows. Levelling a character re-reads this and the max moves on its own.
 */
export function resourcesForClass(className: string, level: number): ClassResource[] {
  const table = CLASS_RESOURCES[className.trim().toLowerCase()] ?? [];
  const best = new Map<string, ClassResource>();
  for (const row of table) {
    if (row.level > level) continue;
    const held = best.get(row.label);
    if (!held || row.level > held.level) best.set(row.label, row);
  }
  return [...best.values()];
}

/**
 * Every resource a character gets from every class they hold.
 *
 * ⚠ Same-named pools from two classes are NOT merged. A Paladin 3 / Cleric 2 has two Channel
 * Divinity entries in 5e and they do not stack into one pool; merging them would invent a rule.
 * They are labelled with the class so the sheet says which is which.
 */
export function resourcesForClasses(
  rows: readonly { name: string; level: number }[],
): (ClassResource & { className: string })[] {
  const out: (ClassResource & { className: string })[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const res of resourcesForClass(row.name, row.level)) {
      const label = seen.has(res.label) ? `${res.label} (${row.name})` : res.label;
      seen.add(res.label);
      out.push({ ...res, label, className: row.name });
    }
  }
  return out;
}
