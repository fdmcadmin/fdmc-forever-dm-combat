import type { MonsterCombatCandidate, MonsterReaderAction } from "../MonsterJconScanner";

export type MainMonsterVisibilityState = "hidden" | "label-only" | "condition" | "hp-bar" | "full";

export type MainMonsterTemplate = {
  templateId: string;
  name: string;
  encounterId?: string;
  encounterLabel?: string;
  stats: {
    kind: "monster" | "npc" | "boss";
    ac: number | string;
    maxHp: number;
    speed: string;
  };
  abilities: { label: string; value: string }[];
  traits: MonsterReaderAction[];
  actions: MonsterReaderAction[];
  reactions: MonsterReaderAction[];
  resources: { id: string; name: string; current?: number; max?: number; reset?: string; note?: string }[];
  notes: string[];
  visibility: {
    defaultState: MainMonsterVisibilityState;
    hiddenName: string;
    revealedName: string;
  };
};

export type MainEncounterMonsterInstance = MonsterCombatCandidate & {
  instanceId: string;
  templateId: string;
  displayName: string;
  hiddenName: string;
  revealedName: string;
  isNameRevealed: boolean;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  status: string;
  visibilityState: MainMonsterVisibilityState;
  templateRef: string;
};

export function isStandardMonsterAction(action: MonsterReaderAction): boolean {
  if (action.kind === "trait" || action.kind === "reaction") {
    return false;
  }

  const economyCost = (action as MonsterReaderAction & { economyCost?: string }).economyCost;
  if (economyCost && economyCost !== "action") {
    return false;
  }

  return action.kind === "action" || action.kind === "attack" || action.kind === "spell";
}

function monsterActionMentionedInText(actionName: string, sourceText: string): boolean {
  const normalizedAction = actionName.trim().toLowerCase();
  const normalizedSource = sourceText.trim().toLowerCase();

  return Boolean(normalizedAction) && normalizedSource.includes(normalizedAction);
}

export function deriveMonsterActionCounter(actions: MonsterReaderAction[]): MonsterCombatCandidate["actionCounter"] {
  const multiattackAction = actions.find(
    (action) => action.name.toLowerCase() === "multiattack" && (action.attackCount ?? 0) > 1,
  );

  if (!multiattackAction?.attackCount) {
    return undefined;
  }

  const multiattackText = `${multiattackAction.name} ${multiattackAction.text ?? ""}`;
  const referencedStandardActions = actions
    .filter((action) => action.name !== multiattackAction.name && isStandardMonsterAction(action))
    .filter((action) => monsterActionMentionedInText(action.name, multiattackText))
    .map((action) => action.name);
  const label = referencedStandardActions.length > 0
    ? `${multiattackAction.name}: ${referencedStandardActions.join(" + ")}`
    : `${multiattackAction.name} x${multiattackAction.attackCount}`;

  return {
    label,
    total: multiattackAction.attackCount,
    remaining: multiattackAction.attackCount,
    sourceActionName: multiattackAction.name,
    actionNames: referencedStandardActions,
  };
}

