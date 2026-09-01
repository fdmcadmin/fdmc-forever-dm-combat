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

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { splitTypedDamage, damageTypeVisual } from "../constants/damageTypeVisuals";
import {
  formatBridgeRollResult,
  type DiceBridgeEvent,
  type DiceBridgeRollRequest,
} from "../integrations/useOwlbearDiceBridge";
import type { MonsterReaderAction } from "../monsters/MonsterJconScanner";
import type { MainEncounterMonsterInstance } from "../monsters/runtime/mainMonsterRuntime";
import { deriveMonsterActionCounter, isMonsterBonusAction, isMonsterSpellAction, isMonsterLegendaryAction } from "../monsters/runtime/mainMonsterRuntime";
import { CLASSIFICATION_LABEL } from "../monsters/runtime/mainMonsterRuntime";
import { CriticalFailureReference } from "./CriticalFailureReference";
import { MONSTER_COLOR, withAlpha } from "../seats/seatColors";
// The roster's tier vocabulary, reused so a boss reads the same colour on the card as in the list.
import { isHeavyTier, tierAccent, tierMark } from "./ThreatHpBar";
import { applyAdvantage, appendBonusDie, abilityCheckFormula, parseAbilityModifier, type RollMode } from "../dice/diceFormula";
import { tabAccent } from "./tabVisuals";

/** Section accents. Reuses the character sheet's tab palette so a monster's Actions /
 *  Bonus / Spells read in the same colour language as a PC's tabs. Legendary has no PC
 *  equivalent, so it borrows the bond accent — the only "this creature is special" colour. */
const SECTION_ACCENT = {
  actions:   tabAccent("main"),
  bonus:     tabAccent("bonus"),
  spells:    tabAccent("spells"),
  reactions: "#7b68ee",
  legendary: tabAccent("bond"),
  resources: tabAccent("resources"),
  /**
   * ⚠ TRAITS ARE THE ONE ACCENT THAT LEAVES THE PC PALETTE, and the doc says why (§11):
   * *"Traits are important reference material but should not compete visually with combat
   * actions."* They were carrying the features tab's green — the brightest colour on the card —
   * so the section a DM reads least shouted loudest. Muted bronze is the doc's own recommendation
   * (§7) and it is the only one of its list that fixes a stated problem rather than renaming a
   * colour that already works. Everything above stays on the character sheet's tab palette so a
   * monster's Actions / Bonus / Spells read in the same language as a PC's.
   */
  traits:    "#9a7b4f",
} as const;
import { rollFormulaLocally } from "../dice/localRoller";

/** How long a roll waits on a dice app before the math takes over. Long enough that a
 *  slow-but-working Dice+ still wins the race; short enough that the table isn't stuck. */
const LOCAL_ROLL_FALLBACK_MS = 6000;

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
  onHpChange: (patch: Partial<Pick<MainEncounterMonsterInstance, "currentHp" | "maxHp" | "tempHp" | "status" | "isNameRevealed">>) => void;
  onSendDicePlusRequest?: (request: DiceBridgeRollRequest) => Promise<boolean>;
  diceBridgeLastEvent?: DiceBridgeEvent | null;
  onActionCommit?: (actionName: string) => void;
  /** Post a "save required" call to the shared log when a save-forcing action is used. */
  onSaveCall?: (actionName: string, save: string) => void;
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
  /** Rider save text on an attack ("STR DC 14") — called after the damage roll. */
  saveRider?: string;
  /** The exact formula sent to the dice app for the CURRENT pending phase — crit-doubled
   *  and additive-appended where that applies. The local-roller fallback needs this: the
   *  damage formula is computed at commit time, so without it a timed-out damage roll has
   *  nothing to roll. */
  pendingFormula?: string;
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
// Both predicates live in mainMonsterRuntime so the card and the action-budget counter can
// never disagree about what counts as a bonus action or a spell.
const isBonusAction = isMonsterBonusAction;
const isSpellAction = isMonsterSpellAction;

function classifyActions(all: MonsterReaderAction[]) {
  const mainActions:  MonsterReaderAction[] = [];
  const bonusActions: MonsterReaderAction[] = [];
  const spells:       MonsterReaderAction[] = [];
  const reactions:    MonsterReaderAction[] = [];
  const legendary:    MonsterReaderAction[] = [];
  const traits:       MonsterReaderAction[] = [];

  for (const a of all) {
    // Reaction/trait win first — a slot-costed REACTION (Frost Ward) is still a reaction.
    if (a.kind === "reaction") { reactions.push(a);    continue; }
    if (a.kind === "trait")    { traits.push(a);       continue; }
    // A LEGENDARY action is its own economy, not a main action that happens to be tagged.
    // Without this bucket a creator-authored dragon's Detect / Tail Swipe / Pounce fell
    // through to mainActions and read as ordinary attacks on the card.
    if (isMonsterLegendaryAction(a)) { legendary.push(a); continue; }
    // Bonus beats spell: a bonus-action cantrip belongs under Bonus Actions, where its
    // economy actually lives. Its slot pill still shows on the row.
    if (isBonusAction(a))      { bonusActions.push(a); continue; }
    if (isSpellAction(a))      { spells.push(a);       continue; }
    mainActions.push(a);
  }
  return { mainActions, bonusActions, spells, reactions, legendary, traits };
}

// ─── Stat box ─────────────────────────────────────────────────────────────────

/**
 * A READOUT, NOT A BOX (playsheet pass, doc §6.3).
 *
 * *"Shrink the current wide AC / HP State / Speed / State boxes... The goal is less unused space,
 * not fewer functions."* Label above value spent a whole stacked box on four short readouts, so
 * the label moved beside the value — the playsheets' own grammar.
 *
 * ⚠ THEN THE BOX ITSELF WENT. Christopher: *"ac/hp/speed/state being on a black background"*, and
 * *"there is still too many grey on black boxes"*. Four `#111` panels with `#2a2a3e` borders sat
 * on a `#0d0d14` card, so the creature's four most-read numbers were framed as four separate
 * objects rather than as one line of a statblock. They are dividers now: same information, same
 * row, no chrome. A printed statblock does not put a box round AC either.
 */
function StatBox({ label, value, color, last }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 5, minWidth: 0,
      paddingRight: last ? 0 : 10, marginRight: last ? 0 : 10,
      borderRight: last ? undefined : "1px solid rgba(255, 255, 255, 0.07)",
    }}>
      <span style={{ fontSize: 8, color: "#5a5a6a", textTransform: "uppercase", letterSpacing: 1, lineHeight: 1.2, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 12.5, fontWeight: 700, color: color ?? "#ccc", lineHeight: 1.25,
        minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value}</span>
    </div>
  );
}

