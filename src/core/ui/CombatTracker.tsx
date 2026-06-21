/**
 * CombatTracker
 *
 * Shows the turn order for the current combat round.
 * Sorted by initiative (descending). Highlights the active combatant.
 * DM controls: Start Combat, Next Turn, End Combat.
 *
 * Combatants = player actors + monster instances, all with initiative values.
 * Monsters with no initiative show at the bottom (DM decides order).
 */

import React, { useState } from "react";
import type { Actor } from "../types/actor";
import type { MainEncounterMonsterInstance } from "../monsters/runtime/mainMonsterRuntime";
import type { FdmcCombatPhase } from "../table-state/fdmcRoomLiveState";
import type { ActorActionEconomyMap } from "../types/actionEconomy";
import { MONSTER_COLOR, NEUTRAL_SEAT_COLOR, withAlpha } from "../seats/seatColors";
import { getActorInitiativeModifier } from "../state/initiative";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Combatant = {
  id: string;
  name: string;
  kind: "actor" | "monster";
  initiative: number | null;
  /** Initiative modifier used for auto-roll. Actors: derived DEX modifier + trait
   *  bonuses (Alert, etc.). Monsters: DEX modifier parsed from ability scores. */
  initiativeBonus: number;
  hp: { current: number; max: number; temp?: number };
  isActive: boolean;
  isDead: boolean;
  /** For monsters: player-safe or DM name */
  displayName?: string;
  /** If this is a companion, the owner actor ID */
  ownerId?: string;
  /** Companion actors that act on this combatant's turn */
  companions?: Combatant[];
};

export type CombatTrackerProps = {
  combatants: Combatant[];
  activeId: string | null;
  round: number;
  phase: FdmcCombatPhase;
  isDmMode: boolean;
  /** Actor IDs owned by the current viewer — enables player-side Next Turn + initiative input */
  viewerActorIds?: string[];
  /** Economy state for all actors — used to show per-row dots for DM */
  actionStateByActorId?: ActorActionEconomyMap;
  /** actorId → seat color. Drives the per-row identity rail (P-UX1). */
  seatColorById?: Record<string, string>;
  /** Color used for monster/GM combatant rows. Defaults to MONSTER_COLOR. */
  monsterColor?: string;
  onStartCombat: () => void;
  onNextTurn: () => void;
  onEndCombat: () => void;
  onSelectCombatant: (id: string) => void;
  onSetInitiative: (id: string, initiative: number) => void;
  /** Roll an actor's initiative through Dice+ (player-owned). The result writes back via
   *  onSetInitiative once Dice+ returns. Falls back to a local roll when absent/unavailable. */
  onRollInitiative?: (combatantId: string) => void;
  /** Swap two combatants' initiative values — Alert feat, class features, DM call */
  onSwapInitiative?: (idA: string, idB: string) => void;
};

// ─── Sort combatants by initiative ───────────────────────────────────────────

export function sortCombatants(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    // Dead actors go to bottom
    if (a.isDead && !b.isDead) return 1;
    if (!a.isDead && b.isDead) return -1;
    // No initiative goes below those with initiative
    if (a.initiative === null && b.initiative !== null) return 1;
    if (a.initiative !== null && b.initiative === null) return -1;
    if (a.initiative === null && b.initiative === null) return 0;
    // Higher initiative goes first
    return (b.initiative ?? 0) - (a.initiative ?? 0);
  });
}

// ─── Parse initiative bonus from ability score string ─────────────────────────
// Handles "14 (+2)", "+2", "14", "2" — always returns the numeric modifier.

function parseInitiativeBonus(abilityScores: { label: string; value: string }[] | undefined): number {
  const dex = abilityScores?.find(a => a.label.toUpperCase().startsWith("DEX"));
  if (!dex) return 0;
  // Try to extract parenthesized modifier first: "14 (+2)" → 2
  const parenMatch = dex.value.match(/\(([+-]?\d+)\)/);
  if (parenMatch) return Number.parseInt(parenMatch[1], 10);
  // Try bare modifier: "+2" or "-1"
  const modMatch = dex.value.match(/^([+-]\d+)$/);
  if (modMatch) return Number.parseInt(modMatch[1], 10);
  // Try raw score: "14" → floor((14-10)/2) = 2
  const score = Number.parseInt(dex.value, 10);
  if (Number.isFinite(score)) return Math.floor((score - 10) / 2);
  return 0;
}

