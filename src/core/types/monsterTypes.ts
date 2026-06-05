export type MonsterViewMode = "dm" | "player";

export type MonsterVisibilityMode = "hidden" | "label-only" | "condition" | "hp-bar" | "full";

export type MonsterIssueSeverity = "error" | "warning" | "info";

export type MonsterValidationIssue = {
  severity: MonsterIssueSeverity;
  path: string;
  message: string;
};

export type MonsterHp = {
  current: number;
  max: number;
  temp: number;
};

export type MonsterDefense = {
  ac: number | string;
  hp: MonsterHp;
  speed: string;
};

export type MonsterAbilityId = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type MonsterAbility = {
  score?: number;
  modifier?: number;
};

export type MonsterHitRider = {
  trigger?: string;
  condition?: string;
  save?: string;
  failEffect?: string;
  successEffect?: string;
};

export type MonsterSubAttack = {
  id: string;
  name: string;
  attack?: string;
  range?: string;
  damage?: string;
  critDamage?: string;
  damageType?: string;
  description?: string;
  hitRider?: MonsterHitRider;
};

export type MonsterAction = {
  id: string;
  name: string;
  kind: string;
  cost?: string;
  range?: string;
  attack?: string;
  save?: string;
  dc?: number | string;
  damage?: string;
  critDamage?: string;
  critThreshold?: number;
  damageType?: string;
  attackCount?: number;
  attacks?: MonsterSubAttack[];
  hitRider?: MonsterHitRider;
  recharge?: string;
  uses?: string;
  description?: string;
};

export type MonsterTrait = {
  id: string;
  name: string;
  description: string;
};

export type MonsterResource = {
  id: string;
  name: string;
  current?: number;
  max?: number;
  reset?: string;
  note?: string;
};

export type NormalizedMonsterActor = {
  schema: string;
  id: string;
  kind: "monster" | "boss" | "npc";
  name: string;
  subtitle: string;
  campaignModule?: string;
  tags: string[];
  defense: MonsterDefense;
  abilities: Partial<Record<MonsterAbilityId, MonsterAbility>>;
  actions: MonsterAction[];
  bonusActions: MonsterAction[];
  reactions: MonsterAction[];
  legendaryActions: MonsterAction[];
  traits: MonsterTrait[];
  resources: MonsterResource[];
  notes: string[];
  visibility: {
    defaultMode: MonsterVisibilityMode;
    revealedName?: string;
    hiddenName?: string;
  };
};

export type MonsterNormalizeResult = {
  monster: NormalizedMonsterActor;
  issues: MonsterValidationIssue[];
};
