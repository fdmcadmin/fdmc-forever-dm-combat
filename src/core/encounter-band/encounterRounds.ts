/**
 * encounterRounds.ts — predicted ROUNDS-TO-KILL for an encounter.
 *
 * WHY THIS EXISTS: the old `encounterDifficulty.ts` (deleted 2026-07-31) reported
 * `threat 360 vs budget 288 = 1.25×`.
 * Those units are invented — nothing at the table is 288 of anything, so the DM cannot
 * check the claim against reality. It rated 2× Lesser Wendigo at low as "Hard" for a
 * party of 4; the fight ran 3.5–4.5 rounds and nobody went down.
 *
 * Rounds-to-kill is falsifiable: the panel predicts a number, the DM counts rounds at
 * the table, and a mismatch means the model is wrong. That feedback loop is the point.
 *
 *   rounds = Σ(rawHP × kitMultiplier × count) ÷ (dpr4P × size/4 × lane × rest × REALIZATION)
 *
 * SOURCE OF TRUTH (2026-08-14): party DPR comes from **`dprBaseline.PARTY_BASELINE`** — the
 * checker workbook, 150,000+ runs. This module no longer carries a DPR table of its own; the
 * v12 curve it used to hold was ~30% high at L3 and disagreed with the lethality checker on
 * every level. Round pacing and lethality now read the same numbers by construction.
 *
 * The ROUND BANDS below are still the v12 rerun's, and they were calibrated against the v12
 * DPR — see the warning on `ROUND_BAND`.
 *
 * BASELINE IS A **4-PLAYER** PARTY. The supported spread is 3 / 4 / 5, so the `low` /
 * `standard` / `high` HP variants mean 3P / 4P / 5P and an encounter's authored HP is its
 * 4-player total. (Previously 4/5/6, which was one player too generous.)
 *
 * The predicted number is judged against a TARGET BAND chosen by the encounter's
 * classification (see `ROUND_BAND`) — a normal fight and an act boss are not held to the
 * same window.
 *
 * ⚠ THIS IS A **PACING CHECK, NOT THE DIFFICULTY CALCULATION.** D&D balances encounters via
 * the Low/Moderate/High XP budget per character. A fight can pass pacing and still be
 * officially over-budget (the Wendigo Wight paces as an act boss while its CR 12 is "Above
 * High" for five level-5 characters). Read the two side by side; neither replaces the other.
 */

// Type-only: erased at compile, so this module stays dependency-free for the test harness.
import type { MonsterClassification } from "../monsters/runtime/mainMonsterRuntime";
// The ONE party-DPR curve. Pure data with no imports of its own, so the harness stays clean.
import { PARTY_BASELINE } from "./dprBaseline";

