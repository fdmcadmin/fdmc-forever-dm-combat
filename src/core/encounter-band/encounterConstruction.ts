/**
 * Encounter CONSTRUCTION targets — the inverse of `encounterRounds.ts`.
 *
 * `estimateRounds` answers "I built this creature, does it pace right?". This module answers
 * the question a DM building their own creature actually has first: **"what should I build?"**
 * Given a tier, it hands back the two numbers that define the fight —
 *
 *   Monster Sustain = D_P50,4 × R          (how much effective HP the creature needs)
 *   Monster DPR     = (S_P50,4 × P) ÷ R    (how hard it must hit)
 *
 * where D_P50,4 is the four-player balanced-middle party DPR, S_P50,4 the four-player
 * balanced-middle party SUSTAINABILITY, R the target rounds and P the share of party sustain
 * the fight is meant to consume.
 *
 * Everything here is authored against a FOUR-player party, the size the campaign is written
 * for (`BASELINE_PARTY_SIZE`). Scale the result with `hpForPartySize` for other party sizes —
 * do not re-derive the targets per size.
 */

import { midpointDprForLevel, BASELINE_PARTY_SIZE } from "./encounterRounds";
import type { MonsterClassification } from "../monsters/runtime/mainMonsterRuntime";

// ─── Construction targets ─────────────────────────────────────────────────────

/**
 * Tiers as the BUILDER sees them. This is `MonsterClassification` plus one split: an act boss
 * is authored at one of two output profiles, because the same total threat can be delivered
 * fast or slow and the two want different fight lengths.
 */
export type ConstructionTier =
  | "strong"
  | "elite"
  | "mid-boss"
  | "act-boss-high"
  | "act-boss-moderate";

export type ConstructionTarget = {
  label: string;
  /**
   * CENTER duration in rounds — the number the fight is built around, not a band edge.
   * `ROUND_BAND` in encounterRounds.ts is the tolerance around this: strong 3 → 2.5-3.5,
   * elite 3.75 → 3-4.5, mid-boss 4.75 → 4-5.5. Those three already agree with the bands
   * that shipped; only the act boss splits.
   */
  centerRounds: number;
  /** P — the share of the party's total sustain the fight is meant to consume. */
  sustainConsumed: number;
  /** What the table should actually FEEL like at this tier. */
  intent: string;
  /** The classification this tier reports as, once built. */
  classification: MonsterClassification;
};

/**
 * Four-player construction targets (Christopher, 2026-07-31).
 *
 * The two act-boss rows carry the SAME sustain consumption (70-75%) and differ only in how
 * fast it is delivered: a high-output boss spends the party's resources over 4.5 rounds, a
 * moderate-output one takes 5.5 to do the same damage. Both are "1-2 downs, no deaths".
 */
export const CONSTRUCTION_TARGET: Record<ConstructionTier, ConstructionTarget> = {
  strong: {
    label: "Strong", centerRounds: 3, sustainConsumed: 0.35, classification: "strong",
    intent: "Noticeable resources, occasional down",
  },
  elite: {
    label: "Elite", centerRounds: 3.75, sustainConsumed: 0.50, classification: "elite",
    intent: "Healing required, approximately one down",
  },
  "mid-boss": {
    label: "Mid-boss", centerRounds: 4.75, sustainConsumed: 0.60, classification: "mid-boss",
    intent: "Multiple defensive decisions, 1-2 downs possible",
  },
  "act-boss-high": {
    label: "High-output Act Boss", centerRounds: 4.5, sustainConsumed: 0.725, classification: "act-boss",
    intent: "1-2 expected downs, no expected deaths",
  },
  "act-boss-moderate": {
    label: "Moderate-output Act Boss", centerRounds: 5.5, sustainConsumed: 0.725, classification: "act-boss",
    intent: "Same overall threat delivered more slowly",
  },
};

/**
 * PARTY SUSTAINABILITY at the four-player balance centre — S_P50,4.
 *
 * ⚠ NOT YET SOURCED. Every other constant in the encounter model is traceable to a workbook
 * sheet; this one has no source yet, so it is deliberately left EMPTY rather than guessed.
 * `monsterDprTarget` returns undefined while it is empty, and the panel must show "needs
 * S_P50,4" instead of a number — a fabricated sustain figure would silently mis-size the
 * damage half of every creature a DM builds.
 *
 * Fill from the same rerun that produced `MIDPOINT_DPR_4P`: total effective HP pool of a
 * four-player balance-centre party at each level checkpoint, healing included.
 */
