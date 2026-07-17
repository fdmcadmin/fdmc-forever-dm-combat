import type { TabActionMap, TabId } from "./tabs";

export type ActorKind = "player" | "companion" | "npc" | "monster" | "boss";

export type HitPoints = {
  current: number;
  max: number;
  temp?: number;
};

export type MovementType = "walk" | "fly" | "swim" | "climb" | "burrow";

export type MovementSpeeds = Partial<Record<MovementType, number | string>>;

export type ActorStats = {
  ac: number;
  hp: HitPoints;
  speed: string | MovementSpeeds;
};

export type AbilityId = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type AbilityScore = {
  score?: number;
  modifier?: number;
};

export type AbilityScores = Partial<Record<AbilityId, AbilityScore>>;

export type ClassFeatureTracker = {
  label: string;
  value: string;
  note?: string;
};

export type PinnedReaction = {
  id: string;
  label: string;
  description?: string;
  logMessage?: string;
  sourceTabId?: TabId;
  sourceActionId?: string;
};

export type BondTiming =
  | "beforeAction"
  | "afterHit"
  | "afterAction"
  | "sameTurnAfterPlayer"
  | "nextTurn";

export type BondState = "ready" | "used" | "cooldown";

export type BondModuleData = {
  name: string;
  state: BondState;
  timing: BondTiming;
  currentEffect: string;
  turnFlow?: string;
  ruleNote?: string;
};

export type DrainTrackerMaxSource = "actorHpMax";
export type DrainTrackerWarningSource = "max";

export type DrainTracker = {
  id?: string;
  label?: string;
  current: number;
  max?: number;
  maxSource?: DrainTrackerMaxSource;
  warningAt?: number;
  warningAtSource?: DrainTrackerWarningSource;
  warningText?: string;
};

export type BrokenChainModuleData = {
  act: number;
  theme: string;
  statBlockStatus: "placeholder" | "confirmed";
  bond?: BondModuleData;
  strDrain?: DrainTracker;
  lifeDrain?: DrainTracker;
  ownerId?: string;
};

export type Actor = {
  id: string;
  kind: ActorKind;
  name: string;
  subtitle: string;
  equipmentSlot?: string;
  race?: string;
  className?: string;
  subclassName?: string;  // e.g. "Battle Master", "Hunter", "Oath of Devotion"
  level: number;
  /** Extra Attack — how many weapon/unarmed attacks a single Attack action grants.
   *  2 for martials at L5, 3 for a Fighter at L11. Spells are never affected: casting
   *  always consumes the whole action regardless of this value. Unset or 1 = one attack.
   *  A per-action `metadata.attackUses` overrides this for that action only. */
  attacksPerAction?: number;
  stats: ActorStats;
  abilityScores?: AbilityScores;
  classFeatureTracker?: ClassFeatureTracker;
  pinnedReactions: PinnedReaction[];
  tabs: TabActionMap;
  moduleData?: BrokenChainModuleData;
};
