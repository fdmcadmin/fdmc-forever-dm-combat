import { useState } from "react";
import type { Actor } from "../types/actor";
import type { FdmcSeat, FdmcSeatBinding } from "./seatTypes";
import type { SeatAssignmentInput } from "./useSeatSystem";

type SeatAssignmentPanelProps = {
  actors: Actor[];
  seats: Record<string, FdmcSeat>;
  seatBindings: Record<string, FdmcSeatBinding>;
  onAssignSeat: (input: SeatAssignmentInput) => Promise<void>;
  onPushActorsToSeat: (seatId: string) => void;
  onPushActorsToAllSeats: () => void;
  /** DM kicks a player from their seat — clears the binding from room metadata */
  onKickFromSeat?: (seatId: string) => void;
  /** DM removes a seat entirely — clears seat + binding from room metadata */
  onRemoveSeat?: (seatId: string) => Promise<void>;
};

function nextSeatId(seats: Record<string, FdmcSeat>): string {
  const existing = Object.keys(seats)
    .map(id => Number(id.replace("seat-", "")))
    .filter(n => Number.isFinite(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `seat-${next}`;
}

export function SeatAssignmentPanel({
  actors,
  seats,
  seatBindings,
  onAssignSeat,
  onPushActorsToSeat,
  onPushActorsToAllSeats,
  onKickFromSeat,
  onRemoveSeat,
}: SeatAssignmentPanelProps) {
  // Dynamic seat ID list — starts from existing seats, grows with Add Seat
  const [seatIds, setSeatIds] = useState<string[]>(() => {
    const fromRoom = Object.keys(seats).sort();
    return fromRoom.length > 0 ? fromRoom : ["seat-1", "seat-2", "seat-3", "seat-4"];
  });

  const [drafts, setDrafts] = useState<Record<string, { label: string; seatMode: "player" | "viewer"; primaryActorId: string; actorIds: string[] }>>(
    () => Object.fromEntries(seatIds.map(id => [id, {
      label: seats[id]?.label ?? `Player ${id.replace("seat-", "")}`,
      seatMode: seats[id]?.seatMode ?? "player",
      primaryActorId: seats[id]?.primaryActorId ?? "",
      actorIds: seats[id]?.actorIds ?? [],
    }]))
  );
  const [saving, setSaving] = useState<string | null>(null);

  function addSeat() {
    const newId = nextSeatId(Object.fromEntries(seatIds.map(id => [id, {} as FdmcSeat])));
    setSeatIds(current => [...current, newId]);
    setDrafts(current => ({
      ...current,
      [newId]: { label: `Player ${newId.replace("seat-", "")}`, seatMode: "player", primaryActorId: "", actorIds: [] },
    }));
  }

  function removeSeat(seatId: string) {
    setSeatIds(current => current.filter(id => id !== seatId));
    setDrafts(current => {
      const next = { ...current };
      delete next[seatId];
      return next;
    });
  }

  function toggleActor(seatId: string, actorId: string) {
    setDrafts(current => {
      const draft = current[seatId];
      const has = draft.actorIds.includes(actorId);
      const actorIds = has ? draft.actorIds.filter(id => id !== actorId) : [...draft.actorIds, actorId];
      const primaryActorId = draft.primaryActorId && actorIds.includes(draft.primaryActorId)
        ? draft.primaryActorId
        : actorIds[0] ?? "";
      return { ...current, [seatId]: { ...draft, actorIds, primaryActorId } };
    });
  }

  async function saveSeat(seatId: string) {
    const draft = drafts[seatId];
    setSaving(seatId);
    await onAssignSeat({
      seatId,
      label: draft.label || `Player ${seatId.replace("seat-", "")}`,
      seatMode: draft.seatMode ?? "player",
      actorIds: draft.seatMode === "viewer" ? [] : draft.actorIds,
      primaryActorId: draft.seatMode === "viewer" ? "" : (draft.primaryActorId || draft.actorIds[0] || ""),
    });
    setSaving(null);
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Player Seats</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={onPushActorsToAllSeats} style={{ fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}>
            Push All
          </button>
          <button type="button" onClick={addSeat} style={{ fontSize: 11, padding: "3px 10px", background: "#7b68ee", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer" }}>
            + Add Seat
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
          Assign actors to seats. Right-click actors to set primary. Players self-select their seat when they open the app.
        </p>

        {seatIds.map(seatId => {
          const draft = drafts[seatId] ?? { label: "", primaryActorId: "", actorIds: [] };
          const binding = Object.values(seatBindings).find(b => b.seatId === seatId);
          const isSaving = saving === seatId;

          const isViewer = draft.seatMode === "viewer";
          return (
            <div key={seatId} style={{ border: `1px solid ${isViewer ? "#2a3a2a" : "#2a2a3e"}`, borderRadius: 6, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <input
                  type="text"
                  value={draft.label}
                  onChange={e => setDrafts(c => ({ ...c, [seatId]: { ...c[seatId], label: e.target.value } }))}
                  style={{ fontWeight: "bold", background: "transparent", border: "none", borderBottom: "1px solid #555", color: "inherit", fontSize: 13, width: 130 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {/* Player / Viewer mode toggle */}
                  <button
                    type="button"
                    onClick={() => setDrafts(c => ({ ...c, [seatId]: { ...c[seatId], seatMode: isViewer ? "player" : "viewer" } }))}
                    style={{ fontSize: 10, padding: "1px 7px", background: isViewer ? "#1a3a1a" : "transparent", border: `1px solid ${isViewer ? "#4caf5066" : "#444"}`, borderRadius: 3, color: isViewer ? "#4caf50" : "#666", cursor: "pointer" }}
                    title="Toggle player / viewer seat"
                  >
                    {isViewer ? "👁 Viewer" : "Player"}
                  </button>
                  <span style={{ fontSize: 10, color: binding ? "#4caf50" : "#555" }}>
                    {binding ? `● ${binding.viewerSeatKey.slice(0, 8)}` : "○ open"}
                  </span>
                  {/* Kick player from seat — clears binding + seat from room metadata */}
                  {binding && (onKickFromSeat || onRemoveSeat) && (
                    <button type="button"
                      onClick={() => {
                        if (onRemoveSeat) void onRemoveSeat(seatId);
                        else if (onKickFromSeat) onKickFromSeat(seatId);
                        removeSeat(seatId);
                      }}
                      title="Kick player from seat — they return to seat selection"
                      style={{ fontSize: 9, padding: "1px 6px", background: "transparent", border: "1px solid #5a2a00", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}>
                      Kick
                    </button>
                  )}
                  <button type="button" onClick={() => {
                    if (onRemoveSeat) void onRemoveSeat(seatId);
                    removeSeat(seatId);
                  }}
                    style={{ fontSize: 10, padding: "1px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              </div>

              {!isViewer && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {actors.map(actor => {
                  const selected = draft.actorIds.includes(actor.id);
                  const isPrimary = draft.primaryActorId === actor.id;
                  return (
                    <button
                      key={actor.id}
                      type="button"
                      onClick={() => toggleActor(seatId, actor.id)}
                      onContextMenu={e => {
                        e.preventDefault();
                        if (draft.actorIds.includes(actor.id)) {
                          setDrafts(c => ({ ...c, [seatId]: { ...c[seatId], primaryActorId: actor.id } }));
                        }
                      }}
                      style={{
                        padding: "2px 8px", fontSize: 11, borderRadius: 12,
                        border: selected ? "1px solid #7b68ee" : "1px solid #333",
                        background: selected ? (isPrimary ? "#7b68ee44" : "#2a2a3e") : "transparent",
                        color: selected ? "#fff" : "#666", cursor: "pointer",
                      }}
                      title={selected ? (isPrimary ? "Primary ★" : "Right-click to set as primary") : "Click to assign"}
                    >
                      {actor.name}{isPrimary ? " ★" : ""}
                    </button>
                  );
                })}
              </div>
              )}
              {isViewer && (
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4caf5066" }}>
                  Read-only watch seat — no actors assigned
                </p>
              )}

              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => void saveSeat(seatId)} disabled={isSaving}
                  style={{ fontSize: 11, padding: "3px 10px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                  {isSaving ? "Saving…" : "Save"}
                </button>
                {seats[seatId] && !isViewer && (
                  <button type="button" onClick={() => onPushActorsToSeat(seatId)}
                    style={{ fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}>
                    Push
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
