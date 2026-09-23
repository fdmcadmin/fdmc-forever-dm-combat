/**
 * FEAT PRICING ERRATA — where the workbook's row disagrees with the printed feat.
 *
 * Christopher, 2026-09-23, quoting the 2024 PHB at Great Weapon Master: *"so the feat is priced
 * wrong in the app and in the workbook pricer."* Asked where the correction should live, he chose an
 * in-app layer, *"but it needs to live in the dnd mod load since this comes from the SRD material"* —
 * which is here, beside the generated table, and never in `core`.
 *
 * ── WHY A LAYER AND NOT AN EDIT ──────────────────────────────────────────────────────────────
 * `featPricing.generated.ts` is generated from `broken_chain_encounter_checker_v12_feat_pricing.xlsx`
 * tab 17 and says "do not hand-edit" for the reason RULE 1A gives: a hand-maintained copy of 117
 * feats drifts from the workbook on the first edit, and a drifted copy is worse than none. This file
 * does not edit it. It is a short, named list of rows the PRINTED FEAT contradicts, applied over the
 * generated one at read time, so a regenerated workbook still wins everywhere an erratum is silent —
 * and the moment the workbook row is fixed, its erratum can be deleted and nothing else changes.
 *
 * ── THE RULE EVERY ROW OBEYS ─────────────────────────────────────────────────────────────────
 * ⚠ **AN ERRATUM CITES THE PRINTED TEXT. NO CITATION, NO ERRATUM** — `check:featerrata` fails a row
 * with an empty `source`, `printed` or `why`, and fails a row whose key names no generated feat.
 * This layer exists to carry what the book says, never to carry a number somebody liked better; the
 * bare coefficients it replaces are exactly the thing it must not become.
 *
 * ⚠ AND AN ERRATUM MAY NOT INVENT AN INPUT. A replacement expression may only use tokens the
 * evaluator already resolves, or ones this app genuinely supplies — see `heavyWeaponEquipped`.
 */
import { type FeatPricing } from "./featPricing.generated";

export type FeatErratum = {
  /** `edition:name`, exactly as the generated table keys it. */
  key: string;
  /** Where the printed text comes from. */
  source: string;
  /** The printed benefit, quoted — what the correction is FROM. */
  printed: string;
  /** What the workbook row does instead, and why that is wrong. */
  why: string;
  /** Replacement expressions. Only the channels named are replaced. */
  dpr?: string;
  personalEhp?: string;
  partyEhp?: string;
  /** Replacement trigger line, when the old one described the wrong cadence. */
  trigger?: string;
  /** Appended to the row's note — what is STILL not priced, named rather than guessed. */
  unpriced?: string;
};

