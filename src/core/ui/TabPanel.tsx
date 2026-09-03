import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "./ActionButton";
import type { ActorConcentrationState } from "../state/useActorConcentrationState";
import { isUsedActionStateValue, slotsOf, type ActorActionEconomyState, type ActionCost } from "../types/actionEconomy";
import type { CommittedRollOutcomeMode, CommittedRollState } from "../types/committedRoll";
import { normalizeOutcomeMode, resolveOutcomeMode, authoredEconomy } from "../types/tabs";
import { isInertAction } from "../types/tabs";
import { rollLabelForEffectKind } from "../constants/itemTypeCapabilities";
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
  /** Renders the upcast level picker for a spell card. TabPanel stays dumb about slots —
   *  ActorCard owns the chosen level and the remaining-slot counts. */
  renderCastLevelPicker?: (action: ActorAction) => ReactNode;
};

const tabNotes: Record<TabId, string> = {
  main: "Ready weapon attacks or non-spell combat actions. Same-slot choices swap the current readied Action.",
  bonus: "Ready Bonus Actions. Spell bonus actions live under Spells but still use the Bonus Action slot.",
  spells: "Choose a spell group to expand it. Spell cards show action economy cost, slot cost when known, and concentration reminders.",
  bond: "Choose a Homebrew group to expand it. This campaign classifies the Homebrew slot as Bonds.",
  checks: "Choose a check group to expand it. Checks are table tools and do not hold action slots.",
  features: "Class actions & class/species features. Choose a group to expand it; reference-only passives do not write log spam.",
  feats: "Feats. Mechanical feats (Tough, ASI, initiative) feed the sheet's derived stats; the rest are reference.",
  status: "Track STR Drain, Life Drain, and other numeric debuffs here.",
  equipment: "Choose an equipment group to expand it. Passive/reference equipment is non-logging unless the item has a defined use action.",
  resources: "Resource pools and class features. Spell slots, Rage, Channel Divinity, Superiority Dice — anything with a count that a rest brings back.",
  outOfCombat: "Choose an out-of-combat group to expand it. Short Rest stays clickable because it can roll Hit Dice; Long Rest is reference-only.",
  notes: "Saved notes live here.",
};

