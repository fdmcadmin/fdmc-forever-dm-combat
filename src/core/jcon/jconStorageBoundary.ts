import type { ActorAction } from "../types/tabs";
import type { MonsterCombatCandidate } from "../monsters/MonsterJconScanner";
import { safeStorage } from "../utils/safeStorage";

export const FDMC_JCON_STORAGE_BOUNDARY_VERSION = "0.5.3.4b";

export const FDMC_PRIVATE_MONSTER_LIBRARY_KEY = "fdmc:main:private:monster-library:v1";
export const FDMC_PRIVATE_EQUIPMENT_LIBRARY_KEY = "fdmc:main:private:equipment-library:v1";
export const FDMC_SESSION_MONSTER_CANDIDATES_KEY = "fdmc:main:session:monster-candidates:v1";
export const FDMC_SESSION_EQUIPMENT_ATTACHMENTS_KEY = "fdmc:main:session:equipment-attachments:v1";
export const FDMC_PUBLIC_MONSTER_SNAPSHOTS_KEY = "fdmc.main.public.monsterSnapshots.v1";
export const FDMC_PUBLIC_EQUIPMENT_SNAPSHOTS_KEY = "fdmc.main.public.equipmentSnapshots.v1";

export type JconStorageBoundary = {
  version: typeof FDMC_JCON_STORAGE_BOUNDARY_VERSION;
  privateLocalKeys: {
    monsterLibrary: typeof FDMC_PRIVATE_MONSTER_LIBRARY_KEY;
    equipmentLibrary: typeof FDMC_PRIVATE_EQUIPMENT_LIBRARY_KEY;
  };
  sessionLocalKeys: {
    monsterCandidates: typeof FDMC_SESSION_MONSTER_CANDIDATES_KEY;
    equipmentAttachments: typeof FDMC_SESSION_EQUIPMENT_ATTACHMENTS_KEY;
  };
  publicRoomKeys: {
    monsterSnapshots: typeof FDMC_PUBLIC_MONSTER_SNAPSHOTS_KEY;
    equipmentSnapshots: typeof FDMC_PUBLIC_EQUIPMENT_SNAPSHOTS_KEY;
  };
  rule: "dm-builder-private-full-records_room-public-small-snapshots_players-read-only";
};

export const FDMC_JCON_STORAGE_BOUNDARY: JconStorageBoundary = {
  version: FDMC_JCON_STORAGE_BOUNDARY_VERSION,
  privateLocalKeys: {
    monsterLibrary: FDMC_PRIVATE_MONSTER_LIBRARY_KEY,
    equipmentLibrary: FDMC_PRIVATE_EQUIPMENT_LIBRARY_KEY,
  },
  sessionLocalKeys: {
    monsterCandidates: FDMC_SESSION_MONSTER_CANDIDATES_KEY,
    equipmentAttachments: FDMC_SESSION_EQUIPMENT_ATTACHMENTS_KEY,
  },
  publicRoomKeys: {
    monsterSnapshots: FDMC_PUBLIC_MONSTER_SNAPSHOTS_KEY,
    equipmentSnapshots: FDMC_PUBLIC_EQUIPMENT_SNAPSHOTS_KEY,
  },
  rule: "dm-builder-private-full-records_room-public-small-snapshots_players-read-only",
};

export type PublicMonsterSnapshot = {
  id: string;
  name: string;
  kind: MonsterCombatCandidate["kind"];
  ac?: string;
  hpState?: string;
  hpPercent?: number;
  speed?: string;
  tags: string[];
  actionNames: string[];
  usedActionNames: string[];
  sourceFlavor?: string;
  updatedAt: string;
};

export type PublicEquipmentSnapshot = {
  id: string;
  actorId: string;
  name: string;
  category?: string;
  hasDefinedUse?: boolean;
  publicDetails?: string;
  attack?: string;
  damage?: string;
  crit?: string;
  range?: string;
  updatedAt: string;
};

function parseHpPercent(hpLabel: string | undefined): { label: string; percent?: number } {
  if (!hpLabel) {
    return { label: "Unknown" };
  }

  const match = hpLabel.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) {
    return { label: "Unknown" };
  }

  const current = Number.parseInt(match[1], 10);
  const max = Number.parseInt(match[2], 10);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return { label: "Unknown" };
  }

  const percent = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  if (current <= 0) {
    return { label: "Defeated", percent };
  }
  if (percent <= 25) {
    return { label: "Near defeat", percent };
  }
  if (percent <= 50) {
    return { label: "Bloodied", percent };
  }
  if (percent <= 75) {
    return { label: "Wounded", percent };
  }
  return { label: "Healthy", percent };
}

