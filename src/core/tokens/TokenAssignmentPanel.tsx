/**
 * P6 — Token Assignment Panel
 *
 * DM-only. Shows when DM has OBR tokens selected.
 * Lets DM bind selected token to a seat/actor or monster instance.
 * Controls lock state and player move permission.
 */

import { useCallback, useEffect, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import {
  FDMC_TOKEN_BINDING_KEY,
  type FdmcTokenBinding,
  readTokenBinding,
  writeTokenBinding,
  clearTokenBinding,
  lockToken,
  unlockToken,
  lockAllTokens,
  getSelectedItems,
} from "./tokenBinding";
import type { FdmcSeat } from "../seats/seatTypes";
import type { MainEncounterMonsterInstance } from "../monsters/runtime/mainMonsterRuntime";

type TokenAssignmentPanelProps = {
  tableId: string;
  seats: Record<string, FdmcSeat>;
  activeMonsters: MainEncounterMonsterInstance[];
};

type TokenState = {
  item: Item;
  binding: FdmcTokenBinding | undefined;
  isLocked: boolean;
};

function statusLabel(binding: FdmcTokenBinding | undefined, seats: Record<string, FdmcSeat>, monsters: MainEncounterMonsterInstance[]): string {
  if (!binding) return "Unbound";
  if (binding.bindingType === "seat") {
    const seat = seats[binding.seatId ?? ""];
    return `Seat: ${seat?.label ?? binding.seatId} — ${binding.actorId ?? "no actor"}`;
  }
  const monster = monsters.find(m => m.instanceId === binding.instanceId);
  return `Monster: ${monster?.revealedName || monster?.displayName || binding.instanceId || "unknown"}`;
}

export function TokenAssignmentPanel({ tableId, seats, activeMonsters }: TokenAssignmentPanelProps) {
  const [selectedTokens, setSelectedTokens] = useState<TokenState[]>([]);
  const [bindingType, setBindingType] = useState<"seat" | "monster">("seat");
  const [selectedSeatId, setSelectedSeatId] = useState<string>("");
  const [selectedActorId, setSelectedActorId] = useState<string>("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [allowPlayerMove, setAllowPlayerMove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const seatList = Object.values(seats).sort((a, b) => a.seatId.localeCompare(b.seatId));

  const refreshSelected = useCallback(async () => {
    const items = await getSelectedItems();
    setSelectedTokens(items.map(item => ({
      item,
      binding: readTokenBinding(item),
      isLocked: item.locked ?? false,
    })));
    // Pre-populate form from first selected token's binding
    if (items.length === 1) {
      const b = readTokenBinding(items[0]);
      if (b) {
        setBindingType(b.bindingType);
        setSelectedSeatId(b.seatId ?? "");
        setSelectedActorId(b.actorId ?? "");
        setSelectedInstanceId(b.instanceId ?? "");
        setAllowPlayerMove(b.allowPlayerMove);
      }
    }
  }, []);

  // Poll selection every 500ms — OBR doesn't have a reliable selection-change event
  useEffect(() => {
    if (!OBR.isAvailable) return;
    void refreshSelected();
    const interval = setInterval(() => void refreshSelected(), 1000);
    return () => clearInterval(interval);
  }, [refreshSelected]);

  // When seat changes, default to first actor in that seat
  useEffect(() => {
    const seat = seats[selectedSeatId];
    if (seat && seat.actorIds.length > 0 && !seat.actorIds.includes(selectedActorId)) {
      setSelectedActorId(seat.primaryActorId || seat.actorIds[0]);
    }
  }, [selectedSeatId, seats, selectedActorId]);

  async function handleSave() {
    if (selectedTokens.length === 0) return;
    if (bindingType === "seat" && (!selectedSeatId || !selectedActorId)) {
      setStatusMsg("Select a seat and actor before saving.");
      return;
    }
    if (bindingType === "monster" && !selectedInstanceId) {
      setStatusMsg("Select a monster instance before saving.");
      return;
    }
    setSaving(true);
    try {
      const seat = seats[selectedSeatId];
      const monster = activeMonsters.find(m => m.instanceId === selectedInstanceId);
      const binding: FdmcTokenBinding = {
        version: 1,
        tableId,
        bindingType,
        boundBy: "gm",
        boundAt: Date.now(),
        allowPlayerMove,
        ...(bindingType === "seat" ? {
          seatId: selectedSeatId,
          actorId: selectedActorId,
          actorType: "player",
        } : {
          instanceId: selectedInstanceId,
          actorType: (monster?.kind as FdmcTokenBinding["actorType"]) ?? "monster",
        }),
      };
      for (const { item } of selectedTokens) {
        await writeTokenBinding(item.id, binding);
        // Lock by default — DM can unlock via allowPlayerMove or Lock/Unlock button
        if (!allowPlayerMove) await lockToken(item.id);
      }
      setStatusMsg(`✓ Bound ${selectedTokens.length} token${selectedTokens.length === 1 ? "" : "s"} — ${statusLabel(binding, seats, activeMonsters)}`);
      void refreshSelected();
    } catch (e) {
      setStatusMsg(`Error: ${String(e)}`);
    }
    setSaving(false);
  }

  async function handleClear() {
    for (const { item } of selectedTokens) {
      await clearTokenBinding(item.id);
    }
    setStatusMsg(`✓ Cleared binding from ${selectedTokens.length} token${selectedTokens.length === 1 ? "" : "s"}`);
    void refreshSelected();
  }

  async function handleToggleLock(token: TokenState) {
    if (token.isLocked) await unlockToken(token.item.id);
    else await lockToken(token.item.id);
    void refreshSelected();
  }

  async function handleLockAll() {
    await lockAllTokens();
    setStatusMsg("✓ All scene tokens locked.");
    void refreshSelected();
  }

  const selectedSeat = seats[selectedSeatId];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Token Assignment</h3>
        <button type="button" onClick={handleLockAll}
          style={{ fontSize: 11, padding: "3px 10px", background: "#3a1a1a", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
          🔒 Lock All
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Selected tokens */}
        {selectedTokens.length === 0 ? (
          <p style={{ fontSize: 12, color: "#555", textAlign: "center", marginTop: 20 }}>
            Select a token on the map to bind it.
          </p>
        ) : (
          <>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#888" }}>
                {selectedTokens.length} token{selectedTokens.length === 1 ? "" : "s"} selected:
              </p>
              {selectedTokens.map(({ item, binding: b, isLocked }) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "#161622", borderRadius: 4, marginBottom: 4, border: "1px solid #2a2a3e" }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#ccc" }}>{item.name || item.id.slice(0, 12)}</span>
                    <span style={{ fontSize: 10, color: "#555", marginLeft: 6 }}>{statusLabel(b, seats, activeMonsters)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: isLocked ? "#ff9999" : "#4caf50" }}>{isLocked ? "🔒" : "🔓"}</span>
                    <button type="button" onClick={() => void handleToggleLock({ item, binding: b, isLocked })}
                      style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#666", cursor: "pointer" }}>
                      {isLocked ? "Unlock" : "Lock"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Binding type */}
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1 }}>Bind To</p>
              <div style={{ display: "flex", gap: 6 }}>
                {(["seat", "monster"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setBindingType(t)}
                    style={{ flex: 1, padding: "5px 0", fontSize: 12, borderRadius: 4, cursor: "pointer", border: "none",
                      background: bindingType === t ? "#7b68ee" : "#1a1a2e",
                      color: bindingType === t ? "#fff" : "#666" }}>
                    {t === "seat" ? "Seat / Actor" : "Monster"}
                  </button>
                ))}
              </div>
            </div>

            {/* Seat binding */}
            {bindingType === "seat" && (
              <>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Seat</label>
                  <select value={selectedSeatId} onChange={e => setSelectedSeatId(e.target.value)}
                    style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}>
                    <option value="">— Select seat —</option>
                    {seatList.filter(s => s.seatMode !== "viewer").map(s => (
                      <option key={s.seatId} value={s.seatId}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {selectedSeat && selectedSeat.actorIds.length > 0 && (
                  <div>
                    <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Actor</label>
                    <select value={selectedActorId} onChange={e => setSelectedActorId(e.target.value)}
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}>
                      {selectedSeat.actorIds.map(id => (
                        <option key={id} value={id}>{id}{id === selectedSeat.primaryActorId ? " ★" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Monster binding */}
            {bindingType === "monster" && (
              <div>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Monster Instance</label>
                {activeMonsters.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#555" }}>No monsters in combat roster.</p>
                ) : (
                  <select value={selectedInstanceId} onChange={e => setSelectedInstanceId(e.target.value)}
                    style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}>
                    <option value="">— Select monster —</option>
                    {activeMonsters.map(m => (
                      <option key={m.instanceId} value={m.instanceId}>
                        {m.revealedName || m.displayName || m.name} ({m.currentHp}/{m.maxHp} HP)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Allow player move */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={allowPlayerMove} onChange={e => setAllowPlayerMove(e.target.checked)}
                style={{ accentColor: "#7b68ee", width: 14, height: 14 }} />
              Allow player to move this token
            </label>

            {/* Save / Clear */}
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ flex: 2, padding: "6px 0", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
                {saving ? "Saving…" : "Save Binding"}
              </button>
              <button type="button" onClick={() => void handleClear()}
                style={{ flex: 1, padding: "6px 0", background: "transparent", color: "#ff9999", border: "1px solid #5a1a1a", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                Clear
              </button>
            </div>
          </>
        )}

        {/* Status */}
        {statusMsg && (
          <div style={{ padding: "6px 10px", background: statusMsg.startsWith("✓") ? "#0d1a0d" : "#1a0a0a", borderRadius: 4, border: `1px solid ${statusMsg.startsWith("✓") ? "#2a6e2a" : "#5a1a1a"}` }}>
            <p style={{ margin: 0, fontSize: 11, color: statusMsg.startsWith("✓") ? "#4caf50" : "#ff9999" }}>{statusMsg}</p>
            <button type="button" onClick={() => setStatusMsg(null)} style={{ fontSize: 10, background: "transparent", border: "none", color: "#444", cursor: "pointer", padding: 0 }}>dismiss</button>
          </div>
        )}

        {/* Quick ref */}
        <div style={{ marginTop: 4, padding: "8px 10px", background: "#0d0d14", borderRadius: 4, border: "1px solid #1a1a2e" }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>How it works</p>
          <p style={{ margin: 0, fontSize: 10, color: "#444", lineHeight: 1.5 }}>
            Binding lives on the token — not room metadata. Deleting a token does not affect actor card access.
            Locked tokens block player movement at the VTT level.
          </p>
        </div>
      </div>
    </div>
  );
}
