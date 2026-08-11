/**
 * DPR & SUSTAIN BASELINE — transcribed from the checker workbook, not derived here.
 *
 * Source: broken_chain_campaign_dpr_sustain_checker_effective_sustain_truth.xlsx
 * (150,000+ simulated runs). THIS FILE IS A TRANSCRIPTION. Do not tune these numbers to
 * make an encounter read the way you want it to — change the workbook and re-transcribe,
 * or the app and the model stop agreeing about what the campaign is.
 *
 * Party figures are the CHECKER baseline, which layers three things onto the legacy
 * population: generic +1 armour coverage, Tier 3 weapon power at the level the party
 * actually receives it, and a mixed generic Convergence spread. Specific item effects are
 * deliberately outside the model.
 */

export type PartyBaseline = {
  level: number;
  stage: string;
  act: string;
  /** 4-player party DPR at this level. */
  dpr: number;
  /** Party effective HP before the sustain layer. */
  baseEhp: number;
  /** Party effective sustain — what the monster has to chew through. */
  sustain: number;
  /**
   * Per-PC shares of baseEhp, squishiest first. They SUM to baseEhp, so read cumulatively:
   * damage past the first drops one PC, past the first two drops a second, and so on.
   * This is what makes a tag mean LETHALITY rather than round count.
   */
  thresholds: [number, number, number, number];
};

export const PARTY_BASELINE: PartyBaseline[] = [
  { level: 3, stage: "Realized", act: "Act 2", dpr: 38.792, baseEhp: 135.76, sustain: 161.96, thresholds: [28.95, 31.54, 35.68, 39.6] },
  { level: 4, stage: "Realized", act: "Act 2", dpr: 42.76, baseEhp: 175.32, sustain: 204.76, thresholds: [37.11, 40.86, 46.08, 51.28] },
  { level: 5, stage: "Realized", act: "Act 2", dpr: 60.171, baseEhp: 218.56, sustain: 257.75, thresholds: [45.72, 50.66, 57.79, 64.38] },
  { level: 6, stage: "Metamorphosis", act: "Act 3", dpr: 67.332, baseEhp: 255.62, sustain: 310.01, thresholds: [54.02, 59.64, 67.3, 74.64] },
  { level: 7, stage: "Metamorphosis", act: "Act 3", dpr: 84.401, baseEhp: 302.57, sustain: 367.52, thresholds: [63.95, 71.04, 79.32, 88.25] },
  { level: 8, stage: "Metamorphosis", act: "Act 3", dpr: 90.299, baseEhp: 351.76, sustain: 425.98, thresholds: [74.48, 82.87, 92.3, 102.11] },
  { level: 9, stage: "Tempered", act: "Act 4", dpr: 114.179, baseEhp: 392, sustain: 480.97, thresholds: [81.58, 92.91, 103.22, 114.3] },
  { level: 10, stage: "Tempered", act: "Act 4", dpr: 115.387, baseEhp: 428.66, sustain: 520.8, thresholds: [88.79, 102.09, 113.2, 124.58] },
  { level: 11, stage: "Tempered", act: "Act 4", dpr: 119.918, baseEhp: 466.67, sustain: 566.58, thresholds: [97.17, 111.36, 123.07, 135.08] },
  { level: 12, stage: "Tempered", act: "Act 4", dpr: 125.384, baseEhp: 504.78, sustain: 605.34, thresholds: [105.22, 120.53, 132.83, 146.2] },
];

/** Monster AC the model expects at each party level — the zero point for the AC delta. */
export const EXPECTED_MONSTER_AC: Record<number, number> = {
  3: 14, 4: 15, 5: 16, 6: 16, 7: 16, 8: 17, 9: 17,
};

/**
 * AC delta -> effective-sustain contribution. Applied PER CREATURE, before encounter
 * totals. Deltas beyond +/-3 combine the listed bands.
 */
export const AC_DELTA_CONTRIBUTION: Record<number, number> = {
  "-3": -0.12288379260766968,
  "-2": -0.08062745835757301,
  "-1": -0.043412247481326216,
  0: 0,
  1: 0.04538239943698086,
  2: 0.0876983537201741,
  3: 0.14009978560652026,
};

