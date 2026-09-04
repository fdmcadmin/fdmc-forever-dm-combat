/**
 * PARTY CURVE — regenerated from the 4,096-runtime actor-first balanced-centre workbook,
 * `Rounds DPR & Sustain` in broken_chain_encounter_checker_V3_2_4096.
 *
 * ⚠ THE NUMBERS IN HERE ARE NO LONGER THE 128-PARTY FIELD. Christopher: *"this model of the dpr
 * and sustain is much closer because it used 4096 parties to get those numbers"*. The workbook
 * runs 2,048 WotC + 2,048 Broken Chain parties per level across 327,680 scheduled fight slots,
 * with individual PC HP/THP/slots/HD and NO pooled sustain, and publishes the four-endpoint
 * balanced centre — (BOS + BDS + WOS + WDS) / 4 — for R1/R2/R3/R4+/Sustain at every level 1-16.
 *
 * `dpr` is the FOUR-ROUND AVERAGE of that profile, which is the workbook's own summary statistic
 * ("Current Party 4-Round Avg", Runtime Inputs B27) rather than a separately published figure.
 * `sustainPerPc` stays sustain / 4, unchanged: the contract gives every PC an equal pool.
 *
 * Levels 17-20 carry no population run — the workbook states "NO L17-20 POPULATION RUN — NOT USED
 * BY CHECKER" — so they are projected from the new level 16 using the same level-to-level shape
 * the previous projection used, and keep the PROJECTED badge that `isProjectedLevel` enforces.
 *
 * The history below is kept because it is why this file is generated rather than transcribed.
 *
 * ⚠ THE FILE IS STILL NAMED partyCurveV2; THE DATA IS v7. The module name is a code identifier
 * with call sites across the checker, and renaming it is churn. The DATA in it was the thing that
 * mattered and it was stale: transcribed from `party_curve_v2.json` out of the v2 workbook, and
 * left there while the bundle moved to v7.
 *
 * ⚠ THE APP WAS RUNNING A WEAKER PARTY THAN v7 SPECIFIES, at every Act 3 level:
 *
 *     level    v7 round1 / sustain     app was      delta
 *     L6         89.5 / 340.4        89.5 / 335.9    0.00 / −4.50
 *     L7         96.2 / 392.0        95.0 / 387.5   −1.20 / −4.50
 *     L8        112.5 / 442.3       111.3 / 437.8   −1.20 / −4.50
 *     L9        138.8 / 502.7       137.0 / 498.2   −1.80 / −4.50
 *     L10       155.2 / 545.0       139.7 / 539.2  −15.54 / −5.86
 *
 * A uniform −4.5 sustain is not rounding drift, it is a different measurement — and it made every
 * encounter read harder than the workbook says it is. Rows are now generated directly from
 * `party_curve.curve`, so the two cannot diverge again without the bundle changing.
 *
 * ⚠ GIFTS AND CONVERGENCE ARE IN THESE NUMBERS, and I reported the opposite. v7
 * `party_curve.generalized_broken_chain_progression.gift_rule`: *"The existing validated gear
 * curve already includes the generalized +2 Gift chassis and average rider for 2 bearers at level
 * 8 and all 4 bearers from level 9."* The mode description says it outright too — *"Gift counts
 * and Convergence maturity come from the authored drop checkpoint for the selected level; the
 * user never selects loot for the checker."* `generalizedGiftCount` is 2 at L8 and 4 at L9,
 * matching the campaign's own gates exactly. Selecting Convergence by hand is an OPTIONAL extra
 * on top, not the baseline.
 *
 * ⚠ THIS SUPERSEDES `dprBaseline.PARTY_BASELINE`. Where the two disagree, this wins — the old
 * baseline stopped at L12, had one equipment mode, and carried per-PC thresholds that were
 * authored rather than derived.
 *
 * TWO EQUIPMENT MODES, and the switch is a REQUIRED app feature — a table running the checker
 * without the Broken Chain campaign must be able to turn it off:
 *  · `wotcStandard` — no automatic combat bonus from unspecified magic items. The GENERIC
 *    mode: the generalized four-player progression, with no campaign loot assumed.
 *  · `brokenChain` — the campaign gear overlay is included, because the campaign's projected loot
 *    distribution is tied into the curve. That INCLUDES the Feywild Gifts and Convergence
 *    maturity at their authored drop checkpoints — 2 Gifts from level 8, all 4 from level 9 —
 *    so nothing needs supplying per encounter for the baseline to be right.
 *
 *    ⚠ THE SENTENCE THAT USED TO SIT HERE CAUSED A FALSE AUDIT FINDING. It read "Selected
 *    Convergence stays a SEPARATE encounter input: burst is added to round 1 only, sustain credit
 *    to sustain" — true of an OPTIONAL hand-picked Convergence bonus on top, but I read it during
 *    the section 9 run as meaning the baseline lacked the campaign rewards, and reported F4–F10
 *    as priced without them. It was the run's headline caveat and it was invented. Christopher:
 *    *"the workbook has the gifts and convergence built into the loot distribution at the gates
 *    they get them."* A comment that describes an optional extra must not read like a gap.
 *
 * Levels 1–16 are empirical (128-party field). 17–20 are PROJECTED and must be badged.
 * Levels 1–2 are campaign-only; the generic checker's own floor is level 3.
 */

