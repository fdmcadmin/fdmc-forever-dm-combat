/**
 * Turns app creatures into checker `RosterGroup` records — priced against the BUNDLED
 * calibration, and silent about nothing.
 *
 * Two rules govern this file.
 *
 * 1. THE CALIBRATION IS DATA, NOT JUDGEMENT. The 58 trait rules, the expected-AC curve and the
 *    AC bands all ship in the v3 compact import, each rule carrying its own STACK GROUP. This
 *    module reads them; it does not restate them. Christopher: *"why would we not put the
 *    things in that tells us what a creature can do."*
 *
 * 2. NOTHING IS SILENT. *"if the checker has no idea how to parse something it will tell the
 *    dm to cal[culate] that damage."* Every path that cannot price something raises an
 *    assumption naming the creature, the field and the reason. A trait that scores nothing
 *    says so; a duplicate stack group says so; an unknown AC says so. The contract's own
 *    wording is that a silent substitute must never happen — and a silent OMISSION is the same
 *    failure wearing different clothes, because both reach the total unchallenged.
 */

import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { estimateMonsterDamage } from "./encounterConstruction";
import { EXPECTED_MONSTER_AC, AC_CONTRIBUTION, traitRule } from "./compactImport";
import type { RosterGroup, SustainFactor } from "./checkerV2";

export type RosterAssumption = {
  creature: string;
  flag: "NEEDS DM INPUT" | "ESTIMATED";
  field: "ac" | "trait" | "damage" | "stack_group";
  detail: string;
};

/**
 * AC as its own multiplier on effective HP.
 *
 * The bands are CUMULATIVE VALUES, not increments — "AC −3 vs expected" is the whole answer for
 * being three under. Beyond ±3 the ±3 band is taken as many times as it fits and the remainder
 * added once, which is what "combine the listed bands" means.
 */
export function acMultiplierFor(
  ac: number | undefined, partyLevel: number, creature: string, out: RosterAssumption[],
): number {
  const expected = EXPECTED_MONSTER_AC[partyLevel];
  if (expected === undefined) {
    out.push({ creature, flag: "ESTIMATED", field: "ac",
      detail: `No expected monster AC published for level ${partyLevel}; AC contributes nothing. The calibration covers 3-20.` });
    return 1;
  }
  if (ac === undefined || !Number.isFinite(ac)) {
    out.push({ creature, flag: "NEEDS DM INPUT", field: "ac",
      detail: "No readable AC, so this creature is priced as if it were exactly on the curve. Enter an AC." });
    return 1;
  }
  const delta = Math.round(ac - expected);
  if (delta === 0) return 1;
  const sign = delta > 0 ? 1 : -1;
  let left = Math.abs(delta);
  let contribution = 0;
  while (left > 0) {
    const chunk = Math.min(3, left);
    contribution += AC_CONTRIBUTION[chunk * sign] ?? 0;
    left -= chunk;
  }
  return 1 + contribution;
}

/**
 * A creature's authored `defenses` become checker sustain factors.
 *
 * `ehpMultiplier: 1.40` is the calibration's `contribution: 0.40` — its table prints both
 * columns for every rule and they differ by exactly 1.0. When a defence's name matches a
 * calibrated rule, that rule's OWN stack group is used, so the double-count guard is the
 * workbook's classification rather than a name this app made up.
 */
