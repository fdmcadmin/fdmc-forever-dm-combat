import { useEffect, useState } from "react";
import { actionCostLabels } from "../types/actionEconomy";
import type { ActionCost } from "../types/actionEconomy";
import type { RerollSource } from "../state/rerollSources";
import { RerollSourcePicker } from "./RerollSourcePicker";
import type {
  CommittedRollDamageChoice,
  CommittedRollOutcome,
  CommittedRollOutcomeMode,
  CommittedRollState,
} from "../types/committedRoll";
import type { DiceBridgeEvent, DiceBridgeStatus } from "../integrations/useOwlbearDiceBridge";
import {
  getCriticalFailureEntries,
  getCriticalFailureEntry,
  type CriticalFailureEntry,
  type CriticalFailureTableKind,
} from "../data/criticalFailureTables";

export type ReadiedRollCandidate = {
  readiedKey: string;
  actionLabel: string;
  costs: ActionCost[];
  outcomeMode: CommittedRollOutcomeMode;
  attackFormula?: string;
  saveDc?: string;
  damageFormula?: string;
  critDamageFormula?: string;
  critThreshold?: number;
};

type CommittedRollPanelProps = {
  committedRoll: CommittedRollState | null;
  onHoldResult: (result: string) => void;
  onChooseOutcome: (outcome: CommittedRollOutcome) => void;
  onChooseDamage: (damageChoice: CommittedRollDamageChoice) => void;
  onResolve: () => void;
  onReset: () => void;
  diceBridgeStatus: DiceBridgeStatus;
  diceBridgeLastEvent: DiceBridgeEvent | null;
  onSendDiceRequest: () => void;
  onSendMockDiceResult: (naturalRoll: number, total: number) => void;
  isBuilderMode?: boolean;
  canShowDevTestRoll?: boolean;
  canShowGenericReroll?: boolean;
  attackUseState?: { current: number; max: number } | null;
  onNextAttack?: () => void;
  /** Available reroll sources scanned from actor equipment + features */
  rerollSources?: RerollSource[];
  /** Called when a source is chosen and reroll fires — parent handles dice request + source consumption */
  onRerollWithSource?: (source: RerollSource) => void;
  /** Player-facing card — hides the DM failure table from non-DM seats (P10). */
  isPlayerMode?: boolean;
  /** This actor is a monster — Nat 1 results are player-visible (they create openings). */
  isMonsterActor?: boolean;
  /** Resolve a Nat 1 with a chosen d6 failure-table entry; parent logs + marks miss (P10). */
  onResolveCriticalFailure?: (entry: CriticalFailureEntry, kind: CriticalFailureTableKind) => void;
  /** Seats that could be asked to roll a MONSTER's Nat 1 d6. */
  seatNames?: string[];
  /** DM opt-in. Off by default — a DM who wants to keep the die sees only the checkbox. */
  letSeatRollMonsterNat1?: boolean;
  onToggleSeatRollsMonsterNat1?: (on: boolean) => void;
  /** Ask that seat to roll the monster's d6. Naming a seat does not hand over resolution. */
  onAskSeatToRollNat1?: (seatName: string) => void;
};

function formatCosts(costs: ActionCost[]) {
  return costs.map((cost) => actionCostLabels[cost]).join(" + ");
}

function formatCritThreshold(threshold?: number) {
  const value = threshold ?? 20;
  return value === 20 ? "Nat 20" : `Nat ${value}-20`;
}

function modeLabel(mode: CommittedRollOutcomeMode) {
  if (mode === "attack-roll") {
    return "Roll";
  }

  if (mode === "ability-check") {
    return "ABS check";
  }

  if (mode === "dc-check") {
    return "DC / check";
  }

  return "Triggered";
}

function resultSummary(committedRoll: CommittedRollState) {
  if (committedRoll.outcomeMode === "ability-check") {
    if (!committedRoll.rollResult) {
      return "No check result held yet.";
    }

    const naturalText = committedRoll.naturalRoll ? ` · natural ${committedRoll.naturalRoll}` : "";
    return `${committedRoll.rollResult}${naturalText}`;
  }

  if (committedRoll.outcomeMode === "dc-check") {
    return committedRoll.saveDc ? `DC / check prompt · ${committedRoll.saveDc}` : "DC / check prompt.";
  }

  if (!committedRoll.requiresRollResult) {
    return "No local result entry required.";
  }

  if (!committedRoll.rollResult) {
    return "No result held yet.";
  }

  const naturalText = committedRoll.naturalRoll ? ` · natural ${committedRoll.naturalRoll}` : "";
  const criticalFailureText = committedRoll.isCriticalFailure ? " · Nat 1 simple miss" : "";
  const critText = committedRoll.isCrit ? ` · CRIT ${formatCritThreshold(committedRoll.critThreshold)} detected` : "";
  return `${committedRoll.rollResult}${naturalText}${criticalFailureText}${critText}`;
}