export type PartyEquipmentMode = "wotcStandard" | "brokenChain";

export type PartyCurveMode = {
  /** Summary DPR. The ROUND PROFILE below is what the simulation actually consumes. */
  dpr: number;
  sustain: number;
  round1: number;
  round2: number;
  round3: number;
  round4Plus: number;
  /** sustain ÷ 4 — the contract gives every PC an EQUAL pool. */
  sustainPerPc: number;
};

export type PartyCurveRow = {
  level: number;
  stage: string;
  evidence: string;
  weightedSamples: number;
  wotcStandard: PartyCurveMode;
  brokenChain: PartyCurveMode;
};

/**
 * The levels the checker offers. 1–20, both equipment modes.
 *
 * ⚠ THIS WAS 3, AND THE 3 WAS NOT A DATA LIMIT. The header above says "levels 1–2 are
 * campaign-only; the generic checker's own floor is level 3", and the selector was built straight
 * off this constant — so no table, campaign or generic, could check a level 1 or level 2 fight at
 * all. Christopher: *"how would a DM build lvl 1 and 2 encounters if they cant check them against
 * a party, standard or BC."*
 *
 * There is nothing to withhold. Both rows are complete for BOTH modes and carry the same evidence
 * class as every level up to 16 — `EMPIRICAL_REBUILT_128_PARTY_FIELD`, 3000 weighted samples,
 * stage "Pre-Bond" — and the two modes diverge exactly where they should: identical at L1, where
 * no gear has dropped yet, and 29.8 vs 32.0 DPR at L2, where the campaign overlay starts. The
 * party defence curve publishes AC and all six saves at both levels in both modes too.
 *
 * So the restriction described a publication scope, not a gap in what can be answered, and it cost
 * the first two levels of every campaign.
 */
export const GENERIC_CHECKER_LEVELS = { minimum: 1, maximum: 20 } as const;
export const EMPIRICAL_LEVELS = { minimum: 1, maximum: 16 } as const;
export const PROJECTED_LEVELS = { minimum: 17, maximum: 20 } as const;

/** 17–20 carry no field samples; the contract requires a PROJECTED badge on them. */
export function isProjectedLevel(level: number): boolean {
  return level >= PROJECTED_LEVELS.minimum;
}

/**
 * max(0.25, 1 + 0.25 × (party size − 4)).
 *
 * ⚠ Applies to creature EFFECTIVE HP only, never to creature DPR — the contract states that
 * as its own guardrail. It also replaces the old 3/4/5-only `PARTY_SIZE_HP_MULTIPLIER` map.
 */
export function partySizeHpMultiplier(partySize: number): number {
  if (!Number.isFinite(partySize) || partySize < 1) {
    throw new RangeError("partySize must be a positive number");
  }
  return Math.max(0.25, 1 + 0.25 * (partySize - 4));
}

