/**
 * RerollSourcePicker
 *
 * Shown when a roll is held and reroll sources are available.
 * Player picks one source, that source is consumed, roll fires again.
 * Both original and new result are shown — player picks either.
 */

import { useState } from "react";
import type { RerollSource } from "../state/rerollSources";

type RerollSourcePickerProps = {
  sources: RerollSource[];
  originalResult: string;
  onReroll: (source: RerollSource) => void;
  onKeepOriginal: () => void;
  onCancel: () => void;
  /** Set after reroll fires — shows new result alongside original */
  newResult?: string | null;
  onPickResult?: (result: string) => void;
};

const KIND_ICONS: Record<RerollSource["kind"], string> = {
  item: "⬡",
  feature: "◆",
  dm: "⚑",
};

const KIND_COLORS: Record<RerollSource["kind"], string> = {
  item: "#7b68ee",
  feature: "#e07b39",
  dm: "#4caf50",
};

export function RerollSourcePicker({
  sources,
  originalResult,
  onReroll,
  onKeepOriginal,
  onCancel,
  newResult,
  onPickResult,
}: RerollSourcePickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sources.find(s => s.id === selectedId);

  // ── After reroll: show both results ──────────────────────────────────────
  if (newResult !== undefined && newResult !== null) {
    return (
      <div style={{ background: "#1a1a2e", borderRadius: 8, padding: 14, border: "1px solid #7b68ee44" }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#7b68ee", fontWeight: 600 }}>
          ↺ Reroll complete — pick your result:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            onClick={() => onPickResult?.(originalResult)}
            style={{ padding: "10px", background: "#161622", border: "1px solid #444", borderRadius: 6, color: "#aaa", cursor: "pointer", fontSize: 12 }}
          >
            <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Original</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{originalResult}</div>
          </button>
          <button
            type="button"
            onClick={() => onPickResult?.(newResult)}
            style={{ padding: "10px", background: "#1a2a1a", border: "1px solid #4caf5044", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 12 }}
          >
            <div style={{ fontSize: 10, color: "#4caf50", marginBottom: 4 }}>New Roll</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#4caf50" }}>{newResult}</div>
          </button>
        </div>
      </div>
    );
  }

  // ── Source picker ─────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#1a1a2e", borderRadius: 8, padding: 12, border: "1px solid #7b68ee33" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#7b68ee", fontWeight: 600 }}>
          ↺ Reroll? Choose source:
        </p>
        <button type="button" onClick={onCancel}
          style={{ fontSize: 11, padding: "1px 6px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#555", cursor: "pointer" }}>
          ✕
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
        {sources.map(source => (
          <label
            key={source.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              background: selectedId === source.id ? "#2a2a3e" : "#111",
              border: `1px solid ${selectedId === source.id ? KIND_COLORS[source.kind] + "66" : "#2a2a2a"}`,
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="reroll-source"
              value={source.id}
              checked={selectedId === source.id}
              onChange={() => setSelectedId(source.id)}
              style={{ accentColor: KIND_COLORS[source.kind] }}
            />
            <span style={{ fontSize: 13, color: KIND_COLORS[source.kind] }}>
              {KIND_ICONS[source.kind]}
            </span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#fff" }}>{source.label}</span>
              {source.condition && (
                <span style={{ fontSize: 10, color: "#666", marginLeft: 6 }}>{source.condition}</span>
              )}
            </div>
            <span style={{ fontSize: 10, color: "#555" }}>{source.costLabel}</span>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onReroll(selected)}
          style={{
            flex: 1, padding: "6px 12px",
            background: selected ? "#7b68ee" : "#333",
            color: "#fff", border: "none", borderRadius: 4,
            cursor: selected ? "pointer" : "default", fontSize: 12, fontWeight: 500,
          }}
        >
          ↺ Reroll
          {selected && selected.kind !== "dm" && (
            <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>
              (spends {selected.costLabel})
            </span>
          )}
        </button>
        <button type="button" onClick={onKeepOriginal}
          style={{ padding: "6px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer", fontSize: 12 }}>
          Keep {originalResult}
        </button>
      </div>
    </div>
  );
}
