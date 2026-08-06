/**
 * EquipmentBagEditor
 *
 * Equipment works differently from actions:
 *   - Items live in the DM equipment library (localStorage)
 *   - Attaching an item adds it to the actor's equipment tab
 *   - Detaching removes it from the actor but keeps it in the library
 *   - Items can be created on the fly and saved to library
 *
 * The actor's bag = actor.tabs.equipment (ActorAction[]) with actionKind "equipment"
 */

import { useEffect, useRef, useState } from "react";
import type { ActorAction } from "../types/tabs";
import { FormulaInput } from "./FormulaInput";
import { WEAPON_CATEGORIES, WEAPON_MASTERIES, WEAPON_MASTERY_NAMES, masteryInfoLine, type WeaponMasteryName } from "../constants/weaponMastery";
import { BASE_WEAPONS } from "../constants/baseWeapons";
import { loadPendingDrafts, savePendingDraft, removePendingDraft, newPendingDraftId, type PendingDraft } from "../state/pendingDrafts";

// ─── Equipment library (dual localStorage) ───────────────────────────────────

export type EquipmentEffectType =
  | "tempHP"        // gain temp HP — player applies manually via HP Tools
  | "reroll"        // adds this item as a reroll source in the picker
  | "armedEffect"   // arms a formula rider (additive to next damage roll)
  | "spellSlotSub"  // can substitute for a spell slot
  | "advantage"     // grant advantage — player applies manually
  | "nullifyDamage" // nullify a damage type — player applies manually
  | "custom";       // freeform — description only

export type EquipmentEffect = {
  type: EquipmentEffectType;
  /** Human-readable label shown on the armed effect pill or picker */
  label?: string;
  /** Formula for armedEffect type e.g. "+1d6+1 radiant" */
  formula?: string;
  /** For tempHP: the amount. For spellSlotSub: the slot level "L1". For nullifyDamage: the damage type */
  value?: string;
  /** Condition that must be met to use e.g. "cantrip attack or damage roll" */
  condition?: string;
};

export type EquipmentCharges = {
  max: number;
  reset: "longRest" | "shortRest" | "manual";
};

export type AbilityStatId = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type StatEffectType =
  | "setStat"   // force stat to a value (e.g. Belt of Giant Strength: STR → 21)
  | "addStat"   // add to stat (e.g. Gauntlets of Ogre Power: +2 STR)
  | "setAC"     // set base AC (armor that replaces the AC formula)
  | "addAC"     // add to AC (shield +2, ring of protection +1)
  | "addHP"     // add to HP max (Amulet of Health effect)
  | "addSpeed"; // add to speed

export type StatEffect = {
  type: StatEffectType;
  stat?: AbilityStatId;   // required for setStat/addStat
  value: number;
  /** Optional: "while equipped and not incapacitated" etc. */
  condition?: string;
};

export type EquipmentItem = {
  id: string;
  name: string;
  type: "weapon" | "armor" | "shield" | "consumable" | "gear" | "magic" | "tool" | "passive";
  description: string;
  isUsable: boolean;
  attack?: string;
  damage?: string;
  crit?: string;
  range?: string;
  ac?: string;
  /** Spellcasting focus (P-UX4 follow-up): bonuses this item adds to the SPELLS cast
   *  through it (e.g. Wand of the War Mage "+1"). Applied as a clickable additive on
   *  spell attack / damage rolls. An item can be both a weapon AND a focus. */
  spellFocusAttack?: string;
  spellFocusDamage?: string;
  value?: string;
  weight?: string;
  tags?: string[];
  /** Charge tracking for items with limited uses */
  charges?: EquipmentCharges;
  /** What happens when a charge is spent */
  effect?: EquipmentEffect;
  /** Passive stat modifications while this item is equipped */
  statEffects?: StatEffect[];
  // ── Campaign library fields (preserved from fdmc-items.json schema) ──
  /** Campaign item — DM cannot edit or delete */
  isLocked?: boolean;
  /** Item subkind from the canonical library (e.g. "Melee One-Handed", "Heavy Armor").
   *  Weapons use WEAPON_CATEGORIES: melee splits 1H / 2H / Versatile, ranged 1H / 2H. */
  category?: string;
  /** Weapon Mastery property (2024 rules). Picked in the equipment creator; its rules
   *  text is appended under Information on the generated attack. */
  mastery?: WeaponMasteryName;
  /** Item tier from campaign module (e.g. "Tier 1", "Tier 2") */
  tier?: string;
  /** Act tag from source library */
  act?: string;
  /** Session tag from source library */
  session?: string;
  /** Source encounter name */
  sourceEncounter?: string;
  /** Source type: "boss-loot" | "merchant" | "dm-reward" | "sendoff" */
  sourceType?: string;
  /** Full mechanics rules text (DM + player read) */
  mechanicsText?: string;
  /** DM-only note about the item */
  dmNote?: string;
  /** Attunement required flag */
  attunementRequired?: boolean;
  /** Convergence metadata from the canonical library */
  convergence?: {
    role: "input" | "output";
    enabled: boolean;
    mechanicalTag?: string;
    actLabel?: string;
    flavorTag?: string;
    inputIds?: string[];
    outputId?: string;
  };
};

// ─── Dual library storage ─────────────────────────────────────────────────────

