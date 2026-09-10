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
import { readDamageTypeChoice } from "../rules/damageTypeChoice";
import { DamageTypePicker } from "./DamageTypePicker";
import { FormulaInput } from "./FormulaInput";
import { SaveDcComposer } from "./SaveDcComposer";
import type { ActorAction } from "../types/tabs";
import { type SpellActionLevel } from "../types/spellSlots";

// ─── Row type ─────────────────────────────────────────────────────────────────

type SpellRow = {
  id: string;
  name: string;
  level: SpellActionLevel;              // base / minimum slot level (0 = cantrip)
  /** Highest slot this can be cast at, as a string for the select. "" = no cap. */
  maxSpellLevel: string;
  /** Cantrip damage at character levels 5 / 11 / 17. Each replaces the base. */
  cantripTiers?: { l5?: string; l11?: string; l17?: string };
  upcastNote: string;                   // e.g. "+1d6 per level above 3rd"
  /** What ONE extra slot level adds to damage/healing (Fireball = "1d6"). "" = nothing. */
  upcastDamage: string;
  /** Separate attack rolls one cast makes at the base level (Scorching Ray = 3). "" = 1. */
  attackRolls: string;
  /** Extra rolls per slot level above base (Scorching Ray = 1). "" = no scaling. */
  attackRollsPerLevel: string;
  slotCost: string;                     // display label: "Cantrip", "Pact Slot", "L1–L5", etc.
  consumesSlot: boolean;
  attack: string;
  saveDc: string;
  damage: string;
  crit: string;
  range: string;
  duration: string;
  concentration: boolean;
  details: string;
  category: string;
  economyCost: "main" | "bonus" | "reaction";
  /** Class-feature spell: uses per long rest. "" / "0" = normal slot-cast spell. */
  classFeatureUses: string;
  /** Weapon-buff rider (Hungering Blade): damage added to weapon attacks while toggled on. */
  weaponBuffDamage: string;
  /**
   * Which class casts this spell. "" = the main class.
   *
   * SPELLS are where this matters most and the picker was built in the OTHER editor first —
   * a Wizard/Cleric resolves @SPELL through INT or WIS depending on the spell, and until this
   * row carried the choice the whole sheet used one stat.
   */
  castingClass: "" | "main" | "second" | "third";
  /** Which save the TARGET rolls. Separate from how the DC number is derived. */
  saveAbility: string;
  /** On a MAXIMUM damage die, roll another and add it — Sorcerous Burst. */
  explodingDamage: boolean;
  /**
   * What this spell DEALS.
   *
   * ⚠ THERE WAS NO BOX FOR THIS, AND SO NOT ONE SPELL IN THE LIBRARY HAD ONE. Fifteen damaging
   * spells across five characters, all untyped — not because nobody typed a type, because the
   * spell editor never offered the field. The action editor had it; every spell is authored here.
   */
  damageType: string;
  /**
   * The permitted SET, when the caster picks per cast — Sorcerous Burst names seven. Derived from
   * the spell's own text on save, and now also settable, because a derivation nobody can see or
   * correct is the thing this codebase keeps having to undo.
   */
  damageTypeOptions?: string[];
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
  // Base level only. "Castable at L3 and above" is the rule for every spell, so spelling out
  // a range per spell told the reader nothing they did not already know.
  return `L${row.level}`;
}

