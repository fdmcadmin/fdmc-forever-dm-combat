/** Shared deterministic tactical round loop for all three checker surfaces.
 * HP is kept per body; targeting is re-evaluated every round. No token coordinates are claimed.
 */
import { prepareRoster, roundValue, specialOutcomeRisks, partyRoundEquivalent, partyDamageCapacityAt,
  partySizeHpMultiplier, type RosterGroup, type RoundProfile, type EncounterResult, type SimulationRound } from "./checkerV2";
import { TACTICAL_AI, bodyThreat, targetScores, focusShares } from "./tacticalAi";
import { concentrationHold, cycleActiveShare } from "./durationPricing";
import { hostileFractionActingFirst } from "./initiativeOrder";

export type TacticalMember = {
  id: string; name: string; maxHp: number; hp?: number; ac: number; dpr: Partial<RoundProfile>;
  frontline?: boolean; meleeShare?: number; hitChance?: number; guardian?: boolean; tempHp?: number;
  healing?: number; maxHealing?: number; healingPerUse?: number; healingSelfOnly?: boolean; reactionReduction?: number;
  bond?: { kind: "reduction" | "temp" | "healing"; amount: number; offense?: Partial<RoundProfile> };
};
export type TacticalOptions = {
  party: { size: number; sustain: number; dpr: Partial<RoundProfile>; initiative?: number;
    mitigationPerRound?: number; members?: TacticalMember[] };
  roster: RosterGroup[];
  settings?: { maxRounds?: number; tacticalTargetWeight?: number; targetSafetyMargin?: number;
    damageAllocation?: "focus_fire" | "spread_evenly"; tactical?: boolean };
};

