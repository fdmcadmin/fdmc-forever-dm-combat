/**
 * Player Tracker Overlay — Monster Gate WS-B/B2.
 *
 * A small standalone popover (id "fdm-player-tracker") a PLAYER opens ALONGSIDE their
 * character-sheet card(s): the whole party in turn order with HP bars + counts, plus
 * the player-safe monster rows. Read-only v1 — initiative rolls stay on the PC/monster
 * cards (the spec allows either home; the cards already do it).
 *
 * Data comes ONLY from player-legal sources (this window runs in a player's browser —
 * there is no DM localStorage here):
 *   - party:    FDMC_CHANNELS.partyTracker broadcast (+ request on mount for late join)
 *   - monsters: FDMC_CHANNELS.monsterRoster broadcast (+ request on mount) — ratio HP
 *               only, real monster numbers never reach this window
 *   - phase / round / active turn / initiative: the shared room live state
 *
 * This mirrors the in-app player tracker merge (App.tsx allCombatants, player branch)
 * so the overlay always agrees with what the main window shows.
 */

import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { FDMC_CHANNELS } from "./core/constants/channels";
import { sortCombatants, isOutOfCombat, type Combatant } from "./core/ui/CombatTracker";
import { FDMC_ROOM_LIVE_STATE_KEY } from "./core/table-state/sharedTableState";
import { subscribeFdmcRoomStateKey } from "./core/table-state/roomStateBridge";
import { normalizeFdmcRoomLiveState, createEmptyRoomLiveState, type FdmcRoomLiveState } from "./core/table-state/fdmcRoomLiveState";
import "./styles.css";

const TRACKER_POPOVER_ID = "fdm-player-tracker";

const params = new URLSearchParams(window.location.search);
const SEAT_COLOR = params.get("seatColor") || "#7b68ee";

/** Structural copy of the player-safe monster broadcast payload (see App.tsx
 *  broadcastMonsterRoster) — declared locally so this entry never imports App. */
type OverlayMonster = {
  instanceId: string;
  publicName: string;
  visibilityState: string;
  showHpBar: boolean;
  hpRatio: number;
  isDown: boolean;
  conditionLabel: string;
};

function hpColor(current: number, max: number): string {
  if (current <= 0) return "#555";
  const ratio = max > 0 ? current / max : 0;
  if (ratio <= 0.25) return "#ff4444";
  if (ratio <= 0.5) return "#e07b39";
  if (ratio <= 0.75) return "#f0c040";
  return "#4caf50";
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div style={{ height: 6, background: "#1c1c2c", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: hpColor(current, max), transition: "width 0.25s" }} />
    </div>
  );
}