/**
 * Trait -> effective-sustain contribution.
 *
 * Single-factor AUTHORING REFERENCES. The workbook is explicit that multiple recurring
 * defences are NOT automatically additive, and that conditional entries count only when
 * the party can realistically exploit them — so these are what a DM reaches for when
 * describing a creature, not a formula to sum blindly.
 *
 * Negative entries are weaknesses: a low relevant save, or a vulnerability the party can
 * hit repeatedly, REDUCES the creature's effective sustain.
 */
export const SUSTAIN_TRAITS: { label: string; contribution: number }[] = [
  { label: "Relevant save / ABS −1 vs CR expectation [conditional]", contribution: -0.025 },
  { label: "Relevant save / ABS −2 vs CR expectation [conditional]", contribution: -0.05 },
  { label: "Relevant save / ABS −3 vs CR expectation [conditional]", contribution: -0.075 },
  { label: "Vulnerability — ~25% of opposing damage", contribution: -0.2 },
  { label: "Vulnerability — ~50% of opposing damage", contribution: -0.3333333333333333 },
  { label: "Vulnerability — ~75% of opposing damage", contribution: -0.42857142857142855 },
  { label: "Vulnerability — ~100% of opposing damage", contribution: -0.5 },
  { label: "Magic Resistance", contribution: 0.11582399372059626 },
  { label: "Evasion-like", contribution: 0.05692769421928534 },
  { label: "Resistance — ~25% of opposing damage", contribution: 0.1440096727974145 },
  { label: "Resistance — ~50% of opposing damage", contribution: 0.34183418117197717 },
  { label: "Resistance — ~75% of opposing damage", contribution: 0.5858292424284814 },
  { label: "Broad resistance below half HP", contribution: 0.17560031351146632 },
  { label: "Telegraphed alternating immunity/resistance", contribution: 0.0759159908422331 },
  { label: "Reactive resistance to last damage type", contribution: 0.05587790305677687 },
  { label: "Nonmagical weapon resistance (campaign gear)", contribution: 0.015517617805909323 },
  { label: "Regeneration 5/round", contribution: 0.037114407532524485 },
  { label: "Regeneration 10/round", contribution: 0.07901267778697774 },
  { label: "Regeneration 15/round", contribution: 0.12290885490705916 },
  { label: "One-time heal — 20% max HP", contribution: 0.13945555937641974 },
  { label: "One-time heal — 35% max HP", contribution: 0.21416727720970496 },
  { label: "Shield-like +5 AC — 1 round", contribution: 0.14153696550922712 },
  { label: "Shield-like +5 AC — 2 rounds", contribution: 0.20415184169656952 },
  { label: "Fixed prevention — 8/round", contribution: 0.1418712644969924 },
  { label: "Fixed prevention — 12/round", contribution: 0.2323134514052565 },
  { label: "First attack each round at disadvantage", contribution: 0.047749343564075675 },
  { label: "All attacks at disadvantage — 1 round", contribution: 0.1294156939022204 },
  { label: "Half cover vs ranged attacks", contribution: 0.049548456103407856 },
  { label: "Concealment until first attack hits each round", contribution: 0.11325953581508919 },
  { label: "Opposing damage uptime −10%", contribution: 0.10834841514716653 },
  { label: "Opposing damage uptime −20%", contribution: 0.23422706888237932 },
  { label: "Relentless — drop to 1 HP once", contribution: 0.09520404861541021 },
  { label: "Phase restore — 25% max HP", contribution: 0.3116716245371236 },
  { label: "Phase restore — 50% max HP", contribution: 0.5433809697892558 },
  { label: "Legendary Resistance — 1 use", contribution: 0.04245766357823744 },
  { label: "Legendary Resistance — 3 uses", contribution: 0.045307068056192445 },
  { label: "Flat DR 3 per damaging hit [volatile]", contribution: 0.37791525515971514 },
  { label: "Flat DR 5 per damaging hit [volatile]", contribution: 0.7515761283417193 },
  { label: "Three attack-decoy images", contribution: 0.2521802532019184 },
  { label: "Damage cap — 40% max HP/round [volatile]", contribution: 0.7533213340633 },
];
