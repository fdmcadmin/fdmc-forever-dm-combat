/**
 * A CREATURE'S BOND, ON ITS CARD — the assignment becomes rows the DM can read and use.
 *
 * Christopher, 2026-09-15: *"the bonds actions did not get generated on my mirrors."*
 *
 * `MainMonsterTemplate.bond` has been expressible since the Mirrors needed it, and
 * `materializeTemplateBody` carried it onto every body — as DATA. Nothing turned it into rows, so a
 * finished mirror printed its Inherent Bond trait ("the DM-assigned Bond and Metamorphosis path selected
 * during construction … resolves with its printed timing and one activation per round") above a card
 * that had no bond on it at all. The one thing the trait promised was the one thing missing.
 *
 * ── WHAT IS GENERATED, AND WHAT IS NOT ───────────────────────────────────────────────────────────
 *
 *   rows      every option the bond's ladder shows at the creature's stage, with its printed text. An
 *             off-turn option is a REACTION on the card, as it is on a character's; everything else is
 *             an action. `bondActions.creatureBondActions` builds them — one ladder, both sides.
 *   a rider   a row whose text carries dice becomes ONE `once-per-turn` rider on the creature's first
 *             attack, because that is what a bond die IS: it arms onto a hit. The trait's own words are
 *             "one activation per round", so one rider, never one per row.
 *
 * ⚠ NO ROW BECOMES AN ATTACK OF ITS OWN. A bond row carries no `roll` and no `damage` here: giving one
 * its own damage line would hand the creature an extra attack every round it never had, and the
 * checker would price it as such. The die is the rider; the row is the text.
 *
 * ⚠ IDEMPOTENT. A body is materialized on every roster build and every render — a rebuild drops the rows
 * it generated last time (by their ◈ mark) before adding this time's, so they never stack.
 */
import type { MainMonsterTemplate, MonsterBond } from "./runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "./MonsterJconScanner";
import type { BondTemplate, BondStageIndex } from "../types/bond";
import type { ActorAction } from "../types/tabs";
import { creatureBondActions } from "../rules/bondActions";
import { resolveMonsterFormula } from "./resolveMonsterFormulaVars";
import { ACTIVE_BOND_TEMPLATES } from "../../modules/bondRoster";

/**
 * How a generated row is recognised on a creature, so a rebuild replaces rather than repeats.
 *
 * ⚠ BY THE NAME, not by an id: a `MonsterReaderAction` has no id field to carry
 * `GENERATED_BOND_ID_PREFIX` in, and the ◈ is already the convergence/bond mark the cards use.
 */
const isGeneratedRow = (a: { name?: string }) => String(a.name ?? "").startsWith("◈ ");

function toCreatureRow(bondName: string, stageTag: string, action: ActorAction): MonsterReaderAction {
  const text = String(action.metadata?.details ?? action.description ?? "");
  return {
    // The ◈ marks it as the bond's, and is what makes a regenerated card replace its own rows.
    name: `◈ ${action.label}`,
    kind: action.pinReaction ? "reaction" : "action",
    text: `${bondName} · ${stageTag} — ${text}`,
    /**
     * ⚠ IT SPENDS THE BOND. Without this the card read a bond row as a non-attack action and spent the
     * creature's whole turn on it (Christopher: *"bond actions are consuming the entire monster action"*).
     * An off-turn option keeps `kind: "reaction"` so it is FOUND with the reactions, and still costs the bond.
     */
    economyCost: "bond",
  } as MonsterReaderAction;
}

/**
 * The bond's rows, and its die as a rider on the creature's first attack.
 *
 * Returns the SAME creature when there is no bond to resolve, so nothing downstream sees a new object
 * on every build.
 */
export function withCreatureBondActions(
  creature: MainMonsterTemplate,
  templates: readonly BondTemplate[] = ACTIVE_BOND_TEMPLATES,
): MainMonsterTemplate {
  const bond = (creature as { bond?: MonsterBond }).bond;
  if (!bond?.templateId) return creature;
  const template = templates.find(t => t.id === bond.templateId);
  if (!template) return creature;

  const stage = (Number(bond.stage ?? 2) as BondStageIndex);
  const rows = creatureBondActions(template, { stage, chosenPathIndex: bond.chosenPathIndex });
  if (rows.length === 0) return creature;

  const stageTag = String(rows[0]?.tags?.[0] ?? "");
  const generated = rows.map(row => toCreatureRow(template.name, stageTag, row));
  const actions = [...(creature.actions ?? []).filter(a => !isGeneratedRow(a)), ...generated.filter(g => g.kind === "action")];
  const reactions = [...(creature.reactions ?? []).filter(a => !isGeneratedRow(a)), ...generated.filter(g => g.kind === "reaction")];

  /**
   * ⚠ ONE RIDER, ON THE FIRST ATTACK. The trait says one activation per round, and a bond die arms onto
   * a hit rather than being rolled on its own. A creature whose bond rows carry no dice — a pure control
   * bond — gets its rows and no rider, which is the honest answer for a bond that adds no damage.
   */
  const withDice = rows.find(r => typeof r.metadata?.damage === "string" && r.metadata.damage.trim() !== "");
  /**
   * ⚠ RESOLVED AGAINST THIS CREATURE. A bond die is written the character way — "1d8 + @PROF" — and a
   * creature's proficiency comes from its CR. Left raw, the rider would print and price a token.
   */
  const die = resolveMonsterFormula(String(withDice?.metadata?.damage ?? "").trim(), creature).trim();
  const riderName = `${template.name} (bond)`;
  const attackAt = actions.findIndex(a => a.kind === "attack" || Boolean(a.roll));
  const withRider = die && attackAt >= 0
    ? actions.map((a, i) => (i === attackAt
      ? { ...a, riders: [...(a.riders ?? []).filter(r => r.name !== riderName), { name: riderName, damage: die, cadence: "once-per-turn" as const }] }
      : a))
    : actions;

  return { ...creature, actions: withRider, reactions };
}
