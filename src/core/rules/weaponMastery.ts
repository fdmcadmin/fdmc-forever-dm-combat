/**
 * WEAPON MASTERY — which WEAPONS a character has mastery with, and how many they get.
 *
 * The 2024 rules give a martial class a number of weapons it can have mastery with, and that
 * set is re-chosen when you finish a Long Rest. So mastery is not a feature to author on a
 * sheet — it is a CHOICE with a cadence, the same shape as a prepared spell list. Authoring it
 * as static "Weapon Mastery - Vex (Handaxe)" feature entries, as the library once did, freezes
 * a decision the rules expect to be revisited and adds a row per weapon nobody can change at
 * the table.
 *
 * ### ⛔ THE CHOICE IS A WEAPON, NOT A PROPERTY
 *
 * This module used to export the eight properties and a `normalizeMasteryChoices` that picked
 * among them, and the card asked the player to choose two of Cleave / Graze / Nick / … That is
 * backwards. A mastery is a property a WEAPON has: a handaxe is Vex because the 2024 weapon
 * table says so, and nobody chooses that. What a character chooses is which of their weapons
 * they have mastery with — the property follows from the weapon.
 *
 * Christopher: *"you have to choose a weapon for that mastery not the type so someone could
 * have vex but it be on a short sword instead of a short bow."* Vex on a shortsword and Vex on
 * a shortbow are different characters, and a picker over the eight properties cannot tell them
 * apart — it records that you have Vex and leaves what you have it ON unanswered.
 *
 * So the chosen value is a BASE WEAPON FORM id, the property is READ OFF `BASE_WEAPONS`, and
 * the options are built from the weapons the character actually carries — see
 * `masteryWeaponOptions`. No table is added here: `BASE_WEAPONS` already carries the property
 * per weapon and `masteryCountForClass` already derives the count.
 *
 * Module-level, not system-level: these are D&D 2024 numbers and belong with the other
 * D&D rules, so a different system can supply its own without touching the card.
 */

import { findForm } from "../constants/chassis";
import type { WeaponMasteryName } from "../constants/weaponMastery";

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

// ─── Which weapons there are to choose from ──────────────────────────────────

/**
 * An equipment row as this module needs to read it.
 *
 * Deliberately structural, not the card's `ActorAction` type: a rules module should not depend
 * on the card's action shape, and every caller already holds rows that satisfy this.
 */
export type MasteryWeaponRow = {
  id: string;
  label: string;
  metadata?: { chassis?: { formId?: string } };
};

/** One pickable weapon: the base form, its mastery, and the carried items that resolve to it. */
export type MasteryWeaponOption = {
  /** The base weapon form id — `base-handaxe`. This is the value that gets stored. */
  formId: string;
  /** The base weapon's own name — "Handaxe". */
  formName: string;
  /** Read off the 2024 table, never chosen. */
  mastery: WeaponMasteryName;
  /** Every carried item that resolves to this form. More than one is normal — two daggers. */
  itemIds: string[];
  /** Those items' labels, for a picker that has to be recognisable at the table. */
  itemLabels: string[];
};

/**
 * The BASE WEAPON an equipment row resolves to, or undefined.
 *
 * Two ways a row resolves to one, and they are the same two `inheritedMasteryFor` uses on the
 * item side: the item IS a seeded base weapon (its id names the form), or it is a chassis whose
 * form has been chosen. Everything else — a homebrew with no base form, an unformed chassis, a
 * wondrous item — resolves to nothing, and has no weapon type to have mastery with.
 *
 * ⚠ READ FROM THE EQUIPMENT ROW, NOT THE ATTACK ROW. `itemToAttackAction` bakes the mastery's
 * rules text into its details string and carries neither `mastery` nor `chassis` in metadata,
 * so an `atk-` row cannot answer this. Both rows share one item id, which is how the card pairs
 * them — the same move `boundCharms` makes.
 */