/**
 * ⚠ A CONTROL THAT IS NOT DOING ANYTHING SHOULD NOT LOOK LIKE A BOX.
 *
 * Christopher: *"there is still too many grey on black boxes like the additive/reset/unchosen
 * dis&advantage."* Every one of those carried a 1px grey border and a dark fill whether or not it
 * was active, so a row of four idle controls read as four objects competing with the creature's
 * actual state — and the two that WERE meaningful (a readied additive, the active roll mode) had
 * to shout over them.
 *
 * Inactive is now text on the card's own ground; the border and fill arrive when the control is ON
 * — which is exactly when they carry information. Hover lives in `.fdmc-ghost-btn` in styles.css,
 * because an inline style cannot express `:hover`.
 */
function ghostStyle(active: boolean, accent = "#7b68ee"): CSSProperties | undefined {
  if (!active) return undefined;
  return {
    background: withAlpha(accent, 0.16),
    borderColor: withAlpha(accent, 0.55),
    color: accent,
    fontWeight: 600,
  };
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 - n % 10 === 10 ? 0 : n % 10)] ?? "th"}`;

// ─── Action budget — the attacks-per-turn dots ────────────────────────────────
// Replaces the old single "Action" dot + Multiattack step tracker. One filled dot per
// action used; empty per action still available. Clicking a dot sets the budget to it.
function ActionBudget({ max, used, onSet }: { max: number; used: number; onSet: (n: number) => void }) {
  const remaining = Math.max(0, max - used);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: max }).map((_, i) => {
          const spent = i < used;
          const color = spent ? "#ff5840" : "#4bb469";
          return (
            <button key={i} type="button"
              onClick={() => onSet(spent ? i : i + 1)}
              title={`Action ${i + 1} of ${max} — ${spent ? "used, click to restore" : "available, click to mark used"}`}
              style={{ width: 12, height: 12, borderRadius: "50%", background: color, border: "none", padding: 0, cursor: "pointer", boxShadow: `0 0 6px ${color}88` }} />
          );
        })}
      </div>
      <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
        {max > 1 ? `Actions · ${remaining} left` : "Action"}
      </span>
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
  /** Slots left for this action's spell level (null = doesn't cost a slot). */
  slotRemaining?: number | null;
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

// Traits are reference text a DM reads mid-fight (auras, resistances, save riders). Same
// deal as action text: it was clipped at 200 chars with no way to see the rest.
function TraitCard({ name, text }: { name: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const full = (text ?? "").trim();
  const isClipped = full.length > 200 || full.includes("\n");
  const shown = open || !isClipped ? full : `${full.split("\n")[0].slice(0, 200).trimEnd()}…`;
  return (
    <div style={{ padding: "5px 8px", borderRadius: 3, background: "#111", border: "1px solid #1a1a1a", marginBottom: 3 }}>
      <strong style={{ fontSize: 10, color: "#777" }}>{name}</strong>
      {full && (
        <p
          onClick={isClipped ? () => setOpen(v => !v) : undefined}
          title={isClipped ? (open ? "Click to collapse" : "Click to read the full text") : undefined}
          style={{
            margin: "2px 0 0", fontSize: 10, color: open ? "#8a8a9a" : "#444", lineHeight: 1.4,
            whiteSpace: "pre-wrap", cursor: isClipped ? "pointer" : "default",
          }}
        >
          {shown}
          {isClipped && (
            <span style={{ color: "#7b68ee", marginLeft: 6, fontWeight: 600, whiteSpace: "nowrap" }}>
              {open ? "less" : "more"}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function ActionCard({
  action, isUsed, isReaction = false, isDischarged = false, slotRemaining = null, committedRoll,
  attackCounter, stepsUsed,
  onUse, onRollResult, onCommit, onClearRoll,
  onStepUsed, onStepReset, onRecharge,
}: ActionCardProps) {
  const actionId = slugify(action.name);
  // Per-action expand for the rules text (see the description block below).
  const [textExpanded, setTextExpanded] = useState(false);
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
            {/* The structured field is the source now; the text is only the fallback for content
                authored before the one-grammar pass. See `splitTypedDamage`. */}
            {action.damage && splitTypedDamage(action.damage, action.text, action.damageType).map((c, i) => {
              const v = damageTypeVisual(c.type);
              return (
                <span
                  key={`${c.dice}-${i}`}
                  title={c.type ? `${c.dice} ${c.type}` : c.dice}
                  style={{
                    fontSize: 10, color: v.color, background: `${v.color}18`,
                    border: `1px solid ${v.color}44`, borderRadius: 4, padding: "0 5px", fontWeight: 600,
                  }}
                >
                  {c.dice} {v.icon}
                </span>
              );
            })}
            {action.spellSlotLevel && (
              <span
                title={slotRemaining !== null ? `${slotRemaining} slot${slotRemaining === 1 ? "" : "s"} left at this level` : "Spell slot"}
                style={{
                  fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 4,
                  color: slotRemaining === 0 ? "#666" : "#57c07a",
                  background: slotRemaining === 0 ? "#1a1a1a" : "#57c07a18",
                  border: `1px solid ${slotRemaining === 0 ? "#333" : "#57c07a55"}`,
                }}
              >
                {ordinal(action.spellSlotLevel)}{slotRemaining !== null ? ` · ${slotRemaining}` : ""}
              </span>
            )}
            {action.save && (
              <span style={{ fontSize: 10, color: "#f0c040" }}>🛡 {action.save}</span>
            )}
          </div>
          {action.text && (() => {
            // Rules text used to be hard-clipped to the first line's first 140 chars with no
            // way to read the rest — so a save DC, a rider, or the back half of a trait just
            // vanished mid-sentence. Click the text (or "more") to expand the whole thing.
            const full = action.text.trim();
            const preview = full.split("\n")[0];
            const isClipped = full.length > 140 || full.includes("\n");
            const shown = textExpanded || !isClipped ? full : `${preview.slice(0, 140).trimEnd()}…`;
            return (
              <p
                onClick={isClipped ? (e) => { e.stopPropagation(); setTextExpanded(v => !v); } : undefined}
                title={isClipped ? (textExpanded ? "Click to collapse" : "Click to read the full text") : undefined}
                style={{
                  margin: 0, fontSize: 10, color: textExpanded ? "#8a8a9a" : "#555", lineHeight: 1.4,
                  whiteSpace: "pre-wrap", cursor: isClipped ? "pointer" : "default",
                }}
              >
                {shown}
                {isClipped && (
                  <span style={{ color: "#7b68ee", marginLeft: 6, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {textExpanded ? "less" : "more"}
                  </span>
                )}
              </p>
            );
          })()}
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
            <p style={{ margin: 0, fontSize: 11, color: "#7b68ee" }}>⏳ Waiting for Dice+… <span style={{ color: "#555" }}>math rolls it if nothing answers</span></p>
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
            <p style={{ margin: 0, fontSize: 11, color: "#e07b39" }}>⏳ Waiting for damage… <span style={{ color: "#555" }}>math rolls it if nothing answers</span></p>
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

function SectionLabel({ text, count, collapsible, open, onToggle, accent, budget }: {
  text: string; count: number; collapsible?: boolean; open?: boolean; onToggle?: () => void;
  /** Per-type colour from tabVisuals, so a monster's sections read in the same language
   *  as the PC sheet's tabs. Falls back to the old violet. */
  accent?: string;
  /**
   * ⚠ HOW MANY OF THESE THE CREATURE MAY TAKE PER TURN — a different question from `count`,
   * which is how many are WRITTEN DOWN.
   *
   * Those two being one badge is what made the Hollow Warden read as one spear attack (one
   * action listed, two per turn) and the Larkskein as two Glass-Thorns (two actions listed,
   * one per turn — and the second is Folded Distance, not an attack at all). The pip row said
   * "2 LEFT" and "ACTION" correctly the whole time; the badge above it disagreed.
   */
  budget?: number;
}) {
  const c = accent ?? "#7b68ee";
  return (
    // The whole strip is the click target when collapsible — a 9px chevron is a poor one.
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        margin: "6px 0 3px", padding: "2px 6px", borderRadius: 4,
        borderLeft: `2px solid ${c}`, background: `${c}0d`,
        cursor: collapsible ? "pointer" : undefined,
      }}>
      <span style={{ fontSize: 9, color: c, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>{text}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {budget !== undefined && budget > 1 && (
          <span
            title={`This creature takes ${budget} of these per turn. The number beside it is how many are written on the block, which is a different thing.`}
            style={{
              fontSize: 9, color: "#0d0d14", background: c, fontWeight: 700,
              padding: "1px 6px", borderRadius: 8, letterSpacing: 0.3,
            }}
          >{budget}/turn</span>
        )}
        <span
          title={`${count} written on the stat block`}
          style={{ fontSize: 9, color: c, background: `${c}1f`, padding: "1px 5px", borderRadius: 8 }}
        >{count}</span>
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

/**
 * ─── Action tile grid ────────────────────────────────────────────────────────
 *
 * UP TO THREE PER ROW, AND NEVER FORCED (playsheet pass, doc §9). Monster actions used to stack
 * one per row at any width, so a wide monster popout ran a single column of tiles down a page of
 * empty space while the DM scrolled past everything the creature could not currently do.
 *
 * `minmax(max(230px, (100% - 2*gap)/3), 1fr)` does the whole rule in one line: the floor stops a
 * tile getting unreadable, and the 1/3-of-container term caps the count at three however wide the
 * panel gets. Wide → 3, moderate → 2, narrow → 1, with no breakpoints to keep in sync with the
 * shell. *"Do not force three columns if it makes the cards unreadable."*
 *
 * Reactions run through it too - section 15 makes Player and Monster actions one tile family, and
 * a reaction is an action tile with its own economy colour. Traits do NOT: they are prose a DM
 * reads in order, and a grid turns a list you scan into a block you have to search.
 */
function ActionTileGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className="monster-action-tile-grid"
      style={{
        display: "grid",
        /**
         * ⚠ THE FLOOR IS 320px AND IT IS DOING REAL WORK, not guarding a minimum.
         *
         * A monster tile carries more than a PC tile does — attack, save, typed damage chips, a
         * recharge badge, a control and up to 140 characters of rules text — so a narrow column
         * wraps that text over three or four lines and a row of three ends up TALLER than the
         * same three stacked. Measured on the Elemental Mirror at 940px: three columns of 299px
         * came to 358px of tiles, two columns of 455px came to 284px. The tiles were not more
         * readable and the panel was not shorter.
         *
         * So three-per-row happens when each column can be at least 320px, which is a genuinely
         * wide monster popout, and two-per-row carries the middle. This is the doc's own rule
         * rather than a compromise on it: *"Do not force three columns if it makes the cards
         * unreadable"*, *"1 column for long/complex entries"*.
         */
        gridTemplateColumns: "repeat(auto-fit, minmax(max(320px, (100% - 12px) / 3), 1fr))",
        // Column gap only: each tile already carries its own bottom margin, and doubling up
        // reopens exactly the vertical space this pass is here to reclaim.
        columnGap: 6,
        rowGap: 4,
        // `start`, not `stretch`: a short tile beside a long one must not grow to match it, or
        // the grid hands back the vertical space it was added to reclaim.
        alignItems: "start",
      }}
    >
      {children}
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
  onSaveCall,
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
  // rechargedActionIds — actions with recharge that have been USED this turn and not yet recharged
  const [dischargedActionIds, setDischargedActionIds] = useState<Set<string>>(() => new Set());
  const [showCritFailTables, setShowCritFailTables] = useState(false);
  const [traitsOpen, setTraitsOpen] = useState(false);
  // Only Actions is expanded by default — the rest collapse to a one-line header with a
  // count. This is where the card's height actually goes; the header/economy trims are
  // worth ~130px, collapsing these is worth roughly twice that on a full stat block.
  const [bonusOpen, setBonusOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [legendaryOpen, setLegendaryOpen] = useState(false);
  /**
   * Legendary points spent this round.
   *
   * Kept apart from the action economy on purpose: legendary is its own pool, refreshing at
   * the START of the creature's turn — which is exactly when the existing per-instance
   * turn-reset broadcast fires, so no new signal is needed.
   */
  const [legendaryUsed, setLegendaryUsed] = useState(0);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [spellsOpen, setSpellsOpen] = useState(false);

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
        setCommittedRoll(null);
        // Legendary points come back at the start of the creature's own turn.
        setLegendaryUsed(0);
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

  // ── Math fallback: no dice app answered ─────────────────────────────────────
  // Dice+ gets first refusal on every roll. When nothing comes back — no dice extension
  // installed, or the request timed out — the math takes over rather than leaving the
  // table stuck on "Waiting for Dice+…" and forcing the DM to roll it by hand. The result
  // is written into the same fields a real dice result would fill, so the card cannot tell
  // the difference and the natural roll still drives crits.
  const phase = committedRoll?.phase;
  const pendingFormula = committedRoll?.pendingFormula;
  const pendingRequestId = committedRoll?.requestId;
  useEffect(() => {
    if (phase !== "pending" && phase !== "damage-pending") return;
    if (!pendingFormula) return;
    const timer = window.setTimeout(() => {
      setCommittedRoll(r => {
        // Re-check inside the setter: a real result may have landed while the timer ran.
        if (!r || r.requestId !== pendingRequestId) return r;
        if (r.phase !== "pending" && r.phase !== "damage-pending") return r;
        const rolled = rollFormulaLocally(pendingFormula);
        if (!rolled) return r;
        const text = `${rolled.text} (math)`;
        return r.phase === "pending"
          ? { ...r, result: text, naturalRoll: rolled.naturalRoll, phase: "held" }
          : { ...r, damageResult: text, phase: "damage-held" };
      });
    }, LOCAL_ROLL_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [phase, pendingFormula, pendingRequestId]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const condition = hpCondition(currentHp, displayMaxHp);
  const hpRatio = displayMaxHp > 0 ? Math.max(0, Math.min(1, currentHp / displayMaxHp)) : 0;

  const publicName = (isDmView || monster.isNameRevealed)
    ? (monster.revealedName || monster.displayName || monster.name)
    : (monster.hiddenName || "Unknown creature");

  // actionCounter is derived from THIS monster's template only
  const actionCounter = useMemo(
    () => deriveMonsterActionCounter(monster.actions ?? [], monster.attacksPerTurn),
    [monster.actions, monster.attacksPerTurn],
  );

  // Action budget replaces the old "Multiattack row + step counter". A creature gets
  // `actionsMax` main-action uses per turn (its attacks-per-turn, default 1). Each ATTACK
  // spends one; a full-action ability (a cast, Raise the Frozen) spends the whole budget —
  // so it's "2 attacks, OR one other action", the way a real stat block reads. Tracked in
  // economy.stepsUsed. No "Multiattack" action is needed or wanted.
  const actionsMax = Math.max(1, monster.attacksPerTurn ?? actionCounter?.total ?? 1);

  // Spell slots spent this fight, per level. Unlike the action budget these do NOT reset on
  // turn advance — a monster's slots persist until it would long rest, i.e. the whole fight.
  const [slotsUsedByLevel, setSlotsUsedByLevel] = useState<Record<number, number>>({});
  const legendaryPerRound = monster.legendaryPerRound ?? 0;
  const legendaryLeft = Math.max(0, legendaryPerRound - legendaryUsed);

  const spellSlots = monster.spellSlots ?? [];
  const slotRemaining = (level: number) => {
    const pool = spellSlots.find(s => s.level === level);
    if (!pool) return null;
    return Math.max(0, pool.max - (slotsUsedByLevel[level] ?? 0));
  };

  const allActions = useMemo(
    () => [...(monster.actions ?? []), ...(monster.reactions ?? []), ...(monster.traits ?? [])],
    [monster.actions, monster.reactions, monster.traits],
  );

  const { mainActions, bonusActions, spells, reactions, legendary, traits } = useMemo(
    () => classifyActions(allActions),
    [allActions],
  );

  const hasBonusActions = bonusActions.length > 0;

  // Log panel removed (P8) — addLog kept as no-op since the encounter log handles all tracking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function addLog(_msg: string) { /* noop — log strip removed, tracked via encounter log */ }

  // ── HP controls ─────────────────────────────────────────────────────────────
  // First HP move reveals the DM's real name to players — the "it just moved so
  // everyone at the table sees it react" beat. A manual Reveal button (below) covers
  // the case where the DM wants the name known before anyone lands a hit.
  function adjustHp(delta: number) {
    const next = Math.max(0, Math.min(displayMaxHp, currentHp + delta));
    setCurrentHp(next);
    onHpChange({
      currentHp: next,
      status: next <= 0 ? "down" : monster.status,
      ...(monster.isNameRevealed ? {} : { isNameRevealed: true }),
    });
    addLog(`${publicName} ${delta > 0 ? "healed" : "took"} ${Math.abs(delta)} ${delta > 0 ? "HP" : "damage"}.`);
  }

  // ── Action commit flow ──────────────────────────────────────────────────────
  async function handleUseAction(action: MonsterReaderAction) {
    const actionId = slugify(action.name);
    // Pure save-forcing action (breath weapon, etc. — no attack roll) calls the save NOW.
    // An attack WITH a rider save (has a roll) calls it after damage instead (handleCommit).
    if (action.save && !action.roll) {
      onSaveCall?.(action.name, action.save);
    }
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
      saveRider: action.save && action.roll ? action.save : undefined,
      pendingFormula: attackFormula || undefined,
      phase: attackFormula ? "pending" : "held",
    };
    setCommittedRoll(roll);
    /**
     * ⚠ AN ATTACK IS SPENT WHEN IT RESOLVES, NOT WHEN THE DICE ARE THROWN.
     *
     * Christopher: *"something is consuming the monster action on roll not commit."* This branch
     * spent a step here, and `handleCommit` spends one again on Apply — so a single Fist took BOTH
     * of the Grief Colossus's 2/turn: "1 LEFT" while the attack was still held at nat 16, "0 LEFT"
     * after the damage was applied. Two implementations of one rule, and per RULE 0 the second one
     * is always the one that is wrong.
     *
     * Resolution is the correct moment and it already has both of its exits covered:
     * `handleCommit` spends on a hit, `handleClearRoll` spends on a miss. A roll thrown and then
     * abandoned costs nothing, which is right — nothing happened at the table either.
     *
     * A NON-ATTACK main action still spends the whole budget here, because a cast IS the turn's
     * action from the moment it is used; there is no hit/miss for it to resolve into.
     * (`handleCommit`'s own guard is `stepsUsed < total`, so it correctly does nothing after this.)
     * Reactions and bonus actions are unchanged: neither draws on the action budget.
     */
    const isBonus = (action as MonsterReaderAction & { economyCost?: string }).economyCost?.toLowerCase() === "bonus";
    setEconomy(e => {
      let next: InstanceEconomy;
      if (action.kind === "reaction") {
        next = { ...e, reactionUsed: true };
      } else if (isBonus) {
        next = { ...e, bonusUsed: true };
      } else if (action.kind === "attack") {
        // Spent on resolve — see handleCommit / handleClearRoll.
        next = e;
      } else {
        next = { ...e, stepsUsed: actionsMax, actionUsed: true };
      }
      broadcastMonsterEconomy(monster.instanceId, next);
      return next;
    });
    // Spend a spell slot if this action costs one (persists until the fight ends).
    if (action.spellSlotLevel && slotRemaining(action.spellSlotLevel) !== null) {
      setSlotsUsedByLevel(prev => ({ ...prev, [action.spellSlotLevel!]: (prev[action.spellSlotLevel!] ?? 0) + 1 }));
    }
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
      setCommittedRoll(r => r && { ...r, phase: "damage-pending", requestId: dmgId, pendingFormula: dmgFormula });
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
      // Attack landed + damage rolled — now call the rider save on the target.
      if (committedRoll.saveRider) {
        onSaveCall?.(committedRoll.actionName, committedRoll.saveRider);
      }
      return;
    }
    // Final commit
    const result = committedRoll.damageResult ?? committedRoll.result;
    /**
     * Spend the action budget. One attack costs one step; a SPELL ACTION costs the whole turn's
     * actions, so casting ends the attacks rather than leaving a swing on the table.
     *
     * ⚠ THE BUDGET IS `actionsMax`, NOT `actionCounter.total`. `deriveMonsterActionCounter`
     * returns UNDEFINED for any creature that does not have `attacksPerTurn > 1` — it exists to
     * label multiattack steps, not to hold the budget. Guarding on it meant every SINGLE-attack
     * creature skipped this branch entirely, which went unnoticed only because the roll-time
     * spend above was covering for it. Remove that one without fixing this one and a Fist never
     * marks its action used at all.
     */
    if (economy.stepsUsed < actionsMax) {
      const spendsEverything = (actionCounter?.fullActionNames ?? []).includes(committedRoll.actionName);
      setEconomy(e => {
        const steps = spendsEverything ? actionsMax : Math.min(e.stepsUsed + 1, actionsMax);
        // Broadcast here too: this is now where the action is spent, so the shared economy
        // strip and any other open window learn about it from this moment, not the roll.
        const next = { ...e, stepsUsed: steps, actionUsed: steps >= actionsMax };
        broadcastMonsterEconomy(monster.instanceId, next);
        return next;
      });
    }
    addLog(`${publicName} ${committedRoll.actionName}: ${result || "used"}.`);
    onActionCommit?.(committedRoll.actionName);
    setCommittedRoll(null);
  }

  function handleClearRoll() {
    /**
     * A MISS IS A RESOLVED ATTACK — it spends its step. Same budget as the hit path above, and
     * for the same reason: `actionCounter` is undefined on a single-attack creature, so guarding
     * on it meant a missed Fist cost nothing.
     */
    if (committedRoll?.actionId && committedRoll.actionId !== "multiattack"
        && economy.stepsUsed < actionsMax) {
      setEconomy(e => {
        const steps = Math.min(e.stepsUsed + 1, actionsMax);
        const next = { ...e, stepsUsed: steps, actionUsed: steps >= actionsMax };
        broadcastMonsterEconomy(monster.instanceId, next);
        return next;
      });
    }
    addLog(`${publicName} roll cleared.`);
    setCommittedRoll(null);
  }

  // ── Ability check / save roll ────────────────────────────────────────────────
  // Rolls a raw 1d20 + ability modifier (with the current adv/disadv mode) and routes
  // it through the same Dice+ bridge as actions. Result lands via the dice listener.
  // Checks and saves are DIFFERENT numbers for a creature proficient in a save. `save`
  // is the override; when absent the save equals the check (no proficiency).
  const abilityChecks = useMemo(() => {
    const scores = (monster as { abilityScores?: { label: string; value: string; save?: number }[] }).abilityScores ?? [];
    return scores.map((s) => {
      const modifier = parseAbilityModifier(s.value);
      return { label: s.label, modifier, save: typeof s.save === "number" ? s.save : modifier };
    });
  }, [monster]);

  // Named skill checks — read the governing ability modifier from the monster's scores
  // (Stealth/Acrobatics ← DEX, Perception ← WIS). A correct classification (stat
  // distribution) in the builder is what makes these land at the right value.
  // PER-CREATURE. A creature that declares its own skills shows exactly those; only a
  // creature with none falls back to the generic trio, so a Drifter stops advertising
  // Acrobatics it never had.
  const skillChecks = useMemo(() => {
    const authored = (monster as { skills?: { label: string; modifier: number }[] }).skills;
    if (authored && authored.length > 0) {
      return authored.map(s => ({ label: s.label, ability: "", modifier: s.modifier }));
    }
    const modFor = (ability: string) =>
      abilityChecks.find((a) => a.label.toUpperCase().includes(ability))?.modifier ?? 0;
    return [
      { label: "Stealth", ability: "DEX", modifier: modFor("DEX") },
      { label: "Perception", ability: "WIS", modifier: modFor("WIS") },
      { label: "Acrobatics", ability: "DEX", modifier: modFor("DEX") },
    ];
  }, [abilityChecks, monster]);

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
      <div style={{ padding: "5px 12px", borderBottom: "1px solid #1a1a2e", background: withAlpha(MONSTER_COLOR, 0.08), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          {/* DISPLAY TYPOGRAPHY, not another form label (playsheet pass, doc §3): the creature's
              name is the one thing on this panel that should read as authored. Weight and
              tracking do the work — no new font family, and the header grows by ~2px. */}
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 750, letterSpacing: 0.2, color: "#fff", lineHeight: 1.15 }}>{publicName}</h3>
          {/* Identity line: creature type • role • tier. The encounter doc's Act/Session
              line is deliberately NOT here — that is encounter detail, and the panel is
              under a size lock. Only renders when the template actually carries the data. */}
          {(monster.kind || monster.archetype || monster.classification) && (
            <span style={{ fontSize: 9.5, color: "#6a6a80", letterSpacing: 0.6, textTransform: "uppercase" }}>
              {[
                monster.kind === "unspecified" ? undefined : monster.kind,
                monster.archetype,
                monster.classification ? CLASSIFICATION_LABEL[monster.classification] : undefined,
              ].filter(Boolean).join(" • ")}
            </span>
          )}
          {monster.displayName && monster.displayName !== publicName && (
            <span style={{ fontSize: 10, color: "#444", marginLeft: 6 }}>{monster.displayName}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* DM-only: reveal the real name to players before anyone lands a hit. Once
              revealed there's no un-reveal — the moment has already happened at the table. */}
          {!monster.isNameRevealed && (
            <button
              type="button"
              onClick={() => { onHpChange({ isNameRevealed: true }); addLog(`${publicName} identity revealed to the table.`); }}
              title="Reveal the real name to players now, instead of waiting for the first HP change"
              style={{ fontSize: 10, padding: "3px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}
            >
              👁 Reveal
            </button>
          )}
          {/* ⚠ THE BOSS BADGE REPLACES THE KIND PILL (playsheet pass, doc §6.1).
              *"Avoid a large row of classification chips. A Boss badge may remain because it has
              strong operational value."* The kind was printed twice — once here as a pill and
              once in the identity line below the name — and the pill was the copy that told the
              DM nothing they were not already reading. What the header genuinely needs to shout
              is that this creature is a boss, which the roster's own tier accent already names. */}
          {isHeavyTier(monster.classification) ? (
            <span
              title={CLASSIFICATION_LABEL[monster.classification!]}
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase",
                color: tierAccent(monster.classification),
                background: withAlpha(tierAccent(monster.classification) ?? MONSTER_COLOR, 0.14),
                border: `1px solid ${withAlpha(tierAccent(monster.classification) ?? MONSTER_COLOR, 0.5)}`,
                padding: "2px 7px", borderRadius: 3,
              }}
            >
              {tierMark(monster.classification)} {CLASSIFICATION_LABEL[monster.classification!]}
            </span>
          ) : null}
          {monster.visibilityState && monster.visibilityState !== "full" && (
            <span style={{ fontSize: 9, color: "#555", background: "#0d0d14", border: "1px solid #2a2a2a", padding: "1px 5px", borderRadius: 3 }}>
              {monster.visibilityState}
            </span>
          )}
        </div>
      </div>

      {/*
        ── THE COMMAND BAND ──────────────────────────────────────────────────────────────────
        Christopher: *"why does the monster window still have so much white space when we could
        shift things up like the economy blips and move the additive and reset turn into the same
        row as the hp."*

        FIVE STACKED ROWS BECAME TWO. Stat boxes, HP, additive, the economy blips and the Nat 1
        button each owned a full-width row with its own padding, and four of the five held one
        short strip of controls with the rest of the row empty. That empty width IS the white
        space — nothing was mis-sized, everything was simply on its own line.

          row 1   AC · HP · SPEED · STATE ........................ actions ● bonus ● reaction ● slots
          row 2   173/173 HP [bar] [5] [+] [-] .......... + Additive · Reset Turn · Nat 1 tables

        The blips move up beside the readouts because they are read together — what the creature
        IS and what it has left this turn. The turn controls join the HP line because that is the
        row a DM's hand is already on.
      */}
      <div style={{ padding: "7px 12px 8px", display: "grid", gap: 6 }}>

        {/* Row 1 — what the creature is, and what it has left. */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
          <StatBox label="AC"    value={String(monster.ac ?? "—")} />
          <StatBox label="HP"    value={condition} color={conditionColor(condition)} />
          <StatBox label="Speed" value={monster.speed ?? "—"} />
          <StatBox label="State" value={monster.status?.trim() || "—"} last />
          <div style={{ flex: 1, minWidth: 16 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <ActionBudget max={actionsMax} used={economy.stepsUsed}
              onSet={(n) => { const next = { ...economy, stepsUsed: n, actionUsed: n >= actionsMax }; setEconomy(next); broadcastMonsterEconomy(monster.instanceId, next); }} />
            {hasBonusActions && (
              <EconomyDot label="Bonus" used={economy.bonusUsed} onClick={() => { const next = { ...economy, bonusUsed: !economy.bonusUsed }; setEconomy(next); broadcastMonsterEconomy(monster.instanceId, next); }} />
            )}
            <EconomyDot label="Reaction" used={economy.reactionUsed} onClick={() => { const next = { ...economy, reactionUsed: !economy.reactionUsed }; setEconomy(next); broadcastMonsterEconomy(monster.instanceId, next); }} />
            {/* Spell slots — DM-local, persist across turns until a long rest / fight end */}
            {spellSlots.map(s => {
              const left = slotRemaining(s.level) ?? 0;
              return (
                <div key={s.level} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {Array.from({ length: s.max }).map((_, i) => {
                      const spent = i >= left;
                      return (
                        <button key={i} type="button"
                          onClick={() => setSlotsUsedByLevel(prev => ({ ...prev, [s.level]: spent ? i : i + 1 }))}
                          title={`${ordinal(s.level)}-level slot ${i + 1} of ${s.max} — ${spent ? "spent, click to restore" : "available, click to spend"}`}
                          style={{ width: 9, height: 9, borderRadius: 2, background: spent ? "#2a2a2a" : "#57c07a", border: "none", padding: 0, cursor: "pointer" }} />
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{ordinal(s.level)} · {left}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2 — HP, its bar, its adjusters, and the turn controls that ride with them. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: conditionColor(condition), fontVariantNumeric: "tabular-nums", minWidth: 60 }}>
            {currentHp}/{displayMaxHp} HP
          </span>
          <div style={{ height: 4, width: "100%", maxWidth: 116, background: "#1a1a2e", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
            <div style={{ height: "100%", width: `${hpRatio * 100}%`, background: conditionColor(condition), borderRadius: 2 }} />
          </div>
          {monster.tempHp > 0 && (
            <span style={{ fontSize: 10, color: "#4caf50" }}>+{monster.tempHp} temp</span>
          )}
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

          <div style={{ flex: 1, minWidth: 8 }} />

          {/* The readied additive reads as state, so it keeps its chip. */}
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
          <button type="button" className="fdmc-ghost-btn" onClick={() => setAdditiveOpen(o => !o)}
            title="Flag a one-off bonus die onto the next roll and/or next damage roll"
            style={ghostStyle(additiveOpen)}>
            + Additive
          </button>
          <button type="button" className="fdmc-ghost-btn"
            title="Clear the action budget, bonus and reaction. Spell slots and recharges persist."
            onClick={() => { const reset = { actionUsed: false, bonusUsed: false, reactionUsed: false, stepsUsed: 0 }; setEconomy(reset); broadcastMonsterEconomy(monster.instanceId, reset); setCommittedRoll(null); /* discharged + spell slots persist across turns */ addLog(`${publicName} turn reset.`); }}>
            Reset Turn
          </button>
          {/* ⚀ THE NAT 1 TABLES, ON THE MONSTER CARD — where a monster's Nat 1 actually happens.
              The overlay was reachable only from a PC's card, so the DM running the monsters had
              no way to look either table up, which is precisely backwards: a monster's Nat 1 is
              the one that is table-facing. Both tables, always, no roll required. */}
          <button type="button" className="fdmc-ghost-btn"
            onClick={() => setShowCritFailTables(true)}
            title="Natural 1 failure tables — both the first and second tables">
            ⚀ Nat 1 tables
          </button>
        </div>

        {/* The additive picker opens under the row that launched it, full width. */}
        {additiveOpen && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "5px 7px", border: "1px solid #2a2a3e", borderRadius: 5, background: "#13131f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "#9d8cff" }}>To roll</span>
              {ADDITIVE_DICE.map((die) => (
                <button key={die} type="button" onClick={() => { setPendingAdditive(die); setAdditiveOpen(false); }}
                  style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, cursor: "pointer", background: "#111", border: "1px solid #2a2a3e", color: "#9d8cff" }}>
                  +1{die}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "#e9a66a" }}>To damage</span>
              {DAMAGE_ADDITIVE_DICE.map((die) => (
                <button key={die} type="button" onClick={() => { setPendingDamageDie(die); setAdditiveOpen(false); }}
                  style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, cursor: "pointer", background: "#111", border: "1px solid #2a2a3e", color: "#e9a66a" }}>
                  +1{die}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PACING DIAL — rescale the whole bar, DM-only.
            The alternative is lying: quietly dealing less than the PC rolled, or healing the
            creature. Both are visible, because the bar stops matching what the table just did.
            This scales current AND max together, so the bar sits at the same fraction the
            instant it is applied — nothing moves and nothing rewinds. Only the PACE changes:
            every hit after it is a bigger share of a smaller bar. */}
        {isDmView && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
            <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Pace</span>
            {[0.75, 0.9, 1.1, 1.25].map(factor => (
              <button
                key={factor}
                type="button"
                onClick={() => {
                  const nextMax = Math.max(1, Math.round(displayMaxHp * factor));
                  const scaled = Math.round(currentHp * factor);
                  const nextHp = currentHp > 0 ? Math.min(nextMax, Math.max(1, scaled)) : 0;
                  setDisplayMaxHp(nextMax);
                  setCurrentHp(nextHp);
                  onHpChange({ currentHp: nextHp, maxHp: nextMax });
                  addLog(`${publicName} rescaled to ${Math.round(factor * 100)}% — ${nextHp}/${nextMax} HP (bar unchanged; pace ${factor < 1 ? "faster" : "slower"}).`);
                }}
                title={`Rescale this creature to ${Math.round(factor * 100)}% of its current bar. The bar does not move — the fight just ${factor < 1 ? "shortens" : "lengthens"}.`}
                style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 3, cursor: "pointer",
                  background: "transparent",
                  border: `1px solid ${factor < 1 ? "#5a1a1a" : "#2a4a6e"}`,
                  color: factor < 1 ? "#c88" : "#7ba8d0",
                }}
              >
                {factor < 1 ? "" : "+"}{Math.round((factor - 1) * 100)}%
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "0 12px 12px" }}>

        <CriticalFailureReference open={showCritFailTables} onClose={() => setShowCritFailTables(false)} />

        {/* 3b. Ability checks & saves + advantage/disadvantage mode */}
        <div style={{ marginBottom: 8, padding: "6px 0", borderBottom: "1px solid #1a1a2e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Checks, Saves &amp; Skills</span>
            <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
              {([
                { id: "disadv", label: "Disadv", color: "#ff5840" },
                { id: "normal", label: "Normal", color: "#9a9ab0" },
                { id: "adv", label: "Adv", color: "#4bb469" },
              ] as { id: RollMode; label: string; color: string }[]).map((m) => {
                const active = rollMode === m.id;
                return (
                  /* Only the CHOSEN mode is a box. Two of these three are always wrong, and
                     framing all three identically made the row read as three objects instead of
                     one setting with one answer — see ghostStyle. */
                  <button key={m.id} type="button" className="fdmc-ghost-btn" onClick={() => setRollMode(m.id)}
                    title={`Roll mode: ${m.label}`}
                    style={ghostStyle(active, m.color)}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {abilityChecks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {abilityChecks.map((ab) => {
                // A proficient save is a different number from the check. Show the SV line
                // always (so the DM never has to guess which it is) but accent it only when
                // it actually differs — otherwise it is just the modifier restated.
                const saveDiffers = ab.save !== ab.modifier;
                return (
                  /* SIX ACROSS, playsheet pass (doc §10): the DM reads the spread as a line, the
                     way a statblock prints it, instead of two rows of three. `flex: 1 1 0` lets
                     all six share the width evenly and still wrap on a narrow popout. */
                  <div key={ab.label}
                    style={{
                      flex: "1 1 0", minWidth: 46, display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
                      padding: "3px 2px", background: "#111", border: "1px solid #2a2a3e", borderRadius: 4,
                    }}>
                    <span style={{ fontSize: 10, color: "#999", fontWeight: 600, letterSpacing: 0.5 }}>{ab.label}</span>
                    <button type="button" onClick={() => handleAbilityCheck(ab.label, ab.modifier)}
                      title={`Roll ${ab.label} CHECK${rollMode === "normal" ? "" : ` with ${rollMode === "adv" ? "advantage" : "disadvantage"}`}`}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, fontSize: 11, color: "#7b68ee", fontVariantNumeric: "tabular-nums" }}>
                      {ab.modifier >= 0 ? `+${ab.modifier}` : ab.modifier}
                    </button>
                    <button type="button" onClick={() => handleAbilityCheck(`${ab.label} save`, ab.save)}
                      title={`Roll ${ab.label} SAVING THROW${saveDiffers ? " (proficient)" : ""}`}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer", padding: 0,
                        fontSize: 8.5, letterSpacing: 0.3, fontVariantNumeric: "tabular-nums",
                        color: saveDiffers ? "#d7b36a" : "#5a5a6a",
                        fontWeight: saveDiffers ? 700 : 400,
                      }}>
                      SV {ab.save >= 0 ? `+${ab.save}` : ab.save}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {skillChecks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {/* A SKILL IS A NAME AND A NUMBER, so it is a chip and not a tile (doc §10:
                  *"Avoid large empty tiles when only one number is present."*). A creature with
                  two skills used to get two third-width boxes with a blank row underneath. */}
              {skillChecks.map((sk) => (
                <button key={sk.label} type="button" onClick={() => handleAbilityCheck(sk.label, sk.modifier)}
                  title={`Roll ${sk.label} (${sk.ability}) check${rollMode === "normal" ? "" : ` with ${rollMode === "adv" ? "advantage" : "disadvantage"}`}`}
                  style={{
                    display: "inline-flex", alignItems: "baseline", gap: 5,
                    padding: "2px 8px", background: "#0d0d14", border: "1px solid #232336",
                    borderRadius: 10, cursor: "pointer",
                  }}>
                  <span style={{ fontSize: 9, color: "#888", fontWeight: 600, letterSpacing: 0.3 }}>{sk.label}</span>
                  <span style={{ fontSize: 11, color: "#7b68ee", fontVariantNumeric: "tabular-nums" }}>
                    {sk.modifier >= 0 ? `+${sk.modifier}` : sk.modifier}
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

        {/* 3c. Legendary — up here, directly under the economy row, NOT down among the action
                lists. It is spent on other creatures' turns, so it is reached constantly and
                out of order; burying it below Actions/Bonus/Reactions meant scrolling past
                everything the creature can't currently do to find the one thing it can.
                Collapsed by default and opened with a click, like the player card's additive
                menu: the header carries the pool, the options only appear when wanted.

                Separate from Reactions on purpose — different economies that happen to share
                "fires when it isn't my turn". */}
        {legendary.length > 0 && (
          <>
            <SectionLabel text={legendaryPerRound ? `Legendary (${legendaryLeft}/${legendaryPerRound})` : "Legendary"}
              count={legendary.length} accent={SECTION_ACCENT.legendary}
              collapsible open={legendaryOpen} onToggle={() => setLegendaryOpen(o => !o)} />
            {legendaryOpen && <ActionTileGrid>{legendary.map(a => {
              const cost = a.legendaryCost ?? 1;
              const unaffordable = legendaryPerRound > 0 && cost > legendaryLeft;
              return (
                <ActionCard key={a.name} action={a}
                  isUsed={unaffordable || (a.spellSlotLevel !== undefined && slotRemaining(a.spellSlotLevel) === 0)}
                  slotRemaining={a.spellSlotLevel !== undefined ? slotRemaining(a.spellSlotLevel) : null}
                  isDischarged={dischargedActionIds.has(slugify(a.name))}
                  committedRoll={committedRoll?.actionId === slugify(a.name) ? committedRoll : null}
                  attackCounter={undefined} stepsUsed={0}
                  onUse={(action) => { setLegendaryUsed(u => u + cost); handleUseAction(action); }}
                  onRollResult={handleRollResult}
                  onCommit={handleCommit} onClearRoll={handleClearRoll}
                  onStepUsed={() => undefined} onStepReset={() => undefined}
                />
              );
            })}</ActionTileGrid>}
          </>
        )}

        {/* 4. Actions — true action-cost only */}
        {mainActions.length > 0 && (
          <>
            <SectionLabel text="Actions" count={mainActions.length} accent={SECTION_ACCENT.actions} budget={actionsMax} />
            <ActionTileGrid>{mainActions.map(a => (
              // Main actions share the turn's action budget: usable until the budget is spent,
              // or until this specific action is out of slots. Not gated per-action.
              <ActionCard key={a.name} action={a}
                isUsed={economy.stepsUsed >= actionsMax
                  || (a.spellSlotLevel !== undefined && slotRemaining(a.spellSlotLevel) === 0)}
                slotRemaining={a.spellSlotLevel !== undefined ? slotRemaining(a.spellSlotLevel) : null}
                isDischarged={dischargedActionIds.has(slugify(a.name))}
                committedRoll={committedRoll?.actionId === slugify(a.name) ? committedRoll : null}
                attackCounter={actionCounter} stepsUsed={economy.stepsUsed}
                onUse={handleUseAction} onRollResult={handleRollResult}
                onCommit={handleCommit} onClearRoll={handleClearRoll}
                onStepUsed={() => setEconomy(e => ({ ...e, stepsUsed: Math.min(e.stepsUsed + 1, actionsMax) }))}
                onStepReset={() => setEconomy(e => ({ ...e, stepsUsed: 0 }))}
                onRecharge={(action) => {
                  const { roll, success } = rollRecharge(action.recharge ?? "6");
                  addLog(`${publicName} recharge roll for ${action.name}: ${roll} — ${success ? "✓ recharged!" : "✗ failed"}`);
                  if (success) setDischargedActionIds(prev => { const next = new Set(prev); next.delete(slugify(action.name)); return next; });
                }}
              />
            ))}</ActionTileGrid>
          </>
        )}

        {/* 4b. Spells — slot-costed main actions, split out of Actions so a caster's
            control kit reads separately from its claws. Collapsed by default. */}
        {spells.length > 0 && (
          <>
            <SectionLabel text="Spells" count={spells.length} accent={SECTION_ACCENT.spells}
              collapsible open={spellsOpen} onToggle={() => setSpellsOpen(o => !o)} />
            {spellsOpen && <ActionTileGrid>{spells.map(a => (
              <ActionCard key={a.name} action={a}
                isUsed={economy.stepsUsed >= actionsMax
                  || (a.spellSlotLevel !== undefined && slotRemaining(a.spellSlotLevel) === 0)}
                slotRemaining={a.spellSlotLevel !== undefined ? slotRemaining(a.spellSlotLevel) : null}
                isDischarged={dischargedActionIds.has(slugify(a.name))}
                committedRoll={committedRoll?.actionId === slugify(a.name) ? committedRoll : null}
                attackCounter={undefined} stepsUsed={0}
                onUse={handleUseAction} onRollResult={handleRollResult}
                onCommit={handleCommit} onClearRoll={handleClearRoll}
                onStepUsed={() => undefined} onStepReset={() => undefined}
              />
            ))}</ActionTileGrid>}
          </>
        )}

        {/* 5. Bonus Actions — only if present */}
        {hasBonusActions && (
          <>
            <SectionLabel text="Bonus Actions" count={bonusActions.length} accent={SECTION_ACCENT.bonus}
              collapsible open={bonusOpen} onToggle={() => setBonusOpen(o => !o)} />
            {bonusOpen && <ActionTileGrid>{bonusActions.map(a => (
              <ActionCard key={a.name} action={a}
                isUsed={economy.bonusUsed || (a.spellSlotLevel !== undefined && slotRemaining(a.spellSlotLevel) === 0)}
                slotRemaining={a.spellSlotLevel !== undefined ? slotRemaining(a.spellSlotLevel) : null}
                isDischarged={dischargedActionIds.has(slugify(a.name))}
                committedRoll={committedRoll?.actionId === slugify(a.name) ? committedRoll : null}
                attackCounter={undefined} stepsUsed={0}
                onUse={handleUseAction} onRollResult={handleRollResult}
                onCommit={handleCommit} onClearRoll={handleClearRoll}
                onStepUsed={() => undefined} onStepReset={() => undefined}
              />
            ))}</ActionTileGrid>}
          </>
        )}

        {/* 6. Reactions — separate, quieter section */}
        {reactions.length > 0 && (
          <>
            <SectionLabel text="Reactions" count={reactions.length} accent={SECTION_ACCENT.reactions}
              collapsible open={reactionsOpen} onToggle={() => setReactionsOpen(o => !o)} />
            {reactionsOpen && <ActionTileGrid>{reactions.map(a => (
              <ActionCard key={a.name} action={a} isReaction
                isUsed={economy.reactionUsed || (a.spellSlotLevel !== undefined && slotRemaining(a.spellSlotLevel) === 0)}
                slotRemaining={a.spellSlotLevel !== undefined ? slotRemaining(a.spellSlotLevel) : null}
                isDischarged={dischargedActionIds.has(slugify(a.name))}
                committedRoll={committedRoll?.actionId === slugify(a.name) ? committedRoll : null}
                attackCounter={undefined} stepsUsed={0}
                onUse={handleUseAction} onRollResult={handleRollResult}
                onCommit={handleCommit} onClearRoll={handleClearRoll}
                onStepUsed={() => undefined} onStepReset={() => undefined}
              />
            ))}</ActionTileGrid>}
          </>
        )}

        {/* 7. Resources / Recharge — small chips derived from action text */}
        {(() => {
          const rechargeable = allActions.filter(a =>
            a.recharge ||
            a.text?.toLowerCase().includes("recharge") ||
            a.name?.toLowerCase().includes("recharge") ||
            a.text?.match(/\d+\s*\/\s*(?:day|encounter|rest)/i)
          );
          if (rechargeable.length === 0) return null;
          return (
            <>
              <SectionLabel text="Resources / Recharge" count={rechargeable.length} accent={SECTION_ACCENT.resources}
                collapsible open={resourcesOpen} onToggle={() => setResourcesOpen(o => !o)} />
              <div style={{ display: resourcesOpen ? "flex" : "none", flexWrap: "wrap", gap: 4 }}>
                {rechargeable.map(a => {
                  const m = a.text?.match(/recharge\s+([\d–\-]+)/i) ?? a.name?.match(/recharge\s+([\d–\-]+)/i);
                  const d = a.text?.match(/(\d+)\s*\/\s*(day|encounter|rest)/i);
                  // The recharge field is authoritative; the regexes only cover creatures
                  // that mention recharge in prose without setting the field.
                  const badge = a.recharge ? `Recharge ${a.recharge}` : m ? `Recharge ${m[1]}` : d ? `${d[1]}/${d[2]}` : "Limited";
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
            <SectionLabel text="Traits" count={traits.length} collapsible open={traitsOpen} onToggle={() => setTraitsOpen(o => !o)} accent={SECTION_ACCENT.traits} />
            {traitsOpen && traits.map(a => (
              <TraitCard key={a.name} name={a.name} text={a.text} />
            ))}
          </>
        )}

      </div>
    </article>
  );
}