// ─── Build combatants from App state ─────────────────────────────────────────

export function buildCombatants(
  actors: Actor[],
  monsters: MainEncounterMonsterInstance[],
  activeId: string | null,
  initiativeByActorId: Record<string, number | null>,
  initiativeByMonsterInstanceId: Record<string, number | null>,
  isDmMode: boolean,
  liveHpByActorId: Record<string, { current: number; max: number }> = {},
): Combatant[] {
  // Separate companions from main actors
  const companions = actors.filter(a => a.kind === "companion");
  const mainActors = actors.filter(a => a.kind !== "companion");

  const mainActorCombatants: Combatant[] = mainActors.map(actor => {
    // Live HP takes precedence over library value — covers damage taken during combat
    const liveHp = liveHpByActorId[actor.id];
    const hp = liveHp ?? actor.stats.hp;

    const ownedCompanions = companions
      .filter(c => (c.moduleData as { ownerId?: string } | undefined)?.ownerId === actor.id)
      .map(c => ({
        id: c.id,
        name: c.name,
        kind: "actor" as const,
        initiative: initiativeByActorId[actor.id] ?? null,
        initiativeBonus: getActorInitiativeModifier(c),
        hp: liveHpByActorId[c.id] ?? c.stats.hp,
        isActive: false,
        isDead: (liveHpByActorId[c.id]?.current ?? c.stats.hp.current) <= 0,
        ownerId: actor.id,
      }));

    return {
      id: actor.id,
      name: actor.name,
      kind: "actor" as const,
      initiative: initiativeByActorId[actor.id] ?? null,
      initiativeBonus: getActorInitiativeModifier(actor),
      hp,
      isActive: actor.id === activeId,
      isDead: hp.current <= 0,
      companions: ownedCompanions.length > 0 ? ownedCompanions : undefined,
    };
  });

  // Companions without a matching main actor (orphaned) — show them standalone
  const orphanedCompanions: Combatant[] = companions
    .filter(c => {
      const ownerId = (c.moduleData as { ownerId?: string } | undefined)?.ownerId;
      return !ownerId || !mainActors.find(a => a.id === ownerId);
    })
    .map(c => {
      const cHp = liveHpByActorId[c.id] ?? c.stats.hp;
      return {
        id: c.id,
        name: c.name,
        kind: "actor" as const,
        initiative: initiativeByActorId[c.id] ?? null,
        initiativeBonus: getActorInitiativeModifier(c),
        hp: cHp,
        isActive: c.id === activeId,
        isDead: cHp.current <= 0,
      };
    });

  const monsterCombatants: Combatant[] = monsters.map(m => ({
    id: m.instanceId,
    name: isDmMode
      ? (m.revealedName || m.displayName || m.name)
      : (m.isNameRevealed ? (m.revealedName || m.name) : (m.hiddenName || "Unknown creature")),
    kind: "monster" as const,
    initiative: initiativeByMonsterInstanceId[m.instanceId] ?? null,
    initiativeBonus: parseInitiativeBonus(m.abilityScores),
    hp: { current: m.currentHp, max: m.maxHp, temp: m.tempHp > 0 ? m.tempHp : undefined },
    isActive: m.instanceId === activeId,
    isDead: m.currentHp <= 0,
    displayName: m.displayName,
  }));

  return [...mainActorCombatants, ...orphanedCompanions, ...monsterCombatants];
}

// ─── HP condition color ───────────────────────────────────────────────────────

function hpColor(current: number, max: number): string {
  if (current <= 0) return "#555";
  const ratio = max > 0 ? current / max : 0;
  if (ratio <= 0.25) return "#ff4444";
  if (ratio <= 0.5)  return "#e07b39";
  if (ratio <= 0.75) return "#f0c040";
  return "#4caf50";
}

