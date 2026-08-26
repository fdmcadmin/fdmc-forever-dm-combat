/**
 * LAIR ACTIONS — the environment taking a turn, on initiative 20.
 *
 * Christopher: *"we need to build the lair and the summons [...] summon has to come first since
 * the lair builds off of it as a start of combat summon"*, and then: *"what about the lair actions
 * on the gate 3 and act 3 final."*
 *
 * ── ⚠ THEY WERE ALREADY AUTHORED, AND PARKED WITH A REASON ──────────────────────────────────
 *
 * Both fights he names carry their lair actions in `notes`, under a comment that says exactly why:
 *
 *   "LAIR ACTIONS are carried in notes, not as actions. A lair is a SUMMON at initiative 20 and
 *    the summon mechanism is unbuilt — filing them as ordinary actions would read as things the
 *    creature can do on its own turn, which is precisely what they are not."
 *
 * That reasoning was right and the blocker is gone: `summon.ts` exists. This is the field those
 * notes were waiting for.
 *
 *   Gate III · Veil-Torn Dragon    Ground Remembers Wrong · Branches Close · Borrowed Sky
 *   Act 3 final · Thought Harrower Adjacent Elsewhere · Memory of Falling · Wrong Angle
 *
 * ── ⚠ NOT ONE OF THE SIX DEALS DAMAGE, AND THAT IS THE POINT ────────────────────────────────
 *
 * Every option is movement, obscurement or cover. A lair that is priced as DPR would read as free
 * damage the fight does not contain; a lair priced as nothing would miss that it moves the party
 * around a dragon for six rounds. v10 added primitives for precisely this, filed under
 * `terrain_lair_region_or_environment_dependency` and marked "current campaign coverage":
 *
 *   cover_modifier                  "Modify or ignore the applicable cover bonus"   -> Wrong Angle
 *   terrain_portal_or_adjacency_link "Create the authored temporary movement link"  -> Adjacent Elsewhere
 *   roll_modifier_zone              "add flat modifier to attack/save in zone"
 *   alternate_attack_origin         "choose one legal authored origin"
 *
 * So a lair action declares WHICH of those it is, and the pricing follows the workbook rather than
 * a number invented here. An option with no effect anyone can price says so and contributes zero,
 * which is the same contract every other unpriceable mechanic in this app works under.
 */

import type { SummonSpec } from "./summon";

/**
 * What a lair option actually does to the fight. Named for the workbook primitive that prices it,
 * so the mapping is checkable rather than a word this file made up.
 */
export type LairEffect =
  /** `cover_modifier` — cover counts as one step less, or not at all. */
  | "cover"
  /** `terrain_portal_or_adjacency_link` — two spaces become adjacent. */
  | "portal"
  /** Forced movement with a save. Priced through reachability, not damage. */
  | "forced_movement"
  /** Heavily obscured — a visibility zone. */
  | "obscure"
  /** `roll_modifier_zone` — a flat modifier to rolls made in an area. */
  | "zone_modifier"
  /** It deals damage. Rare for a lair, and then it is priced on the lair channel. */
  | "damage";

export type LairOption = {
  name: string;
  /** The printed text, verbatim. The card shows this; nothing parses it. */
  text: string;
  /** Which workbook primitive prices it. Absent = nothing can, and it contributes zero. */
  effect?: LairEffect;
  /** Damage, for the rare option that deals some. */
  damage?: string;
  /** The save it forces — "STR DC 17". */
  save?: string;
  /**
   * A lair that CALLS something. Christopher: *"the lair builds off of it as a start of combat
   * summon."* Same spec a creature action uses; the lair is just another summoner.
   */
  summon?: SummonSpec;
};

export type LairSpec = {
  /**
   * The initiative count it acts on. 20 by convention, and every one of these prints "losing
   * ties" — so it resolves before anything on 20 that rolled it.
   */
  initiative?: number;
  options: LairOption[];
  /**
   * ⚠ THE SAME OPTION CANNOT BE USED ON CONSECUTIVE ROUNDS. Every lair in the campaign prints
   * this, and it is not decoration: with three options and no repeat, a six-round fight fires
   * each roughly twice rather than the best one six times. Pricing the best option every round
   * would overstate the lair by the gap between its strongest and its average.
   */
  noRepeatConsecutive?: boolean;
  /**
   * What the lair brings when the fight starts — the start-of-combat summon. Fires once, before
   * round 1, so its bodies are present from the first turn rather than arriving on initiative 20.
   */
  openingSummon?: SummonSpec;
  /** Why this lair exists here, for the card. */
  note?: string;
};

/**
 * Which options are legal this round, given what fired last round.
 *
 * A lair takes ONE option per round. With `noRepeatConsecutive` the previous one is off the table,
 * which is the rule every campaign lair prints.
 */
export function legalLairOptions(lair: LairSpec, previous: string | undefined): LairOption[] {
  if (!lair.noRepeatConsecutive || !previous) return lair.options;
  const others = lair.options.filter(o => o.name !== previous);
  // A one-option lair cannot alternate with anything; the rule cannot make it silent.
  return others.length > 0 ? others : lair.options;
}

/**
 * The lair's contribution to a round, in damage.
 *
 * ⚠ ZERO IS THE COMMON AND CORRECT ANSWER. Six of the six options in this campaign deal none:
 * they move bodies, obscure ground and change cover. Returning a number for them would invent
 * damage the fight does not contain.
 *
 * What they DO cost the party is reachability and position, which is priced on the party's side
 * through the control model — not here, and not twice.
 */
export function lairDamagePerRound(lair: LairSpec, damageOf: (option: LairOption) => number): number {
  const damaging = lair.options.filter(o => o.effect === "damage" && o.damage);
  if (damaging.length === 0) return 0;
  /**
   * ⚠ THE MEAN OF THE DAMAGING OPTIONS, NOT THE BEST. A lair picks one option a round and cannot
   * repeat it, so a fight sees its options in rotation. Charging the strongest every round is the
   * same error the multiattack alternatives case exists to avoid — see `actionTrace`.
   */
  const total = damaging.reduce((sum, o) => sum + damageOf(o), 0);
  return total / damaging.length;
}

/** Every option a lair carries that nothing can price yet — reported, never guessed at. */
export function unpricedLairOptions(lair: LairSpec): LairOption[] {
  return lair.options.filter(o => !o.effect);
}
