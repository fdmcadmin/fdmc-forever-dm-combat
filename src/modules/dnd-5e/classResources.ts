/**
 * CLASS RESOURCES — what each class tracks, by level.
 *
 * LAYER: D&D MOD. These are 5e's pools; another d20 system ships its own table and the engine
 * neither knows nor cares. The SHAPE — a pool with a max and a reset cadence — is engine.
 *
 * ⚠ AND IT NOW LIVES WHERE THAT SENTENCE SAYS IT DOES. This file declared "LAYER: D&D MOD" at the
 * top while sitting in `core/rules/`, which is the one place the line above says it must not be.
 * Moved to the mod beside `featPricing.generated.ts` and `shortRestRules.generated.ts`.
 * Christopher: *"classResources were suppose to go into it that is why we have the Main class and
 * sub class but if they didnt then they belong in the dnd mod, same with the short rest rules"*.
 *
 * ── WHAT THIS TABLE IS FOR, AND WHAT IT IS NOT ──────────────────────────────────────────────
 * This grants pools onto a CHARACTER SHEET when the editor builds one. It is read by
 * `ActorEditor` and nothing else. It is NOT the recovery authority: what a short rest gives back
 * is `shortRestRules.generated.ts`, generated from the workbook, which the sheet's own header
 * reserves for the app — *"the external party runtime applies these rules to live state"*.
 *
 * ⚠ THE TWO TABLES DISAGREE IN PLACES, AND THE DISAGREEMENTS ARE LISTED RATHER THAN PAPERED OVER.
 * The registry has 168 rules across 16 classes and 135 subclasses; this table has 13 classes and
 * NO subclasses. Where they differ today:
 *
 *   · Barbarian Rage — the registry says `one_expended_use` `on_finish_short_rest`. Here it is
 *     `longRest` carrying a prose `note`, because `reset` cannot express "full on a long rest,
 *     one use back on a short one". The note is not machine-readable, so a short rest in the app
 *     returns nothing for it. Fixing this needs a partial-recovery shape on `ClassResource`; it
 *     is a real change to the resource model and is not smuggled in with a file move.
 *   · Wizard Arcane Recovery — `longRest` here; the registry says `during_short_rest` /
 *     `once_per_long_rest`, which is a different rule: it is USED on a short rest, once between
 *     long rests.
 *   · Sorcerer Sorcerous Restoration (L5, up to half class level) — absent here entirely.
 *   · Warlock Pact Magic — deliberately absent here (slots belong to the slot system) and present
 *     in the registry, which owns the CADENCE rather than the pool. Both are correct.
 *   · Hit Point Dice — a registry row for all 16 classes; none here, because `core/rules/
 *     multiclass.ts` already grants them per die size and the app spends them.
 *   · Blood Hunter, Gunslinger and Illrigger are in the registry and missing here.
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

import type { ResourceKind } from "../../core/types/tabs";
import { shortRestRulesFor } from "./shortRestRules.generated";

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
  /**
   * What the workbook's registry says comes back on a short rest for this pool, e.g.
   * "all_expended_uses (on_finish_short_rest)". Absent when the registry names no rule for it.
   *
   * ⚠ REPORTED, NOT APPLIED. This is the authority's own line put in front of the DM; it does not
   * change `reset`, because `reset` is a single cadence and several of these are partial — a
   * Barbarian's Rage is a long-rest pool that returns ONE use on a short rest, which the current
   * shape cannot say. Showing the registry's words is honest; silently rewriting `reset` to
   * "shortRest" would refill the whole pool and be wrong in the direction that hands out power.
   */
  shortRest?: string;
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

/**
 * The registry's recovery line for one pool, matched by resource name.
 *
 * ⚠ MATCHED BOTH WAYS, because the two tables name the same thing at different lengths: this
 * table says "Sorcery Points" where the registry says "Sorcery Points (Sorcerous Restoration)".
 * A strict equality check would silently find nothing and every pool would look unrecovered.
 */
function registryShortRest(
  className: string,
  subclassName: string | null | undefined,
  level: number,
  label: string,
): string | undefined {
  const want = label.trim().toLowerCase();
  if (!want) return undefined;
  for (const rule of shortRestRulesFor(className, subclassName, level)) {
    const named = rule.resource.trim().toLowerCase();
    if (!named || !rule.recovery) continue;
    if (named === want || named.includes(want) || want.includes(named)) {
      return rule.timing ? `${rule.recovery} (${rule.timing})` : rule.recovery;
    }
  }
  return undefined;
}

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
  rows: readonly { name: string; level: number; subclassName?: string | null }[],
): (ClassResource & { className: string })[] {
  const out: (ClassResource & { className: string })[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const res of resourcesForClass(row.name, row.level)) {
      const label = seen.has(res.label) ? `${res.label} (${row.name})` : res.label;
      seen.add(res.label);
      out.push({
        ...res,
        label,
        className: row.name,
        shortRest: registryShortRest(row.name, row.subclassName, row.level, res.label),
      });
    }
  }
  return out;
}
