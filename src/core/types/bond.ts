/**
 * BOND TEMPLATES — the shape a staged, path-branching bond takes.
 *
 * LAYER: ENGINE. The SHAPE is engine — a template with stages, a permanent branch, and an
 * optional companion actor is not a 5e idea and not a Broken Chain one. The fourteen bonds
 * themselves are BROKEN CHAIN MOD content and live in that module, never here (RULE 3).
 *
 * This is the same authoring pattern as the equipment chassis and the monster spell pool, one
 * more level up: the AUTHOR writes a template carrying options, the table makes a choice, and
 * the choice lives on the character while the template stays generic.
 */

/** Which stage of the ladder a character's bond currently sits at. */
export type BondStageIndex = 0 | 1 | 2 | 3 | 4;

export const BOND_STAGE_NAMES = ["Instinct", "Realized", "Metamorphosis", "Tempered", "Unbroken"] as const;

/**
 * The stage at which the permanent path choice is made. Stages after it derive from that
 * choice rather than offering a new one.
 */
export const BOND_METAMORPHOSIS_STAGE: BondStageIndex = 2;

/**
 * BONDS SCALE ON CHARACTER LEVEL, THE WAY CANTRIPS DO.
 *
 * Christopher: *"the way to do the bonds is like we have the cantrip scaling, because we have set
 * lvls that those bond get overridden… the lvls are 3/6/9/13."* A bond stage is therefore DERIVED,
 * never stored and never hand-advanced — the same reasoning as a cantrip's damage tier, and for
 * the same reason: two records that can disagree about which tier a character is on will.
 *
 * The thresholds agree with the party curve's own stage column in `partyCurveV2.ts`
 * (Realized 3–5, Metamorphosis 6–8, Tempered 9–12, Unbroken 13–16), which is the reference the
 * encounter model already prices against.
 *
 * Index 0 is levels 1–2. Each entry is the level at which that stage BEGINS.
 */
export const BOND_STAGE_LEVELS = [1, 3, 6, 9, 13] as const;

/** The stage a character of this level is on. */
export function bondStageForLevel(level: number): BondStageIndex {
  let stage: BondStageIndex = 0;
  for (let i = BOND_STAGE_LEVELS.length - 1; i >= 0; i--) {
    if (level >= BOND_STAGE_LEVELS[i]) { stage = i as BondStageIndex; break; }
  }
  return stage;
}

/** The level at which a stage unlocks — what the level-up editor flags on. */
export function levelForBondStage(stage: BondStageIndex): number {
  return BOND_STAGE_LEVELS[stage];
}

/**
 * A STAGE CAN ALSO BE GATED ON A CAMPAIGN MILESTONE, not just a level.
 *
 * Christopher: *"how do we handle the lvl 9 bond because the party needs to have killed the act 3
 * boss for the bond upgrade."* Reaching level 9 is necessary and not sufficient — Tempered is
 * earned in the story as well as on the sheet.
 *
 * LAYER: the MECHANISM is engine (a stage may require a milestone). WHICH stage requires WHICH
 * milestone is campaign content and ships in the mod — a different campaign gates different
 * stages on different fights, or none at all.
 */
export type BondStageGate = {
  stage: BondStageIndex;
  /** Opaque id raised when the milestone is earned — see `bondMilestoneForEncounter`. */
  milestoneId: string;
  /** What the DM sees when the stage is held back. */
  label: string;
};

export type BondStageContext = {
  level: number;
  /** Milestones the party has earned. */
  milestones?: ReadonlySet<string> | string[];
  /** Gates this campaign applies. Empty = level alone decides. */
  gates?: readonly BondStageGate[];
};

/** Why a bond is not further along than it is. */
export type BondStageResolution = {
  stage: BondStageIndex;
  /** The stage the character's LEVEL alone would allow. */
  stageByLevel: BondStageIndex;
  /** Set when a milestone is holding the bond back below its level. */
  blockedBy?: BondStageGate;
};

/**
 * The stage a character is actually on, level and gates together.
 *
 * ⚠ A BLOCKED STAGE BLOCKS EVERYTHING ABOVE IT. Tempered is the prerequisite for Unbroken, so a
 * level-13 character who never killed the Act 3 boss is held at Metamorphosis — not advanced to
 * Unbroken with a hole where Tempered should be. The walk stops at the first unmet gate.
 */
export function resolveBondStage(ctx: BondStageContext): BondStageResolution {
  const earned = ctx.milestones instanceof Set
    ? ctx.milestones
    : new Set(ctx.milestones ?? []);
  const stageByLevel = bondStageForLevel(ctx.level);

  let stage: BondStageIndex = 0;
  for (let s = 1; s <= stageByLevel; s++) {
    const gate = (ctx.gates ?? []).find(g => g.stage === s && !earned.has(g.milestoneId));
    if (gate) return { stage, stageByLevel, blockedBy: gate };
    stage = s as BondStageIndex;
  }
  return { stage, stageByLevel };
}

