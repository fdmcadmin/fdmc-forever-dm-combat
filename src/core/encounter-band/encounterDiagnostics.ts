/**
 * ENCOUNTER DIAGNOSTICS — section 7 of the v7 Checker Implementation Audit.
 *
 * *"Add or expose a diagnostic trace that can show, for every round: party members/resources
 * entering the round; party damage/actions; each monster body and current HP/EHP/state; damage
 * assigned to each body; ending HP/EHP; alive/dead/disabled status; available monster actions;
 * action actually scheduled; Recharge/limited-resource state; hit/save/target calculation;
 * control/reachability modification; individual monster damage/resource contribution; total
 * monster contribution; party damage allocation; PCs down/standing; and remaining party sustain.
 * This diagnostic information does not all need to remain in the normal UI. It exists so the
 * engine can be audited."*
 *
 * ⚠ IT RECOMPUTES NOTHING. Every number here is read back out of the same `simulateEncounter`
 * result and the same prepared roster the checker used. A diagnostic that does its own arithmetic
 * is a second engine, and a second engine can agree with the first while both are wrong — which
 * is precisely the failure mode this audit exists to catch.
 *
 * ⚠ PER-BODY STATE IS ONLY EXPRESSIBLE BECAUSE OF `livingBodies`. Before whole-body attrition the
 * engine had no notion of a body being alive or dead — only a continuous fraction — so a trace
 * like this could not have been written honestly. Section 7 depended on section 2 being fixed.
 */

import {
  prepareRoster, roundValue, livingBodies, remainingGroupFraction,
  type PreparedGroup, type RosterGroup, type EncounterResult,
} from "./checkerV2";

export type BodyDiagnostic = {
  creature: string;
  /** Position in kill priority — the order damage is applied in. */
  order: number;
  quantity: number;
  /** Effective HP of ONE body. */
  bodyEhp: number;
  aliveAtStart: number;
  aliveAtEnd: number;
  /** Bodies that dropped during this round. */
  killedThisRound: number;
  /** Cumulative party damage that has landed on THIS group, at the end of the round. */
  damageIntoGroup: number;
  /** EHP left in the group at the end of the round. */
  groupEhpRemaining: number;
  /** DPR of one body this round, before uptime. */
  bodyDpr: number;
  dprUptime: number;
  /** What this group contributed to the round's monster damage, at the midpoint. */
  contribution: number;
};

export type RoundDiagnostic = {
  round: number;
  /** Party state ENTERING the round. */
  pcsStanding: number;
  partySustainRemaining: number;
  partyPotential: number;
  partyDamage: number;
  cumulativePartyDamage: number;
  /** Monster output at the start and end of the round, and the midpoint that is actually used. */
  monsterDprStart: number;
  monsterDprEnd: number;
  monsterDamage: number;
  cumulativeMonsterDamage: number;
  bodies: BodyDiagnostic[];
  /** Sum of the per-body contributions — must equal `monsterDamage`. */
  bodyContributionTotal: number;
  downs: number;
  standingAtEnd: number;
  status: string;
};

export type EncounterDiagnostic = {
  encounterEhp: number;
  partySustain: number;
  partySize: number;
  damageAllocation: string;
  completionRound: number | null;
  fatalRound: number | null;
  rounds: RoundDiagnostic[];
  /**
   * Self-check: every round's per-body contributions must sum to the monster damage the simulator
   * used. A mismatch means the diagnostic and the engine disagree, which is a bug in one of them
   * and must never be reported as a result.
   */
  reconciles: boolean;
  worstDiscrepancy: number;
};

/** One group's share of cumulative party damage, given kill order. */
function damageIntoGroup(group: PreparedGroup, cumulativePartyDamage: number): number {
  const start = group.cumulativeEnd - group.groupEhp;
  return Math.max(0, Math.min(cumulativePartyDamage - start, group.groupEhp));
}

/**
 * Expand a finished simulation into a per-round, per-body audit trace.
 *
 * `roster` and `partySize` must be the SAME inputs the result was produced from — the function
 * re-prepares them to recover per-body state the result does not carry, and reconciles its own
 * totals against the result's to prove it did so faithfully.
 */
