import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appendBonusDie, applyAdvantage, type RollMode } from "../dice/diceFormula";

const ADDITIVE_DICE = ["d4", "d6", "d8", "d10"] as const;
// Standard combat actions (5e 2024) — declared from a dropdown above the actions list,
// logged to the encounter log so the table sees what the actor did this turn.
const STANDARD_COMBAT_ACTIONS = [
  "Attack", "Magic", "Dash", "Disengage", "Dodge", "Help", "Hide", "Ready",
  "Search", "Study", "Utilize", "Influence", "Grapple", "Shove", "Improvise",
  "Two-Weapon Fighting", "Interact with an Object", "Opportunity Attack",
] as const;
const DAMAGE_ADDITIVE_DICE = ["d4", "d6", "d8", "d10", "d12"] as const;
import OBR from "@owlbear-rodeo/sdk";
import { HitPointBadge } from "../hp/HitPointBadge";
import { getHpStatus } from "../hp/hpStatus";
import type { AbilityId, Actor, DrainTracker, HitPoints, PinnedReaction } from "../types/actor";
import type { ActorConcentrationState } from "../state/useActorConcentrationState";
import { actionCostLabels, isUsedActionStateValue, makeUsedActionStateValue, type ActorActionEconomyState, type ActionCost } from "../types/actionEconomy";
import type { AddCombatLogEntryInput } from "../types/combatLog";
import type { CombatRulesProfile, CommittedRollDamageChoice, CommittedRollOutcome, CommittedRollState, StartCommittedRollInput } from "../types/committedRoll";
import { formatCriticalFailureLog } from "../data/criticalFailureTables";
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
import { initiativeRollFormula } from "../state/initiative";
import { resolveFormulaVars, formulaHasVars, getProficiencyBonus } from "../state/resolveFormulaVars";
import { PinnedReactions } from "./PinnedReactions";
import { withAlpha } from "../seats/seatColors";
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
  /** Seat color for the character's seat — tints the name so the sheet carries seat identity. */
  seatColor?: string;
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
  /** Current combat round — when set + isActiveTurn, shows F09 initiative pill */
  combatRound?: number;
  /** Resource counters — remaining count per resource action ID */
  resourceCounters?: Record<string, number>;
  /** Spend a variable amount from a pool resource (Lay on Hands, Ki, …). */
  onSpendResource?: (resourceActionId: string, amount: number) => void;
  /** Consume an action's tagged resource on USE (for non-rolling activated abilities —
   *  additive riders / weapon buffs — that never reach the roll-commit consume path). */
  onConsumeActionResources?: (action: ActorAction) => void;
  /** A save-forcing action fired — the host decides targets (picker) and announces it. */
  onSaveCall?: (actionName: string, save: string) => void;
  /** Character gold (gp) from live state — shown as a chip in the header. */
  gold?: number;
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
  features: "Class Actions",
  feats: "Feats",
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
  /** Bonus added to the DAMAGE roll (existing additive path). */
  formula?: string;
  /** Bonus added to the ATTACK roll — used by spellcasting focuses (id "focus:*") and
   *  fighting styles (id "buff:*"). */
  attackFormula?: string;
  /** For weapon buffs / fighting styles (id "buff:*") — which weapon attacks it rides. */
  appliesTo?: "ranged" | "melee" | "weapon";
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
// Broadcast by App's End Combat — every card clears its armed effects (rage / spell
// focuses / weapon buffs) and ends any active rage, so toggles persist through the
// whole fight and auto-clear when combat ends.
export const FDMC_COMBAT_END_CHANNEL = "forever-dm-combat:combat-end:v1";

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

function firstRollDiceLabel(action: ActorAction | null | undefined, fallbackLabel: string) {
  const override = action?.metadata?.diceLabel?.trim();
  const label = override || fallbackLabel;

  // Dice+ labels are safest when they stay compact and do not include punctuation-heavy weapon names.
  return label.replace(/[–—]/g, "-").replace(/[^a-zA-Z0-9 +_/-]/g, "").trim() || fallbackLabel;
}