export function traitFactorsFor(
  template: MainMonsterTemplate, out: RosterAssumption[],
): SustainFactor[] {
  const name = template.name;
  const defenses = template.stats.defenses ?? [];
  const factors: SustainFactor[] = [];
  const claimed = new Map<string, string>();

  if (defenses.length === 0 && !template.stats.kitMultiplier) {
    out.push({ creature: name, flag: "NEEDS DM INPUT", field: "trait",
      detail: "No defensive traits assessed, so this creature prices at raw HP. If it has resistances, regeneration, a revival or an AC reaction, they are not being counted." });
    return factors;
  }

  for (const d of defenses) {
    const contribution = (d.ehpMultiplier || 1) - 1;
    const rule = traitRule(d.name);
    if (contribution === 0) {
      // An explicit 1.0 is an authored decision ("plain HP bar"), not an omission — but it is
      // still stated, so nobody has to guess whether it was assessed.
      out.push({ creature: name, flag: "ESTIMATED", field: "trait",
        detail: `"${d.name}" is assessed at 1.0 — no effective-HP contribution.` });
      continue;
    }
    const stackGroup = rule?.stack_group ?? d.name;
    const already = claimed.get(stackGroup);
    if (already) {
      out.push({ creature: name, flag: "NEEDS DM INPUT", field: "stack_group",
        detail: `"${d.name}" and "${already}" both claim the stack group "${stackGroup}", so they are the same effect counted twice. Only the first is applied.` });
      continue;
    }
    claimed.set(stackGroup, d.name);
    if (!rule) {
      out.push({ creature: name, flag: "ESTIMATED", field: "trait",
        detail: `"${d.name}" is not a calibrated rule; its authored ×${(1 + contribution).toFixed(3)} is used as entered and its stack group is its own name.` });
    }
    factors.push({ stackGroup, label: d.name, contribution });
  }

  if (factors.length === 0 && template.stats.kitMultiplier && template.stats.kitMultiplier !== 1) {
    factors.push({ stackGroup: "legacy_kit", label: "Legacy kit multiplier",
      contribution: template.stats.kitMultiplier - 1 });
    out.push({ creature: name, flag: "ESTIMATED", field: "trait",
      detail: "Priced from a legacy single kit multiplier rather than itemised traits." });
  }
  return factors;
}

export type RosterEntryInput = { template: MainMonsterTemplate; quantity: number };
export type RosterBuild = { roster: RosterGroup[]; assumptions: RosterAssumption[] };

/**
 * Build the ordered roster the simulation consumes. ORDER IS KILL PRIORITY.
 *
 * ⚠ `baseHp` is the creature's RAW authored HP. Do NOT pre-scale it for party size — the
 * contract applies `partySizeHpMultiplier` inside `effectiveHpPerBody`, and scaling here as
 * well would apply it twice.
 */
export function rosterFromTemplates(entries: RosterEntryInput[], partyLevel: number): RosterBuild {
  const assumptions: RosterAssumption[] = [];
  const roster = entries.map(({ template, quantity }) => {
    const ac = typeof template.stats.ac === "number"
      ? template.stats.ac
      : Number.parseInt(String(template.stats.ac), 10);
    const actions = (template.actions ?? []).map(a => ({ ...a, kind: a.kind as string }));
    const est = estimateMonsterDamage(actions, {
      partyLevel, attacksPerTurn: template.stats.attacksPerTurn,
    });
    // Anything the damage estimator could not read is surfaced, never dropped.
    for (const u of est.unread) {
      assumptions.push({ creature: template.name, flag: "NEEDS DM INPUT", field: "damage", detail: u });
    }
    if (est.dpr <= 0) {
      assumptions.push({ creature: template.name, flag: "NEEDS DM INPUT", field: "damage",
        detail: "No readable damage at all, so this creature contributes nothing to the fight's pressure." });
    }
    return {
      id: template.templateId,
      name: template.name,
      quantity,
      baseHp: template.stats.maxHp,
      acMultiplier: acMultiplierFor(Number.isFinite(ac) ? ac : undefined, partyLevel, template.name, assumptions),
      traitFactors: traitFactorsFor(template, assumptions),
      /**
       * A creature's printed output does not change round to round, so the same figure fills
       * all four slots. The ROUND SHAPE belongs to the PARTY (nova → floor); the monster side
       * varies through continuous depletion instead.
       */
      dpr: { round1: est.dpr, round2: est.dpr, round3: est.dpr, round4Plus: est.dpr },
      damageUptime: template.stats.damageUptime ?? 1,
    };
  });
  return { roster, assumptions };
}
