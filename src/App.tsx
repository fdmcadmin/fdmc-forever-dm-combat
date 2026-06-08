import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FDMC_CHANNELS } from "./core/constants/channels";
import { FDMC_STORAGE_KEYS } from "./core/constants/storageKeys";
const ENCOUNTER_LOAD_QUEUE_KEY = FDMC_STORAGE_KEYS.encounterLoadQueue;
const ENCOUNTER_LOAD_CHANNEL = FDMC_CHANNELS.encounterLoadRequest;
const MONSTER_ROSTER_CHANNEL = FDMC_CHANNELS.monsterRoster;
const VIEWER_PARTY_CHANNEL = FDMC_CHANNELS.viewerParty;
const PARTY_TRACKER_CHANNEL = FDMC_CHANNELS.partyTracker;

type ViewerActorSummary = {
  id: string;
  name: string;
  hpCurrent: number;
  hpMax: number;
  status: string;
};

export type PlayerSafeMonster = {
  instanceId: string;
  publicName: string;
  visibilityState: string;
  showHpBar: boolean;
  hpRatio: number;
  /** True only when the monster is genuinely at 0 HP AND visible — never set for
   *  hidden monsters (would leak), and NOT inferred from a hidden HP bar. */
  isDown: boolean;
  conditionLabel: string;
  activeConditions: string[];
  ac: string;
  /** Whether monster has standard actions — shows "Action" category pill on player card */
  actionNames: string[];
  /** Whether monster has reactions — shows "Reaction" category pill on player card */
  reactionNames: string[];
  /** Whether monster has bonus actions — shows "Bonus" category pill on player card */
  hasBonusActions: boolean;
};
import OBR from "@owlbear-rodeo/sdk";
import { CombatLog } from "./core/combat-log/CombatLog";
import { RecentEventsWidget } from "./core/combat-log/RecentEventsWidget";
import { CombatTracker, buildCombatants, sortCombatants, type Combatant } from "./core/ui/CombatTracker";
import { patchCombat } from "./core/table-state/fdmcRoomLiveState";
import { EncounterCleanupPanel } from "./core/campaign/EncounterCleanupPanel";
import { FdmcRoomMaintenancePanel } from "./core/campaign/FdmcRoomMaintenancePanel";
import { useCombatLog } from "./core/combat-log/useCombatLog";
import { useActionEconomyState } from "./core/state/useActionEconomyState";
import { useActorConcentrationState } from "./core/state/useActorConcentrationState";
import { useCommittedRollState } from "./core/state/useCommittedRollState";
import { useActorLiveState } from "./core/state/useActorLiveState";
import { useActorNotesState } from "./core/state/useActorNotesState";
import { useActorStatusState } from "./core/state/useActorStatusState";
import { useResourceCounterState } from "./core/state/useResourceCounterState";
import { useOwlbearDiceBridge } from "./core/integrations/useOwlbearDiceBridge";
import { ToolPanelLayer } from "./core/runtime-shell/ToolPanelLayer";
import { getToolPanelTitle, type ToolPanelId } from "./core/runtime-shell/toolPanelTypes";
import { ActorCard } from "./core/ui/ActorCard";
import { ActorSelector } from "./core/ui/ActorSelector";
import { MonsterActorCard, MONSTER_ECONOMY_CHANNEL, type MonsterEconomyBroadcast } from "./core/ui/MonsterActorCard";
import { readTokenBinding } from "./core/tokens/tokenBinding";
// Token context menu is registered by the background page (src/background.ts), not here.
import { isObrReady, obrSend } from "./core/utils/obrReady";
import { loadEquipmentLibrary, itemToAction } from "./core/ui/EquipmentBagEditor";
import { MONSTER_POPOUT_HP_CHANNEL } from "./core/monster-state/useMonsterPopout";
import { MonsterSelector } from "./core/ui/MonsterSelector";
import { ActorEditor, type ActorEditorSaveMode } from "./core/ui/ActorEditor";
import { LevelUpApprovalPanel, LevelUpRequestPanel, isLevelUpRequest, type LevelUpRequest } from "./core/ui/LevelUpRequestPanel";
import { resolveActor, buildActorLibraryFromBundled } from "./core/table-state/actorHydrationBoundary";
import { SeatAssignmentPanel } from "./core/seats/SeatAssignmentPanel";
import { useDmSeatSystem, usePlayerSeatSystem } from "./core/seats/useSeatSystem";
import {
  seedLibraryFromBundled,
  loadActorLibrary,
  loadActorOverrides,
  saveActorLibrary,
  saveActorOverride,
  upsertActorInLibrary,
} from "./core/seats/dmActorLibrary";
import { FDMC_SEAT_BROADCAST_CHANNEL, hashViewerId } from "./core/seats/seatTypes";
import { buildActorSeatColorMap, getSeatColor, withAlpha, MONSTER_COLOR } from "./core/seats/seatColors";
import type { MonsterCombatCandidate, MonsterReaderAction } from "./core/monsters/MonsterJconScanner";
import { MonsterRuntimeSetupSlot } from "./core/monsters/runtime/MonsterRuntimeSetupSlot";
import { EncounterLibraryPanel } from "./core/monsters/EncounterLibraryPanel";
import { type MainEncounterMonsterInstance } from "./core/monsters/runtime/mainMonsterRuntime";
import {
  saveMonsterRoster,
  loadMonsterRoster,
  clearMonsterRoster,
} from "./core/monsters/runtime/monsterRosterStorage";
import {
  readFdmcRoomStateKey,
  publishFdmcRoomStateKey,
} from "./core/table-state/roomStateBridge";
import {
  deregisterMonsterInstance,
  patchMonsterInitiative,
  patchMonsterHp,
  pushRecentEvent,
  normalizeFdmcRoomLiveState,
} from "./core/table-state/fdmcRoomLiveState";
import {
  FDMC_TABLE_BINDING_KEY,
  FDMC_ROOM_LIVE_STATE_KEY,
  normalizeTableBinding,
  createTableBinding,
  type FdmcTableBinding,
} from "./core/table-state/sharedTableState";
import { DEFAULT_COMBAT_RULES_PROFILE } from "./core/types/committedRoll";
import type { Actor } from "./core/types/actor";
import { brokenChainActors } from "./modules/the-broken-chain/actors/index";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "./data/broken-chain/monsterLibrary";
import { appendLogEntry, clearEncounterLog, makeLogId, makeActionCode, readEncounterLog } from "./core/events/encounterLog";
import { generatePostCombatSummary, exportSummaryAsText, exportSummaryAsJson, downloadExport } from "./core/export/encounterLogExport";

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_VERSION = "FDMC 0.6.0-p3 · 2026-06-03";
const DM_LIBRARY_UPDATED_CHANNEL = FDMC_CHANNELS.dmLibraryUpdated;

// ─── DM toolbar button color system (P-UX1) ───────────────────────────────────
// Buttons are color-coded by *what they do* so the toolbar stops reading as a row
// of identical buttons:
//   create  → green   (build something new)
//   use     → blue    (open / navigate existing tools)
//   session → solid green (broadcast / "go" action)
//   cleanup → amber   (tidy the encounter)
//   fix     → clean cyan (only touch if something is broken)
//   danger  → red     (close / destructive)
//   claim   → purple  (table ownership)
const DM_BTN: Record<"create" | "use" | "session" | "cleanup" | "fix" | "danger" | "claim", React.CSSProperties> = {
  create:  { fontSize: 11, padding: "3px 11px", background: "#16291b", border: "1px solid #2f7d3f", borderRadius: 5, color: "#7be08a", cursor: "pointer", fontWeight: 600 },
  use:     { fontSize: 11, padding: "3px 11px", background: "#15233c", border: "1px solid #2f5d9e", borderRadius: 5, color: "#7db1ff", cursor: "pointer", fontWeight: 500 },
  session: { fontSize: 11, padding: "3px 11px", background: "#2a6e2a", border: "1px solid #3a8e3a", borderRadius: 5, color: "#eafff0", cursor: "pointer", fontWeight: 600 },
  cleanup: { fontSize: 11, padding: "3px 11px", background: "#2a2010", border: "1px solid #6e5a20", borderRadius: 5, color: "#e0b85a", cursor: "pointer", fontWeight: 500 },
  fix:     { fontSize: 11, padding: "3px 11px", background: "#0e2a2a", border: "1px solid #2f7d7d", borderRadius: 5, color: "#6fe0e0", cursor: "pointer", fontWeight: 500 },
  danger:  { fontSize: 11, padding: "3px 11px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 5, color: "#ff9999", cursor: "pointer" },
  claim:   { fontSize: 11, padding: "3px 11px", background: "#7b68ee", border: "none", borderRadius: 5, color: "#fff", cursor: "pointer", fontWeight: 600 },
};

// Group label that sits in front of a button cluster.
const dmGroupLabel = (color: string): React.CSSProperties => ({
  fontSize: 9, color, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, flexShrink: 0,
});

// Subtle shade variation within a family so a cluster reads as "shades of green /
// shades of blue" rather than three identical buttons.
const DM_CREATE_SHADES: React.CSSProperties[] = [
  { ...DM_BTN.create, background: "#16301d", border: "1px solid #379149", color: "#8ee89a" },
  { ...DM_BTN.create, background: "#15291b", border: "1px solid #2f7d3f", color: "#7be08a" },
  { ...DM_BTN.create, background: "#122417", border: "1px solid #2a6e38", color: "#6dd47e" },
];
const DM_USE_SHADES: React.CSSProperties[] = [
  { ...DM_BTN.use, background: "#172a45", border: "1px solid #3a6fb0", color: "#93c0ff" },
  { ...DM_BTN.use, background: "#15233c", border: "1px solid #2f5d9e", color: "#7db1ff" },
  { ...DM_BTN.use, background: "#122036", border: "1px solid #2a548c", color: "#6aa6f5" },
];

// Shared maintenance helpers
// The only room-metadata keys the 0.6.0 build keeps: compact live state + table
// binding. Everything else FDMC-prefixed is legacy and safe to purge.
const FDMC_KEEP_KEYS = new Set([
  FDMC_ROOM_LIVE_STATE_KEY,
  FDMC_TABLE_BINDING_KEY,
]);

async function scanFdmcRoomMetadata() {
  if (!OBR.isAvailable) return { ok: true, entries: [], totalBytes: 0, message: "Not in Owlbear." };
  const obr = OBR as unknown as { room?: { getMetadata?: () => Promise<Record<string, unknown>> } };
  const metadata = await obr.room?.getMetadata?.() ?? {};
  const entries = Object.keys(metadata)
    .filter(k => k.startsWith("fdmc") || k.startsWith("forever-dm-combat") || k.startsWith("fdm:"))
    .map(k => ({ key: k, bytes: JSON.stringify(metadata[k]).length, isCanonical: FDMC_KEEP_KEYS.has(k) }));
  return { ok: true, entries, totalBytes: entries.reduce((s, e) => s + e.bytes, 0), message: `${entries.length} FDMC key(s).` };
}

async function purgeLegacyFdmcMetadata() {
  if (!OBR.isAvailable) return { ok: false, removedKeys: [], failedKeys: [], message: "Not in Owlbear." };
  const obr = OBR as unknown as { room?: { getMetadata?: () => Promise<Record<string, unknown>>; setMetadata?: (m: Record<string, unknown>) => Promise<void> } };
  const metadata = await obr.room?.getMetadata?.() ?? {};
  const keysToRemove = Object.keys(metadata).filter(k =>
    (k.startsWith("fdmc") || k.startsWith("forever-dm-combat") || k.startsWith("fdm:")) &&
    !FDMC_KEEP_KEYS.has(k)
  );
  if (keysToRemove.length === 0) return { ok: true, removedKeys: [], failedKeys: [], message: "No legacy keys found." };
  const patch: Record<string, undefined> = {};
  for (const k of keysToRemove) patch[k] = undefined;
  try {
    await obr.room?.setMetadata?.({ ...metadata, ...patch });
    return { ok: true, removedKeys: keysToRemove, failedKeys: [], message: `Removed ${keysToRemove.length} legacy key(s): ${keysToRemove.join(", ")}` };
  } catch (err) {
    return { ok: false, removedKeys: [], failedKeys: keysToRemove, message: `Purge failed: ${String(err)}` };
  }
}

// ─── Viewer role ──────────────────────────────────────────────────────────────

function useViewerRole(tableBinding: FdmcTableBinding | null) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [idLoaded, setIdLoaded] = useState(false);

  useEffect(() => {
    if (!OBR.isAvailable) {
      setIdLoaded(true); // outside Owlbear — no viewer ID available
      return;
    }
    void OBR.player.getId()
      .then(id => { setViewerId(id); setIdLoaded(true); })
      .catch(() => setIdLoaded(true));
  }, []);

  // Still loading viewer ID — return loading state
  if (!idLoaded) return "loading" as const;
  // No table binding — DM needs to claim
  if (!tableBinding) return "unknown" as const;
  // Binding exists and viewer ID matches
  if (tableBinding.gmControllerId === viewerId) return "dm" as const;
  // Binding exists, viewer ID loaded but doesn't match → player
  return "player" as const;
}

// ─── App ─────────────────────────────────────────────────────────────────────

// ─── Player-safe monster roster ───────────────────────────────────────────────

