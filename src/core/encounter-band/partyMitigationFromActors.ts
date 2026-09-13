/**
 * WHAT THE PARTY'S OWN CLASSES PREVENT — resistances, and the Reaction that stops one hit.
 *
 * The checker has priced a CREATURE's typed responses against the party's damage mix since
 * `damageResponsePricing` existed. The party side of that question was never asked, and this is
 * the mirror of it: the party's responses priced against the ROSTER's damage mix, with the same
 * function, so there is one model of "what does a resistance remove" pointed both ways.
 *
 * ─── ⚠ MOST OF IT IS KNOWN WITHOUT BEING TOLD ───────────────────────────────────────────────
 *
 * Christopher, 2026-09-07: *"all of those resistances should be there because they are based on
 * classes not because they want them, same with the rage, it should already be known what rage
 * resists."*
 *
 * The first version of this file asked the DM to enter every one, reasoning that the app must not
 * read a mechanic out of a feature's description. That rule is real and it is a rule about PROSE —
 * it does not mean the app may not know what raging does. `classDamageResponses` is the hand-built
 * rule table, keyed on the STATED race and class, in exactly the shape `casterLean` and
 * `weaponMastery` already use; the entered field is now the override and the extension for the
 * cases that genuinely turn on a choice the sheet does not state.
 *
 * ⚠ AND A CONDITIONAL ONE IS COUNTED FOR THE FIGHTS IT COVERS. Rage's resistance lasts as long as
 * the rage. A level 1 Barbarian gets two, regains one at the day's single Short Rest, and the day
 * is five fights — so it covers three fights in five and is weighed at 0.6, a figure the resource
 * ledger already holds rather than one anybody has to supply.
 *
 * ─── ⚠ ONE REACTION PER CHARACTER PER ROUND, AND IT IS CONTENDED ────────────────────────────
 *
 * `Action Timing` row 22: *"All normal Reactions compete for the same actor budget: defensive,
 * offensive, opportunity attacks, spell reactions, item reactions, and creature reactions."* Row
 * 13: *"Once spent, no other normal Reaction is legal until refresh."*
 *
 * So Uncanny Dodge and Spirit Shield and a bond's Shielding reaction are not three mitigations on
 * one character — they are one, and it is the best of them. Summing them is the commonest way a
 * party's defence gets inflated, and it is why this returns a per-actor BEST rather than a total.
 * The bond figure is passed in for exactly this reason: `partyBondMitigationFromActors` already
 * prices the bond side, and the two must contend rather than stack.
 *
 * ⚠ AND A CONDITION NOTHING CAN COUNT IS STILL REPORTED. A gate with a named resource is counted
 * above; a free-text qualifier the app cannot evaluate is priced at the UPPER BOUND and flagged as
 * unread — never silently narrowed, never silently dropped.
 */

import type { Actor } from "../types/actor";
import { priceDamageResponses, type DamageResponse } from "./damageResponsePricing";
import { partyDamageMixFromActors, type PartyDamageMix } from "./partyDamageMix";
import { damageResponsesForActor, type DerivedDamageResponse } from "../../modules/dnd-5e/classDamageResponses";
import { resourceLedgerFromActor, RESOURCE_DAY } from "./resourceLedger";
import { damageExpressionAverage } from "./damageExpression";
import { resolveFormulaVars } from "../state/resolveFormulaVars";

/**
 * THE DAMAGE THE ROSTER THROWS, IN TYPES — the mix a party's resistance is weighed against.
 *
 * ⚠ IT REUSES `partyDamageMixFromActors` RATHER THAN COUNTING TYPES A SECOND TIME. That function
 * already resolves a stated `damageType`, a type written inside the expression, the weapon table
 * and a rider's own type, and reports what it could not type. A creature action states the same
 * three things under different field names, so the adapter is a rename and the model stays single.
 */
