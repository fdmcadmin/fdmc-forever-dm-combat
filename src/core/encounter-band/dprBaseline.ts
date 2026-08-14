/**
 * DPR & SUSTAIN BASELINE — transcribed from the checker workbook, not derived here.
 *
 * Source (2026-08-14): broken_chain_campaign_baseline_L1_16_multiclass_monster_validated.xlsx
 * — 93,000 party runs over 128 profiles (64 representative + 64 multiclass progression),
 * plus 80,000 monster sustain calibration cases and 28 published monster fixtures.
 * Supersedes broken_chain_campaign_dpr_sustain_checker_effective_sustain_truth.xlsx as the
 * source, but NOT as the numbers for L3–12 — see the freeze note on PARTY_BASELINE.
 *
 * THIS FILE IS A TRANSCRIPTION. Do not tune these numbers to make an encounter read the way
 * you want it to — change the workbook and re-transcribe, or the app and the model stop
 * agreeing about what the campaign is. The workbook's own authoring rule says the same thing
 * from the other side: "the checker does not inflate monster HP to hit a desired round target."
 *
 * Party figures are the CHECKER baseline, which layers three things onto the legacy
 * population: generic +1 armour coverage, Tier 3 weapon power at the level the party
 * actually receives it, and a mixed generic Convergence spread. Specific item effects are
 * deliberately outside the model.
 */

/**
 * The party's damage DECAYS across a fight, then settles on a floor it can hold forever.
 *
 * Round 1 is a nova — the best slots, the readied burst, everything up front. By round 4 the
 * party is on `r4plus`, the repeatable output with nothing left to spend. Flattening this into
 * one average is what made short fights read soft and long fights read lethal: a 2-round fight
 * is fought almost entirely at nova rates, and a 7-round one almost entirely at the floor.
 */
export type RoundCurve = {
  r1: number;
  r2: number;
  r3: number;
  /** The repeatable floor — every round from the fourth onward. */
  r4plus: number;
};

/** Party damage in round `n` (1-indexed). Round 4 and later all use the floor. */
export function partyDamageInRound(curve: RoundCurve, round: number): number {
  return round <= 1 ? curve.r1 : round === 2 ? curve.r2 : round === 3 ? curve.r3 : curve.r4plus;
}

export type PartyBaseline = {
  level: number;
  stage: string;
  act: string;
  /**
   * Bonded balanced DPR — the single summary figure. Kept because the pacing model and the
   * encounter builder are calibrated against it; the round-by-round resolution uses `rounds`.
   */
  dpr: number;
  /** Party effective HP before the sustain layer. */
  baseEhp: number;
  /** Party effective sustain — what the monster has to chew through. */
  sustain: number;
  /**
   * Per-PC shares of baseEhp, squishiest first. They SUM to baseEhp, so read cumulatively:
   * damage past the first drops one PC, past the first two drops a second, and so on.
   * This is what makes a tag mean LETHALITY rather than round count.
   *
   * ⚠ ON THE BASE-EHP AXIS, not the sustain axis. The workbook publishes these as "PC1..PC4
   * sustain", which are these values already scaled by `sustain / baseEhp`; the checker applies
   * that scale itself. New levels are converted back onto this axis so both ends agree.
   */
  thresholds: [number, number, number, number];
  /** Round-by-round damage. See `RoundCurve`. */
  rounds: RoundCurve;
};

/**
 * ⚠ L3–12 ARE FROZEN. DO NOT RETUNE THEM (Christopher, 2026-08-14).
 *
 * The L1–16 workbook re-ran the population at 128 party profiles / 93,000 party runs and
 * reached its own L3–12 centers that sit within **1.7%** of these (its stated 2% overlap rule;
 * measured max DPR shift 0.017207, max sustain shift 0.004243). Its own Decision cell reads
 * "PASS — freeze L3–L12", and every L3–12 row in it is sourced **"Frozen prior baseline"**.
 * Christopher: *"there is only a 1.7% variance so do not change our current model in them."*
 *
 * So the `dpr` / `baseEhp` / `sustain` / `thresholds` on levels 3–12 below are UNTOUCHED. What
 * they gained is the `rounds` curve, which was always part of the same frozen rows and had
 * simply never been transcribed. L1–2 and L13–16 are new, and come from the expanded medians.
 *
 * Chasing sub-2% churn through a campaign's authored encounters costs more than it buys —
 * that is the whole point of the workbook freezing them.
 */
