import type { HitPoints } from "../types/actor";

export type HpStatus = "healthy" | "bloodied" | "critical" | "down";

export function getHpStatus(hp: HitPoints): HpStatus {
  if (hp.current <= 0) {
    return "down";
  }

  const ratio = hp.current / hp.max;

  if (ratio <= 0.25) {
    return "critical";
  }

  if (ratio <= 0.5) {
    return "bloodied";
  }

  return "healthy";
}
