/**
 * FormulaInput
 *
 * Text field for roll formulas with quick-insert variable buttons.
 * Click a variable tag to append it to the current formula.
 *
 * Variables: @STR @DEX @CON @INT @WIS @CHA @PROF @SPELL @ATK
 *
 * Examples:
 *   Start: "1d20"  → click [@STR] → "1d20+@STR"  → click [@PROF] → "1d20+@STR+@PROF"
 *   Start: "2d6"   → click [@STR] → "2d6+@STR"
 *   Damage field: "1d8" → click [@WIS] → "1d8+@WIS"
 */

import { useRef } from "react";

type FormulaVar = {
  token: string;
  label: string;
  hint: string;
  color: string;
};

const FORMULA_VARS: FormulaVar[] = [
  { token: "@STR", label: "STR",   hint: "STR modifier (after drain/equipment)", color: "#e07b39" },
  { token: "@DEX", label: "DEX",   hint: "DEX modifier", color: "#e07b39" },
  { token: "@CON", label: "CON",   hint: "CON modifier (after life drain)", color: "#e07b39" },
  { token: "@INT", label: "INT",   hint: "INT modifier", color: "#7b68ee" },
  { token: "@WIS", label: "WIS",   hint: "WIS modifier", color: "#7b68ee" },
  { token: "@CHA", label: "CHA",   hint: "CHA modifier", color: "#7b68ee" },
  { token: "@PROF", label: "PROF", hint: "Proficiency bonus (auto from level)", color: "#4caf50" },
  { token: "@SPELL", label: "SPELL", hint: "Spellcasting mod + PROF (auto-detects class stat)", color: "#4caf50" },
  { token: "@ATK",  label: "ATK",  hint: "Higher of STR or DEX — for finesse weapons", color: "#4caf50" },
];

/** Quick-assemble dice buttons (appended as "1dX"). */
const DICE_SIZES = ["d4", "d6", "d8", "d10", "d12"] as const;

type FormulaInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** Which variable buttons to show — defaults to all */
  showVars?: string[];
  /** Show the 1d20 / dice / modifier quick-assemble row — defaults to true */
  showDice?: boolean;
  /** Show the dedicated 1d20 button inside the dice row — defaults to true (turn off for damage fields) */
  showD20?: boolean;
  style?: React.CSSProperties;
};

export function FormulaInput({
  value,
  onChange,
  placeholder,
  label,
  showVars,
  showDice = true,
  showD20 = true,
  style,
}: FormulaInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleVars = showVars
    ? FORMULA_VARS.filter(v => showVars.includes(v.token))
    : FORMULA_VARS;

  function appendToken(token: string) {
    const input = inputRef.current;
    const current = value ?? "";

    // If field is empty or ends with an operator, just append token
    // Otherwise append "+token"
    const needsPlus = current.trim() && !/[+\-*/\(]$/.test(current.trim());
    const next = current + (needsPlus ? "+" : "") + token;
    onChange(next);

    // Refocus field after clicking a button
    setTimeout(() => input?.focus(), 0);
  }

  function insertVar(token: string) {
    appendToken(token);
  }

  /** Set/insert the leading d20 term for an attack or check roll. */
  function insertD20() {
    appendToken("1d20");
  }

  /** Append a single die of the chosen size (e.g. "1d8"). */
  function insertDie(die: string) {
    appendToken(`1${die}`);
  }

  /** Nudge a flat numeric modifier, merging with a trailing +N/-N if present. */
  function adjustModifier(delta: number) {
    const input = inputRef.current;
    const current = (value ?? "").trim();
    const trailing = current.match(/([+-]\s*\d+)\s*$/);
    let next: string;
    if (trailing) {
      const currentMod = Number.parseInt(trailing[1].replace(/\s+/g, ""), 10);
      const merged = currentMod + delta;
      const head = current.slice(0, trailing.index).trimEnd();
      next = merged === 0 ? head : `${head}${merged >= 0 ? `+${merged}` : merged}`;
    } else if (!current) {
      next = delta >= 0 ? `+${delta}` : String(delta);
    } else {
      next = `${current}${delta >= 0 ? `+${delta}` : delta}`;
    }
    onChange(next);
    setTimeout(() => input?.focus(), 0);
  }

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "4px 8px",
    borderRadius: 4,
    border: "1px solid #444",
    background: "#111",
    color: "#fff",
    fontSize: 13,
    fontFamily: "monospace",
    ...style,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <span style={{ fontSize: 12, color: "#aaa" }}>{label}</span>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "1d20+@STR+@PROF"}
        style={inputStyle}
      />
      {/* Dice quick-assemble row: 1d20 + dice sizes + modifier stepper */}
      {showDice && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
          {showD20 && (
            <button type="button" onClick={insertD20} title="Insert 1d20 (attack / check)"
              style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #7b68ee66", borderRadius: 3, color: "#9d8cff", cursor: "pointer", fontFamily: "monospace", lineHeight: 1.6 }}>
              1d20
            </button>
          )}
          {DICE_SIZES.map(die => (
            <button key={die} type="button" onClick={() => insertDie(die)} title={`Add 1${die}`}
              style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #4a4a6e", borderRadius: 3, color: "#bbb", cursor: "pointer", fontFamily: "monospace", lineHeight: 1.6 }}>
              +1{die}
            </button>
          ))}
          <span style={{ display: "inline-flex", gap: 2, marginLeft: 4 }}>
            <button type="button" onClick={() => adjustModifier(-1)} title="Decrease flat modifier"
              style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer", fontFamily: "monospace", lineHeight: 1.6 }}>
              −1
            </button>
            <button type="button" onClick={() => adjustModifier(1)} title="Increase flat modifier"
              style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #2a6e2a", borderRadius: 3, color: "#8fd98f", cursor: "pointer", fontFamily: "monospace", lineHeight: 1.6 }}>
              +1
            </button>
          </span>
        </div>
      )}
      {/* Variable quick-insert buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {visibleVars.map(v => (
          <button
            key={v.token}
            type="button"
            onClick={() => insertVar(v.token)}
            title={v.hint}
            style={{
              fontSize: 10,
              padding: "1px 6px",
              background: "transparent",
              border: `1px solid ${v.color}44`,
              borderRadius: 3,
              color: v.color,
              cursor: "pointer",
              fontFamily: "monospace",
              lineHeight: 1.6,
            }}
          >
            {v.label}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Clear formula"
            style={{
              fontSize: 10,
              padding: "1px 6px",
              background: "transparent",
              border: "1px solid #5a1a1a",
              borderRadius: 3,
              color: "#ff9999",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
