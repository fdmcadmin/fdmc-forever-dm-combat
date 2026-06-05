import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { HitPointBadge } from "../hp/HitPointBadge";
import { getHpStatus } from "../hp/hpStatus";
import type { AbilityId, Actor, DrainTracker, HitPoints, PinnedReaction } from "../types/actor";
import type { ActorConcentrationState } from "../state/useActorConcentrationState";
import { actionCostLabels, isUsedActionStateValue, makeUsedActionStateValue, type ActorActionEconomyState, type ActionCost } from "../types/actionEconomy";
import type { AddCombatLogEntryInput } from "../types/combatLog";
import type { CombatRulesProfile, CommittedRollDamageChoice, CommittedRollOutcome, CommittedRollState, StartCommittedRollInput } from "../types/committedRoll";
import type { ActorNote, ActorNoteVisibility } from "../state/useActorNotesState";
import type { ActorAction, TabId } from "../types/tabs";
import type { ActorStatusTrackerState, StatusTrackerId } from "../types/status";
import { getStatusTrackerLabel } from "../types/status";
import { formatMovementSpeed } from "../utils/movement";
import type { DiceBridgeEvent, DiceBridgeRollRequest, DiceBridgeStatus } from "../integrations/useOwlbearDiceBridge";
import { AbilityScoreRow } from "./AbilityScoreRow";
import { ActionEconomyPanel } from "./ActionEconomyPanel";
import { ActorNotesPanel } from "./ActorNotesPanel";
import { BondSummary } from "./BondSummary";
import { ClassFeatureTrackerBox } from "./ClassFeatureTrackerBox";
import { CommittedRollPanel, type ReadiedRollCandidate } from "./CommittedRollPanel";
import { getRerollSources } from "../state/rerollSources";
import type { RerollSource } from "../state/rerollSources";
import { deriveActorStats } from "../state/deriveActorStats";
import { resolveFormulaVars, formulaHasVars, getProficiencyBonus } from "../state/resolveFormulaVars";
import { PinnedReactions } from "./PinnedReactions";
import { TabBar } from "./TabBar";
import { TabPanel } from "./TabPanel";
import { StatusTrackerPanel } from "./StatusTrackerPanel";

type ActorCardProps = {
  actor: Actor;
  hp: HitPoints;
  actionState: ActorActionEconomyState;
  actorNotes: ActorNote[];
  status: ActorStatusTrackerState;
  concentration: ActorConcentrationState;
  committedRoll: CommittedRollState | null;
  rulesProfile: CombatRulesProfile;
  turnResetVersion: number;
  onHpChange: (nextHp: HitPoints) => void;
  onResetHp: () => void;
  onReadyActionCosts: (costs: ActionCost[], readiedKey: string) => void;
  onUnreadyAction: (readiedKey: string) => void;
  onRemovePendingLogEntries: (pendingKeys: string[]) => void;
  onResetTurn: () => void;
  onSetConcentration: (nextConcentration: Exclude<ActorConcentrationState, null>) => void;
  onClearConcentration: () => void;
  onStartCommittedRoll: (input: StartCommittedRollInput) => void;
  onSetCommittedRollResult: (result: string) => void;
  onChooseCommittedRollOutcome: (outcome: CommittedRollOutcome) => void;
  onChooseCommittedRollDamage: (damageChoice: CommittedRollDamageChoice) => void;
  onClearCommittedRoll: () => void;
  onMarkCommittedRollBridgeSent: () => void;
  diceBridgeStatus: DiceBridgeStatus;
  diceBridgeLastEvent: DiceBridgeEvent | null;
  onSendDiceBridgeRequest: (request: DiceBridgeRollRequest) => Promise<boolean>;
  onSendDicePlusRequest: (request: DiceBridgeRollRequest) => Promise<boolean>;
  onSendMockDiceBridgeResult: (naturalRoll: number, total: number) => void;
  onAddActorNote: (text: string, visibility?: ActorNoteVisibility) => ActorNote | null;
  onDeleteActorNote: (noteId: string) => void;
  onStatusTrackerChange: (trackerId: StatusTrackerId, nextTracker: DrainTracker) => void;
  onResetStatusTracker: (trackerId: StatusTrackerId) => void;
  onResetAllActorStatuses: () => void;
  isBuilderMode?: boolean;
  canShowDevTestRoll?: boolean;
  isPlayerMode?: boolean;
  /** False during combat when it is not this actor's turn — gates main/bonus actions */
  isActiveTurn?: boolean;
  /** Resource counters — remaining count per resource action ID */
  resourceCounters?: Record<string, number>;
  onShortRest?: () => void;
  onLongRest?: () => void;
  onLog: (input: AddCombatLogEntryInput) => void;
};

const tabLabels: Record<TabId, string> = {
  main: "Main",
  bonus: "Bonus",
  spells: "Spells",
  bond: "Bond",
  checks: "Checks",
  features: "Features",
  status: "Status",
  equipment: "Equipment",
  resources: "Resources",
  outOfCombat: "Out of Combat",
  notes: "Notes",
};


type SessionCounterId = "rage" | "riskDice";

type SessionCounter = {
  id: SessionCounterId;
  label: string;
  current: number;
  max: number;
  die?: string;
  active?: boolean;
  note: string;
};

type ArmedEffect = {
  id: string;
  label: string;
  details: string;
  source: string;
  formula?: string;
};

type ClassOptionContext =
  | {
      kind: "attack-miss";
      actionLabel: string;
      actionId: string;
      sourceTabId: TabId | "pinned";
    }
  | {
      kind: "abs-fail";
      ability: AbilityId;
      rollType: "check" | "save";
      actionLabel: string;
    };

type ClassOptionButton = {
  id: string;
  label: string;
  details: string;
  formula?: string;
  counterId?: SessionCounterId;
  responseKind: "miss" | "abs-fail" | "gm-response" | "instant";
};


type InitiativeRollState = {
  requestId: string;
  formula: string;
  status: "pending" | "received" | "manual";
  result?: string;
};

type AttackUseState = {
  current: number;
  max: number;
  label: string;
};

const ACTOR_CARD_SESSION_STORAGE_KEY = "fdm:actor-card-session-state:v1";
const ACTOR_CARD_SESSION_CHANNEL = "forever-dm-combat:actor-card-session-state:v1";

type ActorCardSessionSnapshot = {
  resolvedReadiedKeysByActorId?: Record<string, string[]>;
  usedCostSlotsByActorId?: Record<string, ActionCost[]>;
  sessionCountersByActorId?: Record<string, Partial<Record<SessionCounterId, SessionCounter>>>;
  armedEffectsByActorId?: Record<string, ArmedEffect[]>;
  classOptionContextByActorId?: Record<string, ClassOptionContext | null>;
  classOptionsDismissedByActorId?: Record<string, boolean>;
  initiativeByActorId?: Record<string, InitiativeRollState | null>;
  attackUseByActorId?: Record<string, AttackUseState | null>;
};

function readActorCardSessionSnapshot(): ActorCardSessionSnapshot {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ACTOR_CARD_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ActorCardSessionSnapshot : {};
  } catch {
    return {};
  }
}

function writeActorCardSessionSnapshot(snapshot: ActorCardSessionSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACTOR_CARD_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Keep in-memory actor-card session state usable if storage is unavailable.
  }
}


function isActorCardSessionSyncMessage(data: unknown): data is { type: "replace"; snapshot: ActorCardSessionSnapshot } {
  if (!data || typeof data !== "object") {
    return false;
  }

  const message = data as { type?: unknown; snapshot?: unknown };
  return message.type === "replace" && Boolean(message.snapshot && typeof message.snapshot === "object");
}

function createSessionCounters(actor: Actor): Partial<Record<SessionCounterId, SessionCounter>> {
  return {};
}

function formatCounterValue(counter: SessionCounter) {
  return `${counter.current}/${counter.max}${counter.die ? ` ${counter.die}` : ""}`;
}

const abilityLabels: Record<AbilityId, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const maverickSpiritAbilities: AbilityId[] = ["int", "wis", "cha"];

function formatModifier(modifier?: number) {
  const value = modifier ?? 0;
  return value >= 0 ? `+${value}` : `${value}`;
}

function abilityRollFormula(actor: Actor, ability: AbilityId) {
  return `1d20${formatModifier(actor.abilityScores?.[ability]?.modifier)}`;
}

function getActorActions(actor: Actor) {
  return Object.values(actor.tabs).flat();
}

/**
 * Reads initiative bonus from actor features/actions.
 * Value comes ONLY from what the player explicitly entered (metadata.initiativeBonus).
 * No hardcoded feat names or ruleset assumptions. Player enters their campaign value.
 */
function getTraitInitiativeBonus(actor: Actor) {
  return getActorActions(actor).reduce((total, action) => {
    const metadata = action.metadata as (ActorAction["metadata"] & { initiativeBonus?: number }) | undefined;
    if (typeof metadata?.initiativeBonus === "number" && Number.isFinite(metadata.initiativeBonus)) {
      return total + metadata.initiativeBonus;
    }
    return total;
  }, 0);
}

function initiativeRollFormula(actor: Actor) {
  // Derived DEX includes equipment bonuses and drain — always current effective value
  const derived = deriveActorStats(actor);
  const dexModifier = derived.dex.modifier;
  const traitBonus = getTraitInitiativeBonus(actor);
  const total = dexModifier + traitBonus;
  return `1d20${total >= 0 ? `+${total}` : String(total)}`;
}


function firstRollDiceLabel(action: ActorAction | null | undefined, fallbackLabel: string) {
  const override = action?.metadata?.diceLabel?.trim();
  const label = override || fallbackLabel;

  // Dice+ labels are safest when they stay compact and do not include punctuation-heavy weapon names.
  return label.replace(/[â€“â€”]/g, "-").replace(/[^a-zA-Z0-9 +_/-]/g, "").trim() || fallbackLabel;
}

function labeledDiceFormula(formula: string, label: string) {
  const cleanFormula = formula.trim();
  const cleanLabel = label.trim();

  if (!cleanFormula || !cleanLabel) {
    return cleanFormula;
  }

  if (cleanFormula.includes("#")) {
    return cleanFormula;
  }

  return `${cleanFormula} # ${cleanLabel}`;
}

function isRangedAttackAction(action?: ActorAction | null) {
  if (!action) {
    return false;
  }

  const searchableText = `${action.label} ${action.description ?? ""} ${action.metadata?.details ?? ""} ${action.metadata?.range ?? ""} ${(action.tags ?? []).join(" ")}`;
  return /\b(?:ranged|range|longbow|shortbow|crossbow|revolver|firearm|pistol|rifle|shot)\b/i.test(searchableText);
}

const orderedTabs: TabId[] = [
  "main",
  "bonus",
  "spells",
  "bond",
  "checks",
  "features",
  "status",
  "equipment",
  "resources",
  "outOfCombat",
  "notes",
];

function hasStatusTrackers(status: ActorStatusTrackerState) {
  return Boolean(status.strDrain || status.lifeDrain);
}

function getVisibleTabs(actor: Actor, status: ActorStatusTrackerState): TabId[] {
  return orderedTabs.filter((tabId) => {
    if (tabId === "notes") {
      return true;
    }

    if (tabId === "status") {
      return hasStatusTrackers(status);
    }

    return (actor.tabs[tabId]?.length ?? 0) > 0;
  });
}

function formatCosts(costs: ActionCost[]) {
  if (costs.length === 0) {
    return "Reminder";
  }

  return costs.map((cost) => actionCostLabels[cost]).join(" + ");
}

function makeReadiedKey(source: TabId | "pinned", actionId: string) {
  return `${source}:${actionId}`;
}

function isPinnedReactionAction(action: ActorAction) {
  return Boolean((action.pinned || action.pinReaction) && action.economyCost?.includes("reaction"));
}

function actionToPinnedReaction(tabId: TabId, action: ActorAction): PinnedReaction {
  return {
    id: action.id,
    label: action.label,
    description: action.metadata?.details ?? action.description,
    logMessage: action.logMessage,
    sourceTabId: tabId,
    sourceActionId: action.id,
  };
}

function getPinnedReactionShortcuts(actor: Actor) {
  const pinnedById = new Map<string, PinnedReaction>();

  actor.pinnedReactions.forEach((reaction) => {
    pinnedById.set(reaction.id, reaction);
  });

  Object.entries(actor.tabs).forEach(([tabId, actions]) => {
    actions.forEach((action) => {
      if (isPinnedReactionAction(action)) {
        pinnedById.set(action.id, actionToPinnedReaction(tabId as TabId, action));
      }
    });
  });

  return Array.from(pinnedById.values());
}

