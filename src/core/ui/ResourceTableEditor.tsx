/**
 * ResourceTableEditor
 *
 * Table-style editor for class features / resource counters.
 * Each row: Name | Value/Pool | Reset | Note | [Remove]
 * Stores as ActorAction[] with actionKind "resource" in actor.tabs.resources
 */

import { useState } from "react";
import type { ActorAction, ResourceKind } from "../types/tabs";

// ─── Resource row type ────────────────────────────────────────────────────────

type ResourceRow = {
  id: string;
  name: string;
  pool: string;           // e.g. "2", "4", "∞"
  reset: string;          // "Short Rest" | "Long Rest" | "Per Encounter" | "Manual" | ""
  resourceKind: ResourceKind;
  note: string;
  include: boolean;       // the [ ] checkbox — whether to include on the actor card
};

const RESET_OPTIONS = [
  "Long Rest",
  "Short Rest",
  "Per Encounter",
  "Per Turn",
  "Manual",
  "—",
];

// ─── Convert between ResourceRow and ActorAction ──────────────────────────────

function rowToAction(row: ResourceRow): ActorAction {
  const details = [
    row.pool ? `Pool: ${row.pool}` : "",
    row.reset && row.reset !== "—" ? `Reset: ${row.reset}` : "",
    row.note,
  ].filter(Boolean).join(" · ");

  return {
    id: row.id,
    label: row.name || "Unnamed Resource",
    description: details,
    actionKind: "resource",
    logMode: "silent",
    displayMode: "compact",
    category: "Class Features / Resources",
    metadata: {
      cost: row.reset || undefined,
      details,
      additive: row.pool || undefined,
      resourceKind: row.resourceKind,
    },
  };
}

function actionToRow(action: ActorAction): ResourceRow {
  const details = action.metadata?.details ?? action.description ?? "";
  const poolMatch = details.match(/Pool:\s*([^\s·]+)/);
  const resetMatch = details.match(/Reset:\s*([^·]+)/);
  return {
    id: action.id,
    name: action.label,
    pool: poolMatch?.[1] ?? action.metadata?.additive ?? "",
    reset: resetMatch?.[1]?.trim() ?? action.metadata?.cost ?? "",
    resourceKind: action.metadata?.resourceKind ?? "pool",
    // Strip ALL derived "Pool: …" / "Reset: …" segments (note the space after the colon,
    // and the `g` flag) so the recovered note never re-absorbs them. This also self-heals
    // rows whose note already accumulated duplicate "Pool: X ·" prefixes.
    note: details.replace(/Pool:\s*[^·]*(?:·\s*)?/gi, "").replace(/Reset:\s*[^·]*(?:·\s*)?/gi, "").trim(),
    include: true,
  };
}

