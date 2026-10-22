/** Checker-only estimates. Never edits or levels up the saved character. */
import type { Actor } from "../types/actor";
import { currentPartyMetrics, type CurrentPartyMetrics, type ResolvedTarget } from "./currentPartyResolver";
import { resolvePartyProfile, type RoundProfile } from "./checkerV2";
import { partyDefenceAt } from "./partyDefenceCurve";
import { partyDefenceFromActors } from "./partyDefenceFromActors";
import { partyHealingFromActors } from "./partyHealingFromActors";
import { partyMitigationFromActors } from "./partyMitigationFromActors";
import { partyBondMitigationFromActors } from "../../modules/the-broken-chain/bondMitigationFromActors";
import { classResourceLean } from "../../modules/dnd-5e/casterLean";
import type { PartyEquipmentMode } from "./partyCurveV2";
import { attackProfile } from "../../modules/dnd-5e/featContextFromActor";
import { damageExpressionAverage } from "./damageExpression";
import { resolveFormulaVars } from "../state/resolveFormulaVars";
import type { TacticalMember } from "./tacticalSimulation";

const keys = ["round1", "round2", "round3", "round4Plus"] as const;
const metricKeys = ["round1Dpr", "round2Dpr", "round3Dpr", "round4PlusDpr"] as const;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

/**
 * The bond-stripped read below prices what a bond is worth by subtracting a second metrics
 * pass from the first. That second pass needs a bond-less actor, and spreading a fresh one
 * per call defeats the identity-keyed cache in currentPartyMetrics — every planner run paid
 * for a full recomputation per bonded character. The clone is derived purely from the actor,
 * so caching it against that actor object is safe: a re-resolved actor is a new object and
 * gets its own clone.
 */
const BOND_STRIPPED = new WeakMap<Actor, Actor>();
function bondStripped(actor: Actor): Actor {
  let clone = BOND_STRIPPED.get(actor);
  if (!clone) {
    clone = { ...actor, tabs: { ...actor.tabs, bond: [] } };
    BOND_STRIPPED.set(actor, clone);
  }
  return clone;
}

