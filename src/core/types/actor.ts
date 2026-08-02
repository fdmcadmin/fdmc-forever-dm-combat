import type { TabActionMap, TabId } from "./tabs";

export type ActorKind = "player" | "companion" | "npc" | "monster" | "boss";

export type HitPoints = {
  current: number;
  /**
   * The character's AUTHORED maximum — the sheet value. Never overwritten by a temporary
   * effect: a spell that raises max HP for a duration writes `bonusMax` instead, so the
   * true max survives and the effect can be removed cleanly when it expires.
   */
  max: number;
  temp?: number;
  /**
   * TEMPORARY increase to maximum HP for a duration — Aid, Heroes' Feast, a bonus from a
   * long-rest ritual. Effective max = `max + bonusMax` (see `effectiveMaxHp`).
   *
   * This is NOT temp HP: temp HP is a separate pool consumed before real HP, while this
   * genuinely raises the ceiling the character can be healed to. Clearing it (effect ends)
   * trims current HP down to the authored max rather than leaving the character over-full.
   */
  bonusMax?: number;
};

/** Max HP a character can currently be healed to — authored max plus any timed bonus. */
export function effectiveMaxHp(hp: HitPoints): number {
  return hp.max + (hp.bonusMax ?? 0);
}

/**
 * HP restored to full, for the HP Tools "Reset" button.
 *
 * MUST be built from an explicit max — the RESOLVED actor's `stats.hp` is the LIVE hp
 * (`resolveActor` sets `hp: live?.hp ?? …`), so the old `setActorHp(id, actor.stats.hp)`
 * wrote the current value back over itself and Reset did nothing at all, mid-damage or at
 * 0 HP. Temp HP is dropped (it is not part of "full"); a timed max-HP bonus is KEPT,
 * since that effect is still running and its ceiling is the real one to fill.
 */
export function fullHeal(hp: HitPoints): HitPoints {
  const max = effectiveMaxHp(hp);
  return { current: max, max: hp.max, temp: 0, bonusMax: hp.bonusMax };
}

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
  /** Explicit override for the displayed ability modifier. When unset, the card
   *  derives it as floor((score - 10) / 2). */
  modifier?: number;
  /** Explicit saving-throw modifier for this ability. When unset, the save equals
   *  the ability modifier (the "no proficiency" default). Set it when the stat block
   *  lists a save that differs from the raw score — proficient PC saves, or summons
   *  like the ranger's Beast of the Land whose saves are keyed to the summoner. */
  save?: number;
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
