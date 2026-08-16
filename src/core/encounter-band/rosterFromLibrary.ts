/**
 * Turns app creatures into checker-v2 `RosterGroup` records.
 *
 * This is the ONLY adapter between the app's monster data and the workbook's runtime, and it
 * is deliberately thin: `simulateEncounter` never asks where a creature came from, so an SRD
 * creature, a Broken Chain creature and a DM's own homebrew all go through identical
 * arithmetic and get identical outputs. That is the reference's own stated goal — it is
 * "intentionally data-agnostic" and can evaluate a locally entered stat block without
 * bundling that book's text.
 */

import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { estimateMonsterDamage } from "./encounterConstruction";
import { EXPECTED_MONSTER_AC, AC_DELTA_CONTRIBUTION } from "./dprBaseline";
import type { RosterGroup, SustainFactor } from "./checkerV2";

/**
 * AC as its own MULTIPLIER on effective HP, per the contract's chain.
 *
 * The bands are CUMULATIVE VALUES, not increments: "AC −3 vs expected" is the whole answer for
 * being three under. Beyond ±3 the workbook says to combine the listed bands, so the ±3 band is
 * taken as many times as it fits and the remainder added once.
 */
export function acMultiplierFor(ac: number | undefined, partyLevel: number): number {
  const expected = EXPECTED_MONSTER_AC[partyLevel];
  if (expected === undefined || ac === undefined || !Number.isFinite(ac)) return 1;
  const delta = Math.round(ac - expected);
  if (delta === 0) return 1;
  const sign = delta > 0 ? 1 : -1;
  let left = Math.abs(delta);
  let contribution = 0;
  while (left > 0) {
    const chunk = Math.min(3, left);
    contribution += AC_DELTA_CONTRIBUTION[chunk * sign] ?? 0;
    left -= chunk;
  }
  return 1 + contribution;
}

/**
 * A creature's authored `defenses` become checker sustain factors.
 *
 * `ehpMultiplier: 1.40` is the workbook's `contribution: 0.40` — its reference prints both
 * columns for every trait and they differ by exactly 1.0.
 *
 * ⚠ Every factor needs a STACK GROUP, and duplicates throw by design. The trait's own name is
 * used, so two differently-named defences never collide, but the same defence entered twice
 * will be rejected rather than silently doubled.
 */
export function traitFactorsFor(template: MainMonsterTemplate): SustainFactor[] {
  const defenses = template.stats.defenses ?? [];
  const out: SustainFactor[] = [];
  const seen = new Set<string>();
  for (const d of defenses) {
    const contribution = (d.ehpMultiplier || 1) - 1;
    if (contribution === 0) continue;              // an authored plain HP bar contributes nothing
    const stackGroup = d.name || `trait-${out.length}`;
    if (seen.has(stackGroup)) continue;            // never double-credit one effect
    seen.add(stackGroup);
    out.push({ stackGroup, label: d.name, contribution });
  }
  if (out.length === 0 && template.stats.kitMultiplier && template.stats.kitMultiplier !== 1) {
    out.push({ stackGroup: "legacy-kit", label: "Legacy kit multiplier",
      contribution: template.stats.kitMultiplier - 1 });
  }
  return out;
}

export type RosterEntryInput = { template: MainMonsterTemplate; quantity: number };

/**
 * Build the ordered roster the simulation consumes. ORDER IS KILL PRIORITY — groups deplete in
 * sequence, so the caller decides what the party focuses. Weakest-first is the usual reading of
 * a party that clears cheap bodies to cut incoming damage.
 *
 * ⚠ `baseHp` is the creature's RAW authored HP. Do NOT pre-scale it for party size — the
 * contract applies `partySizeHpMultiplier` inside `effectiveHpPerBody`, and scaling here as
 * well would apply it twice.
 */
export function rosterFromTemplates(entries: RosterEntryInput[], partyLevel: number): RosterGroup[] {
  return entries.map(({ template, quantity }) => {
    const ac = typeof template.stats.ac === "number"
      ? template.stats.ac
      : Number.parseInt(String(template.stats.ac), 10);
    const actions = (template.actions ?? []).map(a => ({ ...a, kind: a.kind as string }));
    const dpr = estimateMonsterDamage(actions, {
      partyLevel,
      attacksPerTurn: template.stats.attacksPerTurn,
    }).dpr;
    return {
      id: template.templateId,
      name: template.name,
      quantity,
      baseHp: template.stats.maxHp,
      acMultiplier: acMultiplierFor(Number.isFinite(ac) ? ac : undefined, partyLevel),
      traitFactors: traitFactorsFor(template),
      /**
       * A creature's printed output does not change round to round, so the same figure fills
       * all four slots. The ROUND SHAPE in this model belongs to the PARTY (nova → floor); the
       * monster side varies through continuous depletion instead.
       */
      dpr: { round1: dpr, round2: dpr, round3: dpr, round4Plus: dpr },
      damageUptime: template.stats.damageUptime ?? 1,
    };
  });
}
