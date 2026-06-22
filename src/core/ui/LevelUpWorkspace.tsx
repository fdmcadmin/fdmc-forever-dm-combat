/**
 * LevelUpWorkspace — full-window level-up experience (opened as its own popout).
 *
 * Two jobs:
 *  1. Author level presets: build the sheet for a target level (L4, L5, …) with the
 *     full ActorEditor and Save it. Presets are hand-built (not auto-progression) and
 *     stored per-actor in the browser via levelPresets.
 *  2. Step through them: submit the next preset (or any preset, or a one-off edit) to
 *     the DM for the normal approval flow.
 *
 * The DM-approval broadcast is identical to the old inline panel; only the surface is
 * bigger and presets are layered on top.
 */

import { useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "../seats/seatTypes";
import type { LevelUpRequest } from "./LevelUpRequestPanel";
import { ActorEditor } from "./ActorEditor";
import {
  loadLevelPresets,
  saveLevelPreset,
  deleteLevelPreset,
  nextLevelPreset,
  type LevelPreset,
} from "../state/levelPresets";

type LevelUpWorkspaceProps = {
  actor: Actor;
  seatId: string;
  seatColor?: string;
  onClose: () => void;
};

type Mode = "list" | "edit";
type EditorIntent = "preset" | "submit";

async function broadcastLevelUpRequest(actor: Actor, seatId: string, proposed: Actor): Promise<boolean> {
  const request: LevelUpRequest = {
    type: "fdmc:level-up-request",
    actorId: actor.id,
    actorName: actor.name,
    seatId,
    proposedActor: proposed,
    requestedAt: new Date().toISOString(),
  };
  if (!OBR.isAvailable) return true; // offline dev — treat as sent
  try {
    await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, request, { destination: "REMOTE" });
    return true;
  } catch {
    return false;
  }
}

export function LevelUpWorkspace({ actor, seatId, seatColor, onClose }: LevelUpWorkspaceProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [editorActor, setEditorActor] = useState<Actor>(actor);
  const [editorIntent, setEditorIntent] = useState<EditorIntent>("preset");
  const [presets, setPresets] = useState<LevelPreset[]>(() => loadLevelPresets(actor.id));
  const [sentLabel, setSentLabel] = useState<string | null>(null);

  const nextStep = nextLevelPreset(actor.id, actor.level);

  function openEditor(seed: Actor, intent: EditorIntent) {
    setEditorActor(seed);
    setEditorIntent(intent);
    setMode("edit");
  }

  function handleEditorSave(edited: Actor) {
    if (editorIntent === "preset") {
      setPresets(saveLevelPreset(actor.id, edited));
      setMode("list");
    } else {
      void broadcastLevelUpRequest(actor, seatId, edited).then(() => {
        setSentLabel(`Level ${edited.level}`);
      });
    }
  }

  async function submitPreset(preset: LevelPreset) {
    await broadcastLevelUpRequest(actor, seatId, preset.actor);
    setSentLabel(`Level ${preset.level}`);
  }

  // ── Sent confirmation ──────────────────────────────────────────────────────
  if (sentLabel) {
    return (
      <div style={{ padding: 28, textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <p style={{ color: "#7b68ee", fontSize: 18, margin: 0 }}>⬆ {sentLabel} sent to your DM</p>
        <p style={{ fontSize: 12, color: "#888", margin: 0, maxWidth: 360 }}>
          Your DM is reviewing the changes. Your card updates when approved. Your saved presets stay
          here so you can keep stepping up next time.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" onClick={() => { setSentLabel(null); setMode("list"); }}
            style={{ padding: "6px 16px", background: "#2a2a4e", border: "1px solid #444", borderRadius: 4, color: "#ddd", cursor: "pointer", fontSize: 12 }}>
            Back to presets
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: "6px 16px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer", fontSize: 12 }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // ── Editor view ────────────────────────────────────────────────────────────
  if (mode === "edit") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", background: "#1a1a2e", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#7b68ee", fontWeight: 600 }}>
            {editorIntent === "preset" ? `Building Level ${editorActor.level} preset` : `Editing ${actor.name} — submit to DM`}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#666" }}>
            {editorIntent === "preset"
              ? "Build the full sheet for this level — HP, AC, actions, spells — then save it. Nothing is sent to the DM yet."
              : "Make your changes, then submit them to the DM for approval."}
          </p>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <ActorEditor
            actor={editorActor}
            mode="edit-current"
            proposeMode
            submitLabel={editorIntent === "preset" ? `Save Level ${editorActor.level} Preset` : "Submit to DM for Approval"}
            onSave={(edited) => handleEditorSave(edited)}
            onCancel={() => setMode("list")}
          />
        </div>
      </div>
    );
  }

  // ── Preset list view ───────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #2a2a3e", background: "#1a1a2e", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: seatColor ?? "#7b68ee" }}>⬆ {actor.name} — Level Up</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888" }}>Currently Level {actor.level}. Build presets ahead of time, then step up when you level.</p>
        </div>
        <button type="button" onClick={onClose}
          style={{ fontSize: 12, padding: "4px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}>
          Close
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Step-up call to action */}
        <div style={{ background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 8, padding: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#aaa", fontWeight: 600 }}>Step up</p>
          {nextStep ? (
            <button type="button" onClick={() => void submitPreset(nextStep)}
              style={{ width: "100%", padding: "10px 12px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Step to Level {nextStep.level} → submit to DM
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              No preset above Level {actor.level} yet. Build your next level below, then come back to step up.
            </p>
          )}
        </div>

        {/* Saved presets */}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#aaa", fontWeight: 600 }}>Saved presets</p>
          {presets.length === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>None yet. Build one below.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {presets.map(p => {
              const isPast = p.level <= actor.level;
              return (
                <div key={p.level} style={{ display: "flex", alignItems: "center", gap: 8, background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 6, padding: "8px 10px", opacity: isPast ? 0.6 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#ddd" }}>Level {p.level}</span>
                    <span style={{ fontSize: 11, color: "#777", marginLeft: 8 }}>
                      HP {p.actor.stats.hp.max} · AC {p.actor.stats.ac}
                      {isPast ? " · at or below current" : ""}
                    </span>
                  </div>
                  <button type="button" onClick={() => openEditor(p.actor, "preset")}
                    style={{ fontSize: 11, padding: "3px 8px", background: "#2a2a4e", border: "1px solid #444", borderRadius: 3, color: "#bbb", cursor: "pointer" }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void submitPreset(p)}
                    style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee22", border: "1px solid #7b68ee55", borderRadius: 3, color: "#9b8bf0", cursor: "pointer" }}>
                    Submit
                  </button>
                  <button type="button" onClick={() => setPresets(deleteLevelPreset(actor.id, p.level))}
                    title="Delete this preset"
                    style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#c77", cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Build / one-off */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #2a2a3e", paddingTop: 14 }}>
          <button type="button" onClick={() => {
            const target = actor.level + 1;
            const existing = presets.find(p => p.level === target);
            openEditor(existing ? existing.actor : { ...actor, level: target }, "preset");
          }}
            style={{ padding: "9px 12px", background: "#2a2a4e", color: "#ddd", border: "1px solid #7b68ee55", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            ＋ Build Level {actor.level + 1} preset
          </button>
          <button type="button" onClick={() => openEditor(actor, "submit")}
            style={{ padding: "7px 12px", background: "transparent", color: "#999", border: "1px solid #333", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            Edit &amp; submit a one-off change now
          </button>
        </div>
      </div>
    </div>
  );
}