/**
 * THE MACHINE FORM OF THE DIE A PATH'S TEXT STATES.
 *
 * A path box is prose because a DM reads it — "Companion stat block attack — the first strike
 * gets +1d4." The card cannot roll prose, and this codebase does not tag from prose
 * (the same rule that keeps equipment from being classified by its name), so the die is stated
 * once more in a field a formula can consume.
 *
 * Christopher, 2026-09-03: *"the bonded strike on faelar's sheet is missing the rider for meta"* —
 * Lyrielle reached Metamorphosis and chose Bonded Strike, and nothing carried the +1d4 to the
 * companion that actually swings it. `bondActions.withCompanionBondRider` is what reads this.
 *
 * Only the CHOSEN form carries one. The unchosen path is held, by definition, at a form the
 * ladder already spells out, and giving it a rider would be inventing a second live effect.
 */
export type BondRider = {
  /** Added to the performer's damage formula, e.g. "1d4". */
  damage?: string;
  /** The rider lands on the first strike of the turn only, not on every attack. */
  firstStrikeOnly?: boolean;
};

export type BondPath = {
  /** The path's name AT THIS STAGE. It renames as it evolves — never use it as a key. */
  name: string;
  /** What this path becomes when it IS the chosen one. */
  chosen: string;
  /** What this path holds at when the OTHER path was chosen. */
  unchosen?: string;
  /** The die `chosen` states, in a form a formula can use. See {@link BondRider}. */
  chosenRider?: BondRider;
};

export type BondStage = {
  /** "I".."V", as printed. */
  numeral: string;
  /** "Instinct", "Realized", … */
  label: string;
  /** The stage's one-line description from the source document. */
  blurb: string;
  /** Stages I and II name their option. */
  optionName?: string;
  /** Stages I and II carry a single shared effect. */
  effect?: string;
  /** Stages III+ carry exactly two paths, indexed. Index is the stable key. */
  paths?: BondPath[];
};

export type BondTemplate = {
  id: string;
  name: string;
  category?: string;
  role: string;
  /**
   * WHICH WAY THIS BOND'S CHARACTER LEANS WHEN ONE SLOT COULD BE TWO THINGS.
   *
   * `Resource Conversion` reserves each use once, so a tier wanted by both a heal and a damage
   * spell has to be divided. Dividing it by how many options of each kind happen to be prepared
   * says nothing about how the character is PLAYED. Christopher, 2026-09-07: *"the split should be
   * based on what role that PC is playing, but it should be about a 70/30 split that way."*
   *
   * The role is already authored one line above; this is the same statement in a form the ledger
   * can read, so the two cannot drift. A character with no bond has no lean and falls back to the
   * loadout split, which the ledger reports rather than hides.
   */
  resourceLean?: "offense" | "sustain" | "control";
  mode: string;
  timing: string;
  quote?: string;
  /**
   * Who performs the bond's effects.
   *
   * `"character"` (default) — the bonded character acts.
   * `"companion"` — a bonded COMPANION acts instead. Pack Instinct's every stage is written as
   * *"your companion moves… and makes one attack"*, so its actions belong on the companion's
   * card, not the character's. The companion is a real actor (`ActorKind === "companion"`)
   * already acting on its owner's turn with its own economy — this only says which card the
   * bond's actions attach to.
   */
  actor?: "character" | "companion";
  /**
   * THE OPTIONS THAT FIRE ON ANOTHER CREATURE'S TURN — every name that lineage takes, stage by stage.
   *
   * Christopher, 2026-09-15: *"the intercept cost bond action but should be listed as reaction option
   * which is suppose to consume that bond action."* A row named here is generated with `pinReaction`,
   * so the card lists it among the reactions — and it still costs the BOND, because the text says
   * *"This does not use your reaction"* and Action Timing r24 keeps such a response off the Reaction.
   *
   * ⚠ AUTHORED, NEVER READ FROM THE PROSE, and it lists EVERY name. A path renames as it climbs
   * (Intercept → Guardian's Stand → Wall of the Watch → Unbroken Watch), and the held form keeps its
   * Realized name, so one name would stop matching at the next stage.
   */
  offTurnOptions?: readonly string[];
  reads?: string;
  onYourTurn?: string;
  stages: BondStage[];
};

/**
 * A character's bond, as assigned by the DM.
 *
 * ⚠ `chosenPathIndex` IS WRITE-ONCE. Christopher: *"if someone has the meta they have to get the
 * tempered/unbroken of that choice, the only way to change is to remove the bond and chose it
 * again and that is a per DM choice."* v13 says the same in "Rules That Always Hold":
 * **Metamorphosis is permanent.**
 *
 * So there is no `setPath` — only `assignBond` (which starts it unset) and `chooseBondPath`
 * (which refuses when one is already set). Clearing it means clearing the whole assignment,
 * which is a deliberate DM act and loses the stage with it.
 */
export type BondAssignment = {
  /** Which template, by `BondTemplate.id`. */
  templateId: string;
  /**
   * ⚠ THERE IS NO STORED STAGE. The stage is `bondStageForLevel(character level)` — bonds scale
   * on level like cantrips, so storing it would create a second source of truth that drifts the
   * first time a character levels outside this code path.
   *
   * The only per-character bond state is the permanent choice below, plus bookkeeping.
   */
  /**
   * The permanent path, as an INDEX into the stage's `paths`. Unset until Metamorphosis.
   * Never keyed by name — a path renames at every stage after it is chosen.
   */
  chosenPathIndex?: 0 | 1;
  /**
   * For a `actor: "companion"` bond — which companion actor performs it. The companion is an
   * ordinary actor of kind `"companion"` owned by this character.
   */
  companionActorId?: string;
  /** DM note on this character's bond, free text. */
  note?: string;
};
