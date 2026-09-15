/**
 * Monster Popout Entry Point
 *
 * Cold-boots from URL param: ?instanceId=xxx
 * Reads full monster template from DM localStorage (monsterRosterStorage).
 * Reads live HP from room metadata via useMonsterPopout.
 * Renders a standalone MonsterActorCard — no App.tsx shell.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { MonsterActorCard } from "./core/ui/MonsterActorCard";
import { SavePromptBanner } from "./core/ui/SavePromptBanner";
import { broadcastSavePrompt } from "./core/state/savePrompt";
import { useMonsterPopout } from "./core/monster-state/useMonsterPopout";
import { useOwlbearDiceBridge } from "./core/integrations/useOwlbearDiceBridge";
import "./styles.css";
import { applyStoredDisplayMode } from "./core/ui/displayMode";
import { monsterHpFromPatch } from "./core/monster-state/monsterHpPatch";

const params = new URLSearchParams(window.location.search);
const INSTANCE_ID = params.get("instanceId") ?? "";

function MonsterPopoutApp() {
  const { monster, isLoaded, commitHp } = useMonsterPopout(INSTANCE_ID);
  const { lastEvent: diceBridgeLastEvent, sendDicePlusRollRequest } = useOwlbearDiceBridge();

  if (!isLoaded) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#555" }}>
        <p style={{ fontSize: 12 }}>Loading…</p>
      </div>
    );
  }

  if (!monster) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#555" }}>
        <p style={{ fontSize: 13, marginBottom: 8 }}>Monster not found.</p>
        <p style={{ fontSize: 11, color: "#444" }}>
          Instance ID: <code>{INSTANCE_ID || "(none)"}</code>
        </p>
        <p style={{ fontSize: 11, color: "#444" }}>
          Open the monster via the DM monster panel to load it to this window.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "#0d0d14", minHeight: "100vh" }}>
      <SavePromptBanner />
      <MonsterActorCard
        monster={monster}
        isDmView={true}
        onHpChange={(patch) => {
          // ⚠ THE SHARED MERGE — this dropped the patch's max, same as the combat window did.
          commitHp(monsterHpFromPatch(monster, patch));
        }}
        onSendDicePlusRequest={sendDicePlusRollRequest}
        diceBridgeLastEvent={diceBridgeLastEvent}
        onSaveCall={(action, save) => broadcastSavePrompt((monster as { displayName?: string; name?: string }).displayName ?? (monster as { name?: string }).name ?? "Monster", action, save)}
      />
    </div>
  );
}

function mountMonsterPopout() {
  const root = document.getElementById("root");
  if (!root) return;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <MonsterPopoutApp />
    </React.StrictMode>
  );
}

// Full or Lite, as this device chose it in the main window — see displayMode.ts.
applyStoredDisplayMode();

if (OBR.isAvailable) {
  OBR.onReady(mountMonsterPopout);
} else {
  mountMonsterPopout();
}
