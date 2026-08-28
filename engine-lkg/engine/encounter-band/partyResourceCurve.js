export const EXPENDED_DPR_RATIO = 0.540602;
export const SHORT_REST_RECOVERY = 0.255401;
export const PUBLISHED_LEVELS = { min: 7, max: 9 };
export function dprDepletionScale(spent) {
    const s = Math.min(1, Math.max(0, spent));
    return 1 - s * (1 - EXPENDED_DPR_RATIO);
}
export function depleteRoundValue(baseValue, modeValue, spent) {
    const giftDelta = modeValue - baseValue;
    return baseValue * dprDepletionScale(spent) + giftDelta;
}
