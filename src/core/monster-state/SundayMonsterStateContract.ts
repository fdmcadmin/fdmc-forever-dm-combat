import type { MonsterAction, MonsterVisibilityMode, NormalizedMonsterActor } from "../types/monsterTypes";

export const SUNDAY_MONSTER_STATE_METADATA_KEY = "fdmc:sunday:monster-runtime:v1";
export const SUNDAY_MONSTER_STATE_BROADCAST = "forever-dm-combat:sunday:monster-runtime:v1";

export type SundayViewerRole = "dm" | "player";

export type SundayMonsterTemplate = {
  templateId: string;
  name: string;
  subtitle: string;
  moduleId: string;
  encounterId: string;
  tags: string[];
  monster: NormalizedMonsterActor;
};

export type SundayMonsterInstance = {
  instanceId: string;
  templateId: string;
  encounterId: string;
  displayName: string;
  monster: NormalizedMonsterActor;
  hp: {
    current: number;
    max: number;
    temp: number;
  };
  visibilityMode: MonsterVisibilityMode;
  revealed: boolean;
  active: boolean;
  actionState: Record<string, unknown>;
};

export type SundayMonsterEncounterSet = {
  encounterId: string;
  label: string;
  sessionLabel: string;
  description: string;
  templateEntries: Array<{ templateId: string; count: number }>;
};

export type SundayMonsterRuntimeState = {
  schema: "fdmc.sunday.monster-runtime.v1";
  updatedAt: string;
  updatedBy: "dm" | "system";
  syncVersion: number;
  selectedEncounterId: string | null;
  activeMonsterInstanceId: string | null;
  templates: SundayMonsterTemplate[];
  encounterSets: SundayMonsterEncounterSet[];
  monsters: SundayMonsterInstance[];
};

export type SundayPlayerSafeMonster = {
  instanceId: string;
  displayName: string;
  name: string;
  subtitle: string;
  encounterId: string;
  active: boolean;
  visibilityMode: MonsterVisibilityMode;
  revealed: boolean;
  ac?: number | string;
  hpPercent: number | null;
  condition: string;
};

export type SundayPlayerSafeSnapshot = {
  activeMonster: SundayPlayerSafeMonster | null;
  monsters: SundayPlayerSafeMonster[];
};

export function cloneSundayMonsterRuntimeState(state: SundayMonsterRuntimeState): SundayMonsterRuntimeState {
  return JSON.parse(JSON.stringify(state)) as SundayMonsterRuntimeState;
}

export function stampSundayMonsterRuntimeState(state: SundayMonsterRuntimeState, updatedBy: "dm" | "system" = "dm"): SundayMonsterRuntimeState {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    updatedBy,
    syncVersion: (state.syncVersion ?? 0) + 1,
  };
}

export function hpPercent(current: number, max: number) {
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
}

export function conditionFromHp(current: number, max: number) {
  if (current <= 0) return "Down";

  const ratio = max > 0 ? current / max : 0;
  if (ratio <= 0.25) return "Critical";
  if (ratio <= 0.5) return "Bloodied";
  if (ratio <= 0.75) return "Wounded";
  return "Healthy";
}

export function makePlayerSafeMonster(instance: SundayMonsterInstance): SundayPlayerSafeMonster | null {
  if (!instance.revealed || instance.visibilityMode === "hidden") {
    return null;
  }

  const showName = true;
  const showAc = instance.visibilityMode === "condition" || instance.visibilityMode === "hp-bar" || instance.visibilityMode === "full";
  const showHpBar = instance.visibilityMode === "hp-bar" || instance.visibilityMode === "full";

  return {
    instanceId: instance.instanceId,
    displayName: showName ? instance.displayName : "Unrevealed creature",
    name: showName ? instance.monster.name : "Unrevealed creature",
    subtitle: showName ? instance.monster.subtitle : "",
    encounterId: instance.encounterId,
    active: instance.active,
    visibilityMode: instance.visibilityMode,
    revealed: instance.revealed,
    ac: showAc ? instance.monster.defense.ac : undefined,
    hpPercent: showHpBar ? hpPercent(instance.hp.current, instance.hp.max) : null,
    condition: conditionFromHp(instance.hp.current, instance.hp.max),
  };
}

export function makePlayerSafeSnapshot(state: SundayMonsterRuntimeState): SundayPlayerSafeSnapshot {
  const monsters = state.monsters
    .map(makePlayerSafeMonster)
    .filter((monster): monster is SundayPlayerSafeMonster => Boolean(monster));

  return {
    activeMonster: monsters.find((monster) => monster.instanceId === state.activeMonsterInstanceId) ?? monsters.find((monster) => monster.active) ?? null,
    monsters,
  };
}

export function getAllDmActions(monster: NormalizedMonsterActor): MonsterAction[] {
  return [
    ...monster.actions,
    ...monster.bonusActions,
    ...monster.reactions,
    ...monster.legendaryActions,
  ];
}

export function updateMonsterHp(
  state: SundayMonsterRuntimeState,
  instanceId: string,
  updater: (current: SundayMonsterInstance["hp"]) => SundayMonsterInstance["hp"]
): SundayMonsterRuntimeState {
  const next = cloneSundayMonsterRuntimeState(state);
  next.monsters = next.monsters.map((monster) => {
    if (monster.instanceId !== instanceId) return monster;
    const updatedHp = updater(monster.hp);
    return {
      ...monster,
      hp: {
        current: Math.max(0, Math.min(updatedHp.current, updatedHp.max)),
        max: Math.max(1, updatedHp.max),
        temp: Math.max(0, updatedHp.temp ?? 0),
      },
    };
  });
  return stampSundayMonsterRuntimeState(next, "dm");
}

export function setActiveMonsterInstance(state: SundayMonsterRuntimeState, instanceId: string): SundayMonsterRuntimeState {
  const next = cloneSundayMonsterRuntimeState(state);
  next.activeMonsterInstanceId = instanceId;
  next.monsters = next.monsters.map((monster) => ({
    ...monster,
    active: monster.instanceId === instanceId,
  }));
  return stampSundayMonsterRuntimeState(next, "dm");
}

export function setMonsterVisibility(
  state: SundayMonsterRuntimeState,
  instanceId: string,
  visibilityMode: MonsterVisibilityMode,
  revealed = true
): SundayMonsterRuntimeState {
  const next = cloneSundayMonsterRuntimeState(state);
  next.monsters = next.monsters.map((monster) => monster.instanceId === instanceId ? {
    ...monster,
    visibilityMode,
    revealed,
  } : monster);
  return stampSundayMonsterRuntimeState(next, "dm");
}
