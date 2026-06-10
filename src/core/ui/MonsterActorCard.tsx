/**
 * MonsterActorCard
 *
 * Built strictly from fdmc-monster-lane-clean-model-0.5.8 docs:
 *   CLAUSE-ONE-BOX-HANDOFF.txt
 *   MONSTER-CARD-SECTIONS-MODEL.md
 *   MONSTER-ACTION-PANEL-CLEAN-MODEL.md
 *   MONSTER-ACTION-COUNTER-MODEL.md
 *   PLAYER-SAFE-MONSTER-CARD-MODEL.md
 *
 * DM card sections (in order):
 *   1. Header — name + role tag
 *   2. Stat boxes — AC / HP State / Speed / State
 *   3. Economy row — clickable dot toggles (Action, Bonus if present, Reaction)
 *   4. Actions — true action-cost actions only
 *   5. Bonus Actions — only rendered if present
 *   6. Reactions — separate, quieter section
 *   7. Resources / Recharge — small chips
 *   8. Traits — collapsed reference, not roll buttons
 *
 * Player card: name, 4 safe boxes, HP ratio bar only.
 * No exact HP, no traits, no DM controls, no action text in player view.
 *
 * Economy concept (from MONSTER-ACTION-COUNTER-MODEL.md):
 *   - One true Action slot by default
 *   - Multiattack consumes one Action, creates per-instance attack-step counter
 *   - attackCounter is scoped to THIS monster instance — never bleeds between monsters
 *   - Reaction is separate economy slot and UI section
 *   - Traits are reference, never action buttons
 */

import { useEffect, useMemo, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import {
  formatBridgeRollResult,
  type DiceBridgeEvent,
  type DiceBridgeRollRequest,
} from "../integrations/useOwlbearDiceBridge";
import type { MonsterReaderAction } from "../monsters/MonsterJconScanner";
import type { MainEncounterMonsterInstance } from "../monsters/runtime/mainMonsterRuntime";
import { deriveMonsterActionCounter } from "../monsters/runtime/mainMonsterRuntime";
import { MONSTER_COLOR, withAlpha } from "../seats/seatColors";
import { applyAdvantage, appendBonusDie, abilityCheckFormula, parseAbilityModifier, type RollMode } from "../dice/diceFormula";

const ADDITIVE_DICE = ["d4", "d6", "d8", "d10"] as const;
const DAMAGE_ADDITIVE_DICE = ["d4", "d6", "d8", "d10", "d12"] as const;

// ─── Economy broadcast ────────────────────────────────────────────────────────

export const MONSTER_ECONOMY_CHANNEL = "fdmc:monster-economy:v1";

export type MonsterEconomyBroadcast = {
  type: "fdmc:monster-economy";
  instanceId: string;
  actionUsed: boolean;
  reactionUsed: boolean;
};

function broadcastMonsterEconomy(instanceId: string, eco: { actionUsed: boolean; reactionUsed: boolean }) {
  if (!OBR.isAvailable) return;
  void OBR.broadcast.sendMessage(
    MONSTER_ECONOMY_CHANNEL,
    { type: "fdmc:monster-economy", instanceId, actionUsed: eco.actionUsed, reactionUsed: eco.reactionUsed } satisfies MonsterEconomyBroadcast,
    { destination: "REMOTE" },
  ).catch(() => undefined);
}

// ─── Props ────────────────────────────────────────────────────────────────────

type MonsterActorCardProps = {
  monster: MainEncounterMonsterInstance;
  isDmView: boolean;
  onHpChange: (patch: Partial<Pick<MainEncounterMonsterInstance, "currentHp" | "tempHp" | "status">>) => void;
  onSendDicePlusRequest?: (request: DiceBridgeRollRequest) => Promise<boolean>;
  diceBridgeLastEvent?: DiceBridgeEvent | null;
  onActionCommit?: (actionName: string) => void;
};

// ─── Internal types ───────────────────────────────────────────────────────────

// Per-instance economy state — resets on turn advance
type InstanceEconomy = {
  actionUsed: boolean;
  bonusUsed: boolean;
  reactionUsed: boolean;
  stepsUsed: number;       // attack steps used inside the current multiattack
};

type CommittedRoll = {
  actionName: string;
  actionId: string;
  attackFormula?: string;
  damageFormula?: string;
  requestId: string;
  naturalRoll?: number;
  critThreshold: number;
  result: string;
  damageResult?: string;
  phase: "pending" | "held" | "damage-pending" | "damage-held" | "done";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hpCondition(current: number, max: number): string {
  if (current <= 0) return "Down";
  const r = max > 0 ? current / max : 0;
  if (r <= 0.25) return "Critical";
  if (r <= 0.5)  return "Bloodied";
  if (r <= 0.75) return "Wounded";
  return "Healthy";
}

function conditionColor(label: string): string {
  switch (label) {
    case "Down":     return "#555";
    case "Critical": return "#ff4444";
    case "Bloodied": return "#e07b39";
    case "Wounded":  return "#f0c040";
    default:         return "#4caf50";
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "action";
}

function makeRequestId(instanceId: string, actionId: string, stage: "attack" | "damage"): string {
  return `fdm-monster-${stage}-${instanceId}-${actionId}-${Date.now()}`;
}

function normalizeFormula(v?: string): string {
  return v?.replace(/\s+/g, " ").trim() ?? "";
}

function doubleDice(formula: string): string {
  return formula.replace(/(?<![A-Za-z0-9])(\d*)d(\d+)/gi, (_m, c: string, d: string) => {
    const n = c ? Number.parseInt(c, 10) : 1;
    return `${Number.isFinite(n) ? n * 2 : 2}d${d}`;
  });
}

/**
 * Classify actions into the four card sections.
 * Priority (from MONSTER-CARD-SECTIONS-MODEL.md):
 *   1. kind === "reaction"  → reactions
 *   2. kind === "trait"     → traits
 *   3. economyCost === "bonus" → bonusActions
 *   4. everything else      → mainActions (true action-cost)
 */
function classifyActions(all: MonsterReaderAction[]) {
  const mainActions:  MonsterReaderAction[] = [];
  const bonusActions: MonsterReaderAction[] = [];
  const reactions:    MonsterReaderAction[] = [];
  const traits:       MonsterReaderAction[] = [];

  for (const a of all) {
    if (a.kind === "reaction") { reactions.push(a);    continue; }
    if (a.kind === "trait")    { traits.push(a);       continue; }
    const ec = (a as MonsterReaderAction & { economyCost?: string }).economyCost?.toLowerCase() ?? "";
    if (ec === "bonus")        { bonusActions.push(a); continue; }
    mainActions.push(a);
  }
  return { mainActions, bonusActions, reactions, traits };
}

// ─── Stat box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      padding: "6px 4px", background: "#111", borderRadius: 4,
      border: "1px solid #2a2a3e", minWidth: 0,
    }}>
      <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color ?? "#ccc" }}>{value}</span>
    </div>
  );
}

