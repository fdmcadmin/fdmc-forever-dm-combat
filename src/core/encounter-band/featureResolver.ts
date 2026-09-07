/**
 * FEATURE RESOLUTION — v3 App Contract rows 11, 12 and 14 (all marked REQUIRED).
 *
 *   feature_resolution  "Calculate from the printed feature first. Resolve named spells only
 *                        when a stat block abbreviates them; printed dice/averages override a
 *                        library profile."
 *   spell_cast_level    "A spell cast with a stated 7th-level (or other) slot is priced at that
 *                        exact cast level. It must never be silently priced at a lower tier."
 *   unknown_mechanic    "If timing, target count, action cost, or damage is not readable, flag
 *                        NEEDS DM INPUT or ESTIMATED. Do not use a hidden CR-band substitute."
 *
 * The order of precedence is the whole design, and it runs printed-first:
 *
 *   1. PRINTED WINS.  A damage expression on the feature is the answer. The library is not
 *      consulted, even for a spell the app knows perfectly well.
 *   2. NAMED SPELL, only if the block ABBREVIATED it — a spell name and no dice. Resolved from
 *      the versioned profile AT ITS STATED CAST LEVEL.
 *   3. OTHERWISE, SAY SO.  `NEEDS_DM_INPUT` or `ESTIMATED` with the reason recorded. Never a
 *      CR-band or tier substitute — the contract calls that out twice, because a silent
 *      substitute is indistinguishable from a real answer once it reaches a total.
 */

import type { MonsterRider } from "../monsters/monsterRider";
import { spellProfile, type SpellProfile, type SrdVersion } from "./compactImport";
import { aoeTargetsForParty } from "./parseCreature";
import { conditionsImposedBy, applySwing, combineSwings, conditionEffect, pHitVsProne, withAdvantage, withDisadvantage, type RollSwing } from "./controlPricing";
import { reachOfFeature } from "./reachability";
import type { SaveAbility } from "./partyDefenceCurve";
import { damageExpressionAverage } from "./damageExpression";

/** How a feature's damage was arrived at — carried all the way to the trace. */
export type DamageMethod =
  | "printed"            // read off the entered stat block
  | "named_spell"        // resolved from the versioned profile at its stated cast level
  | "needs_dm_input"     // unreadable; the DM must supply it
  | "estimated";         // resolvable in shape but not in value

export type ResolutionFlag = "NEEDS DM INPUT" | "ESTIMATED";

export type FeatureAssumption = {
  feature: string;
  flag: ResolutionFlag;
  /** What could not be read — timing, target count, action cost, or damage. */
  field: "timing" | "targets" | "action_cost" | "damage" | "cast_level";
  detail: string;
};

export type ResolvedFeature = {
  name: string;
  method: DamageMethod;
  /** Expected damage for ONE use, before hit/save probability and target count. */
  rawAverage: number;
  /** The level the spell was actually cast at, when one applies. */
  castLevel: number | null;
  /** A component that resolves on a later round, kept OUT of cast-round damage. */
  delayedAverage: number;
  notes: string[];
  assumptions: FeatureAssumption[];
};

