/**
 * DAMAGE TYPE — one control, for whichever editor is asking.
 *
 * ⚠ THE SPELL EDITOR HAD NO WAY TO SET ONE AT ALL. The action editor grew a damage-type select
 * and a read-from-text suggestion; the spell editor got neither, and every spell in the game is
 * authored in the spell editor. Christopher: *"i still cant just pick a damage tpye like for
 * spells like i can from actions, the pick a damage type from text isnt working nor is there a
 * spell damage option when i click things like surcerous burst."*
 *
 * Measured against his own library: of fifteen damaging spells across five characters, ZERO carry
 * a damage type. Not because nobody typed one — because there was no box to type it in. Fire Bolt
 * says "deals 2d10 fire damage" in its own description, `readDamageTypeChoice` reads that
 * correctly, and the spell editor threw the answer away.
 *
 * ⚠ THE READING IS OFFERED, NEVER APPLIED. A wrong guess has to be visible, so the text's answer
 * is a note with a button beside the picker rather than something that rewrites the field. That
 * rule is why this is a shared component and not two: the action editor already had it right, and
 * a second copy would have drifted from it the first time either side changed.
 *
 * Two shapes, because a spell is not an action:
 *
 *   FIXED    one type, the normal case — an action takes exactly this
 *   CHOICE   a permitted SET the caster picks from at the table — Sorcerous Burst names seven
 *
 * Christopher, on why they differ: *"an action editor is a pick the attack element while a spell
 * is a possable array of elements."* So `options` is only wired up by the spell editor, and the
 * card turns that set into buttons at cast time.
 */

import { useState } from "react";
import { DAMAGE_TYPES, isCustomDamageType } from "../constants/damageTypes";
import { readDamageTypeChoice } from "../rules/damageTypeChoice";

const select = {
  display: "block", width: "100%", marginTop: 2, padding: "4px 8px",
  borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff",
} as const;

export function DamageTypePicker({
  value,
  onChange,
  text,
  isHealing,
  options,
  onOptions,
  label = "Damage Type",
}: {
  /** The chosen type, or the pre-selected one when the caster picks. */
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  /** The spell or action's own rules text, read for a suggestion. */
  text?: string;
  /** Healing has no damage type, and asking for one is noise. */
  isHealing?: boolean;
  /**
   * The permitted SET, for a spell whose caster picks per cast. Omit for an action — passing it
   * is what turns this from one type into an array.
   */
  options?: string[];
  onOptions?: (next: string[] | undefined) => void;
  label?: string;
}) {
  const [custom, setCustom] = useState(() => isCustomDamageType(value));
  const reading = readDamageTypeChoice(text, isHealing ? "healing" : undefined);
  const offersSet = Boolean(onOptions) && reading.kind === "choice";
  const setMatches = offersSet
    && options?.length === reading.options.length
    && reading.options.every(t => options?.includes(t));

  return (
    <div style={{ gridColumn: "span 2" }}>
      {reading.kind !== "none" && (
        <div style={{ fontSize: 10, color: reading.kind === "choice" ? "#7be08a" : "#667", padding: "2px 0" }}>
          {reading.kind === "choice" ? "⚡ Caster picks: " : "Reads as: "}
          <strong style={{ color: "#dfe4ff" }}>{reading.options.join(" · ")}</strong>
          <span style={{ display: "block", color: "#667" }}>{reading.reason}</span>
          <span style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
            {reading.primary && value !== reading.primary && (
              <button type="button" className="inline-commit-button"
                onClick={() => { onChange(reading.primary); setCustom(false); }}>
                Use {reading.primary}
              </button>
            )}
            {/* The whole set, for a spell. One click instead of naming seven types by hand. */}
            {offersSet && !setMatches && (
              <button type="button" className="inline-commit-button"
                title="Give the card the full set of types the caster may pick from at cast time."
                onClick={() => onOptions?.(reading.options.slice())}>
                Offer all {reading.options.length} on the card
              </button>
            )}
          </span>
        </div>
      )}

      <label style={{ fontSize: 11 }}>
        {label}
        <select
          value={custom ? "__custom__" : (value ?? "")}
          onChange={e => {
            const v = e.target.value;
            if (v === "__custom__") setCustom(true);
            else { setCustom(false); onChange(v || undefined); }
          }}
          style={select}
        >
          <option value="">— none —</option>
          {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          {/* All-system, not D&D-locked — the same escape hatch the action editor offers. */}
          <option value="__custom__">Custom…</option>
        </select>
        {custom && (
          <input type="text" value={value ?? ""} onChange={e => onChange(e.target.value || undefined)}
            placeholder="custom damage type (e.g. shadow, void)"
            style={{ ...select, marginTop: 4 }} />
        )}
      </label>

      {/* What the card will actually offer, once a set exists. Shown so it is not invisible state. */}
      {onOptions && (options?.length ?? 0) > 0 && (
        <div style={{ fontSize: 10, color: "#7be08a", marginTop: 3, display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "#667" }}>card offers:</span>
          <strong style={{ color: "#dfe4ff" }}>{options!.join(" · ")}</strong>
          <button type="button" className="inline-commit-button" onClick={() => onOptions?.(undefined)}>clear</button>
        </div>
      )}
    </div>
  );
}
