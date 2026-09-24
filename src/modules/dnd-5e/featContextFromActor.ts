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
import { rerollGain } from "../../core/encounter-band/rerollPricing";

type ActionLike = {
  label?: string;
  /** What the row spends — read for whether a Bonus Action or Reaction is still free. */
  economyCost?: string[];
  actionKind?: string;
  /** Where a weapon's TYPE is stated — `BASE_WEAPONS` tags "heavy", "martial", "reach". See `isHeavyWeapon`. */
  tags?: string[];
  /** "Melee One-Handed", "Melee Two-Handed", "Melee Versatile", "Ranged Two-Handed" — a stated field. */
  category?: string;
  metadata?: {
    attack?: string;
    damage?: string;
    slot?: string;
    equipped?: boolean;
    attackUses?: number;
    spell?: unknown;
    details?: string;
    damageType?: string;
    /** The toggle, for a hand-built weapon row that carries no SRD tags. */
    heavyWeapon?: boolean;
  };
};

export type ActorLikeForFeats = {
  name?: string;
  level?: number;
  /** Stated on the sheet; `CON_mod`, `CHA_mod` and `maxHp` are read from here, never re-derived. */
  abilityScores?: Record<string, { score?: number } | undefined>;
  stats?: { hp?: { max?: number } };
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

/**
 * IS THIS ATTACK MADE WITH A HEAVY WEAPON — the gate Great Weapon Master was missing entirely.
 *
 * Christopher, 2026-09-23, quoting the 2024 PHB: Heavy Weapon Mastery applies *"when you hit a creature
 * with a weapon that has the Heavy property"*. The workbook row had no such gate, so a character leading
 * with a rapier priced exactly like one leading with a greataxe.
 *
 * ⚠ THE TYPE IS A STATED FIELD, NOT SOMETHING READ OUT OF THE NAME. Christopher, same day: *"the SRD
 * weapons should have the item type listed but we simply have it as a toggleable to simplify it for the
 * GWM and even things such as Archery and hunter's mark since the app doesnt have a targeting function
 * and i dont want to build one."* They do list it — `BASE_WEAPONS` tags the greataxe, greatsword, maul,
 * glaive, halberd, pike and heavy crossbow `"heavy"` — so this reads the TAG. A first pass read the
 * label and the description too, which is the prose inference this codebase does not make about authored
 * data: it would have called a "Heavy Cloak" a heavy weapon and missed any weapon not named like one.
 *
 * `metadata.heavyWeapon` is the toggle for a hand-built row that carries no tags. A weapon that says
 * neither is not Heavy here, and the feat prices at zero rather than guessing either way.
 */
export function isHeavyWeapon(a: ActionLike): boolean {
  if (a.metadata?.heavyWeapon === true) return true;
  return (a.tags ?? []).some(t => String(t).trim().toLowerCase() === "heavy");
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
function resolvedFormulaText(raw: string | undefined, actor: ActorLikeForFeats): string | undefined {
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
  /** 1 when the weapon this profile came from prints the Heavy property. Great Weapon Master's gate. */
  heavyWeaponEquipped: number;
  /** Expected damage from rerolling one of this attack's misses — the workbook's `attackRerollGain`. */
  attackRerollGain: number;
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
  // Which row each profile came from — the facts below are that ROW's, not the bag's.
  const profileSource = new Map<AttackProfile, ActionLike>();
  for (const a of candidates) {
    const attackBonus = parseAttackBonus(resolvedFormulaText(a.metadata?.attack, actor));
    if (attackBonus === undefined) continue;
    /**
     * ⚠ RESOLVE THE DAMAGE TOO, OR THE MODIFIER IS SILENTLY DROPPED — AND SO IS EVERYTHING
     * AFTER IT.
     *
     * The attack string has been resolved since 0.8.21.4; the damage string was still passed raw.
     * `damageExpressionAverage` cannot read an @-token, so "1d12+@STR" averaged 6.5 instead of
     * 11.5 — and "1d8+@DEX+2" averaged 6.5, losing the magic weapon's +2 along with the DEX,
     * because the unresolved term takes the rest of the expression with it.
     *
     * That understated every weapon this returns, which is the number the DPR-channel feats are
     * priced against and the number a party's own offence is read from. Same rule as the bonus:
     * a string that still carries an @-token after resolution is a missing input, not a partial
     * number, so the candidate is skipped rather than averaged low.
     */
    const perHitDamage = damageExpressionAverage(resolvedFormulaText(a.metadata?.damage, actor));
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
      /**
       * ⚠ THE WEAPON THIS PROFILE IS, NOT ANY WEAPON IN THE BAG. A character who leads with a rapier is
       * swinging the rapier; a greataxe left in the pack does not earn Great Weapon Master its damage.
       */
      heavyWeaponEquipped: isHeavyWeapon(a) ? 1 : 0,
      /**
       * ⚠ WHAT ONE REROLL OF THIS ATTACK IS WORTH — the workbook's `attackRerollGain`, and the
       * reason Lucky reported NEEDS_INPUT forever. It is not a new model: `rerollPricing` is the
       * same arithmetic the checker uses for an item's reroll charges, so a feat's reroll and an
       * item's are priced by one rule.
       *
       * Lucky still asks for `luckPointsUsedOnAttacks`, which is a genuine allocation — points can
       * go to a save or an enemy's attack roll instead — and is not this file's to decide.
       */
      attackRerollGain: rerollGain({
        method: "reroll", attackBonus, targetAc: targetAC, perHitDamage,
      })?.value ?? 0,
    };
    profileSource.set(profile, a);
    if (!best || profile.hitChance * profile.perHitDamage * profile.attacks
      > best.hitChance * best.perHitDamage * best.attacks) best = profile;
  }
  if (best) bestSource = profileSource.get(best);
  return best;
}

/** The row the last `attackProfile` chose, so `featContextFromActor` can read its stated fields. */
let bestSource: ActionLike | undefined;

/**
 * What this character contributes to a feat context. Keys are OMITTED, never defaulted — an absent
 * key is what makes the evaluator report NEEDS_INPUT instead of pricing a guess.
 */
/**
 * THE FACTS A SHEET ALREADY STATES — the other half of why 42 feats reported NEEDS_INPUT.
 *
 * `attackProfile` supplied the numbers a fight needs (bonus, damage, hit chance). What it never
 * supplied is what the SHEET says about the weapon in hand and the economy around it: which hand it
 * takes, what it is made of, what it deals, and whether this character's Bonus Action and Reaction are
 * still free. Every one of those is a stated field, so none of it is inferred from prose.
 *
 * ⚠ A KEY IS OMITTED, NEVER DEFAULTED. That is this file's standing rule and it is what makes a feat
 * report NEEDS_INPUT instead of pricing off a zero. A weapon whose category the sheet does not state
 * contributes no one/two-handed key at all rather than a 0 that reads as "not two-handed".
 */
function statedFacts(actor: ActorLikeForFeats, a: ActionLike, p: AttackProfile): Record<string, number> {
  const out: Record<string, number> = {};
  const tags = (a.tags ?? []).map(t => String(t).trim().toLowerCase());
  const category = String(a.category ?? "").toLowerCase();
  const damageType = String(a.metadata?.damageType ?? "").toLowerCase();

  /** The workbook's other name for the same count. */
  out.attackCount = p.attacks;
  /** Two attack rolls are two chances, so disadvantage is the square — the same shape `onceHit` uses. */
  out.normalHit = p.hitChance;
  out.disadvantagedHit = p.hitChance * p.hitChance;

  /**
   * THE WEAPON'S OWN DIE, without the modifier riding on it — `(weaponDie+abilityMod)` is how Crossbow
   * Expert and Dual Wielder are written, so handing them `perHitDamage` would count the modifier twice.
   */
  const dice = String(a.metadata?.damage ?? "").match(/\d*\s*d\s*\d+/gi)?.join("+");
  const weaponDie = dice ? damageExpressionAverage(dice) : 0;
  if (weaponDie > 0) out.weaponDie = weaponDie;

  /**
   * ⚠ THE ABILITY IS NAMED IN THE ATTACK STRING, so it is read there rather than guessed from the
   * weapon's properties. `@ATK` is a COMBINED bonus (modifier + proficiency) and cannot be split
   * without the proficiency, so a sheet using it contributes no `abilityMod` at all.
   */
  const token = /@(STR|DEX|CON|INT|WIS|CHA)\b/i.exec(String(a.metadata?.attack ?? ""));
  if (token) {
    const mod = Number(resolvedFormulaText(`@${token[1].toUpperCase()}`, actor));
    if (Number.isFinite(mod)) out.abilityMod = mod;
  }

  /**
   * WHICH HAND IT TAKES. `BASE_WEAPONS` states the category ("Melee One-Handed", "Melee Two-Handed",
   * "Melee Versatile") and tags `versatile` / `light`, so both gates are stated fields.
   */
  const twoHanded = category.includes("two-handed") || tags.includes("versatile");
  const oneHanded = category.includes("one-handed");
  const hitsPerTurn = p.attacks * p.hitChance;
  if (twoHanded) out.eligibleTwoHandedHits = hitsPerTurn;
  else if (oneHanded) out.eligibleTwoHandedHits = 0;
  if (oneHanded) out.eligibleOneHandedHits = hitsPerTurn;
  else if (twoHanded) out.eligibleOneHandedHits = 0;

  if (tags.includes("light")) { out.legalLightAttack = 1; out.legalExtraAttack = 1; }
  else if (category.includes("melee")) { out.legalLightAttack = 0; out.legalExtraAttack = 0; }

  /** WHAT IT DEALS — Piercer and Slasher, gated on the type the sheet prints. */
  if (damageType) {
    out.eligiblePiercingAttacks = damageType.includes("piercing") ? p.attacks : 0;
    out.eligibleSlashingAttacks = damageType.includes("slashing") ? p.attacks : 0;
    out.eligiblePhysicalHitCount =
      /piercing|slashing|bludgeoning/.test(damageType) ? hitsPerTurn : 0;
  }

  return out;
}

/**
 * ⚠ IS THE BUDGET STILL FREE — AND THIS IS ALSO THE DOUBLE-COUNT GUARD.
 *
 * Ten of the blocked rows ask `reactionAvailable` or `bonusActionAvailable`. The honest answer is not
 * "yes, everyone has one": since 0.8.75.4 a character's authored reaction goes to the tracer, which
 * spends the one Reaction a turn on it. A feat priced as though the Reaction were still free would be
 * paid on a budget something else already took, and the same round would be sold twice.
 *
 * So the budget is available only when nothing on the sheet that DEALS DAMAGE already claims it. A
 * purely defensive reaction (Shield) does not compete for the damage the feat is pricing, and sustain
 * owns it elsewhere.
 */
function budgetFree(actor: ActorLikeForFeats, slot: "reaction" | "bonus"): number {
  const claimed = allActions(actor).some(a => {
    if (!isWorn(a)) return false;
    if (!(a.economyCost ?? []).includes(slot)) return false;
    return Boolean(String(a.metadata?.damage ?? "").trim()) || Boolean(a.metadata?.attack);
  });
  return claimed ? 0 : 1;
}

export function featContextFromActor(
  actor: ActorLikeForFeats,
  targetAC: number | undefined,
): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = { shieldEquipped: shieldEquipped(actor) };
  if (targetAC === undefined || !Number.isFinite(targetAC)) return out;
  /**
   * ⚠ THE ECONOMY KEYS DO NOT NEED A WEAPON, so they are set before the profile is asked for. A
   * caster with no readable attack still has a Reaction, and ten of the blocked rows want to know.
   */
  out.reactionAvailable = budgetFree(actor, "reaction");
  out.bonusActionAvailable = budgetFree(actor, "bonus");
  for (const id of ["str", "dex", "con", "int", "wis", "cha"]) {
    const mod = Number(resolvedFormulaText(`@${id.toUpperCase()}`, actor));
    if (Number.isFinite(mod)) out[`${id.toUpperCase()}_mod`] = mod;
  }
  const maxHp = Number(actor.stats?.hp?.max);
  if (Number.isFinite(maxHp) && maxHp > 0) out.maxHp = maxHp;

  const p = attackProfile(actor, targetAC);
  if (!p) return out;
  const facts = bestSource ? statedFacts(actor, bestSource, p) : {};
  return { ...out, ...p, ...facts, targetAC };
}