/** The fields the parser is contractually required to read off a feature. */
export type ParsedFeature = {
  name: string;
  /** From the SECTION HEADING, never inferred from the word "Recharge". */
  /**
   * ⚠ `free` IS FOR AN EFFECT THAT COSTS NOTHING BUT IS NOT A TRAIT. A creature that burns
   * everything near it at the start of its turn spends no Action, no Bonus Action and no
   * Reaction — but it DOES deal damage every round, which a `trait` never does (traits are
   * skipped by the scheduler entirely). Without this channel the only way to make such a thing
   * count was to inflate the Multiattack budget, which is exactly the workaround this exists to
   * retire. Christopher: *"this also goes for each monster that has a start of turn 1/turn."*
   */
  activationType?: "action" | "bonus_action" | "reaction" | "legendary_action" | "lair_action" | "free" | "trait";
  damage?: string;
  attackBonus?: number;
  saveDc?: number;
  /** Printed success damage. Never assumed to be half unless the block says half. */
  successDamage?: string;
  /**
   * WHICH save the target rolls. v7's targeting rule: *"Use the matching ability save average."*
   * A flat bonus prices an INT save like a DEX save; the party is far worse at one than the other.
   */
  saveAbility?: SaveAbility;
  /**
   * An AREA effect with no printed target count — a cone, a radius, "each creature within X".
   * Priced against the party the checker is running (half of it), not counted as one target.
   */
  isArea?: boolean;
  targets?: number;
  /**
   * PRINTED melee reach, in feet. Never inferred from creature size — the v7 reach reference is
   * explicit that size is occupied space, not reach.
   */
  reachFt?: number;
  /** PRINTED range for a ranged attack, spell, aura or save effect, in feet. */
  rangeFt?: number;
  /**
   * Conditions this feature imposes on its target. Authored beats prose; the parser falls back to
   * reading the action text so existing library creatures still price.
   */
  conditions?: string[];
  /** Forced movement in feet: positive pushes away, negative pulls closer. */
  forcedMovementFt?: number;
  recharge?: string;
  uses?: number;
  resourcePool?: string;
  timing?: string;
  /** A recognised spell this feature casts. */
  spellName?: string;
  /** The slot level it is cast with. THIS is what the spell is priced at. */
  spellSlotLevel?: number;
  /** Authored as unusable in this encounter. Never scheduled, and always stated. */
  gated?: boolean;
  /** Printed as taking the place of a routine attack — competes for ONE Multiattack slot. */
  replacesRoutineSlot?: boolean;
  /**
   * How many Multiattack slots this attack takes, when the block STATES a split.
   *
   * ⚠ ONLY WHEN IT IS AUTHORED. Left unset, the routine keeps the D&D convention the trace has
   * always used: the distinct attacks in descending order, then the last one repeated to fill —
   * which is exactly the Veil-Torn Dragon's bite-claw-claw. That convention is right for most
   * blocks and must not change.
   *
   * The Breaker is the first block that says otherwise: *"the Breaker makes four attacks: two
   * Grasping Limb attacks and two Heavy Blow attacks."* Under the convention that reads as one
   * Heavy Blow and three Grasping Limbs — the weaker attack three times, which is neither what
   * the block says nor what the creature would choose.
   */
  routineSlots?: number;
  /**
   * Extra damage this action carries on a hit, as authored facts rather than dice folded into the
   * damage string. See `monsterRider.ts` — cadence is what makes a rider priceable.
   */
  riders?: readonly MonsterRider[];
  text?: string;
};

/**
 * How much of a feature's offence happens inside 5 ft.
 *
 * An explicit party melee share wins. Otherwise it is read from the action itself: a 5-ft reach
 * is entirely melee, anything longer is entirely not. That is the honest reading of a single
 * action — the weighted blend belongs to a whole party's attack mix, which the caller supplies.
 */
function meleeShareOf(feature: ParsedFeature, target: { meleeShare?: number }): number {
  if (typeof target.meleeShare === "number") return Math.min(1, Math.max(0, target.meleeShare));
  return reachOfFeature(feature) <= 5 ? 1 : 0;
}

/**
 * Damage for a spell profile at a GIVEN CAST LEVEL.
 *
 * ⚠ NEVER DOWNGRADES. If a block casts Fireball with a 7th-level slot, this returns the
 * 7th-level value — base damage plus `upcast` for every level above the spell's own base.
 * Pricing it at 3rd because that is Fireball's base level is the exact failure row 12 forbids.
 *
 * A `delayed` component (Acid Arrow's end-of-next-turn tick) is returned separately so it is
 * never folded into the cast round.
 */
