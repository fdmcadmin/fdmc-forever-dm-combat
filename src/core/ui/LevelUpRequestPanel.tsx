import { useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "../seats/seatTypes";
import { ActorEditor } from "./ActorEditor";
import { ActorEditorActionTab } from "./ActorEditorActionTab";
import type { ActorAction } from "../types/tabs";

// ─── Broadcast types ──────────────────────────────────────────────────────────

export type LevelUpRequest = {
  type: "fdmc:level-up-request";
  actorId: string;
  actorName: string;
  seatId: string;
  proposedActor: Actor;   // full proposed actor — DM reviews and applies as override
  requestedAt: string;
};

export type LevelUpResponse = {
  type: "fdmc:level-up-response";
  actorId: string;
  seatId: string;
  approved: boolean;
  reason?: string;
};

export function isLevelUpRequest(msg: unknown): msg is LevelUpRequest {
  return Boolean(
    msg &&
    typeof msg === "object" &&
    (msg as { type?: unknown }).type === "fdmc:level-up-request"
  );
}

export function isLevelUpResponse(msg: unknown): msg is LevelUpResponse {
  return Boolean(
    msg &&
    typeof msg === "object" &&
    (msg as { type?: unknown }).type === "fdmc:level-up-response"
  );
}

// ─── DM approval panel ────────────────────────────────────────────────────────

type LevelUpApprovalPanelProps = {
  request: LevelUpRequest;
  currentActor: Actor | undefined;
  onApprove: (request: LevelUpRequest, finalActor: Actor) => void;
  onReject: (request: LevelUpRequest, reason: string) => void;
};

export function LevelUpApprovalPanel({
  request,
  currentActor,
  onApprove,
  onReject,
}: LevelUpApprovalPanelProps) {
  const [reviewing, setReviewing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [finalActor, setFinalActor] = useState<Actor>(request.proposedActor);

  const proposed = request.proposedActor;
  const current = currentActor;

  // Show a compact diff summary
  const levelChanged = current && proposed.level !== current.level;
  const hpChanged = current && proposed.stats.hp.max !== current.stats.hp.max;
  const acChanged = current && proposed.stats.ac !== current.stats.ac;
  const mainActionsAdded = current
    ? (proposed.tabs.main?.length ?? 0) - (current.tabs.main?.length ?? 0)
    : 0;
  const spellsAdded = current
    ? (proposed.tabs.spells?.length ?? 0) - (current.tabs.spells?.length ?? 0)
    : 0;

  if (reviewing) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0d0d14", zIndex: 100, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#7b68ee" }}>Reviewing {request.actorName}'s level-up proposal</p>
          <button type="button" onClick={() => setReviewing(false)}
            style={{ fontSize: 12, padding: "2px 8px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
            Back
          </button>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <ActorEditor
            actor={finalActor}
            mode="edit-current"
            onSave={(edited) => { setFinalActor(edited); setReviewing(false); }}
            onCancel={() => setReviewing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#1a1a2e", borderRadius: 8, padding: 12, border: "1px solid #7b68ee", marginBottom: 8 }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "#7b68ee", fontWeight: 600 }}>⬆ Level-Up Request</p>
      <p style={{ margin: "0 0 6px", fontSize: 13 }}>
        <strong>{request.actorName}</strong>
        {levelChanged && <span style={{ color: "#7b68ee", marginLeft: 8 }}>Level {current?.level} → {proposed.level}</span>}
      </p>

      {/* Compact diff */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {hpChanged && (
          <span style={{ fontSize: 11, background: "#2a3a2a", padding: "2px 8px", borderRadius: 10, color: "#4caf50" }}>
            HP {current?.stats.hp.max} → {proposed.stats.hp.max}
          </span>
        )}
        {acChanged && (
          <span style={{ fontSize: 11, background: "#2a2a3a", padding: "2px 8px", borderRadius: 10, color: "#7b68ee" }}>
            AC {current?.stats.ac} → {proposed.stats.ac}
          </span>
        )}
        {mainActionsAdded > 0 && (
          <span style={{ fontSize: 11, background: "#3a2a2a", padding: "2px 8px", borderRadius: 10, color: "#e07b39" }}>
            +{mainActionsAdded} action{mainActionsAdded === 1 ? "" : "s"}
          </span>
        )}
        {spellsAdded > 0 && (
          <span style={{ fontSize: 11, background: "#2a2a3a", padding: "2px 8px", borderRadius: 10, color: "#7b68ee" }}>
            +{spellsAdded} spell{spellsAdded === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button
          type="button"
          onClick={() => onApprove(request, finalActor)}
          style={{ flex: 1, padding: "5px 12px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setReviewing(true)}
          style={{ flex: 1, padding: "5px 12px", background: "#2a2a4e", color: "#aaa", border: "1px solid #444", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
        >
          Review &amp; Edit
        </button>
        <button
          type="button"
          onClick={() => setShowReject(v => !v)}
          style={{ flex: 1, padding: "5px 12px", background: "transparent", color: "#ff9999", border: "1px solid #5a1a1a", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
        >
          Reject
        </button>
      </div>

      {showReject && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason (optional)"
            style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}
          />
          <button
            type="button"
            onClick={() => onReject(request, rejectReason)}
            style={{ padding: "4px 10px", background: "#8b0000", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Player level-up request panel ────────────────────────────────────────────
// Renders the full ActorEditor in proposeMode — same experience as DM editing,
// but scoped to the player's own actor and submit goes to DM for approval.

type LevelUpRequestPanelProps = {
  actor: Actor;
  seatId: string;
  onClose: () => void;
};

type SubmitStatus = "idle" | "sending" | "sent";

export function LevelUpRequestPanel({ actor, seatId, onClose }: LevelUpRequestPanelProps) {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  async function handlePropose(proposedActor: Actor) {
    setSubmitStatus("sending");

    const request: LevelUpRequest = {
      type: "fdmc:level-up-request",
      actorId: actor.id,
      actorName: actor.name,
      seatId,
      proposedActor,
      requestedAt: new Date().toISOString(),
    };

    if (OBR.isAvailable) {
      try {
        await OBR.broadcast.sendMessage(
          FDMC_SEAT_BROADCAST_CHANNEL,
          request,
          { destination: "REMOTE" }
        );
      } catch {
        setSubmitStatus("idle");
        return;
      }
    }

    setSubmitStatus("sent");
  }

  if (submitStatus === "sent") {
    return (
      <div style={{ padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <p style={{ color: "#7b68ee", fontSize: 16, margin: 0 }}>Level-up request sent!</p>
        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
          Your DM is reviewing the changes. Your card will update when approved.
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 8, padding: "5px 16px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer", fontSize: 12 }}
        >
          Close
        </button>
      </div>
    );
  }

  // Full editor in proposeMode — player makes all changes, hits "Submit for DM Approval"
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #2a2a3e", background: "#1a1a2e", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#7b68ee", fontWeight: 600 }}>⬆ Level-Up Request</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#666" }}>
          Make your changes below — update HP, AC, add actions or spells — then hit <strong style={{ color: "#aaa" }}>Submit for DM Approval</strong> at the bottom.
        </p>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ActorEditor
          actor={actor}
          mode="edit-current"
          proposeMode
          onSave={(proposedActor) => void handlePropose(proposedActor)}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
