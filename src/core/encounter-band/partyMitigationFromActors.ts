/**
 * WHAT THE PARTY'S OWN CLASSES PREVENT — resistances, and the Reaction that stops one hit.
 *
 * The checker has priced a CREATURE's typed responses against the party's damage mix since
 * `damageResponsePricing` existed. The party side of that question was never asked, and this is
 * the mirror of it: the party's responses priced against the ROSTER's damage mix, with the same
 * function, so there is one model of "what does a resistance remove" pointed both ways.
 *
 * ─── ⚠ WHY THIS TOOK SO LONG, STATED PLAINLY ────────────────────────────────────────────────
 *
 * There was nowhere to put the data. A creature carries `stats.defenses`; an `Actor` carried no
 * equivalent field at all, so Ash's *"Resistance to Necrotic and Radiant damage"* and Ripsnarl's
 * Rage resistance to bludgeoning, piercing and slashing existed only as English inside a feature's
 * description. Reading a mechanic out of prose is the one thing this codebase refuses to do, and
 * "the class is called Barbarian so it must resist B/P/S" is exactly that with extra steps. So
 * `Actor.damageResponses` is a STATED field, entered the way a creature's is, and everything below
 * prices what the DM said and reports every character who said nothing.
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
 * ⚠ AND A CONDITIONAL RESISTANCE IS NOT AN UNCONDITIONAL ONE. Rage lasts as long as the rage does.
 * The qualifier is where a DM says so, nothing here can evaluate it, and the honest handling is
 * the same one `priceDamageResponses` already uses: price the full share as the UPPER BOUND and
 * report that the qualifier was not read — never silently narrow it, never silently drop it.
 */

import type { Actor } from "../types/actor";
import { priceDamageResponses, type DamageResponse } from "./damageResponsePricing";
import { partyDamageMixFromActors, type PartyDamageMix } from "./partyDamageMix";
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
  templates: ReadonlyArray<{ name?: string; actions?: ReadonlyArray<{ name?: string; damage?: string; damageType?: string }> }>,
): PartyDamageMix {
  return partyDamageMixFromActors(templates.map(t => ({
    name: t.name,
    actions: (t.actions ?? []).map(a => ({
      label: a.name,
      metadata: { damage: a.damage, damageType: a.damageType },
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
  resisted: Array<{ actor: string; response: DamageResponse; share: number; qualifierUnresolved: boolean }>;
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
  /** Characters carrying no stated `damageResponses` at all. A zero that says whose it is. */
  withoutStatedResponses: string[];
  /** Responses that could not be weighed, because the roster's damage is untyped. */
  unweighted: DamageResponse[];
};

const EMPTY: PartyMitigation = {
  multiplier: 1, resisted: [], reactionPerRound: 0, reactions: [],
  displacedByBond: [], withoutStatedResponses: [], unweighted: [],
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
    const own = actor.damageResponses ?? [];
    if (own.length === 0) { withoutStatedResponses.push(actor.name); continue; }
    for (const r of own) {
      const share = Number.isFinite(r.share as number)
        ? (r.share as number)
        : incoming.mix?.usable ? (incoming.mix.shares[r.type.trim().toLowerCase()] ?? 0) : undefined;
      if (share === undefined) { unweighted.push(r); continue; }
      const eligible = share / actors.length;
      scaled.push({ ...r, share: eligible });
      resisted.push({ actor: actor.name, response: r, share: eligible, qualifierUnresolved: Boolean(r.qualifier?.trim()) });
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
  };
}