/**
 * **4-player** expected DPR by ACTUAL PARTY LEVEL — now read straight from `dprBaseline`.
 *
 * ⚠ SINGLE SOURCE OF TRUTH (Christopher, 2026-08-14). This module used to carry its OWN DPR
 * table, transcribed from `Broken_Chain_v12_Full_DPR_and_Encounter_Rerun.xlsx`. When the
 * checker workbook was transcribed into `dprBaseline.ts` the app ended up holding **two**
 * party-DPR curves that disagreed by ~30% at L3 (55.33 vs 38.79) and ~7% at L9 — the pacing
 * panel reading one, the lethality checker the other. His call: *"the dpr that matched the
 * workbook model we just input would be the right one — why would we add in the entire
 * workbook and say nah we don't need it."*
 *
 * So the v12 numbers are GONE, not commented out. There is one curve. If it is wrong, it is
 * wrong in the workbook, and it gets fixed by re-transcribing `dprBaseline.ts`.
 *
 * The checker baseline is the STRICTLY BETTER model: it layers generic +1 armour coverage,
 * Tier 3 weapon power at the level the party actually receives it, and a mixed generic
 * Convergence spread onto the same population. The old curve had none of those, which is
 * most of why it read high.
 *
 * WHAT SURVIVED THE SWAP, and why it still holds:
 * - **The 4-player baseline.** Both models publish at 4P, so `low`/`standard`/`high` still
 *   mean 3P/4P/5P and an encounter's authored HP is still its 4-player total.
 * - **`REALIZATION = 1.0`.** The checker's DPR is hit/save-adjusted, same as v12, so a
 *   dice-EV discount on top would still double-count.
 * - **`acFactor` as a substitution.** Both models resolve against the SAME target AC per
 *   level — `BASELINE_TARGET_AC` here and `EXPECTED_MONSTER_AC` in `dprBaseline` agree on
 *   every level they share (3–9: 14/15/16/16/16/17/17). That agreement is what makes the
 *   re-resolution valid against the new curve without re-deriving it.
 *
 * ⚠ ONE TERM IS NOW UNVERIFIED: `PARTY_ATTACK_SHARE = 0.82` was back-solved from a pair of
 * v12 figures that no longer exist here. It is a property of the roster mix rather than of
 * either workbook, so it is kept — but it can no longer be re-checked against its own source.
 * See the note on that constant.
 *
 * ⚠ NO "+1 PSEUDO LEVEL" — feed this the party's ACTUAL level; the stage mapping
 * (Realized L3–5, Metamorphosis L6–8, Tempered L9–12) is already baked in.
 */
const MIDPOINT_DPR_4P: ReadonlyArray<readonly [level: number, dpr: number]> =
  PARTY_BASELINE.map(b => [b.level, b.dpr] as const);

/**
 * Dice-EV → real-table discount. **Now 1.0 — deliberately inert.**
 *
 * The old 0.77 existed because the previous workbook was raw dice EV with no hit chance. The
 * v12 model's Expected DPR is already **hit/save-adjusted** against the per-level target AC
 * (L5 15 · L6 16 · L9 17 · L12 18), so applying 0.77 on top would double-discount every
 * encounter by ~23%. Kept as a named constant rather than deleted so the term stays visible
 * in the formula and can be re-armed if a future model reverts to raw EV.
 *
 * ⚠ THE CURRENT TABLE IS NOT THE BENCHMARK. Do not calibrate this — or any kitMultiplier —
 * from the live party's fights. The v12 rerun puts them at the ~10th percentile
 * ("lower-output, survival-forward", 109.15 vs a 141.14 five-player median), and their
 * earlier fights carried two confounders pulling opposite ways (a bond mix built around a
 * departed 6th player vs a deliberately sub-optimised tank). Author against Balance Center.
 */
export const REALIZATION = 1.0;

/**
 * The party size the campaign is AUTHORED against. `low`/`standard`/`high` HP variants mean
 * 3P / **4P** / 5P, so an encounter's authored (standard) HP is its 4-player total and the
 * 0.75/1.25 variants produce the 3P and 5P bands.
 */
export const BASELINE_PARTY_SIZE = 4;

/** The party sizes the model supports, low → high. */
export const SUPPORTED_PARTY_SIZES = [3, 4, 5] as const;

/**
 * Lever 1 of ENCOUNTER-BALANCE-RULES: the party-size HP band.
 *
 * Scales an encounter's AUTHORED (4-player) HP to the size actually fighting it. This is the
 * ONLY thing that may change about a locked encounter — a creature's kit and authored
 * `stats.maxHp` are written once, for what the creature IS.
 *
 * It is a property of the ENCOUNTER, not of each creature: the multiplier is uniform, so
 * scaling every body by it is arithmetically identical to scaling the total, but authoring
 * it per-creature allowed incoherent fights (a boss at 5P sitting next to its adds at 3P).
 * One fight, one party, one band.
 *
 * Deliberately keyed off the same party size that drives `partyDpr`, so the offensive and
 * defensive sides of the estimate can never be told two different party sizes — which they
 * could when HP scaled off a separate per-creature `hpVariant` dial.
 */