function labeledDiceFormula(formula: string, label: string) {
  const cleanFormula = formula.trim();

  if (!cleanFormula) {
    return cleanFormula;
  }

  if (cleanFormula.includes("#")) {
    return cleanFormula;
  }

  // Dice+ also parses the text after "#" and throws on dice/math tokens (e.g. a label
  // "Greataxe (dmg +2)" -> "Unexpected token: MATH"). Keep only readable words: strip
  // dice terms, operators, parens, and bare numbers so the label can never break the roll.
  const safeLabel = label
    .replace(/\d*d\d+/gi, " ")
    .replace(/[+\-*/#=<>()]/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!safeLabel) {
    return cleanFormula;
  }

  return `${cleanFormula} # ${safeLabel}`;
}

function isRangedAttackAction(action?: ActorAction | null) {
  if (!action) {
    return false;
  }

  const range = action.metadata?.range ?? "";
  // A "normal/long" range like "150/600 ft" or "20/60" means a ranged/thrown weapon.
  if (/\d+\s*\/\s*\d+/.test(range)) {
    return true;
  }

  const searchableText = `${action.label} ${action.description ?? ""} ${action.metadata?.details ?? ""} ${range} ${(action.tags ?? []).join(" ")}`;
  return /\b(?:ranged|range|bow|longbow|shortbow|crossbow|sling|dart|javelin|blowgun|revolver|firearm|pistol|rifle|shot|thrown)\b/i.test(searchableText);
}

// Whether a weapon buff / fighting style (Archery, TWF, GWF) rides the attacked action.
// Styles/buffs ride WEAPON attacks only (never spells), gated by their target.
function buffMatchesAttack(appliesTo: ArmedEffect["appliesTo"], action?: ActorAction | null) {
  if (!action || action.actionKind === "spell") return false;
  if (appliesTo === "ranged") return isRangedAttackAction(action);
  if (appliesTo === "melee") return !isRangedAttackAction(action);
  return true; // "weapon" / undefined → any weapon attack
}

const orderedTabs: TabId[] = [
  "main",
  "bonus",
  "spells",
  "bond",
  "checks",
  "features",  // "Class Actions"
  "feats",
  "status",
  "equipment",
  "resources",
  // "outOfCombat" dropped (P-SHEET) — Short/Long Rest live on buttons, not a tab
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

  (actor.pinnedReactions ?? []).forEach((reaction) => {
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
    // Drop any unresolved @VAR token outright (e.g. "@DEX", "@PROF"). Without this the
    // generic char-strip below would keep the "D" from "@DEX" and emit "1d20+D" — invalid
    // notation. Vars are normally resolved before this runs; this is the safety net.
    .replace(/@[A-Za-z_]+/g, "")
    .replace(/\bcrit\b.*$/i, "")
    .replace(/\bwith\s+rage\b:?/i, "")
    .replace(/\b(?:healing|piercing|slashing|bludgeoning|force|fire|cold|necrotic|psychic|radiant|acid|poison|lightning|thunder|temp(?:orary)?\s*hp|hp|damage|on\s+hit)\b/gi, " ")
    .replace(/[^0-9dD+\-*/()\s]/g, " ")
    .replace(/\s+/g, "")
    // Drop annotation parens left by labels like "+2 (Archery)" -> "+2()" -> "+2".
    // Keep parens that still contain dice/numbers, e.g. "(1d6+2)".
    .replace(/\(([^)]*)\)/g, (m, inner) => (/[0-9dD]/.test(inner) ? m : ""))
    .replace(/^[+*/]+/, "")        // strip a leading operator (keep a leading minus)
    .replace(/\+{2,}/g, "+")
    .replace(/\+-/g, "-")
    .replace(/[+\-*/]+$/, "")      // strip any trailing operator
    .trim();

  return cleaned;
}

function hasRollableFormula(rawFormula?: string) {
  return /\d+d\d+/i.test(rawFormula ?? "") || /^[+-]?\d+$/.test((rawFormula ?? "").trim());
}

// Collapse the flat +N/-N modifiers in a formula into one signed number, keeping dice
// terms intact: "1d20+2+3+1+2" -> "1d20+8", "1d6+3+1+2" -> "1d6+6". Skips anything with
// * / ( ) and bails (returns input) unless the whole string is accounted for, so it never
// mangles an unexpected formula.
function condenseFlatModifiers(formula: string): string {
  if (!formula || /[*/()]/.test(formula)) return formula;
  const re = /([+-]?)(\d*d\d+(?:k[hl]\d+)?|\d+)/gi;
  const diceTerms: string[] = [];
  let flatSum = 0;
  let consumed = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    consumed += m[0];
    const neg = m[1] === "-";
    if (/d/i.test(m[2])) diceTerms.push((neg ? "-" : "") + m[2]);
    else flatSum += (neg ? -1 : 1) * Number.parseInt(m[2], 10);
  }
  if (consumed.replace(/\s/g, "") !== formula.replace(/\s/g, "")) return formula;
  let out = diceTerms.join("+").replace(/\+-/g, "-");
  if (flatSum !== 0 || diceTerms.length === 0) {
    out += out && flatSum >= 0 ? `+${flatSum}` : `${flatSum}`;
  }
  return out || formula;
}

function combineRollFormulas(formulas: string[]) {
  const normalized = formulas
    .map((formula) => normalizeRollFormula(formula))
    .filter(Boolean);

  if (normalized.length === 0) {
    return "";
  }

  return condenseFlatModifiers(normalized.join("+").replace(/\+\+/g, "+").replace(/\+-/g, "-"));
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
  // Rage, spellcasting focuses, and weapon buffs stay armed across rolls until toggled off.
  return effect.id === "rage-active" || effect.id.startsWith("focus:") || effect.id.startsWith("buff:");
}


function normalizeFirstRollFormula(rawFormula?: string) {
  const normalized = normalizeRollFormula(rawFormula);

  if (normalized) {
    return condenseFlatModifiers(normalized);
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

  return `CRIT! ${formatCritThresholdLabel(critThreshold)} — ${actionLabel} ${damageLabel}`;
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
  seatColor,
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
  onSendDicePlusRequest: onSendDicePlusRequestRaw,
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
  combatRound,
  resourceCounters,
  onSpendResource,
  onConsumeActionResources,
  onSaveCall,
  gold,
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
  // one-off additive bonus die (Bless/Guidance/Coach grant) that rides the NEXT d20 roll, then clears
  const [pendingAdditiveDie, setPendingAdditiveDie] = useState<string | null>(null);
  // one-off additive die that rides the NEXT damage roll, then clears
  const [pendingDamageDie, setPendingDamageDie] = useState<string | null>(null);
  // per-pool "spend N" input value (Lay on Hands etc.), keyed by resource action id
  const [resourceSpend, setResourceSpend] = useState<Record<string, string>>({});
  const [additiveMenuOpen, setAdditiveMenuOpen] = useState(false);
  // adv / normal / disadv for the player's own d20 rolls (attacks + ability checks).
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  // Wrap the dice-send prop once so every existing call site picks up adv/disadv +
  // the additive without per-site edits. Only attack rolls and ability checks (d20
  // rolls) are affected — damage/healing sends pass through untouched.
  const onSendDicePlusRequest = useCallback(async (request: DiceBridgeRollRequest) => {
    const isD20Roll = request.outcomeMode === "attack-roll" || request.outcomeMode === "ability-check";
    if (!isD20Roll) return onSendDicePlusRequestRaw(request);
    // The formula carries a " # Label" suffix for Dice+. Advantage and any one-off
    // bonus die must modify the DICE part only — appending after the label corrupts
    // the notation (the die ends up inside the label text).
    const hashIdx = request.formula.indexOf("#");
    const dicePart = hashIdx >= 0 ? request.formula.slice(0, hashIdx).trimEnd() : request.formula;
    const labelPart = hashIdx >= 0 ? request.formula.slice(hashIdx) : "";
    let dice = applyAdvantage(dicePart, rollMode);
    if (pendingAdditiveDie) {
      dice = appendBonusDie(dice, pendingAdditiveDie);
      setPendingAdditiveDie(null);
    }
    const formula = labelPart ? `${dice} ${labelPart}` : dice;
    return onSendDicePlusRequestRaw(formula === request.formula ? request : { ...request, formula });
  }, [onSendDicePlusRequestRaw, pendingAdditiveDie, rollMode]);
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

  // End Combat → drop every armed effect (rage / spell focus / weapon buff) and end any
  // active rage (keeping remaining uses). Lets a toggle persist all fight then auto-clear.
  useEffect(() => {
    if (!OBR.isAvailable) {
      return;
    }
    return OBR.broadcast.onMessage(FDMC_COMBAT_END_CHANNEL, () => {
      setArmedEffectsByActorId({});
      setSessionCountersByActorId((current) => {
        const next: Record<string, Partial<Record<SessionCounterId, SessionCounter>>> = {};
        for (const aid of Object.keys(current)) {
          const counters = current[aid] ?? {};
          const updated: Partial<Record<SessionCounterId, SessionCounter>> = {};
          (Object.keys(counters) as SessionCounterId[]).forEach((cid) => {
            const c = counters[cid];
            if (c) updated[cid] = { ...c, active: false };
          });
          next[aid] = updated;
        }
        return next;
      });
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
      message: `${actor.name} takes ${amount} damage. HP ${formatHp(hp.current)} → ${formatHp(next.current)}.`,
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
            )} → ${formatHp(next.current)}.`
          : `${actor.name} heals ${amount} HP. HP ${formatHp(hp.current)} → ${formatHp(next.current)}.`,
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
      message: `${actor.name} gains ${amount} temporary HP. Temp HP ${currentTemp} → ${next.temp}.`,
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
      message: `${actor.name} loses ${amount} temporary HP. Temp HP ${currentTemp} → ${nextTemp}.`,
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
      message: `${actor.name}'s temporary HP resets to 0. Temp HP ${currentTemp} → 0.`,
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
      message: `${actor.name} drops to 0 HP. HP ${formatHp(hp.current)} → 0.`,
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
      message: `${actor.name} spends 1 Risk Die. Risk Dice ${counter.current}/${counter.max} → ${nextValue}/${counter.max}.`,
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
      message: `${actor.name} spends 1 ${counter.label}. ${counter.label} ${counter.current}/${counter.max} → ${nextValue}/${counter.max}.`,
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
        {/* Advantage / disadvantage for the player's own d20 rolls (attacks + checks) */}
        <span className="abs-check-rollmode" style={{ display: "inline-flex", alignItems: "center", gap: 2, marginLeft: 8 }}>
          {([
            { id: "disadv", label: "Disadv", color: "#ff5840" },
            { id: "normal", label: "Normal", color: "#9a9ab0" },
            { id: "adv", label: "Adv", color: "#34c759" },
          ] as { id: RollMode; label: string; color: string }[]).map((m) => {
            const active = rollMode === m.id;
            return (
              <button key={m.id} type="button" onClick={() => setRollMode(m.id)}
                title={`Roll mode: ${m.label} (applies to your next attack / check)`}
                style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
                  background: active ? `${m.color}2e` : "transparent",
                  border: `1px solid ${active ? m.color : "#3a3a52"}`,
                  color: active ? m.color : "#777", fontWeight: active ? 600 : 400,
                }}>
                {m.label}
              </button>
            );
          })}
        </span>
        <span className="abs-check-additive" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() => setAdditiveMenuOpen((current) => !current)}
            title="Flag a one-off bonus die onto your next roll and/or next damage roll"
            aria-expanded={additiveMenuOpen}
          >
            + Additive
          </button>
          {pendingAdditiveDie && (
            <span className="abs-check-additive-chip" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 4px 2px 8px", borderRadius: 10, background: "rgba(123,104,238,0.15)", border: "1px solid rgba(123,104,238,0.4)", color: "#9d8cff" }}>
              roll +1{pendingAdditiveDie}
              <button type="button" onClick={() => setPendingAdditiveDie(null)} title="Clear roll additive"
                style={{ background: "transparent", border: "none", color: "#9d8cff", cursor: "pointer", lineHeight: 1, padding: 0 }}>
                ✕
              </button>
            </span>
          )}
          {pendingDamageDie && (
            <span className="abs-check-additive-chip" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 4px 2px 8px", borderRadius: 10, background: "rgba(224,123,57,0.15)", border: "1px solid rgba(224,123,57,0.45)", color: "#e9a66a" }}>
              dmg +1{pendingDamageDie}
              <button type="button" onClick={() => setPendingDamageDie(null)} title="Clear damage additive"
                style={{ background: "transparent", border: "none", color: "#e9a66a", cursor: "pointer", lineHeight: 1, padding: 0 }}>
                ✕
              </button>
            </span>
          )}
          {additiveMenuOpen && (
            <span style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 30, display: "inline-flex", flexDirection: "column", gap: 4, padding: "6px 8px", border: "1px solid #3a3a52", borderRadius: 6, background: "#13131f", boxShadow: "0 6px 18px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#9d8cff", minWidth: 62 }}>To roll</span>
                {ADDITIVE_DICE.map((die) => (
                  <button key={die} className="secondary-button compact quiet" type="button"
                    onClick={() => { setPendingAdditiveDie(die); setAdditiveMenuOpen(false); }}>
                    +1{die}
                  </button>
                ))}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#e9a66a", minWidth: 62 }}>To damage</span>
                {DAMAGE_ADDITIVE_DICE.map((die) => (
                  <button key={die} className="secondary-button compact quiet" type="button"
                    onClick={() => { setPendingDamageDie(die); setAdditiveMenuOpen(false); }}>
                    +1{die}
                  </button>
                ))}
              </span>
            </span>
          )}
        </span>
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

  // Readied riders: a readied Bond OR any readied action whose outcome mode is "additive"
  // arms as an armed effect that rides the next damage roll (general bond-style rider, any
  // tab). Re-derived from the readied state each render; consumed when another action resolves.
  function getReadiedRiderEffects(): ArmedEffect[] {
    const effects: ArmedEffect[] = [];
    (Object.keys(actionState) as ActionCost[]).forEach((slot) => {
      const key = actionState[slot];
      if (!key || isUsedActionStateValue(key)) return;
      const entry = getActionForReadiedKey(key);
      if (!entry) return;
      const isBond = entry.sourceTabId === "bond";
      const isAdditive = entry.action.metadata?.outcomeMode === "additive";
      if (!isBond && !isAdditive) return;
      if (effects.some(e => e.id.endsWith(`:${entry.action.id}`))) return;
      // Rider damage lives in metadata.damage for both bonds and "additive" actions.
      // (metadata.additive is an overloaded field — resource pool max / reroll flag /
      // resource name — never a roll formula, so it must not be used here.)
      const formula = entry.action.metadata?.damage;
      const details = entry.action.metadata?.details ?? entry.action.description
        ?? (isBond ? "Resolve this bond effect manually." : "Additive — adds to your next damage roll.");
      effects.push({
        id: `${isBond ? "bond" : "additive"}:${entry.action.id}`,
        label: formula ? `${entry.action.label} (${formula})` : entry.action.label,
        details,
        source: isBond ? "Bond" : "Additive",
        formula,
      });
    });
    return effects;
  }

  function getVisibleArmedEffects() {
    return [...getReadiedRiderEffects(), ...armedEffects];
  }

  function consumeReadiedBondWithResolvedAction(resolvedReadiedKey: string) {
    // A readied rider (Bond or "additive" outcome mode) is applied/cleared when a DIFFERENT
    // action resolves — it rode that action. Scan every readied slot.
    (Object.keys(actionState) as ActionCost[]).forEach((slot) => {
      const key = actionState[slot];
      if (!key || isUsedActionStateValue(key) || key === resolvedReadiedKey) return;
      const entry = getActionForReadiedKey(key);
      if (!entry) return;
      const isBond = entry.sourceTabId === "bond";
      const isAdditive = entry.action.metadata?.outcomeMode === "additive";
      if (!isBond && !isAdditive) return;

      onUnreadyAction(key);
      onRemovePendingLogEntries([makePendingLogKey(actor.id, key)]);
      markCostSlotsUsed([slot]);
      onLog({
        actorName: actor.name,
        actionName: isBond ? "Bond Applied" : "Additive Applied",
        tabId: "system",
        message: `${actor.name}'s readied ${isBond ? "bond" : "additive"} ${entry.action.label} is applied/cleared with the resolved action.`,
      });
    });
  }

  // ── Spellcasting focus (P-UX4 follow-up) ─────────────────────────────────
  // Equipped items with a spell focus bonus surface as clickable toggles. When armed,
  // the focus adds its attack bonus to spell attack rolls (handleCommitRoll) and its
  // damage bonus to spell damage rolls (getDamageAdditives). Stays armed until toggled.
  function getEquippedSpellFocuses() {
    return (actor.tabs.equipment ?? [])
      .filter(a => a.metadata?.equipped !== false)
      .filter(a => a.metadata?.spellFocusAttack?.trim() || a.metadata?.spellFocusDamage?.trim())
      .map(a => ({
        id: a.id.replace(/^equip-/, ""),
        label: a.label,
        attack: a.metadata?.spellFocusAttack?.trim() || undefined,
        damage: a.metadata?.spellFocusDamage?.trim() || undefined,
      }));
  }

  function isSpellFocusArmed(focusId: string) {
    return armedEffects.some(e => e.id === `focus:${focusId}`);
  }

  // Resolve @vars and collapse a flat bonus to a single signed number for chip labels,
  // so a stored "1+@INT+@PROF" reads as "+6" instead of the raw template. Dice keep their
  // expression (e.g. "1d4+3").
  function formatBonusForChip(raw?: string): string {
    if (!raw?.trim()) return "";
    const resolved = normalizeRollFormula(resolveFormulaVars(raw, actor, deriveActorStats(actor, undefined, status), status));
    if (!resolved) return "";
    if (/d/i.test(resolved)) return /^[-(]/.test(resolved) ? resolved : `+${resolved}`;
    const nums = resolved.match(/[+-]?\d+/g);
    if (!nums) return resolved;
    const total = nums.reduce((sum, n) => sum + Number.parseInt(n, 10), 0);
    return total >= 0 ? `+${total}` : `${total}`;
  }

  // Render-time chip text — always rebuilt from the effect's formulas so @vars resolve and
  // flat bonuses condense (e.g. "atk +6"), even for effects armed before a fix or with a
  // stale stored label. Falls back to the stored label when there are no formulas.
  function armedChipLabel(effect: ArmedEffect): string {
    const parts: string[] = [];
    if (effect.attackFormula?.trim()) parts.push(`atk ${formatBonusForChip(effect.attackFormula)}`);
    if (effect.formula?.trim()) parts.push(`dmg ${formatBonusForChip(effect.formula)}`);
    return parts.length ? parts.join(" · ") : effect.label;
  }

  function toggleSpellFocus(focus: { id: string; label: string; attack?: string; damage?: string }) {
    const effectId = `focus:${focus.id}`;
    if (isSpellFocusArmed(focus.id)) {
      clearArmedEffect(effectId);
      return;
    }
    upsertArmedEffect({
      id: effectId,
      label: [focus.attack ? `atk ${formatBonusForChip(focus.attack)}` : "", focus.damage ? `dmg ${formatBonusForChip(focus.damage)}` : ""].filter(Boolean).join(" · ") || focus.label,
      details: `${focus.label} — spellcasting focus. Adds to spell attack & damage rolls while armed.`,
      source: focus.label,
      formula: focus.damage,
      attackFormula: focus.attack,
    });
  }

  function renderSpellFocusPanel() {
    const focuses = getEquippedSpellFocuses();
    if (focuses.length === 0) return null;
    return (
      <section className="armed-effects-panel" aria-label="Spell focuses">
        <div className="armed-effects-header">
          <span className="stat-label">🪄 Spell Focuses</span>
          <span>toggle when casting a spell</span>
        </div>
        <div className="armed-effect-chip-list">
          {focuses.map(f => {
            const armed = isSpellFocusArmed(f.id);
            return (
              <button
                type="button"
                key={f.id}
                onClick={() => toggleSpellFocus(f)}
                className={`armed-effect-chip ${armed ? "rage-armed" : ""}`}
                style={{ cursor: "pointer", opacity: armed ? 1 : 0.65 }}
                title={`${f.label}${f.attack ? ` · ${formatBonusForChip(f.attack)} to spell attack` : ""}${f.damage ? ` · ${formatBonusForChip(f.damage)} to spell damage` : ""} (applies to spell rolls only)`}
              >
                {armed ? "✓ " : ""}{f.label}{f.attack ? ` atk ${formatBonusForChip(f.attack)}` : ""}{f.damage ? ` dmg ${formatBonusForChip(f.damage)}` : ""}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  // ── Weapon buffs (Hungering Blade etc.) ──────────────────────────────────
  // Spells/abilities flagged with metadata.weaponBuffDamage show as clickable toggles.
  // While armed, the rider damage adds to the actor's WEAPON attacks (getDamageAdditives,
  // gated to non-spell). Persistent until toggled off. Slot/once-per-turn/temp-HP are
  // handled by the player (assisted, not auto).
  type WeaponBuffOption = { id: string; label: string; attack?: string; damage?: string; appliesTo: "ranged" | "melee" | "weapon" };
  // Standing toggles = PASSIVE fighting styles only (Archery, GWF, Dueling). Activated
  // buffs (weaponBuffDamage — Hunter's Mark, Channel Divinity damage, …) are NOT standing
  // toggles; they arm their chip when the action is cast/used (see handleUseAction).
  function getWeaponBuffs(): WeaponBuffOption[] {
    return Object.values(actor.tabs).flat()
      .filter(a => a.metadata?.combatStyleAttack?.trim() || a.metadata?.combatStyleDamage?.trim())
      .map(a => {
        const m = a.metadata!;
        return {
          id: a.id,
          label: a.label,
          attack: m.combatStyleAttack?.trim() || undefined,
          damage: m.combatStyleDamage?.trim() || undefined,
          appliesTo: m.combatStyleTarget ?? "weapon",
        };
      });
  }

  function isWeaponBuffArmed(buffId: string) {
    return armedEffects.some(e => e.id === `buff:${buffId}`);
  }

  function toggleWeaponBuff(buff: WeaponBuffOption) {
    const effectId = `buff:${buff.id}`;
    if (isWeaponBuffArmed(buff.id)) {
      clearArmedEffect(effectId);
      return;
    }
    upsertArmedEffect({
      id: effectId,
      label: [buff.attack ? `atk ${formatBonusForChip(buff.attack)}` : "", buff.damage ? `dmg ${formatBonusForChip(buff.damage)}` : ""].filter(Boolean).join(" · ") || buff.label,
      details: `${buff.label} — ${buff.appliesTo} attacks. Adds ${[buff.attack ? `${formatBonusForChip(buff.attack)} to attack` : "", buff.damage ? `${formatBonusForChip(buff.damage)} to damage` : ""].filter(Boolean).join(" + ")} while armed.`,
      source: buff.label,
      formula: buff.damage,
      attackFormula: buff.attack,
      appliesTo: buff.appliesTo,
    });
  }

  function renderWeaponBuffPanel() {
    const buffs = getWeaponBuffs();
    if (buffs.length === 0) return null;
    return (
      <section className="armed-effects-panel" aria-label="Fighting styles and weapon buffs">
        <div className="armed-effects-header">
          <span className="stat-label">⚔ Fighting Styles & Buffs</span>
          <span>toggle on while active</span>
        </div>
        <div className="armed-effect-chip-list">
          {buffs.map(b => {
            const armed = isWeaponBuffArmed(b.id);
            const bonusText = [b.attack ? `${formatBonusForChip(b.attack)} atk` : "", b.damage ? `${formatBonusForChip(b.damage)} dmg` : ""].filter(Boolean).join(" · ");
            return (
              <button
                type="button"
                key={b.id}
                onClick={() => toggleWeaponBuff(b)}
                className={`armed-effect-chip ${armed ? "rage-armed" : ""}`}
                style={{ cursor: "pointer", opacity: armed ? 1 : 0.65 }}
                title={`${b.label} — adds ${bonusText} to ${b.appliesTo} attacks while on.`}
              >
                {armed ? "✓ " : ""}{b.label} <span style={{ opacity: 0.7 }}>({b.appliesTo}: {bonusText})</span>
              </button>
            );
          })}
        </div>
      </section>
    );
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
              <strong>{effect.source}</strong> · {armedChipLabel(effect)}
              {/* Bonds & additives are readied riders — clear them by un-readying the action,
                  not here (the chip is re-derived from the readied state). */}
              {!effect.id.startsWith("bond:") && !effect.id.startsWith("additive:") && (
                <button type="button" onClick={() => clearArmedEffect(effect.id)} aria-label={`Clear ${effect.label}`}>
                  ✕
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
                −
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
                      −
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
      return `${actor.name} swapped readied ${actionCostLabels[swappedCost]}: ${previousLabel} → ${actionLabel}.`;
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

    // Built-in Rage only when this actor actually has a Rage session counter. A custom
    // Rage authored as a resource pool + additive/buff action must NOT be hijacked here —
    // it flows through the normal use path (and its pool counts down below).
    if ((action.id === "rage" || action.label.toLowerCase() === "rage") && sessionCounters.rage) {
      handleUseRage();
      return;
    }

    // Activated weapon buff (Hunter's Mark, Channel Divinity damage, …): casting/using
    // the action arms a PERSISTENT damage chip that rides weapon attacks until it ends
    // (clear ✕ / End Combat). Not a standing toggle. Continues the normal use flow below.
    const buffDamage = action.metadata?.weaponBuffDamage?.trim();
    if (buffDamage) {
      upsertArmedEffect({
        id: `buff:${action.id}`,
        label: `dmg ${formatBonusForChip(buffDamage)}`,
        details: `${action.label} — adds ${formatBonusForChip(buffDamage)} to weapon attacks while active. Clear it (✕) when it ends; auto-clears at End Combat.`,
        source: action.label,
        formula: buffDamage,
        appliesTo: "weapon",
      });
      onLog({
        actorName: actor.name,
        actionName: action.label,
        tabId: "system",
        message: `${actor.name} activates ${action.label} — ${formatBonusForChip(buffDamage)} to weapon attacks until it ends.`,
      });
    }

    // Activated abilities (additive riders / weapon buffs) never go through a committed
    // roll, so spend their tagged resource HERE, on use — that's what makes the pool
    // (Rage uses, Channel Divinity, …) count down automatically. Gated to non-rolling
    // actions so it can't double up with the roll-commit consume.
    const isActivatedAbility = action.metadata?.outcomeMode === "additive" || Boolean(buffDamage);
    const rollsItsOwn = hasRollableFormula(action.metadata?.attack) || Boolean(action.metadata?.saveDc?.trim());
    if (isActivatedAbility && !rollsItsOwn) {
      onConsumeActionResources?.(action);
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
    // Resolve @VARIABLE tokens (@PROF, @STR, …) before sending to Dice+. Damage-only and
    // triggered actions route here (see TabPanel resolveOutcomeMode); without this the raw
    // "1d8+1+@PROF" was sent to Dice+, which can't parse it — so the dice never rolled.
    const _derivedForTrigger = deriveActorStats(actor, undefined, status);
    const rawRollFormula = entry.action.metadata?.damage ?? entry.action.metadata?.additive ?? entry.action.metadata?.attack;
    const rollFormula = rawRollFormula
      ? normalizeFirstRollFormula(resolveFormulaVars(rawRollFormula, actor, _derivedForTrigger, status))
      : rawRollFormula;
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
    const readiedRiders = getReadiedRiderEffects();
    const pairedText = readiedRiders.length > 0 ? ` + ${readiedRiders[0].label.replace(/\s*\([^)]*\)/g, "")}` : "";

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
      message: `${actor.name} is raging and uses ${candidate.actionLabel}${pairedText}. Rage ${counter.current}/${counter.max} → ${nextValue}/${counter.max}.`,
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
    const resolvePrimeFormula = (f?: string) => f ? normalizeFirstRollFormula(resolveFormulaVars(f, actor, _derivedForPrime, status)) : f;

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
    const resolveFormula = (f?: string) => f ? normalizeFirstRollFormula(resolveFormulaVars(f, actor, _derivedForRoll, status)) : f;

    const resolvedCandidate: ReadiedRollCandidate = {
      ...candidate,
      attackFormula: resolveFormula(candidate.attackFormula ?? entry.action.metadata?.attack),
      saveDc: resolveFormula(candidate.saveDc ?? entry.action.metadata?.saveDc),
      damageFormula: resolveFormula(candidate.damageFormula ?? entry.action.metadata?.damage),
      critDamageFormula: resolveFormula(candidate.critDamageFormula ?? entry.action.metadata?.crit),
      critThreshold: candidate.critThreshold ?? entry.action.metadata?.critThreshold,
    };

    // Spellcasting focus: when casting a spell, armed focus toggles add their attack bonus
    // to the spell's attack roll (the damage bonus rides via getDamageAdditives). Focuses
    // never touch non-spell attacks.
    const spellAttackFormula = resolvedCandidate.attackFormula?.trim();
    if (entry.action.actionKind === "spell" && spellAttackFormula) {
      const focusAttackBonuses = armedEffects
        .filter(e => e.id.startsWith("focus:") && e.attackFormula?.trim())
        // Resolve @VARIABLE tokens in the focus bonus (e.g. a wand "@SPELL+1") — otherwise
        // the raw @SPELL is sent to Dice+ and only the flat part lands.
        .map(e => resolveFormulaVars((e.attackFormula as string).trim(), actor, _derivedForRoll, status));
      if (focusAttackBonuses.length > 0) {
        resolvedCandidate.attackFormula = combineRollFormulas([spellAttackFormula, ...focusAttackBonuses]);
      }
    }

    // Fighting styles (Archery etc.): armed weapon-buff toggles add their attack bonus to a
    // matching WEAPON attack roll (gated by target). Damage bonus rides via getDamageAdditives.
    const weaponAttackFormula = resolvedCandidate.attackFormula?.trim();
    if (entry.action.actionKind !== "spell" && weaponAttackFormula) {
      const styleAttackBonuses = armedEffects
        .filter(e => e.id.startsWith("buff:") && e.attackFormula?.trim() && buffMatchesAttack(e.appliesTo, entry.action))
        .map(e => resolveFormulaVars((e.attackFormula as string).trim(), actor, _derivedForRoll, status));
      if (styleAttackBonuses.length > 0) {
        resolvedCandidate.attackFormula = combineRollFormulas([weaponAttackFormula, ...styleAttackBonuses]);
      }
    }

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
      const saveCall = resolvedCandidate.saveDc?.trim();
      if (saveCall) {
        onSaveCall?.(resolvedCandidate.actionLabel, saveCall);
      } else {
        onLog({
          actorName: actor.name,
          actionName: resolvedCandidate.actionLabel,
          tabId: "system",
          message: `${actor.name} uses ${resolvedCandidate.actionLabel} — choose Applies / No Effect.`,
        });
      }
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

    return `${actor.name} rolled ${naturalText} — simple miss for ${committedRoll.actionLabel}.${resultText} No critical-failure chart used tonight. Marked used until reset.`;
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
        ? `${actor.name} holds ${committedRoll.actionLabel} roll: ${trimmedResult} — Nat 1 will resolve as simple miss tonight.`
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
    const derivedForAdditives = deriveActorStats(actor, undefined, status);

    return getVisibleArmedEffects()
      .map((effect) => ({
        // Resolve @VARIABLE tokens up front (e.g. a focus "1d4+@CHA" or a buff "@CHA") so
        // the rollability check + sent formula use real numbers, not raw @vars.
        effect,
        resolvedFormula: effect.formula?.trim() ? resolveFormulaVars(effect.formula, actor, derivedForAdditives, status) : "",
      }))
      .filter(({ effect, resolvedFormula }) => {
        if (!resolvedFormula.trim() || !hasRollableFormula(resolvedFormula)) {
          return false;
        }

        if ((effect.id === "rage-active" || effect.id === "rage-pending") && !isEligibleRageAction(entry?.action ?? null, committedRoll)) {
          return false;
        }

        // Spellcasting focus bonuses only ride SPELL damage.
        if (effect.id.startsWith("focus:") && entry?.action.actionKind !== "spell") {
          return false;
        }

        // Weapon buffs / fighting styles ride matching WEAPON attacks only (gated by target).
        if (effect.id.startsWith("buff:") && !buffMatchesAttack(effect.appliesTo, entry?.action)) {
          return false;
        }

        return true;
      })
      .map(({ effect, resolvedFormula }) => {
        const baseFormula = normalizeRollFormula(resolvedFormula);
        // Bonds never crit — their rider dice are not doubled on a critical hit
        // (table ruling). Other riders (rage, focus, fighting styles) still double.
        const applyCrit = isCritDamage && !effect.id.startsWith("bond:");
        const formula = formatAdditiveFormulaForDamage(resolvedFormula, applyCrit);

        return {
          id: effect.id,
          label: effect.label,
          shorthand: additiveShorthandForEffect(effect),
          baseFormula,
          formula,
          critAdjusted: applyCrit && Boolean(baseFormula) && formula !== baseFormula,
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
    const baseCombinedFormula = combineRollFormulas([baseFormula, ...additiveFormulas]);

    if (!baseCombinedFormula) {
      return;
    }

    // One-off damage additive die (from the Additive control) rides this roll, then clears.
    const combinedFormula = pendingDamageDie ? appendBonusDie(baseCombinedFormula, pendingDamageDie) : baseCombinedFormula;
    if (pendingDamageDie) setPendingDamageDie(null);

    const additiveText = additiveParts.length > 0 ? ` with additives (${additiveParts.map((effect) => `${effect.shorthand}=${effect.critAdjusted ? `${effect.baseFormula}→${effect.formula}` : effect.formula}`).join(" + ")})` : "";
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

    // Attack with a rider save ("hit, then DC 14 STR or prone"): now that the hit's damage
    // is rolled, call the save on the target. Crit and normal damage are the same hit, so
    // only fire on the primary damage to avoid a double prompt.
    const riderSave = committedRoll.saveDc?.trim();
    if (riderSave && committedRoll.outcomeMode === "attack-roll" && damageChoice !== "crit") {
      onSaveCall?.(committedRoll.actionLabel, riderSave);
    }

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
    <article className={`actor-card ${hpStatus}`} style={seatColor ? { borderLeft: `5px solid ${seatColor}` } : undefined}>
      <header className="actor-card-header selected-actor-header" style={seatColor ? { background: withAlpha(seatColor, 0.1) } : undefined}>
        <div className="actor-title-row compact-detail-title">
          <div className="actor-title-copy">
            <p className="eyebrow">{actor.kind === "companion" ? "Companion Card" : "Selected Character"}</p>
            <h2 style={seatColor ? { color: seatColor } : undefined}>{actor.name}</h2>
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
            {/* F09: initiative pill — shows round when active turn */}
            {initiativeState?.result && (
              <span className={`initiative-result-pill ${initiativeState.status}`}>
                {isActiveTurn && combatRound !== undefined
                  ? `⚡ Init ${initiativeState.result} · Rd ${combatRound}`
                  : `Init ${initiativeState.result}`}
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
            {typeof gold === "number" && (
              <div className="speed-subrow" title="Character gold — DM grants it; merchant purchases spend it">
                <span className="stat-label">Gold</span>
                <span className="stat-value" style={{ color: "#e0a030", fontWeight: 700 }}>💰 {gold}</span>
              </div>
            )}
          </div>
        </div>

        <AbilityScoreRow abilityScores={actor.abilityScores} derivedStats={deriveActorStats(actor, undefined, status)} />
        {renderCompactDebuffSummary()}
        {renderAttackUsePanel()}
      </header>

      {renderSpellFocusPanel()}

      {renderWeaponBuffPanel()}

      {renderArmedEffectsPanel()}

      {renderClassOptionsPanel()}

      {/* In player mode, float the roll workspace (incl. Hit/Miss) pinned to the bottom of
          the viewport so the player never has to scroll back to the top after rolling. */}
      <div style={isPlayerMode && committedRoll ? {
        position: "fixed", left: 8, right: 8, bottom: 8, zIndex: 60,
        maxHeight: "72vh", overflowY: "auto", borderRadius: 10,
        background: "#0d0d14", border: "2px solid #7b68ee",
        boxShadow: "0 -10px 28px rgba(0,0,0,0.6)",
      } : undefined}>
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
        isPlayerMode={isPlayerMode}
        isMonsterActor={actor.kind === "monster"}
        onResolveCriticalFailure={(entry, kind) => {
          // Players see the soft player-summary in the shared log; the DM table effect
          // stays DM-side. The d6 result is always logged so the table has a record.
          const playerSafe = isPlayerMode && actor.kind !== "monster";
          onLog({
            actorName: actor.name,
            actionName: committedRoll?.actionLabel ?? "Nat 1",
            tabId: "system",
            message: formatCriticalFailureLog(entry, kind, actor.level ?? 1, playerSafe),
          });
          handleChooseCommittedRollOutcome("miss");
        }}
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
              actionName: `${committedRoll.actionLabel} (Reroll — ${source.label})`,
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
      </div>
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
          isActiveTurn={isActiveTurn}
          hasBonusActions={Object.values(actor.tabs).some((actions: ActorAction[]) => actions.some(a => a.economyCost?.includes("bonus") ?? false))}
          onResetTurn={isPlayerMode ? onResetTurn : resetTurn}
          onClearConcentration={onClearConcentration}
        />
      </div>

      <TabBar
        activeTab={activeTab}
        visibleTabs={visibleTabs}
        onChangeTab={setActiveTab}
        counts={Object.fromEntries(visibleTabs.map((t) => [t, actor.tabs[t]?.length ?? 0]))}
      />

      {/* Standard combat actions — quick declare (Dash, Dodge, Disengage, …) above the
          actions list; logs to the encounter log so the table sees the called action. */}
      <div className="standard-actions-row" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0 2px" }}>
        <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>Standard action</span>
        <select
          defaultValue=""
          onChange={(e) => {
            const action = e.target.value;
            if (!action) return;
            onLog({ actorName: actor.name, actionName: action, tabId: "system", message: `${actor.name} takes the ${action} action.` });
            e.target.value = "";
          }}
          style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "3px 6px", background: "#111", border: "1px solid #3a3a52", borderRadius: 4, color: "#ccc" }}
          title="Declare a standard combat action — logs it to the encounter log"
        >
          <option value="">— Declare a standard action —</option>
          {STANDARD_COMBAT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

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
            resolveFormula={(f) => condenseFlatModifiers(resolveFormulaVars(f, actor, deriveActorStats(actor, undefined, status), status))}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Spend N from a points pool (Lay on Hands, Ki, …) — deduct only, no auto-heal */}
                      {hasCounter && onSpendResource && (kind === "pool" || kind === "counter") && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <input
                            type="number" min={1} max={remaining} inputMode="numeric"
                            value={resourceSpend[action.id] ?? ""}
                            onChange={e => setResourceSpend(s => ({ ...s, [action.id]: e.target.value }))}
                            placeholder="N"
                            style={{ width: 40, padding: "1px 4px", fontSize: 11, background: "#111", border: "1px solid #333", borderRadius: 3, color: "#ddd", textAlign: "center" }}
                          />
                          <button type="button"
                            disabled={remaining <= 0}
                            onClick={() => {
                              const n = Number.parseInt(resourceSpend[action.id] ?? "", 10);
                              if (!Number.isFinite(n) || n <= 0) return;
                              onSpendResource(action.id, n);
                              setResourceSpend(s => ({ ...s, [action.id]: "" }));
                            }}
                            style={{ fontSize: 10, padding: "2px 7px", background: remaining > 0 ? "#2a2a4e" : "#1a1a1a", border: "1px solid #7b68ee55", borderRadius: 3, color: remaining > 0 ? "#9d8cff" : "#555", cursor: remaining > 0 ? "pointer" : "default" }}
                            title="Spend this many points from the pool">
                            Spend
                          </button>
                        </span>
                      )}
                      {hasCounter && (
                        <span style={{ fontSize: 12, color: remaining === 0 ? "#555" : remaining <= max * 0.5 ? "#e07b39" : "#4caf50", fontVariantNumeric: "tabular-nums" }}>
                          {remaining}/{max}
                        </span>
                      )}
                    </div>
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
            resolveFormula={(f) => condenseFlatModifiers(resolveFormulaVars(f, actor, deriveActorStats(actor, undefined, status), status))}
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
          resolveFormula={(f) => condenseFlatModifiers(resolveFormulaVars(f, actor, deriveActorStats(actor, undefined, status), status))}
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