function inferCosts(action: ActorAction, activeTab: TabId): ActionCost[] {
  if (action.economyCost) {
    /**
     * LEGACY BACKFILL. Every action authored before 0.7.10.18 stored `[]` for BOTH free and
     * passive, so an empty array is ambiguous on disk even though it can no longer be produced.
     * The authored value survived on `metadata.cost`; recover it rather than asking the table
     * to re-save every action to get its clicks back.
     */
    if (action.economyCost.length === 0) {
      const authored = action.metadata?.cost?.trim().toLowerCase();
      if (authored === "free") return ["free"];
      if (authored === "passive") return ["passive"];
      /**
       * ⚠ AND THE ECONOMY NAMED IN PROSE, which this recovered for exactly two values.
       *
       * The backfill above only rescued `free` and `passive`, because those were the two the
       * empty array was ambiguous BETWEEN. But a legacy action whose cost reads "Magic Action;
       * 1 Psionic Energy Die" is neither — so it fell through with `[]`, and `isInertAction`'s
       * last rule (silent AND no slots) then made it INERT. No button, no handler, no log line
       * when clicked, and a card that looks completely normal because the "ACTION" chip is
       * rendered from the prose it just failed to read.
       *
       * Christopher: *"half of my pisionic dice do nothing."* Both Telekinetic Movement entries
       * died here — the resource-name fix alone would never have reached them, because nothing
       * was calling the spend at all.
       *
       * ⚠ BONUS BEFORE ACTION. "Bonus Action" contains "action"; testing the general word first
       * would file every bonus action as a main action and silently move it to the wrong slot.
       *
       * The exact single-word economies first — `authoredEconomy` already parses those, and
       * Psi-Powered Leap stores exactly "bonus". Then the prose forms, for a cost written as a
       * sentence: "Magic Action; 1 Psionic Energy Die", "Bonus Action; 1 Superiority Die".
       */
      const exact = authoredEconomy(action);
      if (exact) return [exact === "action" ? "main" : exact];
      if (authored) {
        if (authored.includes("bonus action")) return ["bonus"];
        if (authored.includes("reaction")) return ["reaction"];
        if (authored.includes("bond")) return ["bond"];
        if (/\baction\b/.test(authored)) return ["main"];
      }
    }
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
  // Only a SLOT can be displaced. A free action never warns about swapping anything.
  return slotsOf(costs).filter((cost) => actionState[cost] && actionState[cost] !== readiedKey && !isUsedActionStateValue(actionState[cost]));
}

function isCompactUtilityTab(tabId: TabId) {
  return tabId === "checks" || tabId === "equipment" || tabId === "resources" || tabId === "features" || tabId === "outOfCombat";
}

function isCollapsibleCategoryTab(tabId: TabId) {
  return ["bond", "checks", "spells", "features", "equipment", "outOfCombat"].includes(tabId);
}

/**
 * A spell's heading comes from ITS OWN LEVEL, not from however the category was typed.
 *
 * ⚠ THE SHEET GROUPED BY AN EXACT STRING, so "Cantrip" and "Cantrips" rendered as two separate
 * sections on the same character — four cantrips under one heading and two under another.
 * The same drift puts an L2 spell under an "L1 Spells" heading if the category was typed by
 * hand while the level was set correctly.
 *
 * ONLY LEVEL HEADINGS ARE REWRITTEN. A deliberate grouping like "Class Spell" (a free cast
 * that spends a long-rest use instead of a slot) is left exactly as authored — those are a
 * real distinction on the sheet, not a typo, and collapsing them into the level sections would
 * hide that Cure Wounds is available both ways.
 */
const LEVEL_HEADING = /^\s*(?:cantrips?|l(?:evel)?\s*(\d+)(?:\s*spells?)?)\s*$/i;

function canonicalSpellCategory(action: ActorAction): string | null {
  const raw = action.category ?? null;
  const level = action.metadata?.spellLevel;
  if (raw === null || typeof level !== "number") return raw;
  if (!LEVEL_HEADING.test(raw)) return raw;      // "Class Spell" and friends stay put
  return level === 0 ? "Cantrips" : `L${level} Spells`;
}

function groupActions(actions: ActorAction[]) {
  return actions.reduce<Array<{ category: string | null; actions: ActorAction[] }>>((groups, action) => {
    const category = canonicalSpellCategory(action);
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
  return isInertAction(action, inferCosts(action, activeTab));
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
    // Non-rolling modes never reach a roll workspace — hasAttachedDice already returns false.
    if (explicit === "utility")       return "triggered";
    if (explicit === "passive")       return "triggered";
    if (explicit === "reference")     return "triggered";   // legacy
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

  /**
   * ⚠ SAY WHICH KIND IT IS. Healing, temp HP and damage REDUCTION all resolve through the
   * `healing` outcome mode, because all three are HP the bearer keeps — but they are three
   * different things and "Roll Healing" on a reduction reads as HP gained rather than harm
   * prevented. `effectKind` names it when the item carries one.
   */
  const kindLabel = rollLabelForEffectKind(action?.metadata?.effectKind);
  if (mode === "triggered" && kindLabel) {
    return kindLabel;
  }

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

function createCandidate(action: ActorAction, _activeTab: TabId, costs: ActionCost[], readiedKey: string, chosenDamageType?: string): ReadiedRollCandidate {
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
    // The caster's pick wins; the authored type is the default when the spell has no choice.
    damageType: chosenDamageType ?? action.metadata?.damageType,
    explodingDamage: action.metadata?.explodingDamage,
  };
}

function hasAttachedDice(action: ActorAction) {
  /**
   * ⚠ UTILITY MEANS *INSTANT*, NOT *DICELESS* — and this line said the opposite.
   *
   * Christopher: *"why is this what utility means, we built utility to mean happens instantly
   * while additive is happens with a attack."* That is the real distinction and it is about WHEN
   * a thing resolves, not whether it has dice:
   *
   *   utility   resolves NOW, on the click.        It may well roll — Second Wind rolls 1d10+level.
   *   additive  arms a rider on a LATER attack.    It rolls nothing standalone.
   *
   * This read "NEITHER passive NOR utility ever rolls, whatever the metadata says" and returned
   * false, so an instant ability carrying its own damage was clickable and could never produce a
   * die. Iskarn's Second Wind — Tactical Shift prints `1d10+6` on the card and rolled nothing:
   * *"Iskarns tactical shift is unrollable."*
   *
   * Only PASSIVE is diceless by definition — it is not clickable at all.
   *
   * ⚠ AND `resolveOutcomeMode`, NOT `normalizeOutcomeMode`. The normaliser maps the retired
   * `reference` tag to `passive`, which is the mapping its own doc warns against — so a legacy
   * entry was blocked here no matter what else was fixed. The resolver is the one that can see
   * whether the action spends anything.
   */
  const mode = resolveOutcomeMode(action);
  if (mode === "passive") return false;

  const metadata = action.metadata;
  /**
   * ⚠ A DC-CHECK'S "DICE" ARE THE TARGET'S SAVE. Shield Bash carries a STR DC 14 and no dice
   * of its own, so a dice-only test said it had nothing to present and it rendered as a dead
   * row. The thing to resolve is the save prompt.
   */
  if (mode === "dc-check" && metadata?.saveDc?.trim()) return true;
  return Boolean(
    hasRollableFormula(metadata?.attack) ||
      hasRollableFormula(metadata?.damage) ||
      hasRollableFormula(metadata?.crit) ||
      hasRollableFormula(metadata?.additive)
  );
}

/**
 * ⚠ "SILENT" IS ABOUT THE LOG, NOT ABOUT WHETHER IT ROLLS — and conflating the two is why
 * every FREE action was broken. Christopher, 2026-08-17: *"most if not all free actions are the
 * ones that are broke, psionic strike, shield bash."*
 *
 * Both are authored the same way: `economyCost: []` (free) plus `logMode: "silent"`. An empty
 * cost means the click cannot READY anything, so the row's only way to resolve is the direct
 * Roll button — and this function refused to show one to any silent action. Click it and
 * nothing happened, twice over: no roll, and no log entry either, because silent.
 *
 * Only an `additive` rider is genuinely silent AND non-rolling: it arms itself onto a later
 * roll. Everything else that is silent still has something to resolve.
 */
function shouldShowDirectRollButton(action: ActorAction, _activeTab: TabId, costs: ActionCost[], _outcomeMode: CommittedRollOutcomeMode) {
  // Costless means NO SLOT. A free action arrives as ["free"] and still qualifies for a
  // direct roll — testing raw length here would have taken Shield Bash's Roll button away
  // the moment "free" became a real value.
  if (slotsOf(costs).length > 0) {
    return false;
  }
  // No Roll button for the one genuinely non-rolling mode. `utility` is INSTANT, not diceless —
  // see `hasAttachedDice`. `resolveOutcomeMode`, so a legacy `reference` entry is not read as
  // passive before anything else gets a say.
  const om = resolveOutcomeMode(action);
  if (om === "passive") {
    return false;
  }
  if (action.logMode === "silent" && om === "additive") {
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
  renderCastLevelPicker,
}: TabPanelProps) {
  const compact = isCompactUtilityTab(activeTab);
  const groupedActions = useMemo(() => groupActions(actions), [actions]);
  const collapsibleCategories = isCollapsibleCategoryTab(activeTab);
  /**
   * ⚠ ONE GRID, NOT ONE GRID PER CATEGORY — on the tabs whose categories are LABELS.
   *
   * Christopher: *"the actions are still forced to a single action per row."* The three-per-row
   * cap was working; nothing ever reached it. Main and Bonus render a heading per category and a
   * SEPARATE grid under each, and on a real sheet those categories are singletons — Attacks(1),
   * Shield Master(1), Melee One-Handed(1), Class Rider(1). Four grids of one tile each is four
   * full-width rows however wide the panel is, and no cap can help: the grid it applies to only
   * ever had one thing in it.
   *
   * So on a non-collapsible tab every action goes into ONE grid and the category rides the TILE
   * as a small caption. That is the doc's own layout (§5.1 is a flat run of action cards, with no
   * headings between them) and it loses nothing — the category is still on screen, attached to
   * the action it describes rather than to a heading above a row of one.
   *
   * The COLLAPSIBLE tabs keep their per-category grids. There the category is a real container a
   * DM opens and closes — Cantrips, L1 Spells, a bond's two choices — and it routinely holds
   * enough actions to fill a row on its own.
   */
  const renderGroups = useMemo(
    () => (collapsibleCategories ? groupedActions : [{ category: null, actions }]),
    [collapsibleCategories, groupedActions, actions],
  );
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  /**
   * The element a caster picked for THIS cast, keyed by readied key.
   *
   * Held here rather than on the action, because it is a choice about one casting — Chromatic
   * Orb is fire this time and cold the next, and writing it back onto the spell would make the
   * last choice look like the authored default.
   */
  const [chosenDamageTypes, setChosenDamageTypes] = useState<Record<string, string | undefined>>({});
  const [selectedRollKey, setSelectedRollKey] = useState<string | null>(null);

  // Which actions are present, not which object identities. Depending on `actions` itself
  // collapsed every category (and dropped the selected roll) whenever the array was rebuilt
  // for a reason that isn't a change of contents — upcasting a spell re-derives its damage,
  // which used to snap the whole spell list shut under the player mid-choice.
  const actionsSignature = useMemo(() => actions.map((action) => action.id).join("|"), [actions]);

  useEffect(() => {
    setOpenCategories({});
  }, [activeTab, actorName, actionsSignature, collapsibleCategories]);

  useEffect(() => {
    setSelectedRollKey(null);
  }, [activeTab, actorName, actionsSignature, committedRoll?.readiedKey]);

  function toggleCategory(key: string) {
    setOpenCategories((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <section className="tab-panel" aria-label={`${activeTab} tab panel`}>
      <p className="placeholder-note">{tabNotes[activeTab]}</p>
      {renderGroups.map((group) => {
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
                  const slots = slotsOf(costs);
                  const selectedDirectRoll = slots.length === 0 && directRollAvailable && selectedRollKey === readiedKey;
                  const readied = slots.some((cost) => actionState[cost] === readiedKey) || selectedDirectRoll;
                  const resolved = resolvedReadiedKeys.includes(readiedKey) || slots.some((cost) => usedCostSlots.includes(cost));
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
                      /* The heading moved onto the tile — see renderGroups. Only where the tile
                         is not already sitting under a category container that says the same. */
                      categoryCaption={collapsibleCategories ? undefined : action.category}
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
                        if (slots.length === 0 && directRollAvailable) {
                          // AN ITEM CHARGE IS SPENT BY THE CLICK. This branch is the one an
                          // equipment row actually takes — no economyCost means `costs` is
                          // empty, and a charged item has dice — so it selected the roll and
                          // returned before `onUseAction` ever ran. That is why a charged item
                          // rolled its dice for free. Spend first, then select.
                          // Only on the click that actually SELECTS. The Roll button sits
                          // inside this row, so its click bubbles back here — without the
                          // guard the roll took a second charge and one use cost two.
                          if (action.metadata?.charges && selectedRollKey !== readiedKey) {
                            onUseAction({ action, tabId: activeTab, costs });
                          }
                          setSelectedRollKey(readiedKey);
                          return;
                        }

                        // Check actions with no cost but with dice — prime directly on click
                        // (compact check list: single click → roll fires)
                        if (slots.length === 0 && isCheckAction(action) && hasAttachedDice(action) && onPrimeRoll) {
                          const candidate = createCandidate(action, activeTab, costs, readiedKey, chosenDamageTypes[readiedKey]);
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
                        if (slots.length === 0 && selectedRollKey === readiedKey) {
                          setSelectedRollKey(null);
                          return;
                        }

                        onUnreadyAction({ action, tabId: activeTab, costs });
                      }}
                      onCommitRoll={readied ? () => onCommitRoll(createCandidate(action, activeTab, costs, readiedKey, chosenDamageTypes[readiedKey])) : undefined}
                      onResetCommittedRoll={commitBlocked ? onResetCommittedRoll : undefined}
                      rollButtonLabel={rollButtonLabelForMode(outcomeMode, action)}
                      castLevelPicker={renderCastLevelPicker?.(action)}
                      chosenDamageType={chosenDamageTypes[readiedKey]}
                      onChooseDamageType={(type) => setChosenDamageTypes(prev => ({ ...prev, [readiedKey]: type }))}
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