function bridgeStatusLabel(status: DiceBridgeStatus) {
  if (status === "ready") {
    return "Bridge ready";
  }

  if (status === "starting") {
    return "Bridge starting";
  }

  if (status === "outside-owlbear") {
    return "Manual mode";
  }

  return "Bridge error";
}

function flowSummary(committedRoll: CommittedRollState) {
  if (committedRoll.outcomeMode === "attack-roll") {
    return `Roll ${committedRoll.attackFormula ?? "manual"} · Crit ${formatCritThreshold(committedRoll.critThreshold)}`;
  }

  if (committedRoll.outcomeMode === "ability-check") {
    return `Ability roll ${committedRoll.attackFormula ?? "1d20"}`;
  }

  if (committedRoll.outcomeMode === "dc-check") {
    return committedRoll.saveDc ? `DC / check · ${committedRoll.saveDc}` : "DC / check prompt";
  }

  return "Triggered effect";
}

function phaseCopy(committedRoll: CommittedRollState) {
  if (committedRoll.isCriticalFailure) {
    return "Nat 1 simple miss";
  }

  if (committedRoll.isCrit && committedRoll.phase === "awaiting-damage") {
    return "Awaiting Crit Damage";
  }

  if (committedRoll.phase === "result-held") {
    return "Awaiting table decision";
  }

  return committedRoll.phase.replaceAll("-", " ");
}

function trackedActionPill(committedRoll: CommittedRollState) {
  if (committedRoll.isCriticalFailure) {
    return "Nat 1 · Miss";
  }

  if (committedRoll.isCrit) {
    return `${formatCritThreshold(committedRoll.critThreshold)} crit`;
  }

  if (committedRoll.rollResult) {
    return committedRoll.rollResult;
  }

  return formatCosts(committedRoll.costs);
}

function getMatchingBridgeResult(committedRoll: CommittedRollState, diceBridgeLastEvent: DiceBridgeEvent | null) {
  const isBridgeResultEvent =
    diceBridgeLastEvent?.kind === "result-received" || diceBridgeLastEvent?.kind === "result-sent";

  if (!isBridgeResultEvent) {
    return null;
  }

  if (diceBridgeLastEvent.result?.requestId !== committedRoll.bridgeRequestId) {
    return null;
  }

  return diceBridgeLastEvent.result;
}

function extractTotalRoll(rawResult: string) {
  const value = rawResult.trim();

  if (!value) {
    return null;
  }

  const explicitTotal = value.match(/\b(?:total|tot)\s*(-?\d{1,3})\b/i);
  if (explicitTotal) {
    return Number.parseInt(explicitTotal[1], 10);
  }

  const slashTotal = value.match(/\/\s*(-?\d{1,3})\b/);
  if (slashTotal) {
    return Number.parseInt(slashTotal[1], 10);
  }

  const numericOnly = value.match(/^\s*(-?\d{1,3})\s*$/);
  if (numericOnly) {
    return Number.parseInt(numericOnly[1], 10);
  }

  return null;
}

function naturalRollLabel(committedRoll: CommittedRollState) {
  if (typeof committedRoll.naturalRoll !== "number") {
    return "Natural die result: not captured yet";
  }

  return `Natural die result: ${committedRoll.naturalRoll}`;
}

function finalTotalLabel(committedRoll: CommittedRollState) {
  const total = extractTotalRoll(committedRoll.rollResult);

  if (typeof total !== "number") {
    return committedRoll.rollResult ? `Final total: ${committedRoll.rollResult}` : "Final total: not captured yet";
  }

  return `Final total: ${total}`;
}

function naturalRollStatus(committedRoll: CommittedRollState) {
  if (committedRoll.isCriticalFailure) {
    return `${committedRoll.rulesProfile.label}: Natural 1 detected — simple Miss for tonight. Final total includes modifiers but does not cancel the natural 1.`;
  }

  if (committedRoll.isCrit) {
    if (committedRoll.rulesProfile.naturalAttack20AutoHits) {
      return `${committedRoll.rulesProfile.label}: Natural ${committedRoll.naturalRoll} auto-hits and routes to Critical Damage. Final total includes modifiers but the natural die result controls the crit gate.`;
    }

    return `${committedRoll.rulesProfile.label}: Natural ${committedRoll.naturalRoll} detected — Critical Damage may apply after table confirmation. Final total includes modifiers.`;
  }

  if (typeof committedRoll.naturalRoll === "number") {
    return "Natural die result captured. Final total includes modifiers for the table decision.";
  }

  return null;
}