export const PARTY_SIZE_HP_MULTIPLIER: Record<number, number> = { 3: 0.75, 4: 1.0, 5: 1.25 };

/**
 * An encounter's authored 4P HP scaled to the party actually fighting it.
 *
 * ROUNDS, not floors. The old per-creature scaler floored, which read one HP light against
 * the v12 workbook's own published bands — Pale Drifter + Frozen Cloak is 166 at 3P, and
 * floor(221 × 0.75) = 165. Rounding reproduces every band in the rerun exactly
 * (129/172/215, 166/221/276, 180/240/300, and the Wight's 216/288/360).
 */
export function hpForPartySize(baseHp: number, partySize: number): number {
  const mult = PARTY_SIZE_HP_MULTIPLIER[partySize] ?? 1;
  if (mult === 1) return baseHp;
  return Math.max(1, Math.round(baseHp * mult));
}

/** Party bond posture. Multiplier = that party's DPR ÷ midpoint DPR. */
export type PartyLane = "easy" | "standard" | "hard" | "punishing";

/**
 * Measured, not guessed: the selected party snapshot runs 132.6 vs midpoint 112.2 at L6
 * = 1.18×, which is the "punishing" anchor. A 4-player punishing party (0.8 × 1.18 ≈ 0.95)
 * therefore fights like a 5-player standard one — which is exactly why "2 Lessers at low"
 * felt easy while the checker called it Hard.
 *
 * ⚠ WHICH LANE TO ACTUALLY USE (Christopher, 2026-07-17):
 * The party is **"standard · mixed" for the whole of Act 2**. The lanes only diverge once
 * the party picks its SPECIALIZATIONS at the end of Act 2 — the 1.18 "punishing" anchor is
 * a POST-specialization measurement and must NOT be used to size Act 2. Sizing Act 2 at
 * 1.18 makes every fight read ~18% shorter than it plays; the real fights confirm standard
 * (Last Directive predicted 2.8 at 1.0× and ran 3.5+ — at 1.18× it would have predicted
 * 2.4, i.e. further from the truth, not closer).
 */
export const LANE_MULTIPLIER: Record<PartyLane, number> = {
  easy: 0.87,        // defensive bonds
  standard: 1.0,     // mixed — the midpoint itself
  hard: 1.14,        // offensive, retains some defence
  punishing: 1.18,   // damage on the mind; every choice-bond in the offence lane
};

export const LANE_LABEL: Record<PartyLane, string> = {
  easy: "Easy · defensive",
  standard: "Standard · mixed",
  hard: "Hard · offensive",
  punishing: "Punishing · all damage",
};

/**
 * TARGET FIGHT LENGTH per classification, in rounds.
 *
 * REVISED 2026-07-21 from the v12 rerun's "Round-Pacing Bands" table
 * (`Broken_Chain_v12_Full_DPR_and_Encounter_Rerun.xlsx` → **Last 3 Rerun**, 100,000 trials
 * per lane). Changes from the 2026-07-17 set: normal 2–2.5 → **2–3**, strong 2.25–3.5 →
 * **2.5–3.5**, elite 3.25–4.5 → **3–4.5**, final-boss 6–8 → **6–7.5 with 8 a hard cap**.
 * mid-boss and act-boss are unchanged.
 *
 * ⚠ PACING CHECK, NOT THE DIFFICULTY CALCULATION. D&D balances encounters through the
 * Low/Moderate/High **XP budget per character**, not round counts. This table says whether a
 * fight PACES right; it does not say whether it is officially survivable. The two are
 * independent and neither replaces the other — the Wendigo Wight passes act-boss pacing
 * while its projected CR 12 is officially "Above High" for five level-5 characters.
 *
 * The band IS the wiggle room: anywhere inside it is "On target". Below min the party walked
 * through it; above max it is turning into a slog. There is no single 3-round floor — a
 * `normal` fight is *supposed* to end in 2–3.
 *
 * Data, not code — on purpose. These are the targets every encounter is judged against, so
 * they must be correctable from real fights rather than buried in a threshold chain (the
 * mistake `BOSS_MULT` made).
 *
 * ⚠ THESE BANDS ARE STILL v12 AND THE DPR UNDER THEM IS NOT (2026-08-14). Party DPR now comes
 * from the checker workbook, which is materially lower — so the same authored HP produces a
 * LONGER predicted fight than it did yesterday. That is the model getting more honest, not the
 * encounters getting worse, but it means a fight can now read "Long" purely because the curve
 * moved. Two ways to reconcile, and it is Christopher's call which:
 *   (a) leave the bands and re-tune encounter HP down to hit them, or
 *   (b) re-derive the bands from the checker workbook, if it publishes pacing targets.
 * Until then, read a band miss as "check this fight", not as "this fight is broken".
 */
