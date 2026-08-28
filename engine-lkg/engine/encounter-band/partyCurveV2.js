export const GENERIC_CHECKER_LEVELS = { minimum: 1, maximum: 20 };
export const EMPIRICAL_LEVELS = { minimum: 1, maximum: 16 };
export const PROJECTED_LEVELS = { minimum: 17, maximum: 20 };
export function isProjectedLevel(level) {
    return level >= PROJECTED_LEVELS.minimum;
}
export function partySizeHpMultiplier(partySize) {
    if (!Number.isFinite(partySize) || partySize < 1) {
        throw new RangeError("partySize must be a positive number");
    }
    return Math.max(0.25, 1 + 0.25 * (partySize - 4));
}
export const PARTY_CURVE_V2 = [
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
        brokenChain: { dpr: 81.45600518299568, sustain: 340.42917562813113, round1: 89.51252588775566, round2: 80.56682007569327, round3: 73.85491986675814, round4Plus: 63.30125779853388, sustainPerPc: 85.10729390703278 } },
    { level: 7, stage: "Metamorphosis", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 4000,
        wotcStandard: { dpr: 77.74270083333334, sustain: 379.2125246027836, round1: 86.23929252506258, round2: 76.7872792983164, round3: 69.14524077624824, round4Plus: 57.742636026605894, sustainPerPc: 94.8031311506959 },
        brokenChain: { dpr: 86.79242177473941, sustain: 392.04956611620446, round1: 96.18817629068685, round2: 85.5372792983164, round3: 77.89524077624824, round4Plus: 66.4926360266059, sustainPerPc: 98.01239152905111 } },
    { level: 8, stage: "Metamorphosis", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 4000,
        wotcStandard: { dpr: 82.52255120503827, sustain: 428.3169882447475, round1: 92.08906786884765, round2: 81.30743124233993, round3: 73.11457436546232, round4Plus: 60.408146752349836, sustainPerPc: 107.07924706118688 },
        brokenChain: { dpr: 102.02477214644433, sustain: 442.33886989482835, round1: 112.49045163447192, round2: 100.50993124233993, round3: 92.31707436546232, round4Plus: 79.61064675234984, sustainPerPc: 110.58471747370709 } },
    { level: 9, stage: "Tempered", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
        wotcStandard: { dpr: 96.30559735996596, sustain: 487.2898080604998, round1: 107.34437314590798, round2: 94.88263720748711, round3: 85.7417114528425, round4Plus: 70.58286618888874, sustainPerPc: 121.82245201512495 },
        brokenChain: { dpr: 126.40977940293466, sustain: 502.66143087588296, round1: 138.79610131778279, round2: 124.53763720748711, round3: 115.3967114528425, round4Plus: 100.23786618888875, sustainPerPc: 125.66535771897074 } },
    { level: 10, stage: "Tempered", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
        wotcStandard: { dpr: 97.51591923556828, sustain: 527.5673482801618, round1: 110.03352477574211, round2: 96.0668040502366, round3: 86.92430013343927, round4Plus: 71.88255263296145, sustainPerPc: 131.89183707004045 },
        brokenChain: { dpr: 131.05509190353774, sustain: 545.0371228954873, round1: 155.22521544761997, round2: 125.7218040502366, round3: 116.57930013343928, round4Plus: 101.53755263296145, sustainPerPc: 136.25928072387183 } },
    { level: 11, stage: "Tempered", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
        wotcStandard: { dpr: 104.17851524147561, sustain: 574.6346335992656, round1: 116.76785233611196, round2: 102.46457639888953, round3: 92.67104957984753, round4Plus: 76.96508448070054, sustainPerPc: 143.6586583998164 },
        brokenChain: { dpr: 137.78013790944482, sustain: 595.0773539121899, round1: 162.2093430079889, round2: 132.11957639888954, round3: 122.32604957984753, round4Plus: 106.62008448070054, sustainPerPc: 148.76933847804747 } },
    { level: 12, stage: "Tempered", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
        wotcStandard: { dpr: 109.36000880794352, sustain: 610.9669046676631, round1: 123.58534006532538, round2: 108.03528161117787, round3: 97.15739145874404, round4Plus: 80.93819519640756, sustainPerPc: 152.74172616691578 },
        brokenChain: { dpr: 143.04255647591245, sustain: 631.7072569533617, round1: 169.35053073720115, round2: 137.69028161117785, round3: 126.81239145874405, round4Plus: 110.59319519640756, sustainPerPc: 157.92681423834043 } },
    { level: 13, stage: "Unbroken", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
        wotcStandard: { dpr: 118.56644205035114, sustain: 666.5908731199305, round1: 132.94248283242604, round2: 116.74238574533558, round3: 103.94950549730922, round4Plus: 87.01785249997886, sustainPerPc: 166.64771827998263 },
        brokenChain: { dpr: 152.24898971832008, sustain: 688.4457167891137, round1: 178.70767350430182, round2: 146.39738574533558, round3: 133.60450549730922, round4Plus: 116.67285249997886, sustainPerPc: 172.11142919727843 } },
    { level: 14, stage: "Unbroken", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
        wotcStandard: { dpr: 123.33384228244424, sustain: 712.4274254003969, round1: 138.89513131746006, round2: 120.49279624062964, round3: 108.23962770552737, round4Plus: 90.31818869257783, sustainPerPc: 178.10685635009924 },
        brokenChain: { dpr: 157.01638995041318, sustain: 734.8186704035396, round1: 184.66032198933584, round2: 150.14779624062965, round3: 137.89462770552737, round4Plus: 119.97318869257784, sustainPerPc: 183.7046676008849 } },
    { level: 15, stage: "Unbroken", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
        wotcStandard: { dpr: 130.48705784414855, sustain: 766.0700436521206, round1: 146.83974364194864, round2: 127.96901354020714, round3: 114.80064494401395, round4Plus: 96.85342458163849, sustainPerPc: 191.51751091303015 },
        brokenChain: { dpr: 164.1696055121175, sustain: 789.5595756910599, round1: 192.60493431382443, round2: 157.62401354020716, round3: 144.45564494401395, round4Plus: 126.5084245816385, sustainPerPc: 197.38989392276497 } },
    { level: 16, stage: "Unbroken", evidence: "EMPIRICAL_REBUILT_128_PARTY_FIELD", weightedSamples: 8000,
        wotcStandard: { dpr: 136.84140216095852, sustain: 812.7162039361829, round1: 153.77675253004506, round2: 135.56543921870556, round3: 120.53497335122567, round4Plus: 101.73850159585592, sustainPerPc: 203.17905098404572 },
        brokenChain: { dpr: 170.52394982892747, sustain: 837.6224167436811, round1: 199.54194320192084, round2: 165.22043921870556, round3: 150.18997335122566, round4Plus: 131.39350159585592, sustainPerPc: 209.40560418592028 } },
    { level: 17, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_LEVELS_13_TO_16", weightedSamples: 0,
        wotcStandard: { dpr: 143.5388375815125, sustain: 868.2246344094497, round1: 161.42333607562156, round2: 142.49155498376294, round3: 126.63194935056765, round4Plus: 107.17931959062429, sustainPerPc: 217.05615860236242 },
        brokenChain: { dpr: 177.1032594050134, sustain: 894.2774872380792, round1: 207.06389212824203, round2: 172.0180113607772, round3: 156.1639860257306, round4Plus: 136.70211803529529, sustainPerPc: 223.5693718095198 } },
    { level: 18, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_LEVELS_13_TO_16", weightedSamples: 0,
        wotcStandard: { dpr: 150.56406591052945, sustain: 927.5242847927941, round1: 169.45014770481595, round2: 149.7715299615182, round3: 133.03732643303954, round4Plus: 112.91110413186085, sustainPerPc: 231.88107119819853 },
        brokenChain: { dpr: 183.94255846997808, sustain: 954.7952784221274, round1: 214.89429209899686, round2: 179.09525221239332, round3: 162.37562326756722, round4Plus: 142.22521546625103, sustainPerPc: 238.69881960553184 } },
    { level: 19, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_LEVELS_13_TO_16", weightedSamples: 0,
        wotcStandard: { dpr: 157.93313033231672, sustain: 990.8740950037028, round1: 177.87609434445508, round2: 157.42344302137792, round3: 139.7667043366239, round4Plus: 118.94941566125748, sustainPerPc: 247.7185237509257 },
        brokenChain: { dpr: 191.0521208274092, sustain: 1019.4391490913587, round1: 223.04579170403142, round2: 186.4636680268843, round3: 168.83433692059262, round4Plus: 147.97145944146112, sustainPerPc: 254.85978727283967 } },
    { level: 20, stage: "PROJECTED_POST_16", evidence: "PROJECTED_FROM_LEVELS_13_TO_16", weightedSamples: 0,
        wotcStandard: { dpr: 165.66285923353377, sustain: 1058.5506905285451, round1: 186.7210230725473, round2: 165.46629669251868, round3: 146.83647187508294, round4Plus: 125.31064676890446, sustainPerPc: 264.6376726321363 },
        brokenChain: { dpr: 198.44262626284635, sustain: 1088.4904137416422, round1: 231.5315582113677, round2: 194.1352384529272, round3: 175.5499547887479, round4Plus: 153.949865623031, sustainPerPc: 272.12260343541055 } },
];
export function partyCurveRow(level) {
    return PARTY_CURVE_V2.find(r => r.level === level);
}
export const BASELINE_PARTY_SIZE = 4;
export const SUPPORTED_PARTY_SIZES = [3, 4, 5, 6];
export const PARTY_SIZE_HP_MULTIPLIER = Object.fromEntries(SUPPORTED_PARTY_SIZES.map(size => [size, partySizeHpMultiplier(size)]));
export function hpForPartySize(baseHp, partySize) {
    const mult = partySizeHpMultiplier(partySize);
    if (mult === 1)
        return baseHp;
    return Math.max(1, Math.round(baseHp * mult));
}