function extractD20Modifier(formula?: string) {
  const value = formula?.trim() ?? "";

  if (!value) {
    return 0;
  }

  const compact = value.replace(/\s+/g, "");
  const modifierMatch = compact.match(/d20([+-]\d+)/i);

  if (!modifierMatch) {
    return 0;
  }

  return Number.parseInt(modifierMatch[1], 10);
}

function formatDevTestResult(committedRoll: CommittedRollState, naturalRoll: number) {
  const modifier = extractD20Modifier(committedRoll.attackFormula);
  const total = naturalRoll + modifier;
  return `nat ${naturalRoll} / total ${total}`;
}

function hasExplicitNegativeModifier(formula?: string) {
  return /d20\s*-\s*\d+/i.test(formula ?? "");
}

function getBridgeResultWarning(committedRoll: CommittedRollState) {
  if (committedRoll.outcomeMode !== "attack-roll" || !committedRoll.rollResult || !committedRoll.naturalRoll) {
    return null;
  }

  const total = extractTotalRoll(committedRoll.rollResult);

  if (typeof total !== "number") {
    return null;
  }

  if (total < committedRoll.naturalRoll && !hasExplicitNegativeModifier(committedRoll.attackFormula)) {
    return "Check this result: total is lower than the natural roll. This can be valid with penalties, but it may also mean the dice bridge returned the wrong total.";
  }

  return null;
}

