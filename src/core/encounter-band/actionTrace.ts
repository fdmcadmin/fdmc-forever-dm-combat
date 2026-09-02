/**
 * actionTrace — v3 App Contract row 13 (REQUIRED).
 *
 *   action_trace  "Return per-round scheduled features, action channels, resources, hit/save
 *                  expectation, targets, expected damage, and unresolved assumptions."
 *
 * The action-economy rules it schedules against, quoted from the contract:
 *   · "Choose one Action or Magic action per turn unless the stat block explicitly combines them."
 *   · "A Bonus Action, Reaction, Legendary Action, and Lair Action use their own printed
 *      budget; none consumes or creates a normal Action unless the text says so."
 *   · "Recharge controls availability only. Read activation_type from the section heading,
 *      never from the word Recharge."
 *   · "A rechargeable Action replaces the routine Action; a rechargeable Bonus Action uses only
 *      the Bonus Action budget."
 *   · "Schedule shared spell slots, N/Day Each, recharge, concentration, and once-per-turn
 *      riders before selecting the round's legal feature set."
 *   · "Use powerful limited abilities early, Multiattack otherwise."
 *
 * Every channel is tracked separately, so a Legendary Action can never quietly consume the
 * Action that a Multiattack needed — the failure the contract calls out by name.
 */

import type { ParsedCreature } from "./parseCreature";
import type { SaveAbility } from "./partyDefenceCurve";
import { riderWeight, describeRider, type MonsterRider } from "../monsters/monsterRider";
import { damageExpressionAverage } from "./damageExpression";
import {
  resolveFeature, expectedDamageForFeature,
  type ParsedFeature, type FeatureAssumption,
} from "./featureResolver";

export type ActionChannel =
  | "action" | "bonus_action" | "reaction" | "legendary_action" | "lair_action" | "free";

export type TracedFeature = {
  feature: string;
  channel: ActionChannel;
  /** How the damage was arrived at — printed, named_spell, or a flag. */
  method: string;
  castLevel: number | null;
  targets: number;
  /** The hit or save arithmetic, in words, so a DM can check it. */
  expectation: string;
  expectedDamage: number;
  /** What it cost: a recharge use, a daily use, a slot. */
  resourceSpent: string | null;
  note?: string;
};

export type TracedRound = {
  round: number;
  scheduled: TracedFeature[];
  /** Damage that resolves THIS round from an earlier round's delayed component. */
  delayedArriving: number;
  totalExpectedDamage: number;
};

export type CreatureTrace = {
  creature: string;
  rounds: TracedRound[];
  /** Mean expected damage per round across the traced window — the DPR the checker consumes. */
  averagePerRound: number;
  assumptions: FeatureAssumption[];
};

type Budgeted = {
  feature: ParsedFeature;
  channel: ActionChannel;
  /** Spell or recharge — IS the Action, so it replaces the routine rather than adding. */
  fullAction: boolean;
  usesLeft: number | null;
  /** Recharge range, if any. Availability only; never changes the channel. */
  recharge?: string;
  perUse: number;
  /** Once-per-turn riders on this feature — priced at the TURN, not per use. See `monsterRider.ts`. */
  turnRiders: readonly MonsterRider[];
  /** This feature's chance to land one attack, for weighting its riders. */
  hitChance: number;
  expectation: string;
  method: string;
  castLevel: number | null;
  targets: number;
  delayed: number;
};

/** Probability a recharge ability is up, once it has been spent. (max − min + 1) / 6. */
function rechargeProbability(range: string | undefined): number {
  if (!range) return 1;
  const m = range.match(/(\d)\s*-?\s*(\d)?/);
  if (!m) return 1;
  const lo = Number.parseInt(m[1], 10);
  const hi = m[2] ? Number.parseInt(m[2], 10) : 6;
  const faces = Math.max(0, Math.min(6, hi) - lo + 1);
  return faces > 0 ? faces / 6 : 1;
}

