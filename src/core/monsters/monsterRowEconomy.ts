/**
 * WHAT A MONSTER CARD ROW SPENDS, WHERE IT SITS, AND HOW IT LOOKS — the card's rules, testable.
 *
 * Christopher, 2026-09-16: *"bond actions are consuming the entire monster action, same with reaction, and
 * there is no clear distinction between the action/reaction/bond as well as each of the attack set
 * (multiattack action should be colored the same) should be distinguishable between each other."*
 *
 * These lived inside `MonsterActorCard`, where no gate could reach them — which is how three separate
 * economy faults shipped in one component. They are pure: a row in, an answer out.
 */
import type { MonsterReaderAction } from "./MonsterJconScanner";
import {
  isMonsterBondAction, isMonsterBonusAction, isMonsterFullAction, isMonsterLegendaryAction, isMonsterSpellAction,
} from "./runtime/mainMonsterRuntime";

// ─── The economy ──────────────────────────────────────────────────────────────

/** Per-instance economy state — resets on turn advance. */
export type InstanceEconomy = {
  actionUsed: boolean;
  bonusUsed: boolean;
  reactionUsed: boolean;
  /** One bond activation a round — the Inherent Bond trait's own limit. */
  bondUsed: boolean;
  /** Attack steps used out of the turn's action budget. */
  stepsUsed: number;
};

export const FRESH_ECONOMY: InstanceEconomy = { actionUsed: false, bonusUsed: false, reactionUsed: false, bondUsed: false, stepsUsed: 0 };

/**
 * WHAT A ROW SPENDS — the one answer every spend reads.
 *
 * The card decided cost in three places and they disagreed. Use spent a reaction correctly, but anything
 * that was not an attack, a reaction or a bonus fell to "the whole action" — every bond row, and every
 * legendary option. Then Commit and Clear each spent an action STEP for whatever had been rolled, with no
 * look at what it was, so a reaction resolving through Commit cost a swing on top of its reaction.
 *
 *   bond       the bond's one activation a round — never the action, never the reaction, even when the
 *              option fires off-turn and is listed with the reactions
 *   reaction   the reaction
 *   legendary  its own pool, spent by the legendary section before this is reached
 *   bonus      the bonus action
 *   attack     one step of the turn's attacks, spent when it resolves (hit or miss)
 *   action     the turn's whole action
 */
export type RowEconomy = "bond" | "reaction" | "legendary" | "bonus" | "attack" | "action";

export function economyOf(a: MonsterReaderAction): RowEconomy {
  if (isMonsterBondAction(a)) return "bond";
  if (a.kind === "reaction") return "reaction";
  if (isMonsterLegendaryAction(a)) return "legendary";
  if (isMonsterBonusAction(a)) return "bonus";
  if (a.kind === "attack") return "attack";
  return "action";
}

/** Only these two draw on the turn's action budget; everything else has an economy of its own. */
export function spendsActionBudget(e: RowEconomy | undefined): boolean {
  return e === "attack" || e === "action";
}

/**
 * What USING a row spends, the moment it is used. An attack spends nothing yet — it is spent when it
 * resolves (`spendsActionBudget` on Commit or Clear). A whole action takes the budget.
 */
export function spendOnUse(economy: InstanceEconomy, spends: RowEconomy, actionsMax: number): InstanceEconomy {
  switch (spends) {
    case "bond":      return { ...economy, bondUsed: true };
    case "reaction":  return { ...economy, reactionUsed: true };
    case "bonus":     return { ...economy, bonusUsed: true };
    case "legendary": return economy;
    case "attack":    return economy;
    default:          return { ...economy, stepsUsed: actionsMax, actionUsed: true };
  }
}

// ─── Where a row sits ─────────────────────────────────────────────────────────

/**
 * ⚠ THE LIST A ROW IS AUTHORED IN IS ITS ECONOMY, NOT ITS `kind`.
 *
 * The Elemental Mirror's Reactive Refraction sits in `reactions` with `kind: "action"`. The card flattened
 * the lists and sorted by kind, so it rendered among the Actions and spent the whole action. The checker
 * reads the section a row is authored in; the card has to as well.
 */
export function cardRows(creature: { actions?: MonsterReaderAction[]; reactions?: MonsterReaderAction[]; traits?: MonsterReaderAction[] }): MonsterReaderAction[] {
  return [
    ...(creature.actions ?? []),
    ...(creature.reactions ?? []).map(a => (a.kind === "reaction" ? a : { ...a, kind: "reaction" as const })),
    ...(creature.traits ?? []),
  ];
}