export const PARTY_CURVE_V2: PartyCurveRow[] = [
  { level: 1, stage: "Pre-Bond", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 22.796206727430558, sustain: 70.25999999999999, round1: 26.069962500000003, round2: 24.001712500000004, round3: 21.522687500000004, round4Plus: 19.590464409722223, sustainPerPc: 17.564999999999998 },
    brokenChain: { dpr: 29.953419140625, sustain: 122.85875, round1: 33.2684, round2: 32.122437500000004, round3: 25.076300000000003, round4Plus: 29.3465390625, sustainPerPc: 30.7146875 } },
  { level: 2, stage: "Pre-Bond", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 25.823964843749998, sustain: 90.25, round1: 31.81525, round2: 30.693025, round3: 21.288175, round4Plus: 19.499409375000003, sustainPerPc: 22.5625 },
    brokenChain: { dpr: 30.16712154503105, sustain: 168.8475, round1: 32.798424999999995, round2: 32.882374999999996, round3: 28.885725, round4Plus: 26.101961180124224, sustainPerPc: 42.211875 } },
  { level: 3, stage: "Realized", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 27.898010441706727, sustain: 162.075, round1: 32.266237499999995, round2: 31.447325, round3: 26.376949999999997, round4Plus: 21.50152926682692, sustainPerPc: 40.51875 },
    brokenChain: { dpr: 31.162578166239005, sustain: 238.06375, round1: 32.318200000000004, round2: 33.568137500000006, round3: 32.204437500000004, round4Plus: 26.559537664956014, sustainPerPc: 59.5159375 } },
  { level: 4, stage: "Realized", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 35.77934394736842, sustain: 199.405, round1: 41.65872, round2: 39.93082, round3: 36.50187, round4Plus: 25.025965789473688, sustainPerPc: 49.85125 },
    brokenChain: { dpr: 35.21440541218638, sustain: 275.40625, round1: 37.20325, round2: 35.789950000000005, round3: 35.68285, round4Plus: 32.18157164874552, sustainPerPc: 68.8515625 } },
  { level: 5, stage: "Realized", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 41.98352148731203, sustain: 266.985, round1: 48.788825, round2: 44.50217500000001, round3: 41.13055, round4Plus: 33.51253594924812, sustainPerPc: 66.74625 },
    brokenChain: { dpr: 44.83075380200525, sustain: 356.895, round1: 48.336406249999996, round2: 46.55515625, round3: 47.742093749999995, round4Plus: 36.68935895802099, sustainPerPc: 89.22375 } },
  { level: 6, stage: "Metamorphosis", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 43.92280386317356, sustain: 372.925, round1: 50.2215125, round2: 47.158012500000005, round3: 42.1499625, round4Plus: 36.161727952694235, sustainPerPc: 93.23125 },
    brokenChain: { dpr: 48.69975007052432, sustain: 431.7975, round1: 51.3597375, round2: 50.912237499999996, round3: 52.1160625, round4Plus: 40.410962782097286, sustainPerPc: 107.949375 } },
  { level: 7, stage: "Metamorphosis", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 46.28718461150918, sustain: 373.685, round1: 51.916112500000004, round2: 49.489225000000005, round3: 45.347025, round4Plus: 38.39637594603673, sustainPerPc: 93.42125 },
    brokenChain: { dpr: 49.04445238723043, sustain: 497.52125, round1: 52.07719375, round2: 52.20844375, round3: 51.10956875000001, round4Plus: 40.782603298921714, sustainPerPc: 124.3803125 } },
  { level: 8, stage: "Metamorphosis", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 49.37493211530877, sustain: 543.9399999999999, round1: 53.292405, round2: 54.172605000000004, round3: 49.543675, round4Plus: 40.49104346123507, sustainPerPc: 135.98499999999999 },
    brokenChain: { dpr: 65.07449656468532, sustain: 509.49249999999995, round1: 69.44502500000002, round2: 72.884375, round3: 54.81542, round4Plus: 63.15316625874125, sustainPerPc: 127.37312499999999 } },
  { level: 9, stage: "Tempered", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 63.52790418519256, sustain: 471.735, round1: 74.33088875, round2: 69.26950125, round3: 62.86775125, round4Plus: 47.64347549077024, sustainPerPc: 117.93375 },
    brokenChain: { dpr: 74.62194321289064, sustain: 717.39375, round1: 82.01242625, round2: 82.85242625000001, round3: 59.572241250000005, round4Plus: 74.05067910156251, sustainPerPc: 179.3484375 } },
  { level: 10, stage: "Tempered", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 65.624775, sustain: 473.27, round1: 74.461975, round2: 72.436975, round3: 65.666475, round4Plus: 49.933675, sustainPerPc: 118.3175 },
    brokenChain: { dpr: 82.33226645029106, sustain: 731.1324999999999, round1: 93.8408375, round2: 90.01151250000001, round3: 70.5989375, round4Plus: 74.87777830116421, sustainPerPc: 182.78312499999998 } },
  { level: 11, stage: "Tempered", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 70.43130624051234, sustain: 568.12, round1: 80.5919925, round2: 75.4713425, round3: 68.35259250000001, round4Plus: 57.30929746204934, sustainPerPc: 142.03 },
    brokenChain: { dpr: 80.23446695601852, sustain: 768.9225, round1: 82.74552500000001, round2: 83.001275, round3: 75.8589, round4Plus: 79.33216782407408, sustainPerPc: 192.230625 } },
  { level: 12, stage: "Tempered", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 75.0701225177485, sustain: 739.72, round1: 85.36638, round2: 80.548955, round3: 74.77905500000001, round4Plus: 59.58610007099392, sustainPerPc: 184.93 },
    brokenChain: { dpr: 80.67613251262627, sustain: 893.2574999999999, round1: 85.50145, round2: 84.92335, round3: 76.48049999999999, round4Plus: 75.79923005050506, sustainPerPc: 223.31437499999998 } },
  { level: 13, stage: "Unbroken", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 91.78475882339015, sustain: 664.4749999999999, round1: 105.10455499999999, round2: 98.85579375, round3: 88.51290499999999, round4Plus: 74.6657815435606, sustainPerPc: 166.11874999999998 },
    brokenChain: { dpr: 102.44086455729166, sustain: 1047.1525000000001, round1: 108.8904625, round2: 103.15514999999999, round3: 98.5652025, round4Plus: 99.15264322916666, sustainPerPc: 261.78812500000004 } },
  { level: 14, stage: "Unbroken", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 80.11560501420456, sustain: 706.1350000000001, round1: 91.8806575, round2: 89.06633250000002, round3: 75.87913250000001, round4Plus: 63.636297556818185, sustainPerPc: 176.53375000000003 },
    brokenChain: { dpr: 109.49881244404841, sustain: 1014.76125, round1: 119.75623750000001, round2: 118.91141250000001, round3: 96.30465000000001, round4Plus: 103.02294977619363, sustainPerPc: 253.6903125 } },
  { level: 15, stage: "Unbroken", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 93.39998622855393, sustain: 779.3, round1: 110.06521875000001, round2: 103.33691249999998, round3: 94.1535125, round4Plus: 66.04430116421568, sustainPerPc: 194.825 },
    brokenChain: { dpr: 91.310308984375, sustain: 1086.2, round1: 99.28054374999999, round2: 99.07099375, round3: 76.64429999999999, round4Plus: 90.24539843750001, sustainPerPc: 271.55 } },
  { level: 16, stage: "Unbroken", evidence: "EMPIRICAL_4096_RUNTIME_ACTOR_FIRST_BALANCED_CENTER", weightedSamples: 4096,
    wotcStandard: { dpr: 94.82775200892857, sustain: 802.7049999999999, round1: 106.87995, round2: 102.8832, round3: 99.25641999999999, round4Plus: 70.29143803571428, sustainPerPc: 200.67624999999998 },
    brokenChain: { dpr: 96.52608327836981, sustain: 1311.9275, round1: 104.866075, round2: 105.52652499999999, round3: 85.45198500000001, round4Plus: 90.25974811347926, sustainPerPc: 327.981875 } },
  { level: 17, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_4096_LEVEL_16", weightedSamples: 0,
    wotcStandard: { dpr: 99.6654318546208, sustain: 857.5296663069392, round1: 112.19457951048052, round2: 108.13956148554024, round3: 104.27707080113491, round4Plus: 74.05051562132752, sustainPerPc: 214.3824165767348 },
    brokenChain: { dpr: 100.36116873344791, sustain: 1400.6635981634092, round1: 108.81911488523137, round2: 109.86814380928114, round3: 88.85095518463277, round4Plus: 93.9064610546464, sustainPerPc: 350.1658995408523 } },
  { level: 18, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_4096_LEVEL_16", weightedSamples: 0,
    wotcStandard: { dpr: 104.75006396211937, sustain: 916.0988515039654, round1: 117.77348016661253, round2: 113.66447348337667, round3: 109.55167932577967, round4Plus: 78.01062287270861, sustainPerPc: 229.02471287599136 },
    brokenChain: { dpr: 104.35206945676727, sustain: 1495.4496890159728, round1: 112.93425628075363, round2: 114.38838741346673, round3: 92.38512408133784, round4Plus: 97.70051005151088, sustainPerPc: 373.8624222539932 } },
  { level: 19, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_4096_LEVEL_16", weightedSamples: 0,
    wotcStandard: { dpr: 110.09426281817734, sustain: 978.6683058338566, round1: 123.62979291044775, round2: 119.47165639265856, round3: 115.09309142358303, round4Plus: 82.18251054602, sustainPerPc: 244.66707645846415 },
    brokenChain: { dpr: 108.50511714157952, sustain: 1596.6982587081563, round1: 117.21814645054621, round2: 119.09460487260934, round3: 96.05986940476205, round4Plus: 101.64784783840048, sustainPerPc: 399.1745646770391 } },
  { level: 20, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_4096_LEVEL_16", weightedSamples: 0,
    wotcStandard: { dpr: 115.71128769205617, sustain: 1045.511247253829, round1: 129.77731212033194, round2: 125.57553159556892, round3: 120.91480272105785, round4Plus: 86.57750433126598, sustainPerPc: 261.37781181345724 },
    brokenChain: { dpr: 112.82690081918498, sustain: 1704.8499165358699, round1: 121.67770524160368, round2: 123.9944476050297, round3: 99.88078277554568, round4Plus: 105.75466765456089, sustainPerPc: 426.21247913396746 } },
];

