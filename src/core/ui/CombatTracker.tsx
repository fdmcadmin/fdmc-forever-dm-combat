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
import type { ResolvedSummon } from "../state/activeSummons";
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
  /**
   * A summoned body rather than a seated character — a Divine Steed, an Eldritch Cannon, the
   * Covenant bond-creature. Drives the "until round N" note and marks the row as temporary.
   */
  summon?: {
    /** The record's id, so the row can be dismissed. */
    recordId: string;
    /** The last round it is up. Undefined = until it drops or is dismissed. */
    expiresAfterRound?: number;
  };
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
  /**
   * Send a summoned body away before the fight ends — dismissed, destroyed, or the DM ruling it
   * gone. Without this the only exits are dropping to 0 HP and End Combat, and a Steed has no
   * duration to end it.
   */
  onDismissSummon?: (recordId: string) => void;
  /** Swap two combatants' initiative values — Alert feat, class features, DM call */
  onSwapInitiative?: (idA: string, idB: string) => void;
  /**
   * Condensed mode (Monster Gate B3): the in-app tracker becomes a slim NAMES + ORDER
   * strip — full HP / economy dots / swap / bench live in the combat window (DM) and the
   * player tracker overlay now. Keeps the header phase controls (Start/Next/End) and the
   * per-row initiative cell so combat can still be rolled and started from here.
   */
  condensed?: boolean;
};

// ─── Out of combat ─────────────────────────────────────────────────────────
// Design (Christopher): a NEGATIVE initiative means the combatant is sitting this
// fight out. They stay listed (so they're easy to bring back) but are excluded
// from Start Combat, Next Turn, and the turn count. Used to bench players whose
// characters aren't in a given encounter (e.g. short-table nights).

export function isOutOfCombat(c: Pick<Combatant, "initiative">): boolean {
  return c.initiative !== null && c.initiative < 0;
}

// ─── Sort combatants by initiative ───────────────────────────────────────────

