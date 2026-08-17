/**
 * Turns app creatures into checker `RosterGroup` records — parsed, traced, and silent about
 * nothing.
 *
 * ⚠ THERE IS NO OLD MODEL LEFT IN THIS PATH. A creature's damage now comes from
 * `parseCreature` → `traceCreature`, the contract's own row 10 and row 13. The previous
 * `estimateMonsterDamage` carried a SECOND action-budget implementation beside the trace, and
 * two implementations of one rule always drift — the trace is the one with the channel
 * separation, the use limits and the gating.
 *
 * Three rules govern this file:
 *
 * 1. THE CALIBRATION IS DATA. The 58 trait rules, the expected-AC curve and the AC bands ship
 *    in the v3 compact import, each rule carrying its own stack group. This module reads them.
 *
 * 2. THE TRACE IS THE DAMAGE. A creature's per-round profile comes straight off its action
 *    trace, so a front-loaded creature actually reads front-loaded: the Veilwood Crone's 1/Day
 *    burst lands in round 1 and her routine carries rounds 2+, instead of one flat average
 *    pretending both are the same fight.
 *
 * 3. NOTHING IS SILENT. Every path that cannot price something raises an assumption naming the
 *    creature, the field and the reason. A silent omission reaches the total exactly as
 *    unchallenged as a silent substitute.
 */

import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { EXPECTED_MONSTER_AC, AC_CONTRIBUTION, traitRule } from "./compactImport";
import { parseCreature, workbookCreature } from "./parseCreature";
import { traceCreature } from "./actionTrace";
import type { PartyDefence } from "./damageExpression";
import type { RosterGroup, SustainFactor } from "./checkerV2";

export type RosterAssumption = {
  creature: string;
  flag: "NEEDS DM INPUT" | "ESTIMATED";
  field: string;
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
 * columns for every rule and they differ by exactly 1.0. A defence whose name matches a
 * calibrated rule inherits THAT RULE'S stack group, so the double-count guard is the
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
 *
 * TWO PATHS, and the first one wins wherever it applies:
 *  · A CAMPAIGN CREATURE the workbook has measured is read from its workbook profile. Every
 *    field the app disagrees on is reported and overridden.
 *  · A DM'S OWN CREATURE is parsed from what they entered, which is the case the whole
 *    row 10 / row 13 machinery exists for.
 */
export function rosterFromTemplates(
  entries: RosterEntryInput[], partyLevel: number, target: PartyDefence,
): RosterBuild {
  const assumptions: RosterAssumption[] = [];

  const roster = entries.map(({ template, quantity }) => {
    const fromWorkbook = workbookCreature(template);
    const parsed = fromWorkbook ? fromWorkbook.parsed : parseCreature(template);

    if (fromWorkbook) {
      for (const d of fromWorkbook.disagreements) {
        assumptions.push({ creature: parsed.name, flag: "ESTIMATED", field: d.field.toLowerCase(),
          detail: `The app has ${d.field} ${d.app}; the workbook has ${d.workbook}. The workbook's value is used — it is the measured one.` });
      }
    }

    const trace = traceCreature(parsed, target, 4);
    for (const a of trace.assumptions) {
      assumptions.push({ creature: parsed.name, flag: a.flag, field: a.field, detail: a.detail });
    }

    // The per-round profile IS the trace. Round 4 carries the sustained figure.
    const r = trace.rounds;
    const dpr = {
      round1: r[0]?.totalExpectedDamage ?? 0,
      round2: r[1]?.totalExpectedDamage ?? 0,
      round3: r[2]?.totalExpectedDamage ?? 0,
      round4Plus: r[3]?.totalExpectedDamage ?? 0,
    };
    if (dpr.round1 <= 0 && dpr.round4Plus <= 0) {
      assumptions.push({ creature: parsed.name, flag: "NEEDS DM INPUT", field: "damage",
        detail: "No readable damage in any round, so this creature contributes nothing to the fight's pressure." });
    }

    /**
     * THE WORKBOOK'S TRAIT MULTIPLIER IS THE TRAIT MULTIPLIER. `tm` is the product it computed
     * for this exact creature across its own calibration run — a single factor carrying the
     * creature's whole defensive kit. It is not combined with the app's itemised pricing;
     * it REPLACES it, and any difference has already been reported above.
     */
    const traitFactors: SustainFactor[] = fromWorkbook
      ? (fromWorkbook.traitMultiplier === 1 ? [] : [{
        stackGroup: fromWorkbook.traitStackGroups[0] ?? "workbook_calibrated",
        label: fromWorkbook.traitStackGroups.length
          ? `Workbook calibration (${fromWorkbook.traitStackGroups.join(", ")})`
          : "Workbook calibration",
        contribution: fromWorkbook.traitMultiplier - 1,
      }])
      : traitFactorsFor(template, assumptions);

    return {
      id: template.templateId,
      name: parsed.name,
      quantity,
      baseHp: parsed.maxHp,
      acMultiplier: acMultiplierFor(parsed.ac, partyLevel, parsed.name, assumptions),
      traitFactors,
      dpr,
      damageUptime: template.stats.damageUptime ?? 1,
    };
  });

  // One line per distinct message across the whole roster.
  const seen = new Set<string>();
  const deduped = assumptions.filter(a => {
    const key = a.creature + "|" + a.flag + "|" + a.field + "|" + a.detail;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { roster, assumptions: deduped };
}