const PARTY_SUSTAIN_4P: ReadonlyArray<readonly [level: number, sustain: number]> = [];

/** Linear interpolation across whatever checkpoints S_P50,4 has. Undefined while unsourced. */
export function partySustainForLevel(level: number): number | undefined {
  const pts = PARTY_SUSTAIN_4P;
  if (pts.length === 0) return undefined;
  const lv = Math.max(1, Math.min(20, Math.floor(level || 1)));
  if (lv <= pts[0][0]) return pts[0][1];
  if (lv >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [l0, s0] = pts[i];
    const [l1, s1] = pts[i + 1];
    if (lv >= l0 && lv <= l1) {
      if (l1 === l0) return s0;
      return s0 + ((s1 - s0) * (lv - l0)) / (l1 - l0);
    }
  }
  return pts[pts.length - 1][1];
}

// ─── The two formulas ─────────────────────────────────────────────────────────

/**
 * Monster Sustain = D_P50,4 × R.
 *
 * The EFFECTIVE HP the creature needs to survive R rounds of the party's damage — so it is
 * compared against `rawHp × defensiveMultiplier(defenses)`, NOT against raw HP. A creature
 * with a 1.6 kit hits this target at 1/1.6 of the raw HP a punching bag would need.
 */
export function monsterSustainTarget(level: number, rounds: number): number {
  return midpointDprForLevel(level) * rounds;
}

/**
 * Monster DPR = (S_P50,4 × P) ÷ R.
 *
 * Undefined until PARTY_SUSTAIN_4P is sourced — see the note there.
 */
export function monsterDprTarget(level: number, rounds: number, sustainConsumed: number): number | undefined {
  const sustain = partySustainForLevel(level);
  if (sustain === undefined || rounds <= 0) return undefined;
  return (sustain * sustainConsumed) / rounds;
}

export type BuildTarget = {
  tier: ConstructionTier;
  label: string;
  rounds: number;
  /** Effective HP to aim for. */
  sustain: number;
  /** Damage per round to aim for, or undefined while S_P50,4 is unsourced. */
  dpr: number | undefined;
  intent: string;
  partySize: number;
};

/** Both targets for a tier at a given party level, for the four-player baseline. */
export function buildTargetsForTier(tier: ConstructionTier, level: number): BuildTarget {
  const t = CONSTRUCTION_TARGET[tier];
  return {
    tier,
    label: t.label,
    rounds: t.centerRounds,
    sustain: monsterSustainTarget(level, t.centerRounds),
    dpr: monsterDprTarget(level, t.centerRounds, t.sustainConsumed),
    intent: t.intent,
    partySize: BASELINE_PARTY_SIZE,
  };
}

// ─── Estimating what a creature ACTUALLY does ─────────────────────────────────

/** Average of a dice expression's rolled part: "2d10" → 11. */
function diceAverage(count: number, faces: number): number {
  return (count * (faces + 1)) / 2;
}

/**
 * Expected value of a damage string.
 *
 * Handles the shapes the scanner and the creature editor actually produce:
 *   "2d10 + 4"                       → 15
 *   "1d8 + 2 slashing + 1d4 cold"    → 9 (every die and flat term counts, types ignored)
 *   "15 (2d10 + 4)"                  → 15 (a leading pre-averaged total is preferred)
 *
 * Damage TYPE is deliberately ignored: resistance lives on the target, and the party's
 * resistances are not modelled here.
 */
