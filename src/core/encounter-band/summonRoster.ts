/**
 * A SUMMON REACHES THE CHECKER THROUGH THE ACTION THAT CALLS IT.
 *
 * Christopher: *"summons always come from spells or action, use the things like call familiar, the
 * find steed and the arcane cannon, they can not come from nothing, even the conv. bond come from
 * the summon action."*
 *
 * ── ⚠ WHAT WAS MISSING, AND IT WAS NOT THE ARITHMETIC ────────────────────────────────────────
 *
 * `summon.ts` resolves every formula the three named cases need and `check:summons` proves it:
 * the Steed's AC `10+@SLOT` and HP `5+10*@SLOT`, the Cannon's `5*@LEVEL`, the bond-creature's
 * `@HITDIEMAX + @LEVEL`, each pulling the CASTER's proficiency, spell attack and save DC. All of
 * it correct, and none of it reachable: `materializeSummon` had ZERO production callers and no
 * `.tsx` in the app mentioned `SummonSpec` at all.
 *
 * The reason was structural rather than an oversight. Nothing a creature could DO carried a
 * summon, so there was no moment at which one could be called — and with no caller there was also
 * no summoner, which is what `@LEVEL` and `@SPELL` resolve against. Putting `summon` on the action
 * fixes both halves at once: the action is the call, and whatever took it is the context.
 *
 * ── ⚠ THE SUMMONER IS THE CREATURE, READ THROUGH THE RESOLVERS ───────────────────────────────
 *
 * Proficiency comes from `creatureProficiencyBonus`, never off `stats.proficiencyBonus` — a blank
 * there means CR feeds it, and reading the field raw is how five Act 3 creatures got reported as
 * having lost their bonus when they had not. The same care applies to every value below.
 */

import { materializeSummon, type SummonSpec, type SummonerContext } from "../monsters/summon";
import { creatureProficiencyBonus } from "../monsters/creator/monsterCreatorModel";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";

export type SummonRosterGroup = {
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
  endsWithGroupId?: string;
};

export type SummonAssumption = { creature: string; flag: string; field: string; detail: string };
export type SummonRosterBuild = { groups: SummonRosterGroup[]; assumptions: SummonAssumption[] };

/**
 * What a creature brings to a formula its summon writes.
 *
 * ⚠ A MONSTER IS NOT A CHARACTER, and the gaps are honest rather than filled in. `@HITDIEMAX` is a
 * class feature and a monster has no class, so it stays undefined and `materializeSummon` reports
 * the unresolved variable instead of inventing a die. `@LEVEL` reads CR, which is the only
 * level-shaped number a stat block publishes.
 */
export function summonerContextFor(template: MainMonsterTemplate): SummonerContext {
  const stats = template.stats as {
    cr?: number; proficiencyBonus?: number; spellAttackBonus?: number; spellSaveDc?: number;
  };
  return {
    name: template.name,
    level: typeof stats.cr === "number" ? stats.cr : undefined,
    proficiencyBonus: creatureProficiencyBonus(stats),
    spellAttackBonus: stats.spellAttackBonus,
    spellSaveDc: stats.spellSaveDc,
  };
}

/**
 * Every body a creature's own actions call, as rows the checker prices.
 *
 * ⚠ THE BODY ARRIVES WHEN THE ACTION IS TAKEN, AND NOBODY KNOWS WHEN THAT IS. A summon is a choice
 * the DM makes mid-fight, not a schedule, so the honest read is the EARLIEST round it can land —
 * round 1 — reported as a ceiling. That is the same call `lairRoster` makes for an option summon,
 * and for the same reason: pricing a maybe as a certainty hands the encounter a body it may never
 * get, while pricing it at nothing hides one it usually does.
 *
 * ⚠ AND IT ENDS WITH ITS SUMMONER. A called body is an extension of the creature that called it —
 * kill the caster and the steed goes with it — which is `endsWithGroupId`, the same field a boss
 * lair uses. A summon that should outlive its summoner is a different thing and would say so.
 */
export function summonRosterGroups(
  template: MainMonsterTemplate,
  library: readonly MainMonsterTemplate[],
): SummonRosterBuild {
  const groups: SummonRosterGroup[] = [];
  const assumptions: SummonAssumption[] = [];
  const context = summonerContextFor(template);

  const rows: Array<{ name?: string; summon?: SummonSpec }> = [
    ...((template.actions ?? []) as Array<{ name?: string; summon?: SummonSpec }>),
    ...((template.reactions ?? []) as Array<{ name?: string; summon?: SummonSpec }>),
  ];

  for (const row of rows) {
    if (!row.summon) continue;
    const source = row.name ?? "an action";
    const made = materializeSummon(row.summon, context, library);
    if (!made?.body) {
      for (const problem of made?.problems ?? []) {
        assumptions.push({ creature: template.name, flag: "NEEDS DM INPUT", field: "summon", detail: `"${source}": ${problem}` });
      }
      assumptions.push({
        creature: template.name, flag: "NEEDS DM INPUT", field: "summon",
        detail: `"${source}" summons "${row.summon.name ?? row.summon.templateId ?? "an unnamed body"}", `
          + `and nothing resolves it to a creature. Give it a templateId that exists, or an inline block.`,
      });
      continue;
    }
    /**
     * ⚠ A PROBLEM IS REPORTED, NOT SWALLOWED. `materializeSummon` returns the body AND what it
     * could not resolve — an unresolved `@HITDIEMAX` on a monster, a missing slot level. The body
     * is still priced, because a steed with an unknown modifier is closer to the truth than no
     * steed, but the checker has to say which numbers it could not read.
     */
    for (const problem of made.problems) {
      assumptions.push({ creature: template.name, flag: "NEEDS DM INPUT", field: "summon", detail: `"${source}": ${problem}` });
    }

    const hp = Number(made.body.stats?.maxHp);
    if (!Number.isFinite(hp) || hp <= 0) {
      assumptions.push({
        creature: template.name, flag: "NEEDS DM INPUT", field: "summon",
        detail: `"${source}" resolves to a body with no readable HP (${JSON.stringify(made.body.stats?.maxHp)}). It is not priced.`,
      });
      continue;
    }

    const duration = row.summon.durationRounds;
    groups.push({
      id: `${template.templateId}:summon:${source}`,
      name: `${made.body.name} (${source})`,
      quantity: Math.max(1, Math.round(made.count)),
      baseHp: hp,
      acMultiplier: 1,
      traitFactors: [],
      // The called body's damage comes from its own template through the normal trace when the DM
      // puts it on the field. Inventing one here would double-count it.
      dpr: { round1: 0, round2: 0, round3: 0, round4Plus: 0 },
      damageUptime: 1,
      arrivesRound: 1,
      ...(duration ? { expiresAfterRound: duration } : {}),
      endsWithGroupId: template.templateId,
    });

    assumptions.push({
      creature: template.name, flag: "ESTIMATED", field: "summon",
      detail: `"${source}" calls ${made.count > 1 ? `${made.count} bodies` : "a body"} of ${made.body.name} `
        + `(${hp} HP each)${duration ? `, lasting ${duration} round(s)` : ""}. Priced from the EARLIEST round it can land `
        + `(round 1) — the DM chooses when to call it, and a fight may never see it.`,
    });
  }

  return { groups, assumptions };
}
