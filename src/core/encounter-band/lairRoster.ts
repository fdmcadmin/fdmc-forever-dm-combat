/**
 * A LAIR, AS THE CHECKER SEES IT.
 *
 * Christopher: *"finish the summon and then the lair action so those can be priced properly"*, and
 * then the shape of it: *"the summon feature was suppose to then build into the lair actions and
 * then the checker could read that a lair is summoned."*
 *
 * ── ⚠ WHAT WAS ACTUALLY MISSING ─────────────────────────────────────────────────────────────
 *
 * Not the summon, and not the lair. `summon.ts` builds bodies and `check:summons` proves it;
 * `lair.ts` holds the rotation rule, the damage mean and the unpriced report, and both campaign
 * lairs are authored against it. The gap was between them and the checker:
 *
 *   · `rosterFromTemplates` never read `template.lair`, so a fight with a lair priced as though it
 *     had none — no bodies, no damage, and not even a line saying one was present.
 *   · `RosterGroup.arrivesRound` had ZERO production writers. `checkerV2` can schedule a body that
 *     shows up on round 3; nothing in the app ever handed it one. Only `check-timed-bodies.ts`
 *     set the field, which is a test proving a capability with no caller — the exact shape of
 *     failure the action-budget and multiattack bugs had.
 *
 * This file is that caller.
 *
 * ── ⚠ WHAT IT PRICES, AND WHAT IT HANDS TO SOMEBODY ELSE ────────────────────────────────────
 *
 * Damage comes from `lairDamagePerRound`, which returns 0 unless an option is authored `damage` —
 * and all six campaign options are movement, obscurement and cover, so 0 is the right answer for
 * that channel. Bodies come from the authored `SummonSpec`, and the ROUND each arrives is the one
 * thing the lair knows that the roster did not.
 *
 * CONTROL is the fourth thing, and it does NOT belong on the row this file builds. See
 * `LairControl`: a lair's cover and obscurement move the EHP of the CREATURE and the damage taken
 * by the PARTY, and this row is bodiless — it has no HP for a multiplier to act on. 0.8.11.1 put
 * the factors here anyway and they moved not one number. The caller applies them.
 */

import type { LairSpec, LairOption } from "../monsters/lair";
import { lairDamagePerRound, unpricedLairOptions } from "../monsters/lair";
import { materializeSummon } from "../monsters/summon";
import { classifyTrait } from "./traitClassifier";
import { summonerContextFor } from "./summonRoster";
import type { SustainFactor } from "./checkerV2";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";

/** The subset of a roster group this file produces. Kept structural so it cannot drift from checkerV2. */
export type LairRosterGroup = {
  id: string;
  name: string;
  quantity: number;
  baseHp: number;
  acMultiplier: number;
  /**
   * ⚠ ALWAYS EMPTY, AND THAT IS THE CORRECTION. 0.8.11.1 put the lair's control factors HERE, and
   * they moved no number at all: `traitFactors` multiply EHP, this row is `bodiless` with
   * `baseHp: 0`, and a multiplier on nothing is nothing. The control was classified, printed, and
   * inert.
   *
   * Control lands on the ACTORS now — see `LairControl`. The field stays so this row cannot drift
   * from `RosterGroup`.
   */
  traitFactors: SustainFactor[];
  dpr: { round1: number; round2: number; round3: number; round4Plus: number };
  damageUptime: number;
  arrivesRound?: number;
  expiresAfterRound?: number;
  /** The lair's own row: it acts, it is never a body. See `RosterGroup.bodiless`. */
  bodiless?: boolean;
  /** A creature's lair falls silent when that creature is dead. A world hazard leaves this unset. */
  endsWithGroupId?: string;
};

export type LairAssumption = { creature: string; flag: string; field: string; detail: string };

/**
 * WHAT THE LAIR DOES TO THE PEOPLE IN IT — the half a bodiless row can never carry.
 *
 * Christopher, 2026-08-30: *"the cover/obscurement should lower the EHP or DPR anyone in the fight
 * but the lair is effecting the players more then the bosses, and yes the Wrong Angle would lower
 * the EHP of both while raising the DPR for both because they would not get cover but the creatures
 * usually dont care about cover."*
 *
 * So a lair's control is TWO-SIDED, and the two sides are two different channels:
 *
 *   `hostFactors`      what it does to the CREATURE, as signed EHP contributions. Concealment the
 *                      boss stands in raises its EHP; cover stripped off the boss lowers it.
 *   `pressureFraction` what it does to the PARTY, as the fraction by which every monster's landed
 *                      damage rises. Stripping cover raises the party's exposure, and nothing on a
 *                      monster's own row can say that.
 *
 * ⚠ ONE OPTION MAY USE BOTH, BUT ONLY WHEN IT REALLY IS TWO EFFECTS. Cover removal genuinely cuts
 * both ways — the option's own text says *"The distortion benefits both sides."* Concealment does
 * not: "the party needs more rounds to kill it" and "the boss is harder to hit" are one statement,
 * and charging both is the double-count `effectiveHpPerBody` warns about.
 */
