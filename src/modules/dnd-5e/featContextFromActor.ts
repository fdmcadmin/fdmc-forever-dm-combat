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
import { resolveFormulaVars } from "../../core/state/resolveFormulaVars";
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
/**
 * The attack string with its @-variables resolved against the actor holding it.
 *
 * ⚠ WITHOUT THIS, A REAL CHARACTER HAS NO READABLE ATTACK BONUS AT ALL. Actions store what the
 * sheet was authored with — `1d20+@ATK`, `1d20+@PROF+@STR` — and @ATK is a COMPLETE bonus
 * (max(STR,DEX) modifier + proficiency). Parsing the raw string finds no number to trust, so the
 * actor drops out of the party's hit-chance average and the fight is priced against whoever is
 * left. Christopher: *"thats why we have the app read current party, so it is suppose to read the
 * actual chance to hit which for my party it should read rip having a +8 to hit, lyrielle having a
 * staggering +9 to hit"*.
 *
 * A string that still carries an @-token after resolution returns undefined rather than a partial
 * number — an unresolved variable is a missing input, and this file's rule is that a key is
 * omitted rather than defaulted.
 */
function resolvedAttackText(raw: string | undefined, actor: ActorLikeForFeats): string | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  if (!/@[A-Za-z]/.test(text)) return text;
  try {
    const out = resolveFormulaVars(text, actor as never);
    return /@[A-Za-z]/.test(out) ? undefined : out;
  } catch {
    return undefined;
  }
}

function parseAttackBonus(raw: string | undefined): number | undefined {
  /**
   * ⚠ THIS TOOK THE FIRST NUMBER IN THE STRING, AND THE FIRST NUMBER IS USUALLY THE DIE COUNT.
   *
   * The old body was `String(raw).match(/([+-]?\s*\d+)/)` — one match, no `/g`. Against the roll
   * an action actually stores, "1d20 + 7", the first match is the "1" of "1d20", so a +7 attack
   * was read as +1. A multi-term bonus lost everything after the first term too: "+3 +1" read as
   * +3, dropping exactly the magic-weapon bonus.
   *
   * ⚠ AND SINCE 2026-09-01 THIS NUMBER PRICES MONSTERS, NOT JUST FEATS. `traitFactorsFor` derives
   * a persistent accuracy defence as `1/hitChance`, so an under-read attack bonus inflates every
   * such creature. Christopher: *"there is no way a BC party can ever have 45% chance to hit, all
   * actors have 1+ weapons, and a PB of 3+"*. He is right: four actors averaging +7 against the
   * Twilight Pond mean AC of 14 hit on 70%, not 45%, and the 45% was three actors read as +1.
   *
   * Dice are stripped BEFORE the signed terms are summed, so the die count can never be mistaken
   * for a bonus, and an unresolved @-variable returns undefined rather than a guess — the same
   * "absent, not defaulted" rule the rest of this file follows.
   */
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  if (/@[A-Za-z]/.test(text)) return undefined;
  const withoutDice = text.replace(/\d*\s*d\s*\d+/gi, " ");
  let total = 0;
  let found = false;
  for (const m of withoutDice.matchAll(/([+-])\s*(\d+)/g)) {
    total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
    found = true;
  }
  if (found) return total;
  const bare = withoutDice.match(/(-?\d+)/);
  return bare ? Number.parseInt(bare[1], 10) : undefined;
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
    const attackBonus = parseAttackBonus(resolvedAttackText(a.metadata?.attack, actor));
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
