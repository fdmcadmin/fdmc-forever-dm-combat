import type { PartyDamageMix } from "./partyDamageMix";

/**
 * Reading a printed damage expression. The one piece of the old `encounterConstruction.ts`
 * that survived it — everything else in that file was a parallel action-budget model,
 * superseded by `parseCreature` + `actionTrace`.
 */

/** Average of a dice expression's rolled part: "2d10" → 11. */
function diceAverage(count: number, faces: number): number {
  return (count * (faces + 1)) / 2;
}

/**
 * Expected value of a damage string. Handles the shapes the scanner and creature editor
 * actually produce:
 *   "2d10 + 4"                     → 15
 *   "1d8 + 2 slashing + 1d4 cold"  → 9   (every die and flat term counts, types ignored)
 *   "15 (2d10 + 4)"                → 15  (a leading pre-averaged total wins)
 */
export function damageExpressionAverage(expr: string | undefined): number {
  if (!expr) return 0;
  const text = expr.trim();
  if (!text) return 0;

  const preAveraged = text.match(/^\s*(\d+)\s*\(/);
  if (preAveraged) return Number.parseInt(preAveraged[1], 10);

  /**
   * ⚠ A BARE NUMBER IS A DAMAGE VALUE. Without this the function read "13.5" as ZERO — it only
   * understood dice and SIGNED flat terms, so an unsigned standalone figure fell through every
   * branch and returned 0.
   *
   * That is not hypothetical: half-on-a-save resolves to exactly this shape. Every "half as much
   * on a success" in the campaign was being computed correctly and then silently discarded here,
   * which is why a save-for-half still priced as all-or-nothing.
   */
  const bare = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (bare) return Number.parseFloat(bare[1]);

  let total = 0;
  for (const m of text.matchAll(/([+-]?)\s*(\d*)d(\d+)/gi)) {
    const sign = m[1] === "-" ? -1 : 1;
    const count = m[2] === "" ? 1 : Number.parseInt(m[2], 10);
    const faces = Number.parseInt(m[3], 10);
    if (Number.isFinite(count) && Number.isFinite(faces) && faces > 0) {
      total += sign * diceAverage(count, faces);
    }
  }
  const withoutDice = text.replace(/[+-]?\s*\d*d\d+/gi, " ");
  for (const m of withoutDice.matchAll(/([+-])\s*(\d+)/g)) {
    total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
  }
  /**
   * ⚠ A FLAT DAMAGE WITH ITS TYPE WRITTEN AFTER IT — "4 bludgeoning" — WAS READING AS ZERO.
   *
   * The bare-number branch above requires the WHOLE string to be a number, and the flat-term loop
   * requires a SIGN, so an unsigned leading figure followed by anything at all fell through every
   * branch. Every Unarmed Strike on every character sheet is written exactly this way, so all five
   * of them were worth nothing — which is also every damage line the party damage mix could read.
   *
   * Only consulted when nothing else was found, so no expression that already parses can move:
   * "1d8 + 2 slashing" leads with a die and never reaches here.
   */
  if (total === 0) {
    const leading = text.match(/^\s*(\d+(?:\.\d+)?)(?!\s*d\d)/);
    if (leading) return Number.parseFloat(leading[1]);
  }
  return Math.max(0, total);
}

/**
 * What a creature's attacks are resolving AGAINST — the party's own numbers.
 *
 * ⚠ THIS IS READ FROM THE CURVE, NOT ASKED FOR. An earlier version of this comment said the
 * workbook published the hit/save arithmetic but *"NO party AC or save-bonus table… not in the
 * contract, not in the party curve, not in the campaign profiles"*, and concluded the app must
 * never supply one.
 *
 * That was true of the v6 bundle and is FALSE of v7, which ships `party_defense_curve` — average
 * AC and all six save averages, by level and by mode. See `partyDefenceCurve.ts`, which is the
 * authority. The values here are the fallback for callers with no party profile, and the DM's
 * typed AC/save remains available as an explicit OVERRIDE, because a real table is not the
 * average table.
 */
export type PartyDefence = {
  ac: number;
  saveBonus: number;
  /**
   * How many PCs are in the fight. Used to price an AREA effect with no printed target count —
   * a cone catches a share of the party, and the workbook's four-PC "two-target" benchmark is
   * exactly half of one. Defaults to the workbook's own four-PC baseline.
   */
  partySize?: number;
  /**
   * All six save averages, from v7's `party_defense_curve`. Each feature is priced against the
   * save it actually calls for — the bundle's targeting rule says so outright, and an INT save is
   * a very different proposition from a DEX save at the same DC. `saveBonus` above stays as the
   * single-number fallback for callers that have no party profile.
   */
  saves?: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>;
  /**
   * What this party actually DEALS, by damage type — from `partyDamageMixFromActors`.
   *
   * It rides on the defence bag because a typed resistance is priced against the party the same
   * way an attack is: both are "what is this creature facing". Absent means no actors were
   * readable, and a typed response then prices at nothing and says so, as it always did.
   */
  damageMix?: PartyDamageMix;
};

/**
 * The starting point the input box opens on: a 4-PC party's mid AC and a mid save bonus.
 *
 * Stated as a starting value, never as an authority — the panel prints it as an assumption on
 * every result so it is never mistaken for a workbook figure.
 */
export const DEFAULT_PARTY_DEFENCE: PartyDefence = { ac: 16, saveBonus: 3 };