function makeBlankRow(): ResourceRow {
  return {
    id: `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    pool: "",
    reset: "Long Rest",
    resourceKind: "pool",
    note: "",
    include: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

type ResourceTableEditorProps = {
  actions: ActorAction[];
  onChange: (actions: ActorAction[]) => void;
};

export function ResourceTableEditor({ actions, onChange }: ResourceTableEditorProps) {
  const [rows, setRows] = useState<ResourceRow[]>(() =>
    actions.length > 0 ? actions.map(actionToRow) : [makeBlankRow()]
  );

  function updateRows(next: ResourceRow[]) {
    setRows(next);
    onChange(next.filter(r => r.include && r.name.trim()).map(rowToAction));
  }

  function setRow(idx: number, patch: Partial<ResourceRow>) {
    const next = rows.map((r, i) => i === idx ? { ...r, ...patch } : r);
    updateRows(next);
  }

  function addRow() {
    const next = [...rows, makeBlankRow()];
    setRows(next); // don't filter yet — just add blank
  }

  function removeRow(idx: number) {
    updateRows(rows.filter((_, i) => i !== idx));
  }

  const inputStyle = {
    width: "100%",
    padding: "3px 6px",
    borderRadius: 3,
    border: "1px solid #333",
    background: "#111",
    color: "#fff",
    fontSize: 12,
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: "#666" }}>
        Check ✓ Enter? to include resource on the actor card. These are counters/toggles that actions and spells will reference.
      </p>

      {/* Table header */}
      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 80px 110px 1fr 32px", gap: 4, padding: "4px 6px", background: "#0d0d14", borderRadius: 4 }}>
        {["Enter?", "Resource Label", "Pool", "Reset", "Note", ""].map(h => (
          <span key={h} style={{ fontSize: 10, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, idx) => (
        <div key={row.id} style={{ background: row.include ? "#1a1a2e" : "#111", borderRadius: 4, border: `1px solid ${row.include ? "#7b68ee33" : "#2a2a2a"}`, padding: "4px 6px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 80px 110px 1fr 32px", gap: 4, alignItems: "center" }}>
            {/* Enter checkbox */}
            <input
              type="checkbox"
              checked={row.include}
              onChange={e => setRow(idx, { include: e.target.checked })}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#7b68ee" }}
              title="Include on actor card"
            />
            {/* Resource label */}
            <input type="text" value={row.name} onChange={e => setRow(idx, { name: e.target.value })}
              placeholder="Channel Divinity, Spell Slots L1…" style={inputStyle} />
            {/* Pool */}
            <input type="text" value={row.pool} onChange={e => setRow(idx, { pool: e.target.value })}
              placeholder="2" style={{ ...inputStyle, textAlign: "center" }} />
            {/* Reset */}
            <select value={row.reset} onChange={e => setRow(idx, { reset: e.target.value })}
              style={{ ...inputStyle, padding: "3px 4px" }}>
              <option value="">—</option>
              {RESET_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {/* Note */}
            <input type="text" value={row.note} onChange={e => setRow(idx, { note: e.target.value })}
              placeholder="e.g. spell actions spend matching slot" style={inputStyle} />
            {/* Remove */}
            <button type="button" onClick={() => removeRow(idx)}
              style={{ fontSize: 13, background: "transparent", border: "none", color: "#5a1a1a", cursor: "pointer", padding: 0, lineHeight: 1 }}
              title="Remove row">✕</button>
          </div>
          {/* Resource kind — second line, only when included */}
          {row.include && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingLeft: 36 }}>
              <span style={{ fontSize: 10, color: "#555" }}>Kind:</span>
              <select value={row.resourceKind} onChange={e => setRow(idx, { resourceKind: e.target.value as ResourceKind })}
                style={{ fontSize: 11, padding: "1px 4px", borderRadius: 3, border: "1px solid #333", background: "#111", color: "#aaa" }}>
                <option value="pool">Pool (uses/day)</option>
                <option value="spellSlot">Spell Slot</option>
                <option value="pactSlot">Pact Slot</option>
                <option value="freeCast">Free Cast</option>
                <option value="toggle">Toggle (on/off)</option>
                <option value="counter">Counter (free track)</option>
              </select>
              <span style={{ fontSize: 10, color: "#444" }}>
                {row.resourceKind === "spellSlot" ? "Resets: Long Rest" :
                 row.resourceKind === "pactSlot" ? "Resets: Short + Long Rest" :
                 row.resourceKind === "freeCast" ? "Resets: Long Rest" :
                 row.resourceKind === "toggle" ? "Resets: Short + Long Rest" :
                 row.resourceKind === "counter" ? "Manual reset only" :
                 row.reset ? `Resets: ${row.reset}` : ""}
              </span>
            </div>
          )}
        </div>
      ))}

      {/* Add row */}
      <button
        type="button"
        onClick={addRow}
        style={{ padding: "5px 12px", background: "transparent", border: "1px dashed #444", borderRadius: 4, color: "#888", cursor: "pointer", fontSize: 12, marginTop: 4, textAlign: "left" }}
      >
        + Add Resource Row
      </button>

      {/* Summary of what will be saved */}
      {rows.filter(r => r.include && r.name.trim()).length > 0 && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#555" }}>
          {rows.filter(r => r.include && r.name.trim()).length} resource{rows.filter(r => r.include && r.name.trim()).length === 1 ? "" : "s"} will be saved to actor card.
        </p>
      )}
    </div>
  );
}
