import type { DrainTracker } from "./actor";

export type StatusTrackerId = "strDrain" | "lifeDrain";

export type ActorStatusTrackerState = Partial<Record<StatusTrackerId, DrainTracker>>;

export type ActorStatusTrackerMap = Record<string, ActorStatusTrackerState>;

export const statusTrackerLabels: Record<StatusTrackerId, string> = {
  strDrain: "STR Drain",
  lifeDrain: "Life Drain",
};

export function getStatusTrackerLabel(trackerId: StatusTrackerId, tracker?: DrainTracker) {
  return tracker?.label ?? statusTrackerLabels[trackerId];
}
