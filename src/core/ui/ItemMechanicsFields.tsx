/**
 * ItemMechanicsFields — armour type, non-attack dice, reroll source and spellcasting focus.
 * The four field families that decide what an item DOES, shared by both equipment editors.
 *
 * ⚠ RULE 1A, AND THE REASON THIS FILE EXISTS. These four lived only in `EquipmentBagEditor`.
 * `EquipmentLibraryStandalone` — the DM's campaign library, where every module item is actually
 * authored — has its own 330-line form and never offered any of them. So an item created in the
 * DM library could not be a spellcasting focus, could not carry an armour type, could not roll
 * healing rather than damage, and could not be a reroll source. Those facts existed on seeded
 * items because they were written in CODE, and there was no way to reproduce them in the app.
 *
 * That is the exact shape RULE 1A names: *"if you can build it by code then a dm in the app."*
 * A code-only field is not a small gap — it looks finished from the seeded library and fails the
 * moment a DM authors their own. It also splits one item into two classes, the code-made ones
 * that work and the app-made ones that quietly don't.
 *
 * Following the `ChassisFields` / `ChargesFields` convention already in this folder: the FIELDS
 * are shared, the SKIN is the caller's — each editor passes its own input styling, and the
 * capability gate (`allows`) so each item type still only shows what it can legitimately carry.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ⚠ THIS COMPONENT IS DELIBERATELY LIMITED TO PLAYER-LEGAL ITEM MECHANICS. DO NOT ADD TO IT.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The two editors are NOT meant to converge, and an earlier note here — "so the two cannot drift
 * apart again" — read as an invitation to normalize them. It was wrong. Christopher, 2026-08-20:
 * *"Do not normalize the permissions of EquipmentBagEditor and EquipmentLibraryStandalone. Their
 * difference is intentional."*
 *
 *   EquipmentBagEditor        PLAYER-FACING. A character's bag. May only author mechanics that
 *                             are legal through character creation and level-up.
 *   EquipmentLibraryStandalone  DM/CAMPAIGN-AUTHORITATIVE. The module catalogue. Owns Convergence,
 *                             tier, source encounter, session, sourceType and DM notes.
 *
 * The boundary is a SUBMISSION-INTEGRITY boundary, not a tidiness one: if a campaign-authoritative
 * control appeared in the bag editor, a player submission could author campaign-only properties on
 * an item — minting a Convergence input, or restamping which encounter a piece of loot came from.
 * Sharing the `EquipmentItem` schema is fine and intended; sharing the AUTHORING CONTROLS is not.
 *
 * The four families below (armour type, non-attack dice, reroll source, spellcasting focus) are
 * all things a PC can legitimately acquire, so they are safe in both. Anything campaign-owned
 * belongs in the standalone form alone.
 */

import type { RerollMethod } from "../state/rerollMethod";
import { ARMOR_TYPES, EFFECT_KINDS, itemTypeAllows, type ArmorTypeId, type EffectKind } from "../constants/itemTypeCapabilities";
import type { EquipmentItem } from "./EquipmentBagEditor";

export type ItemMechanicsField = "armorType" | "effectDice" | "reroll" | "spellFocus";

const ALL_FIELDS: ItemMechanicsField[] = ["armorType", "effectDice", "reroll", "spellFocus"];

type Props = {
  draft: EquipmentItem;
  set: <K extends keyof EquipmentItem>(key: K, value: EquipmentItem[K]) => void;
  inputStyle: React.CSSProperties;
  /**
   * Which families to render here. The two editors lay their forms out differently — the bag
   * editor sits Armour type beside the AC box inside one grid, the standalone runs a single
   * column — so the CALLER decides placement while the fields themselves stay single-sourced.
   * Defaults to all four.
   */
  include?: readonly ItemMechanicsField[];
};

