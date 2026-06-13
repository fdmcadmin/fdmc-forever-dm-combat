import type { ActionCost } from "../../../core/types/actionEconomy";
import type { ActorAction, ResourceKind } from "../../../core/types/tabs";

type CheckSpec = [string, string];

type NormalizedActionInput = {
  id: string;
  label: string;
  attack?: string;
  damage?: string;
  crit?: string;
  saveDc?: string;
  range?: string;
  cost?: string;
  slotCost?: string;
  details?: string;
  concentration?: boolean;
  withModifier?: string;
  additive?: string;
  critThreshold?: number;
  diceLabel?: string;
  actionKind?: ActorAction["actionKind"];
  economyCost?: ActionCost[];
  category?: string;
  tags?: string[];
  logMode?: ActorAction["logMode"];
  displayMode?: ActorAction["displayMode"];
  hasDefinedUse?: boolean;
  pinned?: boolean;
  pinReaction?: boolean;
};

function detectConcentration(details?: string, explicit?: boolean) {
  return Boolean(explicit || /concentration/i.test(details ?? ""));
}

function concentrationDuration(details?: string) {
  const match = (details ?? "").match(/concentration(?:,| up to)?\s*([^.]*)/i);
  if (!match?.[1]?.trim()) {
    return undefined;
  }
  return match[1].trim().replace(/^up to\s+/i, "up to ");
}

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function normalizedAction(input: NormalizedActionInput): ActorAction {
  const { attack, damage, crit, saveDc, range, cost, slotCost, details, concentration, withModifier, additive, critThreshold, diceLabel, ...action } = input;
  const usesConcentration = detectConcentration(details, concentration);

  return {
    ...action,
    concentration: usesConcentration,
    description: details,
    metadata: {
      attack,
      damage,
      crit,
      saveDc,
      range,
      cost,
      slotCost,
      concentration: usesConcentration ? concentrationDuration(details) ?? "Yes" : undefined,
      details,
      withModifier,
      additive,
      critThreshold,
      diceLabel,
    },
  };
}

export function attackAction(input: Omit<NormalizedActionInput, "actionKind">): ActorAction {
  return normalizedAction({ ...input, actionKind: "attack" });
}

export function spellAction(input: Omit<NormalizedActionInput, "actionKind">): ActorAction {
  return normalizedAction({ ...input, actionKind: "spell", category: input.category ?? "Spells" });
}

export function bondAction(input: Omit<NormalizedActionInput, "actionKind" | "economyCost">): ActorAction {
  return normalizedAction({ ...input, actionKind: "bond", economyCost: ["bond"], category: input.category ?? "Bond" });
}

export function check(label: string, formula: string, category = "Ability Checks"): ActorAction {
  return {
    id: `check-${slugify(label)}`,
    label,
    description: formula,
    metadata: { attack: formula, details: formula },
    category,
    actionKind: "check",
    logMode: "table-note",
    displayMode: "compact",
  };
}

export function checks(specs: Array<CheckSpec | [string, string, string]>): ActorAction[] {
  return specs.map(([label, formula, category]) => check(label, formula, category ?? "Ability Checks"));
}

export function compactResource(id: string, label: string, description: string, category = "Class Feature Resources"): ActorAction {
  return {
    id,
    label,
    description,
    metadata: { details: description },
    category,
    actionKind: "resource",
    logMode: "silent",
    displayMode: "compact",
  };
}

/**
 * Machine-trackable resource (P-SHEET S2). Carries a max (metadata.additive), a
 * resourceKind, and a reset cadence (metadata.cost) so useResourceCounterState can
 * decrement on use and auto-restore on Short/Long Rest.
 *   reset "long"  → restored on a Long Rest only (kind "pool"/"spellSlot"/"counter").
 *   reset "short" → restored on a Short Rest (also on a Long Rest).
 *   reset "manual"→ never auto-reset (kind "counter"); DM/player resets by hand.
 */