function makePendingLogKey(actorId: string, readiedKey: string) {
  return `${actorId}:${readiedKey}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function formatHp(current: number) {
  return `${current}`;
}

function formatTrackerWarning(template: string, threshold: number) {
  return template.replaceAll("{threshold}", `${threshold}`);
}

function clampTrackerValue(value: number, max?: number) {
  const minimumClamped = Math.max(0, value);

  if (typeof max === "number") {
    return Math.min(max, minimumClamped);
  }

  return minimumClamped;
}

function titleCaseKind(kind: string) {
  return kind
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function createDiceRequestId(prefix: string, actionId: string) {
  return `${prefix}-${Date.now()}-${actionId}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRollFormula(rawFormula?: string) {
  if (!rawFormula?.trim()) {
    return "";
  }

  const cleaned = rawFormula
    .replace(/\bcrit\b.*$/i, "")
    .replace(/\bwith\s+rage\b:?/i, "")
    .replace(/\b(?:healing|piercing|slashing|bludgeoning|force|fire|cold|necrotic|psychic|radiant|acid|poison|lightning|thunder|temp(?:orary)?\s*hp|hp|damage|on\s+hit)\b/gi, " ")
    .replace(/[^0-9dD+\-*/()\s]/g, " ")
    .replace(/\s+/g, "")
    .replace(/^[+]/, "")
    .replace(/\+{2,}/g, "+")
    .trim();

  return cleaned;
}

function hasRollableFormula(rawFormula?: string) {
  return /\d+d\d+/i.test(rawFormula ?? "") || /^[+-]?\d+$/.test((rawFormula ?? "").trim());
}

function combineRollFormulas(formulas: string[]) {
  const normalized = formulas
    .map((formula) => normalizeRollFormula(formula))
    .filter(Boolean);

  if (normalized.length === 0) {
    return "";
  }

  return normalized.join("+").replace(/\+\+/g, "+").replace(/\+-/g, "-");
}

function doubleDiceTerms(rawFormula?: string) {
  const normalized = normalizeRollFormula(rawFormula);

  if (!normalized) {
    return "";
  }

  // BUILD 0.5.3.1: Crit Damage uses the action's own crit field for base damage,
  // then doubles additive dice only. Flat additive modifiers such as Rage +2 stay flat.
  return normalized.replace(/(?<![A-Za-z0-9])(\d*)d(\d+)/gi, (_match, countText: string, dieText: string) => {
    const count = countText ? Number.parseInt(countText, 10) : 1;
    const doubled = Number.isFinite(count) ? count * 2 : 2;
    return `${doubled}d${dieText}`;
  });
}

function formatAdditiveFormulaForDamage(rawFormula: string, isCritDamage: boolean) {
  return isCritDamage ? doubleDiceTerms(rawFormula) : normalizeRollFormula(rawFormula);
}

function isPersistentDamageAdditive(effect: Pick<ArmedEffect, "id">) {
  return effect.id === "rage-active";
}


function normalizeFirstRollFormula(rawFormula?: string) {
  const normalized = normalizeRollFormula(rawFormula);

  if (normalized) {
    return normalized;
  }

  const trimmed = rawFormula?.trim() ?? "";
  return hasRollableFormula(trimmed) ? trimmed.replace(/^\[|\]$/g, "") : "";
}

function formatCritThresholdLabel(threshold?: number) {
  const value = typeof threshold === "number" ? threshold : 20;
  return value === 20 ? "Nat 20" : `Nat ${value}-20`;
}

function formatDamageRollLabel(actionLabel: string, damageLabel: string, isCritDamage: boolean, critThreshold?: number) {
  if (!isCritDamage) {
    return `${actionLabel} ${damageLabel}`;
  }

  return `CRIT! ${formatCritThresholdLabel(critThreshold)} â€” ${actionLabel} ${damageLabel}`;
}

function additiveShorthandForEffect(effect: ArmedEffect) {
  if (effect.source === "Bond" || effect.id.startsWith("bond:")) {
    return "B";
  }

  if (effect.id === "rage-active" || effect.id === "rage-pending") {
    return "R";
  }

  if (effect.id.startsWith("risk-die")) {
    return "RD";
  }

  return effect.label.replace(/\s+/g, " ").trim();
}

function formatAdditiveShorthand(effects: Array<{ shorthand: string }>) {
  const tags = Array.from(new Set(effects.map((effect) => effect.shorthand).filter(Boolean)));
  return tags.length > 0 ? ` (${tags.join("+")})` : "";
}

function isEligibleRageAction(action?: ActorAction | null, candidate?: ReadiedRollCandidate | CommittedRollState | null) {
  if (!action || !candidate) {
    return false;
  }

  if (candidate.outcomeMode !== "attack-roll") {
    return false;
  }

  const searchableText = `${action.label} ${action.description ?? ""} ${action.metadata?.details ?? ""} ${(action.tags ?? []).join(" ")}`;
  return /\b(?:unarmed|strike|dagger|flail|quarterstaff|melee|weapon)\b/i.test(searchableText);
}

export function ActorCard({
  actor,
  hp,
  actionState,
  actorNotes,
  status,
  concentration,
  committedRoll,
  rulesProfile,
  turnResetVersion,
  onHpChange,
  onResetHp,
  onReadyActionCosts,
  onUnreadyAction,
  onRemovePendingLogEntries,
  onResetTurn,
  onSetConcentration,
  onClearConcentration,
  onStartCommittedRoll,
  onSetCommittedRollResult,
  onChooseCommittedRollOutcome,
  onChooseCommittedRollDamage,
  onClearCommittedRoll,
  onMarkCommittedRollBridgeSent,
  diceBridgeStatus,
  diceBridgeLastEvent,
  onSendDiceBridgeRequest,
  onSendDicePlusRequest,
  onSendMockDiceBridgeResult,
  onAddActorNote,
  onDeleteActorNote,
  onStatusTrackerChange,
  onResetStatusTracker,
  onResetAllActorStatuses,
  isBuilderMode = false,
  canShowDevTestRoll = false,
  isPlayerMode = false,
  isActiveTurn = true,
  resourceCounters,
  onShortRest,
  onLongRest,
  onLog,
}: ActorCardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("main");
  const [debuffsOpen, setDebuffsOpen] = useState(false);
  const [absCheckOpen, setAbsCheckOpen] = useState(false);
  const [resolvedReadiedKeysByActorId, setResolvedReadiedKeysByActorId] = useState<Record<string, string[]>>(() => readActorCardSessionSnapshot().resolvedReadiedKeysByActorId ?? {});
  const [usedCostSlotsByActorId, setUsedCostSlotsByActorId] = useState<Record<string, ActionCost[]>>(() => readActorCardSessionSnapshot().usedCostSlotsByActorId ?? {});
  const [sessionCountersByActorId, setSessionCountersByActorId] = useState<Record<string, Partial<Record<SessionCounterId, SessionCounter>>>>(() => readActorCardSessionSnapshot().sessionCountersByActorId ?? {});
  const [armedEffectsByActorId, setArmedEffectsByActorId] = useState<Record<string, ArmedEffect[]>>(() => readActorCardSessionSnapshot().armedEffectsByActorId ?? {});
  const [classOptionContextByActorId, setClassOptionContextByActorId] = useState<Record<string, ClassOptionContext | null>>(() => readActorCardSessionSnapshot().classOptionContextByActorId ?? {});
  const [classOptionsDismissedByActorId, setClassOptionsDismissedByActorId] = useState<Record<string, boolean>>(() => readActorCardSessionSnapshot().classOptionsDismissedByActorId ?? {});
  const [initiativeByActorId, setInitiativeByActorId] = useState<Record<string, InitiativeRollState | null>>(() => readActorCardSessionSnapshot().initiativeByActorId ?? {});
  const [attackUseByActorId, setAttackUseByActorId] = useState<Record<string, AttackUseState | null>>(() => readActorCardSessionSnapshot().attackUseByActorId ?? {});
  const [debuffNote, setDebuffNote] = useState("");
  const sessionBroadcastReadyRef = useRef(false);
  const suppressNextSessionBroadcastRef = useRef(false);
  const hasMountedTurnResetRef = useRef(false);

  const broadcastActorCardSession = useCallback((snapshot: ActorCardSessionSnapshot) => {
    writeActorCardSessionSnapshot(snapshot);

    if (!OBR.isAvailable || !sessionBroadcastReadyRef.current) {
      return;
    }

    void OBR.broadcast
      .sendMessage(ACTOR_CARD_SESSION_CHANNEL, { type: "replace", snapshot }, { destination: "REMOTE" })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const snapshot = {
      resolvedReadiedKeysByActorId,
      usedCostSlotsByActorId,
      sessionCountersByActorId,
      armedEffectsByActorId,
      classOptionContextByActorId,
      classOptionsDismissedByActorId,
      initiativeByActorId,
      attackUseByActorId,
    };

    if (suppressNextSessionBroadcastRef.current) {
      suppressNextSessionBroadcastRef.current = false;
      writeActorCardSessionSnapshot(snapshot);
      return;
    }

    broadcastActorCardSession(snapshot);
  }, [
    resolvedReadiedKeysByActorId,
    usedCostSlotsByActorId,
    sessionCountersByActorId,
    armedEffectsByActorId,
    classOptionContextByActorId,
    classOptionsDismissedByActorId,
    initiativeByActorId,
    attackUseByActorId,
    broadcastActorCardSession,
  ]);

  function applyActorCardSessionSnapshot(snapshot: ActorCardSessionSnapshot) {
    setResolvedReadiedKeysByActorId(snapshot.resolvedReadiedKeysByActorId ?? {});
    setUsedCostSlotsByActorId(snapshot.usedCostSlotsByActorId ?? {});
    setSessionCountersByActorId(snapshot.sessionCountersByActorId ?? {});
    setArmedEffectsByActorId(snapshot.armedEffectsByActorId ?? {});
    setClassOptionContextByActorId(snapshot.classOptionContextByActorId ?? {});
    setClassOptionsDismissedByActorId(snapshot.classOptionsDismissedByActorId ?? {});
    setInitiativeByActorId(snapshot.initiativeByActorId ?? {});
    setAttackUseByActorId(snapshot.attackUseByActorId ?? {});
  }

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACTOR_CARD_SESSION_STORAGE_KEY) {
        return;
      }

      suppressNextSessionBroadcastRef.current = true;
      applyActorCardSessionSnapshot(readActorCardSessionSnapshot());
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!OBR.isAvailable) {
      return;
    }

    sessionBroadcastReadyRef.current = true;

    return OBR.broadcast.onMessage(ACTOR_CARD_SESSION_CHANNEL, (event) => {
      if (!isActorCardSessionSyncMessage(event.data)) {
        return;
      }

      suppressNextSessionBroadcastRef.current = true;
      writeActorCardSessionSnapshot(event.data.snapshot);
      applyActorCardSessionSnapshot(event.data.snapshot);
    });
  }, []);

  const visibleTabs = useMemo(() => getVisibleTabs(actor, status), [actor, status]);
  const resolvedReadiedKeys = resolvedReadiedKeysByActorId[actor.id] ?? [];
  const usedCostSlotsFromSession = usedCostSlotsByActorId[actor.id] ?? [];
  const usedCostSlotsFromActionState = (Object.entries(actionState) as Array<[ActionCost, string | null]>)
    .filter(([, value]) => isUsedActionStateValue(value))
    .map(([cost]) => cost);
  const usedCostSlots = uniqueStrings([...usedCostSlotsFromSession, ...usedCostSlotsFromActionState]) as ActionCost[];
  const sessionCounters = sessionCountersByActorId[actor.id] ?? createSessionCounters(actor);
  const armedEffects = armedEffectsByActorId[actor.id] ?? [];
  const classOptionContext = classOptionContextByActorId[actor.id] ?? null;
  const classOptionsDismissed = classOptionsDismissedByActorId[actor.id] ?? false;
  const initiativeState = initiativeByActorId[actor.id] ?? null;
  const attackUseState = attackUseByActorId[actor.id] ?? null;

  useEffect(() => {
    setActiveTab(visibleTabs.includes("main") ? "main" : visibleTabs[0] ?? "notes");
  }, [actor.id, visibleTabs]);

  useEffect(() => {
    setSessionCountersByActorId((current) => {
      if (current[actor.id]) {
        return current;
      }

      return {
        ...current,
        [actor.id]: createSessionCounters(actor),
      };
    });
  }, [actor]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs.includes("main") ? "main" : visibleTabs[0] ?? "notes");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const result = diceBridgeLastEvent?.result;
    const currentInitiative = initiativeByActorId[actor.id];

    if (!result || !currentInitiative || currentInitiative.status !== "pending") {
      return;
    }

    if (result.requestId !== currentInitiative.requestId) {
      return;
    }

    const resultText = result.result?.trim()
      || result.text?.trim()
      || (typeof result.naturalRoll === "number" && typeof result.total === "number"
        ? `nat ${result.naturalRoll} / total ${result.total}`
        : typeof result.total === "number"
          ? `total ${result.total}`
          : "result received");

    setInitiativeByActorId((current) => ({
      ...current,
      [actor.id]: {
        ...currentInitiative,
        status: "received",
        result: resultText,
      },
    }));

    onLog({
      actorName: actor.name,
      actionName: "Initiative",
      tabId: "system",
      message: `${actor.name} initiative result received: ${resultText}.`,
    });
  }, [actor.id, actor.name, diceBridgeLastEvent, initiativeByActorId, onLog]);

  useEffect(() => {
    // BUILD 0.4.0g: Do not clear used/resolved turn state just because an
    // actor card mounted or the Owlbear popover opened. The previous effect
    // ran on first render, which wiped red/used action state when swapping
    // cards before Next Turn was clicked. Only a real parent turn-reset tick
    // should clear the per-turn used/readied guard.
    if (!hasMountedTurnResetRef.current) {
      hasMountedTurnResetRef.current = true;
      return;
    }

    setResolvedReadiedKeysByActorId({});
    setUsedCostSlotsByActorId({});
  }, [turnResetVersion]);

  const hpStatus = getHpStatus(hp);
  const isCompanionCard = actor.kind === "companion";
  const levelDisplay = isCompanionCard && actor.level <= 0 ? "Ref" : `${actor.level}`;
  const pinnedReactions = useMemo(() => getPinnedReactionShortcuts(actor), [actor]);
  const activeActions = useMemo(
    () => (actor.tabs[activeTab] ?? []).filter((action) => !isPinnedReactionAction(action)),
    [actor.tabs, activeTab]
  );

  const readiedLabelMap = useMemo(() => {
    const entries: Record<string, string> = {};

    function labelWithConcentration(action: Pick<ActorAction, "label" | "concentration">) {
      return action.concentration ? `${action.label} (Concentration)` : action.label;
    }

    Object.entries(actor.tabs).forEach(([tabId, actions]) => {
      actions.forEach((action) => {
        entries[makeReadiedKey(tabId as TabId, action.id)] = labelWithConcentration(action);
      });
    });

    pinnedReactions.forEach((reaction) => {
      entries[makeReadiedKey("pinned", reaction.id)] = reaction.label;
    });

    return entries;
  }, [actor, pinnedReactions]);

  function getActionLogLabel(action: ActorAction) {
    return action.concentration ? `${action.label} (Concentration)` : action.label;
  }

  function getReadiedLabel(readiedKey: string | null) {
    if (!readiedKey) {
      return null;
    }

    return readiedLabelMap[readiedKey] ?? "previous item";
  }

  function isResolvedReadiedKey(readiedKey: string) {
    return resolvedReadiedKeys.includes(readiedKey);
  }

  function markReadiedKeyResolved(readiedKey: string) {
    setResolvedReadiedKeysByActorId((current) => {
      const currentKeys = current[actor.id] ?? [];

      if (currentKeys.includes(readiedKey)) {
        return current;
      }

      return {
        ...current,
        [actor.id]: [...currentKeys, readiedKey],
      };
    });
  }

  function clearResolvedReadiedKeysForActor() {
    setResolvedReadiedKeysByActorId((current) => {
      if (!current[actor.id]?.length) {
        return current;
      }

      const next = { ...current };
      delete next[actor.id];
      return next;
    });
  }

  function markCostSlotsUsed(costs: ActionCost[]) {
    if (costs.length === 0) {
      return;
    }

    setUsedCostSlotsByActorId((current) => {
      const currentCosts = current[actor.id] ?? [];
      const nextCosts = uniqueStrings([...currentCosts, ...costs]) as ActionCost[];

      if (nextCosts.length === currentCosts.length) {
        return current;
      }

      return {
        ...current,
        [actor.id]: nextCosts,
      };
    });
  }

  function clearUsedCostSlotsForActor() {
    setUsedCostSlotsByActorId((current) => {
      if (!current[actor.id]?.length) {
        return current;
      }

      const next = { ...current };
      delete next[actor.id];
      return next;
    });
  }

  function hasUsedCostSlot(costs: ActionCost[]) {
    return costs.some((cost) => usedCostSlots.includes(cost));
  }

  function getActionForReadiedKey(readiedKey: string): { action: ActorAction; sourceTabId: TabId | "pinned" } | null {
    const [source, actionId] = readiedKey.split(":");

    if (!source || !actionId) {
      return null;
    }

    if (source === "pinned") {
      const reaction = pinnedReactions.find((item) => item.id === actionId);

      if (!reaction) {
        return null;
      }

      if (reaction.sourceTabId && reaction.sourceActionId) {
        const sourceAction = actor.tabs[reaction.sourceTabId]?.find((item) => item.id === reaction.sourceActionId);

        if (sourceAction) {
          return {
            sourceTabId: reaction.sourceTabId,
            action: {
              ...sourceAction,
              economyCost: sourceAction.economyCost ?? ["reaction"],
            },
          };
        }
      }

      return {
        sourceTabId: "pinned",
        action: {
          id: reaction.id,
          label: reaction.label,
          description: reaction.description,
          logMessage: reaction.logMessage,
          economyCost: ["reaction"],
          actionKind: "feature",
        },
      };
    }

    const sourceTabId = source as TabId;
    const action = actor.tabs[sourceTabId]?.find((item) => item.id === actionId);

    return action ? { action, sourceTabId } : null;
  }

  function getSupersededPendingLogKeys(costs: ActionCost[], nextReadiedKey: string) {
    return uniqueStrings(
      costs
        .map((cost) => actionState[cost])
        .filter((currentKey): currentKey is string => Boolean(currentKey) && currentKey !== nextReadiedKey && !isUsedActionStateValue(currentKey))
        .map((currentKey) => makePendingLogKey(actor.id, currentKey))
    );
  }

  function getCurrentPendingLogKeys() {
    return uniqueStrings(
      (Object.keys(actionState) as ActionCost[])
        .map((cost) => actionState[cost])
        .filter((readiedKey): readiedKey is string => Boolean(readiedKey) && !isUsedActionStateValue(readiedKey))
        .map((readiedKey) => makePendingLogKey(actor.id, readiedKey))
    );
  }

  function damageAmount(amount: number) {
    const next = {
      current: Math.max(0, hp.current - amount),
      max: hp.max,
      temp: hp.temp ?? 0,
    };

    if (next.current === hp.current) {
      return;
    }

    onHpChange(next);
    onLog({
      actorName: actor.name,
      actionName: `Damage ${amount}`,
      tabId: "system",
      message: `${actor.name} takes ${amount} damage. HP ${formatHp(hp.current)} â†’ ${formatHp(next.current)}.`,
    });
  }

  function healAmount(amount: number) {
    const next = {
      current: Math.min(hp.max, hp.current + amount),
      max: hp.max,
      temp: hp.temp ?? 0,
    };
    const restoredAmount = next.current - hp.current;

    if (restoredAmount <= 0) {
      return;
    }

    onHpChange(next);
    onLog({
      actorName: actor.name,
      actionName: `Heal ${amount}`,
      tabId: "system",
      message:
        restoredAmount < amount
          ? `${actor.name} receives ${amount} healing, but only ${restoredAmount} HP is restored due to max HP. HP ${formatHp(
              hp.current
            )} â†’ ${formatHp(next.current)}.`
          : `${actor.name} heals ${amount} HP. HP ${formatHp(hp.current)} â†’ ${formatHp(next.current)}.`,
    });
  }

  function gainTempHp(amount: number) {
    const currentTemp = hp.temp ?? 0;
    const next = {
      ...hp,
      temp: currentTemp + amount,
    };

    onHpChange(next);
    onLog({
      actorName: actor.name,
      actionName: `Temp HP +${amount}`,
      tabId: "system",
      message: `${actor.name} gains ${amount} temporary HP. Temp HP ${currentTemp} â†’ ${next.temp}.`,
    });
  }

  function loseTempHp(amount: number) {
    const currentTemp = hp.temp ?? 0;
    const nextTemp = Math.max(0, currentTemp - amount);

    if (nextTemp === currentTemp) {
      return;
    }

    onHpChange({
      ...hp,
      temp: nextTemp,
    });
    onLog({
      actorName: actor.name,
      actionName: `Temp HP -${amount}`,
      tabId: "system",
      message: `${actor.name} loses ${amount} temporary HP. Temp HP ${currentTemp} â†’ ${nextTemp}.`,
    });
  }

  function resetTempHp() {
    const currentTemp = hp.temp ?? 0;

    if (currentTemp === 0) {
      return;
    }

    onHpChange({
      ...hp,
      temp: 0,
    });
    onLog({
      actorName: actor.name,
      actionName: "Reset Temp HP",
      tabId: "system",
      message: `${actor.name}'s temporary HP resets to 0. Temp HP ${currentTemp} â†’ 0.`,
    });
  }

  function setZero() {
    const next = {
      current: 0,
      max: hp.max,
      temp: hp.temp ?? 0,
    };

    if (hp.current === 0) {
      return;
    }

    onHpChange(next);
    onLog({
      actorName: actor.name,
      actionName: "Set 0 HP",
      tabId: "system",
      message: `${actor.name} drops to 0 HP. HP ${formatHp(hp.current)} â†’ 0.`,
    });
  }

  function resetHp() {
    onResetHp();
    onLog({
      actorName: actor.name,
      actionName: "Reset HP",
      tabId: "system",
      message: `${actor.name} HP reset to ${actor.stats.hp.current}/${actor.stats.hp.max}.`,
    });
  }

  function resetTurn() {
    clearResolvedReadiedKeysForActor();
    clearUsedCostSlotsForActor();
    clearAttackUseForActor();
    onRemovePendingLogEntries(getCurrentPendingLogKeys());
    onClearCommittedRoll();
    onResetTurn();
    onLog({
      actorName: actor.name,
      actionName: "Next Turn",
      tabId: "system",
      message: `${actor.name} starts next turn. Turn actions reset; active concentration remains.`,
    });
  }

  function clearAttackUseForActor() {
    setAttackUseByActorId((current) => {
      if (!current[actor.id]) {
        return current;
      }

      const next = { ...current };
      delete next[actor.id];
      return next;
    });
  }

  function getAttackUseMax(action?: ActorAction | null) {
    const configuredUses = action?.metadata?.attackUses;

    if (typeof configuredUses === "number" && configuredUses > 1) {
      return Math.floor(configuredUses);
    }

    return 1;
  }

  function getCurrentAttackUse() {
    return attackUseState?.current ?? 0;
  }

  function isMultiAttackCandidate(state: CommittedRollState) {
    if (!state.costs.includes("main") || state.outcomeMode !== "attack-roll") {
      return false;
    }

    const entry = getActionForReadiedKey(state.readiedKey);
    return getAttackUseMax(entry?.action ?? null) > 1;
  }

  function recordAttackUse(state: CommittedRollState) {
    const entry = getActionForReadiedKey(state.readiedKey);
    const max = getAttackUseMax(entry?.action ?? null);

    if (max <= 1) {
      return { current: 1, max, slotComplete: true };
    }

    const nextCurrent = Math.min(max, getCurrentAttackUse() + 1);

    setAttackUseByActorId((current) => ({
      ...current,
      [actor.id]: {
        current: nextCurrent,
        max,
        label: state.actionLabel,
      },
    }));

    return {
      current: nextCurrent,
      max,
      slotComplete: nextCurrent >= max,
    };
  }

  async function handleInitiative() {
    const formula = initiativeRollFormula(actor);
    const requestId = createDiceRequestId("fdm-init", actor.id);

    setInitiativeByActorId((current) => ({
      ...current,
      [actor.id]: {
        requestId,
        formula,
        status: "pending",
      },
    }));

    onLog({
      actorName: actor.name,
      actionName: "Initiative",
      tabId: "system",
      message: `${actor.name} rolls Initiative (${formula}). Sending to Dice+ when available; manual fallback remains available.`,
    });

    const request: DiceBridgeRollRequest = {
      protocol: "forever-dm-combat.roll.request.v1",
      requestId,
      source: "Forever DM Combat",
      actorId: actor.id,
      actorName: actor.name,
      actionId: "initiative",
      actionName: "Initiative",
      formula: labeledDiceFormula(formula, `${actor.name} Initiative`),
      outcomeMode: "ability-check",
      sentAt: new Date().toISOString(),
    };

    const sent = await onSendDicePlusRequest(request);

    if (!sent) {
      setInitiativeByActorId((current) => ({
        ...current,
        [actor.id]: {
          requestId,
          formula,
          status: "manual",
        },
      }));
      onLog({
        actorName: actor.name,
        actionName: "Manual Initiative",
        tabId: "system",
        message: `${actor.name} should roll Initiative manually: ${formula}.`,
      });
      return;
    }

    onLog({
      actorName: actor.name,
      actionName: "Dice+ Initiative",
      tabId: "system",
      message: `${actor.name} sent Initiative (${formula}) to Dice+.`,
    });
  }

  function handleAdjustStatusTracker(trackerId: StatusTrackerId, delta: number) {
    const tracker = status[trackerId];

    if (!tracker) {
      return;
    }

    const label = getStatusTrackerLabel(trackerId, tracker);
    const nextTracker = {
      ...tracker,
      current: clampTrackerValue(tracker.current + delta, tracker.max),
    };

    if (nextTracker.current === tracker.current) {
      return;
    }

    onStatusTrackerChange(trackerId, nextTracker);

    const displayMax = typeof nextTracker.max === "number" ? `/${nextTracker.max}` : "";
    const baseMessage = `${actor.name} ${label} is now ${nextTracker.current}${displayMax}.`;
    const threshold = nextTracker.warningAt;
    const thresholdWarning =
      typeof threshold === "number" && tracker.current < threshold && nextTracker.current >= threshold
        ? ` ${formatTrackerWarning(
            nextTracker.warningText ?? `${label} has reached ${threshold}. Resolve the table rule.`,
            threshold
          )}`
        : "";

    onLog({
      actorName: actor.name,
      actionName: `${label} ${delta > 0 ? `+${delta}` : delta}`,
      tabId: "system",
      message: `${baseMessage}${thresholdWarning}`,
    });
  }

  function handleResetStatusTracker(trackerId: StatusTrackerId) {
    const tracker = status[trackerId];
    const label = getStatusTrackerLabel(trackerId, tracker);

    onResetStatusTracker(trackerId);
    onLog({
      actorName: actor.name,
      actionName: `Clear ${label}`,
      tabId: "system",
      message: `${actor.name} ${label} cleared to its module default.`,
    });
  }

  function handleResetAllActorStatuses() {
    onResetAllActorStatuses();
    onLog({
      actorName: actor.name,
      actionName: "Reset Status",
      tabId: "system",
      message: `${actor.name}'s drain trackers reset to module defaults.`,
    });
  }


  function setSessionCounter(counterId: SessionCounterId, updater: (counter: SessionCounter) => SessionCounter) {
    setSessionCountersByActorId((current) => {
      const actorCounters = current[actor.id] ?? createSessionCounters(actor);
      const counter = actorCounters[counterId];

      if (!counter) {
        return current;
      }

      return {
        ...current,
        [actor.id]: {
          ...actorCounters,
          [counterId]: updater(counter),
        },
      };
    });
  }

  function upsertArmedEffect(effect: ArmedEffect) {
    setArmedEffectsByActorId((current) => {
      const currentEffects = current[actor.id] ?? [];
      const withoutExisting = currentEffects.filter((item) => item.id !== effect.id);

      return {
        ...current,
        [actor.id]: [...withoutExisting, effect],
      };
    });
  }

  function clearArmedEffect(effectId: string) {
    setArmedEffectsByActorId((current) => {
      const currentEffects = current[actor.id] ?? [];
      const nextEffects = currentEffects.filter((item) => item.id !== effectId);

      if (nextEffects.length === currentEffects.length) {
        return current;
      }

      return {
        ...current,
        [actor.id]: nextEffects,
      };
    });
  }

  function clearAllArmedEffectsForActor() {
    setArmedEffectsByActorId((current) => {
      if (!current[actor.id]?.length) {
        return current;
      }

      const next = { ...current };
      delete next[actor.id];
      return next;
    });
  }

  function setClassOptionContext(nextContext: ClassOptionContext | null) {
    setClassOptionContextByActorId((current) => ({
      ...current,
      [actor.id]: nextContext,
    }));

    if (nextContext) {
      setClassOptionsDismissedByActorId((current) => ({
        ...current,
        [actor.id]: false,
      }));
    }
  }

  function clearClassOptionContext() {
    setClassOptionContext(null);
  }

  function handleAdjustSessionCounter(counterId: SessionCounterId, delta: number) {
    const counter = sessionCounters[counterId];

    if (!counter) {
      return;
    }

    const nextValue = Math.max(0, Math.min(counter.max, counter.current + delta));

    if (nextValue === counter.current) {
      return;
    }

    setSessionCounter(counterId, (current) => ({ ...current, current: nextValue }));
    onLog({
      actorName: actor.name,
      actionName: `${counter.label} ${delta > 0 ? `+${delta}` : delta}`,
      tabId: "system",
      message: `${actor.name} ${counter.label} is now ${nextValue}/${counter.max}.`,
    });
  }

  function handleUseRage() {
    const counter = sessionCounters.rage;

    if (!counter) {
      return;
    }

    if (counter.active) {
      onLog({
        actorName: actor.name,
        actionName: "Rage Active",
        tabId: "system",
        message: `${actor.name} is already raging.`,
      });
      return;
    }

    if (counter.current <= 0) {
      onLog({
        actorName: actor.name,
        actionName: "Rage Empty",
        tabId: "system",
        message: `${actor.name} has no Rage uses remaining to prepare.`,
      });
      return;
    }

    upsertArmedEffect({
      id: "rage-pending",
      label: "Rage prepared (+2)",
      details: "+2 damage will attach to the next eligible Strength melee damage roll when the action is rolled.",
      source: "Rage",
      formula: "+2",
    });
    onLog({
      actorName: actor.name,
      actionName: "Prepare Rage",
      tabId: "system",
      message: `${actor.name} prepares to Rage. Rage will spend and become active on the next eligible melee attack roll.`,
    });
  }

  function handleEndRage() {
    const counter = sessionCounters.rage;

    if (!counter) {
      return;
    }

    setSessionCounter("rage", (current) => ({ ...current, active: false }));
    clearArmedEffect("rage-active");
    clearArmedEffect("rage-pending");
    onLog({
      actorName: actor.name,
      actionName: "End Rage",
      tabId: "system",
      message: `${actor.name}'s Rage reminder is cleared.`,
    });
  }

  function handleSpendRiskDie() {
    const counter = sessionCounters.riskDice;

    if (!counter) {
      return;
    }

    if (counter.current <= 0) {
      onLog({
        actorName: actor.name,
        actionName: "Risk Dice Empty",
        tabId: "system",
        message: `${actor.name} has no Risk Dice remaining to spend.`,
      });
      return;
    }

    const nextValue = counter.current - 1;
    setSessionCounter("riskDice", (current) => ({ ...current, current: nextValue }));
    upsertArmedEffect({
      id: `risk-die-${Date.now()}`,
      label: "Risk Die spent (1d8)",
      details: "Roll/apply 1d8 for the selected Gunslinger maneuver, then clear this reminder.",
      source: "Resource",
      formula: "1d8",
    });
    onLog({
      actorName: actor.name,
      actionName: "Spend Risk Die",
      tabId: "system",
      message: `${actor.name} spends 1 Risk Die. Risk Dice ${counter.current}/${counter.max} â†’ ${nextValue}/${counter.max}.`,
    });
  }

  function spendSessionCounter(counterId: SessionCounterId, reason: string) {
    const counter = sessionCounters[counterId];

    if (!counter) {
      return false;
    }

    if (counter.current <= 0) {
      onLog({
        actorName: actor.name,
        actionName: `${counter.label} Empty`,
        tabId: "system",
        message: `${actor.name} has no ${counter.label} remaining for ${reason}.`,
      });
      return false;
    }

    const nextValue = counter.current - 1;
    setSessionCounter(counterId, (current) => ({ ...current, current: nextValue }));
    onLog({
      actorName: actor.name,
      actionName: reason,
      tabId: "system",
      message: `${actor.name} spends 1 ${counter.label}. ${counter.label} ${counter.current}/${counter.max} â†’ ${nextValue}/${counter.max}.`,
    });
    return true;
  }

  async function sendClassOptionDice(option: ClassOptionButton) {
    if (!option.formula?.trim()) {
      return false;
    }

    const request: DiceBridgeRollRequest = {
      protocol: "forever-dm-combat.roll.request.v1",
      requestId: createDiceRequestId("fdm-class", option.id),
      source: "Forever DM Combat",
      actorId: actor.id,
      actorName: actor.name,
      actionId: option.id,
      actionName: option.label,
      // Class option formulas must stay raw for Dice+.
      // Labels stay in actionName/log text so response dice like Grazing Shot actually roll.
      formula: option.formula.trim(),
      outcomeMode: "triggered",
      sentAt: new Date().toISOString(),
    };

    const sent = await onSendDicePlusRequest(request);

    if (sent) {
      onLog({
        actorName: actor.name,
        actionName: option.label,
        tabId: "system",
        message: `${actor.name} sent ${option.label} (${option.formula}) to Dice+.`,
      });
      return true;
    }

    onLog({
      actorName: actor.name,
      actionName: option.label,
      tabId: "system",
      message: `${actor.name} should roll ${option.label} manually: ${option.formula}.`,
    });
    return false;
  }

  async function handleUseClassOption(option: ClassOptionButton) {
    if (option.counterId && !spendSessionCounter(option.counterId, option.label)) {
      return;
    }

    // Hide contextual response options immediately so Grazing Shot does not fall through
    // into the direct class option buttons while Dice+ is resolving/responding.
    const shouldDismissAfterUse = option.responseKind === "miss" || option.responseKind === "abs-fail";

    if (shouldDismissAfterUse) {
      clearClassOptionContext();
      setClassOptionsDismissedByActorId((current) => ({
        ...current,
        [actor.id]: true,
      }));
    }

    await sendClassOptionDice(option);

    onLog({
      actorName: actor.name,
      actionName: option.label,
      tabId: "system",
      message: `${actor.name} uses class option: ${option.label}. ${option.details}`,
    });

    if (!shouldDismissAfterUse) {
      clearClassOptionContext();
      setClassOptionsDismissedByActorId((current) => ({
        ...current,
        [actor.id]: true,
      }));
    }
  }

  function getClassOptions() {
    const options: ClassOptionButton[] = [];

    const riskDice = sessionCounters.riskDice;
    const hasRiskDice = Boolean(riskDice && riskDice.current > 0);

    if (!hasRiskDice) {
      return options;
    }

    // 0.4.0e: keep this panel contextual only.
    // Direct Gunslinger options will move to a cleaner feature/resource surface later.
    if (!classOptionContext || classOptionsDismissed) {
      return options;
    }

    if (classOptionContext.kind === "attack-miss") {
      const missedEntry = getActionForReadiedKey(`${classOptionContext.sourceTabId}:${classOptionContext.actionId}`);
      const isEligibleRangedMiss = isRangedAttackAction(missedEntry?.action ?? null);

      if (isEligibleRangedMiss) {
        options.push({
          id: "grazing-shot",
          label: "Grazing Shot",
          details: `After ${classOptionContext.actionLabel} misses, spend 1 Risk Die and roll 1d8+2 damage.`,
          formula: "1d8+2",
          counterId: "riskDice",
          responseKind: "miss",
        });
      }

      return options;
    }

    if (classOptionContext.kind === "abs-fail") {
      if (maverickSpiritAbilities.includes(classOptionContext.ability)) {
        options.push({
          id: "maverick-spirit",
          label: "Maverick Spirit",
          details: `After failed ${classOptionContext.actionLabel}, spend 1 Risk Die and add 1d8 to the roll.`,
          formula: "1d8",
          counterId: "riskDice",
          responseKind: "abs-fail",
        });
      }

      return options;
    }

    return options;
  }

  function renderClassOptionsPanel() {
    const options = getClassOptions();

    if (options.length === 0) {
      return null;
    }

    return (
      <section className="class-options-panel" aria-label="Class options">
        <div className="class-options-heading">
          <span className="stat-label">Class Options</span>
          {classOptionContext && (
            <span className="class-option-context">
              {classOptionContext.kind === "attack-miss"
                ? `Context: ${classOptionContext.actionLabel} missed`
                : `Context: ${classOptionContext.actionLabel} failed`}
            </span>
          )}
        </div>
        <div className="class-option-grid">
          {options.map((option) => (
            <button className="class-option-button" key={option.id} type="button" onClick={() => void handleUseClassOption(option)}>
              <strong>{option.label}</strong>
              <span>{option.formula ? `Roll ${option.formula}` : "No dice"}</span>
              <small>{option.details}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  async function handleStartAbsCheck(ability: AbilityId, rollType: "check" | "save") {
    const label = `${abilityLabels[ability]} ${rollType === "save" ? "Save" : "Check"}`;
    const formula = abilityRollFormula(actor, ability);
    const bridgeRequestId = createDiceRequestId("fdm-abs", `${ability}-${rollType}`);

    onStartCommittedRoll({
      readiedKey: `abs-check:${actor.id}:${ability}:${rollType}:${Date.now()}`,
      actionId: `abs-${ability}-${rollType}`,
      actionLabel: label,
      sourceTabId: "checks",
      costs: [],
      outcomeMode: "ability-check",
      attackFormula: formula,
      bridgeRequestId,
      rulesProfile,
    });

    onLog({
      actorName: actor.name,
      actionName: label,
      tabId: "system",
      message: `${actor.name} rolls ${label}. Sending ${formula} to Dice+ when available; manual entry remains available.`,
    });

    const request: DiceBridgeRollRequest = {
      protocol: "forever-dm-combat.roll.request.v1",
      requestId: bridgeRequestId,
      source: "Forever DM Combat",
      actorId: actor.id,
      actorName: actor.name,
      actionId: `abs-${ability}-${rollType}`,
      actionName: label,
      formula: labeledDiceFormula(formula, label),
      outcomeMode: "ability-check",
      sentAt: new Date().toISOString(),
    };

    const sent = await onSendDicePlusRequest(request);

    if (sent) {
      onMarkCommittedRollBridgeSent();
      onLog({
        actorName: actor.name,
        actionName: "Dice+",
        tabId: "system",
        message: `${actor.name} sent ${label} (${formula}) to Dice+.`,
      });
      return;
    }

    onLog({
      actorName: actor.name,
      actionName: "Manual Check",
      tabId: "system",
      message: `${actor.name} has no dice extension response for ${label}. Use manual roll entry.`,
    });
  }

  function renderAbsCheckPanel() {
    const abilities: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

    return (
      <section className={`abs-check-panel ${absCheckOpen ? "open" : ""}`} aria-label="Ability and save checks">
        <button
          className="secondary-button compact abs-check-toggle"
          type="button"
          onClick={() => setAbsCheckOpen((current) => !current)}
          aria-expanded={absCheckOpen}
        >
          {absCheckOpen ? "Checks ▼" : "Checks ▶"}
        </button>
        {absCheckOpen && (
          <div className="abs-check-drawer">
            <div>
              <span className="stat-label">Ability Check</span>
              <div className="abs-check-button-grid">
                {abilities.map((ability) => (
                  <button key={`check-${ability}`} type="button" onClick={() => void handleStartAbsCheck(ability, "check")}>
                    {abilityLabels[ability]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="stat-label">Save</span>
              <div className="abs-check-button-grid">
                {abilities.map((ability) => (
                  <button key={`save-${ability}`} type="button" onClick={() => void handleStartAbsCheck(ability, "save")}>
                    {abilityLabels[ability]} Save
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  function getReadiedBondEffect(): ArmedEffect | null {
    const readiedBondKey = actionState.bond;

    if (!readiedBondKey) {
      return null;
    }

    const entry = getActionForReadiedKey(readiedBondKey);

    if (!entry || entry.sourceTabId !== "bond") {
      return null;
    }

    const formula = entry.action.metadata?.damage ?? entry.action.metadata?.additive;
    const details = entry.action.metadata?.details ?? entry.action.description ?? "Resolve this bond effect manually.";

    return {
      id: `bond:${entry.action.id}`,
      label: formula ? `${entry.action.label} (${formula})` : entry.action.label,
      details,
      source: "Bond",
      formula,
    };
  }

  function getVisibleArmedEffects() {
    const bondEffect = getReadiedBondEffect();
    return bondEffect ? [bondEffect, ...armedEffects] : armedEffects;
  }

  function consumeReadiedBondWithResolvedAction(resolvedReadiedKey: string) {
    const bondKey = actionState.bond;

    if (!bondKey || bondKey === resolvedReadiedKey) {
      return;
    }

    const bondEntry = getActionForReadiedKey(bondKey);

    if (!bondEntry || bondEntry.sourceTabId !== "bond") {
      return;
    }

    onUnreadyAction(bondKey);
    onRemovePendingLogEntries([makePendingLogKey(actor.id, bondKey)]);
    markCostSlotsUsed(["bond"]);
    onLog({
      actorName: actor.name,
      actionName: "Bond Applied",
      tabId: "system",
      message: `${actor.name}'s readied bond ${bondEntry.action.label} is applied/cleared with the resolved action.`,
    });
  }

  function renderArmedEffectsPanel() {
    const visibleEffects = getVisibleArmedEffects();

    if (visibleEffects.length === 0) {
      return null;
    }

    return (
      <section className="armed-effects-panel" aria-label="Armed effects">
        <div className="armed-effects-header">
          <span className="stat-label">Armed Effects</span>
          <span>{visibleEffects.length} active</span>
        </div>
        <div className="armed-effect-chip-list">
          {visibleEffects.map((effect) => (
            <span className={`armed-effect-chip ${effect.id === "rage-active" || effect.id === "rage-pending" ? "rage-armed" : ""}`} key={effect.id} title={effect.details}>
              <strong>{effect.source}</strong> · {effect.label}
              {!effect.id.startsWith("bond:") && (
                <button type="button" onClick={() => clearArmedEffect(effect.id)} aria-label={`Clear ${effect.label}`}>
                  Ã—
                </button>
              )}
            </span>
          ))}
        </div>
      </section>
    );
  }

  function renderSessionCounterPanel() {
    const counters = Object.values(sessionCounters).filter((counter): counter is SessionCounter => Boolean(counter));

    if (counters.length === 0) {
      return null;
    }

    return (
      <section className="session-counter-panel" aria-label="Session counters">
        <div className="session-counter-heading">
          <span className="stat-label">Combat Counters</span>
          <span className="session-counter-note">editable</span>
        </div>
        {counters.map((counter) => (
          <div className={`session-counter-row ${counter.active ? "active" : ""}`} key={counter.id}>
            <div>
              <strong>{counter.label}</strong>
              <span>{formatCounterValue(counter)}</span>
              <p>{counter.note}</p>
            </div>
            <div className="session-counter-controls">
              <button type="button" onClick={() => handleAdjustSessionCounter(counter.id, -1)}>
                âˆ’
              </button>
              <button type="button" onClick={() => handleAdjustSessionCounter(counter.id, 1)}>
                +
              </button>
              {counter.id === "rage" && (
                counter.active ? (
                  <button type="button" onClick={handleEndRage}>End Rage</button>
                ) : (
                  <button type="button" onClick={handleUseRage}>Prepare Rage</button>
                )
              )}
              {counter.id === "riskDice" && <button type="button" onClick={handleSpendRiskDie}>Spend Risk Die</button>}
            </div>
          </div>
        ))}
      </section>
    );
  }

  function renderAttackUsePanel() {
    if (!attackUseState || attackUseState.max <= 1) {
      return null;
    }

    return (
      <section className="attack-use-panel" aria-label="Attack use counter">
        <span className="stat-label">Attack Uses</span>
        <strong>Attack {attackUseState.current}/{attackUseState.max}</strong>
        <span>{attackUseState.current >= attackUseState.max ? "Main slot used" : "Main slot still available"}</span>
      </section>
    );
  }

  function renderCompactDebuffSummary() {
    if (!hasStatusTrackers(status)) {
      return null;
    }

    const trackers: Array<{ id: StatusTrackerId; tracker: DrainTracker }> = [];

    if (status.strDrain) {
      trackers.push({ id: "strDrain", tracker: status.strDrain });
    }

    if (status.lifeDrain) {
      trackers.push({ id: "lifeDrain", tracker: status.lifeDrain });
    }

    return (
      <section className={`compact-debuff-panel ${debuffsOpen ? "open" : ""}`} aria-label="Debuffs and trackers">
        <div className="compact-debuff-summary-row">
          <div className="compact-debuff-chip-list">
            <span className="compact-debuff-title">Debuffs</span>
            {trackers.map(({ id, tracker }) => {
              const label = getStatusTrackerLabel(id, tracker);
              const value = typeof tracker.max === "number" ? `${tracker.current}/${tracker.max}` : `${tracker.current}`;
              return (
                <span className={`compact-debuff-chip ${tracker.current > 0 ? "active" : ""}`} key={id}>
                  {label} {value}
                </span>
              );
            })}
          </div>
          <button
            className={`debuff-manage-button ${debuffsOpen ? "open" : ""}`}
            type="button"
            onClick={() => setDebuffsOpen((current) => !current)}
            aria-expanded={debuffsOpen}
          >
            {debuffsOpen ? "Hide" : "Manage"}
          </button>
        </div>

        {debuffsOpen && (
          <div className="compact-debuff-drawer">
            {trackers.map(({ id, tracker }) => {
              const label = getStatusTrackerLabel(id, tracker);
              const value = typeof tracker.max === "number" ? `${tracker.current}/${tracker.max}` : `${tracker.current}`;
              return (
                <div className="compact-debuff-control-row" key={id}>
                  <div>
                    <span className="stat-label">{label}</span>
                    <strong>{value}</strong>
                  </div>
                  <div className="compact-debuff-controls">
                    <button type="button" onClick={() => handleAdjustStatusTracker(id, -1)}>
                      âˆ’
                    </button>
                    <button type="button" onClick={() => handleAdjustStatusTracker(id, 1)}>
                      +
                    </button>
                    <button type="button" onClick={() => handleResetStatusTracker(id)}>
                      Clear {label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function createReadiedMessage(action: ActorAction, costs: ActionCost[], readiedKey: string) {
    const actionLabel = getActionLogLabel(action);
    const swappedCost = costs.find((cost) => {
      const currentKey = actionState[cost];
      return currentKey && currentKey !== readiedKey;
    });

    if (swappedCost) {
      const previousLabel = getReadiedLabel(actionState[swappedCost]);
      return `${actor.name} swapped readied ${actionCostLabels[swappedCost]}: ${previousLabel} â†’ ${actionLabel}.`;
    }

    return `${actor.name} has readied ${actionLabel} [${formatCosts(costs)}].`;
  }

  function isAlreadyReadiedForCosts(costs: ActionCost[], readiedKey: string) {
    return costs.length > 0 && costs.every((cost) => actionState[cost] === readiedKey);
  }

  function unreadiesKey(readiedKey: string) {
    return (Object.keys(actionState) as ActionCost[]).some((cost) => actionState[cost] === readiedKey);
  }

  function createUtilityActionMessage(action: ActorAction, tabId: TabId) {
    if (action.logMessage) {
      return action.logMessage;
    }

    if (action.actionKind === "resource" || tabId === "resources") {
      return `${actor.name} tracks ${action.label}.`;
    }

    if (action.actionKind === "utility" || tabId === "outOfCombat") {
      return `${actor.name} checks out-of-combat utility: ${action.label}.`;
    }

    if (action.actionKind === "feature" || tabId === "features") {
      return `${actor.name} reviews feature/passive: ${action.label}.`;
    }

    if (action.actionKind === "equipment" || tabId === "equipment") {
      return action.hasDefinedUse
        ? `${actor.name} uses equipment: ${action.label}.`
        : `${actor.name} reviews equipment: ${action.label}.`;
    }

    if (action.actionKind === "check" || tabId === "checks") {
      return `${actor.name} checks ${action.label}.`;
    }

    return `${actor.name} notes ${action.label} from ${tabLabels[tabId]}.`;
  }

  function handleUseAction(input: { action: ActorAction; tabId: TabId; costs: ActionCost[] }) {
    const { action, tabId, costs } = input;
    const readiedKey = makeReadiedKey(tabId, action.id);

    // Off-turn gate: block main/bonus/bond actions when it is not this actor's turn during combat.
    // Reactions (cost "reaction") are always allowed — they fire on other turns by design.
    if (!isActiveTurn) {
      const isReactionOnly = costs.length > 0 && costs.every(c => c === "reaction");
      const isPinnedReaction = action.pinReaction === true;
      if (!isReactionOnly && !isPinnedReaction) {
        onLog({
          actorName: actor.name,
          actionName: "Off Turn",
          tabId: "system",
          message: `It is not ${actor.name}'s turn. Only reactions can be used.`,
        });
        return;
      }
    }

    if (action.id === "rage" || action.label.toLowerCase() === "rage") {
      handleUseRage();
      return;
    }

    if (action.logMode === "silent") {
      return;
    }

    if (isResolvedReadiedKey(readiedKey)) {
      return;
    }

    if (costs.length > 0 && hasUsedCostSlot(costs)) {
      return;
    }

    const pendingConcentrationKey = concentration
      ? makeReadiedKey(concentration.sourceTabId, concentration.actionId)
      : null;
    const concentrationWouldBeSuperseded = Boolean(
      pendingConcentrationKey &&
        costs.some((cost) => actionState[cost] === pendingConcentrationKey) &&
        pendingConcentrationKey !== readiedKey
    );
    if (costs.length > 0) {
      if (committedRoll && committedRoll.readiedKey !== readiedKey) {
        onLog({
          actorName: actor.name,
          actionName: "Committed Roll Locked",
          tabId: "system",
          message: `${actor.name} has a committed roll for ${committedRoll.actionLabel}. Resolve or reset that roll before swapping readied actions.`,
        });
        return;
      }

      if (isAlreadyReadiedForCosts(costs, readiedKey)) {
        return;
      }

      if (action.concentration) {
        onSetConcentration({ actionId: action.id, actionLabel: action.label, sourceTabId: tabId, active: false });
      } else if (concentrationWouldBeSuperseded) {
        onClearConcentration();
      }

      const message = action.logMessage ?? createReadiedMessage(action, costs, readiedKey);
      onReadyActionCosts(costs, readiedKey);
      onLog({
        actorName: actor.name,
        actionName: action.label,
        tabId,
        actionCosts: costs,
        pendingKey: makePendingLogKey(actor.id, readiedKey),
        supersedePendingKeys: getSupersededPendingLogKeys(costs, readiedKey),
        message,
      });
      return;
    }

    onLog({
      actorName: actor.name,
      actionName: action.label,
      tabId,
      actionCosts: costs,
      tone: action.logMode === "table-note" || costs.length === 0 ? "table-note" : "combat",
      message: createUtilityActionMessage(action, tabId),
    });
  }

  function handleUnreadyAction(input: { action: ActorAction; tabId: TabId; costs: ActionCost[] }) {
    const { action, tabId } = input;
    const readiedKey = makeReadiedKey(tabId, action.id);

    if (!unreadiesKey(readiedKey)) {
      return;
    }

    // If a committed roll exists for this key, clear it first — no blocking guard,
    // unready always wins. Roll window closes atomically with the unready.
    if (committedRoll?.readiedKey === readiedKey) {
      onClearCommittedRoll();
    }

    if (concentration && concentration.actionId === action.id && concentration.sourceTabId === tabId) {
      onClearConcentration();
    }

    onUnreadyAction(readiedKey);
    onRemovePendingLogEntries([makePendingLogKey(actor.id, readiedKey)]);
  }

  function handleUseReaction(reaction: PinnedReaction) {
    const costs: ActionCost[] = ["reaction"];
    const readiedKey = makeReadiedKey("pinned", reaction.id);

    if (hasUsedCostSlot(costs)) {
      return;
    }

    if (committedRoll && committedRoll.readiedKey !== readiedKey) {
      onLog({
        actorName: actor.name,
        actionName: "Committed Roll Locked",
        tabId: "system",
        message: `${actor.name} has a committed roll for ${committedRoll.actionLabel}. Resolve or reset that roll before swapping readied reactions.`,
      });
      return;
    }

    if (isAlreadyReadiedForCosts(costs, readiedKey)) {
      return;
    }

    const message = reaction.logMessage ?? createReadiedMessage({ id: reaction.id, label: reaction.label }, costs, readiedKey);

    onReadyActionCosts(costs, readiedKey);
    onLog({
      actorName: actor.name,
      actionName: reaction.label,
      tabId: "pinned",
      actionCosts: costs,
      pendingKey: makePendingLogKey(actor.id, readiedKey),
      supersedePendingKeys: getSupersededPendingLogKeys(costs, readiedKey),
      message,
    });
  }

  function handleUnreadyReaction(reaction: PinnedReaction) {
    const readiedKey = makeReadiedKey("pinned", reaction.id);

    if (!unreadiesKey(readiedKey)) {
      return;
    }

    if (committedRoll?.readiedKey === readiedKey) {
      onLog({
        actorName: actor.name,
        actionName: "Committed Roll Locked",
        tabId: "system",
        message: `${actor.name} has a committed roll for ${committedRoll.actionLabel}. Reset the roll before unreadying it.`,
      });
      return;
    }

    onUnreadyAction(readiedKey);
    onRemovePendingLogEntries([makePendingLogKey(actor.id, readiedKey)]);
  }

  async function completeTriggeredCandidate(candidate: ReadiedRollCandidate, entry: { action: ActorAction; sourceTabId: TabId | "pinned" }) {
    const rollFormula = entry.action.metadata?.damage ?? entry.action.metadata?.additive ?? entry.action.metadata?.attack;
    const normalizedFormula = rollFormula && hasRollableFormula(rollFormula) ? combineRollFormulas([rollFormula]) : "";

    if (normalizedFormula) {
      const request: DiceBridgeRollRequest = {
        protocol: "forever-dm-combat.roll.request.v1",
        requestId: createDiceRequestId("fdm-trigger", entry.action.id),
        source: "Forever DM Combat",
        actorId: actor.id,
        actorName: actor.name,
        actionId: entry.action.id,
        actionName: candidate.actionLabel,
        formula: normalizedFormula,
        outcomeMode: "triggered",
        sentAt: new Date().toISOString(),
      };

      const sent = await onSendDicePlusRequest(request);

      onLog({
        actorName: actor.name,
        actionName: sent ? "Dice+" : "Manual Roll",
        tabId: "system",
        message: sent
          ? `${actor.name} sent ${candidate.actionLabel} (${normalizedFormula}) to Dice+.`
          : `${actor.name} should roll ${candidate.actionLabel} manually: ${normalizedFormula}.`,
      });
    }

    markReadiedKeyResolved(candidate.readiedKey);
    markCostSlotsUsed(candidate.costs);
    consumeReadiedBondWithResolvedAction(candidate.readiedKey);
    onUnreadyAction(candidate.readiedKey);
    onRemovePendingLogEntries([makePendingLogKey(actor.id, candidate.readiedKey)]);

    if (concentration && concentration.actionId === entry.action.id && concentration.sourceTabId === entry.sourceTabId) {
      onSetConcentration({ ...concentration, active: true });
    }

    onLog({
      actorName: actor.name,
      actionName: "Triggered",
      tabId: "system",
      message: `${actor.name} triggers ${candidate.actionLabel}. Marked used until reset.`,
    });
  }

  function applyPendingRageForCommittedAction(candidate: ReadiedRollCandidate, action: ActorAction) {
    const counter = sessionCounters.rage;
    const hasPendingRage = armedEffects.some((effect) => effect.id === "rage-pending");

    if (!counter || !hasPendingRage || counter.current <= 0 || !isEligibleRageAction(action, candidate)) {
      return;
    }

    const nextValue = counter.current - 1;
    const readiedBond = getReadiedBondEffect();
    const pairedText = readiedBond ? ` + ${readiedBond.label.replace(/\s*\([^)]*\)/g, "")}` : "";

    setSessionCounter("rage", (current) => ({ ...current, current: nextValue, active: true }));
    clearArmedEffect("rage-pending");
    upsertArmedEffect({
      id: "rage-active",
      label: "Rage active (+2)",
      details: "+2 damage to eligible Strength melee attacks. Included in the next eligible damage roll.",
      source: "Rage",
      formula: "+2",
    });

    onLog({
      actorName: actor.name,
      actionName: "Rage Active",
      tabId: "system",
      message: `${actor.name} is raging and uses ${candidate.actionLabel}${pairedText}. Rage ${counter.current}/${counter.max} â†’ ${nextValue}/${counter.max}.`,
    });
  }

  function createAutoBridgeRequestId(actionId: string) {
    return createDiceRequestId("fdm", actionId);
  }

  function handlePrimeRoll(candidate: ReadiedRollCandidate) {
    const entry = getActionForReadiedKey(candidate.readiedKey);

    if (!entry) {
      return;
    }

    const _derivedForPrime = deriveActorStats(actor, undefined, status);
    const resolvePrimeFormula = (f?: string) => f ? resolveFormulaVars(normalizeFirstRollFormula(f) ?? f, actor, _derivedForPrime, status) : f;

    const resolvedCandidate: ReadiedRollCandidate = {
      ...candidate,
      attackFormula: resolvePrimeFormula(candidate.attackFormula ?? entry.action.metadata?.attack),
      saveDc: resolvePrimeFormula(candidate.saveDc ?? entry.action.metadata?.saveDc),
      damageFormula: resolvePrimeFormula(candidate.damageFormula ?? entry.action.metadata?.damage),
      critDamageFormula: resolvePrimeFormula(candidate.critDamageFormula ?? entry.action.metadata?.crit),
      critThreshold: candidate.critThreshold ?? entry.action.metadata?.critThreshold,
    };

    if (resolvedCandidate.outcomeMode === "triggered") {
      return;
    }

    if (committedRoll && committedRoll.readiedKey !== resolvedCandidate.readiedKey) {
      onLog({
        actorName: actor.name,
        actionName: "Committed Roll Locked",
        tabId: "system",
        message: `${actor.name} has a committed roll for ${committedRoll.actionLabel}. Resolve or reset that roll before priming another action.`,
      });
      return;
    }

    const bridgeRequestId = createAutoBridgeRequestId(entry.action.id);
    applyPendingRageForCommittedAction(resolvedCandidate, entry.action);
    onRemovePendingLogEntries([makePendingLogKey(actor.id, resolvedCandidate.readiedKey)]);

    onStartCommittedRoll({
      readiedKey: resolvedCandidate.readiedKey,
      actionId: entry.action.id,
      actionLabel: resolvedCandidate.actionLabel,
      sourceTabId: entry.sourceTabId,
      costs: resolvedCandidate.costs,
      outcomeMode: resolvedCandidate.outcomeMode,
      attackFormula: resolvedCandidate.attackFormula,
      saveDc: resolvedCandidate.saveDc,
      damageFormula: resolvedCandidate.damageFormula,
      critDamageFormula: resolvedCandidate.critDamageFormula,
      critThreshold: resolvedCandidate.critThreshold,
      bridgeRequestId,
      rulesProfile,
    });

    onLog({
      actorName: actor.name,
      actionName: "Roll Workspace Primed",
      tabId: "system",
      message: `${actor.name} primes ${resolvedCandidate.actionLabel}. Use the roll workspace, Dev Test Roll injector, or manual result entry to continue.`,
    });
  }

  async function handleCommitRoll(candidate: ReadiedRollCandidate) {
    const entry = getActionForReadiedKey(candidate.readiedKey);

    if (!entry) {
      return;
    }

    // Resolve @VARIABLE tokens using current derived stats (includes equipment + drain)
    const _derivedForRoll = deriveActorStats(actor, undefined, status);
    const resolveFormula = (f?: string) => f ? resolveFormulaVars(normalizeFirstRollFormula(f) ?? f, actor, _derivedForRoll, status) : f;

    const resolvedCandidate: ReadiedRollCandidate = {
      ...candidate,
      attackFormula: resolveFormula(candidate.attackFormula ?? entry.action.metadata?.attack),
      saveDc: resolveFormula(candidate.saveDc ?? entry.action.metadata?.saveDc),
      damageFormula: resolveFormula(candidate.damageFormula ?? entry.action.metadata?.damage),
      critDamageFormula: resolveFormula(candidate.critDamageFormula ?? entry.action.metadata?.crit),
      critThreshold: candidate.critThreshold ?? entry.action.metadata?.critThreshold,
    };

    if (resolvedCandidate.outcomeMode === "triggered") {
      await completeTriggeredCandidate(resolvedCandidate, entry);
      return;
    }

    const bridgeRequestId = createAutoBridgeRequestId(entry.action.id);
    applyPendingRageForCommittedAction(resolvedCandidate, entry.action);

    // Once the roll is committed, the pre-roll/readied log entry should leave
    // the shared table log. The committed roll/result entries are the table truth.
    onRemovePendingLogEntries([makePendingLogKey(actor.id, resolvedCandidate.readiedKey)]);

    onStartCommittedRoll({
      readiedKey: resolvedCandidate.readiedKey,
      actionId: entry.action.id,
      actionLabel: resolvedCandidate.actionLabel,
      sourceTabId: entry.sourceTabId,
      costs: resolvedCandidate.costs,
      outcomeMode: resolvedCandidate.outcomeMode,
      attackFormula: resolvedCandidate.attackFormula,
      saveDc: resolvedCandidate.saveDc,
      damageFormula: resolvedCandidate.damageFormula,
      critDamageFormula: resolvedCandidate.critDamageFormula,
      critThreshold: resolvedCandidate.critThreshold,
      bridgeRequestId,
      rulesProfile,
    });

    const canSendRollToDicePlus =
      (resolvedCandidate.outcomeMode === "attack-roll" || resolvedCandidate.outcomeMode === "ability-check") &&
      Boolean(resolvedCandidate.attackFormula?.trim());

    if (resolvedCandidate.outcomeMode === "dc-check") {
      onLog({
        actorName: actor.name,
        actionName: "Check",
        tabId: "system",
        message: `${actor.name} checks ${resolvedCandidate.actionLabel}${resolvedCandidate.saveDc ? ` (${resolvedCandidate.saveDc})` : ""}. Choose Applies or No Effect from the roll workspace.`,
      });
    }

    if (!canSendRollToDicePlus) {
      if (resolvedCandidate.outcomeMode !== "dc-check") {
        onLog({
          actorName: actor.name,
          actionName: "Manual Roll",
          tabId: "system",
          message: `${actor.name} readied ${resolvedCandidate.actionLabel}. Use manual roll entry if no dice formula is available.`,
        });
      }
      return;
    }

    const request: DiceBridgeRollRequest = {
      protocol: "forever-dm-combat.roll.request.v1",
      requestId: bridgeRequestId,
      source: "Forever DM Combat",
      actorId: actor.id,
      actorName: actor.name,
      actionId: entry.action.id,
      actionName: resolvedCandidate.actionLabel,
      formula: labeledDiceFormula(resolvedCandidate.attackFormula?.trim() || "1d20", firstRollDiceLabel(entry.action, resolvedCandidate.actionLabel)),
      outcomeMode: resolvedCandidate.outcomeMode,
      critThreshold: resolvedCandidate.outcomeMode === "attack-roll" ? resolvedCandidate.critThreshold : undefined,
      sentAt: new Date().toISOString(),
    };

    const sent = await onSendDicePlusRequest(request);

    if (!sent) {
      onLog({
        actorName: actor.name,
        actionName: "Manual Roll",
        tabId: "system",
        message: `${actor.name} has no dice extension response for ${resolvedCandidate.actionLabel}. Use manual roll entry.`,
      });
      return;
    }

    onMarkCommittedRollBridgeSent();
  }

  function buildDiceBridgeRequest() {
    if (!committedRoll) {
      return null;
    }

    return {
      protocol: "forever-dm-combat.roll.request.v1" as const,
      requestId: committedRoll.bridgeRequestId,
      source: "Forever DM Combat" as const,
      actorId: actor.id,
      actorName: actor.name,
      actionId: committedRoll.actionId,
      actionName: committedRoll.actionLabel,
      formula: labeledDiceFormula(committedRoll.attackFormula?.trim() || "1d20", firstRollDiceLabel(getActionForReadiedKey(committedRoll.readiedKey)?.action, committedRoll.actionLabel)),
      outcomeMode: committedRoll.outcomeMode,
      critThreshold: committedRoll.critThreshold,
      sentAt: new Date().toISOString(),
    };
  }

  async function handleSendDiceBridgeRequest() {
    const request = buildDiceBridgeRequest();

    if (!committedRoll || !request) {
      return;
    }

    const sent = await onSendDiceBridgeRequest(request);

    if (!sent) {
      onLog({
        actorName: actor.name,
        actionName: "Dice Bridge",
        tabId: "system",
        message: `${actor.name} tried to send ${committedRoll.actionLabel} to the generic dice bridge, but the Owlbear bridge was not ready.`,
      });
      return;
    }

    onMarkCommittedRollBridgeSent();
    onLog({
      actorName: actor.name,
      actionName: "Dice Bridge",
      tabId: "system",
      message: `${actor.name} sent ${committedRoll.actionLabel} (${request.formula}) to the generic Owlbear dice bridge.`,
    });
  }

  async function handleSendDicePlusRequest() {
    const request = buildDiceBridgeRequest();

    if (!committedRoll || !request) {
      return;
    }

    const sent = await onSendDicePlusRequest(request);

    if (!sent) {
      onLog({
        actorName: actor.name,
        actionName: "Dice+",
        tabId: "system",
        message: `${actor.name} tried to send ${committedRoll.actionLabel} to Dice+, but Dice+ was not ready or did not respond.`,
      });
      return;
    }

    onMarkCommittedRollBridgeSent();
  }

  function formatCommittedRollTableResult() {
    if (!committedRoll?.rollResult) {
      return "";
    }

    return ` Result ${committedRoll.rollResult}.`;
  }

  function criticalFailureLogLine() {
    if (!committedRoll) {
      return "";
    }

    const naturalText = typeof committedRoll.naturalRoll === "number" ? `Nat ${committedRoll.naturalRoll}` : "Natural 1";
    const resultText = formatCommittedRollTableResult();

    return `${actor.name} rolled ${naturalText} â€” simple miss for ${committedRoll.actionLabel}.${resultText} No critical-failure chart used tonight. Marked used until reset.`;
  }

  function handleHoldCommittedRollResult(result: string) {
    const trimmedResult = result.trim();

    if (!committedRoll || !trimmedResult) {
      return;
    }

    onSetCommittedRollResult(trimmedResult);
    onLog({
      actorName: actor.name,
      actionName: "Roll Result Held",
      tabId: "system",
      message: committedRoll.isCriticalFailure
        ? `${actor.name} holds ${committedRoll.actionLabel} roll: ${trimmedResult} â€” Nat 1 will resolve as simple miss tonight.`
        : `${actor.name} holds roll result for ${committedRoll.actionLabel}: ${trimmedResult}.`,
    });
  }

  function completeCommittedRoll(message: string, actionName = "Used") {
    if (!committedRoll) {
      return;
    }

    markReadiedKeyResolved(committedRoll.readiedKey);
    const attackUse = isMultiAttackCandidate(committedRoll) ? recordAttackUse(committedRoll) : null;
    const costsToMarkUsed = attackUse && !attackUse.slotComplete
      ? committedRoll.costs.filter((cost) => cost !== "main")
      : committedRoll.costs;

    markCostSlotsUsed(costsToMarkUsed);
    consumeReadiedBondWithResolvedAction(committedRoll.readiedKey);
    onUnreadyAction(committedRoll.readiedKey);
    if (costsToMarkUsed.length > 0) {
      onReadyActionCosts(costsToMarkUsed, makeUsedActionStateValue(committedRoll.readiedKey));
    }
    onRemovePendingLogEntries([makePendingLogKey(actor.id, committedRoll.readiedKey)]);

    if (concentration && concentration.actionId === committedRoll.actionId && concentration.sourceTabId === committedRoll.sourceTabId) {
      onSetConcentration({ ...concentration, active: true });
    }

    onClearCommittedRoll();
    const attackUseText = attackUse && attackUse.max > 1
      ? attackUse.slotComplete
        ? ` Attack ${attackUse.current}/${attackUse.max}; Main slot is now used.`
        : ` Attack ${attackUse.current}/${attackUse.max}; Main slot remains available.`
      : "";

    onLog({
      actorName: actor.name,
      actionName,
      tabId: "system",
      message: `${message}${attackUseText}`,
    });
  }

  function handleChooseCommittedRollOutcome(outcome: CommittedRollOutcome) {
    if (!committedRoll || (committedRoll.requiresRollResult && !committedRoll.rollResult)) {
      return;
    }

    const resultText = formatCommittedRollTableResult();
    const isDcCheck = committedRoll.outcomeMode === "dc-check";
    const isAbilityCheck = committedRoll.outcomeMode === "ability-check";

    if (outcome === "reroll") {
      if (!committedRoll.requiresRollResult) {
        return;
      }

      onChooseCommittedRollOutcome(outcome);
      onLog({
        actorName: actor.name,
        actionName: "Reroll",
        tabId: "system",
        message: `${actor.name} requests a reroll for ${committedRoll.actionLabel}. Previous result ${committedRoll.rollResult} cleared.`,
      });
      return;
    }

    if (outcome === "miss") {
      if (committedRoll.outcomeMode === "attack-roll" && committedRoll.isCrit && committedRoll.rulesProfile.naturalAttack20AutoHits) {
        onLog({
          actorName: actor.name,
          actionName: "Rules Gate",
          tabId: "system",
          message: `${actor.name}'s ${committedRoll.actionLabel} is a natural critical hit under ${committedRoll.rulesProfile.label}. Miss is not available for this rules profile.`,
        });
        return;
      }

      if (committedRoll.outcomeMode === "attack-roll") {
        setClassOptionContext({
          kind: "attack-miss",
          actionId: committedRoll.actionId,
          actionLabel: committedRoll.actionLabel,
          sourceTabId: committedRoll.sourceTabId,
        });
      }

      if (isAbilityCheck) {
        const abilityEntry = (Object.entries(abilityLabels) as Array<[AbilityId, string]>).find(([, label]) =>
          committedRoll.actionLabel.startsWith(label)
        );

        if (abilityEntry) {
          setClassOptionContext({
            kind: "abs-fail",
            ability: abilityEntry[0],
            rollType: committedRoll.actionLabel.includes("Save") ? "save" : "check",
            actionLabel: committedRoll.actionLabel,
          });
        }
      }

      completeCommittedRoll(
        isAbilityCheck
          ? `${actor.name} marks ${committedRoll.actionLabel} as failed.${resultText} Marked used until reset.`
          : isDcCheck
            ? `${actor.name} marks no effect for ${committedRoll.actionLabel}. Marked used until reset.`
            : committedRoll.isCriticalFailure
              ? criticalFailureLogLine()
              : `${actor.name} misses with ${committedRoll.actionLabel}.${resultText} Marked used until reset.`,
        isAbilityCheck ? "Fail" : isDcCheck ? "No Effect" : committedRoll.isCriticalFailure ? "Nat 1 Miss" : "Miss"
      );
      return;
    }

    if (!committedRoll.hasDamageChoice) {
      if (isAbilityCheck) {
        clearClassOptionContext();
      }

      completeCommittedRoll(
        isAbilityCheck
          ? `${actor.name} marks ${committedRoll.actionLabel} as passed.${resultText} Marked used until reset.`
          : isDcCheck
            ? `${actor.name} marks ${committedRoll.actionLabel} as applied. Marked used until reset.`
            : `${actor.name} confirms Hit for ${committedRoll.actionLabel}.${resultText} Marked used until reset.`,
        isAbilityCheck ? "Pass" : isDcCheck ? "Applies" : "Hit"
      );
      return;
    }

    onChooseCommittedRollOutcome(outcome);
    onLog({
      actorName: actor.name,
      actionName: isDcCheck ? "Applies" : "Hit",
      tabId: "system",
      message: isAbilityCheck
        ? `${actor.name} marks ${committedRoll.actionLabel} as passed.${resultText}`
        : isDcCheck
          ? `${actor.name} marks ${committedRoll.actionLabel} as applied. Choose Damage / Effect if needed.`
          : `${actor.name} confirms Hit for ${committedRoll.actionLabel}.${resultText} Choose Damage${committedRoll.hasCritDamageChoice ? " or Crit Damage" : ""}.`,
    });
  }


  function getDamageAdditives(damageChoice: CommittedRollDamageChoice = "damage") {
    const entry = committedRoll ? getActionForReadiedKey(committedRoll.readiedKey) : null;
    const isCritDamage = damageChoice === "crit";

    return getVisibleArmedEffects()
      .filter((effect) => {
        if (!effect.formula?.trim() || !hasRollableFormula(effect.formula)) {
          return false;
        }

        if ((effect.id === "rage-active" || effect.id === "rage-pending") && !isEligibleRageAction(entry?.action ?? null, committedRoll)) {
          return false;
        }

        return true;
      })
      .map((effect) => {
        const baseFormula = normalizeRollFormula(effect.formula as string);
        const formula = formatAdditiveFormulaForDamage(effect.formula as string, isCritDamage);

        return {
          id: effect.id,
          label: effect.label,
          shorthand: additiveShorthandForEffect(effect),
          baseFormula,
          formula,
          critAdjusted: isCritDamage && Boolean(baseFormula) && formula !== baseFormula,
          persistent: isPersistentDamageAdditive(effect),
        };
      });
  }

  function consumeResolvedDamageAdditives(damageChoice: CommittedRollDamageChoice) {
    const consumed = getDamageAdditives(damageChoice)
      .filter((effect) => !effect.persistent && !effect.id.startsWith("bond:"));

    consumed.forEach((effect) => clearArmedEffect(effect.id));
  }

  async function sendDamageRollToDicePlus(label: string, baseFormula: string | undefined, damageChoice: CommittedRollDamageChoice) {
    const entry = committedRoll ? getActionForReadiedKey(committedRoll.readiedKey) : null;

    if (!committedRoll || !baseFormula?.trim()) {
      return;
    }

    const additiveParts = getDamageAdditives(damageChoice);
    const additiveFormulas = additiveParts.map((effect) => effect.formula);
    const combinedFormula = combineRollFormulas([baseFormula, ...additiveFormulas]);

    if (!combinedFormula) {
      return;
    }

    const additiveText = additiveParts.length > 0 ? ` with additives (${additiveParts.map((effect) => `${effect.shorthand}=${effect.critAdjusted ? `${effect.baseFormula}â†’${effect.formula}` : effect.formula}`).join(" + ")})` : "";
    const rageIsAttached = Boolean(
      committedRoll &&
      getVisibleArmedEffects().some((effect) => effect.id === "rage-active" || effect.id === "rage-pending") &&
      isEligibleRageAction(entry?.action ?? null, committedRoll)
    );
    const displayAdditiveParts = rageIsAttached && !additiveParts.some((effect) => effect.shorthand === "R")
      ? [...additiveParts, { id: "rage-display", label: "Rage", shorthand: "R", baseFormula: "+2", formula: "+2", critAdjusted: false, persistent: true }]
      : additiveParts;
    const additiveLabel = formatAdditiveShorthand(displayAdditiveParts);
    const isCritDamage = label.toLowerCase().includes("crit");
    const actionLabelWithAdditives = `${committedRoll.actionLabel}${additiveLabel}`;
    const displayLabel = formatDamageRollLabel(actionLabelWithAdditives, label, isCritDamage, committedRoll.critThreshold);

    // BUILD 0.5.3.1.3: Bond additives are valid damage add-ons, but Dice+ can fail when
    // the outgoing damage formula is label-suffixed with the Bond shorthand. Keep the
    // roll formula clean whenever Bond is attached; the FDMC log still records B/R/RD details.
    const hasBondAdditive = additiveParts.some((effect) => effect.shorthand === "B" || effect.id.startsWith("bond:"));
    const diceFormula = additiveLabel && !hasBondAdditive
      ? labeledDiceFormula(combinedFormula, actionLabelWithAdditives)
      : combinedFormula;
    const request: DiceBridgeRollRequest = {
      protocol: "forever-dm-combat.roll.request.v1",
      requestId: createDiceRequestId("fdm-dmg", committedRoll.actionId),
      source: "Forever DM Combat",
      actorId: actor.id,
      actorName: actor.name,
      actionId: committedRoll.actionId,
      actionName: displayLabel,
      formula: diceFormula,
      outcomeMode: "triggered",
      sentAt: new Date().toISOString(),
    };

    const sent = await onSendDicePlusRequest(request);

    if (sent) {
      onLog({
        actorName: actor.name,
        actionName: "Dice+ Damage",
        tabId: "system",
        message: `${actor.name} sent ${label} for ${committedRoll.actionLabel} (${combinedFormula}) to Dice+${additiveText}.`,
      });
      return;
    }

    onLog({
      actorName: actor.name,
      actionName: "Manual Damage Roll",
      tabId: "system",
      message: `${actor.name} should roll ${label} for ${committedRoll.actionLabel} manually: ${combinedFormula}${additiveText}.`,
    });
  }

  async function handleChooseCommittedRollDamage(damageChoice: CommittedRollDamageChoice) {
    if (!committedRoll) {
      return;
    }

    if (damageChoice === "crit" && !committedRoll.hasCritDamageChoice) {
      return;
    }

    if (damageChoice === "damage" && !committedRoll.hasDamageChoice) {
      return;
    }

    const formula = damageChoice === "crit" ? committedRoll.critDamageFormula : committedRoll.damageFormula;
    const label = damageChoice === "crit" ? "Crit Damage" : committedRoll.outcomeMode === "dc-check" ? "Damage / Effect" : "Damage";
    const resultLabel = damageChoice === "crit" ? `CRIT! ${formatCritThresholdLabel(committedRoll.critThreshold)} Damage` : label;

    await sendDamageRollToDicePlus(label, formula, damageChoice);
    consumeResolvedDamageAdditives(damageChoice);

    completeCommittedRoll(
      `${actor.name} selects ${resultLabel} for ${committedRoll.actionLabel}${formula ? ` (${formula})` : ""}. Marked used until reset.`,
      resultLabel
    );
  }

  function handleResolveCommittedRoll() {
    if (!committedRoll) {
      return;
    }

    completeCommittedRoll(
      `${actor.name} marks ${committedRoll.actionLabel} used. Committed roll and readied state cleared.`,
      "Used"
    );
  }

  function handleResetCommittedRoll() {
    if (!committedRoll) {
      return;
    }

    onClearCommittedRoll();
    onLog({
      actorName: actor.name,
      actionName: "Reset Roll",
      tabId: "system",
      message: `${actor.name} resets the committed roll for ${committedRoll.actionLabel}. Readied state remains pending.`,
    });
  }

  function handleNextAttack() {
    onLog({
      actorName: actor.name,
      actionName: "Next Attack",
      tabId: "system",
      message: `${actor.name} - Attack ${(attackUseState?.current ?? 0) + 1} of ${attackUseState?.max ?? 1} ready. Click the attack action to roll.`,
    });
  }

  return (
    <article className={`actor-card ${hpStatus}`}>
      <header className="actor-card-header selected-actor-header">
        <div className="actor-title-row compact-detail-title">
          <div className="actor-title-copy">
            <p className="eyebrow">{actor.kind === "companion" ? "Companion Card" : "Selected Actor"}</p>
            <h2>{actor.name}</h2>
            <p className="actor-subtitle">
              {actor.className ? `${actor.className} · Level ${levelDisplay}` : actor.subtitle}
            </p>
            {isCompanionCard && (
              <div className="companion-equipment-slot">
                <p className="eyebrow">Equipment Slot</p>
                <span>{actor.equipmentSlot ?? "Empty"}</span>
              </div>
            )}
          </div>
          <div className="actor-header-tools">
            {/* P9: initiative roll button removed — roll from combat tracker 🎲 button instead */}
            {initiativeState?.result && (
              <span className={`initiative-result-pill ${initiativeState.status}`}>
                Init {initiativeState.result}
              </span>
            )}
            {!isPlayerMode && <span className="actor-kind-pill">{titleCaseKind(actor.kind)}</span>}
          </div>
        </div>

        <div className="selected-defense-row">
          <HitPointBadge
            hp={hp}
            onDamageAmount={damageAmount}
            onHealAmount={healAmount}
            onTempHpGain={gainTempHp}
            onTempHpLoss={loseTempHp}
            onResetTempHp={resetTempHp}
            onSetZero={setZero}
            onResetHp={resetHp}
            controlsSlot={renderAbsCheckPanel()}
          />
          <div className="stat-box compact-defense-box ac-speed-box">
            <div>
              <span className="stat-label">AC</span>
              {(() => {
                const _ds = deriveActorStats(actor, undefined, status);
                return (
                  <span
                    className="stat-value"
                    title={_ds.ac !== _ds.acBase ? `Base: ${_ds.acBase} · Modified by: ${_ds.acModifiedBy.join(", ")}` : undefined}
                    style={_ds.ac !== _ds.acBase ? { color: "#7b68ee" } : undefined}
                  >
                    {_ds.ac !== _ds.acBase ? `${_ds.ac}(${_ds.acBase})` : _ds.ac}
                  </span>
                );
              })()}
            </div>
            <div className="speed-subrow">
              <span className="stat-label">Speed</span>
              <span className="stat-value speed-value">{formatMovementSpeed(actor.stats.speed)}</span>
            </div>
          </div>
        </div>

        <AbilityScoreRow abilityScores={actor.abilityScores} derivedStats={deriveActorStats(actor, undefined, status)} />
        {renderCompactDebuffSummary()}
        {renderAttackUsePanel()}
      </header>

      {renderArmedEffectsPanel()}

      {renderClassOptionsPanel()}

      <CommittedRollPanel
        committedRoll={committedRoll}
        onHoldResult={handleHoldCommittedRollResult}
        onChooseOutcome={handleChooseCommittedRollOutcome}
        onChooseDamage={handleChooseCommittedRollDamage}
        onResolve={handleResolveCommittedRoll}
        onReset={handleResetCommittedRoll}
        diceBridgeStatus={diceBridgeStatus}
        diceBridgeLastEvent={diceBridgeLastEvent}
        onSendDiceRequest={handleSendDiceBridgeRequest}
        onSendMockDiceResult={onSendMockDiceBridgeResult}
        isBuilderMode={isBuilderMode}
        canShowDevTestRoll={canShowDevTestRoll}
        canShowGenericReroll={false}
        attackUseState={attackUseState}
        onNextAttack={attackUseState && attackUseState.current < attackUseState.max ? handleNextAttack : undefined}
        rerollSources={getRerollSources(actor)}
        onRerollWithSource={async (source: RerollSource) => {
          // Fire the same roll formula again via Dice+
          if (committedRoll?.attackFormula) {
            const bridgeRequestId = createDiceRequestId("fdm-reroll", actor.id);
            const request = {
              protocol: "forever-dm-combat.roll.request.v1" as const,
              requestId: bridgeRequestId,
              source: "Forever DM Combat" as const,
              actorId: actor.id,
              actorName: actor.name,
              actionId: committedRoll.actionId,
              actionName: `${committedRoll.actionLabel} (Reroll â€” ${source.label})`,
              formula: labeledDiceFormula(committedRoll.attackFormula, `${committedRoll.actionLabel} reroll`),
              outcomeMode: committedRoll.outcomeMode,
              sentAt: new Date().toISOString(),
            };
            onLog({
              actorName: actor.name,
              actionName: "Reroll",
              tabId: "system",
              message: `${actor.name} rerolls ${committedRoll.actionLabel} using ${source.label}${source.costLabel && source.kind !== "dm" ? ` (costs ${source.costLabel})` : ""}.`,
            });
            await onSendDicePlusRequest(request).catch(() => undefined);
          }
        }}
      />
      {!isCompanionCard && <BondSummary actor={actor} actionState={actionState} />}

      <PinnedReactions
        actorName={actor.name}
        reactions={pinnedReactions}
        actionState={actionState}
        committedRoll={committedRoll}
        resolvedReadiedKeys={resolvedReadiedKeys}
        usedCostSlots={usedCostSlots}
        onUseReaction={handleUseReaction}
        onUnreadyReaction={handleUnreadyReaction}
        onCommitRoll={handleCommitRoll}
      />


      <div className="inline-state-bar above-tabs-state-bar">
        <ActionEconomyPanel
          state={actionState}
          usedCostSlots={usedCostSlots}
          concentration={concentration}
          isPlayerMode={isPlayerMode}
          onResetTurn={isPlayerMode ? onResetTurn : resetTurn}
          onClearConcentration={onClearConcentration}
        />
      </div>

      <TabBar activeTab={activeTab} visibleTabs={visibleTabs} onChangeTab={setActiveTab} />

      {activeTab === "notes" ? (
        <ActorNotesPanel
          actorName={actor.name}
          notes={actorNotes}
          onAddNote={onAddActorNote}
          onDeleteNote={onDeleteActorNote}
        />
      ) : activeTab === "status" ? (
        <div className="tab-panel">
          <StatusTrackerPanel
            status={status}
            onAdjustTracker={handleAdjustStatusTracker}
            onResetTracker={handleResetStatusTracker}
            onResetAllStatuses={handleResetAllActorStatuses}
          />
          <section className="debuff-note-section" aria-label="Active conditions">
            <p className="eyebrow">Active Conditions</p>
            <textarea
              className="debuff-note-input"
              value={debuffNote}
              onChange={(event) => setDebuffNote(event.target.value)}
              placeholder="Poisoned, Prone, Rattled, STR drained -4..."
              rows={2}
              aria-label="Write active conditions or debuffs"
            />
          </section>
        </div>
      ) : activeTab === "features" ? (
        <>
          <section className="feature-tracker-strip embedded-feature-strip" aria-label="Features and resources snapshot">
            <ClassFeatureTrackerBox tracker={actor.classFeatureTracker} />
          </section>
          {renderSessionCounterPanel()}
          <TabPanel
            actorName={actor.name}
            activeTab={activeTab}
            actions={activeActions}
            actionState={actionState}
            concentration={concentration}
            committedRoll={committedRoll}
            resolvedReadiedKeys={resolvedReadiedKeys}
            usedCostSlots={usedCostSlots}
            onUseAction={handleUseAction}
            onUnreadyAction={handleUnreadyAction}
            onCommitRoll={handleCommitRoll}
            onPrimeRoll={handlePrimeRoll}
            onResetCommittedRoll={committedRoll && !isPlayerMode ? handleResetCommittedRoll : undefined}
          />
        </>
      ) : activeTab === "resources" ? (
        <>
          {/* Rest buttons */}
          {(onShortRest || onLongRest) && (
            <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderBottom: "1px solid #2a2a3e" }}>
              {onShortRest && (
                <button type="button" onClick={onShortRest}
                  style={{ flex: 1, padding: "5px 0", fontSize: 11, background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer" }}
                  title="Short Rest — resets pact slots, toggles, and short-rest pools">
                  ☕ Short Rest
                </button>
              )}
              {onLongRest && (
                <button type="button" onClick={onLongRest}
                  style={{ flex: 1, padding: "5px 0", fontSize: 11, background: "#1a2a1a", border: "1px solid #2a6e2a44", borderRadius: 4, color: "#4caf50", cursor: "pointer" }}
                  title="Long Rest — resets all resources except manual counters">
                  🌙 Long Rest
                </button>
              )}
            </div>
          )}
          {/* Resource counter display */}
          {activeActions.length > 0 && resourceCounters && (
            <div style={{ padding: "8px 12px" }}>
              {activeActions.map(action => {
                const max = Number.parseInt(action.metadata?.additive ?? "0", 10);
                const remaining = resourceCounters[action.id] ?? max;
                const kind = action.metadata?.resourceKind ?? "pool";
                const hasCounter = max > 0;
                return (
                  <div key={action.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #1a1a2e" }}>
                    <div>
                      <span style={{ fontSize: 12, color: remaining === 0 ? "#555" : "#aaa" }}>{action.label}</span>
                      {action.metadata?.cost && (
                        <span style={{ fontSize: 10, color: "#444", marginLeft: 6 }}>{action.metadata.cost}</span>
                      )}
                      <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>({kind})</span>
                    </div>
                    {hasCounter && (
                      <span style={{ fontSize: 12, color: remaining === 0 ? "#555" : remaining <= max * 0.5 ? "#e07b39" : "#4caf50", fontVariantNumeric: "tabular-nums" }}>
                        {remaining}/{max}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Generic tab panel for any action buttons on the resource actions */}
          <TabPanel
            actorName={actor.name}
            activeTab={activeTab}
            actions={activeActions}
            actionState={actionState}
            concentration={concentration}
            committedRoll={committedRoll}
            resolvedReadiedKeys={resolvedReadiedKeys}
            usedCostSlots={usedCostSlots}
            onUseAction={handleUseAction}
            onUnreadyAction={handleUnreadyAction}
            onCommitRoll={handleCommitRoll}
            onPrimeRoll={handlePrimeRoll}
            onResetCommittedRoll={committedRoll ? handleResetCommittedRoll : undefined}
          />
        </>
      ) : (
        <TabPanel
          actorName={actor.name}
          activeTab={activeTab}
          actions={activeActions}
          actionState={actionState}
          concentration={concentration}
          committedRoll={committedRoll}
          resolvedReadiedKeys={resolvedReadiedKeys}
          usedCostSlots={usedCostSlots}
          onUseAction={handleUseAction}
          onUnreadyAction={handleUnreadyAction}
          onCommitRoll={handleCommitRoll}
          onPrimeRoll={handlePrimeRoll}
          onResetCommittedRoll={committedRoll ? handleResetCommittedRoll : undefined}
        />
      )}
    </article>
  );
}