export function sortCombatants(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    // Dead actors go to the very bottom
    if (a.isDead && !b.isDead) return 1;
    if (!a.isDead && b.isDead) return -1;
    // Benched (out-of-combat) sit just above the dead, below everyone active
    const aOut = isOutOfCombat(a);
    const bOut = isOutOfCombat(b);
    if (aOut && !bOut) return 1;
    if (!aOut && bOut) return -1;
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
  /**
   * The summoned bodies standing THIS round, already resolved against their casters.
   *
   * ⚠ THE CALLER DECIDES WHICH ROUND, and passes only what is up. This function has no round of
   * its own and must not grow one: `resolveActiveSummons` is where duration lives, and a second
   * opinion here is how a body ends up on the field one round after the tracker says it left.
   */
  summons: readonly ResolvedSummon[] = [],
): Combatant[] {
  // Separate companions from main actors
  const companions = actors.filter(a => a.kind === "companion");
  const mainActors = actors.filter(a => a.kind !== "companion");

  /**
   * One row per BODY. A call that brings three bodies is three combatants with three HP pools —
   * the workbook's own rule for a created body, "its own HP, initiative/action schedule, duration".
   * A single row carrying `x3` would give the table one pool to erase them all with.
   */
  const summonRows = (s: ResolvedSummon): Array<{ id: string; name: string; maxHp: number; source: ResolvedSummon }> => {
    const maxHp = Math.max(1, Math.round(Number(s.body.stats?.maxHp) || 1));
    if (s.count <= 1) return [{ id: s.id, name: s.name, maxHp, source: s }];
    return Array.from({ length: s.count }, (_, i) => ({
      id: `${s.id}#${i + 1}`,
      name: `${s.name} ${i + 1}`,
      maxHp,
      source: s,
    }));
  };

  const summonCombatant = (
    row: { id: string; name: string; maxHp: number; source: ResolvedSummon },
    initiative: number | null,
  ): Combatant => {
    const hp = liveHpByActorId[row.id] ?? { current: row.maxHp, max: row.maxHp };
    return {
      id: row.id,
      name: row.name,
      kind: "actor" as const,
      initiative,
      // A summoned body has no sheet to derive from; the DM sets its place in the order.
      initiativeBonus: 0,
      hp,
      isActive: row.id === activeId,
      isDead: hp.current <= 0,
      ownerId: row.source.ownerId,
      summon: {
        recordId: row.source.id,
        ...(row.source.expiresAfterRound !== undefined ? { expiresAfterRound: row.source.expiresAfterRound } : {}),
      },
    };
  };

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

    /**
     * ⚠ `summoner-turn` NESTS, AND THAT IS THE WHOLE POINT OF THE FIELD. The Covenant bond-creature
     * "acts on your turn" and Faelar "acts during Lyrielle's turn" — the same slot, because they are
     * the same thing. Giving one of these its own row hands the party a free extra turn every round,
     * which is exactly what `SummonSpec.acts` was written to prevent.
     */
    const ownedSummons = summons
      .filter(s => s.acts === "summoner-turn" && s.ownerId === actor.id)
      .flatMap(s => summonRows(s).map(row => summonCombatant(row, initiativeByActorId[actor.id] ?? null)));

    const nested = [...ownedCompanions, ...ownedSummons];

    return {
      id: actor.id,
      name: actor.name,
      kind: "actor" as const,
      initiative: initiativeByActorId[actor.id] ?? null,
      initiativeBonus: getActorInitiativeModifier(actor),
      hp,
      isActive: actor.id === activeId,
      isDead: hp.current <= 0,
      companions: nested.length > 0 ? nested : undefined,
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

  /**
   * ⚠ A BODY WHOSE CASTER IS NOT IN THIS FIGHT STILL APPEARS. It is on the field either way, and a
   * summon that silently vanishes because the DM benched its owner is indistinguishable at the
   * table from one that was never called — the same rule the orphaned-companion pass above follows.
   */
  const mainActorIds = new Set(mainActors.map(a => a.id));
  const summonCombatants: Combatant[] = summons
    .filter(s => s.acts !== "summoner-turn" || !mainActorIds.has(s.ownerId))
    .flatMap(s => summonRows(s).map(row => summonCombatant(row, initiativeByActorId[row.id] ?? null)));

  return [...mainActorCombatants, ...orphanedCompanions, ...monsterCombatants, ...summonCombatants];
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
  onDismissSummon,
  condensed = false,
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
  // Everyone actually in the fight — excludes dead AND benched (negative initiative).
  const inCombat = sorted.filter(c => !c.isDead && !isOutOfCombat(c));
  // Can only start once at least one non-benched combatant has an initiative.
  const canStart = inCombat.some(c => c.initiative !== null);
  // Combatants that joined mid-combat with no initiative (need to be slotted).
  // Benched combatants (negative initiative) are not "missing" one, so they're skipped.
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
              {inCombat.findIndex(c => c.id === activeId) + 1}/{inCombat.length}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {/* Roll initiative for any monster that still lacks one. Deliberately NOT phase-gated:
              reinforcements that arrive mid-fight need to be slotted into the order without
              leaving combat (previously this was setup/initiative only, so the DM had to close
              the window). The button only appears when something actually needs a roll. */}
          {isDmMode && sorted.some(c => c.kind === "monster" && c.initiative === null && !c.isDead) && (
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
              title={phase === "combat"
                ? "Roll 1d20 + DEX for monsters that joined mid-fight — they slot straight into the order"
                : "Auto-roll 1d20 + DEX for all monsters without initiative"}
            >
              🎲 Roll Monsters
            </button>
          )}
          {isDmMode && (phase === "setup" || phase === "initiative") && (
            <button
              type="button"
              onClick={onStartCombat}
              disabled={!canStart}
              style={{
                fontSize: 11, padding: "2px 10px",
                background: canStart ? "#2a6e2a" : "#1a2a1a",
                color: canStart ? "#fff" : "#555",
                border: "none", borderRadius: 3, cursor: canStart ? "pointer" : "default",
              }}
            >
              ▶ Start Combat
            </button>
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
        {sorted.map((combatant) => {
          const rowOut = isOutOfCombat(combatant);
          const isActive = combatant.id === activeId && !rowOut;
          const isSwapSource = combatant.id === swapSourceId;
          const isSwapTarget = swapSourceId !== null && swapSourceId !== combatant.id;
          const aliveIdx = inCombat.findIndex(c => c.id === activeId);
          const nextInCombat = inCombat.length > 0 ? inCombat[(aliveIdx + 1) % inCombat.length] : undefined;
          const isNext = phase === "combat" && !isActive && !rowOut && nextInCombat?.id === combatant.id;
          // Who may bench / rejoin this row: the DM always; a player on their own
          // actor while initiative is still being set.
          const canToggleOut = isDmMode || (viewerActorIdSet.has(combatant.id) && (phase === "setup" || phase === "initiative"));

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
                opacity: combatant.isDead ? 0.4 : rowOut ? 0.55 : 1,
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
                {/* A summoned body says how long it has. "Until 5" is the whole reason the record
                    carries a round — a body with no end date reads as permanent, and that is the
                    Covenant creature "always being on". */}
                {combatant.summon && (
                  <span style={{ fontSize: 9, color: "#8a8aa0", marginLeft: 5 }}>
                    ✦{combatant.summon.expiresAfterRound !== undefined
                      ? ` until R${combatant.summon.expiresAfterRound}`
                      : ""}
                  </span>
                )}
              </button>

              {/* Dismiss — a summoned body leaves the field. DM only: a player who could remove a
                  body from the chart could remove the one that was about to be hit. */}
              {!condensed && isDmMode && combatant.summon && onDismissSummon && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDismissSummon(combatant.summon!.recordId); }}
                  title={`Dismiss ${combatant.name} — it leaves the field`}
                  style={{
                    fontSize: 10, padding: "1px 5px", flexShrink: 0, background: "transparent",
                    border: "1px solid #3a3a4e", borderRadius: 3, color: "#8a8aa0", cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              )}

              {/* Benched badge — sitting this fight out (negative initiative) */}
              {rowOut && (
                <span style={{ fontSize: 9, color: "#8a8aa0", border: "1px solid #3a3a4e", borderRadius: 3, padding: "1px 4px", flexShrink: 0, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Out
                </span>
              )}

              {/* Bench / Rejoin toggle — DM anytime; a player on their own actor while
                  initiative is still being set. Bench sets a negative initiative so the
                  combatant is skipped by Start Combat / Next Turn. */}
              {!condensed && canToggleOut && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (rowOut) {
                      if (combatant.kind === "actor" && onRollInitiative) {
                        onRollInitiative(combatant.id);
                      } else {
                        onSetInitiative(combatant.id, Math.floor(Math.random() * 20) + 1 + combatant.initiativeBonus);
                      }
                    } else {
                      onSetInitiative(combatant.id, -1);
                    }
                  }}
                  title={rowOut ? "Rejoin combat (rolls initiative)" : "Bench — sit this fight out (negative initiative)"}
                  style={{
                    fontSize: 9, padding: "1px 5px", flexShrink: 0,
                    background: rowOut ? "#1a2a1a" : "transparent",
                    border: `1px solid ${rowOut ? "#4caf50" : "#2a2a2a"}`,
                    borderRadius: 3, color: rowOut ? "#4caf50" : "#666", cursor: "pointer",
                  }}
                >
                  {rowOut ? "Rejoin" : "Bench"}
                </button>
              )}

              {/* Swap button — DM only, before or during combat */}
              {!condensed && isDmMode && onSwapInitiative && combatant.initiative !== null && (
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
              {!condensed && isDmMode && combatant.kind === "actor" && actionStateByActorId && (() => {
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
                  don't control. Monster true HP stays DM-only (players get the bar only).
                  Condensed (B3): hidden — HP lives in the combat window / player overlay. */}
              {!condensed && <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
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
              </div>}
            </div>

            {/* Companion sub-entries — act on owner's turn, inherit initiative.
                The name is a button: a companion is never its own combatant in the
                initiative order, so clicking here is the ONLY way to open its card
                and spend its action during the owner's turn. */}
            {combatant.companions?.map(companion => (
              <div
                key={companion.id}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "2px 6px 2px 28px", // indented
                  // Lit up while the owner is the active turn — that's when it can act.
                  background: isActive ? withAlpha(railColor, 0.08) : "transparent",
                  borderRadius: 4,
                  opacity: companion.isDead ? 0.4 : isActive ? 1 : 0.8,
                }}
              >
                <span style={{ fontSize: 10, color: isActive ? railColor : "#555", flexShrink: 0 }}>└</span>
                <button
                  type="button"
                  onClick={() => onSelectCombatant(companion.id)}
                  title={`Open ${companion.name}'s card — acts on ${combatant.name}'s turn`}
                  style={{
                    flex: 1, textAlign: "left", padding: 0, cursor: "pointer",
                    background: "transparent", border: "none",
                    fontSize: 11, fontWeight: isActive ? 600 : 500,
                    color: companion.isDead ? "#555" : isActive ? railColor : "#666",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {companion.name}
                  <span style={{ fontSize: 9, color: isActive ? "#8a8aa0" : "#444", marginLeft: 4 }}>acts on {combatant.name}'s turn</span>
                  {companion.summon?.expiresAfterRound !== undefined && (
                    <span style={{ fontSize: 9, color: isActive ? "#8a8aa0" : "#444", marginLeft: 4 }}>
                      ✦ until R{companion.summon.expiresAfterRound}
                    </span>
                  )}
                </button>
                {/* Economy dots — companion row */}
                {!condensed && isDmMode && actionStateByActorId && (() => {
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
