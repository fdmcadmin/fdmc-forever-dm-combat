export type ActionCost = "main" | "bonus" | "bond" | "reaction";

export type ActorActionEconomyState = Record<ActionCost, string | null>;

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
};

export function hasReadiedCost(state: ActorActionEconomyState, cost: ActionCost) {
  return Boolean(state[cost]);
}

export function getReadiedCount(state?: ActorActionEconomyState) {
  if (!state) {
    return 0;
  }

  return Object.values(state).filter(isReadiedActionStateValue).length;
}
