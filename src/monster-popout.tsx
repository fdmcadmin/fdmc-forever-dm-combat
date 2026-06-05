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
import { MonsterActorCard } from "./core/ui/MonsterActorCard";
import { useMonsterPopout } from "./core/monster-state/useMonsterPopout";
import { useOwlbearDiceBridge } from "./core/integrations/useOwlbearDiceBridge";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const INSTANCE_ID = params.get("instanceId") ?? "";

function MonsterPopoutApp() {
  const { monster, isLoaded, commitHp } = useMonsterPopout(INSTANCE_ID);
  const { lastEvent: diceBridgeLastEvent, sendDicePlusRollRequest } = useOwlbearDiceBridge();

  if (!isLoaded) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace", textAlign: "center", color: "#555" }}>
        <p style={{ fontSize: 12 }}>Loading…</p>
      </div>
    );
  }

  if (!monster) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace", textAlign: "center", color: "#555" }}>
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
      <MonsterActorCard
        monster={monster}
        isDmView={true}
        onHpChange={(patch) => {
          commitHp({
            current: typeof patch.currentHp === "number" ? patch.currentHp : monster.currentHp,
            max: monster.maxHp,
            temp: typeof patch.tempHp === "number" ? patch.tempHp : monster.tempHp,
          });
        }}
        onSendDicePlusRequest={sendDicePlusRollRequest}
        diceBridgeLastEvent={diceBridgeLastEvent}
      />
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <MonsterPopoutApp />
    </React.StrictMode>
  );
}
