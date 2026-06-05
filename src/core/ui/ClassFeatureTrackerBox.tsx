import type { ClassFeatureTracker } from "../types/actor";

export function ClassFeatureTrackerBox({ tracker }: { tracker?: ClassFeatureTracker }) {
  return (
    <div className="stat-box class-feature-box">
      <span className="stat-label">Class Feature</span>
      <span className="stat-value class-feature-value">{tracker?.label ?? "Tracker"}</span>
      <span className="class-feature-detail">{tracker?.value ?? "Track on sheet"}</span>
      {tracker?.note && <span className="class-feature-note">{tracker.note}</span>}
    </div>
  );
}