export function ItemMechanicsFields({ draft, set, inputStyle, include = ALL_FIELDS }: Props) {
  const allows = (c: Parameters<typeof itemTypeAllows>[1]) => itemTypeAllows(draft.type, c);
  const shows = (f: ItemMechanicsField) => include.includes(f);

  return (
    <>
      {/* ARMOUR CARRIES ITS TYPE — *"armor is armor with armor type."* It is what decides
          whether DEX applies to the AC, and at what cap. */}
      {shows("armorType") && allows("armorType") && (
        <label style={{ fontSize: 12 }}>
          Armour type
          <select value={draft.armorType ?? ""} onChange={e => set("armorType", (e.target.value || undefined) as ArmorTypeId | undefined)}
            style={{ ...inputStyle, marginTop: 2 }}>
            <option value="">— none —</option>
            {ARMOR_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <span style={{ fontSize: 10, color: "#5a5a6e" }}>
            {ARMOR_TYPES.find(a => a.id === draft.armorType)?.note ?? "Decides how DEX applies."}
          </span>
        </label>
      )}

      {/* DICE THAT ARE NOT AN ATTACK — a wondrous item rolls, it just never rolls to hit.
          Every A3/T3/T4 Convergence item is a Rider, Reaction, Bonus/Magic Action or Passive,
          and several of them roll. Removing the attack block from wondrous items was right;
          removing their dice with it was not. */}
      {shows("effectDice") && allows("effectDice") && !allows("attackDice") && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>
            Effect dice <span style={{ color: "#666" }}>— what it rolls, when it is not an attack</span>
            <input type="text" value={draft.damage ?? ""} onChange={e => set("damage", e.target.value || undefined)}
              placeholder="2d8, 1d10, +2d10..." style={inputStyle} />
          </label>
          {/* FOUR KINDS, TWO MODES. Healing, temp HP and reduction all resolve through the
              `healing` outcome mode — they are HP the bearer keeps, so none may be announced as
              damage dealt — but they are three different things at the table. */}
          <label style={{ fontSize: 12 }}>
            Rolls as
            <select value={draft.effectKind ?? "damage"}
              onChange={e => set("effectKind", e.target.value === "damage" ? undefined : e.target.value as EffectKind)}
              style={{ ...inputStyle, marginTop: 2 }}>
              {EFFECT_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <span style={{ fontSize: 10, color: "#5a5a6e" }}>
              {(EFFECT_KINDS.find(k => k.id === (draft.effectKind ?? "damage")) ?? EFFECT_KINDS[0]).note}
            </span>
          </label>
        </div>
      )}

      {/* ⚠ REROLL SOURCE. The scanner has always looked for `effect.type === "reroll"`, and the
          METHOD is chosen rather than read from the description — prose-reading is a guess, and
          guessing "other side of the die" turns a determined value into a random one. */}
      {shows("reroll") && (
      <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={draft.effect?.type === "reroll"}
            onChange={e => set("effect", e.target.checked
              ? { ...(draft.effect ?? {}), type: "reroll", rerollMethod: draft.effect?.rerollMethod ?? "reroll" }
              : (draft.effect?.type === "reroll" ? undefined : draft.effect))} />
          🎲 This can reroll a d20
          <span style={{ color: "#555", fontSize: 10 }}>— offers it in the reroll picker</span>
        </label>
        {draft.effect?.type === "reroll" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 6 }}>
            <label style={{ fontSize: 12 }}>
              Method
              <select value={draft.effect.rerollMethod ?? "reroll"}
                onChange={e => set("effect", { ...draft.effect!, rerollMethod: e.target.value as RerollMethod })}
                style={{ ...inputStyle, marginTop: 2 }}>
                <option value="reroll">Reroll — throw it again</option>
                <option value="advantage">Advantage — second d20, keep the higher</option>
                <option value="bonus">Add dice to the roll (+1d4, +1d10)</option>
                <option value="flip">Other side of the die (21 − roll)</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              When it applies
              <input type="text" value={draft.effect.condition ?? ""}
                onChange={e => set("effect", { ...draft.effect!, condition: e.target.value || undefined })}
                placeholder="a failed save vs Charmed or Frightened" style={inputStyle} />
            </label>
          </div>
        )}
        {draft.effect?.type === "reroll" && !draft.charges && (
          <div style={{ fontSize: 10, color: "#e07b39", marginTop: 4 }}>
            ⚠ Give it charges above, or it will never appear — the picker skips a reroll item with no pool to spend.
          </div>
        )}
      </div>
      )}

      {/* Spellcasting focus — weapons and wondrous items. A staff or a blade can be a focus;
          armour and rations cannot. */}
      {shows("spellFocus") && allows("spellFocus") && (
        <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
          <div style={{ fontSize: 11, color: "#9d8cff", marginBottom: 4 }}>🪄 Spellcasting focus</div>
          {/* ⚠ BEING A FOCUS IS ITS OWN FACT. A plain focus with no magical plus is still what
              every spell is cast through, and it is what supplies @SPELL to the roll — spells
              carry no @SPELL of their own. */}
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <input type="checkbox" checked={Boolean(draft.isSpellFocus)}
              onChange={e => set("isSpellFocus", e.target.checked || undefined)} />
            This item is a spellcasting focus
            <span style={{ color: "#555", fontSize: 10 }}>— supplies @SPELL to every spell cast through it</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 12 }}>Spell Attack Bonus <input type="text" value={draft.spellFocusAttack ?? ""} onChange={e => set("spellFocusAttack", e.target.value || undefined)} placeholder="+1" style={inputStyle} /></label>
            <label style={{ fontSize: 12 }}>Spell Damage Bonus <input type="text" value={draft.spellFocusDamage ?? ""} onChange={e => set("spellFocusDamage", e.target.value || undefined)} placeholder="+1, +1d4..." style={inputStyle} /></label>
            <label style={{ fontSize: 12 }}>Spell Save DC <input type="text" value={draft.spellFocusSaveDc ?? ""} onChange={e => set("spellFocusSaveDc", e.target.value || undefined)} placeholder="+1" style={inputStyle} /></label>
          </div>
          {/* WRITE THE ITEM'S OWN EXTRA ONLY. @SPELL comes from being a focus, so a +1 wand is
              "+1" and not "@SPELL+1". */}
          <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
            The item's OWN extra, on top of the @SPELL every focus supplies — "+1", not "@SPELL+1".
            Attack and damage ride the spell's rolls; the DC bonus shifts its printed save DC.
            Put riders (e.g. "ignore Half Cover") in Description.
          </div>
        </div>
      )}
    </>
  );
}
