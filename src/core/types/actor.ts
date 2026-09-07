import type { BondAssignment } from "./bond";
import type { TabActionMap, TabId } from "./tabs";
import type { DamageResponse } from "../encounter-band/damageResponsePricing";

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
  /**
   * @deprecated The pre-v13 bond: one flat `currentEffect` string with no stages and no paths.
   * Read only as a fallback so an actor imported before the ladder existed still shows something.
   * New assignments go to `bondAssignment`.
   */
  bond?: BondModuleData;
  /**
   * THE CHARACTER'S v13 BOND — which of the fourteen, and the permanent path once chosen.
   *
   * The stage is NOT stored: it is `bondStageForLevel(character level)` gated by campaign
   * milestones, because bonds scale on level like cantrips (3/6/9/13) and a stored stage would
   * be a second source of truth. See `core/rules/bondProgress.ts`.
   */
  bondAssignment?: BondAssignment;
  /**
   * A COMPANION'S VIEW OF ITS OWNER'S BOND, stamped at the hydration boundary.
   *
   * The pack bond is `actor: "companion"` — Faelar swings it, Lyrielle chooses it. The choice
   * lives on HER sheet, so the companion's card had no way to see which path was taken and the
   * Metamorphosis rider never reached the attack that it modifies. Christopher: *"the bonded
   * strike on faelar's sheet is missing the rider for meta."*
   *
   * Stamped rather than looked up so the rule stays where the other owner-derived values already
   * are (`resolveActor`), and so every surface downstream — card, popout, tracker — sees one
   * answer. It is derived state: never authored, never written back.
   */
  ownerBond?: {
    /** Absent when the owner's bond is authored on their card rather than assigned. */
    assignment?: BondAssignment;
    /**
     * The owner's authored bond-row labels, so a companion-performed bond that writes no
     * assignment is still IDENTIFIABLE downstream. It names the template; it cannot name the
     * chosen path, which only an assignment records.
     */
    cardBondLabels?: string[];
    /** The OWNER's level — the bond's stage is derived from it, not from the beast's. */
    ownerLevel?: number;
    milestones?: string[];
  };
  /**
   * Campaign milestones this party has earned — the ids raised when a gated encounter ends.
   *
   * Held per actor for now because that is where module data lives; every character in one party
   * carries the same set. A party-level store is the right home eventually, and moving it is a
   * data migration rather than a rule change.
   */
  milestones?: string[];
  strDrain?: DrainTracker;
  lifeDrain?: DrainTracker;
  ownerId?: string;
};

export type Actor = {
  id: string;
  /**
   * PROFICIENCY BONUS, WHEN IT IS NOT THIS ACTOR'S OWN.
   *
   * Christopher, 2026-09-02: *"the PB it is reading for the attack, the save and checks are all
   * suppose to come from Lyrielle"* — the owner of that specific companion.
   *
   * A Primal Companion / Beast Master beast uses its RANGER'S proficiency, not a bonus derived
   * from its own level, and every number on its card follows from that: attack bonus, save DCs,
   * skill checks. `buildFormulaVarMap` derived `getProficiencyBonus(actor.level)`, so Faelar
   * was proficient at her own level and quietly disagreed with her owner.
   *
   * ⚠ STAMPED, NOT AUTHORED. `resolveActor` writes this for a companion by reading its owner
   * through the same override layer everything else resolves through; nothing hand-enters it.
   * Absent on an ordinary character, whose own level is the right source.
   *
   * This is the player-side twin of `creatureProficiencyBonus`, which already prefers an
   * explicit bonus over one derived from CR — same rule, same reason.
   */
  proficiencyBonus?: number;
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
  classes?: {
    name: string;
    level: number;
    hitDie?: string;
    /**
     * Spellcasting ability for THIS class. Normally derived from the class name; set it only
     * when the character breaks the default — a Hexblade casting off CHA, or a homebrew class
     * the table invented that no lookup could know about.
     */
    castingAbility?: "str" | "dex" | "con" | "int" | "wis" | "cha";
  }[];
  /**
   * Character level. With `classes` present this is the SUM of their levels — use
   * `characterLevel(actor)` rather than reading it raw, so the two can never disagree.
   */
  level: number;
  /**
   * Challenge Rating, for a monster. The creature-side counterpart of `level`: it drives the
   * PROFICIENCY BONUS used by save proficiencies, and the two tables step identically (CR 0–4 and
   * levels 1–4 are both +2, and so on), so the same helper serves both.
   *
   * Kept SEPARATE from `level` rather than overloading it — a monster does not have a character
   * level, and writing its CR into that field would quietly feed every other level-driven rule.
   */
  cr?: number;
  /** Extra Attack — how many weapon/unarmed attacks a single Attack action grants.
   *  2 for martials at L5, 3 for a Fighter at L11. Spells are never affected: casting
   *  always consumes the whole action regardless of this value. Unset or 1 = one attack.
   *  A per-action `metadata.attackUses` overrides this for that action only. */
  attacksPerAction?: number;
  /**
   * DAMAGE TYPES THIS CHARACTER RESISTS, IGNORES OR TAKES DOUBLE FROM.
   *
   * ⚠ THE APP HAD NOWHERE TO PUT THIS, WHICH IS WHY PARTY MITIGATION WAS NEVER PRICED. Creatures
   * have carried `stats.defenses` since the monster reader existed, and the checker prices them
   * against the party's own damage mix. The party side had no field at all — Ash's *"Resistance to
   * Necrotic and Radiant"* and Ripsnarl's Rage resistance to bludgeoning, piercing and slashing
   * existed only as English inside a feature's description, and reading a mechanic out of prose is
   * the one thing this codebase does not do (see `partyDamageMix`, `never infer data from prose`).
   *
   * So it is a STATED field, entered the same way a creature's is, and priced by the same
   * `priceDamageResponses` the creature side uses — one model, pointed the other way.
   *
   * ⚠ CONDITIONAL RESISTANCE IS NOT UNCONDITIONAL. Rage's B/P/S resistance applies only while
   * raging, which is a resource with a duration; entering it here prices it as if it were always
   * on. `qualifier` is where that is said, and `partyMitigationFromActors` reports every
   * qualifier it could not evaluate rather than quietly pricing the upper bound as certain.
   */
  damageResponses?: readonly DamageResponse[];
  stats: ActorStats;
  abilityScores?: AbilityScores;
  classFeatureTracker?: ClassFeatureTracker;
  pinnedReactions: PinnedReaction[];
  tabs: TabActionMap;
  moduleData?: BrokenChainModuleData;
};