export const PARTY_BASELINE: PartyBaseline[] = [
  { level: 1, stage: "Pre-Bond", act: "Act 1", dpr: 23.092678, baseEhp: 62.313096, sustain: 67.070439, thresholds: [13.22, 14.42, 16.32, 18.16], rounds: { r1: 25.965499, r2: 23.589244, r3: 20.987872, r4plus: 20.060562 } },
  { level: 2, stage: "Pre-Bond", act: "Act 1", dpr: 29.944473, baseEhp: 96.632877, sustain: 106.032481, thresholds: [20.53, 22.47, 25.36, 28.22], rounds: { r1: 34.58, r2: 31.332989, r3: 27.5902, r4plus: 24.764428 } },
  { level: 3, stage: "Realized", act: "Act 2", dpr: 38.792, baseEhp: 135.76, sustain: 161.96, thresholds: [28.95, 31.54, 35.68, 39.6], rounds: { r1: 49.272646, r2: 42.809991, r3: 38.511015, r4plus: 31.652184 } },
  { level: 4, stage: "Realized", act: "Act 2", dpr: 42.76, baseEhp: 175.32, sustain: 204.76, thresholds: [37.11, 40.86, 46.08, 51.28], rounds: { r1: 54.80862, r2: 47.514452, r3: 42.431125, r4plus: 34.730948 } },
  { level: 5, stage: "Realized", act: "Act 2", dpr: 60.171, baseEhp: 218.56, sustain: 257.75, thresholds: [45.72, 50.66, 57.79, 64.38], rounds: { r1: 75.586898, r2: 66.201467, r3: 59.31444, r4plus: 49.612888 } },
  { level: 6, stage: "Metamorphosis", act: "Act 3", dpr: 67.332, baseEhp: 255.62, sustain: 310.01, thresholds: [54.02, 59.64, 67.3, 74.64], rounds: { r1: 82.411563, r2: 73.277715, r3: 66.244529, r4plus: 56.234642 } },
  { level: 7, stage: "Metamorphosis", act: "Act 3", dpr: 84.401, baseEhp: 302.57, sustain: 367.52, thresholds: [63.95, 71.04, 79.32, 88.25], rounds: { r1: 88.740405, r2: 78.685381, r3: 70.935676, r4plus: 59.705269 } },
  { level: 8, stage: "Metamorphosis", act: "Act 3", dpr: 90.299, baseEhp: 351.76, sustain: 425.98, thresholds: [74.48, 82.87, 92.3, 102.11], rounds: { r1: 93.900856, r2: 83.544579, r3: 75.099092, r4plus: 63.061294 } },
  { level: 9, stage: "Tempered", act: "Act 4", dpr: 114.179, baseEhp: 392, sustain: 480.97, thresholds: [81.58, 92.91, 103.22, 114.3], rounds: { r1: 109.095744, r2: 97.293067, r3: 87.792706, r4plus: 74.920756 } },
  { level: 10, stage: "Tempered", act: "Act 4", dpr: 115.387, baseEhp: 428.66, sustain: 520.8, thresholds: [88.79, 102.09, 113.2, 124.58], rounds: { r1: 111.51422, r2: 99.100888, r3: 89.666279, r4plus: 75.362317 } },
  { level: 11, stage: "Tempered", act: "Act 4", dpr: 119.918, baseEhp: 466.67, sustain: 566.58, thresholds: [97.17, 111.36, 123.07, 135.08], rounds: { r1: 118.314408, r2: 105.524088, r3: 94.605017, r4plus: 78.799723 } },
  { level: 12, stage: "Tempered", act: "Act 4", dpr: 125.384, baseEhp: 504.78, sustain: 605.34, thresholds: [105.22, 120.53, 132.83, 146.2], rounds: { r1: 125.233599, r2: 111.224421, r3: 100.027012, r4plus: 82.683449 } },
  { level: 13, stage: "Unbroken", act: "Act 5", dpr: 120.236569, baseEhp: 502.012993, sustain: 655.480795, thresholds: [104.67, 119.67, 131.71, 145.02], rounds: { r1: 133.740985, r2: 118.626813, r3: 106.095186, r4plus: 88.55389 } },
  { level: 14, stage: "Unbroken", act: "Act 5", dpr: 125.815265, baseEhp: 541.26583, sustain: 698.398942, thresholds: [113.15, 129.11, 142.17, 156.27], rounds: { r1: 139.791602, r2: 123.587028, r3: 111.093724, r4plus: 93.526699 } },
  { level: 15, stage: "Unbroken", act: "Act 5", dpr: 132.545722, baseEhp: 579.23822, sustain: 748.32761, thresholds: [121.01, 137.98, 152.03, 167.44], rounds: { r1: 147.753946, r2: 130.498347, r3: 117.106415, r4plus: 98.584686 } },
  { level: 16, stage: "Unbroken", act: "Act 5", dpr: 138.566901, baseEhp: 616.624636, sustain: 793.202079, thresholds: [128.85, 147.06, 161.82, 178.25], rounds: { r1: 154.687108, r2: 137.045925, r3: 122.845394, r4plus: 103.375296 } },
];

/**
 * Monster AC the model expects at each party level — the zero point for the AC delta.
 *
 * Extended to the full L1–16 span 2026-08-14. Levels 3–9 were already here and the new
 * workbook publishes them identically; **10–12 were missing entirely**, so `effectiveSustain`
 * silently skipped the AC term for three levels the baseline already covered.
 */
