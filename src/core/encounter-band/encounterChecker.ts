/**
 * THE ENCOUNTER CHECKER — how a monster gets vetted before it is played.
 *
 * This is a transcription of the checker workbook's Encounter Race, not a model invented here.
 * Its three outputs, and the formulas, are the sheet's own:
 *
 *   MER          = party sustain / monster DPR        (rounds the PARTY survives)
 *   roundsToKill = monster sustain / party DPR        (rounds the MONSTER survives)
 *   raceMargin   = MER - roundsToKill                 (positive = party ahead)
 *
 * ⚠ A CLASSIFICATION IS LETHALITY, NOT ROUND LENGTH (Christopher).
 *
 * Round length already falls out of HP divided by DPR — the tag adds nothing by repeating it.
 * What the tag actually says is how much the fight COSTS: a mid-boss might last three rounds
 * and put one character down; an act boss four rounds, two down, one hurt and one at mid HP.
 * So the readout here is a casualty count and the state of the survivors, and the party's
 * per-PC thresholds are what make that computable — they sum to the party's effective HP, so
 * damage crossing each one in turn drops a character.
 *
 * The old `ROUND_BAND` in encounterRounds.ts answers the other question and is left alone; it
 * is a pacing check, and pacing and lethality are not the same thing.
 */

import {
  PARTY_BASELINE, EXPECTED_MONSTER_AC, AC_DELTA_CONTRIBUTION, partyDamageInRound, type RoundCurve,
  type PartyBaseline,
} from "./dprBaseline";

export function partyBaselineFor(level: number): PartyBaseline | undefined {
  return PARTY_BASELINE.find(b => b.level === level);
}

/**
 * Effective sustain for one creature: raw HP adjusted by how hard it is to hurt.
 *
 * The AC delta is measured against what the model expects a monster to have at THAT party
 * level, and applied per creature before any encounter total — a creature two points under
 * the curve is genuinely softer than its HP suggests, and the sheet prices that.
 *
 * `traitContributions` are the values from SUSTAIN_TRAITS. They are summed rather than
 * multiplied because the workbook expresses them as shares of effective sustain, but the
 * workbook is equally explicit that they are single-factor references: stacking every defence
 * a creature owns will overstate it, so pass the ones the party will actually run into.
 */
export function effectiveSustain(opts: {
  rawHp: number;
  ac: number;
  partyLevel: number;
  traitContributions?: number[];
}): number {
  const expected = EXPECTED_MONSTER_AC[opts.partyLevel];
  let acContribution = 0;
  if (expected !== undefined) {
    const delta = Math.round(opts.ac - expected);
    if (delta !== 0) {
      // Beyond ±3 the sheet says to combine the listed bands, so walk out in steps.
      const step = delta > 0 ? 1 : -1;
      for (let d = step; Math.abs(d) <= Math.abs(delta); d += step) {
        const band = AC_DELTA_CONTRIBUTION[Math.abs(d) > 3 ? 3 * step : d];
        acContribution += band ?? 0;
      }
    }
  }
  const traits = (opts.traitContributions ?? []).reduce((a, b) => a + b, 0);
  return opts.rawHp * (1 + acContribution + traits);
}

// ─── Pricing a defence off the Sustain Trait Reference ────────────────────────
//
// The reference lists anchor points, not a formula, and a real stat block rarely lands on one
// exactly. These helpers read BETWEEN the reference's own anchors so that a defence which is
// clearly on the list gets priced instead of dropped. Every family the reference covers —
// damage reduction, resistance and immunity, to-hit reduction, and a temporary AC bonus — has
// a helper here, so "no entry for that" is never a reason to score a creature as if it had no
// defence at all.
//
// Interpolation stays inside the listed range; below the lowest anchor the helpers extrapolate
// along the same slope, which is flagged in each doc comment because it is the weakest claim
// the model makes.

const lerp = (x: number, x0: number, y0: number, x1: number, y1: number) =>
  y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);

/**
 * Flat damage prevented per round — "Bark-Ribbed reduces it by 3", "Body Between reduces 12".
 * Anchors: 8/round -> 0.1419, 12/round -> 0.2323. Below 8 this extrapolates along that slope.
 */