function rowToAction(row: SpellRow): ActorAction {
  // Class-feature spell: spends a dedicated 1-per-long-rest resource (not a spell slot).
  const cfUses = Number.parseInt(row.classFeatureUses, 10);
  const isClassFeature = Number.isFinite(cfUses) && cfUses > 0;
  /**
   * ⚠ THE COST COLUMN IS THE AUTHOR'S, AND IT USED TO BE OVERWRITTEN ON EVERY SAVE.
   *
   * Christopher, 2026-09-10: *"i remove the 1/LR but keep the 1 free cast and it is reverting the
   * cost back to 1/LR"* — reproduced live on Find Steed: cleared, saved, and back to "1/Long Rest"
   * when the card was reopened.
   *
   * This read `isClassFeature ? \`${cfUses}/Long Rest\` : formatSlotLabel(row)`, so the moment the
   * uses box held a number the cost column was recomputed and whatever the author had put there
   * was discarded. Typing a different label did nothing; CLEARING it did nothing either, because
   * both roads ended at the same derived string.
   *
   * `formatSlotLabel` already has the right precedence — a typed label wins, and blank derives
   * "L{level}" from the level. A class-feature spell needs no exception to that: what makes it a
   * class feature is `spellSlotMode` and `classFeatureUses`, which are set from the uses box a few
   * lines below and are not touched here. The label was only ever a display string.
   *
   * ⚠ EXISTING SHEETS DO NOT MOVE. Every class-feature spell authored so far has "N/Long Rest"
   * STORED in `metadata.slotCost` and read back into the row, so it is a typed label and keeps
   * winning. Only clearing the box changes anything — which is the thing that was asked for.
   */
  const slotLabel = formatSlotLabel(row);
  const detailParts = [
    row.details,
    isClassFeature ? `Class feature — ${cfUses}/Long Rest` : "",
    row.upcastNote ? `Upcast: ${row.upcastNote}` : "",
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
    // One tag, for the level the spell STARTS at. The castable range is base→9 by rule.
    tags: [`spell-level:${row.level}`],
    metadata: {
      attack: row.attack || undefined,
      damage: row.damage || undefined,
      crit: row.crit || undefined,
      saveDc: row.saveDc || undefined,
      range: row.range || undefined,
      duration: row.duration || undefined,
      cost: row.economyCost === "main" ? "Action" : row.economyCost === "bonus" ? "Bonus Action" : "Reaction",
      slotCost: slotLabel,
      spellLevel: row.level,
      ...(Number(row.maxSpellLevel) > row.level ? { maxSpellLevel: Number(row.maxSpellLevel) } : {}),
      ...(row.level === 0 && row.cantripTiers && Object.values(row.cantripTiers).some(v => v && v.trim()) ? { cantripTiers: row.cantripTiers } : {}),
      ...(row.upcastDamage.trim() ? { upcastDamage: row.upcastDamage.trim() } : {}),
      ...(Number(row.attackRolls) > 1 ? { attackRolls: Number(row.attackRolls) } : {}),
      ...(Number(row.attackRollsPerLevel) > 0 ? { attackRollsPerLevel: Number(row.attackRollsPerLevel) } : {}),
      // freeCast routes the cast to the dedicated resource (App.tsx consume routing).
      ...(isClassFeature ? { spellSlotMode: "freeCast" as const, classFeatureUses: cfUses } : {}),
      ...(row.weaponBuffDamage.trim() ? { weaponBuffDamage: row.weaponBuffDamage.trim() } : {}),
      ...(row.castingClass ? { castingClass: row.castingClass } : {}),
      ...(row.saveAbility.trim() ? { saveAbility: row.saveAbility.trim() } : {}),
      ...(row.explodingDamage ? { explodingDamage: true } : {}),
      ...(row.damageType.trim() ? { damageType: row.damageType.trim() } : {}),
      /**
       * THE ELEMENT PICKER, on the editor a spell is ACTUALLY built in.
       *
       * This was derived only in pcActionAdapters (the ACTION editor), so a spell authored
       * here — which is every spell — reached the card with no permitted set and therefore no
       * picker. Sorcerous Burst names seven types in its own text and offered none of them.
       *
       * A spell takes an ARRAY where an action takes one element: *"an action editor is a pick
       * the attack element while a spell is a possable array of elements"*. A healing spell needs
       * no mode flag here — "spells doesnt need it because you are casting a spell that says
       * healing" — its text names no damage type, so the reader returns `none` unprompted.
       */
      ...(() => {
        // ⚠ AN AUTHORED SET WINS. This used to re-derive on every save, so clearing a set the
        // reader had suggested was impossible — the next save put it straight back.
        if (row.damageTypeOptions) return { damageTypeOptions: row.damageTypeOptions };
        const reading = readDamageTypeChoice(detailParts || row.details);
        return reading.kind === "choice" ? { damageTypeOptions: reading.options } : {};
      })(),
      concentration: row.concentration ? "Yes" : undefined,
      details: detailParts || row.details,
    },
  };
}

