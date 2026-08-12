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

import { FDMC_CHANNELS } from "./core/constants/channels";
import { FDMC_STORAGE_KEYS } from "./core/constants/storageKeys";
import { FDMC_ACCENTS } from "./core/constants/theme";
import appManifest from "../public/manifest.json";

const APP_VERSION = appManifest.version;

const DM_LIBRARY_UPDATED_CHANNEL = FDMC_CHANNELS.dmLibraryUpdated;

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
  patchActorHp,
  patchActorGold,
  grantActorCoin,
  patchActorCoins,
  getActorCoins,
  walletsFromRoomState,
  PARTY_WALLET_SEAT_ID,
  getPartyCoins,
  patchPartyCoins,
  grantPartyCoin,
  type FdmcRoomLiveState,
} from "./core/table-state/fdmcRoomLiveState";
import { setCoin, type CoinType, type Coins } from "./core/currency/currency";
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
import { loadEquipmentLibrary, saveEquipmentLibrary, seedCampaignEquipmentLibrary, seedBaseWeapons, itemToAction, itemToAttackAction, type EquipmentItem } from "./core/ui/EquipmentBagEditor";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS } from "./data/broken-chain/equipmentLibrary";
import { EquipmentLibraryStandalone, ConvergenceApprovalPanel, isConvergenceRequest, type ConvergenceRequest } from "./core/ui/EquipmentLibraryStandalone";
import { LevelUpApprovalPanel, isLevelUpRequest, type LevelUpRequest } from "./core/ui/LevelUpRequestPanel";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "./core/seats/seatTypes";
import { buildActorSeatColorMap, withAlpha } from "./core/seats/seatColors";
import { TokenAssignmentPanel } from "./core/tokens/TokenAssignmentPanel";
import { loadMonsterRoster } from "./core/monsters/runtime/monsterRosterStorage";
import "./styles.css";

// ─── Panel type ───────────────────────────────────────────────────────────────

type PanelId = "editActors" | "seats" | "monsters" | "equipment" | "tokens" | "maintenance" | "library" | "seatTokens" | "approvals";

const PANEL_TITLES: Record<PanelId, string> = {
  editActors: "Party Characters",
  seats: "Player Seats",
  monsters: "Monsters & Encounters",
  equipment: "Equipment Library",
  tokens: "Token Assignment",
  maintenance: "Settings & Data",
  library: "Library",
  seatTokens: "Seats & Tokens",
  approvals: "DM Approvals",
};

// Per-panel accent color — drives the header stripe + title so each DM tool reads
// as its own space instead of "purple text on black" everywhere (P-UX1). Pulled
// from the shared accent tokens so the DM chrome stays consistent.
const PANEL_ACCENT: Record<PanelId, string> = {
  editActors: FDMC_ACCENTS.use,       // party characters → blue
  seats: FDMC_ACCENTS.seats,          // seats → green
  monsters: FDMC_ACCENTS.monster,     // monsters → GM red
  equipment: FDMC_ACCENTS.equipment,  // equipment → gold
  tokens: FDMC_ACCENTS.fix,           // tokens → cyan
  maintenance: FDMC_ACCENTS.fix,      // fix-it → cyan
  library: FDMC_ACCENTS.use,          // library → blue
  seatTokens: FDMC_ACCENTS.seats,     // seats & tokens → green
  approvals: FDMC_ACCENTS.approval,   // approvals → amber
};

// Library sub-tab accents (Party Characters / Monsters / Equipment).
const LIB_TAB_ACCENT: Record<"actors" | "monsters" | "equipment", string> = {
  actors: FDMC_ACCENTS.use, monsters: FDMC_ACCENTS.monster, equipment: FDMC_ACCENTS.equipment,
};
// Seats & Tokens sub-tab accents.
const SEATTOK_TAB_ACCENT: Record<"seats" | "tokens", string> = {
  seats: FDMC_ACCENTS.seats, tokens: FDMC_ACCENTS.fix,
};

function getPanelFromUrl(): PanelId {
  const param = new URLSearchParams(window.location.search).get("panel");
  const valid: PanelId[] = ["editActors", "seats", "monsters", "equipment", "tokens", "maintenance", "library", "seatTokens", "approvals"];
  return valid.includes(param as PanelId) ? (param as PanelId) : "editActors";
}