export function damageExpressionAverage(expr: string | undefined): number {
  if (!expr) return 0;
  const text = expr.trim();
  if (!text) return 0;

  // Stat-block form "15 (2d10 + 4)" — the leading number is already the average.
  const preAveraged = text.match(/^\s*(\d+)\s*\(/);
  if (preAveraged) return Number.parseInt(preAveraged[1], 10);

  let total = 0;
  // Dice terms, with their sign.
  for (const m of text.matchAll(/([+-]?)\s*(\d*)d(\d+)/gi)) {
    const sign = m[1] === "-" ? -1 : 1;
    const count = m[2] === "" ? 1 : Number.parseInt(m[2], 10);
    const faces = Number.parseInt(m[3], 10);
    if (Number.isFinite(count) && Number.isFinite(faces) && faces > 0) {
      total += sign * diceAverage(count, faces);
    }
  }
  // Flat terms — only those NOT glued to a die (strip dice first so "1d8" doesn't add 8).
  const withoutDice = text.replace(/[+-]?\s*\d*d\d+/gi, " ");
  for (const m of withoutDice.matchAll(/([+-])\s*(\d+)/g)) {
    total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
  }
  return Math.max(0, total);
}

/**
 * Probability a recharge ability is up on an average round.
 *
 * "5-6" → 2 faces of 6 → 1/3. A blank/absent recharge is always available. This is the
 * steady-state share, not the round-1 guarantee, which is the right average across a fight.
 */
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

/** Chance a +N attack lands against AC. Clamped to the 5%/95% nat-1/nat-20 rails. */
export function hitChance(attackBonus: number, targetAc: number): number {
  const needed = targetAc - attackBonus;
  const raw = (21 - needed) / 20;
  return Math.max(0.05, Math.min(0.95, raw));
}

/** Pulls "+7" out of "1d20 + 7". Returns 0 when absent. */
export function attackBonusFromRoll(roll: string | undefined): number {
  if (!roll) return 0;
  const m = roll.match(/([+-])\s*(\d+)\s*$/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
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
};

export type MonsterDprEstimate = {
  dpr: number;
  /** Per-action contribution, largest first — so a DM can see WHERE the damage comes from. */
  breakdown: { name: string; dpr: number; note: string }[];
  /** What the estimate could not read, so the number is never trusted blindly. */
  unread: string[];
};

/**
 * Estimate a creature's damage per round FROM ITS ABILITIES, to compare against the
 * `Monster DPR` construction target.
 *
 * This is a REFERENCE ESTIMATE, in the same spirit as the rest of the creator: it reads the
 * damage the creature can actually roll and says roughly how hard it hits. It deliberately
 * does NOT model: conditions and control (a stunned party takes more than this says), riders
 * with saves, target resistances, or focus-fire. Anything it cannot parse is reported in
 * `unread` rather than silently counted as zero.
 *
 * Save-based damage is counted at HALF on a successful save, the 5e default, using the
 * party's assumed save rate.
 */
export function estimateMonsterDpr(
  actions: readonly DprEstimateAction[] | undefined,
  options: {
    /** Attacks the creature makes per turn — overrides an action's own attackCount. */
    attacksPerTurn?: number;
    /** Party AC the attacks are landing against. */
    targetAc?: number;
    /** Chance a party member SAVES against a DC. */
    partySaveRate?: number;
    /** Legendary actions available each round. */
    legendaryPerRound?: number;
  } = {},
): MonsterDprEstimate {
  const targetAc = options.targetAc ?? 16;
  const saveRate = options.partySaveRate ?? 0.5;
  const breakdown: MonsterDprEstimate["breakdown"] = [];
  const unread: string[] = [];

  for (const a of actions ?? []) {
    if (!a) continue;
    // Traits and reactions are not part of the creature's own turn output.
    if (a.kind === "trait") continue;

    const avg = damageExpressionAverage(a.damage);
    if (avg <= 0) {
      if (a.damage) unread.push(`${a.name ?? "unnamed"} — could not read "${a.damage}"`);
      continue;
    }

    const uptime = rechargeAvailability(a.recharge);
    const count = Math.max(1, a.attackCount ?? options.attacksPerTurn ?? 1);

    let expected: number;
    let note: string;
    if (a.roll) {
      const bonus = attackBonusFromRoll(a.roll);
      const hit = hitChance(bonus, targetAc);
      expected = avg * hit * count * uptime;
      note = `${avg.toFixed(1)} dmg × ${(hit * 100).toFixed(0)}% hit${count > 1 ? ` × ${count}` : ""}${uptime < 1 ? ` × ${(uptime * 100).toFixed(0)}% uptime` : ""}`;
    } else if (a.save) {
      // Half on a save.
      const effective = avg * (1 - saveRate) + avg * 0.5 * saveRate;
      expected = effective * uptime;
      note = `${avg.toFixed(1)} dmg, ${(saveRate * 100).toFixed(0)}% save for half${uptime < 1 ? ` × ${(uptime * 100).toFixed(0)}% uptime` : ""}`;
    } else {
      expected = avg * uptime;
      note = `${avg.toFixed(1)} automatic${uptime < 1 ? ` × ${(uptime * 100).toFixed(0)}% uptime` : ""}`;
    }

    breakdown.push({ name: a.name ?? "unnamed", dpr: expected, note });
  }

  breakdown.sort((x, y) => y.dpr - x.dpr);
  const dpr = breakdown.reduce((s, b) => s + b.dpr, 0);
  return { dpr, breakdown, unread };
}
