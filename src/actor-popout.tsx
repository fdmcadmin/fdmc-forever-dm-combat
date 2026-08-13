/**
 * Actor Popout Entry Point
 *
 * Cold-boots from URL param: ?fdmActorPopover=actorId
 * Reads actor from DM localStorage library (or player cache).
 * Reads live HP from room metadata via useActorLiveState.
 * Renders a standalone ActorCard — no App.tsx shell.
 *
 * Boot model matches the explicit-id pattern described in _specs/P4-SPEC.md.
 */

import React, { useEffect, useMemo, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import ReactDOM from "react-dom/client";
import { ActorCard } from "./core/ui/ActorCard";
import { SavePromptBanner } from "./core/ui/SavePromptBanner";
import { broadcastSavePrompt } from "./core/state/savePrompt";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "./core/seats/seatTypes";
import { FDMC_CHANNELS } from "./core/constants/channels";
import { useActorLiveState } from "./core/state/useActorLiveState";
import { getPartyCoins, patchPartyCoins, transferPartyToActor } from "./core/table-state/fdmcRoomLiveState";
import { useActionEconomyState } from "./core/state/useActionEconomyState";
import { useCommittedRollState } from "./core/state/useCommittedRollState";
import { useActorConcentrationState } from "./core/state/useActorConcentrationState";
import { useActorNotesState } from "./core/state/useActorNotesState";
import { useActorStatusState, createActorStatus } from "./core/state/useActorStatusState";
import { useOwlbearDiceBridge } from "./core/integrations/useOwlbearDiceBridge";
import { useCombatLog } from "./core/combat-log/useCombatLog";
import { useResourceCounterState } from "./core/state/useResourceCounterState";
import { consumeActionResourcesOnCommit } from "./core/state/consumeActionResources";
import { loadActorLibrary, loadActorOverrides, resolveActorFromLibrary } from "./core/seats/dmActorLibrary";
import { loadCachedActors } from "./core/seats/playerActorCache";
import { resolveActor, buildActorLibraryFromBundled } from "./core/table-state/actorHydrationBoundary";
import { fullHeal } from "./core/types/actor";
import type { StatusTrackerId } from "./core/types/status";
import { DEFAULT_COMBAT_RULES_PROFILE } from "./core/types/committedRoll";
import { brokenChainActors } from "./modules/the-broken-chain/actors/index";
import "./styles.css";

// ─── Read actorId from URL ────────────────────────────────────────────────────

const params = new URLSearchParams(window.location.search);
const POPOUT_ACTOR_ID = params.get("fdmActorPopover") ?? "";
// Seat color is passed by the opener so the popout sheet can carry seat identity.
const POPOUT_SEAT_COLOR = params.get("seatColor") ?? undefined;

// ─── Resolve actor — DM library first, player cache fallback, bundled last ───

function resolvePopoutActor(actorId: string) {
  if (!actorId) return undefined;

  const library = loadActorLibrary();
  const overrides = loadActorOverrides();

  // DM library (has full actor + any overrides)
  if (library[actorId]) {
    return resolveActorFromLibrary(actorId, library, overrides);
  }

  // Player cache (received from DM via seat broadcast)
  const cached = loadCachedActors();
  const fromCache = cached.find(a => a.id === actorId);
  if (fromCache) return fromCache;

  // Bundled source fallback
  const bundledLib = buildActorLibraryFromBundled(brokenChainActors);
  return bundledLib[actorId];
}

// ─── Popout App ───────────────────────────────────────────────────────────────

function ActorPopout() {
  const baseActor = useMemo(() => resolvePopoutActor(POPOUT_ACTOR_ID), []);

  // Need actor in an array for the hooks
  const actorList = useMemo(() => baseActor ? [baseActor] : [], [baseActor]);

  const { roomLiveState, setActorHp, getActorHp, setActorCoins, commitRoomState } = useActorLiveState(actorList);

  /**
   * The rest of the party, so an item can be handed to another player from this window.
   *
   * The popout is its own window with no actor library, so it learns the roster the same
   * way the inline card does: subscribe, and ASK on mount for the late-joiner case. Without
   * this the card had no `partyMembers`, and the send picker simply never rendered — the
   * transfer plumbing on both sides was complete, with no way to trigger it.
   */
  const [partyRoster, setPartyRoster] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!OBR.isAvailable) return;
    const unsub = OBR.broadcast.onMessage(FDMC_CHANNELS.partyTracker, (event) => {
      const msg = event.data as { type?: string; party?: Array<{ id: string; name: string }> } | undefined;
      if (msg?.type === "fdmc:party-tracker" && Array.isArray(msg.party)) {
        setPartyRoster(msg.party.map(c => ({ id: c.id, name: c.name })).filter(c => c.id && c.name));
      }
    });
    void OBR.broadcast.sendMessage(FDMC_CHANNELS.partyTracker, { type: "fdmc:party-tracker-request" }, { destination: "REMOTE" }).catch(() => undefined);
    return unsub;
  }, []);

  // The wallet is DM-granted: only the GM may edit coins. Players still SEE their wallet
  // (read-only); the merchant still spends from it. Outside OBR (dev) default to editable.
  const [isGm, setIsGm] = useState<boolean>(!OBR.isAvailable);
  useEffect(() => {
    if (!OBR.isAvailable) return;
    let active = true;
    const apply = () => { OBR.player.getRole().then(r => { if (active) setIsGm(r === "GM"); }).catch(() => {}); };
    let unsub: (() => void) | undefined;
    OBR.onReady(() => { apply(); unsub = OBR.player.onChange(() => apply()); });
    return () => { active = false; unsub?.(); };
  }, []);

  // Re-resolve with live HP overlay
  const actor = useMemo(() => {
    if (!baseActor) return undefined;
    const library = { [baseActor.id]: baseActor };
    return resolveActor(baseActor.id, library, {}, roomLiveState);
  }, [baseActor, roomLiveState]);

  const { getActionState, readyActionCosts, unreadyActionKey, resetActorTurn } = useActionEconomyState(actorList);
  const { getCommittedRoll, startCommittedRoll, setCommittedRollResult, chooseCommittedRollOutcome, chooseCommittedRollDamage, markCommittedRollBridgeSent, clearCommittedRoll } = useCommittedRollState(actorList);
  const { getActorConcentration, setActorConcentration, clearActorConcentration } = useActorConcentrationState(actorList);
  const { getActorNotes, addActorNote, deleteActorNote } = useActorNotesState(actorList);
  // resetActorTracker / resetActorStatuses are deliberately NOT taken: they write this seat's
  // own copy. Every tracker change here goes through commitTracker so the GM stays the writer.
  const { getActorStatus, setActorTracker } = useActorStatusState(actorList);
  const { addEntry, removePendingEntries } = useCombatLog();
  const { counters, resetActorResources, consumeSpellSlot, consumeNamedResource, consumeItemCharge, restoreItemCharge, spendResource } = useResourceCounterState(actorList);
  const { status: diceBridgeStatus, lastEvent: diceBridgeLastEvent, sendRollRequest, sendDicePlusRollRequest, sendMockRollResult } = useOwlbearDiceBridge();

  if (!actor) {
    return (
      <div style={{ padding: 24, color: "#888" }}>
        <p>Actor not found: {POPOUT_ACTOR_ID || "(no id)"}</p>
        <p style={{ fontSize: 11 }}>Open this popout from the actor selector in Forever DM Combat.</p>
      </div>
    );
  }

  const hp = getActorHp(actor.id);
  /**
   * HP writes go through the GM. A seat only ever REQUESTS — the GM applies it to its own
   * live state and writes, so the GM copy stays authoritative and two seats can never write
   * at once. Auto-approved (combat state): the GM applies it with no click.
   * Outside OBR, or when this window IS the GM, write directly.
   */
  const commitHp = (nextHp: Parameters<typeof setActorHp>[1]) => {
    if (isGm || !OBR.isAvailable) { void setActorHp(actor!.id, nextHp); return; }
    void OBR.broadcast.sendMessage(
      FDMC_SEAT_BROADCAST_CHANNEL,
      { type: "fdmc:request-actor-hp", actorId: actor!.id, hp: nextHp },
      { destination: "REMOTE" },
    ).catch(() => undefined);
  };

  /**
   * Status trackers, same rule as HP: the GM is the single writer, so a seat REQUESTS and the
   * GM applies against its own live state. This was the last hole in the 0.7.0.4 write audit —
   * the popout still called setActorTracker / resetActorTracker / resetActorStatuses directly,
   * so a drained tracker could read one way on the seat and another on the master card.
   *
   * `fdmc:request-actor-tracker` carries the numeric `current` because that is what
   * patchActorTracker sets, and `current` is the only part of a tracker a player moves.
   */
  const commitTracker = (trackerId: StatusTrackerId, current: number) => {
    if (isGm || !OBR.isAvailable) {
      const existing = getActorStatus(actor!)[trackerId];
      if (existing) setActorTracker(actor!.id, trackerId, { ...existing, current });
      return;
    }
    void OBR.broadcast.sendMessage(
      FDMC_SEAT_BROADCAST_CHANNEL,
      { type: "fdmc:request-actor-tracker", actorId: actor!.id, trackerId, current },
      { destination: "REMOTE" },
    ).catch(() => undefined);
  };


  /**
   * A rest rewrites the whole card (pools for the rest actually taken, recharges, and HP
   * on a long rest), so it runs on the GM master copy. A seat REQUESTS; the GM applies.
   * GM window (or dev, outside OBR) still performs it directly.
   */
  const requestRest = (restType: "short" | "long") => {
    if (isGm || !OBR.isAvailable) {
      resetActorResources(actor!.id, restType);
      if (restType === "long") { const m = actor!.stats.hp.max; void setActorHp(actor!.id, { current: m, max: m, temp: 0 }); }
      addEntry({ actorName: actor!.name, actionName: restType === "long" ? "Long Rest" : "Short Rest", tabId: "system",
        message: restType === "long" ? `${actor!.name} takes a Long Rest — HP restored to full and resources reset.` : `${actor!.name} takes a Short Rest.` });
      return;
    }
    void OBR.broadcast.sendMessage(
      FDMC_SEAT_BROADCAST_CHANNEL,
      { type: "fdmc:request-actor-rest", actorId: actor!.id, restType },
      { destination: "REMOTE" },
    ).catch(() => undefined);
  };

  const actionState = getActionState(actor);
  const concentration = getActorConcentration(actor);
  const committedRoll = getCommittedRoll(actor);
  const actorNotes = getActorNotes(actor);
  const status = getActorStatus(actor);

  return (
    <div style={{ height: "100vh", overflow: "auto" }}>
      <SavePromptBanner />
      <ActorCard
        actor={actor}
        // The purse renders as a line under the character's own wallet, inside the card.
        partyCoins={getPartyCoins(roomLiveState)}
        onEditPartyCoins={isGm ? ((c) => void commitRoomState(patchPartyCoins(roomLiveState, c))) : undefined}
        onPartyTransfer={(copper) => {
          // The GM is the single writer, so a GM-held card moves coin itself; a player's card
          // asks, and the same balance guard runs on the GM's copy.
          if (isGm || !OBR.isAvailable) {
            const moved = transferPartyToActor(roomLiveState, actor.id, copper);
            if (moved) void commitRoomState(moved);
            return;
          }
          void OBR.broadcast.sendMessage(
            FDMC_SEAT_BROADCAST_CHANNEL,
            { type: "fdmc:request-party-transfer", actorId: actor.id, copper },
            { destination: "REMOTE" },
          ).catch(() => undefined);
        }}
        seatColor={POPOUT_SEAT_COLOR}
        hp={hp}
        actionState={actionState}
        concentration={concentration}
        committedRoll={committedRoll}
        actorNotes={actorNotes}
        status={status}
        rulesProfile={DEFAULT_COMBAT_RULES_PROFILE}
        turnResetVersion={0}
        diceBridgeStatus={diceBridgeStatus}
        diceBridgeLastEvent={diceBridgeLastEvent}
        onHpChange={(nextHp) => commitHp(nextHp)}
        onResetHp={() => commitHp(fullHeal(actor.stats.hp))}
        onReadyActionCosts={(costs, readiedKey) => readyActionCosts(actor.id, costs, readiedKey)}
        onUnreadyAction={(readiedKey) => unreadyActionKey(actor.id, readiedKey)}
        onRemovePendingLogEntries={removePendingEntries}
        onResetTurn={() => resetActorTurn(actor.id)}
        onSetConcentration={(next) => setActorConcentration(actor.id, next)}
        onClearConcentration={() => clearActorConcentration(actor.id)}
        onStartCommittedRoll={(input) => {
          startCommittedRoll(actor.id, input);
          const action = Object.values(actor.tabs).flat().find(a => a.id === input.actionId);
          // Ray 2+ of a multi-roll cast: the slot was already spent on ray 1.
          if (action && !input.continuesMultiRoll) consumeActionResourcesOnCommit({ actorId: actor.id, actorName: actor.name, action, consumeSpellSlot, consumeNamedResource, log: addEntry , resourceLabels: (actor.tabs.resources ?? []).map(r => r.label), castLevel: input.castLevel });
        }}
        onSetCommittedRollResult={(result) => setCommittedRollResult(actor.id, result)}
        onChooseCommittedRollOutcome={(outcome) => chooseCommittedRollOutcome(actor.id, outcome)}
        onChooseCommittedRollDamage={(choice) => chooseCommittedRollDamage(actor.id, choice)}
        onMarkCommittedRollBridgeSent={() => markCommittedRollBridgeSent(actor.id)}
        onClearCommittedRoll={() => clearCommittedRoll(actor.id)}
        onSendDiceBridgeRequest={sendRollRequest}
        onSendDicePlusRequest={sendDicePlusRollRequest}
        onSendMockDiceBridgeResult={(nat, total) => void sendMockRollResult({ naturalRoll: nat, total, protocol: "fdm-dice-result", requestId: "" })}
        onAddActorNote={(text, visibility) => addActorNote(actor.id, text, visibility)}
        onDeleteActorNote={(noteId) => deleteActorNote(actor.id, noteId)}
        onStatusTrackerChange={(trackerId, nextTracker) => commitTracker(trackerId, nextTracker.current)}
        onResetStatusTracker={(trackerId) => {
          const back = createActorStatus(actor)[trackerId];
          if (back) commitTracker(trackerId, back.current);
        }}
        onResetAllActorStatuses={() => {
          // No "reset every tracker" request type exists, and inventing one would duplicate
          // what patchActorTracker already does — so reset each tracker to its default.
          const defaults = createActorStatus(actor);
          for (const [trackerId, tracker] of Object.entries(defaults)) {
            if (tracker) commitTracker(trackerId as StatusTrackerId, tracker.current);
          }
        }}
        resourceCounters={counters[actor.id]}
        onSpendResource={(rid, amt) => {
          const r = spendResource(actor.id, rid, amt);
          addEntry({ actorName: actor.name, actionName: r.label ?? "Resource", tabId: "resources", message: r.outcome === "spent" ? `${actor.name} spends ${amt} from ${r.label ?? "pool"} (${r.remaining}/${r.max ?? "?"} left).` : `⚠ ${actor.name} has nothing left in ${r.label ?? "that pool"}.` });
        }}
        onSpendItemCharge={(action) => consumeActionResourcesOnCommit({ actorId: actor.id, actorName: actor.name, action, consumeSpellSlot, consumeNamedResource, consumeItemCharge, log: addEntry, resourceLabels: [] })}
        onRestoreItemCharge={(action) => { const r = restoreItemCharge(actor.id, action); addEntry({ actorName: actor.name, actionName: action.label, tabId: "equipment", message: `${actor.name} regains a charge on ${action.label} (${r.remaining}/${r.max ?? "?"}).` }); }}
        // The popout has no actor library of its own, so it can only ask — the DM's
        // fdmc:item-equip handler performs the change and pushes the sheet back.
        combatActive={roomLiveState.combat.phase === "combat"}
        // Grip is free and not turn-bound, but it still rewrites the card, so the GM performs
        // it like every other gear change. This window only asks.
        onSetGrip={(action, grip) => {
          if (!OBR.isAvailable) return;
          void OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL,
            { type: "fdmc:item-grip", actorId: actor.id, actionId: action.id, grip },
            // ALL, not REMOTE: REMOTE excludes this client, so a DM with the card open on
            // their own machine never reached their own main window and the control died.
            { destination: "ALL" }).catch(() => undefined);
        }}
        onToggleEquipped={(action) => {
          if (!OBR.isAvailable) return;
          void OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL,
            { type: "fdmc:item-equip", actorId: actor.id, actionId: action.id },
            // ALL, not REMOTE — see the grip note above. The DM handler is gated on isDmMode,
            // so a player client receiving its own message simply ignores it.
            { destination: "ALL" }).catch(() => undefined);
        }}
        // Hand an item to another player. Same authority rule as equipping: this window
        // only ASKS, and the DM performs the move so the item can never exist on two
        // sheets or neither. This is how a crafted or converged item reaches whoever
        // actually needs it.
        partyMembers={partyRoster.filter(p => p.id !== actor.id)}
        onSendItem={(action, toActorId) => {
          if (!OBR.isAvailable) return;
          void OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL,
            { type: "fdmc:item-transfer", fromActorId: actor.id, toActorId, actionId: action.id },
            { destination: "ALL" }).catch(() => undefined);
        }}
        onConsumeActionResources={(action, castLevel) => consumeActionResourcesOnCommit({ actorId: actor.id, actorName: actor.name, action, consumeSpellSlot, consumeNamedResource, consumeItemCharge, log: addEntry , resourceLabels: (actor.tabs.resources ?? []).map(r => r.label), castLevel })}
        onSaveCall={(action, save) => {
          broadcastSavePrompt(actor.name, action, save);
          addEntry({ actorName: actor.name, actionName: "Save Call", tabId: "system", message: `⚠ SAVE — ${actor.name}'s ${action}: each target must make a ${save} saving throw.` });
        }}
        coins={roomLiveState.actorLiveState[actor.id]?.coins ?? {}}
        onUpdateCoins={isGm ? ((c) => void setActorCoins(actor.id, c)) : undefined}
        isActiveTurn={
          roomLiveState.combat.phase !== "combat" ||
          roomLiveState.combat.activeActorId === actor.id ||
          // A COMPANION acts on its owner's turn — it never becomes the active combatant
          // itself (buildCombatants renders it as a sub-entry with isActive:false), so
          // without this it was permanently off-turn in this window and every main/bonus
          // action was blocked. Both App.tsx card sites already did this; the popout — the
          // window players actually use — did not, which is why a companion had to be
          // re-tagged as a "player" to be usable at all.
          (actor.kind === "companion" &&
            roomLiveState.combat.activeActorId ===
              (actor.moduleData as { ownerId?: string } | undefined)?.ownerId)
        }
        onShortRest={() => requestRest("short")}
        onLongRest={() => requestRest("long")}
        onLog={addEntry}
      />
    </div>
  );
}

function mountActorPopout() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ActorPopout />
    </React.StrictMode>
  );
}

if (OBR.isAvailable) {
  OBR.onReady(mountActorPopout);
} else {
  mountActorPopout();
}