export const EXPECTED_MONSTER_AC: Record<number, number> = {
  1: 13, 2: 13, 3: 14, 4: 15, 5: 16, 6: 16, 7: 16, 8: 17, 9: 17,
  10: 18, 11: 18, 12: 18, 13: 19, 14: 19, 15: 19, 16: 20,
};

/**
 * AC delta -> effective-sustain contribution. Applied PER CREATURE, before encounter
 * totals. Deltas beyond +/-3 combine the listed bands.
 */
export const AC_DELTA_CONTRIBUTION: Record<number, number> = {
  "-3": -0.12288379260766968,
  "-2": -0.08062745835757301,
  "-1": -0.043412247481326216,
  0: 0,
  1: 0.04538239943698086,
  2: 0.0876983537201741,
  3: 0.14009978560652026,
};

/**
 * Trait -> effective-sustain contribution.
 *
 * Single-factor AUTHORING REFERENCES. The workbook is explicit that multiple recurring
 * defences are NOT automatically additive, and that conditional entries count only when
 * the party can realistically exploit them — so these are what a DM reaches for when
 * describing a creature, not a formula to sum blindly.
 *
 * Negative entries are weaknesses: a low relevant save, or a vulnerability the party can
 * hit repeatedly, REDUCES the creature's effective sustain.
 */
export const SUSTAIN_TRAITS: { label: string; contribution: number }[] = [
  { label: "Relevant save / ABS −1 vs CR expectation [conditional]", contribution: -0.025 },
  { label: "Relevant save / ABS −2 vs CR expectation [conditional]", contribution: -0.05 },
  { label: "Relevant save / ABS −3 vs CR expectation [conditional]", contribution: -0.075 },
  { label: "Vulnerability — ~25% of opposing damage", contribution: -0.2 },
  { label: "Vulnerability — ~50% of opposing damage", contribution: -0.3333333333333333 },
  { label: "Vulnerability — ~75% of opposing damage", contribution: -0.42857142857142855 },
  { label: "Vulnerability — ~100% of opposing damage", contribution: -0.5 },
  { label: "Magic Resistance", contribution: 0.11582399372059626 },
  { label: "Evasion-like", contribution: 0.05692769421928534 },
  { label: "Resistance — ~25% of opposing damage", contribution: 0.1440096727974145 },
  { label: "Resistance — ~50% of opposing damage", contribution: 0.34183418117197717 },
  { label: "Resistance — ~75% of opposing damage", contribution: 0.5858292424284814 },
  { label: "Broad resistance below half HP", contribution: 0.17560031351146632 },
  { label: "Telegraphed alternating immunity/resistance", contribution: 0.0759159908422331 },
  { label: "Reactive resistance to last damage type", contribution: 0.05587790305677687 },
  { label: "Nonmagical weapon resistance (campaign gear)", contribution: 0.015517617805909323 },
  { label: "Regeneration 5/round", contribution: 0.037114407532524485 },
  { label: "Regeneration 10/round", contribution: 0.07901267778697774 },
  { label: "Regeneration 15/round", contribution: 0.12290885490705916 },
  { label: "One-time heal — 20% max HP", contribution: 0.13945555937641974 },
  { label: "One-time heal — 35% max HP", contribution: 0.21416727720970496 },
  { label: "Shield-like +5 AC — 1 round", contribution: 0.14153696550922712 },
  { label: "Shield-like +5 AC — 2 rounds", contribution: 0.20415184169656952 },
  { label: "Fixed prevention — 8/round", contribution: 0.1418712644969924 },
  { label: "Fixed prevention — 12/round", contribution: 0.2323134514052565 },
  { label: "First attack each round at disadvantage", contribution: 0.047749343564075675 },
  { label: "All attacks at disadvantage — 1 round", contribution: 0.1294156939022204 },
  { label: "Half cover vs ranged attacks", contribution: 0.049548456103407856 },
  { label: "Concealment until first attack hits each round", contribution: 0.11325953581508919 },
  { label: "Opposing damage uptime −10%", contribution: 0.10834841514716653 },
  { label: "Opposing damage uptime −20%", contribution: 0.23422706888237932 },
  { label: "Relentless — drop to 1 HP once", contribution: 0.09520404861541021 },
  { label: "Phase restore — 25% max HP", contribution: 0.3116716245371236 },
  { label: "Phase restore — 50% max HP", contribution: 0.5433809697892558 },
  { label: "Legendary Resistance — 1 use", contribution: 0.04245766357823744 },
  { label: "Legendary Resistance — 3 uses", contribution: 0.045307068056192445 },
  { label: "Flat DR 3 per damaging hit [volatile]", contribution: 0.37791525515971514 },
  { label: "Flat DR 5 per damaging hit [volatile]", contribution: 0.7515761283417193 },
  { label: "Three attack-decoy images", contribution: 0.2521802532019184 },
  { label: "Damage cap — 40% max HP/round [volatile]", contribution: 0.7533213340633 },
];