// Player-safe HP condition — shown for party members the viewer does NOT control, so
// other seats read as Healthy/Wounded/… instead of exact numbers (own actors + the DM
// still see real HP). Same vocabulary monsters use for players.
function hpConditionLabel(current: number, max: number): string {
  if (current <= 0) return "Down";
  const ratio = max > 0 ? current / max : 0;
  if (ratio <= 0.25) return "Critical";
  if (ratio <= 0.5)  return "Bloodied";
  if (ratio <= 0.75) return "Wounded";
  return "Healthy";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CombatTracker({
  combatants,
  activeId,
  round,
  phase,
  isDmMode,
  viewerActorIds,
  actionStateByActorId,
  seatColorById,
  monsterColor = MONSTER_COLOR,
  onStartCombat,
  onNextTurn,
  onEndCombat,
  onSelectCombatant,
  onSetInitiative,
  onRollInitiative,
  onSwapInitiative,
}: CombatTrackerProps) {
  const viewerActorIdSet = new Set(viewerActorIds ?? []);
  const isViewerActive = activeId !== null && viewerActorIdSet.has(activeId);

  // Exact HP is visible to the DM, to the actor's own controller, and (for companions)
  // to whoever controls the owner. Everyone else sees the abstracted condition label.
  const canSeeExactHp = (c: { id: string; ownerId?: string }) =>
    isDmMode || viewerActorIdSet.has(c.id) || (c.ownerId ? viewerActorIdSet.has(c.ownerId) : false);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const sorted = sortCombatants(combatants);
  const activeIndex = sorted.findIndex(c => c.id === activeId);
  // Combatants that joined mid-combat with no initiative (need to be slotted)
  const needsInitiative = phase === "combat"
    ? sorted.filter(c => c.initiative === null && !c.isDead)
    : [];

  if (combatants.length === 0) return null;

  return (
    <section style={{ borderTop: "1px solid #2a2a3e", padding: "8px 0 0" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Phase label colored by state — green in combat, amber in initiative, muted in setup */}
          <span style={{ fontSize: 11, color: phase === "combat" ? "#7be08a" : phase === "initiative" ? "#e0b85a" : "#8a8aa0", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
            {phase === "combat" ? `Round ${round}` : phase === "initiative" ? "Initiative" : "Setup"}
          </span>
          {phase === "combat" && activeIndex >= 0 && (
            <span style={{ fontSize: 10, color: "#555" }}>
              {activeIndex + 1}/{sorted.filter(c => !c.isDead).length}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {isDmMode && (phase === "setup" || phase === "initiative") && (
            <>
              {sorted.some(c => c.kind === "monster" && c.initiative === null && !c.isDead) && (
                <button
                  type="button"
                  onClick={() => {
                    sorted
                      .filter(c => c.kind === "monster" && c.initiative === null && !c.isDead)
                      .forEach(c => {
                        const roll = Math.floor(Math.random() * 20) + 1 + c.initiativeBonus;
                        onSetInitiative(c.id, roll);
                      });
                  }}
                  style={{ fontSize: 11, padding: "2px 8px", background: "#2a2a3e", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}
                  title="Auto-roll 1d20 + DEX for all monsters without initiative"
                >
                  🎲 Roll Monsters
                </button>
              )}
              <button
                type="button"
                onClick={onStartCombat}
                disabled={!sorted.some(c => c.initiative !== null)}
                style={{
                  fontSize: 11, padding: "2px 10px",
                  background: sorted.some(c => c.initiative !== null) ? "#2a6e2a" : "#1a2a1a",
                  color: sorted.some(c => c.initiative !== null) ? "#fff" : "#555",
                  border: "none", borderRadius: 3, cursor: sorted.some(c => c.initiative !== null) ? "pointer" : "default",
                }}
              >
                ▶ Start Combat
              </button>
            </>
          )}
          {isDmMode && phase === "combat" && (
            <>
              <button
                type="button"
                onClick={onNextTurn}
                style={{ fontSize: 11, padding: "2px 10px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}
              >
                Next Turn →
              </button>
              <button
                type="button"
                onClick={onEndCombat}
                style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}
                title="End combat — keep actor HP and seats"
              >
                End
              </button>
            </>
          )}
          {/* Player "End My Turn" — shown when it's their actor's turn */}
          {!isDmMode && isViewerActive && phase === "combat" && (
            <button
              type="button"
              onClick={onNextTurn}
              style={{ fontSize: 11, padding: "2px 10px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}
            >
              End My Turn →
            </button>
          )}
        </div>
      </div>

      {/* Mid-combat: monsters/actors needing initiative ── */}
      {isDmMode && needsInitiative.length > 0 && (
        <div style={{ margin: "0 8px 6px", padding: "6px 8px", background: "#1a1a12", border: "1px solid #e07b3944", borderRadius: 5 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#e07b39" }}>
            ⚡ {needsInitiative.length} combatant{needsInitiative.length === 1 ? "" : "s"} joined mid-combat — set initiative to slot into order:
          </p>
          {needsInitiative.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, flex: 1, color: "#aaa" }}>{c.name}</span>
              <input
                type="number"
                placeholder="init"
                onClick={e => e.stopPropagation()}
                onChange={e => {
                  const val = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(val)) onSetInitiative(c.id, val);
                }}
                style={{ width: 50, fontSize: 12, textAlign: "center", background: "#111", border: "1px solid #e07b3966", borderRadius: 3, color: "#e07b39", padding: "2px 4px" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Swap mode banner */}
      {isDmMode && swapSourceId && (
        <div style={{ margin: "0 8px 4px", padding: "4px 8px", background: "#1a2a1a", border: "1px solid #4caf5044", borderRadius: 4, fontSize: 11, color: "#4caf50" }}>
          Select who to swap initiative with — or click the same combatant to cancel.
        </div>
      )}

      {/* Turn order list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px 6px" }}>
        {sorted.map((combatant, idx) => {
          const isActive = combatant.id === activeId;
          const isSwapSource = combatant.id === swapSourceId;
          const isSwapTarget = swapSourceId !== null && swapSourceId !== combatant.id;
          const aliveSorted = sorted.filter(c => !c.isDead);
          const aliveIdx = aliveSorted.findIndex(c => c.id === activeId);
          const isNext = phase === "combat" && !isActive && idx === (aliveIdx + 1) % Math.max(1, aliveSorted.length);

          // Identity color — seat color for party characters, monster color for monsters.
          const railColor = combatant.kind === "monster"
            ? monsterColor
            : seatColorById?.[combatant.id]
              ?? (combatant.ownerId ? seatColorById?.[combatant.ownerId] : undefined)
              ?? NEUTRAL_SEAT_COLOR;

          return (
            <React.Fragment key={combatant.id}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 6px",
                // Identity rail on the left edge using the seat/monster color.
                borderLeft: `3px solid ${railColor}`,
                paddingLeft: 7,
                background: isActive ? withAlpha(railColor, 0.16) : isSwapSource ? "#1a2a1a" : "transparent",
                border: `1px solid ${isActive ? withAlpha(railColor, 0.5) : isSwapSource ? "#4caf5066" : isNext ? "#2a2a3e" : "transparent"}`,
                borderLeftWidth: 3,
                borderLeftColor: railColor,
                borderRadius: 5,
                opacity: combatant.isDead ? 0.4 : 1,
              }}
            >
              {/* Turn indicator */}
              <span style={{ width: 12, fontSize: 10, color: isActive ? "#7b68ee" : isNext ? "#444" : "transparent", flexShrink: 0 }}>
                {isActive ? "▶" : isNext ? "›" : "·"}
              </span>

              {/* Initiative — editable for DM always; editable for player on their own actors during setup/initiative */}
              {isDmMode || (viewerActorIdSet.has(combatant.id) && (phase === "setup" || phase === "initiative")) ? (
                <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                  <input
                    type="number"
                    value={combatant.initiative ?? ""}
                    onChange={e => {
                      const val = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(val)) onSetInitiative(combatant.id, val);
                    }}
                    onClick={e => e.stopPropagation()}
                    placeholder="—"
                    style={{
                      width: 30, fontSize: 12, textAlign: "center",
                      background: "#0d0d14", border: `1px solid ${viewerActorIdSet.has(combatant.id) && !isDmMode ? "#7b68ee66" : "#2a2a2a"}`,
                      borderRadius: 3, color: "#7b68ee", padding: "1px 2px",
                    }}
                  />
                  {/* Roll initiative button — shown for own actors (player) or all in DM mode */}
                  {(viewerActorIdSet.has(combatant.id) || isDmMode) && (phase === "setup" || phase === "initiative") && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        // Actors roll through Dice+ (player-owned, visible dice); the result
                        // writes initiative back via onSetInitiative. Monsters / no-bridge
                        // fall back to a local quick-roll for the DM.
                        if (combatant.kind === "actor" && onRollInitiative) {
                          onRollInitiative(combatant.id);
                          return;
                        }
                        const roll = Math.floor(Math.random() * 20) + 1 + combatant.initiativeBonus;
                        onSetInitiative(combatant.id, roll);
                      }}
                      title={combatant.kind === "actor" && onRollInitiative
                        ? `Roll Initiative (1d20${combatant.initiativeBonus >= 0 ? "+" : ""}${combatant.initiativeBonus}) through Dice+`
                        : `Roll 1d20${combatant.initiativeBonus >= 0 ? "+" : ""}${combatant.initiativeBonus}`}
                      style={{ fontSize: 9, padding: "1px 3px", background: "#2a2a3e", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}
                    >
                      🎲
                    </button>
                  )}
                </div>
              ) : (
                <span style={{ width: 26, fontSize: 12, color: "#7b68ee", textAlign: "center", flexShrink: 0 }}>
                  {combatant.initiative ?? "—"}
                </span>
              )}

              {/* Name — clickable */}
              <button
                type="button"
                onClick={() => {
                  if (swapSourceId) {
                    if (swapSourceId === combatant.id) {
                      setSwapSourceId(null); // cancel
                    } else {
                      onSwapInitiative?.(swapSourceId, combatant.id);
                      setSwapSourceId(null);
                    }
                  } else {
                    onSelectCombatant(combatant.id);
                  }
                }}
                style={{
                  // Names hold their seat color (party) / monster color (GM) so the
                  // tracker reads as the table at a glance.
                  flex: 1, fontSize: 12, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#fff" : isSwapTarget ? "#4caf50" : combatant.isDead ? "#555" : railColor,
                  background: "transparent", border: "none", cursor: "pointer",
                  textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: 0,
                }}
              >
                {combatant.name}
                {combatant.kind === "monster" && (
                  <span style={{ fontSize: 10, color: withAlpha(monsterColor, 0.7), marginLeft: 4 }}>⚔</span>
                )}
              </button>

              {/* Swap button — DM only, before or during combat */}
              {isDmMode && onSwapInitiative && combatant.initiative !== null && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setSwapSourceId(prev => prev === combatant.id ? null : combatant.id);
                  }}
                  title="Swap initiative with another combatant (Alert feat, class feature, DM call)"
                  style={{
                    fontSize: 10, padding: "1px 5px", flexShrink: 0,
                    background: isSwapSource ? "#4caf5022" : "transparent",
                    border: `1px solid ${isSwapSource ? "#4caf50" : "#2a2a2a"}`,
                    borderRadius: 3, color: isSwapSource ? "#4caf50" : "#444", cursor: "pointer",
                  }}
                >
                  ⇅
                </button>
              )}

              {/* Economy dots — DM only, actor combatants */}
              {isDmMode && combatant.kind === "actor" && actionStateByActorId && (() => {
                const state = actionStateByActorId[combatant.id];
                if (!state) return null;
                const costs = ["main", "bonus", "reaction"] as const;
                const labels = ["A", "B", "R"] as const;
                return (
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {costs.map((cost, i) => {
                      const val = state[cost];
                      const isUsed = typeof val === "string" && val.startsWith("__fdm_used__:");
                      const isReadied = val && !isUsed;
                      const color = isUsed ? "#ff5840" : isReadied ? "#d7b36a" : "#2a2a4e";
                      return (
                        <div key={cost} title={`${labels[i]}: ${isUsed ? "used" : isReadied ? "readied" : "available"}`}
                          style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                      );
                    })}
                  </div>
                );
              })()}

              {/* HP — the DM and an actor's own controller see exact numbers; other seats
                  see the abstracted condition (Healthy/Wounded/…) for party members they
                  don't control. Monster true HP stays DM-only (players get the bar only). */}
              <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                {(isDmMode || combatant.kind === "actor") && (() => {
                  const temp = combatant.hp.temp ?? 0;
                  const displayCurrent = combatant.hp.current + temp;
                  if (!canSeeExactHp(combatant)) {
                    // Party member the viewer doesn't control — condition only, no numbers.
                    return (
                      <span style={{ fontSize: 10, color: hpColor(combatant.hp.current, combatant.hp.max), minWidth: 48, textAlign: "right" }}>
                        {combatant.isDead ? "☠ Down" : hpConditionLabel(combatant.hp.current, combatant.hp.max)}
                      </span>
                    );
                  }
                  return (
                    <span style={{ fontSize: 10, color: hpColor(combatant.hp.current, combatant.hp.max), minWidth: 36, textAlign: "right" }}>
                      {combatant.isDead ? "☠" : temp > 0
                        ? <>{displayCurrent}<span style={{ color: "#7ec8e3" }}>/{combatant.hp.max}</span></>
                        : `${combatant.hp.current}/${combatant.hp.max}`
                      }
                    </span>
                  );
                })()}
                <div style={{ width: 28, height: 3, background: "#2a2a2a", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${combatant.hp.max > 0 ? Math.max(0, Math.min(100, (combatant.hp.current / combatant.hp.max) * 100)) : 0}%`,
                    background: hpColor(combatant.hp.current, combatant.hp.max),
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            </div>

            {/* Companion sub-entries — act on owner's turn, inherit initiative */}
            {combatant.companions?.map(companion => (
              <div
                key={companion.id}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "2px 6px 2px 28px", // indented
                  opacity: companion.isDead ? 0.4 : 0.8,
                }}
              >
                <span style={{ fontSize: 10, color: "#555", flexShrink: 0 }}>└</span>
                <span style={{ fontSize: 11, color: "#666", flex: 1 }}>
                  {companion.name}
                  <span style={{ fontSize: 9, color: "#444", marginLeft: 4 }}>acts on {combatant.name}'s turn</span>
                </span>
                {/* Economy dots — companion row */}
                {isDmMode && actionStateByActorId && (() => {
                  const cState = actionStateByActorId[companion.id];
                  if (!cState) return null;
                  const costs = ["main", "bonus", "reaction"] as const;
                  const labels = ["A", "B", "R"] as const;
                  return (
                    <div style={{ display: "flex", gap: 2, flexShrink: 0, marginRight: 2 }}>
                      {costs.map((cost, i) => {
                        const val = cState[cost];
                        const isUsed = typeof val === "string" && val.startsWith("__fdm_used__:");
                        const isReadied = val && !isUsed;
                        const color = isUsed ? "#ff5840" : isReadied ? "#d7b36a" : "#2a2a4e";
                        return (
                          <div key={cost} title={`${labels[i]}: ${isUsed ? "used" : isReadied ? "readied" : "available"}`}
                            style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                        );
                      })}
                    </div>
                  );
                })()}
                {/* Companions follow their owner: exact HP for the owner's controller + DM,
                    abstracted condition for other seats. */}
                <span style={{ fontSize: 10, color: hpColor(companion.hp.current, companion.hp.max) }}>
                  {companion.isDead ? "☠"
                    : canSeeExactHp(combatant)
                      ? `${companion.hp.current}/${companion.hp.max}`
                      : hpConditionLabel(companion.hp.current, companion.hp.max)}
                </span>
              </div>
            ))}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}
