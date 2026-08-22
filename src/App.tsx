import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import appManifest from "../public/manifest.json";
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
  /** Threat tier — drives the heavy HP bar in the players' tracker so a boss reads as a
   *  boss across the table. REVEAL-GATED: only populated once the name is revealed, or
   *  the bar would telegraph "this is the boss" while it is still an unknown shape. */
  classification?: MonsterClassification;
};
import type { MonsterClassification } from "./core/monsters/runtime/mainMonsterRuntime";
import OBR from "@owlbear-rodeo/sdk";
import { CombatLog } from "./core/combat-log/CombatLog";
import { RecentEventsWidget } from "./core/combat-log/RecentEventsWidget";
import { CombatTracker, buildCombatants, sortCombatants, isOutOfCombat, type Combatant } from "./core/ui/CombatTracker";
import { ReadmeOverlay } from "./core/ui/ReadmeOverlay";
import { CriticalFailureReference } from "./core/ui/CriticalFailureReference";
import { playerSafeTier } from "./core/ui/ThreatHpBar";
// getActorCopper is deliberately NOT imported here — useActorLiveState already exposes one
// bound to the live room copy, and two functions of the same name with different arities is
// how you get a silent shadowing bug.
import { patchCombat, patchActorHp, patchActorInitiative, patchActorTracker, walletsFromRoomState, getPartyCoins, patchPartyCoins, transferPartyToActor } from "./core/table-state/fdmcRoomLiveState";
import { isActorStateRequest } from "./core/state/actorStateRequests";
import { addToConvergenceInbox, loadConvergenceInbox } from "./core/state/convergenceInbox";
import { isConvergenceRequest } from "./core/ui/EquipmentLibraryStandalone";
import { EncounterCleanupPanel } from "./core/campaign/EncounterCleanupPanel";
import { FdmcRoomMaintenancePanel } from "./core/campaign/FdmcRoomMaintenancePanel";
import { useCombatLog } from "./core/combat-log/useCombatLog";
import { useActionEconomyState } from "./core/state/useActionEconomyState";
import { useActorConcentrationState } from "./core/state/useActorConcentrationState";
import { useCommittedRollState } from "./core/state/useCommittedRollState";
import { useActorLiveState } from "./core/state/useActorLiveState";
import { parsePriceCopper, coinsToCopper, formatCopperPrice, formatCoins } from "./core/currency/currency";
import { useActorNotesState } from "./core/state/useActorNotesState";
import { useActorStatusState } from "./core/state/useActorStatusState";
import { useResourceCounterState } from "./core/state/useResourceCounterState";
import { consumeActionResourcesOnCommit } from "./core/state/consumeActionResources";
import { offHandBlocker } from "./core/constants/chassis";
import { initiativeRollFormula, getActorInitiativeModifier } from "./core/state/initiative";
import { useOwlbearDiceBridge } from "./core/integrations/useOwlbearDiceBridge";
import { ToolPanelLayer } from "./core/runtime-shell/ToolPanelLayer";
import { getToolPanelTitle, type ToolPanelId } from "./core/runtime-shell/toolPanelTypes";
import { ActorCard, FDMC_COMBAT_END_CHANNEL } from "./core/ui/ActorCard";
import { SavePromptBanner } from "./core/ui/SavePromptBanner";
import { broadcastSavePrompt } from "./core/state/savePrompt";
import { ActorSelector } from "./core/ui/ActorSelector";
import { MonsterActorCard, MONSTER_ECONOMY_CHANNEL, type MonsterEconomyBroadcast } from "./core/ui/MonsterActorCard";
import { readTokenBinding } from "./core/tokens/tokenBinding";
// Token context menu is registered by the background page (src/background.ts), not here.
import { isObrReady, obrSend } from "./core/utils/obrReady";
import { loadEquipmentLibrary, itemToAction, seedCampaignEquipmentLibrary, seedBaseWeapons, repairEquipmentLibraries, SLOT_CAPACITY, type EquipmentSlot } from "./core/ui/EquipmentBagEditor";
import { claimFromOpenOffer, broadcastOfferState, LOOT_PASS_ID } from "./core/ui/openLootOffer";
import { FDMC_ACCENTS } from "./core/constants/theme";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS } from "./data/broken-chain/equipmentLibrary";
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
  clearActorOverride,
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
  subscribeFdmcRoomStateKey,
} from "./core/table-state/roomStateBridge";
import {
  deregisterMonsterInstance,
  patchMonsterInitiative,
  patchMonsterHp,
  pushRecentEvent,
  removeActorFromRoomState,
  normalizeFdmcRoomLiveState,
  type FdmcRoomLiveState,
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
import { fullHeal } from "./core/types/actor";
import { wipePartyLocalData, buildClearedActorLiveState } from "./core/seats/wipePartyData";
import { takeSnapshot, mirrorWallets } from "./core/state/autoBackup";
import { brokenChainActors } from "./modules/the-broken-chain/actors/index";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "./data/broken-chain/monsterLibrary";
import { appendLogEntry, clearEncounterLog, makeLogId, makeActionCode, readEncounterLog } from "./core/events/encounterLog";
import { generatePostCombatSummary, exportSummaryAsText, exportFilename, downloadExport } from "./core/export/encounterLogExport";

// ─── Constants ────────────────────────────────────────────────────────────────

// Single source of truth: the OBR manifest version. Bump public/manifest.json and
// this label + the OBR extension version move together (no more stale-version drift).
const APP_VERSION = `FDMC v${appManifest.version}`;
const DM_LIBRARY_UPDATED_CHANNEL = FDMC_CHANNELS.dmLibraryUpdated;

/** Parse a gold cost from an item's free-text value ("25 gp", "1,200 gp", "5"). 0 if none. */
function parseGoldCost(value?: string): number {
  if (!value) return 0;
  const match = value.replace(/,/g, "").match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

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

/**
 * Every mutating handler ActorCard requires, wired to nothing.
 *
 * This is what makes the "view as" preview read-only, and it is deliberately a single
 * object rather than two dozen inline lambdas: the guarantee is "this card cannot write",
 * and that is only checkable at a glance if the no-ops live in one place. Adding a new
 * required handler to ActorCard will fail the build here until it is listed, which is the
 * point — a new write path must be consciously silenced, not silently inherited.
 */
const READ_ONLY_CARD_HANDLERS = {
  onHpChange: () => undefined,
  onResetHp: () => undefined,
  onReadyActionCosts: () => undefined,
  onUnreadyAction: () => undefined,
  onRemovePendingLogEntries: () => undefined,
  onResetTurn: () => undefined,
  onSetConcentration: () => undefined,
  onClearConcentration: () => undefined,
  onStartCommittedRoll: () => undefined,
  onSetCommittedRollResult: () => undefined,
  onChooseCommittedRollOutcome: () => undefined,
  onChooseCommittedRollDamage: () => undefined,
  onClearCommittedRoll: () => undefined,
  onMarkCommittedRollBridgeSent: () => undefined,
  // Signature returns a promise — a preview never sends, so it resolves "not sent".
  onSendDiceBridgeRequest: async () => false,
  onSendDicePlusRequest: async () => false,
  onSendMockDiceBridgeResult: () => undefined,
  onAddActorNote: () => null,
  onDeleteActorNote: () => undefined,
  onStatusTrackerChange: () => undefined,
  onResetStatusTracker: () => undefined,
  onResetAllActorStatuses: () => undefined,
  onLog: () => undefined,
} as const;
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
  // Co-DM: true when the viewer's claimed seat is flagged "co-dm". Read independently
  // from the main live-state hook (which is created later) so the role resolves early.
  const [isCoDmSeat, setIsCoDmSeat] = useState(false);

  useEffect(() => {
    if (!OBR.isAvailable) {
      setIdLoaded(true); // outside Owlbear — no viewer ID available
      return;
    }
    void OBR.player.getId()
      .then(id => { setViewerId(id); setIdLoaded(true); })
      .catch(() => setIdLoaded(true));
  }, []);

  // Watch the room seats/bindings; flip co-dm on when this viewer's seat is "co-dm".
  useEffect(() => {
    if (!OBR.isAvailable) return;
    let cancelled = false;
    let key: string | null = null;
    const check = (state: FdmcRoomLiveState | undefined) => {
      if (cancelled || !state || !key) return;
      const binding = Object.values(state.seatBindings).find(b => b.viewerSeatKey === key);
      const seat = binding ? state.seats[binding.seatId] : undefined;
      setIsCoDmSeat(seat?.seatMode === "co-dm");
    };
    void OBR.player.getId().then(id => {
      if (cancelled) return;
      key = hashViewerId(id);
      void readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState).then(check);
    });
    const unsub = subscribeFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState, check);
    return () => { cancelled = true; unsub(); };
  }, []);

  // Still loading viewer ID — return loading state
  if (!idLoaded) return "loading" as const;
  // Real GM ALWAYS wins first — a Co-DM seat change can never lock the GM out.
  if (tableBinding && tableBinding.gmControllerId === viewerId) return "dm" as const;
  // Co-DM seat → DM-level access (editing tools).
  if (isCoDmSeat) return "dm" as const;
  // No table binding — DM needs to claim
  if (!tableBinding) return "unknown" as const;
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
  // Connected Owlbear players — so a seat can adopt a player's own OBR color and the
  // map identity and the app identity agree. Empty (and harmless) outside OBR.
  const [obrPlayers, setObrPlayers] = useState<Array<{ id: string; name: string; color: string; role?: string }>>([]);
  useEffect(() => {
    if (!OBR.isAvailable) return;
    let active = true;
    const apply = (list: Array<{ id: string; name: string; color: string; role?: string }>) => { if (active) setObrPlayers(list); };
    let unsub: (() => void) | undefined;
    OBR.onReady(() => {
      void OBR.party.getPlayers().then(apply).catch(() => undefined);
      unsub = OBR.party.onChange(apply);
    });
    return () => { active = false; unsub?.(); };
  }, []);

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

  // ── DM: apply AUTO-APPROVED seat requests (combat state) ──────────────────
  // The GM is the single writer to room metadata. A seat asks; the GM applies it to ITS
  // OWN current state and writes. That keeps the GM's local copy authoritative — it can
  // never fall behind a player's write, because players no longer write — and it stops
  // two seats writing at once. Auto-approved means no click: combat must not stall.
  // Card-fundamental changes (creating equipment, level up) still queue for approval.
  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data as unknown;

      /**
       * CONVERGENCE REQUESTS ARE CAUGHT HERE, IN THE MAIN WINDOW — before the actor-state
       * guard below, which returns early for anything it does not recognise.
       *
       * They used to be heard only by the DM panel and the Library popover. A broadcast is
       * ephemeral, so a player submitting while neither window happened to be open sent their
       * items into nothing, and opening the Library afterwards showed an empty list because
       * there was nothing left to hear. This window is always open, so it is the only place
       * that can promise to catch one.
       *
       * Recorded to the shared inbox rather than to component state, so it outlives this
       * window and any DM surface can read it whenever it opens.
       */
      if (isConvergenceRequest(msg)) {
        setConvergencePending(addToConvergenceInbox(msg).length);
        const seatLabel = roomLiveStateRef.current.seats[msg.seatId]?.label ?? msg.seatId;
        addEntry({
          actorName: msg.actorName ?? seatLabel,
          actionName: "Convergence Request",
          tabId: "system",
          message: `◈ ${msg.actorName ?? seatLabel} submitted ${msg.submittedItemIds.length} item(s) to the forge — open Library to review.`,
        });
        return;
      }

      if (!isActorStateRequest(msg)) return;

      // A REST runs on the GM's copy so the master card is what refills: resource pools
      // for the rest ACTUALLY taken (short restores only short-rest pools + any
      // shortRestRegain partials; long restores everything), recharge abilities, and HP
      // on a long rest.
      if (msg.type === "fdmc:request-actor-rest") {
        const actor = dmActors.find(a => a.id === msg.actorId);
        resetActorResources(msg.actorId, msg.restType);
        if (msg.restType === "long" && actor) {
          const max = actor.stats.hp.max;
          void commitRoomState(patchActorHp(roomLiveStateRef.current, msg.actorId, { current: max, max, temp: 0 }));
        }
        addEntry({
          actorName: actor?.name ?? "Party character",
          actionName: msg.restType === "long" ? "Long Rest" : "Short Rest",
          tabId: "system",
          message: msg.restType === "long"
            ? `${actor?.name ?? "Character"} takes a Long Rest — HP restored to full and all resources reset.`
            : `${actor?.name ?? "Character"} takes a Short Rest — short-rest resources and recharges restored.`,
        });
        return;
      }

      // GEAR. Same tier as HP: applied the moment it arrives, with no card open anywhere and
      // nothing for the GM to click. A seat runs the card it was lent.
      if (msg.type === "fdmc:request-actor-equip") {
        performEquipToggle(msg.actorId, msg.actionId);
        return;
      }
      if (msg.type === "fdmc:request-actor-grip") {
        performGripChange(msg.actorId, msg.actionId, msg.grip);
        return;
      }

      // Party purse. Applied against the balance AT THIS MOMENT, which is the whole reason a
      // shared pot can be spendable by anyone: two seats can both see 50 gp and both ask for
      // 40, and the second one is refused here rather than overdrawing the party.
      if (msg.type === "fdmc:request-party-transfer") {
        const actor = dmActors.find(a => a.id === msg.actorId);
        const moved = transferPartyToActor(roomLiveStateRef.current, msg.actorId, msg.copper);
        const took = msg.copper > 0;
        if (!moved) {
          addEntry({
            actorName: actor?.name ?? "Party character",
            actionName: "Party Purse",
            tabId: "system",
            message: took
              ? `${actor?.name ?? "Character"} tried to take ${formatCopperPrice(msg.copper)} from the party purse — not enough left.`
              : `${actor?.name ?? "Character"} tried to put in ${formatCopperPrice(-msg.copper)} — they do not have it.`,
          });
          return;
        }
        void commitRoomState(moved);
        addEntry({
          actorName: actor?.name ?? "Party character",
          actionName: "Party Purse",
          tabId: "system",
          message: took
            ? `${actor?.name ?? "Character"} took ${formatCopperPrice(msg.copper)} from the party purse.`
            : `${actor?.name ?? "Character"} put ${formatCopperPrice(-msg.copper)} into the party purse.`,
        });
        return;
      }

      // roomLiveStateRef is the GM's live copy, so concurrent requests each build on the
      // result of the last rather than on a stale render closure.
      const base = roomLiveStateRef.current;
      const next =
        msg.type === "fdmc:request-actor-hp" ? patchActorHp(base, msg.actorId, msg.hp)
        : msg.type === "fdmc:request-actor-initiative" ? patchActorInitiative(base, msg.actorId, msg.initiative)
        : patchActorTracker(base, msg.actorId, msg.trackerId, msg.current);
      void commitRoomState(next);
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
      const freshLib = { ...actorLibrary };
      delete freshLib[realId];
      saveActorLibrary(freshLib);
      setActorLibrary(freshLib);

      // Drop the actor's override too — otherwise a same-id actor re-imported later
      // silently inherits the dead delta.
      clearActorOverride(realId);
      const freshOverrides = loadActorOverrides();
      setActorOverrides(freshOverrides);

      // Scrub the actor out of room metadata (live state, seat membership, bindings,
      // active pointer) so a viewer joining no longer sees the removed character, then
      // re-push the corrected roster to every connected seat. The party-tracker and
      // viewer-party broadcasts refire automatically when actorLibrary changes.
      void commitRoomState(removeActorFromRoomState(roomLiveState, realId));
      pushActorsToAllSeats({ freshLibrary: freshLib, freshOverrides });

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
    // Persist the approved actor to the BASE library too (not just a session override) —
    // otherwise the level-up reverts on the next Sync/reload and "doesn't push through".
    // Mirrors the dm-panel approval handler + handleActorEditorSave.
    upsertActorInLibrary(finalActor);
    setActorLibrary(lib => { const next = { ...lib, [request.actorId]: finalActor }; saveActorLibrary(next); return next; });

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
      // Notify the dm-panel window (and any Co-DM card view) to reload library +
      // overrides from localStorage so they don't keep showing the pre-level-up actor.
      void obrSend(DM_LIBRARY_UPDATED_CHANNEL, { type: "library-updated" }, { destination: "REMOTE" });
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
  // P-UX4 Phase 8 — clickable quick-guide / onboarding overlay
  const [showReadme, setShowReadme] = useState(false);
  const [showCritFailTables, setShowCritFailTables] = useState(false);

  // ── Level-up approval queue (DM side) ────────────────────────────────────
  const [levelUpRequests, setLevelUpRequests] = useState<LevelUpRequest[]>([]);

  // Seed the campaign equipment library here too (not only in the DM panel) so the
  // actor editor's "From Library" has Broken Chain gear to attach even when DM tools
  // were never opened in this browser. Idempotent — guarded by the seed-version key.
  // The repair runs BEFORE the seeders: it drops rows a previous build left behind, and seeding
  // on top of them would just re-resolve to the stale copies.
  useMemo(() => { repairEquipmentLibraries(); seedCampaignEquipmentLibrary(BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS); seedBaseWeapons(); }, []);

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
    setActorCoins,
    spendActorCopper,
    getActorCopper,
    getRoomStateBytes,
    commitRoomState,
    refreshFromRoom,
  } = useActorLiveState(bundledActors);

  // Keep a local copy of every purse.
  //
  // Coin lives ONLY in room metadata — actors, gear and spells are all in localStorage, so a
  // lost room hands back a party whose ids match and whose actions work, with every wallet at
  // zero and nothing local to restore from. The mirror writes only when a wallet actually
  // changes, and never overwrites a good copy with an empty one.
  useEffect(() => {
    if (!isDmMode) return;
    mirrorWallets(walletsFromRoomState(roomLiveState));
  }, [isDmMode, roomLiveState]);

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
    mergeIntoCommittedRoll,
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
    consumeItemCharge,
    restoreItemCharge,
    resetEncounterCharges,
    spendResource,
    resetActorResources,
  } = useResourceCounterState(isDmMode ? dmActors : playerActors);

  // Spend a variable amount from a pool (Lay on Hands etc.) and log it. Healing is
  // applied at the table verbally — we only deduct the points here.
  function handleSpendResource(actorId: string, actorName: string, resourceActionId: string, amount: number) {
    const r = spendResource(actorId, resourceActionId, amount);
    if (r.outcome === "spent") {
      addEntry({ actorName, actionName: r.label ?? "Resource", tabId: "resources", message: `${actorName} spends ${amount} from ${r.label ?? "pool"} (${r.remaining}/${r.max ?? "?"} left).` });
    } else {
      addEntry({ actorName, actionName: r.label ?? "Resource", tabId: "resources", message: `⚠ ${actorName} has nothing left in ${r.label ?? "that pool"}.` });
    }
  }

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
        // Reveal-gated in one place so no call site can leak the tier early.
        classification: playerSafeTier(m.classification, Boolean(m.isNameRevealed)),
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
      const msg = event.data as { type?: string; offerId?: string; chosenItemId?: string; actorId?: string; seatId?: string; cost?: number } | undefined;
      if (msg?.type !== "fdmc:loot-choice" || !msg.chosenItemId || !msg.actorId) return;

      // Find the actor and add the item to their equipment tab
      const actor = dmActors.find(a => a.id === msg.actorId);
      if (!actor) return;

      // Find the item from all libraries — the library is the CATALOGUE (stats/price), never
      // the stock. A player with nothing to buy passes instead, which spends no item but
      // still hands the turn on so one AFK seat can't stall the round.
      const allItems = [...loadEquipmentLibrary("campaign"), ...loadEquipmentLibrary("dm")];
      const isPass = msg.chosenItemId === LOOT_PASS_ID;
      const item = isPass ? undefined : allItems.find(i => i.id === msg.chosenItemId);
      if (!isPass && !item) return;
      const itemLabel = item?.name ?? "that";

      // Price is settled BEFORE the item leaves the pool. Claiming first and then failing the
      // affordability check would burn the only copy on a purchase that never completed.
      const costCopper = item
        ? parsePriceCopper(item.value) || (typeof msg.cost === "number" && msg.cost > 0 ? Math.floor(msg.cost) * 100 : 0)
        : 0;
      const balanceCopper = costCopper > 0 ? getActorCopper(actor.id) : 0;
      if (costCopper > 0 && balanceCopper < costCopper) {
        void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
          type: "fdmc:purchase-denied",
          seatId: msg.seatId,
          itemName: itemLabel,
          reason: `Not enough coin — ${itemLabel} costs ${formatCopperPrice(costCopper)}, you have ${formatCopperPrice(balanceCopper)}.`,
        }, { destination: "REMOTE" });
        return;
      }

      // STOCK COMES FROM THE SENT POOL, NOT THE LIBRARY. The first claim to arrive wins; a
      // second claim for the same item is refused. Send a pool of one and exactly one player
      // can have it.
      const claim = claimFromOpenOffer(msg.offerId, msg.seatId, msg.chosenItemId,
        { actorName: actor.name, itemName: item?.name, costCopper });
      if (claim.outcome === "gone") {
        void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
          type: "fdmc:purchase-denied",
          seatId: msg.seatId,
          itemName: itemLabel,
          reason: `${itemLabel} is gone — it was already taken.`,
        }, { destination: "REMOTE" });
        return;
      }
      if (claim.outcome === "already-picked") {
        void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
          type: "fdmc:purchase-denied",
          seatId: msg.seatId,
          itemName: itemLabel,
          reason: claim.took
            ? `You already took ${claim.took} from this drop — loot is one pick each.`
            : "You've already had your pick from this drop.",
        }, { destination: "REMOTE" });
        return;
      }
      if (claim.outcome === "not-your-turn") {
        void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
          type: "fdmc:purchase-denied",
          seatId: msg.seatId,
          itemName: itemLabel,
          reason: `It's ${claim.waitingOn.label}'s pick right now — hold on.`,
        }, { destination: "REMOTE" });
        return;
      }
      // Item is spent. Tell every recipient what's left and whose turn it is now, so a taken
      // item drops off their list rather than sitting there as a choice that will be refused.
      void broadcastOfferState(claim.offer, claim.done, allItems);

      // Paid for out of the wallet (auto-converts across coins + makes change).
      let walletLeftLabel = "";
      if (costCopper > 0) {
        void spendActorCopper(actor.id, costCopper);
        walletLeftLabel = formatCopperPrice(balanceCopper - costCopper);
      }

      // A pass takes nothing — the turn has already moved on, so there's no sheet to update.
      if (!item) {
        const shopping = claim.offer.mode === "merchant";
        addEntry({ actorName: actor.name, actionName: shopping ? "Done Shopping" : "Passed", tabId: "system",
          message: shopping ? `${actor.name} finished at the merchant.` : `${actor.name} passed on the loot.` });
        return;
      }

      // Build the equipment action and add it
      // Arrives in the bag, not already worn — the same rule as a hand-off from another
      // player. Granted loot that equipped itself would apply its AC and stat effects
      // unasked, and an attuned one would claim a slot the player never agreed to spend.
      const equipAction = itemToAction(item, false);

      const updatedActor = {
        ...actor,
        tabs: { ...actor.tabs, equipment: [...(actor.tabs.equipment ?? []), equipAction] },
      };

      // Save and broadcast — pass freshLibrary so push doesn't use stale ref
      const freshLib = { ...dmActors.reduce((m, a) => ({ ...m, [a.id]: a }), {} as Record<string, typeof actor>), [updatedActor.id]: updatedActor };
      upsertActorInLibrary(updatedActor);
      setActorLibrary(lib => ({ ...lib, [updatedActor.id]: updatedActor }));

      /**
       * WRITE THE LAYER THAT WINS, OR THE ITEM IS INVISIBLE.
       *
       * A resolved actor is base + override, and tab merging replaces a tab WHOLESALE rather
       * than appending (`{ ...baseTabs, ...overrideTabs }`, dmActorLibrary.ts). So an override
       * carrying tabs.equipment shadows the base array entirely. Writing a purchase to the
       * base alone therefore succeeded and then vanished on the next resolve: coin spent
       * (wallets live in room state, a different store), item stored, nothing visible on any
       * surface — which is why this read as "it voided" rather than as a delivery failure.
       *
       * Every character in the live library carries such an override, so every purchase hit
       * this. The shadowing itself is CORRECT and load-bearing: removing an item writes the
       * override without the item while the base keeps its stale copy, and the override is
       * what makes the removal stick. The bug was never the masking — it was writing a new
       * item to the layer that loses.
       *
       * `updatedActor` is the RESOLVED actor plus the new item, so its equipment is the array
       * the player should see. Writing it into the override makes the winning layer agree with
       * the base rather than contradict it. Only touched when an override already exists:
       * creating one here would bake resolved state into a layer that did not want it.
       */
      const existingOverride = actorOverrides[updatedActor.id];
      if (existingOverride?.tabs?.equipment) {
        const nextOverride: typeof existingOverride = {
          ...existingOverride,
          tabs: { ...existingOverride.tabs, equipment: updatedActor.tabs.equipment },
        };
        saveActorOverride(updatedActor.id, nextOverride);
        setActorOverrides(prev => ({ ...prev, [updatedActor.id]: nextOverride }));
      }

      /**
       * THE PUSH IS WHAT THE PLAYER ACTUALLY SEES.
       *
       * Everything above lands on the DM's copy. The coin does not need this — wallets live in
       * room live state, which every seat reads directly — but the ITEM only reaches the
       * player's sheet when their seat is pushed. So a purchase with no resolvable seat took
       * the money, updated the DM's library, told the player "attached", and left their card
       * unchanged: the exact shape of "the money worked but the item never arrived".
       *
       * A seat that cannot be pushed is now said out loud, on both sides. The item is NOT lost
       * — it is on the DM's copy of the character and appears the moment that seat is pushed
       * again — but nobody should have to guess that.
       */
      const seatId = msg.seatId ?? "";
      const seatIsPushable = Boolean(seatId) && Boolean(roomLiveStateRef.current.seats[seatId]);
      if (seatIsPushable) {
        pushActorsToSeat(seatId, { freshLibrary: freshLib });
      } else {
        addEntry({
          actorName: actor.name, actionName: "Loot Delivery", tabId: "system",
          message: `⚠ ${item.name} was added to ${actor.name} on your copy, but ${seatId ? `seat "${seatId}" is not in this room` : "the request carried no seat"} — so their card was not refreshed. Re-push that seat from Seats & Tokens.`,
        });
        void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
          type: "fdmc:purchase-denied",
          seatId,
          itemName: item.name,
          reason: `${item.name} was recorded, but your sheet could not be refreshed — ask the DM to re-push your seat.`,
        }, { destination: "REMOTE" });
      }

      // Notify player their item was attached
      void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:loot-attached",
        seatId: msg.seatId,
        itemName: item.name,
      }, { destination: "REMOTE" });

      addEntry({
        actorName: actor.name,
        actionName: costCopper > 0 ? "Item Purchased" : "Item Equipped",
        tabId: "system",
        message: costCopper > 0
          ? `${actor.name} bought ${item.name} for ${formatCopperPrice(costCopper)} (${walletLeftLabel} left).`
          : `${actor.name} received ${item.name}.`,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDmMode, dmActors]);

  // ── DM: player hands an item to another player → move it, push both sheets ──
  //
  // The DM owns the actor library, so a peer-to-peer trade still routes through here: the
  // player's card only ASKS. That also makes the move atomic — the item can never exist on
  // both sheets or neither, which a two-sided client swap could produce if one push failed.
  //
  // The whole ActorAction moves, not a fresh copy built from the library, so a renamed or
  // DM-tweaked item arrives as the receiver's own, and its charges travel with it.
  //
  // ONE implementation, two entry points: a remote player's request arrives on the channel
  // below, and the DM's own click calls this directly. Routing the DM through a self-
  // addressed broadcast would depend on the SDK looping LOCAL messages back to the sender's
  // own handler — and if it doesn't, the DM's clicks silently do nothing.
  function performItemTransfer(fromActorId: string, toActorId: string, actionId: string, notifySeatId?: string) {
    if (fromActorId === toActorId) return;
    const from = dmActors.find(a => a.id === fromActorId);
    const to = dmActors.find(a => a.id === toActorId);
    if (!from || !to) return;

    // Authoritative check: the sender must actually be holding it. Without this a stale card
    // could hand over an item it gave away a moment ago, duplicating it.
    const moving = (from.tabs.equipment ?? []).find(a => a.id === actionId);
    if (!moving) return;

    // TRADE IS HARD LOCKED IN COMBAT. Not "costs an action" — not available at all. Handing
    // gear around mid-fight is the move that turns one good item into everyone's item.
    if (roomLiveState.combat.phase === "combat") {
      addEntry({
        actorName: from.name, actionName: "Trade Locked", tabId: "system",
        message: `⚠ No trading in combat — ${moving.label} stays with ${from.name} until the fight ends.`,
      });
      return;
    }

    // An EQUIPPED item cannot be handed over — its statEffects are inside the sender's
    // derived AC and stats, so giving it away while worn leaves that card claiming armour it
    // no longer has. The picker already hides equipped items, but the rule lives here too:
    // the card is one entry point and the DM's own click is another, and a rule enforced
    // only in the UI is a rule that holds until someone finds the other door.
    if (moving.metadata?.equipped !== false) {
      addEntry({
        actorName: from.name, actionName: "Hand-off Blocked", tabId: "system",
        message: `⚠ ${from.name} must unequip ${moving.label} before handing it over — its bonuses are still on the sheet.`,
      });
      return;
    }

    // A weapon's rollable main-tab row is generated from the item and shares its id suffix,
    // so it travels along instead of being left behind pointing at an item that's gone.
    const itemKey = actionId.replace(/^equip-/, "");
    const movesToo = (a: { id: string }) => a.id === `atk-${itemKey}`;
    const carriedAttack = (from.tabs.main ?? []).filter(movesToo);

    const updatedFrom = { ...from, tabs: { ...from.tabs,
      equipment: (from.tabs.equipment ?? []).filter(a => a.id !== actionId),
      main: (from.tabs.main ?? []).filter(a => !movesToo(a)) } };
    // It lands UNEQUIPPED. Handing someone a breastplate doesn't put it on them, and an item
    // that arrived already equipped would silently apply its AC and stat effects — and, if it
    // needs attunement, claim one of the receiver's three slots without them agreeing to it.
    const received = { ...moving, metadata: { ...moving.metadata, equipped: false } };
    const heldIds = new Set((to.tabs.equipment ?? []).map(a => a.id));
    const mainIds = new Set((to.tabs.main ?? []).map(a => a.id));
    const updatedTo = { ...to, tabs: { ...to.tabs,
      equipment: heldIds.has(received.id) ? (to.tabs.equipment ?? []) : [...(to.tabs.equipment ?? []), received],
      main: [...(to.tabs.main ?? []), ...carriedAttack.filter(a => !mainIds.has(a.id))] } };

    const freshLib = {
      ...dmActors.reduce((m, a) => ({ ...m, [a.id]: a }), {} as Record<string, typeof from>),
      [updatedFrom.id]: updatedFrom,
      [updatedTo.id]: updatedTo,
    };
    upsertActorInLibrary(updatedFrom);
    upsertActorInLibrary(updatedTo);
    setActorLibrary(lib => ({ ...lib, [updatedFrom.id]: updatedFrom, [updatedTo.id]: updatedTo }));
    // Push every seat: the giver's sheet changed as much as the receiver's, and the two sit
    // on different seats. Resolving actor→seat here only re-derives what this already walks.
    pushActorsToAllSeats({ freshLibrary: freshLib });

    if (OBR.isAvailable) {
      void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:loot-attached", seatId: notifySeatId, itemName: `${moving.label} → ${to.name}`,
      }, { destination: "REMOTE" }).catch(() => undefined);
    }

    addEntry({
      actorName: from.name,
      actionName: "Item Given",
      tabId: "system",
      message: `${from.name} hands ${moving.label} to ${to.name}.`,
    });
  }

  /**
   * Equip or unequip a carried item.
   *
   * Same authority rule as the hand-off: the actor record is the DM's, so the player's card
   * asks and this performs it. Enforced HERE too, not only in the card's disabled button —
   * a stale sheet could otherwise ask to equip a fourth attuned item and get it.
   */
  /**
   * Gear handling in combat, per Christopher:
   *   · trade is HARD LOCKED — no hand-offs once initiative is rolled;
   *   · equip/unequip costs NO action, but only on your own turn;
   *   · once each per turn — you may take one thing off and put one thing on.
   *
   * Out of combat none of this applies: swap freely.
   */
  const inCombat = roomLiveState.combat.phase === "combat";

  /** A companion acts on its owner's turn, so it is "on turn" when the owner is. */
  function isActorOnTurn(actorId: string): boolean {
    const active = roomLiveState.combat.activeActorId;
    if (!active) return false;
    if (active === actorId) return true;
    const a = dmActors.find(x => x.id === actorId);
    return a?.kind === "companion"
      && (a.moduleData as { ownerId?: string } | undefined)?.ownerId === active;
  }

  /**
   * One unequip and one equip per actor per turn.
   *
   * Keyed by round + whose turn it is, so it clears itself when the turn moves rather than
   * needing a reset broadcast. DM-side only: the GM performs every gear change, so this is
   * the one place that sees them all.
   */
  const gearTurnLedger = useRef<Record<string, { key: string; equipped: number; unequipped: number }>>({});
  function gearTurnKey(): string {
    return `${roomLiveState.combat.round}:${roomLiveState.combat.activeActorId ?? ""}`;
  }
  function performEquipToggle(actorId: string, actionId: string) {
    /**
     * NEITHER OF THESE MAY FAIL QUIETLY.
     *
     * Every RULE rejection below announces itself — Gear Locked, Attunement Full — so a player
     * who is refused knows why. These two lookups did not, so a request that missed either one
     * ended the same way as a click on nothing: the button pressed, no message anywhere, and
     * the item unchanged. Indistinguishable from a dead control, which is exactly how it was
     * reported.
     *
     * They are also the two lookups most likely to miss, because both compare ids across a
     * copy boundary: the seat holds a snapshot pushed from the DM, and an item re-attached
     * since that push has a different action id on each side.
     */
    /**
     * READ THE CHARACTER FRESH, NOT FROM THE RENDER CLOSURE.
     *
     * `dmActors` is a memo captured when this handler was created. Each toggle then wrote the
     * WHOLE equipment array back, so two changes close together both started from the same
     * snapshot and the second overwrote the first. Three operations in fifteen seconds — stow
     * Handaxe, stow Hunting Trap, equip Pathfinder's Token — left only the last one applied,
     * while all three logged as if they had worked. That is why the DM's own card disagreed
     * with its own log, and why it looked like a display problem rather than a lost write.
     *
     * Resolving from storage at APPLY time is the same discipline `roomLiveStateRef.current`
     * already uses for concurrent room-state requests: every change builds on the result of
     * the last one rather than on whatever the last render happened to see.
     */
    const actor: Actor | undefined =
      resolveActor(actorId, loadActorLibrary(), loadActorOverrides(), roomLiveStateRef.current)
      ?? dmActors.find(a => a.id === actorId);
    if (!actor) {
      addEntry({
        actorName: "System", actionName: "Gear Change Failed", tabId: "system",
        message: `⚠ A seat asked to equip/unequip on character "${actorId}", which is not in the library. Their card is out of date — push that seat again.`,
      });
      return;
    }
    const equipment = actor.tabs.equipment ?? [];
    /**
     * MATCH ON THE ITEM, NOT JUST THE ACTION ID.
     *
     * A seat holds a snapshot pushed from the DM, so the two sides can legitimately carry
     * different ACTION ids for the same item: attaching from the library builds
     * `equip-<itemId>`, while an item authored by hand on the sheet keeps whatever id it was
     * given. Anything re-attached since the last push differs again. An exact id comparison
     * therefore missed, and — because the miss was silent — the button simply did nothing.
     *
     * The underlying item id is the stable thing. Try the exact action id first, then the item
     * both sides ultimately name, so a card one push out of date still works instead of going
     * dead.
     */
    const itemIdOf = (id: string) => id.replace(/^equip-/, "").replace(/^atk-/, "");
    const target = equipment.find(a => a.id === actionId)
      ?? equipment.find(a => itemIdOf(a.id) === itemIdOf(actionId));
    if (!target) {
      addEntry({
        actorName: actor.name, actionName: "Gear Change Failed", tabId: "system",
        message: `⚠ ${actor.name} tried to equip/unequip "${actionId}", which matches nothing on your copy of their sheet (${equipment.length} carried: ${equipment.map(a => a.id).slice(0, 6).join(", ")}${equipment.length > 6 ? "…" : ""}). Re-push that seat.`,
      });
      return;
    }

    const willEquip = target.metadata?.equipped === false;

    // In combat: only on your own turn, and only once each way.
    if (inCombat) {
      if (!isActorOnTurn(actorId)) {
        addEntry({
          actorName: actor.name, actionName: "Gear Locked", tabId: "system",
          message: `⚠ ${actor.name} can only change gear on their own turn.`,
        });
        return;
      }
      const key = gearTurnKey();
      const prev = gearTurnLedger.current[actorId];
      const used = prev && prev.key === key ? prev : { key, equipped: 0, unequipped: 0 };
      const spent = willEquip ? used.equipped : used.unequipped;
      if (spent >= 1) {
        addEntry({
          actorName: actor.name, actionName: "Gear Locked", tabId: "system",
          message: `⚠ ${actor.name} has already ${willEquip ? "equipped" : "unequipped"} something this turn.`,
        });
        return;
      }
      gearTurnLedger.current[actorId] = willEquip
        ? { ...used, equipped: used.equipped + 1 }
        : { ...used, unequipped: used.unequipped + 1 };
    }

    if (willEquip && target.metadata?.attunementRequired) {
      const attuned = equipment.filter(a => a.metadata?.attunementRequired && a.metadata?.equipped !== false).length;
      if (attuned >= 3) {
        addEntry({
          actorName: actor.name, actionName: "Attunement Full", tabId: "system",
          message: `⚠ ${actor.name} is already attuned to 3 items — ${target.label} stays unequipped until one is removed.`,
        });
        return;
      }
    }

    // Worn slots are exclusive: putting one on takes the oldest one in that slot off.
    //
    // Without this, a piece left on by mistake keeps contributing — and since the highest
    // effective AC wins, the forgotten one can be the piece being counted. Rings allow two;
    // everything else allows one. Items with no slot are carried, not worn, and displace
    // nothing, so weapons and utility gear are untouched.
    const slotOf = (a: typeof target): string | undefined => {
      if (a.metadata?.slot) return a.metadata.slot;
      // Fallback for gear attached before slots existed: an item that REPLACES your AC is
      // body armour whatever else it claims to be.
      return (a.metadata?.statEffects ?? []).some(e => (e as { type?: string }).type === "setAC")
        ? "body" : undefined;
    };
    const targetSlot = willEquip ? slotOf(target) : undefined;
    const capacity = targetSlot ? (SLOT_CAPACITY[targetSlot as EquipmentSlot] ?? 1) : 0;
    // Oldest first, so a third ring displaces the one worn longest rather than a random one.
    const wornInSlot = targetSlot
      ? equipment.filter(a => a.id !== actionId && a.metadata?.equipped !== false && slotOf(a) === targetSlot)
      : [];
    const toDisplace = new Set(wornInSlot.slice(0, Math.max(0, wornInSlot.length - capacity + 1)).map(a => a.id));
    const displaced: string[] = [];

    const updated = { ...actor, tabs: { ...actor.tabs,
      equipment: equipment.map(a => {
        if (a.id === actionId) return { ...a, metadata: { ...a.metadata, equipped: willEquip } };
        if (toDisplace.has(a.id)) {
          displaced.push(a.label);
          return { ...a, metadata: { ...a.metadata, equipped: false } };
        }
        return a;
      }) } };
    const freshLib = {
      ...dmActors.reduce((m, a) => ({ ...m, [a.id]: a }), {} as Record<string, typeof actor>),
      [updated.id]: updated,
    };
    upsertActorInLibrary(updated);
    setActorLibrary(lib => ({ ...lib, [updated.id]: updated }));
    pushActorsToAllSeats({ freshLibrary: freshLib });

    addEntry({
      actorName: actor.name,
      actionName: willEquip ? "Item Equipped" : "Item Stowed",
      tabId: "system",
      // Say what came off — a silent swap looks like the old armour is still on.
      message: displaced.length
        ? `${actor.name} equips ${target.label}, removing ${displaced.join(" and ")}.`
        : `${actor.name} ${willEquip ? "equips" : "stows"} ${target.label}.`,
    });
  }

  /**
   * Change a versatile chassis item's grip.
   *
   * Free and NOT turn-bound, unlike equip/unequip: a hand slides onto or off the hilt with no
   * action, and may do so between attacks in an Extra Attack sequence. The only hard rule is
   * that two-handing needs the off hand empty, which is enforced here as well as on the button
   * — a shield cannot be worked around mid-turn, since doffing one costs an action.
   */
  function performGripChange(actorId: string, actionId: string, grip: "1h" | "2h") {
    const actor = dmActors.find(a => a.id === actorId);
    if (!actor) return;
    const equipment = actor.tabs.equipment ?? [];
    const target = equipment.find(a => a.id === actionId);
    if (!target) return;

    if (grip === "2h") {
      const blocker = offHandBlocker(equipment);
      if (blocker) {
        addEntry({
          actorName: actor.name, actionName: "Grip", tabId: "system",
          message: `⚠ ${actor.name} cannot two-hand ${target.label} — the off hand is holding ${blocker}.`,
        });
        return;
      }
    }

    const updated = { ...actor, tabs: { ...actor.tabs,
      equipment: equipment.map(a => a.id === actionId
        ? { ...a, metadata: { ...a.metadata, grip } }
        : a) } };
    const freshLib = {
      ...dmActors.reduce((m, a) => ({ ...m, [a.id]: a }), {} as Record<string, typeof actor>),
      [updated.id]: updated,
    };
    upsertActorInLibrary(updated);
    setActorLibrary(lib => ({ ...lib, [updated.id]: updated }));
    pushActorsToAllSeats({ freshLibrary: freshLib });

    addEntry({
      actorName: actor.name, actionName: "Grip", tabId: "system",
      message: `${actor.name} takes ${target.label} in ${grip === "2h" ? "two hands" : "one hand"}.`,
    });
  }

  /** The DM performs it; a seat asks. Same split as equip. */
  function requestGripChange(actorId: string, action: { id: string }, grip: "1h" | "2h") {
    if (isDmMode) { performGripChange(actorId, action.id, grip); return; }
    void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
      type: "fdmc:request-actor-grip", actorId, actionId: action.id, grip,
    }, { destination: "REMOTE" }).catch(() => undefined);
  }

  useEffect(() => {
    if (!isDmMode || !OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data as { type?: string; fromActorId?: string; toActorId?: string; actorId?: string; actionId?: string; seatId?: string; grip?: "1h" | "2h" } | undefined;
      if (msg?.type === "fdmc:item-grip" && msg.actorId && msg.actionId && msg.grip) {
        performGripChange(msg.actorId, msg.actionId, msg.grip);
        return;
      }
      if (msg?.type === "fdmc:item-transfer" && msg.fromActorId && msg.toActorId && msg.actionId) {
        performItemTransfer(msg.fromActorId, msg.toActorId, msg.actionId, msg.seatId);
        return;
      }
      if (msg?.type === "fdmc:item-equip" && msg.actorId && msg.actionId) {
        performEquipToggle(msg.actorId, msg.actionId);
      }
      /**
       * A popout asking for its character.
       *
       * A push only lands on a window that was listening at the time, so a client whose cache
       * was never written has nothing but the shipped snapshot — a complete, plausible sheet
       * that no DM action can change. Answering with a full push turns that dead end into a
       * round trip, and costs nothing when the card was already current.
       */
      if (msg?.type === "fdmc:actor-refresh-request") {
        pushActorsToAllSeats();
      }
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
      // isNameRevealed rides this channel too (the combat window / popout reveals a
      // creature on its first HP change). It was NOT read here, so the reveal updated the
      // DM's own roster copy but monsterCandidates stayed hidden — and the roster then
      // re-broadcast to players still carried the HIDDEN name. That is why revealing a
      // boss never reached the player view.
      const msg = event.data as { type?: string; instanceId?: string; currentHp?: number; maxHp?: number; tempHp?: number; isNameRevealed?: boolean } | undefined;
      if (msg?.type !== "fdmc:monster-popout-hp" || !msg.instanceId) return;
      setMonsterCandidates(prev => {
        const next = prev.map(m => {
          const inst = m as MainEncounterMonsterInstance;
          if (inst.instanceId !== msg.instanceId) return m;
          return {
            ...inst,
            currentHp: msg.currentHp ?? inst.currentHp,
            maxHp: msg.maxHp ?? inst.maxHp,
            tempHp: msg.tempHp ?? inst.tempHp,
            // Reveal is one-way: never un-reveal a creature the table has already seen.
            isNameRevealed: msg.isNameRevealed ? true : inst.isNameRevealed,
          };
        }) as MainEncounterMonsterInstance[];
        // Persist so the reveal survives a reload, then push the player-safe roster.
        saveMonsterRoster(next);
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
        // A kill is "boss-worthy" by THREAT TIER, not by kind. kind is identity (what the
        // creature is); classification is how big a threat it is. Mid-boss and up qualify.
        const isBossKill = inst.classification === "mid-boss"
          || inst.classification === "act-boss"
          || inst.classification === "final-boss";
        if (patch.currentHp <= 0 && inst.currentHp > 0 && isBossKill) {
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

  // ── Item hand-off between players ────────────────────────────────────────
  //
  // Recipients come from whichever roster this side already has: the DM holds every actor,
  // a player has the broadcast party tracker. Self is filtered out — handing an item to
  // yourself is a no-op the DM handler rejects anyway.
  function itemTransferTargets(selfActorId: string): Array<{ id: string; name: string }> {
    const roster = isDmMode
      ? dmActors.map(a => ({ id: a.id, name: a.name }))
      : partyRoster.map(c => ({ id: c.id, name: c.name }));
    return roster.filter(p => p.id !== selfActorId && p.name);
  }

  // The DM owns the move. Their own click runs it directly; a player's asks over the channel.
  function requestItemTransfer(fromActorId: string, toActorId: string, action: { id: string; label: string }) {
    if (isDmMode) {
      performItemTransfer(fromActorId, toActorId, action.id, claimedSeatId ?? undefined);
      return;
    }
    void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
      type: "fdmc:item-transfer",
      fromActorId,
      toActorId,
      actionId: action.id,
      seatId: claimedSeatId ?? "",
    }, { destination: "REMOTE" }).catch(() => undefined);
  }

  // Equip/unequip, same split: the DM runs it, a player asks for it.
  function requestEquipToggle(actorId: string, action: { id: string }) {
    if (isDmMode) {
      performEquipToggle(actorId, action.id);
      return;
    }
    void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
      type: "fdmc:request-actor-equip",
      actorId,
      actionId: action.id,
      seatId: claimedSeatId ?? "",
    }, { destination: "REMOTE" }).catch(() => undefined);
  }

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
  // Offers this player has closed themselves. Every pick re-sends the offer with the stock
  // that's left, and without this a shop you walked away from would pop open again each time
  // another player bought something.
  const dismissedOfferIds = useRef<Set<string>>(new Set());
  /** Offers already announced in the log, so stock updates don't re-announce them. */
  const lootOfferSeenIds = useRef<Set<string>>(new Set());
  // Which of this seat's actors is buying/receiving. Offers are addressed to SEATS, but one
  // player can run two characters with separate purses and bags — and the offer panel covers
  // the card switcher, so the choice has to be reachable from inside the panel.
  const [buyerActorId, setBuyerActorId] = useState<string>("");
  const [showConvergePanel, setShowConvergePanel] = useState(false);
  const [convergenceSubmitting, setConvergenceSubmitting] = useState(false);
  // Convergence item selection — lifted to component scope so the hook is never
  // called conditionally inside the panel's render IIFE (rules-of-hooks).
  const [convergenceSelected, setConvergenceSelected] = useState<string[]>([]);
  const [showLevelUpRequest, setShowLevelUpRequest] = useState(false);
  const [levelUpRejectionToast, setLevelUpRejectionToast] = useState<string | null>(null);
  // A save-forcing action fired; pick which combatants must roll, then broadcast the call.
  const [pendingSave, setPendingSave] = useState<{ source: string; action: string; save: string } | null>(null);
  const [saveTargets, setSaveTargets] = useState<Set<string>>(new Set());

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
      // Loot offer — player must choose one item. Re-sent after every pick with the stock
      // that is LEFT, so a taken item disappears from the list rather than being offered and
      // then refused.
      if (msg.type === "fdmc:loot-offer" && msg.seatId === claimedSeatId) {
        const offer = msg as import("./core/ui/EquipmentLibraryStandalone").LootOffer;
        if (offer.closed) {
          // Round over — drop the overlay and stop tracking it.
          setLootOffer(prev => (prev?.offerId === offer.offerId ? null : prev));
          dismissedOfferIds.current.delete(offer.offerId);
        } else if (!dismissedOfferIds.current.has(offer.offerId)) {
          setLootOffer(offer);
          // Only announce the first send; the stock updates that follow aren't news.
          if (!lootOfferSeenIds.current.has(offer.offerId)) {
            lootOfferSeenIds.current.add(offer.offerId);
            addEntry({ actorName: "DM", actionName: "Loot Offer", tabId: "system", message: msg.message ?? "Boss drop — choose an item." });
          }
        }
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
      // DM confirms choice was received and item attached.
      // Merchant shops stay open for more purchases; pick-one offers close.
      if (msg.type === "fdmc:loot-attached" && msg.seatId === claimedSeatId) {
        setLootOffer(prev => ((prev as { mode?: string } | null)?.mode === "merchant" ? prev : null));
        setLootToast(`✓ ${(msg as { itemName?: string }).itemName ?? "Item"} added to your equipment.`);
        setTimeout(() => setLootToast(null), 6000);
      }
      // Merchant purchase rejected (not enough gold) — toast, shop stays open
      if (msg.type === "fdmc:purchase-denied" && (msg as { seatId?: string }).seatId === claimedSeatId) {
        const reason = (msg as { reason?: string }).reason ?? "Purchase denied.";
        setLootToast(`✗ ${reason}`);
        addEntry({ actorName: "DM", actionName: "Purchase Denied", tabId: "system", message: reason });
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
  const [bossKillAlert, setBossKillAlert] = useState<{ name: string; encounterId: string; encounterName: string; reason?: "boss" | "combat-end" } | null>(null);

  // P7/P8: log HP change to encounter log + ring buffer
  /**
   * `actorId` here is WHOSE HP MOVED — the target, not the cause. The cause is not known
   * at this level (the DM is adjusting a bar), so the summary credits whoever's turn it
   * is and marks the entry INFERRED. A committed attack roll should credit its own actor
   * and mark it "attributed"; that wiring is still to come, and until it lands these
   * totals are honest estimates rather than claims.
   */
  function logHpChange(actorId: string, actorName: string, delta: number, round: number) {
    if (!isDmMode || delta === 0) return;
    appendLogEntry({
      id: makeLogId(), timestamp: new Date().toLocaleTimeString(), round,
      type: "hp-change", code: makeActionCode(actorName, "HP"),
      actorId, actorName, val: delta, message: delta < 0 ? `${actorName} took ${Math.abs(delta)} damage` : `${actorName} healed ${delta} HP`,
    });
    // Feed the summary log too — it reads CombatLogEntry, not the localStorage encounter
    // log, so without this the panel counted nothing at all.
    {
      const causeId = roomLiveState.combat.activeActorId ?? undefined;
      const causeActor = actors.find(a => a.id === causeId);
      const causeMonster = monsterCandidates.find(m => (m as MainEncounterMonsterInstance).instanceId === causeId) as MainEncounterMonsterInstance | undefined;
      const causeName = causeActor?.name ?? causeMonster?.revealedName ?? causeMonster?.displayName ?? "Unknown";
      // Companions count as PARTY — Faelar's damage is the ranger's damage.
      const causeSide: "party" | "monster" | undefined = causeActor
        ? "party"
        : causeMonster ? "monster" : undefined;
      const targetSide: "party" | "monster" = actors.some(a => a.id === actorId) ? "party" : "monster";
      addEntry({
        actorName: causeName,
        actionName: delta < 0 ? "Damage" : "Healing",
        tabId: "system",
        message: delta < 0
          ? `${causeName} dealt ${Math.abs(delta)} damage to ${actorName}.`
          : `${causeName} healed ${actorName} for ${delta}.`,
        actorId: causeId,
        actorSide: causeSide,
        targetId: actorId,
        targetName: actorName,
        // The target's own side, so "took the most damage" groups correctly.
        targetSide,
        amount: Math.abs(delta),
        category: delta < 0 ? "damage" : "healing",
        attribution: "inferred",
        round,
      });
    }
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

  /**
   * PLAYER SEAT NAMES, offered when a MONSTER rolls a Nat 1 so the DM can hand that d6 to a
   * player — the one Nat 1 that is table-facing. Player characters only: a monster is never
   * asked to roll its own failure, and the DM keeps every PC nat 1 as a plain miss.
   */
  const playerSeatNames = useMemo(
    () => actors.filter(a => a.kind !== "monster").map(a => a.name),
    [actors],
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

  // Companions act on their owner's turn — reset their action economy alongside
  // the owner so they get a fresh Action/Bonus/Reaction when the owner's turn starts.
  function resetCompanionTurns(ownerId: string) {
    for (const companion of actors.filter(
      a => a.kind === "companion" && (a.moduleData as { ownerId?: string } | undefined)?.ownerId === ownerId
    )) {
      resetActorTurn(companion.id);
    }
  }

  function handleStartCombat() {
    const sorted = sortCombatants(allCombatants).filter(c => !c.isDead && !isOutOfCombat(c));
    if (sorted.length === 0) return;
    const firstId = sorted[0].id;
    resetCompanionTurns(firstId);
    // Read fresh from OBR to ensure seat bindings from dm-panel are captured
    void (async () => {
      const freshState = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
      const base = freshState ?? roomLiveState;
      const next = patchCombat(base, { phase: "combat", activeActorId: firstId, round: 1 });
      void commitRoomState(next);
    })();
    setSelectedActorId(actors.find(a => a.id === firstId)?.id ?? selectedActorId);
    setActiveMonsterInstanceId(monsterCandidates.find(m => (m as MainEncounterMonsterInstance).instanceId === firstId) ? firstId : "");
    // NOT cleared here. The tracked window starts at the FIRST INITIATIVE ROLL, and those
    // are logged during the setup/initiative phase — clearing on Start Combat destroyed
    // every one of them before the fight it belongs to had begun. The log now spans
    // initiative → End Combat, delimited by these Combat Start / Combat End markers so an
    // export can segment sessions, and the DM clears it by hand from the log panel.
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
    const sorted = sortCombatants(allCombatants).filter(c => !c.isDead && !isOutOfCombat(c));
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
      if (nextActor) {
        resetActorTurn(nextActor.id);
        resetCompanionTurns(nextActor.id); // companions share the owner's turn
      }
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
    // Tell every card to drop armed effects + end active rage (toggles auto-clear at fight end).
    if (OBR.isAvailable) {
      void OBR.broadcast.sendMessage(FDMC_COMBAT_END_CHANNEL, { type: "fdmc:combat-end" }, { destination: "ALL" }).catch(() => undefined);
    }
    // "Once per encounter" item pools come back here. They are the only pools that refill
    // without a rest, so without this a party fighting twice between short rests would carry
    // an empty Quickstep Boots into the second fight.
    resetEncounterCharges();
    addEntry({ actorName: "System", actionName: "Combat End", tabId: "system", message: "Combat ended. Seats and HP preserved." });
    // OFFER the log after every combat — a living record is only living if each fight can be
    // kept, and most fights never involve a boss. Deliberately an offer, never an automatic
    // download: plenty of campaigns will not want a file per encounter, and silently writing
    // to someone's disk at the end of every fight is not ours to decide. Whatever the alert
    // already says wins, so a boss kill keeps its own wording.
    setBossKillAlert(prev => prev ?? {
      name: "Combat",
      encounterId: "encounter",
      encounterName: activeEncounterName(),
      reason: "combat-end",
    });
  }

  /**
   * Best available name for the fight that just ended, for the export filename. Prefers the
   * strongest creature actually in the roster, which is what a DM would call the encounter.
   */
  function activeEncounterName(): string {
    return monsterCandidates.find(m => m?.name)?.name ?? "Encounter";
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

  // ── Tracker initiative via Dice+ (player-owned) ──────────────────────────────
  // The combat tracker's per-actor dice button rolls through Dice+ as the viewer who
  // clicked it (each browser sends its own roll). We remember the requestId here; when
  // the matching result returns, the total is written to SHARED initiative so the GM's
  // tracker — and everyone's — updates. Only the sending instance holds the requestId.
  const pendingTrackerInitiativeRef = useRef<Map<string, { actorId: string; sentAt: number }>>(new Map());

  async function handleRollActorInitiativeViaDicePlus(actorId: string) {
    const actor = actors.find(a => a.id === actorId);
    if (!actor) return;
    const formula = initiativeRollFormula(actor);
    const requestId = `fdm-tracker-init-${Date.now()}-${actorId}-${Math.random().toString(36).slice(2, 8)}`;
    // Prune any rolls that were sent but never resolved (>60s) so the map can't grow.
    const cutoff = Date.now() - 60000;
    for (const [id, entry] of pendingTrackerInitiativeRef.current) {
      if (entry.sentAt < cutoff) pendingTrackerInitiativeRef.current.delete(id);
    }
    pendingTrackerInitiativeRef.current.set(requestId, { actorId, sentAt: Date.now() });
    const sent = await sendDicePlusRollRequest({
      protocol: "forever-dm-combat.roll.request.v1",
      requestId,
      source: "Forever DM Combat",
      actorId,
      actorName: actor.name,
      actionId: "initiative",
      actionName: "Initiative",
      formula: `${formula} # ${actor.name} Initiative`,
      outcomeMode: "ability-check",
      sentAt: new Date().toISOString(),
    });
    if (!sent) {
      // No Dice+ bridge — fall back to a local roll so the actor still slots into order.
      pendingTrackerInitiativeRef.current.delete(requestId);
      const roll = Math.floor(Math.random() * 20) + 1 + getActorInitiativeModifier(actor);
      handleSetCombatantInitiative(actorId, roll);
      addEntry({ actorName: actor.name, actionName: "Initiative", tabId: "system", message: `${actor.name} rolls Initiative ${roll} (Dice+ unavailable — local roll).` });
      return;
    }
    addEntry({ actorName: actor.name, actionName: "Initiative", tabId: "system", message: `${actor.name} rolls Initiative (${formula}) through Dice+.` });
  }

  // Capture a tracker initiative result and write it to shared initiative.
  useEffect(() => {
    const result = diceBridgeLastEvent?.result;
    if (!result?.requestId) return;
    const entry = pendingTrackerInitiativeRef.current.get(result.requestId);
    if (!entry) return;
    pendingTrackerInitiativeRef.current.delete(result.requestId);
    const actor = actors.find(a => a.id === entry.actorId);
    const total = typeof result.total === "number"
      ? result.total
      : (() => {
          const text = result.result ?? "";
          const m = text.match(/total\s*(-?\d+)/i) ?? text.match(/(-?\d+)\s*$/);
          return m ? Number.parseInt(m[1], 10) : null;
        })();
    if (typeof total === "number" && Number.isFinite(total)) {
      handleSetCombatantInitiative(entry.actorId, total);
      addEntry({ actorName: actor?.name ?? "Actor", actionName: "Initiative", tabId: "system", message: `${actor?.name ?? "Actor"} initiative set to ${total} (Dice+).` });
    } else {
      // Result arrived but no total could be read — tell the table to set it manually.
      addEntry({ actorName: actor?.name ?? "Actor", actionName: "Initiative", tabId: "system", message: `⚠ ${actor?.name ?? "Actor"} initiative result couldn't be read from Dice+ — set it manually on the tracker.` });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceBridgeLastEvent]);

  // ── Tool panel ────────────────────────────────────────────────────────────
  const [openPanel, setOpenPanel] = useState<ToolPanelId>(null);
  const closePanel = useCallback(() => setOpenPanel(null), []);

  // ── Open DM tool as OBR popover window ───────────────────────────────────
  // All known DM popover IDs — used for close-all
  /**
   * Seat whose card the DM is PREVIEWING — read-only, so "what does this look like to them?"
   * has an answer without asking a player to describe their screen.
   *
   * Deliberately not an impersonation: no write handler is passed to the previewed card, so
   * nothing here can act as that player. Acting-as would mean the GM client issuing
   * player-side requests to itself, and the write-authority model assumes those come from a
   * different machine.
   */
  const [previewSeatId, setPreviewSeatId] = useState<string>("");
  /**
   * How many forge requests are waiting, for the badge on the Library button.
   *
   * Sourced from the durable inbox rather than from a message that just arrived, so it is
   * still right after a reload and still right if the request came in before this window was
   * looking. Re-read on a timer AND whenever a request lands, because the other windows
   * resolve requests without telling this one.
   */
  const [convergencePending, setConvergencePending] = useState(0);
  useEffect(() => {
    if (!isDmMode) return;
    const refresh = () => setConvergencePending(loadConvergenceInbox().length);
    refresh();
    const t = window.setInterval(refresh, 4000);
    return () => window.clearInterval(t);
  }, [isDmMode]);
  const DM_PANEL_IDS = ["fdm-dm-editActors", "fdm-dm-seats", "fdm-dm-monsters", "fdm-dm-equipment", "fdm-dm-maintenance", "fdm-dm-library", "fdm-dm-seatTokens", "fdm-dm-tokens", "fdm-dm-approvals", "fdm-dm-balance"] as const;

  const closeAllDmPanels = useCallback(async () => {
    if (!OBR.isAvailable) { setOpenPanel(null); return; }
    await Promise.all([
      ...DM_PANEL_IDS.map(id => OBR.popover.close(id).catch(() => undefined)),
      OBR.popover.close("fdm-actor-card").catch(() => undefined),
      OBR.popover.close("fdm-combat").catch(() => undefined),
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
        <ReadmeOverlay open={showReadme} onClose={() => setShowReadme(false)} />
        <CriticalFailureReference open={showCritFailTables} onClose={() => setShowCritFailTables(false)} />
        {isDmMode && (
          <header className="fdmc-dm-toolbar" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "6px 10px", background: "#0d0d14", borderBottom: "1px solid #2a2a3e" }}>
            <button type="button" style={DM_BTN.use} title="Open the quick guide — colors, flow, and controls"
              onClick={() => setShowReadme(true)}>📖 Guide</button>
            {/* ⚀ THE NAT 1 TABLES, WITH NO MONSTER AND NO ROLL REQUIRED. Both entry points
                before this needed something in play — a card to hang a button on, or an actual
                natural 1 — so a DM could not read the tables while prepping. It sits beside the
                Guide because it is the same kind of thing: pure reference, changes nothing. */}
            <button type="button" style={DM_BTN.use} title="Natural 1 failure tables — both the first and second tables, for melee, ranged and spell attacks alike"
              onClick={() => setShowCritFailTables(true)}>⚀ Nat 1</button>
            <span style={dmGroupLabel("#3f9d5f")}>Create</span>
            <button type="button" style={DM_CREATE_SHADES[0]} onClick={() => void openDmPanel("library", "actor")}>+ Party Character</button>
            <button type="button" style={DM_CREATE_SHADES[1]} onClick={() => void openDmPanel("library", "monster")}>+ Monster</button>
            <button type="button" style={DM_CREATE_SHADES[2]} onClick={() => void openDmPanel("library", "equipment")}>+ Equipment</button>
            <span style={{ width: 10 }} />
            <span style={dmGroupLabel("#5f8fd9")}>Manage</span>
            <button type="button" style={DM_USE_SHADES[0]} onClick={() => void openDmPanel("seatTokens")}>Seats &amp; Tokens</button>
            {/* The Library button carries the pending-forge count. A log line scrolls away and
                is easy to miss; the thing you have to click to act on it should be the thing
                that tells you there is something to act on. Read from the durable inbox, so it
                is still there after a reload — and it clears itself when the request is
                resolved, because that is when the inbox entry goes. */}
            <button type="button" style={DM_USE_SHADES[1]} onClick={() => void openDmPanel("library")}>
              Library
              {convergencePending > 0 && (
                <span
                  title={`${convergencePending} convergence request${convergencePending === 1 ? "" : "s"} waiting`}
                  style={{ marginLeft: 6, padding: "0 6px", borderRadius: 8, background: "#2a6e2a", color: "#dfffdf", fontSize: 10, fontWeight: 700 }}>
                  ◈ {convergencePending}
                </span>
              )}
            </button>
            {/* See a seat exactly as its player does. Read-only. */}
            <select value={previewSeatId} onChange={e => setPreviewSeatId(e.target.value)}
              title="Preview a player's card as they see it — read only"
              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid #2f5d9e", background: "#15233c", color: "#7db1ff", cursor: "pointer" }}>
              <option value="">👁 View as…</option>
              {/* Every non-viewer seat is LISTED, including ones with nobody bound yet. The
                  filter used to drop those, so a seat you knew existed just was not in the
                  list and there was nothing to explain why. A seat with no character is
                  disabled and says so — that is a seat waiting to be bound, not a missing
                  feature. */}
              {(() => {
                const seats = Object.values(roomLiveState.seats)
                  .filter(seat => seat.seatMode !== "viewer")
                  .sort((a, b) => a.seatId.localeCompare(b.seatId));
                if (seats.length === 0) {
                  return <option value="" disabled>— no player seats yet —</option>;
                }
                return seats.map(seat => {
                  const bound = (seat.actorIds?.length ?? 0) > 0;
                  return (
                    <option key={seat.seatId} value={seat.seatId} disabled={!bound}>
                      {seat.label}{bound ? "" : " — no character bound"}
                    </option>
                  );
                });
              })()}
            </select>
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
            obrPlayers={obrPlayers}
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

  /**
   * The space a popover can actually occupy, in CSS px.
   *
   * `window.screen` is the PHYSICAL MONITOR. It does not subtract browser chrome, does not
   * notice a browser window that isn't maximised, and on Windows at 125/150% display
   * scaling it reports logical pixels that don't match the usable area either. Sizing a
   * popover from it produces a window BIGGER than the room available — which is why the
   * combat window covered the map and pushed its own Close button out of reach.
   *
   * OBR.viewport is the authoritative measure of the map area the extension lives in.
   * Falls back to the iframe's own innerWidth/Height, then to a conservative default.
   */
  async function getUsableViewport(): Promise<{ w: number; h: number }> {
    try {
      const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
      if (w > 0 && h > 0) return { w, h };
    } catch { /* not in OBR, or the call failed — fall through */ }
    return { w: window.innerWidth || 1024, h: window.innerHeight || 768 };
  }

  // Open the GM combat window (Monster Gate WS-B/B1) — the single large DM combat
  // view: encounter roster · active creature card · player view. Distinct popover id,
  // so it coexists with the DM panels and actor card (S0: one DM window is all we need).
  async function openCombatWindow() {
    if (!OBR.isAvailable) return;
    try {
      const url = new URL(window.location.href);
      url.pathname = url.pathname.replace(/\/[^/]*$/, "/combat-window.html");
      url.search = "";
      // Size against the REAL viewport, not window.screen — see getUsableViewport.
      // The old floors (960 × 700) were larger than a laptop's usable area once browser
      // chrome and OS scaling are subtracted, so the window could not shrink to fit and
      // spilled over the map: you had to zoom the browser out to reach Close or the tokens.
      const { w: vw, h: vh } = await getUsableViewport();
      const width = Math.min(1240, Math.max(680, vw - 48));
      const height = Math.min(880, Math.max(420, vh - 48));
      await OBR.popover.open({
        id: "fdm-combat",
        url: url.toString(),
        width,
        height,
        anchorReference: "POSITION",
        anchorPosition: { left: Math.max(8, Math.floor((vw - width) / 2)), top: 16 },
        anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
        transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
        disableClickAway: true,
        marginThreshold: 16,
      });
    } catch {
      // no-op — outside OBR there is no combat window
    }
  }

  // Open the level-up editor as its own resizable window (frees players from the
  // cramped combat popover). Falls back to the inline panel outside Owlbear.
  async function openLevelUpWindow() {
    if (!OBR.isAvailable) { setShowLevelUpRequest(v => !v); return; }
    try {
      const url = new URL(window.location.href);
      url.pathname = url.pathname.replace(/\/[^/]*$/, "/levelup-popout.html");
      url.search = "";
      url.searchParams.set("fdmLevelUp", actorToShow.id);
      url.searchParams.set("seatId", claimedSeatId ?? "");
      const sc = seatColorById[actorToShow.id];
      if (sc) url.searchParams.set("seatColor", sc);
      await OBR.popover.open({
        id: "fdm-levelup",
        url: url.toString(),
        width: 540,
        height: 780,
        anchorReference: "POSITION",
        anchorPosition: { left: Math.max(16, Math.floor(window.screen.width / 2) - 270), top: 24 },
        anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
        transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
        disableClickAway: true,
        marginThreshold: 16,
      });
    } catch {
      setShowLevelUpRequest(v => !v); // window failed — fall back to inline panel
    }
  }

  return (
    <main className="fdmc-app">

      <ReadmeOverlay open={showReadme} onClose={() => setShowReadme(false)} />
        <CriticalFailureReference open={showCritFailTables} onClose={() => setShowCritFailTables(false)} />

      {/* ── DM toolbar — grouped, color-coded rows (P-UX1) ── */}
      {isDmMode && (
        <header
          className="fdmc-dm-toolbar"
          style={{ display: "flex", flexDirection: "column", gap: 5, padding: "6px 10px", background: "#0d0d14", borderBottom: "1px solid #2a2a3e" }}
        >
          {/* Row 1 — session + status. Creation moved into the Library (P-UX4 Phase 5);
              the top Create buttons are hidden once content exists. */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={DM_BTN.use} title="Open the quick guide — colors, flow, and controls"
              onClick={() => setShowReadme(true)}>📖 Guide</button>
            {/* ⚀ THE NAT 1 TABLES, WITH NO MONSTER AND NO ROLL REQUIRED. Both entry points
                before this needed something in play — a card to hang a button on, or an actual
                natural 1 — so a DM could not read the tables while prepping. It sits beside the
                Guide because it is the same kind of thing: pure reference, changes nothing. */}
            <button type="button" style={DM_BTN.use} title="Natural 1 failure tables — both the first and second tables, for melee, ranged and spell attacks alike"
              onClick={() => setShowCritFailTables(true)}>⚀ Nat 1</button>

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
            {/* Seat & token assignment lives in Seats & Tokens (P-UX4 Phase 7 removed the
                standalone Assign Token button — seat assignment uses the anchor model). */}
            <button type="button" style={DM_USE_SHADES[0]} title="Seats, token assignment, and the secondary-token anchor model"
              onClick={() => void openDmPanel("seatTokens")}>Seats &amp; Tokens</button>
            <button type="button" style={DM_USE_SHADES[2]} title="Browse, create &amp; load Party Characters, Monsters and Equipment"
              onClick={() => void openDmPanel("library")}>
              Library{monsterCandidates.length > 0 ? ` (${monsterCandidates.length})` : ""}
            </button>
            <button type="button"
              title="Open the GM combat window — roster, active creature card, and player view in one window"
              style={{ background: "#2a1515", border: "1px solid #8a3434", color: "#e08585", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
              onClick={() => void openCombatWindow()}>
              ⚔ Combat{monsterCandidates.length > 0 ? ` (${monsterCandidates.length})` : ""}
            </button>

            <span style={{ flex: 1, minWidth: 8 }} />

            {/* P-UX4 Phase 6 — labeled DM-control icons: cleanup (yellow), GM room data
                (teal hammer/wrench), close all (red). */}
            <button type="button" style={DM_BTN.cleanup} title="Post-combat cleanup — clear defeated monsters and stale state after a fight"
              onClick={() => setOpenPanel("encounterCleanup")}>🧹 Cleanup</button>
            <button type="button" style={DM_BTN.fix} title="GM session-save / room-metadata control — clean room metadata &amp; save actor stats"
              onClick={() => void openDmPanel("maintenance")}>🛠 GM Data</button>
            <button type="button" style={DM_BTN.danger} title="Close all DM windows"
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

      {/* ── View as a seat — a read-only preview of a player's card ─────────────── */}
      {isDmMode && previewSeatId && (() => {
        const seat = roomLiveState.seats[previewSeatId];
        const seatActorIds = seat?.actorIds ?? [];
        const shown = dmActors.find(a => a.id === (seat?.primaryActorId || seatActorIds[0]));
        // NEVER FAIL SILENTLY. This returned null when the seat or its character could not be
        // resolved, so picking a seat opened nothing at all and the preview simply looked
        // gone. Say which of the two is missing instead — a seat that vanished from the room
        // and a seat whose character is not in the library are different problems.
        if (!seat || !shown) {
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,14,0.94)", zIndex: 240, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div style={{ maxWidth: 420, background: "#15233c", border: "1px solid #2f5d9e", borderRadius: 8, padding: "14px 16px", color: "#cfe3ff" }}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13 }}>Cannot preview that seat</p>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#8fb6e8", lineHeight: 1.5 }}>
                  {!seat
                    ? `Seat "${previewSeatId}" is no longer in this room — it was probably renamed or cleared.`
                    : `${seat.label} has no character the library can resolve. Bind one in Seats & Tokens, then try again.`}
                </p>
                <button type="button" onClick={() => setPreviewSeatId("")}
                  style={{ fontSize: 11, padding: "4px 12px", background: "transparent", border: "1px solid #444", borderRadius: 5, color: "#aaa", cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          );
        }
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,14,0.94)", zIndex: 240, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px" }}>
            <div style={{ width: "100%", maxWidth: 560, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#15233c", border: "1px solid #2f5d9e", borderRadius: "8px 8px 0 0", flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "#7db1ff", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Viewing as</span>
              <strong style={{ fontSize: 13, color: "#fff" }}>{seat.label}</strong>
              <span style={{ fontSize: 11, color: "#8a8aa0" }}>{shown.name}</span>
              {seatActorIds.length > 1 && (
                <span style={{ fontSize: 10, color: "#666" }}>+{seatActorIds.length - 1} more on this seat</span>
              )}
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#a06a4a" }}>read only</span>
              <button type="button" onClick={() => setPreviewSeatId("")}
                style={{ fontSize: 11, padding: "3px 12px", background: "transparent", border: "1px solid #444", borderRadius: 5, color: "#888", cursor: "pointer" }}>
                Close
              </button>
            </div>
            {/* No write handler is passed, so nothing in here can change the sheet. */}
            <div style={{ width: "100%", maxWidth: 560, flex: 1, minHeight: 0, overflowY: "auto", background: "#0d0d14", border: "1px solid #2f5d9e", borderTop: "none", borderRadius: "0 0 8px 8px" }}>
              <ActorCard
                actor={shown}
                seatColor={seatColorById[shown.id]}
                seatNames={playerSeatNames}
                onMergeIntoCommittedRoll={(patch) => mergeIntoCommittedRoll(shown.id, patch)}
                hp={getActorHp(shown.id)}
                actionState={getActionState(shown)}
                concentration={getActorConcentration(shown)}
                committedRoll={getCommittedRoll(shown)}
                actorNotes={getActorNotes(shown)}
                status={getActorStatus(shown)}
                rulesProfile={DEFAULT_COMBAT_RULES_PROFILE}
                turnResetVersion={turnResetVersion}
                diceBridgeStatus={diceBridgeStatus}
                diceBridgeLastEvent={diceBridgeLastEvent}
                isPlayerMode
                combatActive={roomLiveState.combat.phase === "combat"}
                isActiveTurn={
                  roomLiveState.combat.phase !== "combat" ||
                  roomLiveState.combat.activeActorId === shown.id ||
                  (shown.kind === "companion" &&
                    roomLiveState.combat.activeActorId ===
                      (shown.moduleData as { ownerId?: string } | undefined)?.ownerId)
                }
                combatRound={roomLiveState.combat.round}
                coins={roomLiveState.actorLiveState[shown.id]?.coins ?? {}}
                {...READ_ONLY_CARD_HANDLERS}
              />
            </div>
          </div>
        );
      })()}

      {/* ── Player loot offer — two views: mid-combat (compact strip) or final (full-screen) ── */}
      {isPlayerMode && lootOffer && actorToShow && (() => {
        const mode = (lootOffer as { mode?: string }).mode;
        const isFinal = mode === "boss-final";
        const isMerchant = mode === "merchant";
        // Ordered round: only the seat holding the turn may take something. Everyone else
        // watches the pool shrink so they can plan, but their buttons are inert.
        const ordered = Boolean(lootOffer.ordered);
        const myTurn = !ordered || lootOffer.turnSeatId === claimedSeatId;
        const waitingOn = lootOffer.turnLabel ?? "another player";
        // The seat is the recipient; this is which of its characters actually gets the item
        // and pays for it. Defaults to the card on screen when the seat runs only one.
        const buyer = playerActors.find(a => a.id === buyerActorId) ?? actorToShow!;

        /**
         * Which character is acting, for a seat that runs more than one.
         *
         * Two characters on one seat have separate purses and separate bags, so "buy from
         * both separately" needs a target — and since the offer panel covers the card
         * switcher, it has to be pickable here. A single-character seat never sees this.
         */
        const buyerPicker = playerActors.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap", padding: "6px 12px", background: "#12121c", borderBottom: "1px solid #2a2a3e" }}>
            <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Acting as</span>
            {playerActors.map(a => {
              const active = a.id === buyer.id;
              return (
                <button key={a.id} type="button" onClick={() => setBuyerActorId(a.id)}
                  title={`${a.name} pays and receives`}
                  style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, cursor: "pointer", fontWeight: active ? 700 : 400,
                    background: active ? "#7b68ee22" : "transparent",
                    border: `1px solid ${active ? "#7b68ee" : "#333"}`,
                    color: active ? "#7b68ee" : "#777" }}>
                  {a.name}
                </button>
              );
            })}
          </div>
        );

        function chooseItem(item: { id: string; name: string }) {
          void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
            type: "fdmc:loot-choice",
            seatId: claimedSeatId,
            offerId: lootOffer!.offerId,
            chosenItemId: item.id,
            actorId: buyer.id,
          } as import("./core/ui/EquipmentLibraryStandalone").LootChoice, { destination: "REMOTE" });
          // One pick per seat in an ordered round — bow out so the stock updates that follow
          // don't re-open the panel on top of you while the rest of the party picks.
          if (ordered) dismissedOfferIds.current.add(lootOffer!.offerId);
          addEntry({ actorName: buyer.name, actionName: "Loot Chosen", tabId: "system", message: `${buyer.name} chose ${item.name}.` });
        }

        /** Take nothing and hand the turn on, so one seat can't stall the whole round. */
        function passOffer() {
          void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
            type: "fdmc:loot-choice",
            seatId: claimedSeatId,
            offerId: lootOffer!.offerId,
            chosenItemId: LOOT_PASS_ID,
            actorId: buyer.id,
          } as import("./core/ui/EquipmentLibraryStandalone").LootChoice, { destination: "REMOTE" });
          dismissedOfferIds.current.add(lootOffer!.offerId);
          setLootOffer(null);
        }

        /** Banner shown to seats waiting their turn in an ordered round. */
        const waitBanner = (
          <div style={{ padding: "8px 12px", background: "#161622", border: "1px solid #2a2a3e", borderRadius: 8, textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "#e0a030" }}>⏳ {waitingOn} is picking…</span>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "#555" }}>The list updates as items are taken. Your turn is next in line.</p>
          </div>
        );

        // Merchant (buy-many) — player's wallet (copper) + what they already own, both reactive.
        const myCoins = roomLiveState.actorLiveState[buyer.id]?.coins ?? {};
        const myCopper = coinsToCopper(myCoins);
        const ownedIds = new Set((buyer.tabs.equipment ?? []).map(e => e.id.replace(/^equip-/, "")));
        function buyItem(item: import("./core/ui/EquipmentBagEditor").EquipmentItem) {
          const costCopper = parsePriceCopper(item.value);
          if (costCopper > myCopper) {
            setLootToast(`✗ Not enough coin for ${item.name} — costs ${formatCopperPrice(costCopper)}, you have ${formatCopperPrice(myCopper)}.`);
            setTimeout(() => setLootToast(null), 4000);
            return;
          }
          void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
            type: "fdmc:loot-choice",
            seatId: claimedSeatId,
            offerId: lootOffer!.offerId,
            chosenItemId: item.id,
            actorId: buyer.id,
            cost: parseGoldCost(item.value),
          } as import("./core/ui/EquipmentLibraryStandalone").LootChoice, { destination: "REMOTE" });
        }

        if (isFinal) {
          // Full-screen pick panel — best for end-of-session rewards
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,14,0.95)", zIndex: 200, display: "flex", flexDirection: "column", padding: 24, gap: 16, overflowY: "auto" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 2 }}>Session Reward</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#fff" }}>🏆 {lootOffer.message}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555" }}>
                  {myTurn ? "Choose one item — it will be added to your equipment." : "Waiting for your turn to pick."}
                </p>
              </div>
              {playerActors.length > 1 && (
                <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a3e" }}>{buyerPicker}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480, margin: "0 auto", width: "100%" }}>
                {!myTurn && waitBanner}
                {lootOffer.items.length === 0 && (
                  <p style={{ textAlign: "center", fontSize: 12, color: "#555", fontStyle: "italic" }}>Everything has been claimed.</p>
                )}
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
                      <button type="button" onClick={() => chooseItem(item)} disabled={!myTurn}
                        title={myTurn ? undefined : `${waitingOn} is picking`}
                        style={{ fontSize: 13, padding: "8px 18px", background: myTurn ? "#7b68ee" : "#1a1a1a", color: myTurn ? "#fff" : "#555", border: myTurn ? "none" : "1px solid #333", borderRadius: 6, cursor: myTurn ? "pointer" : "default", fontWeight: 600, flexShrink: 0 }}>
                        ✓ Choose
                      </button>
                    </div>
                  </div>
                ))}
                {ordered && myTurn && (
                  <button type="button" onClick={passOffer}
                    style={{ fontSize: 12, padding: "7px 18px", background: "transparent", border: "1px solid #444", borderRadius: 6, color: "#888", cursor: "pointer", alignSelf: "center" }}>
                    Pass — take nothing
                  </button>
                )}
              </div>
            </div>
          );
        }

        if (isMerchant) {
          // Merchant: a shop framed like the rest of the app — a titled panel with a sticky
          // header (shop name + wallet) and a sticky footer, not free-floating centred text.
          // Coin uses the equipment accent so it reads as the same family as the equipment
          // tools rather than an unrelated gold.
          const COIN = FDMC_ACCENTS.equipment;
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(6,8,14,0.94)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 12px" }}>
              <div style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: 520, maxHeight: "100%", background: "#0d0d14", border: `1px solid ${COIN}44`, borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
                {/* Header — panel chrome, matching the app's titled surfaces */}
                <div style={{ padding: "10px 14px", background: "#161622", borderBottom: "1px solid #2a2a3e", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 9, color: COIN, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Merchant</p>
                    <p style={{ margin: "1px 0 0", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lootOffer.message}</p>
                  </div>
                  <span title="Your coin purse" style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: COIN, background: `${COIN}1a`, border: `1px solid ${COIN}55`, borderRadius: 20, padding: "4px 12px" }}>
                    {formatCoins(myCoins)}
                  </span>
                </div>

                {buyerPicker}

                {/* Whose turn at the counter */}
                {ordered && (
                  <div style={{ padding: "6px 14px", background: myTurn ? "#16291b" : "#1a1a22", borderBottom: "1px solid #2a2a3e", textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: myTurn ? "#7be08a" : "#e0a030" }}>
                      {myTurn ? "You're at the counter — buy what you need, then hand it on." : `⏳ ${waitingOn} is at the counter…`}
                    </span>
                  </div>
                )}

                {/* Stock */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, overflowY: "auto" }}>
                  <p style={{ margin: 0, fontSize: 10, color: "#555", textAlign: "center" }}>
                    Stock is what this merchant has — once it's bought, it's gone. Coin is deducted and change made as you buy.
                  </p>
                  {lootOffer.items.length === 0 && (
                    <p style={{ margin: "16px 0", textAlign: "center", fontSize: 12, color: "#555", fontStyle: "italic" }}>Sold out — the shelves are bare.</p>
                  )}
                  {lootOffer.items.map(item => {
                    const costCopper = parsePriceCopper(item.value);
                    const owned = ownedIds.has(item.id);
                    const unpriced = costCopper <= 0;
                    const tooPoor = !unpriced && costCopper > myCopper;
                    const buyable = !owned && !tooPoor && !unpriced && myTurn;
                    return (
                    <div key={item.id} style={{ padding: "10px 12px", background: "#161622", borderRadius: 8, border: `1px solid ${buyable ? `${COIN}33` : "#2a2a3e"}`, opacity: owned ? 0.55 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                            <strong style={{ fontSize: 13, color: "#fff" }}>{item.name}</strong>
                            <span style={{ fontSize: 9, color: "#8a8aa0", background: "#22222e", padding: "1px 6px", borderRadius: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.category ?? item.type}</span>
                            {item.tier && <span style={{ fontSize: 9, color: "#7b68ee" }}>{item.tier}</span>}
                            {item.attunementRequired && <span style={{ fontSize: 9, color: "#e07b39" }}>Attunement</span>}
                          </div>
                          {item.description && <p style={{ margin: "0 0 3px", fontSize: 11, color: "#888", lineHeight: 1.45 }}>{item.description}</p>}
                          {item.mechanicsText && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#aaa", lineHeight: 1.45 }}>{item.mechanicsText}</p>}
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {item.attack && <span style={{ fontSize: 10, color: "#7b68ee" }}>⚔ {item.attack}</span>}
                            {item.damage && <span style={{ fontSize: 10, color: "#e07b39" }}>💥 {item.damage}</span>}
                            {item.ac && <span style={{ fontSize: 10, color: "#4caf50" }}>🛡 AC {item.ac}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: unpriced ? "#555" : tooPoor ? "#a06a4a" : COIN, whiteSpace: "nowrap" }}>
                            {unpriced ? "—" : formatCopperPrice(costCopper)}
                          </span>
                          <button type="button" disabled={!buyable} onClick={() => buyItem(item)}
                            title={owned ? "Already in your bag" : unpriced ? "No price set — the DM must price this item" : tooPoor ? "Not enough coin" : !myTurn ? `${waitingOn} is at the counter` : `Buy for ${formatCopperPrice(costCopper)}`}
                            style={{ fontSize: 11, padding: "5px 14px", borderRadius: 5, fontWeight: 600, whiteSpace: "nowrap",
                              background: owned ? "#16291b" : buyable ? `${COIN}22` : "transparent",
                              border: `1px solid ${owned ? "#2f7d3f" : buyable ? `${COIN}77` : "#333"}`,
                              color: owned ? "#7be08a" : buyable ? COIN : "#555",
                              cursor: buyable ? "pointer" : "default" }}>
                            {owned ? "✓ Owned" : unpriced ? "No price" : tooPoor ? "Can't afford" : "Buy"}
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Footer */}
                {/* In an ordered shop "done" is how the counter passes on, so it has to reach
                    the GM — closing the window locally would strand the queue behind you. */}
                <div style={{ padding: "8px 12px", background: "#161622", borderTop: "1px solid #2a2a3e", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
                  <button type="button"
                    onClick={() => {
                      if (ordered && myTurn) passOffer();
                      else { dismissedOfferIds.current.add(lootOffer!.offerId); setLootOffer(null); }
                    }}
                    style={{ fontSize: 11, padding: "5px 16px", background: ordered && myTurn ? `${COIN}22` : "transparent", border: `1px solid ${ordered && myTurn ? `${COIN}77` : "#444"}`, borderRadius: 5, color: ordered && myTurn ? COIN : "#888", cursor: "pointer", fontWeight: ordered && myTurn ? 600 : 400 }}>
                    {ordered && myTurn ? "Done — pass to next player" : "Done shopping"}
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Mid-boss: compact strip above the combat panel, doesn't block view
        return (
          <div style={{ margin: "4px 12px 0", background: "#0d0d14", border: "1px solid #7b68ee44", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "6px 10px", background: "#1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#7b68ee" }}>🎁 {lootOffer.message}</span>
              <span style={{ fontSize: 10, color: myTurn ? "#444" : "#e0a030" }}>
                {myTurn ? "pick one" : `⏳ ${waitingOn} is picking`}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {lootOffer.items.length === 0 && (
                <p style={{ margin: 0, padding: "8px 10px", fontSize: 11, color: "#555", fontStyle: "italic" }}>Everything has been claimed.</p>
              )}
              {lootOffer.items.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#0d0d14" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#ddd" }}>{item.name}</span>
                    <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>{item.category ?? item.type}</span>
                    {item.tier && <span style={{ fontSize: 10, color: "#7b68ee66", marginLeft: 4 }}>{item.tier}</span>}
                  </div>
                  <button type="button" onClick={() => chooseItem(item)} disabled={!myTurn}
                    title={myTurn ? undefined : `${waitingOn} is picking`}
                    style={{ fontSize: 10, padding: "3px 10px", background: myTurn ? "#7b68ee22" : "transparent", border: `1px solid ${myTurn ? "#7b68ee55" : "#333"}`, borderRadius: 4, color: myTurn ? "#7b68ee" : "#555", cursor: myTurn ? "pointer" : "default", flexShrink: 0 }}>
                    Take
                  </button>
                </div>
              ))}
              {ordered && myTurn && (
                <button type="button" onClick={passOffer}
                  style={{ fontSize: 10, padding: "5px 10px", background: "transparent", border: "none", borderTop: "1px solid #1a1a2e", color: "#666", cursor: "pointer" }}>
                  Pass — take nothing
                </button>
              )}
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

        const selected = convergenceSelected;
        const toggle = (id: string) =>
          setConvergenceSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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

      {/* ── Save-required pop-up (everyone) ── */}
      <SavePromptBanner />

      {/* ── Save target picker — choose which combatants must roll, then announce ── */}
      {pendingSave && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <div style={{ background: "#13131f", border: "1px solid #e0a85a", borderRadius: 10, padding: 16, width: "min(420px, 94vw)", maxHeight: "82vh", overflow: "auto" }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#f0c040" }}>⚠ {pendingSave.save} saving throw</p>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#aaa" }}>{pendingSave.source}: {pendingSave.action}. Pick who must roll.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
              {allCombatants.filter(c => !c.isDead && !isOutOfCombat(c)).map(c => {
                const name = c.displayName ?? c.name;
                return (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 4px", cursor: "pointer", borderRadius: 4 }}>
                    <input type="checkbox" checked={saveTargets.has(c.id)}
                      onChange={e => setSaveTargets(prev => { const n = new Set(prev); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
                      style={{ width: 15, height: 15, accentColor: "#e0a85a", cursor: "pointer" }} />
                    <span style={{ color: c.kind === "monster" ? "#ff8a6a" : "#9d8cff" }}>{name}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setSaveTargets(new Set(allCombatants.filter(c => !c.isDead && !isOutOfCombat(c)).map(c => c.id)))}
                style={{ fontSize: 12, padding: "5px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer" }}>Select all</button>
              <button type="button"
                onClick={() => {
                  const names = allCombatants.filter(c => saveTargets.has(c.id)).map(c => c.displayName ?? c.name);
                  broadcastSavePrompt(pendingSave.source, pendingSave.action, pendingSave.save, names);
                  addEntry({ actorName: pendingSave.source, actionName: "Save Call", tabId: "system", tone: "combat",
                    message: `⚠ SAVE — ${pendingSave.source}'s ${pendingSave.action}: ${names.length ? names.join(", ") : "each target"} must make a ${pendingSave.save} saving throw.` });
                  setPendingSave(null);
                }}
                style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "6px 12px", background: "#2a6e2a", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer" }}>
                Call save{saveTargets.size > 0 ? ` (${saveTargets.size})` : " — all"}
              </button>
              <button type="button" onClick={() => setPendingSave(null)}
                style={{ fontSize: 12, padding: "5px 10px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 4, color: "#c77", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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
              <button type="button" onClick={() => void openLevelUpWindow()}
                style={{ fontSize: 10, padding: "1px 6px", background: showLevelUpRequest ? "#7b68ee22" : "transparent", border: "1px solid #7b68ee33", borderRadius: 3, color: "#7b68ee88", cursor: "pointer" }}
                title="Open the level-up window (build presets, step up, submit to DM)">
                ⬆ Level
              </button>
            )}
            {/* Turn-order tracker overlay (Monster Gate B2) — opens ALONGSIDE the
                character card(s); distinct popover id so neither closes the other. */}
            {OBR.isAvailable && (
              <button type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      const url = new URL(window.location.href);
                      url.pathname = url.pathname.replace(/\/[^/]*$/, "/player-tracker.html");
                      url.search = "";
                      const sc = actorToShow ? seatColorById[actorToShow.id] : undefined;
                      if (sc) url.searchParams.set("seatColor", sc);
                      await OBR.popover.open({
                        id: "fdm-player-tracker",
                        url: url.toString(),
                        width: 300,
                        height: 540,
                        anchorReference: "POSITION",
                        anchorPosition: { left: 16, top: 60 },
                        anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
                        transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
                        disableClickAway: true,
                        marginThreshold: 16,
                      });
                    } catch { /* outside OBR there is no overlay */ }
                  })();
                }}
                style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #4caf5033", borderRadius: 3, color: "#4caf5099", cursor: "pointer" }}
                title="Open the turn-order tracker — party HP + monsters, alongside your character card">
                ⚔ Tracker
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


      {/* ── Combat Tracker (Monster Gate B3) — a condensed NAMES + ORDER strip. Only
             appears once a fight is actually staged (a monster is in the roster) or combat
             is running — the party alone no longer keeps it on screen. Full HP / economy /
             swap / bench live in the combat window (DM) and the player tracker overlay. ── */}
      {allCombatants.length > 0
        && (allCombatants.some(c => c.kind === "monster") || roomLiveState.combat.phase === "combat") && (
        <CombatTracker
          condensed
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
          onRollInitiative={handleRollActorInitiativeViaDicePlus}
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
        // The party purse renders inside the card, on a line under the character's wallet.
        partyCoins={getPartyCoins(roomLiveState)}
        onEditPartyCoins={isDmMode ? ((c) => void commitRoomState(patchPartyCoins(roomLiveStateRef.current, c))) : undefined}
        onPartyTransfer={(copper) => {
          // The GM is already the single writer, so they apply their own move directly;
          // a seat asks, and the same guard runs on the GM's copy.
          if (isDmMode) {
            const moved = transferPartyToActor(roomLiveStateRef.current, actorToShow.id, copper);
            if (moved) void commitRoomState(moved);
            return;
          }
          void obrSend(FDMC_SEAT_BROADCAST_CHANNEL, {
            type: "fdmc:request-party-transfer", actorId: actorToShow.id, copper,
          });
        }}
        seatColor={seatColorById[actorToShow.id]}
                seatNames={playerSeatNames}
                onMergeIntoCommittedRoll={(patch) => mergeIntoCommittedRoll(actorToShow.id, patch)}
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
        onResetHp={() => void setActorHp(actorToShow.id, fullHeal(actorToShow.stats.hp))}
        onReadyActionCosts={(costs, readiedKey) => readyActionCosts(actorToShow.id, costs, readiedKey)}
        onUnreadyAction={(readiedKey) => unreadyActionKey(actorToShow.id, readiedKey)}
        onRemovePendingLogEntries={removePendingEntries}
        onResetTurn={handleNextTurn}
        onSetConcentration={(next) => setActorConcentration(actorToShow.id, next)}
        onClearConcentration={() => clearActorConcentration(actorToShow.id)}
        onStartCommittedRoll={(input) => {
          startCommittedRoll(actorToShow.id, input);
          const action = Object.values(actorToShow.tabs).flat().find(a => a.id === input.actionId);
          // Ray 2+ of a multi-roll cast: the slot was already spent on ray 1.
          if (action && !input.continuesMultiRoll) consumeActionResourcesOnCommit({ actorId: actorToShow.id, actorName: actorToShow.name, action, consumeSpellSlot, consumeNamedResource, log: addEntry , resourceLabels: (actorToShow.tabs.resources ?? []).map(r => r.label), castLevel: input.castLevel });
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
        onSpendResource={(rid, amt) => handleSpendResource(actorToShow.id, actorToShow.name, rid, amt)}
        onSpendItemCharge={(a) => consumeActionResourcesOnCommit({ actorId: actorToShow.id, actorName: actorToShow.name, action: a, consumeSpellSlot, consumeNamedResource, consumeItemCharge, log: addEntry, resourceLabels: [] })}
        onRestoreItemCharge={(a) => { const r = restoreItemCharge(actorToShow.id, a); addEntry({ actorName: actorToShow.name, actionName: a.label, tabId: "equipment", message: `${actorToShow.name} regains a charge on ${a.label} (${r.remaining}/${r.max ?? "?"}).` }); }}
        partyMembers={itemTransferTargets(actorToShow.id)}
        onSendItem={(action, toActorId) => requestItemTransfer(actorToShow.id, toActorId, action)}
        onToggleEquipped={(action) => requestEquipToggle(actorToShow.id, action)}
        onSetGrip={(action, grip) => requestGripChange(actorToShow.id, action, grip)}
        combatActive={roomLiveState.combat.phase === "combat"}
        onConsumeActionResources={(action, castLevel) => consumeActionResourcesOnCommit({ actorId: actorToShow.id, actorName: actorToShow.name, action, consumeSpellSlot, consumeNamedResource, consumeItemCharge, log: addEntry , resourceLabels: (actorToShow.tabs.resources ?? []).map(r => r.label), castLevel })}
        onSaveCall={(action, save) => { setSaveTargets(new Set()); setPendingSave({ source: actorToShow.name, action, save }); }}
        coins={roomLiveState.actorLiveState[actorToShow.id]?.coins ?? {}}
        onUpdateCoins={isDmMode ? ((c) => void setActorCoins(actorToShow.id, c)) : undefined}
        onShortRest={() => { resetActorResources(actorToShow.id, "short"); addEntry({ actorName: actorToShow.name, actionName: "Short Rest", tabId: "system", message: `${actorToShow.name} takes a Short Rest — short-rest resources reset. Spend Hit Dice from the Resources tab to heal.` }); }}
        onLongRest={() => { resetActorResources(actorToShow.id, "long"); const m = actorToShow.stats.hp.max; void setActorHp(actorToShow.id, { current: m, max: m, temp: 0 }); addEntry({ actorName: actorToShow.name, actionName: "Long Rest", tabId: "system", message: `${actorToShow.name} takes a Long Rest — HP restored to full and resources reset.` }); }}
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
          onSaveCall={(actionName, save) => { setSaveTargets(new Set()); setPendingSave({ source: activeMonster.displayName, action: actionName, save }); }}
        />
      )}

      {/* ── P8: Boss kill alert ── */}
      {isDmMode && bossKillAlert && (
        <div style={{ margin: "8px 12px", padding: "10px 14px", background: "#1a0a0a", border: "1px solid #8b000088", borderRadius: 6, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#ff9999" }}>
            {bossKillAlert.reason === "combat-end"
              ? `📜 Combat ended — export the log for ${bossKillAlert.encounterName}?`
              : `⚔ ${bossKillAlert.name} defeated — export encounter log?`}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button"
              onClick={() => {
                const summary = generatePostCombatSummary(readEncounterLog(), bossKillAlert.encounterId, bossKillAlert.encounterName);
                downloadExport(exportSummaryAsText(summary), exportFilename(summary.encounterName, summary.completedAt));
              }}
              style={{ fontSize: 11, padding: "4px 12px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Export Log</button>
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
            obrPlayers={obrPlayers}
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
            partyCount={Object.keys(actorLibrary).length}
            onWipeParty={async () => {
              // BACK UP FIRST. The wipe clears the local party layers AND the room-metadata
              // wallets, and coin has no other home — so without this, a wipe is the one
              // action that can destroy gold outright with nothing to restore from.
              takeSnapshot(APP_VERSION, walletsFromRoomState(roomLiveState), "before-wipe");
              // Clear every LOCAL layer keyed to party characters.
              const report = wipePartyLocalData();
              // …then the SHARED layer: live HP / temp / coins / initiative in room
              // metadata. Read fresh so a concurrent dm-panel write isn't clobbered.
              const fresh = await readFdmcRoomStateKey(FDMC_ROOM_LIVE_STATE_KEY, normalizeFdmcRoomLiveState);
              const base = fresh ?? roomLiveState;
              const cleared = {
                ...buildClearedActorLiveState(base),
                revision: base.revision + 1,
                updatedAt: Date.now(),
              };
              await commitRoomState(cleared);
              // Drop the in-memory copies so the UI reflects the wipe immediately.
              setActorLibrary({});
              setActorOverrides({});
              setSelectedActorId("");
              setFocusedActorId(null);
              pushActorsToAllSeats();
              // Tell the other DM windows (dm-panel, popouts) to reload from storage.
              if (OBR.isAvailable) {
                void obrSend(DM_LIBRARY_UPDATED_CHANNEL, { type: "fdmc:dm-library-updated" }, { destination: "LOCAL" }).catch(() => undefined);
              }
              addEntry({
                actorName: "System", actionName: "Party wiped", tabId: "system",
                message: `Removed ${report.actorIds.length} party character(s) and cleared ${report.cleared.length} stored layer(s) + live actor state. Ready for a clean import.`,
              });
              return `Removed ${report.actorIds.length} character(s): ${report.actorIds.join(", ") || "none"}. Cleared ${report.cleared.length} storage layer(s) + live HP/coins. Import your file now — nothing will leak through.`;
            }}
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
                seatNames={playerSeatNames}
                onMergeIntoCommittedRoll={(patch) => mergeIntoCommittedRoll(focusedActor.id, patch)}
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
                onResetHp={() => void setActorHp(focusedActorId, fullHeal(focusedActor.stats.hp))}
                onReadyActionCosts={(costs, readiedKey) => readyActionCosts(focusedActorId, costs, readiedKey)}
                onUnreadyAction={(readiedKey) => unreadyActionKey(focusedActorId, readiedKey)}
                onRemovePendingLogEntries={removePendingEntries}
                onResetTurn={() => { resetActorTurn(focusedActorId); setTurnResetVersion(v => v + 1); }}
                onSetConcentration={(next) => setActorConcentration(focusedActorId, next)}
                onClearConcentration={() => clearActorConcentration(focusedActorId)}
                onStartCommittedRoll={(input) => {
                  startCommittedRoll(focusedActorId, input);
                  const action = Object.values(focusedActor.tabs).flat().find(a => a.id === input.actionId);
                  // Ray 2+ of a multi-roll cast: the slot was already spent on ray 1.
          if (action && !input.continuesMultiRoll) consumeActionResourcesOnCommit({ actorId: focusedActorId, actorName: focusedActor.name, action, consumeSpellSlot, consumeNamedResource, log: addEntry , resourceLabels: (focusedActor.tabs.resources ?? []).map(r => r.label), castLevel: input.castLevel });
                }}
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
                onSpendResource={(rid, amt) => handleSpendResource(focusedActorId, focusedActor.name, rid, amt)}
                onSpendItemCharge={(a) => consumeActionResourcesOnCommit({ actorId: focusedActorId, actorName: focusedActor.name, action: a, consumeSpellSlot, consumeNamedResource, consumeItemCharge, log: addEntry, resourceLabels: [] })}
                onRestoreItemCharge={(a) => { const r = restoreItemCharge(focusedActorId, a); addEntry({ actorName: focusedActor.name, actionName: a.label, tabId: "equipment", message: `${focusedActor.name} regains a charge on ${a.label} (${r.remaining}/${r.max ?? "?"}).` }); }}
                partyMembers={itemTransferTargets(focusedActorId)}
                onSendItem={(action, toActorId) => requestItemTransfer(focusedActorId, toActorId, action)}
                onToggleEquipped={(action) => requestEquipToggle(focusedActorId, action)}
                onSetGrip={(action, grip) => requestGripChange(focusedActorId, action, grip)}
                combatActive={roomLiveState.combat.phase === "combat"}
                onConsumeActionResources={(action, castLevel) => consumeActionResourcesOnCommit({ actorId: focusedActorId, actorName: focusedActor.name, action, consumeSpellSlot, consumeNamedResource, consumeItemCharge, log: addEntry , resourceLabels: (focusedActor.tabs.resources ?? []).map(r => r.label), castLevel })}
                onSaveCall={(action, save) => { setSaveTargets(new Set()); setPendingSave({ source: focusedActor.name, action, save }); }}
                coins={roomLiveState.actorLiveState[focusedActorId]?.coins ?? {}}
                onUpdateCoins={isDmMode ? ((c) => void setActorCoins(focusedActorId, c)) : undefined}
                onShortRest={() => { resetActorResources(focusedActorId, "short"); addEntry({ actorName: focusedActor.name, actionName: "Short Rest", tabId: "system", message: `${focusedActor.name} takes a Short Rest — short-rest resources reset. Spend Hit Dice from the Resources tab to heal.` }); }}
                onLongRest={() => { resetActorResources(focusedActorId, "long"); const m = focusedActor.stats.hp.max; void setActorHp(focusedActorId, { current: m, max: m, temp: 0 }); addEntry({ actorName: focusedActor.name, actionName: "Long Rest", tabId: "system", message: `${focusedActor.name} takes a Long Rest — HP restored to full and resources reset.` }); }}
                onLog={addEntry}
              />
            </div>
          </div>
        );
      })()}

    </main>
  );
}
