/**
 * MONSTER DAMAGE ESTIMATION — reads a creature's own actions and returns its per-round output.
 *
 * ⚠ THIS FILE USED TO CARRY A THIRD BALANCE MODEL and no longer does (0.7.9.1). Deleted with
 * the rest of the old checker: partySustainForLevel, rawPartyHpForLevel and
 * PARTY_RECOVERY_FACTOR (a party-sustain curve that disagreed with the real one by 35-46%),
 * the ESCALATION_LADDER with buildTargetFor / buildLadderFor, its own pcer / mer / pressure /
 * roundMargin, auditEncounter, and WIGHT_L5_CALIBRATION. Every one of those is now owned by
 * checkerV2.ts, which is the workbook own runtime - PCER, MER and the balance adjustment
 * included. None of them had a single external caller left.
 *
 * What remains is the one job the contract still needs from the app: turning an authored stat
 * block into a DPR figure. The action budget below is the model established at 0.7.1.10-.12
 * and re-confirmed by the v2 contract — activation type comes from the section heading,
 * Recharge controls availability only, and a rechargeable Action replaces the routine Action.
 */

import {
  isMonsterFullAction, isMonsterBonusAction, isMonsterLegendaryAction,
} from "../monsters/runtime/mainMonsterRuntime";
import type { MonsterClassification } from "../monsters/runtime/mainMonsterRuntime";

/** Linear interpolation across a table's level checkpoints, clamped at both ends. */
function interpolate(
  pts: ReadonlyArray<readonly [number, ...number[]]>,
  level: number,
  idx: number,
): number {
  const lv = Math.max(1, Math.min(20, Math.floor(level || 1)));
  if (lv <= pts[0][0]) return pts[0][idx] as number;
  const last = pts[pts.length - 1];
  if (lv >= last[0]) return last[idx] as number;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (lv >= a[0] && lv <= b[0]) {
      if (b[0] === a[0]) return a[idx] as number;
      const t = (lv - a[0]) / (b[0] - a[0]);
      return (a[idx] as number) + ((b[idx] as number) - (a[idx] as number)) * t;
    }
  }
  return last[idx] as number;
}

/** Average of a dice expression's rolled part: "2d10" → 11. */
function diceAverage(count: number, faces: number): number {
  return (count * (faces + 1)) / 2;
}

/**
 * Expected value of a damage string. Handles the shapes the scanner and creature editor
 * actually produce:
 *   "2d10 + 4"                     → 15
 *   "1d8 + 2 slashing + 1d4 cold"  → 9   (every die and flat term counts, types ignored)
 *   "15 (2d10 + 4)"                → 15  (a leading pre-averaged total wins)
 */
