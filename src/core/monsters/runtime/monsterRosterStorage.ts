import type { MainEncounterMonsterInstance } from "./mainMonsterRuntime";
import { safeStorage } from "../../utils/safeStorage";

const ROSTER_KEY = "fdmc.dm.monsterRoster.v1";

export function saveMonsterRoster(instances: MainEncounterMonsterInstance[]): void {
  try {
    safeStorage().setItem(ROSTER_KEY, JSON.stringify(instances));
  } catch {
    // Storage blocked — main window still works from React state
  }
}

export function loadMonsterRoster(): MainEncounterMonsterInstance[] {
  try {
    const raw = safeStorage().getItem(ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as MainEncounterMonsterInstance[];
  } catch {
    return [];
  }
}

export function clearMonsterRoster(): void {
  try {
    safeStorage().removeItem(ROSTER_KEY);
  } catch {
    // ok
  }
}

export function getMonsterFromRoster(instanceId: string): MainEncounterMonsterInstance | undefined {
  return loadMonsterRoster().find(m => m.instanceId === instanceId);
}