export const ROUND_BAND: Record<MonsterClassification, { min: number; max: number }> = {
  normal: { min: 2, max: 3 },
  strong: { min: 2.5, max: 3.5 },
  elite: { min: 3, max: 4.5 },
  "mid-boss": { min: 4, max: 5.5 },
  "act-boss": { min: 5, max: 6.5 },
  "final-boss": { min: 6, max: 7.5 },
};

/**
 * Rounds a result may sit below a band's `min` and still PASS (v12 "Floor tolerance" = 0.1).
 * A 2.92-round elite result is treated as functionally 3 rounds rather than a miss.
 */
export const BAND_FLOOR_TOLERANCE = 0.1;

/**
 * Hard ceiling on fight length, in rounds — no encounter should ever be authored past this,
 * including a final boss (v12: "6–7.5; 8 is a hard cap").
 */
export const ABSOLUTE_ROUND_CAP = 8;

export const CLASSIFICATION_LABEL: Record<MonsterClassification, string> = {
  normal: "Normal",
  strong: "Strong",
  elite: "Elite",
  "mid-boss": "Mid boss",
  "act-boss": "Act boss",
  "final-boss": "Final boss",
};

/** Weakest → strongest. The encounter's band comes from the strongest creature in it. */
export const CLASSIFICATION_ORDER: readonly MonsterClassification[] = [
  "normal",
  "strong",
  "elite",
  "mid-boss",
  "act-boss",
  "final-boss",
];

/**
 * A fight is judged by its BIGGEST threat: a mid-boss escorted by chaff is a mid-boss
 * fight (4-5.5), not an average of the two. Chaff still adds HP, so it pushes the
 * estimate up inside that band rather than changing which band applies.
 */
/**
 * The higher of two tiers. Used so a declared encounter tier can only ESCALATE the fight's
 * band above what its roster already justifies, never soften it — the balance rules allow
 * escalation levers only.
 */
export function maxClassification(
  a: MonsterClassification | undefined,
  b: MonsterClassification,
): MonsterClassification {
  if (!a) return b;
  const ia = CLASSIFICATION_ORDER.indexOf(a);
  const ib = CLASSIFICATION_ORDER.indexOf(b);
  return ia >= ib ? a : b;
}

export function encounterClassification(monsters: RoundsMonster[]): MonsterClassification {
  let top = 0;
  for (const m of monsters) {
    if (m.count <= 0) continue;
    const idx = CLASSIFICATION_ORDER.indexOf(m.classification ?? "normal");
    if (idx > top) top = idx;
  }
  return CLASSIFICATION_ORDER[top]!;
}

