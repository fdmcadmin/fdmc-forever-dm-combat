/**
 * BOND PROGRESSION — resolving a character's bond at their current level.
 *
 * LAYER: ENGINE. The ladder, the permanent branch and the companion routing are structure. The
 * fourteen bonds that use them are Broken Chain content (RULE 3).
 *
 * ── STAGE IS DERIVED FROM LEVEL, LIKE CANTRIP SCALING ────────────────────────────────────────
 * Christopher: *"the way to do the bonds is like we have the cantrip scaling, because we have set
 * lvls that those bond get overridden… the lvls are 3/6/9/13."*
 *
 * So nothing here advances a stage. There is no `advanceBondStage`, because a stage is not a
 * thing a DM grants — it is what the character's level already says. A stored stage would be a
 * second source of truth and would drift the first time someone levelled outside this path.
 *
 * ── THE PERMANENCE RULE, AND WHY IT IS SHAPED THIS WAY ───────────────────────────────────────
 * Christopher: *"make sure the 'choice' isnt a changeable choice if someone has the meta they
 * have to get the tempered/unbroken of that choice, the only way to change is to remove the bond
 * and chose it again and that is a per DM choice."* v13 agrees — "Metamorphosis is permanent."
 *
 * Enforced by SHAPE, not by a disabled button:
 *   · there is no `setPath` — only `chooseBondPath`, which REFUSES when a path is already set
 *   · Tempered and Unbroken take no path argument; they read the index chosen at Metamorphosis
 *   · there is no `clearBondPath`. Removing the assignment is the only reset.
 *
 * A UI that merely hid the choice would leave the mechanism reachable. Here a caller cannot
 * express the illegal move, which is the only kind of rule that survives a refactor.
 *
 * ── ⏸ FROZEN: GENERATING THE BOND TAB ACTIONS ────────────────────────────────────────────────
 * Christopher: *"it still needs clickable action buttons like the current bond do, if it can
 * create the bond actions that is fine, if it cant then that can be frozen atm."*
 *
 * It CAN be generated — `resolveBond` already returns the stage text and both paths, and the dice
 * are extractable from that text. It is frozen because generating it TODAY would DUPLICATE what
 * is already there: a character carrying Warden Instinct already has an authored "BOND — HOW IT
 * WORKS" header plus "Rallying Surge" and "Fortify" as bond-economy actions. Adding generated
 * twins gives every bonded character two of everything.
 *
 * The real change is a MIGRATION — the assignment becomes the source and the authored rows are
 * replaced, not joined — and that is a decision about existing party data, not a rendering task.
 * Until then the authored bond tab stays the clickable surface and the assignment drives the
 * summary strip, which is why they are deliberately independent.
 */

import {
  BOND_METAMORPHOSIS_STAGE,
  BOND_STAGE_NAMES,
  bondStageForLevel,
  levelForBondStage,
  resolveBondStage,
  type BondAssignment,
  type BondStageContext,
  type BondStageGate,
  type BondStageIndex,
  type BondTemplate,
} from "../types/bond";

/** What the bond actually does for this character, right now. */
export type ResolvedBond = {
  template: BondTemplate;
  stageIndex: BondStageIndex;
  stageName: string;
  /** Stage numeral as printed ("I".."V"). */
  numeral: string;
  /** Stages I–II: the single shared effect. */
  effect?: string;
  /** Stages III+: the chosen path's current form. Undefined until a path is chosen. */
  chosen?: { name: string; text: string };
  /** Stages III+: what the OTHER path holds at, per the chosen path's own box. */
  unchosen?: { name: string; text: string };
  /** True when the character has reached Metamorphosis with no path chosen yet. */
  awaitingPathChoice: boolean;
  /**
   * Set when the character's LEVEL would allow a further stage but a campaign milestone has
   * not been earned — the level-9 Tempered bump waiting on the Act 3 boss. Shown to the DM so
   * a held-back bond reads as "not yet earned", never as a bug.
   */
  blockedBy?: BondStageGate;
};

export function bondStageName(stage: BondStageIndex): string {
  return BOND_STAGE_NAMES[stage];
}

