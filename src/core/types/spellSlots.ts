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
