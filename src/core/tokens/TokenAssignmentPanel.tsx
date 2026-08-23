/**
 * P6 — Token Assignment Panel
 *
 * DM-only. Shows when DM has OBR tokens selected.
 * Lets DM bind selected token to a seat/actor or monster instance.
 * Controls lock state and player move permission.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import {
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
import { getSeatColor, withAlpha, MONSTER_COLOR } from "../seats/seatColors";
import type { MainEncounterMonsterInstance } from "../monsters/runtime/mainMonsterRuntime";
import { TOKEN_MENU_STATUS_KEY, TOKEN_MENU_ERROR_KEY } from "./tokenContextMenu";

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

  // Token context-menu health. The persistent background page registers the right-click menu
  // and writes a "ready"/"unavailable" status flag. If the menu can't register (OBR.contextMenu
  // missing, or the background page never loaded — e.g. a bad manifest key), warn the DM here so
  // they fall back to this panel for token assignment.
  const [menuOk, setMenuOk] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  useEffect(() => {
    if (!OBR.isAvailable) return;
    const check = () => {
      try {
        setMenuOk(window.localStorage.getItem(TOKEN_MENU_STATUS_KEY) === "ready");
        setMenuError(window.localStorage.getItem(TOKEN_MENU_ERROR_KEY) || null);
      }
      catch { setMenuOk(true); setMenuError(null); }
    };
    check();
    // The background page may register a moment after this panel mounts.
    const t = setTimeout(check, 1500);
    const onStorage = (e: StorageEvent) => { if (e.key === TOKEN_MENU_STATUS_KEY || e.key === TOKEN_MENU_ERROR_KEY) check(); };
    window.addEventListener("storage", onStorage);
    return () => { clearTimeout(t); window.removeEventListener("storage", onStorage); };
  }, []);

  const seatList = Object.values(seats).sort((a, b) => a.seatId.localeCompare(b.seatId));

  // Signature of the last selection the form was synced to. The form is ONLY
  // (re)filled when the selection actually changes — a routine status poll must never
  // clobber the DM's in-progress seat / control choices.
  const lastSelectionSigRef = useRef<string>("");

  const refreshSelected = useCallback(async () => {
    const items = await getSelectedItems();
    setSelectedTokens(items.map(item => ({
      item,
      binding: readTokenBinding(item),
      isLocked: item.locked ?? false,
    })));

    // Detect a real selection change (different token set), not just a poll tick.
    const sig = items.map(i => i.id).sort().join(",");
    const selectionChanged = sig !== lastSelectionSigRef.current;
    lastSelectionSigRef.current = sig;
    if (!selectionChanged) return; // leave the form alone while the DM is editing

    // Pre-populate form from the newly-selected token's binding; clear for unbound.
    if (items.length === 1) {
      const b = readTokenBinding(items[0]);
      if (b) {
        setBindingType(b.bindingType);
        setSelectedSeatId(b.seatId ?? "");
        setSelectedActorId(b.actorId ?? "");
        setSelectedInstanceId(b.instanceId ?? "");
        setAllowPlayerMove(b.allowPlayerMove);
      } else {
        // New unbound token — reset form so DM can't accidentally re-apply previous binding
        setBindingType("seat");
        setSelectedSeatId("");
        setSelectedActorId("");
        setSelectedInstanceId("");
        setAllowPlayerMove(false);
      }
    }
  }, []);

  // Refresh immediately when the map selection changes (event-driven, snappy), plus a
  // slow fallback poll to keep the per-token lock indicator current. Neither resets the
  // form unless the selection genuinely changed (guard above).
  useEffect(() => {
    if (!OBR.isAvailable) return;
    void refreshSelected();
    let unsub: (() => void) | undefined;
    try { unsub = OBR.player.onChange(() => void refreshSelected()); } catch { /* poll covers it */ }
    const interval = setInterval(() => void refreshSelected(), 1500);
    return () => { try { unsub?.(); } catch { /* ok */ } clearInterval(interval); };
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
    // Only the seat is required — the actor defaults to the seat's primary character
    // (or is left open if the seat has none yet). This lets a DM bind a token to a seat
    // before a player has even claimed it.
    if (bindingType === "seat" && !selectedSeatId) {
      setStatusMsg("Select a seat before saving.");
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
      const resolvedActorId = selectedActorId || seat?.primaryActorId || seat?.actorIds[0] || "";
      const binding: FdmcTokenBinding = {
        version: 1,
        tableId,
        bindingType,
        boundBy: "gm",
        boundAt: Date.now(),
        allowPlayerMove,
        ...(bindingType === "seat" ? {
          seatId: selectedSeatId,
          actorId: resolvedActorId,
          actorType: "player",
        } : {
          instanceId: selectedInstanceId,
          // Token bindings classify the TOKEN (player / companion / monster / npc), not the
          // creature's D&D type — so every creature type except npc collapses to "monster".
          actorType: monster?.kind === "npc" ? "npc" : "monster",
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Token Assignment</h3>
        <button type="button" onClick={handleLockAll}
          style={{ fontSize: 11, padding: "3px 10px", background: "#3a1a1a", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
          🔒 Lock All
        </button>
      </div>

      {!menuOk && (
        <div style={{ margin: "8px 14px 0", padding: "6px 10px", background: "#2a1a12", border: "1px solid #5a4a1a", borderRadius: 5, fontSize: 11, color: "#e0c98a", lineHeight: 1.4, flexShrink: 0 }}>
          ⚠ Token context menu unavailable — use Assign Token panel.
          {menuError && (
            <div style={{ marginTop: 4, fontSize: 10, color: "#c79b6a", fontFamily: "monospace", wordBreak: "break-word" }}>
              {menuError}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Selected tokens */}
        {selectedTokens.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 24, padding: "0 12px" }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🎯</div>
            <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 6px" }}>
              Click a token on the map
            </p>
            <p style={{ fontSize: 11, color: "#666", margin: 0, lineHeight: 1.5 }}>
              Its assignment options appear here. Assign a token to a <strong style={{ color: "#aaa" }}>seat</strong> (it gets
              that seat's color marker) or to a <strong style={{ color: MONSTER_COLOR }}>monster</strong>, then choose who can move it.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#888" }}>
                {selectedTokens.length} token{selectedTokens.length === 1 ? "" : "s"} selected:
              </p>
              {selectedTokens.map(({ item, binding: b, isLocked }) => {
                const markerColor = b
                  ? (b.bindingType === "seat" ? getSeatColor(b.seatId) : MONSTER_COLOR)
                  : "#3a3a4e";
                return (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "#161622", borderRadius: 4, marginBottom: 4, border: "1px solid #2a2a3e", borderLeft: `3px solid ${markerColor}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span title={b ? "Assigned marker color" : "Unassigned"} style={{ width: 10, height: 10, borderRadius: "50%", background: markerColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#ccc" }}>{item.name || item.id.slice(0, 12)}</span>
                    <span style={{ fontSize: 10, color: "#555", marginLeft: 2 }}>{statusLabel(b, seats, activeMonsters)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: isLocked ? "#ff9999" : "#4caf50" }}>{isLocked ? "🔒" : "🔓"}</span>
                    <button type="button" onClick={() => void handleToggleLock({ item, binding: b, isLocked })}
                      style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#666", cursor: "pointer" }}>
                      {isLocked ? "Unlock" : "Lock"}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Binding type */}
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1 }}>Bind To</p>
              <div style={{ display: "flex", gap: 6 }}>
                {(["seat", "monster"] as const).map(t => {
                  const activeBg = t === "monster" ? MONSTER_COLOR : "#7b68ee";
                  return (
                    <button key={t} type="button" onClick={() => setBindingType(t)}
                      style={{ flex: 1, padding: "5px 0", fontSize: 12, borderRadius: 4, cursor: "pointer", border: "none",
                        background: bindingType === t ? activeBg : "#1a1a2e",
                        color: bindingType === t ? "#fff" : "#666" }}>
                      {t === "seat" ? "Seat / Party Character" : "Monster (GM)"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seat binding */}
            {bindingType === "seat" && (
              <>
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Seat</label>
                  {seatList.filter(s => s.seatMode !== "viewer").length === 0 ? (
                    <p style={{ fontSize: 12, color: "#e0b34a", background: "#2a230d", border: "1px solid #5a4a1a", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
                      No seats yet — open the <strong>Seats</strong> tab and add a seat first, then come back to bind this token.
                    </p>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {selectedSeatId && (
                        <span title="This seat's color — the token marker will match" style={{ width: 14, height: 14, borderRadius: "50%", background: getSeatColor(selectedSeatId), flexShrink: 0, boxShadow: `0 0 0 2px ${withAlpha(getSeatColor(selectedSeatId), 0.3)}` }} />
                      )}
                      <select value={selectedSeatId} onChange={e => setSelectedSeatId(e.target.value)}
                        style={{ flex: 1, padding: "5px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}>
                        <option value="">— Select seat —</option>
                        {seatList.filter(s => s.seatMode !== "viewer").map(s => (
                          <option key={s.seatId} value={s.seatId}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {selectedSeat && selectedSeat.actorIds.length > 0 && (
                  <div>
                    <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>Party Character</label>
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

            {/* Token control mode — who is allowed to move this token */}
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#7b68ee", textTransform: "uppercase", letterSpacing: 1 }}>Token Control</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => setAllowPlayerMove(false)}
                  title="DM-only — token auto-locks so players and viewers cannot move it. DM can still reassign or unlock instantly."
                  style={{ flex: 1, padding: "6px 0", fontSize: 12, borderRadius: 4, cursor: "pointer",
                    border: `1px solid ${!allowPlayerMove ? "#ff9999" : "#333"}`,
                    background: !allowPlayerMove ? "#3a1a1a" : "transparent",
                    color: !allowPlayerMove ? "#ff9999" : "#666" }}>
                  🔒 DM-only
                </button>
                <button type="button" onClick={() => setAllowPlayerMove(true)}
                  title="Seat-controlled — the assigned seat's player may move this token."
                  style={{ flex: 1, padding: "6px 0", fontSize: 12, borderRadius: 4, cursor: "pointer",
                    border: `1px solid ${allowPlayerMove ? "#4caf50" : "#333"}`,
                    background: allowPlayerMove ? "#1a3a1a" : "transparent",
                    color: allowPlayerMove ? "#4caf50" : "#666" }}>
                  👤 Seat can move
                </button>
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 10, color: "#555" }}>
                {allowPlayerMove
                  ? "The seat's player can drag this token. Viewers still cannot."
                  : "Locked for everyone except the DM. This does not change who owns the character."}
              </p>
            </div>

            {/* Save / Clear */}
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ flex: 2, padding: "6px 0", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                {saving ? "Saving…" : "Assign Token"}
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