/**
 * At stages III+ BOTH paths are reported, because both are live: the chosen one at its upgraded
 * form and the unchosen one held at whatever the ladder says. A card showing only the chosen path
 * would hide half of what the character can still do.
 *
 * Resolve a bond AT AN EXPLICIT STAGE.
 *
 * This is the shared core. A character reaches its stage by level and campaign gates; a CREATURE
 * is simply built at one — an Elemental Mirror is authored at Metamorphosis and never advances.
 * Both end up here so the path/permanence rules cannot drift apart between them.
 */
export function resolveBondAtStage(
  template: BondTemplate,
  chosenPathIndex: 0 | 1 | undefined,
  stageIndex: BondStageIndex,
  blockedBy?: BondStageGate,
): ResolvedBond {
  const stage = template.stages[stageIndex];
  const base = {
    template,
    stageIndex,
    stageName: bondStageName(stageIndex),
    numeral: stage?.numeral ?? "",
    awaitingPathChoice: false,
    ...(blockedBy ? { blockedBy } : {}),
  };
  if (!stage) return base;
  if (!stage.paths) return { ...base, effect: stage.effect };

  const picked = chosenPathIndex;
  if (picked === undefined) return { ...base, awaitingPathChoice: true };

  const other = picked === 0 ? 1 : 0;
  /**
   * ⚠ THE UNCHOSEN PATH'S TEXT LIVES IN THE CHOSEN PATH'S BOX.
   *
   * A v13 path box reads "IF you took THIS path": `pmain` is your upgraded form and `palt` is
   * what the OTHER path holds at. Reading it off the other box returns nothing and leaves every
   * card blank from stage III up. The NAME comes from the other box; the TEXT from this one.
   */
  return {
    ...base,
    chosen: { name: stage.paths[picked].name, text: stage.paths[picked].chosen },
    unchosen: stage.paths[picked].unchosen
      ? { name: stage.paths[other]?.name ?? "Other path", text: stage.paths[picked].unchosen as string }
      : undefined,
  };
}

export function resolveBond(
  template: BondTemplate,
  assignment: BondAssignment,
  ctx: BondStageContext | number,
): ResolvedBond {
  const context: BondStageContext = typeof ctx === "number" ? { level: ctx } : ctx;
  const { stage: stageIndex, blockedBy } = resolveBondStage(context);
  return resolveBondAtStage(template, assignment.chosenPathIndex, stageIndex, blockedBy);
}

export type BondChoiceResult =
  | { ok: true; assignment: BondAssignment }
  | { ok: false; reason: string };

/**
 * Make the permanent path choice.
 *
 * Refuses if one is already set — that is the whole point. The caller is told the only legal
 * route, and that it costs the character their bond, so the DM sees the price before taking it.
 */
export function chooseBondPath(
  assignment: BondAssignment,
  pathIndex: 0 | 1,
  characterLevel: number,
): BondChoiceResult {
  if (assignment.chosenPathIndex !== undefined) {
    return {
      ok: false,
      reason:
        "Metamorphosis is permanent — this bond's path is already set. To change it the DM must remove the bond and assign it again, which starts it over at Instinct.",
    };
  }
  const stage = bondStageForLevel(characterLevel);
  if (stage < BOND_METAMORPHOSIS_STAGE) {
    return {
      ok: false,
      reason: `The path is chosen at ${BOND_STAGE_NAMES[BOND_METAMORPHOSIS_STAGE]} (level ${levelForBondStage(BOND_METAMORPHOSIS_STAGE)}); this character is level ${characterLevel}, still at ${bondStageName(stage)}.`,
    };
  }
  return { ok: true, assignment: { ...assignment, chosenPathIndex: pathIndex } };
}

/**
 * WHAT THE LEVEL-UP EDITOR MUST FLAG.
 *
 * Christopher: *"when a player gets to that lvl for the level up editor it should flag and
 * 'choosing' the meta and then the tempered and unbroken are set in that."*
 *
 * Two distinct things happen on a bond level, and only one of them needs the player:
 *   · a stage that simply OVERRIDES the previous text — announce it, nothing to decide
 *   · Metamorphosis — a permanent choice that must be made before the ladder can continue
 *
 * Tempered and Unbroken never ask again: they are the chosen path evolving, which is why
 * `requiresChoice` can only ever be true at Metamorphosis.
 */
