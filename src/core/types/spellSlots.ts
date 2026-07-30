export type SpellSlotLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SpellActionLevel = SpellSlotLevel;

export type SpellCastingActionData = {
  baseSpellLevel: SpellActionLevel;
  usableSpellLevels: SpellActionLevel[];
  defaultCastLevel: SpellActionLevel;
  lastCastLevel?: SpellActionLevel;
  consumesSpellSlot: boolean;
  slotResourceKeyPrefix: string;
};

export function formatSpellLevel(level: SpellActionLevel) {
  return level === 0 ? "Cantrip" : `Level ${level}`;
}

export function spellSlotResourceKey(prefix: string, level: SpellActionLevel) {
  return `${prefix}:${level}`;
}

export function clampSpellActionLevel(value: unknown, fallback: SpellActionLevel = 0): SpellActionLevel {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(9, Math.max(0, Math.floor(parsed))) as SpellActionLevel;
}

export function normalizeUsableSpellLevels(value: unknown, fallback: SpellActionLevel[] = [0]): SpellActionLevel[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const levels = value
    .map((entry) => clampSpellActionLevel(entry, 0))
    .filter((entry, index, array) => array.indexOf(entry) === index)
    .sort((a, b) => a - b);

  return levels.length > 0 ? levels : fallback;
}

/**
 * How many separate attack rolls one cast of this spell makes.
 *
 * Scorching Ray: base level 2, `attackRolls: 3`, `attackRollsPerLevel: 1` — cast at L2 it is
 * 3 rays, at L4 it is 5. Each ray is its own d20 resolved hit/miss with its own damage, but
 * the cast spends exactly ONE slot (see `continuesMultiRoll` on the committed-roll input).
 *
 * The base level is the lowest level the spell can be cast at, so upcast scaling works
 * whether the level comes from a runtime pick (`selectedCastLevel`) or from an action
 * authored at a higher level — which is how upcasting is expressed today.
 *
 * Returns 1 for anything that does not declare a ray count, so every existing single-roll
 * spell is untouched.
 */
export function spellAttackRollCount(metadata: {
  attackRolls?: number;
  attackRollsPerLevel?: number;
  spellLevel?: number;
  selectedCastLevel?: number | null;
  usableSpellLevels?: number[];
} | undefined): number {
  const base = Math.floor(metadata?.attackRolls ?? 0);
  if (!Number.isFinite(base) || base < 1) {
    return 1;
  }

  const perLevel = Math.floor(metadata?.attackRollsPerLevel ?? 0);
  if (!Number.isFinite(perLevel) || perLevel <= 0) {
    return base;
  }

  const declaredLevel = metadata?.spellLevel ?? 0;
  const usable = (metadata?.usableSpellLevels ?? []).filter((level) => Number.isFinite(level));
  // Base level = the lowest slot this spell can go in. A Scorching Ray action authored at L4
  // still knows it is a level-2 spell because L2 is in its usable list.
  const baseLevel = usable.length > 0 ? Math.min(...usable, declaredLevel) : declaredLevel;
  const castLevel = metadata?.selectedCastLevel ?? declaredLevel;
  const above = Math.max(0, Math.floor(castLevel) - Math.floor(baseLevel));

  return base + perLevel * above;
}

export function makeSpellCastingData(params: Partial<SpellCastingActionData> & { baseSpellLevel?: unknown }) {
  const baseSpellLevel = clampSpellActionLevel(params.baseSpellLevel, 0);
  const usableSpellLevels = normalizeUsableSpellLevels(params.usableSpellLevels, [baseSpellLevel]);
  const defaultCastLevel = clampSpellActionLevel(params.defaultCastLevel, baseSpellLevel);

  return {
    baseSpellLevel,
    usableSpellLevels,
    defaultCastLevel,
    lastCastLevel: params.lastCastLevel === undefined ? undefined : clampSpellActionLevel(params.lastCastLevel, defaultCastLevel),
    consumesSpellSlot: params.consumesSpellSlot !== false,
    slotResourceKeyPrefix: typeof params.slotResourceKeyPrefix === "string" && params.slotResourceKeyPrefix.trim() ? params.slotResourceKeyPrefix.trim() : "spell-slot",
  } satisfies SpellCastingActionData;
}
