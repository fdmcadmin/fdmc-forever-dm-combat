const step = (ladder, fallback, x) => {
    for (const [bound, value] of ladder)
        if (x <= bound)
            return value;
    return fallback;
};
const DEFENSIVE_CR = [
    [6, 0], [35, 0.125], [49, 0.25], [70, 0.5], [85, 1], [100, 2], [115, 3], [130, 4],
    [145, 5], [160, 6], [175, 7], [190, 8], [205, 9], [220, 10], [235, 11], [250, 12],
    [265, 13], [280, 14], [295, 15], [310, 16], [325, 17], [340, 18], [355, 19], [400, 20],
    [445, 21], [490, 22], [535, 23], [580, 24],
];
const OFFENSIVE_CR = [
    [1, 0], [3, 0.125], [5, 0.25], [8, 0.5], [14, 1], [20, 2], [26, 3], [32, 4],
    [38, 5], [44, 6], [50, 7], [56, 8], [62, 9], [68, 10], [74, 11], [80, 12],
    [86, 13], [92, 14], [98, 15], [104, 16], [110, 17], [116, 18], [122, 19], [140, 20],
    [158, 21], [176, 22], [194, 23], [212, 24],
];
const EXPECTED_AC = [[3, 13], [4, 14], [7, 15], [9, 16], [12, 17], [16, 18]];
const EXPECTED_SAVE_DC = [[3, 13], [4, 14], [7, 15], [10, 16], [12, 17], [16, 18], [20, 19], [23, 20]];
const EXPECTED_ATTACK = [[2, 3], [3, 4], [4, 5], [7, 6], [10, 7], [15, 8], [16, 9], [20, 10], [23, 11]];
const EHP_CEILING = 625;
const DPR_CEILING = 230;
function shiftPerTwo(baseCr, actual, expected) {
    const delta = actual - expected;
    const steps = Math.sign(delta) * Math.trunc(Math.abs(delta) / 2);
    return Math.max(0, Math.min(25, baseCr + steps));
}
function bandMidpoint(ladder, ceiling, cr) {
    const index = ladder.findIndex(([, value]) => value === cr);
    if (index === -1) {
        const lower = ladder[ladder.length - 1][0] + 1;
        return (lower + ceiling) / 2;
    }
    const lower = index === 0 ? 0 : ladder[index - 1][0] + 1;
    return (lower + ladder[index][0]) / 2;
}
const round1 = (n) => Math.round(n * 10) / 10;
export function estimateCreature(input) {
    const ehpMultiplier = input.ehpMultiplier ?? 1;
    const effectiveHp = Math.max(1, input.rawHp * ehpMultiplier + (input.ehpAdjustment ?? 0));
    const effectiveAc = input.ac + (input.acAdjustment ?? 0);
    const modeledDpr = (input.r1Dpr + 2 * input.r2PlusDpr) / 3;
    const baseDefensiveCr = step(DEFENSIVE_CR, 25, effectiveHp);
    const acAdjustedDefensiveCr = shiftPerTwo(baseDefensiveCr, effectiveAc, step(EXPECTED_AC, 19, baseDefensiveCr));
    const baseOffensiveCr = step(OFFENSIVE_CR, 25, modeledDpr);
    const bySaveDc = input.offenseBasis === "saveDc";
    const deliveryAdjustedOffensiveCr = shiftPerTwo(baseOffensiveCr, bySaveDc ? (input.saveDc ?? 0) : (input.attackBonus ?? 0), bySaveDc
        ? step(EXPECTED_SAVE_DC, 21, baseOffensiveCr)
        : step(EXPECTED_ATTACK, 12, baseOffensiveCr));
    const averageCr = (acAdjustedDefensiveCr + deliveryAdjustedOffensiveCr) / 2;
    const aboveTable = effectiveHp > EHP_CEILING || modeledDpr > DPR_CEILING || averageCr > 25;
    const capStatus = aboveTable ? "ABOVE CR 25 - MANUAL REVIEW" : "WITHIN CR 0-25 TABLE";
    const lowCr = Math.min(acAdjustedDefensiveCr, deliveryAdjustedOffensiveCr);
    const highCr = Math.max(acAdjustedDefensiveCr, deliveryAdjustedOffensiveCr);
    const desired = input.desiredCr;
    const hasDesired = typeof desired === "number" && Number.isFinite(desired);
    const targetEhpAdjustment = hasDesired
        ? bandMidpoint(DEFENSIVE_CR, EHP_CEILING, desired) - effectiveHp : null;
    const targetDprAdjustment = hasDesired
        ? bandMidpoint(OFFENSIVE_CR, DPR_CEILING, desired) - modeledDpr : null;
    const guidance = !hasDesired
        ? "Set a desired CR to receive baseline editor guidance."
        : `To approach the CR ${desired} baseline: `
            + `${targetEhpAdjustment >= 0 ? "add " : "remove "}`
            + `${Math.abs(Math.round(targetEhpAdjustment))} source-traced effective HP and `
            + `${targetDprAdjustment >= 0 ? "add " : "remove "}`
            + `${Math.abs(round1(targetDprAdjustment)).toFixed(1)} expected three-round DPR. `
            + "AC and attack/save differences can shift the final rating; preserve authored actions, "
            + "Recharge, slots, and timing, then rerun the parser and encounter trace.";
    return {
        ehpMultiplier,
        effectiveHp,
        effectiveAc,
        modeledDpr,
        baseDefensiveCr,
        acAdjustedDefensiveCr,
        baseOffensiveCr,
        deliveryAdjustedOffensiveCr,
        estimatedCr: aboveTable ? "25+" : Math.round(averageCr),
        crRange: aboveTable ? `CR ${lowCr}-CR 25+` : `CR ${lowCr}-CR ${highCr}`,
        targetEhpAdjustment,
        targetDprAdjustment,
        capStatus,
        guidance,
        requiredRuntimeTrace: "PER-TARGET ACTION / CONTROL / SEQUENCING",
    };
}
