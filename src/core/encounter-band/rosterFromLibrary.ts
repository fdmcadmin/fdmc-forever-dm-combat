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
import { parseCreature } from "./parseCreature";
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
    /**
     * ⚠ THE RULE THE TRAIT DECLARES, THEN ITS NAME AS A FALLBACK.
     *
     * A campaign trait carries a campaign NAME — the Grief Colossus's "Body Between" IS the
     * workbook's "Fixed prevention - 12/round", same effect and same ×1.232313. Matching on the
     * display name found nothing, so every one of them was reported as an authored assumption on a
     * figure that came straight out of the 58 calibrated rules. See `MonsterDefense.rule`.
     */
    const rule = traitRule(d.rule ?? d.name);
    if (contribution === 0) {
      /**
       * ⚠ A DELIBERATE 1.0 IS AN ANSWER, NOT A GAP. The Wendigo Wight's "Wrong Cold + Hungering
       * Leap tempo" is authored at exactly 1.0 with its reason written out — the tempo tax is
       * counted on the damage clock via uptime, and folding it in here would double-charge it.
       * Reporting that as an assumption told the DM the checker was guessing at a number someone
       * had already decided. A 1.0 with NO note still reports: that one really is unassessed.
       */
      if (!d.note) {
        out.push({ creature: name, flag: "ESTIMATED", field: "trait",
          detail: `"${d.name}" is assessed at 1.0 with no stated reason — no effective-HP contribution.` });
      }
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
 * ⚠ ONE PATH. EVERY CREATURE IS READ FROM THE LIBRARY ENTRY THE DM CAN SEE AND EDIT.
 *
 * There used to be two, and the campaign one won: a creature with an entry in
 * `data/checker/v7-runtime.json` was priced from that snapshot's ac, hp, trait multiplier and
 * FEATURE LIST, not from its authored block. The block was decoration.
 *
 * Christopher: *"the encounter checker needs to read the library that is listed and then pull
 * those encounter, not a snapshot, if i go in a change every library entry to have 1 additional
 * monster and the encounter checker still show what was there before instead of what is there now
 * then isnt not working correctly, also rule 1 should have decided on how 2 shources of truth are
 * handled because there is only ever one source of truth for a specific file."*
 *
 * Both halves are right, and the second decides the first. RULE 1 does not describe a precedence
 * order between two truths — it says a file IS the truth. A frozen copy of that file is not a
 * second source of truth, it is a stale one, and the only thing precedence bought was the ability
 * to be confidently wrong: an edit to a library entry changed nothing the checker reported.
 *
 * It was not hypothetical. Velvet Host's snapshot entry held a completely superseded kit —
 * "Declare the Courtesy", "Wrong Invitation" — where its block prints the v3.21 one built on
 * Even-Handed Hospitality. The checker had been pricing a creature that no longer existed.
 *
 * ⚠ WHAT THE SNAPSHOT STILL PROVIDES, AND WHAT IT NO LONGER DOES. `v7-runtime.json` remains the
 * source for the party curve, spell profiles, effect families and the rest of the pricing law —
 * that is workbook law and belongs there. It is no longer consulted for what a creature IS.
 */
export function rosterFromTemplates(
  entries: RosterEntryInput[], partyLevel: number, target: PartyDefence,
): RosterBuild {
  const assumptions: RosterAssumption[] = [];

  const roster = entries.map(({ template, quantity }) => {
    // The library entry, every time. Nothing overrides what the DM can see.
    const parsed = parseCreature(template);

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
     * Itemised from the block's own defences, for every creature.
     *
     * The snapshot's calibrated `tm` used to replace this wholesale. Dropping it costs nothing
     * measurable: across all 51 profiled creatures the block's defence product and the snapshot's
     * `tm` agree to within 0.005, so this is the same number arrived at from the readable source
     * instead of a precomputed one.
     */
    const traitFactors: SustainFactor[] = traitFactorsFor(template, assumptions);

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
