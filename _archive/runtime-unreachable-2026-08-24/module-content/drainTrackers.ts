import type { DrainTracker } from "../../../core/types/actor";

export function createBrokenChainStrDrain(): DrainTracker {
  return {
    id: "str-drain",
    label: "STR Drain",
    current: 0,
    max: 6,
    warningAtSource: "max",
    warningText: "STR Drain has reached {threshold}. Resolve the Broken Chain drain rule at the table.",
  };
}

export function createBrokenChainLifeDrain(): DrainTracker {
  return {
    id: "life-drain",
    label: "Life Drain",
    current: 0,
    maxSource: "actorHpMax",
    warningAtSource: "max",
    warningText: "Life Drain has reached {threshold}. Reduce HP to 0 / resolve death handling at the table.",
  };
}

export function createBrokenChainDrainTrackers() {
  return {
    strDrain: createBrokenChainStrDrain(),
    lifeDrain: createBrokenChainLifeDrain(),
  };
}
