/**
 * EquipmentLibraryStandalone
 *
 * Full equipment library panel for the DM tools window.
 * Reuses EquipmentBagEditor's library storage.
 * Adds loot delivery — DM selects item + seat → broadcasts to player.
 */

import { useState, useEffect } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { loadEquipmentLibrary, saveEquipmentLibrary, exportEquipmentLibrary, importEquipmentLibrary, itemToAction, type EquipmentItem, type EquipmentImportResult } from "./EquipmentBagEditor";
import type { FdmcSeat } from "../seats/seatTypes";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "../seats/seatTypes";
import { useModuleUnlock, ModuleUnlockPrompt } from "../campaign/moduleUnlock";
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
  /** boss-mid = compact strip during combat; boss-final = full-screen; merchant = shows gold cost */
  mode?: "boss-mid" | "boss-final" | "merchant";
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
export function isConvergenceRequest(msg: unknown): msg is ConvergenceRequest {
  return Boolean(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:convergence-request");
}

// itemToAction is imported from EquipmentBagEditor (canonical source with weapon auto-detect)

// ─── Item form (inline) ───────────────────────────────────────────────────────

const ITEM_TYPES: EquipmentItem["type"][] = ["weapon", "armor", "shield", "consumable", "gear", "magic", "tool"];

// Loot is grouped by its encounter/merchant tag (item.sourceEncounter). Items with
// no tag fall into a single "Unsorted" bucket rendered flat (not collapsed).
const UNGROUPED_KEY = "__ungrouped__";

function groupByEncounter(items: EquipmentItem[]): { key: string; label: string; items: EquipmentItem[] }[] {
  const groups = new Map<string, EquipmentItem[]>();
  for (const it of items) {
    const key = it.sourceEncounter?.trim() || UNGROUPED_KEY;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  const tagged: { key: string; label: string; items: EquipmentItem[] }[] = [];
  for (const [key, list] of groups) {
    if (key === UNGROUPED_KEY) continue;
    tagged.push({ key, label: key, items: list });
  }
  tagged.sort((a, b) => a.label.localeCompare(b.label));
  const ungrouped = groups.get(UNGROUPED_KEY);
  if (ungrouped) tagged.push({ key: UNGROUPED_KEY, label: "Unsorted (no encounter)", items: ungrouped });
  return tagged;
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

  const isWeapon = draft.type === "weapon" || draft.type === "magic";
  const isArmor = draft.type === "armor" || draft.type === "shield";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "#1a1a2e", borderRadius: 8, margin: 14 }}>
      <h4 style={{ margin: 0 }}>{initial ? "Edit Item" : "New Item"}</h4>
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

  // Submitted items — try library first, fall back to names from the request
  const submittedItems = req.submittedItemIds.map(id => allItems.find(i => i.id === id)).filter(Boolean) as EquipmentItem[];
  const submittedNames = submittedItems.length > 0
    ? submittedItems.map(i => i.name)
    : req.submittedItemNames;

  // DM picks the output item — default to first DM library item, or first campaign item
  const pickableItems = dmLib.length > 0 ? [...dmLib, ...campaignLib] : campaignLib;
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
                {submittedNames.length === 0 && req.submittedItemIds.map(id => (
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
          <select value={selectedOutputId} onChange={e => setSelectedOutputId(e.target.value)}
            style={{ display: "block", width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #2a6e2a66", background: "#0d1a0d", color: "#fff", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
            {dmLib.length > 0 && (
              <optgroup label="── My Library (custom items)">
                {dmLib.map(i => <option key={i.id} value={i.id}>{i.name}{i.tier ? ` [${i.tier}]` : ""}</option>)}
              </optgroup>
            )}
            <optgroup label="── Campaign Library">
              {campaignLib.map(i => <option key={i.id} value={i.id}>{i.name}{i.tier ? ` [${i.tier}]` : ""}</option>)}
            </optgroup>
          </select>
          {selectedOutput && <ItemCard item={selectedOutput} role="output" />}
          {!selectedOutput && selectedOutputId && (
            <div style={{ background: "#1a1a0d", border: "1px solid #5a4a0a", borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ margin: 0, color: "#ffcc44", fontSize: 12 }}>⚠ Selected item not found. Choose another from the dropdown.</p>
            </div>
          )}
          {pickableItems.length === 0 && (
            <p style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>No items in library. Add items to My Library before approving.</p>
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
  /** Called by DM panel to grant gold to a seat's primary actor. mode "add" = adjust, "set" = absolute. */
  onSendGold?: (seatId: string, amount: number, mode: "add" | "set") => void;
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
  const [lootOffer, setLootOffer] = useState<{ items: EquipmentItem[]; seatId: string; mode: "boss-mid" | "boss-final" | "merchant" } | null>(null);
  const [convergenceBuilder, setConvergenceBuilder] = useState<{
    seatId: string;
    combos: Array<{ outputItem: EquipmentItem; inputItems: Array<{ id: string; name: string }>; description: string }>;
    message: string;
  } | null>(null);
  const [pendingConvergenceRequests, setPendingConvergenceRequests] = useState<ConvergenceRequest[]>([]);
  const [convergenceApproval, setConvergenceApproval] = useState<ConvergenceRequest | null>(null);
  const [lootMessage, setLootMessage] = useState("");
  const [recentDelivery, setRecentDelivery] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<EquipmentImportResult | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  // Multi-item boss-haul cart: stage several items, then send them all to one seat.
  const [cart, setCart] = useState<EquipmentItem[]>([]);
  const [cartSeatId, setCartSeatId] = useState<string>("");
  // Gold grant panel: pick a seat + amount, add-to or set the actor's gold.
  const [goldPanel, setGoldPanel] = useState<{ seatId: string; amount: string } | null>(null);

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

  function handleSaveItem(item: EquipmentItem) {
    const lib = loadEquipmentLibrary("dm");
    const idx = lib.findIndex(i => i.id === item.id);
    if (idx === -1) lib.push(item); else lib[idx] = item;
    saveEquipmentLibrary(lib, "dm");
    refreshLibrary();
    setEditingItem(null);
  }

  // TODO: remove at 0.9.0 alpha lock — DM-only pre-alpha unlock for campaign item editing
  function handleUnlockItem(item: EquipmentItem) {
    const unlockedCopy: EquipmentItem = { ...item, isLocked: false };
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
    onSendGold(goldPanel.seatId, amt, mode);
    const seatLabel = seats.find(s => s.seatId === goldPanel.seatId)?.label ?? goldPanel.seatId;
    setRecentDelivery(`${mode === "add" ? `Granted ${amt} gp to` : `Set ${seatLabel}'s gold to ${amt} gp —`} ${mode === "add" ? seatLabel : ""}`.trim());
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

  // Listen for convergence requests from players (only when not managed externally by dm-panel)
  useEffect(() => {
    if (!OBR.isAvailable || externalConvergenceRequests !== undefined) return;
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
    setRecentDelivery(`Convergence approved — ${outputItem.name} sent to ${seat?.label ?? req.seatId}. Remove ${req.submittedItemNames.join(" + ")} from their bag.`);
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

  async function handleSendLootOffer() {
    if (!lootOffer || lootOffer.items.length === 0 || !OBR.isAvailable) return;
    const isAll = lootOffer.seatId === "__all__";
    const targetSeats = isAll ? seats.filter(s => s.seatMode !== "viewer") : seats.filter(s => s.seatId === lootOffer.seatId);
    const offerId = `offer-${Date.now().toString(36)}`;
    for (const seat of targetSeats) {
      const offer: LootOffer = {
        type: "fdmc:loot-offer",
        seatId: seat.seatId,
        offerId,
        items: lootOffer.items,
        message: lootMessage.trim() || (lootOffer.mode === "boss-final" ? "Session reward — choose your item." : lootOffer.mode === "merchant" ? "Merchant stock — spend your gold." : "Boss drop — choose one item."),
        mode: lootOffer.mode,
      };
      await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, offer, { destination: "REMOTE" });
    }
    const target = isAll ? "all players" : (seats.find(s => s.seatId === lootOffer.seatId)?.label ?? lootOffer.seatId);
    setRecentDelivery(`${lootOffer.mode === "boss-final" ? "Session reward" : lootOffer.mode === "merchant" ? "Merchant stock" : "Mid-boss loot"} (${lootOffer.items.length} items) sent to ${target}`);
    setLootOffer(null);
    setLootMessage("");
    setTimeout(() => setRecentDelivery(null), 6000);
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
        <h3 style={{ margin: 0 }}>💰 Send Gold</h3>
        <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
          Grant gold to a player who didn't get boss loot. Gold lands on the seat's primary character and shows on their sheet.
        </p>
        <label style={{ fontSize: 12 }}>
          Player seat:
          <select value={goldPanel.seatId} onChange={e => setGoldPanel(g => g ? { ...g, seatId: e.target.value } : g)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            {seats.filter(s => s.seatMode !== "viewer").map(s => <option key={s.seatId} value={s.seatId}>{s.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          Amount (gp):
          <input type="number" inputMode="numeric" value={goldPanel.amount} autoFocus
            onChange={e => setGoldPanel(g => g ? { ...g, amount: e.target.value } : g)}
            placeholder="e.g. 50"
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => handleSendGold("add")}
            title="Add this amount to the character's current gold"
            style={{ flex: 1, padding: "8px", background: "#4a3a1a", border: "1px solid #e0a03055", color: "#e0a030", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            ＋ Add Gold
          </button>
          <button type="button" onClick={() => handleSendGold("set")}
            title="Set the character's gold to exactly this amount"
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
    const seatLabel = lootOffer.seatId === "__all__" ? "All Players" : (seats.find(s => s.seatId === lootOffer.seatId)?.label ?? lootOffer.seatId);
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
          Send to:
          <select value={lootOffer.seatId} onChange={e => setLootOffer(o => o ? { ...o, seatId: e.target.value } : null)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff" }}>
            <option value="__all__">★ All Players</option>
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
      onApprove={async (req, outputItemId) => {
        await handleApproveConvergence(req, outputItemId);
        setConvergenceApproval(null);
      }}
      onDeny={async (req) => {
        if (!OBR.isAvailable) return;
        await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, {
          type: "fdmc:convergence-denied",
          seatId: req.seatId,
          offerId: req.offerId,
          reason: "DM declined the convergence request.",
        }, { destination: "REMOTE" });
        setPendingConvergenceRequests(prev => prev.filter(r => !(r.offerId === req.offerId && r.seatId === req.seatId)));
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
                        setLootOffer(o => o ? { ...o, items: [...o.items, item] } : { items: [item], seatId: "__all__", mode: "boss-mid" });
                      }
                    } else {
                      setLootOffer({ items: [item], seatId: "__all__", mode: "boss-mid" });
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
            {item.isLocked ? (
              /* TODO: remove at 0.9.0 alpha lock */
              <button type="button" onClick={() => handleUnlockItem(item)}
                style={{ fontSize: 10, padding: "2px 7px", background: "transparent", border: "1px solid #5a4a1a", borderRadius: 3, color: "#e07b3988", cursor: "pointer" }}
                title="Unlock for DM editing — creates a custom copy (pre-alpha only)">
                🔓
              </button>
            ) : (
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

  // Render a library section grouped into collapsible per-encounter / per-merchant
  // bands. Untagged items render flat under "Unsorted". A search filter auto-expands
  // every group so matches are never hidden behind a collapsed header.
  function renderGroupedList(items: EquipmentItem[], sectionKey: string) {
    const groups = groupByEncounter(items);
    return groups.map(g => {
      const gid = `${sectionKey}:${g.key}`;
      if (g.key === UNGROUPED_KEY) {
        // Untagged items render directly (no collapse).
        return <div key={gid}>{g.items.map(renderItem)}</div>;
      }
      const expanded = expandedGroups.has(gid) || filterText.trim().length > 0;
      return (
        <div key={gid} style={{ marginBottom: 8 }}>
          <button type="button" onClick={() => toggleGroup(gid)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "7px 10px",
              background: "#161622", border: "1px solid #2a2a3e", borderLeft: "3px solid #e0b34a", borderRadius: 6, cursor: "pointer", color: "#fff" }}
            title={expanded ? "Collapse" : "Expand"}>
            <span style={{ fontSize: 11, color: "#e0b34a", width: 12, flexShrink: 0 }}>{expanded ? "▼" : "▶"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🎁 {g.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#0d0d14", background: "#e0b34a", borderRadius: 8, padding: "1px 7px", flexShrink: 0 }}>{g.items.length}</span>
          </button>
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
            <button type="button" onClick={() => setGoldPanel({ seatId: seats.find(s => s.seatMode !== "viewer")?.seatId ?? "", amount: "" })}
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

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {/* Pending convergence requests — shown only when not managed by the unified approvals panel */}
        {pendingConvergenceRequests.length > 0 && !externalConvergenceRequests && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4caf50", textTransform: "uppercase", letterSpacing: 1 }}>
              ◈ Convergence Requests ({pendingConvergenceRequests.length})
            </p>
            {pendingConvergenceRequests.map(req => {
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
