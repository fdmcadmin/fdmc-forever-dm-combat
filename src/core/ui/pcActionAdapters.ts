import type { Actor } from "../types/actor";
import type { ActorAction, ActionOutcomeMode, TabId } from "../types/tabs";
import { normalizePcActionDraft, type PcActionDraft, type PcRollMode } from "./pcActionTypes";
import { readDamageTypeChoice } from "../rules/damageTypeChoice";

// Persist the editor's chosen outcome mode so it round-trips (a "Triggered Feature" on a
// damage action must not re-derive to "Straight Damage" on reopen). inferOutcomeMode honors
// this explicit value at runtime too.
function rollModeToOutcomeMode(rollMode: PcRollMode): ActionOutcomeMode | undefined {
  switch (rollMode) {
    case "attack": return "attack-roll";
    case "save": return "dc-check";
    case "check": return "ability-check";
    case "damageOnly": return "damage-only";
    case "healing": return "healing";
    case "triggered": return "triggered";
    case "additive": return "additive";
    case "reference": return "passive";   // legacy tag, normalised on the way in
    case "passive": return "passive";
    // utility is a REAL mode now, not an absence: clickable, logs, never rolls. Leaving it to
    // inference is what made it indistinguishable from a plain triggered action.
    case "utility": return "utility";
    default: return undefined;
  }
}

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

/**
 * The authored economy, stored as itself.
 *
 * ⚠ "free" and "passive" used to BOTH return `[]`, which is what made them indistinguishable
 * and cost Shield Bash its click. They are real values now, so `economyCost` says what the DM
 * picked and `slotsOf()` says what it occupies — two questions, two answers.
 */
function actionCostToEconomy(cost: PcActionDraft["actionCost"]): ActorAction["economyCost"] {
  if (cost === "bonus") return ["bonus"];
  if (cost === "reaction") return ["reaction"];
  if (cost === "bond") return ["bond"];
  if (cost === "free") return ["free"];
  if (cost === "passive") return ["passive"];
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
      /**
       * The permitted set, derived from the action's own rules text at save time. Stored so
       * the CARD can offer the pick without re-parsing prose at every render — and so a later
       * edit to the text updates the set on the next save rather than drifting silently.
       */
      damageTypeOptions: (() => {
        const r = readDamageTypeChoice(normalized.description, normalized.rollMode === "healing" ? "healing" : undefined);
        return r.kind === "choice" ? r.options : undefined;
      })(),
      castingClass: normalized.castingClass,
      // Tagging a FEATURE with this makes it an innate focus — see getEquippedSpellFocuses.
      spellFocusAttack: normalized.spellFocusAttack,
      isSpellFocus: normalized.spellFocusAttack ? true : undefined,
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
      attackRolls: normalized.attackRolls,
      attackRollsPerLevel: normalized.attackRollsPerLevel,
      usableSpellLevels: normalized.usableSpellLevels,
      initiativeBonus: normalized.initiativeBonus ?? undefined,
      outcomeMode: rollModeToOutcomeMode(normalized.rollMode),
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

  // Stat effects: preserve any non-AC effects already on the action (e.g. a code-authored
  // feat's +HP / +STR) and apply the editor's AC Bonus as an addAC effect, so feats can
  // grant AC the same way equipment does (deriveActorStats folds feat statEffects).
  const preservedEffects = (existingAction?.metadata?.statEffects ?? []).filter(
    e => e.type !== "addAC" && e.type !== "setAC",
  );
  const acEffect = typeof draft.acBonus === "number" && draft.acBonus !== 0
    ? [{ type: "addAC", value: draft.acBonus }]
    : [];
  const statEffects = [...preservedEffects, ...acEffect];

  // Fighting style toggle (Archery / TWF / GWF) — bonus to matching weapon attacks.
  // weaponBuffDamage = activated buff (Rage, Hunter's Mark): using the action arms a
  // persistent chip; it is NOT a standing toggle.
  const combatStyle = {
    ...(draft.combatStyleAttack?.trim() ? { combatStyleAttack: draft.combatStyleAttack.trim() } : {}),
    ...(draft.combatStyleDamage?.trim() ? { combatStyleDamage: draft.combatStyleDamage.trim() } : {}),
    ...(draft.combatStyleTarget ? { combatStyleTarget: draft.combatStyleTarget } : {}),
    ...(draft.weaponBuffDamage?.trim() ? { weaponBuffDamage: draft.weaponBuffDamage.trim() } : {}),
    ...(draft.weaponBuffAttack?.trim() ? { weaponBuffAttack: draft.weaponBuffAttack.trim() } : {}),
    ...(draft.turnRider?.kind ? { turnRider: draft.turnRider } : {}),
    /**
     * ⚠ THE TAG, NOT `additive`. The scanner accepts either, but `additive` already carries
     * `resourceName` — writing "reroll" into it would erase which pool the action spends. The
     * tag is additive-free and is what the scanner checks first.
     */
    ...(draft.isRerollSource ? { rerollMethod: draft.rerollMethod ?? "reroll" } : {}),
  };

  const withEffects: ActorAction = (statEffects.length || Object.keys(combatStyle).length)
    ? {
      ...base,
      tags: draft.isRerollSource ? [...(base.tags ?? []), "reroll"] : base.tags,
      metadata: { ...base.metadata, ...(statEffects.length ? { statEffects } : {}), ...combatStyle },
    }
    : base;

  if (existingAction) {
    return { ...withEffects, id: existingAction.id };
  }
  return withEffects;
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
