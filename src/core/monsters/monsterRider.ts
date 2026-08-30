/**
 * A RIDER — extra damage an action carries on a hit, as its own authored fact.
 *
 * ⚠ MONSTERS HAD NO WAY TO EXPRESS ONE. A PC action has `metadata.riders`; a creature action had
 * a damage string and nothing else, so the only way to give a creature a rider was to fold it into
 * that string — `"1d12 + 5 slashing + 1d6"` — where it is a number with no name, no type, no
 * cadence and no condition. `damageExpressionAverage` sums every die in the field, so a rider
 * printed in the PROSE instead was worth exactly zero, and one folded into the field was billed on
 * every attack whether or not it should be.
 *
 * Christopher: *"there is no way for me to create a rider for the Reeve."*
 *
 * ── WHAT THE WORKBOOK ASKS FOR ───────────────────────────────────────────────────────────────
 *
 * v10's Pricing Resolver has two primitives for exactly this, and they differ only in cadence:
 *
 *   first_hit_or_once_per_turn_rider   "P(at least one qualifying trigger in the legal turn) x
 *                                       rider EV"
 *   conditional_extra_damage           "P(condition true) x P(trigger succeeds) x extra damage EV"
 *
 * So a rider needs three things beyond its dice: how often it fires, what makes it fire, and
 * whether the creature needs something to be true first. Those are the fields below.
 *
 * ⚠ CADENCE IS THE FIELD THAT CHANGES THE ANSWER MOST. On a two-attack creature a `per-hit` rider
 * is worth twice a `once-per-turn` one, and the difference between "each hit deals an extra 1d6"
 * and "the first hit each turn deals an extra 1d6" is a whole attack's worth of damage.
 */

export type RiderCadence = "per-hit" | "once-per-turn";

export type MonsterRider = {
  /** What the block calls it, so the trace can name what it is billing. */
  name: string;
  /** The extra dice — `"1d6"`. Read the same way any damage field is. */
  damage: string;
  /**
   * ⚠ THE RIDER CARRIES ITS OWN DAMAGE TYPE, because a second type is the whole reason it is a
   * rider and not just more dice on the main line. "9 (2d6+2) Slashing plus 3 (1d6) Fire" is two
   * types, and folding them into one string loses the one the resistances need.
   *
   * Capitalised as the SRD prints it. See `statBlockGrammar`.
   */
  damageType?: string;
  /**
   * `per-hit` rides every hit this action lands. `once-per-turn` fires at most once across the
   * whole turn however many attacks connect — the workbook's "first hit or once per turn".
   */
  cadence: RiderCadence;
  /**
   * How often the thing it needs is TRUE, 0–1. Unset means unconditional.
   *
   * ⚠ THIS IS A PROBABILITY, NOT A TOGGLE, and it is the author's to state. "Against a creature
   * it has marked" or "while bloodied" are conditions the app cannot evaluate — it does not know
   * what the party will do — so the honest model is the workbook's: the author says how often the
   * condition holds and the rider is weighted by it. Unset is read as "always", which is what an
   * unconditional rider is.
   */
  chance?: number;
  /** Why that chance, or what the condition is. Shown wherever the rider is priced. */
  note?: string;
};

/** The share of a rider that actually lands, given its cadence and condition. */
export function riderWeight(rider: MonsterRider, hitChance: number, attacksThisTurn: number): number {
  const condition = Number.isFinite(rider.chance as number)
    ? Math.min(1, Math.max(0, rider.chance as number))
    : 1;
  if (rider.cadence === "per-hit") return condition * hitChance;
  /**
   * ONCE PER TURN: the chance at least ONE of this turn's attacks connects, not the chance one
   * particular attack does. Charging it per attack is the commonest way a once-per-turn rider gets
   * overpriced, and on a three-attack creature it triples it.
   */
  const atLeastOneHit = 1 - Math.pow(1 - hitChance, Math.max(1, attacksThisTurn));
  return condition * atLeastOneHit;
}

/** One line for a card or a trace row: `Bloodscent +1d6 necrotic · once per turn · 50%`. */
export function describeRider(rider: MonsterRider): string {
  const pct = Number.isFinite(rider.chance as number) ? ` · ${Math.round((rider.chance as number) * 100)}%` : "";
  return `${rider.name} +${rider.damage} · ${rider.cadence === "per-hit" ? "every hit" : "once per turn"}${pct}`;
}
