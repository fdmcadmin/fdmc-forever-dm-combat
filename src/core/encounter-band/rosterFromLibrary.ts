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
import type { TemplateBodyChoice } from "../monsters/encounterLibrary";
import { materializeTemplateBody } from "../monsters/actionSetPicks";
import { lairRosterGroups } from "./lairRoster";
import { summonRosterGroups } from "./summonRoster";
import { EXPECTED_MONSTER_AC, AC_CONTRIBUTION, resolveTraitRule } from "./compactImport";
import { parseCreature } from "./parseCreature";
import { priceDamageResponses, describeDamageResponses } from "./damageResponsePricing";
import type { PartyDamageMix } from "./partyDamageMix";
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
  /** The party's damage composition, so a typed response prices itself. See `partyDamageMix.ts`. */
  damageMix?: PartyDamageMix,
): SustainFactor[] {
  const name = template.name;
  const defenses = template.stats.defenses ?? [];
  const factors: SustainFactor[] = [];
  const claimed = new Map<string, string>();

  /**
   * ⚠ A TYPED RESPONSE IS AN ASSESSMENT, and this asked for one that was already sitting there.
   *
   * The question is "has anyone looked at this creature's durability", not "does it own a defence
   * row". A block carrying `resistant to Fire` has been looked at — that resistance prices itself
   * below, off the party's real damage share — so demanding a row as well asks for the same fact
   * in a second place, which is the complaint this whole reader exists to answer.
   *
   * Christopher: *"why is it we have over 200 readable trait pricing and i still have to go in and
   * say this is a resistance."* He should not have to, and adding the row is actively WRONG: a
   * typed response and a calibrated rule sit in different stack groups on purpose, so a
   * hand-added "Resistance - ~50% of opposing damage" beside `resistant to Fire` prices the same
   * resistance twice.
   *
   * The flag still fires on a block with NOTHING recorded anywhere, because that one really is
   * unassessed.
   */
  const hasTypedResponse = (template.stats.damageResponses ?? []).some(r => r.type.trim() !== "");
  if (defenses.length === 0 && !template.stats.kitMultiplier && !hasTypedResponse) {
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
    const rule = resolveTraitRule(d);
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
    /**
     * ⚠ A DECLARED PROVENANCE IS AN ANSWER; ONLY `uncalibrated` IS STILL A QUESTION.
     *
     * Christopher: *"make sure that anything uncalibrated gets it and if something still is
     * unreadable (unlikely) then the app says so when estimating the monster."*
     *
     * `workbook-profile`, `interpolated` and `derived` all say where the number came from and
     * show their working — reporting them as assumptions is the same noise as reporting a
     * decided 1.0 was. `uncalibrated` is the one that has NOT been answered, so it says so, by
     * name, every time the creature is priced.
     */
    if (!rule && d.provenance === "uncalibrated") {
      out.push({ creature: name, flag: "ESTIMATED", field: "trait",
        detail: `"${d.name}" carries a hand-authored ×${(1 + contribution).toFixed(3)} that predates the workbook and has never been recalibrated against the 58 rules. It is used as entered and its stack group is its own name.` });
    } else if (!rule && !d.provenance) {
      out.push({ creature: name, flag: "NEEDS DM INPUT", field: "trait",
        detail: `"${d.name}" is not a calibrated rule and declares no provenance, so there is nothing to say where its ×${(1 + contribution).toFixed(3)} came from. Give it a rule that resolves, or declare the source.` });
    }
    factors.push({ stackGroup, label: d.name, contribution });
  }

  /**
   * ⚠ TYPED RESPONSES PRICE THEMSELVES, from the block's own words. Christopher: *"i want to type
   * the defense like resistance to cold and then it prices off that text not have to go in and
   * create a trait just for it to price."*
   *
   * Their own stack group, because they are not one of the 58 rules and must not collide with
   * one: a creature can hold `Resistance - ~25% of opposing damage` as a calibrated trait AND be
   * immune to cold, and those are different claims about different damage.
   */
  const typed = priceDamageResponses(template.stats.damageResponses, damageMix);
  if (typed.multiplier !== 1) {
    factors.push({
      stackGroup: "typed_damage_response",
      label: describeDamageResponses(template.stats.damageResponses),
      contribution: typed.multiplier - 1,
    });
  }
  /**
   * ⚠ THE MESSAGE NAMES THE WORK, because there is a finite amount of it and finishing it makes
   * every one of these price itself for good. The party's damage mix is unreadable only because
   * some damaging actions do not state a damage type; fill those in once and this stops asking.
   */
  for (const r of typed.unweighted) {
    const gap = damageMix?.untyped.length ?? 0;
    out.push({ creature: name, flag: "NEEDS DM INPUT", field: "damage_response",
      detail: gap > 0
        ? `"${r.response} to ${r.type}" prices at nothing because this party's damage mix cannot be read: ${gap} damaging action${gap === 1 ? "" : "s"} on the actors state no damage type (${damageMix!.untyped.slice(0, 3).map(u => u.label).join(", ")}${gap > 3 ? ", …" : ""}). Set the damage type on those actions and every typed response prices itself.`
        : `"${r.response} to ${r.type}" is recorded but there are no readable party actors to weigh it against, so it prices at nothing. The workbook weights it by the party's ACTUAL share of that damage type — choose the party's actors, or enter the share directly.` });
  }
  /**
   * ⚠ A DERIVED NUMBER IS STILL REPORTED. It is not a gap — nothing is being asked for — but the
   * DM did not type it, so it is shown with the share it used and where that share came from.
   */
  /**
   * ⚠ THE COVERAGE TRAVELS WITH THE NUMBER, because the gate that used to demand full coverage is
   * gone. A share read off 84% of the party's damage is a usable answer and a qualified one, and
   * the difference between those two has to be visible or the number is a claim it cannot support.
   * Christopher: *"the reader should only say ok i read this much fire action."* This is the "how
   * much" half of that sentence.
   */
  const cover = damageMix && damageMix.coverage < 0.999
    ? ` Read from ${(damageMix.coverage * 100).toFixed(0)}% of their damage — ${damageMix.untyped.length} action${damageMix.untyped.length === 1 ? "" : "s"} state no damage type.`
    : "";
  for (const d of typed.derived) {
    const pct = (d.share * 100).toFixed(1);
    out.push({ creature: name, flag: "ESTIMATED", field: "damage_response",
      detail: (d.share === 0
        ? `"${d.response.response} to ${d.response.type}" prices at nothing because none of this party's readable damage is ${d.response.type} — read from their own actions, not assumed.`
        : d.qualifierUnresolved
          ? `"${d.response.response} to ${d.response.type} ${d.response.qualifier}" priced at this party's full ${pct}% ${d.response.type} share. The qualifier narrows what is eligible and cannot be read from prose, so this is the UPPER bound — enter a share to state the real one.`
          : `"${d.response.response} to ${d.response.type}" priced at this party's own ${pct}% ${d.response.type} share, read from their actions.`) + cover });
  }

  if (factors.length === 0 && template.stats.kitMultiplier && template.stats.kitMultiplier !== 1) {
    factors.push({ stackGroup: "legacy_kit", label: "Legacy kit multiplier",
      contribution: template.stats.kitMultiplier - 1 });
    out.push({ creature: name, flag: "ESTIMATED", field: "trait",
      detail: "Priced from a legacy single kit multiplier rather than itemised traits." });
  }
  return factors;
}