/**
 * The card's sections. A bond row is the bond's wherever it would otherwise land; reaction and trait win
 * next (a slot-costed REACTION — Frost Ward — is still a reaction); legendary is its own economy; bonus
 * beats spell, because a bonus-action cantrip belongs where its economy lives.
 */
export function classifyMonsterRows(all: MonsterReaderAction[]) {
  const mainActions:  MonsterReaderAction[] = [];
  const bonusActions: MonsterReaderAction[] = [];
  const spells:       MonsterReaderAction[] = [];
  const reactions:    MonsterReaderAction[] = [];
  const legendary:    MonsterReaderAction[] = [];
  const traits:       MonsterReaderAction[] = [];
  const bond:         MonsterReaderAction[] = [];

  for (const a of all) {
    if (isMonsterBondAction(a))       { bond.push(a);         continue; }
    if (a.kind === "reaction")        { reactions.push(a);    continue; }
    if (a.kind === "trait")           { traits.push(a);       continue; }
    if (isMonsterLegendaryAction(a))  { legendary.push(a);    continue; }
    if (isMonsterBonusAction(a))      { bonusActions.push(a); continue; }
    if (isMonsterSpellAction(a))      { spells.push(a);       continue; }
    mainActions.push(a);
  }
  return { mainActions, bonusActions, spells, reactions, legendary, traits, bond };
}

// ─── How a row looks ──────────────────────────────────────────────────────────

/**
 * A ROW SAYS WHAT IT IS AT A GLANCE — by colour AND by name.
 *
 * Every row wore the same grey border; only the section headers had colour, and a section can hold rows
 * from two sets. So each row carries a stripe and a label:
 *
 *   Bond / Reaction / Bonus / Legendary   the economy's own colour — never the same as an action's
 *   <set> · <option>                      each authored action set (an element package) its own colour, in
 *                                         whichever section its rows land — a spell and an action from the
 *                                         same package read as one set
 *   Multiattack · N/turn                  every attack in the routine shares ONE colour
 *   Whole action                          a spell or recharge ability that IS the turn, outside any set
 *
 * ⚠ THE LABEL IS NOT DECORATION. Colour alone fails anyone who cannot tell two hues apart; the words carry
 * the same fact.
 */
export type RowAccent = { color: string; label: string };

/** Hues for authored action sets, chosen to stay clear of every section accent on the card. */
export const SET_HUES = ["#fb923c", "#38bdf8", "#a3e635", "#f472b6", "#fde047"] as const;
export const WHOLE_ACTION_HUE = "#c084fc";

export type RowAccentContext = {
  /** The card's section colours. */
  palette: { actions: string; bonus: string; reactions: string; bond: string; legendary: string };
  /** The routine: which rows each cost one swing, and how many swings a turn. */
  routine?: { names: readonly string[]; perTurn: number };
  /** The hue each authored set was given — see `setHues`. */
  setHueById: ReadonlyMap<string, string>;
};

/** One hue per authored set, in the order the sets first appear, so a package is one colour everywhere. */
export function setHues(rows: readonly MonsterReaderAction[]): Map<string, string> {
  const ids = [...new Set(rows.map(a => a.setId).filter((id): id is string => Boolean(id)))];
  return new Map(ids.map((id, i) => [id, SET_HUES[i % SET_HUES.length]]));
}

export function rowAccent(a: MonsterReaderAction, ctx: RowAccentContext): RowAccent {
  const { palette } = ctx;
  const spends = economyOf(a);
  if (spends === "bond") return { color: palette.bond, label: a.kind === "reaction" ? "Bond · off-turn" : "Bond" };
  if (spends === "reaction") return { color: palette.reactions, label: "Reaction" };
  if (spends === "legendary") return { color: palette.legendary, label: `Legendary${(a.legendaryCost ?? 1) > 1 ? ` · ${a.legendaryCost}` : ""}` };
  if (spends === "bonus") return { color: palette.bonus, label: "Bonus action" };
  /**
   * An authored set before the routine: an element package's rows belong together even when one of them is
   * also a swing, because the package is what the DM chose and what they look for.
   */
  if (a.setId) {
    const setName = a.setId.charAt(0).toUpperCase() + a.setId.slice(1);
    return { color: ctx.setHueById.get(a.setId) ?? SET_HUES[0], label: a.setOption ? `${setName} · ${a.setOption}` : setName };
  }
  if (ctx.routine && ctx.routine.perTurn > 1 && ctx.routine.names.includes(a.name)) {
    return { color: palette.actions, label: `Multiattack · ${ctx.routine.perTurn}/turn` };
  }
  if (isMonsterFullAction(a)) return { color: WHOLE_ACTION_HUE, label: "Whole action" };
  return { color: palette.actions, label: spends === "attack" ? "Attack" : "Action" };
}