export const FEAT_ERRATA: readonly FeatErratum[] = [
  {
    key: "2024:Great Weapon Master",
    source: "2024 PHB p.204, quoted by Christopher 2026-09-23",
    printed:
      "Heavy Weapon Mastery. When you hit a creature with a weapon that has the Heavy property as part of "
      + "the Attack action on your turn, you can cause the weapon to deal an extra 3 damage to the target. "
      + "Hew. Immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 HP "
      + "with one, you can make one attack with the same weapon as a Bonus Action.",
    why:
      "The workbook prices `PB*onceHit+0.10*hitChance*perHitDamage`. Three faults. (1) `PB` where the "
      + "printed benefit is a flat 3 — identical at levels 5-8 and wrong either side of that. (2) No Heavy "
      + "gate at all, so a character leading with a rapier priced exactly like one leading with a greataxe. "
      + "(3) `0.10*hitChance*perHitDamage` for Hew: a flat tenth of a hit, every turn, unconditionally — not "
      + "crit chance, not kill chance, and blind to Hew spending the Bonus Action.",
    dpr: "heavyWeaponEquipped ? 3*onceHit : 0",
    trigger: "Heavy Weapon Mastery: once per turn, on a hit with a Heavy weapon as part of the Attack action",
    unpriced:
      "Hew is NOT priced. It needs the character's crit margin and whether a creature dropped to this PC "
      + "this turn, and it spends the Bonus Action. Christopher, 2026-09-23: \"the hew effect would be "
      + "counted if the pc has a wider crit margin and even has to determine if a creature went down to said "
      + "PC(also partially the AI Tactical).\" Named here rather than approximated.",
  },
  {
    key: "2014:Great Weapon Master",
    source: "2014 PHB p.167; the same defect Christopher found in the 2024 row",
    printed:
      "On your turn, when you score a critical hit with a melee weapon or reduce a creature to 0 hit points "
      + "with one, you can make one melee weapon attack as a bonus action.",
    why:
      "The power-attack half is a real expected-value calculation and is kept verbatim. The trailing "
      + "`+0.12*hitChance*perHitDamage` is the same fudge as the 2024 row's 0.10 — the crit-or-kill bonus "
      + "attack paid out every turn regardless of whether either trigger happened.",
    dpr: "attacks*max(0,hit(attackBonus-5,targetAC)*(perHitDamage+10)-hit(attackBonus,targetAC)*perHitDamage)",
    unpriced:
      "The crit-or-kill bonus attack is NOT priced, for the same reason as the 2024 row's Hew: no crit "
      + "margin, no kill attribution, and it spends the Bonus Action.",
  },
  {
    key: "2024:Spell Sniper",
    source: "Christopher, 2026-09-23, on what the feat does",
    printed:
      "\"the spell sniper is simply removing disadvantage to melee spell casting and ignoring AC based on "
      + "cover, so it shouldnt need a DM input\"",
    why:
      "The workbook prices `spellAttackDpr*0.025*coverOrRangeExposure` — two inputs nobody supplies, so the "
      + "feat reported NEEDS_INPUT forever. He is right that it should not ask. Both benefits REMOVE a "
      + "penalty, and this checker applies neither: it has no terrain, so it never adds cover to a target's "
      + "AC, and it never gives a caster disadvantage for a hostile being adjacent. A benefit that removes "
      + "something the simulation does not apply is worth zero IN THIS SIMULATION — which is an answer, not "
      + "a missing input, and it is the distinction `priceFeat` already draws for an inert feat.",
    dpr: "0",
    trigger: "Removes cover AC and melee-range disadvantage from spell attacks; this checker models neither",
    unpriced:
      "⚠ WORTH REAL DAMAGE AT THE TABLE, and zero only because the checker has no cover and no adjacency "
      + "disadvantage. If either is ever modelled, this erratum must be revisited rather than left at 0.",
  },
  {
    key: "2014:Spell Sniper",
    source: "Christopher, 2026-09-23 — the same reading as the 2024 row",
    printed:
      "\"the spell sniper is simply removing disadvantage to melee spell casting and ignoring AC based on "
      + "cover, so it shouldnt need a DM input\"",
    why:
      "Same expression, same two unsupplied inputs. The 2014 feat also doubles a spell attack's range, which "
      + "this checker does not model either — it has no distances.",
    dpr: "0",
    trigger: "Ignores half and three-quarters cover on spell attacks; this checker models no cover",
    unpriced:
      "Zero only because the checker has no cover and no ranges. Revisit if either is modelled.",
  },
];

export const ERRATA_BY_KEY = new Map(FEAT_ERRATA.map(e => [e.key.toLowerCase(), e]));

/**
 * The generated row with its erratum applied, or the generated row untouched.
 *
 * ⚠ THE NOTE CARRIES THE CORRECTION WITH IT. A number that changed without saying why is the thing
 * this layer is supposed to prevent, so the row that comes back states its source and what is still
 * unpriced — the panel and the gates read `note`, so the correction travels with the price.
 */
export function withErrata(row: FeatPricing | undefined): FeatPricing | undefined {
  if (!row) return row;
  const e = ERRATA_BY_KEY.get(row.key.toLowerCase());
  if (!e) return row;
  return {
    ...row,
    ...(e.dpr !== undefined ? { dpr: e.dpr } : {}),
    ...(e.personalEhp !== undefined ? { personalEhp: e.personalEhp } : {}),
    ...(e.partyEhp !== undefined ? { partyEhp: e.partyEhp } : {}),
    ...(e.trigger !== undefined ? { trigger: e.trigger } : {}),
    note: [row.note, `ERRATUM (${e.source}): ${e.why}`, e.unpriced ? `STILL UNPRICED: ${e.unpriced}` : ""]
      .filter(Boolean).join(" — "),
  };
}