export function damageReductionContribution(perRound: number): number {
  return Math.max(0, lerp(perRound, 8, 0.1418712644969924, 12, 0.2323134514052565));
}

/**
 * Resistance to some share of the damage aimed at the creature. Anchors are the reference's
 * own 25 / 50 / 75% entries; 100% (immunity to that share) extends the top segment.
 */
export function resistanceContribution(sharePercent: number): number {
  const pts: [number, number][] = [
    [0, 0], [25, 0.1440096727974145], [50, 0.34183418117197717], [75, 0.5858292424284814],
  ];
  const s = Math.max(0, Math.min(100, sharePercent));
  for (let i = 1; i < pts.length; i++) {
    if (s <= pts[i][0]) return lerp(s, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  return lerp(s, pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
}

/** Vulnerability is the same axis with the sign flipped — the reference lists it separately. */
export function vulnerabilityContribution(sharePercent: number): number {
  const pts: [number, number][] = [
    [0, 0], [25, -0.2], [50, -0.3333333333333333], [75, -0.42857142857142855], [100, -0.5],
  ];
  const s = Math.max(0, Math.min(100, sharePercent));
  for (let i = 1; i < pts.length; i++) {
    if (s <= pts[i][0]) return lerp(s, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  return -0.5;
}

/**
 * Making the party miss more often. The reference prices four shapes of this; `share` narrows
 * an entry when it only applies to some of the attacks made (opportunity attacks only, say).
 */
export const TO_HIT_REDUCTION = {
  firstAttackEachRound: 0.047749343564075675,
  allAttacksOneRound: 0.1294156939022204,
  halfCoverVsRanged: 0.049548456103407856,
  concealmentUntilFirstHit: 0.11325953581508919,
} as const;

export function toHitReductionContribution(
  kind: keyof typeof TO_HIT_REDUCTION,
  share = 1,
): number {
  return TO_HIT_REDUCTION[kind] * Math.max(0, Math.min(1, share));
}

/**
 * A temporary AC bonus above the creature's printed AC — distinct from AC_DELTA_CONTRIBUTION,
 * which prices the AC it stands at. Anchors: shield-like +5 for 1 round -> 0.1417, for 2
 * rounds -> 0.2042. Scaled linearly in AC points, so +2 for a round is two fifths of the +5.
 */
export function acBonusContribution(points: number, rounds = 1): number {
  const one = 0.14153696550922712;
  const two = 0.20415184169656952;
  const perRound = rounds <= 1 ? one : lerp(Math.min(rounds, 2), 1, one, 2, two);
  return perRound * (points / 5);
}

/**
 * A LAIR. It acts on its own initiative every round and its options are control, not damage:
 * sliding characters out of position, obscuring a sphere, moving someone off a line. None of
 * that shortens the fight — it costs the party turns, which is the reference's "Opposing
 * damage uptime" entry (−10% -> 0.1083, −20% -> 0.2342).
 *
 * Applied to the WHOLE encounter rather than per creature, which is the one place this
 * deliberately departs from the sheet's "apply per creature" note: a lair disrupts everything
 * the party is shooting at, not just its owner.
 */
export const LAIR_UPTIME_TAX = {
  light: 0.10834841514716653,
  heavy: 0.23422706888237932,
} as const;

/**
 * ATTRITION — the share of its printed DPR a roster actually delivers.
 *
 * A dead body stops dealing damage. With `bodies` killed in sequence the encounter averages
 * (bodies + 1) / 2·bodies of its printed output: 1.00 for a lone boss, 0.75 for a pair, 0.67
 * for three, 0.63 for four.
 *
 * This is not a fudge factor — it is the entire reason a tag means what it means. Two bodies
 * and six bodies holding the same total HP and the same total DPR are not the same fight, and
 * without this term they score identically. Concentration is what makes a boss lethal.
 */
export function attritionFactor(bodies: number): number {
  const n = Math.max(1, bodies);
  return (n + 1) / (2 * n);
}

/**
 * Total effective sustain for a whole roster, including encounter-wide effects.
 *
 * `count` matters: "Veil-Torn Wyrmling ×2" is two bodies, and dropping the count both
 * understates the sustain and — through attrition — misreads how lethal the fight is.
 */
export function encounterSustain(opts: {
  partyLevel: number;
  creatures: { rawHp: number; ac: number; count?: number; traitContributions?: number[] }[];
  /** Encounter-wide contributions, e.g. LAIR_UPTIME_TAX.light for a lair. */
  encounterContributions?: number[];
}): { sustain: number; bodies: number } {
  let sustain = 0;
  let bodies = 0;
  for (const c of opts.creatures) {
    const n = Math.max(1, c.count ?? 1);
    bodies += n;
    sustain += n * effectiveSustain({
      rawHp: c.rawHp, ac: c.ac, partyLevel: opts.partyLevel,
      traitContributions: c.traitContributions,
    });
  }
  const wide = (opts.encounterContributions ?? []).reduce((a, b) => a + b, 0);
  return { sustain: sustain * (1 + wide), bodies };
}

// ─── Resolving a built encounter, body by body ────────────────────────────────

/**
 * A single creature TYPE in a built encounter. `count` is how many of it are on the table.
 *
 * This is what lets the checker read an encounter someone assembled themselves out of 1..X
 * creatures, rather than a single lumped sustain total: bodies die at different times, and a
 * dead body stops dealing damage.
 */
export type EncounterBody = {
  name?: string;
  /** Effective sustain for ONE of these, from `effectiveSustain`. */
  sustain: number;
  /** Printed damage per round for ONE of these. */
  dpr: number;
  count?: number;
};

/**
 * Share of a body's round that still resolves when the party kills it partway through.
 *
 * The workbook's default. A creature removed mid-round already acted, or acted in part — 0
 * would let the party erase a turn by landing the killing blow, and 1 would charge them for a
 * corpse's full turn.
 */
export const KILLED_BODY_DPR_RETAINED = 0.5;

/** How the fight actually played out, round by round. */
export type EncounterRound = {
  round: number;
  /** Party damage available this round, off the decay curve. */
  partyDamage: number;
  cumulativePartyDamage: number;
  bodiesAlive: number;
  /** Bodies killed during THIS round. */
  bodiesRemoved: number;
  /** Bodies that still acted, counting a killed body at `KILLED_BODY_DPR_RETAINED`. */
  effectiveBodiesActing: number;
  monsterDamage: number;
  cumulativeMonsterDamage: number;
  pcsDown: number;
  pcsAlive: number;
};

/**
 * The round the party's damage stops falling and holds — `r4plus`, the repeatable floor.
 *
 * Worth surfacing on its own: a fight that ends by round 3 was fought on the way down from the
 * nova and never tested the party's staying power. One that runs past this is being fought at
 * the floor, where every extra round costs the same and the party has nothing left to spend to
 * shorten it. It is the point a fight stops being a burst check and becomes an endurance one.
 */
export const DPR_FLAT_FROM_ROUND = 4;

export type EncounterResolution = {
  rounds: EncounterRound[];
  /** Rounds to clear every body — fractional, from where the last one fell. */
  roundsToKill: number;
  totalSustain: number;
  bodies: number;
  /** Damage the party absorbed over the whole fight. */
  damageTaken: number;
  pcsDowned: number;
  nextPcPressure: number;
  lethalityRead: string;
  /** True if the party ran out before the roster did. */
  partyWiped: boolean;
  /**
   * The round the fight turns LETHAL — when the first character hits the floor.
   * `null` if nobody goes down, which is the answer for most fights and is not a failure.
   */
  firstDownRound: number | null;
  /** The round the last character falls. `null` unless the party wipes. */
  wipeRound: number | null;
  /**
   * True once the fight runs to `DPR_FLAT_FROM_ROUND` — the party is on its repeatable floor
   * with nothing left to shorten the fight with.
   */
  reachesFlatDpr: boolean;
};

/**
 * RESOLVE A BUILT ENCOUNTER ROUND BY ROUND — the workbook's Encounter Checker round table.
 *
 * This supersedes the closed-form `attritionFactor` approximation for any caller that knows
 * the individual bodies. Two things it gets right that a single averaged term cannot:
 *
 * 1. **Party damage decays** (nova → floor), so a 2-round fight is fought at much higher
 *    output than a 7-round one. Averaging flattens exactly the difference that decides
 *    whether a fight is survivable.
 * 2. **Bodies die on their own schedule.** Focus fire removes the first body early and its
 *    damage stops; the averaged (n+1)/2n term assumes an even spread of deaths across the
 *    fight, which is only true when every body has identical sustain.
 *
 * Party damage is applied to bodies in order, so the roster should be passed weakest-first if
 * the party would sensibly focus that way. Damage carries over between bodies within a round —
 * overkill is not wasted, matching the workbook.
 *
 * ⚠ `sustain` per body must ALREADY carry AC, traits, pass fraction and uptime (that is what
 * `effectiveSustain` produces). Do not apply those again here.
 */
export function resolveEncounter(opts: {
  partyLevel: number;
  bodies: EncounterBody[];
  /** Overrides the baseline round curve — e.g. scaled for party size or resource state. */
  roundCurve?: RoundCurve;
  /** Safety stop. A fight that has not ended by here is not a fight. */
  maxRounds?: number;
}): EncounterResolution | null {
  const base = partyBaselineFor(opts.partyLevel);
  if (!base) return null;

  const curve = opts.roundCurve ?? base.rounds;
  const maxRounds = Math.max(1, opts.maxRounds ?? 30);

  // Expand counts into individual bodies — the whole point is that they die separately.
  const pool: { sustain: number; dpr: number; remaining: number }[] = [];
  for (const b of opts.bodies) {
    for (let i = 0; i < Math.max(1, b.count ?? 1); i++) {
      pool.push({ sustain: b.sustain, dpr: b.dpr, remaining: b.sustain });
    }
  }
  if (pool.length === 0) return null;

  const totalSustain = pool.reduce((s, b) => s + b.sustain, 0);
  const scale = base.sustain / base.baseEhp;
  const thresholds = base.thresholds.map(t => t * scale);

  const rounds: EncounterRound[] = [];
  let cumulativeParty = 0;
  let cumulativeMonster = 0;
  let roundsToKill = 0;
  let alive = pool.length;

  for (let r = 1; r <= maxRounds && alive > 0; r++) {
    const partyDamage = partyDamageInRound(curve, r);

    // Apply the party's damage down the line, carrying overkill to the next body.
    let budget = partyDamage;
    let removedThisRound = 0;
    let retainedFromKills = 0;
    for (const body of pool) {
      if (body.remaining <= 0 || budget <= 0) continue;
      if (budget >= body.remaining) {
        budget -= body.remaining;
        body.remaining = 0;
        removedThisRound++;
        retainedFromKills += KILLED_BODY_DPR_RETAINED;
        // Where in the round this one fell — used for a fractional final round.
        if (alive - removedThisRound === 0) {
          roundsToKill = r - 1 + (partyDamage > 0 ? (partyDamage - budget) / partyDamage : 1);
        }
      } else {
        body.remaining -= budget;
        budget = 0;
      }
    }
    alive -= removedThisRound;
    cumulativeParty += partyDamage - budget;

    // A body killed this round still contributes its retained share.
    const survivorDpr = pool.reduce((s, b) => s + (b.remaining > 0 ? b.dpr : 0), 0);
    const killedDpr = pool.reduce((s, b) => s + (b.remaining <= 0 ? b.dpr : 0), 0);
    // Only bodies killed THIS round retain anything; ones already dead contribute nothing.
    const monsterDamage = survivorDpr + (removedThisRound > 0
      ? (killedDpr / Math.max(1, pool.length - alive)) * removedThisRound * KILLED_BODY_DPR_RETAINED
      : 0);
    cumulativeMonster += monsterDamage;

    let down = 0;
    let cum = 0;
    for (const t of thresholds) {
      if (cumulativeMonster >= cum + t) { down++; cum += t; } else break;
    }

    rounds.push({
      round: r,
      partyDamage,
      cumulativePartyDamage: cumulativeParty,
      bodiesAlive: alive,
      bodiesRemoved: removedThisRound,
      effectiveBodiesActing: alive + retainedFromKills,
      monsterDamage,
      cumulativeMonsterDamage: cumulativeMonster,
      pcsDown: down,
      pcsAlive: thresholds.length - down,
    });

    if (down >= thresholds.length) break;   // the party is gone; the fight is over
  }

  if (roundsToKill === 0) roundsToKill = rounds.length;

  let pcsDowned = 0;
  let cum = 0;
  let nextPcPressure = 0;
  for (const t of thresholds) {
    if (cumulativeMonster >= cum + t) { pcsDowned++; cum += t; continue; }
    nextPcPressure = Math.max(0, (cumulativeMonster - cum) / t);
    break;
  }

  const hurt = nextPcPressure >= 0.66 ? "1 badly hurt"
    : nextPcPressure >= 0.33 ? "1 at mid HP"
    : nextPcPressure > 0 ? "1 scratched" : "";
  const partyWiped = pcsDowned >= thresholds.length;

  const firstDownRound = rounds.find(x => x.pcsDown >= 1)?.round ?? null;
  const wipeRound = partyWiped
    ? (rounds.find(x => x.pcsDown >= thresholds.length)?.round ?? null)
    : null;

  return {
    rounds,
    roundsToKill,
    totalSustain,
    bodies: pool.length,
    damageTaken: cumulativeMonster,
    pcsDowned,
    nextPcPressure,
    lethalityRead: partyWiped
      ? "PARTY WIPE"
      : [pcsDowned > 0 ? `${pcsDowned} down` : "none down", hurt].filter(Boolean).join(", "),
    partyWiped,
    firstDownRound,
    wipeRound,
    reachesFlatDpr: roundsToKill >= DPR_FLAT_FROM_ROUND,
  };
}

export type EncounterCheck = {
  partyLevel: number;
  partyDpr: number;
  partySustain: number;
  monsterSustain: number;
  monsterDpr: number;
  bodies: number;
  /** Rounds the monster survives — the fight's length. */
  roundsToKill: number;
  /** Rounds the party survives. The sheet calls this MER. */
  mer: number;
  /** MER − roundsToKill. Positive means the party wins the race. */
  raceMargin: number;
  status: "PARTY AHEAD" | "TOO CLOSE" | "MONSTER AHEAD";
  /** Damage the party actually absorbs, after attrition. */
  damageTaken: number;
  /** How many characters go down — this is what the classification tag is about. */
  pcsDowned: number;
  /** How far into the next character's health the fight reaches, 0–1. */
  nextPcPressure: number;
  /** Plain reading of the cost, e.g. "2 down, 1 at mid HP". */
  lethalityRead: string;
};

/**
 * Run one encounter against the party baseline.
 *
 * `monsterSustain` is the sum of every body's effective sustain (see effectiveSustain).
 * `monsterDpr` is the roster's printed per-round output — expected damage, not a peak burst.
 *
 * Note that `roundsToKill` depends only on monster sustain and party DPR, never on monster
 * DPR. So the fight's length is known before any monster damage is priced, which is what lets
 * a once-per-fight ability be amortised exactly rather than iterated to a fixed point.
 */
export function checkEncounter(opts: {
  partyLevel: number;
  monsterSustain: number;
  monsterDpr: number;
  /** Number of separate bodies. Drives attrition; defaults to a single body. */
  bodies?: number;
  /**
   * The party's ACTUAL output for this fight, when the caller knows more than the baseline.
   * Defaults to the workbook figure for the level, which is a 4-player, standard-lane,
   * long-rested party fighting a creature at the level's expected AC.
   *
   * The difficulty panel passes its `landedDpr`, which is that same number with party size,
   * bond lane, resource state, monster AC and damage uptime applied. At the defaults those
   * all resolve to 1.0, so this is EXACTLY `base.dpr` and the workbook reading is unchanged —
   * it only diverges once the DM moves a dial, which is the point. Without it the headline sat
   * frozen while the rows under it moved.
   *
   * ⚠ AC IS PRICED ONCE, ON THE PARTY'S DAMAGE. The workbook's own `effectiveSustain` prices
   * it on the MONSTER instead. Both are valid; doing both double-counts armour. The panel
   * feeds this function an AC-free sustain (`effectiveHp`) precisely so the AC lives here.
   */
  partyDpr?: number;
}): EncounterCheck | null {
  const base = partyBaselineFor(opts.partyLevel);
  if (!base) return null;

  const bodies = Math.max(1, opts.bodies ?? 1);
  const dpr = opts.partyDpr && opts.partyDpr > 0 ? opts.partyDpr : base.dpr;
  const roundsToKill = opts.monsterSustain / dpr;
  const mer = base.sustain / opts.monsterDpr;
  const raceMargin = mer - roundsToKill;

  const damageTaken = opts.monsterDpr * roundsToKill * attritionFactor(bodies);

  // The thresholds are shares of `baseEhp`, but the race is run against `sustain`. Put them on
  // the same axis before reading them, or the casualty count and the margin disagree about how
  // much punishment the party owns. Scaled this way, a margin of exactly 0 is exactly a wipe.
  const scale = base.sustain / base.baseEhp;
  let cumulative = 0;
  let pcsDowned = 0;
  let nextPcPressure = 0;
  for (let i = 0; i < base.thresholds.length; i++) {
    const share = base.thresholds[i] * scale;
    if (damageTaken >= cumulative + share) { pcsDowned++; cumulative += share; continue; }
    nextPcPressure = Math.max(0, (damageTaken - cumulative) / share);
    break;
  }

  const hurt = nextPcPressure >= 0.66 ? "1 badly hurt"
    : nextPcPressure >= 0.33 ? "1 at mid HP"
    : nextPcPressure > 0 ? "1 scratched" : "";
  const lethalityRead = pcsDowned >= base.thresholds.length
    ? "PARTY WIPE"
    : [pcsDowned > 0 ? `${pcsDowned} down` : "none down", hurt].filter(Boolean).join(", ");

  return {
    partyLevel: opts.partyLevel,
    partyDpr: dpr,
    partySustain: base.sustain,
    monsterSustain: opts.monsterSustain,
    monsterDpr: opts.monsterDpr,
    bodies,
    roundsToKill, mer, raceMargin,
    status: raceMargin > 1 ? "PARTY AHEAD" : raceMargin > 0 ? "TOO CLOSE" : "MONSTER AHEAD",
    damageTaken, pcsDowned, nextPcPressure, lethalityRead,
  };
}

/**
 * What each classification is SUPPOSED to cost, in characters.
 *
 * The tag is the price of the fight, not its length (Christopher): "a mid boss might last 3
 * rounds but down 1 person, or an act boss might last 4 rounds but down 2, leave one hurt and
 * one at mid hp". Those two entries are his words; the rest step down from them.
 *
 * Verified against the authored Act 3 roster at the level each fight is run: the three Gates
 * land on 1 down and the act boss on 2 down.
 */
export const EXPECTED_LETHALITY: Record<string, { downed: number; note: string }> = {
  normal: { downed: 0, note: "Nobody down. Resource cost only." },
  strong: { downed: 0, note: "Nobody down, but someone should end it hurt." },
  elite: { downed: 0, note: "Nobody down, or one if the party misplays. Expensive, not deadly." },
  "mid-boss": { downed: 1, note: "One down. Roughly three rounds." },
  "act-boss": { downed: 2, note: "Two down, one hurt and one at mid HP. Roughly four rounds." },
  "final-boss": { downed: 3, note: "Three down. The fight is meant to nearly end them." },
};

/** Does the fight cost what its tag says it should? */
export function lethalityVerdict(check: EncounterCheck, classification: string): {
  ok: boolean; expected: number; actual: number; note: string;
} {
  const want = EXPECTED_LETHALITY[classification] ?? EXPECTED_LETHALITY.normal;
  return {
    // One character either side of the mark is inside authoring tolerance; the workbook is a
    // distribution over 150k runs, not a promise about one table's dice.
    ok: Math.abs(check.pcsDowned - want.downed) <= 1,
    expected: want.downed,
    actual: check.pcsDowned,
    note: want.note,
  };
}
