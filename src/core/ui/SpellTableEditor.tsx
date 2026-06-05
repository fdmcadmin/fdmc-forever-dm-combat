/**
 * SpellTableEditor
 *
 * Table-style editor for spell lists.
 * Each row: Name | Level | Slot Cost | Attack/Save | Damage | Conc | [Remove]
 * Stores as ActorAction[] with actionKind "spell" in actor.tabs.spells
 *
 * Spell levels: 0 = Cantrip, 1-9 = spell slots
 */

import { useState } from "react";
import { FormulaInput } from "./FormulaInput";
import type { ActorAction } from "../types/tabs";
import { formatSpellLevel, type SpellActionLevel } from "../types/spellSlots";

// ─── Row type ─────────────────────────────────────────────────────────────────

type SpellRow = {
  id: string;
  name: string;
  level: SpellActionLevel;              // base / minimum slot level (0 = cantrip)
  usableSpellLevels: SpellActionLevel[]; // which slot levels this can be cast at
  upcastNote: string;                   // e.g. "+1d6 per level above 3rd"
  slotCost: string;                     // display label: "Cantrip", "Pact Slot", "L1–L5", etc.
  consumesSlot: boolean;
  attack: string;
  saveDc: string;
  damage: string;
  crit: string;
  range: string;
  concentration: boolean;
  details: string;
  category: string;
  economyCost: "main" | "bonus" | "reaction";
  include: boolean;
};

const SPELL_LEVELS: { value: SpellActionLevel; label: string }[] = [
  { value: 0, label: "Cantrip" },
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
  { value: 6, label: "6th" },
  { value: 7, label: "7th" },
  { value: 8, label: "8th" },
  { value: 9, label: "9th" },
];

// ─── Converters ───────────────────────────────────────────────────────────────

function formatSlotLabel(row: SpellRow): string {
  if (row.level === 0) return "Cantrip";
  if (row.slotCost.trim()) return row.slotCost.trim();
  const levels = row.usableSpellLevels.filter(l => l > 0).sort((a, b) => a - b);
  if (levels.length === 0) return `L${row.level}`;
  if (levels.length === 1) return `L${levels[0]}`;
  return `L${levels[0]}–L${levels[levels.length - 1]}`;
}

function rowToAction(row: SpellRow): ActorAction {
  const slotLabel = formatSlotLabel(row);
  const detailParts = [
    row.details,
    row.upcastNote ? `Upcast: ${row.upcastNote}` : "",
    row.usableSpellLevels.length > 1
      ? `Available at: ${row.usableSpellLevels.map(l => l === 0 ? "Cantrip" : `L${l}`).join(", ")}`
      : "",
  ].filter(Boolean).join(" · ");

  return {
    id: row.id,
    label: row.name || "Unnamed Spell",
    description: detailParts || row.details,
    actionKind: "spell",
    economyCost: [row.economyCost],
    logMode: "default",
    displayMode: "card",
    category: row.category || (row.level === 0 ? "Cantrips" : `Level ${row.level} Spells`),
    concentration: row.concentration,
    tags: row.usableSpellLevels.map(l => `spell-level:${l}`),
    metadata: {
      attack: row.attack || undefined,
      damage: row.damage || undefined,
      crit: row.crit || undefined,
      saveDc: row.saveDc || undefined,
      range: row.range || undefined,
      cost: row.economyCost === "main" ? "Action" : row.economyCost === "bonus" ? "Bonus Action" : "Reaction",
      slotCost: slotLabel,
      spellLevel: row.level,
      concentration: row.concentration ? "Yes" : undefined,
      details: detailParts || row.details,
    },
  };
}

function actionToRow(action: ActorAction): SpellRow {
  const cost = action.economyCost?.[0];
  const baseLevel = (action.metadata?.spellLevel ?? 0) as SpellActionLevel;
  // Recover usable levels from tags
  const usable = (action.tags ?? [])
    .filter(t => t.startsWith("spell-level:"))
    .map(t => Number(t.replace("spell-level:", "")) as SpellActionLevel)
    .sort((a, b) => a - b);

  return {
    id: action.id,
    name: action.label,
    level: baseLevel,
    usableSpellLevels: usable.length > 0 ? usable : [baseLevel],
    upcastNote: "",
    slotCost: action.metadata?.slotCost ?? (baseLevel === 0 ? "Cantrip" : `L${baseLevel}`),
    consumesSlot: baseLevel > 0,
    attack: action.metadata?.attack ?? "",
    saveDc: action.metadata?.saveDc ?? "",
    damage: action.metadata?.damage ?? "",
    crit: action.metadata?.crit ?? "",
    range: action.metadata?.range ?? "",
    concentration: Boolean(action.concentration),
    details: action.description ?? action.metadata?.details ?? "",
    category: action.category ?? "Spells",
    economyCost: cost === "bonus" ? "bonus" : cost === "reaction" ? "reaction" : "main",
    include: true,
  };
}