function formForRow(row: MasteryWeaponRow) {
  const itemId = row.id.replace(/^equip-/, "");
  const own = itemId.startsWith("base-") ? findForm(itemId) : undefined;
  return own ?? findForm(row.metadata?.chassis?.formId);
}

/**
 * The weapons this character could have mastery with: one option per distinct base form among
 * the equipment rows they are carrying.
 *
 * ⚠ CARRIED, NOT THE WHOLE TABLE. Christopher's call — the picker offers the weapons in the
 * bag, so a Vex pick is visibly a pick of the shortsword in hand rather than a line item from a
 * 33-row list the character may own none of.
 *
 * ⚠ AND ONE OPTION PER FORM, NOT PER ITEM. Mastery in 2024 attaches to a weapon TYPE, so a
 * character carrying two handaxes has mastery with both for one pick and must not be made to
 * spend two. Deduping here is what makes that true: the option carries every item id that
 * resolves to the form, and all of them light up together.
 *
 * STOWED WEAPONS COUNT. The set is re-chosen on a Long Rest, when nothing is in hand; a weapon
 * in the bag is still a weapon you have mastery with.
 */
export function masteryWeaponOptions(rows: readonly MasteryWeaponRow[]): MasteryWeaponOption[] {
  const byForm = new Map<string, MasteryWeaponOption>();
  for (const row of rows) {
    const form = formForRow(row);
    if (!form?.mastery) continue;
    const itemId = row.id.replace(/^equip-/, "");
    const existing = byForm.get(form.id);
    if (existing) {
      if (!existing.itemIds.includes(itemId)) {
        existing.itemIds.push(itemId);
        existing.itemLabels.push(row.label);
      }
    } else {
      byForm.set(form.id, {
        formId: form.id,
        formName: form.name,
        mastery: form.mastery,
        itemIds: [itemId],
        itemLabels: [row.label],
      });
    }
  }
  return [...byForm.values()].sort((a, b) => a.formName.localeCompare(b.formName));
}

/**
 * Keep only forms this character can actually pick, deduped, and never more than they are owed.
 *
 * ⚠ A STORED VALUE THAT IS NO LONGER AN OPTION IS DROPPED, and that is the point: the choices
 * live in local storage, and the weapon they name can be given away, sold or stowed into
 * another character's bag between sessions. A pick naming a weapon the character no longer
 * carries would keep marking nothing, forever, while still counting against the limit.
 *
 * It is also what retires the old saves. Before this, the stored value was a PROPERTY name —
 * "Vex", "Graze" — and there is no honest way to turn one of those into a weapon: Vex is on
 * eight of them. Those entries match no form id, so they fall out here and the player re-picks
 * once.
 */
export function normalizeMasteryWeapons(
  chosen: unknown,
  options: readonly MasteryWeaponOption[],
  limit: number,
): string[] {
  const legal = new Set(options.map(o => o.formId));
  const list = Array.isArray(chosen) ? chosen : [];
  const seen = new Set<string>();
  for (const raw of list) {
    const id = String(raw).trim();
    if (legal.has(id)) seen.add(id);
  }
  return [...seen].slice(0, Math.max(0, limit));
}

/**
 * ITEM ID → the mastery that is LIVE on it, for every item covered by a chosen form.
 *
 * This is what puts the property where the weapon is swung. The card marks an item's equipment
 * entry and its attack row from this map, so "I have mastery with my handaxe" is readable on
 * the thing being swung instead of only in a resource list.
 */
export function activeMasteryByItemId(
  options: readonly MasteryWeaponOption[],
  chosenFormIds: readonly string[],
): Map<string, WeaponMasteryName> {
  const out = new Map<string, WeaponMasteryName>();
  const chosen = new Set(chosenFormIds);
  for (const option of options) {
    if (!chosen.has(option.formId)) continue;
    for (const itemId of option.itemIds) out.set(itemId, option.mastery);
  }
  return out;
}
