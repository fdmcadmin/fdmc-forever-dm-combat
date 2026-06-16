import type { Actor } from "../types/actor";
import type { ActorAction, TabId } from "../types/tabs";
import { normalizePcActionDraft, type PcActionDraft } from "./pcActionTypes";

function tabToActorTab(tab: PcActionDraft["tab"]): TabId {
  switch (tab) {
    case "bonus":
      return "bonus";
    case "reaction":
      return "main";
    case "bond":
      return "bond";
    case "spell":
      return "spells";
    case "feature":
      return "features";
    case "resource":
      return "resources";
    case "outOfCombat":
      return "outOfCombat";
    default:
      return "main";
  }
}

function tabToActionKind(tab: PcActionDraft["tab"]): ActorAction["actionKind"] {
  switch (tab) {
    case "bond":
      return "bond";
    case "spell":
      return "spell";
    case "feature":
      return "feature";
    case "resource":
      return "resource";
    case "outOfCombat":
      return "utility";
    case "reaction":
      return "feature";
    default:
      return "attack";
  }
}

function actionCostToEconomy(cost: PcActionDraft["actionCost"]): ActorAction["economyCost"] {
  if (cost === "bonus") return ["bonus"];
  if (cost === "reaction") return ["reaction"];
  if (cost === "bond") return ["bond"];
  if (cost === "free" || cost === "passive") return [];
  return ["main"];
}

function emptyTabs(): Actor["tabs"] {
  return {
    main: [],
    bonus: [],
    spells: [],
    bond: [],
    checks: [],
    features: [],
    feats: [],
    status: [],
    equipment: [],
    resources: [],
    outOfCombat: [],
    notes: [],
  };
}

function actionToPinnedReaction(action: ActorAction) {
  return {
    id: action.id,
    label: action.label,
    description: action.metadata?.details ?? action.description,
    logMessage: action.logMessage,
    sourceTabId: "main" as const,
    sourceActionId: action.id,
  };
}

export function adaptPcActionToActorAction(draft: PcActionDraft): ActorAction {
  const normalized = normalizePcActionDraft(draft, draft.source ?? "actor");

  return {
    id: normalized.id,
    label: normalized.name,
    description: normalized.description,
    actionKind: tabToActionKind(normalized.tab),
    economyCost: actionCostToEconomy(normalized.actionCost),
    logMode: normalized.visibility === "hidden" ? "silent" : "default",
    displayMode: normalized.tab === "feature" || normalized.tab === "resource" || normalized.tab === "outOfCombat" ? "compact" : "card",
    category: normalized.source ?? (normalized.tab === "spell" ? "Spells" : normalized.tab === "bond" ? "Bond" : normalized.tab === "feature" ? "Features" : normalized.tab),
    tags: [
      normalized.tab,
      normalized.slotCost ? `spell-slot:${normalized.slotCost}` : "",
      normalized.spellLevel !== undefined ? `spell-level:${normalized.spellLevel}` : "",
    ].filter(Boolean),
    metadata: {
      attack: typeof normalized.attackBonus === "number" ? String(normalized.attackBonus) : typeof normalized.attackBonus === "string" ? normalized.attackBonus : undefined,
      damage: normalized.damage,
      damageType: normalized.damageType,
      crit: normalized.critDamage,
      saveDc: typeof normalized.saveDc === "number" ? String(normalized.saveDc) : typeof normalized.saveDc === "string" ? normalized.saveDc : undefined,
      range: normalized.range,
      cost: normalized.actionCost,
      slotCost: normalized.slotCost,
      details: normalized.description,
      concentration: normalized.consumesSpellSlot ? "yes" : undefined,
      withModifier: normalized.checkAbility,
      additive: normalized.resourceName,
      spellLevel: normalized.spellLevel,
      attackUses: normalized.attackUses && normalized.attackUses > 1 ? normalized.attackUses : undefined,
      initiativeBonus: normalized.initiativeBonus ?? undefined,
    },
    hasDefinedUse: Boolean(normalized.uses),
    pinned: normalized.tab === "reaction",
    pinReaction: normalized.tab === "reaction",
    concentration: Boolean(normalized.consumesSpellSlot),
  };
}

/**
 * Convert an editor draft into an ActorAction.
 * If existingAction is provided, the action ID is preserved (edit mode).
 * If not provided, a new ID is generated (create mode).
 */
export function actionFromEditorDraft(draft: PcActionDraft, existingAction?: ActorAction): ActorAction {
  const base = adaptPcActionToActorAction(draft);
  if (existingAction) {
    return { ...base, id: existingAction.id };
  }
  return base;
}

/**
 * Remove an action by ID from a tab's action list.
 * Returns the filtered array. The caller saves the result back to actor.tabs[tabId].
 */
export function archiveActionFromTab(tabActions: ActorAction[], actionId: string): ActorAction[] {
  return tabActions.filter(a => a.id !== actionId);
}

/**
 * Replace an existing action in a tab's action list by ID.
 * If the action is not found, appends it.
 */
export function replaceActionInTab(tabActions: ActorAction[], updatedAction: ActorAction): ActorAction[] {
  const idx = tabActions.findIndex(a => a.id === updatedAction.id);
  if (idx === -1) return [...tabActions, updatedAction];
  return tabActions.map((a, i) => i === idx ? updatedAction : a);
}

export function appendActorActionToActor(actor: Actor, draft: PcActionDraft): Actor {
  const action = adaptPcActionToActorAction(draft);
  const tab = tabToActorTab(draft.tab);
  const nextTabs = {
    ...emptyTabs(),
    ...actor.tabs,
    [tab]: [...(actor.tabs[tab] ?? []), action],
  } satisfies Actor["tabs"];

  const nextPinnedReactions = draft.tab === "reaction"
    ? Array.from(new Map([...actor.pinnedReactions, actionToPinnedReaction(action)].map((entry) => [entry.id, entry])).values())
    : actor.pinnedReactions;

  return {
    ...actor,
    tabs: nextTabs,
    pinnedReactions: nextPinnedReactions,
  };
}
