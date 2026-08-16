/**
 * PARTY CURVE v2 — transcribed from `party_curve_v2.json`, schema `fdmc.party-curve.v2` 2.0.0,
 * extracted from the Embedded App Payload of
 * `broken_chain_encounter_checker_app_ready_v2.xlsx` and SHA-256 verified against that sheet's
 * own manifest before transcription.
 *
 * ⚠ THIS SUPERSEDES `dprBaseline.PARTY_BASELINE`. Christopher, 2026-08-14: *"the app is wrong
 * if it contradicts the workbook. you invented designs and guessed at the outcome, this
 * workbook has used over 300+ real creatures and spells/traits/actions to give a true design."*
 * Where the two disagree, this wins. The old baseline stopped at L12, had one equipment mode,
 * and carried per-PC thresholds that were authored rather than derived.
 *
 * TWO EQUIPMENT MODES, and the switch is a REQUIRED app feature — a table running the checker
 * without the Broken Chain campaign must be able to turn it off:
 *  · `wotcStandard` — no automatic combat bonus from unspecified magic items. The GENERIC
 *    mode: the generalized four-player progression, with no campaign loot assumed.
 *  · `brokenChain` — the campaign gear overlay is included, because the campaign's projected
 *    loot distribution is tied into the curve. Selected Convergence stays a SEPARATE encounter
 *    input: burst is added to round 1 only, sustain credit to sustain.
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

/** The generic checker supports 3–20; levels 1–2 exist for the campaign only. */
export const GENERIC_CHECKER_LEVELS = { minimum: 3, maximum: 20 } as const;
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
  { level: 1, stage: "Pre-Bond", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 3000,
    wotcStandard: { dpr: 22.816201838893253, sustain: 67.35593392709542, round1: 25.569531373434977, round2: 23.2230278241347, round3: 20.308334474411048, round4Plus: 19.590873903016544, sustainPerPc: 16.838983481773855 },
    brokenChain: { dpr: 22.816201838893253, sustain: 67.35593392709542, round1: 25.569531373434977, round2: 23.2230278241347, round3: 20.308334474411048, round4Plus: 19.590873903016544, sustainPerPc: 16.838983481773855 } },
  { level: 2, stage: "Pre-Bond", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 3000,
    wotcStandard: { dpr: 29.77612015714413, sustain: 106.5818445034777, round1: 34.42052300270093, round2: 31.128739423840127, round3: 27.062792165427766, round4Plus: 24.36417000184036, sustainPerPc: 26.645461125869424 },
    brokenChain: { dpr: 31.96362015714413, sustain: 107.31336624203985, round1: 36.60802300270093, round2: 33.31623942384013, round3: 29.250292165427766, round4Plus: 26.55167000184036, sustainPerPc: 26.828341560509962 } },
  { level: 3, stage: "Realized", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 3000,
    wotcStandard: { dpr: 42.96208393516801, sustain: 176.97282555188772, round1: 48.48739482560448, round2: 42.22680882377182, round3: 37.15720142562871, round4Plus: 30.85384064439453, sustainPerPc: 44.24320638797193 },
    brokenChain: { dpr: 47.33708393516801, sustain: 179.2667827166363, round1: 52.86239482560448, round2: 46.60180882377182, round3: 41.53220142562871, round4Plus: 35.22884064439453, sustainPerPc: 44.816695679159075 } },
  { level: 4, stage: "Realized", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 4000,
    wotcStandard: { dpr: 47.718494528918015, sustain: 222.05215787197514, round1: 53.44523583306023, round2: 47.050446087964694, round3: 41.30368034211944, round4Plus: 33.882755544543016, sustainPerPc: 55.513039467993785 },
    brokenChain: { dpr: 52.093494528918015, sustain: 224.6064122945274, round1: 57.82023583306023, round2: 51.425446087964694, round3: 45.67868034211944, round4Plus: 38.257755544543016, sustainPerPc: 56.15160307363185 } },
  { level: 5, stage: "Realized", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 4000,
    wotcStandard: { dpr: 66.25599632579302, sustain: 277.80336801565636, round1: 75.51101016638492, round2: 65.20989034912361, round3: 58.71310680700148, round4Plus: 48.46607757579302, sustainPerPc: 69.45084200391409 },
    brokenChain: { dpr: 70.63099632579302, sustain: 281.1580399060901, round1: 79.88601016638492, round2: 69.58489034912361, round3: 63.08810680700148, round4Plus: 52.84107757579302, sustainPerPc: 70.28950997652252 } },
  { level: 6, stage: "Metamorphosis", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 4000,
    wotcStandard: { dpr: 72.70600518299568, sustain: 328.3925480460517, round1: 80.76252588775566, round2: 71.81682007569327, round3: 65.10491986675814, round4Plus: 54.55125779853388, sustainPerPc: 82.09813701151292 },
    brokenChain: { dpr: 81.45600518299568, sustain: 335.92917562813113, round1: 89.51252588775566, round2: 80.56682007569327, round3: 73.85491986675814, round4Plus: 63.30125779853388, sustainPerPc: 83.98229390703278 } },
  { level: 7, stage: "Metamorphosis", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 4000,
    wotcStandard: { dpr: 77.74270083333334, sustain: 379.2125246027836, round1: 86.23929252506258, round2: 76.7872792983164, round3: 69.14524077624824, round4Plus: 57.742636026605894, sustainPerPc: 94.8031311506959 },
    brokenChain: { dpr: 86.49270083333334, sustain: 387.54956611620446, round1: 94.98929252506258, round2: 85.5372792983164, round3: 77.89524077624824, round4Plus: 66.4926360266059, sustainPerPc: 96.88739152905111 } },
  { level: 8, stage: "Metamorphosis", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 4000,
    wotcStandard: { dpr: 82.52255120503827, sustain: 428.3169882447475, round1: 92.08906786884765, round2: 81.30743124233993, round3: 73.11457436546232, round4Plus: 60.408146752349836, sustainPerPc: 107.07924706118688 },
    brokenChain: { dpr: 101.72505120503827, sustain: 437.83886989482835, round1: 111.29156786884765, round2: 100.50993124233993, round3: 92.31707436546232, round4Plus: 79.61064675234984, sustainPerPc: 109.45971747370709 } },
  { level: 9, stage: "Tempered", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
    wotcStandard: { dpr: 96.30559735996596, sustain: 487.2898080604998, round1: 107.34437314590798, round2: 94.88263720748711, round3: 85.7417114528425, round4Plus: 70.58286618888874, sustainPerPc: 121.82245201512495 },
    brokenChain: { dpr: 125.96059735996596, sustain: 498.16143087588296, round1: 136.99937314590798, round2: 124.53763720748711, round3: 115.3967114528425, round4Plus: 100.23786618888875, sustainPerPc: 124.54035771897074 } },
  { level: 10, stage: "Tempered", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
    wotcStandard: { dpr: 97.51591923556828, sustain: 527.5673482801618, round1: 110.03352477574211, round2: 96.0668040502366, round3: 86.92430013343927, round4Plus: 71.88255263296145, sustainPerPc: 131.89183707004045 },
    brokenChain: { dpr: 127.17091923556828, sustain: 539.1731228954873, round1: 139.6885247757421, round2: 125.7218040502366, round3: 116.57930013343928, round4Plus: 101.53755263296145, sustainPerPc: 134.79328072387182 } },
  { level: 11, stage: "Tempered", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
    wotcStandard: { dpr: 104.17851524147561, sustain: 574.6346335992656, round1: 116.76785233611196, round2: 102.46457639888953, round3: 92.67104957984753, round4Plus: 76.96508448070054, sustainPerPc: 143.6586583998164 },
    brokenChain: { dpr: 133.8335152414756, sustain: 588.8707039121899, round1: 146.42285233611196, round2: 132.11957639888954, round3: 122.32604957984753, round4Plus: 106.62008448070054, sustainPerPc: 147.21767597804748 } },
  { level: 12, stage: "Tempered", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
    wotcStandard: { dpr: 109.36000880794352, sustain: 610.9669046676631, round1: 123.58534006532538, round2: 108.03528161117787, round3: 97.15739145874404, round4Plus: 80.93819519640756, sustainPerPc: 152.74172616691578 },
    brokenChain: { dpr: 139.0150088079435, sustain: 625.0527694533617, round1: 153.24034006532537, round2: 137.69028161117785, round3: 126.81239145874405, round4Plus: 110.59319519640756, sustainPerPc: 156.26319236334044 } },
  { level: 13, stage: "Unbroken", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
    wotcStandard: { dpr: 118.56644205035114, sustain: 666.5908731199305, round1: 132.94248283242604, round2: 116.74238574533558, round3: 103.94950549730922, round4Plus: 87.01785249997886, sustainPerPc: 166.64771827998263 },
    brokenChain: { dpr: 148.22144205035113, sustain: 681.7912292891137, round1: 162.59748283242604, round2: 146.39738574533558, round3: 133.60450549730922, round4Plus: 116.67285249997886, sustainPerPc: 170.44780732227844 } },
  { level: 14, stage: "Unbroken", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
    wotcStandard: { dpr: 123.33384228244424, sustain: 712.4274254003969, round1: 138.89513131746006, round2: 120.49279624062964, round3: 108.23962770552737, round4Plus: 90.31818869257783, sustainPerPc: 178.10685635009924 },
    brokenChain: { dpr: 152.98884228244424, sustain: 728.1641829035397, round1: 168.55013131746006, round2: 150.14779624062965, round3: 137.89462770552737, round4Plus: 119.97318869257784, sustainPerPc: 182.0410457258849 } },
  { level: 15, stage: "Unbroken", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
    wotcStandard: { dpr: 130.48705784414855, sustain: 766.0700436521206, round1: 146.83974364194864, round2: 127.96901354020714, round3: 114.80064494401395, round4Plus: 96.85342458163849, sustainPerPc: 191.51751091303015 },
    brokenChain: { dpr: 160.14205784414855, sustain: 782.9050881910599, round1: 176.49474364194865, round2: 157.62401354020716, round3: 144.45564494401395, round4Plus: 126.5084245816385, sustainPerPc: 195.72627204776498 } },
  { level: 16, stage: "Unbroken", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
    wotcStandard: { dpr: 136.84140216095852, sustain: 812.7162039361829, round1: 153.77675253004506, round2: 135.56543921870556, round3: 120.53497335122567, round4Plus: 101.73850159585592, sustainPerPc: 203.17905098404572 },
    brokenChain: { dpr: 166.49640216095852, sustain: 830.9679292436812, round1: 183.43175253004506, round2: 165.22043921870556, round3: 150.18997335122566, round4Plus: 131.39350159585592, sustainPerPc: 207.7419823109203 } },
  { level: 17, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_LEVELS_13_TO_16", weightedSamples: 0,
    wotcStandard: { dpr: 143.5388375815125, sustain: 868.2246344094497, round1: 161.42333607562156, round2: 142.49155498376294, round3: 126.63194935056765, round4Plus: 107.17931959062429, sustainPerPc: 217.05615860236242 },
    brokenChain: { dpr: 173.07571173704446, sustain: 887.6229997380792, round1: 190.95370145636625, round2: 172.0180113607772, round3: 156.1639860257306, round4Plus: 136.70211803529529, sustainPerPc: 221.9057499345198 } },
  { level: 18, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_LEVELS_13_TO_16", weightedSamples: 0,
    wotcStandard: { dpr: 150.56406591052945, sustain: 927.5242847927941, round1: 169.45014770481595, round2: 149.7715299615182, round3: 133.03732643303954, round4Plus: 112.91110413186085, sustainPerPc: 231.88107119819853 },
    brokenChain: { dpr: 179.91501080200914, sustain: 948.1407909221274, round1: 198.78410142712107, round2: 179.09525221239332, round3: 162.37562326756722, round4Plus: 142.22521546625103, sustainPerPc: 237.03519773053185 } },
  { level: 19, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_LEVELS_13_TO_16", weightedSamples: 0,
    wotcStandard: { dpr: 157.93313033231672, sustain: 990.8740950037028, round1: 177.87609434445508, round2: 157.42344302137792, round3: 139.7667043366239, round4Plus: 118.94941566125748, sustainPerPc: 247.7185237509257 },
    brokenChain: { dpr: 187.02457315944025, sustain: 1012.7846615913587, round1: 206.93560103215563, round2: 186.4636680268843, round3: 168.83433692059262, round4Plus: 147.97145944146112, sustainPerPc: 253.19616539783968 } },
  { level: 20, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_LEVELS_13_TO_16", weightedSamples: 0,
    wotcStandard: { dpr: 165.66285923353377, sustain: 1058.5506905285451, round1: 186.7210230725473, round2: 165.46629669251868, round3: 146.83647187508294, round4Plus: 125.31064676890446, sustainPerPc: 264.6376726321363 },
    brokenChain: { dpr: 194.4150785948774, sustain: 1081.8359262416423, round1: 215.4213675394919, round2: 194.1352384529272, round3: 175.5499547887479, round4Plus: 153.949865623031, sustainPerPc: 270.45898156041056 } },
];

export function partyCurveRow(level: number): PartyCurveRow | undefined {
  return PARTY_CURVE_V2.find(r => r.level === level);
}
