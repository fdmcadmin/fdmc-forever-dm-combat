/**
 * EquipmentLibraryStandalone
 *
 * Full equipment library panel for the DM tools window.
 * Reuses EquipmentBagEditor's library storage.
 * Adds loot delivery — DM selects item + seat → broadcasts to player.
 */

import { useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { loadEquipmentLibrary, saveEquipmentLibrary, exportEquipmentLibrary, importEquipmentLibrary, type EquipmentItem, type EquipmentImportResult } from "./EquipmentBagEditor";
import type { FdmcSeat } from "../seats/seatTypes";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "../seats/seatTypes";
import type { ActorAction } from "../types/tabs";

// ─── Loot broadcast types ─────────────────────────────────────────────────────

/** DM sends a single item directly (existing flow) */
export type LootDelivery = {
  type: "fdmc:loot-delivery";
  seatId: string;
  item: EquipmentItem;
  deliveryId: string;
  message: string;
};

/** DM sends a list of items — player must pick one */
export type LootOffer = {
  type: "fdmc:loot-offer";
  seatId: string;
  offerId: string;
  items: EquipmentItem[];
  message: string;
};

/** Player broadcasts their chosen item back to DM */
export type LootChoice = {
  type: "fdmc:loot-choice";
  seatId: string;
  offerId: string;
  chosenItemId: string;
  actorId: string;
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

function itemToAction(item: EquipmentItem): ActorAction {
  return {
    id: `equip-${item.id}`,
    label: item.name,
    description: item.description,
    actionKind: "equipment",
    logMode: item.isUsable ? "table-note" : "silent",
    displayMode: "compact",
    hasDefinedUse: item.isUsable,
    category: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    metadata: {
      attack: item.attack,
      damage: item.damage,
      crit: item.crit,
      range: item.range,
      cost: item.isUsable ? "Action" : undefined,
      details: [item.description, item.ac ? `AC ${item.ac}` : undefined, item.value].filter(Boolean).join(" · "),
    },
  };
}

// ─── Item form (inline) ───────────────────────────────────────────────────────

const ITEM_TYPES: EquipmentItem["type"][] = ["weapon", "armor", "shield", "consumable", "gear", "magic", "tool"];

function ItemForm({ initial, onSave, onCancel }: {
  initial?: EquipmentItem;
  onSave: (item: EquipmentItem) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<EquipmentItem>(() => initial ?? {
    id: `item-${Date.now().toString(36)}`,
    name: "",
    type: "gear",
    description: "",
    isUsable: false,
  });

  const input = { display: "block" as const, width: "100%", marginTop: 2, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 13 };

  function set<K extends keyof EquipmentItem>(k: K, v: EquipmentItem[K]) {
    setDraft(d => ({ ...d, [k]: v }));
  }

  const isWeapon = draft.type === "weapon" || draft.type === "magic";
  const isArmor = draft.type === "armor" || draft.type === "shield";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "#1a1a2e", borderRadius: 8, margin: 14 }}>
      <h4 style={{ margin: 0 }}>{initial ? "Edit Item" : "New Item"}</h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Name <input type="text" value={draft.name} onChange={e => set("name", e.target.value)} style={input} /></label>
        <label style={{ fontSize: 12 }}>Type
          <select value={draft.type} onChange={e => set("type", e.target.value as EquipmentItem["type"])} style={{ ...input, marginTop: 2 }}>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      {isWeapon && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>Attack <input type="text" value={draft.attack ?? ""} onChange={e => set("attack", e.target.value || undefined)} placeholder="1d20+5" style={input} /></label>
          <label style={{ fontSize: 12 }}>Damage <input type="text" value={draft.damage ?? ""} onChange={e => set("damage", e.target.value || undefined)} placeholder="1d8+3" style={input} /></label>
          <label style={{ fontSize: 12 }}>Crit <input type="text" value={draft.crit ?? ""} onChange={e => set("crit", e.target.value || undefined)} placeholder="2d8+3" style={input} /></label>
          <label style={{ fontSize: 12, gridColumn: "span 3" }}>Range <input type="text" value={draft.range ?? ""} onChange={e => set("range", e.target.value || undefined)} placeholder="5 ft, 150/600 ft..." style={input} /></label>
        </div>
      )}
      {isArmor && <label style={{ fontSize: 12 }}>AC <input type="text" value={draft.ac ?? ""} onChange={e => set("ac", e.target.value || undefined)} placeholder="14" style={input} /></label>}
      <label style={{ fontSize: 12 }}>Description <textarea value={draft.description} onChange={e => set("description", e.target.value)} rows={2} style={{ ...input, resize: "vertical" as const }} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Value <input type="text" value={draft.value ?? ""} onChange={e => set("value", e.target.value || undefined)} placeholder="25 gp" style={input} /></label>
        <label style={{ fontSize: 12 }}>Weight <input type="text" value={draft.weight ?? ""} onChange={e => set("weight", e.target.value || undefined)} placeholder="3 lb" style={input} /></label>
      </div>
      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={draft.isUsable} onChange={e => set("isUsable", e.target.checked)} />
        Has usable action (shows Use button)
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

// ─── Main component ───────────────────────────────────────────────────────────

type EquipmentLibraryStandaloneProps = {
  seats: FdmcSeat[];
};

export function EquipmentLibraryStandalone({ seats }: EquipmentLibraryStandaloneProps) {
  const [campaignLib, setCampaignLib] = useState<EquipmentItem[]>(() => loadEquipmentLibrary("campaign"));
  const [dmLib, setDmLib] = useState<EquipmentItem[]>(() => loadEquipmentLibrary("dm"));
  const [editingItem, setEditingItem] = useState<EquipmentItem | null | "new">(null);
  const [lootTarget, setLootTarget] = useState<{ item: EquipmentItem; seatId: string } | null>(null);
  const [lootOffer, setLootOffer] = useState<{ items: EquipmentItem[]; seatId: string } | null>(null);
  const [lootMessage, setLootMessage] = useState("");
  const [recentDelivery, setRecentDelivery] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<EquipmentImportResult | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");

  function refreshLibrary() {
    setCampaignLib(loadEquipmentLibrary("campaign"));
    setDmLib(loadEquipmentLibrary("dm"));
  }

  function handleSaveItem(item: EquipmentItem) {
    const lib = loadEquipmentLibrary("dm");
    const idx = lib.findIndex(i => i.id === item.id);
    if (idx === -1) lib.push(item); else lib[idx] = item;
    saveEquipmentLibrary(lib, "dm");
    refreshLibrary();
    setEditingItem(null);
  }

  function handleDeleteItem(id: string) {
    saveEquipmentLibrary(loadEquipmentLibrary("dm").filter(i => i.id !== id), "dm");
    refreshLibrary();
  }

  async function handleSendLoot() {
    if (!lootTarget || !OBR.isAvailable) return;
    const delivery: LootDelivery = {
      type: "fdmc:loot-delivery",
      seatId: lootTarget.seatId,
      item: lootTarget.item,
      deliveryId: `loot-${Date.now().toString(36)}`,
      message: lootMessage.trim() || `${lootTarget.item.name} delivered.`,
    };
    await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, delivery, { destination: "REMOTE" });
    setRecentDelivery(`Sent ${lootTarget.item.name} to ${seats.find(s => s.seatId === lootTarget.seatId)?.label ?? lootTarget.seatId}`);
    setLootTarget(null);
    setLootMessage("");
    setTimeout(() => setRecentDelivery(null), 4000);
  }

  async function handleSendLootOffer() {
    if (!lootOffer || lootOffer.items.length === 0 || !OBR.isAvailable) return;
    const offer: LootOffer = {
      type: "fdmc:loot-offer",
      seatId: lootOffer.seatId,
      offerId: `offer-${Date.now().toString(36)}`,
      items: lootOffer.items,
      message: lootMessage.trim() || `Boss drop — choose one item.`,
    };
    await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, offer, { destination: "REMOTE" });
    setRecentDelivery(`Loot offer sent (${lootOffer.items.length} items) to ${seats.find(s => s.seatId === lootOffer.seatId)?.label ?? lootOffer.seatId}`);
    setLootOffer(null);
    setLootMessage("");
    setTimeout(() => setRecentDelivery(null), 6000);
  }

  if (editingItem) {
    return (
      <ItemForm
        initial={editingItem === "new" ? undefined : editingItem}
        onSave={handleSaveItem}
        onCancel={() => setEditingItem(null)}
      />
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
    const seatLabel = seats.find(s => s.seatId === lootOffer.seatId)?.label ?? lootOffer.seatId;
    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Boss Loot Table</h3>
          <span style={{ fontSize: 11, color: "#7b68ee" }}>→ {seatLabel}</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
          Player will see all items and choose one. The chosen item attaches to their actor's equipment.
        </p>
        {/* Items in the offer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lootOffer.items.map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#161622", borderRadius: 6, border: "1px solid #2a3a2a" }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</span>
                <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>{item.category ?? item.type}</span>
                {item.tier && <span style={{ fontSize: 10, color: "#7b68ee66", marginLeft: 4 }}>{item.tier}</span>}
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
        {/* Seat selector */}
        <label style={{ fontSize: 12 }}>
          Send to seat:
          <select value={lootOffer.seatId} onChange={e => setLootOffer(o => o ? { ...o, seatId: e.target.value } : null)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            {seats.filter(s => s.seatMode !== "viewer").map(s => <option key={s.seatId} value={s.seatId}>{s.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          Message (optional)
          <input type="text" value={lootMessage} onChange={e => setLootMessage(e.target.value)}
            placeholder="Boss drop — choose your reward..."
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => void handleSendLootOffer()} disabled={lootOffer.items.length === 0}
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

  const filteredCampaign = filterText
    ? campaignLib.filter(i => {
        const lower = filterText.toLowerCase().trim();
        // Name search only triggers with 3+ chars to prevent spurious matches (e.g. "1" matching "+1" items)
        const nameMatch = lower.length >= 3 && i.name.toLowerCase().includes(lower);
        // Act and encounter always match (user explicitly filtering by these)
        const actMatch = Boolean(i.act?.toLowerCase().includes(lower));
        const encounterMatch = Boolean(i.sourceEncounter?.toLowerCase().includes(lower));
        return nameMatch || actMatch || encounterMatch;
      })
    : campaignLib;
  const filteredDm = filterText
    ? dmLib.filter(i => i.name.toLowerCase().includes(filterText.toLowerCase()))
    : dmLib;

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
                  title="Send this item directly to a player (they receive it automatically)">
                  Loot
                </button>
                <button type="button"
                  onClick={() => {
                    if (lootOffer) {
                      // Add to existing offer (if not already in it)
                      if (!lootOffer.items.find(i => i.id === item.id)) {
                        setLootOffer(o => o ? { ...o, items: [...o.items, item] } : { items: [item], seatId: seats[0]?.seatId ?? "" });
                      }
                    } else {
                      setLootOffer({ items: [item], seatId: seats[0]?.seatId ?? "" });
                    }
                  }}
                  style={{ fontSize: 11, padding: "2px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}
                  title="Add to loot table — player picks one item from the list">
                  + Table
                </button>
              </>
            )}
            {!item.isLocked && (
              <>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
          🔒 {campaignLib.length} campaign · {dmLib.length} custom
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {lootOffer !== null && (lootOffer as { items: EquipmentItem[] }).items.length > 0 && (
            <button type="button" onClick={() => setLootOffer(o => o)}
              style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee33", border: "1px solid #7b68ee", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
              🎁 Table ({(lootOffer as { items: EquipmentItem[] }).items.length})
            </button>
          )}
          {dmLib.length > 0 && (
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
          <button type="button" onClick={() => setEditingItem("new")}
            style={{ fontSize: 11, padding: "3px 10px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
            + New Item
          </button>
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

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {/* Campaign Library — locked */}
        {filteredCampaign.length > 0 && (
          <>
            <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4caf5066", textTransform: "uppercase", letterSpacing: 1 }}>
              🔒 Campaign Library — The Broken Chain ({filteredCampaign.length})
            </p>
            {filteredCampaign.map(renderItem)}
          </>
        )}

        {/* DM Custom Library */}
        <p style={{ margin: `${filteredCampaign.length > 0 ? "14px" : "0"} 0 6px`, fontSize: 10, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1 }}>
          My Library ({filteredDm.length})
        </p>
        {filteredDm.length === 0 ? (
          <p style={{ fontSize: 12, color: "#444", fontStyle: "italic" }}>
            No custom items yet. Use + New Item or ↑ Import to add your own.
          </p>
        ) : (
          filteredDm.map(renderItem)
        )}
      </div>
    </div>
  );
}
