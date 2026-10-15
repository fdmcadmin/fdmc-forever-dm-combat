/** One planning calculation consumed by encounter, act and creature checkers. */
import type { Actor } from "../types/actor";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { rosterDamageMix } from "./partyMitigationFromActors";
import type { PlanningMemberState } from "./actTacticalState";
import type { TacticalMember } from "./tacticalSimulation";
import { planningParty } from "./planningParty";
import { targetFromRoster } from "./currentPartyResolver";
import { rosterFromTemplates, pcTurnValueAt, type RosterEntryInput } from "./rosterFromLibrary";
import { partyDefenceAt } from "./partyDefenceCurve";
import { partyDamageMixFromActors, EMPTY_DAMAGE_MIX } from "./partyDamageMix";
import { centerLineHitChance, centerLineAttackShare, centerLineSaveDcs, centerLineMeleeAttackShare } from "./centerLineAccuracy";
import { resolvePartyProfile, simulateEncounter, type RoundProfile } from "./checkerV2";
import type { PartyEquipmentMode } from "./partyCurveV2";

export type PlanningInput = {
  entries: RosterEntryInput[]; library: MainMonsterTemplate[]; actors?: readonly Actor[];
  level: number; size: number; mode: PartyEquipmentMode;
  arrivingResources?: number; arrivingSustain?: number; acOverride?: number | null; saveOverride?: number | null;
  targetSafetyMargin?: number;
  memberState?: PlanningMemberState;
};

export function checkPlannedEncounter(input: PlanningInput) {
  const { level, size, mode, entries, library } = input;
  const actors = input.actors ?? [];
  if (actors.length && actors.length !== size) throw new RangeError(`Choose exactly ${size} player actors`);
  const target = targetFromRoster(entries, size);
  if (!target) throw new Error("No readable creature target in this encounter");
  const plan = actors.length ? planningParty(actors, target, level, mode, input.arrivingResources ?? 0, input.arrivingSustain ?? 0, { mix: rosterDamageMix(entries.map(e => e.template)) }) : null;
  const proxy = partyDefenceAt(level, mode);
  const ac = input.acOverride ?? plan?.defence.ac ?? proxy.ac;
  const saves = plan?.defence.saves ?? { str: proxy.str, dex: proxy.dex, con: proxy.con, int: proxy.int, wis: proxy.wis, cha: proxy.cha };
  const usedSaves = input.saveOverride == null ? saves : Object.fromEntries(Object.keys(saves).map(k => [k, input.saveOverride!])) as typeof saves;
  const saveBonus = Object.values(usedSaves).reduce((s, n) => s + n, 0) / 6;
  const midpoint = resolvePartyProfile({ level, size, equipmentMode: mode, arrivingSpent: input.arrivingResources ?? 0 });
  const full = resolvePartyProfile({ level, size, equipmentMode: mode });
  const m = plan?.metrics;
  const dpr: RoundProfile = m ? { round1: m.round1Dpr, round2: m.round2Dpr, round3: m.round3Dpr, round4Plus: m.round4PlusDpr } : midpoint.dpr;
  let sustain = m?.fiveRoundSustain ?? full.sustain * (1 - (input.arrivingSustain ?? 0));
  const built = rosterFromTemplates(entries, level, { ac, saveBonus, saves: usedSaves, partySize: size,
    members: plan?.defence.perPc.map(d => ({ ac: input.acOverride ?? d.ac, saves: input.saveOverride == null ? d.saves : usedSaves })),
    damageMix: actors.length ? partyDamageMixFromActors([...actors]) : EMPTY_DAMAGE_MIX,
    hitChance: plan ? plan.members.reduce((s, p) => s + (p.hitChance ?? centerLineHitChance(level, mode, size, target.ac) ?? 0.65), 0) / size : centerLineHitChance(level, mode, size, target.ac),
    partyAttackShare: m?.delivery.attackShare ?? centerLineAttackShare(level, mode, size),
    partySaveDcs: m?.delivery.saveDcs ?? centerLineSaveDcs(level, mode, size),
    partySaveHalfShare: m?.delivery.saveHalfShare,
    partyMeleeAttackShare: m?.delivery.meleeAttackShare ?? centerLineMeleeAttackShare(level, mode, size),
    partyAccuracySource: plan ? "chosen" : "center",
    pcTurnValue: m ? { round1: dpr.round1 / size, round2: dpr.round2 / size, round3: dpr.round3 / size, round4Plus: dpr.round4Plus / size } : pcTurnValueAt(level, size, mode),
  }, library);
  const members: TacticalMember[] = plan?.members.map(p => ({ ...p, ac: input.acOverride ?? p.ac }))
    ?? Array.from({ length: size }, (_, i) => ({ id: `proxy-${i}`, name: `PC ${i + 1}`,
      maxHp: full.sustain / size, hp: sustain / size, ac,
      dpr: Object.fromEntries(Object.entries(dpr).map(([k, n]) => [k, n / size])) }));
  for (const member of members) {
    const previous = input.memberState?.[member.id];
    if (!previous) continue;
    member.hp = member.maxHp * Math.max(0, Math.min(1, previous.hpFraction));
    member.healing = (member.maxHealing ?? member.healing ?? 0) * Math.max(0, Math.min(1, previous.healingFraction));
    member.tempHp = Math.max(0, previous.tempHp);
  }
  sustain = members.reduce((n, p) => n + (p.hp ?? p.maxHp) + (p.healing ?? 0), 0);
  const result = sustain > 0 ? simulateEncounter({ party: { size, sustain, dpr, members,
    initiative: plan?.defence.initiative ?? proxy.dex }, roster: built.roster,
    settings: { tactical: true, targetSafetyMargin: input.targetSafetyMargin } }) : null;
  return { plan, built, result, dpr, members, sustain, fullSustain: plan?.fullSustain ?? full.sustain, midpoint,
    basis: plan?.projected ? `Party projected to level ${level}; saved characters unchanged` : plan ? `Party read at level ${level}` : `Level ${level} population estimate` };
}
