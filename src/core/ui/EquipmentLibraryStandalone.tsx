/**
 * EquipmentLibraryStandalone
 *
 * Full equipment library panel for the DM tools window.
 * Reuses EquipmentBagEditor's library storage.
 * Adds loot delivery — DM selects item + seat → broadcasts to player.
 */

import { useState, useEffect } from "react";
import { parseActField, parseSessionField } from "../campaign/actTags";
import { loadConvergenceInbox, removeFromConvergenceInbox } from "../state/convergenceInbox";
import { SELECTABLE_ITEM_TYPES, itemTypeAllows } from "../constants/itemTypeCapabilities";
import OBR from "@owlbear-rodeo/sdk";
import { matchingForms } from "../constants/chassis";
import { LootPoolBuilder } from "./LootPoolBuilder";
import { ChassisFields } from "./ChassisFields";
import { ChargesFields } from "./ChargesFields";
import { ItemMechanicsFields } from "./ItemMechanicsFields";
import { loadEquipmentLibrary, saveEquipmentLibrary, exportEquipmentLibrary, importEquipmentLibrary, itemToAction, SLOT_LABEL, SLOT_CAPACITY, type EquipmentItem, type EquipmentImportResult, fingerprintEquipmentItem } from "./EquipmentBagEditor";
import type { FdmcSeat } from "../seats/seatTypes";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "../seats/seatTypes";
import { useModuleUnlock, ModuleUnlockPrompt } from "../campaign/moduleUnlock";
import { COIN_TYPES, COIN_LABEL, COIN_ABBR, formatCopperPrice, type CoinType } from "../currency/currency";
import { PARTY_WALLET_SEAT_ID } from "../table-state/fdmcRoomLiveState";
import { WEAPON_MASTERY_NAMES } from "../constants/weaponMastery";
import { saveOpenLootOffer, loadOpenLootOffer, currentPicker, skipCurrentPicker, closeOpenOffer, OPEN_LOOT_OFFER_CHANGED, type OpenLootOffer } from "./openLootOffer";
// ─── Loot broadcast types ─────────────────────────────────────────────────────

/** DM sends a single item directly (existing flow) */
export type LootDelivery = {
  type: "fdmc:loot-delivery";
  seatId: string;
  item: EquipmentItem;
  deliveryId: string;
  message: string;
};

/**
 * DM sends a list of items — player must pick one.
 *
 * Re-sent to every recipient after each pick, carrying the items that are STILL available,
 * so a claimed item drops off everyone's list. See openLootOffer.ts for the stock model.
 */
export type LootOffer = {
  type: "fdmc:loot-offer";
  seatId: string;
  offerId: string;
  items: EquipmentItem[];
  message: string;
  /** boss-mid = compact strip during combat; boss-final = full-screen; merchant = shows gold cost */
  mode?: "boss-mid" | "boss-final" | "merchant";
  /** true = players pick one at a time in the DM's order; false/absent = open shop. */
  ordered?: boolean;
  /** Ordered offers: the seat whose pick it is. Others see "waiting on…" and can't claim. */
  turnSeatId?: string;
  /** Display name for the seat currently picking. */
  turnLabel?: string;
  /** The round is over (pool empty or everyone picked) — dismiss the overlay. */
  closed?: boolean;
};

/** DM pushes a convergence offer — player picks a combo using items they own */
export type ConvergenceOffer = {
  type: "fdmc:convergence-offer";
  seatId: string;
  offerId: string;
  /** Each convergence option: submit these input items → receive this output item */
  combos: Array<{
    outputItem: EquipmentItem;
    inputItems: Array<{ id: string; name: string }>;
    description: string;
  }>;
  message: string;
};

/** Player submits items for convergence — DM receives, picks output, and approves */
export type ConvergenceRequest = {
  type: "fdmc:convergence-request";
  seatId: string;
  offerId: string;
  outputItemId?: string;       // not filled by player — DM selects at approval
  submittedItemIds: string[];  // the items the player is sacrificing
  submittedItemNames: string[]; // resolved names for DM display
  actorId: string;
  actorName: string;
};

/** Player broadcasts their chosen item back to DM */
export type LootChoice = {
  type: "fdmc:loot-choice";
  seatId: string;
  offerId: string;
  chosenItemId: string;
  actorId: string;
  /** Merchant purchase — gold to deduct from the buyer. Absent/0 for free loot. */
  cost?: number;
};

export function isLootDelivery(msg: unknown): msg is LootDelivery {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:loot-delivery");
}
export function isLootOffer(msg: unknown): msg is LootOffer {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:loot-offer");
}
export function isLootChoice(msg: unknown): msg is LootChoice {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:loot-choice");
}
export function isConvergenceOffer(msg: unknown): msg is ConvergenceOffer {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:convergence-offer");
}
/**
 * A convergence request must carry its submitted items, not just its type.
 *
 * The approval panel maps over `submittedItemIds` directly, so a message that names the type
 * but lacks the array throws DURING RENDER — which shows as a blank screen with no way out,
 * because the control that closes it is inside the component that failed to render. Checking
 * the shape here means a malformed message is ignored where it arrives instead of taking the
 * window down when someone clicks Review.
 */
export function isConvergenceRequest(msg: unknown): msg is ConvergenceRequest {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as { type?: unknown; submittedItemIds?: unknown; seatId?: unknown };
  return m.type === "fdmc:convergence-request"
    && Array.isArray(m.submittedItemIds)
    && typeof m.seatId === "string";
}

// itemToAction is imported from EquipmentBagEditor (canonical source with weapon auto-detect)

// ─── Item form (inline) ───────────────────────────────────────────────────────

// Read from the ONE shared table — this file used to keep its own list, and it silently
// disagreed with EquipmentBagEditor (which also offered the now-retired "passive").
const ITEM_TYPES: EquipmentItem["type"][] = SELECTABLE_ITEM_TYPES;

// Loot groups by ACT first, then by encounter/merchant inside it, in campaign order —
// so the library reads like the campaign runs instead of alphabetically. Base weapons
// get their own bucket at the end (they belong to no act), and untagged items fall into
// "Unsorted" last.
const UNGROUPED_KEY = "__ungrouped__";
const BASE_WEAPON_KEY = "__base_weapons__";
const CONVERGENCE_KEY = "__convergence_outputs__";

/** Mundane 2024 weapons seeded by seedBaseWeapons — no act, no source encounter. */
function isBaseWeapon(it: EquipmentItem): boolean {
  return it.type === "weapon" && !it.sourceEncounter?.trim() && !it.act?.trim();
}

/**
 * A COMPLETED convergence item — the crafted output, not the input that dropped.
 *
 * Outputs are made, not found, so they have no source encounter and were falling into
 * "Unsorted", where twelve of them flooded the list alongside genuinely untagged gear. They
 * get their own collapsed section, the same treatment the 2024 weapon bases already have.
 *
 * INPUTS are deliberately NOT pulled out: they drop from bosses, so they belong in the boss
 * pool they came from, next to the weapons and armour from the same fight.
 */
function isConvergenceOutput(it: EquipmentItem): boolean {
  return it.convergence?.role === "output";
}

export type EquipmentGroup = {
  key: string;
  label: string;
  items: EquipmentItem[];
  /** Act heading this group sits under ("Act 2", "2024 Weapon Bases", "Unsorted"). */
  actLabel: string;
  /** Sort bucket: act number, 9000 for base weapons, 9999 for unsorted. */
  actBucket: number;
};