export function diagnoseEncounter(
  result: EncounterResult,
  roster: RosterGroup[],
  partySize: number,
  partySustain: number,
): EncounterDiagnostic {
  const prepared = prepareRoster(roster, partySize);
  const rounds: RoundDiagnostic[] = [];
  let worstDiscrepancy = 0;

  for (const row of result.rounds) {
    const damageBefore = row.cumulativePartyDamage - row.partyDamage;
    const bodies: BodyDiagnostic[] = prepared.map(group => {
      const aliveAtStart = livingBodies(group, damageBefore);
      const aliveAtEnd = livingBodies(group, row.cumulativePartyDamage);
      const bodyDpr = roundValue(group.dpr, row.round);
      /**
       * The midpoint, per group, mirroring what the simulator does in aggregate: the round's
       * output is the average of what was standing at the start and what is standing at the end.
       * Summing these must reproduce the simulator's own figure — see `reconciles`.
       */
      const contribution = row.monsterDamage === 0
        ? 0
        : ((aliveAtStart + aliveAtEnd) / 2) * bodyDpr * group.dprUptime;
      return {
        creature: group.name ?? group.id ?? `group ${group.order}`,
        order: group.order,
        quantity: group.quantity,
        bodyEhp: group.bodyEhp,
        aliveAtStart,
        aliveAtEnd,
        killedThisRound: Math.max(0, aliveAtStart - aliveAtEnd),
        damageIntoGroup: damageIntoGroup(group, row.cumulativePartyDamage),
        groupEhpRemaining: group.groupEhp * remainingGroupFraction(group, row.cumulativePartyDamage),
        bodyDpr,
        dprUptime: group.dprUptime,
        contribution,
      };
    });
    const bodyContributionTotal = bodies.reduce((s, b) => s + b.contribution, 0);
    worstDiscrepancy = Math.max(worstDiscrepancy, Math.abs(bodyContributionTotal - row.monsterDamage));
    rounds.push({
      round: row.round,
      pcsStanding: row.pcsStart,
      partySustainRemaining: Math.max(0, partySustain - (row.cumulativeMonsterDamage - row.monsterDamage)),
      partyPotential: row.partyPotential,
      partyDamage: row.partyDamage,
      cumulativePartyDamage: row.cumulativePartyDamage,
      monsterDprStart: row.monsterDprStart,
      monsterDprEnd: row.monsterDprEnd,
      monsterDamage: row.monsterDamage,
      cumulativeMonsterDamage: row.cumulativeMonsterDamage,
      bodies,
      bodyContributionTotal,
      downs: row.downs,
      standingAtEnd: row.standing,
      status: row.status,
    });
  }

  return {
    encounterEhp: result.encounterEhp,
    partySustain,
    partySize,
    damageAllocation: result.damageAllocation,
    completionRound: result.completionRound,
    fatalRound: result.fatalRound,
    rounds,
    reconciles: worstDiscrepancy < 1e-6,
    worstDiscrepancy,
  };
}

/** Render the trace as plain text — for a console audit, not for the panel. */
export function formatDiagnostic(d: EncounterDiagnostic): string {
  const out: string[] = [];
  out.push(`encounter EHP ${d.encounterEhp.toFixed(1)} · party ${d.partySize} · sustain ${d.partySustain.toFixed(1)} · ${d.damageAllocation}`);
  out.push(`completion round ${d.completionRound ?? "—"} · fatal round ${d.fatalRound ?? "—"}`);
  for (const r of d.rounds) {
    out.push(`\nROUND ${r.round}  [${r.status}]`);
    out.push(`  party: ${r.pcsStanding} standing, sustain left ${r.partySustainRemaining.toFixed(1)}, deals ${r.partyDamage.toFixed(1)} (cum ${r.cumulativePartyDamage.toFixed(1)})`);
    for (const b of r.bodies) {
      out.push(`    #${b.order} ${b.creature}: ${b.aliveAtStart}→${b.aliveAtEnd} alive of ${b.quantity}`
        + (b.killedThisRound ? ` (−${b.killedThisRound})` : "")
        + ` · body EHP ${b.bodyEhp.toFixed(1)} · group left ${b.groupEhpRemaining.toFixed(1)}`
        + ` · DPR ${b.bodyDpr.toFixed(1)}×${b.dprUptime} → contributes ${b.contribution.toFixed(1)}`);
    }
    out.push(`  monsters: ${r.monsterDprStart.toFixed(1)} → ${r.monsterDprEnd.toFixed(1)}, midpoint ${r.monsterDamage.toFixed(1)} (cum ${r.cumulativeMonsterDamage.toFixed(1)})`);
    out.push(`  downs ${r.downs}, standing ${r.standingAtEnd}`);
  }
  out.push(`\nreconciles with the engine: ${d.reconciles ? "YES" : `NO — worst discrepancy ${d.worstDiscrepancy.toFixed(6)}`}`);
  return out.join("\n");
}