export type BondLevelUpFlag = {
  /** The stage this level unlocks. */
  stage: BondStageIndex;
  stageName: string;
  /** True only at Metamorphosis, and only while no path has been chosen. */
  requiresChoice: boolean;
  /** The two paths to choose between, when a choice is required. */
  options?: { index: 0 | 1; name: string; text: string }[];
  /** One-line summary for the level-up sheet. */
  message: string;
};

/**
 * Does levelling from `fromLevel` to `toLevel` cross a bond threshold? Returns what the
 * level-up editor should surface, or null when this level changes nothing about the bond.
 */
export function bondLevelUpFlag(
  template: BondTemplate,
  assignment: BondAssignment,
  fromLevel: number,
  toLevel: number,
  opts?: { milestones?: ReadonlySet<string> | string[]; gates?: readonly BondStageGate[] },
): BondLevelUpFlag | null {
  /**
   * ⚠ FLAG WHAT WAS EARNED, NOT WHAT THE LEVEL SUGGESTS. Levelling to 9 does not grant Tempered
   * on its own — the Act 3 boss has to be dead. Announcing the stage anyway would tell the player
   * they had gained something the resolver will not give them, and the card would then disagree
   * with the level-up sheet.
   */
  const gated = { milestones: opts?.milestones, gates: opts?.gates };
  const beforeR = resolveBondStage({ level: fromLevel, ...gated });
  const afterR = resolveBondStage({ level: toLevel, ...gated });
  if (afterR.stage <= beforeR.stage) {
    // The level moved but a milestone is holding the bond. Say so rather than going silent —
    // a DM who levelled the party expects the bond to move and needs to know why it did not.
    if (afterR.blockedBy && afterR.stageByLevel > afterR.stage) {
      return {
        stage: afterR.stage,
        stageName: bondStageName(afterR.stage),
        requiresChoice: false,
        message: `${template.name} holds at ${bondStageName(afterR.stage)} — ${afterR.blockedBy.label} first.`,
      };
    }
    return null;
  }
  const after = afterR.stage;
  const stage = template.stages[after];
  const name = bondStageName(after);

  // The choice is owed at Metamorphosis and stays owed until it is made — a character who
  // levelled past it without choosing must still be stopped, not quietly skipped.
  const owesChoice = after >= BOND_METAMORPHOSIS_STAGE && assignment.chosenPathIndex === undefined;
  if (owesChoice && stage?.paths) {
    const meta = template.stages[BOND_METAMORPHOSIS_STAGE];
    return {
      stage: after,
      stageName: name,
      requiresChoice: true,
      options: (meta?.paths ?? []).map((p, i) => ({ index: i as 0 | 1, name: p.name, text: p.chosen })),
      message: `${template.name} reaches ${name} — choose the permanent path. This cannot be changed later.`,
    };
  }
  return {
    stage: after,
    stageName: name,
    requiresChoice: false,
    message: `${template.name} advances to ${name}.`,
  };
}

/**
 * Assign a bond to a character, with no path chosen.
 *
 * Re-assigning is how a DM changes a locked path, so this returns a FRESH assignment rather than
 * merging into whatever was there.
 */
export function assignBond(templateId: string, opts?: { companionActorId?: string; note?: string }): BondAssignment {
  return {
    templateId,
    ...(opts?.companionActorId ? { companionActorId: opts.companionActorId } : {}),
    ...(opts?.note ? { note: opts.note } : {}),
  };
}

/**
 * Which actor performs this bond — the companion when the template says so and one is
 * designated, otherwise the character.
 *
 * A companion bond with no companion designated returns the character and REPORTS the gap,
 * rather than silently dropping the bond's actions on the floor.
 */
export function bondPerformer(
  template: BondTemplate,
  assignment: BondAssignment,
  characterActorId: string,
): { actorId: string; isCompanion: boolean; missingCompanion: boolean } {
  if (template.actor !== "companion") {
    return { actorId: characterActorId, isCompanion: false, missingCompanion: false };
  }
  if (!assignment.companionActorId) {
    return { actorId: characterActorId, isCompanion: false, missingCompanion: true };
  }
  return { actorId: assignment.companionActorId, isCompanion: true, missingCompanion: false };
}
