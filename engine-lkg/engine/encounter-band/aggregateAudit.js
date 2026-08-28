import { PARTY_CURVE_V2 } from "./partyCurveV2";
const ROUND_ROWS = 20;
function matchLessOrEqual(x, range) {
    let i = 0;
    while (i < range.length && range[i] <= x)
        i++;
    return i;
}
export function aggregateAudit(opts) {
    const { level, partySize, mode, groups, completionRoundMonsterFraction: B7 = 0.5, targetSafetyMargin: B8 = 1, } = opts;
    const row = PARTY_CURVE_V2.find(r => r.level === level);
    if (!row)
        throw new RangeError(`no party curve row for level ${level}`);
    const curve = mode === "brokenChain" ? row.brokenChain : row.wotcStandard;
    const E5 = curve.round1, E6 = curve.round2, E7 = curve.round3, E8 = curve.round4Plus;
    const B6 = partySize;
    const L5 = groups.reduce((s, g) => s + g.groupEhp, 0);
    const L6 = groups.reduce((s, g) => s + g.quantity * g.round1DprPerBody, 0);
    const L7 = groups.reduce((s, g) => s + g.quantity * g.round2PlusDprPerBody, 0);
    const L8 = curve.sustain;
    const B = [E5, E6, E7, ...Array(ROUND_ROWS - 3).fill(E8)];
    const C = [], D = [], E = [];
    for (let i = 0; i < ROUND_ROWS; i++) {
        C[i] = i === 0 ? B[0] : C[i - 1] + B[i];
        if (i === 0)
            D[i] = C[0] >= L5 ? B7 * L6 : L6;
        else
            D[i] = C[i - 1] >= L5 ? 0 : (C[i] >= L5 ? B7 * L7 : L7);
        E[i] = i === 0 ? D[0] : E[i - 1] + D[i];
    }
    const completionRound = L5 <= 0 ? "ENTER CREATURE"
        : L5 <= C[0] ? 1
            : L5 > C[ROUND_ROWS - 1] ? ">20"
                : matchLessOrEqual(L5 - 0.000001, C) + 1;
    const fatalRound = L5 <= 0 ? "-"
        : L8 <= E[0] ? 1
            : L8 > E[ROUND_ROWS - 1] ? "NOT FATAL"
                : matchLessOrEqual(L8 - 0.000001, E) + 1;
    const damageAtCompletion = typeof completionRound === "number"
        ? (E[completionRound - 1] ?? E[ROUND_ROWS - 1])
        : 0;
    const projectedDowns = L5 <= 0 ? "-" : Math.min(B6, Math.trunc(damageAtCompletion / (L8 / B6)));
    const residualDamageFlag = L5 <= 0 ? "-" : (damageAtCompletion > 0 && projectedDowns < B6 ? "YES" : "NO");
    const standingAtCompletion = L5 <= 0 ? B6 : B6 - projectedDowns;
    const ehpAdjustmentToTarget = L7 <= 0 ? "ENTER R2+ DPR" : ((L8 / L7) - B8) * ((E5 + E6 + E7 + E8) / 4) - L5;
    return {
        encounterEhp: L5,
        monsterDprRound1: L6,
        monsterDprRound2Plus: L7,
        partySustain: L8,
        completionRound,
        fatalRound,
        projectedDowns,
        residualDamageFlag,
        standingAtCompletion,
        ehpAdjustmentToTarget,
        rounds: B.map((partyDpr, i) => ({
            round: i + 1,
            partyDpr,
            cumulativePartyDamage: C[i],
            monsterDpr: D[i],
            cumulativeMonsterDamage: E[i],
        })),
    };
}
export function auditDivergence(aggregate, bodyTrace) {
    const aggDowns = typeof aggregate.projectedDowns === "number" ? aggregate.projectedDowns : null;
    const aggRound = typeof aggregate.completionRound === "number" ? aggregate.completionRound : null;
    if (bodyTrace.completionRound === null) {
        const wipes = typeof aggregate.fatalRound === "number";
        return {
            agrees: wipes,
            note: wipes
                ? `Both models wipe the party — the body trace never finishes the roster, and the aggregate `
                    + `audit puts the fatal round at ${aggregate.fatalRound}.`
                : `The body trace wipes the party before the roster is cleared, but the workbook's aggregate `
                    + `audit reports "${aggregate.fatalRound}". The two models disagree on survival, not just `
                    + `on margin — check the roster's DPR before running this fight.`,
        };
    }
    const roundGap = aggRound !== null ? Math.abs(aggRound - bodyTrace.completionRound) : 0;
    const downGap = aggDowns !== null && bodyTrace.downsAtCompletion !== null
        ? aggDowns - bodyTrace.downsAtCompletion : 0;
    if (roundGap < 1 && downGap === 0)
        return { agrees: true, note: "Aggregate audit and body trace agree." };
    if (roundGap >= 1) {
        return {
            agrees: false,
            note: `The fight ends on round ${bodyTrace.completionRound} by body trace and round ${aggRound} `
                + `by the workbook's aggregate audit. Treat the aggregate as the sanity check and look for `
                + `why the traced roster is dying faster or slower than its flat DPR implies.`,
        };
    }
    return {
        agrees: false,
        note: `Body trace projects ${bodyTrace.downsAtCompletion} down, the workbook's aggregate audit `
            + `${aggDowns}. The trace removes each body's output the round it dies, so it always reads `
            + `softer with more than one body; the aggregate is the pessimistic sanity check.`,
    };
}
