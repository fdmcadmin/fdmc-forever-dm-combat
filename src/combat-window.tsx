/**
 * Combat Window — the GM seat's single combat view (Monster Gate WS-B/B1).
 *
 * One large popover (id "fdm-combat") with three panes:
 *   left   — Encounter Roster: every in-combat monster, HP bars, active-turn marker
 *   center — the active creature's FULL card (MonsterActorCard)
 *   right  — Player View: what the table sees — PCs in turn order with HP, plus
 *            player-safe monster rows honoring each creature's visibilityState
 *
 * S0 architecture (MONSTER-GATE-SPEC.md): in-combat monsters are DM-local roster
 * COPIES (monsterRosterStorage) that never write back to the library, so this window
 * needs NO metadata rework. The one trap S0 found: each card's per-round live state
 * (economy / used actions / recharge discharge) is component-local useState — so this
 * window mounts EVERY in-combat card at once and only toggles visibility to swap.
 * Nothing unmounts between turns; swapping creatures never resets their round state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { MonsterActorCard } from "./core/ui/MonsterActorCard";
import { ThreatHpBar, isHeavyTier, tierAccent, tierMark, playerSafeTier } from "./core/ui/ThreatHpBar";
import { SavePromptBanner } from "./core/ui/SavePromptBanner";
import { broadcastSavePrompt } from "./core/state/savePrompt";
import { useOwlbearDiceBridge } from "./core/integrations/useOwlbearDiceBridge";
import { loadMonsterRoster, saveMonsterRoster } from "./core/monsters/runtime/monsterRosterStorage";
import { MONSTER_POPOUT_HP_CHANNEL } from "./core/monster-state/useMonsterPopout";
import type { MainEncounterMonsterInstance } from "./core/monsters/runtime/mainMonsterRuntime";
import { buildCombatants, sortCombatants, isOutOfCombat, type Combatant } from "./core/ui/CombatTracker";
import { loadActorLibrary } from "./core/seats/dmActorLibrary";
import { FDMC_ROOM_LIVE_STATE_KEY } from "./core/table-state/sharedTableState";
import { subscribeFdmcRoomStateKey } from "./core/table-state/roomStateBridge";
import { normalizeFdmcRoomLiveState, createEmptyRoomLiveState, type FdmcRoomLiveState } from "./core/table-state/fdmcRoomLiveState";
import type { Actor } from "./core/types/actor";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "./data/broken-chain/monsterLibrary";
import { resolveMonsterLibrary } from "./core/monsters/dmMonsterLibrary";
import { useActiveSummonsState } from "./core/state/useActiveSummonsState";
import "./styles.css";

const COMBAT_WINDOW_POPOVER_ID = "fdm-combat";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function hpColor(current: number, max: number): string {
  if (current <= 0) return "#555";
  const ratio = max > 0 ? current / max : 0;
  if (ratio <= 0.25) return "#ff4444";
  if (ratio <= 0.5) return "#e07b39";
  if (ratio <= 0.75) return "#f0c040";
  return "#4caf50";
}

function hpConditionLabel(current: number, max: number): string {
  if (current <= 0) return "Down";
  const r = max > 0 ? current / max : 0;
  if (r <= 0.25) return "Critical";
  if (r <= 0.5) return "Bloodied";
  if (r <= 0.75) return "Wounded";
  return "Healthy";
}

// ─── Left pane: encounter roster ──────────────────────────────────────────────

function RosterPane({ monsters, selectedId, activeId, onSelect }: {
  monsters: MainEncounterMonsterInstance[];
  selectedId: string | null;
  activeId: string | null;
  onSelect: (instanceId: string) => void;
}) {
  return (
    <div style={{ overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="fdmc-section-head" style={{ color: "#e05555", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
        ⚔ Encounter Roster
      </div>
      {monsters.length === 0 && (
        <div style={{ fontSize: 11, color: "#666", padding: "12px 4px" }}>
          No monsters in combat. Load an encounter from the Monsters panel.
        </div>
      )}
      {monsters.map(m => {
        const isSelected = m.instanceId === selectedId;
        const isActiveTurn = m.instanceId === activeId;
        const dead = m.currentHp <= 0;
        return (
          <button
            key={m.instanceId}
            onClick={() => onSelect(m.instanceId)}
            style={{
              textAlign: "left", cursor: "pointer", borderRadius: 8, padding: "8px 10px",
              background: isSelected ? "#241a1a" : "#161622",
              border: `1px solid ${isSelected ? "#e05555" : "#2a2a3e"}`,
              opacity: dead ? 0.55 : 1,
              display: "flex", flexDirection: "column", gap: 5,
            }}
          >
            {/* Name and HP share one row — the readout used to own a line of its own,
                which cost ~22px per creature across the roster. */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isActiveTurn && <span title="Active turn" style={{ color: "#f0c040", fontSize: 11 }}>▶</span>}
              {isHeavyTier(m.classification) && (
                <span title={m.classification} style={{ color: tierAccent(m.classification), fontSize: 10 }}>
                  {tierMark(m.classification)}
                </span>
              )}
              <strong style={{ fontSize: 12.5, color: dead ? "#777" : "#eee", flex: 1 }}>
                {m.revealedName || m.displayName || m.name}
              </strong>
              <span style={{ fontSize: 10, color: hpColor(m.currentHp, m.maxHp), fontVariantNumeric: "tabular-nums" }}>
                {dead ? "Down" : `${m.currentHp}/${m.maxHp}`}{m.tempHp > 0 ? ` +${m.tempHp}` : ""}
              </span>
            </div>
            {/* The DM roster is not player-facing, so the tier is shown unconditionally. */}
            <ThreatHpBar ratio={m.maxHp > 0 ? m.currentHp / m.maxHp : 0} tier={m.classification} isDown={dead} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Right pane: player view (what the table sees) ────────────────────────────