export type RosterEntryInput = {
  template: MainMonsterTemplate;
  quantity: number;
  /**
   * The DM's per-body choices, for a TEMPLATE creature. Supplying these prices what the fight
   * actually fields instead of the unfinished template.
   *
   * ⚠ WITHOUT THESE, A TEMPLATE PRICES AS EVERY CHOICE AT ONCE. The Elemental Mirror's block
   * carries every element package's actions and its damage reads `2d6+@MAIN {primary}` with the
   * variables unresolved — so the parser found no attack bonus, treated every attack as
   * AUTOMATIC, and then scheduled the largest spell in the whole pool. Gate II's boss priced at
   * 42 automatic damage a round off "Stormcharged Fireball", an ability the mirror in front of
   * the party may not even have.
   *
   * Christopher: *"when creating the mirrors it would price all 14 bonds when it should only
   * price the bonds and the spells that have been added to those mirrors via the element."*
   */
  bodies?: TemplateBodyChoice[];
};
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
  /**
   * ⚠ WHERE A SUMMONED CREATURE IS LOOKED UP — and it cannot be the encounter.
   *
   * Both the lair path and the action path resolved a summon's `templateId` against
   * `entries.map(e => e.template)`, which is the creatures ALREADY IN THE FIGHT. A summoned body is
   * by definition not one of those: "Find Steed" names a steed precisely because no steed is on the
   * field yet. So every summon naming a library creature reported "not in the library" while
   * sitting one lookup away from it.
   *
   * Defaults to the entries so every existing caller behaves exactly as before; a caller that holds
   * the real library passes it and summons resolve.
   */
  library?: readonly MainMonsterTemplate[],
): RosterBuild {
  const assumptions: RosterAssumption[] = [];
  /** The library a summon resolves against — see the `library` parameter. */
  const summonLibrary: readonly MainMonsterTemplate[] = library ?? entries.map(e => e.template);

  /**
   * ⚠ A TEMPLATE WITH AUTHORED BODIES IS PRICED AS THOSE BODIES, ONE ROW EACH.
   *
   * `materializeTemplateBody` already collapses the action pools to what a body actually took and
   * resolves its formula variables — it is what the map spawn has always used. The checker was
   * the only surface still reading the bare template, so it priced choices nobody made.
   *
   * Each body becomes its own roster row because they are not interchangeable: two mirrors differ
   * in archetype, element package and bond, which is exactly what the fight is about.
   */
  const expanded: Array<RosterEntryInput & { fromAuthoredBody?: boolean }> = entries.flatMap(entry => {
    const bodies = entry.bodies ?? [];
    if (bodies.length === 0) return [entry];
    return bodies.map(body => ({
      template: materializeTemplateBody(entry.template, body),
      quantity: 1,
      fromAuthoredBody: true,
    }));
  });

  const roster = expanded.map(({ template, quantity, fromAuthoredBody }) => {
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
    const traitFactors: SustainFactor[] = traitFactorsFor(template, assumptions, target.damageMix);

    /**
     * ⚠ ONE BODY PER PC OVERRIDES THE AUTHORED COUNT. The Mirrors are the campaign's sole
     * body-count exception — *"use one mirror per PC"* — so party size IS the count and the
     * stored `count` is a placeholder. Priced from the placeholder instead, Gate II read 82.7
     * EHP against its authored 331.0 at 4P: a gate at a quarter of its real size.
     */
    /**
     * ⚠ AUTHORED BODIES ARE THE COUNT, AND THEY BEAT `oneBodyPerPc`.
     *
     * The Mirror derives its count from party size precisely BECAUSE the bodies are usually not
     * authored. Once the DM has built them, they ARE the roster — and applying the per-PC rule on
     * top would multiply again, turning four authored mirrors into sixteen at 4P.
     */
    const perPc = Boolean(template.stats.oneBodyPerPc) && !fromAuthoredBody;
    const bodies = perPc ? Math.max(1, Math.round(target.partySize ?? 4)) : quantity;

    return {
      id: template.templateId,
      name: parsed.name,
      quantity: bodies,
      flatHpPerBody: perPc,
      baseHp: parsed.maxHp,
      acMultiplier: acMultiplierFor(parsed.ac, partyLevel, parsed.name, assumptions),
      traitFactors,
      dpr,
      damageUptime: template.stats.damageUptime ?? 1,
    };
  });

  /**
   * ⚠ THE LAIR, WHICH THIS FUNCTION USED TO WALK STRAIGHT PAST.
   *
   * `template.lair` was read nowhere in the pricing path, so Gate III and the Act 3 final were
   * checked as though the environment did not take a turn — no bodies, no damage, and no line
   * saying a lair was present at all. See `lairRoster.ts` for why the arrival round is the part
   * that actually needed building.
   *
   * Appended AFTER the creature rows so a summoned body never renumbers the roster the DM authored.
   */
  /**
   * ⚠ MEASURED BEFORE ANY LAIR ROW EXISTS. `roster` holds only creatures at this point, which is
   * exactly the base the lair's pressure is a fraction OF — a lair that amplified its own row
   * would be pricing itself.
   */
  const ROUNDS = ["round1", "round2", "round3", "round4Plus"] as const;
  const creatureDprAt = (round: (typeof ROUNDS)[number]): number =>
    roster.reduce((sum, g) => sum + Number(g.quantity ?? 0) * Number(g.dpr?.[round] ?? 0), 0);

  const lairGroups: typeof roster = [];
  for (const { template } of expanded) {
    if (!template.lair) continue;
    const built = lairRosterGroups(template, summonLibrary as MainMonsterTemplate[]);
    const rows = built.groups as unknown as typeof roster;
    assumptions.push(...built.assumptions as RosterAssumption[]);

    /**
     * ── THE CREATURE HALF: control lands on the BOSS, not on the lair's bodiless row ──────────
     *
     * Christopher: *"the cover/obscurement should lower the EHP or DPR anyone in the fight."* An
     * EHP factor on a row with `baseHp: 0` lowers nothing, which is what 0.8.11.1 shipped. The
     * creature the lair belongs to is the one whose effective HP actually moves.
     */
    const host = roster.find(g => g.id === template.templateId);
    if (host) {
      const held = new Set((host.traitFactors ?? []).map(f => String(f.stackGroup ?? f.label ?? "")));
      for (const factor of built.control.hostFactors) {
        // ⚠ `combineSustainContributions` THROWS on a repeated stack group, and it is right to:
        // a lair granting cover to a creature that already has a cover trait is one effect
        // claimed twice. The creature's own trait is the more specific of the two, so it wins.
        if (held.has(factor.stackGroup)) {
          assumptions.push({ creature: template.name, flag: "ESTIMATED", field: "lair",
            detail: `Lair option "${factor.label}" is the same ${factor.stackGroup} effect ${template.name} `
              + `already has as a trait, so it is NOT counted twice. The creature's own trait carries it.` });
          continue;
        }
        held.add(factor.stackGroup);
        (host.traitFactors ??= []).push(factor);
      }
    } else if (built.control.hostFactors.length) {
      assumptions.push({ creature: template.name, flag: "NEEDS DM INPUT", field: "lair",
        detail: `The lair's control could not be applied — no roster row matches ${template.templateId}.` });
    }

    /**
     * ── THE PARTY HALF: what nothing on a monster's row can say ───────────────────────────────
     *
     * *"raising the DPR for both because they would not get cover."* Stripping cover raises what
     * every monster LANDS, and the party's side of that has no home on a creature row — so it goes
     * where it belongs, on the lair, which is the thing doing it. The row already dies with its
     * boss via `endsWithGroupId`, so the pressure stops when the lair does.
     *
     * ⚠ A CEILING. It is measured off a roster at full strength while the lair row's damage is
     * flat, so late rounds — with bodies already dead — read slightly high.
     */
    const pressure = built.control.pressureFraction;
    const lairRow = rows.find(g => g.id === `${template.templateId}:lair`);
    if (pressure > 0 && lairRow) {
      const base = Object.fromEntries(ROUNDS.map(r => [r, creatureDprAt(r) * pressure]));
      lairRow.dpr = {
        round1: (lairRow.dpr?.round1 ?? 0) + base.round1,
        round2: (lairRow.dpr?.round2 ?? 0) + base.round2,
        round3: (lairRow.dpr?.round3 ?? 0) + base.round3,
        round4Plus: (lairRow.dpr?.round4Plus ?? 0) + base.round4Plus,
      };
      assumptions.push({ creature: template.name, flag: "ESTIMATED", field: "lair",
        detail: `The lair strips cover, so every monster lands ${(pressure * 100).toFixed(2)}% more on the party `
          + `— ${base.round1.toFixed(1)} extra damage a round, carried on the lair's own row because the lair `
          + `is what causes it. Measured at full roster strength, so it is a ceiling.` });
    }

    lairGroups.push(...rows);
  }
  roster.push(...lairGroups);

  /**
   * ⚠ AND THE BODIES A CREATURE'S OWN ACTIONS CALL. Christopher: *"summons always come from spells
   * or action [...] they can not come from nothing."* An action carrying a `summon` is the only way
   * one enters a fight, so this is the walk that finally gives `materializeSummon` a caller — it
   * had none outside its own test, which is why the Steed, the Cannon and the bond-creature all
   * resolved correctly and none of them could reach a roster.
   *
   * Appended after the lair rows for the same reason the lair rows come after the creatures: a
   * called body must never renumber the roster the DM authored.
   */
  const summonGroups: typeof roster = [];
  for (const { template } of expanded) {
    const built = summonRosterGroups(template, summonLibrary);
    summonGroups.push(...(built.groups as unknown as typeof roster));
    assumptions.push(...built.assumptions as RosterAssumption[]);
  }
  roster.push(...summonGroups);

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
