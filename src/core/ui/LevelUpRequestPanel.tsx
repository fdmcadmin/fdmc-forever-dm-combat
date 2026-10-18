import { Suspense, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import { FDMC_SEAT_BROADCAST_CHANNEL } from "../seats/seatTypes";
// The editor loads when a level-up is opened, not with every player's window — see runtime-shell/lazyPanels.
import { LazyActorEditor as ActorEditor, PanelLoading } from "../runtime-shell/lazyPanels";
import { recordLevelUpSubmission, type PendingLevelUpStep } from "../state/levelUpOutbox";

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

/**
 * SUBMIT A LEVEL-UP — record it, then send it.
 *
 * ⚠ ONE HELPER, BECAUSE THERE ARE TWO SUBMIT SITES. `LevelUpRequestPanel` and `LevelUpWorkspace`
 * each built this request by hand; the moment one of them learns to save a step and the other
 * does not, a player's work survives from one screen and vanishes from the other — and which
 * screen they used is not something anyone would think to ask about.
 *
 * ⚠ THE RECORD IS WRITTEN FIRST, DELIBERATELY. The failure being fixed is "it reported success
 * and nothing had happened", so the step must not depend on the send: if the broadcast throws,
 * or the tab closes mid-send, the player still has their level-up and a Resubmit button.
 *
 * Returns whether the SEND succeeded. That is not whether anyone HEARD it — only the receipt
 * (`fdmc:level-up-received`) can say that, which is exactly why it exists.
 */
export async function submitLevelUpRequest(
  actor: { id: string; name: string },
  seatId: string,
  proposedActor: Actor,
): Promise<boolean> {
  const request: LevelUpRequest = {
    type: "fdmc:level-up-request",
    actorId: actor.id,
    actorName: actor.name,
    seatId,
    proposedActor,
    requestedAt: new Date().toISOString(),
  };
  recordLevelUpSubmission(request);
  if (!OBR.isAvailable) return true; // offline dev — the step is saved either way
  try {
    await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, request, { destination: "REMOTE" });
    return true;
  } catch {
    return false;
  }
}

/** Send a saved step again, unchanged. The record is re-stamped so "last tried" stays honest. */
export async function resubmitLevelUpStep(step: PendingLevelUpStep): Promise<boolean> {
  recordLevelUpSubmission(step.request);
  if (!OBR.isAvailable) return true;
  try {
    await OBR.broadcast.sendMessage(FDMC_SEAT_BROADCAST_CHANNEL, step.request, { destination: "REMOTE" });
    return true;
  } catch {
    return false;
  }
}

/**
 * A GM window telling the player it has the request.
 *
 * ⚠ THE ONE SIGNAL THE PROTOCOL WAS MISSING. Approval and rejection both came back; RECEIPT
 * never did, so a request sent into a closed GM app looked exactly like one sitting in a queue.
 * The player had no way to tell "waiting on my DM" from "nobody ever heard this", which is the
 * difference between being patient and needing to resubmit.
 *
 * Sent by every surface that RECORDS a request, so a receipt means it is genuinely written down
 * — not merely that some window was awake.
 */
export type LevelUpReceived = {
  type: "fdmc:level-up-received";
  actorId: string;
  seatId: string;
};

export function isLevelUpReceived(msg: unknown): msg is LevelUpReceived {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as { type?: unknown; actorId?: unknown };
  return m.type === "fdmc:level-up-received" && typeof m.actorId === "string";
}

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
          <Suspense fallback={<PanelLoading />}>
            <ActorEditor
              actor={finalActor}
              mode="edit-current"
              onSave={(edited) => { setFinalActor(edited); setReviewing(false); }}
              onCancel={() => setReviewing(false)}
            />
          </Suspense>
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

    // Records the step, then sends — see submitLevelUpRequest.
    const sent = await submitLevelUpRequest(actor, seatId, proposedActor);
    if (!sent) { setSubmitStatus("idle"); return; }
    setSubmitStatus("sent");
  }

  if (submitStatus === "sent") {
    return (
      <div style={{ padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <p style={{ color: "#7b68ee", fontSize: 16, margin: 0 }}>Level-up sent.</p>
        {/**
          * ⚠ IT NO LONGER CLAIMS SOMEONE IS READING IT. This said "Your DM is reviewing the
          * changes" the instant the broadcast left — true only if a GM window happened to be
          * open, and flatly false otherwise, which is the case that sent level-ups into the
          * void. What IS true at this moment is that the step is saved; whether anyone heard it
          * is answered by the receipt, on the card.
          */}
        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
          It is saved on your card until your DM answers it. If they were offline, your card
          will say so and offer a Resubmit — nothing is lost either way.
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
        <Suspense fallback={<PanelLoading />}>
          <ActorEditor
            actor={actor}
            mode="edit-current"
            proposeMode
            onSave={(proposedActor) => void handlePropose(proposedActor)}
            onCancel={onClose}
          />
        </Suspense>
      </div>
    </div>
  );
}