// ─── DM Panel App ─────────────────────────────────────────────────────────────

function DmPanelApp() {
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

  const panelId = useMemo(() => getPanelFromUrl(), []);
  // create= jumps straight into the right creator (set by the main DM toolbar).
  const createParam = useMemo(() => new URLSearchParams(window.location.search).get("create"), []);

  // ── Seed campaign equipment library on first DM panel open ────────────────
  useMemo(() => { seedCampaignEquipmentLibrary(BROKEN_CHAIN_EQUIPMENT_LIBRARY, RETIRED_EQUIPMENT_IDS); seedBaseWeapons(); }, []);

  // ── Token panel: monster roster from localStorage ─────────────────────────
  const [tokenPanelMonsters] = useState(() => loadMonsterRoster());

  // ── Actor library ──────────────────────────────────────────────────────────
  const [actorLibrary, setActorLibrary] = useState<Record<string, Actor>>(() =>
    seedLibraryFromBundled(brokenChainActors)
  );
  const [actorOverrides, setActorOverrides] = useState(() => loadActorOverrides());
  const actors = useMemo(
    () => Object.values(actorLibrary).map(a =>
      resolveActorFromLibrary(a.id, actorLibrary, actorOverrides) ?? a
    ),
    [actorLibrary, actorOverrides]
  );
  // Candidate owners for the Companion "Owner" dropdown in the actor editor.
  const ownerOptions = useMemo(
    () => Object.values(actorLibrary)
      .filter(a => a.kind === "player")
      .map(a => ({ id: a.id, name: a.name })),
    [actorLibrary]
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

  // ── Approvals inbox — level-up + convergence ─────────────────────────────
  const LEVEL_UP_STORAGE_KEY = FDMC_STORAGE_KEYS.pendingLevelUpRequests;

  const [levelUpRequests, setLevelUpRequests] = useState<LevelUpRequest[]>(() => {
    try {
      const stored = localStorage.getItem(LEVEL_UP_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as LevelUpRequest[]) : [];
    } catch { return []; }
  });
  const [pendingConvergenceRequests, setPendingConvergenceRequests] = useState<ConvergenceRequest[]>([]);
  const [convergenceApprovalReq, setConvergenceApprovalReq] = useState<ConvergenceRequest | null>(null);

  // Cross-window sync: when another DM panel popover approves/clears a request,
  // it writes the updated list to localStorage. The storage event fires in all
  // other same-origin tabs/popovers — we re-read and sync React state so the
  // badge disappears everywhere, not just in the window that did the approval.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== LEVEL_UP_STORAGE_KEY) return;
      try {
        const next = event.newValue ? (JSON.parse(event.newValue) as LevelUpRequest[]) : [];
        setLevelUpRequests(next);
      } catch { /* ignore malformed */ }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [LEVEL_UP_STORAGE_KEY]);

  useEffect(() => {
    if (!OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data as unknown;
      if (isLevelUpRequest(msg)) {
        setLevelUpRequests(prev => {
          const filtered = prev.filter(r => r.actorId !== msg.actorId);
          const next = [...filtered, msg];
          try { localStorage.setItem(LEVEL_UP_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
      }
      if (isConvergenceRequest(msg)) {
        setPendingConvergenceRequests(prev => {
          if (prev.find(r => r.offerId === msg.offerId && r.seatId === msg.seatId)) return prev;
          return [...prev, msg];
        });
      }
    });
  }, []);

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
    // otherwise the level-up reverts on the next Sync/reload. upsertActorInLibrary reads
    // fresh localStorage so it never clobbers actors added in another window.
    upsertActorInLibrary(finalActor);
    setActorLibrary(lib => { const next = { ...lib, [request.actorId]: finalActor }; saveActorLibrary(next); return next; });

    // Sync level-up HP to live state — new max HP must win over old live HP
    const currentLiveHp = roomLiveState.actorLiveState[request.actorId]?.hp;
    const editedHp = finalActor.stats.hp;
    if (!currentLiveHp || editedHp.max !== currentLiveHp.max || editedHp.current !== currentLiveHp.current) {
      void commitRoomState(patchActorHp(roomLiveState, request.actorId, editedHp));
    }

    pushActorsToAllSeats({ freshOverrides });
    // Tell the main window (and any Co-DM card view) to reload library + overrides from
    // localStorage — without this the DM's own card stays on the pre-level-up actor until
    // a manual ↺ Sync. Every other dm-panel save already does this.
    broadcastLibraryUpdate();
    setLevelUpRequests(prev => {
      const next = prev.filter(r => r.actorId !== request.actorId);
      try { localStorage.setItem(LEVEL_UP_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (OBR.isAvailable) {
      void OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:level-up-response",
        actorId: request.actorId,
        seatId: request.seatId,
        approved: true,
      }, { destination: "REMOTE" });
    }
  }

  function handleLevelUpReject(request: LevelUpRequest, reason: string) {
    setLevelUpRequests(prev => {
      const next = prev.filter(r => r.actorId !== request.actorId);
      try { localStorage.setItem(LEVEL_UP_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (OBR.isAvailable) {
      void OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:level-up-rejected",
        actorId: request.actorId,
        seatId: request.seatId,
        reason,
      }, { destination: "REMOTE" });
    }
  }

  async function handleDeliverLoot(seatId: string, item: EquipmentItem, message: string) {
    const seat = seats[seatId];
    const actorId = seat?.primaryActorId;
    const actor = actorId ? actorLibrary[actorId] : undefined;

    if (actor) {
      // Delivered loot lands in the bag — see itemToAction. The player equips it.
      const equipEntry = itemToAction(item, false);
      const newEquipment = [...(actor.tabs.equipment ?? []), equipEntry];
      // Weapons also get a rollable attack action in the main (Actions) tab
      const newMain = [...(actor.tabs.main ?? [])];
      if (item.attack || item.damage) {
        const atkEntry = itemToAttackAction(item);
        if (!newMain.some(a => a.id === atkEntry.id)) {
          newMain.push(atkEntry);
        }
      }
      const updatedActor = {
        ...actor,
        tabs: { ...actor.tabs, equipment: newEquipment, main: newMain },
      };
      const freshLib = { ...actorLibrary, [updatedActor.id]: updatedActor };
      upsertActorInLibrary(updatedActor);
      setActorLibrary(() => freshLib);
      pushActorsToSeat(seatId, { freshLibrary: freshLib });
    }

    if (OBR.isAvailable) {
      await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:loot-attached",
        seatId,
        itemName: item.name,
        message,
      }, { destination: "REMOTE" });
    }
  }

  // Boss haul — attach SEVERAL items to one seat's primary actor in a single push.
  async function handleDeliverLootBundle(seatId: string, items: EquipmentItem[], message: string) {
    const seat = seats[seatId];
    const actorId = seat?.primaryActorId;
    const actor = actorId ? actorLibrary[actorId] : undefined;
    if (actor && items.length > 0) {
      const newEquipment = [...(actor.tabs.equipment ?? [])];
      const newMain = [...(actor.tabs.main ?? [])];
      for (const item of items) {
        newEquipment.push(itemToAction(item, false));
        if (item.attack || item.damage) {
          const atkEntry = itemToAttackAction(item);
          if (!newMain.some(a => a.id === atkEntry.id)) newMain.push(atkEntry);
        }
      }
      const updatedActor = { ...actor, tabs: { ...actor.tabs, equipment: newEquipment, main: newMain } };
      const freshLib = { ...actorLibrary, [updatedActor.id]: updatedActor };
      upsertActorInLibrary(updatedActor);
      setActorLibrary(() => freshLib);
      pushActorsToSeat(seatId, { freshLibrary: freshLib });
    }
    if (OBR.isAvailable) {
      await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:loot-attached",
        seatId,
        itemName: `${items.length} item${items.length === 1 ? "" : "s"}`,
        message,
      }, { destination: "REMOTE" });
    }
  }

  // Grant currency to a seat's primary actor. mode "add" = adjust the coin; "set" = absolute. coin defaults to gp.
  function handleSendGold(seatId: string, amount: number, mode: "add" | "set", coin: CoinType = "gp") {
    // The party purse is an entry in the same picker, so it lands here first — campaign gold
    // belongs to the group, not to whichever character happened to be selected.
    if (seatId === PARTY_WALLET_SEAT_ID) {
      void commitRoomState(mode === "add"
        ? grantPartyCoin(roomLiveState, coin, amount)
        : patchPartyCoins(roomLiveState, setCoin(getPartyCoins(roomLiveState), coin, amount)));
      return;
    }
    const seat = seats[seatId];
    const actorId = seat?.primaryActorId;
    if (!actorId) return;
    if (mode === "add") {
      void commitRoomState(grantActorCoin(roomLiveState, actorId, coin, amount));
    } else {
      const next = setCoin(getActorCoins(roomLiveState, actorId), coin, amount);
      void commitRoomState(patchActorCoins(roomLiveState, actorId, next));
    }
  }

  async function handleConvergenceApprove(req: ConvergenceRequest, outputItemId: string) {
    const allItems = [...loadEquipmentLibrary("campaign"), ...loadEquipmentLibrary("dm")];
    const outputItem = allItems.find(i => i.id === outputItemId);
    if (!outputItem) return;
    await handleDeliverLoot(req.seatId, outputItem, `Convergence complete — ${outputItem.name} has been forged. Remove your submitted items from your equipment bag.`);
    setPendingConvergenceRequests(prev => prev.filter(r => !(r.offerId === req.offerId && r.seatId === req.seatId)));
    setConvergenceApprovalReq(null);
  }

  async function handleConvergenceDeny(req: ConvergenceRequest) {
    if (OBR.isAvailable) {
      await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, {
        type: "fdmc:convergence-denied",
        seatId: req.seatId,
        offerId: req.offerId,
        reason: "DM declined the convergence request.",
      }, { destination: "REMOTE" });
    }
    setPendingConvergenceRequests(prev => prev.filter(r => !(r.offerId === req.offerId && r.seatId === req.seatId)));
    setConvergenceApprovalReq(null);
  }

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
  // create=actor opens the guided Party Character creator immediately.
  const [editingActorId, setEditingActorId] = useState<string | null>(createParam === "actor" ? "__new__" : null);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  // lootEncounter= arrives when the monster panel's "Create loot for encounter" button
  // reopens the panel on the equipment tab pre-tagged to that loot pool.
  const lootEncounterParam = useMemo(() => new URLSearchParams(window.location.search).get("lootEncounter") ?? undefined, []);
  // Library tab: actors | monsters | equipment — honor the create= / lootEncounter= hint
  const [libraryTab, setLibraryTab] = useState<"actors" | "monsters" | "equipment">(
    lootEncounterParam ? "equipment"
      : createParam === "monster" ? "monsters"
      : createParam === "equipment" ? "equipment"
      : "actors"
  );
  // Equipment loot-pool create flow: preset tag + a signal that re-opens the creator.
  const [equipPreset, setEquipPreset] = useState<string | undefined>(lootEncounterParam);
  const [equipCreateSignal, setEquipCreateSignal] = useState(0);
  // P-UX4 Phase 5: Library "+ Create Monster" trigger (bump opens the band picker).
  const [monsterCreateSignal, setMonsterCreateSignal] = useState(0);

  // Open the equipment creator pre-tagged to a loot pool (from the encounter editor).
  // Switches to the Equipment tab and bumps the signal so the New Item form opens with
  // the encounter name pre-filled — the in-app tie between encounters and loot creation.
  const handleCreateLootForEncounter = useCallback((lootPoolName: string) => {
    setEquipPreset(lootPoolName);
    setLibraryTab("equipment");
    setEquipCreateSignal(s => s + 1);
  }, []);
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

  /**
   * Every actor's purse, for the backup file.
   *
   * Coin is room metadata rather than localStorage, so it is the one thing the old export
   * left behind — a wipe and reimport brought back the sheets and gear and quietly zeroed
   * everyone's gold.
   */
  /** Every purse, for the backup file. Shared helper — see walletsFromRoomState. */
  function currentWallets(): Record<string, Coins> {
    return walletsFromRoomState(roomLiveState);
  }

  function handleExport() {
    exportActorLibrary(APP_VERSION, currentWallets());
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void importActorLibrary(file).then(result => {
      setImportResult(result);
      if (result.ok) {
        setActorLibrary(loadActorLibrary());
        broadcastLibraryUpdate();
        // Purses go back through the normal room-state commit — the GM is still the only
        // writer, the import just supplies the values.
        const wallets = result.wallets ?? {};
        if (Object.keys(wallets).length) {
          let next = roomLiveState;
          for (const [actorId, coins] of Object.entries(wallets)) next = patchActorCoins(next, actorId, coins);
          void commitRoomState(next);
        }
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
    setActorOverrides(freshOverrides);

    // Sync edited HP to live state — resolveActor's live-HP-wins rule would
    // otherwise discard the DM's HP change silently.
    const currentLiveHp = roomLiveState.actorLiveState[editedActor.id]?.hp;
    const editedHp = editedActor.stats.hp;
    if (!currentLiveHp || editedHp.max !== currentLiveHp.max || editedHp.current !== currentLiveHp.current) {
      void commitRoomState(patchActorHp(roomLiveState, editedActor.id, editedHp));
    }

    // Pass fresh data so seat-system refs don't hold stale library
    pushActorsToAllSeats({ freshLibrary: freshLib, freshOverrides });
    broadcastLibraryUpdate();
    setEditingActorId(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const title = PANEL_TITLES[panelId];

  // actorId → seat color, so the library shows which character belongs to which seat (P-UX1).
  const actorSeatColor = buildActorSeatColorMap(seats);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#0d0d14", color: "#fff" }}>
      {/* Header — accent stripe + title colored by panel type */}
      <div style={{ padding: "8px 14px", borderTop: `3px solid ${PANEL_ACCENT[panelId]}`, borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d0d14", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, color: PANEL_ACCENT[panelId] }}>{title}</h2>
          {(levelUpRequests.length + pendingConvergenceRequests.length) > 0 && panelId !== "approvals" && (
            <a href={`?panel=approvals`} style={{ background: "#7b68ee", color: "#fff", borderRadius: 10, padding: "1px 9px", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
              ⬆ {levelUpRequests.length + pendingConvergenceRequests.length} Pending
            </a>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              // Bump revision so publishFdmcRoomStateKey's early-return guard passes,
              // then push all actor definitions to all seats via broadcast.
              void commitRoomState({ ...roomLiveState, revision: roomLiveState.revision + 1, updatedAt: Date.now() })
                .then(() => pushActorsToAllSeats());
            }}
            style={{ fontSize: 11, padding: "2px 9px", background: "#2a3a2a", border: "1px solid #4caf5055", borderRadius: 3, color: "#4caf50", cursor: "pointer", fontWeight: 600 }}
            title="Force-publish room metadata and re-push all actor cards to every seated player"
          >
            ⚡ Force Push
          </button>
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
            <ActorEditor mode="create-new" ownerOptions={ownerOptions} onSave={handleActorEditorSave} onCancel={() => setEditingActorId(null)} />
          ) : editingActorId ? (
            (() => {
              const actor = actors.find(a => a.id === editingActorId);
              if (!actor) return <p style={{ padding: 14 }}>Actor not found.</p>;
              return <ActorEditor actor={actor} mode="edit-current" ownerOptions={ownerOptions} onSave={handleActorEditorSave} onCancel={() => setEditingActorId(null)} />;
            })()
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                  {actors.length === 0 ? "No Party Characters yet." : `${actors.length} Party Character${actors.length === 1 ? "" : "s"}`}
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
                    style={{ fontSize: 12, padding: "4px 12px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>
                    + Create Party Character
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
                    <p style={{ fontSize: 12, color: "#555", margin: 0 }}>No Party Characters in your library.</p>

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
                      — or — use Create Party Character to build from scratch
                    </p>
                  </div>
                ) : actors.map(actor => {
                  const seatColor = actorSeatColor[actor.id];
                  return (
                  <div key={actor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: seatColor ? withAlpha(seatColor, 0.06) : "#161622", borderRadius: 8, marginBottom: 8, border: "1px solid #2a2a3e", borderLeft: `4px solid ${seatColor ?? "#2a2a3e"}` }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{actor.name || "Unnamed"}</span>
                      {seatColor && <span title="Assigned to a seat" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: seatColor, marginLeft: 8 }} />}
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
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── Seats ── */}
        {panelId === "seats" && (
          <SeatAssignmentPanel
              obrPlayers={obrPlayers}
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
            onCreateLootForEncounter={(lootPoolName) => {
              // Standalone monsters panel has no sibling equipment tab — reopen this
              // window on the Library/Equipment tab pre-tagged to the loot pool.
              const u = new URL(window.location.href);
              u.searchParams.set("panel", "library");
              u.searchParams.set("create", "equipment");
              u.searchParams.set("lootEncounter", lootPoolName);
              window.location.href = u.toString();
            }}
            onLoadEncounter={(instances) => {
              // Write instances to localStorage queue — App.tsx reads on broadcast
              try {
                const existing = JSON.parse(window.localStorage.getItem(FDMC_STORAGE_KEYS.encounterLoadQueue) ?? "[]") as unknown[];
                window.localStorage.setItem(
                  FDMC_STORAGE_KEYS.encounterLoadQueue,
                  JSON.stringify([...existing, ...instances])
                );
              } catch { /* ok */ }
              if (OBR.isAvailable) {
                void OBR.broadcast.sendMessage(
                  FDMC_CHANNELS.encounterLoadRequest,
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
          <EquipmentLibraryStandalone
            seats={Object.values(seats)}
            externalConvergenceRequests={pendingConvergenceRequests}
            onExternalConvergenceApprove={handleConvergenceApprove}
            onExternalConvergenceDeny={handleConvergenceDeny}
            onDeliverLoot={handleDeliverLoot}
            onDeliverLootBundle={handleDeliverLootBundle}
            onSendGold={handleSendGold}
          />
        )}

        {/* ── Unified Approvals Inbox ── */}
        {panelId === "approvals" && (() => {
          const seatList = Object.values(seats);
          const campaignLib = loadEquipmentLibrary("campaign");
          const dmLib = loadEquipmentLibrary("dm");

          if (convergenceApprovalReq) {
            return (
              <ConvergenceApprovalPanel
                req={convergenceApprovalReq}
                campaignLib={campaignLib}
                dmLib={dmLib}
                seats={seatList}
                onApprove={async (req, outputItemId) => { await handleConvergenceApprove(req, outputItemId); }}
                onDeny={async (req) => { await handleConvergenceDeny(req); }}
                onBack={() => setConvergenceApprovalReq(null)}
              />
            );
          }

          const totalPending = levelUpRequests.length + pendingConvergenceRequests.length;
          return (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", fontSize: 12, color: "#888", flexShrink: 0 }}>
                {totalPending === 0 ? "No pending approvals." : `${totalPending} pending approval${totalPending === 1 ? "" : "s"}`}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>

                {/* Level-up requests */}
                {levelUpRequests.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 10, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1 }}>
                      ⬆ Level-Up Requests ({levelUpRequests.length})
                    </p>
                    {levelUpRequests.map(req => (
                      <LevelUpApprovalPanel
                        key={req.actorId}
                        request={req}
                        currentActor={actors.find(a => a.id === req.actorId)}
                        onApprove={handleLevelUpApprove}
                        onReject={handleLevelUpReject}
                      />
                    ))}
                  </div>
                )}

                {/* Convergence requests */}
                {pendingConvergenceRequests.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 10, color: "#4caf50", textTransform: "uppercase", letterSpacing: 1 }}>
                      ◈ Convergence Forge Requests ({pendingConvergenceRequests.length})
                    </p>
                    {pendingConvergenceRequests.map(req => {
                      const seat = seatList.find(s => s.seatId === req.seatId);
                      const allItems = [...campaignLib, ...dmLib];
                      const submittedNames = req.submittedItemNames.length > 0
                        ? req.submittedItemNames
                        : req.submittedItemIds.map(id => allItems.find(i => i.id === id)?.name ?? id);
                      return (
                        <div key={`${req.offerId}-${req.seatId}`}
                          style={{ background: "#0d1a0d", border: "1px solid #2a6e2a66", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#4caf50" }}>{req.actorName ?? seat?.label ?? req.seatId}</span>
                              <span style={{ fontSize: 11, color: "#666", marginLeft: 6 }}>wants to forge</span>
                              <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                                Submitting: {submittedNames.join(" + ")}
                              </div>
                            </div>
                            <button type="button" onClick={() => setConvergenceApprovalReq(req)}
                              style={{ fontSize: 12, padding: "6px 14px", background: "#1a2a1a", border: "1px solid #4caf5055", borderRadius: 6, color: "#4caf50", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                              Review →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {totalPending === 0 && (
                  <p style={{ fontSize: 12, color: "#444", fontStyle: "italic", marginTop: 20, textAlign: "center" }}>
                    All clear — no approvals waiting.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

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
              backup={{
                version: APP_VERSION,
                getWallets: currentWallets,
                // A restore only writes local storage; the purses come back as data and are
                // published here, so the GM remains the single writer of room state.
                onRestored: (result) => {
                  setActorLibrary(loadActorLibrary());
                  broadcastLibraryUpdate();
                  const wallets = result.wallets ?? {};
                  if (Object.keys(wallets).length) {
                    let next = roomLiveState;
                    for (const [actorId, coins] of Object.entries(wallets)) next = patchActorCoins(next, actorId, coins);
                    void commitRoomState(next);
                  }
                },
                extraActions: (
                  <button type="button" onClick={handleExport}
                    style={{ fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #7db1ff55", borderRadius: 4, color: "#7db1ff", cursor: "pointer" }}
                    title="Download the full library — actors, overrides, equipment and wallets — as a file">
                    Export Library File
                  </button>
                ),
              }}
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
            <div style={{ display: "flex", gap: 6, padding: "6px 14px", borderBottom: "1px solid #2a2a3e", flexShrink: 0 }}>
              {(["actors", "monsters", "equipment"] as const).map(tab => {
                const accent = LIB_TAB_ACCENT[tab];
                const active = libraryTab === tab;
                return (
                  <button key={tab} type="button" onClick={() => setLibraryTab(tab)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 12px", borderRadius: 5, cursor: "pointer",
                      border: `1px solid ${active ? accent : "#2a2a3e"}`,
                      background: active ? accent : "transparent",
                      color: active ? "#0d0d14" : accent, fontWeight: active ? 700 : 500 }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#0d0d14" : accent }} />
                    {tab === "actors" ? "Party Characters" : tab === "monsters" ? "Monsters" : "Equipment"}
                  </button>
                );
              })}
            </div>
            {/* P-UX4 Phase 5: creation lives in the Library (the top toolbar's Create
                buttons are hidden once content exists). Colored per type. */}
            <div style={{ padding: "6px 14px", borderBottom: "1px solid #1a1a2e", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
              {libraryTab === "actors" && (
                <button type="button" onClick={() => setEditingActorId("__new__")}
                  style={{ fontSize: 12, padding: "4px 12px", background: "#16351f", border: "1px solid #2a6e3f", borderRadius: 5, color: "#7be08a", cursor: "pointer", fontWeight: 600 }}>+ Create Party Character</button>
              )}
              {libraryTab === "monsters" && (
                <button type="button" onClick={() => setMonsterCreateSignal(s => s + 1)}
                  style={{ fontSize: 12, padding: "4px 12px", background: "#351616", border: "1px solid #6e2a2a", borderRadius: 5, color: "#e08a8a", cursor: "pointer", fontWeight: 600 }}>+ Create Monster</button>
              )}
              {libraryTab === "equipment" && (
                <button type="button" onClick={() => setEquipCreateSignal(s => s + 1)}
                  style={{ fontSize: 12, padding: "4px 12px", background: "#2a2510", border: "1px solid #6e5a20", borderRadius: 5, color: "#e0c060", cursor: "pointer", fontWeight: 600 }}>+ Create Equipment</button>
              )}
              <span style={{ fontSize: 10, color: "#555" }}>Library = load &amp; edit what exists · use <strong style={{ color: "#7b68ee" }}>+ Create</strong> to build something new.</span>
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {libraryTab === "actors" && (
                editingActorId === "__new__" ? (
                  <ActorEditor mode="create-new" ownerOptions={ownerOptions} onSave={handleActorEditorSave} onCancel={() => setEditingActorId(null)} />
                ) : editingActorId ? (
                  (() => {
                    const actor = actors.find(a => a.id === editingActorId);
                    if (!actor) return <p style={{ padding: 14 }}>Actor not found.</p>;
                    return <ActorEditor actor={actor} mode="edit-current" ownerOptions={ownerOptions} onSave={handleActorEditorSave} onCancel={() => setEditingActorId(null)} />;
                  })()
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: "#888" }}>{actors.length} Party Character{actors.length === 1 ? "" : "s"}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {actors.length > 0 && <button type="button" onClick={handleExport} style={{ fontSize: 11, padding: "3px 9px", background: "#2a3a2a", color: "#4caf50", border: "1px solid #2a6e2a55", borderRadius: 4, cursor: "pointer" }}>↓ Export</button>}
                        <label style={{ fontSize: 11, padding: "3px 9px", background: "#2a2a3e", color: "#aaa", border: "1px solid #444", borderRadius: 4, cursor: "pointer" }}>
                          ↑ Import<input type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} />
                        </label>
                        {/* Manage view — create is driven by the toolbar's "+ Party Character" button. */}
                      </div>
                    </div>
                    {importResult && (
                      <div style={{ padding: "4px 14px", background: importResult.ok ? "#0d1a0d" : "#1a0a0a", fontSize: 11, color: importResult.ok ? "#4caf50" : "#ff9999", flexShrink: 0 }}>
                        {importResult.ok ? "✓" : "✕"} {importResult.message}
                        <button type="button" onClick={() => setImportResult(null)} style={{ marginLeft: 8, background: "transparent", border: "none", color: "#555", cursor: "pointer" }}>×</button>
                      </div>
                    )}
                    <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
                      {actors.map(actor => {
                        const seatColor = actorSeatColor[actor.id];
                        return (
                        <div key={actor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: seatColor ? withAlpha(seatColor, 0.06) : "#161622", borderRadius: 6, marginBottom: 6, border: "1px solid #2a2a3e", borderLeft: `4px solid ${seatColor ?? "#2a2a3e"}` }}>
                          <div>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{actor.name}</span>
                            {seatColor && <span title="Assigned to a seat" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: seatColor, marginLeft: 7 }} />}
                            <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>AC {actor.stats.ac} · HP {actor.stats.hp.max} · Level {actor.level}</span>
                          </div>
                          <button type="button" onClick={() => setEditingActorId(actor.id)}
                            style={{ fontSize: 11, padding: "3px 10px", background: "#2a2a3e", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer" }}>Edit</button>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
              {libraryTab === "monsters" && (
                <EncounterLibraryPanel
                  monsterLibrary={BROKEN_CHAIN_MONSTER_LIBRARY}
                  activeRosterCount={Object.keys(roomLiveState.monsterLiveState).length}
                  autoOpenBandPicker={createParam === "monster"}
                  createSignal={monsterCreateSignal}
                  hideCreate
                  onCreateLootForEncounter={handleCreateLootForEncounter}
                  onLoadEncounter={(instances) => {
                    try {
                      const existing = JSON.parse(window.localStorage.getItem(FDMC_STORAGE_KEYS.encounterLoadQueue) ?? "[]") as unknown[];
                      window.localStorage.setItem(FDMC_STORAGE_KEYS.encounterLoadQueue, JSON.stringify([...existing, ...instances]));
                    } catch { /* ok */ }
                    if (OBR.isAvailable) {
                      void OBR.broadcast.sendMessage(FDMC_CHANNELS.encounterLoadRequest, { type: "fdmc:encounter-load-request" }, { destination: "LOCAL" }).catch(() => undefined);
                    }
                  }}
                  onClearRoster={() => undefined}
                />
              )}
              {libraryTab === "equipment" && (
                <EquipmentLibraryStandalone
                  seats={Object.values(seats)}
                  onDeliverLoot={handleDeliverLoot}
                  onDeliverLootBundle={handleDeliverLootBundle}
                  onSendGold={handleSendGold}
                  autoCreate={createParam === "equipment" || Boolean(lootEncounterParam)}
                  presetEncounter={equipPreset}
                  createSignal={equipCreateSignal}
                  hideCreate
                />
              )}
            </div>
          </div>
        )}

        {/* ── Seats & Tokens (tabbed) ── */}
        {(panelId === "seatTokens" || panelId === "seats" || panelId === "tokens") && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 6, padding: "6px 14px", borderBottom: "1px solid #2a2a3e", flexShrink: 0 }}>
              {(["seats", "tokens"] as const).map(tab => {
                const accent = SEATTOK_TAB_ACCENT[tab];
                const active = seatTokenTab === tab;
                return (
                  <button key={tab} type="button" onClick={() => setSeatTokenTab(tab)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 12px", borderRadius: 5, cursor: "pointer",
                      border: `1px solid ${active ? accent : "#2a2a3e"}`,
                      background: active ? accent : "transparent",
                      color: active ? "#0d0d14" : accent, fontWeight: active ? 700 : 500 }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#0d0d14" : accent }} />
                    {tab === "seats" ? "Seats" : "Tokens"}
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {seatTokenTab === "seats" && (
                <SeatAssignmentPanel
              obrPlayers={obrPlayers}
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