function PlayerMonsterRoster({
  monsters,
  peekId,
  onPeek,
}: {
  monsters: PlayerSafeMonster[];
  peekId?: string | null;
  onPeek?: (id: string) => void;
}) {
  if (monsters.length === 0) return null;
  return (
    <section aria-label="Monster roster">
      <h2 className="panel-title" style={{ color: MONSTER_COLOR, borderLeft: `3px solid ${MONSTER_COLOR}`, paddingLeft: 8 }}>Monsters</h2>
      <div className="actor-list actor-card-grid-2x3">
        {monsters.map(m => {
          const ratio = m.hpRatio;
          const condColor = m.conditionLabel === "Down" ? "#555"
            : ratio <= 0.25 ? "#ff4444"
            : ratio <= 0.5 ? "#e07b39"
            : ratio <= 0.75 ? "#f0c040"
            : "#4caf50";
          return (
            <div key={m.instanceId} style={{ display: "flex", flexDirection: "column" }}>
              <button
                type="button"
                className={`actor-select-button actor-grid-card ${peekId === m.instanceId ? "active" : ""}`}
                onClick={() => onPeek?.(m.instanceId)}
                aria-label={`View ${m.publicName}`}
                style={{ cursor: onPeek ? "pointer" : "default" }}
              >
                <span className="actor-grid-name">{m.publicName || "Unknown creature"}</span>
                <span className="actor-grid-meta" style={{ color: condColor }}>
                  {m.conditionLabel || "—"}
                </span>
              </button>
              {/* Peek panel — HP bar, conditions, action/reaction pills */}
              {peekId === m.instanceId && (
                <div style={{ background: "#161622", border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 10px", margin: "2px 0 6px", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {m.ac && <span style={{ fontSize: 11, color: "#aaa" }}>AC {m.ac}</span>}
                    <span style={{ fontSize: 11, color: condColor }}>{m.conditionLabel || "—"}</span>
                  </div>
                  {m.showHpBar && (
                    <div style={{ height: 5, background: "#2a2a2a", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, m.hpRatio * 100))}%`, background: condColor, borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                  )}
                  {m.activeConditions.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {m.activeConditions.map(c => (
                        <span key={c} style={{ fontSize: 10, padding: "1px 6px", background: "#2a1a2a", border: "1px solid #7b68ee55", borderRadius: 10, color: "#bb99ff" }}>{c}</span>
                      ))}
                    </div>
                  )}
                  {(m.actionNames.length > 0 || m.hasBonusActions || m.reactionNames.length > 0) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {m.actionNames.length > 0 && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#1a1a2e", border: "1px solid #2a2a4e", color: "#aaa" }}>Action</span>
                      )}
                      {m.hasBonusActions && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#1a1a2e", border: "1px solid #2a3a1e", color: "#c8b96a" }}>Bonus</span>
                      )}
                      {m.reactionNames.length > 0 && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#1a2a1a", border: "1px solid #2a4e2a", color: "#9be9a8" }}>Reaction</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Table binding ──────────────────────────────────────────────────────────
  const [tableBinding, setTableBinding] = useState<FdmcTableBinding | null>(null);
  const viewerRole = useViewerRole(tableBinding);
  const isDmMode = viewerRole === "dm";
  const isPlayerMode = viewerRole === "player";
  const isRoleLoading = viewerRole === "loading";

  // On mount: check OBR's native GM role. If OBR says GM, auto-claim the
  // table binding — this handles new rooms (no binding) and old rooms with
  // a stale binding from a previous session/build.
  useEffect(() => {
    if (!OBR.isAvailable) return;

    void (async () => {
      try {
        const [obrRole, gmId, existing] = await Promise.all([
          (OBR.player as unknown as { getRole?: () => Promise<string> }).getRole?.() ?? Promise.resolve("PLAYER"),
          OBR.player.getId(),
          readFdmcRoomStateKey(FDMC_TABLE_BINDING_KEY, normalizeTableBinding),
        ]);

        if (obrRole === "GM") {
          if (!existing || existing.gmControllerId !== gmId) {
            // OBR says GM but binding is missing or stale — auto-claim
            const binding = createTableBinding(gmId);
            await publishFdmcRoomStateKey(FDMC_TABLE_BINDING_KEY, binding);
            setTableBinding(binding);
          } else {
            setTableBinding(existing);
          }
        } else {
          // Player — just read existing binding for seat matching
          if (existing) setTableBinding(existing);
        }
      } catch {
        // Fallback: try to read binding without role check
        const existing = await readFdmcRoomStateKey(FDMC_TABLE_BINDING_KEY, normalizeTableBinding).catch(() => null);
        if (existing) setTableBinding(existing);
      }
    })();
  }, []);

  async function claimTableBinding() {
    if (!OBR.isAvailable) return;
    const gmId = await OBR.player.getId().catch(() => null);
    const binding = createTableBinding(gmId);
    await publishFdmcRoomStateKey(FDMC_TABLE_BINDING_KEY, binding);
    setTableBinding(binding);
  }

  // ── DM: listen for encounter load requests from monster panel popover ──────
  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(ENCOUNTER_LOAD_CHANNEL, () => {
      try {
        const raw = window.localStorage.getItem(ENCOUNTER_LOAD_QUEUE_KEY);
        const instances: MainEncounterMonsterInstance[] = raw ? JSON.parse(raw) as MainEncounterMonsterInstance[] : [];
        window.localStorage.removeItem(ENCOUNTER_LOAD_QUEUE_KEY);
        addMonsterInstances(instances);
      } catch { /* ok */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDmMode]);

  // ── DM: listen for level-up requests ────────────────────────────────────
  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data as unknown;
      if (isLevelUpRequest(msg)) {
        setLevelUpRequests(current => {
          const filtered = current.filter(r => r.actorId !== msg.actorId);
          const next = [...filtered, msg];
          try { localStorage.setItem(FDMC_STORAGE_KEYS.pendingLevelUpRequests, JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
      }
    });
  }, [isDmMode]);

  // ── DM: listen for player turn-end requests ───────────────────────────────
  // Uses roomLiveStateRef so the listener always reads current combat state.
  // handleNextTurnRef is set below after handleNextTurn is defined.
  const handleNextTurnRef = useRef<() => void>(() => undefined);
  // Updated every render so the DM listener always calls the current closure
  // (assigning to a ref during render is safe — refs don't trigger re-renders)

  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data as unknown;
      if (msg && typeof msg === "object" && (msg as { type?: string }).type === "fdmc:request-next-turn") {
        const req = msg as { type: string; actorId: string };
        if (req.actorId && req.actorId === roomLiveStateRef.current.combat.activeActorId) {
          handleNextTurnRef.current();
        }
      }
    });
  }, [isDmMode]);

  // ── DM: handle actor editor save ──────────────────────────────────────────
  function handleActorEditorSave(editedActor: Actor, saveMode: ActorEditorSaveMode) {
    const isDeleted = editedActor.id.endsWith("--DELETED");

    if (isDeleted) {
      const realId = editedActor.id.replace("--DELETED", "");
      setActorLibrary(lib => {
        const next = { ...lib };
        delete next[realId];
        saveActorLibrary(next);
        return next;
      });
      setEditingActorId(null);
      closePanel();
      return;
    }

    // New actor (created from blank form) or duplicate — write directly to library
    const isNew = editingActorId === "__new__" || saveMode === "duplicate";
    if (isNew) {
      upsertActorInLibrary(editedActor);
      const freshLib = { ...actorLibrary, [editedActor.id]: editedActor };
      setActorLibrary(() => freshLib);
      pushActorsToAllSeats({ freshLibrary: freshLib });
      setEditingActorId(null);
      return;
    }

    // Save override (preserves base actor, only stores delta)
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
    const freshOverrides = loadActorOverrides();
    setActorOverrides(freshOverrides);

    let freshLib = actorLibrary;
    if (saveMode === "current-and-library") {
      upsertActorInLibrary(editedActor);
      freshLib = { ...actorLibrary, [editedActor.id]: editedActor };
      setActorLibrary(() => freshLib);
    }

    // Sync edited HP to live state so resolveActor's live-HP-wins rule doesn't
    // silently discard the DM's HP change (live HP overlays stats.hp in resolveActor).
    const liveHp = getActorHp(editedActor.id);
    const editedHp = editedActor.stats.hp;
    if (editedHp.max !== liveHp.max || editedHp.current !== liveHp.current) {
      void setActorHp(editedActor.id, editedHp);
    }

    // Push with fresh data so broadcast doesn't use stale refs
    pushActorsToAllSeats({ freshLibrary: freshLib, freshOverrides });
    setEditingActorId(null);
    closePanel();
  }

  // ── DM: approve level-up request ─────────────────────────────────────────
  // finalActor is the full proposed actor, possibly edited by DM in the review step.
  function handleLevelUpApprove(request: LevelUpRequest, finalActor: Actor) {
    const base = actorLibrary[request.actorId] ?? finalActor;
    const override: Partial<Actor> = {};
    if (finalActor.level !== base.level) override.level = finalActor.level;
    if (finalActor.name !== base.name) override.name = finalActor.name;
    if (finalActor.subtitle !== base.subtitle) override.subtitle = finalActor.subtitle;
    if (JSON.stringify(finalActor.stats) !== JSON.stringify(base.stats)) override.stats = finalActor.stats;
    if (JSON.stringify(finalActor.tabs) !== JSON.stringify(base.tabs)) override.tabs = finalActor.tabs;
    if (JSON.stringify(finalActor.abilityScores) !== JSON.stringify(base.abilityScores)) override.abilityScores = finalActor.abilityScores;
    if (JSON.stringify(finalActor.classFeatureTracker) !== JSON.stringify(base.classFeatureTracker)) override.classFeatureTracker = finalActor.classFeatureTracker;
    saveActorOverride(request.actorId, override);
    const freshOverrides = loadActorOverrides();
    setActorOverrides(freshOverrides);

    // Sync HP if level-up changed max HP (live HP would otherwise override the new max)
    const liveHp = getActorHp(request.actorId);
    const editedHp = finalActor.stats.hp;
    if (editedHp.max !== liveHp.max || editedHp.current !== liveHp.current) {
      void setActorHp(request.actorId, editedHp);
    }

    pushActorsToAllSeats({ freshOverrides });
    setLevelUpRequests(current => {
      const next = current.filter(r => r.actorId !== request.actorId);
      try { localStorage.setItem(FDMC_STORAGE_KEYS.pendingLevelUpRequests, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

    if (OBR.isAvailable) {
      void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:level-up-response",
        actorId: request.actorId,
        seatId: request.seatId,
        approved: true,
      }, { destination: "REMOTE" });
    }
  }

  function handleLevelUpReject(request: LevelUpRequest, reason: string) {
    setLevelUpRequests(current => {
      const next = current.filter(r => r.actorId !== request.actorId);
      try { localStorage.setItem(FDMC_STORAGE_KEYS.pendingLevelUpRequests, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (OBR.isAvailable) {
      // Send dedicated rejection notice so player gets a toast + can resubmit
      void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:level-up-rejected",
        actorId: request.actorId,
        seatId: request.seatId,
        reason,
      }, { destination: "REMOTE" });
    }
  }

  // ── DM Actor library — load from localStorage immediately so hooks have real actors on first render ──
  // brokenChainActors is intentionally empty (private actors not bundled).
  // loadActorLibrary() returns actors imported via Edit Actors → Import.
  // seedLibraryFromBundled is only used as the fallback when localStorage has nothing.
  const [actorLibrary, setActorLibrary] = useState<Record<string, Actor>>(() => {
    const stored = loadActorLibrary();
    return Object.keys(stored).length > 0 ? stored : seedLibraryFromBundled(brokenChainActors);
  });
  const [actorOverrides, setActorOverrides] = useState(() => loadActorOverrides());

  // ── Reload library when DM popover saves changes ─────────────────────────
  // Also reload on mount in case actors were built in popover before this window opened
  useEffect(() => {
    const stored = loadActorLibrary();
    if (Object.keys(stored).length > 0) {
      setActorLibrary(stored);
      setActorOverrides(loadActorOverrides());
    }

    if (!OBR.isAvailable) return;
    return OBR.broadcast.onMessage(DM_LIBRARY_UPDATED_CHANNEL, () => {
      setActorLibrary(loadActorLibrary());
      setActorOverrides(loadActorOverrides());
    });
  }, []);

  // ── Actor editor state ────────────────────────────────────────────────────
  const [editingActorId, setEditingActorId] = useState<string | null>(null);

  // ── Level-up approval queue (DM side) ────────────────────────────────────
  const [levelUpRequests, setLevelUpRequests] = useState<LevelUpRequest[]>([]);

  // bundledActors is derived from the DM's actor library (not the empty brokenChainActors export).
  // All runtime hooks that need actor IDs/HP defaults receive the real seeded actors this way.
  const bundledActors = useMemo(() => Object.values(actorLibrary), [actorLibrary]);

  // ── Live state — HP, initiative, trackers — room metadata ──────────────────
  const {
    roomLiveState,
    setActorHp,
    getActorHp,
    setActorInitiative,
    getActorInitiative,
    getRoomStateBytes,
    commitRoomState,
    refreshFromRoom,
  } = useActorLiveState(bundledActors);

  // ── DM seat system ────────────────────────────────────────────────────────
  const {
    seats,
    seatBindings,
    assignSeat,
    kickFromSeat,
    removeSeat,
    purgeAllSeatMetadata,
    pushActorsToSeat,
    pushActorsToAllSeats,
  } = useDmSeatSystem({
    actorLibrary,
    actorOverrides,
    roomLiveState,
    onRoomStateChange: commitRoomState,
  });

  // ── Player seat system ────────────────────────────────────────────────────
  const {
    viewerSeatKey,
    claimedSeatId,
    seatActors,
    seatStatus,
    isBrowsing,
    requestActorData,
    manualClaim,
    claimViewerSeat,
    releaseSeat,
  } = usePlayerSeatSystem(roomLiveState);

  // ── Active actors — DM sees all; player sees only their seat actors ────────
  const dmActors: Actor[] = useMemo(
    () => Object.values(actorLibrary).flatMap(actor => {
      const resolved = resolveActor(actor.id, actorLibrary, actorOverrides, roomLiveState);
      return resolved ? [resolved] : [];
    }),
    [actorLibrary, actorOverrides, roomLiveState],
  );

  // Player actors come from seat broadcast cache, HP overlaid from live state
  const playerActors: Actor[] = useMemo(
    () => seatActors.flatMap(a => {
      const resolved = resolveActor(a.id, { [a.id]: a }, actorOverrides, roomLiveState);
      return resolved ? [resolved] : [];
    }),
    [seatActors, actorOverrides, roomLiveState],
  );

  const actors = isDmMode ? dmActors : playerActors;

  // ── Selected actor ────────────────────────────────────────────────────────
  const [selectedActorId, setSelectedActorId] = useState<string>(() => bundledActors[0]?.id ?? "");
  const selectedActor = actors.find(a => a.id === selectedActorId) ?? actors[0] ?? null;

  // ── Action economy ────────────────────────────────────────────────────────
  const {
    actionStateByActorId,
    getActionState,
    readyActionCosts,
    unreadyActionKey,
    resetActorTurn,
    resetAllTurns,
  } = useActionEconomyState(isDmMode ? bundledActors : seatActors);

  // ── Committed roll ────────────────────────────────────────────────────────
  const {
    getCommittedRoll,
    startCommittedRoll,
    setCommittedRollResult,
    chooseCommittedRollOutcome,
    chooseCommittedRollDamage,
    markCommittedRollBridgeSent,
    clearCommittedRoll,
  } = useCommittedRollState(isDmMode ? bundledActors : seatActors);

  // ── Concentration ─────────────────────────────────────────────────────────
  const {
    getActorConcentration,
    setActorConcentration,
    clearActorConcentration,
  } = useActorConcentrationState(isDmMode ? bundledActors : seatActors);

  // ── Notes ─────────────────────────────────────────────────────────────────
  const { getActorNotes, addActorNote, deleteActorNote } =
    useActorNotesState(isDmMode ? bundledActors : seatActors);

  // ── Status ────────────────────────────────────────────────────────────────
  const {
    getActorStatus,
    setActorTracker,
    resetActorTracker,
    resetActorStatuses,
  } = useActorStatusState(isDmMode ? bundledActors : seatActors);

  // ── Resource counters (spell slots, class features) ───────────────────────
  const {
    getRemaining,
    decrementResource,
    counters,
    consumeSpellSlot,
    consumeNamedResource,
    resetActorResources,
  } = useResourceCounterState(isDmMode ? dmActors : playerActors);

  // ── Combat log ────────────────────────────────────────────────────────────
  const { entries: logEntries, addEntry, removePendingEntries, clearEntries } = useCombatLog();

  // ── Dice bridge ───────────────────────────────────────────────────────────
  const {
    status: diceBridgeStatus,
    lastEvent: diceBridgeLastEvent,
    sendRollRequest,
    sendDicePlusRollRequest,
    sendMockRollResult,
  } = useOwlbearDiceBridge();

  // ── Monster combat roster — hydrate when DM mode confirmed (async tableBinding) ──
  const [monsterCandidates, setMonsterCandidates] = useState<MonsterCombatCandidate[]>([]);
  useEffect(() => {
    if (!isDmMode) return;
    const saved = loadMonsterRoster();
    if (saved.length > 0) setMonsterCandidates(saved);
  }, [isDmMode]);
  const [activeMonsterInstanceId, setActiveMonsterInstanceId] = useState<string>("");
  // Ref so addMonsterInstances always reads latest state without stale closures
  const roomLiveStateRef = useRef(roomLiveState);
  useEffect(() => { roomLiveStateRef.current = roomLiveState; }, [roomLiveState]);

  const activeMonster = useMemo(
    () => monsterCandidates.find(
      m => (m as MainEncounterMonsterInstance).instanceId === activeMonsterInstanceId
    ) as MainEncounterMonsterInstance | undefined ?? monsterCandidates[0] as MainEncounterMonsterInstance | undefined,
    [monsterCandidates, activeMonsterInstanceId],
  );

  // ── Token right-click menu — REGISTERED IN THE BACKGROUND PAGE ───────────
  // The token context menu (GM Lock / Assign to seat / Clear) is registered by
  // `src/background.ts`, NOT here. This app is the action POPOVER — it only runs while
  // open, so a menu registered here would vanish the moment the DM closes the popover.
  // The background page (manifest "background") keeps it alive for the whole session.
  // See background.ts.

  function broadcastMonsterRoster(roster: MainEncounterMonsterInstance[]) {
    if (!OBR.isAvailable) return;
    const payload: PlayerSafeMonster[] = roster.map(m => {
      const ratio = m.maxHp > 0 ? m.currentHp / m.maxHp : 0;
      const conditionLabel = m.currentHp <= 0 ? "Down"
        : ratio <= 0.25 ? "Critical"
        : ratio <= 0.5 ? "Bloodied"
        : ratio <= 0.75 ? "Wounded"
        : "Healthy";
      const vis = m.visibilityState;
      const showName = vis !== "hidden";
      const showHpBar = vis === "hp-bar" || vis === "full";
      return {
        instanceId: m.instanceId,
        publicName: showName
          ? (m.isNameRevealed ? (m.revealedName || m.displayName) : (m.hiddenName || "Unknown creature"))
          : "Unknown creature",
        visibilityState: vis,
        showHpBar,
        hpRatio: showHpBar ? ratio : 0,
        isDown: vis !== "hidden" && m.currentHp <= 0,
        conditionLabel: vis !== "hidden" ? conditionLabel : "",
        activeConditions: vis !== "hidden" ? (m.usedActionNames ?? []) : [],
        ac: vis === "full" ? (m.ac ?? "") : "",
        actionNames: vis !== "hidden" ? (m.actions ?? []).map(a => a.name).filter(Boolean) : [],
        reactionNames: vis !== "hidden" ? (m.reactions ?? []).map(a => a.name).filter(Boolean) : [],
        hasBonusActions: vis !== "hidden" && (m.actions ?? []).some(a => (a as MonsterReaderAction & { economyCost?: string }).economyCost === "bonus"),
      };
    });
    void obrSend(
      MONSTER_ROSTER_CHANNEL,
      { type: "fdmc:monster-roster", monsters: payload },
      { destination: "REMOTE" }
    ).catch(() => undefined);
  }

  // ── DM: token selection → auto-open bound card ───────────────────────────
  // When DM selects a token on the map, check its binding and open the right card.
  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.player.onChange(async (player) => {
      const selected = player.selection ?? [];
      if (selected.length !== 1) return; // only act on single-token selection
      try {
        const items = await OBR.scene.items.getItems(selected);
        if (items.length === 0) return;
        const binding = readTokenBinding(items[0]);
        if (!binding || binding.tableId !== roomLiveState.tableId) return;
        if (binding.bindingType === "seat" && binding.actorId) {
          // Open actor card for bound actor
          const actorId = binding.actorId;
          setSelectedActorId(actorId);
          setActiveMonsterInstanceId("");
        } else if (binding.bindingType === "monster" && binding.instanceId) {
          // Open monster card for bound instance
          setActiveMonsterInstanceId(binding.instanceId);
        }
      } catch { /* selection read failed — ignore */ }
    });
  }, [isDmMode, roomLiveState.tableId]);

  // ── DM: receive loot choice → attach item to actor → re-broadcast ───────
  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, async (event) => {
      const msg = event.data as { type?: string; offerId?: string; chosenItemId?: string; actorId?: string; seatId?: string } | undefined;
      if (msg?.type !== "fdmc:loot-choice" || !msg.chosenItemId || !msg.actorId) return;

      // Find the actor and add the item to their equipment tab
      const actor = dmActors.find(a => a.id === msg.actorId);
      if (!actor) return;

      // Find the item from all libraries
      const allItems = [...loadEquipmentLibrary("campaign"), ...loadEquipmentLibrary("dm")];
      const item = allItems.find(i => i.id === msg.chosenItemId);
      if (!item) return;

      // Build the equipment action and add it
      const equipAction = itemToAction(item);

      const updatedActor = {
        ...actor,
        tabs: { ...actor.tabs, equipment: [...(actor.tabs.equipment ?? []), equipAction] },
      };

      // Save and broadcast — pass freshLibrary so push doesn't use stale ref
      const freshLib = { ...dmActors.reduce((m, a) => ({ ...m, [a.id]: a }), {} as Record<string, typeof actor>), [updatedActor.id]: updatedActor };
      upsertActorInLibrary(updatedActor);
      setActorLibrary(lib => ({ ...lib, [updatedActor.id]: updatedActor }));
      pushActorsToSeat(msg.seatId ?? "", { freshLibrary: freshLib });

      // Notify player their item was attached
      void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:loot-attached",
        seatId: msg.seatId,
        itemName: item.name,
      }, { destination: "REMOTE" });

      addEntry({ actorName: actor.name, actionName: "Item Equipped", tabId: "system", message: `${actor.name} received ${item.name}.` });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDmMode, dmActors]);

  // ── DM: respond to player roster request on join ─────────────────────────
  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(MONSTER_ROSTER_CHANNEL, (event) => {
      const msg = event.data as { type?: string } | undefined;
      if (msg?.type === "fdmc:monster-roster-request" && monsterCandidates.length > 0) {
        broadcastMonsterRoster(monsterCandidates as MainEncounterMonsterInstance[]);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDmMode, monsterCandidates]);

  // ── DM: sync HP from monster popout → monsterCandidates → broadcast to players ──
  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(MONSTER_POPOUT_HP_CHANNEL, (event) => {
      const msg = event.data as { type?: string; instanceId?: string; currentHp?: number; maxHp?: number; tempHp?: number } | undefined;
      if (msg?.type !== "fdmc:monster-popout-hp" || !msg.instanceId) return;
      setMonsterCandidates(prev => {
        const next = prev.map(m => {
          const inst = m as MainEncounterMonsterInstance;
          if (inst.instanceId !== msg.instanceId) return m;
          return { ...inst, currentHp: msg.currentHp ?? inst.currentHp, maxHp: msg.maxHp ?? inst.maxHp, tempHp: msg.tempHp ?? inst.tempHp };
        }) as MainEncounterMonsterInstance[];
        broadcastMonsterRoster(next);
        return next;
      });
    });
  }, [isDmMode]);

  function addMonsterInstances(monsters: MainEncounterMonsterInstance[]) {
    if (monsters.length === 0) return;
    setMonsterCandidates(c => {
      const next = [...c, ...monsters];
      saveMonsterRoster(next as MainEncounterMonsterInstance[]);
      broadcastMonsterRoster(next as MainEncounterMonsterInstance[]);
      return next;
    });
    setActiveMonsterInstanceId(prev => prev || monsters[0].instanceId);
    addEntry({
      actorName: "System", actionName: "Encounter Loaded", tabId: "system",
      message: `${monsters.length} monster${monsters.length === 1 ? "" : "s"} added to combat roster.`,
    });
  }

  function addMonsterInstance(monster: MainEncounterMonsterInstance) {
    addMonsterInstances([monster]);
  }

  function updateMonsterInstance(
    instanceId: string,
    patch: Partial<Pick<MainEncounterMonsterInstance, "currentHp" | "tempHp" | "status" | "visibilityState" | "hiddenName" | "isNameRevealed">>
  ) {
    setMonsterCandidates(current => {
      const next = current.map(m => {
        const enc = m as MainEncounterMonsterInstance;
        if (enc.instanceId !== instanceId) return m;
        const currentHp = typeof patch.currentHp === "number" ? patch.currentHp : enc.currentHp;
        return { ...enc, ...patch, currentHp, hp: `${currentHp}/${enc.maxHp}` } as MainEncounterMonsterInstance;
      });
      saveMonsterRoster(next as MainEncounterMonsterInstance[]);
      broadcastMonsterRoster(next as MainEncounterMonsterInstance[]);
      return next;
    });
    // P4 spec: HP changes write to room metadata via patchMonsterHp so DM reload restores live HP
    if (typeof patch.currentHp === "number") {
      const inst = monsterCandidates.find(m => (m as MainEncounterMonsterInstance).instanceId === instanceId) as MainEncounterMonsterInstance | undefined;
      if (inst) {
        const nextState = patchMonsterHp(roomLiveState, instanceId, { current: patch.currentHp, max: inst.maxHp, temp: patch.tempHp ?? inst.tempHp ?? 0 });
        void commitRoomState(nextState);
        // P7/P8: log HP change
        const delta = patch.currentHp - inst.currentHp;
        const monsterName = inst.revealedName || inst.displayName || inst.name;
        logHpChange(instanceId, monsterName, delta, roomLiveState.combat.round);
        // P8: boss kill detection
        if (patch.currentHp <= 0 && inst.currentHp > 0 && (inst.kind === "boss")) {
          const encId = inst.templateRef ?? instanceId;
          const encName = inst.revealedName || inst.name;
          appendLogEntry({
            id: makeLogId(), timestamp: new Date().toLocaleTimeString(),
            round: roomLiveState.combat.round, type: "boss-killed",
            code: "KILL", actorId: instanceId, actorName: monsterName,
            val: 0, message: `${monsterName} defeated`,
          });
          setBossKillAlert({ name: monsterName, encounterId: encId, encounterName: encName });
        }
      }
    }
  }

  function removeMonsterInstance(instanceId: string) {
    setMonsterCandidates(c => {
      const next = c.filter(m => (m as MainEncounterMonsterInstance).instanceId !== instanceId);
      saveMonsterRoster(next as MainEncounterMonsterInstance[]);
      broadcastMonsterRoster(next as MainEncounterMonsterInstance[]);
      return next;
    });
    if (activeMonsterInstanceId === instanceId) setActiveMonsterInstanceId("");
    const nextState = deregisterMonsterInstance(roomLiveState, instanceId);
    void commitRoomState(nextState);
  }

  // ── Monster economy state — received via OBR broadcast from MonsterActorCard ──
  const [monsterEconomyByInstanceId, setMonsterEconomyByInstanceId] = useState<
    Record<string, { actionUsed: boolean; reactionUsed: boolean }>
  >({});

  useEffect(() => {
    if (!OBR.isAvailable) return;
    return OBR.broadcast.onMessage(MONSTER_ECONOMY_CHANNEL, (event) => {
      const msg = event.data as MonsterEconomyBroadcast | undefined;
      if (msg?.type !== "fdmc:monster-economy") return;
      setMonsterEconomyByInstanceId(prev => ({
        ...prev,
        [msg.instanceId]: { actionUsed: msg.actionUsed, reactionUsed: msg.reactionUsed },
      }));
    });
  }, []);

  // ── Viewer: party summary — received from DM when viewer joins ───────────
  const [viewerParty, setViewerParty] = useState<ViewerActorSummary[]>([]);

  // Player/viewer: listen for party summary broadcasts
  useEffect(() => {
    if (isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(VIEWER_PARTY_CHANNEL, (event) => {
      const msg = event.data as { type?: string; actors?: ViewerActorSummary[] } | undefined;
      if (msg?.type === "fdmc:viewer-party" && Array.isArray(msg.actors)) {
        setViewerParty(msg.actors);
      }
    });
  }, [isDmMode]);

  // Viewer: request party data on entering viewer mode
  useEffect(() => {
    if (!isPlayerMode || seatStatus !== "viewer" || !OBR.isAvailable) return;
    void obrSend(
      VIEWER_PARTY_CHANNEL,
      { type: "fdmc:viewer-party-request" },
      { destination: "REMOTE" },
    ).catch(() => undefined);
  }, [isPlayerMode, seatStatus]);

  // DM: respond to viewer party requests
  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(VIEWER_PARTY_CHANNEL, (event) => {
      const msg = event.data as { type?: string } | undefined;
      if (msg?.type !== "fdmc:viewer-party-request") return;
      // Send compact actor summary to viewers
      const summary: ViewerActorSummary[] = dmActors.map(a => {
        const hp = getActorHp(a.id);
        return { id: a.id, name: a.name, hpCurrent: hp.current, hpMax: hp.max, status: "" };
      });
      void obrSend(
        VIEWER_PARTY_CHANNEL,
        { type: "fdmc:viewer-party", actors: summary },
        { destination: "REMOTE" },
      ).catch(() => undefined);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDmMode, dmActors]);

  // ── Shared party tracker — every PC sees the whole party (names + HP) so healers
  // know who to help. The DM broadcasts a player-safe roster of party combatants
  // (actors only — NEVER monster HP). Players merge it into their combat tracker.
  const [partyRoster, setPartyRoster] = useState<Combatant[]>([]);

  // Player: receive the roster + request it on mount (covers late joiners).
  useEffect(() => {
    if (isDmMode || !OBR.isAvailable) return;
    const unsub = OBR.broadcast.onMessage(PARTY_TRACKER_CHANNEL, (event) => {
      const msg = event.data as { type?: string; party?: Combatant[] } | undefined;
      if (msg?.type === "fdmc:party-tracker" && Array.isArray(msg.party)) {
        setPartyRoster(msg.party);
      }
    });
    void obrSend(PARTY_TRACKER_CHANNEL, { type: "fdmc:party-tracker-request" }, { destination: "REMOTE" }).catch(() => undefined);
    return unsub;
  }, [isDmMode]);

  // ── Player: monster roster cache — received from DM broadcast ─────────────
  const [playerMonsters, setPlayerMonsters] = useState<PlayerSafeMonster[]>([]);
  const [playerPeekId, setPlayerPeekId] = useState<string | null>(null);

  useEffect(() => {
    if (isDmMode || !OBR.isAvailable) return;
    // Listen for roster broadcasts from DM
    const unsub = OBR.broadcast.onMessage(MONSTER_ROSTER_CHANNEL, (event) => {
      const msg = event.data as { type?: string; monsters?: PlayerSafeMonster[] } | undefined;
      if (msg?.type === "fdmc:monster-roster" && Array.isArray(msg.monsters)) {
        setPlayerMonsters(msg.monsters);
      }
    });
    // Request current roster on join — DM re-sends if they have monsters loaded
    void obrSend(
      MONSTER_ROSTER_CHANNEL,
      { type: "fdmc:monster-roster-request" },
      { destination: "REMOTE" },
    ).catch(() => undefined);
    return unsub;
  }, [isDmMode]);

  // ── Player: loot delivery toast + offer + level-up request UI ───────────
  const [lootToast, setLootToast] = useState<string | null>(null);
  const [lootOffer, setLootOffer] = useState<import("./core/ui/EquipmentLibraryStandalone").LootOffer | null>(null);
  const [showConvergePanel, setShowConvergePanel] = useState(false);
  const [convergenceSubmitting, setConvergenceSubmitting] = useState(false);
  const [showLevelUpRequest, setShowLevelUpRequest] = useState(false);
  const [levelUpRejectionToast, setLevelUpRejectionToast] = useState<string | null>(null);

  // ── Player: refresh + loot delivery via seat broadcast ───────────────────
  useEffect(() => {
    if (isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data as { type?: unknown; seatId?: string; message?: string; item?: { name?: string } } | undefined;
      if (!msg) return;
      if (msg.type === "fdmc:seats-ready") {
        void refreshFromRoom();
      }
      // Single loot delivery — auto-attach + toast
      if (msg.type === "fdmc:loot-delivery" && msg.seatId === claimedSeatId) {
        const itemName = msg.item?.name ?? "item";
        const text = msg.message?.trim() || `${itemName} delivered.`;
        setLootToast(text);
        addEntry({ actorName: "DM", actionName: "Loot Delivered", tabId: "system", message: text });
        setTimeout(() => setLootToast(null), 6000);
      }
      // Loot offer — player must choose one item
      if (msg.type === "fdmc:loot-offer" && msg.seatId === claimedSeatId) {
        setLootOffer(msg as import("./core/ui/EquipmentLibraryStandalone").LootOffer);
        addEntry({ actorName: "DM", actionName: "Loot Offer", tabId: "system", message: msg.message ?? "Boss drop — choose an item." });
      }
      // Convergence denied by DM
      if (msg.type === "fdmc:convergence-denied" && (msg as { seatId?: string }).seatId === claimedSeatId) {
        setConvergenceSubmitting(false);
        setShowConvergePanel(false);
        const reason = (msg as { reason?: string }).reason ?? "DM declined the convergence.";
        setLootToast(`◈ ${reason}`);
        addEntry({ actorName: "DM", actionName: "Convergence Denied", tabId: "system", message: reason });
        setTimeout(() => setLootToast(null), 6000);
      }
      // DM confirms choice was received and item attached
      if (msg.type === "fdmc:loot-attached" && msg.seatId === claimedSeatId) {
        setLootOffer(null);
        setLootToast(`✓ ${(msg as { itemName?: string }).itemName ?? "Item"} added to your equipment.`);
        setTimeout(() => setLootToast(null), 6000);
      }
      // Level-up rejection from DM
      if ((msg as { type?: unknown; actorId?: string; seatId?: string; reason?: string }).type === "fdmc:level-up-rejected"
        && (msg as { seatId?: string }).seatId === claimedSeatId) {
        const reason = (msg as { reason?: string }).reason;
        const text = reason ? `DM rejected level-up: ${reason}. You can revise and resubmit.` : "DM rejected your level-up request. You can revise and resubmit.";
        setLevelUpRejectionToast(text);
        addEntry({ actorName: "DM", actionName: "Level-Up Rejected", tabId: "system", message: text });
        setTimeout(() => setLevelUpRejectionToast(null), 8000);
      }
    });
  }, [isDmMode, refreshFromRoom, claimedSeatId]);

  // ── Turn reset ────────────────────────────────────────────────────────────
  const [turnResetVersion, setTurnResetVersion] = useState(0);
  const [focusedActorId, setFocusedActorId] = useState<string | null>(null);
  // P8: boss kill alert
  const [bossKillAlert, setBossKillAlert] = useState<{ name: string; encounterId: string; encounterName: string } | null>(null);

  // P7/P8: log HP change to encounter log + ring buffer
  function logHpChange(actorId: string, actorName: string, delta: number, round: number) {
    if (!isDmMode || delta === 0) return;
    appendLogEntry({
      id: makeLogId(), timestamp: new Date().toLocaleTimeString(), round,
      type: "hp-change", code: makeActionCode(actorName, "HP"),
      actorId, actorName, val: delta, message: delta < 0 ? `${actorName} took ${Math.abs(delta)} damage` : `${actorName} healed ${delta} HP`,
    });
    if (OBR.isAvailable) {
      const next = pushRecentEvent(roomLiveState, {
        actorId, type: "hp-change", code: makeActionCode(actorName, "HP"), val: delta, round,
      });
      void commitRoomState(next);
    }
  }

  // P7/P8: log roll result to encounter log + ring buffer
  function logRollResult(actorId: string, actorName: string, actionName: string, val: number, type: "roll-attack" | "roll-damage", round: number) {
    if (!isDmMode) return;
    const code = makeActionCode(actorName, actionName);
    appendLogEntry({
      id: makeLogId(), timestamp: new Date().toLocaleTimeString(), round,
      type, code, actorId, actorName, val, message: `${actorName} — ${actionName}: ${val}`,
    });
    if (OBR.isAvailable) {
      const next = pushRecentEvent(roomLiveState, { actorId, type, code, val, round });
      void commitRoomState(next);
    }
  }
  // Track which actor's OBR popover is currently open for toggle behavior
  const [openActorPopoverId, setOpenActorPopoverId] = useState<string | null>(null);

  // ── Combat tracker helpers ────────────────────────────────────────────────

  /** actorId → seat color, from the compact seat snapshots in room state (P-UX1). */
  const seatColorById = useMemo(
    () => buildActorSeatColorMap(roomLiveState.seats),
    [roomLiveState.seats],
  );

  /** Live HP map for all actors — used by combat tracker and actor selector */
  const liveHpByActorId = useMemo(
    () => Object.fromEntries(actors.map(a => [a.id, getActorHp(a.id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actors, roomLiveState.actorLiveState],
  );

  /** All combatants (actors + monsters) with their current initiative */
  const allCombatants = useMemo(() => {
    const initiativeByActor: Record<string, number | null> = {};
    for (const actor of actors) {
      initiativeByActor[actor.id] = getActorInitiative(actor.id);
    }
    const initiativeByMonster: Record<string, number | null> = {};
    for (const m of monsterCandidates as MainEncounterMonsterInstance[]) {
      initiativeByMonster[m.instanceId] = roomLiveState.monsterLiveState[m.instanceId]?.initiative ?? null;
    }

    // DM: full roster — real HP for both party and monsters.
    if (isDmMode) {
      return buildCombatants(
        actors,
        monsterCandidates as MainEncounterMonsterInstance[],
        roomLiveState.combat.activeActorId,
        initiativeByActor,
        initiativeByMonster,
        true,
        liveHpByActorId,
      );
    }

    // Player / viewer: party (actor) rows come from the DM's shared roster so EVERY
    // ally's HP is visible (healers need this). Fall back to just the player's own seat
    // actors until the roster arrives. Active flag is recomputed from live combat state.
    const partyCombatants: Combatant[] = partyRoster.length > 0
      ? partyRoster.map(c => ({ ...c, isActive: c.id === roomLiveState.combat.activeActorId }))
      : buildCombatants(actors, [], roomLiveState.combat.activeActorId, initiativeByActor, {}, false, liveHpByActorId);

    // Monsters come from the player-safe broadcast — ratio HP only, never true numbers.
    const playerMonsterCombatants: Combatant[] = playerMonsters.map(m => ({
      id: m.instanceId,
      name: m.publicName,
      kind: "monster" as const,
      initiative: roomLiveState.monsterLiveState[m.instanceId]?.initiative ?? null,
      initiativeBonus: 0,
      hp: { current: Math.round(m.hpRatio * 100), max: 100 },
      isActive: m.instanceId === roomLiveState.combat.activeActorId,
      isDead: m.isDown,
    }));

    return [...partyCombatants, ...playerMonsterCombatants];
  }, [actors, monsterCandidates, playerMonsters, partyRoster, roomLiveState, isDmMode, getActorInitiative, liveHpByActorId]);

  // ── DM: broadcast the player-safe party roster (actor combatants only — never monster
  // HP) so every PC's tracker shows ally HP. Re-broadcasts when the party's HP / init /
  // active / death state changes; also replies to a late joiner's request.
  const partyRosterSig = useMemo(
    () => (isDmMode ? JSON.stringify(allCombatants.filter(c => c.kind === "actor")) : ""),
    [isDmMode, allCombatants],
  );
  const partyRosterSigRef = useRef(partyRosterSig);
  partyRosterSigRef.current = partyRosterSig;

  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable || !partyRosterSig) return;
    void obrSend(PARTY_TRACKER_CHANNEL, { type: "fdmc:party-tracker", party: JSON.parse(partyRosterSig) }, { destination: "REMOTE" }).catch(() => undefined);
  }, [isDmMode, partyRosterSig]);

  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(PARTY_TRACKER_CHANNEL, (event) => {
      const msg = event.data as { type?: string } | undefined;
      if (msg?.type !== "fdmc:party-tracker-request") return;
      const sig = partyRosterSigRef.current;
      if (sig) void obrSend(PARTY_TRACKER_CHANNEL, { type: "fdmc:party-tracker", party: JSON.parse(sig) }, { destination: "REMOTE" }).catch(() => undefined);
    });
  }, [isDmMode]);

  function handleStartCombat() {
    const sorted = sortCombatants(allCombatants).filter(c => !c.isDead);
    if (sorted.length === 0) return;
    const firstId = sorted[0].id;
    // Read fresh from OBR to ensure seat bindings from dm-panel are captured
    void (async () => {
      const freshState = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
      const base = freshState ?? roomLiveState;
      const next = patchCombat(base, { phase: "combat", activeActorId: firstId, round: 1 });
      void commitRoomState(next);
    })();
    setSelectedActorId(actors.find(a => a.id === firstId)?.id ?? selectedActorId);
    setActiveMonsterInstanceId(monsterCandidates.find(m => (m as MainEncounterMonsterInstance).instanceId === firstId) ? firstId : "");
    clearEncounterLog(); // P8: fresh log per combat session
    addEntry({ actorName: "System", actionName: "Combat Start", tabId: "system", message: `Round 1 begins. ${sorted[0]?.name ?? "First combatant"} goes first.` });
  }

  function handleNextTurn() {
    // Players broadcast a request — DM executes the actual state change
    if (isPlayerMode && OBR.isAvailable) {
      void OBR.broadcast.sendMessage(
        FDMC_SEAT_BROADCAST_CHANNEL,
        { type: "fdmc:request-next-turn", actorId: roomLiveState.combat.activeActorId },
        { destination: "REMOTE" }
      );
      return;
    }

    const currentId = roomLiveState.combat.activeActorId;
    const sorted = sortCombatants(allCombatants).filter(c => !c.isDead);
    if (sorted.length === 0) return;

    // Log turn end
    const currentActor = actors.find(a => a.id === currentId);
    if (currentActor) {
      addEntry({ actorName: currentActor.name, actionName: "Turn End", tabId: "system", message: `${currentActor.name} ends their turn.` });
    } else if (currentId) {
      addEntry({ actorName: "Monster", actionName: "Turn End", tabId: "system", message: "Monster turn ends." });
    }

    // Advance to next combatant
    const currentIdx = sorted.findIndex(c => c.id === currentId);
    const nextIdx = (currentIdx + 1) % sorted.length;
    const nextCombatant = sorted[nextIdx];
    const isNewRound = nextIdx === 0;
    const newRound = isNewRound ? roomLiveState.combat.round + 1 : roomLiveState.combat.round;

    const next = patchCombat(roomLiveState, { activeActorId: nextCombatant.id, round: newRound });
    void commitRoomState(next);

    // Reset economy on TURN START — applies to both actors AND monsters
    if (nextCombatant.kind === "actor") {
      // Actor's turn starts — reset their economy now
      const nextActor = actors.find(a => a.id === nextCombatant.id);
      if (nextActor) resetActorTurn(nextActor.id);
      setTurnResetVersion(v => v + 1);
      setSelectedActorId(nextCombatant.id);
      setActiveMonsterInstanceId("");
    } else {
      // Monster's turn starts — reset its economy now
      const nextInstanceId = nextCombatant.id;
      if (OBR.isAvailable) {
        void obrSend(
          "fdmc:monster-turn-reset",
          { type: "fdmc:monster-turn-reset", instanceId: nextInstanceId },
          { destination: "LOCAL" }
        ).catch(() => undefined);
      }
      setMonsterEconomyByInstanceId(prev => {
        const updated = { ...prev };
        delete updated[nextInstanceId];
        return updated;
      });
      if (OBR.isAvailable) {
        void obrSend(
          MONSTER_ECONOMY_CHANNEL,
          { type: "fdmc:monster-economy", instanceId: nextInstanceId, actionUsed: false, reactionUsed: false } satisfies MonsterEconomyBroadcast,
          { destination: "REMOTE" },
        ).catch(() => undefined);
      }
      setTurnResetVersion(v => v + 1);
      setActiveMonsterInstanceId(nextCombatant.id);
    }

    if (isNewRound) {
      addEntry({ actorName: "System", actionName: `Round ${newRound}`, tabId: "system", message: `Round ${newRound} begins.` });
    }
    addEntry({ actorName: nextCombatant.name, actionName: "Turn Start", tabId: "system", message: `${nextCombatant.name}'s turn.` });
  }
  handleNextTurnRef.current = handleNextTurn; // always keep ref current — safe to assign during render

  function handleEndCombat() {
    const next = patchCombat(roomLiveState, { phase: "setup", activeActorId: null, round: 1 });
    void commitRoomState(next);
    addEntry({ actorName: "System", actionName: "Combat End", tabId: "system", message: "Combat ended. Seats and HP preserved." });
  }

  function handleSetCombatantInitiative(combatantId: string, initiative: number) {
    if (actors.find(a => a.id === combatantId)) {
      void setActorInitiative(combatantId, initiative);
      // Propagate initiative to companions — companions act on owner's turn
      const companions = actors.filter(
        a => a.kind === "companion" &&
        (a.moduleData as { ownerId?: string } | undefined)?.ownerId === combatantId
      );
      for (const companion of companions) {
        void setActorInitiative(companion.id, initiative);
      }
    } else {
      // Monster — write only initiative to room metadata; full monster data stays DM-local
      void commitRoomState(patchMonsterInitiative(roomLiveState, combatantId, initiative));
    }
  }

  // ── Tool panel ────────────────────────────────────────────────────────────
  const [openPanel, setOpenPanel] = useState<ToolPanelId>(null);
  const closePanel = useCallback(() => setOpenPanel(null), []);

  // ── Open DM tool as OBR popover window ───────────────────────────────────
  // All known DM popover IDs — used for close-all
  const DM_PANEL_IDS = ["fdm-dm-editActors", "fdm-dm-seats", "fdm-dm-monsters", "fdm-dm-equipment", "fdm-dm-maintenance", "fdm-dm-library", "fdm-dm-seatTokens", "fdm-dm-tokens", "fdm-dm-approvals"] as const;

  const closeAllDmPanels = useCallback(async () => {
    if (!OBR.isAvailable) { setOpenPanel(null); return; }
    await Promise.all([
      ...DM_PANEL_IDS.map(id => OBR.popover.close(id).catch(() => undefined)),
      OBR.popover.close("fdm-actor-card").catch(() => undefined),
    ]);
  }, []);

  const openDmPanel = useCallback(async (
    panel: "editActors" | "seats" | "monsters" | "equipment" | "tokens" | "maintenance" | "library" | "seatTokens" | "approvals",
    create?: "actor" | "monster" | "equipment",
  ) => {
    if (!OBR.isAvailable) {
      const fallbackMap: Record<string, ToolPanelId> = {
        editActors: "editActors", seats: "actorAssignments", library: "editActors",
        monsters: "monsterPanel", maintenance: "roomMaintenance", seatTokens: "actorAssignments",
      };
      setOpenPanel(fallbackMap[panel] ?? null);
      return;
    }
    try {
      const base = new URL(window.location.href);
      base.pathname = base.pathname.replace(/\/[^/]*$/, "/dm-panel.html");
      base.search = "";
      base.searchParams.set("panel", panel);
      // create= tells the DM panel to jump straight into the right creator.
      if (create) base.searchParams.set("create", create);
      if (OBR.popover) {
        const sizes: Record<string, { width: number; height: number }> = {
          editActors: { width: 700, height: 860 },
          library: { width: 700, height: 860 },
          seats: { width: 640, height: 800 },
          seatTokens: { width: 640, height: 800 },
          tokens: { width: 640, height: 800 },
          monsters: { width: 660, height: 820 },
          equipment: { width: 640, height: 780 },
          maintenance: { width: 560, height: 640 },
        };
        const { width, height } = sizes[panel] ?? { width: 660, height: 800 };
        // Close ALL other DM panels first — enforce one DM panel at a time
        // (actor card stays independent). When create= is set we also close the
        // target panel so it reopens fresh and the create flow actually triggers.
        await Promise.all(
          DM_PANEL_IDS
            .filter(id => create ? true : id !== `fdm-dm-${panel}`)
            .map(id => OBR.popover.close(id).catch(() => undefined))
        );

        // Position near the right edge of the screen, below the OBR toolbar
        const panelLeft = Math.max(width + 32, Math.min(window.screen.width - width - 16, window.screen.width - width - 40));

        await OBR.popover.open({
          id: `fdm-dm-${panel}`,
          url: base.toString(),
          width,
          height,
          anchorReference: "POSITION",
          anchorPosition: { left: panelLeft, top: 24 },
          anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
          transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
          disableClickAway: true,
          marginThreshold: 16,
        });
      } else {
        throw new Error("no popover");
      }
    } catch {
      // Fallback
      const fallbackMap: Record<string, ToolPanelId> = {
        editActors: "editActors", seats: "actorAssignments",
        monsters: "monsterPanel", maintenance: "roomMaintenance",
      };
      setOpenPanel(fallbackMap[panel] ?? null);
    }
  }, []);

  // ── Budget ────────────────────────────────────────────────────────────────
  const roomBytes = getRoomStateBytes();
  const budgetLabel = roomBytes < 4000 ? "OK" : roomBytes < 8000 ? "WARN" : "DANGER";

  // ─────────────────────────────────────────────────────────────────────────
  // Player no-seat state
  // ─────────────────────────────────────────────────────────────────────────

  // Still identifying the viewer — show a minimal loading state, no flash
  if (isRoleLoading) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "#555" }}>
        <p style={{ fontSize: 12 }}>Loading…</p>
      </div>
    );
  }

  // ── Boot screen — no table binding or unrecognized viewer ────────────────
  // Shown when: no binding exists, OR a stale binding exists with a different GM ID.
  // Anyone can claim DM from here. The Owlbear room owner is the intended claimer.
  if (viewerRole === "unknown" || (!isDmMode && !isPlayerMode)) {
    return (
      <div style={{ padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 14 }}>Forever DM Combat</p>
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{APP_VERSION}</p>
        {tableBinding ? (
          <>
            <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
              A table exists but you are not recognized as DM or a seated player.
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
              If you are the DM, claim the table to reassign yourself.
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
            No table binding found. If you are the DM, claim the table to begin.
          </p>
        )}
        <button
          type="button"
          onClick={() => void claimTableBinding()}
          style={{ padding: "8px 20px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
        >
          Claim Table as DM
        </button>
        {tableBinding && (
          <>
            <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
              If you are a player, wait for the DM to assign your seat.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!OBR.isAvailable) return;
                void publishFdmcRoomStateKey(FDMC_TABLE_BINDING_KEY, null).then(() => setTableBinding(null));
              }}
              style={{ padding: "4px 12px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 4, color: "#ff9999", cursor: "pointer", fontSize: 11 }}
            >
              Clear stale FDMC metadata
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Viewer mode — read-only combat observer ───────────────────────────────
  if (isPlayerMode && seatStatus === "viewer") {
    return (
      <main className="fdmc-app">
        {/* Viewer status bar */}
        <div style={{ padding: "4px 12px", background: "#0a0a12", borderBottom: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#555" }}>👁 Watching — read only</span>
          <button
            type="button"
            onClick={releaseSeat}
            style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#555", cursor: "pointer" }}
          >
            ← Change Seat
          </button>
        </div>

        {/* Actor nameplates — from viewer party broadcast */}
        {viewerParty.length > 0 && (
          <section aria-label="Actor roster" style={{ padding: "8px 12px" }}>
            <h2 className="panel-title">Actors</h2>
            <div className="actor-list actor-card-grid-2x3">
              {viewerParty.map(actor => {
                const ratio = actor.hpMax > 0 ? actor.hpCurrent / actor.hpMax : 0;
                const hpStatus = actor.hpCurrent <= 0 ? "down" : ratio < 0.5 ? "bloodied" : "healthy";
                return (
                  <div key={actor.id} className={`actor-select-button actor-grid-card ${hpStatus}`} style={{ cursor: "default" }}>
                    <span className="actor-grid-name">{actor.name}</span>
                    <span className="actor-grid-meta">
                      {actor.hpCurrent <= 0 ? "☠ Down" : ratio <= 0.25 ? "Critical" : ratio <= 0.5 ? "Bloodied" : ratio <= 0.75 ? "Wounded" : "Healthy"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {viewerParty.length === 0 && (
          <p style={{ padding: "12px 14px", fontSize: 11, color: "#444" }}>Waiting for party data…</p>
        )}

        {/* Monster nameplates — player-safe, from DM broadcast */}
        {playerMonsters.length > 0 && (
          <PlayerMonsterRoster monsters={playerMonsters} />
        )}

        {/* Recent events — compact player view (no full DM log) */}
        <RecentEventsWidget entries={logEntries} />
      </main>
    );
  }

  // Show seat picker when:
  //  - no-seat: always (binding was removed — don't let cached actors block the picker)
  //  - claiming/loading: only if no cached actors yet, or player explicitly browsing
  if (isPlayerMode && (
    seatStatus === "no-seat" ||
    ((seatStatus === "claiming" || seatStatus === "loading") && (seatActors.length === 0 || isBrowsing))
  )) {
    const availableSeats = Object.values(roomLiveState.seats).sort((a, b) => a.seatId.localeCompare(b.seatId));
    const boundSeatIds = new Set(Object.values(roomLiveState.seatBindings).map(b => b.seatId));
    const openSeats = availableSeats.filter(s => !boundSeatIds.has(s.seatId));
    // Auto-claim if exactly one seat is open
    // Auto-claim removed — players always choose their own seat

    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#aaa" }}>Forever DM Combat</p>
          <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{APP_VERSION}</p>
        </div>

        {seatStatus === "loading" ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#555", margin: 0, fontSize: 12 }}>Connecting…</p>
          </div>
        ) : seatStatus === "claiming" ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#7b68ee", margin: 0 }}>Connecting to your seat…</p>
            <button type="button" onClick={requestActorData}
              style={{ marginTop: 8, fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        ) : availableSeats.length === 0 ? (
          <>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <p style={{ color: "#555", fontSize: 12, margin: 0 }}>
                Waiting for DM to open seats…
              </p>
              <button
                type="button"
                onClick={() => void refreshFromRoom()}
                style={{ fontSize: 12, padding: "4px 14px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}
              >
                Refresh
              </button>
            </div>
            {/* Viewer option even when no player seats exist */}
            <div style={{ marginTop: 12, borderTop: "1px solid #2a2a2a", paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => claimViewerSeat()}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "#0d0d14", border: "1px solid #333",
                  borderRadius: 6, color: "#666", cursor: "pointer",
                  textAlign: "left", display: "flex",
                  justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: "#555" }}>👁 Watch as Viewer</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                    Read-only — see the combat screen without a player seat
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "#444" }}>no seat required →</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 12, color: "#888", textAlign: "center" }}>
              Select your seat:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {availableSeats.map(seat => {
                  const isViewerSeat = seat.seatMode === "viewer";
                  const isTaken = boundSeatIds.has(seat.seatId);
                  return (
                    <button
                      key={seat.seatId}
                      type="button"
                      onClick={() => manualClaim(seat.seatId, seat)}
                      style={{
                        padding: "10px 14px",
                        background: isViewerSeat ? "#0d0d14" : (isTaken ? "#1a1a1a" : "#1a1a2e"),
                        border: `1px solid ${isViewerSeat ? "#2a3a2a" : (isTaken ? "#333" : "#7b68ee55")}`,
                        borderRadius: 6,
                        color: isViewerSeat ? "#4caf50" : (isTaken ? "#555" : "#fff"),
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>
                          {isViewerSeat ? `👁 ${seat.label}` : seat.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                          {isViewerSeat
                            ? "Read-only watch seat"
                            : seat.actorIds.length > 0
                              ? seat.actorIds.join(", ")
                              : "No actors assigned yet"}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: isViewerSeat ? "#4caf5066" : (isTaken ? "#555" : "#7b68ee") }}>
                        {isTaken && !isViewerSeat ? "occupied" : "open →"}
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Viewer seat — always available at the bottom, no DM config needed */}
            <div style={{ marginTop: 12, borderTop: "1px solid #2a2a2a", paddingTop: 12 }}>
              <button
                type="button"
                onClick={() => claimViewerSeat()}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "#0d0d14", border: "1px solid #333",
                  borderRadius: 6, color: "#666", cursor: "pointer",
                  textAlign: "left", display: "flex",
                  justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: "#555" }}>👁 Watch as Viewer</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                    Read-only — see the combat screen without a player seat
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "#444" }}>no seat required →</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (!selectedActor && actors.length === 0) {
    // DM sees toolbar so they can access Edit Actors to build the library
    // Player sees a waiting message
    return (
      <main className="fdmc-app">
        {isDmMode && (
          <header className="fdmc-dm-toolbar" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "6px 10px", background: "#0d0d14", borderBottom: "1px solid #2a2a3e" }}>
            <span style={dmGroupLabel("#3f9d5f")}>Create</span>
            <button type="button" style={DM_CREATE_SHADES[0]} onClick={() => void openDmPanel("library", "actor")}>+ Party Character</button>
            <button type="button" style={DM_CREATE_SHADES[1]} onClick={() => void openDmPanel("library", "monster")}>+ Monster</button>
            <button type="button" style={DM_CREATE_SHADES[2]} onClick={() => void openDmPanel("library", "equipment")}>+ Equipment</button>
            <span style={{ width: 10 }} />
            <span style={dmGroupLabel("#5f8fd9")}>Manage</span>
            <button type="button" style={DM_USE_SHADES[0]} onClick={() => void openDmPanel("seatTokens")}>Seats &amp; Tokens</button>
            <button type="button" style={DM_USE_SHADES[1]} onClick={() => void openDmPanel("library")}>Library</button>
            <span style={{ flex: 1, minWidth: 8 }} />
            <button type="button" style={DM_BTN.fix} title="Something looks broken? Open Room Maintenance."
              onClick={() => void openDmPanel("maintenance")}>🛠 Fix something</button>
            <button type="button" style={DM_BTN.danger} title="Close all floating DM windows"
              onClick={() => void closeAllDmPanels()}>✕ Close All</button>
            <button type="button" style={DM_BTN.use}
              onClick={() => { setActorLibrary(loadActorLibrary()); setActorOverrides(loadActorOverrides()); }}>↺ Sync</button>
          </header>
        )}
        <div style={{ padding: 24, textAlign: "center", color: "#555", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <p style={{ margin: 0 }}>
            {isDmMode ? "No Party Characters in your library." : "No characters assigned to your seat."}
          </p>
          {isDmMode ? (
            <>
              <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
                What do you want to build first?
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <button type="button" onClick={() => void openDmPanel("library", "actor")}
                  style={{ ...DM_BTN.create, fontSize: 13, padding: "9px 18px" }}>+ Create Party Character</button>
                <button type="button" onClick={() => void openDmPanel("library", "monster")}
                  style={{ ...DM_BTN.create, fontSize: 13, padding: "9px 18px" }}>+ Create Monster</button>
                <button type="button" onClick={() => void openDmPanel("library", "equipment")}
                  style={{ ...DM_BTN.create, fontSize: 13, padding: "9px 18px" }}>+ Create Equipment</button>
              </div>
              <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
                Monsters and equipment you create are saved to your <strong style={{ color: "#7be08a" }}>My Library</strong>.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#444", margin: 0 }}>
                The DM may not have assigned actors to your seat yet.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={requestActorData}
                  style={{ fontSize: 12, padding: "5px 14px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}>
                  Retry
                </button>
                <button type="button" onClick={releaseSeat}
                  style={{ fontSize: 12, padding: "5px 14px", background: "#1a1a2e", border: "1px solid #7b68ee44", borderRadius: 4, color: "#7b68ee", cursor: "pointer" }}>
                  ← Choose Different Seat
                </button>
              </div>
            </>
          )}
        </div>

        <ToolPanelLayer
          openPanel={openPanel}
          title={getToolPanelTitle(openPanel)}
          isAllowed={isDmMode}
          onClose={closePanel}
        >
          {openPanel === "actorAssignments" && (
            <SeatAssignmentPanel
              actors={dmActors}
              seats={seats}
              seatBindings={seatBindings}
              onAssignSeat={assignSeat}
              onPushActorsToSeat={pushActorsToSeat}
              onPushActorsToAllSeats={pushActorsToAllSeats}
            />
          )}
          {openPanel === "editActors" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              {/* Level-up approval queue — same as OBR popover path */}
              {levelUpRequests.length > 0 && (
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", flexShrink: 0 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600 }}>Pending Level-Up Requests</p>
                  {levelUpRequests.map(req => (
                    <LevelUpApprovalPanel
                      key={req.actorId}
                      request={req}
                      currentActor={dmActors.find(a => a.id === req.actorId)}
                      onApprove={handleLevelUpApprove}
                      onReject={handleLevelUpReject}
                    />
                  ))}
                </div>
              )}
              {editingActorId === "__new__" ? (
                <ActorEditor
                  mode="create-new"
                  onSave={handleActorEditorSave}
                  onCancel={() => setEditingActorId(null)}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#888" }}>No actors yet — build your party.</p>
                    <button
                      type="button"
                      onClick={() => setEditingActorId("__new__")}
                      style={{ fontSize: 12, padding: "4px 12px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}
                    >
                      + Create New Actor
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {openPanel === "roomMaintenance" && (
            <FdmcRoomMaintenancePanel
              onScan={scanFdmcRoomMetadata}
              onPurge={purgeLegacyFdmcMetadata}
              onReinitialize={async () => {
                const scan = await scanFdmcRoomMetadata();
                const sharedExists = scan.entries.some(e => e.key.includes("sharedTableState"));
                return { ok: true, checks: { tableBindingExists: Boolean(tableBinding), sharedTableStateExists: sharedExists, actorsByIdEmpty: true, actorsOrderEmpty: true, combatPhaseSetup: true, revisionIsOne: true }, tableBinding: tableBinding ?? undefined, message: "Room live state is canonical." };
              }}
              onActorSnapshot={async () => ({ ok: true, mode: "empty" as const, actorCount: dmActors.length, bytes: 0, message: `${dmActors.length} actors in DM library (localStorage).` })}
              onPurgeSeatMetadata={purgeAllSeatMetadata}
            />
          )}
        </ToolPanelLayer>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────

  const actorToShow = selectedActor ?? actors[0];
  if (!actorToShow) return null;

  const hp = getActorHp(actorToShow.id);
  const actionState = getActionState(actorToShow);
  const concentration = getActorConcentration(actorToShow);
  const committedRoll = getCommittedRoll(actorToShow);
  const actorNotes = getActorNotes(actorToShow);
  const status = getActorStatus(actorToShow);
  // liveHpByActorId is computed above as a useMemo

  return (
    <main className="fdmc-app">

      {/* ── DM toolbar — grouped, color-coded rows (P-UX1) ── */}
      {isDmMode && (
        <header
          className="fdmc-dm-toolbar"
          style={{ display: "flex", flexDirection: "column", gap: 5, padding: "6px 10px", background: "#0d0d14", borderBottom: "1px solid #2a2a3e" }}
        >
          {/* Row 1 — CREATE (green) · session + status on the right */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={dmGroupLabel("#3f9d5f")}>Create</span>
            <button type="button" style={DM_CREATE_SHADES[0]} title="Build a new Party Character (guided)"
              onClick={() => void openDmPanel("library", "actor")}>+ Party Character</button>
            <button type="button" style={DM_CREATE_SHADES[1]} title="Build a new monster — pick a band to scaffold it (saved to My Library)"
              onClick={() => void openDmPanel("library", "monster")}>+ Monster</button>
            <button type="button" style={DM_CREATE_SHADES[2]} title="Build a new equipment item"
              onClick={() => void openDmPanel("library", "equipment")}>+ Equipment</button>

            <span style={{ flex: 1, minWidth: 8 }} />

            {/* Approvals badge — only when pending */}
            {levelUpRequests.length > 0 && (
              <button type="button" onClick={() => void openDmPanel("approvals")}
                title={`${levelUpRequests.length} pending level-up request${levelUpRequests.length === 1 ? "" : "s"}`}
                style={{ background: "#7b68ee", color: "#fff", borderRadius: 10, padding: "2px 9px", fontSize: 11, border: "none", cursor: "pointer", fontWeight: 600 }}>
                ⬆ {levelUpRequests.length} Approval{levelUpRequests.length === 1 ? "" : "s"}
              </button>
            )}
            <button type="button" style={DM_BTN.session} title="Tell players their seats are open"
              onClick={() => {
                pushActorsToAllSeats();
                if (OBR.isAvailable) {
                  void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, { type: "fdmc:seats-ready", seats: Object.values(seats) }, { destination: "REMOTE" });
                }
              }}>
              ▶ Players Join
            </button>
            {!tableBinding && (
              <button type="button" style={DM_BTN.claim} onClick={() => void claimTableBinding()}>Claim Table</button>
            )}
            <span style={{ fontSize: 9, color: "#3a3a4e" }}>{APP_VERSION}</span>
            <span title="Room metadata size" style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, border: "1px solid #2a2a3e",
              color: budgetLabel === "OK" ? "#4caf50" : budgetLabel === "WARN" ? "#e0b85a" : "#ff5840" }}>
              {roomBytes}B
            </span>
          </div>

          {/* Row 2 — MANAGE (blue) · housekeeping cluster on the right */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={dmGroupLabel("#5f8fd9")}>Manage</span>
            <button type="button" style={DM_USE_SHADES[0]} onClick={() => void openDmPanel("seatTokens")}>Seats &amp; Tokens</button>
            <button type="button" style={DM_USE_SHADES[1]} title="Assign the selected map token to a seat or monster"
              onClick={() => void openDmPanel("tokens")}>🎯 Assign Token</button>
            <button type="button" style={DM_USE_SHADES[2]} title="Browse & load Party Characters, Monsters and Equipment"
              onClick={() => void openDmPanel("library")}>
              Library{monsterCandidates.length > 0 ? ` (${monsterCandidates.length})` : ""}
            </button>

            <span style={{ flex: 1, minWidth: 8 }} />

            <button type="button" style={DM_BTN.cleanup} title="Tidy up the encounter — clear defeated monsters and stale state"
              onClick={() => setOpenPanel("encounterCleanup")}>🧹 Cleanup</button>
            <button type="button" style={DM_BTN.fix} title="Something looks broken? Open Room Maintenance to repair room state."
              onClick={() => void openDmPanel("maintenance")}>🛠 Fix something</button>
            <button type="button" style={DM_BTN.danger} title="Close all floating DM windows"
              onClick={() => void closeAllDmPanels()}>✕ Close All</button>
          </div>
        </header>
      )}

      {/* ── DM sync bar — always visible, pulls actors from localStorage ── */}
      {isDmMode && (
        <div style={{ padding: "3px 12px", background: "#0a0a12", borderBottom: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#444" }}>
            {dmActors.length > 0 ? `${dmActors.length} Party Character${dmActors.length === 1 ? "" : "s"} loaded` : "No characters — open Library → Create Party Character"}
          </span>
          <button
            type="button"
            onClick={() => {
              // P8: reload from localStorage, repair room metadata HP, bust all seated player caches
              const freshLib = loadActorLibrary();
              const freshOverrides = loadActorOverrides();
              setActorLibrary(freshLib);
              setActorOverrides(freshOverrides);
              // Repair room metadata HP for any actor whose max HP changed in the library
              for (const actor of Object.values(freshLib)) {
                const resolved = resolveActor(actor.id, freshLib, freshOverrides, roomLiveState);
                if (!resolved) continue;
                const liveHp = getActorHp(actor.id);
                if (liveHp.max !== resolved.stats.hp.max) {
                  // Preserve current HP ratio, update max
                  const newCurrent = Math.min(liveHp.current, resolved.stats.hp.max);
                  void setActorHp(actor.id, { current: newCurrent, max: resolved.stats.hp.max, temp: liveHp.temp });
                }
              }
              pushActorsToAllSeats({ freshLibrary: freshLib, freshOverrides });
            }}
            style={{ fontSize: 11, padding: "2px 10px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}
            title="Reload actors from library and push to all seated players"
          >
            ↺ Sync Library
          </button>
        </div>
      )}

      {/* ── Player loot offer — two views: mid-combat (compact strip) or final (full-screen) ── */}
      {isPlayerMode && lootOffer && actorToShow && (() => {
        const mode = (lootOffer as { mode?: string }).mode;
        const isFinal = mode === "boss-final";
        const isMerchant = mode === "merchant";

        function chooseItem(item: { id: string; name: string }) {
          void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
            type: "fdmc:loot-choice",
            seatId: claimedSeatId,
            offerId: lootOffer!.offerId,
            chosenItemId: item.id,
            actorId: actorToShow!.id,
          } as import("./core/ui/EquipmentLibraryStandalone").LootChoice, { destination: "REMOTE" });
          addEntry({ actorName: actorToShow!.name, actionName: "Loot Chosen", tabId: "system", message: `${actorToShow!.name} chose ${item.name}.` });
        }

        if (isFinal) {
          // Full-screen pick panel — best for end-of-session rewards
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,14,0.95)", zIndex: 200, display: "flex", flexDirection: "column", padding: 24, gap: 16, overflowY: "auto" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 2 }}>Session Reward</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#fff" }}>🏆 {lootOffer.message}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>Choose one item — it will be added to your equipment.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480, margin: "0 auto", width: "100%" }}>
                {lootOffer.items.map(item => (
                  <div key={item.id} style={{ padding: "14px 16px", background: "#161622", borderRadius: 10, border: "1px solid #2a2a3e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          <strong style={{ fontSize: 14, color: "#fff" }}>{item.name}</strong>
                          <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 6px", borderRadius: 8 }}>{item.category ?? item.type}</span>
                          {item.tier && <span style={{ fontSize: 10, color: "#7b68ee" }}>{item.tier}</span>}
                          {item.attunementRequired && <span style={{ fontSize: 10, color: "#e07b39" }}>Attunement</span>}
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item.description}</p>
                        {item.mechanicsText && <p style={{ margin: 0, fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>{item.mechanicsText}</p>}
                        {item.attack && <span style={{ fontSize: 11, color: "#7b68ee", marginRight: 8 }}>⚔ {item.attack}</span>}
                        {item.damage && <span style={{ fontSize: 11, color: "#e07b39" }}>💥 {item.damage}</span>}
                        {item.ac && <span style={{ fontSize: 11, color: "#4caf50" }}>🛡 AC {item.ac}</span>}
                      </div>
                      <button type="button" onClick={() => chooseItem(item)}
                        style={{ fontSize: 13, padding: "8px 18px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                        ✓ Choose
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (isMerchant) {
          // Merchant: full-screen shop view with gold costs
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,14,0.95)", zIndex: 200, display: "flex", flexDirection: "column", padding: 24, gap: 16, overflowY: "auto" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "#e0a030", textTransform: "uppercase", letterSpacing: 2 }}>Merchant</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#fff" }}>🛒 {lootOffer.message}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>Choose one item to purchase — gold spent is recorded by the DM.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480, margin: "0 auto", width: "100%" }}>
                {lootOffer.items.map(item => (
                  <div key={item.id} style={{ padding: "14px 16px", background: "#161622", borderRadius: 10, border: "1px solid #2a2a3e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          <strong style={{ fontSize: 14, color: "#fff" }}>{item.name}</strong>
                          <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 6px", borderRadius: 8 }}>{item.category ?? item.type}</span>
                          {item.attunementRequired && <span style={{ fontSize: 10, color: "#e07b39" }}>Attunement</span>}
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item.description}</p>
                        {item.mechanicsText && <p style={{ margin: "0 0 6px", fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>{item.mechanicsText}</p>}
                        {item.value && <span style={{ fontSize: 13, color: "#e0a030", fontWeight: 600 }}>💰 {item.value}</span>}
                      </div>
                      <button type="button" onClick={() => chooseItem(item)}
                        style={{ fontSize: 13, padding: "8px 14px", background: "#4a3a1a", border: "1px solid #e0a03055", color: "#e0a030", borderRadius: 6, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                        Buy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center" }}>
                <button type="button" onClick={() => setLootOffer(null)}
                  style={{ fontSize: 12, padding: "6px 20px", background: "transparent", border: "1px solid #444", borderRadius: 6, color: "#888", cursor: "pointer" }}>
                  Nothing for me
                </button>
              </div>
            </div>
          );
        }

        // Mid-boss: compact strip above the combat panel, doesn't block view
        return (
          <div style={{ margin: "4px 12px 0", background: "#0d0d14", border: "1px solid #7b68ee44", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "6px 10px", background: "#1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#7b68ee" }}>🎁 {lootOffer.message}</span>
              <span style={{ fontSize: 10, color: "#444" }}>pick one</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {lootOffer.items.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#0d0d14" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#ddd" }}>{item.name}</span>
                    <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>{item.category ?? item.type}</span>
                    {item.tier && <span style={{ fontSize: 10, color: "#7b68ee66", marginLeft: 4 }}>{item.tier}</span>}
                  </div>
                  <button type="button" onClick={() => chooseItem(item)}
                    style={{ fontSize: 10, padding: "3px 10px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 4, color: "#7b68ee", cursor: "pointer", flexShrink: 0 }}>
                    Take
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Player convergence panel (player-initiated) ── */}
      {isPlayerMode && showConvergePanel && actorToShow && (() => {
        // Get convergence-eligible items from the actor's equipment bag
        const equipBag: { id?: string; label?: string; itemId?: string; metadata?: { convergence?: { role?: string; mechanicalTag?: string } } }[] =
          (actorToShow as unknown as { tabs?: { equipment?: unknown[] } }).tabs?.equipment as typeof equipBag ?? [];
        const allLibItems = loadEquipmentLibrary();
        // An item is convergence-eligible if it's tagged in the library with role: "input"
        const eligibleItems = equipBag
          .map(a => {
            const rawId = (a.id ?? "").replace(/^equip-/, "");
            return allLibItems.find(i => i.id === rawId || `equip-${i.id}` === a.id);
          })
          .filter((i): i is import("./core/ui/EquipmentBagEditor").EquipmentItem => Boolean(i?.convergence?.role === "input"));

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [selected, setSelected] = useState<string[]>([]);

        function toggle(id: string) {
          setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        }

        function submitConvergence() {
          if (selected.length < 2 || convergenceSubmitting) return;
          setConvergenceSubmitting(true);
          const chosenItems = eligibleItems.filter(i => selected.includes(i.id));
          void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
            type: "fdmc:convergence-request",
            seatId: claimedSeatId,
            offerId: `forge-${Date.now().toString(36)}`,
            submittedItemIds: chosenItems.map(i => i.id),
            submittedItemNames: chosenItems.map(i => i.name),
            actorId: actorToShow!.id,
            actorName: actorToShow!.name,
          } as import("./core/ui/EquipmentLibraryStandalone").ConvergenceRequest, { destination: "REMOTE" });
          addEntry({
            actorName: actorToShow!.name,
            actionName: "Convergence Submitted",
            tabId: "system",
            message: `${actorToShow!.name} submitted ${chosenItems.map(i => i.name).join(" + ")} for convergence.`,
          });
        }

        if (convergenceSubmitting) {
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,14,0.97)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
              <p style={{ fontSize: 32, margin: 0 }}>◈</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#4caf50", margin: 0 }}>Awaiting DM Approval</p>
              <p style={{ fontSize: 12, color: "#555", margin: 0, textAlign: "center" }}>Your items have been submitted. The DM will forge the result and send it to you.</p>
            </div>
          );
        }

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,14,0.97)", zIndex: 200, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 10, color: "#4caf50", textTransform: "uppercase", letterSpacing: 2 }}>Forge</p>
                <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>◈ Try Convergence</h3>
              </div>
              <button type="button" onClick={() => setShowConvergePanel(false)}
                style={{ fontSize: 12, padding: "5px 12px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}>
                ✕ Close
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#888", lineHeight: 1.6 }}>
                Select two items from your bag to submit for convergence. The DM will determine the outcome. You will not know the result until they approve.
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
                Only items with a convergence tag (◈) are eligible. You need at least 2.
              </p>

              {eligibleItems.length === 0 && (
                <div style={{ background: "#1a1a0d", border: "1px solid #5a4a0a", borderRadius: 8, padding: "14px 16px" }}>
                  <p style={{ margin: 0, color: "#ffcc44", fontSize: 13, fontWeight: 600 }}>No convergence items in your bag</p>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666" }}>
                    Convergence items are special drops tagged with ◈. Check your equipment tab — they appear in your bag after boss encounters.
                  </p>
                </div>
              )}

              {eligibleItems.length === 1 && (
                <div style={{ background: "#1a1a0d", border: "1px solid #5a4a0a", borderRadius: 8, padding: "14px 16px" }}>
                  <p style={{ margin: 0, color: "#ffcc44", fontSize: 13, fontWeight: 600 }}>Only 1 convergence item found</p>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666" }}>You need at least 2 convergence-tagged items to attempt a forge.</p>
                </div>
              )}

              {eligibleItems.map(item => {
                const isSelected = selected.includes(item.id);
                return (
                  <button key={item.id} type="button" onClick={() => toggle(item.id)}
                    style={{
                      all: "unset", display: "block", width: "100%", boxSizing: "border-box",
                      padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                      background: isSelected ? "#0d1a0d" : "#161622",
                      border: `2px solid ${isSelected ? "#4caf50" : "#2a2a3e"}`,
                      transition: "border-color 0.15s",
                    }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 2,
                        background: isSelected ? "#4caf50" : "transparent",
                        border: `2px solid ${isSelected ? "#4caf50" : "#444"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, color: "#fff",
                      }}>
                        {isSelected ? "✓" : ""}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          <strong style={{ fontSize: 14, color: "#fff" }}>{item.name}</strong>
                          {item.category && <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 6px", borderRadius: 8 }}>{item.category}</span>}
                          {item.tier && <span style={{ fontSize: 10, color: "#4caf5088" }}>{item.tier}</span>}
                          <span style={{ fontSize: 10, color: "#4caf50" }}>◈ {item.convergence?.mechanicalTag}</span>
                        </div>
                        {item.act && <p style={{ margin: "0 0 4px", fontSize: 10, color: "#444" }}>{item.act}{item.session ? ` · ${item.session}` : ""}</p>}
                        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item.description}</p>
                        {item.mechanicsText && <p style={{ margin: 0, fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>{item.mechanicsText}</p>}
                      </div>
                    </div>
                  </button>
                );
              })}

              {selected.length >= 2 && (
                <div style={{ background: "#0a1a0a", border: "1px solid #4caf5055", borderRadius: 8, padding: "12px 14px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#4caf50", fontWeight: 600 }}>Ready to submit</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                    {eligibleItems.filter(i => selected.includes(i.id)).map(i => i.name).join(" + ")} will be sent to the DM. You will not know the result until they approve. This cannot be undone.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #2a2a3e", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button"
                disabled={selected.length < 2}
                onClick={submitConvergence}
                style={{
                  width: "100%", padding: "13px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none",
                  cursor: selected.length >= 2 ? "pointer" : "default",
                  background: selected.length >= 2 ? "linear-gradient(135deg, #1a4a1a 0%, #2a6e2a 100%)" : "#1a1a1a",
                  color: selected.length >= 2 ? "#fff" : "#444",
                }}>
                {selected.length < 2 ? `◈ Select ${2 - selected.length} more item${2 - selected.length === 1 ? "" : "s"}` : "◈ Submit to DM for Forging"}
              </button>
              <button type="button" onClick={() => setShowConvergePanel(false)}
                style={{ width: "100%", padding: "8px", fontSize: 12, background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#666", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Player loot delivery toast ── */}
      {isPlayerMode && lootToast && (
        <div style={{ padding: "6px 14px", background: "#2a6e2a", fontSize: 12, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>🎁 {lootToast}</span>
          <button type="button" onClick={() => setLootToast(null)} style={{ fontSize: 11, background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}>×</button>
        </div>
      )}
      {/* ── Player level-up rejection toast ── */}
      {isPlayerMode && levelUpRejectionToast && (
        <div style={{ padding: "6px 14px", background: "#3a1a1a", fontSize: 12, color: "#ff9999", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>↩ {levelUpRejectionToast}</span>
          <button type="button" onClick={() => setLevelUpRejectionToast(null)} style={{ fontSize: 11, background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* ── Player convergence forge button — shown when player has ≥2 convergence items ── */}
      {isPlayerMode && actorToShow && !showConvergePanel && !convergenceSubmitting && (() => {
        const equipBag: { id?: string }[] =
          (actorToShow as unknown as { tabs?: { equipment?: { id?: string }[] } }).tabs?.equipment ?? [];
        const libItems = loadEquipmentLibrary();
        const eligibleCount = equipBag.filter(a => {
          const rawId = (a.id ?? "").replace(/^equip-/, "");
          const lib = libItems.find(i => i.id === rawId || `equip-${i.id}` === a.id);
          return lib?.convergence?.role === "input";
        }).length;
        if (eligibleCount < 2) return null;
        return (
          <div style={{ padding: "4px 12px", flexShrink: 0 }}>
            <button type="button" onClick={() => setShowConvergePanel(true)}
              style={{ width: "100%", padding: "7px", fontSize: 12, fontWeight: 600, background: "#0d1a0d", border: "1px solid #4caf5055", borderRadius: 6, color: "#4caf50", cursor: "pointer", letterSpacing: 0.5 }}>
              ◈ Try Convergence — {eligibleCount} forge item{eligibleCount !== 1 ? "s" : ""} in bag
            </button>
          </div>
        );
      })()}

      {/* ── Player seat status bar — shows when seated or syncing, not while browsing ── */}
      {isPlayerMode && !isBrowsing && claimedSeatId && (seatStatus === "ready" || seatStatus === "claiming") && (() => {
        const mySeatColor = getSeatColor(claimedSeatId);
        // "Your turn" when one of this seat's characters is the active combatant.
        const isMyTurn = roomLiveState.combat.phase === "combat"
          && seatActors.some(a => a.id === roomLiveState.combat.activeActorId);
        return (
        <div style={{ padding: "4px 12px", background: seatStatus === "claiming" ? "#1a1a2e" : withAlpha(mySeatColor, isMyTurn ? 0.22 : 0.12), borderLeft: `4px solid ${seatStatus === "claiming" ? "#444" : mySeatColor}`, fontSize: 11, color: "#888", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: seatStatus === "claiming" ? "#888" : mySeatColor, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span>
              {seatStatus === "claiming" ? "⟳" : "●"} {roomLiveState.seats[claimedSeatId]?.label ?? claimedSeatId}
              {seatStatus === "claiming" && <span style={{ fontSize: 9, color: "#555", marginLeft: 4 }}>syncing…</span>}
            </span>
            {isMyTurn && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: mySeatColor, color: "#0d0d14", textTransform: "uppercase", letterSpacing: 0.5 }}>
                ▶ Your turn
              </span>
            )}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {/* P6: unlock own token — only show when DM has granted movement for this seat */}
            {OBR.isAvailable && viewerSeatKey && (() => {
              // Only show if this player's viewerSeatKey appears in a binding
              // (i.e. DM has actually bound a token with allowPlayerMove to their seat)
              const myBinding = Object.values(roomLiveState.seatBindings).find(
                b => b.viewerSeatKey === viewerSeatKey
              );
              if (!myBinding) return null;
              return (
                <button type="button"
                  onClick={async () => {
                    try {
                      const all = await OBR.scene.items.getItems();
                      const { readTokenBinding, unlockToken } = await import("./core/tokens/tokenBinding");
                      for (const item of all) {
                        const b = readTokenBinding(item);
                        if (b?.bindingType === "seat" && b.seatId === claimedSeatId && b.allowPlayerMove) {
                          await unlockToken(item.id);
                        }
                      }
                    } catch { /* ok */ }
                  }}
                  style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #2a6e2a44", borderRadius: 3, color: "#4caf5099", cursor: "pointer" }}
                  title="Unlock your token (DM has granted movement permission)">
                  🔓
                </button>
              );
            })()}
            <button type="button" onClick={requestActorData}
              style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#666", cursor: "pointer" }}>
              Refresh
            </button>
            {/* Level-up request — player submits request to DM */}
            {actorToShow && (
              <button type="button" onClick={() => setShowLevelUpRequest(v => !v)}
                style={{ fontSize: 10, padding: "1px 6px", background: showLevelUpRequest ? "#7b68ee22" : "transparent", border: "1px solid #7b68ee33", borderRadius: 3, color: "#7b68ee88", cursor: "pointer" }}
                title="Request level up from DM">
                ⬆ Level
              </button>
            )}
            {/* Always give players a way back to the seat picker */}
            <button type="button" onClick={releaseSeat}
              style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #2a2a3e", borderRadius: 3, color: "#555", cursor: "pointer" }}
              title="Return to seat selection">
              ← Seats
            </button>
          </div>
        </div>
        );
      })()}

      {/* ── Player level-up request panel ── */}
      {isPlayerMode && showLevelUpRequest && actorToShow && (
        <LevelUpRequestPanel
          actor={actorToShow}
          seatId={claimedSeatId ?? ""}
          onClose={() => setShowLevelUpRequest(false)}
        />
      )}

      {/* ── Actor selector ── */}
      <ActorSelector
        actors={actors}
        selectedActorId={actorToShow.id}
        hpByActorId={liveHpByActorId}
        actionStateByActorId={actionStateByActorId}
        seatColorById={seatColorById}
        onSelectActor={setSelectedActorId}
        onOpenActorCard={async (actorId) => {
          setSelectedActorId(actorId);

          // Toggle: if this actor's card is already open, close it
          if (openActorPopoverId === actorId) {
            setOpenActorPopoverId(null);
            setFocusedActorId(null);
            if (OBR.isAvailable) await OBR.popover.close("fdm-actor-card").catch(() => undefined);
            return;
          }

          setFocusedActorId(null);
          if (!OBR.isAvailable) { setFocusedActorId(actorId); setOpenActorPopoverId(actorId); return; }
          try {
            const popoverUrl = new URL(window.location.href);
            popoverUrl.pathname = popoverUrl.pathname.replace(/\/[^/]*$/, "/actor-popout.html");
            popoverUrl.search = "";
            popoverUrl.searchParams.set("fdmActorPopover", actorId);
            // Carry the seat color so the popout sheet can tint the character name.
            const popoutSeatColor = seatColorById[actorId];
            if (popoutSeatColor) popoverUrl.searchParams.set("seatColor", popoutSeatColor);
            await OBR.popover.close("fdm-actor-card").catch(() => undefined);
            const cardLeft = Math.max(500 + 32, Math.min(window.screen.width - 500 - 16, window.screen.width - 540));
            await OBR.popover.open({
              id: "fdm-actor-card",
              url: popoverUrl.toString(),
              width: 500,
              height: 640,
              anchorReference: "POSITION",
              anchorPosition: { left: cardLeft, top: 24 },
              anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
              transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
              disableClickAway: true,   // keep window open — user must click ✕ Close All or the actor button again
              marginThreshold: 16,
            });
            setOpenActorPopoverId(actorId);
          } catch {
            setFocusedActorId(actorId);
            setOpenActorPopoverId(actorId);
          }
        }}
      />

      {/* ── Context-aware economy strip — actor dots or monster dots by active turn ── */}
      {(() => {
        const dot = (label: string, color: string) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}66` }} />
            <span style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
          </div>
        );

        const activeId = roomLiveState.combat.activeActorId;
        const phase = roomLiveState.combat.phase;

        // During combat: show active combatant's economy dots
        if (phase === "combat" && activeId) {
          const activeMon = monsterCandidates.find(
            m => (m as MainEncounterMonsterInstance).instanceId === activeId,
          ) as MainEncounterMonsterInstance | undefined;

          if (activeMon) {
            // Monster's turn — show ACTION + REACTION dots only
            const eco = monsterEconomyByInstanceId[activeId] ?? { actionUsed: false, reactionUsed: false };
            return (
              <div style={{ display: "flex", gap: 10, padding: "6px 14px 4px", alignItems: "center" }}>
                {dot("Action",   eco.actionUsed   ? "#ff5840" : "#4bb469")}
                {dot("Reaction", eco.reactionUsed ? "#ff5840" : "#4bb469")}
                <span style={{ fontSize: 9, color: "#555", marginLeft: 2 }}>
                  {activeMon.revealedName || activeMon.displayName || activeMon.name}
                </span>
              </div>
            );
          }

          // Actor's turn — check all combatants (includes actors from other seats)
          const activeActor = actors.find(a => a.id === activeId);
          if (activeActor) {
            const actionState = actionStateByActorId[activeActor.id];
            const concentration = getActorConcentration(activeActor);
            const slots: { cost: "main" | "bonus" | "bond" | "reaction"; label: string }[] = [
              { cost: "main", label: "Action" }, { cost: "bonus", label: "Bonus" },
              { cost: "bond", label: "Bond" }, { cost: "reaction", label: "Reaction" },
            ];
            return (
              <div style={{ display: "flex", gap: 10, padding: "6px 14px 4px", alignItems: "center" }}>
                {slots.map(({ cost, label }) => {
                  const val = actionState?.[cost] ?? null;
                  const isUsed = val?.startsWith("__fdm_used__:");
                  const isReadied = val && !isUsed;
                  return dot(label, isUsed ? "#ff5840" : isReadied ? "#d7b36a" : "#4bb469");
                })}
                {dot("Conc", concentration ? "#9b8ac4" : "#2a2a3e")}
              </div>
            );
          }

          // Another player's turn (activeId not in my actor list, not a monster)
          const activeCombatant = allCombatants.find(c => c.id === activeId);
          if (activeCombatant) {
            const slots: { cost: "main" | "bonus" | "bond" | "reaction"; label: string }[] = [
              { cost: "main", label: "Action" }, { cost: "bonus", label: "Bonus" },
              { cost: "bond", label: "Bond" }, { cost: "reaction", label: "Reaction" },
            ];
            const actionState = actionStateByActorId[activeId];
            return (
              <div style={{ display: "flex", gap: 10, padding: "6px 14px 4px", alignItems: "center" }}>
                {slots.map(({ cost, label }) => {
                  const val = actionState?.[cost] ?? null;
                  const isUsed = val?.startsWith("__fdm_used__:");
                  const isReadied = val && !isUsed;
                  return dot(label, isUsed ? "#ff5840" : isReadied ? "#d7b36a" : "#4bb469");
                })}
                <span style={{ fontSize: 9, color: "#555", marginLeft: 2 }}>
                  ⏳ {activeCombatant.name}
                </span>
              </div>
            );
          }
        }

        // Outside combat or no active — show selected actor's dots
        if (actorToShow) {
          const actionState = actionStateByActorId[actorToShow.id];
          const concentration = getActorConcentration(actorToShow);
          const slots: { cost: "main" | "bonus" | "bond" | "reaction"; label: string }[] = [
            { cost: "main", label: "Action" }, { cost: "bonus", label: "Bonus" },
            { cost: "bond", label: "Bond" }, { cost: "reaction", label: "Reaction" },
          ];
          return (
            <div style={{ display: "flex", gap: 10, padding: "6px 14px 4px", alignItems: "center" }}>
              {slots.map(({ cost, label }) => {
                const val = actionState?.[cost] ?? null;
                const isUsed = val?.startsWith("__fdm_used__:");
                const isReadied = val && !isUsed;
                return dot(label, isUsed ? "#ff5840" : isReadied ? "#d7b36a" : "#4bb469");
              })}
              {dot("Conc", concentration ? "#9b8ac4" : "#2a2a3e")}
            </div>
          );
        }

        return null;
      })()}

      {/* ── Player monster roster — safe view from DM broadcast ── */}
      {isPlayerMode && playerMonsters.length > 0 && (
        <PlayerMonsterRoster
          monsters={playerMonsters}
          peekId={playerPeekId}
          onPeek={(id) => setPlayerPeekId(prev => prev === id ? null : id)}
        />
      )}

      {/* ── DM monster selector — full data from local roster ── */}
      {isDmMode && monsterCandidates.length > 0 && (
        <MonsterSelector
          monsters={monsterCandidates as MainEncounterMonsterInstance[]}
          activeInstanceId={activeMonsterInstanceId}
          isDmView={true}
          onSelectMonster={(instanceId) => setActiveMonsterInstanceId(instanceId)}
          onOpenMonsterCard={(instanceId) => {
            setActiveMonsterInstanceId(instanceId);
            if (!OBR.isAvailable) return; // inline card at 1492 handles non-OBR view
            void (async () => {
              try {
                const base = new URL(window.location.href);
                base.pathname = base.pathname.replace(/\/[^/]*$/, "/monster-popout.html");
                base.search = "";
                base.searchParams.set("instanceId", instanceId);
                const cardLeft = Math.max(540 + 32, Math.min(window.screen.width - 540 - 16, window.screen.width - 580));
                OBR.popover.close("fdm-monster-card").catch(() => undefined);
                await OBR.popover.open({
                  id: "fdm-monster-card",
                  url: base.toString(),
                  width: 540,
                  height: 680,
                  anchorReference: "POSITION",
                  anchorPosition: { left: cardLeft, top: 24 },
                  anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
                  transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
                  disableClickAway: false,
                  marginThreshold: 16,
                });
              } catch { /* inline card handles fallback */ }
            })();
          }}
        />
      )}


      {/* ── Combat Tracker — shows whenever there are combatants ── */}
      {allCombatants.length > 0 && (
        <CombatTracker
          combatants={allCombatants}
          activeId={roomLiveState.combat.activeActorId}
          round={roomLiveState.combat.round}
          phase={roomLiveState.combat.phase}
          isDmMode={isDmMode}
          viewerActorIds={isPlayerMode ? seatActors.map(a => a.id) : undefined}
          actionStateByActorId={isDmMode ? actionStateByActorId : undefined}
          seatColorById={seatColorById}
          monsterColor={MONSTER_COLOR}
          onStartCombat={handleStartCombat}
          onNextTurn={handleNextTurn}
          onEndCombat={handleEndCombat}
          onSelectCombatant={(id) => {
            const actor = actors.find(a => a.id === id);
            if (actor) { setSelectedActorId(id); setActiveMonsterInstanceId(""); return; }
            // Only open a monster card for a real monster instance. Clicking another
            // player's row in the shared tracker (a party actor the viewer doesn't own)
            // must not hijack the monster card.
            const isMonster = isDmMode
              ? monsterCandidates.some(m => (m as MainEncounterMonsterInstance).instanceId === id)
              : playerMonsters.some(m => m.instanceId === id);
            if (isMonster) setActiveMonsterInstanceId(id);
          }}
          onSetInitiative={handleSetCombatantInitiative}
          onSwapInitiative={(idA, idB) => {
            // Swap the initiative values of two combatants
            const initA = allCombatants.find(c => c.id === idA)?.initiative ?? null;
            const initB = allCombatants.find(c => c.id === idB)?.initiative ?? null;
            if (initA !== null) handleSetCombatantInitiative(idB, initA);
            if (initB !== null) handleSetCombatantInitiative(idA, initB);
            addEntry({
              actorName: "System", actionName: "Initiative Swap", tabId: "system",
              message: `Initiative swapped: ${allCombatants.find(c => c.id === idA)?.name} ↔ ${allCombatants.find(c => c.id === idB)?.name}`,
            });
          }}
        />
      )}

      {/* ── Inline actor card — hidden by default, only shown when OBR popover fails ── */}
      {focusedActorId && (
      <ActorCard
        actor={actorToShow}
        seatColor={seatColorById[actorToShow.id]}
        hp={hp}
        actionState={actionState}
        concentration={concentration}
        committedRoll={committedRoll}
        actorNotes={actorNotes}
        status={status}
        rulesProfile={DEFAULT_COMBAT_RULES_PROFILE}
        turnResetVersion={turnResetVersion}
        isPlayerMode={isPlayerMode}
        isActiveTurn={
          roomLiveState.combat.phase !== "combat" ||
          roomLiveState.combat.activeActorId === actorToShow.id ||
          // Companions act on their owner's turn — check ownerId from moduleData
          (actorToShow.kind === "companion" &&
            roomLiveState.combat.activeActorId ===
              (actorToShow.moduleData as { ownerId?: string } | undefined)?.ownerId)
        }
        combatRound={roomLiveState.combat.phase === "combat" ? roomLiveState.combat.round : undefined}
        diceBridgeStatus={diceBridgeStatus}
        diceBridgeLastEvent={diceBridgeLastEvent}
        onHpChange={(nextHp) => void setActorHp(actorToShow.id, nextHp)}
        onResetHp={() => void setActorHp(actorToShow.id, actorToShow.stats.hp)}
        onReadyActionCosts={(costs, readiedKey) => readyActionCosts(actorToShow.id, costs, readiedKey)}
        onUnreadyAction={(readiedKey) => unreadyActionKey(actorToShow.id, readiedKey)}
        onRemovePendingLogEntries={removePendingEntries}
        onResetTurn={handleNextTurn}
        onSetConcentration={(next) => setActorConcentration(actorToShow.id, next)}
        onClearConcentration={() => clearActorConcentration(actorToShow.id)}
        onStartCommittedRoll={(input) => {
          startCommittedRoll(actorToShow.id, input);

          // Find the action being committed
          const action = Object.values(actorToShow.tabs).flat().find(a => a.id === input.actionId);
          if (!action) return;

          // Spell with slot level → decrement matching slot resource
          if (action.actionKind === "spell" && (action.metadata?.spellLevel ?? 0) > 0) {
            consumeSpellSlot(actorToShow.id, action.metadata?.spellLevel ?? 1);
            return;
          }

          // Any action with a slotCost that references a named resource
          // e.g. Channel Divinity, Rage, Bardic Inspiration, Fury of the Gods
          const slotCost = action.metadata?.slotCost?.trim();
          if (slotCost && slotCost !== "Cantrip" && slotCost !== "No Slot" && !slotCost.startsWith("L")) {
            consumeNamedResource(actorToShow.id, slotCost);
          }
        }}
        onSetCommittedRollResult={(result) => setCommittedRollResult(actorToShow.id, result)}
        onChooseCommittedRollOutcome={(outcome) => chooseCommittedRollOutcome(actorToShow.id, outcome)}
        onChooseCommittedRollDamage={(choice) => chooseCommittedRollDamage(actorToShow.id, choice)}
        onMarkCommittedRollBridgeSent={() => markCommittedRollBridgeSent(actorToShow.id)}
        onClearCommittedRoll={() => clearCommittedRoll(actorToShow.id)}
        onSendDiceBridgeRequest={sendRollRequest}
        onSendDicePlusRequest={sendDicePlusRollRequest}
        onSendMockDiceBridgeResult={(nat, total) => void sendMockRollResult({ naturalRoll: nat, total, protocol: "fdm-dice-result", requestId: "" })}
        onAddActorNote={(text, visibility) => addActorNote(actorToShow.id, text, visibility)}
        onDeleteActorNote={(noteId) => deleteActorNote(actorToShow.id, noteId)}
        onStatusTrackerChange={(trackerId, nextTracker) => setActorTracker(actorToShow.id, trackerId, nextTracker)}
        onResetStatusTracker={(trackerId) => resetActorTracker(actorToShow, trackerId)}
        onResetAllActorStatuses={() => resetActorStatuses(actorToShow)}
        resourceCounters={counters[actorToShow.id]}
        onShortRest={() => { resetActorResources(actorToShow.id, "short"); addEntry({ actorName: actorToShow.name, actionName: "Short Rest", tabId: "system", message: `${actorToShow.name} takes a Short Rest.` }); }}
        onLongRest={() => { resetActorResources(actorToShow.id, "long"); addEntry({ actorName: actorToShow.name, actionName: "Long Rest", tabId: "system", message: `${actorToShow.name} takes a Long Rest.` }); }}
        onLog={addEntry}
      />
      )}

      {/* ── Active monster card — only shown when OBR popover is unavailable (inline fallback) ── */}
      {isDmMode && activeMonster && activeMonsterInstanceId && !OBR.isAvailable && (
        <MonsterActorCard
          monster={activeMonster}
          isDmView={isDmMode}
          onHpChange={(patch) => updateMonsterInstance(activeMonster.instanceId, patch)}
          onSendDicePlusRequest={sendDicePlusRollRequest}
          diceBridgeLastEvent={diceBridgeLastEvent}
          onActionCommit={(actionName) => {
            addEntry({
              actorName: activeMonster.displayName,
              actionName,
              tabId: "system",
              message: `${activeMonster.displayName} used ${actionName}.`,
            });
          }}
        />
      )}

      {/* ── P8: Boss kill alert ── */}
      {isDmMode && bossKillAlert && (
        <div style={{ margin: "8px 12px", padding: "10px 14px", background: "#1a0a0a", border: "1px solid #8b000088", borderRadius: 6, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#ff9999" }}>
            ⚔ {bossKillAlert.name} defeated — export encounter log?
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button"
              onClick={() => {
                const summary = generatePostCombatSummary(readEncounterLog(), bossKillAlert.encounterId, bossKillAlert.encounterName);
                downloadExport(exportSummaryAsText(summary), `fdmc-${bossKillAlert.encounterId}-${Date.now()}.txt`);
              }}
              style={{ fontSize: 11, padding: "4px 12px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
              Export Text
            </button>
            <button type="button"
              onClick={() => {
                const summary = generatePostCombatSummary(readEncounterLog(), bossKillAlert.encounterId, bossKillAlert.encounterName);
                downloadExport(exportSummaryAsJson(summary), `fdmc-${bossKillAlert.encounterId}-${Date.now()}.json`, "application/json");
              }}
              style={{ fontSize: 11, padding: "4px 12px", background: "#2a3a4e", color: "#7b68ee", border: "1px solid #7b68ee44", borderRadius: 4, cursor: "pointer" }}>
              Export JSON
            </button>
            <button type="button" onClick={() => setBossKillAlert(null)}
              style={{ fontSize: 11, padding: "4px 12px", background: "transparent", color: "#666", border: "1px solid #444", borderRadius: 4, cursor: "pointer" }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Combat log — DM sees full log; players see compact recent events ── */}
      {isDmMode
        ? <CombatLog entries={logEntries} onClear={clearEntries} />
        : <RecentEventsWidget entries={logEntries} />
      }

      {/* ── Tool panel layer ── */}
      <ToolPanelLayer
        openPanel={openPanel}
        title={getToolPanelTitle(openPanel)}
        isAllowed={isDmMode}
        onClose={closePanel}
      >
        {openPanel === "actorAssignments" && (
          <SeatAssignmentPanel
            actors={dmActors}
            seats={seats}
            seatBindings={seatBindings}
            onAssignSeat={assignSeat}
            onPushActorsToSeat={pushActorsToSeat}
            onPushActorsToAllSeats={pushActorsToAllSeats}
            onKickFromSeat={(seatId) => void kickFromSeat(seatId)}
            onRemoveSeat={removeSeat}
          />
        )}

        {openPanel === "editActors" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* Level-up approval queue */}
            {levelUpRequests.length > 0 && (
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e" }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600 }}>Pending Level-Up Requests</p>
                {levelUpRequests.map(req => (
                  <LevelUpApprovalPanel
                    key={req.actorId}
                    request={req}
                    currentActor={dmActors.find(a => a.id === req.actorId)}
                    onApprove={handleLevelUpApprove}
                    onReject={handleLevelUpReject}
                  />
                ))}
              </div>
            )}

            {/* Actor editor / actor list */}
            {editingActorId === "__new__" ? (
              <ActorEditor
                mode="create-new"
                onSave={handleActorEditorSave}
                onCancel={() => setEditingActorId(null)}
              />
            ) : editingActorId ? (
              (() => {
                const actor = dmActors.find(a => a.id === editingActorId);
                if (!actor) return <p style={{ padding: 14 }}>Actor not found.</p>;
                return (
                  <ActorEditor
                    actor={actor}
                    mode="edit-current"
                    onSave={handleActorEditorSave}
                    onCancel={() => setEditingActorId(null)}
                  />
                );
              })()
            ) : (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                    {dmActors.length === 0 ? "No actors yet — create your first actor." : `${dmActors.length} actor${dmActors.length === 1 ? "" : "s"}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingActorId("__new__")}
                    style={{ fontSize: 12, padding: "4px 12px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}
                  >
                    + Create New Actor
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
                  {dmActors.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#555", textAlign: "center", marginTop: 40 }}>
                      Build your party from scratch using the editor.
                    </p>
                  ) : (
                    dmActors.map(actor => (
                      <div key={actor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#161622", borderRadius: 6, marginBottom: 6, border: "1px solid #2a2a3e" }}>
                        <div>
                          <span style={{ fontWeight: 500 }}>{actor.name || "Unnamed"}</span>
                          <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>Level {actor.level}{actor.className ? ` · ${actor.className}` : ""}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingActorId(actor.id)}
                          style={{ fontSize: 12, padding: "3px 10px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 4, color: "#7b68ee", cursor: "pointer" }}
                        >
                          Edit
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {openPanel === "monsterPanel" && (
          <EncounterLibraryPanel
            monsterLibrary={BROKEN_CHAIN_MONSTER_LIBRARY}
            activeRosterCount={monsterCandidates.length}
            onLoadEncounter={(instances) => {
              addMonsterInstances(instances);
              closePanel();
            }}
            onClearRoster={() => {
              setMonsterCandidates([]);
              setActiveMonsterInstanceId("");
              resetAllTurns();
              addEntry({ actorName: "System", actionName: "Roster Cleared", tabId: "system", message: "Combat roster cleared from encounter library." });
            }}
          />
        )}

        {openPanel === "encounterCleanup" && (
          <EncounterCleanupPanel
            activeMonsterCount={monsterCandidates.length}
            combatantCount={actors.length}
            persistentEquipmentCount={0}
            onCleanup={async () => {
              // Wipe local state
              setMonsterCandidates([]);
              setActiveMonsterInstanceId("");
              clearMonsterRoster();
              resetAllTurns();
              // Read FRESH from OBR so seat bindings from the live state survive the wipe
              // (React local roomLiveState may be stale if bindings were written by dm-panel recently)
              const freshState = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
              const base = freshState ?? roomLiveState;
              const wiped = {
                ...base,
                revision: base.revision + 1,
                updatedAt: Date.now(),
                monsterLiveState: {},
                combat: { phase: "setup" as const, activeActorId: null, round: 1 },
                recentEvents: { slots: [], nextSlot: 1 },
              };
              void commitRoomState(wiped);
              // Broadcast empty roster to clear player monster view
              broadcastMonsterRoster([]);
              // Broadcast so player cards reset action economy toggles
              if (OBR.isAvailable) {
                void obrSend(
                  "fdmc:action-economy-reset",
                  { type: "fdmc:action-economy-reset" },
                  { destination: "REMOTE" }
                ).catch(() => undefined);
              }
              const msg = "Encounter wiped. Monsters cleared, combat reset. Seats and actor HP preserved.";
              addEntry({ actorName: "System", actionName: "Encounter Cleanup", tabId: "system", message: msg });
              closePanel();
              return msg;
            }}
          />
        )}

        {openPanel === "roomMaintenance" && (
          <FdmcRoomMaintenancePanel
            onScan={scanFdmcRoomMetadata}
            onPurge={purgeLegacyFdmcMetadata}
            onReinitialize={async () => ({
              ok: true,
              checks: {
                tableBindingExists: Boolean(tableBinding),
                sharedTableStateExists: false,
                actorsByIdEmpty: true,
                actorsOrderEmpty: true,
                combatPhaseSetup: true,
                revisionIsOne: true,
              },
              tableBinding: tableBinding ?? undefined,
              message: "Room live state is the canonical state.",
            })}
            onActorSnapshot={async () => ({
              ok: true,
              mode: "empty" as const,
              actorCount: 0,
              bytes: 0,
              message: "Snapshot split-button implementation in P3.",
            })}
            onPurgeSeatMetadata={purgeAllSeatMetadata}
          />
        )}
      </ToolPanelLayer>

      {/* ── Actor pop-out overlay — CSS popout within same React tree ── */}
      {(() => {
        if (!focusedActorId) return null;
        const focusedActor = actors.find(a => a.id === focusedActorId);
        if (!focusedActor) return null;
        const focusedHp = getActorHp(focusedActorId);
        const focusedActionState = getActionState(focusedActor);
        const focusedConcentration = getActorConcentration(focusedActor);
        const focusedCommittedRoll = getCommittedRoll(focusedActor);
        const focusedNotes = getActorNotes(focusedActor);
        const focusedStatus = getActorStatus(focusedActor);
        return (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#0d0d14" }}
          >
            {/* Close bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #2a2a3e", background: "#0d0d14" }}>
              <span style={{ fontSize: 11, color: "#888" }}>Focused Card — {focusedActor.name}</span>
              <button
                type="button"
                onClick={() => setFocusedActorId(null)}
                style={{ fontSize: 12, padding: "2px 10px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              <ActorCard
                actor={focusedActor}
                seatColor={seatColorById[focusedActor.id]}
                hp={focusedHp}
                actionState={focusedActionState}
                concentration={focusedConcentration}
                committedRoll={focusedCommittedRoll}
                actorNotes={focusedNotes}
                status={focusedStatus}
                rulesProfile={DEFAULT_COMBAT_RULES_PROFILE}
                turnResetVersion={turnResetVersion}
                isPlayerMode={isPlayerMode}
                isActiveTurn={
                  roomLiveState.combat.phase !== "combat" ||
                  roomLiveState.combat.activeActorId === focusedActorId ||
                  // Companions act on their owner's turn
                  (focusedActor.kind === "companion" &&
                    roomLiveState.combat.activeActorId ===
                      (focusedActor.moduleData as { ownerId?: string } | undefined)?.ownerId)
                }
                combatRound={roomLiveState.combat.phase === "combat" ? roomLiveState.combat.round : undefined}
                diceBridgeStatus={diceBridgeStatus}
                diceBridgeLastEvent={diceBridgeLastEvent}
                onHpChange={(nextHp) => void setActorHp(focusedActorId, nextHp)}
                onResetHp={() => void setActorHp(focusedActorId, focusedActor.stats.hp)}
                onReadyActionCosts={(costs, readiedKey) => readyActionCosts(focusedActorId, costs, readiedKey)}
                onUnreadyAction={(readiedKey) => unreadyActionKey(focusedActorId, readiedKey)}
                onRemovePendingLogEntries={removePendingEntries}
                onResetTurn={() => { resetActorTurn(focusedActorId); setTurnResetVersion(v => v + 1); }}
                onSetConcentration={(next) => setActorConcentration(focusedActorId, next)}
                onClearConcentration={() => clearActorConcentration(focusedActorId)}
                onStartCommittedRoll={(input) => startCommittedRoll(focusedActorId, input)}
                onSetCommittedRollResult={(result) => setCommittedRollResult(focusedActorId, result)}
                onChooseCommittedRollOutcome={(outcome) => chooseCommittedRollOutcome(focusedActorId, outcome)}
                onChooseCommittedRollDamage={(choice) => chooseCommittedRollDamage(focusedActorId, choice)}
                onMarkCommittedRollBridgeSent={() => markCommittedRollBridgeSent(focusedActorId)}
                onClearCommittedRoll={() => clearCommittedRoll(focusedActorId)}
                onSendDiceBridgeRequest={sendRollRequest}
                onSendDicePlusRequest={sendDicePlusRollRequest}
                onSendMockDiceBridgeResult={(nat, total) => void sendMockRollResult({ naturalRoll: nat, total, protocol: "fdm-dice-result", requestId: "" })}
                onAddActorNote={(text, visibility) => addActorNote(focusedActorId, text, visibility)}
                onDeleteActorNote={(noteId) => deleteActorNote(focusedActorId, noteId)}
                onStatusTrackerChange={(trackerId, nextTracker) => setActorTracker(focusedActorId, trackerId, nextTracker)}
                onResetStatusTracker={(trackerId) => resetActorTracker(focusedActor, trackerId)}
                onResetAllActorStatuses={() => resetActorStatuses(focusedActor)}
                resourceCounters={counters[focusedActorId]}
                onShortRest={() => { resetActorResources(focusedActorId, "short"); addEntry({ actorName: focusedActor.name, actionName: "Short Rest", tabId: "system", message: `${focusedActor.name} takes a Short Rest.` }); }}
                onLongRest={() => { resetActorResources(focusedActorId, "long"); addEntry({ actorName: focusedActor.name, actionName: "Long Rest", tabId: "system", message: `${focusedActor.name} takes a Long Rest.` }); }}
                onLog={addEntry}
              />
            </div>
          </div>
        );
      })()}

    </main>
  );
}
