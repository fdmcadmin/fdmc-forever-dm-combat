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
 * ── ⚠ IT PRICES NOTHING ITSELF ──────────────────────────────────────────────────────────────
 *
 * Damage comes from `lairDamagePerRound`, which returns 0 unless an option is authored `damage`
 * — and all six campaign options are movement, obscurement and cover, so 0 is the right answer
 * today. Bodies come from the authored `SummonSpec`. What this adds is the ROUND each one arrives,
 * which is the only thing the lair knows that the roster did not.
 */

import type { LairSpec, LairOption } from "../monsters/lair";
import { lairDamagePerRound, unpricedLairOptions } from "../monsters/lair";
import { materializeSummon } from "../monsters/summon";
import { summonerContextFor } from "./summonRoster";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";

/** The subset of a roster group this file produces. Kept structural so it cannot drift from checkerV2. */
export type LairRosterGroup = {
  id: string;
  name: string;
  quantity: number;
  baseHp: number;
  acMultiplier: number;
  traitFactors: never[];
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

export type LairRosterBuild = { groups: LairRosterGroup[]; assumptions: LairAssumption[] };

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
  if (!lair) return { groups: [], assumptions: [] };

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

  return { groups, assumptions };
}