// ─── The two defensive axes, kept separate ────────────────────────────────────
//
// The v12 workbook models `rounds = effectiveHP ÷ AC-adjusted DPR` — AC is a penalty on the
// PARTY'S OUTPUT, while traits are an uplift on the CREATURE'S HP. The old single
// `kitMultiplier` collapsed both into one opaque number, so you could never tell whether a
// creature was hard to kill because it was hard to HIT or because it had more effective HP.
// Splitting them makes each term mean exactly one thing — and makes the defensive side a
// real, itemised check instead of a guess.

/**
 * The AC the party's DPR is calibrated against, per level (v12 Assumptions: L5 15 · L6 16 ·
 * L9 17 · L12 18). A creature AT this AC is exactly "average to hit" and scores acFactor 1.0.
 */
const BASELINE_TARGET_AC: ReadonlyArray<readonly [level: number, ac: number]> = [
  // Monster Builder workbook → Model Inputs → Target AC. Every level is authored.
  [3, 14], [4, 15], [5, 16], [6, 16], [7, 16], [8, 17], [9, 17], [10, 18], [11, 18], [12, 18],
];

/** Party attack bonus by level — Model Inputs → Martial +hit. */
const PARTY_ATTACK_BONUS: ReadonlyArray<readonly [level: number, bonus: number]> = [
  [3, 6], [4, 7], [5, 8], [6, 8], [7, 8], [8, 9], [9, 10], [10, 10], [11, 10], [12, 10],
];

/**
 * The share of party damage that is delivered by ATTACK ROLLS, and therefore the only share a
 * creature's AC can touch. Save-half, save-none and automatic damage are unaffected by armour.
 *
 * 0.82 is back-solved from the workbook's own pair of published L5 figures: the generic
 * balanced center 84.844 (resolved vs the level's AC 16) and the same party re-resolved
 * against the Wendigo Wight's AC 17, 79.493. One point of AC moves a martial attack from a
 * 65% to a 60% hit rate — a 7.69% cut to attack-roll damage — yet total party DPR falls only
 * 6.31%, and 6.31 / 7.69 = 0.82.
 *
 * ⚠ This is a property of the BALANCED-CENTER roster mix, not a universal constant. Model
 * Inputs → Class Resolution carries per-class attack shares that run from 0.10 (Wizard) to
 * 1.00 (Fighter); a caster-heavy table sits well below 0.82 and a martial one approaches 1.0.
 * It is the right number for authoring against the publishing center, which is what this model
 * is for.
 *
 * ⚠ NO LONGER RE-DERIVABLE (2026-08-14). The pair it was back-solved from lived in the v12
 * workbook, which is no longer in this file. Kept because it describes the ROSTER MIX rather
 * than either workbook, and the roster population did not change — the checker layers gear
 * onto the same shells. If the checker workbook ever publishes its own AC-re-resolved pair,
 * re-solve this from that and delete this warning.
 */
export const PARTY_ATTACK_SHARE = 0.82;

function lerpTable(table: ReadonlyArray<readonly [number, number]>, level: number): number {
  const lv = Math.max(1, Math.min(20, Math.floor(level || 1)));
  if (lv <= table[0][0]) return table[0][1];
  if (lv >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [l0, v0] = table[i];
    const [l1, v1] = table[i + 1];
    if (lv >= l0 && lv <= l1) return l1 === l0 ? v0 : v0 + ((v1 - v0) * (lv - l0)) / (l1 - l0);
  }
  return table[table.length - 1][1];
}

/** Chance a level-appropriate attack lands against `ac`, clamped to the nat-1/nat-20 band. */
export function hitChance(ac: number, level: number): number {
  const need = ac - lerpTable(PARTY_ATTACK_BONUS, level);
  return Math.max(0.05, Math.min(0.95, (21 - need) / 20));
}