// ─── Economy dot toggle ───────────────────────────────────────────────────────
// Clicking a dot cycles: ready (green) → used (red) → ready

function EconomyDot({ label, used, onClick }: { label: string; used: boolean; onClick: () => void }) {
  const color = used ? "#ff5840" : "#4bb469";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}: ${used ? "Used — click to restore" : "Ready — click to mark used"}`}
      style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "2px 4px" }}
    >
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}88` }} />
      <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
}

// ─── Attack step tracker ──────────────────────────────────────────────────────
// Rendered inline inside the Multiattack action row

function AttackStepTracker({ total, stepsUsed, stepNames, onStepUsed, onReset }: {
  total: number;
  stepsUsed: number;
  stepNames: string[];
  onStepUsed: () => void;
  onReset: () => void;
}) {
  const remaining = total - stepsUsed;
  if (total <= 1) return null;
  return (
    <div style={{ marginTop: 5, padding: "4px 6px", background: "#1a1a12", borderRadius: 3, border: "1px solid #e07b3933" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#e07b39" }}>
          ⚡ Steps {remaining}/{total}
        </span>
        {stepNames.length > 0 ? (
          stepNames.map((name, i) => (
            <span key={i} style={{ fontSize: 10, color: i < stepsUsed ? "#444" : "#aaa", textDecoration: i < stepsUsed ? "line-through" : "none" }}>
              {name}
            </span>
          ))
        ) : (
          // No named steps — just show count dots
          Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < stepsUsed ? "#3a1a1a" : "#e07b39", border: i < stepsUsed ? "1px solid #444" : "none" }} />
          ))
        )}
        {remaining > 0 && (
          <button type="button" onClick={onStepUsed}
            style={{ fontSize: 10, padding: "1px 6px", background: "#e07b3922", border: "1px solid #e07b3944", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}>
            Use Step
          </button>
        )}
        {stepsUsed > 0 && (
          <button type="button" onClick={onReset}
            style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#555", cursor: "pointer" }}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────

type ActionCardProps = {
  action: MonsterReaderAction;
  isUsed: boolean;
  isReaction?: boolean;
  isDischarged?: boolean;   // recharge ability used this turn — locked until recharge succeeds
  committedRoll: CommittedRoll | null;
  attackCounter: ReturnType<typeof deriveMonsterActionCounter> | undefined;
  stepsUsed: number;
  onUse: (a: MonsterReaderAction) => void;
  onRollResult: (result: string) => void;
  onCommit: () => void;
  onClearRoll: () => void;
  onStepUsed: () => void;
  onStepReset: () => void;
  onRecharge?: (action: MonsterReaderAction) => void;
};

function parseRechargeRange(recharge: string): [number, number] {
  if (recharge.includes("-")) {
    const [lo, hi] = recharge.split("-").map(Number);
    return [lo, hi];
  }
  const n = Number(recharge);
  return [n, 6];
}

function rollRecharge(recharge: string): { roll: number; success: boolean } {
  const [lo, hi] = parseRechargeRange(recharge);
  const roll = Math.floor(Math.random() * 6) + 1;
  return { roll, success: roll >= lo && roll <= hi };
}

function ActionCard({
  action, isUsed, isReaction = false, isDischarged = false, committedRoll,
  attackCounter, stepsUsed,
  onUse, onRollResult, onCommit, onClearRoll,
  onStepUsed, onStepReset, onRecharge,
}: ActionCardProps) {
  const actionId = slugify(action.name);
  const isThisAction = committedRoll?.actionId === actionId;
  const isCrit = isThisAction
    && typeof committedRoll?.naturalRoll === "number"
    && committedRoll.naturalRoll >= (committedRoll.critThreshold ?? 20);
  const isMultiattack = action.name.toLowerCase() === "multiattack";
  // Multi-attack in-progress: action slot used but sub-attacks remain
  const isMultiattackInProgress = isMultiattack && attackCounter && stepsUsed > 0 && stepsUsed < attackCounter.total;
  // Sub-attacks are always re-usable during multiattack steps
  const isInMultiattackStep = !isMultiattack && attackCounter && stepsUsed > 0 && stepsUsed < attackCounter.total;
  const showRollButton = action.kind !== "trait" && (!isUsed || isInMultiattackStep) && !isThisAction && !isDischarged;

  const borderColor = isThisAction ? "#7b68ee66"
    : isDischarged ? "#5a3a0066"
    : isReaction ? "#2a2a3e66"
    : "#2a2a3e";

  const bgColor = isUsed ? "#0d0d0d"
    : isDischarged ? "#1a0e00"
    : isMultiattackInProgress ? "#1a1500"
    : isReaction ? "#111"
    : "#161622";

  return (
    <div style={{
      padding: "7px 10px", borderRadius: 4,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      marginBottom: 4,
      opacity: isUsed ? 0.5 : 1,
    }}>
      {/* Action header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: action.text ? 2 : 0 }}>
            <strong style={{ fontSize: 12, color: isDischarged ? "#e07b39" : isMultiattackInProgress ? "#e07b39" : isReaction ? "#888" : "#ddd" }}>{action.name}</strong>
            {action.recharge && (
              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: isDischarged ? "#3a1a00" : "#1a1a2e", border: `1px solid ${isDischarged ? "#e07b3966" : "#444"}`, color: isDischarged ? "#e07b39" : "#666" }}>
                Recharge {action.recharge}
              </span>
            )}
            {isMultiattackInProgress && (
              <span style={{ fontSize: 9, color: "#e07b39" }}>⚡ in progress</span>
            )}
            {action.roll && (
              <span style={{ fontSize: 10, color: "#7b68ee" }}>⚔ {action.roll}</span>
            )}
            {action.damage && (
              <span style={{ fontSize: 10, color: "#e07b39" }}>💥 {action.damage}</span>
            )}
            {action.save && (
              <span style={{ fontSize: 10, color: "#f0c040" }}>🛡 {action.save}</span>
            )}
          </div>
          {action.text && (
            <p style={{ margin: 0, fontSize: 10, color: "#555", lineHeight: 1.4 }}>
              {action.text.split("\n")[0].slice(0, 140)}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {isDischarged && action.recharge && onRecharge && (
            <button type="button" onClick={() => onRecharge(action)}
              style={{ fontSize: 10, padding: "2px 8px", background: "#3a1a00", border: "1px solid #e07b3966", borderRadius: 3, color: "#e07b39", cursor: "pointer", whiteSpace: "nowrap" }}
              title={`Roll 1d6 — needs ${action.recharge} to recharge`}>
              🎲 Recharge
            </button>
          )}
          {showRollButton && (
            <button type="button" onClick={() => onUse(action)}
              style={{
                fontSize: 10, padding: "2px 9px",
                background: isReaction ? "#2a2a2a" : "#7b68ee22",
                border: `1px solid ${isReaction ? "#444" : "#7b68ee55"}`,
                borderRadius: 3,
                color: isReaction ? "#888" : "#7b68ee",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {action.roll ? "Roll" : action.save ? "Prompt" : action.damage ? "Effect" : "Use"}
            </button>
          )}
        </div>
      </div>

      {/* Multiattack step tracker — inline, per this monster instance */}
      {isMultiattack && attackCounter && attackCounter.total > 1 && (
        <AttackStepTracker
          total={attackCounter.total}
          stepsUsed={stepsUsed}
          stepNames={attackCounter.label ? attackCounter.label.split(/[,+]/).map(s => s.trim()).filter(Boolean) : []}
          onStepUsed={onStepUsed}
          onReset={onStepReset}
        />
      )}

      {/* Committed roll result panel */}
      {isThisAction && committedRoll && (
        <div style={{ marginTop: 6, padding: "6px 8px", background: "#0d0d14", borderRadius: 3, border: `1px solid ${isCrit ? "#f0c040" : "#7b68ee33"}` }}>
          {committedRoll.phase === "pending" && (
            <p style={{ margin: 0, fontSize: 11, color: "#7b68ee" }}>⏳ Waiting for Dice+…</p>
          )}
          {(committedRoll.phase === "held") && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: isCrit ? "#f0c040" : "#fff" }}>
                {isCrit ? "⚡ CRIT " : ""}{committedRoll.result}
              </span>
              {committedRoll.damageFormula ? (
                <>
                  <button type="button" onClick={onCommit}
                    style={{ fontSize: 11, padding: "2px 8px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
                    Hit → {isCrit ? doubleDice(committedRoll.damageFormula) : committedRoll.damageFormula}
                  </button>
                  <button type="button" onClick={onClearRoll}
                    style={{ fontSize: 10, padding: "2px 5px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                    Miss
                  </button>
                </>
              ) : (
                <button type="button" onClick={onCommit}
                  style={{ fontSize: 11, padding: "2px 8px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
                  Commit
                </button>
              )}
              {/* Manual override */}
              <input type="text" placeholder="Override…"
                onKeyDown={e => { if (e.key === "Enter") onRollResult((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; }}
                style={{ width: 80, fontSize: 10, padding: "2px 5px", background: "#111", border: "1px solid #333", borderRadius: 3, color: "#aaa" }} />
            </div>
          )}
          {committedRoll.phase === "damage-pending" && (
            <p style={{ margin: 0, fontSize: 11, color: "#e07b39" }}>⏳ Waiting for damage…</p>
          )}
          {committedRoll.phase === "damage-held" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e07b39" }}>💥 {committedRoll.damageResult}</span>
              <button type="button" onClick={onCommit}
                style={{ fontSize: 11, padding: "2px 8px", background: "#8b0000", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
                Apply
              </button>
              <button type="button" onClick={onClearRoll}
                style={{ fontSize: 10, padding: "2px 5px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#555", cursor: "pointer" }}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ text, count, collapsible, open, onToggle }: {
  text: string; count: number; collapsible?: boolean; open?: boolean; onToggle?: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 4px" }}>
      <span style={{ fontSize: 9, color: "#7b68ee88", textTransform: "uppercase", letterSpacing: 1.2 }}>{text}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#444", background: "#1a1a2e", padding: "1px 5px", borderRadius: 8 }}>{count}</span>
        {collapsible && (
          <button type="button" onClick={onToggle}
            style={{ fontSize: 9, padding: "1px 5px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 3, color: "#444", cursor: "pointer" }}>
            {open ? "▲" : "▼"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MonsterActorCard({
  monster,
  isDmView,
  onHpChange,
  onSendDicePlusRequest,
  diceBridgeLastEvent = null,
  onActionCommit,
}: MonsterActorCardProps) {
  // ── Local state ─────────────────────────────────────────────────────────────
  const [currentHp, setCurrentHp] = useState(monster.currentHp);
  const [displayMaxHp, setDisplayMaxHp] = useState(monster.maxHp);
  const [hpInput, setHpInput] = useState("5");
  const [economy, setEconomy] = useState<InstanceEconomy>({
    actionUsed: false, bonusUsed: false, reactionUsed: false, stepsUsed: 0,
  });
  const [committedRoll, setCommittedRoll] = useState<CommittedRoll | null>(null);
  // adv/normal/disadv applies to every d20 the card sends — action attacks AND ability checks
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  // one-off additive bonus die (e.g. Bless/Guidance) that rides the NEXT d20 roll, then clears
  const [pendingAdditive, setPendingAdditive] = useState<string | null>(null);
  // one-off additive die that rides the NEXT damage roll, then clears
  const [pendingDamageDie, setPendingDamageDie] = useState<string | null>(null);
  const [additiveOpen, setAdditiveOpen] = useState(false);
  const [usedActionIds, setUsedActionIds] = useState<Set<string>>(() => new Set());
  // rechargedActionIds — actions with recharge that have been USED this turn and not yet recharged
  const [dischargedActionIds, setDischargedActionIds] = useState<Set<string>>(() => new Set());
  const [traitsOpen, setTraitsOpen] = useState(false);

  // ── Sync live HP from parent (both current and max — hpVariant scaling) ────
  useEffect(() => {
    setCurrentHp(monster.currentHp);
    setDisplayMaxHp(monster.maxHp);
  }, [monster.currentHp, monster.maxHp, monster.instanceId]);

  // ── Reset on turn advance broadcast ────────────────────────────────────────
  useEffect(() => {
    if (!OBR.isAvailable) return;
    return OBR.broadcast.onMessage("fdmc:monster-turn-reset", (event) => {
      const msg = event.data as { type?: string; instanceId?: string } | undefined;
      if (msg?.instanceId === monster.instanceId) {
        setEconomy({ actionUsed: false, bonusUsed: false, reactionUsed: false, stepsUsed: 0 });
        setUsedActionIds(new Set());
        setCommittedRoll(null);
      }
    });
  }, [monster.instanceId]);

  // ── Receive economy updates from other windows (popout ↔ inline card) ──────
  useEffect(() => {
    if (!OBR.isAvailable) return;
    return OBR.broadcast.onMessage(MONSTER_ECONOMY_CHANNEL, (event) => {
      const msg = event.data as MonsterEconomyBroadcast | undefined;
      if (msg?.type !== "fdmc:monster-economy" || msg.instanceId !== monster.instanceId) return;
      // Update local state without re-broadcasting (avoids echo loop)
      setEconomy(e => ({ ...e, actionUsed: msg.actionUsed, reactionUsed: msg.reactionUsed }));
    });
  }, [monster.instanceId]);

  // ── Dice+ result listener ───────────────────────────────────────────────────
  useEffect(() => {
    if (diceBridgeLastEvent?.kind !== "result-received" || !committedRoll) return;
    if (diceBridgeLastEvent.result?.requestId !== committedRoll.requestId) return;
    const formatted = formatBridgeRollResult(diceBridgeLastEvent.result);
    if (!formatted) return;
    if (committedRoll.phase === "pending") {
      setCommittedRoll(r => r && { ...r, result: formatted, naturalRoll: diceBridgeLastEvent.result?.naturalRoll, phase: "held" });
    } else if (committedRoll.phase === "damage-pending") {
      setCommittedRoll(r => r && { ...r, damageResult: formatted, phase: "damage-held" });
    }
  }, [diceBridgeLastEvent, committedRoll]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const condition = hpCondition(currentHp, displayMaxHp);
  const hpRatio = displayMaxHp > 0 ? Math.max(0, Math.min(1, currentHp / displayMaxHp)) : 0;

  const publicName = (isDmView || monster.isNameRevealed)
    ? (monster.revealedName || monster.displayName || monster.name)
    : (monster.hiddenName || "Unknown creature");

  // actionCounter is derived from THIS monster's template only
  const actionCounter = useMemo(
    () => deriveMonsterActionCounter(monster.actions ?? []),
    [monster.actions],
  );

  const allActions = useMemo(
    () => [...(monster.actions ?? []), ...(monster.reactions ?? []), ...(monster.traits ?? [])],
    [monster.actions, monster.reactions, monster.traits],
  );

  const { mainActions, bonusActions, reactions, traits } = useMemo(
    () => classifyActions(allActions),
    [allActions],
  );

  const hasBonusActions = bonusActions.length > 0;

  // Log panel removed (P8) — addLog kept as no-op since the encounter log handles all tracking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function addLog(_msg: string) { /* noop — log strip removed, tracked via encounter log */ }

  // ── HP controls ─────────────────────────────────────────────────────────────
  function adjustHp(delta: number) {
    const next = Math.max(0, Math.min(displayMaxHp, currentHp + delta));
    setCurrentHp(next);
    onHpChange({ currentHp: next, status: next <= 0 ? "down" : monster.status });
    addLog(`${publicName} ${delta > 0 ? "healed" : "took"} ${Math.abs(delta)} ${delta > 0 ? "HP" : "damage"}.`);
  }

  // ── Action commit flow ──────────────────────────────────────────────────────
  async function handleUseAction(action: MonsterReaderAction) {
    const actionId = slugify(action.name);
    // adv/disadv rewrites the d20 portion of the attack roll only — damage is untouched
    let attackFormula = applyAdvantage(normalizeFormula(action.roll), rollMode);
    // a pending additive die rides this roll only when there's an actual d20 attack to roll
    if (attackFormula && pendingAdditive) {
      attackFormula = appendBonusDie(attackFormula, pendingAdditive);
      setPendingAdditive(null);
    }
    const damageFormula = normalizeFormula(action.damage);
    const requestId = makeRequestId(monster.instanceId, actionId, "attack");
    const roll: CommittedRoll = {
      actionName: action.name,
      actionId,
      attackFormula: attackFormula || undefined,
      damageFormula: damageFormula || undefined,
      requestId,
      critThreshold: (action as MonsterReaderAction & { critThreshold?: number }).critThreshold ?? 20,
      result: "",
      phase: attackFormula ? "pending" : "held",
    };
    setCommittedRoll(roll);
    // Mark economy slot and broadcast
    setEconomy(e => {
      const next = action.kind === "reaction"
        ? { ...e, reactionUsed: true }
        : (action as MonsterReaderAction & { economyCost?: string }).economyCost?.toLowerCase() === "bonus"
          ? { ...e, bonusUsed: true }
          : { ...e, actionUsed: true };
      broadcastMonsterEconomy(monster.instanceId, next);
      return next;
    });
    // Mark recharge action as discharged — requires recharge roll to re-enable
    if (action.recharge) {
      setDischargedActionIds(prev => new Set([...prev, slugify(action.name)]));
    }
    addLog(`${publicName} readies ${action.name}.`);
    if (attackFormula && onSendDicePlusRequest) {
      const req: DiceBridgeRollRequest = {
        protocol: "forever-dm-combat.roll.request.v1",
        requestId,
        source: "Forever DM Combat",
        actorId: monster.instanceId,
        actorName: publicName,
        actionId,
        actionName: action.name,
        formula: attackFormula,
        outcomeMode: "attack-roll",
        critThreshold: roll.critThreshold,
        sentAt: new Date().toISOString(),
      };
      const sent = await onSendDicePlusRequest(req);
      if (!sent) addLog(`Dice+ unavailable — enter result manually.`);
    }
  }

  function handleRollResult(result: string) {
    if (!result.trim() || !committedRoll) return;
    if (committedRoll.phase === "pending" || committedRoll.phase === "held") {
      setCommittedRoll(r => r && { ...r, result: result.trim(), phase: "held" });
    } else if (committedRoll.phase === "damage-pending" || committedRoll.phase === "damage-held") {
      setCommittedRoll(r => r && { ...r, damageResult: result.trim(), phase: "damage-held" });
    }
  }

  async function handleCommit() {
    if (!committedRoll) return;
    const isCrit = typeof committedRoll.naturalRoll === "number" && committedRoll.naturalRoll >= committedRoll.critThreshold;
    if (committedRoll.phase === "held" && committedRoll.damageFormula) {
      let dmgFormula = isCrit ? doubleDice(committedRoll.damageFormula) : committedRoll.damageFormula;
      // One-off damage additive die (from the Additive control) rides this roll, then clears.
      if (pendingDamageDie) {
        dmgFormula = appendBonusDie(dmgFormula, pendingDamageDie);
        setPendingDamageDie(null);
      }
      const dmgId = makeRequestId(monster.instanceId, committedRoll.actionId, "damage");
      setCommittedRoll(r => r && { ...r, phase: "damage-pending", requestId: dmgId });
      if (onSendDicePlusRequest) {
        await onSendDicePlusRequest({
          protocol: "forever-dm-combat.roll.request.v1",
          requestId: dmgId,
          source: "Forever DM Combat",
          actorId: monster.instanceId,
          actorName: publicName,
          actionId: committedRoll.actionId,
          actionName: `${committedRoll.actionName} damage`,
          formula: dmgFormula,
          outcomeMode: "triggered",
          sentAt: new Date().toISOString(),
        });
      }
      return;
    }
    // Final commit
    const result = committedRoll.damageResult ?? committedRoll.result;
    setUsedActionIds(prev => new Set([...prev, committedRoll.actionId]));
    // Hit during multiattack — auto-advance step so next sub-attack is available
    if (committedRoll.actionId !== "multiattack"
        && actionCounter && economy.stepsUsed < actionCounter.total) {
      setEconomy(e => ({ ...e, stepsUsed: Math.min(e.stepsUsed + 1, actionCounter.total) }));
    }
    addLog(`${publicName} ${committedRoll.actionName}: ${result || "used"}.`);
    onActionCommit?.(committedRoll.actionName);
    setCommittedRoll(null);
  }

  function handleClearRoll() {
    // Miss during multiattack — auto-advance step so next sub-attack is available
    if (committedRoll?.actionId && committedRoll.actionId !== "multiattack"
        && actionCounter && economy.stepsUsed < actionCounter.total) {
      setEconomy(e => ({ ...e, stepsUsed: Math.min(e.stepsUsed + 1, actionCounter.total) }));
    }
    addLog(`${publicName} roll cleared.`);
    setCommittedRoll(null);
  }

  // ── Ability check / save roll ────────────────────────────────────────────────
  // Rolls a raw 1d20 + ability modifier (with the current adv/disadv mode) and routes
  // it through the same Dice+ bridge as actions. Result lands via the dice listener.
  const abilityChecks = useMemo(() => {
    const scores = (monster as { abilityScores?: { label: string; value: string }[] }).abilityScores ?? [];
    return scores.map((s) => ({ label: s.label, modifier: parseAbilityModifier(s.value) }));
  }, [monster]);

  const checkRoll = committedRoll && committedRoll.actionId.startsWith("check-") ? committedRoll : null;

  async function handleAbilityCheck(label: string, modifier: number) {
    const actionId = `check-${label.toLowerCase()}`;
    const checkName = `${label} Check`;
    let formula = applyAdvantage(abilityCheckFormula(modifier), rollMode);
    if (pendingAdditive) {
      formula = appendBonusDie(formula, pendingAdditive);
      setPendingAdditive(null);
    }
    const requestId = makeRequestId(monster.instanceId, actionId, "attack");
    setCommittedRoll({
      actionName: checkName,
      actionId,
      attackFormula: formula,
      requestId,
      critThreshold: 20,
      result: "",
      phase: "pending",
    });
    addLog(`${publicName} rolls a ${label} check${rollMode === "normal" ? "" : ` (${rollMode === "adv" ? "advantage" : "disadvantage"})`}.`);
    if (onSendDicePlusRequest) {
      const sent = await onSendDicePlusRequest({
        protocol: "forever-dm-combat.roll.request.v1",
        requestId,
        source: "Forever DM Combat",
        actorId: monster.instanceId,
        actorName: publicName,
        actionId,
        actionName: checkName,
        formula,
        outcomeMode: "ability-check",
        sentAt: new Date().toISOString(),
      });
      if (!sent) addLog("Dice+ unavailable — enter result manually.");
    }
  }

  // ── Player card ─────────────────────────────────────────────────────────────
  // Per PLAYER-SAFE-MONSTER-CARD-MODEL.md — 4 safe boxes + HP bar only
  if (!isDmView) {
    const showBoxes = monster.visibilityState === "condition"
      || monster.visibilityState === "hp-bar"
      || monster.visibilityState === "full";
    const showHpBar = monster.visibilityState === "hp-bar"
      || monster.visibilityState === "full"
      || monster.visibilityState === "condition";

    const monsterActions = monster.actions ?? [];
    const monsterReactions = monster.reactions ?? [];
    const allPlayerActions = [...monsterActions, ...monsterReactions];

    return (
      <article
        className="monster-actor-card player-safe"
        style={{ background: "#0d0d14", borderRadius: 6, border: "1px solid #2a2a3e", borderLeft: `3px solid ${MONSTER_COLOR}`, overflow: "hidden", cursor: allPlayerActions.length > 0 ? "pointer" : "default" }}
        onClick={() => { if (allPlayerActions.length > 0) setTraitsOpen(o => !o); }}
      >
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 13, color: "#ccc" }}>{publicName}</h3>
          {allPlayerActions.length > 0 && (
            <span style={{ fontSize: 10, color: "#444" }}>{traitsOpen ? "▲" : "▼"} actions</span>
          )}
        </div>
        {showBoxes && (
          <div style={{ display: "flex", gap: 4, padding: "8px 12px" }}>
            <StatBox label="AC"       value={String(monster.ac ?? "—")} />
            <StatBox label="HP State" value={condition} color={conditionColor(condition)} />
            <StatBox label="Speed"    value={monster.speed ?? "—"} />
            <StatBox label="State"    value={monster.status?.trim() || "—"} />
          </div>
        )}
        {showHpBar && (
          <div style={{ padding: "0 12px 8px" }}>
            <div style={{ height: 4, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${hpRatio * 100}%`, background: conditionColor(condition), borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          </div>
        )}
        {traitsOpen && allPlayerActions.length > 0 && (() => {
          // Count by category — never expose action names to players
          const bonusCount = monsterActions.filter(a => (a as MonsterReaderAction & { economyCost?: string }).economyCost?.toLowerCase() === "bonus").length;
          const specialCount = monsterActions.filter(a => a.kind === "trait").length;
          const actionCount = monsterActions.length - bonusCount - specialCount;
          const reactionCount = monsterReactions.length;
          return (
            <div style={{ padding: "6px 12px 8px", borderTop: "1px solid #1a1a2e", display: "flex", flexWrap: "wrap", gap: 5 }}>
              {actionCount > 0 && Array.from({ length: actionCount }).map((_, i) => (
                <span key={`act-${i}`} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: "#1a1a2e", border: "1px solid #2a2a4e", color: "#aaa" }}>
                  Action
                </span>
              ))}
              {bonusCount > 0 && Array.from({ length: bonusCount }).map((_, i) => (
                <span key={`bon-${i}`} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: "#1a1500", border: "1px solid #e07b3944", color: "#e07b39" }}>
                  Bonus
                </span>
              ))}
              {reactionCount > 0 && Array.from({ length: reactionCount }).map((_, i) => (
                <span key={`rea-${i}`} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: "#1a1a2e", border: "1px solid #7b68ee44", color: "#7b68ee" }}>
                  Reaction
                </span>
              ))}
              {specialCount > 0 && Array.from({ length: specialCount }).map((_, i) => (
                <span key={`spc-${i}`} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: "#1a0a1a", border: "1px solid #9b59b644", color: "#9b59b6" }}>
                  Special
                </span>
              ))}
            </div>
          );
        })()}
      </article>
    );
  }

  // ── DM card ──────────────────────────────────────────────────────────────────
  return (
    <article className="monster-actor-card dm-card"
      style={{ background: "#0d0d14", borderRadius: 6, border: "1px solid #2a2a3e", borderLeft: `3px solid ${MONSTER_COLOR}`, overflow: "hidden" }}>

      {/* 1. Header — GM/monster red identity so it never reads as a party card */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a1a2e", background: withAlpha(MONSTER_COLOR, 0.08), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: "0 0 1px", fontSize: 14, color: "#fff" }}>{publicName}</h3>
          {monster.displayName && monster.displayName !== publicName && (
            <span style={{ fontSize: 10, color: "#444" }}>{monster.displayName}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: MONSTER_COLOR, background: withAlpha(MONSTER_COLOR, 0.14), border: `1px solid ${withAlpha(MONSTER_COLOR, 0.4)}`, padding: "2px 7px", borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {monster.kind ?? "monster"}
          </span>
          {monster.visibilityState && monster.visibilityState !== "full" && (
            <span style={{ fontSize: 9, color: "#555", background: "#0d0d14", border: "1px solid #2a2a2a", padding: "1px 5px", borderRadius: 3 }}>
              {monster.visibilityState}
            </span>
          )}
        </div>
      </div>

      {/* 2. Stat boxes */}
      <div style={{ display: "flex", gap: 4, padding: "8px 12px 4px" }}>
        <StatBox label="AC"       value={String(monster.ac ?? "—")} />
        <StatBox label="HP State" value={condition} color={conditionColor(condition)} />
        <StatBox label="Speed"    value={monster.speed ?? "—"} />
        <StatBox label="State"    value={monster.status?.trim() || "—"} />
      </div>

      {/* HP bar + exact HP + quick controls */}
      <div style={{ padding: "4px 12px 8px" }}>
        <div style={{ height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden", marginBottom: 5 }}>
          <div style={{ height: "100%", width: `${hpRatio * 100}%`, background: conditionColor(condition), borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: conditionColor(condition), fontVariantNumeric: "tabular-nums", minWidth: 60 }}>
            {currentHp}/{displayMaxHp} HP
          </span>
          {monster.tempHp > 0 && (
            <span style={{ fontSize: 10, color: "#4caf50" }}>+{monster.tempHp} temp</span>
          )}
          <div style={{ flex: 1 }} />
          <input
            type="number" min={1} value={hpInput}
            onChange={e => setHpInput(e.target.value)}
            style={{ width: 38, padding: "1px 4px", fontSize: 11, textAlign: "center", background: "#111", border: "1px solid #333", borderRadius: 3, color: "#aaa" }}
          />
          <button type="button"
            onClick={() => adjustHp(Number.parseInt(hpInput, 10) || 0)}
            style={{ fontSize: 11, padding: "1px 8px", background: "#1a3a1a", border: "1px solid #2a6e2a44", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}>
            +
          </button>
          <button type="button"
            onClick={() => adjustHp(-(Number.parseInt(hpInput, 10) || 0))}
            style={{ fontSize: 11, padding: "1px 8px", background: "#3a1a1a", border: "1px solid #5a1a1a44", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
            −
          </button>
        </div>
      </div>

      <div style={{ padding: "0 12px 12px" }}>

        {/* Additive bonus — one-off +1dX onto the next d20 roll and/or the next damage roll */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setAdditiveOpen(o => !o)}
            title="Flag a one-off bonus die onto the next roll and/or next damage roll"
            style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
              background: additiveOpen ? withAlpha("#7b68ee", 0.18) : "transparent",
              border: `1px solid ${additiveOpen ? "#7b68ee" : "#2a2a2a"}`, color: additiveOpen ? "#9d8cff" : "#666" }}>
            + Additive
          </button>
          {pendingAdditive && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, padding: "2px 4px 2px 8px", borderRadius: 10, background: withAlpha("#7b68ee", 0.15), border: "1px solid #7b68ee55", color: "#9d8cff" }}>
              roll +1{pendingAdditive}
              <button type="button" onClick={() => setPendingAdditive(null)} title="Clear roll additive"
                style={{ background: "transparent", border: "none", color: "#9d8cff", cursor: "pointer", fontSize: 10, lineHeight: 1, padding: 0 }}>
                ✕
              </button>
            </span>
          )}
          {pendingDamageDie && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, padding: "2px 4px 2px 8px", borderRadius: 10, background: withAlpha("#e07b39", 0.15), border: "1px solid #e07b3955", color: "#e9a66a" }}>
              dmg +1{pendingDamageDie}
              <button type="button" onClick={() => setPendingDamageDie(null)} title="Clear damage additive"
                style={{ background: "transparent", border: "none", color: "#e9a66a", cursor: "pointer", fontSize: 10, lineHeight: 1, padding: 0 }}>
                ✕
              </button>
            </span>
          )}
          {additiveOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "5px 7px", border: "1px solid #2a2a3e", borderRadius: 5, background: "#13131f" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, color: "#9d8cff", minWidth: 58 }}>To roll</span>
                {ADDITIVE_DICE.map((die) => (
                  <button key={die} type="button" onClick={() => { setPendingAdditive(die); setAdditiveOpen(false); }}
                    style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, cursor: "pointer", background: "#111", border: "1px solid #2a2a3e", color: "#9d8cff" }}>
                    +1{die}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, color: "#e9a66a", minWidth: 58 }}>To damage</span>
                {DAMAGE_ADDITIVE_DICE.map((die) => (
                  <button key={die} type="button" onClick={() => { setPendingDamageDie(die); setAdditiveOpen(false); }}
                    style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, cursor: "pointer", background: "#111", border: "1px solid #2a2a3e", color: "#e9a66a" }}>
                    +1{die}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Economy row — clickable dot toggles */}
        <div style={{ display: "flex", gap: 12, marginBottom: 8, padding: "5px 0", borderBottom: "1px solid #1a1a2e" }}>
          <EconomyDot label="Action"   used={economy.actionUsed}   onClick={() => { const next = { ...economy, actionUsed: !economy.actionUsed }; setEconomy(next); broadcastMonsterEconomy(monster.instanceId, next); }} />
          {hasBonusActions && (
            <EconomyDot label="Bonus"  used={economy.bonusUsed}    onClick={() => { const next = { ...economy, bonusUsed: !economy.bonusUsed }; setEconomy(next); broadcastMonsterEconomy(monster.instanceId, next); }} />
          )}
          <EconomyDot label="Reaction" used={economy.reactionUsed} onClick={() => { const next = { ...economy, reactionUsed: !economy.reactionUsed }; setEconomy(next); broadcastMonsterEconomy(monster.instanceId, next); }} />
          {/* Quick turn reset */}
          <button type="button"
            onClick={() => { const reset = { actionUsed: false, bonusUsed: false, reactionUsed: false, stepsUsed: 0 }; setEconomy(reset); broadcastMonsterEconomy(monster.instanceId, reset); setUsedActionIds(new Set()); setCommittedRoll(null); /* discharged stays — recharge roll needed */ addLog(`${publicName} turn reset.`); }}
            style={{ marginLeft: "auto", fontSize: 9, padding: "1px 7px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 3, color: "#444", cursor: "pointer" }}>
            Reset Turn
          </button>
        </div>

        {/* 3b. Ability checks & saves + advantage/disadvantage mode */}
        <div style={{ marginBottom: 8, padding: "6px 0", borderBottom: "1px solid #1a1a2e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Checks &amp; Saves</span>
            <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
              {([
                { id: "disadv", label: "Disadv", color: "#ff5840" },
                { id: "normal", label: "Normal", color: "#888" },
                { id: "adv", label: "Adv", color: "#4bb469" },
              ] as { id: RollMode; label: string; color: string }[]).map((m) => {
                const active = rollMode === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setRollMode(m.id)}
                    title={`Roll mode: ${m.label}`}
                    style={{
                      fontSize: 9, padding: "2px 7px", borderRadius: 3, cursor: "pointer",
                      background: active ? withAlpha(m.color, 0.18) : "transparent",
                      border: `1px solid ${active ? m.color : "#2a2a2a"}`,
                      color: active ? m.color : "#555",
                      fontWeight: active ? 600 : 400,
                    }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {abilityChecks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {abilityChecks.map((ab) => (
                <button key={ab.label} type="button" onClick={() => handleAbilityCheck(ab.label, ab.modifier)}
                  title={`Roll ${ab.label} check / save${rollMode === "normal" ? "" : ` with ${rollMode === "adv" ? "advantage" : "disadvantage"}`}`}
                  style={{
                    flex: "1 1 30%", minWidth: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                    padding: "4px 2px", background: "#111", border: "1px solid #2a2a3e", borderRadius: 4, cursor: "pointer",
                  }}>
                  <span style={{ fontSize: 10, color: "#999", fontWeight: 600, letterSpacing: 0.5 }}>{ab.label}</span>
                  <span style={{ fontSize: 11, color: "#7b68ee", fontVariantNumeric: "tabular-nums" }}>
                    {ab.modifier >= 0 ? `+${ab.modifier}` : ab.modifier}
                  </span>
                </button>
              ))}
            </div>
          )}
          {checkRoll && (
            <div style={{ marginTop: 6, padding: "5px 8px", background: "#0d0d14", border: "1px solid #2a2a3e", borderRadius: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "#888" }}>{checkRoll.actionName}</span>
              <strong style={{ fontSize: 12, color: checkRoll.phase === "pending" ? "#666" : "#7b68ee" }}>
                {checkRoll.phase === "pending" ? "Rolling…" : (checkRoll.result || "—")}
              </strong>
              {checkRoll.phase !== "pending" || !onSendDicePlusRequest ? (
                <input
                  type="text" placeholder="manual result"
                  onKeyDown={(e) => { if (e.key === "Enter") { handleRollResult((e.target as HTMLInputElement).value); } }}
                  onBlur={(e) => { if (e.target.value.trim()) handleRollResult(e.target.value); }}
                  style={{ width: 90, padding: "1px 4px", fontSize: 10, background: "#111", border: "1px solid #333", borderRadius: 3, color: "#aaa" }}
                />
              ) : null}
              <button type="button" onClick={() => { if (checkRoll.result) addLog(`${publicName} ${checkRoll.actionName}: ${checkRoll.result}.`); setCommittedRoll(null); }}
                style={{ marginLeft: "auto", fontSize: 9, padding: "1px 7px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 3, color: "#666", cursor: "pointer" }}>
                Clear
              </button>
            </div>
          )}
        </div>

        {/* 4. Actions — true action-cost only */}
        {mainActions.length > 0 && (
          <>
            <SectionLabel text="Actions" count={mainActions.length} />
            {mainActions.map(a => (
              <ActionCard key={a.name} action={a} isUsed={usedActionIds.has(slugify(a.name))}
                isDischarged={dischargedActionIds.has(slugify(a.name))}
                committedRoll={committedRoll?.actionId === slugify(a.name) ? committedRoll : null}
                attackCounter={actionCounter} stepsUsed={economy.stepsUsed}
                onUse={handleUseAction} onRollResult={handleRollResult}
                onCommit={handleCommit} onClearRoll={handleClearRoll}
                onStepUsed={() => setEconomy(e => ({ ...e, stepsUsed: Math.min(e.stepsUsed + 1, actionCounter?.total ?? 1) }))}
                onStepReset={() => setEconomy(e => ({ ...e, stepsUsed: 0 }))}
                onRecharge={(action) => {
                  const { roll, success } = rollRecharge(action.recharge ?? "6");
                  addLog(`${publicName} recharge roll for ${action.name}: ${roll} — ${success ? "✓ recharged!" : "✗ failed"}`);
                  if (success) setDischargedActionIds(prev => { const next = new Set(prev); next.delete(slugify(action.name)); return next; });
                }}
              />
            ))}
          </>
        )}

        {/* 5. Bonus Actions — only if present */}
        {hasBonusActions && (
          <>
            <SectionLabel text="Bonus Actions" count={bonusActions.length} />
            {bonusActions.map(a => (
              <ActionCard key={a.name} action={a} isUsed={usedActionIds.has(slugify(a.name))}
                isDischarged={dischargedActionIds.has(slugify(a.name))}
                committedRoll={committedRoll?.actionId === slugify(a.name) ? committedRoll : null}
                attackCounter={undefined} stepsUsed={0}
                onUse={handleUseAction} onRollResult={handleRollResult}
                onCommit={handleCommit} onClearRoll={handleClearRoll}
                onStepUsed={() => undefined} onStepReset={() => undefined}
              />
            ))}
          </>
        )}

        {/* 6. Reactions — separate, quieter section */}
        {reactions.length > 0 && (
          <>
            <SectionLabel text="Reactions" count={reactions.length} />
            {reactions.map(a => (
              <ActionCard key={a.name} action={a} isReaction isUsed={usedActionIds.has(slugify(a.name))}
                isDischarged={dischargedActionIds.has(slugify(a.name))}
                committedRoll={committedRoll?.actionId === slugify(a.name) ? committedRoll : null}
                attackCounter={undefined} stepsUsed={0}
                onUse={handleUseAction} onRollResult={handleRollResult}
                onCommit={handleCommit} onClearRoll={handleClearRoll}
                onStepUsed={() => undefined} onStepReset={() => undefined}
              />
            ))}
          </>
        )}

        {/* 7. Resources / Recharge — small chips derived from action text */}
        {(() => {
          const rechargeable = allActions.filter(a =>
            a.text?.toLowerCase().includes("recharge") ||
            a.name?.toLowerCase().includes("recharge") ||
            a.text?.match(/\d+\s*\/\s*(?:day|encounter|rest)/i)
          );
          if (rechargeable.length === 0) return null;
          return (
            <>
              <SectionLabel text="Resources / Recharge" count={rechargeable.length} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {rechargeable.map(a => {
                  const m = a.text?.match(/recharge\s+([\d–\-]+)/i) ?? a.name?.match(/recharge\s+([\d–\-]+)/i);
                  const d = a.text?.match(/(\d+)\s*\/\s*(day|encounter|rest)/i);
                  const badge = m ? `Recharge ${m[1]}` : d ? `${d[1]}/${d[2]}` : "Limited";
                  return (
                    <div key={a.name} style={{ display: "flex", gap: 5, padding: "2px 8px", background: "#161622", border: "1px solid #2a2a3e", borderRadius: 10, fontSize: 10 }}>
                      <span style={{ color: "#888" }}>{a.name}</span>
                      <span style={{ color: "#7b68ee66" }}>{badge}</span>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* 8. Traits — collapsed, reference only, not roll buttons */}
        {traits.length > 0 && (
          <>
            <SectionLabel text="Traits" count={traits.length} collapsible open={traitsOpen} onToggle={() => setTraitsOpen(o => !o)} />
            {traitsOpen && traits.map(a => (
              <div key={a.name} style={{ padding: "5px 8px", borderRadius: 3, background: "#111", border: "1px solid #1a1a1a", marginBottom: 3 }}>
                <strong style={{ fontSize: 10, color: "#777" }}>{a.name}</strong>
                {a.text && (
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#444", lineHeight: 1.4 }}>
                    {a.text.split("\n")[0].slice(0, 200)}
                  </p>
                )}
              </div>
            ))}
          </>
        )}

      </div>
    </article>
  );
}