const CAMPAIGN_EQUIPMENT_KEY = "fdmc.dm.equipmentLibrary.campaign.v1";
const DM_EQUIPMENT_KEY = "fdmc.dm.equipmentLibrary.dm.v1";
const CAMPAIGN_EQUIPMENT_SEED_KEY = "fdmc.dm.equipmentLibrary.campaign.seeded.v1";
// Bump to re-seed the campaign equipment library after editing the bundled items.
// v0.3.0 — Act 2 armor is now +1 magical (loot doc v5): Permafrost Hide 11→12,
// Hollowbone Halfplate 15→16, Bonemarch Plate 16→17, Wight Iron Plate 17→18,
// Frosted Sentinel Wrap 14→15, Veilstitched Leathers 12→13.
// v0.3.1 — Rimeguard 12-16→13-17 (all three modes) and Marrow Shield +2→+3.
const CAMPAIGN_EQUIPMENT_SEED_VERSION = "tbc-acts1-2-v0.3.2-rimeguard-split";

export function loadEquipmentLibrary(owner?: "campaign" | "dm"): EquipmentItem[] {
  const key = owner === "campaign" ? CAMPAIGN_EQUIPMENT_KEY : owner === "dm" ? DM_EQUIPMENT_KEY : null;
  if (key) {
    try { return (JSON.parse(window.localStorage.getItem(key) ?? "[]") as EquipmentItem[]); } catch { return []; }
  }
  // Both combined — DM items override campaign items with same ID (so edits to campaign items persist)
  const campaign = loadEquipmentLibrary("campaign");
  const dm = loadEquipmentLibrary("dm");
  const dmIds = new Set(dm.map(i => i.id));
  return [...campaign.filter(i => !dmIds.has(i.id)), ...dm];
}

export function saveEquipmentLibrary(library: EquipmentItem[], owner: "campaign" | "dm" = "dm"): void {
  const key = owner === "campaign" ? CAMPAIGN_EQUIPMENT_KEY : DM_EQUIPMENT_KEY;
  try { window.localStorage.setItem(key, JSON.stringify(library)); } catch { /* ok */ }
}

/**
 * Re-seed the bundled campaign items.
 *
 * MERGES by id rather than replacing the library wholesale. The campaign library is
 * shared: `seedBaseWeapons` puts the mundane 2024 weapons in it too. The old wholesale
 * `saveEquipmentLibrary(items, "campaign")` therefore DELETED every base weapon the
 * moment CAMPAIGN_EQUIPMENT_SEED_VERSION was bumped — and because seedBaseWeapons is
 * gated on its own separate version key, it early-returned and never put them back.
 * (That is exactly what happened on the 0.6.5.4 armour bump.)
 *
 * Bundled items win for their own ids, so edits to the shipped module data still land;
 * anything else already in the library is preserved.
 */
export function seedCampaignEquipmentLibrary(items: EquipmentItem[]): void {
  if (window.localStorage.getItem(CAMPAIGN_EQUIPMENT_SEED_KEY) === CAMPAIGN_EQUIPMENT_SEED_VERSION) return;
  const byId = new Map(loadEquipmentLibrary("campaign").map(i => [i.id, i]));
  for (const item of items) byId.set(item.id, item);
  saveEquipmentLibrary(Array.from(byId.values()), "campaign");
  window.localStorage.setItem(CAMPAIGN_EQUIPMENT_SEED_KEY, CAMPAIGN_EQUIPMENT_SEED_VERSION);
}

/** Seed version for the base weapon set — bump to re-seed after editing BASE_WEAPONS. */
const BASE_WEAPON_SEED_KEY = "fdmc.equipment.baseWeapons.seedVersion";
// v2 is a REPAIR bump, not a content change: the 0.6.5.4 campaign re-seed wiped the base
// weapons out of the shared campaign library, and this key's own guard meant they were
// never restored. Bumping re-runs the (id-preserving) weapon seed for anyone affected.
const BASE_WEAPON_SEED_VERSION = "2024-phb-v2-restore";

/**
 * Put the mundane 2024 weapons in the library.
 *
 * The library shipped with campaign magic items only, so a basic Longbow or Scimitar could
 * not be attached — which is exactly why every character's basic weapons were hand-authored
 * as main-tab attacks instead of generated from a built weapon.
 *
 * Seeded into the CAMPAIGN library alongside the module items and marked `isLocked`, so a DM
 * editing one writes an unlocked override under the same id (see `upsertItem`) rather than
 * mutating the shared base. Never overwrites an existing id.
 */
export function seedBaseWeapons(): void {
  if (window.localStorage.getItem(BASE_WEAPON_SEED_KEY) === BASE_WEAPON_SEED_VERSION) return;

  const existing = loadEquipmentLibrary("campaign");
  const byId = new Map(existing.map(i => [i.id, i]));

  for (const w of BASE_WEAPONS) {
    if (byId.has(w.id)) continue;
    byId.set(w.id, {
      id: w.id,
      name: w.name,
      type: "weapon",
      description: w.description,
      isUsable: true,
      attack: w.attack,
      damage: w.damage,
      crit: w.crit,
      range: w.range,
      category: w.category,
      mastery: w.mastery,
      tags: w.tags,
      isLocked: true,
    });
  }

  saveEquipmentLibrary(Array.from(byId.values()), "campaign");
  window.localStorage.setItem(BASE_WEAPON_SEED_KEY, BASE_WEAPON_SEED_VERSION);
}