/**
 * RE-RESOLVE the published party DPR against a creature whose AC differs from the level
 * baseline. Multiply the balanced-center figure by this.
 *
 * ⚠ This is a SUBSTITUTION, not a penalty stacked on top. The DPR curve is already
 * target-resolved against the level's baseline AC, so `hitChance(ac) / hitChance(baseline)`
 * — the old implementation — asked the party to roll to hit twice. It was wrong twice over:
 * it double-counted, AND it applied the full attack-roll penalty to save-based and automatic
 * damage that armour cannot affect at all. At L5 vs AC 17 it returned 0.846 where the real
 * answer is 0.937, reading party damage ~10% low and every armoured fight correspondingly
 * long.
 *
 * Only the attack-roll share moves:
 *
 *   factor = 1 − attackShare × (1 − hit(creatureAC) / hit(baselineAC))
 *
 * At the baseline AC this is exactly 1.0, so an average-armoured creature uses the published
 * number untouched. It reproduces the workbook's own re-resolved pair to five decimals:
 * 84.844 × 0.936923 = 79.4927 against a published 79.492684475.
 *
 * Still deliberately NOT part of the defensive (EHP) number — armour is a tax on the party's
 * output, a second life is a bigger HP bar, and they must never share a dial.
 */
export function acFactor(ac: number, level: number): number {
  const baseline = hitChance(lerpTable(BASELINE_TARGET_AC, level), level);
  if (baseline <= 0) return 1;
  return 1 - PARTY_ATTACK_SHARE * (1 - hitChance(ac, level) / baseline);
}

/**
 * One named defensive trait and what it is worth as an effective-HP multiplier.
 *
 * ITEMISED ON PURPOSE. "Reknit in the Cold returns it at 40% once" is checkable at the table;
 * a bare 1.84 is not. Multipliers compose (they multiply), so a creature with a 40% revival
 * and a 10% resistance uplift is 1.40 × 1.10 = 1.54.
 */
export type MonsterDefense = {
  /** The trait's actual name, as printed on the stat block. */
  name: string;
  /** Effective-HP multiplier. 1.40 = "this trait is worth 40% more HP". */
  ehpMultiplier: number;
  /** Why it is worth that — the arithmetic, so a future session can re-check it. */
  note?: string;
};

/** Product of a creature's defensive traits. No traits = 1.0 (a plain HP bar). */
export function defensiveMultiplier(defenses: readonly MonsterDefense[] | undefined): number {
  if (!defenses || defenses.length === 0) return 1;
  return defenses.reduce((acc, d) => acc * (d.ehpMultiplier || 1), 1);
}

export type RoundsMonster = {
  id: string;
  name: string;
  /** HP after the party-size band is applied. */
  maxHp: number;
  count: number;
  /** Threat tier — sets the target band for the fight. Unset = "normal". */
  classification?: MonsterClassification;
  /** Armour Class — drives the OFFENSIVE side (how much party damage actually lands). */
  ac?: number;
  /** Itemised defensive traits — drives the EFFECTIVE-HP side. */
  defenses?: readonly MonsterDefense[];
  /**
   * Share of its turns the party actually spends attacking THIS creature. A tempo tax:
   * auras that force spacing, leaps that reset position, forced movement. It reduces damage
   * DELIVERED and is applied to party DPR — it is NOT resistance and must never be folded
   * into effective HP, which would charge the party for it twice.
   * Unset = 1.0 (the party attacks freely).
   */
  damageUptime?: number;
  /**
   * @deprecated Legacy single-number kit estimate that conflated AC with defensive traits.
   * Still honoured for creatures not yet migrated to `ac` + `defenses`, so nothing silently
   * reads 1.0 mid-migration. Prefer the two split terms.
   */
  kitMultiplier?: number;
};

