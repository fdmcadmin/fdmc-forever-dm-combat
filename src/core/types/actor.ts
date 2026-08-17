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
  /**
   * Proficient in this saving throw — the save becomes modifier + proficiency bonus, and
   * follows both the score and the character's level on its own.
   *
   * This replaces typing the number in. A typed save has to be re-entered on every level-up
   * and after every score change, and a stale one is invisible: a save reads as a plain
   * "+X" with nothing on the sheet to compare it against.
   */
  saveProficient?: boolean;
  /**
   * Explicit saving-throw modifier — the escape hatch for saves that follow neither rule,
   * such as a summon whose saves key off its summoner rather than its own scores. Wins over
   * `saveProficient` when set. Sheets authored before the flag existed carry one of these on
   * every ability; the editor converts them on open (see `inferSaveProficiency`).
   */
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

/**
 * THE OPPORTUNITY ATTACK IS A RULE, NOT ACTOR DATA.
 *
 * Every creature that can make a melee attack has it. Carrying it as per-actor content is why
 * it disappeared: the campaign module declared `defaultPlayerPinnedReactions` but nothing ever
 * imported it, and every authored actor — plus every actor the editor creates — ships
 * `pinnedReactions: []`. So the row rendered empty on all six characters at once.
 *
 * It lives in core because it is a rule of the game rather than campaign content, and it is
 * seeded at RENDER time (`getPinnedReactionShortcuts`) rather than written into actor records,
 * so it reaches code-authored actors, imported actors and brand-new ones with no migration.
 * An actor that pins its own `opportunity-attack` action still wins — the seed is a floor.
 */
export const OPPORTUNITY_ATTACK_REACTION: PinnedReaction = {
  id: "opportunity-attack",
  label: "Opportunity Attack",
  description: "Reaction attack when a creature you can see leaves your reach.",
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
  /**
   * MULTICLASS, as a real structure: Paladin 5 / Sorcerer 1 is level 6.
   *
   * `className` alone could say "Paladin / Sorcerer" but not who had which levels, so every
   * per-class rule had to read total character level and over-count — a Fighter 4 / Wizard 6
   * was drawing 10th-level Fighter weapon masteries. Levels belong to CLASSES; the character's
   * level is their sum, which is the direction the maths actually runs.
   *
   * Absent for a single-class character: `className` + `level` already say everything, and
   * requiring the array would mean migrating every existing sheet to say the same thing twice.
   *
   * `hitDie` is what makes a mixed hit-dice pool expressible — a Paladin 5 / Sorcerer 1 has
   * 5d10 and 1d6, not 6 of anything.
   */
  classes?: { name: string; level: number; hitDie?: string }[];
  /**
   * Character level. With `classes` present this is the SUM of their levels — use
   * `characterLevel(actor)` rather than reading it raw, so the two can never disagree.
   */
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
