/**
 * THE ACCURACY INPUTS A FEAT NEEDS, READ OFF THE CHARACTER AND THE FIGHT.
 *
 * Christopher, 2026-08-31: *"you said the shield problem of need shield was fixed and the GWM would
 * be correct."*
 *
 * ── ⚠ WHAT WAS ACTUALLY FIXED BEFORE THIS, AND WHY IT WAS NOT ENOUGH ────────────────────────
 *
 * `EquipmentBagEditor` learned to derive `metadata.slot` from an item's type, so `offHandBlocker`
 * can finally find a worn shield — no item in the equipment library states a slot, so that lookup
 * had been returning nothing for everybody. That fix is real and it is a PREREQUISITE for this one.
 *
 * It changed nothing about Shield Master, because `partyFeatsFromActors` never passed equipment to
 * the feat evaluator AT ALL. Its context was `level`, `PB`, `partySize`, `round`, `baseDpr`,
 * `baseEhp` and five `resolved*` flags; its `ActorLike` had three fields — name, level, tabs. There
 * was no route from a worn shield to `shieldEquipped` regardless of what the lookup could find.
 *
 * **I fixed the lookup and reported it as fixing the feature.** This module is the missing half:
 * the SUPPLY. It is the same fault as the lair — correct code that nothing reached — and it is why
 * `check:feats` now asserts the values ARRIVE rather than that they can be computed.
 *
 * ── WHAT MAY BE DERIVED, AND WHAT MAY NOT ───────────────────────────────────────────────────
 *
 * The workbook's own eligibility line says to read *"the character's class, proficiency, equipment,
 * and ability records"*, so reading them is the intended behaviour, not an inference.
 *
 * ⚠ BUT AN ABSENT INPUT STAYS ABSENT. A character with no readable weapon returns no accuracy
 * numbers and the feat still reports NEEDS_INPUT. `partyFeatsFromActors` already holds this line —
 * *"any feat needing them reports NEEDS_INPUT rather than being priced off a plausible-looking
 * guess"* — and a zero that looks like an answer is the thing it was protecting against.
 */

import { damageExpressionAverage } from "../../core/encounter-band/damageExpression";
import { attackHitProbability } from "../../core/encounter-band/checkerV2";

type ActionLike = {
  label?: string;
  metadata?: {
    attack?: string;
    damage?: string;
    slot?: string;
    equipped?: boolean;
    attackUses?: number;
    spell?: unknown;
  };
};

export type ActorLikeForFeats = {
  name?: string;
  level?: number;
  attacksPerAction?: number;
  actions?: ActionLike[];
  tabs?: Record<string, ActionLike[] | undefined>;
};

/** Every action on the actor, wherever it is filed. */
function allActions(actor: ActorLikeForFeats): ActionLike[] {
  const fromTabs = Object.values(actor.tabs ?? {}).flatMap(t => (Array.isArray(t) ? t : []));
  return [...(actor.actions ?? []), ...fromTabs];
}

/** Worn means EQUIPPED, and an action that says nothing is worn — the same read `offHandBlocker` uses. */
const isWorn = (a: ActionLike): boolean => a.metadata?.equipped !== false;

/**
 * ⚠ THE SHIELD IS FOUND BY SLOT, WHICH IS WHY THE SLOT FIX HAD TO LAND FIRST. Before items derived
 * a slot from their type this returned false for a character visibly holding the Marrow Shield.
 */
export function shieldEquipped(actor: ActorLikeForFeats): boolean {
  return allActions(actor).some(a => isWorn(a) && a.metadata?.slot === "shield");
}

/** "+9", "9", "+9 to hit" → 9. Anything unreadable is not a number and must not become one. */
function parseAttackBonus(raw: string | undefined): number | undefined {
  const m = String(raw ?? "").match(/([+-]?\s*\d+)/);
  if (!m) return undefined;
  const n = Number(m[1].replace(/\s+/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export type AttackProfile = {
  attacks: number;
  attackBonus: number;
  perHitDamage: number;
  hitChance: number;
  onceHit: number;
};

/**
 * The character's WEAPON attack, as the feats mean it.
 *
 * ⚠ ONE ATTACK, NOT ALL OF THEM. A sheet lists every weapon the character can swing; it does not
 * swing all of them. The representative one is the highest EXPECTED damage against this fight's AC
 * — accuracy and damage together, because the biggest die on the worst attack bonus is not the
 * attack a feat is going to be used with.
 *
 * ⚠ AND SPELLS ARE NOT WEAPON ATTACKS. Great Weapon Master is a heavy-weapon feat; a cast never
 * benefits from Extra Attack and must not set the profile.
 */
export function attackProfile(actor: ActorLikeForFeats, targetAC: number): AttackProfile | undefined {
  const candidates = allActions(actor)
    .filter(a => isWorn(a) && !a.metadata?.spell && a.metadata?.attack && a.metadata?.damage);
  if (candidates.length === 0) return undefined;

  let best: AttackProfile | undefined;
  for (const a of candidates) {
    const attackBonus = parseAttackBonus(a.metadata?.attack);
    if (attackBonus === undefined) continue;
    const perHitDamage = damageExpressionAverage(a.metadata?.damage);
    if (!(perHitDamage > 0)) continue;

    // A per-action override wins over the actor's Extra Attack, exactly as the card resolves it.
    const attacks = Math.max(1, Math.round(a.metadata?.attackUses ?? actor.attacksPerAction ?? 1));
    const hitChance = attackHitProbability(attackBonus, targetAC);
    const profile: AttackProfile = {
      attacks,
      attackBonus,
      perHitDamage,
      hitChance,
      /**
       * ⚠ "ONCE PER TURN" IS NOT "ON EVERY HIT". Great Weapon Master adds PB to ONE attack a turn,
       * so what it is worth is the chance that AT LEAST ONE attack lands — not the chance a given
       * attack lands. With two attacks at 60% those are 0.84 and 0.60, and using the second
       * under-prices the feat by a quarter.
       */
      onceHit: 1 - Math.pow(1 - hitChance, attacks),
    };
    if (!best || profile.hitChance * profile.perHitDamage * profile.attacks
      > best.hitChance * best.perHitDamage * best.attacks) best = profile;
  }
  return best;
}

/**
 * What this character contributes to a feat context. Keys are OMITTED, never defaulted — an absent
 * key is what makes the evaluator report NEEDS_INPUT instead of pricing a guess.
 */
export function featContextFromActor(
  actor: ActorLikeForFeats,
  targetAC: number | undefined,
): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = { shieldEquipped: shieldEquipped(actor) };
  if (targetAC === undefined || !Number.isFinite(targetAC)) return out;
  const p = attackProfile(actor, targetAC);
  if (!p) return out;
  return { ...out, ...p, targetAC };
}
