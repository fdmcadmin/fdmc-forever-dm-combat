/**
 * PARTY CURVE — regenerated from `Broken_Chain_Actor_First_Party_Curves_L1_16_V3_0_Certified`.
 *
 * ⚠ THIS REPLACES A CURVE THAT WAS LESS THAN HALF THE CERTIFIED DAMAGE. The previous import read
 * `Rounds DPR & Sustain` out of the V3_2_4096 checker workbook and published 51.36 R1 at level 6
 * Broken Chain. The certified curve says 118.69 — the sustain figures agree almost exactly
 * (431.80 vs 430.37), so the gap is entirely offence: feat effects the older sheet never priced.
 * The certification's own regression gate makes that explicit — every one of the 160 four-player
 * points must be STRICTLY ABOVE the prior curve, and all 160 are.
 *
 * That difference is not academic. A3 Gate I: Twilight Pond read FATAL at 4P on the old figures
 * and clears on these.
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

export type PartyCurveModes = {
  wotcStandard: PartyCurveMode;
  brokenChain: PartyCurveMode;
};

export type PartyCurveRow = {
  level: number;
  stage: string;
  evidence: string;
  weightedSamples: number;
  /** The FOUR-PLAYER certification party. Every existing caller reads these two. */
  wotcStandard: PartyCurveMode;
  brokenChain: PartyCurveMode;
  /**
   * ⚠ PARTY SIZE IS CERTIFIED, NOT SCALED — and that is the whole point of this table.
   *
   * `resolvePartyProfile` multiplied the four-player row by `size / 4`, while creature effective
   * HP scaled by `partySizeHpMultiplier`, which is also linear in size. The two cancelled exactly,
   * so changing party size could not change how long a fight took: Twilight Pond read ~10 rounds
   * to clear at 4P, 5P and 6P alike.
   *
   * V3.0 certifies each size independently, rebuilt from the actor-first non-party pool under Bond
   * legality, and the result is NOT linear. At level 6 Broken Chain the six-player sustain is
   * 1.74x the four-player figure where the old scale said 1.50x, and R1 is 1.58x rather than 1.50x.
   * Adding a body buys more than its share, which is what a real table experiences.
   *
   * Absent only on the projected levels' fallback path; `resolvePartyProfile` scales when a size
   * is not certified rather than refusing to answer.
   */
  bySize?: Partial<Record<number, PartyCurveModes>>;
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
  { level: 1, stage: "Pre-Bond", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 27.51822700108839, sustain: 138.22584, round1: 29.124333877647352, round2: 27.05710552220364, round3: 27.61036349788533, round4Plus: 26.28110510661724, sustainPerPc: 34.55646 },
    brokenChain: { dpr: 27.222164461555522, sustain: 138.10875, round1: 28.799014792098596, round2: 26.744437574227064, round3: 27.32951638325701, round4Plus: 26.015689096639413, sustainPerPc: 34.5271875 },
    bySize: {
      3: { wotcStandard: { dpr: 19.520779069379586, sustain: 101.00142714897171, round1: 21.52702209221636, round2: 19.667198670078427, round3: 18.943680963452604, round4Plus: 17.945214551770942, sustainPerPc: 33.66714238299057 },
          brokenChain: { dpr: 19.659099452621938, sustain: 105.21244200687269, round1: 21.71379674915248, round2: 19.78366081549877, round3: 19.033223604925865, round4Plus: 18.105716640910636, sustainPerPc: 35.070814002290895 } },
      4: { wotcStandard: { dpr: 27.51822700108839, sustain: 138.22584, round1: 29.124333877647352, round2: 27.05710552220364, round3: 27.61036349788533, round4Plus: 26.28110510661724, sustainPerPc: 34.55646 },
          brokenChain: { dpr: 27.222164461555522, sustain: 138.10875, round1: 28.799014792098596, round2: 26.744437574227064, round3: 27.32951638325701, round4Plus: 26.015689096639413, sustainPerPc: 34.5271875 } },
      5: { wotcStandard: { dpr: 32.87668993951432, sustain: 194.65566075641175, round1: 36.30485525733576, round2: 33.30594579110444, round3: 31.771029874273292, round4Plus: 30.12492883534378, sustainPerPc: 38.93113215128235 },
          brokenChain: { dpr: 33.51857786935148, sustain: 198.21591377734677, round1: 37.22334835014978, round2: 33.94607175732682, round3: 32.18468907049654, round4Plus: 30.720202299432792, sustainPerPc: 39.643182755469354 } },
      6: { wotcStandard: { dpr: 39.6997806757741, sustain: 247.1590557564118, round1: 43.230870389077744, round2: 39.49206848871884, round3: 38.963595157893145, round4Plus: 37.112588667406676, sustainPerPc: 41.19317595940196 },
          brokenChain: { dpr: 41.015679803010144, sustain: 246.09935749093898, round1: 44.69103828224969, round2: 40.8766031948035, round3: 40.19605031249548, round4Plus: 38.29902742249188, sustainPerPc: 41.01655958182317 } },
    } },
  { level: 2, stage: "Pre-Bond", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 39.10844170594909, sustain: 169.25106049375236, round1: 47.22160755683748, round2: 42.9765204071449, round3: 32.97779736191393, round4Plus: 33.25784149790003, sustainPerPc: 42.31276512343809 },
    brokenChain: { dpr: 41.013916777321974, sustain: 171.1000127793236, round1: 49.16895112895958, round2: 44.92566238678281, round3: 34.75985986107132, round4Plus: 35.20119373247419, sustainPerPc: 42.7750031948309 },
    bySize: {
      3: { wotcStandard: { dpr: 25.66708307778149, sustain: 131.45355082851708, round1: 30.74428043632855, round2: 28.30886158070582, round3: 22.4996694634193, round4Plus: 21.115520830672303, sustainPerPc: 43.81785027617236 },
          brokenChain: { dpr: 28.01276387492521, sustain: 132.5488517768287, round1: 33.1861693847571, round2: 30.32277778732424, round3: 24.683623140372227, round4Plus: 23.85848518724727, sustainPerPc: 44.182950592276235 } },
      4: { wotcStandard: { dpr: 39.10844170594909, sustain: 169.25106049375236, round1: 47.22160755683748, round2: 42.9765204071449, round3: 32.97779736191393, round4Plus: 33.25784149790003, sustainPerPc: 42.31276512343809 },
          brokenChain: { dpr: 41.013916777321974, sustain: 171.1000127793236, round1: 49.16895112895958, round2: 44.92566238678281, round3: 34.75985986107132, round4Plus: 35.20119373247419, sustainPerPc: 42.7750031948309 } },
      5: { wotcStandard: { dpr: 43.94185588652726, sustain: 238.69534136688515, round1: 51.35783955876814, round2: 47.053684516394696, round3: 40.1358498407954, round4Plus: 37.22004963015079, sustainPerPc: 47.73906827337703 },
          brokenChain: { dpr: 47.34466194347411, sustain: 254.80793951809585, round1: 55.490054362790964, round2: 50.43160839301399, round3: 42.9935355612771, round4Plus: 40.463449456814374, sustainPerPc: 50.96158790361917 } },
      6: { wotcStandard: { dpr: 51.99687035792934, sustain: 306.83976249708405, round1: 60.20053530284532, round2: 55.1095265955346, round3: 46.994479231275754, round4Plus: 45.68294030206168, sustainPerPc: 51.13996041618068 },
          brokenChain: { dpr: 57.27344163597098, sustain: 329.3297629959782, round1: 66.10817097110768, round2: 60.36084534740685, round3: 51.692199779651204, round4Plus: 50.932550445718206, sustainPerPc: 54.88829383266303 } },
    } },
  { level: 3, stage: "Realized", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 49.06588217037201, sustain: 221.69350384552024, round1: 59.639290316827164, round2: 51.14674278904175, round3: 48.471306160417946, round4Plus: 37.00618941520115, sustainPerPc: 55.42337596138006 },
    brokenChain: { dpr: 53.249260700432956, sustain: 234.73440169101906, round1: 64.16810486813223, round2: 54.5970093394941, round3: 52.07586461897998, round4Plus: 42.15606397512549, sustainPerPc: 58.683600422754765 },
    bySize: {
      3: { wotcStandard: { dpr: 33.51515552281661, sustain: 196.49799435843468, round1: 40.12656301614982, round2: 34.890588890240046, round3: 32.8296448343797, round4Plus: 26.21382535049688, sustainPerPc: 65.49933145281156 },
          brokenChain: { dpr: 37.04711564381569, sustain: 212.95304463666994, round1: 43.670987676695944, round2: 38.85920468683374, round3: 35.97858959240099, round4Plus: 29.679680619332075, sustainPerPc: 70.98434821222331 } },
      4: { wotcStandard: { dpr: 49.06588217037201, sustain: 221.69350384552024, round1: 59.639290316827164, round2: 51.14674278904175, round3: 48.471306160417946, round4Plus: 37.00618941520115, sustainPerPc: 55.42337596138006 },
          brokenChain: { dpr: 53.249260700432956, sustain: 234.73440169101906, round1: 64.16810486813223, round2: 54.5970093394941, round3: 52.07586461897998, round4Plus: 42.15606397512549, sustainPerPc: 58.683600422754765 } },
      5: { wotcStandard: { dpr: 58.05598997423566, sustain: 371.118947693146, round1: 69.41242806817021, round2: 60.953668882566305, round3: 56.42294773718422, round4Plus: 45.43491520902191, sustainPerPc: 74.2237895386292 },
          brokenChain: { dpr: 64.876512723981, sustain: 370.1665325050338, round1: 76.8255873232188, round2: 67.64870063765296, round3: 62.77506657741252, round4Plus: 52.25669635763968, sustainPerPc: 74.03330650100676 } },
      6: { wotcStandard: { dpr: 69.01745503143594, sustain: 464.441447693146, round1: 81.05151834191112, round2: 71.32579457223612, round3: 67.20070132907743, round4Plus: 56.49180588251908, sustainPerPc: 77.40690794885766 },
          brokenChain: { dpr: 77.95425346866807, sustain: 461.1540325050338, round1: 90.56636762831732, round2: 79.98488069529492, round3: 75.61420260991703, round4Plus: 65.65156294114304, sustainPerPc: 76.85900541750563 } },
    } },
  { level: 4, stage: "Realized", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 58.49471919307784, sustain: 314.96040532185094, round1: 68.06836463430346, round2: 61.32144427889845, round3: 57.49614326391834, round4Plus: 47.09292459519111, sustainPerPc: 78.74010133046274 },
    brokenChain: { dpr: 63.24568838348821, sustain: 283.19485432552676, round1: 74.06461752038389, round2: 65.96875081550095, round3: 63.27208137462174, round4Plus: 49.67730382344623, sustainPerPc: 70.79871358138169 },
    bySize: {
      3: { wotcStandard: { dpr: 44.095765403216205, sustain: 253.6921286707308, round1: 52.23282980578041, round2: 46.91208371961583, round3: 42.86619572412903, round4Plus: 34.37195236333953, sustainPerPc: 84.5640428902436 },
          brokenChain: { dpr: 47.14528525534095, sustain: 247.88810240308328, round1: 55.12079017093866, round2: 50.02515135697715, round3: 46.76669462037617, round4Plus: 36.6685048730718, sustainPerPc: 82.62936746769442 } },
      4: { wotcStandard: { dpr: 58.49471919307784, sustain: 314.96040532185094, round1: 68.06836463430346, round2: 61.32144427889845, round3: 57.49614326391834, round4Plus: 47.09292459519111, sustainPerPc: 78.74010133046274 },
          brokenChain: { dpr: 63.24568838348821, sustain: 283.19485432552676, round1: 74.06461752038389, round2: 65.96875081550095, round3: 63.27208137462174, round4Plus: 49.67730382344623, sustainPerPc: 70.79871358138169 } },
      5: { wotcStandard: { dpr: 71.19122661549562, sustain: 482.04764926942886, round1: 84.08865145509134, round2: 74.74453658653327, round3: 68.58153149790067, round4Plus: 57.35018692245721, sustainPerPc: 96.40952985388577 },
          brokenChain: { dpr: 77.18793980141992, sustain: 473.822922026295, round1: 89.9798299629945, round2: 80.8722155799569, round3: 75.19275373312492, round4Plus: 62.70695992960332, sustainPerPc: 94.764584405259 } },
      6: { wotcStandard: { dpr: 84.37409564028528, sustain: 591.6057630914731, round1: 99.71836040640042, round2: 88.2621638640424, round3: 81.35573623985641, round4Plus: 68.16012205084192, sustainPerPc: 98.60096051524552 },
          brokenChain: { dpr: 92.79087908401084, sustain: 593.5357097710929, round1: 107.35160995277195, round2: 96.49349432098766, round3: 90.53019718608093, round4Plus: 76.78821487620282, sustainPerPc: 98.92261829518215 } },
    } },
  { level: 5, stage: "Realized", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 84.0936057701843, sustain: 353.07773309265826, round1: 103.04798981442218, round2: 86.47263463133629, round3: 80.793174799387, round4Plus: 66.06062383559171, sustainPerPc: 88.26943327316457 },
    brokenChain: { dpr: 85.62925677363823, sustain: 368.82890181495446, round1: 101.26592315299419, round2: 88.61763950340388, round3: 83.39355307558017, round4Plus: 69.23991136257467, sustainPerPc: 92.20722545373862 },
    bySize: {
      3: { wotcStandard: { dpr: 62.69305342128051, sustain: 315.31879893568674, round1: 77.96306592998505, round2: 62.1757747606856, round3: 58.80587445545845, round4Plus: 51.82749853899294, sustainPerPc: 105.10626631189558 },
          brokenChain: { dpr: 65.12089011211378, sustain: 301.56587705690407, round1: 78.71558884099244, round2: 63.700365890077386, round3: 61.927073860976144, round4Plus: 56.14053185640914, sustainPerPc: 100.52195901896802 } },
      4: { wotcStandard: { dpr: 84.0936057701843, sustain: 353.07773309265826, round1: 103.04798981442218, round2: 86.47263463133629, round3: 80.793174799387, round4Plus: 66.06062383559171, sustainPerPc: 88.26943327316457 },
          brokenChain: { dpr: 85.62925677363823, sustain: 368.82890181495446, round1: 101.26592315299419, round2: 88.61763950340388, round3: 83.39355307558017, round4Plus: 69.23991136257467, sustainPerPc: 92.20722545373862 } },
      5: { wotcStandard: { dpr: 101.54506289536016, sustain: 549.5635976147332, round1: 123.50865709702737, round2: 100.47903416626309, round3: 96.78242029646329, round4Plus: 85.4101400216869, sustainPerPc: 109.91271952294665 },
          brokenChain: { dpr: 109.27168814264422, sustain: 533.5037953000531, round1: 131.8506836811714, round2: 108.85302346780449, round3: 104.8653809770908, round4Plus: 91.51766444451025, sustainPerPc: 106.70075906001061 } },
      6: { wotcStandard: { dpr: 119.70078440653256, sustain: 673.1763231320425, round1: 146.45248585948065, round2: 118.60198111791394, round3: 113.4640608846057, round4Plus: 100.28460976412998, sustainPerPc: 112.19605385534042 },
          brokenChain: { dpr: 128.29531213297665, sustain: 658.6964971446672, round1: 154.7623387100095, round2: 127.09580581930383, round3: 122.20728256988498, round4Plus: 109.11582143270832, sustainPerPc: 109.7827495241112 } },
    } },
  { level: 6, stage: "Metamorphosis", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 85.99303484206169, sustain: 419.2837825523727, round1: 104.68014619407722, round2: 88.48924337533771, round3: 79.47159432524593, round4Plus: 71.33115547358591, sustainPerPc: 104.82094563809318 },
    brokenChain: { dpr: 97.95380440284774, sustain: 430.3669691843818, round1: 118.68824343018082, round2: 101.05303680975442, round3: 92.89110208143266, round4Plus: 79.18283529002304, sustainPerPc: 107.59174229609545 },
    bySize: {
      3: { wotcStandard: { dpr: 75.48358042106037, sustain: 367.7991823116351, round1: 90.72949297575673, round2: 75.1010322826787, round3: 71.29183509298915, round4Plus: 64.8119613328169, sustainPerPc: 122.5997274372117 },
          brokenChain: { dpr: 82.75988521914533, sustain: 362.76343449288754, round1: 97.83269005914238, round2: 81.22313347076623, round3: 78.63760324171488, round4Plus: 73.34611410495788, sustainPerPc: 120.92114483096252 } },
      4: { wotcStandard: { dpr: 85.99303484206169, sustain: 419.2837825523727, round1: 104.68014619407722, round2: 88.48924337533771, round3: 79.47159432524593, round4Plus: 71.33115547358591, sustainPerPc: 104.82094563809318 },
          brokenChain: { dpr: 97.95380440284774, sustain: 430.3669691843818, round1: 118.68824343018082, round2: 101.05303680975442, round3: 92.89110208143266, round4Plus: 79.18283529002304, sustainPerPc: 107.59174229609545 } },
      5: { wotcStandard: { dpr: 119.7146519059723, sustain: 620.914930435664, round1: 144.62829473606664, round2: 118.67094924191193, round3: 114.23636145437715, round4Plus: 101.32300219153349, sustainPerPc: 124.1829860871328 },
          brokenChain: { dpr: 132.79093446834995, sustain: 612.4299001386639, round1: 158.94957891043782, round2: 131.04140602102063, round3: 127.19181636030508, round4Plus: 113.9809365816362, sustainPerPc: 122.48598002773278 } },
      6: { wotcStandard: { dpr: 141.24388769282268, sustain: 770.6823565109328, round1: 169.4812940321933, round2: 139.42843270696721, round3: 135.20408605704594, round4Plus: 120.86173797508421, sustainPerPc: 128.4470594184888 },
          brokenChain: { dpr: 156.634106067881, sustain: 747.6943175153278, round1: 188.07084031526665, round2: 153.60700752204093, round3: 149.35921222385883, round4Plus: 135.49936421035756, sustainPerPc: 124.61571958588797 } },
    } },
  { level: 7, stage: "Metamorphosis", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 97.28376578819561, sustain: 477.569540251758, round1: 116.08133314667043, round2: 102.74980768097655, round3: 93.23398519894506, round4Plus: 77.06993712619037, sustainPerPc: 119.3923850629395 },
    brokenChain: { dpr: 103.2391274799181, sustain: 493.7415832333304, round1: 122.67772366329233, round2: 106.72367958860585, round3: 100.38865335092677, round4Plus: 83.16645331684741, sustainPerPc: 123.4353958083326 },
    bySize: {
      3: { wotcStandard: { dpr: 79.6309661422593, sustain: 428.7425616671815, round1: 95.86455223921314, round2: 78.99179049231826, round3: 74.50049486867637, round4Plus: 69.16702696882939, sustainPerPc: 142.91418722239385 },
          brokenChain: { dpr: 86.8451172542197, sustain: 415.83985573890595, round1: 105.03316451136354, round2: 84.70363907370789, round3: 80.75171324688644, round4Plus: 76.89195218492097, sustainPerPc: 138.61328524630198 } },
      4: { wotcStandard: { dpr: 97.28376578819561, sustain: 477.569540251758, round1: 116.08133314667043, round2: 102.74980768097655, round3: 93.23398519894506, round4Plus: 77.06993712619037, sustainPerPc: 119.3923850629395 },
          brokenChain: { dpr: 103.2391274799181, sustain: 493.7415832333304, round1: 122.67772366329233, round2: 106.72367958860585, round3: 100.38865335092677, round4Plus: 83.16645331684741, sustainPerPc: 123.4353958083326 } },
      5: { wotcStandard: { dpr: 126.85417402626939, sustain: 725.2885730606486, round1: 148.33460842943123, round2: 128.2747776975487, round3: 121.48697809090658, round4Plus: 109.32033188719105, sustainPerPc: 145.0577146121297 },
          brokenChain: { dpr: 139.26329191123216, sustain: 708.4977106376721, round1: 165.1259913119403, round2: 140.0498921243968, round3: 132.22542891738385, round4Plus: 119.65185529120765, sustainPerPc: 141.69954212753441 } },
      6: { wotcStandard: { dpr: 153.32606653456276, sustain: 883.8360730606485, round1: 181.10451240226928, round2: 155.0154719930141, round3: 147.17383145119737, round4Plus: 130.01045029177033, sustainPerPc: 147.30601217677474 },
          brokenChain: { dpr: 165.91894404319146, sustain: 864.9014864271088, round1: 197.97534400825646, round2: 166.20858914025467, round3: 157.62444142960095, round4Plus: 141.86740159465376, sustainPerPc: 144.15024773785146 } },
    } },
  { level: 8, stage: "Metamorphosis", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 101.77482632560078, sustain: 542.5616805470287, round1: 122.54549522876871, round2: 104.2764532783174, round3: 98.08119233389641, round4Plus: 82.19616446142062, sustainPerPc: 135.64042013675717 },
    brokenChain: { dpr: 122.2835278008707, sustain: 592.1281406436337, round1: 143.94879087884868, round2: 124.34962565472314, round3: 118.62206085265987, round4Plus: 102.2136338172511, sustainPerPc: 148.03203516090844 },
    bySize: {
      3: { wotcStandard: { dpr: 87.0795155103074, sustain: 489.1180746093916, round1: 106.30687877182258, round2: 87.22212647962593, round3: 81.59542065614572, round4Plus: 73.19363613363535, sustainPerPc: 163.03935820313055 },
          brokenChain: { dpr: 103.00305917130389, sustain: 492.881418784066, round1: 126.79265752100851, round2: 102.11650635308578, round3: 94.84294739697384, round4Plus: 88.26012541414742, sustainPerPc: 164.29380626135534 } },
      4: { wotcStandard: { dpr: 101.77482632560078, sustain: 542.5616805470287, round1: 122.54549522876871, round2: 104.2764532783174, round3: 98.08119233389641, round4Plus: 82.19616446142062, sustainPerPc: 135.64042013675717 },
          brokenChain: { dpr: 122.2835278008707, sustain: 592.1281406436337, round1: 143.94879087884868, round2: 124.34962565472314, round3: 118.62206085265987, round4Plus: 102.2136338172511, sustainPerPc: 148.03203516090844 } },
      5: { wotcStandard: { dpr: 139.67390117926925, sustain: 833.5411534742434, round1: 168.72298555179805, round2: 140.94321908240954, round3: 131.81854875001045, round4Plus: 117.210851332859, sustainPerPc: 166.70823069484868 },
          brokenChain: { dpr: 167.09350839525757, sustain: 861.5384205734963, round1: 205.97795644721876, round2: 165.6947254366634, round3: 154.27660933946828, round4Plus: 142.42474235767986, sustainPerPc: 172.30768411469927 } },
      6: { wotcStandard: { dpr: 160.42884988067993, sustain: 1017.8980354610642, round1: 191.9170266296363, round2: 162.74468320921588, round3: 153.34564104818978, round4Plus: 133.70804863567778, sustainPerPc: 169.64967257684404 },
          brokenChain: { dpr: 200.12165407389324, sustain: 1052.721530787408, round1: 244.16504538288004, round2: 200.4584576766821, round3: 185.7532272955134, round4Plus: 170.10988594049738, sustainPerPc: 175.453588464568 } },
    } },
  { level: 9, stage: "Tempered", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 116.91885957017838, sustain: 617.122547189093, round1: 139.66475906744733, round2: 122.45535002493233, round3: 110.25925452073218, round4Plus: 95.29607466760166, sustainPerPc: 154.28063679727325 },
    brokenChain: { dpr: 148.53550891069787, sustain: 638.1736849326206, round1: 175.04056525669003, round2: 152.90035198966646, round3: 142.18699443199836, round4Plus: 124.01412396443664, sustainPerPc: 159.54342123315516 },
    bySize: {
      3: { wotcStandard: { dpr: 91.3106099280952, sustain: 512.844029367397, round1: 111.32833008449832, round2: 91.26052756245626, round3: 85.47506596739709, round4Plus: 77.17851609802914, sustainPerPc: 170.94800978913233 },
          brokenChain: { dpr: 126.48073267160527, sustain: 536.332341504809, round1: 153.56347501331442, round2: 124.71670105538911, round3: 118.65906127125768, round4Plus: 108.98369334645983, sustainPerPc: 178.77744716826967 } },
      4: { wotcStandard: { dpr: 116.91885957017838, sustain: 617.122547189093, round1: 139.66475906744733, round2: 122.45535002493233, round3: 110.25925452073218, round4Plus: 95.29607466760166, sustainPerPc: 154.28063679727325 },
          brokenChain: { dpr: 148.53550891069787, sustain: 638.1736849326206, round1: 175.04056525669003, round2: 152.90035198966646, round3: 142.18699443199836, round4Plus: 124.01412396443664, sustainPerPc: 159.54342123315516 } },
      5: { wotcStandard: { dpr: 155.80293711729493, sustain: 881.1550583072711, round1: 182.8230330109985, round2: 156.45459909206727, round3: 152.1535765125371, round4Plus: 131.78053985357684, sustainPerPc: 176.23101166145423 },
          brokenChain: { dpr: 201.03718000603288, sustain: 911.7709338727179, round1: 242.21634054410987, round2: 199.75310671303004, round3: 193.1565700160989, round4Plus: 169.02270275089268, sustainPerPc: 182.3541867745436 } },
      6: { wotcStandard: { dpr: 178.9490389379988, sustain: 1077.6428451293452, round1: 213.06289406001935, round2: 178.9668881033994, round3: 174.43802081604406, round4Plus: 149.32835277253247, sustainPerPc: 179.60714085489087 },
          brokenChain: { dpr: 232.0797267857256, sustain: 1131.3430857877988, round1: 279.5618381551846, round2: 229.43457108871465, round3: 222.5865479465322, round4Plus: 196.735949952471, sustainPerPc: 188.55718096463315 } },
    } },
  { level: 10, stage: "Tempered", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 120.9328998676628, sustain: 632.5645097257441, round1: 146.43289424863863, round2: 123.95121997162882, round3: 114.06994445102066, round4Plus: 99.27754079936307, sustainPerPc: 158.14112743143602 },
    brokenChain: { dpr: 156.07397775766535, sustain: 746.5053129135626, round1: 194.57102072784477, round2: 156.26647919141485, round3: 144.3780807858546, round4Plus: 129.0803303255472, sustainPerPc: 186.62632822839066 },
    bySize: {
      3: { wotcStandard: { dpr: 92.52428157831254, sustain: 548.523336825139, round1: 113.50006554118781, round2: 91.40839004619873, round3: 86.76538259781093, round4Plus: 78.4232881280527, sustainPerPc: 182.84111227504636 },
          brokenChain: { dpr: 132.6177661343029, sustain: 573.216520502841, round1: 171.39931089590561, round2: 126.01425857813214, round3: 122.6866045618689, round4Plus: 110.37089050130497, sustainPerPc: 191.072173500947 } },
      4: { wotcStandard: { dpr: 120.9328998676628, sustain: 632.5645097257441, round1: 146.43289424863863, round2: 123.95121997162882, round3: 114.06994445102066, round4Plus: 99.27754079936307, sustainPerPc: 158.14112743143602 },
          brokenChain: { dpr: 156.07397775766535, sustain: 746.5053129135626, round1: 194.57102072784477, round2: 156.26647919141485, round3: 144.3780807858546, round4Plus: 129.0803303255472, sustainPerPc: 186.62632822839066 } },
      5: { wotcStandard: { dpr: 162.04171105358841, sustain: 945.7653129804576, round1: 198.13470791611863, round2: 161.30498990283172, round3: 152.4944525943349, round4Plus: 136.23269380106842, sustainPerPc: 189.1530625960915 },
          brokenChain: { dpr: 217.31144316197447, sustain: 975.9972440668457, round1: 279.4761322065342, round2: 207.88914288021158, round3: 199.73844432981355, round4Plus: 182.14205323133856, sustainPerPc: 195.19944881336914 } },
      6: { wotcStandard: { dpr: 182.96356402708187, sustain: 1150.4477509070023, round1: 225.707759681835, round2: 181.96523234018915, round3: 172.40132010300604, round4Plus: 151.77994398329736, sustainPerPc: 191.7412918178337 },
          brokenChain: { dpr: 247.30106490553513, sustain: 1192.3117629646422, round1: 318.9504256798607, round2: 236.20073562948227, round3: 227.76374719256455, round4Plus: 206.2893511202329, sustainPerPc: 198.7186271607737 } },
    } },
  { level: 11, stage: "Tempered", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 126.49841796411557, sustain: 700.9892332150505, round1: 152.72724378729862, round2: 129.19984175038786, round3: 119.0962527871001, round4Plus: 104.97033353167573, sustainPerPc: 175.24730830376262 },
    brokenChain: { dpr: 159.59694218854153, sustain: 812.9940232106343, round1: 199.33956439823294, round2: 158.37208284063604, round3: 149.60017929564157, round4Plus: 131.07594221965556, sustainPerPc: 203.24850580265857 },
    bySize: {
      3: { wotcStandard: { dpr: 104.16492328085192, sustain: 580.1031340297765, round1: 128.06170700878778, round2: 106.38365181489615, round3: 97.03784888219755, round4Plus: 85.17648541752624, sustainPerPc: 193.36771134325883 },
          brokenChain: { dpr: 146.09937064329614, sustain: 636.8485660773969, round1: 188.5218599261646, round2: 142.61536312446162, round3: 133.83754834303716, round4Plus: 119.42271117952119, sustainPerPc: 212.2828553591323 } },
      4: { wotcStandard: { dpr: 126.49841796411557, sustain: 700.9892332150505, round1: 152.72724378729862, round2: 129.19984175038786, round3: 119.0962527871001, round4Plus: 104.97033353167573, sustainPerPc: 175.24730830376262 },
          brokenChain: { dpr: 159.59694218854153, sustain: 812.9940232106343, round1: 199.33956439823294, round2: 158.37208284063604, round3: 149.60017929564157, round4Plus: 131.07594221965556, sustainPerPc: 203.24850580265857 } },
      5: { wotcStandard: { dpr: 186.12600629989743, sustain: 990.455024054857, round1: 227.9867658234889, round2: 190.22878977074654, round3: 174.8207611529058, round4Plus: 151.4677084524485, sustainPerPc: 198.09100481097138 },
          brokenChain: { dpr: 241.03911640882745, sustain: 1052.8907095453835, round1: 305.63075424156966, round2: 236.5002919401213, round3: 222.9398289561788, round4Plus: 199.08559049744008, sustainPerPc: 210.5781419090767 } },
      6: { wotcStandard: { dpr: 214.4469512986953, sustain: 1195.6409150525533, round1: 263.06098102341434, round2: 217.97188900931408, round3: 201.60988757894745, round4Plus: 175.14504758310537, sustainPerPc: 199.2734858420922 },
          brokenChain: { dpr: 278.73044213108005, sustain: 1289.4682218087785, round1: 353.320648399397, round2: 273.7919036107297, round3: 258.77696666629123, round4Plus: 229.03224984790228, sustainPerPc: 214.91137030146308 } },
    } },
  { level: 12, stage: "Tempered", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 143.79108972404742, sustain: 734.8489465310154, round1: 174.84138860127212, round2: 145.14072702274558, round3: 134.41102835286918, round4Plus: 120.7712149193028, sustainPerPc: 183.71223663275384 },
    brokenChain: { dpr: 166.80433548534674, sustain: 806.6191376241527, round1: 204.7643011122592, round2: 165.87381925343237, round3: 153.14724460052702, round4Plus: 143.4319769751684, sustainPerPc: 201.65478440603817 },
    bySize: {
      3: { wotcStandard: { dpr: 113.39777285778158, sustain: 594.1398642639197, round1: 136.3641512855713, round2: 116.56487812082784, round3: 105.21057188185216, round4Plus: 95.45149014287497, sustainPerPc: 198.04662142130655 },
          brokenChain: { dpr: 145.88569040266202, sustain: 668.6247790219572, round1: 182.31933714414413, round2: 141.4400606832813, round3: 134.3002057479385, round4Plus: 125.48315803528419, sustainPerPc: 222.87492634065242 } },
      4: { wotcStandard: { dpr: 143.79108972404742, sustain: 734.8489465310154, round1: 174.84138860127212, round2: 145.14072702274558, round3: 134.41102835286918, round4Plus: 120.7712149193028, sustainPerPc: 183.71223663275384 },
          brokenChain: { dpr: 166.80433548534674, sustain: 806.6191376241527, round1: 204.7643011122592, round2: 165.87381925343237, round3: 153.14724460052702, round4Plus: 143.4319769751684, sustainPerPc: 201.65478440603817 } },
      5: { wotcStandard: { dpr: 197.08864348328908, sustain: 1052.117238128602, round1: 239.0206534904367, round2: 201.60648639686667, round3: 184.10203506251173, round4Plus: 163.62539898334114, sustainPerPc: 210.42344762572037 },
          brokenChain: { dpr: 251.17681770134078, sustain: 1122.922539714022, round1: 316.0973343674508, round2: 245.78486513189353, round3: 232.31770564589738, round4Plus: 210.50736566012145, sustainPerPc: 224.58450794280438 } },
      6: { wotcStandard: { dpr: 236.13864181721559, sustain: 1291.8968714826342, round1: 290.20733800591626, round2: 241.32782027297932, round3: 221.31177346057885, round4Plus: 191.70763552938797, sustainPerPc: 215.3161452471057 },
          brokenChain: { dpr: 300.7085399065188, sustain: 1370.7598772140218, round1: 378.2771558665403, round2: 294.38377770883574, round3: 278.32564549573453, round4Plus: 251.84758055496465, sustainPerPc: 228.4599795356703 } },
    } },
  { level: 13, stage: "Unbroken", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 150.2607005427823, sustain: 815.9207093471734, round1: 183.05627595000314, round2: 152.86523334420417, round3: 139.6402080423639, round4Plus: 125.48108483455795, sustainPerPc: 203.98017733679336 },
    brokenChain: { dpr: 189.7949032901676, sustain: 847.1183088896846, round1: 240.19684125593838, round2: 186.7996526021446, round3: 175.68714077103627, round4Plus: 156.49597853155115, sustainPerPc: 211.77957722242115 },
    bySize: {
      3: { wotcStandard: { dpr: 123.09782653805627, sustain: 667.9947477014433, round1: 147.56307093200994, round2: 122.59423049800708, round3: 113.91598205121261, round4Plus: 108.31802267099546, sustainPerPc: 222.6649159004811 },
          brokenChain: { dpr: 163.27559461567424, sustain: 728.7838098815221, round1: 200.94357994573087, round2: 158.71581589658183, round3: 150.06159024947232, round4Plus: 143.3813923709119, sustainPerPc: 242.92793662717403 } },
      4: { wotcStandard: { dpr: 150.2607005427823, sustain: 815.9207093471734, round1: 183.05627595000314, round2: 152.86523334420417, round3: 139.6402080423639, round4Plus: 125.48108483455795, sustainPerPc: 203.98017733679336 },
          brokenChain: { dpr: 189.7949032901676, sustain: 847.1183088896846, round1: 240.19684125593838, round2: 186.7996526021446, round3: 175.68714077103627, round4Plus: 156.49597853155115, sustainPerPc: 211.77957722242115 } },
      5: { wotcStandard: { dpr: 207.33651023126077, sustain: 1159.2484264629393, round1: 251.5705788460833, round2: 211.31769585389245, round3: 193.68102056450832, round4Plus: 172.77674566055902, sustainPerPc: 231.84968529258785 },
          brokenChain: { dpr: 263.10335203574124, sustain: 1224.776395367785, round1: 324.48298837485373, round2: 257.5407355983757, round3: 244.03552216428193, round4Plus: 226.35416200545362, sustainPerPc: 244.955279073557 } },
      6: { wotcStandard: { dpr: 248.0051655336593, sustain: 1416.4917225203526, round1: 300.69334358466995, round2: 254.23747098497984, round3: 235.5525557303344, round4Plus: 201.53729183465293, sustainPerPc: 236.0819537533921 },
          brokenChain: { dpr: 314.8032548860904, sustain: 1496.8511391428972, round1: 390.8451555585035, round2: 308.9299957746093, round3: 292.7982995746506, round4Plus: 266.63956863659814, sustainPerPc: 249.47518985714953 } },
    } },
  { level: 14, stage: "Unbroken", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 160.8844810600105, sustain: 893.9647704401739, round1: 193.51897422982475, round2: 162.42652709104985, round3: 151.23049052993892, round4Plus: 136.36193238922857, sustainPerPc: 223.49119261004347 },
    brokenChain: { dpr: 189.48137696965125, sustain: 913.5048835764716, round1: 235.04561118935635, round2: 185.39776618707324, round3: 177.64750572344127, round4Plus: 159.83462477873425, sustainPerPc: 228.3762208941179 },
    bySize: {
      3: { wotcStandard: { dpr: 133.87338771904888, sustain: 722.2326263943949, round1: 160.48733287319195, round2: 129.20176289874962, round3: 124.16938740176971, round4Plus: 121.63506770248425, sustainPerPc: 240.7442087981316 },
          brokenChain: { dpr: 172.6573960020333, sustain: 775.8494346672433, round1: 217.78745062367793, round2: 164.5757803811091, round3: 159.11143895045828, round4Plus: 149.1549140528879, sustainPerPc: 258.6164782224144 } },
      4: { wotcStandard: { dpr: 160.8844810600105, sustain: 893.9647704401739, round1: 193.51897422982475, round2: 162.42652709104985, round3: 151.23049052993892, round4Plus: 136.36193238922857, sustainPerPc: 223.49119261004347 },
          brokenChain: { dpr: 189.48137696965125, sustain: 913.5048835764716, round1: 235.04561118935635, round2: 185.39776618707324, round3: 177.64750572344127, round4Plus: 159.83462477873425, sustainPerPc: 228.3762208941179 } },
      5: { wotcStandard: { dpr: 224.61190900460696, sustain: 1243.390655981056, round1: 267.979053761672, round2: 224.99136027799025, round3: 211.38718892664656, round4Plus: 194.09003305211905, sustainPerPc: 248.67813119621118 },
          brokenChain: { dpr: 278.96565748499535, sustain: 1309.7443697709405, round1: 343.05228100083457, round2: 274.1606652152807, round3: 260.9723978768639, round4Plus: 237.6772858470021, sustainPerPc: 261.9488739541881 } },
      6: { wotcStandard: { dpr: 269.4638870834273, sustain: 1511.4832234956216, round1: 328.67842542506753, round2: 271.4285652179803, round3: 254.6104074995217, round4Plus: 223.13815019113986, sustainPerPc: 251.9138705826036 },
          brokenChain: { dpr: 334.2792882579549, sustain: 1636.7365425686219, round1: 412.48850191513105, round2: 328.53405974809095, round3: 314.0763891044784, round4Plus: 282.0182022641191, sustainPerPc: 272.789423761437 } },
    } },
  { level: 15, stage: "Unbroken", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 172.19640187091034, sustain: 923.3275151955638, round1: 207.04331744691774, round2: 173.15373012597178, round3: 161.9800286515464, round4Plus: 146.60853125920536, sustainPerPc: 230.83187879889095 },
    brokenChain: { dpr: 196.35391980396594, sustain: 981.3970731700299, round1: 242.32161495209166, round2: 193.6613863370841, round3: 183.3326835871275, round4Plus: 166.09999433956048, sustainPerPc: 245.34926829250747 },
    bySize: {
      3: { wotcStandard: { dpr: 138.75897446694606, sustain: 760.8701501976499, round1: 166.56564704960866, round2: 133.6736660791634, round3: 126.5015854890901, round4Plus: 128.29499924992203, sustainPerPc: 253.62338339921664 },
          brokenChain: { dpr: 178.73927607379613, sustain: 832.7069509681868, round1: 225.8779942506758, round2: 170.18882001588887, round3: 164.10000509215809, round4Plus: 154.79028493646177, sustainPerPc: 277.56898365606224 } },
      4: { wotcStandard: { dpr: 172.19640187091034, sustain: 923.3275151955638, round1: 207.04331744691774, round2: 173.15373012597178, round3: 161.9800286515464, round4Plus: 146.60853125920536, sustainPerPc: 230.83187879889095 },
          brokenChain: { dpr: 196.35391980396594, sustain: 981.3970731700299, round1: 242.32161495209166, round2: 193.6613863370841, round3: 183.3326835871275, round4Plus: 166.09999433956048, sustainPerPc: 245.34926829250747 } },
      5: { wotcStandard: { dpr: 235.00912857533638, sustain: 1350.2469611467452, round1: 281.8584423643564, round2: 234.44253434329565, round3: 217.71898237787335, round4Plus: 206.01655521582023, sustainPerPc: 270.04939222934905 },
          brokenChain: { dpr: 290.1660501085519, sustain: 1455.315089065114, round1: 357.80833617408445, round2: 281.7859165147962, round3: 269.45517129563314, round4Plus: 251.61477644969352, sustainPerPc: 291.06301781302284 } },
      6: { wotcStandard: { dpr: 284.26760828578716, sustain: 1634.4198674222146, round1: 348.1000834884675, round2: 286.43914355499186, round3: 265.39226347455417, round4Plus: 237.1389426251353, sustainPerPc: 272.4033112370358 },
          brokenChain: { dpr: 350.84674682060734, sustain: 1815.2629988363801, round1: 433.77988603165466, round2: 343.788053496948, round3: 328.1775683945889, round4Plus: 297.6414793592379, sustainPerPc: 302.54383313939667 } },
    } },
  { level: 16, stage: "Unbroken", evidence: "CERTIFIED_V3_0_ACTOR_FIRST_BOS_BDS_WOS_ODS", weightedSamples: 4096,
    wotcStandard: { dpr: 196.34616675070544, sustain: 1076.040885379862, round1: 231.59201565964224, round2: 195.202369519466, round3: 183.24584632168398, round4Plus: 175.3444355020294, sustainPerPc: 269.0102213449655 },
    brokenChain: { dpr: 237.80659866071014, sustain: 1096.712671288423, round1: 294.3944284360854, round2: 232.25295310801238, round3: 220.00431389506002, round4Plus: 204.5746992036828, sustainPerPc: 274.17816782210576 },
    bySize: {
      3: { wotcStandard: { dpr: 158.85104052296765, sustain: 833.3549895568193, round1: 189.7628699259407, round2: 151.7502662710767, round3: 144.53394333479213, round4Plus: 149.35708256006114, sustainPerPc: 277.78499651893975 },
          brokenChain: { dpr: 191.6686130201113, sustain: 921.0595354451094, round1: 244.00846395945854, round2: 178.53889108018393, round3: 172.8780029349567, round4Plus: 171.24909410584615, sustainPerPc: 307.0198451483698 } },
      4: { wotcStandard: { dpr: 196.34616675070544, sustain: 1076.040885379862, round1: 231.59201565964224, round2: 195.202369519466, round3: 183.24584632168398, round4Plus: 175.3444355020294, sustainPerPc: 269.0102213449655 },
          brokenChain: { dpr: 237.80659866071014, sustain: 1096.712671288423, round1: 294.3944284360854, round2: 232.25295310801238, round3: 220.00431389506002, round4Plus: 204.5746992036828, sustainPerPc: 274.17816782210576 } },
      5: { wotcStandard: { dpr: 255.49759490605533, sustain: 1433.2875853461749, round1: 309.2052271898833, round2: 252.43960993039266, round3: 235.21982414502241, round4Plus: 225.12571835892294, sustainPerPc: 286.657517069235 },
          brokenChain: { dpr: 321.6427614305678, sustain: 1541.14520269786, round1: 401.3704679838536, round2: 308.65837705921723, round3: 294.8805399062228, round4Plus: 281.6616607729777, sustainPerPc: 308.229040539572 } },
      6: { wotcStandard: { dpr: 308.9083545941536, sustain: 1756.4082118623307, round1: 372.64157589242933, round2: 307.688932025466, round3: 287.43179118057947, round4Plus: 267.8711192781394, sustainPerPc: 292.7347019770551 },
          brokenChain: { dpr: 383.1348995119508, sustain: 1949.653814970558, round1: 476.07290613790263, round2: 367.9602806396732, round3: 352.60200306101945, round4Plus: 335.904408209208, sustainPerPc: 324.942302495093 } },
    } },
  { level: 17, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_CERTIFIED_V3_0_LEVEL_16", weightedSamples: 0,
    wotcStandard: { dpr: 206.3799598005665, sustain: 1149.5343636484345, round1: 243.107980635453, round2: 205.175370135974, round3: 192.51490322641226, round4Plus: 184.72158520442684, sustainPerPc: 287.3835909121086 },
    brokenChain: { dpr: 247.22391307226692, sustain: 1170.89207773924, round1: 305.49194417315994, round2: 241.80840648549108, round3: 228.75528794697814, round4Plus: 212.8400136834385, sustainPerPc: 292.72301943481 },
    bySize: {
      3: { wotcStandard: { dpr: 166.97286611194866, sustain: 890.2730468975304, round1: 199.19887123864606, round2: 159.50327409983555, round3: 151.8448503612093, round4Plus: 157.3444687481037, sustainPerPc: 296.7576822991768 },
          brokenChain: { dpr: 199.253369909076, sustain: 983.358122334706, round1: 253.20662638105946, round2: 185.88441683972093, round3: 179.75446317815377, round4Plus: 178.16797323736986, sustainPerPc: 327.7860407782353 } },
      4: { wotcStandard: { dpr: 206.3799598005665, sustain: 1149.5343636484345, round1: 243.107980635453, round2: 205.175370135974, round3: 192.51490322641226, round4Plus: 184.72158520442684, sustainPerPc: 287.3835909121086 },
          brokenChain: { dpr: 247.22391307226692, sustain: 1170.89207773924, round1: 305.49194417315994, round2: 241.80840648549108, round3: 228.75528794697814, round4Plus: 212.8400136834385, sustainPerPc: 292.72301943481 } },
      5: { wotcStandard: { dpr: 268.5500940437793, sustain: 1531.1809753069736, round1: 324.58052653478563, round2: 265.3368938704618, round3: 247.11786155697544, round4Plus: 237.1650942128944, sustainPerPc: 306.2361950613947 },
          brokenChain: { dpr: 334.3772978737114, sustain: 1645.385118387305, round1: 416.50056099719615, round2: 321.35733606959394, round3: 306.6098187892079, round4Plus: 293.04147563884766, sustainPerPc: 329.077023677461 } },
      6: { wotcStandard: { dpr: 324.68687443144637, sustain: 1876.370706320594, round1: 391.17126191932095, round2: 323.40893540624796, round3: 301.97084722010237, round4Plus: 282.1964531801143, sustainPerPc: 312.72845105343237 },
          brokenChain: { dpr: 398.305261786787, sustain: 2081.524419336952, round1: 494.01898818818574, round2: 383.09906470835716, round3: 366.6272324977165, round4Plus: 349.47576175288884, sustainPerPc: 346.9207365561587 } },
    } },
  { level: 18, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_CERTIFIED_V3_0_LEVEL_16", weightedSamples: 0,
    wotcStandard: { dpr: 216.92687510368265, sustain: 1228.0474386827063, round1: 255.19657955525517, round2: 215.65789705352904, round3: 202.2528134100971, round4Plus: 194.6002103958492, sustainPerPc: 307.0118596706766 },
    brokenChain: { dpr: 257.02378474920056, sustain: 1250.129007295105, round1: 317.0445335026304, round2: 251.75699453801823, round3: 237.8543440228418, round4Plus: 221.43926693331187, sustainPerPc: 312.5322518237763 },
    bySize: {
      3: { wotcStandard: { dpr: 175.51025941944403, sustain: 951.0786015137583, round1: 209.10407983520062, round2: 167.65238752939396, round3: 159.52556229514988, round4Plus: 165.7590080180316, sustainPerPc: 317.0262005045861 },
          brokenChain: { dpr: 207.14624185451265, sustain: 1049.9042026686575, round1: 262.78197599624593, round2: 193.53215545807865, round3: 186.90444408143193, round4Plus: 185.36639188229412, sustainPerPc: 349.9680675562192 } },
      4: { wotcStandard: { dpr: 216.92687510368265, sustain: 1228.0474386827063, round1: 255.19657955525517, round2: 215.65789705352904, round3: 202.2528134100971, round4Plus: 194.6002103958492, sustainPerPc: 307.0118596706766 },
          brokenChain: { dpr: 257.02378474920056, sustain: 1250.129007295105, round1: 317.0445335026304, round2: 251.75699453801823, round3: 237.8543440228418, round4Plus: 221.43926693331187, sustainPerPc: 312.5322518237763 } },
      5: { wotcStandard: { dpr: 282.2698809517193, sustain: 1635.7604734124277, round1: 340.7203660916818, round2: 278.89310741780065, round3: 259.61773299703725, round4Plus: 249.8483173003574, sustainPerPc: 327.15209468248554 },
          brokenChain: { dpr: 347.62914011329934, sustain: 1756.73207101991, round1: 432.25109068699805, round2: 334.57876124947387, round3: 318.8056458654329, round4Plus: 304.88106265129255, sustainPerPc: 351.346414203982 } },
      6: { wotcStandard: { dpr: 341.27190856683757, sustain: 2004.5266264184413, round1: 410.62234074419257, round2: 339.9320827437042, round3: 317.24532695667756, round4Plus: 297.28788382277594, sustainPerPc: 334.0877710697402 },
          brokenChain: { dpr: 414.0918606395395, sustain: 2222.3859102629726, round1: 512.7009816101257, round2: 398.860695304606, round3: 381.2103347174503, round4Plus: 363.59543092597596, sustainPerPc: 370.39765171049544 } },
    } },
  { level: 19, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_CERTIFIED_V3_0_LEVEL_16", weightedSamples: 0,
    wotcStandard: { dpr: 228.01317273714847, sustain: 1311.9229484090329, round1: 267.88628677048166, round2: 226.6759822620448, round3: 212.48329270482878, round4Plus: 205.0071292112387, sustainPerPc: 327.9807371022582 },
    brokenChain: { dpr: 267.2217569438317, sustain: 1334.768279915922, round1: 329.07085753563206, round2: 262.1148917856947, round3: 247.31532756370424, round4Plus: 230.38595089029573, sustainPerPc: 333.6920699789805 },
    bySize: {
      3: { wotcStandard: { dpr: 184.48449991828863, sustain: 1016.0371690568312, round1: 219.50182715314034, round2: 176.21784382127032, round3: 167.59478484154678, round4Plus: 174.6235438571971, sustainPerPc: 338.6790563522771 },
          brokenChain: { dpr: 215.35974754371713, sustain: 1120.9873688993864, round1: 272.7499800442864, round2: 201.49454070991482, round3: 194.3388253050881, round4Plus: 192.85564411557917, sustainPerPc: 373.66245629979545 } },
      4: { wotcStandard: { dpr: 228.01317273714847, sustain: 1311.9229484090329, round1: 267.88628677048166, round2: 226.6759822620448, round3: 212.48329270482878, round4Plus: 205.0071292112387, sustainPerPc: 327.9807371022582 },
          brokenChain: { dpr: 267.2217569438317, sustain: 1334.768279915922, round1: 329.07085753563206, round2: 262.1148917856947, round3: 247.31532756370424, round4Plus: 230.38595089029573, sustainPerPc: 333.6920699789805 } },
      5: { wotcStandard: { dpr: 296.6910947119022, sustain: 1747.4827401392047, round1: 357.66276279426796, round2: 293.1419156626216, round3: 272.749880813374, round4Plus: 263.20981957734546, sustainPerPc: 349.49654802784096 },
          brokenChain: { dpr: 361.41930593982073, sustain: 1875.670615612602, round1: 448.6474991750728, round2: 348.3441481323141, round3: 331.48657873070454, round4Plus: 317.19899772119135, sustainPerPc: 375.1341231225204 } },
      6: { wotcStandard: { dpr: 358.7047117211872, sustain: 2141.435582257468, round1: 431.0406288307951, round2: 357.2994071215762, round3: 333.2924300553119, round4Plus: 313.1863808770657, sustainPerPc: 356.90593037624467 },
          brokenChain: { dpr: 430.5197326290165, sustain: 2372.8512829003157, round1: 532.1490637731013, round2: 415.2707978548174, round3: 396.3734998771419, round4Plus: 378.2855690110055, sustainPerPc: 395.4752138167193 } },
    } },
  { level: 20, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_CERTIFIED_V3_0_LEVEL_16", weightedSamples: 0,
    wotcStandard: { dpr: 239.6664576991542, sustain: 1401.5271465477529, round1: 281.2069925260837, round2: 238.25698774067703, round3: 223.2312565518654, round4Plus: 215.9705939779907, sustainPerPc: 350.3817866369382 },
    brokenChain: { dpr: 277.8340045385113, sustain: 1425.1782252524617, round1: 341.59034261572566, round2: 272.8989382078569, round3: 257.15263473207153, round4Plus: 239.69410259839108, sustainPerPc: 356.29455631311544 },
    bySize: {
      3: { wotcStandard: { dpr: 193.91795755942258, sustain: 1085.4323998688833, round1: 230.41660479097118, round2: 185.22091417023952, round3: 176.07216988909076, round4Plus: 183.96214138738873, sustainPerPc: 361.81079995629443 },
          brokenChain: { dpr: 223.90691438380898, sustain: 1196.9169577801836, round1: 283.1267400264144, round2: 209.78451792572505, round3: 202.06891926286508, round4Plus: 200.6474803202315, sustainPerPc: 398.97231926006117 } },
      4: { wotcStandard: { dpr: 239.6664576991542, sustain: 1401.5271465477529, round1: 281.2069925260837, round2: 238.25698774067703, round3: 223.2312565518654, round4Plus: 215.9705939779907, sustainPerPc: 350.3817866369382 },
          brokenChain: { dpr: 277.8340045385113, sustain: 1425.1782252524617, round1: 341.59034261572566, round2: 272.8989382078569, round3: 257.15263473207153, round4Plus: 239.69410259839108, sustainPerPc: 356.29455631311544 } },
      5: { wotcStandard: { dpr: 311.8496223041444, sustain: 1866.835625826061, round1: 375.44762397680427, round2: 308.11870366383545, round3: 286.5462872081958, round4Plus: 277.28587436774234, sustainPerPc: 373.3671251652122 },
          brokenChain: { dpr: 375.76966722987913, sustain: 2002.7183439550606, round1: 465.7162718831983, round2: 362.67587663028434, round3: 344.67191313471614, round4Plus: 330.0146072713178, sustainPerPc: 400.5436687910121 } },
      6: { wotcStandard: { dpr: 377.0286504376805, sustain: 2287.6954052498154, round1: 452.4742208768265, round2: 375.5540380273044, round3: 350.1512378379158, round4Plus: 329.9351050086753, sustainPerPc: 381.2825675416359 },
          brokenChain: { dpr: 447.61493167909885, sustain: 2533.5753261719083, round1: 552.3946495237985, round2: 432.35605207797744, round3: 412.1398007777113, round4Plus: 393.5692243369082, sustainPerPc: 422.2625543619847 } },
    } },
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
