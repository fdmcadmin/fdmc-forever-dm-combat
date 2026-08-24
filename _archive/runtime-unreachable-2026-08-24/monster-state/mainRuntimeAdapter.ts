import type { MonsterVisibilityMode, NormalizedMonsterActor } from "../types/monsterTypes";

export type MainMonsterRuntimeView = "dm" | "player" | "setup";

export type MainMonsterRuntimeEnvelope = {
  schema: "fdmc.main.monster-runtime-handoff.v1";
  producedBy: "monster-cards";
  build: string;
  purpose: "main-runtime-absorption";
  activeMonster: NormalizedMonsterActor;
  dmRuntime: ReturnType<typeof makeDmRuntimeMonster>;
  playerRuntime: ReturnType<typeof makePlayerSafeMonster>;
  setupRuntime: ReturnType<typeof makeSetupMonsterSlot>;
  rules: {
    oneActiveMonster: string;
    playerSafeFilter: string;
    builderBoundary: string;
    futureLibraryBoundary: string;
  };
};

export function makeDmRuntimeMonster(monster: NormalizedMonsterActor) {
  return {
    view: "dm" as const,
    id: monster.id,
    name: monster.name,
    subtitle: monster.subtitle,
    campaignModule: monster.campaignModule,
    tags: monster.tags,
    defense: monster.defense,
    abilities: monster.abilities,
    actions: monster.actions,
    bonusActions: monster.bonusActions,
    reactions: monster.reactions,
    legendaryActions: monster.legendaryActions,
    traits: monster.traits,
    resources: monster.resources,
    notes: monster.notes,
    visibility: monster.visibility,
    permissions: {
      exactHp: true,
      hpControls: true,
      actionControls: true,
      hiddenMetadata: true,
      warnings: true,
    },
  };
}

function getHpBand(current: number, max: number) {
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return "unknown";
  }

  const ratio = current / max;
  if (ratio <= 0) return "down";
  if (ratio <= 0.25) return "bloodied-critical";
  if (ratio <= 0.5) return "wounded";
  if (ratio <= 0.75) return "hurt";
  return "healthy";
}

export function makePlayerSafeMonster(monster: NormalizedMonsterActor, visibilityMode: MonsterVisibilityMode = monster.visibility.defaultMode) {
  const hp = monster.defense.hp;
  const hpRatio = hp.max > 0 ? Math.max(0, Math.min(1, hp.current / hp.max)) : null;
  const revealedName = monster.visibility.revealedName || monster.name;
  const hiddenName = monster.visibility.hiddenName || "Unrevealed creature";
  const showName = visibilityMode !== "hidden";
  const showAc = visibilityMode === "full" || visibilityMode === "condition" || visibilityMode === "hp-bar";
  const showHpBar = visibilityMode === "hp-bar" || visibilityMode === "full";
  const showCondition = visibilityMode === "condition" || visibilityMode === "hp-bar" || visibilityMode === "full";

  return {
    view: "player" as const,
    id: monster.id,
    name: showName ? revealedName : hiddenName,
    subtitle: showName ? monster.subtitle : "",
    campaignModule: monster.campaignModule,
    visibleTags: monster.tags.filter((tag) => !/boss|hidden|dm|internal|cr|challenge/i.test(tag)),
    ac: showAc ? monster.defense.ac : undefined,
    speed: undefined,
    hp: {
      mode: visibilityMode,
      ratio: showHpBar ? hpRatio : null,
      condition: showCondition ? getHpBand(hp.current, hp.max) : undefined,
      current: undefined,
      max: undefined,
      temp: undefined,
    },
    actions: [],
    visibleActionLog: true,
    permissions: {
      exactHp: false,
      hpControls: false,
      actionControls: false,
      hiddenMetadata: false,
      warnings: false,
      builderTools: false,
    },
  };
}

export function makeSetupMonsterSlot(monster: NormalizedMonsterActor) {
  return {
    view: "setup" as const,
    slotType: "main-encounter-monster-slot",
    id: monster.id,
    name: monster.name,
    subtitle: monster.subtitle,
    campaignModule: monster.campaignModule,
    tags: monster.tags,
    summary: {
      ac: monster.defense.ac,
      hpMax: monster.defense.hp.max,
      speed: monster.defense.speed,
      actionCount: monster.actions.length + monster.bonusActions.length + monster.reactions.length + monster.legendaryActions.length,
      traitCount: monster.traits.length,
      resourceCount: monster.resources.length,
    },
    sourceOptions: ["module-dropdown", "native-jcon-import"],
    attachTargets: ["encounter", "token", "combat-tracker"],
  };
}

export function makeMainMonsterRuntimeEnvelope(monster: NormalizedMonsterActor, visibilityMode: MonsterVisibilityMode = monster.visibility.defaultMode): MainMonsterRuntimeEnvelope {
  return {
    schema: "fdmc.main.monster-runtime-handoff.v1",
    producedBy: "monster-cards",
    build: "Monster Cards BUILD 0.3.0j",
    purpose: "main-runtime-absorption",
    activeMonster: monster,
    dmRuntime: makeDmRuntimeMonster(monster),
    playerRuntime: makePlayerSafeMonster(monster, visibilityMode),
    setupRuntime: makeSetupMonsterSlot(monster),
    rules: {
      oneActiveMonster: "Main should keep one activeMonster source and render setup, DM, Player-safe, and export views from that same object.",
      playerSafeFilter: "Player view is a filter over activeMonster. It must never use a separate sample/default monster or expose exact HP.",
      builderBoundary: "Monster Cards can prototype creation. Main absorbs runtime/import/module selection. Dev-only estimator shortcuts do not move into Beta/player runtime.",
      futureLibraryBoundary: "Saved native monster libraries and The Broken Chain dropdowns are future Main/module data features after this runtime contract is absorbed.",
    },
  };
}
