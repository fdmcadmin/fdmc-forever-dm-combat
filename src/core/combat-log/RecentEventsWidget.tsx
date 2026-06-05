/**
 * RecentEventsWidget — Player-facing compact event strip.
 * Shows last 7 non-system combat log entries. No timestamps, no DM controls, no export.
 * Replaces the full Encounter Log in the player render path.
 */

import { useState } from "react";
import type { CombatLogEntry } from "../types/combatLog";

const MAX_SLOTS = 7;

type RecentEventsWidgetProps = {
  entries: CombatLogEntry[];
};

export function RecentEventsWidget({ entries }: RecentEventsWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  // Show only non-system entries, most recent first, capped at MAX_SLOTS
  const visible = entries
    .filter(e => e.tabId !== "system" && e.actorName !== "System")
    .slice(-MAX_SLOTS)
    .reverse();

  if (visible.length === 0) {
    return null;
  }

  const preview = visible[0];

  return (
    <div style={{ margin: "6px 12px 0", fontFamily: "monospace" }}>
      {/* Collapsed — single line showing most recent event */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        style={{
          width: "100%", textAlign: "left", background: "#0a0a12",
          border: "1px solid #1a1a2e", borderRadius: expanded ? "6px 6px 0 0" : 6,
          padding: "5px 10px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Recent Events
        </span>
        <span style={{ fontSize: 11, color: "#444", maxWidth: "65%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {preview.actorName} · {preview.actionName}
          {expanded ? " ▲" : " ▼"}
        </span>
      </button>

      {/* Expanded — list of last N events */}
      {expanded && (
        <div style={{ background: "#0a0a12", border: "1px solid #1a1a2e", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "4px 0" }}>
          {visible.map((e, i) => (
            <div key={i} style={{ padding: "4px 10px", borderBottom: i < visible.length - 1 ? "1px solid #111" : "none" }}>
              <span style={{ fontSize: 11, color: "#7b68ee", fontWeight: 500 }}>{e.actorName}</span>
              <span style={{ fontSize: 11, color: "#555" }}> · </span>
              <span style={{ fontSize: 11, color: "#aaa" }}>{e.actionName}</span>
              {e.message && e.message !== e.actionName && (
                <span style={{ fontSize: 10, color: "#444", marginLeft: 6 }}>— {e.message.slice(0, 60)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
