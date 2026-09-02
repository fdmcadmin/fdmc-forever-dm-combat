/**
 * USABLE HEALING — what a heal is actually worth, once the slot is spent.
 *
 * Christopher, 2026-09-02: *"Healing must be resolved through the same resource/slot system as
 * other spell uses… expected rolled healing at the actual cast level + legal modifiers, then
 * capped by the target's missing HP and reduced by any active healing modifier or prevention
 * effect. Overhealing has zero sustain value."*
 *
 * ─── THE WORKBOOK IS THE AUTHORITY, AND IT ALREADY SAYS THIS ────────────────────────────────
 *
 * `pricingPrimitives.generated.ts` carries the contract verbatim:
 *
 *   healing                      channel `sustain`, model `round_state` —
 *                                *"Expected usable same-encounter healing, capped by missing
 *                                HP/overheal and action/resource availability."*
 *   healing_received_multiplier  *"healing received is halved"* → 0.5
 *                                *"cannot regain HP / healing prevented"* → 0
 *
 * So nothing here is invented. This is the one place that arithmetic lives, so the live card and
 * the encounter model cannot disagree about what a Cure Wounds was worth.
 *
 * ─── ⚠ WHY THIS IS NOT A SECOND SUSTAIN POOL ────────────────────────────────────────────────
 *
 * *"The healing is therefore part of the value obtained from spending that slot, not a second free
 * sustain pool. A slot spent healing cannot also be spent on damage/control."*
 *
 * That is why `partyHealingFromActors` refuses to count Cure Wounds and friends: a levelled slot
 * is ALREADY in the party DPR curve, so adding its healing on top would spend the same slot twice
 * — once as damage, once as HP. The trade is real and it is the caster's to make; what the model
 * must never do is take both sides of it.
 *
 * Flat pools that can do nothing else — Lay on Hands — are not a trade and are counted there.
 *
 * ─── ⚠ RESOLVE ONCE. THE HP STATE IS THE SOURCE OF TRUTH ────────────────────────────────────
 *
 * *"Do not double-count healing if a runtime total already contains the healing event… resolve the
 * heal once, update current HP, and let the resulting HP state drive later sustain/down
 * calculations."*
 *
 * `usableHealing` returns what to ADD to current HP and nothing else. It does not accumulate, it
 * does not remember, and it must not be summed into a separate "healing done" figure that then
 * also gets subtracted from incoming damage — the HP number it produced already carries the
 * effect.
 */

import { damageExpressionAverage } from "../encounter-band/damageExpression";
import { scaleUpcastRider } from "../dice/diceFormula";

/**
 * The multiplier an active effect imposes on healing RECEIVED.
 *
 * 1 = untouched, 0.5 = halved, 0 = prevented. The workbook's `healing_received_multiplier`.
 */
export type HealingMultiplier = number;

/** `cannot regain hit points` and its family — the prevention half of the primitive. */
export function healingMultiplierFromText(text: string | undefined): HealingMultiplier {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return 1;
  if (/\b(?:can(?:not|'t)\s+regain\s+(?:hit\s+points|hp)|healing\s+(?:is\s+)?prevented|no\s+healing)\b/.test(t)) return 0;
  if (/\bhealing\s+(?:received\s+)?is\s+halved\b|\bhalf\s+healing\b/.test(t)) return 0.5;
  return 1;
}

/**
 * The healing formula at the level the spell is ACTUALLY cast at.
 *
 * ⚠ THE UPCAST RIDER IS PER EXTRA LEVEL, NOT PER LEVEL. `upcastDamage` is authored as what ONE
 * extra slot level adds — "2d8" for Cure Wounds — and `scaleUpcastRider` multiplies it by the
 * distance above the spell's own base. Casting Cure Wounds at 4th is base + 2d8 × 3, not 2d8 × 4.
 */
export function healingFormulaAtLevel(opts: {
  base: string | undefined;
  /** What one extra slot level adds. Absent = the spell does not upcast by dice. */
  upcast?: string;
  /** The spell's own lowest castable level. */
  baseLevel?: number;
  /** The level the player actually spent. Absent = as authored. */
  castLevel?: number;
}): string {
  const base = (opts.base ?? "").trim();
  const upcast = (opts.upcast ?? "").trim();
  const baseLevel = Number(opts.baseLevel ?? 0);
  const castLevel = Number(opts.castLevel ?? baseLevel);
  if (!upcast || !Number.isFinite(baseLevel) || !Number.isFinite(castLevel)) return base;
  const steps = Math.max(0, Math.floor(castLevel - baseLevel));
  if (steps <= 0) return base;
  const rider = scaleUpcastRider(upcast, steps);
  if (!rider) return base;
  return base ? `${base} + ${rider}` : rider;
}

/** Expected (average) healing at the level actually cast. */
export function expectedHealingAtLevel(opts: Parameters<typeof healingFormulaAtLevel>[0]): number {
  return damageExpressionAverage(healingFormulaAtLevel(opts));
}

export type UsableHealing = {
  /** What the dice said, before the target's state is considered. */
  rolled: number;
  /** After the healing-received multiplier — still before the missing-HP cap. */
  afterMultiplier: number;
  /** What actually reaches the target's HP. THIS is the sustain value. */
  usable: number;
  /** Healing that landed on a full target. Worth exactly nothing. */
  overheal: number;
  /** True when an effect stopped the heal outright (multiplier 0). */
  prevented: boolean;
};

/**
 * What a heal is worth against a specific target's state.
 *
 * ⚠ ORDER MATTERS AND IT IS NOT ARBITRARY. The multiplier applies to healing RECEIVED, so it
 * comes first; the missing-HP cap then bounds what is left. Capping first and halving after would
 * let a halved heal on a nearly-full target read higher than the cap it was supposed to respect.
 */
export function usableHealing(opts: {
  amount: number;
  /** 1 untouched, 0.5 halved, 0 prevented. */
  multiplier?: HealingMultiplier;
  /** Target's current HP. */
  current: number;
  /** Target's max INCLUDING any temporary max-HP boost — heal up to what is usable today. */
  effectiveMax: number;
}): UsableHealing {
  const rolled = Math.max(0, Number(opts.amount) || 0);
  const multiplier = Math.max(0, Number(opts.multiplier ?? 1));
  const afterMultiplier = rolled * multiplier;
  const missing = Math.max(0, Number(opts.effectiveMax) - Number(opts.current));
  const usable = Math.min(afterMultiplier, missing);
  return {
    rolled,
    afterMultiplier,
    usable,
    overheal: Math.max(0, afterMultiplier - usable),
    prevented: multiplier === 0 && rolled > 0,
  };
}
