import { partySizeHpMultiplier, partyCurveRow, } from "./partyCurveV2";
import { depleteRoundValue } from "./partyResourceCurve";
export { partySizeHpMultiplier };
const EPSILON = 1e-9;
export function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
export function combineSustainContributions(factors = []) {
    const seen = new Set();
    let multiplier = 1;
    for (const factor of factors) {
        const stackGroup = String(factor.stackGroup ?? factor.label ?? "").trim();
        if (!stackGroup)
            throw new TypeError("every sustain factor needs a stackGroup");
        if (seen.has(stackGroup))
            throw new Error(`duplicate sustain stackGroup: ${stackGroup}`);
        seen.add(stackGroup);
        const contribution = Number(factor.contribution);
        if (!Number.isFinite(contribution) || contribution <= -1) {
            throw new RangeError(`invalid sustain contribution for ${stackGroup}`);
        }
        multiplier *= 1 + contribution;
    }
    return multiplier - 1;
}
export function attackHitProbability(attackBonus, targetAc) {
    return clamp((21 + attackBonus - targetAc) / 20, 0.05, 0.95);
}
export function expectedAttackDamage(rawAverage, attackBonus, targetAc, targetCount = 1) {
    return rawAverage * attackHitProbability(attackBonus, targetAc) * targetCount;
}
export function saveFailureProbability(saveDc, targetSaveBonus) {
    return clamp((saveDc - targetSaveBonus - 1) / 20, 0, 1);
}
export function expectedSaveDamage(opts) {
    const { failureAverage, successAverage = 0, saveDc, targetSaveBonus, targetCount = 1 } = opts;
    const failureProbability = saveFailureProbability(saveDc, targetSaveBonus);
    return (failureProbability * failureAverage
        + (1 - failureProbability) * successAverage) * targetCount;
}
export function rechargeProbability(minimum, maximum = 6) {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum)
        || minimum < 1 || maximum > 6 || minimum > maximum) {
        throw new RangeError("recharge range must be within 1..6");
    }
    return (maximum - minimum + 1) / 6;
}
export function roundValue(profile, round) {
    if (round <= 1)
        return Number(profile.round1 ?? 0);
    if (round === 2)
        return Number(profile.round2 ?? 0);
    if (round === 3)
        return Number(profile.round3 ?? 0);
    return Number(profile.round4Plus ?? 0);
}
export function resolvePartyProfile(opts) {
    const { level, size, equipmentMode = "wotcStandard", convergence = [], customDpr = null, customSustain = null, arrivingSpent = 0, partyCurve = null } = opts;
    const row = (partyCurve
        ? partyCurve.curve.find(candidate => Number(candidate.level) === Number(level))
        : partyCurveRow(level));
    if (!row)
        throw new RangeError(`party curve does not contain level ${level}`);
    if (!Number.isInteger(size) || size < 1)
        throw new RangeError("size must be a positive integer");
    const modeKey = equipmentMode === "brokenChain" ? "brokenChain" : "wotcStandard";
    const source = row[modeKey];
    const scale = size / 4;
    const campaignEnabled = modeKey === "brokenChain";
    const convergenceBurst = campaignEnabled
        ? convergence.reduce((sum, item) => sum + Number(item.round1Burst ?? 0), 0) : 0;
    const convergenceSustain = campaignEnabled
        ? convergence.reduce((sum, item) => sum + Number(item.sustainCredit ?? 0), 0) : 0;
    const base = row.wotcStandard;
    const spent = Math.min(1, Math.max(0, Number(arrivingSpent) || 0));
    const deplete = (key) => depleteRoundValue(base[key] * scale, source[key] * scale, spent);
    const dpr = customDpr ?? {
        round1: deplete("round1") + convergenceBurst,
        round2: deplete("round2"),
        round3: deplete("round3"),
        round4Plus: deplete("round4Plus"),
    };
    const sustain = customSustain
        ?? (source.sustain * scale + convergenceSustain) * (1 - spent);
    const evidence = String(row.evidence ?? "");
    return {
        size, level, equipmentMode: modeKey,
        evidence,
        projection: evidence.startsWith("PROJECTED"),
        dpr, sustain,
        convergenceApplied: campaignEnabled ? convergence : [],
    };
}
export function stateTriggerEligible(trigger, state = {}) {
    const type = String(trigger?.type ?? trigger?.kind ?? "");
    const currentHp = Number(state.currentHp ?? state.current_hp ?? 0);
    const previousHp = Number(state.previousHp ?? state.previous_hp ?? currentHp);
    const maxHp = Number(state.maxHp ?? state.max_hp ?? 0);
    const alreadyTriggered = Boolean(state.alreadyTriggered ?? state.already_triggered);
    const usesRemaining = Number(state.usesRemaining ?? state.uses_remaining ?? 1);
    if (alreadyTriggered || usesRemaining <= 0)
        return false;
    if (state.activatorAlive === false || state.activator_alive === false)
        return false;
    if (state.activatorFullForm === false || state.activator_full_form === false)
        return false;
    if (state.corpseAvailable === false || state.corpse_available === false)
        return false;
    if (state.withinRange === false || state.within_range === false)
        return false;
    if (type === "first_damage_to_hp_fraction_or_below" || type === "hp_at_or_below") {
        const fraction = Number(trigger.hpFraction ?? trigger.hp_fraction ?? trigger.fraction ?? 0);
        if (!(maxHp > 0) || !(fraction >= 0 && fraction <= 1))
            return false;
        const threshold = maxHp * fraction;
        return previousHp > threshold + EPSILON && currentHp <= threshold + EPSILON;
    }
    if (type === "body_at_zero_hp" || type === "hp_zero") {
        return currentHp <= Number(trigger.hp ?? 0) + EPSILON;
    }
    if (type === "body_at_zero_hp_for_full_turn" || type === "start_turn_after_zero_duration") {
        const hp = Number(trigger.hp ?? 0);
        const required = Number(trigger.fullTurnsAtZero ?? trigger.full_turns_at_zero ?? 1);
        const elapsed = Number(state.fullTurnsAtZero ?? state.full_turns_at_zero ?? 0);
        return currentHp <= hp + EPSILON && elapsed >= required;
    }
    throw new RangeError(`unsupported state trigger type: ${type}`);
}
export function resolveStateTrigger(event, state = {}, partySize = 4) {
    const e = event;
    const trigger = (e.trigger ?? e);
    if (!stateTriggerEligible(trigger, state)) {
        return { triggered: false, state: { ...state }, spawnedChildren: [] };
    }
    const maxHp = Number(state.maxHp ?? state.max_hp ?? 0);
    const restoreFraction = e.restoreToHpFraction ?? e.restore_to_hp_fraction;
    const nextState = {
        ...state,
        alreadyTriggered: true,
        usesRemaining: Math.max(0, Number(state.usesRemaining ?? state.uses_remaining ?? 1) - 1),
    };
    if (restoreFraction !== undefined && restoreFraction !== null) {
        nextState.currentHp = maxHp * Number(restoreFraction);
    }
    const spawn = e.spawn;
    const spawnedChildren = [];
    if (spawn) {
        const fixedBaseHp = Number(spawn.baseHp ?? spawn.base_hp ?? 0);
        const fourPcBaseHp = Number(spawn.fourPcBaseHp ?? spawn.four_pc_base_hp ?? 0);
        let baseHp = fourPcBaseHp > 0 ? fourPcBaseHp * partySizeHpMultiplier(partySize) : fixedBaseHp;
        if (spawn.roundHp === "nearest_integer" || spawn.round_hp === "nearest_integer") {
            baseHp = Math.round(baseHp);
        }
        spawnedChildren.push({
            catalogName: spawn.catalogName ?? spawn.catalog_name ?? null,
            quantity: Number(spawn.quantity ?? 1),
            baseHp,
            armorClass: Number(spawn.armorClass ?? spawn.armor_class ?? 0) || null,
            initiative: spawn.initiative ?? null,
        });
    }
    return {
        triggered: true,
        state: nextState,
        stateChanges: [...(e.stateChanges ?? e.state_changes ?? [])],
        spawnedChildren,
        consumesAction: String(e.cost?.activationType ?? e.cost?.activation_type ?? "").toLowerCase() === "action",
    };
}
export function effectiveHpPerBody(group, partySize) {
    const rawHp = Number(group.baseHp ?? 0);
    const explicitPools = Number(group.explicitSameEncounterPools ?? 0);
    const acMultiplier = Number(group.acMultiplier ?? 1);
    const damagePassFraction = Number(group.damagePassFraction ?? 1);
    const damageUptime = Number(group.damageUptime ?? 1);
    const traitAdjustment = group.traitFactors
        ? combineSustainContributions(group.traitFactors)
        : Number(group.ehpAdjustment ?? 0);
    if (rawHp < 0 || explicitPools < 0 || acMultiplier <= 0
        || damagePassFraction <= 0 || damageUptime <= 0) {
        throw new RangeError(`invalid sustain inputs for ${group.name ?? group.id ?? "creature"}`);
    }
    return (rawHp + explicitPools)
        * acMultiplier
        * (1 + traitAdjustment)
        / damagePassFraction
        / damageUptime
        * (group.flatHpPerBody ? 1 : partySizeHpMultiplier(partySize));
}
export function prepareRoster(roster, partySize) {
    let cumulativeEnd = 0;
    return roster
        .filter(group => Number(group.quantity ?? 0) > 0)
        .map((group, index) => {
        const quantity = Number(group.quantity);
        const bodyEhp = effectiveHpPerBody(group, partySize);
        const groupEhp = quantity * bodyEhp;
        cumulativeEnd += groupEhp;
        return { ...group, order: index + 1, quantity, bodyEhp, groupEhp, cumulativeEnd,
            dprUptime: Number(group.dprUptime ?? 1) };
    });
}
export function remainingGroupFraction(group, cumulativePartyDamage) {
    if (group.groupEhp <= 0)
        return 0;
    return clamp((group.cumulativeEnd - cumulativePartyDamage) / group.groupEhp, 0, 1);
}
export function livingBodies(group, cumulativePartyDamage) {
    if (group.bodiless)
        return Math.max(0, Number(group.quantity ?? 0));
    if (group.bodyEhp <= 0)
        return 0;
    const cumulativeStart = group.cumulativeEnd - group.groupEhp;
    const intoThisGroup = clamp(cumulativePartyDamage - cumulativeStart, 0, group.groupEhp);
    const killed = Math.floor((intoThisGroup + EPSILON) / group.bodyEhp);
    return Math.max(0, group.quantity - killed);
}
export function groupPresentIn(group, round) {
    const arrives = Number(group.arrivesRound ?? 1);
    if (round < arrives)
        return false;
    const expires = group.expiresAfterRound;
    return typeof expires !== "number" || round <= expires;
}
export function encounterEhpAt(roster, round) {
    return roster.reduce((sum, group) => {
        if (group.replacesParent)
            return sum;
        return round >= Number(group.arrivesRound ?? 1) ? sum + group.groupEhp : sum;
    }, 0);
}
export function encounterDprAt(roster, cumulativePartyDamage, round) {
    return roster.reduce((total, group) => {
        if (!groupPresentIn(group, round))
            return total;
        if (group.endsWithGroupId) {
            const parent = roster.find(g => g.id === group.endsWithGroupId);
            if (parent && livingBodies(parent, cumulativePartyDamage) <= 0)
                return total;
        }
        const alive = livingBodies(group, cumulativePartyDamage);
        const bodyDpr = roundValue(group.dpr, round);
        return total + alive * bodyDpr * group.dprUptime;
    }, 0);
}
export function specialOutcomeRisks(roster) {
    const risks = [];
    for (const group of roster) {
        for (const event of group.outcomeEvents ?? []) {
            const targetCount = Math.max(0, Number(event.targetCount ?? 1));
            const conditionProbability = clamp(Number(event.conditionProbability ?? 1), 0, 1);
            let probabilityPerTarget;
            if (event.failureProbability !== undefined) {
                probabilityPerTarget = clamp(Number(event.failureProbability), 0, 1) * conditionProbability;
            }
            else if (event.saveDc !== undefined && event.targetSaveBonus !== undefined) {
                probabilityPerTarget = saveFailureProbability(Number(event.saveDc), Number(event.targetSaveBonus))
                    * conditionProbability;
            }
            else {
                probabilityPerTarget = conditionProbability;
            }
            const effectiveTrials = targetCount * Math.max(1, Number(group.quantity ?? 1));
            risks.push({
                groupId: group.id ?? null,
                creature: group.name ?? group.id ?? "Creature",
                name: event.name ?? event.kind ?? "Special outcome",
                kind: event.kind ?? "state_change",
                earliestRound: Math.max(1, Number(event.earliestRound ?? 1)),
                expectedAffectedTargets: effectiveTrials * probabilityPerTarget,
                probabilityAtLeastOne: effectiveTrials > 0
                    ? 1 - (1 - probabilityPerTarget) ** effectiveTrials : 0,
                deterministicDamageCredit: 0,
            });
        }
    }
    return risks;
}
export function partyDamageCapacityAt(profile, roundEquivalent) {
    const value = Math.max(0, Number(roundEquivalent));
    const r1 = roundValue(profile, 1), r2 = roundValue(profile, 2);
    const r3 = roundValue(profile, 3), r4 = roundValue(profile, 4);
    if (value <= 1)
        return value * r1;
    if (value <= 2)
        return r1 + (value - 1) * r2;
    if (value <= 3)
        return r1 + r2 + (value - 2) * r3;
    return r1 + r2 + r3 + (value - 3) * r4;
}
export function partyRoundEquivalent(profile, encounterEhp) {
    const target = Math.max(0, Number(encounterEhp));
    const r1 = roundValue(profile, 1), r2 = roundValue(profile, 2);
    const r3 = roundValue(profile, 3), r4 = roundValue(profile, 4);
    if (target <= r1)
        return r1 > 0 ? target / r1 : null;
    if (target <= r1 + r2)
        return r2 > 0 ? 1 + (target - r1) / r2 : null;
    if (target <= r1 + r2 + r3)
        return r3 > 0 ? 2 + (target - r1 - r2) / r3 : null;
    return r4 > 0 ? 3 + (target - r1 - r2 - r3) / r4 : null;
}
export function simulateEncounter(opts) {
    const { party, roster, settings = {} } = opts;
    const partySize = Number(party.size);
    const partySustain = Number(party.sustain);
    if (!Number.isInteger(partySize) || partySize < 1 || partySustain <= 0) {
        throw new RangeError("party.size must be a positive integer and party.sustain must be positive");
    }
    const prepared = prepareRoster(roster, partySize);
    const encounterEhp = prepared.reduce((sum, group) => (group.replacesParent ? sum : sum + group.groupEhp), 0);
    const maxRounds = Number(settings.maxRounds ?? 20);
    const damageAllocation = settings.damageAllocation === "spread_evenly" ? "spread_evenly" : "focus_fire";
    const sustainPerPc = partySustain / partySize;
    const rounds = [];
    let cumulativePartyDamage = 0;
    let cumulativeMonsterDamage = 0;
    let standing = partySize;
    let completionRound = null;
    let fatalRound = null;
    for (let round = 1; round <= maxRounds; round += 1) {
        const pcsStart = standing;
        const partyPotential = roundValue(party.dpr, round);
        const partyDamage = completionRound || pcsStart === 0 ? 0 : partyPotential;
        const partyDamageBefore = cumulativePartyDamage;
        cumulativePartyDamage += partyDamage;
        const ehpOnField = encounterEhpAt(prepared, round);
        const completesNow = completionRound === null && ehpOnField > 0
            && cumulativePartyDamage + EPSILON >= ehpOnField;
        const monsterDprStart = encounterDprAt(prepared, partyDamageBefore, round);
        const monsterDprEnd = encounterDprAt(prepared, cumulativePartyDamage, round);
        const monsterDamage = completionRound || pcsStart === 0
            ? 0
            : (monsterDprStart + monsterDprEnd) / 2;
        cumulativeMonsterDamage += monsterDamage;
        const downs = damageAllocation === "spread_evenly"
            ? (cumulativeMonsterDamage + EPSILON >= partySustain ? partySize : 0)
            : Math.min(partySize, Math.floor((cumulativeMonsterDamage + EPSILON) / sustainPerPc));
        const residual = cumulativeMonsterDamage - downs * sustainPerPc;
        const damagedButStanding = damageAllocation === "spread_evenly"
            ? (downs === 0 && cumulativeMonsterDamage > EPSILON ? partySize : 0)
            : (downs < partySize && residual > EPSILON ? 1 : 0);
        standing = Math.max(0, partySize - downs);
        const fatalNow = fatalRound === null && cumulativeMonsterDamage + EPSILON >= partySustain;
        if (completesNow)
            completionRound = round;
        if (fatalNow)
            fatalRound = round;
        const status = fatalNow || (fatalRound !== null && !completionRound) ? "FATAL"
            : completesNow || completionRound !== null ? "COMPLETE"
                : standing === 0 ? "PARTY_DOWN" : "ONGOING";
        rounds.push({
            round, partyPotential, pcsStart, partyDamage, cumulativePartyDamage,
            monsterEhpLeft: Math.max(0, ehpOnField - cumulativePartyDamage),
            monsterDprStart, monsterDprEnd, monsterDamage, cumulativeMonsterDamage,
            downs, damagedButStanding, standing, completesNow, fatalNow, status,
        });
        if (completionRound !== null)
            break;
        if (standing === 0)
            break;
    }
    const completionState = completionRound === null
        ? null : rounds.find(row => row.round === completionRound) ?? null;
    const startingEncounterDpr = encounterDprAt(prepared, 0, 1);
    const pcer = partyRoundEquivalent(party.dpr, encounterEhp);
    const mer = startingEncounterDpr > 0 ? partySustain / startingEncounterDpr : null;
    const safetyMargin = pcer === null || mer === null ? null : mer - pcer;
    const targetSafetyMargin = Number(settings.targetSafetyMargin ?? 1);
    const targetPcer = mer === null ? null : Math.max(0, mer - targetSafetyMargin);
    const targetEncounterEhp = targetPcer === null ? null : partyDamageCapacityAt(party.dpr, targetPcer);
    const scaledHpChange = targetEncounterEhp === null ? null : targetEncounterEhp - encounterEhp;
    const baseFourPcHpChange = scaledHpChange === null
        ? null : scaledHpChange / partySizeHpMultiplier(partySize);
    const outcomeRisks = specialOutcomeRisks(prepared);
    const earliestPossibleSpecialFatalRound = outcomeRisks
        .filter(risk => risk.kind === "instant_death" || risk.kind === "drop_to_zero")
        .reduce((earliest, risk) => earliest === null ? risk.earliestRound : Math.min(earliest, risk.earliestRound), null);
    return {
        encounterEhp,
        startingEncounterDpr,
        completionRound,
        fatalRound,
        fatalRoundBasis: "deterministic expected damage; special zero-HP/death effects are reported separately",
        damageAllocation,
        survivorCountBasis: damageAllocation === "spread_evenly"
            ? "projected under equal per-PC sustain and even damage allocation"
            : "projected under equal per-PC sustain and sequential focus fire",
        earliestPossibleSpecialFatalRound,
        specialOutcomeRisks: outcomeRisks,
        downsAtCompletion: completionState?.downs ?? null,
        damagedButStandingAtCompletion: completionState?.damagedButStanding ?? null,
        standingAtCompletion: completionState?.standing ?? null,
        pcer, mer, safetyMargin,
        balanceAdjustment: {
            targetSafetyMargin, targetPcer, targetEncounterEhp, scaledHpChange, baseFourPcHpChange,
            percentChange: scaledHpChange === null || encounterEhp === 0 ? null : scaledHpChange / encounterEhp,
        },
        rounds,
    };
}