function actionToRow(action: ActorAction): SpellRow {
  const cost = action.economyCost?.[0];
  const baseLevel = (action.metadata?.spellLevel ?? 0) as SpellActionLevel;
  // `rowToAction` composes the details as "notes · Upcast: … · Available at: …". Reading the
  // whole string back as the note re-composed those derived segments on every save, so a
  // spell edited twice grew "Upcast: x · Upcast: x". Recover the note into its own field and
  // strip the derived parts, which also self-heals rows that already doubled up.
  const composedDetails = action.description ?? action.metadata?.details ?? "";
  const recoveredUpcast = composedDetails.match(/Upcast:\s*([^·]+)/i)?.[1]?.trim() ?? "";
  const plainDetails = composedDetails
    .replace(/Upcast:\s*[^·]*(?:·\s*)?/gi, "")
    .replace(/Available at:\s*[^·]*(?:·\s*)?/gi, "")
    .replace(/Class feature\s*—\s*[^·]*(?:·\s*)?/gi, "")
    .replace(/\s*·\s*$/, "")
    .trim();

  return {
    id: action.id,
    name: action.label,
    level: baseLevel,
    maxSpellLevel: action.metadata?.maxSpellLevel ? String(action.metadata.maxSpellLevel) : "",
    cantripTiers: action.metadata?.cantripTiers,
    upcastNote: recoveredUpcast,
    slotCost: action.metadata?.slotCost ?? (baseLevel === 0 ? "Cantrip" : `L${baseLevel}`),
    consumesSlot: baseLevel > 0,
    attack: action.metadata?.attack ?? "",
    saveDc: action.metadata?.saveDc ?? "",
    damage: action.metadata?.damage ?? "",
    crit: action.metadata?.crit ?? "",
    range: action.metadata?.range ?? "",
    duration: action.metadata?.duration ?? "",
    concentration: Boolean(action.concentration),
    details: plainDetails,
    category: action.category ?? "Spells",
    economyCost: cost === "bonus" ? "bonus" : cost === "reaction" ? "reaction" : "main",
    classFeatureUses: action.metadata?.spellSlotMode === "freeCast" && action.metadata?.classFeatureUses
      ? String(action.metadata.classFeatureUses)
      : "",
    weaponBuffDamage: action.metadata?.weaponBuffDamage ?? "",
    castingClass: action.metadata?.castingClass ?? "",
    saveAbility: action.metadata?.saveAbility ?? "",
    explodingDamage: Boolean(action.metadata?.explodingDamage),
    damageType: action.metadata?.damageType ?? "",
    damageTypeOptions: action.metadata?.damageTypeOptions,
    upcastDamage: action.metadata?.upcastDamage ?? "",
    attackRolls: action.metadata?.attackRolls ? String(action.metadata.attackRolls) : "",
    attackRollsPerLevel: action.metadata?.attackRollsPerLevel ? String(action.metadata.attackRollsPerLevel) : "",
    include: true,
  };
}