export function partyCurveRow(level: number): PartyCurveRow | undefined {
  return PARTY_CURVE_V2.find(r => r.level === level);
}

// ─── Party size, for the UI ───────────────────────────────────────────────────
//
// These moved here when `encounterRounds.ts` was deleted (0.7.9.5). They belong beside
// `partySizeHpMultiplier`, which is the workbook's formula and the only authority any of them
// has — nothing below re-derives a multiplier, it only presents one.

/**
 * The party size the campaign is AUTHORED against. An encounter's authored HP is its 4-player
 * total; every other size scales from there.
 */
export const BASELINE_PARTY_SIZE = 4;

/** Sizes offered in the library UI. The model itself accepts any positive integer. */
export const SUPPORTED_PARTY_SIZES = [3, 4, 5, 6] as const;

/** The multiplier for each offered size — GENERATED from the formula, never a second table. */
export const PARTY_SIZE_HP_MULTIPLIER: Record<number, number> = Object.fromEntries(
  SUPPORTED_PARTY_SIZES.map(size => [size, partySizeHpMultiplier(size)]),
);

/**
 * An encounter's authored 4P HP scaled to the party actually fighting it.
 *
 * ⚠ FOR DISPLAY ONLY. The checker applies `partySizeHpMultiplier` INSIDE `effectiveHpPerBody`,
 * so a roster passed to `simulateEncounter` must carry RAW authored HP — scaling it here as
 * well would apply the multiplier twice.
 *
 * ROUNDS, not floors: rounding reproduces the workbook's own published bands exactly
 * (129/172/215, 166/221/276, 180/240/300), where flooring read one HP light.
 */
export function hpForPartySize(baseHp: number, partySize: number): number {
  const mult = partySizeHpMultiplier(partySize);
  if (mult === 1) return baseHp;
  return Math.max(1, Math.round(baseHp * mult));
}