export function rosterDamageMix(
  templates: ReadonlyArray<{
    name?: string;
    actions?: ReadonlyArray<{
      name?: string; damage?: string; damageType?: string | readonly string[];
      extraDamage?: ReadonlyArray<{ damage: string; damageType?: string | readonly string[] }>;
    }>;
  }>,
): PartyDamageMix {
  return partyDamageMixFromActors(templates.map(t => ({
    name: t.name,
    actions: (t.actions ?? []).map(a => ({
      label: a.name,
      /**
       * ⚠ A SECOND DAMAGE LINE IS ITS OWN TYPE, SO IT TRAVELS AS ITS OWN TYPED LINE. It rides the
       * `riders` slot the mix already reads with a stated type — the adapter stays a rename, and
       * the 1d6 psychic on an Ember Lance is weighed as psychic rather than dropped.
       *
       * The type may be an ARRAY here — one roll, two types, the Winter Needle's cold and psychic —
       * and passing that straight through crashed the mix: `(type ?? "").trim is not a function`.
       * `damageLinesOf` now accepts both shapes.
       */
      metadata: {
        damage: a.damage,
        damageType: a.damageType,
        riders: (a.extraDamage ?? []).map(line => ({ formula: line.damage, damageType: line.damageType })),
      },
    })),
  })) as never);
}

/** A reaction that removes damage, and how much of it. */
export type ReactionMitigation = {
  actor: string;
  action: string;
  /** Expected HP removed from ONE incoming hit. */
  amount: number;
  /** Where the figure came from — the printed dice, or a share of the hit. */
  basis: "printed" | "halved";
};

export type PartyMitigation = {
  /**
   * Effective-HP multiplier from the party's typed responses, weighted by what this roster
   * actually throws. 1.0 when nothing is stated or nothing the party resists is being dealt.
   */
  multiplier: number;
  /** The responses that produced it, with the incoming share each was weighed at. */
  resisted: Array<{
    actor: string;
    response: DerivedDamageResponse;
    /** The share of INCOMING damage this one removed, after party scaling and any resource gate. */
    share: number;
    /** Where the rule came from — a lineage, a class, or the sheet. */
    source: string;
    /** Fraction of the day fights its gating resource can cover. Unset when nothing gates it. */
    uptime?: number;
    /** How that fraction was counted, so a number nobody typed is one they can argue with. */
    uptimeNote?: string;
    qualifierUnresolved: boolean;
  }>;
  /**
   * HP per round the party's REACTIONS prevent, already contended: one per character, the best of
   * whatever that character could have spent it on.
   */
  reactionPerRound: number;
  reactions: ReactionMitigation[];
  /**
   * Characters whose reaction lost the contest to their bond's — named, so a figure that did not
   * appear is a decision the DM can see rather than a number that went missing.
   */
  displacedByBond: Array<{ actor: string; action: string; amount: number; bondAmount: number }>;
/**
   * Characters with no damage responses at all — none from their class or lineage, and none
   * entered. A zero that says whose it is.
   */
  withoutStatedResponses: string[];
  /** Responses that could not be weighed, because the roster's damage is untyped. */
  unweighted: DamageResponse[];
  /**
   * How much of the ROSTER's damage carried a type at all, 0..1.
   *
   * ⚠ A SHARE IS A SHARE OF WHAT COULD BE TYPED, NOT OF EVERYTHING. The Veilwood Crone types a
   * quarter of her output, and all of that quarter is slashing — so a slashing resistance reads
   * as removing 100% of incoming when it removes at most a quarter of it, and a bludgeoning one
   * reads as 0% when it may remove plenty. Neither is fixable here (the fix is typing the stat
   * block), so the coverage is carried out so the panel can say how much of the fight the
   * multiplier was actually derived from.
   */
  mixCoverage: number;
};

const EMPTY: PartyMitigation = {
  multiplier: 1, resisted: [], reactionPerRound: 0, reactions: [],
  displacedByBond: [], withoutStatedResponses: [], unweighted: [], mixCoverage: 0,
};

function actionsOf(actor: Actor): Array<{ tab: string; action: Record<string, unknown> }> {
  const out: Array<{ tab: string; action: Record<string, unknown> }> = [];
  for (const [tab, list] of Object.entries(actor.tabs ?? {})) {
    if (!Array.isArray(list) || tab === "resources") continue;
    for (const a of list as Record<string, unknown>[]) if (a) out.push({ tab, action: a });
  }
  return out;
}

