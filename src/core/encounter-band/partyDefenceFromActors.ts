/**
 * THE PARTY'S DEFENCE, READ FROM THE ACTORS THEMSELVES.
 *
 * Christopher, 2026-09-02: *"there should be a update to the standard on the dex line as well as
 * how ac for the party was obtained."*
 *
 * ─── WHAT THE CURVE IS, AND WHAT IT IS NOT ──────────────────────────────────────────────────
 *
 * `partyDefenceCurve` publishes an AVERAGE AC and six average save bonuses per level. The
 * workbook's own `Party Defense Reach` sheet labels every one of those rows
 * `PROVISIONAL STANDARD-PROGRESSION PROXY` — it is a stand-in for a party nobody has met. Its
 * companion sheet, `Party Progression Runtime`, says what should replace it:
 *
 *     Defense — Expose AC and armor source per PC. **Per-PC, not party-average AC.**
 *     AC — Use explicit campaign armor AC when equipped; otherwise class-equipment fallback.
 *
 * We are not an abstract party. The actors are right there, and `deriveActorStats` already
 * resolves each one's real AC — armour string, DEX cap, shield, and every equipped stat effect.
 * That number has existed for as long as the character cards have; the checker simply never
 * asked for it and priced every attack against a proxy instead.
 *
 * ─── ⚠ THE DEX LINE IS THE ONE THAT WAS COSTING US ──────────────────────────────────────────
 *
 * The panel's single "PARTY SAVE" figure is the SIX-WAY MEAN of the curve row. At level 4 the
 * Broken Chain saves are STR 2.08 / DEX 2.38 / CON 2.45 / INT 1.57 / WIS 2.17 / CHA 1.68, whose
 * mean is 2.055 — the 2.06 the panel shows. So every Dexterity save in the campaign was being
 * resolved 0.32 too low and every Intelligence save 0.49 too high. DEX is the most common damage
 * save in the game: breath weapons, fireballs, every area burst the Act 3 gates open with.
 *
 * `saveBonusFor` has always known better — it takes an ability and returns that column. It had
 * no callers. `featureResolver` reads `target.saves[ability]` when the feature named one, so the
 * six-way path is real; it is the FALLBACK that flattens, and the fallback is what an unparsed
 * save lands on.
 *
 * ⚠ AND DEX IS ALSO INITIATIVE. `getActorInitiativeModifier` is the live combat tracker's own
 * derivation — DEX modifier plus every entered `initiativeBonus` (Alert and friends). The
 * checker needs exactly that number to place a party body among the hostile ones, so it reads
 * the same function rather than deriving a second opinion of it.
 *
 * ⚠ NOTHING HERE IS SILENT. Every PC reports the AC it contributed and where that AC came from,
 * the same contract `partyHealingFromActors` holds: a DM who disagrees can see which character
 * to argue with.
 */

import type { Actor } from "../types/actor";
import type { SaveAbility } from "./partyDefenceCurve";
import { deriveActorStats } from "../state/deriveActorStats";
import { getActorInitiativeModifier } from "../state/initiative";
import { savingThrowModifier } from "../rules/dnd5e";

export const SAVE_ABILITIES: readonly SaveAbility[] = ["str", "dex", "con", "int", "wis", "cha"];

export type PcDefence = {
  actor: string;
  ac: number;
  /** Which items moved the AC off its base, so the number is auditable. */
  acSource: string;
  saves: Record<SaveAbility, number>;
  /** Abilities this PC is proficient in — the reason a save sits above its modifier. */
  proficientSaves: SaveAbility[];
  /** DEX modifier plus entered initiative bonuses. */
  initiative: number;
};

export type PartyDefenceFromActors = {
  perPc: PcDefence[];
  /** Mean AC across the chosen party — what an untargeted attack resolves against. */
  ac: number;
  /** Mean bonus PER ABILITY. Six numbers, never one. */
  saves: Record<SaveAbility, number>;
  /** Mean initiative modifier — the party's place in the body order. */
  initiative: number;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Read a party's real defence off the chosen actors.
 *
 * Returns null for an empty party, which is the honest answer — the caller falls back to the
 * published curve and says so. A partially chosen party is not answered either: averaging two of
 * four PCs would produce a confident number for a party that does not exist.
 */
export function partyDefenceFromActors(actors: readonly Actor[]): PartyDefenceFromActors | null {
  if (!actors.length) return null;

  const perPc: PcDefence[] = actors.map(actor => {
    const stats = deriveActorStats(actor);
    const scores = actor.abilityScores ?? {};
    const saves = {} as Record<SaveAbility, number>;
    const proficientSaves: SaveAbility[] = [];

    for (const ability of SAVE_ABILITIES) {
      const entry = scores[ability];
      saves[ability] = savingThrowModifier({
        modifier: stats[ability].modifier,
        saveProficient: entry?.saveProficient,
        explicit: entry?.save,
        level: actor.level,
      });
      if (entry?.saveProficient) proficientSaves.push(ability);
    }

    return {
      actor: actor.name,
      ac: stats.ac,
      acSource: stats.acModifiedBy.length ? stats.acModifiedBy.join(" · ") : "base + armour",
      saves,
      proficientSaves,
      initiative: getActorInitiativeModifier(actor),
    };
  });

  const saves = {} as Record<SaveAbility, number>;
  for (const ability of SAVE_ABILITIES) saves[ability] = mean(perPc.map(p => p.saves[ability]));

  return {
    perPc,
    ac: mean(perPc.map(p => p.ac)),
    saves,
    initiative: mean(perPc.map(p => p.initiative)),
  };
}
