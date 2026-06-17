import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "./ActionButton";
import type { ActorConcentrationState } from "../state/useActorConcentrationState";
import { isUsedActionStateValue, type ActorActionEconomyState, type ActionCost } from "../types/actionEconomy";
import type { CommittedRollOutcomeMode, CommittedRollState } from "../types/committedRoll";
import type { ActorAction, TabId } from "../types/tabs";
import type { ReadiedRollCandidate } from "./CommittedRollPanel";

type TabPanelProps = {
  actorName: string;
  activeTab: TabId;
  actions: ActorAction[];
  actionState: ActorActionEconomyState;
  concentration: ActorConcentrationState;
  committedRoll: CommittedRollState | null;
  resolvedReadiedKeys: string[];
  usedCostSlots: ActionCost[];
  onUseAction: (input: { action: ActorAction; tabId: TabId; costs: ActionCost[] }) => void;
  onUnreadyAction: (input: { action: ActorAction; tabId: TabId; costs: ActionCost[] }) => void;
  onCommitRoll: (candidate: ReadiedRollCandidate) => void;
  onPrimeRoll?: (candidate: ReadiedRollCandidate) => void;
  /** Resets the active committed roll so the DM can swap to a different action */
  onResetCommittedRoll?: () => void;
  /** Resolves @VARIABLE tokens for the action chips (display only). */
  resolveFormula?: (formula: string) => string;
};

const tabNotes: Record<TabId, string> = {
  main: "Ready weapon attacks or non-spell combat actions. Same-slot choices swap the current readied Action.",
  bonus: "Ready Bonus Actions. Spell bonus actions live under Spells but still use the Bonus Action slot.",
  spells: "Choose a spell group to expand it. Spell cards show action economy cost, slot cost when known, and concentration reminders.",
  bond: "Choose a Homebrew group to expand it. This campaign classifies the Homebrew slot as Bonds.",
  checks: "Choose a check group to expand it. Checks are table tools and do not hold action slots in BUILD 0.4.0b.",
  features: "Class actions & class/species features. Choose a group to expand it; reference-only passives do not write log spam.",
  feats: "Feats. Mechanical feats (Tough, ASI, initiative) feed the sheet's derived stats; the rest are reference.",
  status: "Track STR Drain, Life Drain, and other numeric debuffs here.",
  equipment: "Choose an equipment group to expand it. Passive/reference equipment is non-logging unless the item has a defined use action.",
  resources: "Later resource automation lives here. BUILD 0.4.0b keeps class resources as feature/reference data instead.",
  outOfCombat: "Choose an out-of-combat group to expand it. Short Rest stays clickable because it can roll Hit Dice; Long Rest is reference-only.",
  notes: "Saved notes live here.",
};

function inferCosts(action: ActorAction, activeTab: TabId): ActionCost[] {
  if (action.economyCost) {
    return action.economyCost;
  }

  if (activeTab === "main") {
    return ["main"];
  }

  if (activeTab === "bonus") {
    return ["bonus"];
  }

  if (activeTab === "bond") {
    return ["bond"];
  }

  return [];
}

function getReadiedKey(tabId: TabId, actionId: string) {
  return `${tabId}:${actionId}`;
}

function getWillSwapCosts(costs: ActionCost[], actionState: ActorActionEconomyState, readiedKey: string) {
  return costs.filter((cost) => actionState[cost] && actionState[cost] !== readiedKey && !isUsedActionStateValue(actionState[cost]));
}

function isCompactUtilityTab(tabId: TabId) {
  return tabId === "checks" || tabId === "equipment" || tabId === "resources" || tabId === "features" || tabId === "outOfCombat";
}

function isCollapsibleCategoryTab(tabId: TabId) {
  return ["bond", "checks", "spells", "features", "equipment", "outOfCombat"].includes(tabId);
}

function groupActions(actions: ActorAction[]) {
  return actions.reduce<Array<{ category: string | null; actions: ActorAction[] }>>((groups, action) => {
    const category = action.category ?? null;
    const existing = groups.find((group) => group.category === category);

    if (existing) {
      existing.actions.push(action);
    } else {
      groups.push({ category, actions: [action] });
    }

    return groups;
  }, []);
}

function categoryKey(category: string | null) {
  return category ?? "default";
}

function isReferenceOnlyAction(action: ActorAction, activeTab: TabId) {
  const costs = inferCosts(action, activeTab);
  return action.logMode === "silent" && costs.length === 0;
}

function getActionGridClass(groupActions: ActorAction[], activeTab: TabId, compact: boolean) {
  const allReferenceOnly = groupActions.every((action) => isReferenceOnlyAction(action, activeTab));
  const classNames = ["action-grid"];

  if (compact) {
    classNames.push("compact-action-grid");
  }

  if (allReferenceOnly) {
    classNames.push("reference-action-list");
  } else {
    classNames.push("active-action-grid");
  }

  return classNames.join(" ");
}