/**
 * Build the per-round trace for one creature.
 *
 * Scheduling order per round, per the contract: limited abilities first (use powerful limited
 * abilities early), then the routine Multiattack fills whatever Action budget is left, then the
 * separate channels resolve on their own budgets.
 */
export function traceCreature(
  creature: ParsedCreature,
  target: { ac: number; saveBonus: number; partySize?: number; saves?: Record<SaveAbility, number> },
  rounds = 4,
): CreatureTrace {
  const assumptions: FeatureAssumption[] = [...creature.assumptions];
  const budgeted: Budgeted[] = [];

  for (const feature of creature.features) {
    if (feature.activationType === "trait") continue;      // traits are not scheduled actions
    /**
     * ⚠ A GATED FEATURE IS NOT SCHEDULABLE. It is authored as unavailable under this
     * encounter's conditions, and `parseCreature` has already raised the assumption saying so.
     * Scheduling it anyway let the Lesser Wendigo spend its Action on a gated Rend and never
     * throw its actual two-Claw routine at all — the trace claimed 9.1 where the creature
     * really does 12.1.
     */
    if (feature.gated) continue;
    const resolved = resolveFeature(feature);
    assumptions.push(...resolved.assumptions);
    const { expected, basis, assumptions: dmgAssumptions } =
      expectedDamageForFeature(resolved, feature, target);
    for (const a of dmgAssumptions) {
      if (!assumptions.some(x => x.feature === a.feature && x.detail === a.detail)) assumptions.push(a);
    }
    const channel = (feature.activationType ?? "action") as ActionChannel;
    /**
     * ⚠ RIDERS ARE PRICED BY CADENCE, WHICH IS THE WHOLE REASON THEY ARE FIELDS AND NOT DICE
     * FOLDED INTO A DAMAGE STRING. A rider written into the damage field is billed on every
     * attack; one printed only in the prose is billed on none. Neither is what the block says.
     *
     * v10's Pricing Resolver splits them exactly this way — `conditional_extra_damage` is
     * "P(condition true) × P(trigger succeeds) × extra damage EV", and
     * `first_hit_or_once_per_turn_rider` is "P(at least one qualifying trigger in the legal turn)
     * × rider EV". A per-hit rider rides each use and belongs in `perUse`; a once-per-turn one
     * does not, and is priced at the turn below, once the routine is known.
     */
    const hitChance = feature.attackBonus !== undefined
      ? Math.min(0.95, Math.max(0.05, (21 + feature.attackBonus - target.ac) / 20))
      : 1;
    const riders = feature.riders ?? [];
    const perHitRiders = riders.filter(r => r.cadence === "per-hit");
    const perHitBonus = perHitRiders.reduce(
      (sum, r) => sum + damageExpressionAverage(r.damage) * riderWeight(r, hitChance, 1), 0);
    const riderNote = perHitRiders.length === 0 ? ""
      : " + " + perHitBonus.toFixed(1) + " rider (" + perHitRiders.map(describeRider).join("; ") + ")";
    budgeted.push({
      feature, channel,
      turnRiders: riders.filter(r => r.cadence === "once-per-turn"),
      hitChance,
      /**
       * A spell, a recharge ability, OR A LIMITED-USE ability IS the Action — it replaces the
       * routine rather than joining it. Recharge never changes the CHANNEL, only availability.
       *
       * ⚠ `uses` belongs in this test. Without it the Veilwood Crone's "Venomous Eruption
       * (1/Day)" fell into the routine pool and fired as Multiattack slot 1 EVERY round —
       * a once-per-day 6d8 burst counted four times in four rounds, and its own printed limit
       * silently ignored.
       */
      fullAction: channel === "action"
        && (feature.spellSlotLevel !== undefined
          || Boolean(feature.recharge)
          || feature.uses !== undefined),
      usesLeft: feature.uses ?? null,
      recharge: feature.recharge,
      perUse: expected + perHitBonus,
      expectation: basis + riderNote,
      method: resolved.method,
      castLevel: resolved.castLevel,
      targets: feature.targets ?? 1,
      delayed: resolved.delayedAverage,
    });
  }

  const routineAll = budgeted
    .filter(b => b.channel === "action" && !b.fullAction && b.perUse > 0)
    .sort((a, b) => b.perUse - a.perUse);
  /**
   * A "(replaces one Claw)" feature is NOT a second attack. It competes for one Multiattack
   * slot against the attack it displaces, and only takes it when it is worth more.
   * Counting it as an extra routine entry gave the Lesser Wendigo a Claw + a Grab where the
   * block says two Claws, one of which MAY become a Grab.
   */
  const routine = routineAll.filter(b => !b.feature.replacesRoutineSlot);
  const replacers = routineAll.filter(b => b.feature.replacesRoutineSlot);
  const actionAlternatives = budgeted
    .filter(b => b.channel === "action" && b.fullAction)
    .sort((a, b) => b.perUse - a.perUse);
  const otherChannels = budgeted.filter(b => b.channel !== "action");

  const traced: TracedRound[] = [];
  const delayedByRound = new Map<number, number>();
  const spent = new Map<Budgeted, number>();

  for (let round = 1; round <= rounds; round++) {
    const scheduled: TracedFeature[] = [];

    // ── The Action channel: ONE action per turn ──────────────────────────────
    // A limited or rechargeable Action replaces the routine when it is available and better.
    const alt = actionAlternatives.find(a => {
      const used = spent.get(a) ?? 0;
      if (a.usesLeft !== null && used >= a.usesLeft) return false;
      return true;
    });
    /**
     * The routine's slots: the best printed attacks, repeating the single named attack when the
     * block lists fewer than the Multiattack allows. A "replaces one X" feature may then take
     * ONE slot — the weakest — and only if it is worth more than what it displaces.
     */
    const slots: Budgeted[] = [];
    /**
     * ⚠ AN AUTHORED SPLIT WINS. When any routine attack states `routineSlots`, the block has
     * told us the split and the convention below does not apply. The Breaker: *"four attacks:
     * two Grasping Limb attacks and two Heavy Blow attacks."* Read as the convention that is
     * one Heavy Blow and three Grasping Limbs — the WEAKER attack three times, which is neither
     * what the block says nor what the creature would pick.
     */
    const declared = routine.filter(b => (b.feature.routineSlots ?? 0) > 0);
    const declaredTotal = declared.reduce((s, b) => s + (b.feature.routineSlots ?? 0), 0);
    /**
     * ⚠ A SPLIT THAT OVERFLOWS THE BUDGET IS A LIST OF ALTERNATIVES, NOT A ROUTINE.
     *
     * Christopher: *"for the guards it makes 3 attacks but it does 1 of each of its actions
     * (tail, claw, bite), then if it says 2 and both have a 2 on them then the app should be able
     * to read it can make either of these 2 combined as dpr and finds the middle damage of those."*
     *
     * Both cases fall out of comparing the declared counts against the budget:
     *
     *   Σ counts == budget    ONE routine. 3 attacks declared 1/1/1 is tail AND claw AND bite.
     *   Σ counts >  budget    ALTERNATIVES. 2 attacks with two actions each declared 2 cannot all
     *                         happen, so each is a routine the creature may pick — and the
     *                         creature is not obliged to pick the best one every round.
     *
     * The alternative case is priced as the MEAN of the options, which is his "middle damage" and
     * is also what the workbook's `multiattack_sequence` asks for: *"Follow the printed sequence
     * and alternatives; do not add every option."* Taking the maximum would assume a creature that
     * always guesses right; summing them would field a routine that does not exist.
     *
     * ⚠ A SINGLE DECLARED OPTION IS NEVER AN ALTERNATIVE. One action marked 2 of a 2-attack
     * budget is a routine with one entry, not a choice between it and nothing.
     */
    const alternatives = declared.length > 1 && declaredTotal > creature.attacksPerTurn;
    if (alternatives) {
      /**
       * ⚠ THE CREATURE TAKES ITS BEST OPTION, EVERY SLOT. THIS AVERAGED THEM AND THAT WAS WRONG.
       *
       * Christopher: *"the Reeve was showing damage sequence that was the highest, now this is
       * reverted to 16 and the attack should never be counted as only possible to do 16."* He is
       * right, and the Reeve is the case that shows why: its block reads *"the Reeve makes two
       * attacks, choosing Shearing Cut or Spoiling Cut for each."*
       *
       * CHOOSING FOR EACH IS A FREE CHOICE, PER ATTACK, AT NO COST. Nothing stops a DM taking
       * Shearing Cut twice, so the damage the creature can do is 2 x 14, not the mean of 14 and
       * 9.5. Averaging them priced the Reeve at 16.0 against a ceiling of 19.1 — and a checker
       * that under-reports what a creature CAN do is worse than useless, because the whole
       * question it answers is whether the party survives the bad case.
       *
       * The Spoiling Cut exists because it lands a debuff. That is a trade a DM makes for CONTROL,
       * and control is priced on its own channel — folding it into the damage average charges the
       * trade twice and credits it to neither.
       *
       * ⚠ AND IT IS NOT THE UNDECLARED CONVENTION EITHER, which is why this has its own branch.
       * That convention is "one of each distinct attack, then repeat the last" — bite-claw-claw —
       * and it is right for a dragon whose block LISTS a Bite and a Claw, because those are what
       * the block says it does. It is wrong here: a creature told it may choose for each attack is
       * not obliged to take one of everything, and filling Heavy then Quick reads a free choice as
       * a fixed sequence.
       *
       * So the whole budget goes to the best option. What the declaration still buys is the case
       * where the counts FIT the budget — 1+1+1 on the Drake Guard IS a sequence, one of each, and
       * that is the case the convention gets wrong in the other direction.
       */
      const best = declared.reduce((a, b) => (b.perUse > a.perUse ? b : a), declared[0]);
      for (let i = 0; i < creature.attacksPerTurn; i++) slots.push(best);
    } else if (declared.length > 0) {
      for (const b of declared) {
        for (let i = 0; i < (b.feature.routineSlots ?? 0) && slots.length < creature.attacksPerTurn; i++) {
          slots.push(b);
        }
      }
      // An under-declared split still fills its remaining slots the ordinary way.
      for (let i = slots.length; i < creature.attacksPerTurn && routine.length > 0; i++) {
        slots.push(routine[Math.min(i, routine.length - 1)]);
      }
    } else {
      for (let i = 0; i < creature.attacksPerTurn && routine.length > 0; i++) {
        slots.push(routine[Math.min(i, routine.length - 1)]);
      }
    }
    const bestReplacer = replacers[0];
    if (bestReplacer && slots.length > 0) {
      let weakest = 0;
      for (let i = 1; i < slots.length; i++) if (slots[i].perUse < slots[weakest].perUse) weakest = i;
      if (bestReplacer.perUse > slots[weakest].perUse) slots[weakest] = bestReplacer;
    } else if (bestReplacer && slots.length === 0) {
      slots.push(bestReplacer);
    }
    const routineTotal = slots.reduce((s, r) => s + r.perUse, 0);

    /**
     * ⚠ "USE POWERFUL LIMITED ABILITIES EARLY, MULTIATTACK OTHERWISE" — the contract's own
     * wording, and POWERFUL is the operative word. A limited or rechargeable Action only
     * displaces the routine when it is worth MORE than the routine it displaces. Taking it
     * unconditionally had the Lesser Wendigo spend its Action on a 2.8-damage Rend instead of
     * 13.2 of Claws, and burn the recharge doing it.
     *
     * A stronger-in-play ability that prices LOWER — a charge that knocks prone, a grapple —
     * is kept as the routine and reported, because the checker prices damage and cannot price
     * a rider. It says so rather than quietly choosing for the DM.
     */
    if (alt && alt.perUse > 0 && alt.perUse <= routineTotal && routine.length > 0) {
      assumptions.push({
        feature: alt.feature.name, flag: "ESTIMATED", field: "action_cost",
        detail: `"${alt.feature.name}" prices at ${alt.perUse.toFixed(1)} against a routine worth ${routineTotal.toFixed(1)}, so the routine is scheduled. If it is worth using for a rider the checker cannot price — knockback, prone, a grapple — that value is not in this number.`,
      });
    }

    if (alt && alt.perUse > 0 && (alt.perUse > routineTotal || routine.length === 0)) {
      const used = spent.get(alt) ?? 0;
      // Round 1 it is available outright; later rounds it is up on its recharge probability.
      const availability = used === 0 ? 1 : rechargeProbability(alt.recharge);
      const value = alt.perUse * availability + routineTotal * (1 - availability);
      spent.set(alt, used + 1);
      scheduled.push({
        feature: alt.feature.name, channel: "action", method: alt.method,
        castLevel: alt.castLevel, targets: alt.targets,
        expectation: alt.expectation + (availability < 1 ? ` × ${(availability * 100).toFixed(0)}% available` : ""),
        expectedDamage: value,
        resourceSpent: alt.feature.spellSlotLevel !== undefined
          ? `level ${alt.feature.spellSlotLevel} slot`
          : alt.recharge ? `recharge ${alt.recharge}` : alt.usesLeft !== null ? "1 use" : null,
        note: "Full Action — replaces the routine Multiattack.",
      });
      if (alt.delayed > 0) {
        delayedByRound.set(round + 1, (delayedByRound.get(round + 1) ?? 0) + alt.delayed);
      }
    } else if (slots.length > 0) {
      slots.forEach((pick, i) => {
        scheduled.push({
          feature: pick.feature.name, channel: "action", method: pick.method,
          castLevel: pick.castLevel, targets: pick.targets,
          expectation: pick.expectation, expectedDamage: pick.perUse,
          resourceSpent: null,
          note: slots.length > 1 ? `Multiattack ${i + 1} of ${slots.length}` : undefined,
        });
      });
      /**
       * ⚠ ONCE PER TURN IS ONCE PER TURN, NOT ONCE PER ATTACK — and charging it per attack is how
       * a once-per-turn rider gets tripled on a three-attack creature.
       *
       * It fires when AT LEAST ONE of this turn's attacks connects, so it is priced here, where
       * the routine is finally known, rather than inside `perUse` where the count is not. One row
       * per rider per turn, however many slots the feature took — which is exactly the workbook's
       * "P(at least one qualifying trigger in the legal turn) × rider EV".
       */
      const riderSlots = new Map<Budgeted, number>();
      for (const pick of slots) riderSlots.set(pick, (riderSlots.get(pick) ?? 0) + 1);
      for (const [pick, count] of riderSlots) {
        for (const rider of pick.turnRiders) {
          const value = damageExpressionAverage(rider.damage) * riderWeight(rider, pick.hitChance, count);
          if (value <= 0) continue;
          scheduled.push({
            feature: `${pick.feature.name} — ${rider.name}`, channel: "action", method: "rider",
            castLevel: null, targets: pick.targets,
            expectation: `${describeRider(rider)} · ${(riderWeight(rider, pick.hitChance, count) * 100).toFixed(0)}% across ${count} attack${count === 1 ? "" : "s"}`,
            expectedDamage: value,
            resourceSpent: null,
            note: rider.note,
          });
        }
      }
    }

    // ── Separate budgets: none of these consumes the Action ──────────────────
    /**
     * ⚠ A REACTION IS A SHARED BUDGET, AND THIS USED TO SUM EVERY ONE OF THEM.
     *
     * Christopher, 2026-09-02: *"Do not sum the expected value of every possible Reaction in the
     * same round. Once one is used, the others are unavailable until refresh."*
     *
     * This loop scheduled EVERY non-action feature every round, with the note "Own budget — does
     * not consume the Action." That note is true of the ACTION and false of everything else it
     * was applied to: a creature carrying Shield, Counterspell and an opportunity attack fired
     * all three, every round, and the trace added up damage from a body that legally had one
     * Reaction to spend.
     *
     * The same error covered Bonus Actions — two bonus-action features both fired, when a turn
     * has one.
     *
     * ⚠ WHICH CHANNELS ARE CAPPED, AND WHY THE OTHERS ARE NOT.
     *   reaction, bonus_action   ONE per turn. The 5e economy, and the workbook's own separate
     *                            shared budget.
     *   legendary_action         Its own authored pool, spent across other creatures' turns —
     *                            genuinely several per round, and `uses` already bounds it.
     *   lair_action              Fires on its own initiative count, not the creature's turn.
     *   free                     Costs nothing by definition.
     *
     * ⚠ HIGHEST EXPECTED VALUE WINS THE SLOT, which is the *"runtime strategy/expected-value
     * logic"* the instruction names. A body does not get to hold the best reaction AND fire a
     * worse one; it picks, and the rest wait for the refresh.
     */
    const SHARED_BUDGET: ReadonlySet<ActionChannel> = new Set<ActionChannel>(["reaction", "bonus_action"]);
    const budgetSpent = new Set<ActionChannel>();

    const eligible = otherChannels
      .filter(b => {
        const used = spent.get(b) ?? 0;
        if (b.usesLeft !== null && used >= b.usesLeft) return false;
        return b.perUse > 0;
      })
      // Best first, so a capped channel's single slot goes to the strongest legal option.
      .sort((a, b) => b.perUse - a.perUse);

    for (const b of eligible) {
      const capped = SHARED_BUDGET.has(b.channel);
      if (capped && budgetSpent.has(b.channel)) continue;   // already spent this turn
      const used = spent.get(b) ?? 0;
      const availability = used === 0 ? 1 : rechargeProbability(b.recharge);
      spent.set(b, used + 1);
      if (capped) budgetSpent.add(b.channel);
      scheduled.push({
        feature: b.feature.name, channel: b.channel, method: b.method,
        castLevel: b.castLevel, targets: b.targets,
        expectation: b.expectation + (availability < 1 ? ` × ${(availability * 100).toFixed(0)}% available` : ""),
        expectedDamage: b.perUse * availability,
        resourceSpent: b.usesLeft !== null ? `1 of ${b.usesLeft} uses` : b.recharge ? `recharge ${b.recharge}` : null,
        note: capped
          ? `Spends this turn's ${b.channel === "reaction" ? "Reaction" : "Bonus Action"} — nothing else on that budget resolves until it refreshes.`
          : "Own budget — does not consume the Action.",
      });
    }

    /**
     * ⚠ WHAT LOST THE SLOT IS REPORTED, NOT DROPPED. A body whose Counterspell never resolved
     * because Shield took the Reaction is a real tactical fact the DM should see, and silently
     * omitting it looks identical to the feature having been forgotten.
     */
    for (const b of eligible) {
      if (!SHARED_BUDGET.has(b.channel)) continue;
      if (scheduled.some(s => s.feature === b.feature.name && s.channel === b.channel)) continue;
      scheduled.push({
        feature: b.feature.name, channel: b.channel, method: b.method,
        castLevel: b.castLevel, targets: b.targets,
        expectation: "not scheduled — the budget was already spent",
        expectedDamage: 0,
        resourceSpent: null,
        note: `${b.channel === "reaction" ? "Reaction" : "Bonus Action"} already spent this turn; this cannot also resolve.`,
      });
    }

    const delayedArriving = delayedByRound.get(round) ?? 0;
    traced.push({
      round, scheduled, delayedArriving,
      totalExpectedDamage: scheduled.reduce((s, x) => s + x.expectedDamage, 0) + delayedArriving,
    });
  }

  const averagePerRound = traced.length
    ? traced.reduce((s, r) => s + r.totalExpectedDamage, 0) / traced.length
    : 0;

  // One assumption per distinct message — the same missing target count on three features
  // is one thing for the DM to fix, not three lines of noise.
  const seen = new Set<string>();
  const deduped = assumptions.filter(a => {
    const key = a.flag + "|" + a.field + "|" + a.detail;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { creature: creature.name, rounds: traced, averagePerRound, assumptions: deduped };
}
