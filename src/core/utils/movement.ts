import type { MovementSpeeds } from "../types/actor";

const movementOrder: Array<keyof MovementSpeeds> = ["walk", "fly", "swim", "climb", "burrow"];

function formatMovementValue(value: number | string) {
  if (typeof value === "number") {
    return `${value}`;
  }

  return value;
}

function formatMovementLabel(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMovementSpeed(speed: string | MovementSpeeds) {
  if (typeof speed === "string") {
    return speed;
  }

  const orderedEntries = movementOrder
    .filter((key) => speed[key] !== undefined && speed[key] !== null && speed[key] !== "")
    .map((key) => `${formatMovementLabel(key)} ${formatMovementValue(speed[key] as number | string)}`);

  const customEntries = Object.entries(speed)
    .filter(([key, value]) => !movementOrder.includes(key as keyof MovementSpeeds) && value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${formatMovementLabel(key)} ${formatMovementValue(value as number | string)}`);

  const entries = [...orderedEntries, ...customEntries];

  if (entries.length === 0) {
    return "—";
  }

  return entries.join(" / ");
}