/** "seat-3" → 3. Unparseable ids sort last rather than jumping the queue. */
function seatNumber(seatId: string): number {
  const n = Number.parseInt(/(\d+)/.exec(seatId)?.[1] ?? "", 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function groupByEncounter(items: EquipmentItem[]): EquipmentGroup[] {
  const groups = new Map<string, { items: EquipmentItem[]; act: number; session: number }>();
  /**
   * ⚠ AN ITEM MAY APPEAR IN SEVERAL POOLS. A choice item — a Feywild Gift offered at either Gate
   * II or Gate III — is ONE item that both pools can hand out. Listing it only under its primary
   * encounter would hide it from the DM running the other gate, which is precisely the fight
   * where they need to see it.
   *
   * The loop is over (item, pool) pairs rather than items. Base weapons and convergence outputs
   * keep their own single buckets — neither is a drop.
   */
  const pairs: { it: EquipmentItem; key: string }[] = [];
  for (const it of items) {
    const base = isBaseWeapon(it);
    const conv = !base && isConvergenceOutput(it);
    if (base) { pairs.push({ it, key: BASE_WEAPON_KEY }); continue; }
    if (conv) { pairs.push({ it, key: CONVERGENCE_KEY }); continue; }
    const primary = it.sourceEncounter?.trim();
    const extra = (it.sourceEncounters ?? []).map(s => s.trim()).filter(Boolean);
    const keys = [...new Set([primary, ...extra].filter(Boolean))] as string[];
    if (keys.length === 0) { pairs.push({ it, key: UNGROUPED_KEY }); continue; }
    for (const key of keys) pairs.push({ it, key });
  }
  for (const { it, key } of pairs) {
    const base = isBaseWeapon(it);
    const conv = !base && isConvergenceOutput(it);
    if (!groups.has(key)) {
      groups.set(key, {
        items: [],
        // 8900 puts completed convergence after the acts but before the weapon bases.
        act: base ? 9000 : conv ? 8900 : parseActField(it.act) || 9999,
        session: parseSessionField(it.session),
      });
    }
    const g = groups.get(key)!;
    g.items.push(it);
    // A group takes the EARLIEST act/session any of its items claims, so one untagged
    // straggler can't drag a whole boss pool into Unsorted.
    // Convergence outputs keep their own bucket — narrowing would pull them back into the act
    // their inputs came from, which is where they were flooding the list in the first place.
    if (!base && !conv) {
      const a = parseActField(it.act); if (a > 0 && a < g.act) g.act = a;
      const s = parseSessionField(it.session); if (s > 0 && (g.session === 0 || s < g.session)) g.session = s;
    }
  }

  const out: EquipmentGroup[] = [];
  for (const [key, g] of groups) {
    const actLabelText = key === BASE_WEAPON_KEY ? "2024 Weapon Bases"
      : key === CONVERGENCE_KEY ? "Convergence — Completed"
      : g.act >= 9999 ? "Unsorted"
      : `Act ${g.act}`;
    out.push({
      key,
      label: key === BASE_WEAPON_KEY ? "2024 Weapon Bases"
        : key === CONVERGENCE_KEY ? "Convergence — Completed Items"
        : key === UNGROUPED_KEY ? "Unsorted (no encounter)"
        : key,
      items: [...g.items].sort((a, b) => a.name.localeCompare(b.name)),
      actLabel: actLabelText,
      actBucket: g.act,
    });
    // stash session for the sort below
    (out[out.length - 1] as EquipmentGroup & { _session?: number })._session = g.session;
  }

  // Campaign order: act, then session, then encounter name. Base weapons and Unsorted last.
  out.sort((a, b) => {
    if (a.actBucket !== b.actBucket) return a.actBucket - b.actBucket;
    const sa = (a as EquipmentGroup & { _session?: number })._session ?? 0;
    const sb = (b as EquipmentGroup & { _session?: number })._session ?? 0;
    if (sa !== sb) return sa - sb;
    return a.label.localeCompare(b.label);
  });
  return out;
}

function ItemForm({ initial, preset, onSave, onCancel }: {
  initial?: EquipmentItem;
  /** Defaults applied only when creating a NEW item (initial undefined). */
  preset?: Partial<EquipmentItem>;
  onSave: (item: EquipmentItem) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<EquipmentItem>(() => initial ?? {
    id: `item-${Date.now().toString(36)}`,
    name: "",
    type: "gear",
    description: "",
    isUsable: false,
    ...preset,
  });

  const input = { display: "block" as const, width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 13 };

  function set<K extends keyof EquipmentItem>(k: K, v: EquipmentItem[K]) {
    setDraft(d => ({ ...d, [k]: v }));
  }

  /**
   * ⚠ ONE GATE, THE SHARED MATRIX. This form previously gated NOTHING through
   * `itemTypeAllows` — it had two ad-hoc booleans for attack dice and AC, and left Convergence,
   * Mastery and the spell-focus pair visible on every item type, which is the long scroll
   * Christopher objected to: *"each gear type should only allow the editing of fields that would
   * effect those types, like you shouldn't be able to add a AC on anything except armor."*
   */
  const allows = (c: Parameters<typeof itemTypeAllows>[1]) => itemTypeAllows(draft.type, c);
  const isWeapon = allows("attackDice");
  const isArmor = allows("ac");

  return (
    // The form SCROLLS. It grew past the panel height once the chassis block landed, and with
    // no overflow the Create/Save buttons at the bottom were unreachable — the item could be
    // filled in but never finished. Viewport-relative so it adapts to the OBR popover.
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "#1a1a2e", borderRadius: 8, margin: 14, maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>
      <h4 style={{ margin: 0, position: "sticky", top: 0, background: "#1a1a2e", paddingBottom: 6, zIndex: 1 }}>{initial ? "Edit Item" : "New Item"}</h4>
      {!initial && draft.sourceEncounter && (
        <div style={{ fontSize: 11, color: "#e0b34a", background: "#2a230d", border: "1px solid #5a4a1a", borderRadius: 6, padding: "6px 10px" }}>
          🎁 Adding to loot pool: <strong>{draft.sourceEncounter}</strong> — this item will appear under that encounter.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Name <input type="text" value={draft.name} onChange={e => set("name", e.target.value)} style={input} /></label>
        <label style={{ fontSize: 12 }}>Type
          <select value={draft.type} onChange={e => set("type", e.target.value as EquipmentItem["type"])} style={{ ...input, marginTop: 2 }}>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {/* ADAPTIVE sits at the top and REPLACES the weapon/armour fields.
          A chassis is not a variation on a fixed item — it IS the item, and its numbers come
          from whichever form the wielder picks. Showing both at once read as though you were
          filling in a specific weapon and then adding options to it, which is backwards. */}
      <ChassisFields draft={draft} set={set} />

      {isWeapon && !draft.chassis && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>Attack <input type="text" value={draft.attack ?? ""} onChange={e => set("attack", e.target.value || undefined)} placeholder="1d20+5" style={input} /></label>
          <label style={{ fontSize: 12 }}>Damage <input type="text" value={draft.damage ?? ""} onChange={e => set("damage", e.target.value || undefined)} placeholder="1d8+3" style={input} /></label>
          <label style={{ fontSize: 12 }}>Crit <input type="text" value={draft.crit ?? ""} onChange={e => set("crit", e.target.value || undefined)} placeholder="2d8+3" style={input} /></label>
          <label style={{ fontSize: 12, gridColumn: "span 3" }}>Range <input type="text" value={draft.range ?? ""} onChange={e => set("range", e.target.value || undefined)} placeholder="5 ft, 150/600 ft..." style={input} /></label>
          {/* The save the TARGET rolls. A magic item does not roll to hit; set this and the
              card announces the save and waits before damage is applied. */}
          <label style={{ fontSize: 12, gridColumn: "span 3" }}>Save DC <span style={{ color: "#666" }}>— target rolls this before damage lands</span>
            <input type="text" value={draft.saveDc ?? ""} onChange={e => set("saveDc", e.target.value || undefined)} placeholder="CON DC 13" style={input} /></label>
        </div>
      )}
      {isArmor && !draft.chassis && <label style={{ fontSize: 12 }}>AC <input type="text" value={draft.ac ?? ""} onChange={e => set("ac", e.target.value || undefined)} placeholder="14" style={input} /></label>}
      <label style={{ fontSize: 12 }}>Description <textarea value={draft.description} onChange={e => set("description", e.target.value)} rows={2} style={{ ...input, resize: "vertical" as const }} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Value <input type="text" value={draft.value ?? ""} onChange={e => set("value", e.target.value || undefined)} placeholder="25 gp" style={input} /></label>
        <label style={{ fontSize: 12 }}>Weight <input type="text" value={draft.weight ?? ""} onChange={e => set("weight", e.target.value || undefined)} placeholder="3 lb" style={input} /></label>
      </div>
      {/* Encounter / loot-pool tagging — links the item to a boss or merchant section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>
          Encounter / Boss / Merchant
          <input type="text" value={draft.sourceEncounter ?? ""} onChange={e => set("sourceEncounter", e.target.value || undefined)}
            placeholder="e.g. The Ironclad Warden" style={input} />
        </label>
        <label style={{ fontSize: 12 }}>
          Act Tag
          <input type="text" value={draft.act ?? ""} onChange={e => set("act", e.target.value || undefined)}
            placeholder="e.g. Act 1" style={input} />
        </label>
      </div>
      {/*
        ALSO DROPS FROM — a CHOICE item, offered at more than one fight.

        *"they need to be able to be given in either gate 2 and gate 3 of act 3 since it s choice
        item not a set item."* The field above is the item's PRIMARY origin; these are extra pools
        it also appears in, so a DM running either gate sees the same Gift on their list.

        Comma-separated because an encounter is identified by its NAME here, and a free-text list
        keeps this working for a DM whose encounters this app has never heard of.
      */}
      <label style={{ fontSize: 12 }}>
        Also drops from <span style={{ color: "#7b68ee" }}>— a choice item offered at more than one fight</span>
        <input type="text"
          value={(draft.sourceEncounters ?? []).join(", ")}
          onChange={e => {
            const list = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
            set("sourceEncounters", list.length ? list : undefined);
          }}
          placeholder="Act 3 - Gate III: The Veil-Torn Dragon"
          style={input} />
      </label>
      {/* ── What it DOES ──────────────────────────────────────────────────────
          MECHANICS is the block the card actually shows a player: itemToAction uses
          `mechanicsText || description`, so an item with mechanics never displays its
          flavour. It was unreachable here, which meant a DM could read it on the card
          and had no way to change it. */}
      <label style={{ fontSize: 12 }}>
        Mechanics <span style={{ color: "#7b68ee" }}>— what the card shows the player</span>
        <textarea value={draft.mechanicsText ?? ""} onChange={e => set("mechanicsText", e.target.value || undefined)}
          rows={2} placeholder="While worn, reduce force damage you take by 2."
          style={{ ...input, resize: "vertical" as const }} />
      </label>
      <label style={{ fontSize: 12 }}>
        DM Note <span style={{ color: "#666" }}>— never shown to players</span>
        <textarea value={draft.dmNote ?? ""} onChange={e => set("dmNote", e.target.value || undefined)}
          rows={2} placeholder="Pairs with Frost Brace (Defense A2)..."
          style={{ ...input, resize: "vertical" as const }} />
      </label>

      {/* ── Charges ───────────────────────────────────────────────────────────
          A "1/day, recharges at dawn" item has no rest that restores it — dawn is not a
          rest — so the pool is `manual` and the note records the cadence. The player
          adjusts it by hand on the card when the DM says dawn came. */}
      <fieldset style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
        <legend style={{ fontSize: 11, color: "#e0b34a", padding: "0 4px" }}>Charges</legend>
        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1.4fr", gap: 8 }}>
          <ChargesFields charges={draft.charges} onChange={v => set("charges", v)} inputStyle={input} dimWhenEmpty />
        </div>
        {draft.charges?.reset === "manual" && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#888" }}>
            Manual pools are adjusted by hand on the card. Say when it comes back in the note —
            &quot;dawn&quot; is not a rest, so nothing restores it automatically.
          </p>
        )}
      </fieldset>

      {/* ── What the item DOES ────────────────────────────────────────────────
          RULE 1A. Armour type, non-attack dice, reroll source and spellcasting focus existed
          only in the bag editor, so an item authored HERE — in the DM library, where every
          module item is actually made — could not be a focus, could not carry an armour type,
          and could not be a reroll source. Those facts were reachable only by writing them in
          code, which is the gap RULE 1A names.

          ⚠ Shared because these four are PLAYER-LEGAL mechanics. This form keeps sole ownership
          of the campaign-authoritative fields below — Convergence, tier, source encounter,
          session, sourceType, DM note — and those must never be added to the bag editor. */}
      <ItemMechanicsFields draft={draft} set={set} inputStyle={input} />

      {/* ── Worn slot + tier ──────────────────────────────────────────────────
          Two items in the same slot cannot both be worn; the newer displaces the older.
          Weapons are held rather than worn, so they take no slot. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Worn slot
          <select value={draft.slot ?? ""} onChange={e => set("slot", (e.target.value || undefined) as EquipmentItem["slot"])}
            style={{ ...input, marginTop: 2 }}>
            <option value="">Carried — no slot</option>
            {(Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]).map(sl => (
              <option key={sl} value={sl}>{SLOT_LABEL[sl]}{SLOT_CAPACITY[sl] > 1 ? ` (${SLOT_CAPACITY[sl]})` : ""}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Tier
          <input type="text" value={draft.tier ?? ""} onChange={e => set("tier", e.target.value || undefined)}
            placeholder="Tier 1" style={input} />
        </label>
      </div>

      {/* The chips shown on the card (A1 · Far Realm · Defense). */}
      <label style={{ fontSize: 12 }}>Tags
        <input type="text" value={(draft.tags ?? []).join(", ")}
          onChange={e => {
            const list = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
            set("tags", list.length ? list : undefined);
          }}
          placeholder="A1, Far Realm, Defense" style={input} />
      </label>

      {/* ── Passive effects ───────────────────────────────────────────────────
          What the item does to the SHEET while worn, as data rather than prose. This is
          what actually moves AC and HP — rules text alone changes nothing. */}
      <fieldset style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
        <legend style={{ fontSize: 11, color: "#4caf50", padding: "0 4px" }}>While worn / equipped</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {(draft.statEffects ?? []).map((eff, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 70px 26px", gap: 6, alignItems: "end" }}>
              <label style={{ fontSize: 11 }}>Effect
                <select value={eff.type} onChange={e => {
                  const next = [...(draft.statEffects ?? [])];
                  next[i] = { ...eff, type: e.target.value as typeof eff.type };
                  set("statEffects", next);
                }} style={{ ...input, marginTop: 2 }}>
                  <option value="setAC">Set AC to</option>
                  <option value="addAC">Add to AC</option>
                  <option value="addHP">Add max HP</option>
                  <option value="addStat">Add to ability</option>
                  <option value="setStat">Set ability to</option>
                </select>
              </label>
              <label style={{ fontSize: 11 }}>Ability
                <select value={eff.stat ?? ""} disabled={eff.type !== "addStat" && eff.type !== "setStat"}
                  onChange={e => {
                    const next = [...(draft.statEffects ?? [])];
                    next[i] = { ...eff, stat: (e.target.value || undefined) as typeof eff.stat };
                    set("statEffects", next);
                  }}
                  style={{ ...input, marginTop: 2, opacity: eff.type === "addStat" || eff.type === "setStat" ? 1 : 0.35 }}>
                  <option value="">—</option>
                  {["str", "dex", "con", "int", "wis", "cha"].map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11 }}>Value
                <input type="number" value={eff.value} onChange={e => {
                  const next = [...(draft.statEffects ?? [])];
                  next[i] = { ...eff, value: Number.parseInt(e.target.value, 10) || 0 };
                  set("statEffects", next);
                }} style={input} />
              </label>
              <button type="button" title="Remove this effect"
                onClick={() => { const next = (draft.statEffects ?? []).filter((_, j) => j !== i); set("statEffects", next.length ? next : undefined); }}
                style={{ padding: "4px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 4, color: "#ff9999", cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
          ))}
          <button type="button"
            onClick={() => set("statEffects", [...(draft.statEffects ?? []), { type: "addAC", value: 1 }])}
            style={{ alignSelf: "flex-start", fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #2f7d3f", borderRadius: 4, color: "#7be08a", cursor: "pointer" }}>
            + Add effect
          </button>
        </div>
      </fieldset>

      {/* ── Classification + what a charge DOES ───────────────────────────────
          `category` is the subkind the library groups by ("Melee One-Handed", "Heavy
          Armor"); `sourceType` marks where it came from, which drives the act-grouped
          library sections; `mastery` is the 2024 weapon-mastery property. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Category
          <input type="text" value={draft.category ?? ""} onChange={e => set("category", e.target.value || undefined)}
            placeholder="Melee One-Handed" style={input} />
        </label>
        <label style={{ fontSize: 12 }}>Source type
          <select value={draft.sourceType ?? ""} onChange={e => set("sourceType", (e.target.value || undefined) as EquipmentItem["sourceType"])}
            style={{ ...input, marginTop: 2 }}>
            <option value="">—</option>
            <option value="encounter">Encounter</option>
            <option value="boss">Boss</option>
            <option value="merchant">Merchant</option>
          </select>
        </label>
        {/* Mastery is a closed set in the 2024 rules, so it picks rather than types —
            a mistyped property would silently match nothing. WEAPONS ONLY; it was ungated. */}
        {allows("mastery") && (
        <label style={{ fontSize: 12 }}>Mastery
          <select value={draft.mastery ?? ""} onChange={e => set("mastery", (e.target.value || undefined) as EquipmentItem["mastery"])}
            style={{ ...input, marginTop: 2 }}>
            <option value="">—</option>
            {WEAPON_MASTERY_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        )}
      </div>

      {/* What spending a charge actually DOES. Without this an item can carry uses that
          resolve to nothing but a log line. */}
      {draft.charges && (
        <fieldset style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
          <legend style={{ fontSize: 11, color: "#e0b34a", padding: "0 4px" }}>When a charge is spent</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 8 }}>
            <label style={{ fontSize: 12 }}>Does
              <select value={draft.effect?.type ?? ""}
                onChange={e => set("effect", e.target.value
                  ? { ...(draft.effect ?? {}), type: e.target.value as NonNullable<EquipmentItem["effect"]>["type"] }
                  : undefined)}
                style={{ ...input, marginTop: 2 }}>
                <option value="">Nothing automatic</option>
                <option value="armedEffect">Arm a bonus on the next roll</option>
                <option value="tempHP">Grant temporary HP</option>
                <option value="spellSlotSub">Substitute a spell slot</option>
                <option value="nullifyDamage">Nullify damage of a type</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>Formula
              <input type="text" value={draft.effect?.formula ?? ""} disabled={!draft.effect}
                onChange={e => draft.effect && set("effect", { ...draft.effect, formula: e.target.value || undefined })}
                placeholder="+1d6+1 radiant" style={{ ...input, opacity: draft.effect ? 1 : 0.4 }} />
            </label>
            <label style={{ fontSize: 12 }}>Value / condition
              <input type="text" value={draft.effect?.value ?? ""} disabled={!draft.effect}
                onChange={e => draft.effect && set("effect", { ...draft.effect, value: e.target.value || undefined })}
                placeholder="5, L1, cold..." style={{ ...input, opacity: draft.effect ? 1 : 0.4 }} />
            </label>
          </div>
        </fieldset>
      )}
      {/* Whether this item feeds a convergence or is one of its outputs.
          ⚠ WONDROUS ONLY — *"you shouldn't be able to add convergence on weapons and armor, this
          is why they are wonderous items."* This was ungated and offered Convergence on rations. */}
      {allows("convergence") && (
      <fieldset style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
        <legend style={{ fontSize: 11, color: "#4caf50", padding: "0 4px" }}>Convergence</legend>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.6fr 1.4fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>Role
            <select value={draft.convergence?.role ?? ""}
              onChange={e => set("convergence", e.target.value
                ? { role: e.target.value as "input" | "output", enabled: draft.convergence?.enabled ?? true,
                    mechanicalTag: draft.convergence?.mechanicalTag, actLabel: draft.convergence?.actLabel,
                    flavorTag: draft.convergence?.flavorTag }
                : undefined)}
              style={{ ...input, marginTop: 2 }}>
              <option value="">Not part of one</option>
              <option value="input">Input — can be sacrificed</option>
              <option value="output">Output — can be made</option>
            </select>
          </label>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, paddingTop: 18 }}>
            <input type="checkbox" checked={draft.convergence?.enabled ?? false} disabled={!draft.convergence}
              onChange={e => draft.convergence && set("convergence", { ...draft.convergence, enabled: e.target.checked })} />
            Enabled
          </label>
          <label style={{ fontSize: 12 }}>Mechanical tag
            <input type="text" value={draft.convergence?.mechanicalTag ?? ""} disabled={!draft.convergence}
              onChange={e => draft.convergence && set("convergence", { ...draft.convergence, mechanicalTag: e.target.value || undefined })}
              placeholder="Defense + Stability" style={{ ...input, opacity: draft.convergence ? 1 : 0.4 }} />
          </label>
        </div>
      </fieldset>
      )}

      {/* ⚠ The spell-focus pair used to sit here, UNGATED — it showed on rations and armour, and
          once ItemMechanicsFields landed it also showed TWICE on a weapon. The focus block now
          lives in that shared component behind `allows("spellFocus")`, which is the only place
          it belongs. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Session
          <input type="text" value={draft.session ?? ""} onChange={e => set("session", e.target.value || undefined)}
            placeholder="Session 4" style={input} />
        </label>
      </div>
      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={draft.isUsable} onChange={e => set("isUsable", e.target.checked)} />
        Has usable action (shows Use button)
      </label>
      {/* Authorable here as well as in the bag editor: an artificer's own creations can
          require attunement exactly as campaign loot does. Feeds the card's attunement
          count, which is why it is a flag rather than a line of rules text. */}
      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={Boolean(draft.attunementRequired)} onChange={e => set("attunementRequired", e.target.checked || undefined)} />
        Requires attunement (holds 1 of 3 slots while equipped)
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => { if (!draft.name.trim()) return; onSave(draft); }} style={{ padding: "5px 16px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {initial ? "Save Changes" : "Create Item"}
        </button>
        <button type="button" onClick={onCancel} style={{ padding: "5px 16px", background: "transparent", color: "#888", border: "1px solid #444", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Convergence approval panel (standalone component with its own state) ────

export function ConvergenceApprovalPanel({
  req, campaignLib, dmLib, seats, onApprove, onDeny, onBack,
}: {
  req: ConvergenceRequest;
  campaignLib: EquipmentItem[];
  dmLib: EquipmentItem[];
  seats: FdmcSeat[];
  onApprove: (req: ConvergenceRequest, outputItemId: string) => Promise<void>;
  onDeny: (req: ConvergenceRequest) => Promise<void>;
  onBack: () => void;
}) {
  const allItems = [...campaignLib, ...dmLib];
  const seat = seats.find(s => s.seatId === req.seatId);

  // Submitted items — try library first, fall back to names from the request.
  // Both arrays are defended: this panel REPLACES the whole window, so anything it throws
  // while rendering leaves a blank screen whose only exit — the Back button — is inside the
  // component that just failed. A request missing its items should show an empty review, not
  // trap the DM in a dead panel.
  const submittedIds = Array.isArray(req.submittedItemIds) ? req.submittedItemIds : [];
  const requestNames = Array.isArray(req.submittedItemNames) ? req.submittedItemNames : [];
  const submittedItems = submittedIds.map(id => allItems.find(i => i.id === id)).filter(Boolean) as EquipmentItem[];
  const submittedNames = submittedItems.length > 0
    ? submittedItems.map(i => i.name)
    : requestNames;

  /**
   * WHAT A FUSION CAN PRODUCE.
   *
   * This offered the entire library — every weapon, every set of armour, every mundane token —
   * which is not a choice so much as a search. A convergence produces a CONVERGENCE OUTPUT and
   * nothing else, so that is the list.
   *
   * The loot doc gives two more rules worth honouring, because both are things the DM would
   * otherwise have to hold in their head while scrolling:
   *
   *   RECIPE — fusion needs a curated two-tag pair, and the tags come from the submitted
   *   inputs. An output whose recipe is exactly those two tags is the intended result.
   *
   *   MATURITY — provenance caps the tier. A1+A1 and A1+A2 make Tier 1; A1+A3, A2+A2 and
   *   A2+A3 make Tier 2; only A3+A3 reaches Tier 3. An output above that cap cannot hold.
   *
   * Neither is enforced as a hard block — a DM overriding their own system is allowed, and
   * Hale's demonstration item is proof the rules have exceptions. They ORDER the list and
   * label it, so the right answer is at the top and a deliberate departure is still possible.
   */
  const inputTags = submittedItems
    .map(i => i.convergence?.mechanicalTag?.trim())
    .filter((t): t is string => Boolean(t));
  const inputActs = submittedItems
    .map(i => Number(i.convergence?.actLabel?.replace(/\D/g, "")) || 0)
    .filter(n => n > 0);
  // A1+A1 / A1+A2 -> 1 · A1+A3 / A2+A2 / A2+A3 -> 2 · A3+A3 -> 3
  const maxTier = inputActs.length < 2 ? 3
    : (() => {
        const sorted = [...inputActs].sort((a, b) => a - b);
        const [lo, hi] = [sorted[0], sorted[sorted.length - 1]];
        if (lo === 3 && hi === 3) return 3;
        if (lo + hi >= 4) return 2;      // 1+3, 2+2, 2+3
        return 1;                         // 1+1, 1+2
      })();

  const recipeMatches = (item: EquipmentItem) => {
    const recipe = item.convergence?.mechanicalTag?.toLowerCase() ?? "";
    if (!recipe || inputTags.length < 2) return false;
    return inputTags.every(t => recipe.includes(t.toLowerCase()));
  };

  const outputs = allItems.filter(i => i.convergence?.role === "output");
  const pickableItems = [...outputs].sort((a, b) => {
    // Recipe match first, then within the tier the inputs can actually support, then by tier.
    const score = (i: EquipmentItem) =>
      (recipeMatches(i) ? 0 : 10) + (Number(i.tier) <= maxTier ? 0 : 5);
    const d = score(a) - score(b);
    return d !== 0 ? d : (Number(a.tier) || 0) - (Number(b.tier) || 0);
  });
  const [selectedOutputId, setSelectedOutputId] = useState<string>(pickableItems[0]?.id ?? "");
  const selectedOutput = allItems.find(i => i.id === selectedOutputId);

  const seatLabel = seat?.label ?? req.seatId;
  const actorLabel = req.actorName ? `${req.actorName} (${seatLabel})` : seatLabel;

  function ItemCard({ item, role }: { item: EquipmentItem; role: "output" | "input" }) {
    const isOutput = role === "output";
    return (
      <div style={{
        background: isOutput ? "#0d1a0d" : "#1a0d0d",
        border: `1px solid ${isOutput ? "#4caf5066" : "#5a1a1a"}`,
        borderRadius: 10, padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{isOutput ? "◈" : "✕"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <strong style={{ fontSize: 14, color: "#fff" }}>{item.name}</strong>
              {item.category && <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 6px", borderRadius: 8 }}>{item.category}</span>}
              {item.tier && <span style={{ fontSize: 10, color: isOutput ? "#4caf50" : "#ff9999" }}>{item.tier}</span>}
              {item.attunementRequired && <span style={{ fontSize: 10, color: "#e07b39" }}>Attunement</span>}
              {item.convergence?.mechanicalTag && <span style={{ fontSize: 10, color: "#4caf5066" }}>◈ {item.convergence.mechanicalTag}</span>}
            </div>
            {item.act && (
              <div style={{ fontSize: 10, color: "#444", marginBottom: 4 }}>
                {item.act}{item.session ? ` · ${item.session}` : ""}{item.sourceEncounter ? ` · ${item.sourceEncounter}` : ""}
              </div>
            )}
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item.description}</p>
            {item.mechanicsText && (
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#c8c8c8", lineHeight: 1.5, background: "#0d0d14", borderRadius: 4, padding: "7px 10px" }}>
                {item.mechanicsText}
              </p>
            )}
            {item.dmNote && (
              <p style={{ margin: 0, fontSize: 10, color: "#555", lineHeight: 1.4, fontStyle: "italic", borderTop: "1px solid #2a2a2a", paddingTop: 6, marginTop: 4 }}>
                DM — {item.dmNote}
              </p>
            )}
            {!isOutput && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#ff9999", fontWeight: 500, borderTop: "1px solid #5a1a1a44", paddingTop: 8 }}>
                ✕ Remove from {actorLabel}'s bag after approving
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={onBack}
            style={{ fontSize: 12, padding: "3px 8px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}>
            ← Back
          </button>
          <h3 style={{ margin: 0, fontSize: 14 }}>◈ Convergence Review</h3>
        </div>
        <span style={{ fontSize: 11, color: "#4caf50", fontWeight: 600 }}>{actorLabel}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Submitted items — what the player is giving up */}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 10, color: "#ff9999", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
            Items Submitted by Player
          </p>
          {submittedItems.length > 0
            ? submittedItems.map(item => <ItemCard key={item.id} item={item} role="input" />)
            : (
              <div style={{ background: "#1a0d0d", border: "1px solid #5a1a1a", borderRadius: 8, padding: "12px 14px" }}>
                <p style={{ margin: "0 0 4px", color: "#ff9999", fontSize: 12, fontWeight: 600 }}>Items not found in library — display by name only</p>
                {submittedNames.map((name, i) => (
                  <p key={i} style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>✕ {name}</p>
                ))}
                {submittedNames.length === 0 && submittedIds.map(id => (
                  <p key={id} style={{ margin: "4px 0 0", fontSize: 11, color: "#555" }}>ID: {id}</p>
                ))}
              </div>
            )
          }
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: "#2a2a3e" }} />
          <span style={{ fontSize: 12, color: "#4caf50", fontWeight: 600 }}>◈ forges into</span>
          <div style={{ flex: 1, height: 1, background: "#2a2a3e" }} />
        </div>

        {/* Output item picker — DM selects what the player receives */}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 10, color: "#4caf50", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
            Select Output Item (DM Chooses)
          </p>
          {/* Grouped by what the submitted inputs actually justify, so the intended result is
              the first thing in the list rather than something to go hunting for. Nothing is
              hidden — a DM overruling their own recipe table is allowed, it just has to be a
              decision rather than an accident. */}
          <select value={selectedOutputId} onChange={e => setSelectedOutputId(e.target.value)}
            style={{ display: "block", width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #2a6e2a66", background: "#0d1a0d", color: "#fff", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
            {(() => {
              const label = (i: EquipmentItem) =>
                `${i.name}${i.tier ? ` · Tier ${i.tier}` : ""}${i.convergence?.mechanicalTag ? ` — ${i.convergence.mechanicalTag}` : ""}`;
              const matching = pickableItems.filter(i => recipeMatches(i));
              const inTier = pickableItems.filter(i => !recipeMatches(i) && Number(i.tier) <= maxTier);
              const above = pickableItems.filter(i => !recipeMatches(i) && Number(i.tier) > maxTier);
              return (
                <>
                  {matching.length > 0 && (
                    <optgroup label={`── Matches this recipe (${inputTags.join(" + ")})`}>
                      {matching.map(i => <option key={i.id} value={i.id}>◈ {label(i)}</option>)}
                    </optgroup>
                  )}
                  {inTier.length > 0 && (
                    <optgroup label={`── Other outputs these inputs can hold (up to Tier ${maxTier})`}>
                      {inTier.map(i => <option key={i.id} value={i.id}>{label(i)}</option>)}
                    </optgroup>
                  )}
                  {above.length > 0 && (
                    <optgroup label={`── Above what this provenance supports (Tier ${maxTier} max)`}>
                      {above.map(i => <option key={i.id} value={i.id}>⚠ {label(i)}</option>)}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </select>
          {/* What the maturity rule concluded, in words, so the grouping is not a mystery. */}
          {inputActs.length >= 2 && (
            <p style={{ margin: "0 0 8px", fontSize: 10, color: "#666" }}>
              Provenance {inputActs.map(a => `A${a}`).join(" + ")} → Tier {maxTier} maximum
              {inputTags.length >= 2 ? ` · recipe ${inputTags.join(" + ")}` : ""}
            </p>
          )}
          {selectedOutput && <ItemCard item={selectedOutput} role="output" />}
          {!selectedOutput && selectedOutputId && (
            <div style={{ background: "#1a1a0d", border: "1px solid #5a4a0a", borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ margin: 0, color: "#ffcc44", fontSize: 12 }}>⚠ Selected item not found. Choose another from the dropdown.</p>
            </div>
          )}
          {pickableItems.length === 0 && (
            <p style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>
              No Convergence outputs in the library. Only items tagged as a Convergence output can be forged —
              add one, or re-seed the campaign library.
            </p>
          )}
        </div>

        {/* DM checklist */}
        <div style={{ background: "#0a0a14", border: "1px solid #2a2a5e", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "#7b68ee", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Before Approving</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#aaa", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#4caf50", flexShrink: 0 }}>□</span>
              Confirm {actorLabel} has submitted items equipped in their bag
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#aaa", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#4caf50", flexShrink: 0 }}>□</span>
              Confirm safe location — convergence cannot happen mid-combat
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#ff9999", display: "flex", alignItems: "flex-start", gap: 8, fontWeight: 500 }}>
              <span style={{ flexShrink: 0 }}>✕</span>
              After approving — open actor editor and remove submitted items from their bag manually
            </p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid #2a2a3e", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button"
          disabled={!selectedOutput}
          onClick={() => selectedOutput && void onApprove(req, selectedOutput.id)}
          style={{
            width: "100%", padding: "13px", fontSize: 14, fontWeight: 700, borderRadius: 8, cursor: selectedOutput ? "pointer" : "default", letterSpacing: 0.5, border: "none",
            background: selectedOutput ? "linear-gradient(135deg, #1a4a1a 0%, #2a6e2a 100%)" : "#1a1a1a",
            color: selectedOutput ? "#fff" : "#444",
          }}>
          ◈ Approve — Forge {selectedOutput?.name ?? "?"} for {actorLabel}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void onDeny(req)}
            style={{ flex: 1, padding: "8px", fontSize: 12, background: "transparent", border: "1px solid #5a1a1a", borderRadius: 6, color: "#ff9999", cursor: "pointer" }}>
            ✕ Deny Request
          </button>
          <button type="button" onClick={onBack}
            style={{ flex: 1, padding: "8px", fontSize: 12, background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#666", cursor: "pointer" }}>
            ← Back to List
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type EquipmentLibraryStandaloneProps = {
  seats: FdmcSeat[];
  externalConvergenceRequests?: ConvergenceRequest[];
  onExternalConvergenceApprove?: (req: ConvergenceRequest, outputItemId: string) => Promise<void>;
  onExternalConvergenceDeny?: (req: ConvergenceRequest) => Promise<void>;
  /** Called by DM panel to attach item to actor + push to seat before notifying player */
  onDeliverLoot?: (seatId: string, item: EquipmentItem, message: string) => Promise<void>;
  /** Called by DM panel to attach MULTIPLE items to one seat's actor in a single push (boss haul). */
  onDeliverLootBundle?: (seatId: string, items: EquipmentItem[], message: string) => Promise<void>;
  /** Called by DM panel to grant currency to a seat's primary actor. mode "add" = adjust, "set" = absolute; coin defaults to gp. */
  onSendGold?: (seatId: string, amount: number, mode: "add" | "set", coin?: CoinType) => void;
  /** Open the New Item form immediately on mount (toolbar "+ Equipment" create flow). */
  autoCreate?: boolean;
  /** Pre-fill the encounter/loot-pool tag on a newly created item. */
  presetEncounter?: string;
  /** Bump this to (re)open the New Item form externally (e.g. "Create loot for encounter"). */
  createSignal?: number;
  /** Hide the in-panel create button — manage-only view (toolbar carries the create buttons). */
  hideCreate?: boolean;
};

export function EquipmentLibraryStandalone({ seats, externalConvergenceRequests, onExternalConvergenceApprove, onExternalConvergenceDeny, onDeliverLoot, onDeliverLootBundle, onSendGold, autoCreate = false, presetEncounter, createSignal, hideCreate = false }: EquipmentLibraryStandaloneProps) {
  const [campaignLib, setCampaignLib] = useState<EquipmentItem[]>(() => loadEquipmentLibrary("campaign"));
  const [poolBuilderOpen, setPoolBuilderOpen] = useState(false);
  const [dmLib, setDmLib] = useState<EquipmentItem[]>(() => loadEquipmentLibrary("dm"));
  const [editingItem, setEditingItem] = useState<EquipmentItem | null | "new">(autoCreate ? "new" : null);
  // Which encounter/merchant groups are expanded (default: all collapsed).
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  // Campaign-library unlock — My Library (custom) is always open; only the Broken Chain
  // (campaign) equipment sits behind the password.
  const { unlocked, unlock } = useModuleUnlock();
  // Broken Chain section is a click-to-open drawer; the lock prompt lives inside it.
  const [brokenChainOpen, setBrokenChainOpen] = useState(false);
  const [lootTarget, setLootTarget] = useState<{ item: EquipmentItem; seatId: string } | null>(null);
  // `seatIds` is the guest list AND the running order: boss loot often goes to some seats and
  // not others, while a merchant usually opens to the whole party starting at seat 1.
  const [lootOffer, setLootOffer] = useState<{ items: EquipmentItem[]; seatIds: string[]; mode: "boss-mid" | "boss-final" | "merchant" } | null>(null);
  const [usePickOrder, setUsePickOrder] = useState(true);
  // Live view of the round in progress. Claims are handled in the main App window, so the
  // record changes underneath this one.
  //
  // THE WRITE IS THE SIGNAL — nothing polls. `storage` carries the other window's writes,
  // OPEN_LOOT_OFFER_CHANGED carries this one's. A refresh that finds nothing new returns the
  // previous object so React skips the render entirely: no write, no work.
  const [openOffer, setOpenOffer] = useState<OpenLootOffer | null>(() => loadOpenLootOffer());
  const [offerPanelOpen, setOfferPanelOpen] = useState(true);
  useEffect(() => {
    const refresh = () => setOpenOffer(prev => {
      const next = loadOpenLootOffer();
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    window.addEventListener("storage", refresh);
    window.addEventListener(OPEN_LOOT_OFFER_CHANGED, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(OPEN_LOOT_OFFER_CHANGED, refresh);
    };
  }, []);
  const [convergenceBuilder, setConvergenceBuilder] = useState<{
    seatId: string;
    combos: Array<{ outputItem: EquipmentItem; inputItems: Array<{ id: string; name: string }>; description: string }>;
    message: string;
  } | null>(null);
  const [pendingConvergenceRequests, setPendingConvergenceRequests] = useState<ConvergenceRequest[]>([]);
  const [convergenceApproval, setConvergenceApproval] = useState<ConvergenceRequest | null>(null);
  const [lootMessage, setLootMessage] = useState("");
  const [recentDelivery, setRecentDelivery] = useState<string | null>(null);
  /** Kept apart from recentDelivery, which is styled as a success and always will be. */
  const [deliveryProblem, setDeliveryProblem] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<EquipmentImportResult | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  // Multi-item boss-haul cart: stage several items, then send them all to one seat.
  const [cart, setCart] = useState<EquipmentItem[]>([]);
  const [cartSeatId, setCartSeatId] = useState<string>("");
  // Currency grant panel: pick a seat + coin + amount, add-to or set the actor's wallet.
  const [goldPanel, setGoldPanel] = useState<{ seatId: string; amount: string; coin: CoinType } | null>(null);

  function refreshLibrary() {
    setCampaignLib(loadEquipmentLibrary("campaign"));
    setDmLib(loadEquipmentLibrary("dm"));
  }

  // External "open creator" trigger — bumping createSignal opens a fresh New Item
  // form (used by the "Create loot for this encounter" button, which also sets
  // presetEncounter so the new item is tagged to that loot pool).
  useEffect(() => {
    if (!createSignal) return;
    setEditingItem("new");
  }, [createSignal]);

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /**
   * Save an edited item back to the store it CAME FROM.
   *
   * Christopher: *"why I cant edit the existing loot pool from the equipment library and move them
   * to the correct acts."* Because every save went to the DM store — editing a campaign item made
   * a private shadow of it, and the next re-seed threw that shadow away. 82 bundled items are
   * locked, so re-filing an act meant unlocking each one and losing the edit on the next bump.
   *
   * An item that lives in the campaign store now saves back to the campaign store, which is what
   * "editing the loot pool" has to mean for the person who authored it.
   */
  function handleSaveItem(item: EquipmentItem, owner?: "campaign" | "dm") {
    const target: "campaign" | "dm" = owner
      ?? (loadEquipmentLibrary("campaign").some(i => i.id === item.id) ? "campaign" : "dm");
    const lib = loadEquipmentLibrary(target);
    const idx = lib.findIndex(i => i.id === item.id);
    if (idx === -1) lib.push(item); else lib[idx] = item;
    saveEquipmentLibrary(lib, target);
    /**
     * Saving to one store drops the id from the other. A DM shadow left behind would WIN by id
     * in `loadEquipmentLibrary()` and every later campaign edit would appear to do nothing —
     * the exact failure the monster stores hit.
     */
    const other: "campaign" | "dm" = target === "campaign" ? "dm" : "campaign";
    const otherLib = loadEquipmentLibrary(other);
    const pruned = otherLib.filter(i => i.id !== item.id);
    if (pruned.length !== otherLib.length) saveEquipmentLibrary(pruned, other);
    refreshLibrary();
    setEditingItem(null);
  }

  // TODO: remove at 0.9.0 alpha lock — DM-only pre-alpha unlock for campaign item editing
  function handleUnlockItem(item: EquipmentItem) {
    // Fingerprint the item AS UNLOCKED, so a later re-seed can tell an untouched snapshot
    // (safe to drop for fresher module data) from an edit the DM actually made (never dropped).
    const unlockedCopy: EquipmentItem = {
      ...item,
      isLocked: false,
      unlockSnapshot: fingerprintEquipmentItem({ ...item, isLocked: false }),
    };
    const lib = loadEquipmentLibrary("dm");
    const idx = lib.findIndex(i => i.id === item.id);
    if (idx === -1) lib.push(unlockedCopy); else lib[idx] = unlockedCopy;
    saveEquipmentLibrary(lib, "dm");
    refreshLibrary();
    // Open edit form immediately so DM can make changes
    setEditingItem(unlockedCopy);
  }

  function handleDeleteItem(id: string) {
    saveEquipmentLibrary(loadEquipmentLibrary("dm").filter(i => i.id !== id), "dm");
    refreshLibrary();
  }

  /**
   * Put a whole loot pool on the table in one click.
   *
   * Building an offer a piece at a time is the slow path when what you actually want is
   * "here is the Full Wendigo's drop" or "here is what the innkeeper stocks" — a boss pool
   * runs eleven items. This loads the group as a unit, merging into an open offer rather
   * than replacing it so two pools can be combined.
   *
   * A stock/merchant group opens as a SHOP (buy what you can afford); anything else opens
   * as a pick-one table. Both are still switchable on the offer panel.
   */
  function tableWholeGroup(items: EquipmentItem[], label: string) {
    const isStock = /merchant|stock|shop|vendor/i.test(label);
    const mode: "boss-mid" | "boss-final" | "merchant" = isStock ? "merchant" : "boss-mid";
    setLootOffer(prev => {
      if (!prev) return { items: [...items], seatIds: defaultRecipientIds(), mode };
      const have = new Set(prev.items.map(i => i.id));
      return { ...prev, items: [...prev.items, ...items.filter(i => !have.has(i.id))] };
    });
  }

  function toggleCart(item: EquipmentItem) {
    setCart(prev => prev.some(i => i.id === item.id) ? prev.filter(i => i.id !== item.id) : [...prev, item]);
  }

  async function handleSendCart() {
    if (cart.length === 0 || !cartSeatId) return;
    const label = `${cart.length} item${cart.length === 1 ? "" : "s"}`;
    const message = `${label} delivered.`;
    if (onDeliverLootBundle) {
      await onDeliverLootBundle(cartSeatId, cart, message);
    } else if (onDeliverLoot) {
      for (const it of cart) await onDeliverLoot(cartSeatId, it, `${it.name} delivered.`);
    }
    setRecentDelivery(`Sent ${label} to ${seats.find(s => s.seatId === cartSeatId)?.label ?? cartSeatId}`);
    setCart([]);
    setTimeout(() => setRecentDelivery(null), 4000);
  }

  function handleSendGold(mode: "add" | "set") {
    if (!goldPanel || !onSendGold) return;
    const amt = parseInt(goldPanel.amount, 10);
    if (!Number.isFinite(amt)) return;
    const coin = goldPanel.coin;
    onSendGold(goldPanel.seatId, amt, mode, coin);
    const seatLabel = seats.find(s => s.seatId === goldPanel.seatId)?.label ?? goldPanel.seatId;
    setRecentDelivery(
      mode === "add"
        ? `Granted ${amt} ${COIN_ABBR[coin]} to ${seatLabel}`
        : `Set ${seatLabel}'s ${COIN_ABBR[coin]} to ${amt}`
    );
    setGoldPanel(null);
    setTimeout(() => setRecentDelivery(null), 4000);
  }

  async function handleSendLoot() {
    if (!lootTarget || !OBR.isAvailable) return;
    const message = lootMessage.trim() || `${lootTarget.item.name} delivered.`;
    if (onDeliverLoot) {
      await onDeliverLoot(lootTarget.seatId, lootTarget.item, message);
    } else {
      const delivery: LootDelivery = {
        type: "fdmc:loot-delivery",
        seatId: lootTarget.seatId,
        item: lootTarget.item,
        deliveryId: `loot-${Date.now().toString(36)}`,
        message,
      };
      await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, delivery, { destination: "REMOTE" });
    }
    setRecentDelivery(`Sent ${lootTarget.item.name} to ${seats.find(s => s.seatId === lootTarget.seatId)?.label ?? lootTarget.seatId}`);
    setLootTarget(null);
    setLootMessage("");
    setTimeout(() => setRecentDelivery(null), 4000);
  }

  /**
   * The requests this window should show: whatever dm-panel has collected, or its own.
   *
   * dm-panel passes its state array, which is `[]` before anything arrives — so every test of
   * `externalConvergenceRequests !== undefined` was permanently true, and both the listener
   * below and the display further down switched themselves off for good.
   */
  const convergenceRequestsToShow = (externalConvergenceRequests?.length ?? 0) > 0
    ? externalConvergenceRequests!
    : pendingConvergenceRequests;

  // Listen for convergence requests from players.
  //
  // This ALSO used to bail whenever dm-panel supplied the prop, which — given that prop starts
  // as [] — meant it never listened at all. Listening regardless is safe: the two states are
  // separate, the dedupe below is by offerId + seatId, and a request seen twice is still one
  // request. Better a duplicate listener than a window that never hears anything.
  useEffect(() => {
    // READ THE INBOX FIRST. The main window records every request durably, so anything that
    // arrived while this popover was closed is waiting here. Listening alone can only ever
    // catch what is broadcast while this window happens to be alive, which is why a request
    // submitted before the Library was opened used to be lost outright.
    setPendingConvergenceRequests(prev => {
      const seen = new Set(prev.map(r => `${r.offerId}::${r.seatId}`));
      const fromInbox = loadConvergenceInbox().filter(r => !seen.has(`${r.offerId}::${r.seatId}`));
      return fromInbox.length ? [...prev, ...(fromInbox as ConvergenceRequest[])] : prev;
    });

    if (!OBR.isAvailable) return;
    return OBR.broadcast.onMessage(FDMC_SEAT_BROADCAST_CHANNEL, (event) => {
      const msg = event.data;
      if (isConvergenceRequest(msg)) {
        setPendingConvergenceRequests(prev => {
          if (prev.find(r => r.offerId === msg.offerId && r.seatId === msg.seatId)) return prev;
          return [...prev, msg];
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApproveConvergence(req: ConvergenceRequest, outputItemId: string) {
    if (!OBR.isAvailable) return;
    const allItems = [...loadEquipmentLibrary("campaign"), ...loadEquipmentLibrary("dm")];
    const outputItem = allItems.find(i => i.id === outputItemId);
    if (!outputItem) return;
    const seat = seats.find(s => s.seatId === req.seatId);
    const delivery: LootDelivery = {
      type: "fdmc:loot-delivery",
      seatId: req.seatId,
      item: outputItem,
      deliveryId: `conv-${Date.now().toString(36)}`,
      message: `Convergence complete — ${outputItem.name} has been forged. Remove your submitted items from your equipment bag.`,
    };
    await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, delivery, { destination: "REMOTE" });
    setPendingConvergenceRequests(prev => prev.filter(r => !(r.offerId === req.offerId && r.seatId === req.seatId)));
    // Drop it from the durable inbox too, or it returns the next time a window opens.
    removeFromConvergenceInbox(req);
    setRecentDelivery(`Convergence approved — ${outputItem.name} sent to ${seat?.label ?? req.seatId}. Remove ${(req.submittedItemNames ?? []).join(" + ") || "the submitted items"} from their bag.`);
    setTimeout(() => setRecentDelivery(null), 10000);
  }

  async function handleSendConvergenceOffer() {
    if (!convergenceBuilder || convergenceBuilder.combos.length === 0 || !OBR.isAvailable) return;
    const offerId = `conv-offer-${Date.now().toString(36)}`;
    const isAll = convergenceBuilder.seatId === "__all__";
    const targetSeats = isAll
      ? seats.filter(s => s.seatMode !== "viewer")
      : seats.filter(s => s.seatId === convergenceBuilder.seatId);
    for (const seat of targetSeats) {
      const offer: ConvergenceOffer = {
        type: "fdmc:convergence-offer",
        seatId: seat.seatId,
        offerId,
        combos: convergenceBuilder.combos,
        message: convergenceBuilder.message.trim() || "Convergence available — combine items to unlock a new one.",
      };
      await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, offer, { destination: "REMOTE" });
    }
    const target = isAll ? "all players" : (seats.find(s => s.seatId === convergenceBuilder.seatId)?.label ?? convergenceBuilder.seatId);
    setRecentDelivery(`Convergence offer (${convergenceBuilder.combos.length} combo${convergenceBuilder.combos.length !== 1 ? "s" : ""}) sent to ${target}`);
    setConvergenceBuilder(null);
    setTimeout(() => setRecentDelivery(null), 6000);
  }

  /**
   * Default guest list: everyone in play, ordered by SEAT NUMBER.
   *
   * The app knows its own seat numbers ("seat-1", "seat-2", …), so the order is read from
   * them rather than from whatever sequence the seat record happens to be stored in — a seat
   * removed and re-added would otherwise land at the end of the queue instead of its place.
   * A seat with no actor isn't in play, so the round starts at the first seat that is.
   */
  function defaultRecipientIds(): string[] {
    return seats
      .filter(s => s.seatMode !== "viewer" && s.actorIds.length > 0)
      .sort((a, b) => seatNumber(a.seatId) - seatNumber(b.seatId))
      .map(s => s.seatId);
  }

  /**
   * The one place a loot pool actually goes out.
   *
   * Both entry points land here — the staged builder (where the DM has tuned the guest list,
   * order and message) and the one-click send off a group header. Keeping it single means the
   * stock record and the broadcast can never disagree about what was sent, which is the whole
   * basis of claim-once.
   */
  async function sendLootPool(opts: {
    items: EquipmentItem[];
    seatIds: string[];
    mode: "boss-mid" | "boss-final" | "merchant";
    message: string;
    takeTurns: boolean;
  }): Promise<boolean> {
    if (opts.items.length === 0 || !OBR.isAvailable) return false;
    // The id list IS the running order — first id picks first.
    const orderedSeats = opts.seatIds
      .map(id => seats.find(s => s.seatId === id))
      .filter((s): s is FdmcSeat => Boolean(s) && s!.seatMode !== "viewer");
    if (orderedSeats.length === 0) return false;
    const offerId = `offer-${Date.now().toString(36)}`;
    // Turn-taking needs someone to pass to; a single recipient just gets the pool.
    const ordered = orderedSeats.length > 1 && opts.takeTurns;
    // Boss loot is one pick each. A merchant turn is a shopping trip — buy what you can
    // afford, then hand the counter on.
    const turnEndsOnPick = opts.mode !== "merchant";
    const recipients = orderedSeats.map(s => ({ seatId: s.seatId, label: s.label ?? s.seatId }));
    const message = opts.message.trim() || (opts.mode === "boss-final"
      ? "Session reward — choose your item."
      : opts.mode === "merchant" ? "Merchant stock — spend your gold." : "Boss drop — choose one item.");

    // The SENT POOL IS THE STOCK. Record what went out so the GM can retire each item as it
    // is claimed — send a pool of one and exactly one player can take it. Without this the
    // claim handler re-resolves from the library, which is a catalogue with no stock, so
    // every recipient could take the same "one of" item.
    saveOpenLootOffer({
      offerId,
      remainingItemIds: opts.items.map(i => i.id),
      recipients,
      turnIndex: 0,
      ordered,
      turnEndsOnPick,
      mode: opts.mode,
      message: opts.message.trim() || "",
      claims: [],
    });
    for (const seat of orderedSeats) {
      const offer: LootOffer = {
        type: "fdmc:loot-offer",
        seatId: seat.seatId,
        offerId,
        items: opts.items,
        message,
        mode: opts.mode,
        ordered,
        turnSeatId: ordered ? recipients[0].seatId : undefined,
        turnLabel: ordered ? recipients[0].label : undefined,
      };
      await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, offer, { destination: "REMOTE" });
    }
    const target = ordered
      ? `${recipients.length} players in order (${recipients.map(r => r.label).join(" → ")})`
      : recipients.map(r => r.label).join(", ");
    setRecentDelivery(`${opts.mode === "boss-final" ? "Session reward" : opts.mode === "merchant" ? "Merchant stock" : "Mid-boss loot"} (${opts.items.length} items) sent to ${target}`);
    setOpenOffer(loadOpenLootOffer());
    setTimeout(() => setRecentDelivery(null), 6000);
    return true;
  }

  async function handleSendLootOffer() {
    if (!lootOffer) return;
    const sent = await sendLootPool({
      items: lootOffer.items,
      seatIds: lootOffer.seatIds,
      mode: lootOffer.mode,
      message: lootMessage,
      takeTurns: usePickOrder,
    });
    if (!sent) return;
    setLootOffer(null);
    setLootMessage("");
  }

  /**
   * Send a whole encounter pool or merchant stock straight to the party — no staging.
   *
   * Staging exists for when the DM wants to trim the pool, pick who's in it, or set the
   * order. When they just want to hand the table what the encounter doc already says it
   * drops, that round trip is friction: this goes out with the whole group, every player in
   * seat order, taking turns. Anything finer still goes through "+ Table all".
   */
  async function sendWholeGroup(items: EquipmentItem[], label: string) {
    const sent = await sendLootPool({
      items,
      seatIds: defaultRecipientIds(),
      // Same read of the label the staging path uses, so a one-click send is never a
      // different KIND of offer than the staged one would have been.
      mode: /merchant|stock|shop|vendor/i.test(label) ? "merchant" : "boss-mid",
      message: "",
      takeTurns: true,
    });
    // A one-click send has no builder to show the problem in, so say why nothing happened
    // rather than leaving the DM to wonder whether the click registered.
    if (!sent) {
      setDeliveryProblem(`Nothing sent — ${defaultRecipientIds().length === 0 ? "no player seats are claimed" : "the pool is empty"}.`);
      setTimeout(() => setDeliveryProblem(null), 6000);
    }
  }

  if (editingItem) {
    return (
      <ItemForm
        initial={editingItem === "new" ? undefined : editingItem}
        preset={editingItem === "new" && presetEncounter ? { sourceEncounter: presetEncounter } : undefined}
        onSave={handleSaveItem}
        onCancel={() => setEditingItem(null)}
      />
    );
  }

  if (goldPanel) {
    const seatLabel = seats.find(s => s.seatId === goldPanel.seatId)?.label ?? goldPanel.seatId;
    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ margin: 0 }}>💰 Send Currency</h3>
        <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
          Grant coin to a player. It lands on the seat's primary character's wallet and shows on their sheet. Coin types they have none of stay hidden until granted.
        </p>
        <label style={{ fontSize: 12 }}>
          Send to:
          <select value={goldPanel.seatId} onChange={e => setGoldPanel(g => g ? { ...g, seatId: e.target.value } : g)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            {/* Campaign gold is party money and is the most common thing this dialog will
                ever send, so the purse is first — not buried behind the character list. */}
            <option value={PARTY_WALLET_SEAT_ID}>👛 Party purse (shared)</option>
            {seats.filter(s => s.seatMode !== "viewer").map(s => <option key={s.seatId} value={s.seatId}>{s.label}</option>)}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ fontSize: 12, flex: "0 0 110px" }}>
            Coin:
            <select value={goldPanel.coin} onChange={e => setGoldPanel(g => g ? { ...g, coin: e.target.value as CoinType } : g)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
              {COIN_TYPES.map(t => <option key={t} value={t}>{COIN_LABEL[t]} ({COIN_ABBR[t]})</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, flex: 1 }}>
            Amount:
            <input type="number" inputMode="numeric" value={goldPanel.amount} autoFocus
              onChange={e => setGoldPanel(g => g ? { ...g, amount: e.target.value } : g)}
              placeholder="e.g. 50"
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => handleSendGold("add")}
            title="Add this amount to the character's current coin"
            style={{ flex: 1, padding: "8px", background: "#4a3a1a", border: "1px solid #e0a03055", color: "#e0a030", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            ＋ Add {COIN_ABBR[goldPanel.coin]}
          </button>
          <button type="button" onClick={() => handleSendGold("set")}
            title="Set this coin to exactly this amount"
            style={{ padding: "8px 12px", background: "transparent", border: "1px solid #555", color: "#aaa", borderRadius: 6, cursor: "pointer" }}>
            Set Total
          </button>
          <button type="button" onClick={() => setGoldPanel(null)}
            style={{ padding: "8px 12px", background: "transparent", border: "1px solid #444", borderRadius: 6, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>Target: <strong style={{ color: "#aaa" }}>{seatLabel}</strong></p>
      </div>
    );
  }

  if (lootTarget) {
    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Send Loot</h3>
        <div style={{ background: "#161622", borderRadius: 8, padding: 12, border: "1px solid #7b68ee33" }}>
          <p style={{ margin: "0 0 4px", fontWeight: 500 }}>{lootTarget.item.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{lootTarget.item.type} · {lootTarget.item.description?.slice(0, 60)}</p>
        </div>
        <label style={{ fontSize: 12 }}>
          Send to seat:
          <select value={lootTarget.seatId} onChange={e => setLootTarget({ ...lootTarget, seatId: e.target.value })}
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            {seats.map(s => <option key={s.seatId} value={s.seatId}>{s.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          Message (optional)
          <input type="text" value={lootMessage} onChange={e => setLootMessage(e.target.value)}
            placeholder="The party finds a +1 longsword among the wreckage..."
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void handleSendLoot()}
            style={{ flex: 1, padding: "8px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
            ▶ Send Loot
          </button>
          <button type="button" onClick={() => setLootTarget(null)}
            style={{ padding: "8px 14px", background: "transparent", border: "1px solid #444", borderRadius: 6, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Loot offer builder ───────────────────────────────────────────────────────
  if (lootOffer) {
    const seatLabel = lootOffer.seatIds.length === 0
      ? "nobody yet"
      : lootOffer.seatIds.length === seats.filter(s => s.seatMode !== "viewer").length
      ? "All Players"
      : `${lootOffer.seatIds.length} players`;
    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{lootOffer.mode === "boss-final" ? "Session Reward" : lootOffer.mode === "merchant" ? "Merchant Stock" : "Mid-Boss Loot"}</h3>
          <span style={{ fontSize: 11, color: "#7b68ee" }}>→ {seatLabel}</span>
        </div>
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["boss-mid", "boss-final", "merchant"] as const).map(m => (
            <button key={m} type="button" onClick={() => setLootOffer(o => o ? { ...o, mode: m } : null)}
              style={{ flex: 1, padding: "5px", fontSize: 11, borderRadius: 4, border: "none", cursor: "pointer",
                background: lootOffer.mode === m ? (m === "boss-final" ? "#7b68ee" : m === "merchant" ? "#4a3a1a" : "#2a6e2a") : "#1a1a2e",
                color: lootOffer.mode === m ? "#fff" : "#555" }}>
              {m === "boss-mid" ? "⚔ Mid-Boss" : m === "boss-final" ? "🏆 Session Final" : "🛒 Merchant"}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
          {lootOffer.mode === "boss-final"
            ? "Full-screen pick panel — best for end-of-session rewards. Player focuses on the choice."
            : lootOffer.mode === "merchant"
            ? "Shows item gold cost (from item value field). Player picks to buy. Gold deducted manually by DM."
            : "Compact strip — shown above the combat panel so player can pick without losing combat view."}
        </p>
        {/* Items in the offer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lootOffer.items.map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#161622", borderRadius: 6, border: "1px solid #2a3a2a" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</span>
                <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>{item.category ?? item.type}</span>
                {item.tier && <span style={{ fontSize: 10, color: "#7b68ee66", marginLeft: 4 }}>{item.tier}</span>}
                {/*
                  ⚠ THE CHASSIS FORM IS PICKED HERE, AT HAND-OVER.

                  Christopher: *"make sure the Choice is a pickable option when it is attached or
                  sent to a player."* A Gift is authored as a SHAPE — "a one-handed melee weapon" —
                  and becomes a specific weapon only when it is given. The picker existed solely in
                  the item editor, so a Gift sent from a loot table arrived with no form at all and
                  no way to choose one: an adaptive item that could not adapt.

                  The pick lands on the COPY being sent, never on the library entry. That is the
                  whole reason the entry stays generic — two players can hold the same Gift in
                  different shapes.
                */}
                {item.chassis && (
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: item.chassis.formId ? "#7b68ee" : "#e0b34a" }}>
                      {item.chassis.formId ? "form" : "pick a form"}
                    </span>
                    <select
                      value={item.chassis.formId ?? ""}
                      onChange={e => setLootOffer(o => o ? {
                        ...o,
                        items: o.items.map(i => i.id === item.id
                          ? { ...i, chassis: { ...i.chassis!, formId: e.target.value || undefined } }
                          : i),
                      } : null)}
                      style={{ fontSize: 10, padding: "1px 4px", borderRadius: 3, background: "#111", color: "#ccc",
                               border: `1px solid ${item.chassis.formId ? "#444" : "#5a4a1a"}` }}>
                      <option value="">— choose —</option>
                      {matchingForms(item.chassis).map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button type="button"
                onClick={() => setLootOffer(o => o ? { ...o, items: o.items.filter(i => i.id !== item.id) } : null)}
                style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                ✕
              </button>
            </div>
          ))}
          {lootOffer.items.length === 0 && (
            <p style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>No items added yet. Go back and click "+ Loot Table".</p>
          )}
        </div>
        {/* Who's in it, and in what order — one control, because for a turn-taking round the
            guest list IS the running order. Boss loot often goes to some seats and not
            others; a merchant usually opens to the whole party starting at seat 1. */}
        {(() => {
          const players = seats.filter(s => s.seatMode !== "viewer");
          const chosen = lootOffer.seatIds;
          const setIds = (ids: string[]) => setLootOffer(o => o ? { ...o, seatIds: ids } : null);
          const toggle = (seatId: string) => setIds(
            chosen.includes(seatId) ? chosen.filter(id => id !== seatId) : [...chosen, seatId]
          );
          const move = (idx: number, dir: -1 | 1) => {
            const to = idx + dir;
            if (to < 0 || to >= chosen.length) return;
            const next = [...chosen];
            [next[idx], next[to]] = [next[to], next[idx]];
            setIds(next);
          };
          const unchosen = players.filter(s => !chosen.includes(s.seatId));
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12 }}>Send to {usePickOrder && chosen.length > 1 ? "— in this order" : ""}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => setIds(defaultRecipientIds())}
                    style={{ fontSize: 10, padding: "2px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>All</button>
                  <button type="button" onClick={() => setIds([])}
                    style={{ fontSize: 10, padding: "2px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>None</button>
                </div>
              </div>
              {/* Chosen seats, in running order */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {chosen.map((seatId, i) => {
                  const s = players.find(p => p.seatId === seatId);
                  if (!s) return null;
                  return (
                    <div key={seatId} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "#161622", borderRadius: 6, border: "1px solid #2a2a3a" }}>
                      {usePickOrder && chosen.length > 1 && (
                        <span style={{ fontSize: 11, color: "#7b68ee", fontWeight: 600, minWidth: 16 }}>{i + 1}.</span>
                      )}
                      <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
                      {usePickOrder && chosen.length > 1 && (<>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                          style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: i === 0 ? "#333" : "#888", cursor: i === 0 ? "default" : "pointer" }}>▲</button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === chosen.length - 1}
                          style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: i === chosen.length - 1 ? "#333" : "#888", cursor: i === chosen.length - 1 ? "default" : "pointer" }}>▼</button>
                      </>)}
                      <button type="button" onClick={() => toggle(seatId)} title="Remove from this offer"
                        style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕</button>
                    </div>
                  );
                })}
                {chosen.length === 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: "#a06a4a", fontStyle: "italic" }}>Nobody selected — add at least one seat below.</p>
                )}
              </div>
              {/* Seats left out — click to add to the end of the order */}
              {unchosen.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {unchosen.map(s => (
                    <button key={s.seatId} type="button" onClick={() => toggle(s.seatId)}
                      style={{ fontSize: 11, padding: "3px 9px", background: "transparent", border: "1px dashed #444", borderRadius: 4, color: "#777", cursor: "pointer" }}>
                      + {s.label}
                    </button>
                  ))}
                </div>
              )}
              {chosen.length > 1 && (<>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <input type="checkbox" checked={usePickOrder} onChange={e => setUsePickOrder(e.target.checked)} />
                  Take turns (one seat at a time)
                </label>
                <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
                  {!usePickOrder
                    ? "Everyone sees the pool at once — first to claim an item gets it."
                    : lootOffer.mode === "merchant"
                    ? "Each player shops in turn — buy what you can afford, then hand the counter on. Closes after the last seat."
                    : "Each player picks in turn. Their choice is spent and the rest of the pool passes to the next. Closes after the last seat."}
                </p>
              </>)}
            </div>
          );
        })()}
        <label style={{ fontSize: 12 }}>
          Message (optional)
          <input type="text" value={lootMessage} onChange={e => setLootMessage(e.target.value)}
            placeholder="Boss drop — choose your reward..."
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {lootOffer.items.some(i => i.chassis && !i.chassis.formId) && (
            <p style={{ fontSize: 11, color: "#e0b34a", margin: "0 0 6px", flexBasis: "100%" }}>
              Pick a form for every adaptive Gift first — one sent without a form arrives as a shape
              the player cannot use.
            </p>
          )}
          <button type="button" onClick={() => void handleSendLootOffer()}
            disabled={lootOffer.items.length === 0 || lootOffer.items.some(i => i.chassis && !i.chassis.formId)}
            style={{ flex: 1, padding: "8px", background: lootOffer.items.length > 0 ? "#7b68ee" : "#333", color: "#fff", border: "none", borderRadius: 6, cursor: lootOffer.items.length > 0 ? "pointer" : "default", fontWeight: 500 }}>
            ▶ Send Loot Offer ({lootOffer.items.length} items)
          </button>
          <button type="button" onClick={() => setLootOffer(null)}
            style={{ padding: "8px 14px", background: "transparent", border: "1px solid #444", borderRadius: 6, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Convergence builder UI ────────────────────────────────────────────────────
  if (convergenceBuilder) {
    const allItems = [...campaignLib, ...dmLib];
    const outputItems = dmLib; // DM creates output items in their custom library
    const inputItems = allItems.filter(i => i.convergence?.role === "input");
    const seatLabel = convergenceBuilder.seatId === "__all__"
      ? "All Players"
      : (seats.find(s => s.seatId === convergenceBuilder.seatId)?.label ?? convergenceBuilder.seatId);

    function addCombo() {
      setConvergenceBuilder(b => b ? {
        ...b,
        combos: [...b.combos, { outputItem: outputItems[0] ?? dmLib[0] ?? campaignLib[0], inputItems: [], description: "" }],
      } : null);
    }
    function removeCombo(idx: number) {
      setConvergenceBuilder(b => b ? { ...b, combos: b.combos.filter((_, i) => i !== idx) } : null);
    }
    function updateComboOutput(idx: number, item: EquipmentItem) {
      setConvergenceBuilder(b => b ? { ...b, combos: b.combos.map((c, i) => i === idx ? { ...c, outputItem: item } : c) } : null);
    }
    function addComboInput(idx: number, item: EquipmentItem) {
      setConvergenceBuilder(b => b ? {
        ...b,
        combos: b.combos.map((c, i) => i === idx
          ? { ...c, inputItems: c.inputItems.find(x => x.id === item.id) ? c.inputItems : [...c.inputItems, { id: item.id, name: item.name }] }
          : c),
      } : null);
    }
    function removeComboInput(comboIdx: number, inputId: string) {
      setConvergenceBuilder(b => b ? {
        ...b,
        combos: b.combos.map((c, i) => i === comboIdx ? { ...c, inputItems: c.inputItems.filter(x => x.id !== inputId) } : c),
      } : null);
    }
    function updateComboDesc(idx: number, desc: string) {
      setConvergenceBuilder(b => b ? { ...b, combos: b.combos.map((c, i) => i === idx ? { ...c, description: desc } : c) } : null);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>◈ Convergence Offer</h3>
          <span style={{ fontSize: 11, color: "#4caf50" }}>→ {seatLabel}</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "#555" }}>
            Player submits 2 input items → receives the output item. DM manually removes input items from their bag after approving.
          </p>

          {convergenceBuilder.combos.length === 0 && (
            <p style={{ fontSize: 12, color: "#444", fontStyle: "italic", marginBottom: 10 }}>No combos added yet. Click + Add Combo below.</p>
          )}

          {convergenceBuilder.combos.map((combo, idx) => (
            <div key={idx} style={{ background: "#161622", border: "1px solid #2a3a2a", borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#4caf50", fontWeight: 600 }}>Combo {idx + 1}</span>
                <button type="button" onClick={() => removeCombo(idx)}
                  style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>✕ Remove</button>
              </div>
              {/* Output item picker */}
              <label style={{ fontSize: 11, color: "#aaa", display: "block", marginBottom: 6 }}>
                Output item (player receives):
                <select value={combo.outputItem.id}
                  onChange={e => {
                    const found = allItems.find(i => i.id === e.target.value);
                    if (found) updateComboOutput(idx, found);
                  }}
                  style={{ display: "block", width: "100%", marginTop: 3, padding: "4px 6px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 11 }}>
                  <optgroup label="My Library">
                    {dmLib.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                  <optgroup label="Campaign Library">
                    {campaignLib.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                </select>
              </label>
              {/* Input items */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#aaa" }}>Input items (player submits):</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {combo.inputItems.map(inp => (
                    <span key={inp.id} style={{ fontSize: 10, background: "#1a2a1a", border: "1px solid #2a6e2a55", borderRadius: 10, padding: "2px 8px", color: "#4caf50", display: "flex", alignItems: "center", gap: 4 }}>
                      {inp.name}
                      <button type="button" onClick={() => removeComboInput(idx, inp.id)}
                        style={{ background: "transparent", border: "none", color: "#ff9999", cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                  {combo.inputItems.length === 0 && <span style={{ fontSize: 10, color: "#444" }}>None selected</span>}
                </div>
                <select defaultValue="" onChange={e => {
                  const found = inputItems.find(i => i.id === e.target.value);
                  if (found) addComboInput(idx, found);
                  e.target.value = "";
                }}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "3px 6px", borderRadius: 4, border: "1px solid #333", background: "#0d0d14", color: "#aaa", fontSize: 11 }}>
                  <option value="">+ Add input item…</option>
                  {inputItems.map(i => <option key={i.id} value={i.id}>{i.name} [{i.convergence?.mechanicalTag}]</option>)}
                </select>
              </div>
              {/* Description */}
              <label style={{ fontSize: 11, color: "#aaa" }}>
                Description (shown to player):
                <input type="text" value={combo.description}
                  onChange={e => updateComboDesc(idx, e.target.value)}
                  placeholder="Combine these two to forge something greater…"
                  style={{ display: "block", width: "100%", marginTop: 3, padding: "4px 6px", borderRadius: 4, border: "1px solid #333", background: "#111", color: "#fff", fontSize: 11 }} />
              </label>
            </div>
          ))}

          <button type="button" onClick={addCombo}
            style={{ width: "100%", padding: "6px", fontSize: 12, background: "#1a2a1a", border: "1px dashed #2a6e2a55", borderRadius: 6, color: "#4caf50", cursor: "pointer", marginBottom: 12 }}>
            + Add Combo
          </button>

          {/* Seat selector */}
          <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            Send to:
            <select value={convergenceBuilder.seatId}
              onChange={e => setConvergenceBuilder(b => b ? { ...b, seatId: e.target.value } : null)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
              <option value="__all__">★ All Players</option>
              {seats.filter(s => s.seatMode !== "viewer").map(s => <option key={s.seatId} value={s.seatId}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, display: "block", marginBottom: 10 }}>
            Message (optional)
            <input type="text" value={convergenceBuilder.message}
              onChange={e => setConvergenceBuilder(b => b ? { ...b, message: e.target.value } : null)}
              placeholder="Convergence available — combine items to unlock something new."
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
          </label>
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid #2a2a3e", flexShrink: 0, display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void handleSendConvergenceOffer()}
            disabled={convergenceBuilder.combos.length === 0}
            style={{ flex: 1, padding: "8px", background: convergenceBuilder.combos.length > 0 ? "#4caf50" : "#333", color: "#fff", border: "none", borderRadius: 6, cursor: convergenceBuilder.combos.length > 0 ? "pointer" : "default", fontWeight: 500, fontSize: 13 }}>
            ◈ Send Convergence Offer ({convergenceBuilder.combos.length} combo{convergenceBuilder.combos.length !== 1 ? "s" : ""})
          </button>
          <button type="button" onClick={() => setConvergenceBuilder(null)}
            style={{ padding: "8px 14px", background: "transparent", border: "1px solid #444", borderRadius: 6, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Convergence approval panel ───────────────────────────────────────────────
  if (convergenceApproval) {
    return <ConvergenceApprovalPanel
      req={convergenceApproval}
      campaignLib={campaignLib}
      dmLib={dmLib}
      seats={seats}
      /**
       * PREFER THE HOST'S HANDLER — it is the one that can actually change the sheet.
       *
       * `onExternalConvergenceApprove` was accepted as a prop, destructured, and then never
       * called. So approving from the Library ran the local handler below, which broadcasts a
       * loot-delivery and touches nothing else: the output was never written to the character
       * and the submitted inputs were never consumed. The request cleared, the DM was told it
       * had worked, and the player's bag was exactly as before.
       *
       * dm-panel's handler owns the actor library, grants the output and then removes the
       * inputs in that order. The local one stays as the fallback for the standalone window,
       * where there is no host to defer to.
       */
      onApprove={async (req, outputItemId) => {
        if (onExternalConvergenceApprove) await onExternalConvergenceApprove(req, outputItemId);
        else await handleApproveConvergence(req, outputItemId);
        removeFromConvergenceInbox(req);
        setPendingConvergenceRequests(prev => prev.filter(r => !(r.offerId === req.offerId && r.seatId === req.seatId)));
        setConvergenceApproval(null);
      }}
      // Deny defers to the host for the same reason approve does — and either way the request
      // is cleared from both the local list and the durable inbox.
      onDeny={async (req) => {
        if (onExternalConvergenceDeny) {
          await onExternalConvergenceDeny(req);
        } else if (OBR.isAvailable) {
          await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, {
            type: "fdmc:convergence-denied",
            seatId: req.seatId,
            offerId: req.offerId,
            reason: "DM declined the convergence request.",
          }, { destination: "ALL" });
        }
        setPendingConvergenceRequests(prev => prev.filter(r => !(r.offerId === req.offerId && r.seatId === req.seatId)));
        removeFromConvergenceInbox(req);
        setConvergenceApproval(null);
      }}
      onBack={() => setConvergenceApproval(null)}
    />;
  }

  // A DM edit to a campaign item is stored as an unlocked override under the same id
  // (see handleUnlockItem / upsertItem). Overlay those overrides so the Broken Chain
  // drawer shows the edited version instead of the original locked copy.
  const dmById = new Map(dmLib.map(i => [i.id, i]));
  const campaignMerged = campaignLib.map(c => dmById.get(c.id) ?? c);
  const filteredCampaign = filterText
    ? campaignMerged.filter(i => {
        const lower = filterText.toLowerCase().trim();
        // Name search only triggers with 3+ chars to prevent spurious matches (e.g. "1" matching "+1" items)
        const nameMatch = lower.length >= 3 && i.name.toLowerCase().includes(lower);
        // Act and encounter always match (user explicitly filtering by these)
        const actMatch = Boolean(i.act?.toLowerCase().includes(lower));
        const encounterMatch = Boolean(i.sourceEncounter?.toLowerCase().includes(lower));
        return nameMatch || actMatch || encounterMatch;
      })
    : campaignMerged;
  // "My Library" = the DM's OWN custom items only. Exclude anything whose id is also a
  // campaign item (campaign loot leaks into the dm store if a pack was imported via the
  // generic Import, or from older builds) so it doesn't double-show alongside the Broken
  // Chain drawer. Mirrors the monster panel's myMonsters filter.
  const campaignIds = new Set(campaignLib.map(i => i.id));
  const dmOnly = dmLib.filter(i => !campaignIds.has(i.id));
  const filteredDm = filterText
    ? dmOnly.filter(i => i.name.toLowerCase().includes(filterText.toLowerCase()))
    : dmOnly;

  function renderItem(item: EquipmentItem) {
    const isPeeked = peekId === item.id;
    return (
      <div key={item.id} style={{ background: "#161622", border: `1px solid ${item.isLocked ? "#2a3a2a" : "#2a2a3e"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
              {item.isLocked && <span style={{ fontSize: 10, color: "#4caf5066" }}>🔒</span>}
              <span style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</span>
              <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 5px", borderRadius: 8 }}>{item.category ?? item.type}</span>
              {item.tier && <span style={{ fontSize: 10, color: "#7b68ee66" }}>{item.tier}</span>}
              {item.attunementRequired && <span style={{ fontSize: 10, color: "#e07b39" }}>Attune</span>}
              {item.convergence?.role === "input" && <span style={{ fontSize: 10, color: "#4caf50" }}>◈ Convergence</span>}
            </div>
            {item.act && <div style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>{item.act}{item.session ? ` · ${item.session}` : ""}{item.sourceEncounter ? ` · ${item.sourceEncounter}` : ""}</div>}
            <p style={{ margin: 0, fontSize: 11, color: "#666" }}>{item.description?.slice(0, 100)}</p>
            {isPeeked && (
              <div style={{ marginTop: 8, fontSize: 11, color: "#aaa", background: "#0d0d14", borderRadius: 4, padding: "8px 10px" }}>
                {item.mechanicsText && <p style={{ margin: "0 0 6px", color: "#aaa" }}><strong style={{ color: "#7b68ee", fontSize: 10 }}>MECHANICS</strong> {item.mechanicsText}</p>}
                {item.dmNote && <p style={{ margin: 0, color: "#555" }}><strong style={{ color: "#555", fontSize: 10 }}>DM NOTE</strong> {item.dmNote}</p>}
                {item.convergence && <p style={{ margin: "4px 0 0", color: "#4caf5088", fontSize: 10 }}>Convergence: {item.convergence.mechanicalTag} · {item.convergence.actLabel} · {item.convergence.flavorTag}</p>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, marginLeft: 8, flexShrink: 0 }}>
            <button type="button" onClick={() => setPeekId(prev => prev === item.id ? null : item.id)}
              style={{ fontSize: 10, padding: "2px 7px", background: isPeeked ? "#7b68ee22" : "transparent", border: "1px solid #333", borderRadius: 3, color: "#666", cursor: "pointer" }}>
              {isPeeked ? "▲" : "▼"}
            </button>
            {seats.length > 0 && (
              <>
                <button type="button" onClick={() => setLootTarget({ item, seatId: seats[0]?.seatId ?? "" })}
                  style={{ fontSize: 11, padding: "2px 8px", background: "#2a6e2a22", border: "1px solid #2a6e2a55", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}
                  title="Send this single item directly to a player (they receive it automatically)">
                  Loot
                </button>
                {(() => {
                  const inCart = cart.some(i => i.id === item.id);
                  return (
                    <button type="button" onClick={() => toggleCart(item)}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
                        background: inCart ? "#2a6e2a" : "transparent",
                        border: `1px solid ${inCart ? "#2a6e2a" : "#2a6e2a55"}`,
                        color: inCart ? "#fff" : "#4caf50" }}
                      title="Add to the boss-haul bundle — send several items to one player at once">
                      {inCart ? "✓ Bundle" : "＋ Bundle"}
                    </button>
                  );
                })()}
                <button type="button"
                  onClick={() => {
                    if (lootOffer) {
                      if (!lootOffer.items.find(i => i.id === item.id)) {
                        setLootOffer(o => o ? { ...o, items: [...o.items, item] } : { items: [item], seatIds: defaultRecipientIds(), mode: "boss-mid" });
                      }
                    } else {
                      setLootOffer({ items: [item], seatIds: defaultRecipientIds(), mode: "boss-mid" });
                    }
                  }}
                  style={{ fontSize: 11, padding: "2px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}
                  title="Add to loot table — player picks one item from the list">
                  + Table
                </button>
                {item.convergence?.role === "input" && (
                  <button type="button"
                    onClick={() => setConvergenceBuilder(b => b ?? { seatId: "__all__", combos: [], message: "" })}
                    style={{ fontSize: 11, padding: "2px 8px", background: "#1a2a1a", border: "1px solid #2a6e2a55", borderRadius: 3, color: "#4caf50", cursor: "pointer" }}
                    title="Open convergence builder">
                    ◈
                  </button>
                )}
              </>
            )}
            {/*
              ✎ EDIT CAMPAIGN — the author edits the real item, in place.

              Unlocking is still here and still does what it did: it makes a DM's PRIVATE copy of
              a campaign item, which is the right tool for a DM who wants their own version. It is
              the wrong tool for the person who wrote the campaign, because the copy is discarded
              on the next re-seed. Editing in place is how a loot pool gets re-filed.
            */}
            {item.isLocked && (
              <button type="button"
                onClick={() => setEditingItem({ ...item, isLocked: false })}
                title="Edit this campaign item IN PLACE — act, encounter, mechanics. Saves to the campaign library, not to a private copy."
                style={{ fontSize: 10, padding: "2px 7px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                ✎ Campaign
              </button>
            )}
            {item.isLocked ? (
              /* TODO: remove at 0.9.0 alpha lock */
              <button type="button" onClick={() => handleUnlockItem(item)}
                style={{ fontSize: 10, padding: "2px 7px", background: "transparent", border: "1px solid #5a4a1a", borderRadius: 3, color: "#e07b3988", cursor: "pointer" }}
                title="Unlock for DM editing — creates a custom copy (pre-alpha only)">
                🔓
              </button>
            ) : (
              <>
                {/*
                  → CAMPAIGN. An item authored in My Library shows under its own act heading and
                  never appears in the CAMPAIGN loot — which reads as "it did not save", because
                  from the DM's side nothing about it looks unsaved. Moving it is one click.
                */}
                <button type="button"
                  onClick={() => {
                    const dm = loadEquipmentLibrary("dm").filter(i => i.id !== item.id);
                    const camp = loadEquipmentLibrary("campaign").filter(i => i.id !== item.id);
                    saveEquipmentLibrary([...camp, item], "campaign");
                    saveEquipmentLibrary(dm, "dm");
                    refreshLibrary();
                  }}
                  title="Move this item into the CAMPAIGN library so it sits with the campaign loot and ships through the author export."
                  style={{ fontSize: 10, padding: "2px 7px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                  → Campaign
                </button>
                <button type="button" onClick={() => setEditingItem(item)}
                  style={{ fontSize: 11, padding: "2px 7px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                  Edit
                </button>
                <button type="button" onClick={() => handleDeleteItem(item.id)}
                  style={{ fontSize: 11, padding: "2px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                  ✕
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render a library section grouped into collapsible per-encounter / per-merchant
  // bands. Untagged items render flat under "Unsorted". A search filter auto-expands
  // every group so matches are never hidden behind a collapsed header.
  function renderGroupedList(items: EquipmentItem[], sectionKey: string) {
    const groups = groupByEncounter(items);
    let lastAct: string | null = null;
    return groups.map(g => {
      const gid = `${sectionKey}:${g.key}`;
      // ACT HEADING — printed once above the first group of each act, so the library
      // reads Act 1 → Act 2 → Act 3 → 2024 Weapon Bases → Unsorted.
      const actHeading = g.actLabel !== lastAct ? (lastAct = g.actLabel) : null;
      const heading = actHeading && (
        <div key={`${gid}:act`} style={{
          margin: "12px 0 6px", paddingBottom: 3, borderBottom: "1px solid #2a2a3e",
          fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
          color: actHeading === "Unsorted" ? "#667" : "#9d8cff",
        }}>
          {actHeading}
        </div>
      );
      if (g.key === UNGROUPED_KEY) {
        // Untagged items render directly (no collapse).
        return <div key={gid}>{heading}{g.items.map(renderItem)}</div>;
      }
      const expanded = expandedGroups.has(gid) || filterText.trim().length > 0;
      return (
        <div key={gid} style={{ marginBottom: 8 }}>
          {heading}
          {/* The header is a ROW, not one big button: "Table all" has to sit beside the
              expander, and a button inside a button is invalid HTML. */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 0,
            background: "#161622", border: "1px solid #2a2a3e", borderLeft: "3px solid #e0b34a", borderRadius: 6, overflow: "hidden" }}>
            <button type="button" onClick={() => toggleGroup(gid)}
              style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, textAlign: "left", padding: "7px 10px",
                background: "transparent", border: "none", cursor: "pointer", color: "#fff" }}
              title={expanded ? "Collapse" : "Expand"}>
              <span style={{ fontSize: 11, color: "#e0b34a", width: 12, flexShrink: 0 }}>{expanded ? "▼" : "▶"}</span>
              <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🎁 {g.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#0d0d14", background: "#e0b34a", borderRadius: 8, padding: "1px 7px", flexShrink: 0 }}>{g.items.length}</span>
            </button>
            {seats.length > 0 && (<>
              <button type="button"
                onClick={() => tableWholeGroup(g.items, g.label)}
                style={{ fontSize: 11, padding: "0 10px", background: "#7b68ee22", border: "none", borderLeft: "1px solid #2a2a3e", color: "#7b68ee", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
                title={`Stage all ${g.items.length} items from ${g.label} on the loot table — use this when you want to trim the pool, choose who's in it, or set the order before sending`}>
                + Table all
              </button>
              {/* Straight out, no staging. The encounter doc already says what this drops, so
                  the common case shouldn't need a builder round trip first. */}
              <button type="button"
                onClick={() => void sendWholeGroup(g.items, g.label)}
                style={{ fontSize: 11, padding: "0 10px", background: "#2a6e2a", border: "none", borderLeft: "1px solid #2a2a3e", color: "#eafff0", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", fontWeight: 600 }}
                title={`Send all ${g.items.length} items from ${g.label} to the whole party now — everyone in seat order, taking turns, claim-once. Use "+ Table all" instead if you need to change any of that first.`}>
                ▶ Send
              </button>
            </>)}
          </div>
          {expanded && <div style={{ marginTop: 6, paddingLeft: 6 }}>{g.items.map(renderItem)}</div>}
        </div>
      );
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
          {dmOnly.length} custom{unlocked ? ` · 🔒 ${campaignLib.length} campaign` : ""}
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {dmOnly.length > 0 && (
            <button type="button" onClick={() => exportEquipmentLibrary()}
              style={{ fontSize: 11, padding: "3px 8px", background: "#2a3a2a", color: "#4caf50", border: "1px solid #2a6e2a55", borderRadius: 3, cursor: "pointer" }}
              title="Export your custom items to JSON">
              ↓ Export
            </button>
          )}
          <label style={{ fontSize: 11, padding: "3px 8px", background: "#2a2a3e", color: "#aaa", border: "1px solid #444", borderRadius: 3, cursor: "pointer", display: "flex", alignItems: "center" }}>
            ↑ Import
            <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              void importEquipmentLibrary(file).then(result => { setImportResult(result); if (result.ok) refreshLibrary(); });
              e.target.value = "";
            }} />
          </label>
          {onSendGold && seats.some(s => s.seatMode !== "viewer") && (
            <button type="button" onClick={() => setGoldPanel({ seatId: seats.find(s => s.seatMode !== "viewer")?.seatId ?? "", amount: "", coin: "gp" })}
              style={{ fontSize: 11, padding: "3px 10px", background: "#4a3a1a", color: "#e0a030", border: "1px solid #e0a03055", borderRadius: 3, cursor: "pointer" }}
              title="Grant gold to a player (for those who didn't get boss loot)">
              💰 Send Gold
            </button>
          )}
          <button type="button" onClick={() => setConvergenceBuilder({ seatId: "__all__", combos: [], message: "" })}
            style={{ fontSize: 11, padding: "3px 10px", background: "#1a2a1a", color: "#4caf50", border: "1px solid #2a6e2a55", borderRadius: 3, cursor: "pointer" }}
            title="Build a convergence offer — player submits 2 items to receive a new one">
            ◈ Converge
          </button>
          {!hideCreate && (
            <button type="button" onClick={() => setEditingItem("new")}
              style={{ fontSize: 11, padding: "3px 10px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
              + New Item
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "6px 14px", borderBottom: "1px solid #1a1a2e", flexShrink: 0 }}>
        <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
          placeholder="Filter by name, act, or encounter…"
          style={{ width: "100%", padding: "4px 8px", borderRadius: 4, border: "1px solid #333", background: "#111", color: "#fff", fontSize: 12 }} />
      </div>

      {importResult && (
        <div style={{ padding: "5px 14px", background: importResult.ok ? "#0d1a0d" : "#1a0a0a", borderBottom: "1px solid #2a2a3e", fontSize: 11, color: importResult.ok ? "#4caf50" : "#ff9999", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{importResult.ok ? "✓" : "✕"} {importResult.message}</span>
          <button type="button" onClick={() => setImportResult(null)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>×</button>
        </div>
      )}
      {recentDelivery && (
        <div style={{ padding: "5px 14px", background: "#2a6e2a", fontSize: 11, color: "#fff", flexShrink: 0 }}>✓ {recentDelivery}</div>
      )}
      {deliveryProblem && (
        <div style={{ padding: "5px 14px", background: "#2a2010", borderBottom: "1px solid #6e5a20", fontSize: 11, color: "#e0b85a", flexShrink: 0 }}>⚠ {deliveryProblem}</div>
      )}
      {/* The round, as the DM sees it — open the whole time it runs and after it closes, so
          "who bought what" is answerable without asking the table. The pool alone only says
          what's LEFT; the ledger is what turns that into a record.
          Skip/Close are not niceties: only the current seat's own click advances the queue,
          so a player who drops out would otherwise hold it open forever. */}
      {openOffer && (() => {
        const picker = currentPicker(openOffer);
        const finished = openOffer.remainingItemIds.length === 0
          || (openOffer.ordered && openOffer.turnIndex >= openOffer.recipients.length);
        const catalogue = () => [...loadEquipmentLibrary("campaign"), ...loadEquipmentLibrary("dm")];
        const all = catalogue();
        const nameOf = (id: string) => all.find(i => i.id === id)?.name ?? id;
        const isShop = openOffer.mode === "merchant";
        const claims = openOffer.claims ?? [];
        const accent = finished ? "#555" : isShop ? "#c0a062" : "#7b68ee";
        return (
          <div style={{ borderBottom: "1px solid #2a2a3e", background: "#12121c", flexShrink: 0 }}>
            <div style={{ padding: "7px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
                {finished ? (isShop ? "Shop closed" : "Round closed") : isShop ? "Shop open" : "Loot round"}
              </span>
              <span style={{ fontSize: 11, color: "#aaa" }}>
                {openOffer.remainingItemIds.length} left
                {finished ? "" : picker ? ` · ${picker.label}'s turn` : openOffer.ordered ? "" : " · open to all"}
              </span>
              <button type="button" onClick={() => setOfferPanelOpen(o => !o)}
                style={{ fontSize: 10, padding: "1px 7px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#777", cursor: "pointer" }}>
                {offerPanelOpen ? "▾ hide" : "▸ details"}
              </button>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {!finished && picker && (
                  <button type="button" onClick={() => void skipCurrentPicker(catalogue()).then(o => setOpenOffer(o))}
                    title={`Move past ${picker.label} — use if they've dropped out`}
                    style={{ fontSize: 10, padding: "2px 9px", background: "transparent", border: "1px solid #6e5a20", borderRadius: 3, color: "#e0b85a", cursor: "pointer" }}>
                    Skip {picker.label}
                  </button>
                )}
                {!finished && (
                  <button type="button" onClick={() => void closeOpenOffer(catalogue()).then(() => setOpenOffer(loadOpenLootOffer()))}
                    title="End the round now — every player's panel closes"
                    style={{ fontSize: 10, padding: "2px 9px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                    Close
                  </button>
                )}
                {finished && (
                  <button type="button" onClick={() => { saveOpenLootOffer(null); setOpenOffer(null); }}
                    title="Clear this record from the panel"
                    style={{ fontSize: 10, padding: "2px 9px", background: "transparent", border: "1px solid #333", borderRadius: 3, color: "#777", cursor: "pointer" }}>
                    Dismiss
                  </button>
                )}
              </div>
            </div>

            {offerPanelOpen && (
              <div style={{ padding: "0 14px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Running order — who has been, who's up, who's still to come */}
                {openOffer.ordered && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {openOffer.recipients.map((r, i) => {
                      const been = i < openOffer.turnIndex;
                      const now = !finished && i === openOffer.turnIndex;
                      return (
                        <span key={r.seatId} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10,
                          background: now ? `${accent}22` : "transparent",
                          border: `1px solid ${now ? accent : been ? "#2a3a2a" : "#333"}`,
                          color: now ? accent : been ? "#4caf50" : "#666" }}>
                          {been ? "✓ " : now ? "▶ " : `${i + 1}. `}{r.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* What's still on the shelf */}
                <div>
                  <p style={{ margin: "0 0 3px", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Still available</p>
                  {openOffer.remainingItemIds.length === 0
                    ? <p style={{ margin: 0, fontSize: 11, color: "#555", fontStyle: "italic" }}>Nothing left.</p>
                    : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {openOffer.remainingItemIds.map(id => (
                          <span key={id} style={{ fontSize: 11, padding: "2px 8px", background: "#161622", border: "1px solid #2a2a3e", borderRadius: 4, color: "#ccc" }}>
                            {nameOf(id)}
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                {/* Who got what */}
                <div>
                  <p style={{ margin: "0 0 3px", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
                    {isShop ? "Purchases" : "Taken"}
                  </p>
                  {claims.length === 0
                    ? <p style={{ margin: 0, fontSize: 11, color: "#555", fontStyle: "italic" }}>Nobody has {isShop ? "bought" : "picked"} yet.</p>
                    : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {claims.map((c, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                            <span style={{ color: "#888", minWidth: 90 }}>{c.actorName}</span>
                            {c.kind === "passed" && <span style={{ color: "#666", fontStyle: "italic" }}>passed</span>}
                            {c.kind === "skipped" && <span style={{ color: "#e0b85a", fontStyle: "italic" }}>skipped by DM</span>}
                            {(c.kind === "took" || c.kind === "bought") && (<>
                              <span style={{ color: "#ddd" }}>{c.itemName ?? nameOf(c.itemId ?? "")}</span>
                              {c.costCopper ? <span style={{ color: "#c0a062" }}>{formatCopperPrice(c.costCopper)}</span> : null}
                            </>)}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {/* PENDING CONVERGENCE REQUESTS.
            This used to render only when `externalConvergenceRequests` was absent, on the
            reasoning that dm-panel's unified approvals view owns them otherwise. But dm-panel
            passes its state array, which starts as [] — not undefined — so the guard was
            permanently true: the internal listener above switched off (same test), the display
            switched off here, and a submitted request existed ONLY in dm-panel's Approvals
            view. A DM working in the Library window saw nothing arrive and the player waited on
            "Awaiting DM Approval" forever.
            Showing whichever list is populated puts the request in front of whoever is looking,
            in the window they are already in. The approvals view still has its own copy; both
            read the same request, and approving in either resolves it. */}
        {convergenceRequestsToShow.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4caf50", textTransform: "uppercase", letterSpacing: 1 }}>
              ◈ Convergence Requests ({convergenceRequestsToShow.length})
            </p>
            {convergenceRequestsToShow.map(req => {
              const seat = seats.find(s => s.seatId === req.seatId);
              const allItems = [...campaignLib, ...dmLib];
              const outputItem = allItems.find(i => i.id === req.outputItemId);
              return (
                <div key={`${req.offerId}-${req.seatId}`}
                  style={{ background: "#0d1a0d", border: "1px solid #2a6e2a66", borderRadius: 8, padding: "8px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#4caf50" }}>{seat?.label ?? req.seatId}</span>
                    <span style={{ fontSize: 11, color: "#666", marginLeft: 6 }}>→</span>
                    <span style={{ fontSize: 12, color: "#aaa", marginLeft: 6 }}>{outputItem?.name ?? req.outputItemId}</span>
                  </div>
                  <button type="button" onClick={() => setConvergenceApproval(req)}
                    style={{ fontSize: 11, padding: "4px 12px", background: "#1a2a1a", border: "1px solid #4caf5055", borderRadius: 4, color: "#4caf50", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                    Review →
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {/*
          🎁 LOOT POOL — build a pool and tick what goes in it.

          The per-item route was four steps deep and had to be repeated once per item: find it,
          open it, type the pool name, save. Eight Gifts meant typing one string eight times, and
          a pool IS its name, so every retype is a chance to split the pool in two.
        */}
        <button type="button" onClick={() => setPoolBuilderOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 8,
            padding: "7px 10px", background: "#12101f", border: "1px solid #4b3f8f",
            borderLeft: "3px solid #7b68ee", borderRadius: 6, color: "#9d8cff",
            cursor: "pointer", textAlign: "left", fontSize: 12, fontWeight: 600 }}>
          🎁 Loot pool
          <span style={{ fontWeight: 400, fontSize: 10, color: "#6a5f8a" }}>
            name a pool, tick the items, tag and promote in one go
          </span>
        </button>
        {poolBuilderOpen && (
          <LootPoolBuilder
            encounterNames={[...new Set([...campaignLib, ...dmLib].map(i => i.sourceEncounter?.trim()).filter((s): s is string => Boolean(s)))]}
            onChanged={refreshLibrary}
            onClose={() => setPoolBuilderOpen(false)}
          />
        )}

        {/* My Library — always visible, no password needed, grouped by encounter/merchant */}
        <p style={{ margin: "0 0 6px", fontSize: 10, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1 }}>
          My Library ({filteredDm.length})
        </p>
        {filteredDm.length === 0 ? (
          <p style={{ fontSize: 12, color: "#444", fontStyle: "italic" }}>
            No custom items yet. Use {hideCreate ? "+ Equipment on the toolbar" : "+ New Item"} or ↑ Import to add your own.
          </p>
        ) : (
          renderGroupedList(filteredDm, "dm")
        )}

        {/* Broken Chain campaign equipment — click-to-open drawer; the lock lives here */}
        <button type="button" onClick={() => setBrokenChainOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", marginTop: 16, marginBottom: 6,
            padding: "8px 10px", background: "#161018", border: "1px solid #4a2a2a", borderLeft: "3px solid #c8472e", borderRadius: 6, cursor: "pointer", color: "#fff" }}
          title={brokenChainOpen ? "Collapse" : "Open the Broken Chain library"}>
          <span style={{ fontSize: 11, color: "#c8472e", width: 12, flexShrink: 0 }}>{brokenChainOpen ? "▼" : "▶"}</span>
          <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }}>🔒 Broken Chain Library</span>
          <span style={{ fontSize: 10, color: unlocked ? "#4caf50" : "#c8472e", flexShrink: 0 }}>
            {unlocked ? `unlocked · ${filteredCampaign.length}` : "locked"}
          </span>
        </button>
        {brokenChainOpen && (
          unlocked ? (
            filteredCampaign.length > 0 ? (
              renderGroupedList(filteredCampaign, "campaign")
            ) : (
              <p style={{ fontSize: 12, color: "#444", fontStyle: "italic" }}>
                {filterText ? "No campaign items match your filter." : "No campaign equipment loaded."}
              </p>
            )
          ) : (
            <ModuleUnlockPrompt onUnlock={unlock} what="equipment" />
          )
        )}
      </div>

      {/* Boss-haul cart — send several items to ONE player in a single delivery */}
      {cart.length > 0 && (
        <div style={{ borderTop: "1px solid #2a2a3e", background: "#12121c", padding: "8px 14px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#4caf50", fontWeight: 700 }}>🎁 Bundle ({cart.length})</span>
            {cart.map(i => (
              <span key={i.id} style={{ fontSize: 10, background: "#1a2a1a", border: "1px solid #2a6e2a55", borderRadius: 10, padding: "1px 7px", color: "#4caf50", display: "flex", alignItems: "center", gap: 4 }}>
                {i.name}
                <button type="button" onClick={() => toggleCart(i)} style={{ background: "transparent", border: "none", color: "#ff9999", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={cartSeatId} onChange={e => setCartSeatId(e.target.value)}
              style={{ flex: 1, padding: "5px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}>
              <option value="">Select player…</option>
              {seats.filter(s => s.seatMode !== "viewer").map(s => <option key={s.seatId} value={s.seatId}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => void handleSendCart()} disabled={!cartSeatId}
              style={{ fontSize: 12, padding: "5px 14px", background: cartSeatId ? "#2a6e2a" : "#333", color: "#fff", border: "none", borderRadius: 4, cursor: cartSeatId ? "pointer" : "default", fontWeight: 600 }}>
              ▶ Send {cart.length} to player
            </button>
            <button type="button" onClick={() => setCart([])}
              style={{ fontSize: 11, padding: "5px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
