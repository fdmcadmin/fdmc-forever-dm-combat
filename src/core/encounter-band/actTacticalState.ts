/** Checker-only carry state. Values are fractions so a level gate can project the same injuries. */
import type { EncounterResult } from "./checkerV2";
import type { TacticalMember } from "./tacticalSimulation";
import type { ScheduledUse } from "./currentPartyResolver";
import { RESOURCE_DAY } from "./resourceLedger";

export type PlanningMemberState = Record<string, { hpFraction: number; healingFraction: number; tempHp: number }>;
const unit = (n: number) => Math.max(0, Math.min(1, n));

export function carryTacticalState(members: readonly TacticalMember[], result: EncounterResult,
  rest: "None" | "Short" | "Long", hitDiceLeft: Record<string, number>,
  recoveryCapacity: Record<string, number>, override?: number): PlanningMemberState {
  const last = result.rounds.at(-1)?.tactical;
  const state: PlanningMemberState = {};
  for (const member of members) {
    const end = last?.party.find(p => p.id === member.id);
    let hp = unit((end?.hp ?? member.hp ?? member.maxHp) / member.maxHp);
    let healing = unit((end?.healingLeft ?? member.healing ?? 0) / Math.max(1e-9, member.maxHealing ?? member.healing ?? 0));
    if (rest === "Long") {
      hp = 1; healing = 1;
      hitDiceLeft[member.id] = recoveryCapacity[member.id] ?? 0;
    } else if (rest === "Short" && hp > 0) {
      const available = override ?? hitDiceLeft[member.id] ?? recoveryCapacity[member.id] ?? 0;
      const restored = Math.min(1 - hp, Math.max(0, available));
      hp += restored;
      if (override === undefined) hitDiceLeft[member.id] = Math.max(0, available - restored);
    }
    state[member.id] = { hpFraction: hp, healingFraction: healing, tempHp: rest === "None" ? end?.tempHp ?? 0 : 0 };
  }
  return state;
}

/** Day-budget estimate, independent of damage received. It is not a live spell-slot inventory. */
export function resourceCostForFight(schedule: readonly ScheduledUse[] | undefined, rounds: number, spent: number): number {
  if (!schedule) return (1 - unit(spent)) * Math.min(1, rounds / RESOURCE_DAY.roundsPerFight) / RESOURCE_DAY.fightsPerLongRest;
  const total = schedule.reduce((n, s) => n + s.usesPerFight, 0);
  const used = schedule.filter(s => s.round <= rounds).reduce((n, s) => n + s.usesPerFight, 0);
  return total > 0 ? (1 - unit(spent)) * used / total / RESOURCE_DAY.fightsPerLongRest : 0;
}
