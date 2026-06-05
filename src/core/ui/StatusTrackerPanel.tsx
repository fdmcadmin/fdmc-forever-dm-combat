import { useState } from "react";
import type { DrainTracker } from "../types/actor";
import type { ActorStatusTrackerState, StatusTrackerId } from "../types/status";
import { getStatusTrackerLabel } from "../types/status";

type StatusTrackerPanelProps = {
  status: ActorStatusTrackerState;
  onAdjustTracker: (trackerId: StatusTrackerId, delta: number) => void;
  onResetTracker: (trackerId: StatusTrackerId) => void;
  onResetAllStatuses: () => void;
};

function parseAmount(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 1;
  }

  return parsed;
}

function hasTracker(tracker?: DrainTracker) {
  return Boolean(tracker);
}

function trackerDisplay(tracker: DrainTracker) {
  if (typeof tracker.max === "number") {
    return `${tracker.current}/${tracker.max}`;
  }

  return `${tracker.current}`;
}

function StatusTrackerRow({
  trackerId,
  tracker,
  onAdjustTracker,
  onResetTracker,
}: {
  trackerId: StatusTrackerId;
  tracker: DrainTracker;
  onAdjustTracker: (trackerId: StatusTrackerId, delta: number) => void;
  onResetTracker: (trackerId: StatusTrackerId) => void;
}) {
  const [amountText, setAmountText] = useState("1");
  const amount = parseAmount(amountText);
  const label = getStatusTrackerLabel(trackerId, tracker);

  return (
    <div className="status-tracker-row">
      <div>
        <span className="stat-label">{label}</span>
        <strong className="status-value">{trackerDisplay(tracker)}</strong>
      </div>
      <div className="status-controls">
        <input
          aria-label={`${label} amount`}
          className="status-amount-input"
          inputMode="numeric"
          min="1"
          type="number"
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
        />
        <button type="button" onClick={() => onAdjustTracker(trackerId, -amount)}>
          −X
        </button>
        <button type="button" onClick={() => onAdjustTracker(trackerId, amount)}>
          +X
        </button>
        <button type="button" onClick={() => onResetTracker(trackerId)}>
          Clear
        </button>
      </div>
    </div>
  );
}

export function StatusTrackerPanel({
  status,
  onAdjustTracker,
  onResetTracker,
  onResetAllStatuses,
}: StatusTrackerPanelProps) {
  const hasAnyTracker = hasTracker(status.strDrain) || hasTracker(status.lifeDrain);

  if (!hasAnyTracker) {
    return null;
  }

  return (
    <section className="status-tracker-panel" aria-label="Status trackers">
      <div className="status-tracker-header">
        <div>
          <p className="eyebrow">Status</p>
          <h3>Drain Trackers</h3>
        </div>
        <button className="secondary-button compact" type="button" onClick={onResetAllStatuses}>
          Clear Status
        </button>
      </div>
      <p className="status-note">Campaign drain trackers. Use explicit clear controls; Short Rest does not clear STR or Life Drain.</p>
      <div className="status-tracker-grid">
        {status.strDrain && (
          <StatusTrackerRow
            trackerId="strDrain"
            tracker={status.strDrain}
            onAdjustTracker={onAdjustTracker}
            onResetTracker={onResetTracker}
          />
        )}
        {status.lifeDrain && (
          <StatusTrackerRow
            trackerId="lifeDrain"
            tracker={status.lifeDrain}
            onAdjustTracker={onAdjustTracker}
            onResetTracker={onResetTracker}
          />
        )}
      </div>
    </section>
  );
}