function upsertItem(item: EquipmentItem): void {
  // Editing a locked campaign item writes an UNLOCKED DM override under the same id.
  // The combined loadEquipmentLibrary() gives DM items priority over campaign items
  // with the same id, so the edit takes effect everywhere it's referenced.
  // (Previously this silently returned for isLocked items, so library/bag edits to
  //  campaign gear appeared to do nothing.)
  const toSave: EquipmentItem = item.isLocked ? { ...item, isLocked: false } : item;
  const library = loadEquipmentLibrary("dm");
  const idx = library.findIndex(i => i.id === toSave.id);
  if (idx === -1) library.push(toSave);
  else library[idx] = toSave;
  saveEquipmentLibrary(library, "dm");
}

// ─── Export / Import ─────────────────────────────────────────────────────────

export function exportEquipmentLibrary(): void {
  const library = loadEquipmentLibrary("dm"); // only export DM custom items
  if (library.length === 0) return;
  const blob = new Blob([JSON.stringify({ schema: "fdmc.equipment-library.v1", exportedAt: new Date().toISOString(), items: library }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fdmc-equipment-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type EquipmentImportResult = {
  ok: boolean;
  added: number;
  updated: number;
  skipped: number;
  message: string;
};

export async function importEquipmentLibrary(file: File): Promise<EquipmentImportResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as { items?: unknown[]; schema?: string };
    const items = parsed.items ?? (Array.isArray(parsed) ? parsed : null);
    if (!Array.isArray(items)) {
      return { ok: false, added: 0, updated: 0, skipped: 0, message: "Invalid file — expected { items: [...] } or a raw array." };
    }
    const existing = loadEquipmentLibrary("dm");
    const existingIds = new Set(existing.map(i => i.id));
    let added = 0, updated = 0, skipped = 0;
    for (const raw of items) {
      const item = raw as EquipmentItem;
      if (!item.id || !item.name) { skipped++; continue; }
      if (existingIds.has(item.id)) updated++; else added++;
      upsertItem(item);
    }
    return { ok: true, added, updated, skipped, message: `Imported ${added + updated} item${added + updated === 1 ? "" : "s"} (${added} new, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ""}).` };
  } catch (e) {
    return { ok: false, added: 0, updated: 0, skipped: 0, message: `Import failed: ${String(e)}` };
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

// ─── AC synthesis (local copy — avoids circular dep with deriveActorStats) ───

function synthesizeAcEquipEffect(item: EquipmentItem): { type: string; value: number } | undefined {
  const ac = item.ac?.trim();
  if (!ac) return undefined;
  if (ac.startsWith("+")) {
    const val = parseInt(ac.slice(1), 10);
    if (!isNaN(val) && val > 0) return { type: "addAC", value: val };
  } else {
    const match = /^(\d+)/.exec(ac);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > 0) return { type: "setAC", value: val };
    }
  }
  return undefined;
}

/**
 * Build the full statEffects array for an item — baked at attach time so the
 * actor record is self-contained.  Includes:
 *   - All explicit statEffects from the library item
 *   - A synthesized setAC/addAC if the item has an ac string but no explicit AC effect
 */
function bakeStatEffects(item: EquipmentItem): Array<{ type: string; stat?: string; value: number; condition?: string }> | undefined {
  const effects: Array<{ type: string; stat?: string; value: number; condition?: string }> = [
    ...(item.statEffects ?? []).map(e => ({ type: e.type, stat: e.stat, value: e.value, condition: e.condition })),
  ];
  const hasAcEffect = effects.some(e => e.type === "setAC" || e.type === "addAC");
  if (!hasAcEffect && item.ac) {
    const synth = synthesizeAcEquipEffect(item);
    if (synth) effects.push(synth);
  }
  return effects.length > 0 ? effects : undefined;
}

// ─── Convert EquipmentItem → ActorAction (EQUIPMENT TAB — display/inventory) ─
//
// Equipment tab entries are INVENTORY DISPLAY ONLY.
// Weapons with attack/damage rolls live in tabs.main as attack actions.
// Armor/shields appear here with their AC info displayed but no dice.
// Consumables (charges, no attack/damage) remain clickable here (Use button).
//
// Key: metadata.statEffects is baked at attach time — actor is self-contained.
// Library changes do NOT silently alter already-equipped items.

export function itemToAction(item: EquipmentItem): ActorAction {
  const isWeapon = Boolean(item.attack || item.damage);
  // Consumables with charges but no attack dice: usable from equipment tab (e.g. Elixir, Potion)
  const isConsumable = Boolean(item.charges) && !isWeapon;
  // P-UX4 Phase 4: passive items (Ward Caches, Convergence gear) are reference/effect
  // display only — no roll/use, non-logging — and surface their full effect text on the
  // actor card. Combine description + mechanics so the player can read the whole effect.
  const isPassive = item.type === "passive";
  const passiveEffectText = isPassive
    ? [item.description, item.mechanicsText].filter(Boolean).join(" — ") || item.description
    : item.description;

  return {
    id: `equip-${item.id}`,
    label: item.name,
    description: passiveEffectText,
    actionKind: "equipment",
    // Weapons: reference-only on equipment tab (roll lives in main tab)
    // Consumables: logged when used so DM/player knows a charge was spent
    // Armor/gear: silent reference
    logMode: isConsumable ? "table-note" : "silent",
    displayMode: "compact",
    hasDefinedUse: isConsumable,  // Use button only for consumables; weapons roll from main
    economyCost: undefined,        // equipment bag never costs action economy slots
    category: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    tags: item.tags,
    metadata: {
      // Keep attack/damage for display text in the bag — but outcomeMode blocks dice button
      attack: item.attack,
      damage: item.damage,
      crit: item.crit,
      range: item.range,
      // Weapons: "reference" → TabPanel.hasAttachedDice returns false → no Roll button
      // Consumables: "triggered" → Use button fires a log entry (no dice on equip tab)
      // Armor/gear: "reference"
      outcomeMode: isConsumable ? "triggered" : "reference",
      details: [
        item.ac ? `AC ${item.ac}` : undefined,
        item.attack ? `⚔ ${item.attack}` : undefined,
        item.damage ? `💥 ${item.damage}` : undefined,
        (item.spellFocusAttack || item.spellFocusDamage)
          ? `🪄 Spell focus${item.spellFocusAttack ? ` · atk ${item.spellFocusAttack}` : ""}${item.spellFocusDamage ? ` · dmg ${item.spellFocusDamage}` : ""}`
          : undefined,
        item.range ? `Range: ${item.range}` : undefined,
        item.mastery ? `Mastery: ${item.mastery}` : undefined,
        item.value ? `Value: ${item.value}` : undefined,
        item.weight ? `Weight: ${item.weight}` : undefined,
      ].filter(Boolean).join(" · "),
      // Baked at attach time — no library lookup needed for AC/stat derivation
      statEffects: bakeStatEffects(item),
      acDisplay: item.ac,
      // Spellcasting focus bonuses — read by the spell roll workspace (clickable additive).
      spellFocusAttack: item.spellFocusAttack,
      spellFocusDamage: item.spellFocusDamage,
      charges: item.charges,
      effect: item.effect ? {
        type: item.effect.type as string,
        label: item.effect.label,
        formula: item.effect.formula,
        value: item.effect.value,
        condition: item.effect.condition,
      } : undefined,
    },
  };
}

// ─── Convert EquipmentItem → ActorAction (MAIN/ACTIONS TAB — rollable attack) ─
//
// Only called for items with attack or damage formulas.
// This is the action the player actually uses during combat.
// id prefix "atk-" distinguishes it from the equipment display entry "equip-".

export function itemToAttackAction(item: EquipmentItem): ActorAction {
  return {
    id: `atk-${item.id}`,
    label: item.name,
    description: item.description,
    actionKind: "attack",
    logMode: "table-note",
    displayMode: "compact",
    hasDefinedUse: true,
    economyCost: ["main"],
    category: item.category ?? (item.type.charAt(0).toUpperCase() + item.type.slice(1)),
    tags: item.tags,
    metadata: {
      attack: item.attack,
      damage: item.damage,
      crit: item.crit,
      range: item.range,
      cost: "Action",
      // Information on the attack: range, then the chosen Weapon Mastery's rules text.
      details: [
        item.range ? `Range: ${item.range}` : undefined,
        masteryInfoLine(item.mastery),
      ].filter(Boolean).join("\n\n") || undefined,
      // No outcomeMode — TabPanel infers "attack-roll" from attack formula (correct behavior)
    },
  };
}

// ─── Item form ────────────────────────────────────────────────────────────────

const ITEM_TYPES: EquipmentItem["type"][] = ["weapon", "armor", "shield", "consumable", "gear", "magic", "tool", "passive"];

type ItemFormProps = {
  initial?: EquipmentItem;
  onSave: (item: EquipmentItem) => void;
  onCancel: () => void;
};

function ItemForm({ initial, onSave, onCancel }: ItemFormProps) {
  const [draft, setDraft] = useState<EquipmentItem>(() => initial ?? {
    id: `item-${Date.now().toString(36)}`,
    name: "",
    type: "gear",
    description: "",
    isUsable: false,
  });

  const [errors, setErrors] = useState<string[]>([]);
  // Pending drafts (P-ROLL3b) — only meaningful when creating a brand-new item
  const [equipDrafts, setEquipDrafts] = useState<PendingDraft<EquipmentItem>[]>(
    () => loadPendingDrafts<EquipmentItem>("equipment"),
  );
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  function set<K extends keyof EquipmentItem>(key: K, value: EquipmentItem[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    setErrors([]);
  }

  function handleSave() {
    if (!draft.name.trim()) { setErrors(["Item name is required."]); return; }
    const item: EquipmentItem = {
      ...draft,
      id: draft.id || `item-${slugify(draft.name)}-${Date.now().toString(36)}`,
      name: draft.name.trim(),
    };
    // Finalize: this item is now truly created, so clear its pending draft.
    if (activeDraftId) removePendingDraft("equipment", activeDraftId);
    onSave(item);
  }

  function handleSaveDraft() {
    if (!draft.name.trim()) { setErrors(["Name the item before saving a draft."]); return; }
    const id = activeDraftId ?? newPendingDraftId("equipment");
    setEquipDrafts(savePendingDraft<EquipmentItem>("equipment", {
      id, name: draft.name.trim(), savedAt: new Date().toISOString(), payload: draft,
    }));
    setActiveDraftId(id);
  }

  function handleResumeDraft(d: PendingDraft<EquipmentItem>) {
    setDraft(d.payload);
    setActiveDraftId(d.id);
    setErrors([]);
  }

  function handleDiscardDraft(id: string) {
    setEquipDrafts(removePendingDraft<EquipmentItem>("equipment", id));
    if (activeDraftId === id) setActiveDraftId(null);
  }

  const inputStyle = {
    display: "block" as const, width: "100%", marginTop: 2,
    padding: "4px 8px", borderRadius: 4, border: "1px solid #444",
    background: "#111", color: "#fff", fontSize: 13,
  };

  const isWeapon = draft.type === "weapon" || draft.type === "magic";
  const isArmor = draft.type === "armor" || draft.type === "shield";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, background: "#1a1a2e", borderRadius: 8 }}>
      <h4 style={{ margin: 0 }}>{initial ? "Edit Item" : "New Item"}</h4>

      {/* Pending / Drafts — parked in-progress items (new-item mode only) */}
      {!initial && equipDrafts.length > 0 && (
        <div style={{ padding: "8px 10px", background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#9d8cff", textTransform: "uppercase", letterSpacing: 1 }}>Pending / Drafts · {equipDrafts.length}</span>
          {equipDrafts.map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ flex: 1, minWidth: 100, fontSize: 12 }}>{d.name}{activeDraftId === d.id ? " · editing" : ""}</strong>
              <span style={{ fontSize: 10, color: "#666" }}>{new Date(d.savedAt).toLocaleString()}</span>
              <button type="button" onClick={() => handleResumeDraft(d)} style={{ fontSize: 11, padding: "2px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#9d8cff", cursor: "pointer" }}>Resume</button>
              <button type="button" onClick={() => handleDiscardDraft(d.id)} style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>Discard</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>
          Name *
          <input type="text" value={draft.name} onChange={e => set("name", e.target.value)} style={inputStyle} autoFocus />
        </label>
        <label style={{ fontSize: 12 }}>
          Type
          <select value={draft.type} onChange={e => set("type", e.target.value as EquipmentItem["type"])} style={{ ...inputStyle, marginTop: 2 }}>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </label>
      </div>

      {/* Weapon fields */}
      {isWeapon && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Attack roll — dice picker (1d20 + dice + @vars) since this weapon makes an attack roll */}
          <FormulaInput label="Attack" value={draft.attack ?? ""} onChange={v => set("attack", v || undefined)} placeholder="1d20+@STR+@PROF" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 12 }}>Damage <input type="text" value={draft.damage ?? ""} onChange={e => set("damage", e.target.value || undefined)} placeholder="1d8+3" style={inputStyle} /></label>
            <label style={{ fontSize: 12 }}>Crit <input type="text" value={draft.crit ?? ""} onChange={e => set("crit", e.target.value || undefined)} placeholder="2d8+3" style={inputStyle} /></label>
            <label style={{ fontSize: 12 }}>Range <input type="text" value={draft.range ?? ""} onChange={e => set("range", e.target.value || undefined)} placeholder="5 ft, 150/600 ft..." style={inputStyle} /></label>
          </div>

          {/* Hand count + Weapon Mastery.
              Mastery is deliberately a FREE CHOICE, never derived from the weapon name:
              a mastery is only live when the character has a feature unlocking it for that
              weapon, so the same longsword is Sap for a Fighter and nothing for a Wizard.
              Picking one appends its rules text under Information on the generated attack. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 12 }}>
              Category
              <select
                value={draft.category ?? ""}
                onChange={e => set("category", e.target.value || undefined)}
                style={{ ...inputStyle, marginTop: 2 }}
              >
                <option value="">— none —</option>
                {WEAPON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              Weapon Mastery
              <select
                value={draft.mastery ?? ""}
                onChange={e => set("mastery", (e.target.value || undefined) as WeaponMasteryName | undefined)}
                style={{ ...inputStyle, marginTop: 2 }}
              >
                <option value="">— none —</option>
                {WEAPON_MASTERY_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>
          {draft.mastery && WEAPON_MASTERIES[draft.mastery] && (
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "#8a8aa0", background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
              <strong style={{ color: "#d7b36a" }}>{draft.mastery}.</strong>{" "}
              {WEAPON_MASTERIES[draft.mastery].summary}
              <br />
              <span style={{ color: "#5a5a6e" }}>
                Officially on: {WEAPON_MASTERIES[draft.mastery].weapons.join(", ")}. Applies only if the character has a feature unlocking it.
              </span>
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <span />
          </div>
        </div>
      )}

      {/* Armor fields */}
      {isArmor && (
        <label style={{ fontSize: 12 }}>
          AC Value / Formula
          <input type="text" value={draft.ac ?? ""} onChange={e => set("ac", e.target.value || undefined)} placeholder="14, 12 + DEX mod..." style={inputStyle} />
        </label>
      )}

      {/* Spellcasting focus — bonuses this item adds to the SPELLS cast through it.
          Leave blank for non-focus items. Works alongside a weapon attack (both). */}
      <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
        <div style={{ fontSize: 11, color: "#9d8cff", marginBottom: 4 }}>🪄 Spellcasting focus <span style={{ color: "#555" }}>(blank = not a focus)</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>Spell Attack Bonus <input type="text" value={draft.spellFocusAttack ?? ""} onChange={e => set("spellFocusAttack", e.target.value || undefined)} placeholder="+1" style={inputStyle} /></label>
          <label style={{ fontSize: 12 }}>Spell Damage Bonus <input type="text" value={draft.spellFocusDamage ?? ""} onChange={e => set("spellFocusDamage", e.target.value || undefined)} placeholder="+1, +1d4..." style={inputStyle} /></label>
        </div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>Added to spell attack/damage rolls as a clickable focus toggle. Put riders (e.g. "ignore Half Cover") in Description.</div>
      </div>

      <label style={{ fontSize: 12 }}>
        Description
        <textarea value={draft.description} onChange={e => set("description", e.target.value)} rows={2}
          style={{ ...inputStyle, resize: "vertical" as const }} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Value <input type="text" value={draft.value ?? ""} onChange={e => set("value", e.target.value || undefined)} placeholder="25 gp" style={inputStyle} /></label>
        <label style={{ fontSize: 12 }}>Weight <input type="text" value={draft.weight ?? ""} onChange={e => set("weight", e.target.value || undefined)} placeholder="3 lb" style={inputStyle} /></label>
      </div>

      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={draft.isUsable} onChange={e => set("isUsable", e.target.checked)} />
        Has a usable action (shows Use button on actor card)
      </label>

      {/* Stat effects — passive stat modifications while item is equipped */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "#aaa" }}>Stat Effects (while equipped)</span>
          <button type="button"
            onClick={() => set("statEffects", [...(draft.statEffects ?? []), { type: "addStat", stat: "str", value: 0 }])}
            style={{ fontSize: 10, padding: "1px 7px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
            + Add Effect
          </button>
        </div>
        {(draft.statEffects ?? []).map((eff, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 70px 60px 28px", gap: 4, marginBottom: 4, alignItems: "center" }}>
            <select value={eff.type} onChange={e => {
              const next = [...(draft.statEffects ?? [])];
              next[i] = { ...eff, type: e.target.value as StatEffect["type"] };
              set("statEffects", next);
            }} style={{ ...inputStyle, fontSize: 11, padding: "2px 4px" }}>
              <option value="setStat">Set Stat</option>
              <option value="addStat">Add to Stat</option>
              <option value="setAC">Set AC</option>
              <option value="addAC">Add to AC</option>
              <option value="addHP">Add to HP Max</option>
              <option value="addSpeed">Add to Speed</option>
            </select>
            {(eff.type === "setStat" || eff.type === "addStat") && (
              <select value={eff.stat ?? "str"} onChange={e => {
                const next = [...(draft.statEffects ?? [])];
                next[i] = { ...eff, stat: e.target.value as StatEffect["stat"] };
                set("statEffects", next);
              }} style={{ ...inputStyle, fontSize: 11, padding: "2px 4px" }}>
                {(["str","dex","con","int","wis","cha"] as const).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            )}
            <input type="number" value={eff.value} onChange={e => {
              const next = [...(draft.statEffects ?? [])];
              next[i] = { ...eff, value: Number(e.target.value) };
              set("statEffects", next);
            }} style={{ ...inputStyle, fontSize: 11, padding: "2px 4px", textAlign: "center" }} />
            <button type="button" onClick={() => set("statEffects", (draft.statEffects ?? []).filter((_, j) => j !== i))}
              style={{ fontSize: 12, background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer", padding: "1px 4px" }}>
              ✕
            </button>
          </div>
        ))}
        {(draft.statEffects ?? []).length === 0 && (
          <p style={{ fontSize: 11, color: "#444", fontStyle: "italic", margin: 0 }}>None — passive items with no stat modifications.</p>
        )}
      </div>

      {errors.map(e => <p key={e} style={{ margin: 0, fontSize: 12, color: "#ff9999" }}>{e}</p>)}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={handleSave} style={{ padding: "5px 16px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {initial ? "Save Item" : "Create & Attach"}
        </button>
        {!initial && (
          <button type="button" onClick={handleSaveDraft} title="Park this in-progress item as a pending draft (survives reloads)"
            style={{ padding: "5px 16px", background: "transparent", color: "#9d8cff", border: "1px solid #7b68ee44", borderRadius: 4, cursor: "pointer" }}>
            {activeDraftId ? "Update Draft" : "Save as Draft"}
          </button>
        )}
        <button type="button" onClick={onCancel} style={{ padding: "5px 16px", background: "transparent", color: "#888", border: "1px solid #444", borderRadius: 4, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Bag editor ───────────────────────────────────────────────────────────────

type EquipmentBagEditorProps = {
  /** Current equipped items — actor.tabs.equipment (display/inventory) */
  equippedActions: ActorAction[];
  /** Current main-tab actions — actor.tabs.main (weapons attach rollable actions here) */
  mainActions: ActorAction[];
  /**
   * Called with tab updates when equipment changes.
   * Always includes `equipment`. Includes `main` when a weapon is attached/detached.
   */
  onChange: (updates: { equipment?: ActorAction[]; main?: ActorAction[] }) => void;
};

export function EquipmentBagEditor({ equippedActions, mainActions, onChange }: EquipmentBagEditorProps) {
  const [view, setView] = useState<"bag" | "library" | "create">("bag");
  const [library, setLibrary] = useState<EquipmentItem[]>(() => loadEquipmentLibrary());
  const [editingItem, setEditingItem] = useState<EquipmentItem | undefined>(undefined);

  // ── Migration: bake statEffects into pre-snapshot equipment entries; create
  //              missing attack actions in main for weapons already equipped. ──
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const equippedActionsRef = useRef(equippedActions);
  equippedActionsRef.current = equippedActions;
  const mainActionsRef = useRef(mainActions);
  mainActionsRef.current = mainActions;

  useEffect(() => {
    const allItems = loadEquipmentLibrary();
    const current = equippedActionsRef.current;
    const currentMain = mainActionsRef.current;
    let equipChanged = false;
    let mainChanged = false;
    const newMain = [...currentMain];

    const refreshed = current.map(a => {
      const itemId = a.id.replace(/^equip-/, "");
      const item = allItems.find(i => i.id === itemId || `equip-${i.id}` === a.id);
      if (!item) return a;

      // Re-derive as fresh snapshot if statEffects are missing or logMode is stale
      const fresh = itemToAction(item);
      const needsRefresh =
        a.metadata?.statEffects === undefined ||
        a.logMode !== fresh.logMode ||
        a.hasDefinedUse !== fresh.hasDefinedUse;

      if (needsRefresh) equipChanged = true;

      // If this is a weapon, ensure it has an attack action in main tab
      if (item.attack || item.damage) {
        const atkId = `atk-${item.id}`;
        if (!newMain.some(m => m.id === atkId)) {
          newMain.push(itemToAttackAction(item));
          mainChanged = true;
        }
      }

      return needsRefresh ? fresh : a;
    });

    const updates: { equipment?: ActorAction[]; main?: ActorAction[] } = {};
    if (equipChanged) updates.equipment = refreshed;
    if (mainChanged) updates.main = newMain;
    if (equipChanged || mainChanged) onChangeRef.current(updates);
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const equippedIds = new Set(equippedActions.map(a => a.id.replace("equip-", "")));

  function refreshLibrary() {
    setLibrary(loadEquipmentLibrary());
  }

  function attachItem(item: EquipmentItem) {
    if (equippedIds.has(item.id)) return; // already equipped
    const newEquipment = [...equippedActions, itemToAction(item)];
    const updates: { equipment: ActorAction[]; main?: ActorAction[] } = { equipment: newEquipment };
    // Weapons also get a rollable attack action in the main (Actions) tab
    if (item.attack || item.damage) {
      const atkEntry = itemToAttackAction(item);
      if (!mainActions.some(a => a.id === atkEntry.id)) {
        updates.main = [...mainActions, atkEntry];
      }
    }
    onChange(updates);
  }

  /**
   * Rebuild an EquipmentItem from the actor's copy, for anything not already in the library.
   *
   * Attaching bakes the item onto the actor, so the actor's entry is a complete record — this
   * reads it back out. Only ever used to RESCUE an item on detach; a library item is never
   * overwritten from an actor's baked copy, because that copy may carry attach-time edits.
   */
  function actionToItem(action: ActorAction, itemId: string): EquipmentItem {
    const m = action.metadata ?? {};
    return {
      id: itemId,
      name: action.label,
      type: (m.attack || m.damage) ? "weapon" : "gear",
      description: action.description ?? "",
      isUsable: Boolean(action.hasDefinedUse),
      attack: m.attack,
      damage: m.damage,
      crit: m.crit,
      range: m.range,
      ac: m.acDisplay,
      spellFocusAttack: m.spellFocusAttack,
      spellFocusDamage: m.spellFocusDamage,
      charges: m.charges,
      // `metadata` stores these with widened `string` types (it is the generic action shape),
      // so narrow them back on the way home. Same objects, round-tripped.
      effect: m.effect as EquipmentEffect | undefined,
      statEffects: m.statEffects as StatEffect[] | undefined,
      category: action.category,
      tags: action.tags,
    };
  }

  function detachItem(actionId: string) {
    const itemId = actionId.replace(/^equip-/, "");
    const detached = equippedActions.find(a => a.id === actionId);

    // NEVER lose a player-created item. Detach was written assuming everything came FROM the
    // library ("stays in library"), which is false for anything a player built on the fly —
    // an artificer's replicated or infused gear, a DM-improvised item. Those existed only on
    // the actor, so detaching destroyed them. Anything unknown to the library is banked there
    // on the way out; items already in the library are left exactly as they are.
    if (detached) {
      const known = loadEquipmentLibrary().some(i => i.id === itemId);
      if (!known) {
        upsertItem(actionToItem(detached, itemId));
        refreshLibrary();
      }
    }

    const newEquipment = equippedActions.filter(a => a.id !== actionId);
    const newMain = mainActions.filter(a => a.id !== `atk-${itemId}`);
    const hadAtkEntry = newMain.length !== mainActions.length;
    onChange({ equipment: newEquipment, ...(hadAtkEntry ? { main: newMain } : {}) });
  }

  // Equip/unequip without removing: flips metadata.equipped so the item stays in the
  // bag but its stat effects / AC / spell-focus bonuses stop (or resume) applying.
  function toggleEquipped(actionId: string) {
    const newEquipment = equippedActions.map(a =>
      a.id === actionId
        ? { ...a, metadata: { ...a.metadata, equipped: a.metadata?.equipped === false } }
        : a,
    );
    onChange({ equipment: newEquipment });
  }

  function handleCreateItem(item: EquipmentItem) {
    upsertItem(item);
    refreshLibrary();
    attachItem(item);
    setView("bag");
  }

  function handleSaveLibraryItem(item: EquipmentItem) {
    upsertItem(item);
    refreshLibrary();
    // Update both equipment display entry and attack action if already equipped
    if (equippedIds.has(item.id)) {
      const newEquipment = equippedActions.map(a => a.id === `equip-${item.id}` ? itemToAction(item) : a);
      const updates: { equipment: ActorAction[]; main?: ActorAction[] } = { equipment: newEquipment };
      if (item.attack || item.damage) {
        updates.main = mainActions.map(a => a.id === `atk-${item.id}` ? itemToAttackAction(item) : a);
      }
      onChange(updates);
    }
    setEditingItem(undefined);
    setView("library");
  }

  function removeFromLibrary(itemId: string) {
    // Cannot remove locked campaign items
    const dmLib = loadEquipmentLibrary("dm").filter(i => i.id !== itemId);
    saveEquipmentLibrary(dmLib, "dm");
    setLibrary(loadEquipmentLibrary());
    const newEquipment = equippedActions.filter(a => a.id !== `equip-${itemId}`);
    const newMain = mainActions.filter(a => a.id !== `atk-${itemId}`);
    const hadAtkEntry = newMain.length !== mainActions.length;
    onChange({ equipment: newEquipment, ...(hadAtkEntry ? { main: newMain } : {}) });
  }

  // ── Bag view ────────────────────────────────────────────────────────────────
  if (view === "bag") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
            {equippedActions.length === 0 ? "No items equipped." : `${equippedActions.length} item${equippedActions.length === 1 ? "" : "s"} equipped.`}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => { refreshLibrary(); setView("library"); }}
              style={{ fontSize: 11, padding: "3px 10px", background: "#2a3a4e", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}>
              From Library
            </button>
            <button type="button" onClick={() => { setEditingItem(undefined); setView("create"); }}
              style={{ fontSize: 11, padding: "3px 10px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
              + New Item
            </button>
          </div>
        </div>

        {equippedActions.length === 0 ? (
          <p style={{ fontSize: 11, color: "#444", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
            Click "From Library" to attach existing items or "New Item" to create one.
          </p>
        ) : (
          equippedActions.map(action => {
            const isUnequipped = action.metadata?.equipped === false;
            return (
            <div key={action.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#161622", borderRadius: 8, border: `1px solid ${isUnequipped ? "#3a3a1a" : "#2a2a3e"}`, opacity: isUnequipped ? 0.6 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{action.label}</span>
                  {isUnequipped && <span style={{ fontSize: 10, color: "#c9a227", background: "#2a2410", padding: "1px 6px", borderRadius: 10 }}>○ Unequipped</span>}
                  {action.category && <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 6px", borderRadius: 10 }}>{action.category}</span>}
                  {action.hasDefinedUse && <span style={{ fontSize: 10, color: "#7b68ee" }}>● Usable</span>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  {action.metadata?.attack && <span style={{ fontSize: 11, color: "#7b68ee" }}>⚔ {action.metadata.attack}</span>}
                  {action.metadata?.damage && <span style={{ fontSize: 11, color: "#e07b39" }}>💥 {action.metadata.damage}</span>}
                  {action.metadata?.details && !action.metadata?.attack && (
                    <span style={{ fontSize: 11, color: "#666" }}>{action.metadata.details.slice(0, 60)}</span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => toggleEquipped(action.id)}
                style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: `1px solid ${isUnequipped ? "#2a6e2a" : "#4a4a6e"}`, borderRadius: 3, color: isUnequipped ? "#8fd98f" : "#9d8cff", cursor: "pointer" }}
                title={isUnequipped ? "Equip — re-apply its bonuses" : "Unequip — keep the item but stop its bonuses"}>
                {isUnequipped ? "Equip" : "Unequip"}
              </button>
              <button type="button" onClick={() => detachItem(action.id)}
                style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #5a3a1a", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}
                title="Detach from actor — removes the item (stays in library)">
                Detach
              </button>
            </div>
            );
          })
        )}
      </div>
    );
  }

  // ── Create new item view ────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <ItemForm
        initial={editingItem}
        onSave={editingItem ? handleSaveLibraryItem : handleCreateItem}
        onCancel={() => { setEditingItem(undefined); setView("bag"); }}
      />
    );
  }

  // ── Library view ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#888" }}>Equipment Library — click to attach</p>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => { setEditingItem(undefined); setView("create"); }}
            style={{ fontSize: 11, padding: "3px 10px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
            + New Item
          </button>
          <button type="button" onClick={() => setView("bag")}
            style={{ fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
            ← Bag
          </button>
        </div>
      </div>

      {library.length === 0 ? (
        <p style={{ fontSize: 11, color: "#444", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          No items in library. Create one with + New Item.
        </p>
      ) : (
        library.map(item => {
          const isEquipped = equippedIds.has(item.id);
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: isEquipped ? "#1a2a1a" : "#161622", borderRadius: 8, border: `1px solid ${isEquipped ? "#2a6e2a44" : "#2a2a3e"}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                  <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 6px", borderRadius: 10 }}>{item.type}</span>
                  {isEquipped && <span style={{ fontSize: 10, color: "#4caf50" }}>● Equipped</span>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  {item.attack && <span style={{ fontSize: 11, color: "#7b68ee" }}>⚔ {item.attack}</span>}
                  {item.damage && <span style={{ fontSize: 11, color: "#e07b39" }}>💥 {item.damage}</span>}
                  {item.description && <span style={{ fontSize: 11, color: "#555" }}>{item.description.slice(0, 50)}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {!isEquipped ? (
                  <button type="button" onClick={() => { attachItem(item); setView("bag"); }}
                    style={{ fontSize: 11, padding: "3px 8px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
                    Attach
                  </button>
                ) : (
                  <button type="button" onClick={() => { detachItem(`equip-${item.id}`); }}
                    style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #5a3a1a", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}>
                    Detach
                  </button>
                )}
                <button type="button" onClick={() => { setEditingItem(item); setView("create"); }}
                  style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                  Edit
                </button>
                <button type="button" onClick={() => removeFromLibrary(item.id)}
                  style={{ fontSize: 11, padding: "3px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
