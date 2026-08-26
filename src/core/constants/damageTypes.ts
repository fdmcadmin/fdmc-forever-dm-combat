// Standard D&D damage types offered as builder defaults. The builder always ALSO
// offers a Custom free-text option, so the engine stays all-system (not D&D-locked) —
// per the P-UX4 brief's all-system d20 flexibility rule.
export const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];

/** True when the value is a non-empty type that isn't one of the standard defaults. */
export function isCustomDamageType(value: string | undefined): boolean {
  return Boolean(value && value.trim() && !DAMAGE_TYPES.includes(value.trim() as DamageType));
}

/**
 * ─── READING A TYPE, RATHER THAN OFFERING ONE ───────────────────────────────────────────────
 *
 * Everything above is the BUILDER's list — what to put in a dropdown. Everything below is for
 * reading a type back out of data that already exists, which turned out to be a different job.
 *
 * ⚠ THE WEAPON TABLE DID NOT RECORD WHAT A WEAPON DEALS. `BaseWeaponSeed` carried an attack
 * formula, a damage formula, a crit and a mastery — and no type. Every character sheet wrote it
 * into the DESCRIPTION instead ("Martial. Piercing. Finesse."), which is prose and unreadable as
 * data. So the encounter checker, weighting a creature's "resistant to fire" by the party's actual
 * share of fire damage, found twenty damage formulas and no types and could price none of it.
 * Twelve campaign creatures resist fire; all twelve scored zero.
 *
 * Christopher: *"i shouldnt need to go through each of my character sheet."* Right — a Greataxe
 * deals slashing because it is a Greataxe. That belongs in the weapon table, once.
 */

/** The builder list narrowed to a name a weapon can carry. Custom types stay free text elsewhere. */
export type DamageTypeName = DamageType;

/** A type as everything else will look it up: lower case, single-spaced, trimmed. */
export function normalizeDamageType(type: string | undefined): string {
  return (type ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The FIRST standard damage type named in a string, or undefined.
 *
 * ⚠ ONLY EVER CALLED ON A DAMAGE FIELD, never on a description. `"1d8 + 2 slashing"` is data —
 * the app's own convention writes the type there and `damageExpressionAverage` documents that
 * shape. `"Martial. Slashing. Versatile."` is prose about a weapon, and reading a type out of it
 * is the thing this codebase does not do.
 */
export function firstDamageTypeIn(text: string | undefined): DamageType | undefined {
  const hay = normalizeDamageType(text);
  if (!hay) return undefined;
  return DAMAGE_TYPES.find(t => new RegExp(String.raw`\b${t}\b`).test(hay));
}
