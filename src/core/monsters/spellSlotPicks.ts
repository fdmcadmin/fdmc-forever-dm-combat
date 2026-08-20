/**
 * SPELL SLOT PICKS — filling an authored caster's slots at the moment it is generated.
 *
 * THE PATTERN. This is the same shape as the equipment chassis, one level up: the AUTHOR writes
 * a template carrying options and slot counts, and the DM picks what fills them when the thing
 * is handed over. The template ships; the picks are local. Christopher: *"i build all the spells
 * hale and the UR have just like a character, then we make the generater have a picker for each
 * of the slots at X Level"*.
 *
 * ⚠ ABS-ARRAY SEMANTICS. *"it would be like the ABS array in dnd beyond, when you pick it you
 * cant see it"* — a spell assigned to a slot LEAVES the pool for that level, so three level-1
 * slots drawn from six candidates yield three DIFFERENT spells. This is the whole reason picks
 * are validated together rather than one dropdown at a time: a picker that only knew its own
 * slot could not know a spell had already been taken.
 *
 * Slots at different levels are independent pools. A spell authored as a candidate at both
 * level 1 and level 2 is two different candidates, because it is a different casting.
 */

import type { MainMonsterTemplate } from "./runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "./MonsterJconScanner";

/** Which spell fills each slot at a level. `null` = still unfilled. */
export type SlotPicks = Record<number, (string | null)[]>;

export type SlotPlanLevel = {
  level: number;
  /** How many slots the creature has at this level. */
  slots: number;
  /** Every spell authored as a candidate for this level. */
  candidates: MonsterReaderAction[];
};

/** Every spell action on a template that was marked as a pool candidate. */
export function slotCandidates(template: MainMonsterTemplate): MonsterReaderAction[] {
  return (template.actions ?? []).filter(a => a.slotCandidate && typeof a.spellSlotLevel === "number");
}

/**
 * The levels this creature must be picked for.
 *
 * A level with no candidates is omitted — the creature has slots but a fixed spell list, which
 * is the normal case and must not raise a picker with nothing in it.
 */
export function slotPlan(template: MainMonsterTemplate): SlotPlanLevel[] {
  const candidates = slotCandidates(template);
  if (candidates.length === 0) return [];
  return (template.stats.spellSlots ?? [])
    .map(({ level, max }) => ({
      level,
      slots: max,
      candidates: candidates.filter(a => a.spellSlotLevel === level),
    }))
    .filter(l => l.candidates.length > 0 && l.slots > 0)
    .sort((a, b) => a.level - b.level);
}

/** True when this creature needs a DM decision before it can be generated. */
export function needsSlotPicks(template: MainMonsterTemplate): boolean {
  return slotPlan(template).length > 0;
}

/** An empty pick sheet — every slot unfilled. */
export function emptyPicks(plan: SlotPlanLevel[]): SlotPicks {
  return Object.fromEntries(plan.map(l => [l.level, Array<string | null>(l.slots).fill(null)]));
}

/**
 * What one slot may still be given: this level's candidates minus the ones already taken by
 * OTHER slots at the same level. The slot's own current pick stays listed, or choosing it again
 * would look like an invalid selection.
 */
export function availableFor(level: SlotPlanLevel, slotIndex: number, picks: SlotPicks): MonsterReaderAction[] {
  const taken = new Set((picks[level.level] ?? []).filter((name, i) => i !== slotIndex && name));
  return level.candidates.filter(c => !taken.has(c.name));
}

/** Slots still empty, as "L1 slot 2" style labels — what the generate button reports. */
export function unfilledSlots(plan: SlotPlanLevel[], picks: SlotPicks): string[] {
  return plan.flatMap(l =>
    (picks[l.level] ?? []).flatMap((name, i) => (name ? [] : [`L${l.level} slot ${i + 1}`])),
  );
}

/**
 * A creature whose pool has collapsed to the chosen spells.
 *
 * Candidates that were NOT picked are removed outright — they are spells this Hale did not
 * bring, and leaving them on the card would offer the DM a spell the creature cannot cast.
 * Everything that was never a candidate is untouched, so attacks, traits and fixed spells all
 * survive exactly as authored.
 *
 * ⚠ The returned template is a COPY. The library entry stays generic on purpose: two DMs
 * running Hale should be able to bring different spells, and a mutation here would silently
 * make the first generation permanent for everyone on that machine.
 */
export function applySlotPicks(template: MainMonsterTemplate, picks: SlotPicks): MainMonsterTemplate {
  const chosen = new Set(Object.values(picks).flat().filter((n): n is string => Boolean(n)));
  return {
    ...template,
    actions: (template.actions ?? []).filter(a => !a.slotCandidate || chosen.has(a.name)),
  };
}