/**
 * The reaction-channel damage reduction this character can spend, best first.
 *
 * ⚠ BOTH HALVES ARE AUTHORED FIELDS, NOT PROSE. `economyCost` says it is a Reaction and
 * `metadata.effectKind` says the dice REDUCE rather than deal — the same field the roll button
 * reads so it never calls a reduction "Roll Damage". Uncanny Dodge prints no dice at all (it
 * halves), which `effectKind: "reduction"` with no damage expression says exactly.
 */
function reactionReductions(actor: Actor, incomingDamagePerHit: number): ReactionMitigation[] {
  const out: ReactionMitigation[] = [];
  for (const { action } of actionsOf(actor)) {
    const economy = (action.economyCost as string[] | undefined) ?? [];
    if (!economy.includes("reaction")) continue;
    const m = (action.metadata ?? {}) as Record<string, unknown>;
    /**
     * ⚠ `effectKind` IS THE ONLY SIGNAL, AND THAT IS DELIBERATE. There is no "reduction" outcome
     * mode — the outcome modes describe how a roll RESOLVES, not what its dice MEAN — so an
     * untagged reaction is not read. Inferring one from the label would put "Uncanny Dodge" and
     * "Deflect Missiles" in a name list, which is the prose inference this whole file exists to
     * avoid and which would silently miss every homebrew equivalent. The fix for an unread
     * reaction is to tag the action, not to widen this test.
     */
    const kind = String(m.effectKind ?? "").toLowerCase();
    if (kind !== "reduction") continue;

    const label = String(action.label ?? "(unnamed reaction)");
    const printed = String(m.damage ?? "").trim();
    if (printed) {
      let resolvedText = printed;
      try { resolvedText = resolveFormulaVars(printed, actor as never); } catch { /* keep the raw */ }
      if (/@[A-Za-z]/.test(resolvedText)) continue;   // unresolved: reported by the caller, not guessed
      const amount = damageExpressionAverage(resolvedText);
      if (amount > 0) out.push({ actor: actor.name, action: label, amount, basis: "printed" });
      continue;
    }
    /**
     * ⚠ NO DICE MEANS IT HALVES, AND THAT NEEDS THE HIT IT IS HALVING. Uncanny Dodge removes half
     * of one attack's damage, so its value is a property of what is hitting the party — not of the
     * character. With no incoming figure there is nothing to halve and it contributes nothing
     * rather than a guess.
     */
    if (incomingDamagePerHit > 0) {
      out.push({ actor: actor.name, action: label, amount: incomingDamagePerHit / 2, basis: "halved" });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/**
 * Price the party's own mitigation against this roster.
 *
 * @param incoming what the hostile side throws — the mix for resistances, and the per-hit figure a
 *   halving reaction needs. Both come from the roster the checker already built.
 * @param bondPerActor what each character's BOND already contributes per round, so the Reaction
 *   budget is contended rather than counted twice.
 */
export function partyMitigationFromActors(
  actors: readonly Actor[],
  incoming: { mix?: PartyDamageMix; damagePerHit?: number } = {},
  bondPerActor: Readonly<Record<string, number>> = {},
): PartyMitigation {
  if (actors.length === 0) return EMPTY;

  const resisted: PartyMitigation["resisted"] = [];
  const unweighted: DamageResponse[] = [];
  const withoutStatedResponses: string[] = [];
  const reactions: ReactionMitigation[] = [];
  const displacedByBond: PartyMitigation["displacedByBond"] = [];

  /**
   * ⚠ EVERY CHARACTER'S RESPONSES ARE PRICED TOGETHER, NOT ONE AT A TIME.
   *
   * `priceDamageResponses` combines responses on ONE pass fraction because they are shares of the
   * same incoming pool — being immune to cold and resistant to fire removes cold's share and half
   * of fire's. Pricing each PC separately and multiplying their multipliers would compound
   * overlapping shares, so one Barbarian resisting B/P/S would read as though the whole party did.
   *
   * ⚠ AND A RESISTANCE ONE CHARACTER HAS IS NOT A RESISTANCE THE PARTY HAS. Only the share of
   * incoming damage aimed at THAT character is eligible, and with no targeting model the honest
   * proxy is their share of the party — so each response is scaled by `1 / partySize` before the
   * combined pass fraction is taken. Christopher's Barbarian resists three physical types; the
   * party of six does not become half as squishy because one of them raged.
   */
  const scaled: DamageResponse[] = [];
  for (const actor of actors) {
    /** The class and lineage rules first, then anything entered — see `damageResponsesForActor`. */
    const own = damageResponsesForActor(actor);
    if (own.length === 0) { withoutStatedResponses.push(actor.name); continue; }
    /** Built once per character, because a gated response has to ask it how big its pool is. */
    const ledger = resourceLedgerFromActor(actor);
    for (const r of own) {
      const share = Number.isFinite(r.share as number)
        ? (r.share as number)
        : incoming.mix?.usable ? (incoming.mix.shares[r.type.trim().toLowerCase()] ?? 0) : undefined;
      if (share === undefined) { unweighted.push(r); continue; }

      /**
       * ⚠ A GATED RESISTANCE COVERS THE FIGHTS ITS RESOURCE COVERS, AND THAT IS A COUNT, NOT A
       * GUESS. Rage lasts a minute, so one use covers a whole fight; the question is how many
       * fights out of the day's five it can cover, which is exactly the pool's total uses. The
       * ledger already counts `start + recovered x rests`, so this asks it rather than assuming
       * a Barbarian rages in every fight (5/5) or in only the ones they started with (2/5).
       */
      let uptime = 1;
      let uptimeNote: string | undefined;
      if (r.gatedByResource) {
        const row = ledger.rows.find(x => x.resource.trim().toLowerCase() === r.gatedByResource!.trim().toLowerCase());
        if (row) {
          uptime = Math.min(1, row.totalUses / RESOURCE_DAY.fightsPerLongRest);
          uptimeNote = `${row.totalUses} use${row.totalUses === 1 ? "" : "s"} across ${RESOURCE_DAY.fightsPerLongRest} fights`;
        } else {
          /**
           * ⚠ NO POOL ON THE SHEET IS NOT "ALWAYS ON". The rule says the resistance costs a use;
           * if the sheet carries no such pool the app cannot say how many fights it covers, and
           * counting it as every fight would be the most generous possible reading of a gap.
           */
          uptime = 0;
          uptimeNote = `no "${r.gatedByResource}" pool on this sheet, so the app cannot say how many fights it covers`;
        }
      }

      const eligible = (share / actors.length) * uptime;
      scaled.push({ ...r, share: eligible });
      resisted.push({
        actor: actor.name, response: r, share: eligible,
        source: r.source,
        ...(uptimeNote ? { uptime, uptimeNote } : {}),
        /**
         * A qualifier that IS the gate has been answered by the count above, so it is no longer
         * an unresolved one. Only a condition nothing could evaluate is reported as unread.
         */
        qualifierUnresolved: Boolean(r.qualifier?.trim()) && !r.gatedByResource,
      });
    }
  }
  const priced = priceDamageResponses(scaled, incoming.mix);

  /**
   * ⚠ THE REACTION BUDGET IS ONE PER CHARACTER AND THE BOND IS ALREADY IN IT.
   *
   * `Action Timing` row 22 puts defensive reactions, spell reactions and bond reactions in the
   * same pool. So each character contributes the BEST single reaction available to them, and when
   * the bond's is better the class one is displaced — named, not dropped, so the panel can show
   * why a Rogue's Uncanny Dodge is not in the total.
   */
  let reactionPerRound = 0;
  for (const actor of actors) {
    const best = reactionReductions(actor, incoming.damagePerHit ?? 0)[0];
    if (!best) continue;
    const bond = bondPerActor[actor.name] ?? 0;
    if (bond >= best.amount) {
      displacedByBond.push({ actor: actor.name, action: best.action, amount: best.amount, bondAmount: bond });
      continue;
    }
    /**
     * The bond figure is already counted by the caller, so only the DIFFERENCE is added — spending
     * the Reaction on the class feature instead of the bond gains what the swap is worth, never
     * the whole feature on top of a bond already in the total.
     */
    reactionPerRound += best.amount - bond;
    reactions.push(best);
  }

  return {
    multiplier: priced.multiplier,
    resisted,
    reactionPerRound,
    reactions,
    displacedByBond,
    withoutStatedResponses,
    unweighted: [...unweighted, ...priced.unweighted],
    mixCoverage: incoming.mix?.coverage ?? 0,
  };
}
