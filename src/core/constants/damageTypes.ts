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