export const MIRAGE_STALKER_TEMPLATE: MainMonsterTemplate = {
  templateId: "mirage-stalker-act-1-boss",
  name: "Mirage Stalker",
  encounterId: "act1-boss",
  encounterLabel: "Act 1 Boss",
  stats: {
    kind: "boss",
    ac: 14,
    maxHp: 100,
    speed: "50 ft",
  },
  abilities: [
    { label: "STR", value: "19 (+4)" },
    { label: "DEX", value: "14 (+2)" },
    { label: "CON", value: "16 (+3)" },
    { label: "INT", value: "4 (-3)" },
    { label: "WIS", value: "12 (+1)" },
    { label: "CHA", value: "6 (-2)" },
  ],
  traits: [
    {
      name: "Phantom Step",
      kind: "trait",
      text: "When the Stalker moves, it leaves an afterimage. Attack rolls against the Stalker have disadvantage until it takes damage that round. Uses and recharge are tracked by the DM.",
    },
    {
      name: "Mirage Hide",
      kind: "trait",
      text: "The Stalker is difficult to read in broken light and corrupted ruins. Use as encounter fiction/visibility support, not as an automatic rules resolver.",
    },
  ],
  actions: [
    {
      name: "Multiattack",
      kind: "action",
      text: "The Mirage Stalker makes one Phantom Rake attack and one Hollow Stamp attack.",
      attackCount: 2,
    },
    {
      name: "Phantom Rake",
      kind: "attack",
      roll: "1d20 + 6",
      damage: "2d8 + 4 piercing",
      text: "Reach 10 ft. The strike lands a half-second before the creature appears to move.",
    },
    {
      name: "Hollow Stamp",
      kind: "attack",
      roll: "1d20 + 6",
      damage: "2d6 + 4 bludgeoning",
      text: "Reach 5 ft. The impact sounds too hollow for the stone beneath it.",
    },
    {
      name: "Phantom Charge",
      kind: "attack",
      roll: "1d20 + 6",
      damage: "2d8 + 4 piercing",
      save: "DC 14 STR on hit after 20 ft movement; fail: prone + push 10 ft",
      text: "Recharge 5–6. Hit-gated rider only; do not fire rider on click or miss.",
    },
  ],
  reactions: [
    {
      name: "Phantom Lunge",
      kind: "reaction",
      roll: "1d20 + 6",
      damage: "2d6 + 4 bludgeoning",
      text: "When a creature within 10 ft misses because of Phantom Step's afterimage, the Stalker can make one Hollow Stamp attack.",
    },
  ],
  resources: [
    {
      id: "phantom-step-uses",
      name: "Phantom Step",
      current: 2,
      max: 2,
      reset: "encounter",
      note: "DM tracked defensive layer.",
    },
    {
      id: "phantom-charge-recharge",
      name: "Phantom Charge Recharge",
      reset: "start-turn",
      note: "Roll recharge 5–6 at the start of the creature's turn.",
    },
  ],
  notes: [
    "First Main absorption test monster from Monster Cards BUILD 0.3.0c.",
    "Template/source record is separate from encounter instance HP, visibility, and action usage state.",
  ],
  visibility: {
    defaultState: "hp-bar",
    hiddenName: "Unrevealed creature",
    revealedName: "Mirage Stalker",
  },
};

export function makeMonsterInstanceId(templateId: string) {
  return `${templateId}-instance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createEncounterMonsterInstance(template: MainMonsterTemplate, displayName = template.name): MainEncounterMonsterInstance {
  const instanceId = makeMonsterInstanceId(template.templateId);

  return {
    id: instanceId,
    instanceId,
    templateId: template.templateId,
    displayName,
    hiddenName: template.visibility.hiddenName,
    revealedName: template.visibility.revealedName,
    isNameRevealed: false,
    templateRef: template.templateId,
    name: displayName,
    kind: template.stats.kind,
    hp: `${template.stats.maxHp}/${template.stats.maxHp}`,
    currentHp: template.stats.maxHp,
    maxHp: template.stats.maxHp,
    tempHp: 0,
    status: "ready",
    visibilityState: template.visibility.defaultState,
    ac: String(template.stats.ac),
    speed: template.stats.speed,
    sourceFlavor: "FDMC Monster Template",
    abilityScores: template.abilities,
    actions: template.actions,
    reactions: template.reactions,
    traits: template.traits,
    spells: [],
    actionCounter: deriveMonsterActionCounter(template.actions),
    usedActionNames: [],
  };
}

export function makePlayerSafeMonsterLabel(instance: MainEncounterMonsterInstance) {
  if (!instance.isNameRevealed && (instance.visibilityState === "hidden" || instance.visibilityState === "label-only" || instance.visibilityState === "condition" || instance.visibilityState === "hp-bar")) {
    return instance.hiddenName || "Unrevealed creature";
  }

  return instance.revealedName || instance.displayName || instance.name;
}