function PlayerViewPane({ combatants, monsters }: {
  combatants: Combatant[];
  monsters: MainEncounterMonsterInstance[];
}) {
  const byInstanceId = useMemo(() => new Map(monsters.map(m => [m.instanceId, m])), [monsters]);
  return (
    <div style={{ overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="fdmc-section-head" style={{ color: "#7ec4e0", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
        👁 Player View
      </div>
      <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>
        Turn order as the table sees it — PC HP visible, monsters per visibility.
      </div>
      {combatants.map(c => {
        const monster = c.kind === "monster" ? byInstanceId.get(c.id) : undefined;
        const vis = monster?.visibilityState ?? "full";
        // Hidden monsters never appear in the player view.
        if (monster && vis === "hidden") return null;
        const benched = isOutOfCombat(c);
        const showBar = c.kind === "actor" || vis === "hp-bar" || vis === "full";
        const showNumbers = c.kind === "actor" || vis === "full";
        const showCondition = monster && vis === "condition";
        return (
          <div
            key={c.id}
            style={{
              borderRadius: 7, padding: "6px 9px",
              background: c.isActive ? "#1d2433" : "#141420",
              border: `1px solid ${c.isActive ? "#f0c040" : "#23233a"}`,
              opacity: c.isDead || benched ? 0.5 : 1,
              display: "flex", flexDirection: "column", gap: 4,
            }}
          >
            {/* Tier is reveal-gated: an unrevealed boss shows an ordinary bar, so the
                heavy treatment never gives away what is standing there. */}
            {(() => {
              const tier = playerSafeTier(monster?.classification, Boolean(monster?.isNameRevealed));
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {c.isActive && <span style={{ color: "#f0c040", fontSize: 10 }}>▶</span>}
                    {isHeavyTier(tier) && (
                      <span title={tier} style={{ color: tierAccent(tier), fontSize: 10 }}>{tierMark(tier)}</span>
                    )}
                    <span style={{ fontSize: 12, color: c.kind === "monster" ? "#e08585" : "#dfe4ff", fontWeight: 600, flex: 1 }}>
                      {c.name}
                    </span>
                    {/* Exact HP moves inline with the name — one row instead of two. */}
                    {showNumbers && (
                      <span style={{ fontSize: 10, color: hpColor(c.hp.current, c.hp.max), fontVariantNumeric: "tabular-nums" }}>
                        {c.hp.current}/{c.hp.max}{c.hp.temp ? ` +${c.hp.temp}` : ""}
                      </span>
                    )}
                    {showCondition && (
                      <span style={{ fontSize: 10, color: hpColor(c.hp.current, c.hp.max) }}>
                        {hpConditionLabel(c.hp.current, c.hp.max)}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "#667" }}>
                      {benched ? "out" : c.initiative !== null ? `init ${c.initiative}` : "—"}
                    </span>
                  </div>
                  {showBar && (
                    <ThreatHpBar
                      ratio={c.hp.max > 0 ? c.hp.current / c.hp.max : 0}
                      tier={tier}
                      isDown={c.isDead}
                    />
                  )}
                </>
              );
            })()}
          </div>
        );
      })}
      {combatants.length === 0 && (
        <div style={{ fontSize: 11, color: "#666", padding: "10px 4px" }}>No combatants yet.</div>
      )}
    </div>
  );
}

// ─── The window ───────────────────────────────────────────────────────────────

function CombatWindowApp() {
  const [roster, setRoster] = useState<MainEncounterMonsterInstance[]>(() => loadMonsterRoster());
  const [roomState, setRoomState] = useState<FdmcRoomLiveState>(() => createEmptyRoomLiveState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actorsById, setActorsById] = useState<Record<string, Actor>>(() => loadActorLibrary());
  const { lastEvent: diceBridgeLastEvent, sendDicePlusRollRequest } = useOwlbearDiceBridge();

  // Track roster ids we've seen so a newly-added monster auto-selects when nothing is.
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const refreshRoster = useCallback(() => {
    const next = loadMonsterRoster();
    setRoster(next);
    // Keep a valid selection: fall back to the first living creature.
    if (!next.find(m => m.instanceId === selectedRef.current)) {
      setSelectedId(next.find(m => m.currentHp > 0)?.instanceId ?? next[0]?.instanceId ?? null);
    }
  }, []);

  // Initial selection
  useEffect(() => {
    if (!selectedRef.current) refreshRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Roster stays fresh: storage events (other windows write localStorage), the popout
  // HP channel (LOCAL broadcasts on every HP commit), and a slow fallback poll.
  useEffect(() => {
    const onStorage = () => { refreshRoster(); setActorsById(loadActorLibrary()); };
    window.addEventListener("storage", onStorage);
    const poll = window.setInterval(refreshRoster, 3000);
    let unsubHp: (() => void) | undefined;
    if (OBR.isAvailable) {
      unsubHp = OBR.broadcast.onMessage(MONSTER_POPOUT_HP_CHANNEL, () => refreshRoster());
    }
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
      unsubHp?.();
    };
  }, [refreshRoster]);

  // Room live state — combat phase/round/active + initiative + actor live HP.
  useEffect(() => {
    return subscribeFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState, (state) => {
      setRoomState(state);
    });
  }, []);

  // HP commits from the mounted cards — same write path as the single monster popout:
  // update the DM-local roster copy + LOCAL broadcast so the main window re-syncs.
  // isNameRevealed rides along here (not a separate write path) so a first-HP-change
  // auto-reveal and a manual Reveal click both land through the one place that persists
  // the roster the player-safe pane actually reads.
  const commitHpFor = useCallback((instanceId: string, hp: { current: number; max: number; temp: number }, isNameRevealed?: boolean) => {
    const full = loadMonsterRoster();
    const next = full.map(m =>
      m.instanceId === instanceId
        ? { ...m, currentHp: hp.current, maxHp: hp.max, tempHp: hp.temp, hp: `${hp.current}/${hp.max}`, ...(isNameRevealed ? { isNameRevealed: true } : {}) }
        : m
    );
    saveMonsterRoster(next);
    setRoster(next);
    if (OBR.isAvailable) {
      void OBR.broadcast.sendMessage(
        MONSTER_POPOUT_HP_CHANNEL,
        { type: "fdmc:monster-popout-hp", instanceId, currentHp: hp.current, maxHp: hp.max, tempHp: hp.temp, ...(isNameRevealed ? { isNameRevealed: true } : {}) },
        { destination: "LOCAL" },
      ).catch(() => undefined);
    }
  }, []);

  /**
   * The summoned bodies standing this round.
   *
   * ⚠ THE RECORDS ARRIVE, NOT THE BODIES. A stat block will not fit in the table's shared 16KB, so
   * what crosses is `{owner, spec, round}` and this window materializes the body itself from the
   * library it already has — the same library the DM's panel resolves, precedence rule included.
   */
  const summonActors = useMemo(
    () => Object.values(actorsById).filter(a => a.kind === "player" || a.kind === "companion"),
    [actorsById],
  );
  const summonLibrary = useMemo(() => resolveMonsterLibrary(BROKEN_CHAIN_MONSTER_LIBRARY).library, []);
  const { activeSummons } = useActiveSummonsState(summonActors, roomState.combat.round, summonLibrary);

  // Player-view combatants: player-safe naming (isDmMode=false) + hidden monsters excluded
  // inside the pane.
  //
  // Combat reads EVERY loaded PARTY character sheet — not only the ones already seeded into
  // the room's live state. A newly imported PC (a replacement tank, an added companion) shows
  // up in combat the moment it is in the library, with no separate seating step: buildCombatants
  // falls back to the sheet's HP and shows init "—" until rolled, and a seated actor still uses
  // its live HP/initiative. (Non-party library actors — monsters/NPCs — are excluded by kind.)
  const playerCombatants = useMemo(() => {
    const actors = Object.values(actorsById).filter(a => a.kind === "player" || a.kind === "companion");
    const initiativeByActor: Record<string, number | null> = {};
    for (const [id, live] of Object.entries(roomState.actorLiveState)) initiativeByActor[id] = live.initiative;
    const initiativeByMonster: Record<string, number | null> = {};
    for (const [id, live] of Object.entries(roomState.monsterLiveState)) initiativeByMonster[id] = live.initiative;
    const liveHpByActorId: Record<string, { current: number; max: number }> = {};
    for (const [id, live] of Object.entries(roomState.actorLiveState)) liveHpByActorId[id] = { current: live.hp.current, max: live.hp.max };
    return sortCombatants(buildCombatants(
      actors, roster, roomState.combat.activeActorId,
      initiativeByActor, initiativeByMonster, false, liveHpByActorId,
      activeSummons,
    ));
  }, [actorsById, roster, roomState, activeSummons]);

  // ── Minimize ────────────────────────────────────────────────────────────────
  // The window is an opaque overlay on the map, so during token work the DM was
  // zooming the MAP out just to see around it. Collapsing the popover to its title bar
  // frees the map without closing combat: OBR.popover.setWidth/setHeight resize it in
  // place, and the expanded size is remembered so Expand restores exactly what was there.
  const [minimized, setMinimized] = useState(false);
  const expandedSize = useRef<{ w: number; h: number } | null>(null);

  const toggleMinimize = useCallback(async () => {
    if (!OBR.isAvailable) { setMinimized(m => !m); return; }
    const id = COMBAT_WINDOW_POPOVER_ID;
    try {
      if (!minimized) {
        const [w, h] = await Promise.all([OBR.popover.getWidth(id), OBR.popover.getHeight(id)]);
        expandedSize.current = { w: w ?? 1100, h: h ?? 800 };
        setMinimized(true);
        await OBR.popover.setWidth(id, 340);
        await OBR.popover.setHeight(id, 46);
      } else {
        const s = expandedSize.current ?? { w: 1100, h: 800 };
        setMinimized(false);
        await OBR.popover.setWidth(id, s.w);
        await OBR.popover.setHeight(id, s.h);
      }
    } catch { /* resize unsupported — the local flag still hides the body */ }
  }, [minimized]);

  const activeMonsterId = roster.find(m => m.instanceId === roomState.combat.activeActorId)?.instanceId ?? null;
  const phaseLabel = roomState.combat.phase === "combat"
    ? `Round ${roomState.combat.round}`
    : roomState.combat.phase === "initiative" ? "Rolling initiative" : "Setup";

  return (
    // height (not minHeight) locks the shell to the popover: the three panes scroll
    // internally instead of the document scrolling, so the header — and its Close
    // button — can never be pushed out of reach.
    <div style={{ background: "#0d0d14", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "inherit" }}>
      <SavePromptBanner />
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
        borderBottom: "1px solid #2a2a3e", background: "#12121c", position: "sticky", top: 0, zIndex: 5,
      }}>
        <strong style={{ color: "#e05555", fontSize: 13, letterSpacing: 0.5 }}>⚔ FDMC Combat</strong>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
          color: roomState.combat.phase === "combat" ? "#4caf50" : "#f0c040",
          border: `1px solid ${roomState.combat.phase === "combat" ? "#2c5231" : "#5a4a1e"}`,
        }}>
          {phaseLabel}
        </span>
        <span style={{ fontSize: 10.5, color: "#667" }}>{roster.length} in combat</span>
        <div style={{ flex: 1 }} />
        {/* Minimize — collapses the popover to this header bar so the map underneath is
            usable. Closing loses nothing (all state is persisted), but re-opening costs a
            click and re-selection; collapsing keeps the roster selection and every card's
            per-round economy exactly where it was. */}
        <button
          onClick={() => void toggleMinimize()}
          title={minimized ? "Expand the combat window" : "Collapse to the title bar so you can see and move tokens"}
          style={{ background: "#1a1a2a", color: "#9d8cff", border: "1px solid #33334e", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}
        >
          {minimized ? "▢ Expand" : "— Minimize"}
        </button>
        <button
          onClick={() => {
            if (OBR.isAvailable) void OBR.popover.close(COMBAT_WINDOW_POPOVER_ID).catch(() => window.close());
            else window.close();
          }}
          style={{ background: "#2a1a1a", color: "#e08585", border: "1px solid #5a2a2a", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}
        >
          ✕ Close
        </button>
      </div>
      {minimized && (
        <div style={{ padding: "6px 12px", fontSize: 10.5, color: "#555" }}>
          Collapsed — the map is clear. Combat state is untouched.
        </div>
      )}

      {/* 3-pane body — `display: none` rather than unmounting, so collapsing never resets
          a card's per-round economy (the S0 keep-all-mounted rule). */}
      <div style={{
        flex: 1, display: minimized ? "none" : "grid", minHeight: 0,
        gridTemplateColumns: "232px minmax(420px, 1fr) 252px",
      }}>
        <div style={{ borderRight: "1px solid #23233a", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <RosterPane monsters={roster} selectedId={selectedId} activeId={activeMonsterId} onSelect={setSelectedId} />
        </div>

        {/* Center: EVERY in-combat card stays mounted; only the selected one is visible.
            This is the S0 keep-all-mounted rule — swapping creatures must never reset
            their per-round economy/recharge state, which lives inside each card. */}
        <div style={{ minHeight: 0, overflowY: "auto" }}>
          {roster.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 12 }}>
              Load an encounter to begin.
            </div>
          )}
          {roster.map(m => (
            <div key={m.instanceId} style={{ display: m.instanceId === selectedId ? "block" : "none" }}>
              <MonsterActorCard
                monster={m}
                isDmView={true}
                onHpChange={(patch) => {
                  commitHpFor(m.instanceId, {
                    current: typeof patch.currentHp === "number" ? patch.currentHp : m.currentHp,
                    max: m.maxHp,
                    temp: typeof patch.tempHp === "number" ? patch.tempHp : m.tempHp,
                  }, patch.isNameRevealed);
                }}
                onSendDicePlusRequest={sendDicePlusRollRequest}
                diceBridgeLastEvent={diceBridgeLastEvent}
                onSaveCall={(action, save) => broadcastSavePrompt(m.revealedName || m.displayName || m.name || "Monster", action, save)}
              />
            </div>
          ))}
        </div>

        <div style={{ borderLeft: "1px solid #23233a", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <PlayerViewPane combatants={playerCombatants} monsters={roster} />
        </div>
      </div>
    </div>
  );
}

function mountCombatWindow() {
  const root = document.getElementById("root");
  if (!root) return;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <CombatWindowApp />
    </React.StrictMode>
  );
}

if (OBR.isAvailable) {
  OBR.onReady(mountCombatWindow);
} else {
  mountCombatWindow();
}