function makeBlankRow(): SpellRow {
  return {
    id: `spell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    level: 1,
    usableSpellLevels: [1],
    upcastNote: "",
    slotCost: "",
    consumesSlot: true,
    attack: "",
    saveDc: "",
    damage: "",
    crit: "",
    range: "",
    concentration: false,
    details: "",
    category: "Spells",
    economyCost: "main",
    include: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

type SpellTableEditorProps = {
  actions: ActorAction[];
  onChange: (actions: ActorAction[]) => void;
};

export function SpellTableEditor({ actions, onChange }: SpellTableEditorProps) {
  const [rows, setRows] = useState<SpellRow[]>(() =>
    actions.length > 0 ? actions.map(actionToRow) : [makeBlankRow()]
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updateRows(next: SpellRow[]) {
    setRows(next);
    onChange(next.filter(r => r.include && r.name.trim()).map(rowToAction));
  }

  function setRow(idx: number, patch: Partial<SpellRow>) {
    const next = rows.map((r, i) => i === idx ? { ...r, ...patch } : r);
    updateRows(next);
  }

  function addRow() {
    setRows(prev => [...prev, makeBlankRow()]);
  }

  function removeRow(idx: number) {
    updateRows(rows.filter((_, i) => i !== idx));
  }

  const inputStyle = {
    width: "100%",
    padding: "3px 5px",
    borderRadius: 3,
    border: "1px solid #333",
    background: "#111",
    color: "#fff",
    fontSize: 12,
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: "#666" }}>
        Check ✓ to include on actor card. Click a row to expand for damage/details.
      </p>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 64px 90px 80px 48px 28px", gap: 4, padding: "3px 6px", background: "#0d0d14", borderRadius: 4 }}>
        {["✓", "Spell Name", "Level", "Slot Cost", "Economy", "Conc", ""].map(h => (
          <span key={h} style={{ fontSize: 10, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{h}</span>
        ))}
      </div>

      {rows.map((row, idx) => (
        <div key={row.id} style={{ borderRadius: 4, border: `1px solid ${row.include ? "#7b68ee33" : "#2a2a2a"}`, overflow: "hidden" }}>
          {/* Main row */}
          <div
            style={{ display: "grid", gridTemplateColumns: "28px 1fr 64px 90px 80px 48px 28px", gap: 4, alignItems: "center", padding: "4px 6px", background: row.include ? "#1a1a2e" : "#111", cursor: "pointer" }}
            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
          >
            <input type="checkbox" checked={row.include}
              onClick={e => e.stopPropagation()}
              onChange={e => setRow(idx, { include: e.target.checked })}
              style={{ width: 14, height: 14, accentColor: "#7b68ee" }} />

            <input type="text" value={row.name}
              onClick={e => e.stopPropagation()}
              onChange={e => setRow(idx, { name: e.target.value })}
              placeholder="Fireball, Bless, Eldritch Blast…"
              style={inputStyle} />

            <select value={row.level}
              onClick={e => e.stopPropagation()}
              onChange={e => {
                const lvl = Number(e.target.value) as SpellActionLevel;
                setRow(idx, {
                  level: lvl,
                  consumesSlot: lvl > 0,
                  slotCost: "",
                  // Seed usable levels from base to 9 for non-cantrips
                  usableSpellLevels: lvl === 0 ? [0] : [lvl],
                });
              }}
              style={{ ...inputStyle, padding: "3px 2px" }}>
              {SPELL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>

            <input type="text" value={row.slotCost}
              onClick={e => e.stopPropagation()}
              onChange={e => setRow(idx, { slotCost: e.target.value })}
              placeholder="Cantrip, Pact Slot, L1…"
              style={inputStyle} />

            <select value={row.economyCost}
              onClick={e => e.stopPropagation()}
              onChange={e => setRow(idx, { economyCost: e.target.value as SpellRow["economyCost"] })}
              style={{ ...inputStyle, padding: "3px 2px" }}>
              <option value="main">Action</option>
              <option value="bonus">Bonus</option>
              <option value="reaction">Reaction</option>
            </select>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <input type="checkbox" checked={row.concentration}
                onClick={e => e.stopPropagation()}
                onChange={e => setRow(idx, { concentration: e.target.checked })}
                style={{ width: 14, height: 14, accentColor: "#e07b39" }}
                title="Concentration" />
            </div>

            <button type="button" onClick={e => { e.stopPropagation(); removeRow(idx); }}
              style={{ fontSize: 12, background: "transparent", border: "none", color: "#5a1a1a", cursor: "pointer", padding: 0 }}>
              ✕
            </button>
          </div>

          {/* Expanded detail row */}
          {expandedId === row.id && (
            <div style={{ padding: "8px 10px", background: "#0d0d1a", borderTop: "1px solid #2a2a3e", display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Slot levels — only for non-cantrips */}
              {row.level > 0 && (
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: "#7b68ee" }}>
                    Available at slot levels — check all levels this spell can be cast at:
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {SPELL_LEVELS.filter(l => l.value > 0).map(l => {
                      const checked = row.usableSpellLevels.includes(l.value);
                      const isBase = l.value === row.level;
                      return (
                        <label key={l.value} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: l.value >= row.level ? "pointer" : "default", opacity: l.value < row.level ? 0.3 : 1 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isBase} // base level always checked
                            onChange={e => {
                              const next = e.target.checked
                                ? [...row.usableSpellLevels, l.value].sort((a, b) => a - b) as SpellActionLevel[]
                                : row.usableSpellLevels.filter(x => x !== l.value) as SpellActionLevel[];
                              setRow(idx, { usableSpellLevels: next.length ? next : [row.level], slotCost: "" });
                            }}
                            style={{ accentColor: "#7b68ee" }}
                          />
                          <span style={{ color: isBase ? "#7b68ee" : checked ? "#fff" : "#666" }}>
                            {l.label}{isBase ? " ★" : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <label style={{ fontSize: 11, marginTop: 6, display: "block" }}>
                    Upcast note
                    <input type="text" value={row.upcastNote} onChange={e => setRow(idx, { upcastNote: e.target.value })}
                      placeholder="+1d6 per level above 3rd, +1d8 healing per level above 1st…"
                      style={{ ...inputStyle, marginTop: 2 }} />
                  </label>
                </div>
              )}

              {/* Roll fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <FormulaInput
                  label="Attack Formula"
                  value={row.attack}
                  onChange={v => setRow(idx, { attack: v })}
                  placeholder="1d20+@SPELL"
                  showVars={["@STR","@DEX","@SPELL","@WIS","@CHA","@PROF"]}
                />
                <label style={{ fontSize: 11 }}>
                  Save DC
                  <input type="text" value={row.saveDc} onChange={e => setRow(idx, { saveDc: e.target.value })}
                    placeholder="CON DC 13" style={{ ...inputStyle, marginTop: 2 }} />
                </label>
                <FormulaInput
                  label="Damage"
                  value={row.damage}
                  onChange={v => setRow(idx, { damage: v })}
                  placeholder="8d6 fire"
                  showVars={["@STR","@DEX","@WIS","@CHA"]}
                />
                <FormulaInput
                  label="Crit / Upcast Damage"
                  value={row.crit}
                  onChange={v => setRow(idx, { crit: v })}
                  placeholder="16d6 fire"
                  showVars={["@STR","@WIS","@CHA"]}
                />
                <label style={{ fontSize: 11 }}>
                  Range
                  <input type="text" value={row.range} onChange={e => setRow(idx, { range: e.target.value })}
                    placeholder="150 ft" style={{ ...inputStyle, marginTop: 2 }} />
                </label>
                <label style={{ fontSize: 11 }}>
                  Card Group
                  <input type="text" value={row.category} onChange={e => setRow(idx, { category: e.target.value })}
                    placeholder="Cantrips, Pact Spells…" style={{ ...inputStyle, marginTop: 2 }} />
                </label>
                <label style={{ fontSize: 11, gridColumn: "span 2" }}>
                  Details / Description
                  <input type="text" value={row.details} onChange={e => setRow(idx, { details: e.target.value })}
                    placeholder="Concentration 1 min. Creatures make DEX save or take half…" style={{ ...inputStyle, marginTop: 2 }} />
                </label>
              </div>
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={addRow}
        style={{ padding: "5px 12px", background: "transparent", border: "1px dashed #444", borderRadius: 4, color: "#888", cursor: "pointer", fontSize: 12, marginTop: 4, textAlign: "left" }}>
        + Add Spell
      </button>

      {rows.filter(r => r.include && r.name.trim()).length > 0 && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#555" }}>
          {rows.filter(r => r.include && r.name.trim()).length} spell{rows.filter(r => r.include && r.name.trim()).length === 1 ? "" : "s"} will be saved to actor card.
        </p>
      )}
    </div>
  );
}