function categoryCountLabel(tabId: TabId, count: number) {
  const label =
    tabId === "spells"
      ? "spell"
      : tabId === "checks"
        ? "check"
        : tabId === "bond"
          ? "choice"
          : tabId === "features"
            ? "feature"
            : tabId === "equipment"
              ? "item"
              : tabId === "outOfCombat"
                ? "utility"
                : "item";
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function actionLabel(action: ActorAction) {
  return action.concentration ? `${action.label} (Concentration)` : action.label;
}

function hasRollableFormula(rawFormula?: string) {
  return /\d+d\d+/i.test(rawFormula ?? "") || /^[+-]?\d+$/.test((rawFormula ?? "").trim());
}

function inferOutcomeMode(action: ActorAction): CommittedRollOutcomeMode {
  // ── Explicit override — always wins ──────────────────────────────────────
  const explicit = action.metadata?.outcomeMode;
  if (explicit) {
    // Map ActionOutcomeMode → CommittedRollOutcomeMode
    if (explicit === "attack-roll")   return "attack-roll";
    if (explicit === "dc-check")      return "dc-check";
    if (explicit === "ability-check") return "ability-check";
    // damage-only, healing, triggered all resolve as "triggered" in the roll panel
    // (straight roll, no hit/miss prompt)
    if (explicit === "damage-only")   return "triggered";
    if (explicit === "healing")       return "triggered";
    if (explicit === "triggered")     return "triggered";
    // additive = a rider; readying it arms it (ActorCard). Standalone Roll = straight roll.
    if (explicit === "additive")      return "triggered";
    // reference = no roll, handled by hasAttachedDice returning false
    if (explicit === "reference")     return "triggered";
  }

  // ── Inference fallback ─────────────────────────────────────────────────
  // Checks: ability roll, Pass/Fail result
  if (action.actionKind === "check") {
    return "ability-check";
  }

  // Healing spells/actions: damage formula only, straight roll
  // Don't run healing through attack-roll — it has no hit/miss
  if (action.actionKind === "spell" && action.metadata?.damage && !action.metadata?.attack && !action.metadata?.saveDc) {
    return "triggered"; // straight roll to the damage phase
  }

  if (action.metadata?.attack?.trim()) {
    return "attack-roll";
  }

  if (action.metadata?.saveDc?.trim()) {
    return "dc-check";
  }

  const searchableText = `${action.label} ${action.description ?? ""} ${action.metadata?.details ?? ""}`;

  if (/\b(?:save|saving throw|dc\s*\d+|\w+\s+dc\s*\d+)\b/i.test(searchableText)) {
    return "dc-check";
  }

  if (/\battack\b/i.test(searchableText)) {
    return "attack-roll";
  }

  return "triggered";
}

function rollButtonLabelForMode(mode: CommittedRollOutcomeMode, action?: ActorAction) {
  if (mode === "dc-check") return "Check";
  if (mode === "ability-check") return "Roll Check";

  // Healing — explicit outcomeMode only, no text scanning
  // Set metadata.outcomeMode = "healing" on the action when building it
  if (mode === "triggered" && action?.metadata?.outcomeMode === "healing") {
    return "Roll Healing";
  }

  // Damage-only triggered — straight roll, no hit/miss
  if (mode === "triggered" && action?.metadata?.outcomeMode === "damage-only") {
    return "Roll Damage";
  }

  return "Roll";
}

function createCandidate(action: ActorAction, activeTab: TabId, costs: ActionCost[], readiedKey: string): ReadiedRollCandidate {
  const outcomeMode = inferOutcomeMode(action);

  return {
    readiedKey,
    actionLabel: actionLabel(action),
    costs,
    outcomeMode,
    attackFormula: action.metadata?.attack,
    saveDc: action.metadata?.saveDc,
    damageFormula: action.metadata?.damage,
    critDamageFormula: action.metadata?.crit,
    critThreshold: action.metadata?.critThreshold,
  };
}

function hasAttachedDice(action: ActorAction) {
  // Reference-only actions never have dice even if metadata has text
  if (action.metadata?.outcomeMode === "reference") return false;

  const metadata = action.metadata;
  return Boolean(
    hasRollableFormula(metadata?.attack) ||
      hasRollableFormula(metadata?.damage) ||
      hasRollableFormula(metadata?.crit) ||
      hasRollableFormula(metadata?.additive)
  );
}

function shouldShowDirectRollButton(action: ActorAction, _activeTab: TabId, costs: ActionCost[], _outcomeMode: CommittedRollOutcomeMode) {
  if (costs.length > 0 || action.logMode === "silent") {
    return false;
  }
  // Reference-only actions never get a Roll button
  if (action.metadata?.outcomeMode === "reference") {
    return false;
  }
  return hasAttachedDice(action);
}

/**
 * Checks have no economy cost but should open their roll workspace on click.
 * This is distinct from "direct roll" (which clicks once → rolls).
 * Checks click once to select, then show a Roll button.
 */
function isCheckAction(action: ActorAction): boolean {
  return action.actionKind === "check" ||
    action.metadata?.outcomeMode === "ability-check";
}

export function TabPanel({
  actorName,
  activeTab,
  actions,
  actionState,
  concentration,
  committedRoll,
  resolvedReadiedKeys,
  usedCostSlots,
  onUseAction,
  onUnreadyAction,
  onCommitRoll,
  onPrimeRoll,
  onResetCommittedRoll,
  resolveFormula,
}: TabPanelProps) {
  const compact = isCompactUtilityTab(activeTab);
  const groupedActions = useMemo(() => groupActions(actions), [actions]);
  const collapsibleCategories = isCollapsibleCategoryTab(activeTab);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [selectedRollKey, setSelectedRollKey] = useState<string | null>(null);

  useEffect(() => {
    if (!collapsibleCategories) {
      setOpenCategories({});
      return;
    }

    setOpenCategories({});
  }, [activeTab, actorName, actions, collapsibleCategories]);

  useEffect(() => {
    setSelectedRollKey(null);
  }, [activeTab, actorName, actions, committedRoll?.readiedKey]);

  function toggleCategory(key: string) {
    setOpenCategories((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <section className="tab-panel" aria-label={`${activeTab} tab panel`}>
      <p className="placeholder-note">{tabNotes[activeTab]}</p>
      {groupedActions.map((group) => {
        const key = categoryKey(group.category);
        const expanded = !collapsibleCategories || Boolean(openCategories[key]);
        const categoryLabel = group.category ?? "General";

        return (
          <div className={`action-category-block ${collapsibleCategories ? "collapsible-category-block" : ""}`} key={key}>
            {group.category && !collapsibleCategories && <h3 className="action-category-heading">{group.category}</h3>}
            {collapsibleCategories && (
              <button
                className={`action-category-toggle ${expanded ? "expanded" : ""}`}
                type="button"
                onClick={() => toggleCategory(key)}
                aria-expanded={expanded}
              >
                <span>{categoryLabel}</span>
                <span className="action-category-count">{categoryCountLabel(activeTab, group.actions.length)}</span>
              </button>
            )}
            {expanded && (
              <div className={getActionGridClass(group.actions, activeTab, compact)}>
                {group.actions.map((action) => {
                  const costs = inferCosts(action, activeTab);
                  const readiedKey = getReadiedKey(activeTab, action.id);
                  const outcomeMode = inferOutcomeMode(action);
                  const directRollAvailable = shouldShowDirectRollButton(action, activeTab, costs, outcomeMode);
                  const selectedDirectRoll = costs.length === 0 && directRollAvailable && selectedRollKey === readiedKey;
                  const readied = costs.some((cost) => actionState[cost] === readiedKey) || selectedDirectRoll;
                  const resolved = resolvedReadiedKeys.includes(readiedKey) || costs.some((cost) => usedCostSlots.includes(cost));
                  const committed = committedRoll?.readiedKey === readiedKey;
                  const commitBlocked = Boolean(committedRoll && committedRoll.readiedKey !== readiedKey);
                  const willSwapCosts = getWillSwapCosts(costs, actionState, readiedKey);

                  const concentrationActive = Boolean(action.concentration && concentration?.actionId === action.id);
                  const concentrationConflict = Boolean(
                    action.concentration && concentration && concentration.actionId !== action.id
                  );

                  return (
                    <ActionButton
                      action={action}
                      resolveFormula={resolveFormula}
                      readied={readied}
                      resolved={resolved}
                      committed={committed}
                      commitBlocked={commitBlocked}
                      willSwapCosts={willSwapCosts}
                      costs={costs}
                      compact={compact}
                      concentrationActive={concentrationActive}
                      concentrationConflict={concentrationConflict}
                      activeConcentrationLabel={concentration?.actionLabel ?? null}
                      key={action.id}
                      onClick={() => {
                        // Checks (no cost, direct roll): select for roll workspace
                        if (costs.length === 0 && directRollAvailable) {
                          setSelectedRollKey(readiedKey);
                          return;
                        }

                        // Check actions with no cost but with dice — prime directly on click
                        // (compact check list: single click → roll fires)
                        if (costs.length === 0 && isCheckAction(action) && hasAttachedDice(action) && onPrimeRoll) {
                          const candidate = createCandidate(action, activeTab, costs, readiedKey);
                          onPrimeRoll(candidate);
                          return;
                        }

                        // Click readies the action (marks economy slot).
                        // Roll panel opens only when the player explicitly clicks the Roll button —
                        // no auto-prime on click. This keeps unready simple and prevents
                        // the roll window from popping before the player is ready to roll.
                        if (!readied) {
                          onUseAction({ action, tabId: activeTab, costs });
                        }
                      }}
                      onUnready={() => {
                        if (costs.length === 0 && selectedRollKey === readiedKey) {
                          setSelectedRollKey(null);
                          return;
                        }

                        onUnreadyAction({ action, tabId: activeTab, costs });
                      }}
                      onCommitRoll={readied ? () => onCommitRoll(createCandidate(action, activeTab, costs, readiedKey)) : undefined}
                      onResetCommittedRoll={commitBlocked ? onResetCommittedRoll : undefined}
                      rollButtonLabel={rollButtonLabelForMode(outcomeMode, action)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {actions.length === 0 && (
        <p className="empty-log">No actions configured for {actorName} in this tab yet.</p>
      )}
    </section>
  );
}