export function spellDamageAtCastLevel(
  profile: SpellProfile, castLevel: number,
): { immediate: number; delayed: number } {
  const baseLevel = profile.base_level ?? profile.level ?? castLevel;
  const levelsAbove = Math.max(0, castLevel - baseLevel);

  if (profile.components?.length) {
    let immediate = 0, delayed = 0;
    for (const c of profile.components) {
      const value = Number(c.raw ?? 0) + levelsAbove * Number(c.upcast ?? 0);
      if (c.delayed) delayed += value; else immediate += value;
    }
    return { immediate, delayed };
  }
  return {
    immediate: Number(profile.raw ?? 0) + levelsAbove * Number(profile.upcast ?? 0),
    delayed: 0,
  };
}

/**
 * Resolve one feature into expected damage for a single use, with its provenance.
 *
 * Nothing here guesses. Every path either produces a number with a stated method, or an
 * assumption the DM has to answer.
 */
export function resolveFeature(
  feature: ParsedFeature,
  options: { srdVersion?: SrdVersion } = {},
): ResolvedFeature {
  const notes: string[] = [];
  const assumptions: FeatureAssumption[] = [];
  const name = feature.name || "unnamed feature";

  // ── 1. PRINTED WINS ────────────────────────────────────────────────────────
  const printed = damageExpressionAverage(feature.damage);
  if (printed > 0) {
    if (feature.spellName) {
      notes.push(`Printed damage overrides the ${feature.spellName} library profile.`);
    }
    return {
      name, method: "printed", rawAverage: printed,
      castLevel: feature.spellSlotLevel ?? null,
      delayedAverage: 0, notes, assumptions,
    };
  }

  // ── 2. NAMED SPELL, only because the block abbreviated it ──────────────────
  if (feature.spellName) {
    const profile = spellProfile(feature.spellName, options.srdVersion ?? "5.2.1");
    if (profile) {
      // The cast level is the STATED slot. Falling back to the spell's own base level is a
      // last resort and is recorded, because an unstated slot is a real ambiguity.
      const stated = feature.spellSlotLevel;
      const castLevel = stated ?? profile.base_level ?? profile.level;
      if (stated === undefined) {
        assumptions.push({
          feature: name, flag: "ESTIMATED", field: "cast_level",
          detail: `No slot level printed for ${feature.spellName}; priced at its base level ${castLevel}. If the block casts it higher, say so — it is never priced down.`,
        });
      }
      const { immediate, delayed } = spellDamageAtCastLevel(profile, castLevel);
      notes.push(`${feature.spellName} resolved at cast level ${castLevel}.`);
      if (delayed > 0) {
        notes.push(`${delayed.toFixed(1)} of it resolves on a later round and is scheduled, not added to the cast round.`);
      }
      return {
        name, method: "named_spell", rawAverage: immediate, castLevel,
        delayedAverage: delayed, notes, assumptions,
      };
    }
    assumptions.push({
      feature: name, flag: "NEEDS DM INPUT", field: "damage",
      detail: `"${feature.spellName}" is not in the versioned spell profiles. Enter its damage — the checker will not substitute a tier estimate.`,
    });
    return { name, method: "needs_dm_input", rawAverage: 0, castLevel: feature.spellSlotLevel ?? null,
      delayedAverage: 0, notes, assumptions };
  }

  // ── 3. UNREADABLE — say so, never substitute ───────────────────────────────
  if (/\d+d\d+/.test(feature.text ?? "")) {
    assumptions.push({
      feature: name, flag: "NEEDS DM INPUT", field: "damage",
      detail: "Dice appear in the printed text but no damage field was entered, so this scores 0. Enter the damage expression.",
    });
  } else if (feature.attackBonus !== undefined || feature.saveDc !== undefined) {
    /**
     * ⚠ A CONTROL EFFECT IS NOT A DAMAGE EFFECT WITH MISSING DICE.
     *
     * This raised "the feature has an attack bonus or save DC but no readable damage" against
     * every save-forcing ability in the campaign that deals none — Snarlroot's Sweeping Growth,
     * the Crone's Blighted Vitality, Hushrunner's Call the Wrong Name, the Veil-Torn Dragon's
     * Fractured Dream Breath. Seven creatures across the Act 3 sequence reported as unpriceable
     * when nothing about them is unreadable: they root, halve speed, block opportunity attacks
     * and suppress healing, and they are supposed to have no damage line.
     *
     * The contract is emphatic that this is a category of its own — *"Control is not
     * automatically unpriceable. Price its direct, deterministic consequence on action uptime,
     * hit probability, reachability, or sustain."* Calling it a damage gap sends the DM looking
     * for dice that were never printed, and buries the real question, which is what the control
     * is worth.
     */
    const controls = conditionsImposedBy({ conditions: feature.conditions, text: feature.text });
    const text = feature.text ?? "";
    /**
     * ⚠ FORCED MOVEMENT AND TERRAIN ARE CONTROL, AND THIS DID NOT KNOW THE WORDS.
     *
     * The condition list catches a NAMED condition — Grease says "falls prone" and resolves. It
     * says nothing about an effect that moves a body or denies it ground, so the Air Mirror's Gust
     * ("pushed 5 feet"), its Vortex Warp ("teleports it") and the Nature Mirror's Venomroot Bloom
     * ("difficult terrain") were reported as MISSING DAMAGE — a message asking the DM to invent
     * dice for spells that print none by design.
     *
     * The condition resolver already publishes the channel these land in: REACHABILITY. So they are
     * named as control and pointed at that channel, which is what the contract asks for — "price
     * its direct, deterministic consequence on action uptime, hit probability, reachability, or
     * sustain."
     */
    const REACHABILITY = new RegExp([
      "difficult terrain",
      "(pushed|pulled|shoved|slid)\\s+(up to\\s+)?\\d+\\s*(feet|ft)",
      "teleports?\\b",
      "speed is (halved|reduced)",
      "knocked (prone|back)",
    ].join("|"), "i");
    /**
     * ⚠ AND A SELF-BUFF IS NEITHER DAMAGE NOR CONTROL. The Earth Mirror's Sunstone Aegis grants
     * ITSELF +2 AC. Asking for its damage sends the DM looking for dice that were never printed;
     * calling it control would file a defence under the party's uptime. It is effective HP and it
     * belongs in the creature's defences with a multiplier and its provenance, where the coverage
     * gate can see it — so it is reported as that, naming the thing to do.
     */
    const SELF_DEFENCE = new RegExp([
      "granting\\s+\\+?\\d+\\s*AC",
      "\\+\\d+\\s*AC\\b",
      "temporary hit points",
    ].join("|"), "i");
    const readsAsControl = controls.length > 0
      || REACHABILITY.test(text)
      || /\b(?:speed is (?:halved|reduced)|cannot|can\'?t|prevent|suppress|halved|rooted|held|blocked|disadvantage)\b/i.test(text);
    const readsAsSelfDefence = !readsAsControl && SELF_DEFENCE.test(text);
    if (readsAsControl) {
      notes.push(
        `Control effect with no damage line${controls.length ? ` (${controls.join(", ")})` : ""}${controls.length === 0 && REACHABILITY.test(text) ? " [reachability]" : ""} — priced through its consequence, not as damage.`,
      );
    } else if (readsAsSelfDefence) {
      assumptions.push({
        feature: name, flag: "NEEDS DM INPUT", field: "damage",
        detail: "This raises the creature's OWN defence rather than dealing damage — it is effective HP, not a damage line. Record it in the creature's defences with a multiplier and where that multiplier came from; entering a damage figure here would price a shield as a weapon.",
      });
    } else {
      assumptions.push({
        feature: name, flag: "NEEDS DM INPUT", field: "damage",
        detail: "The feature has an attack bonus or save DC but no readable damage, and its text does not describe a control effect either. Enter the damage, or state what it does.",
      });
    }
  }
  return { name, method: "needs_dm_input", rawAverage: 0, castLevel: null,
    delayedAverage: 0, notes, assumptions };
}

/**
 * Expected damage for one use, after hit/save probability and target count.
 *
 * ⚠ SUCCESS DAMAGE IS THE PRINTED VALUE. The contract is explicit that half is not assumed
 * unless the block says half — a save-for-none effect priced at half is a fabricated number.
 */
export function expectedDamageForFeature(
  resolved: ResolvedFeature,
  feature: ParsedFeature,
  target: {
    ac: number;
    saveBonus: number;
    partySize?: number;
    /** All six save averages, so each feature is priced against the save it actually calls for. */
    saves?: Record<SaveAbility, number>;
    /** Conditions the TARGET is currently under. Reprices the die, per the pricing contract. */
    conditions?: string[];
    /**
     * The share of this creature's attacks made from within 5 ft. Only prone needs it, because
     * prone is the one condition whose sign flips with distance. Defaults from the action's own
     * reach when not supplied.
     */
    meleeShare?: number;
  },
): { expected: number; basis: string; assumptions: FeatureAssumption[] } {
  const assumptions = [...resolved.assumptions];
  /**
   * ⚠ AN AREA IS PRICED AGAINST THE PARTY, NOT COUNTED AS ONE.
   *
   * This used to take `feature.targets ?? 1` and flag every cone in the campaign as unpriceable.
   * That was wrong twice over: it under-priced the effect by the whole party minus one, and it
   * called a determinable number unknown. The checker is a FOUR-PC BASELINE model that already
   * knows its party size, and the catalog's "two-target" figure IS that baseline — two of four.
   *
   * Printed count wins. An area with no printed count takes half the party. Anything else is one.
   */
  /**
   * ⚠ THE BENCHMARK IS VALIDATED, SO USING IT IS NOT AN ASSUMPTION.
   *
   * This used to raise an ESTIMATED flag on every area effect. Christopher, 2026-08-20: *"this
   * should not be a stated assumption because we have validated the assumption, it can go up or
   * down per the actual encounter but that is player agency for how they move, the checker just
   * needs to use the validated assumption."*
   *
   * He is right, and the contract says the same thing in its own words: *"Do not silently default
   * an area to one target when no target count is known; use an authored runtime benchmark **or**
   * mark NEEDS DM INPUT."* We HAVE the authored benchmark — the workbook's four-PC two-target
   * figure — so the first branch applies and there is nothing to flag. Flagging it anyway asked
   * the DM to resolve something the model had already resolved correctly, and made a fully priced
   * library encounter read as half-broken.
   *
   * How many PCs a cone actually catches is decided at the table by where people stand. That is
   * player agency, not missing data, and no amount of DM input makes it knowable in advance —
   * which is precisely why the model carries a validated average instead.
   *
   * The count still appears in `basis` ("× 2"), so the trace always shows what was used.
   */
  const partySize = target.partySize ?? 4;
  const targets = feature.targets
    ?? (feature.isArea ? aoeTargetsForParty(partySize) : 1);
  if (resolved.rawAverage <= 0) return { expected: 0, basis: "no readable damage", assumptions };

  /**
   * ⚠ CONDITIONS REPRICE THE DIE, AND THEY ARE APPLIED HERE RATHER THAN AS A MULTIPLIER LATER.
   * The contract prices Restrained, Stunned, Prone and the rest through their actual effect on
   * hit and save probability; a flat tax applied downstream would both misprice the extremes and
   * risk double-counting against the sustain channel.
   */
  const targetConditions = target.conditions ?? [];
  const incomingSwing = targetConditions.reduce<RollSwing>(
    (swing, c) => combineSwings(swing, conditionEffect(c)?.incomingAttacks ?? "none"), "none");
  const isTargetProne = targetConditions.includes("prone");

  if (feature.attackBonus !== undefined) {
    const base = Math.min(0.95, Math.max(0.05, (21 + feature.attackBonus - target.ac) / 20));
    /**
     * PRONE IS RANGE-DEPENDENT, so it cannot go through the flat swing. Advantage inside 5 ft,
     * disadvantage beyond it — weighted by how much of this creature's offence is actually in
     * melee. Everything else is a single swing.
     */
    const hit = isTargetProne
      ? pHitVsProne(base, meleeShareOf(feature, target))
      : applySwing(base, incomingSwing);
    const swingNote = isTargetProne
      ? ` (prone: ${(meleeShareOf(feature, target) * 100).toFixed(0)}% within 5 ft at advantage, the rest at disadvantage)`
      : incomingSwing !== "none" ? ` (${incomingSwing})` : "";
    return {
      expected: resolved.rawAverage * hit * targets,
      basis: `${resolved.rawAverage.toFixed(1)} × ${(hit * 100).toFixed(0)}% hit${swingNote}${targets > 1 ? ` × ${targets}` : ""}`,
      assumptions,
    };
  }
  if (feature.saveDc !== undefined) {
    /**
     * ⚠ THE SAVE THE BLOCK NAMES, NOT A FLAT NUMBER. v7: *"Use the matching ability save average."*
     * `target.saves` carries all six; the flat `saveBonus` is the fallback for a caller that has
     * not been given the party profile, and for a block whose save ability is unreadable.
     */
    const saveBonus = target.saves && feature.saveAbility
      ? target.saves[feature.saveAbility]
      : target.saveBonus;
    const baseFail = Math.min(1, Math.max(0, (feature.saveDc - saveBonus - 1) / 20));
    /**
     * ⚠ THE SWING IS ON THE SAVE, SO IT INVERTS. `p_fail` is a FAILURE probability: disadvantage
     * on the save raises it, advantage lowers it. Applying the attack-side transform directly
     * here would have made every restrained target BETTER at saving.
     *
     * Restrained narrows to DEX only (`savesDexOnly`) — the contract grants disadvantage on Dex
     * saves specifically, and spreading it to all six would over-price every WIS-save effect in
     * the campaign against a restrained target.
     */
    const saveSwing = targetConditions.reduce<RollSwing>((swing, c) => {
      const effect = conditionEffect(c);
      if (!effect || effect.saves === "none") return swing;
      if (effect.savesDexOnly && feature.saveAbility !== "dex") return swing;
      return combineSwings(swing, effect.saves);
    }, "none");
    const pFail = saveSwing === "disadvantage" ? withAdvantage(baseFail)
      : saveSwing === "advantage" ? withDisadvantage(baseFail)
      : baseFail;
    /**
     * ⚠ ALL-OR-NOTHING IS A COMPLETE CALCULATION, NOT A MISSING ONE.
     *
     * This raised an ESTIMATED flag whenever no success damage was printed. That is backwards:
     * a save that negates is the DEFAULT and the contract states it as a rule — *"Half is only
     * applied when the block says half."* When the block says nothing, none IS the printed answer.
     *
     * Christopher, 2026-08-20: *"if mind hook is all or nothing then the checker needs to read
     * exactly that because it should take the listed save and cal the chance it has to be all and
     * the chance it has to be none and then if 80% of the time it is all damage then there is a
     * valid number to compute."* Exactly — and the line below already computes it: p_fail × full
     * plus (1 − p_fail) × 0. Mind Hook at DC 18 WIS against a +2.9 party is 71% × 7.0 = 5.0. That
     * is a number, not a gap, and flagging it implied the total could not be trusted.
     *
     * The `basis` string already prints both halves of the split, so the trace shows the working.
     */
    const success = damageExpressionAverage(feature.successDamage);
    return {
      expected: (pFail * resolved.rawAverage + (1 - pFail) * success) * targets,
      basis: feature.successDamage === undefined || success === 0
        ? `${(pFail * 100).toFixed(0)}% fail → ${resolved.rawAverage.toFixed(1)}, ${((1 - pFail) * 100).toFixed(0)}% save → 0 (all or nothing)${targets > 1 ? ` × ${targets}` : ""}`
        : `${(pFail * 100).toFixed(0)}% fail → ${resolved.rawAverage.toFixed(1)}, else ${success.toFixed(1)}${targets > 1 ? ` × ${targets}` : ""}`,
      assumptions,
    };
  }
  return {
    expected: resolved.rawAverage * targets,
    basis: `${resolved.rawAverage.toFixed(1)} automatic${targets > 1 ? ` × ${targets}` : ""}`,
    assumptions,
  };
}
