/**
 * The action economy — SIX costs, four of which occupy a slot.
 *
 * ⚠ REBUILT 2026-08-18. `ActionCost` used to list four values while the editor offered six, and
 * `free`/`passive` were both flattened to an empty cost array. That made "consumes no slot" and
 * "cannot be used" the same statement, so every gate asking `costs.length === 0` answered the
 * wrong question. It was patched twice — first at three call sites, then behind a predicate — and
 * both times the type still said something untrue, so a new gate could reintroduce the bug by
 * writing the obvious thing.
 *
 * Christopher: *"there is no reason that we have 'fixed' it twice and it still has 4 values."*
 *
 * The model now separates two ideas that were one:
 *   · `ActionCost`  — what an action COSTS. All six, including `free` and `passive`.
 *   · `EconomySlot` — the four that occupy a tracked slot and can be readied, swapped and spent.
 *
 * A free action therefore carries `["free"]`, not `[]`. It is costless without being absent, so
 * a gate that tests for emptiness no longer catches it by accident — the distinction is in the
 * data rather than in every reader's memory.
 */

/** The four that occupy a slot in the economy state. Readied, swapped, spent. */
export type EconomySlot = "main" | "bonus" | "bond" | "reaction";

/** Every cost an action can carry. `free` and `passive` consume no slot. */
export type ActionCost = EconomySlot | "free" | "passive";

export const ECONOMY_SLOTS: readonly EconomySlot[] = ["main", "bonus", "bond", "reaction"] as const;

/**
 * Does this cost occupy a slot? The type guard is the point: anything indexing the economy
 * state must narrow through here, so `state[cost]` cannot be written against `free`.
 */
export function consumesSlot(cost: ActionCost): cost is EconomySlot {
  return cost !== "free" && cost !== "passive";
}

/** Only the slot-consuming costs, for readying and spending. */
export function slotsOf(costs: readonly ActionCost[]): EconomySlot[] {
  return costs.filter(consumesSlot);
}

/**
 * Costless but USABLE. The case the old four-value type could not express, and the reason
 * Shield Bash — a save-DC action authored Free and hidden from the log — sat dead on the sheet.
 */
export function isFreeCost(costs: readonly ActionCost[]): boolean {
  return costs.includes("free");
}

/** ⚠ KEYED BY SLOT, not by cost. There is no "free" slot to ready, swap or use up. */
export type ActorActionEconomyState = Record<EconomySlot, string | null>;

export type ActorActionEconomyMap = Record<string, ActorActionEconomyState>;

export const USED_ACTION_STATE_PREFIX = "__fdm_used__:";

export function makeUsedActionStateValue(readiedKey: string) {
  return `${USED_ACTION_STATE_PREFIX}${readiedKey}`;
}

export function isUsedActionStateValue(value: string | null | undefined) {
  return Boolean(value?.startsWith(USED_ACTION_STATE_PREFIX));
}

export function isReadiedActionStateValue(value: string | null | undefined) {
  return Boolean(value && !isUsedActionStateValue(value));
}

export const emptyActionEconomyState: ActorActionEconomyState = {
  main: null,
  bonus: null,
  bond: null,
  reaction: null,
};

export const actionCostLabels: Record<ActionCost, string> = {
  main: "Action",
  bonus: "Bonus Action",
  bond: "Bond",
  reaction: "Reaction",
  free: "Free",
  passive: "Passive",
};

export function hasReadiedCost(state: ActorActionEconomyState, cost: ActionCost) {
  return consumesSlot(cost) ? Boolean(state[cost]) : false;
}

export function getReadiedCount(state?: ActorActionEconomyState) {
  if (!state) {
    return 0;
  }

  return Object.values(state).filter(isReadiedActionStateValue).length;
}
