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

import React, { useMemo } from "react";
import OBR from "@owlbear-rodeo/sdk";
import ReactDOM from "react-dom/client";
import { ActorCard } from "./core/ui/ActorCard";
import { SavePromptBanner } from "./core/ui/SavePromptBanner";
import { broadcastSavePrompt } from "./core/state/savePrompt";
import { useActorLiveState } from "./core/state/useActorLiveState";
import { useActionEconomyState } from "./core/state/useActionEconomyState";
import { useCommittedRollState } from "./core/state/useCommittedRollState";
import { useActorConcentrationState } from "./core/state/useActorConcentrationState";
import { useActorNotesState } from "./core/state/useActorNotesState";
import { useActorStatusState } from "./core/state/useActorStatusState";
import { useOwlbearDiceBridge } from "./core/integrations/useOwlbearDiceBridge";
import { useCombatLog } from "./core/combat-log/useCombatLog";
import { useResourceCounterState } from "./core/state/useResourceCounterState";
import { consumeActionResourcesOnCommit } from "./core/state/consumeActionResources";
import { loadActorLibrary, loadActorOverrides, resolveActorFromLibrary } from "./core/seats/dmActorLibrary";
import { loadCachedActors } from "./core/seats/playerActorCache";
import { resolveActor, buildActorLibraryFromBundled } from "./core/table-state/actorHydrationBoundary";
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

  const { roomLiveState, setActorHp, getActorHp } = useActorLiveState(actorList);

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
  const { getActorStatus, setActorTracker, resetActorTracker, resetActorStatuses } = useActorStatusState(actorList);
  const { addEntry, removePendingEntries } = useCombatLog();
  const { counters, resetActorResources, consumeSpellSlot, consumeNamedResource, spendResource } = useResourceCounterState(actorList);
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
        seatColor={POPOUT_SEAT_COLOR}
        hp={hp}
        gold={roomLiveState.actorLiveState[actor.id]?.gold ?? 0}
        actionState={actionState}
        concentration={concentration}
        committedRoll={committedRoll}
        actorNotes={actorNotes}
        status={status}
        rulesProfile={DEFAULT_COMBAT_RULES_PROFILE}
        turnResetVersion={0}
        diceBridgeStatus={diceBridgeStatus}
        diceBridgeLastEvent={diceBridgeLastEvent}
        onHpChange={(nextHp) => void setActorHp(actor.id, nextHp)}
        onResetHp={() => void setActorHp(actor.id, actor.stats.hp)}
        onReadyActionCosts={(costs, readiedKey) => readyActionCosts(actor.id, costs, readiedKey)}
        onUnreadyAction={(readiedKey) => unreadyActionKey(actor.id, readiedKey)}
        onRemovePendingLogEntries={removePendingEntries}
        onResetTurn={() => resetActorTurn(actor.id)}
        onSetConcentration={(next) => setActorConcentration(actor.id, next)}
        onClearConcentration={() => clearActorConcentration(actor.id)}
        onStartCommittedRoll={(input) => {
          startCommittedRoll(actor.id, input);
          const action = Object.values(actor.tabs).flat().find(a => a.id === input.actionId);
          if (action) consumeActionResourcesOnCommit({ actorId: actor.id, actorName: actor.name, action, consumeSpellSlot, consumeNamedResource, log: addEntry });
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
        onStatusTrackerChange={(trackerId, nextTracker) => setActorTracker(actor.id, trackerId, nextTracker)}
        onResetStatusTracker={(trackerId) => resetActorTracker(actor, trackerId)}
        onResetAllActorStatuses={() => resetActorStatuses(actor)}
        resourceCounters={counters[actor.id]}
        onSpendResource={(rid, amt) => {
          const r = spendResource(actor.id, rid, amt);
          addEntry({ actorName: actor.name, actionName: r.label ?? "Resource", tabId: "resources", message: r.outcome === "spent" ? `${actor.name} spends ${amt} from ${r.label ?? "pool"} (${r.remaining}/${r.max ?? "?"} left).` : `⚠ ${actor.name} has nothing left in ${r.label ?? "that pool"}.` });
        }}
        onConsumeActionResources={(action) => consumeActionResourcesOnCommit({ actorId: actor.id, actorName: actor.name, action, consumeSpellSlot, consumeNamedResource, log: addEntry })}
        onSaveCall={(action, save) => {
          broadcastSavePrompt(actor.name, action, save);
          addEntry({ actorName: actor.name, actionName: "Save Call", tabId: "system", message: `⚠ SAVE — ${actor.name}'s ${action}: each target must make a ${save} saving throw.` });
        }}
        isActiveTurn={roomLiveState.combat.phase !== "combat" || roomLiveState.combat.activeActorId === actor.id}
        onShortRest={() => { resetActorResources(actor.id, "short"); addEntry({ actorName: actor.name, actionName: "Short Rest", tabId: "system", message: `${actor.name} takes a Short Rest.` }); }}
        onLongRest={() => { resetActorResources(actor.id, "long"); const m = actor.stats.hp.max; void setActorHp(actor.id, { current: m, max: m, temp: 0 }); addEntry({ actorName: actor.name, actionName: "Long Rest", tabId: "system", message: `${actor.name} takes a Long Rest — HP restored to full and resources reset.` }); }}
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