function PlayerTrackerApp() {
  const [partyRoster, setPartyRoster] = useState<Combatant[]>([]);
  const [monsters, setMonsters] = useState<OverlayMonster[]>([]);
  const [roomState, setRoomState] = useState<FdmcRoomLiveState>(() => createEmptyRoomLiveState());

  // Party roster — DM broadcast + request on mount (late-join covered).
  useEffect(() => {
    if (!OBR.isAvailable) return;
    const unsub = OBR.broadcast.onMessage(FDMC_CHANNELS.partyTracker, (event) => {
      const msg = event.data as { type?: string; party?: Combatant[] } | undefined;
      if (msg?.type === "fdmc:party-tracker" && Array.isArray(msg.party)) setPartyRoster(msg.party);
    });
    void OBR.broadcast.sendMessage(FDMC_CHANNELS.partyTracker, { type: "fdmc:party-tracker-request" }, { destination: "REMOTE" }).catch(() => undefined);
    return unsub;
  }, []);

  // Player-safe monster roster — DM broadcast + request on mount.
  useEffect(() => {
    if (!OBR.isAvailable) return;
    const unsub = OBR.broadcast.onMessage(FDMC_CHANNELS.monsterRoster, (event) => {
      const msg = event.data as { type?: string; monsters?: OverlayMonster[] } | undefined;
      if (msg?.type === "fdmc:monster-roster" && Array.isArray(msg.monsters)) setMonsters(msg.monsters);
    });
    void OBR.broadcast.sendMessage(FDMC_CHANNELS.monsterRoster, { type: "fdmc:monster-roster-request" }, { destination: "REMOTE" }).catch(() => undefined);
    return unsub;
  }, []);

  // Shared combat state — phase / round / active turn / initiative.
  useEffect(() => {
    return subscribeFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState, setRoomState);
  }, []);

  // Merge — identical policy to the in-app player tracker: party rows carry real HP
  // (healers need ally numbers), monster rows are ratio-only bars.
  const combatants = useMemo(() => {
    const partyCombatants: Combatant[] = partyRoster.map(c => ({
      ...c,
      isActive: c.id === roomState.combat.activeActorId,
    }));
    const monsterCombatants: Combatant[] = monsters.map(m => ({
      id: m.instanceId,
      name: m.publicName,
      kind: "monster" as const,
      initiative: roomState.monsterLiveState[m.instanceId]?.initiative ?? null,
      initiativeBonus: 0,
      hp: { current: Math.round(m.hpRatio * 100), max: 100 },
      isActive: m.instanceId === roomState.combat.activeActorId,
      isDead: m.isDown,
    }));
    return sortCombatants([...partyCombatants, ...monsterCombatants]);
  }, [partyRoster, monsters, roomState]);

  const monstersByInstanceId = useMemo(() => new Map(monsters.map(m => [m.instanceId, m])), [monsters]);
  const phaseLabel = roomState.combat.phase === "combat"
    ? `Round ${roomState.combat.round}`
    : roomState.combat.phase === "initiative" ? "Rolling initiative" : "Waiting";

  return (
    <div style={{ background: "#0d0d14", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header — seat-tinted rail so the window reads as "yours" */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
        borderBottom: "1px solid #2a2a3e", borderLeft: `3px solid ${SEAT_COLOR}`,
        background: "#12121c", position: "sticky", top: 0, zIndex: 5,
      }}>
        <strong style={{ color: SEAT_COLOR, fontSize: 12.5 }}>⚔ Turn Order</strong>
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
          color: roomState.combat.phase === "combat" ? "#4caf50" : "#f0c040",
          border: `1px solid ${roomState.combat.phase === "combat" ? "#2c5231" : "#5a4a1e"}`,
        }}>
          {phaseLabel}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            if (OBR.isAvailable) void OBR.popover.close(TRACKER_POPOVER_ID).catch(() => window.close());
            else window.close();
          }}
          style={{ background: "transparent", color: "#666", border: "1px solid #2a2a3e", borderRadius: 5, padding: "2px 8px", fontSize: 10.5, cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      {/* Turn-order list */}
      <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {combatants.length === 0 && (
          <div style={{ fontSize: 11, color: "#666", padding: "14px 6px", textAlign: "center" }}>
            Waiting for the DM's roster…
          </div>
        )}
        {combatants.map(c => {
          const monster = c.kind === "monster" ? monstersByInstanceId.get(c.id) : undefined;
          const benched = isOutOfCombat(c);
          // Party rows show real numbers; monsters only what their visibility allows.
          const showNumbers = c.kind === "actor";
          const showBar = c.kind === "actor" || (monster?.showHpBar ?? false);
          const showCondition = monster && !monster.showHpBar && monster.conditionLabel;
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
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {c.isActive && <span style={{ color: "#f0c040", fontSize: 10 }}>▶</span>}
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: c.kind === "monster" ? "#e08585" : "#dfe4ff" }}>
                  {c.name}
                </span>
                <span style={{ fontSize: 10, color: "#667" }}>
                  {benched ? "out" : c.initiative !== null ? `init ${c.initiative}` : "—"}
                </span>
              </div>
              {showNumbers && (
                <div style={{ fontSize: 10, color: hpColor(c.hp.current, c.hp.max) }}>
                  {c.hp.current} / {c.hp.max} HP{c.hp.temp ? ` (+${c.hp.temp})` : ""}
                </div>
              )}
              {showCondition && (
                <div style={{ fontSize: 10, color: "#e08585" }}>{monster.conditionLabel}</div>
              )}
              {c.isDead && c.kind === "monster" && (
                <div style={{ fontSize: 10, color: "#777" }}>Down</div>
              )}
              {showBar && <HpBar current={c.hp.current} max={c.hp.max} />}
              {/* Companions ride their owner's turn — show them nested */}
              {c.companions?.map(comp => (
                <div key={comp.id} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 12 }}>
                  <span style={{ fontSize: 11, color: "#9aa4d4", flex: 1 }}>└ {comp.name}</span>
                  <span style={{ fontSize: 9.5, color: hpColor(comp.hp.current, comp.hp.max) }}>
                    {comp.hp.current}/{comp.hp.max}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mountPlayerTracker() {
  const root = document.getElementById("root");
  if (!root) return;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <PlayerTrackerApp />
    </React.StrictMode>
  );
}

if (OBR.isAvailable) {
  OBR.onReady(mountPlayerTracker);
} else {
  mountPlayerTracker();
}