export function simulateTacticalEncounter({ party, roster, settings = {} }: TacticalOptions): EncounterResult {
  const size = party.size;
  if (!Number.isInteger(size) || size < 1 || !Number.isFinite(party.sustain) || party.sustain <= 0) throw new RangeError("Invalid party size/sustain");
  if (party.members && party.members.length !== size) throw new RangeError("Tactical member count must match party size");
  const sourceMembers: TacticalMember[] = party.members ?? Array.from({ length: size }, (_, i) => ({ id: `proxy-${i}`, name: `PC ${i + 1}`,
    maxHp: party.sustain / size, ac: 15, dpr: Object.fromEntries(Object.entries(party.dpr).map(([k, v]) => [k, Number(v) / size])) }));
  if (sourceMembers.some(p => !Number.isFinite(p.maxHp) || p.maxHp <= 0 || !Number.isFinite(p.ac))) throw new RangeError("Invalid member HP/AC");
  const pcs = sourceMembers.map(p => ({ ...p, hp: Math.max(0, Math.min(p.maxHp, p.hp ?? p.maxHp)), tempHp: Math.max(0, p.tempHp ?? 0), healing: Math.max(0, p.healing ?? 0) }));
  const prepared = prepareRoster(roster, size, 0);
  const state = prepared.map((g, index) => ({ g, index, hp: g.groupEhp, damage: 0, previousDamage: 0, arrived: false }));
  const alive = (s: typeof state[number]) => s.g.bodiless ? s.g.quantity : s.g.bodyEhp > 0 ? Math.min(s.g.quantity, Math.ceil(Math.max(0, s.hp - 1e-9) / s.g.bodyEhp)) : 0;
  const present = (s: typeof state[number], round: number): boolean => {
    if (round < (s.g.arrivesRound ?? 1) || round > (s.g.expiresAfterRound ?? Infinity)) return false;
    if (s.g.endsWithGroupId && !s.g.replacesParent) {
      const parent = state.find(p => p.g.id === s.g.endsWithGroupId);
      if (parent && alive(parent) <= 0) return false;
    }
    return alive(s) > 0;
  };
  const encounterEhp = prepared.reduce((sum, g) => sum + (g.replacesParent ? 0 : g.groupEhp), 0);
  const hostileFirst = hostileFractionActingFirst(prepared.map(g => ({ name: g.name, quantity: g.quantity,
    initiativeMod: g.initiativeMod ?? 0, weight: roundValue(g.dpr, 1) })), party.initiative ?? 0);
  const rounds: SimulationRound[] = [];
  let cumulativePartyDamage = 0, cumulativeMonsterDamage = 0;
  let completionRound: number | null = null, fatalRound: number | null = null;
  const owed: Array<{ source: number; round: number; lost: number; concentration: boolean; queued: number }> = [];
  const horizon = Math.max(1, Math.floor(settings.maxRounds ?? 20));
  for (let round = 1; round <= horizon; round++) {
    for (const s of state) if (!s.arrived && round >= (s.g.arrivesRound ?? 1)) {
      s.arrived = true;
      if (s.g.replacesParent && s.g.endsWithGroupId) {
        const parent = state.find(p => p.g.id === s.g.endsWithGroupId);
        if (parent) { s.hp = parent.hp; parent.hp = 0; }
      }
    }
    const sustainAtStart = pcs.reduce((n, p) => n + p.hp + p.healing + p.tempHp, 0);
    const pcsStart = pcs.filter(p => p.hp > 0).length;
    if (!pcsStart) { fatalRound = round - 1; break; }
    const live = state.filter(s => present(s, round));
    const startAlive = new Map(live.map(s => [s.index, alive(s)]));
    const key = round === 1 ? "round1" : round === 2 ? "round2" : round === 3 ? "round3" : "round4Plus";
    const concentration: NonNullable<SimulationRound["concentration"]> = [];
    const holdOf = (id: string | undefined, con: number) => {
      const holder = state.find(s => s.g.id === id);
      if (!holder || !present(holder, round)) return 0;
      return concentrationHold(con, holder.previousDamage, Math.max(1, roundValue(party.dpr, Math.max(1, round - 1)) / size)).hold;
    };
    for (const o of owed) if (o.concentration && o.queued < round && o.round >= round) {
      const s = state[o.source]; o.lost *= holdOf(s.g.id, s.g.conSave ?? 0);
    }
    for (const s of live) for (const use of s.g.pcTurnDenials?.[key] ?? []) use.turns.forEach((p, k) => {
      const lost = alive(s) * s.g.dprUptime * use.pcs * p;
      owed.push({ source: s.index, round: round + k, lost: lost * hostileFirst, concentration: Boolean(use.concentration), queued: round });
      owed.push({ source: s.index, round: round + k + 1, lost: lost * (1 - hostileFirst), concentration: Boolean(use.concentration), queued: round });
    });
    const pcTurnsLost = Math.min(pcsStart, owed.filter(o => o.round === round).reduce((sum, o) => sum + o.lost, 0));
    let partyFactor = 1;
    const shares = new Map<number, number>();
    for (const s of live) {
      const c = s.g.concentration;
      const hold = c ? holdOf(c.holderGroupId, c.conSave) : 1;
      const share = c ? cycleActiveShare(c.activeTurns, hold) : 1;
      shares.set(s.index, share);
      if (c) concentration.push({ id: s.g.id ?? String(s.index), name: s.g.name ?? "effect",
        damageToHolder: state.find(p => p.g.id === c.holderGroupId)?.previousDamage ?? 0, hold, activeShare: share });
      partyFactor *= 1 - share * (1 - (s.g.partyDamageFactor ?? 1));
    }
    const bodyDpr = (s: typeof state[number]) => s.g.concentration
      ? Math.max(0, (shares.get(s.index) ?? 1) * roundValue(s.g.concentration.dependent, round) + roundValue(s.g.concentration.fixed, round))
      : roundValue(s.g.dpr, round);
    const partyPotential = pcs.filter(p => p.hp > 0).reduce((sum, p) => sum + roundValue(p.dpr, round), 0);
    const healthShare = pcs.reduce((sum, p) => sum + p.hp, 0) / pcs.reduce((sum, p) => sum + p.maxHp, 0);
    let defense = Math.max(0, party.mitigationPerRound ?? 0), sacrificed = 0, healed = 0;
    const healers = new Set<string>();
    for (const p of pcs) if (p.hp > 0) defense += Math.max(0, p.reactionReduction ?? 0);
    const lowest = () => [...pcs].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    // One bond branch per living owner; offensive contribution is removed when defense wins.
    for (const p of pcs) if (p.hp > 0 && p.bond && healthShare < TACTICAL_AI.bondDefenceThreshold) {
      const target = lowest(), amount = Math.max(0, p.bond.amount);
      sacrificed += roundValue(p.bond.offense ?? {}, round);
      if (p.bond.kind === "reduction") defense += amount;
      else if (p.bond.kind === "temp") target.tempHp = Math.max(target.tempHp, amount);
      else { const n = Math.min(target.maxHp - target.hp, amount); target.hp += n; healed += n; }
    }
    for (const p of pcs) if (p.hp > 0 && p.healing > 0) {
      const target = p.healingSelfOnly ? p : lowest();
      if (target.hp / target.maxHp >= TACTICAL_AI.healTrigger) continue;
      const n = Math.min(p.healing, p.healingPerUse ?? p.healing, target.maxHp - target.hp);
      target.hp += n; p.healing -= n; healed += n; healers.add(p.id);
      // Conservative Action heal: offense is displaced, never a free second Action.
      sacrificed += roundValue(p.dpr, round);
    }
    let potential = Math.max(0, partyPotential - sacrificed) * Math.max(0, partyFactor) * (1 - pcTurnsLost / Math.max(1, pcsStart));
    const frontline = pcs.filter(p => p.hp > 0 && p.frontline).length;
    // The supplied model's surround assumption, applied only to the melee share.
    if (frontline >= 2 && party.members) {
      const meleeGain = pcs.filter(p => p.hp > 0 && !healers.has(p.id)).reduce((sum, p) => sum + roundValue(p.dpr, round) * (p.meleeShare ?? 0) * (1 - (p.hitChance ?? 1)), 0);
      potential += Math.max(0, meleeGain) * TACTICAL_AI.surroundAdvantageQuality * Math.max(0, partyFactor) * (1 - pcTurnsLost / Math.max(1, pcsStart));
    }
    const targets = live.filter(s => !s.g.bodiless && s.hp > 0);
    const scores = targetScores(targets.map((s, i) => ({ authoredOrder: i + 1,
      threat: bodyThreat({ damagePerRound: bodyDpr(s), pcTurnsDeniedPerRound: (s.g.pcTurnDenials?.[key] ?? []).reduce((n, u) => n + u.pcs * (u.turns[0] ?? 0), 0) }) })), settings.tacticalTargetWeight ?? TACTICAL_AI.targetWeight);
    const ranked = targets.map((s, i) => ({ s, score: scores[i] })).sort((a, b) =>
      Number(Boolean(b.s.g.killOrderFirst)) - Number(Boolean(a.s.g.killOrderFirst)) || b.score - a.score).map(x => x.s);
    const dealt = new Map<number, number>();
    const hit = (s: typeof state[number], amount: number) => {
      const n = Math.min(Math.max(0, amount), s.hp); s.hp -= n; s.damage += n;
      dealt.set(s.index, (dealt.get(s.index) ?? 0) + n); return n;
    };
    let budget = potential;
    const compulsory = ranked.find(s => s.g.killOrderFirst);
    if (compulsory) budget -= hit(compulsory, budget);
    // Each living redirector takes its own legal action share before discretionary targeting.
    for (const s of ranked) if (!compulsory && (s.g.redirectsPartyActionsPerRound ?? 0) > 0)
      budget -= hit(s, Math.min(budget, potential * Math.min(1, s.g.redirectsPartyActionsPerRound! * (startAlive.get(s.index) ?? 0) / size)));
    const substitute = live.find(s => (s.g.substitutesPartyDamagePerRound ?? 0) > 0);
    if (!compulsory && substitute && ranked.length > 1) budget -= hit(ranked[1], Math.min(budget, potential * substitute.g.substitutesPartyDamagePerRound!));
    for (const s of ranked) { if (budget <= 0) break; budget -= hit(s, budget); }
    const partyDamage = potential - budget;
    cumulativePartyDamage += partyDamage;
    const targetWeights = (s: typeof state[number]) => {
      const haveFront = pcs.some(p => p.hp > 0 && p.frontline);
      const focus = focusShares(pcs.map(p => ({ ...p,
        reach: s.g.tactical?.meleeOnly && haveFront && !p.frontline ? 0 : 1 })));
      const area = Math.max(0, Math.min(1, s.g.tactical?.areaShare?.[key] ?? 0));
      const up = pcs.filter(p => p.hp > 0).length;
      return focus.map((w, i) => (1 - area) * w + (pcs[i].hp > 0 ? area / Math.max(1, up) : 0));
    };
    let monsterDprStart = 0, monsterDprEnd = 0, rawTotal = 0;
    const contributions = live.map(s => {
      const start = startAlive.get(s.index) ?? 0, end = present(s, round) ? alive(s) : 0;
      const weights = targetWeights(s);
      const profiles = s.g.tactical?.vsPcDpr;
      const base = roundValue(s.g.dpr, round);
      const accuracy = profiles?.length === size && base > 0
        ? profiles.reduce((sum, profile, i) => sum + roundValue(profile, round) * weights[i], 0) / base : 1;
      const dpr = bodyDpr(s) * s.g.dprUptime * accuracy;
      monsterDprStart += start * dpr; monsterDprEnd += end * dpr;
      const value = (hostileFirst * start + (1 - hostileFirst) * end) * dpr;
      rawTotal += value; return { s, start, end, dpr, value };
    });
    // Signed interaction rows are opportunity costs, not damage against PCs. Deduct once.
    const positive = contributions.reduce((sum, c) => sum + Math.max(0, c.value), 0);
    rawTotal = Math.max(0, rawTotal);
    const prevented = Math.min(rawTotal, defense), kept = positive > 0 ? (rawTotal - prevented) / positive : 0;
    const received = pcs.map(() => 0);
    for (const { s, value } of contributions) {
      let remaining = Math.max(0, value) * kept;
      // Reallocate overflow immediately: a dropped PC cannot keep absorbing the next attack.
      while (remaining > 1e-8 && pcs.some(p => p.hp > 0)) {
        const blended = targetWeights(s);
        let applied = 0;
        pcs.forEach((p, i) => {
          const amount = Math.min(remaining * blended[i], p.hp + p.tempHp);
          const thp = Math.min(p.tempHp, amount); p.tempHp -= thp; p.hp = Math.max(0, p.hp - (amount - thp));
          received[i] += amount; applied += amount;
        });
        remaining -= applied; if (applied < 1e-8) break;
      }
    }
    const monsterDamage = rawTotal - prevented;
    cumulativeMonsterDamage += monsterDamage;
    const standing = pcs.filter(p => p.hp > 1e-9).length;
    const future = state.some(s => !s.g.bodiless && (s.g.arrivesRound ?? 1) > round && (!s.g.endsWithGroupId || state.some(p => p.g.id === s.g.endsWithGroupId && alive(p) > 0)));
    const left = state.filter(s => !s.g.bodiless && present(s, round)).reduce((sum, s) => sum + s.hp, 0);
    const completesNow = !future && left <= 1e-8 && encounterEhp > 0;
    const fatalNow = standing === 0;
    if (completesNow) completionRound = round;
    if (fatalNow) fatalRound = round;
    rounds.push({ round, pcsStart, partyPotential, partyDamage, cumulativePartyDamage,
      monsterEhpLeft: left, monsterDprStart, monsterDprEnd, monsterDamage, cumulativeMonsterDamage,
      bondMitigation: prevented, downs: size - standing, damagedButStanding: pcs.filter(p => p.hp > 0 && p.hp < p.maxHp).length,
      standing, completesNow, fatalNow, status: fatalNow ? "FATAL" : completesNow ? "COMPLETE" : "ONGOING",
      pcTurnsLost, concentration,
      tactical: { healed, sustainAtStart, party: pcs.map((p, i) => ({ id: p.id, name: p.name, hp: p.hp, tempHp: p.tempHp, healingLeft: p.healing, damageReceived: received[i] })),
        bodies: state.map(s => { const c = contributions.find(c => c.s === s); return { creature: s.g.name ?? s.g.id ?? String(s.index), order: ranked.indexOf(s) + 1,
          quantity: s.g.quantity, bodyEhp: s.g.bodyEhp, aliveAtStart: startAlive.get(s.index) ?? 0, aliveAtEnd: present(s, round) ? alive(s) : 0,
          killedThisRound: Math.max(0, (startAlive.get(s.index) ?? 0) - alive(s)), damageIntoGroup: s.damage, groupEhpRemaining: s.hp,
          bodyDpr: bodyDpr(s), dprUptime: s.g.dprUptime, contribution: Math.max(0, c?.value ?? 0) * kept }; }) } });
    for (const s of state) s.previousDamage = dealt.get(s.index) ?? 0;
    if (completesNow || fatalNow) break;
  }
  /**
   * ⚠ INDEXED, NOT `.at(-1)` — THIS FILE IS PACKAGED INTO THE ENGINE.
   *
   * The app compiles at ES2022, where `Array.prototype.at` exists, so `tsc -b` was perfectly
   * happy. `package-engine.mjs` compiles the engine at `--target es2020`, where it does not:
   * `TS2550: Property 'at' does not exist`. The engine build is the one that certifies, so a
   * construct the app accepts and the engine rejects fails nothing until `engine:package` runs.
   *
   * The panels may keep using `.at(-1)` — they are app-only. Anything that reaches the engine
   * stays inside its target.
   */
  const last = rounds.length > 0 ? rounds[rounds.length - 1] : undefined;
  const completed = rounds.find(r => r.completesNow);
  const pcer = completionRound !== null ? completionRound - 1 + (last && last.partyPotential > 0 ? last.partyDamage / last.partyPotential : 1) : partyRoundEquivalent(party.dpr, encounterEhp);
  const meanDamage = cumulativeMonsterDamage / Math.max(1, rounds.length);
  const mer = fatalRound !== null ? fatalRound : meanDamage > 0 ? party.sustain / meanDamage : null;
  const targetSafetyMargin = settings.targetSafetyMargin ?? 1;
  const targetPcer = mer === null ? null : Math.max(0, mer - targetSafetyMargin);
  const targetEncounterEhp = targetPcer === null ? null : partyDamageCapacityAt(party.dpr, targetPcer);
  const delta = targetEncounterEhp === null ? null : targetEncounterEhp - encounterEhp;
  const risks = specialOutcomeRisks(prepared);
  return { encounterEhp, startingEncounterDpr: rounds[0]?.monsterDprStart ?? 0, completionRound, fatalRound,
    fatalRoundBasis: "Per-member expected HP, healing and temporary HP; special outcomes reported separately",
    damageAllocation: "focus_fire", survivorCountBasis: "Automatic reachable-vulnerability targeting; per-member HP state",
    earliestPossibleSpecialFatalRound: risks.filter(r => r.kind === "instant_death" || r.kind === "drop_to_zero").reduce<number | null>((n, r) => n === null ? r.earliestRound : Math.min(n, r.earliestRound), null),
    specialOutcomeRisks: risks, downsAtCompletion: completed?.downs ?? null, damagedButStandingAtCompletion: completed?.damagedButStanding ?? null,
    standingAtCompletion: completed?.standing ?? null, pcer, mer, merBasis: mer === null ? null : fatalRound === null ? "rate" : "fall", safetyMargin: pcer === null || mer === null ? null : mer - pcer,
    balanceAdjustment: { targetSafetyMargin, targetPcer, targetEncounterEhp, scaledHpChange: delta,
      baseFourPcHpChange: delta === null ? null : delta / partySizeHpMultiplier(size), percentChange: delta === null || !encounterEhp ? null : delta / encounterEhp }, rounds };
}