export function restResource(
  id: string,
  label: string,
  max: number,
  reset: "short" | "long" | "manual",
  kind: ResourceKind,
  description: string,
  category = "Class Feature Resources",
): ActorAction {
  const cadence = reset === "short" ? "Short Rest" : reset === "long" ? "Long Rest" : "Manual";
  return {
    id,
    label,
    description,
    metadata: { details: description, additive: String(max), resourceKind: kind, cost: cadence },
    category,
    actionKind: "resource",
    logMode: "silent",
    displayMode: "compact",
  };
}

export function passiveEquipment(id: string, label: string, description: string, category = "Reference Equipment"): ActorAction {
  return {
    id,
    label,
    description,
    metadata: { details: description },
    category,
    actionKind: "equipment",
    logMode: "silent",
    displayMode: "compact",
    hasDefinedUse: false,
  };
}

export function usableEquipment(id: string, label: string, description: string, category = "Usable Equipment"): ActorAction {
  return {
    id,
    label,
    description,
    metadata: { details: description },
    category,
    actionKind: "equipment",
    logMode: "table-note",
    displayMode: "compact",
    hasDefinedUse: true,
  };
}

export const compactEquipment = passiveEquipment;

export function feature(id: string, label: string, description: string, category = "Features / Passives", logMode: ActorAction["logMode"] = "silent"): ActorAction {
  return {
    id,
    label,
    description,
    metadata: { details: description },
    category,
    actionKind: "feature",
    logMode,
    displayMode: "compact",
  };
}

export function reactionFeature(id: string, label: string, description: string, category = "Reaction Features", pinned = true): ActorAction {
  return {
    id,
    label,
    description,
    metadata: { cost: "Reaction", details: description },
    category,
    actionKind: "feature",
    economyCost: ["reaction"],
    displayMode: "compact",
    pinReaction: pinned,
  };
}

export function utility(
  id: string,
  label: string,
  description: string,
  category = "Out of Combat",
  logMode: ActorAction["logMode"] = "table-note",
): ActorAction {
  return {
    id,
    label,
    description,
    metadata: { details: description },
    category,
    actionKind: "utility",
    logMode,
    displayMode: "compact",
  };
}

export function referenceUtility(id: string, label: string, description: string, category = "Out of Combat"): ActorAction {
  return utility(id, label, description, category, "silent");
}

export function reminder(id: string, label: string, description: string, category = "Notes"): ActorAction {
  return {
    id,
    label,
    description,
    metadata: { details: description },
    category,
    actionKind: "reminder",
    logMode: "silent",
    displayMode: "compact",
    economyCost: [],
  };
}

export function commonSkillChecks(values: Record<string, string>) {
  return checks([
    ["Acrobatics", values.acrobatics, "Ability Checks"],
    ["Animal Handling", values.animalHandling, "Ability Checks"],
    ["Arcana", values.arcana, "Ability Checks"],
    ["Athletics", values.athletics, "Ability Checks"],
    ["Deception", values.deception, "Ability Checks"],
    ["History", values.history, "Ability Checks"],
    ["Insight", values.insight, "Ability Checks"],
    ["Intimidation", values.intimidation, "Ability Checks"],
    ["Investigation", values.investigation, "Ability Checks"],
    ["Medicine", values.medicine, "Ability Checks"],
    ["Nature", values.nature, "Ability Checks"],
    ["Perception", values.perception, "Ability Checks"],
    ["Performance", values.performance, "Ability Checks"],
    ["Persuasion", values.persuasion, "Ability Checks"],
    ["Religion", values.religion, "Ability Checks"],
    ["Sleight of Hand", values.sleightOfHand, "Ability Checks"],
    ["Stealth", values.stealth, "Ability Checks"],
    ["Survival", values.survival, "Ability Checks"],
    ["Grapple", values.athletics, "Combat Checks"],
    ["Shove", values.athletics, "Combat Checks"],
    ["Escape Grapple", values.athletics, "Combat Checks"],
    ["Hide", values.stealth, "Combat Checks"],
  ]);
}
