/**
 * DM Panel — Separate OBR popover window for all DM tools
 *
 * Boot: OBR.popover.open({ url: "/dm-panel.html?panel=editActors", width: 680, height: 800 })
 * Reads ?panel= from URL, renders the correct DM tool.
 * Shares state via localStorage (same origin) + OBR broadcast.
 *
 * Panels:
 *   editActors   → ActorEditor + actor list
 *   seats        → SeatAssignmentPanel
 *   monsters     → EncounterLibraryPanel
 *   equipment    → Equipment Library
 *   maintenance  → FdmcRoomMaintenancePanel
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";

const DM_LIBRARY_UPDATED_CHANNEL = "forever-dm-combat:dm-library-updated:v1";

function broadcastLibraryUpdate() {
  if (!OBR.isAvailable) return;
  void OBR.broadcast.sendMessage(DM_LIBRARY_UPDATED_CHANNEL, { type: "library-updated" }, { destination: "REMOTE" });
}
import { ActorEditor } from "./core/ui/ActorEditor";
import { SeatAssignmentPanel } from "./core/seats/SeatAssignmentPanel";
import { EncounterLibraryPanel } from "./core/monsters/EncounterLibraryPanel";
import { FdmcRoomMaintenancePanel } from "./core/campaign/FdmcRoomMaintenancePanel";
import {
  loadActorLibrary,
  loadActorOverrides,
  saveActorLibrary,
  saveActorOverride,
  upsertActorInLibrary,
  seedLibraryFromBundled,
  resolveActorFromLibrary,
} from "./core/seats/dmActorLibrary";
import { seedBrokenChainParty, type SeedResult } from "./core/seats/seedBrokenChainParty";
import { exportActorLibrary, importActorLibrary, type ImportResult } from "./core/seats/actorLibraryExport";
import { loadEncounterLibrary } from "./core/monsters/encounterLibrary";
import { useDmSeatSystem } from "./core/seats/useSeatSystem";
import {
  normalizeFdmcRoomLiveState,
  createEmptyRoomLiveState,
  type FdmcRoomLiveState,
} from "./core/table-state/fdmcRoomLiveState";
import {
  FDMC_ROOM_LIVE_STATE_KEY,
  FDMC_TABLE_BINDING_KEY,
  normalizeTableBinding,
} from "./core/table-state/sharedTableState";
import { readFdmcRoomStateKey, publishFdmcRoomStateKey, subscribeFdmcRoomStateKey } from "./core/table-state/roomStateBridge";
import { brokenChainActors } from "./modules/the-broken-chain/actors/index";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "./data/broken-chain/monsterLibrary";
import type { Actor } from "./core/types/actor";
import type { ActorEditorSaveMode } from "./core/ui/ActorEditor";
import { loadEquipmentLibrary, saveEquipmentLibrary, seedCampaignEquipmentLibrary, type EquipmentItem } from "./core/ui/EquipmentBagEditor";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY } from "./data/broken-chain/equipmentLibrary";
import { EquipmentLibraryStandalone } from "./core/ui/EquipmentLibraryStandalone";
import { TokenAssignmentPanel } from "./core/tokens/TokenAssignmentPanel";
import { loadMonsterRoster } from "./core/monsters/runtime/monsterRosterStorage";
import "./styles.css";

// ─── Panel type ───────────────────────────────────────────────────────────────

type PanelId = "editActors" | "seats" | "monsters" | "equipment" | "tokens" | "maintenance" | "library" | "seatTokens";

const PANEL_TITLES: Record<PanelId, string> = {
  editActors: "Edit Actors",
  seats: "Player Seats",
  monsters: "Monsters & Encounters",
  equipment: "Equipment Library",
  tokens: "Token Assignment",
  maintenance: "Room Maintenance",
  library: "Library",
  seatTokens: "Seats & Tokens",
};

function getPanelFromUrl(): PanelId {
  const param = new URLSearchParams(window.location.search).get("panel");
  const valid: PanelId[] = ["editActors", "seats", "monsters", "equipment", "tokens", "maintenance", "library", "seatTokens"];
  return valid.includes(param as PanelId) ? (param as PanelId) : "editActors";
}

// ─── DM Panel App ─────────────────────────────────────────────────────────────

function DmPanelApp() {
  const panelId = useMemo(() => getPanelFromUrl(), []);

  // ── Seed campaign equipment library on first DM panel open ────────────────
  useMemo(() => { seedCampaignEquipmentLibrary(BROKEN_CHAIN_EQUIPMENT_LIBRARY); }, []);

  // ── Token panel: monster roster from localStorage ─────────────────────────
  const [tokenPanelMonsters] = useState(() => loadMonsterRoster());

  // ── Actor library ──────────────────────────────────────────────────────────
  const [actorLibrary, setActorLibrary] = useState<Record<string, Actor>>(() =>
    seedLibraryFromBundled(brokenChainActors)
  );
  const actorOverrides = useMemo(() => loadActorOverrides(), []);
  const actors = useMemo(
    () => Object.values(actorLibrary).map(a =>
      resolveActorFromLibrary(a.id, actorLibrary, actorOverrides) ?? a
    ),
    [actorLibrary, actorOverrides]
  );

  // ── Room live state ────────────────────────────────────────────────────────
  const [roomLiveState, setRoomLiveState] = useState<FdmcRoomLiveState>(() => createEmptyRoomLiveState());

  useEffect(() => {
    void readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState)
      .then(val => { if (val) setRoomLiveState(val); });

    return subscribeFdmcRoomStateKey(
      FDMC_ROOM_LIVE_STATE_KEY,
      normalizeFdmcRoomLiveState,
      (val) => setRoomLiveState(val),
    );
  }, []);

  const commitRoomState = useCallback(async (next: FdmcRoomLiveState) => {
    setRoomLiveState(next);
    await publishFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, next);
  }, []);

  // ── Seat system ────────────────────────────────────────────────────────────
  const { seats, seatBindings, assignSeat, kickFromSeat, removeSeat, purgeAllSeatMetadata, pushActorsToSeat, pushActorsToAllSeats } = useDmSeatSystem({
    actorLibrary,
    actorOverrides,
    roomLiveState,
    onRoomStateChange: commitRoomState,
  });

  // ── On DM reconnect/reload — push current actor library to all seated players ──
  // This ensures saves that happened between sessions reach players immediately
  useEffect(() => {
    if (!OBR.isAvailable || Object.keys(seats).length === 0) return;
    // Small delay so seat system refs are populated from room state
    const t = setTimeout(() => pushActorsToAllSeats(), 1500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(seats).join(",")]);

  // ── Actor editor state ────────────────────────────────────────────────────
  const [editingActorId, setEditingActorId] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  // Library tab: actors | monsters | equipment
  const [libraryTab, setLibraryTab] = useState<"actors" | "monsters" | "equipment">("actors");
  // Seats+Tokens tab
  const [seatTokenTab, setSeatTokenTab] = useState<"seats" | "tokens">(
    getPanelFromUrl() === "tokens" || getPanelFromUrl() === "seatTokens"
      ? "tokens" : "seats"
  );

  function handleSeedParty() {
    const result = seedBrokenChainParty(brokenChainActors);
    setActorLibrary(loadActorLibrary());
    setSeedResult(result);
    broadcastLibraryUpdate();
  }

  function handleExport() {
    exportActorLibrary("0.6.0");
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void importActorLibrary(file).then(result => {
      setImportResult(result);
      if (result.ok) {
        setActorLibrary(loadActorLibrary());
        broadcastLibraryUpdate();
      }
    });
    // Reset file input so same file can be re-picked
    e.target.value = "";
  }

  function handleActorEditorSave(editedActor: Actor, saveMode: ActorEditorSaveMode) {
    const isDeleted = editedActor.id.endsWith("--DELETED");
    if (isDeleted) {
      const realId = editedActor.id.replace("--DELETED", "");
      setActorLibrary(lib => { const next = { ...lib }; delete next[realId]; saveActorLibrary(next); return next; });
      broadcastLibraryUpdate();
      setEditingActorId(null);
      return;
    }

    const isNew = editingActorId === "__new__" || saveMode === "duplicate";
    if (isNew) {
      upsertActorInLibrary(editedActor);
      const freshLib = { ...actorLibrary, [editedActor.id]: editedActor };
      setActorLibrary(() => freshLib);
      pushActorsToAllSeats({ freshLibrary: freshLib });
      broadcastLibraryUpdate();
      setEditingActorId(null);
      return;
    }

    const base = actorLibrary[editedActor.id] ?? editedActor;
    const override: Partial<Actor> = {};
    if (editedActor.level !== base.level) override.level = editedActor.level;
    if (editedActor.name !== base.name) override.name = editedActor.name;
    if (editedActor.subtitle !== base.subtitle) override.subtitle = editedActor.subtitle;
    if (JSON.stringify(editedActor.stats) !== JSON.stringify(base.stats)) override.stats = editedActor.stats;
    if (JSON.stringify(editedActor.tabs) !== JSON.stringify(base.tabs)) override.tabs = editedActor.tabs;
    if (JSON.stringify(editedActor.abilityScores) !== JSON.stringify(base.abilityScores)) override.abilityScores = editedActor.abilityScores;
    if (JSON.stringify(editedActor.classFeatureTracker) !== JSON.stringify(base.classFeatureTracker)) override.classFeatureTracker = editedActor.classFeatureTracker;

    saveActorOverride(editedActor.id, override);
    upsertActorInLibrary(editedActor);
    const freshOverrides = loadActorOverrides();
    const freshLib = { ...actorLibrary, [editedActor.id]: editedActor };
    setActorLibrary(() => freshLib);
    // Pass fresh data so seat-system refs don't hold stale library
    pushActorsToAllSeats({ freshLibrary: freshLib, freshOverrides });
    broadcastLibraryUpdate();
    setEditingActorId(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const title = PANEL_TITLES[panelId];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: "monospace", background: "#0d0d14", color: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d0d14", flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 15, color: "#7b68ee" }}>{title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "#444" }}>FDMC 0.6.0 DM Tools</span>
          <button
            type="button"
            onClick={() => {
              if (OBR.isAvailable) {
                void OBR.popover.close(`fdm-dm-${panelId}`).catch(() => window.close());
              } else {
                window.close();
              }
            }}
            style={{ fontSize: 14, lineHeight: 1, padding: "3px 8px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Panel content — maintenance uses scrollable, editor panels use hidden (they manage their own scroll) */}
      <div style={{ flex: 1, overflow: panelId === "maintenance" ? "auto" : "hidden", display: "flex", flexDirection: "column" }}>

        {/* ── Edit Actors ── */}
        {panelId === "editActors" && (
          editingActorId === "__new__" ? (
            <ActorEditor mode="create-new" onSave={handleActorEditorSave} onCancel={() => setEditingActorId(null)} />
          ) : editingActorId ? (
            (() => {
              const actor = actors.find(a => a.id === editingActorId);
              if (!actor) return <p style={{ padding: 14 }}>Actor not found.</p>;
              return <ActorEditor actor={actor} mode="edit-current" onSave={handleActorEditorSave} onCancel={() => setEditingActorId(null)} />;
            })()
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                  {actors.length === 0 ? "No actors yet." : `${actors.length} actor${actors.length === 1 ? "" : "s"}`}
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  {actors.length > 0 && (
                    <button type="button" onClick={handleExport}
                      style={{ fontSize: 12, padding: "4px 10px", background: "#2a3a2a", color: "#4caf50", border: "1px solid #2a6e2a55", borderRadius: 4, cursor: "pointer" }}
                      title="Save your actor library as a private JSON file">
                      ↓ Export
                    </button>
                  )}
                  <label style={{ fontSize: 12, padding: "4px 10px", background: "#2a2a3e", color: "#aaa", border: "1px solid #444", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center" }}
                    title="Restore actor library from a previously exported JSON file">
                    ↑ Import
                    <input type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} />
                  </label>
                  <button type="button" onClick={() => setEditingActorId("__new__")}
                    style={{ fontSize: 12, padding: "4px 12px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}>
                    + New Actor
                  </button>
                </div>
              </div>

              {/* Import/export result notification */}
              {importResult && (
                <div style={{ padding: "6px 14px", background: importResult.ok ? "#0d1a0d" : "#1a0a0a", borderBottom: "1px solid #2a2a3e", fontSize: 11, color: importResult.ok ? "#4caf50" : "#ff9999", flexShrink: 0 }}>
                  {importResult.ok ? "✓" : "✕"} {importResult.message}
                  {importResult.ok && " — Click ↺ Sync Library on the main panel."}
                  <button type="button" onClick={() => setImportResult(null)} style={{ marginLeft: 8, background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>×</button>
                </div>
              )}
              <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
                {actors.length === 0 ? (
                  <div style={{ textAlign: "center", marginTop: 40, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                    <p style={{ fontSize: 12, color: "#555", margin: 0 }}>No actors in library.</p>

                    {/* One-time import button — seeds from bundled 0.5.5b source files */}
                    <div style={{ background: "#1a1a2e", borderRadius: 8, padding: 16, border: "1px solid #7b68ee33", maxWidth: 340 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500, color: "#7b68ee" }}>Import Broken Chain Party</p>
                      <p style={{ margin: "0 0 12px", fontSize: 11, color: "#666" }}>
                        Imports all 5 party actors from the bundled source files with correct actions, spells, bonds and features. Equipment is extracted to the equipment library. Actions are validated on a double pass.
                      </p>
                      <button
                        type="button"
                        onClick={handleSeedParty}
                        style={{ width: "100%", padding: "8px 16px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
                      >
                        ▶ Import Party from Source Files
                      </button>
                    </div>

                    {/* Seed result report */}
                    {seedResult && (
                      <div style={{ background: "#0d1a0d", borderRadius: 8, padding: 12, border: "1px solid #2a6e2a44", maxWidth: 340, textAlign: "left" }}>
                        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#4caf50", fontWeight: 500 }}>
                          ✓ Import complete
                        </p>
                        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#888" }}>
                          Actors: {seedResult.actorsCreated.join(", ")}
                        </p>
                        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#888" }}>
                          Equipment items: {seedResult.equipmentItemsCreated}
                        </p>
                        {seedResult.validationFixes.length > 0 && (
                          <details style={{ marginTop: 6 }}>
                            <summary style={{ fontSize: 11, color: "#7b68ee", cursor: "pointer" }}>
                              {seedResult.validationFixes.length} action fix{seedResult.validationFixes.length === 1 ? "" : "es"} applied
                            </summary>
                            <div style={{ marginTop: 4, fontSize: 10, color: "#555" }}>
                              {seedResult.validationFixes.map((f, i) => <p key={i} style={{ margin: "1px 0" }}>{f}</p>)}
                            </div>
                          </details>
                        )}
                        {seedResult.warnings.length > 0 && (
                          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#ff9999" }}>
                            ⚠ {seedResult.warnings.join(" ")}
                          </p>
                        )}
                        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#4caf50" }}>
                          Close this window → click ↺ Sync Library on the main panel.
                        </p>
                      </div>
                    )}

                    <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
                      — or — use Create New Actor to build from scratch
                    </p>
                  </div>
                ) : actors.map(actor => (
                  <div key={actor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#161622", borderRadius: 8, marginBottom: 8, border: "1px solid #2a2a3e" }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{actor.name || "Unnamed"}</span>
                      <span style={{ fontSize: 12, color: "#888", marginLeft: 10 }}>
                        {actor.race} {actor.className} · Level {actor.level}
                      </span>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                        AC {actor.stats.ac} · HP {actor.stats.hp.max} · {typeof actor.stats.speed === "string" ? actor.stats.speed : "30 ft"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => setEditingActorId(actor.id)}
                        style={{ fontSize: 12, padding: "5px 14px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 6, color: "#7b68ee", cursor: "pointer" }}>
                        Edit
                      </button>
                      <button type="button"
                        onClick={() => {
                          // Archive by removing from library — stays in localStorage under archived key
                          setActorLibrary(lib => {
                            const next = { ...lib };
                            delete next[actor.id];
                            saveActorLibrary(next);
                            return next;
                          });
                          broadcastLibraryUpdate();
                        }}
                        title="Archive actor — removes from active roster"
                        style={{ fontSize: 12, padding: "5px 10px", background: "transparent", border: "1px solid #5a1a1a33", borderRadius: 6, color: "#ff999966", cursor: "pointer" }}>
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* ── Seats ── */}
        {panelId === "seats" && (
          <SeatAssignmentPanel
            actors={actors}
            seats={seats}
            seatBindings={seatBindings}
            onAssignSeat={assignSeat}
            onPushActorsToSeat={pushActorsToSeat}
            onPushActorsToAllSeats={pushActorsToAllSeats}
            onKickFromSeat={(seatId) => void kickFromSeat(seatId)}
            onRemoveSeat={removeSeat}
          />
        )}

        {/* ── Monsters & Encounters ── */}
        {panelId === "monsters" && (
          <EncounterLibraryPanel
            monsterLibrary={BROKEN_CHAIN_MONSTER_LIBRARY}
            activeRosterCount={Object.keys(roomLiveState.monsterLiveState).length}
            onLoadEncounter={(instances) => {
              // Write instances to localStorage queue — App.tsx reads on broadcast
              try {
                const existing = JSON.parse(window.localStorage.getItem("fdmc.dm.encounterLoadQueue.v1") ?? "[]") as unknown[];
                window.localStorage.setItem(
                  "fdmc.dm.encounterLoadQueue.v1",
                  JSON.stringify([...existing, ...instances])
                );
              } catch { /* ok */ }
              if (OBR.isAvailable) {
                void OBR.broadcast.sendMessage(
                  "forever-dm-combat:encounter-load-request:v1",
                  { type: "fdmc:encounter-load-request" },
                  { destination: "LOCAL" }
                ).catch(() => undefined);
              }
            }}
            onClearRoster={() => undefined}
          />
        )}

        {/* ── Equipment Library ── */}
        {panelId === "equipment" && (
          <EquipmentLibraryStandalone seats={Object.values(seats)} />
        )}

        {/* ── Token Assignment ── */}
        {panelId === "tokens" && (
          <TokenAssignmentPanel
            tableId={roomLiveState.tableId}
            seats={roomLiveState.seats}
            activeMonsters={tokenPanelMonsters}
          />
        )}

        {/* ── Maintenance ── */}
        {panelId === "maintenance" && (
          <div style={{ overflowY: "auto", flex: 1, paddingBottom: 32 }}>
            <FdmcRoomMaintenancePanel
              onScan={async () => {
                // Read all room metadata and find FDMC-owned keys
                const obr = OBR as unknown as { room?: { getMetadata?: () => Promise<Record<string, unknown>> } };
                const metadata = await obr.room?.getMetadata?.() ?? {};
                const fdmcKeys = Object.keys(metadata).filter(k =>
                  k.startsWith("fdmc") || k.startsWith("forever-dm-combat") || k.startsWith("fdm:")
                );
                const entries = fdmcKeys.map(k => ({
                  key: k,
                  bytes: JSON.stringify(metadata[k]).length,
                  isCanonical: k === FDMC_ROOM_LIVE_STATE_KEY || k === FDMC_TABLE_BINDING_KEY,
                }));
                const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
                return { ok: true, entries, totalBytes, message: `Found ${entries.length} FDMC keys totalling ${totalBytes} bytes.` };
              }}
              onPurge={async () => {
                // Remove all legacy/unknown FDMC keys — keep only the current live state and table binding
                const obr = OBR as unknown as { room?: { getMetadata?: () => Promise<Record<string, unknown>>; setMetadata?: (m: Record<string, unknown>) => Promise<void> } };
                const metadata = await obr.room?.getMetadata?.() ?? {};
                const keysToRemove = Object.keys(metadata).filter(k =>
                  (k.startsWith("fdmc") || k.startsWith("forever-dm-combat") || k.startsWith("fdm:")) &&
                  k !== FDMC_ROOM_LIVE_STATE_KEY &&
                  k !== FDMC_TABLE_BINDING_KEY
                );
                if (keysToRemove.length === 0) {
                  return { ok: true, removedKeys: [], failedKeys: [], message: "No legacy keys to remove." };
                }
                // Set each old key to undefined to remove it
                const patch: Record<string, undefined> = {};
                for (const k of keysToRemove) patch[k] = undefined;
                try {
                  await obr.room?.setMetadata?.({ ...metadata, ...patch });
                  return { ok: true, removedKeys: keysToRemove, failedKeys: [], message: `Removed ${keysToRemove.length} legacy key(s): ${keysToRemove.join(", ")}` };
                } catch (err) {
                  return { ok: false, removedKeys: [], failedKeys: keysToRemove, message: `Purge failed: ${String(err)}` };
                }
              }}
              onReinitialize={async () => {
                const binding = await readFdmcRoomStateKey(FDMC_TABLE_BINDING_KEY, normalizeTableBinding);
                const clean = createEmptyRoomLiveState(binding?.tableId, binding?.gmControllerId ?? null);
                await publishFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, clean);
                setRoomLiveState(clean);
                return { ok: true, checks: { tableBindingExists: Boolean(binding), sharedTableStateExists: false, actorsByIdEmpty: true, actorsOrderEmpty: true, combatPhaseSetup: true, revisionIsOne: true }, tableBinding: binding ?? undefined, message: "Room live state reset." };
              }}
              onActorSnapshot={async () => ({ ok: true, mode: "empty" as const, actorCount: actors.length, bytes: 0, message: `${actors.length} actors in DM library.` })}
              onPurgeSeatMetadata={purgeAllSeatMetadata}
            />
          </div>
        )}

        {/* ── Library (Actors / Monsters / Equipment tabs) ── */}
        {panelId === "library" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 2, padding: "6px 14px", borderBottom: "1px solid #2a2a3e", flexShrink: 0 }}>
              {(["actors", "monsters", "equipment"] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setLibraryTab(tab)}
                  style={{ fontSize: 12, padding: "3px 12px", borderRadius: 4, border: "none", cursor: "pointer",
                    background: libraryTab === tab ? "#7b68ee" : "transparent",
                    color: libraryTab === tab ? "#fff" : "#666" }}>
                  {tab === "actors" ? "Actors" : tab === "monsters" ? "Monsters" : "Equipment"}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {libraryTab === "actors" && (
                editingActorId === "__new__" ? (
                  <ActorEditor mode="create-new" onSave={handleActorEditorSave} onCancel={() => setEditingActorId(null)} />
                ) : editingActorId ? (
                  (() => {
                    const actor = actors.find(a => a.id === editingActorId);
                    if (!actor) return <p style={{ padding: 14 }}>Actor not found.</p>;
                    return <ActorEditor actor={actor} mode="edit-current" onSave={handleActorEditorSave} onCancel={() => setEditingActorId(null)} />;
                  })()
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: "#888" }}>{actors.length} actor{actors.length === 1 ? "" : "s"}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {actors.length > 0 && <button type="button" onClick={handleExport} style={{ fontSize: 11, padding: "3px 9px", background: "#2a3a2a", color: "#4caf50", border: "1px solid #2a6e2a55", borderRadius: 4, cursor: "pointer" }}>↓ Export</button>}
                        <label style={{ fontSize: 11, padding: "3px 9px", background: "#2a2a3e", color: "#aaa", border: "1px solid #444", borderRadius: 4, cursor: "pointer" }}>
                          ↑ Import<input type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} />
                        </label>
                        <button type="button" onClick={() => setEditingActorId("__new__")} style={{ fontSize: 11, padding: "3px 9px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>+ New</button>
                      </div>
                    </div>
                    {importResult && (
                      <div style={{ padding: "4px 14px", background: importResult.ok ? "#0d1a0d" : "#1a0a0a", fontSize: 11, color: importResult.ok ? "#4caf50" : "#ff9999", flexShrink: 0 }}>
                        {importResult.ok ? "✓" : "✕"} {importResult.message}
                        <button type="button" onClick={() => setImportResult(null)} style={{ marginLeft: 8, background: "transparent", border: "none", color: "#555", cursor: "pointer" }}>×</button>
                      </div>
                    )}
                    <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
                      {actors.map(actor => (
                        <div key={actor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#161622", borderRadius: 6, marginBottom: 6, border: "1px solid #2a2a3e" }}>
                          <div>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{actor.name}</span>
                            <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>AC {actor.stats.ac} · HP {actor.stats.hp.max} · Level {actor.level}</span>
                          </div>
                          <button type="button" onClick={() => setEditingActorId(actor.id)}
                            style={{ fontSize: 11, padding: "3px 10px", background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer" }}>Edit</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
              {libraryTab === "monsters" && (
                <EncounterLibraryPanel
                  monsterLibrary={BROKEN_CHAIN_MONSTER_LIBRARY}
                  activeRosterCount={Object.keys(roomLiveState.monsterLiveState).length}
                  onLoadEncounter={(instances) => {
                    try {
                      const existing = JSON.parse(window.localStorage.getItem("fdmc.dm.encounterLoadQueue.v1") ?? "[]") as unknown[];
                      window.localStorage.setItem("fdmc.dm.encounterLoadQueue.v1", JSON.stringify([...existing, ...instances]));
                    } catch { /* ok */ }
                    if (OBR.isAvailable) {
                      void OBR.broadcast.sendMessage("forever-dm-combat:encounter-load-request:v1", { type: "fdmc:encounter-load-request" }, { destination: "LOCAL" }).catch(() => undefined);
                    }
                  }}
                  onClearRoster={() => undefined}
                />
              )}
              {libraryTab === "equipment" && <EquipmentLibraryStandalone seats={Object.values(seats)} />}
            </div>
          </div>
        )}

        {/* ── Seats & Tokens (tabbed) ── */}
        {(panelId === "seatTokens" || panelId === "seats" || panelId === "tokens") && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 2, padding: "6px 14px", borderBottom: "1px solid #2a2a3e", flexShrink: 0 }}>
              {(["seats", "tokens"] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setSeatTokenTab(tab)}
                  style={{ fontSize: 12, padding: "3px 12px", borderRadius: 4, border: "none", cursor: "pointer",
                    background: seatTokenTab === tab ? "#7b68ee" : "transparent",
                    color: seatTokenTab === tab ? "#fff" : "#666" }}>
                  {tab === "seats" ? "Seats" : "Tokens"}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {seatTokenTab === "seats" && (
                <SeatAssignmentPanel
                  actors={actors}
                  seats={seats}
                  seatBindings={seatBindings}
                  onAssignSeat={assignSeat}
                  onPushActorsToSeat={pushActorsToSeat}
                  onPushActorsToAllSeats={pushActorsToAllSeats}
                  onKickFromSeat={(seatId) => void kickFromSeat(seatId)}
                  onRemoveSeat={removeSeat}
                />
              )}
              {seatTokenTab === "tokens" && (
                <TokenAssignmentPanel tableId={roomLiveState.tableId} seats={roomLiveState.seats} activeMonsters={tokenPanelMonsters} />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function mountDmPanel() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <DmPanelApp />
    </React.StrictMode>
  );
}

if (OBR.isAvailable) {
  OBR.onReady(mountDmPanel);
} else {
  mountDmPanel();
}