export function createPublicMonsterSnapshot(monster: MonsterCombatCandidate): PublicMonsterSnapshot {
  const hpState = parseHpPercent(monster.hp);
  const tags = [monster.kind, monster.sourceFlavor]
    .map((tag) => tag?.replace(/metadata signal|builder import|fdm|jcon/gi, "").trim().toLowerCase())
    .filter((tag): tag is string => Boolean(tag && tag.length <= 28))
    .slice(0, 4);

  return {
    id: monster.id,
    name: monster.name,
    kind: monster.kind,
    ac: monster.ac,
    hpState: hpState.label,
    hpPercent: hpState.percent,
    speed: monster.speed,
    tags,
    actionNames: monster.actions?.map((action) => action.name).filter(Boolean).slice(0, 12) ?? [],
    usedActionNames: monster.usedActionNames ?? [],
    sourceFlavor: monster.sourceFlavor,
    updatedAt: new Date().toISOString(),
  };
}

export function createPublicEquipmentSnapshot(actorId: string, action: ActorAction): PublicEquipmentSnapshot {
  const metadata = action.metadata as {
    attack?: unknown;
    damage?: unknown;
    crit?: unknown;
    range?: unknown;
    details?: unknown;
  } | undefined;

  const details = typeof metadata?.details === "string"
    ? metadata.details
    : typeof action.description === "string"
      ? action.description
      : undefined;

  return {
    id: action.id,
    actorId,
    name: action.label,
    category: action.category,
    hasDefinedUse: action.hasDefinedUse,
    publicDetails: details?.slice(0, 500),
    attack: typeof metadata?.attack === "string" ? metadata.attack : undefined,
    damage: typeof metadata?.damage === "string" ? metadata.damage : undefined,
    crit: typeof metadata?.crit === "string" ? metadata.crit : undefined,
    range: typeof metadata?.range === "string" ? metadata.range : undefined,
    updatedAt: new Date().toISOString(),
  };
}

function readArrayLengthFromLocalStorage(key: string): number | "missing" | "invalid" | "blocked" {
  if (typeof window === "undefined") {
    return "blocked";
  }

  try {
    const raw = safeStorage().getItem(key);
    if (!raw) {
      return "missing";
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : "invalid";
  } catch {
    return "blocked";
  }
}

function formatLocalCount(label: string, key: string): string {
  const count = readArrayLengthFromLocalStorage(key);
  return `${label}:${count}`;
}

export function getPrivateJconStorageSummary(): string {
  return [
    `boundary=${FDMC_JCON_STORAGE_BOUNDARY_VERSION}`,
    formatLocalCount("privateMonsterLibrary", FDMC_PRIVATE_MONSTER_LIBRARY_KEY),
    formatLocalCount("privateEquipmentLibrary", FDMC_PRIVATE_EQUIPMENT_LIBRARY_KEY),
    formatLocalCount("sessionMonsterCandidates", FDMC_SESSION_MONSTER_CANDIDATES_KEY),
    formatLocalCount("sessionEquipmentAttachments", FDMC_SESSION_EQUIPMENT_ATTACHMENTS_KEY),
  ].join(" | ");
}

function readArrayLength(value: unknown): number | "missing" | "invalid" {
  if (value === undefined || value === null) {
    return "missing";
  }
  return Array.isArray(value) ? value.length : "invalid";
}

export async function getRoomJconStorageSummary(
  readRoomMetadata: () => Promise<Record<string, unknown> | undefined>,
): Promise<string> {
  try {
    const metadata = await readRoomMetadata();
    if (!metadata) {
      return "roomMetadata:missing";
    }

    return [
      `publicMonsterSnapshots:${readArrayLength(metadata[FDMC_PUBLIC_MONSTER_SNAPSHOTS_KEY])}`,
      `publicEquipmentSnapshots:${readArrayLength(metadata[FDMC_PUBLIC_EQUIPMENT_SNAPSHOTS_KEY])}`,
    ].join(" | ");
  } catch (error) {
    return `roomMetadata:error:${error instanceof Error ? error.message : String(error)}`;
  }
}