export type LairControl = {
  hostFactors: SustainFactor[];
  pressureFraction: number;
};

export type LairRosterBuild = {
  groups: LairRosterGroup[];
  assumptions: LairAssumption[];
  control: LairControl;
};

/**
 * DOES THIS OPTION HAND OUT COVER, OR TAKE IT AWAY?
 *
 * ⚠ THE CLASSIFIER CANNOT ANSWER THIS, AND READING IT AS "GRANTS" IS HOW 0.8.11.1 GOT THE SIGN
 * BACKWARDS. `classifyTrait` matches on the substring "half cover", so Wrong Angle's *"treat half
 * cover as no cover and three-quarters cover as half cover"* came back as the rule for GAINING half
 * cover — a cover strip priced as a cover grant, +0.0165 where the number belongs below zero.
 *
 * The split is deliberate and it is the design: the calibrated rule carries the MAGNITUDE, which is
 * RULE 2 and stays; the option's own wording carries the DIRECTION. Neither one invents the other.
 */
function stripsCover(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  return /\bas no cover\b/.test(t)
    || /\bignor\w*[^.]{0,30}\bcover\b/.test(t)
    || /\bcover\b[^.]{0,30}\bdoes(n't| not) apply\b/.test(t)
    || /\bcover\b[^.]{0,30}\bis (reduced|ignored|treated as)\b/.test(t);
}

/**
 * ⚠ WHEN A LAIR SUMMON ACTUALLY ARRIVES, AND WHY IT IS NOT ALWAYS ROUND 1.
 *
 * The opening summon is the easy half: it fires before initiative, so its bodies are standing when
 * round 1 begins — `arrivesRound: 1`, and `checkerV2`'s own note says exactly that.
 *
 * An option summon is not guaranteed. The lair takes ONE option per round and, with
 * `noRepeatConsecutive`, cannot repeat the one it just used. So with N options the summoning one
 * is available on round 1 and then roughly every other round after — it is a CHOICE the DM makes,
 * not a schedule. Pricing it as though it lands on round 1 every fight would hand the encounter a
 * body it may never get.
 *
 * The honest read is the earliest round it CAN land, reported as an assumption so the number is
 * visible as a ceiling rather than a prediction. A single-option lair has no choice to make, so
 * there it really is round 1.
 */
function arrivalRoundFor(lair: LairSpec, option: LairOption): { round: number; certain: boolean } {
  const contested = (lair.options?.length ?? 0) > 1;
  return { round: 1, certain: !contested && !!option.summon };
}

/**
 * HP a summoned body brings — THROUGH THE SUMMON ENGINE, which this used to bypass.
 *
 * ⚠ IT READ `stats.maxHp` STRAIGHT OFF THE TEMPLATE, so a body whose HP is a FORMULA — which is
 * the whole reason `summon.ts` exists — resolved to `Number("5+10*@SLOT")`, NaN, undefined, and a
 * NEEDS DM INPUT saying nothing resolved it. The one live path that summoned anything could only
 * summon a creature whose HP was already a literal.
 *
 * The summoner is the creature whose lair this is. Christopher: *"summons always come from spells
 * or action [...] they can not come from nothing"* — a lair action is an action, and the boss it
 * belongs to is what its formulas resolve against.
 */
function summonBaseHp(
  spec: NonNullable<LairOption["summon"]>,
  library: MainMonsterTemplate[],
  summoner: MainMonsterTemplate,
): { hp: number; problems: string[] } | undefined {
  const made = materializeSummon(spec, summonerContextFor(summoner), library);
  if (!made?.body) return undefined;
  const hp = Number(made.body.stats?.maxHp);
  return Number.isFinite(hp) && hp > 0 ? { hp, problems: made.problems } : undefined;
}

/**
 * Turn one creature's lair into the rows the checker prices, plus what it had to assume.
 *
 * `library` resolves a summon's `templateId`. A spec naming a creature that is not there is
 * REPORTED rather than skipped silently — a lair calling a body nobody can find is a broken fight,
 * and the same reasoning `fold-authoring` uses when it refuses a dangling encounter reference.
 */
export function lairRosterGroups(
  template: MainMonsterTemplate,
  library: MainMonsterTemplate[],
): LairRosterBuild {
  const lair = template.lair;
  if (!lair) return { groups: [], assumptions: [], control: { hostFactors: [], pressureFraction: 0 } };

  const name = template.name;
  const groups: LairRosterGroup[] = [];
  const assumptions: LairAssumption[] = [];

  /**
   * ⚠ SAY THE LAIR IS THERE, EVEN WHEN IT PRICES AT NOTHING. A fight where the environment takes a
   * turn on initiative 20 is not the same fight as one where it does not, and a checker that
   * reports nothing reads as "there is no lair" rather than "the lair costs no damage".
   */
  const damage = lairDamagePerRound(lair, o => Number(String(o.damage ?? "").replace(/[^\d.]/g, "")) || 0);
  const unpriced = unpricedLairOptions(lair);
  assumptions.push({
    creature: name, flag: damage > 0 ? "ESTIMATED" : "NOTED", field: "lair",
    detail: `Lair acts on initiative ${lair.initiative ?? 20}${lair.noRepeatConsecutive ? ", never repeating an option" : ""}`
      + ` — ${lair.options.length} option(s), ${damage > 0 ? `${damage.toFixed(1)} average damage a round` : "no damage"}.`
      + (unpriced.length ? ` ${unpriced.length} option(s) nothing can price yet: ${unpriced.map(o => o.name).join(", ")}.` : ""),
  });

  /**
   * WHAT THE LAIR'S NON-DAMAGING OPTIONS ARE WORTH.
   *
   * Each option's own text goes through the SAME classifier a creature trait does, so a lair and a
   * creature saying "heavily obscured" are priced by one rule rather than two.
   *
   * ⚠ A LAIR PICKS ONE OPTION A ROUND AND CANNOT REPEAT IT, so a fight sees them in rotation. Each
   * matched rule is therefore worth its contribution DIVIDED BY the number of options — charging
   * every option every round is the same error the damage mean already avoids.
   *
   * ⚠ AND ONE RULE PER STACK GROUP. Two options that classify to the same effect are the same
   * claim about the same thing; `stack_group` is the workbook's own double-count key.
   */
  const control: LairControl = { hostFactors: [], pressureFraction: 0 };
  const seenGroups = new Set<string>();
  const rotation = Math.max(1, lair.options.length);
  for (const o of lair.options) {
    if (o.effect === "damage") continue;
    const match = classifyTrait(o.name, o.text);
    if (!match) {
      assumptions.push({ creature: name, flag: "NEEDS DM INPUT", field: "lair",
        detail: `"${o.name}" is a ${o.effect ?? "control"} option and no calibrated rule reads it, so it prices at NOTHING. `
          + `Word it the way the workbook does, or state what it is worth.` });
      continue;
    }
    if (seenGroups.has(match.rule.stack_group)) continue;
    seenGroups.add(match.rule.stack_group);

    const share = match.rule.contribution / rotation;

    if (stripsCover(o.text ?? "")) {
      /**
       * ⚠ BOTH SIDES, AND THE PARTY'S SIDE IS THE ONE THAT MATTERS.
       *
       * Nobody gets cover, so everybody is easier to hit: the host's EHP falls by the calibrated
       * cover contribution, and the damage the party takes rises by the same fraction.
       */
      control.hostFactors.push({
        stackGroup: match.rule.stack_group,
        label: `${o.name} — cover stripped (${match.label} reversed)`,
        contribution: -share,
      });
      control.pressureFraction += share;
      assumptions.push({ creature: name, flag: "ESTIMATED", field: "lair",
        detail: `"${o.name}" REMOVES cover rather than granting it, so it is priced in both directions: `
          + `${name} loses ${(share * 100).toFixed(2)}% effective HP and every monster in the fight lands `
          + `${(share * 100).toFixed(2)}% more. ⚠ THE CREATURE HALF IS A CEILING ON THE PARTY'S BENEFIT — it `
          + `assumes ${name} was using cover, and per the author creatures usually are not, so the real fight `
          + `is slightly HARDER than this reads.` });
      continue;
    }

    /**
     * Cover or concealment GRANTED. One statement, one channel: "the boss is harder to hit" and
     * "the party needs more rounds" are the same fact, and charging the party channel as well
     * would be the double-count.
     */
    control.hostFactors.push({
      stackGroup: match.rule.stack_group,
      label: `${o.name} — ${match.label}`,
      contribution: share,
    });
  }

  /**
   * ⚠ THE LAIR ITSELF IS A ROW, NOT JUST A NOTE — and this is the half that was missing.
   *
   * Christopher: *"lair summons happen at round 0 and they get a initiative 20 so there isnt a
   * summon because its a 'creature' with a X action but one 1 action per turn."*
   *
   * That is the workbook's `lair_action` primitive word for word: `separate_action_budget` on the
   * offense channel, *"priced on authored initiative/cadence"*. The lair is not a summoned body and
   * not part of the parent's action economy — it is its own actor, present from round 1 on
   * initiative 20, taking exactly one option a round.
   *
   * Until now the damage `lairDamagePerRound` computes went into an assumption STRING and nowhere
   * else, so it was narrated and never counted. It is a `bodiless` group so it acts without being
   * something the party can kill: no EHP, never dies, one action a round.
   *
   * ⚠ ZERO IS STILL A ROW. Both campaign lairs author only movement, obscurement and cover, so the
   * damage really is 0 — but the row has to exist anyway, or the first lair anybody authors with a
   * damaging option prices at nothing and nothing says why.
   */
  groups.push({
    id: `${template.templateId}:lair`,
    name: `${name} — lair (initiative ${lair.initiative ?? 20})`,
    quantity: 1,
    baseHp: 0,
    bodiless: true,
    acMultiplier: 1,
    // ⚠ EMPTY BY DESIGN — a multiplier on a bodiless row multiplies nothing. See `LairControl`.
    traitFactors: [],
    dpr: { round1: damage, round2: damage, round3: damage, round4Plus: damage },
    damageUptime: 1,
    arrivesRound: 1,
    /**
     * ⚠ A CREATURE'S LAIR DIES WITH THE CREATURE. Christopher: *"[Lairs] go away with the boss they
     * are attached to but the 'lair' will be used for things like active volcano and world
     * hazards."* This row hangs off `template.lair`, so it always has a boss — the roster group id
     * for a creature IS its templateId, which is what makes the link a single field.
     *
     * A world hazard is the same row with this omitted: bodiless, one action a round, and nobody's
     * death silences it.
     */
    endsWithGroupId: template.templateId,
  });

  const addSummon = (spec: NonNullable<LairOption["summon"]>, source: string, round: number, certain: boolean) => {
    const resolved = summonBaseHp(spec, library, template);
    if (resolved === undefined) {
      assumptions.push({ creature: name, flag: "NEEDS DM INPUT", field: "lair",
        detail: `${source} summons "${spec.name ?? spec.templateId ?? "an unnamed body"}", and nothing resolves it to a creature with HP. `
          + `Give the summon a templateId that exists, or an inline block.` });
      return;
    }
    const hp = resolved.hp;
    // A formula the summoner could not fill in is REPORTED — the body is still priced, because a
    // body with one unreadable number is closer to the truth than no body at all.
    for (const problem of resolved.problems) {
      assumptions.push({ creature: name, flag: "NEEDS DM INPUT", field: "lair", detail: `${source}: ${problem}` });
    }
    const count = Math.max(1, Math.round(spec.count ?? 1));
    groups.push({
      id: `${template.templateId}:lair:${source}`,
      name: `${spec.name ?? "Summoned body"} (${source})`,
      quantity: count,
      baseHp: hp,
      acMultiplier: 1,
      traitFactors: [],
      /**
       * ⚠ A SUMMONED BODY'S DAMAGE IS NOT READ HERE. It comes from the resolved template through
       * the normal trace once the DM adds it to the roster; what the lair contributes is the body
       * and the round. Inventing a DPR for it would be the double-count `effectiveHpPerBody`
       * warns about, on the damage side.
       */
      dpr: { round1: 0, round2: 0, round3: 0, round4Plus: 0 },
      damageUptime: 1,
      arrivesRound: round,
      ...(spec.durationRounds ? { expiresAfterRound: round + spec.durationRounds - 1 } : {}),
    });
    if (!certain) {
      assumptions.push({ creature: name, flag: "ESTIMATED", field: "lair",
        detail: `${source} is one of ${lair.options.length} options and the lair takes one a round`
          + `${lair.noRepeatConsecutive ? " without repeating" : ""}, so its ${count} body/bodies are priced from the EARLIEST round they can arrive (round ${round}). `
          + `That is a ceiling — the DM chooses the option, and a fight may never see it.` });
    }
  };

  if (lair.openingSummon) {
    // Fires before initiative, so the bodies are standing when round 1 begins. Not a choice.
    addSummon(lair.openingSummon, "opening summon", 1, true);
  }
  for (const option of lair.options) {
    if (!option.summon) continue;
    const { round, certain } = arrivalRoundFor(lair, option);
    addSummon(option.summon, option.name, round, certain);
  }

  return { groups, assumptions, control };
}
