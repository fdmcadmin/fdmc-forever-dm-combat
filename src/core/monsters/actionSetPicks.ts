/**
 * ACTION SET PICKS — building one body from a template creature.
 *
 * Christopher: *"the DM say this is a one of them and then on veritable actions like the spells
 * there needs to be a how many of these types of actions are able to be chosen for this action
 * set."*
 *
 * A template carries every option a body COULD have; each body takes the stated number from each
 * pool. That is the same ABS-array shape used everywhere else in this app — the ability spine,
 * the equipment chassis, the spell-slot pool, the bond path — and it obeys the same rule
 * Christopher set for all of them: *"when you pick it you cant see it."* A taken option leaves
 * the pool, so two mirrors built from one template are genuinely different bodies.
 *
 * ⚠ THIS SITS BESIDE `spellSlotPicks.ts`, IT DOES NOT REPLACE IT. Slot-costed spells pool by
 * LEVEL because 5e counts slots for you; an action set is for the pools nothing counts. Both end
 * in the same place — a template plus a set of choices produces one concrete stat block.
 */

import type { MainMonsterTemplate, MonsterActionSet } from "./runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "./MonsterJconScanner";

/** Which action names fill each set, by set id. `null` = that slot is still empty. */
export type ActionSetPicks = Record<string, (string | null)[]>;

export type ActionSetPlan = {
  set: MonsterActionSet;
  /** Every action authored as a candidate for this set. */
  candidates: MonsterReaderAction[];
  /** How many the body takes — the set's `pick`, capped at what actually exists. */
  slots: number;
  /** True when the set asks for more than it offers, which the DM should fix. */
  short: boolean;
};

/** Every action tagged into a named set. */
export function actionSetCandidates(template: MainMonsterTemplate, setId: string): MonsterReaderAction[] {
  return (template.actions ?? []).filter(a => a.setId === setId);
}

/**
 * The sets this creature must be picked for.
 *
 * A set with no candidates is omitted — it asks a question with no answers, and raising a picker
 * with nothing in it just blocks generation.
 */
export function actionSetPlan(template: MainMonsterTemplate): ActionSetPlan[] {
  return (template.actionSets ?? [])
    .map(set => {
      const candidates = actionSetCandidates(template, set.id);
      return {
        set,
        candidates,
        // Never ask for more than exists: picks are distinct, so 5 slots from 3 candidates can
        // only ever fill 3 and the extra two would sit permanently empty, blocking the build.
        slots: Math.min(Math.max(0, set.pick), candidates.length),
        short: set.pick > candidates.length,
      };
    })
    .filter(p => p.candidates.length > 0 && p.slots > 0);
}

/** True when this creature needs choices before a body can be generated. */
export function needsActionSetPicks(template: MainMonsterTemplate): boolean {
  return actionSetPlan(template).length > 0;
}

/** An empty pick sheet — every slot of every set unfilled. */
export function emptyActionSetPicks(plan: ActionSetPlan[]): ActionSetPicks {
  return Object.fromEntries(plan.map(p => [p.set.id, Array<string | null>(p.slots).fill(null)]));
}

/**
 * What one slot may still be given: this set's candidates minus those already taken by OTHER
 * slots in the same set. The slot's own current pick stays listed, or re-choosing it would look
 * like an invalid selection.
 */
export function availableInSet(plan: ActionSetPlan, slotIndex: number, picks: ActionSetPicks): MonsterReaderAction[] {
  const taken = new Set((picks[plan.set.id] ?? []).filter((name, i) => i !== slotIndex && name));
  return plan.candidates.filter(c => !taken.has(c.name));
}

/** Slots still empty, as "Elemental package slot 2" labels — what a generate button reports. */
export function unfilledActionSlots(plan: ActionSetPlan[], picks: ActionSetPicks): string[] {
  return plan.flatMap(p =>
    (picks[p.set.id] ?? []).flatMap((name, i) => (name ? [] : [`${p.set.label} slot ${i + 1}`])),
  );
}

/**
 * One BODY built from the template: a copy whose pools have collapsed to the chosen actions.
 *
 * Candidates that were not picked are removed outright — they are options this body did not
 * take, and leaving them on the card would offer the DM an action the creature cannot use.
 * Anything with no `setId` is untouched, so fixed attacks, traits and reactions all survive.
 *
 * ⚠ THE TEMPLATE IS NOT MUTATED. Every body is a fresh copy and the template stays generic:
 * one mirror per adventurer, each different, all from the same authored shape. Mutating here
 * would make the first body generated permanent for every body after it.
 */
export function buildBodyFromTemplate(
  template: MainMonsterTemplate,
  picks: ActionSetPicks,
  opts?: { name?: string; templateIdSuffix?: string },
): MainMonsterTemplate {
  const chosen = new Set(Object.values(picks).flat().filter((n): n is string => Boolean(n)));
  return {
    ...template,
    templateId: opts?.templateIdSuffix ? `${template.templateId}:${opts.templateIdSuffix}` : template.templateId,
    ...(opts?.name ? { name: opts.name } : {}),
    // A generated body is a concrete creature, never itself a template to build more from.
    isTemplate: undefined,
    actionSets: undefined,
    actions: (template.actions ?? []).filter(a => !a.setId || chosen.has(a.name)),
  };
}