export function damageExpressionAverage(expr: string | undefined): number {
  if (!expr) return 0;
  const text = expr.trim();
  if (!text) return 0;

  const preAveraged = text.match(/^\s*(\d+)\s*\(/);
  if (preAveraged) return Number.parseInt(preAveraged[1], 10);

  let total = 0;
  for (const m of text.matchAll(/([+-]?)\s*(\d*)d(\d+)/gi)) {
    const sign = m[1] === "-" ? -1 : 1;
    const count = m[2] === "" ? 1 : Number.parseInt(m[2], 10);
    const faces = Number.parseInt(m[3], 10);
    if (Number.isFinite(count) && Number.isFinite(faces) && faces > 0) {
      total += sign * diceAverage(count, faces);
    }
  }
  const withoutDice = text.replace(/[+-]?\s*\d*d\d+/gi, " ");
  for (const m of withoutDice.matchAll(/([+-])\s*(\d+)/g)) {
    total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
  }
  return Math.max(0, total);
}

/** Probability a recharge ability is up on an average round. "5-6" → 1/3. */
export function rechargeAvailability(recharge: string | undefined): number {
  if (!recharge) return 1;
  const m = recharge.match(/(\d)\s*(?:-\s*(\d))?/);
  if (!m) return 1;
  const lo = Number.parseInt(m[1], 10);
  const hi = m[2] ? Number.parseInt(m[2], 10) : 6;
  if (!Number.isFinite(lo)) return 1;
  const faces = Math.max(0, Math.min(6, hi) - lo + 1);
  return faces > 0 ? faces / 6 : 1;
}

/** Chance a +N attack lands against AC, clamped to the nat-1/nat-20 rails. */
export function hitChance(attackBonus: number, targetAc: number): number {
  const raw = (21 - (targetAc - attackBonus)) / 20;
  return Math.max(0.05, Math.min(0.95, raw));
}

/** Pulls "+7" out of "1d20 + 7". */
export function attackBonusFromRoll(roll: string | undefined): number {
  if (!roll) return 0;
  const m = roll.match(/([+-])\s*(\d+)\s*$/);
  return m ? (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10) : 0;
}

/**
 * Party AC and save bonus by level ("Model Inputs" → Target AC / Damage Save). The DPR
 * progression is already target-resolved against these, which is why a monster's own AC must
 * never be folded in a second time.
 */
const PARTY_DEFENCE_BY_LEVEL: ReadonlyArray<readonly [level: number, targetAc: number, damageSave: number]> = [
  [3, 14, 2], [4, 15, 2], [5, 16, 3], [6, 16, 3], [7, 16, 3],
  [8, 17, 4], [9, 17, 4], [10, 18, 4], [11, 18, 5], [12, 18, 5],
];

/** The AC a monster's attacks are landing against at this party level. */
export function partyTargetAcForLevel(level: number): number {
  return Math.round(interpolate(PARTY_DEFENCE_BY_LEVEL, level, 1));
}

/** The party's damage-save bonus at this level. */
export function partyDamageSaveForLevel(level: number): number {
  return interpolate(PARTY_DEFENCE_BY_LEVEL, level, 2);
}

export type DprEstimateAction = {
  name?: string;
  kind?: string;
  roll?: string;
  damage?: string;
  save?: string;
  attackCount?: number;
  recharge?: string;
  legendaryCost?: number;
  /** The discriminator for a spell action — see `isMonsterSpellAction`. NOT `kind`. */
  spellSlotLevel?: number;
  economyCost?: string;
  /** Authored: the creature cannot use this under the encounter's conditions. Never inferred. */
  gated?: boolean;
  /**
   * The printed rules text. Read ONLY to warn that an ability looks like it deals damage while
   * its `damage` field is empty — never to price one. See the omission check below.
   */
  text?: string;
};

export type MonsterDamageEstimate = {
  /** Sustained damage per round — the MER denominator. */
  dpr: number;
  /** Per-action contribution, largest first, so a builder sees WHERE the damage is. */
  breakdown: { name: string; dpr: number; note: string }[];
  /** What could not be parsed — never silently counted as zero. */
  unread: string[];
};

/**
 * Estimate a creature's SUSTAINED damage per round from its abilities, for the MER clock.
 *
 * A reference estimate, in the same spirit as the rest of the creator. It reads what the
 * creature can actually roll; it does not model burst, focus fire, control, or recovery
 * timing — README §7 is explicit that those stay a second axis to be validated separately
 * even when the clocks look healthy.
 */
export function estimateMonsterDamage(
  actions: readonly DprEstimateAction[] | undefined,
  options: {
    attacksPerTurn?: number;
    /** Defaults to the authored party AC for the level. */
    targetAc?: number;
    partyLevel?: number;
    /** Chance a party member saves. Defaults from the level's damage-save bonus vs the DC. */
    partySaveRate?: number;
    saveDc?: number;
  } = {},
): MonsterDamageEstimate {
  const level = options.partyLevel ?? 5;
  const targetAc = options.targetAc ?? partyTargetAcForLevel(level);
  const saveRate = options.partySaveRate
    ?? (options.saveDc
      ? Math.max(0.05, Math.min(0.95, (21 - (options.saveDc - partyDamageSaveForLevel(level))) / 20))
      : 0.5);

  const breakdown: MonsterDamageEstimate["breakdown"] = [];
  const unread: string[] = [];

  /** One damaging entry, already resolved to expected damage for a single use. */
  type Priced = {
    name: string; per: number; note: string; recharge?: string; limited: boolean;
    /** Spell or recharge — IS the creature's Action, so it replaces the whole routine. */
    fullAction: boolean;
    /** Bonus / legendary — runs on its own economy, so it adds instead of competing. */
    outOfBudget: boolean;
    /** Authored as unusable in this encounter — counted as zero, and said out loud. */
    gated: boolean;
  };
  const priced: Priced[] = [];

  for (const a of actions ?? []) {
    if (!a || a.kind === "trait") continue;

    const avg = damageExpressionAverage(a.damage);
    if (avg <= 0) {
      if (a.damage) {
        unread.push(`${a.name ?? "unnamed"} — could not read "${a.damage}"`);
      } else if (/\d+d\d+/.test(a.text ?? "")) {
        /**
         * ⚠ DAMAGE THAT LIVES ONLY IN PROSE SCORES ZERO, SILENTLY. This branch is why it no
         * longer does so quietly.
         *
         * The Veilwood Crone's Venomous Eruption is "27 (6d8) poison damage" in its text with
         * an empty `damage` field, so she was reading 15.6 DPR — two Claws and nothing else —
         * while her signature AoE contributed nothing at all. The Lesser Wendigo's Grab was
         * the same. Neither appeared in `unread`, because the old check only fired when a
         * damage field existed and failed to parse.
         *
         * The dice pattern is used only to DETECT a probable omission and warn about it —
         * never to price one. Reading a number out of campaign prose is exactly the mistake
         * that must not be made; saying "this looks authored wrong" is not.
         */
        unread.push(`${a.name ?? "unnamed"} — has dice in its text but no damage field, so it scores 0`);
      }
      continue;
    }

    let per: number;
    let note: string;
    if (a.roll) {
      const hit = hitChance(attackBonusFromRoll(a.roll), targetAc);
      per = avg * hit;
      note = `${avg.toFixed(1)} × ${(hit * 100).toFixed(0)}% hit`;
    } else if (a.save) {
      per = avg * (1 - saveRate) + avg * 0.5 * saveRate;
      note = `${avg.toFixed(1)}, ${(saveRate * 100).toFixed(0)}% save for half`;
    } else {
      per = avg;
      note = `${avg.toFixed(1)} automatic`;
    }
    // An entry carrying its own attackCount states its full routine on its own.
    const own = a.attackCount ?? 0;
    if (own > 1) { per *= own; note += ` × ${own}`; }
    // The SAME predicates the combat card spends the budget with — never a parallel rule set.
    const ra = a as unknown as Parameters<typeof isMonsterFullAction>[0];
    priced.push({ name: a.name ?? "unnamed", per, note, recharge: a.recharge,
      limited: own > 1,
      fullAction: isMonsterFullAction(ra),
      outOfBudget: isMonsterBonusAction(ra) || isMonsterLegendaryAction(ra),
      gated: Boolean(a.gated) });
  }

  if (priced.length === 0) return { dpr: 0, breakdown, unread };

  /**
   * THE ACTION BUDGET — the model established at 0.7.1.10–0.7.1.12, not a new one.
   *
   * Christopher, 2026-08-14: *"action economy was already established when we were going over
   * the frost weaver and the wendigo wight."* It was, and this function was ignoring it: it
   * SUMMED every damaging entry, charging the party for a creature performing its whole stat
   * block every round. The Mirage Stalker read 48.1 DPR for a creature that cannot exceed ~16.
   *
   * So the budget is read through the SAME predicates the combat card uses, rather than a
   * parallel set of rules that could drift from them:
   *
   *  · THE ROUTINE — `attacksPerTurn` is the SIZE OF THE BUDGET, not a multiplier on every
   *    line ("claw is action and bolt is action and action count is 2 so using either until
   *    that count is out"). One Claw with attacksPerTurn 2 makes two Claws; three named
   *    attacks with attacksPerTurn 2 makes the best TWO, not all three doubled. Getting this
   *    backwards caused both the under-read (Lesser Wendigo 6.05) and the over-read (48.1).
   *
   *  · `isMonsterFullAction` — a SPELL or a RECHARGE action IS the creature's Action, so it
   *    replaces the entire routine rather than adding to it or costing one swing. Either/or,
   *    never both. ⚠ The spell discriminator is `spellSlotLevel`, NOT `kind` — no template
   *    sets `kind: "spell"`, and the Frost-Weaver is the test case for exactly that.
   *
   *  · `isMonsterBonusAction` / `isMonsterLegendaryAction` — OUTSIDE the budget entirely, so
   *    they ADD. A legendary action runs on someone else's turn from its own pool.
   *
   * Still not modelled, because the data has nowhere to say it: per-day limits (a 2/day
   * ability is priced as always available) and abilities gated on another ability firing.
   */
  const routineSize = Math.max(1, options.attacksPerTurn ?? 1);
  // Out of the budget → they add on top of whatever the turn's action was.
  const additive = priced.filter(x => x.outOfBudget);
  // Each IS the Action → an alternative to the whole routine.
  const alternatives = priced.filter(x => !x.outOfBudget && x.fullAction);
  // Ordinary attacks → spend one swing each out of `routineSize`.
  const routinePool = priced.filter(x => !x.outOfBudget && !x.fullAction);

  let routine = 0;
  if (routinePool.length > 0) {
    const sorted = [...routinePool].sort((a, b) => b.per - a.per);
    // Fill the routine from the best entries, repeating the best when the block names fewer
    // distinct attacks than the routine has swings.
    for (let i = 0; i < routineSize; i++) {
      const pick = sorted[Math.min(i, sorted.length - 1)];
      // An entry that states its own attackCount already IS a whole routine; do not stack it.
      if (pick.limited && i > 0) break;
      routine += pick.per;
    }
    const used = Math.min(routineSize, sorted.length);
    for (let i = 0; i < used; i++) {
      const pick = sorted[i];
      const reps = i === used - 1 && routineSize > sorted.length && !pick.limited
        ? routineSize - sorted.length + 1 : 1;
      breakdown.push({ name: pick.name, dpr: pick.per * reps,
        note: pick.note + (reps > 1 ? ` × ${reps} (routine of ${routineSize})` : "") });
    }
  }

  /**
   * A RECHARGE ACTION IS TAKEN WHEN IT IS UP — it is not compared against the routine
   * (Christopher, 2026-08-14): *"a recharge is always available action unless the creature
   * can't use it."*
   *
   * An earlier pass clamped this to `max(0, alt − routine)`, i.e. the creature only used its
   * recharge when it out-damaged a full multiattack. That is wrong twice over. It made the
   * Stalker's Phantom Charge score a flat 0 and print "weaker than the routine", when the
   * Charge is simply what the Stalker does on the turns it has it — the push-and-prone rider
   * is the reason it exists, and a boss trading damage for control is a real turn, not a
   * mistake to be optimised away. And it silently made recharge abilities incapable of ever
   * LOWERING a creature's DPR, which is exactly what a control-flavoured one should do.
   *
   * So the recharge simply replaces the routine on its share of turns, up or down:
   *     expected = p·alt + (1−p)·routine
   *
   * Turns are then claimed in damage order, so two recharge abilities cannot both spend the
   * same turn. `gated` is the *"unless the creature can't use it"* case — the Pale Stalker's
   * Cold Breath is "locked while both Pack Hunters are alive", so it is not available at the
   * start of its own authored fight.
   */
  let dpr = routine;
  let turnsLeft = 1;
  for (const alt of [...alternatives].sort((a, b) => b.per - a.per)) {
    if (alt.gated) {
      breakdown.push({ name: alt.name, dpr: 0,
        note: `${alt.note} — GATED: not available under this encounter's conditions, so it is not counted` });
      continue;
    }
    const p = Math.min(turnsLeft, rechargeAvailability(alt.recharge));
    turnsLeft -= p;
    // Replaces the routine on those turns — which can LOWER total damage, and should.
    const delta = p * (alt.per - routine);
    dpr += delta;
    breakdown.push({ name: alt.name, dpr: delta,
      note: `${alt.note} — full action, taken on ${(p * 100).toFixed(0)}% of turns`
        + (alt.per < routine
          ? ` (trades ${(routine - alt.per).toFixed(1)} damage for its rider)` : "") });
  }
  // Bonus and legendary actions are not competing for the Action, so they simply add.
  for (const extra of additive) {
    const p = rechargeAvailability(extra.recharge);
    dpr += extra.per * p;
    breakdown.push({ name: extra.name, dpr: extra.per * p,
      note: `${extra.note} — outside the action budget, so it adds${p < 1 ? ` × ${(p * 100).toFixed(0)}% uptime` : ""}` });
  }

  breakdown.sort((x, y) => y.dpr - x.dpr);
  return { dpr, breakdown, unread };
}