export function CommittedRollPanel({
  committedRoll,
  onHoldResult,
  onChooseOutcome,
  onChooseDamage,
  onResolve,
  onReset,
  diceBridgeStatus,
  diceBridgeLastEvent,
  onSendDiceRequest,
  onSendMockDiceResult,
  isBuilderMode = false,
  canShowDevTestRoll = false,
  canShowGenericReroll = false,
  attackUseState = null,
  onNextAttack,
  rerollSources = [],
  onRerollWithSource,
  isPlayerMode = false,
  isMonsterActor = false,
  seatNames,
  letSeatRollMonsterNat1,
  onToggleSeatRollsMonsterNat1,
  onAskSeatToRollNat1,
  onResolveCriticalFailure,
}: CommittedRollPanelProps) {
  const [showRerollPicker, setShowRerollPicker] = useState(false);
  const [rerollNewResult, setRerollNewResult] = useState<string | null>(null);
  const [resultInput, setResultInput] = useState("");
  const [mockNaturalRoll, setMockNaturalRoll] = useState("15");
  const [mockTotal, setMockTotal] = useState("");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [mockToolsOpen, setMockToolsOpen] = useState(false);
  const [devCustomOpen, setDevCustomOpen] = useState(false);
  const [criticalFailureKind, setCriticalFailureKind] = useState<CriticalFailureTableKind>("standard");
  const [criticalFailureD6, setCriticalFailureD6] = useState<number | null>(null);

  useEffect(() => {
    setResultInput(committedRoll?.rollResult ?? "");
  }, [committedRoll?.readiedKey, committedRoll?.rollResult]);

  useEffect(() => {
    if (!committedRoll) {
      return;
    }

    setMockTotal("");
    setMockNaturalRoll("15");
    setManualEntryOpen(false);
    setMockToolsOpen(false);
    setDevCustomOpen(false);
    setCriticalFailureKind("standard");
    setCriticalFailureD6(null);
  }, [committedRoll?.bridgeRequestId]);

  // When reroll picker is open and a NEW dice result arrives, capture it as the reroll result
  useEffect(() => {
    if (!showRerollPicker || !committedRoll || !diceBridgeLastEvent) return;
    const event = diceBridgeLastEvent;
    if (event.kind !== "result-received" && event.kind !== "result-sent") return;
    const resultText = event.result?.result?.trim();
    if (resultText) setRerollNewResult(resultText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceBridgeLastEvent, showRerollPicker]);

  // Auto-capture: when a Dice+ result arrives that matches the current roll,
  // immediately hold it — no manual "Hold Result" click required.
  useEffect(() => {
    if (!committedRoll || committedRoll.rollResult) {
      return; // already has a result
    }

    const matched = getMatchingBridgeResult(committedRoll, diceBridgeLastEvent);
    if (!matched) return;

    const formatted = matched.result?.trim();
    if (formatted) {
      onHoldResult(formatted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceBridgeLastEvent, committedRoll?.bridgeRequestId]);

  if (!committedRoll) {
    return null;
  }

  const matchingBridgeResult = getMatchingBridgeResult(committedRoll, diceBridgeLastEvent);
  const bridgeResultReceived = Boolean(matchingBridgeResult && committedRoll.rollResult);
  const bridgeWarning = getBridgeResultWarning(committedRoll);
  const resolvedMockNaturalRoll = Number.parseInt(mockNaturalRoll, 10);
  const fallbackTotal = Number.isFinite(resolvedMockNaturalRoll) ? resolvedMockNaturalRoll : 0;
  const resolvedMockTotal = mockTotal.trim() ? Number.parseInt(mockTotal, 10) : fallbackTotal;
  const canSendMockResult =
    diceBridgeStatus === "ready" &&
    Number.isFinite(resolvedMockNaturalRoll) &&
    resolvedMockNaturalRoll >= 1 &&
    resolvedMockNaturalRoll <= 20 &&
    Number.isFinite(resolvedMockTotal);

  const naturalStatus = naturalRollStatus(committedRoll);
  const isAttackCriticalFailure = committedRoll.outcomeMode === "attack-roll" && committedRoll.isCriticalFailure;
  /**
   * ⚠ THE PLAYER ROLLS THE DIE; THE PLAYER DOES NOT SEE THE TABLE.
   *
   * Christopher, 2026-08-17: *"i didnt tell you to make the players nat one a pure miss, i said
   * they dont get to see the options, they still get to roll the dice or choose miss if a dm is
   * looking to speed up the combat."*
   *
   * Two different things, and an earlier pass of mine collapsed them: it removed the whole box
   * from a player seat, which took away their d6 as well as the table. The d6 is theirs. What is
   * withheld is WHICH TABLE it reads against (first failure or second in the same fight) and
   * what the six outcomes are — both DM decisions. A MONSTER's nat 1 is fully table-facing,
   * because those create openings the party is meant to see.
   */
  const critFailBelongsToTable = !isPlayerMode || isMonsterActor;
  const isAttackCrit = committedRoll.outcomeMode === "attack-roll" && committedRoll.isCrit;
  const hasNaturalGateNotice = committedRoll.outcomeMode === "attack-roll" && committedRoll.phase !== "committed" && Boolean(committedRoll.rollResult);

  const canShowResultControls = committedRoll.phase === "committed" || committedRoll.phase === "result-held";
  const showResultEntry = committedRoll.requiresRollResult && canShowResultControls && (!bridgeResultReceived || manualEntryOpen);
  const showBridgeResultNotice = committedRoll.requiresRollResult && bridgeResultReceived && !manualEntryOpen;
  const showDevTestRoll = canShowDevTestRoll && committedRoll.requiresRollResult && !bridgeResultReceived;
  const showMockTools = isBuilderMode && committedRoll.requiresRollResult && !bridgeResultReceived && mockToolsOpen;
  const attackCritAutoHit = isAttackCrit && committedRoll.rulesProfile.naturalAttack20AutoHits;
  const showOutcomePrompt = committedRoll.phase === "result-held" && !isAttackCriticalFailure && !attackCritAutoHit;
  // Show reroll prompt if:
  //   - old generic flag is set, OR
  //   - there are available reroll sources from items/features
  const hasRerollSources = rerollSources.length > 0;
  const showRerollPrompt = showOutcomePrompt &&
    (committedRoll.outcomeMode === "attack-roll" || committedRoll.outcomeMode === "ability-check") &&
    (canShowGenericReroll || hasRerollSources);
  const showHeldResult = committedRoll.phase !== "committed";
  const outcomeCopy =
    committedRoll.outcomeMode === "ability-check"
      ? { hit: "Pass", miss: "Fail" }
      : committedRoll.outcomeMode === "dc-check"
        ? { hit: "Applies", miss: "No Effect" }
        : { hit: "Hit", miss: "Miss" };

  return (
    <section className="committed-roll-panel" aria-label="Roll flow">
      <div className="committed-roll-header">
        <div>
          <p className="eyebrow">Roll Gate</p>
          <h3>{modeLabel(committedRoll.outcomeMode)} workspace</h3>
        </div>
        <span className="committed-roll-phase">{committedRoll.phase.replaceAll("-", " ")}</span>
      </div>

      <div className={`tracked-action-banner ${committedRoll.isCrit ? "crit" : ""} ${committedRoll.isCriticalFailure ? "critical-failure" : ""}`}>
        <div>
          <span className="committed-roll-label">Tracking action</span>
          <strong>{committedRoll.actionLabel}</strong>
          <span className="committed-roll-meta">{formatCosts(committedRoll.costs)} · {phaseCopy(committedRoll)}</span>
        </div>
        <span className="tracked-action-pill">{trackedActionPill(committedRoll)}</span>
      </div>

      <div className="committed-roll-body">
        {isBuilderMode && (
          <div className="committed-roll-card">
            <span className="committed-roll-label">Readied item</span>
            <strong>{committedRoll.actionLabel}</strong>
            <span className="committed-roll-meta">
              {formatCosts(committedRoll.costs)} · {flowSummary(committedRoll)}
            </span>
            {committedRoll.damageFormula && (
              <span className="committed-roll-meta">Damage/effect option: {committedRoll.damageFormula}</span>
            )}
            {committedRoll.hasCritDamageChoice && committedRoll.critDamageFormula && (
              <span className="committed-roll-meta">Crit option: {committedRoll.critDamageFormula}</span>
            )}
            {committedRoll.rerollCount > 0 && (
              <span className="committed-roll-meta">Rerolls requested: {committedRoll.rerollCount}</span>
            )}
            {committedRoll.bridgeSentCount > 0 && (
              <span className="committed-roll-meta">Dice bridge sends: {committedRoll.bridgeSentCount}</span>
            )}
          </div>
        )}

        {showDevTestRoll && (
          <div className="dev-test-roll-box" aria-label="Dev test roll harness">
            <div>
              <span className="committed-roll-label">Dev Test Roll · Builder utility</span>
              <strong>Inject Dice+ shaped result</strong>
              <span className="committed-roll-meta">Used for Nat 1 / Nat 20 / crit-threshold verification without waiting on physical dice.</span>
            </div>
            <div className="dev-test-roll-buttons">
              <button className="secondary-button compact" type="button" onClick={() => onHoldResult(formatDevTestResult(committedRoll, 1))}>
                Nat 1
              </button>
              <button className="secondary-button compact" type="button" onClick={() => onHoldResult(formatDevTestResult(committedRoll, 20))}>
                Nat 20
              </button>
              <button className="secondary-button compact quiet" type="button" onClick={() => onHoldResult(formatDevTestResult(committedRoll, 10))}>
                10
              </button>
              <button className="secondary-button compact quiet" type="button" onClick={() => setDevCustomOpen((current) => !current)}>
                Custom
              </button>
            </div>
            {devCustomOpen && (
              <div className="roll-entry-row manual-fallback">
                <label className="roll-result-label" htmlFor="dev-test-roll-result">
                  Custom dev result
                </label>
                <input
                  id="dev-test-roll-result"
                  className="roll-result-input"
                  value={resultInput}
                  onChange={(event) => setResultInput(event.target.value)}
                  placeholder="Example: nat 1 / total 7"
                />
                <button className="secondary-button compact" type="button" onClick={() => onHoldResult(resultInput)}>
                  Inject
                </button>
              </div>
            )}
          </div>
        )}

        {isBuilderMode && committedRoll.requiresRollResult && (
          <div className="dice-bridge-box">
            <div>
              <span className="committed-roll-label">External dice bridge</span>
              <strong>{bridgeStatusLabel(diceBridgeStatus)}</strong>
              <span className="committed-roll-meta">Request ID: {committedRoll.bridgeRequestId}</span>
              {diceBridgeLastEvent && <span className="committed-roll-meta">{diceBridgeLastEvent.message}</span>}
            </div>
            <span className="committed-roll-meta">
              The Roll button sends to Dice+ automatically when available. Manual entry remains available below.
            </span>

            {!bridgeResultReceived && (
              <button
                className="secondary-button compact quiet"
                type="button"
                onClick={() => setMockToolsOpen((current) => !current)}
              >
                {mockToolsOpen ? "Hide Bridge Debug" : "Bridge Debug"}
              </button>
            )}

            {showMockTools && (
              <div className="mock-result-harness" aria-label="Mock dice bridge result harness">
                <button
                  className="secondary-button compact quiet"
                  type="button"
                  onClick={onSendDiceRequest}
                  disabled={diceBridgeStatus !== "ready"}
                  title={diceBridgeStatus === "ready" ? "Broadcast this generic roll request through Owlbear" : "Bridge is only active inside Owlbear"}
                >
                  Send Generic Bridge Request
                </button>
                <span className="committed-roll-label">Mock catcher return</span>
                <div className="mock-result-row">
                  <label>
                    Nat
                    <input
                      className="mock-result-input"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      type="number"
                      value={mockNaturalRoll}
                      onChange={(event) => setMockNaturalRoll(event.target.value)}
                    />
                  </label>
                  <label>
                    Total
                    <input
                      className="mock-result-input"
                      inputMode="numeric"
                      type="number"
                      value={mockTotal}
                      onChange={(event) => setMockTotal(event.target.value)}
                      placeholder="same"
                    />
                  </label>
                </div>
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() => onSendMockDiceResult(resolvedMockNaturalRoll, resolvedMockTotal)}
                  disabled={!canSendMockResult}
                  title="Broadcast a matching result back through the Forever DM Combat result channel."
                >
                  Mock Return Result
                </button>
              </div>
            )}
          </div>
        )}

        {isBuilderMode && showBridgeResultNotice && (
          <div className="bridge-result-received-box">
            <span className="committed-roll-label">Bridge result received</span>
            <strong>{committedRoll.rollResult}</strong>
            <span className="committed-roll-meta">Result accepted from the bridge. Manual fallback is still available if it needs correction.</span>
            {bridgeWarning && <span className="bridge-result-warning">{bridgeWarning}</span>}
            <button className="secondary-button compact" type="button" onClick={() => setManualEntryOpen(true)}>
              Edit Manual Result
            </button>
          </div>
        )}

        {showResultEntry && (
          <div className={`roll-entry-row ${bridgeResultReceived ? "manual-fallback" : ""}`}>
            <label className="roll-result-label" htmlFor="committed-roll-result">
              {bridgeResultReceived ? "Manual fallback" : "Manual roll result"}
            </label>
            <input
              id="committed-roll-result"
              className="roll-result-input"
              value={resultInput}
              onChange={(event) => setResultInput(event.target.value)}
              placeholder="Example: nat 20 / total 25"
            />
            <button className="secondary-button compact" type="button" onClick={() => onHoldResult(resultInput)}>
              Hold Result
            </button>
            {bridgeResultReceived && (
              <button className="secondary-button compact quiet" type="button" onClick={() => setManualEntryOpen(false)}>
                Hide Manual
              </button>
            )}
          </div>
        )}

        {isBuilderMode && showHeldResult && (
          <p className={`committed-roll-result ${committedRoll.isCrit ? "crit" : ""} ${committedRoll.isCriticalFailure ? "critical-failure" : ""}`}>Held state: {resultSummary(committedRoll)}</p>
        )}

        {hasNaturalGateNotice && (
          <div className={`natural-roll-gate-box ${isAttackCrit ? "crit" : ""} ${isAttackCriticalFailure ? "critical-failure" : ""}`}>
            <span>{naturalRollLabel(committedRoll)}</span>
            <span>{finalTotalLabel(committedRoll)}</span>
            {naturalStatus && <strong>{naturalStatus}</strong>}
          </div>
        )}

        {isAttackCriticalFailure && committedRoll.phase === "result-held" && (
          <div className="critical-failure-pending-box">
            <span className="committed-roll-label">Nat 1 failure check</span>
            <p>
              {critFailBelongsToTable
                ? "Roll a d6 for the failure result. Monster Nat 1 results are player-visible because they create openings."
                : "Roll a d6. The DM reads what it means and resolves the complication."}
            </p>
            {/*
              ⚠ THE PLAYER ROLLS; THE PLAYER DOES NOT CHOOSE. Christopher, 2026-08-17:
              *"i said they dont get to see the options, they still get to roll the dice."*

              So the d6 row stays on every seat — it is their die. WHICH TABLE it reads against
              is a DM decision (first failure or second in the same fight), and the six outcomes
              are the DM's to know, so both are hidden from a player seat. An earlier pass of
              mine removed the whole box from players and turned a nat 1 into a bare miss, which
              took the die off them as well; this is the correction.
            */}
            {critFailBelongsToTable && (
              <div className="critical-failure-toggle-row">
                <button
                  className={`secondary-button compact ${criticalFailureKind === "standard" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setCriticalFailureKind("standard");
                    setCriticalFailureD6(null);
                  }}
                >
                  First Nat 1
                </button>
                <button
                  className={`secondary-button compact ${criticalFailureKind === "double" ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setCriticalFailureKind("double");
                    setCriticalFailureD6(null);
                  }}
                >
                  Second Nat 1
                </button>
              </div>
            )}
            <div className="critical-failure-d6-row" aria-label="Critical failure d6 result">
              {[1, 2, 3, 4, 5, 6].map((roll) => (
                <button
                  key={`critical-failure-d6-${roll}`}
                  className={`critical-failure-d6-button ${criticalFailureD6 === roll ? "active" : ""}`}
                  type="button"
                  onClick={() => setCriticalFailureD6(roll)}
                >
                  {roll}
                </button>
              ))}
            </div>
            {criticalFailureKind === "double" && critFailBelongsToTable && (
              <p className="critical-failure-note">
                Damage only exists on the second Nat 1 table when the d6 result is 6. Level 2+ actors use the non-damage replacement.
              </p>
            )}
            {/* ⚀ HAND THE MONSTER'S d6 TO A SEAT. Christopher, 2026-08-17: *"when a monster rolls
                a nat one the dm should be able to pick a seat to roll that monsters nat 1
                (togglable option for DM who dont want to do that)."*

                A monster's Nat 1 is the table-facing one — it creates an opening the party gets to
                enjoy — so letting a player roll it is a table moment rather than a mechanic. It is
                OPT-IN: a DM who would rather keep the die never sees more than this row, and the
                choice persists so it is answered once, not every fight. Naming a seat only says
                who rolls; the DM still resolves the result. */}
            {isMonsterActor && seatNames && seatNames.length > 0 && (
              <div className="critical-failure-seat-row" style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", padding: "4px 0" }}>
                <label style={{ fontSize: 10, color: "#8a8aa0", display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={Boolean(letSeatRollMonsterNat1)}
                    onChange={e => onToggleSeatRollsMonsterNat1?.(e.target.checked)} />
                  Let a player roll it
                </label>
                {letSeatRollMonsterNat1 && seatNames.map(seat => (
                  <button key={seat} type="button" className="secondary-button compact"
                    title={`Ask ${seat} to roll this monster's Nat 1 d6. You still read the table and resolve it.`}
                    onClick={() => onAskSeatToRollNat1?.(seat)}>
                    🎲 {seat}
                  </button>
                ))}
              </div>
            )}

            {/* THE SPEED-UP. *"or choose miss if a dm is looking to speed up the combat."* A
                nat 1 is a miss whatever the d6 says, so the table roll is optional — skipping
                it resolves the attack immediately instead of stalling the turn on a lookup. */}
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => onChooseOutcome("miss")}
              title="A Nat 1 is a miss regardless — resolve it now and skip the failure table"
            >
              Skip the table — just a miss
            </button>
            {(() => {
              const selectedEntry = typeof criticalFailureD6 === "number" ? getCriticalFailureEntry(criticalFailureKind, criticalFailureD6) : null;
              const canSeeTable = !isPlayerMode || isMonsterActor;
              if (!selectedEntry) {
                return <p className="critical-failure-note">Waiting on d6 result.</p>;
              }

              return (
                <div className="critical-failure-selected-result">
                  <span className="critical-failure-roll">{selectedEntry.roll}</span>
                  {canSeeTable ? (
                    <>
                      <strong>{selectedEntry.title}</strong>
                      <span>{selectedEntry.dmEffect}</span>
                      {selectedEntry.damageClause && <em>{selectedEntry.damageClause}</em>}
                    </>
                  ) : (
                    <>
                      <strong>Result hidden from player</strong>
                      <span>The DM sees the table result and resolves the complication.</span>
                    </>
                  )}
                  <button
                    className="roll-prompt-button suggested"
                    type="button"
                    onClick={() => {
                      if (onResolveCriticalFailure) {
                        onResolveCriticalFailure(selectedEntry, criticalFailureKind);
                      } else {
                        onChooseOutcome("miss");
                      }
                    }}
                  >
                    Apply d6 Result / Mark Used
                  </button>
                </div>
              );
            })()}
            {(!isPlayerMode || isMonsterActor) && (
              <details className="critical-failure-dm-table">
                <summary>DM table reference</summary>
                <div className="critical-failure-table-grid">
                  {getCriticalFailureEntries(criticalFailureKind).map((entry) => (
                    <div key={`${criticalFailureKind}-${entry.id}`} className="critical-failure-entry-button static">
                      <span className="critical-failure-roll">{entry.roll}</span>
                      <strong>{entry.title}</strong>
                      <span>{entry.dmEffect}</span>
                      {entry.damageClause && <em>{entry.damageClause}</em>}
                    </div>
                  ))}
                </div>
              </details>
            )}
            <button className="roll-prompt-button quiet" type="button" onClick={() => onChooseOutcome("miss")}>
              Simple Miss / Mark Used
            </button>
          </div>
        )}

        {showOutcomePrompt && (
          <div className="roll-prompt-row">
            <button className={`roll-prompt-button ${committedRoll.isCrit ? "suggested" : ""}`} type="button" onClick={() => onChooseOutcome("hit")}>
              {committedRoll.isCrit ? `CRIT! ${formatCritThreshold(committedRoll.critThreshold)} Hit` : outcomeCopy.hit}
            </button>
            <button className="roll-prompt-button" type="button" onClick={() => onChooseOutcome("miss")}>
              {outcomeCopy.miss}
            </button>
            {showRerollPrompt && !showRerollPicker && (
              <button
                className="roll-prompt-button"
                type="button"
                onClick={() => {
                  if (hasRerollSources) {
                    setShowRerollPicker(true);
                    setRerollNewResult(null);
                  } else {
                    onChooseOutcome("reroll");
                  }
                }}
              >
                ↺ Reroll
                {hasRerollSources && (
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>
                    ({rerollSources.filter(s => s.kind !== "dm").length} source{rerollSources.filter(s => s.kind !== "dm").length === 1 ? "" : "s"} + DM)
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {/* ── Reroll source picker ── */}
        {showRerollPicker && (
          <div style={{ margin: "8px 0" }}>
            <RerollSourcePicker
              sources={rerollSources}
              originalResult={committedRoll.rollResult ?? ""}
              newResult={rerollNewResult}
              onReroll={(source) => {
                onRerollWithSource?.(source);
              }}
              onKeepOriginal={() => {
                setShowRerollPicker(false);
                setRerollNewResult(null);
              }}
              onCancel={() => {
                setShowRerollPicker(false);
                setRerollNewResult(null);
              }}
              onPickResult={(result) => {
                // Player picked a result — apply it as the held result
                setShowRerollPicker(false);
                setRerollNewResult(null);
                onHoldResult(result);
              }}
            />
          </div>
        )}

        {committedRoll.phase === "awaiting-damage" && (
          <div className="roll-prompt-row">
            {!committedRoll.isCrit && committedRoll.hasDamageChoice && (
              <button className="roll-prompt-button" type="button" onClick={() => onChooseDamage("damage")}>
                {/* A DC-check with no authored formula still reaches this step (see
                    useCommittedRollState) so the save does not dead-end. The label says which
                    case it is, because "Damage / Effect" with nothing after it looks broken. */}
                Damage / Effect {committedRoll.damageFormula
                  ? `(${committedRoll.damageFormula})`
                  : "— roll it at the table"}
              </button>
            )}
            {committedRoll.isCrit && committedRoll.hasCritDamageChoice && (
              <button
                className="roll-prompt-button crit-damage-button suggested"
                type="button"
                onClick={() => onChooseDamage("crit")}
              >
                {`CRIT! ${formatCritThreshold(committedRoll.critThreshold)} Damage`} {committedRoll.critDamageFormula ? `(${committedRoll.critDamageFormula})` : ""}
              </button>
            )}
            {committedRoll.isCrit && !committedRoll.hasCritDamageChoice && committedRoll.hasDamageChoice && (
              <button className="roll-prompt-button crit-damage-button suggested" type="button" onClick={() => onChooseDamage("damage")}>
                Crit Detected — Use Damage Formula {committedRoll.damageFormula ? `(${committedRoll.damageFormula})` : ""}
              </button>
            )}
          </div>
        )}

        {committedRoll.phase === "awaiting-resolution" && (
          <div className="roll-resolution-box">
            <p>
              Ready to mark used: {committedRoll.outcome === "hit" ? committedRoll.damageChoice ?? "applies" : committedRoll.outcome}.
            </p>
            <button className="roll-resolve-button" type="button" onClick={onResolve}>
              Mark Used
            </button>
          </div>
        )}

        {attackUseState && attackUseState.max > 1 && attackUseState.current < attackUseState.max && onNextAttack && (
          <div className="next-attack-prompt">
            <p className="multi-attack-progress">
              Attack {attackUseState.current} of {attackUseState.max} resolved - Main slot still available
            </p>
            <button
              className="next-attack-button"
              type="button"
              onClick={onNextAttack}
            >
              Next Attack ({attackUseState.current + 1} of {attackUseState.max})
            </button>
          </div>
        )}

        <div className="roll-reset-row">
          <button className="secondary-button compact quiet" type="button" onClick={onReset}>
            Reset Roll
          </button>
        </div>

      </div>
    </section>
  );
}
