/**
 * WHAT A REROLL IS WORTH — accuracy, not damage.
 *
 * Christopher, 2026-09-23: *"ok but feat pricing such as lucky is there show how is the item reroll not
 * priced the same"*. It was not priced at all. A reroll source carries no damage of its own, so
 * `actorAsCreature` dropped it before it reached anything — the Unfinished Thorn, a Stabilized Band
 * charge and Lucky were each worth exactly zero in every fight the checker has ever priced.
 *
 * A reroll does not add dice to a hit. It converts a MISS into a hit, which is why its value is the
 * damage of the attack it saves multiplied by the chance it saves one. That chance depends on HOW the
 * source changes the roll, and the four methods are genuinely different numbers:
 *
 *   reroll / advantage   throw again: the first roll missed (1−h), the second lands (h)   →  (1−h)·h
 *   flip                 21 − natural: deterministic. A miss at r converts when 21−r ≥ need,
 *                        so the rolls it saves are r ∈ [1, min(need−1, 21−need)]
 *   bonus                add dice to the roll already made: it converts when r < need and
 *                        r + die ≥ need, summed over the die's faces
 *
 * ⚠ ONE THING IS DELIBERATELY NOT COUNTED: a reroll spent on a HIT to fish for a critical. The picker
 * offers it, the table sometimes does it, and pricing it would need a policy for when a player gives up
 * a saved miss for a better hit. The saved miss is the floor and it is the use the feat is named for.
 */

/** The natural d20 face this attack needs against this AC. Clamped: a 1 always misses, a 20 always hits. */
export function faceNeeded(attackBonus: number, targetAc: number): number {
  return Math.min(20, Math.max(2, Math.ceil(targetAc - attackBonus)));
}

export type RerollGain = {
  /** Expected damage this ONE use adds. */
  value: number;
  /** The chance this use converts a miss into a hit — what `value` is `perHitDamage` times. */
  convertChance: number;
  /** Stated so the number can be argued with rather than taken on faith. */
  basis: string;
};

/**
 * What one use of a reroll source is worth against a given attack.
 *
 * `bonusDice` is only read for the `bonus` method and is the dice ADDED to the roll already made.
 * A method whose dice cannot be read returns no gain rather than a guess — the caller names it.
 */
export function rerollGain(input: {
  method: "reroll" | "flip" | "advantage" | "bonus";
  attackBonus: number;
  targetAc: number;
  perHitDamage: number;
  bonusDice?: string;
}): RerollGain | undefined {
  const { method, attackBonus, targetAc, perHitDamage } = input;
  if (!(perHitDamage > 0)) return undefined;
  const need = faceNeeded(attackBonus, targetAc);
  const hit = (21 - need) / 20;
  const miss = 1 - hit;

  if (method === "reroll" || method === "advantage") {
    const convertChance = miss * hit;
    return {
      value: convertChance * perHitDamage,
      convertChance,
      basis: `throws the die again: missed on ${(miss * 100).toFixed(0)}%, lands on ${(hit * 100).toFixed(0)}% of those`,
    };
  }

  if (method === "flip") {
    /**
     * ⚠ NOTHING RANDOM HAPPENS. 21 − natural is already determined by the roll that was made, so this
     * is a count of the faces it rescues, not a probability of a second roll going well. A miss at r
     * becomes 21 − r, which hits when 21 − r ≥ need. Above r = 21 − need the flip cannot save it, and
     * the rolls that were already hits are not misses to convert.
     */
    const rescued = Math.max(0, Math.min(need - 1, 21 - need));
    const convertChance = rescued / 20;
    return {
      value: convertChance * perHitDamage,
      convertChance,
      basis: `the other side of the die rescues naturals 1-${rescued} against a ${need}+`,
    };
  }

  // bonus: the dice are ADDED to the roll already made.
  const die = /(\d*)\s*d\s*(\d+)/i.exec(input.bonusDice ?? "");
  if (!die) return undefined;
  const count = Math.max(1, Number(die[1] || 1));
  const faces = Number(die[2]);
  if (!(faces > 0) || count !== 1) return undefined; // one die is the shape every printed source uses
  /**
   * A natural r misses when r < need and is rescued when r + d ≥ need, so for each face d the rolls
   * it saves are r ∈ [need − d, need − 1]. Counted over the d20's own faces, each equally likely.
   */
  let converted = 0;
  for (let d = 1; d <= faces; d++) {
    const from = Math.max(1, need - d);
    const to = need - 1;
    converted += Math.max(0, to - from + 1);
  }
  const convertChance = converted / (20 * faces);
  return {
    value: convertChance * perHitDamage,
    convertChance,
    basis: `adds ${count}d${faces} to a roll that needed a ${need}+`,
  };
}