function makeBlankRow(): SpellRow {
  return {
    id: `spell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    level: 1,
    maxSpellLevel: "",
    upcastNote: "",
    upcastDamage: "",
    attackRolls: "",
    attackRollsPerLevel: "",
    slotCost: "",
    consumesSlot: true,
    attack: "",
    saveDc: "",
    damage: "",
    crit: "",
    range: "",
    duration: "",
    concentration: false,
    details: "",
    category: "Spells",
    economyCost: "main",
    classFeatureUses: "",
    weaponBuffDamage: "",
    castingClass: "",
    saveAbility: "",
    explodingDamage: false,
    damageType: "",
    include: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

type SpellTableEditorProps = {
  actions: ActorAction[];
  onChange: (actions: ActorAction[]) => void;
  /** The character's class rows, in slot order — populates the per-spell "Cast using" picker. */
  classRows?: { name: string; level: number }[];
};

export function SpellTableEditor({ actions, onChange, classRows = [] }: SpellTableEditorProps) {
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
            /**
             * TWO COLUMNS. Every field was a full-width row, so a single spell ran off the
             * bottom of the panel and authoring one meant scrolling past fields that are three
             * characters wide. Blocks that genuinely need the width — the cantrip tiers, the
             * slot-level row, and the roll fields, which are a two-column grid of their own —
             * span both.
             */
            <div style={{ padding: "8px 10px", background: "#0d0d1a", borderTop: "1px solid #2a2a3e", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "start" }}>

              {/* CANTRIPS scale on CHARACTER level, not a slot — so they get these three
                  boxes where a levelled spell gets its upcast rider. Each box is the whole
                  damage at that tier, because a cantrip REPLACES its dice rather than adding
                  to them: Fire Bolt is 2d10 at 5th, not 1d10 + 1d10. Leave a tier blank when
                  nothing changes there. */}
              {row.level === 0 && (
                <div style={{ gridColumn: "span 2" }}>
                  <p style={{ margin: "0 0 5px", fontSize: 11, color: "#7b68ee" }}>
                    Damage by character level — each box replaces the base, not added to it
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {([["l5", "At 5th"], ["l11", "At 11th"], ["l17", "At 17th"]] as const).map(([key, label]) => (
                      <label key={key} style={{ fontSize: 11, color: "#999" }}>
                        {label}
                        <input type="text" value={row.cantripTiers?.[key] ?? ""}
                          onChange={e => setRow(idx, {
                            cantripTiers: { ...(row.cantripTiers ?? {}), [key]: e.target.value },
                          })}
                          placeholder={key === "l5" ? "2d10" : key === "l11" ? "3d10" : "4d10"}
                          style={{ ...inputStyle, marginTop: 2, width: 90 }} />
                      </label>
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: "#666", display: "block", marginTop: 4 }}>
                    Base {row.damage || "—"} until 5th. The highest tier the character has reached wins.
                  </span>
                </div>
              )}

              {/* Slot levels — only for non-cantrips */}
              {row.level > 0 && (
                <div style={{ gridColumn: "span 2" }}>
                  {/* The per-spell "available at" checkbox grid is gone. EVERY SPELL UPCASTS,
                      so the castable range is base→9 and re-stating it on each spell was 39
                      lists all saying the same thing — plus one more way to lock a spell out
                      of a slot it should have been able to use. The only level a spell needs
                      to record is the one it STARTS at, set by the Level field above. */}
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#666" }}>
                    Castable at <strong style={{ color: "#7b68ee" }}>L{row.level}</strong>
                    {Number(row.maxSpellLevel) > row.level
                      ? <> through <strong style={{ color: "#7b68ee" }}>L{row.maxSpellLevel}</strong>.</>
                      : <> and every slot above it.</>}
                    {" "}A bigger slot is always spendable, whether or not it adds anything.
                  </p>
                  {/* The one exception to base→9. Divine Smite tops out at a 5th-level slot:
                      a 6th buys nothing, so offering it only invites a wasted slot. One number
                      — "where does it stop" — not the old list of which levels were legal. */}
                  <label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                    Stops scaling at (blank = no cap)
                    <select value={row.maxSpellLevel}
                      onChange={e => setRow(idx, { maxSpellLevel: e.target.value })}
                      style={{ ...inputStyle, marginTop: 2 }}>
                      <option value="">No cap — up to L9</option>
                      {SPELL_LEVELS.filter(l => l.value > row.level).map(l => (
                        <option key={l.value} value={String(l.value)}>Caps at L{l.value}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: 11, marginTop: 6, display: "block" }}>
                    Upcast note
                    <input type="text" value={row.upcastNote} onChange={e => setRow(idx, { upcastNote: e.target.value })}
                      placeholder="+1d6 per level above 3rd, +1d8 healing per level above 1st…"
                      style={{ ...inputStyle, marginTop: 2 }} />
                  </label>

                  {/* The machine version of the note above: authored once, multiplied by how
                      far the cast is above base. This is what actually gets rolled. */}
                  <label style={{ fontSize: 11, marginTop: 6, display: "block" }}>
                    Upcast rider — added per level above L{row.level}
                    <input type="text" value={row.upcastDamage}
                      onChange={e => setRow(idx, { upcastDamage: e.target.value })}
                      placeholder="1d6, 2d8, 1d8+2… (blank = no automatic scaling)"
                      style={{ ...inputStyle, marginTop: 2 }} />
                    {row.upcastDamage.trim() && (
                      <span style={{ fontSize: 10, color: "#9be9a8", display: "block", marginTop: 2 }}>
                        ⚡ Rolled automatically: {row.damage || "base"} at L{row.level},
                        {" "}+{row.upcastDamage.trim()} for each level above.
                        {Number(row.attackRollsPerLevel) > 0 && (
                          <span style={{ color: "#e0a85a" }}> ⚠ This spell also gains a roll per level — using both double-counts the upcast.</span>
                        )}
                      </span>
                    )}
                  </label>
                </div>
              )}

              {/* Class-feature spell: dedicated uses/long-rest resource instead of a spell slot */}
              <label style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
                <span>Class feature uses / Long Rest <span style={{ color: "#555" }}>(blank = normal spell slot)</span></span>
                <input type="number" min={0} value={row.classFeatureUses}
                  onChange={e => setRow(idx, { classFeatureUses: e.target.value })}
                  placeholder="e.g. 1"
                  style={{ ...inputStyle, maxWidth: 140 }} />
                {Number(row.classFeatureUses) > 0 && (
                  <span style={{ fontSize: 10, color: "#9be9a8" }}>
                    ◇ Spends a dedicated “{row.name || "spell"}” resource ({row.classFeatureUses}/Long Rest), auto-added to the Resources list — does not use a spell slot.
                  </span>
                )}
              </label>

              {/* Weapon-buff rider (Hungering Blade): toggles on as a persistent damage
                  additive on the actor's WEAPON attacks. */}
              <label style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
                <span>Weapon buff rider <span style={{ color: "#555" }}>(blank = none)</span></span>
                <input type="text" value={row.weaponBuffDamage}
                  onChange={e => setRow(idx, { weaponBuffDamage: e.target.value })}
                  placeholder="@CHA, 1d6, 1d6+@WIS..."
                  style={{ ...inputStyle, maxWidth: 200 }} />
                {row.weaponBuffDamage.trim() && (
                  <span style={{ fontSize: 10, color: "#e0a85a" }}>
                    ⚔ Shows as a clickable toggle on the card; while on, adds {row.weaponBuffDamage} to your weapon-attack damage. Spend the slot by casting; apply once-per-turn / temp-HP riders manually.
                  </span>
                )}
              </label>

              {/* Multi-roll spells — ONE cast, ONE slot, several separate attack rolls that
                  each resolve hit/miss with their own damage (Scorching Ray's rays). */}
              <label style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
                <span>Attack rolls per cast <span style={{ color: "#555" }}>(blank = 1 — a single roll)</span></span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min={1} value={row.attackRolls}
                    onChange={e => setRow(idx, { attackRolls: e.target.value })}
                    placeholder="3" style={{ ...inputStyle, maxWidth: 70, textAlign: "center" }} />
                  <span style={{ color: "#555" }}>+</span>
                  <input type="number" min={0} value={row.attackRollsPerLevel}
                    onChange={e => setRow(idx, { attackRollsPerLevel: e.target.value })}
                    placeholder="1" style={{ ...inputStyle, maxWidth: 70, textAlign: "center" }} />
                  <span style={{ color: "#666", fontSize: 10 }}>per slot level above L{row.level}</span>
                </div>
                {Number(row.attackRolls) > 1 && (
                  <span style={{ fontSize: 10, color: "#9be9a8" }}>
                    ⚡ {Number(row.attackRolls)} rolls at L{row.level}
                    {Number(row.attackRollsPerLevel) > 0
                      ? `, ${Number(row.attackRolls) + Number(row.attackRollsPerLevel)} at L${row.level + 1}…`
                      : ""}
                    . Each is its own to-hit and damage; the cast still spends one slot.
                  </span>
                )}
              </label>

              {/* Roll fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, gridColumn: "span 2" }}>
                <FormulaInput
                  label="Attack Formula"
                  value={row.attack}
                  onChange={v => setRow(idx, { attack: v })}
                  placeholder="1d20+@SPELL"
                  showVars={["@STR","@DEX","@SPELL","@WIS","@CHA","@PROF"]}
                />
                {/* WHICH CLASS CASTS THIS SPELL. Only asked when the character has more than one
                    class. @SPELL resolves through that class's ability, so a Wizard/Cleric gets
                    INT on one spell and WIS on the next instead of one stat for every spell. */}
                {classRows.length > 1 && (
                  <label style={{ fontSize: 12 }}>
                    Cast using
                    <select
                      value={row.castingClass}
                      onChange={e => setRow(idx, { castingClass: e.target.value as SpellRow["castingClass"] })}
                      style={{ ...inputStyle, marginTop: 2 }}
                    >
                      <option value="">— main class ({classRows[0]?.name}) —</option>
                      {classRows.slice(0, 3).map((c, i) => (
                        <option key={c.name + i} value={i === 0 ? "main" : i === 1 ? "second" : "third"}>
                          {c.name} {c.level}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {/* TOGGLES, NOT A TYPED BOX — the same composer the action editor uses. The 8
                    is constant in every save DC, so authoring it is ceremony, and a typed
                    number freezes at the level it was written with nothing to flag it stale. */}
                <SaveDcComposer
                  saveDc={row.saveDc}
                  onSaveDc={v => setRow(idx, { saveDc: v })}
                  saveAbility={row.saveAbility}
                  onSaveAbility={v => setRow(idx, { saveAbility: v })}
                />
                {/* Sorcerous Burst is the shape this exists for, and it is a SPELL — so the
                    control has to be here, not only on the action editor. Same detector as the
                    crit rider that grants GWM its extra attack; the difference is which die is
                    watched. */}
                <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6, gridColumn: "span 2" }}>
                  <input type="checkbox" checked={row.explodingDamage}
                    onChange={e => setRow(idx, { explodingDamage: e.target.checked })} />
                  Exploding damage dice <span style={{ color: "#667" }}>— on a max damage die, roll another and add it</span>
                </label>
                <FormulaInput
                  label="Damage"
                  value={row.damage}
                  onChange={v => setRow(idx, { damage: v })}
                  placeholder="8d6 fire"
                  showVars={["@STR","@DEX","@WIS","@CHA","@CASTMOD","@PROF","@MAIN"]}
                />
                <FormulaInput
                  label="Crit / Upcast Damage"
                  value={row.crit}
                  onChange={v => setRow(idx, { crit: v })}
                  placeholder="16d6 fire"
                  showVars={["@STR","@WIS","@CHA"]}
                />
                {/* ⚠ THE FIELD THAT WAS NOT HERE. Every spell in the game is authored on this
                    screen, and it offered no way to say what the spell DEALS — so the encounter
                    checker, weighting a creature's fire resistance by how much fire the party
                    actually throws, found fifteen damaging spells and no types.
                    Christopher: *"i still cant just pick a damage tpye like for spells like i can
                    from actions."* Same control the action editor uses, literally — see
                    `DamageTypePicker`, which both now share so they cannot drift apart again. */}
                <DamageTypePicker
                  value={row.damageType || undefined}
                  onChange={v => setRow(idx, { damageType: v ?? "" })}
                  text={row.details}
                  options={row.damageTypeOptions}
                  onOptions={v => setRow(idx, { damageTypeOptions: v })}
                />
                <label style={{ fontSize: 11 }}>
                  Range
                  <input type="text" value={row.range} onChange={e => setRow(idx, { range: e.target.value })}
                    placeholder="150 ft" style={{ ...inputStyle, marginTop: 2 }} />
                </label>
                <label style={{ fontSize: 11 }}>
                  Duration
                  <input type="text" value={row.duration} onChange={e => setRow(idx, { duration: e.target.value })}
                    placeholder="Instantaneous, 1 min, Conc. up to 10 min…" style={{ ...inputStyle, marginTop: 2 }} />
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