export function planningParty(actors: readonly Actor[], target: ResolvedTarget, level: number,
  mode: PartyEquipmentMode, arrivingResources = 0, arrivingSustain = arrivingResources, incoming: Parameters<typeof partyMitigationFromActors>[1] = {}) {
  if (!actors.length) return null;
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new RangeError("Planning level must be 1–20");
  const aggregate = currentPartyMetrics(actors, target, { arrivingSpent: arrivingResources, leanFor: classResourceLean });
  if (!aggregate) return null;
  const metrics: CurrentPartyMetrics = { ...aggregate, atWill: { ...aggregate.atWill },
    delivery: { ...aggregate.delivery, saveDcs: [] }, schedule: [], estimated: [...aggregate.estimated] };
  for (const k of metricKeys) metrics[k] = 0;
  for (const k of keys) metrics.atWill[k] = 0;
  metrics.fiveRoundSustain = 0;
  const members: TacticalMember[] = [];
  const defences = [] as NonNullable<ReturnType<typeof partyDefenceFromActors>>["perPc"];
  let fullSustain = 0;
  for (const actor of actors) {
    const read = currentPartyMetrics([actor], target, { arrivingSpent: arrivingResources, leanFor: classResourceLean });
    if (!read) continue;
    const sourceLevel = Math.max(1, Math.min(20, actor.level || 1));
    const from = resolvePartyProfile({ level: sourceLevel, size: 4, equipmentMode: mode });
    const to = resolvePartyProfile({ level, size: 4, equipmentMode: mode });
    const ratio = (a: number, b: number) => a > 0 ? b / a : 1;
    const sustainScale = ratio(from.sustain, to.sustain);
    const dpr = {} as RoundProfile;
    keys.forEach((k, i) => {
      const scale = ratio(from.dpr[k], to.dpr[k]);
      dpr[k] = read[metricKeys[i]] * scale;
      metrics[metricKeys[i]] += dpr[k];
      metrics.atWill[k] += read.atWill[k] * scale;
    });
    metrics.schedule.push(...read.schedule.map(s => ({ ...s,
      valuePerUse: s.valuePerUse * ratio(from.dpr[keys[Math.min(3, s.round - 1)]], to.dpr[keys[Math.min(3, s.round - 1)]]) })));
    const defence = partyDefenceFromActors([actor])!.perPc[0];
    const oldDef = partyDefenceAt(sourceLevel, mode), newDef = partyDefenceAt(level, mode);
    const projected = { ...defence, ac: defence.ac + newDef.ac - oldDef.ac,
      saves: { ...defence.saves }, initiative: defence.initiative + newDef.dex - oldDef.dex };
    for (const k of Object.keys(projected.saves) as Array<keyof typeof projected.saves>) projected.saves[k] += newDef[k] - oldDef[k];
    defences.push(projected);
    metrics.delivery.saveDcs.push(...read.delivery.saveDcs.map(dc => dc + Math.ceil(level / 4) - Math.ceil(sourceLevel / 4)));
    const mitigation = partyMitigationFromActors([actor], incoming);
    const resistance = mitigation.multiplier;
    const hp = Math.max(1, Number(actor.stats.hp.max)) * sustainScale * resistance;
    // Only dedicated HP pools with a usable healing action are added. Shared spell slots
    // remain in the offensive ledger; they cannot also buy free healing here.
    const pools = partyHealingFromActors([actor]);
    const healAction = Object.values(actor.tabs).flat().find(a =>
      a.actionKind !== "resource" && /heal/i.test(String(a.metadata?.effectKind ?? "") + " " + a.label)
      && a.actionKind !== "spell");
    const fullHealing = healAction ? pools.total * sustainScale * resistance : 0;
    const healing = fullHealing * (1 - arrivingResources);
    const printedHeal = healAction?.metadata?.damage;
    const healAmount = printedHeal ? damageExpressionAverage(resolveFormulaVars(printedHeal, actor)) : 0;
    const healingPerUse = healAmount > 0 ? healAmount * sustainScale * resistance : healing;
    if (pools.total > 0 && !healAction) metrics.estimated.push(`${actor.name}: healing pool omitted because no usable healing action was read.`);
    const weapon = attackProfile(actor, target.ac);
    const bond = partyBondMitigationFromActors([actor]);
    const best = bond?.sources.reduce<(NonNullable<typeof bond>)["sources"][number] | undefined>((a, b) => !a || b.amount > a.amount ? b : a, undefined);
    const withoutBond = best ? currentPartyMetrics([bondStripped(actor)], target,
      { arrivingSpent: arrivingResources, leanFor: classResourceLean }) : null;
    const bondOffense = {} as RoundProfile;
    keys.forEach((k, i) => bondOffense[k] = withoutBond ? Math.max(0, read[metricKeys[i]] - withoutBond[metricKeys[i]]) * ratio(from.dpr[k], to.dpr[k]) : 0);
    members.push({ id: actor.id, name: actor.name, maxHp: hp, hp: hp * (1 - arrivingSustain),
      ac: projected.ac, dpr, healing, maxHealing: fullHealing, healingPerUse,
      healingSelfOnly: Boolean(healAction && /yourself|self only/i.test(healAction.description ?? "")),
      reactionReduction: mitigation.reactionPerRound,
      hitChance: weapon?.hitChance, frontline: (read.delivery.meleeAttackShare ?? 0) > 0,
      meleeShare: Math.min(1, (read.delivery.meleeAttackShare ?? 0) * (weapon?.attacks ?? 1)), guardian: Boolean(best && /guardian/i.test(best.bond)),
      ...(best ? { bond: { kind: best.kind, amount: best.amount * sustainScale, offense: bondOffense } } : {}) });
    fullSustain += hp + fullHealing;
    metrics.fiveRoundSustain += hp * (1 - arrivingSustain) + healing;
    if (sourceLevel !== level) metrics.estimated.push(`${actor.name}: saved L${sourceLevel} → planning L${level}. Round damage and sustain use the selected-mode curve growth; defence uses curve deltas. Future feat, spell and subclass choices are estimates, not edits to the character.`);
  }
  if (!defences.length) return null;
  const saves = { ...defences[0].saves };
  for (const k of Object.keys(saves) as Array<keyof typeof saves>) saves[k] = mean(defences.map(d => d.saves[k]));
  return { metrics, members, fullSustain, projected: actors.some(a => a.level !== level),
    defence: { ac: mean(defences.map(d => d.ac)), saves, initiative: mean(defences.map(d => d.initiative)), perPc: defences } };
}
