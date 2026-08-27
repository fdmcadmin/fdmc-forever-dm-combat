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

/** HP a summoned body brings, from its own template or its inline block. */
function summonBaseHp(spec: NonNullable<LairOption["summon"]>, library: MainMonsterTemplate[]): number | undefined {
  if (spec.inline) return Number(spec.inline.stats?.maxHp) || undefined;
  if (!spec.templateId) return undefined;
  const t = library.find(x => x.templateId === spec.templateId);
  return t ? Number(t.stats?.maxHp) || undefined : undefined;
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

  const addSummon = (spec: NonNullable<LairOption["summon"]>, source: string, round: number, certain: boolean) => {
    const hp = summonBaseHp(spec, library);
    if (hp === undefined) {
      assumptions.push({ creature: name, flag: "NEEDS DM INPUT", field: "lair",
        detail: `${source} summons "${spec.name ?? spec.templateId ?? "an unnamed body"}", and nothing resolves it to a creature with HP. `
          + `Give the summon a templateId that exists, or an inline block.` });
      return;
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