/** Linear interpolation across the chart's level checkpoints. */
export function midpointDprForLevel(level: number): number {
  const lv = Math.max(1, Math.min(20, Math.floor(level || 1)));
  const pts = MIDPOINT_DPR_4P;
  if (lv <= pts[0][0]) return pts[0][1];
  if (lv >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [l0, d0] = pts[i];
    const [l1, d1] = pts[i + 1];
    if (lv >= l0 && lv <= l1) {
      if (l1 === l0) return d0;
      return d0 + ((d1 - d0) * (lv - l0)) / (l1 - l0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Effective party DPR — what the table actually puts out per round. */
export function partyDpr(
  size: number,
  level: number,
  lane: PartyLane = "standard",
  resources: PartyResources = "fresh",
): number {
  // Baseline is a FOUR-player party (3/4/5 spread), so scale off 4, not 5.
  const s = Math.max(1, Math.floor(size || BASELINE_PARTY_SIZE));
  return midpointDprForLevel(level)
    * (s / BASELINE_PARTY_SIZE)
    * LANE_MULTIPLIER[lane]
    * RESOURCE_MULTIPLIER[resources]
    * REALIZATION;
}

/**
 * The DEFENSIVE check, on its own: how much effective HP the party must actually chew
 * through, from itemised traits only. AC is deliberately absent — it belongs to the party's
 * damage, not the creature's HP.
 *
 * A creature still carrying only a legacy `kitMultiplier` falls back to it so nothing reads
 * 1.0 mid-migration; once it declares `defenses`, those win.
 */
export function effectiveHp(monsters: RoundsMonster[]): number {
  return monsters.reduce((sum, m) => {
    const mult = m.defenses?.length ? defensiveMultiplier(m.defenses) : (m.kitMultiplier || 1);
    return sum + m.maxHp * mult * Math.max(0, m.count);
  }, 0);
}

/**
 * The OFFENSIVE-side adjustment: the HP-weighted average `acFactor` across the fight, i.e.
 * how much of the party's damage actually lands. Weighting by effective HP (not by body
 * count) is what makes a 288-HP AC-17 boss escorted by two AC-13 chaff read as a hard-to-hit
 * fight rather than an average-AC one.
 */
export function encounterAcFactor(monsters: RoundsMonster[], level: number): number {
  let weighted = 0;
  let total = 0;
  for (const m of monsters) {
    const n = Math.max(0, m.count);
    if (n <= 0) continue;
    const mult = m.defenses?.length ? defensiveMultiplier(m.defenses) : (m.kitMultiplier || 1);
    const w = m.maxHp * mult * n;
    total += w;
    weighted += w * (m.ac === undefined ? 1 : acFactor(m.ac, level));
  }
  return total > 0 ? weighted / total : 1;
}

export type RoundsEstimate = {
  rawHp: number;
  effectiveHp: number;
  dpr: number;
  /** Party DPR AFTER the encounter's AC adjustment — the damage that actually lands. */
  landedDpr: number;
  /** HP-weighted AC adjustment. <1 = harder to hit than a level-appropriate target. */
  acFactor: number;
  rounds: number;
  /** The tier this fight is judged as — the strongest creature in it. */
  classification: MonsterClassification;
  /** The target band for that tier. Inside it = On target. */
  band: { min: number; max: number };
  /** How the fight reads against its own band. */
  verdict: "Throwaway" | "Short" | "On target" | "Long" | "Slog";
};

/**
 * Judge a predicted round count against its tier's band.
 *
 * Inside the band = On target — the band already carries the wiggle room, so nothing is
 * added on top. Outside it, the margins scale with the band so the wording means the same
 * thing at every tier: a normal fight (2-2.5) is a Slog past ~3.1, an act boss (5-6.5)
 * past ~8.1.
 */
export function verdictForRounds(
  rounds: number,
  classification: MonsterClassification = "normal",
): RoundsEstimate["verdict"] {
  const band = ROUND_BAND[classification] ?? ROUND_BAND.normal;
  // Floor tolerance (v12): a result up to 0.1 rounds under the band still PASSES — the
  // rerun treats the Frozen Sentinels' 2.92 as functionally a 3-round elite result.
  if (rounds < band.min * 0.75) return "Throwaway";
  if (rounds < band.min - BAND_FLOOR_TOLERANCE) return "Short";
  if (rounds <= band.max) return "On target";
  if (rounds <= band.max * 1.25) return "Long";
  return "Slog";
}

/**
 * Resource state when the fight starts. The campaign fixes these by MAP, not by chance —
 * e.g. the village long rest sits before S4, then there is nowhere to long rest until the
 * Wendigo Wight, so the Pale Drifter is *always* fought on a short rest. Spell slots do
 * not return on a short rest, and the Frozen Sentinels are built to burn them (Glacial
 * Freeze wastes a slot outright; Whiteout breaks concentration).
 *
 * The 0.88 / 0.75 figures are estimates, not measurements. The number that would pin them
 * is slots remaining when the party walks out of the Sentinels.
 */
export type PartyResources = "fresh" | "shortRest" | "depleted";

export const RESOURCE_MULTIPLIER: Record<PartyResources, number> = {
  fresh: 1.0,
  shortRest: 0.88,
  depleted: 0.75,
};

export const RESOURCE_LABEL: Record<PartyResources, string> = {
  fresh: "Fresh · long rest",
  shortRest: "Short rest only",
  depleted: "Depleted",
};

export function estimateRounds(
  monsters: RoundsMonster[],
  size: number,
  level: number,
  lane: PartyLane = "standard",
  resources: PartyResources = "fresh",
  /**
   * The FIGHT's declared tier, when the encounter sets one. It wins over the creatures'
   * own classifications: a fight can be elite purely because its chaff stacks up enough
   * HP to push the round count into the elite band, with nothing elite in it.
   */
  encounterTier?: MonsterClassification,
): RoundsEstimate {
  const rawHp = monsters.reduce((s, m) => s + m.maxHp * Math.max(0, m.count), 0);
  // PC EFFECTIVE DAMAGE, exactly as the workbook builds it:
  //     published balanced center  ×  AC re-resolution  ×  encounter uptime
  // The two adjustments are different in kind and must both be present.
  //   · AC RE-RESOLVES the curve to the armour actually in this fight. It is a substitution,
  //     not a stacked penalty — see `acFactor`. At the level's baseline AC it is exactly 1.0.
  //   · UPTIME is a CLOCK term: aura spacing, forced repositioning, lost turns. It reduces
  //     damage delivered and must never be folded into the creature's EHP instead.
  // Wight check: 84.844 × 0.9369 × 0.86 = 68.36, the sheet's PC effective damage.
  const eff = effectiveHp(monsters);
  const dpr = partyDpr(size, level, lane, resources);
  const ac = encounterAcFactor(monsters, level);
  // Encounter damage UPTIME — the lowest uptime in the fight governs, since the creature
  // imposing the worst tempo tax is the one dictating where the party can stand.
  const uptime = monsters.reduce((lo, m) => Math.min(lo, m.damageUptime ?? 1), 1);
  const landedDpr = dpr * ac * uptime;
  const rounds = landedDpr > 0 ? eff / landedDpr : 0;
  // The band ALWAYS derives from the strongest creature in the fight (Christopher,
  // 2026-07-25). A declared encounter tier may only ESCALATE above that — never below it.
  // `encounterTier ?? derived` used to let a declared tier win outright, which is a
  // de-escalation lever: an act boss sitting in an encounter tagged "normal" would have
  // been judged against a 2-3 round band. ENCOUNTER-BALANCE-RULES is explicit that the
  // levers are escalation-only, so this takes the max of the two instead.
  const derivedTier = encounterClassification(monsters);
  const classification = maxClassification(encounterTier, derivedTier);
  const band = ROUND_BAND[classification] ?? ROUND_BAND.normal;
  return {
    rawHp,
    effectiveHp: eff,
    dpr,
    landedDpr,
    acFactor: ac,
    rounds,
    classification,
    band,
    verdict: verdictForRounds(rounds, classification),
  };
}
