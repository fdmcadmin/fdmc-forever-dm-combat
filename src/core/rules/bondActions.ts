/**
 * BOND TAB ACTIONS — the assignment becomes the clickable surface.
 *
 * LAYER: ENGINE. Turning a staged template into rows a card can click is structure, not
 * campaign content. The fourteen bonds stay in the mod (RULE 3); nothing in this file names one.
 *
 * ── WHAT THIS UNFREEZES ──────────────────────────────────────────────────────────────────────
 * `bondProgress.ts` recorded this as FROZEN with its reason: generating the rows would DUPLICATE
 * the authored ones, so *"a character carrying Warden Instinct already has a BOND - HOW IT WORKS
 * header plus Rallying Surge and Fortify as bond-economy actions"* and generated twins would give
 * every bonded character two of everything. Christopher: *"it still needs clickable action
 * buttons like the current bond do, if it can create the bond actions that is fine."*
 *
 * The answer the note asked for is REPLACE, NOT JOIN — and it is done by DERIVATION, not by a
 * migration that deletes party data:
 *
 *   · a bond row is any `actionKind: "bond"` entry in the bond tab. When an actor carries a
 *     `bondAssignment`, those rows STOP RENDERING and the generated ladder renders instead.
 *   · everything else in the bond tab (primed additives - Rage, Focus, Pressure) is untouched:
 *     the tab is "Bonds & Additives" and only the BOND half has a new source.
 *   · nothing is deleted. Clear the assignment and the authored rows come back exactly as
 *     authored. A delete pass would be irreversible loss across the whole party for a change
 *     that a render rule expresses completely.
 *
 * ── DERIVED, LIKE THE STAGE ──────────────────────────────────────────────────────────────────
 * The stage is derived from level and never stored, because a stored stage drifts. The ACTIONS
 * are derived for exactly the same reason: written into `tabs.bond` they would be a frozen copy
 * of the ladder that stops matching it the first time a character levels, chooses a path, or the
 * v13 document is re-extracted.
 *
 * ── WHY THE ROWS STILL BEHAVE LIKE BONDS ─────────────────────────────────────────────────────
 * Nothing here re-implements bond mechanics. `ActorCard.getReadiedRiderEffects` already arms ANY
 * non-passive action in the bond tab as a rider keyed `bond:<action id>`, and
 * `applyCrit = isCritDamage && !effect.id.startsWith("bond:")` already keeps bond dice out of a
 * crit double. A generated row is an ordinary bond-tab row, so it inherits both. (RULE 0: wire,
 * do not rewrite.)
 *
 * ── WHAT IS READ, AND WHAT IS NOT INVENTED ───────────────────────────────────────────────────
 * Every label, every rule text and every die comes out of the template. Two things the v13
 * document does not publish are therefore NOT supplied here:
 *
 *   · `+ your modifier` (Unbroken only) - the document never says WHICH modifier. It is carried
 *     as a printed note on the row, never folded into the rollable formula.
 *   · a target, a range or a save - the bond text states them in prose and the ladder has no
 *     fields for them. The text is the card.
 */

import type { ActionCost } from "../types/actionEconomy";
import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";
import {
  BOND_METAMORPHOSIS_STAGE,
  type BondStageContext,
  type BondStageIndex,
  type BondAssignment,
  type BondTemplate,
} from "../types/bond";
import { bondPerformer, resolveBond, resolveBondAtStage, type ResolvedBond } from "./bondProgress";

/** The separator v13 prints between an option name and its rule. */
const EM_DASH = "—";

const BOND_COST: ActionCost[] = ["bond"];

/**
 * Prefix every generated row shares, so a generated id is never mistaken for an authored one.
 *
 * ⚠ NO COLON, ANYWHERE IN A GENERATED ID. An action is addressed by the readied key
 * `<tabId>:<action id>`, and `ActorCard.getActionForReadiedKey` recovers it with a plain
 * `split(":")` that reads the first two parts. A colon inside the id truncates that lookup: the
 * readied action resolves to nothing, so the bond silently stops arming as a rider and stops
 * logging — while still LOOKING readied on the card. Caught by driving the real card rather than
 * by reading the generator, which is the whole point of "verify the wiring, not just the logic".
 */
export const GENERATED_BOND_ID_PREFIX = "bond-gen";

/** Is this an authored ladder row - the thing the assignment replaces? */
export function isAuthoredBondLadderRow(action: ActorAction): boolean {
  return action.actionKind === "bond" && !action.id.startsWith(`${GENERATED_BOND_ID_PREFIX}-`);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * THE TWO OPTION NAMES A BOND OFFERS, read off the stage that first states both.
 *
 * Stage II is written as `<lead-in>, choose one: NAME - text. NAME - text.` in all fourteen
 * bonds, with the em dash as the separator every time. The names are needed in three places -
 * to split stage II into two rows, to label the held (unchosen) option at stage III+, and to
 * strip that name off the front of the text it is glued to - so they are parsed once here.
 *
 * ⚠ PACK RENAMES AT STAGE II. Its stage I option is "Coordinated Strike" and its stage II pair
 * is "Bonded Strike / Shielding Bond". So stage I uses its OWN `optionName` and everything from
 * stage II up uses this pair; treating stage I's name as option 0 for the whole ladder would
 * mislabel that bond at every later stage.
 */
function stageTwoOptions(template: BondTemplate): { name: string; text: string }[] {
  const effect = template.stages[1]?.effect?.trim();
  if (!effect) return [];

  // Anchor past the "choose one:" / "choose each turn:" lead-in when there is one, so the
  // lead-in can never be captured as an option name.
  const marker = effect.match(/choose\s+(?:one\s+)?(?:each\s+turn|one)?\s*:\s*/i);
  const body = marker ? effect.slice((marker.index ?? 0) + marker[0].length) : effect;

  // "Silencing Round - ", "Off-Balance - ", "Bonded Strike - ": one or more capitalised words
  // immediately before the em dash.
  const re = new RegExp(`([A-Z][A-Za-z'\\u2019-]*(?:\\s+[A-Z][A-Za-z'\\u2019-]*)*)\\s+${EM_DASH}\\s+`, "g");
  const found: { name: string; start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    found.push({ name: match[1], start: match.index, end: match.index + match[0].length });
  }
  if (found.length === 0) return [];

  return found.map((entry, i) => ({
    name: entry.name,
    text: body.slice(entry.end, found[i + 1] ? found[i + 1].start : undefined).trim(),
  }));
}

/**
 * Strip a known option name off the front of the text it is glued to.
 *
 * A stage III+ `unchosen` reads "Challenge 1 enemy within 10 ft must target you..." - the held
 * option's NAME run straight into its rule with no punctuation. Splitting on "the leading run of
 * capitalised words" looked right and is wrong: "Closing Strike If your movement..." would take
 * "If" with it. Matching against the names the bond actually has cannot make that mistake.
 */
function splitLeadingOptionName(text: string, names: string[]): { name?: string; rest: string } {
  const trimmed = text.trim();
  for (const name of names) {
    if (trimmed.toLowerCase().startsWith(name.toLowerCase())) {
      return { name, rest: trimmed.slice(name.length).replace(/^[\s:.—-]+/, "") };
    }
  }
  return { rest: trimmed };
}

/**
 * WHAT THE ROW ROLLS.
 *
 * Bond text states one effect die, sometimes beside a secondary one. Three rules, and each
 * exists because a simpler one gets a real bond wrong:
 *
 *   · a d20 is never the effect die - Covenant's Call prints "1d20 + your proficiency to hit;
 *     1d8 damage" and the attack roll is not what the bond rider carries.
 *   · the die carrying `+ PB` wins - from Metamorphosis up the bond's own output is the scaled
 *     one, and a splash die ("A second ally within 10 ft gains 1d6") is printed after it.
 *   · otherwise the LAST die wins - Siphon's Sacrifice reads "take 1d6 damage(...); your next
 *     damaging action this turn deals 1d8", where the first die is the COST the bearer pays.
 *
 * ⚠ ONLY `PB` IS RESOLVED. v13 also writes `+ your modifier` (Unbroken) and `+ your main stat`
 * (Covenant) and names neither, so neither is folded into the rollable formula — they come back
 * as a printed note instead. They still have to be MATCHED, though: dropping them from the tail
 * pattern breaks the run before `PB` in "1d12 + main stat + PB" and silently loses the
 * proficiency bonus from the one bond that writes it in that order.
 */
function extractEffectDice(text: string): { dice?: string; formula?: string; unresolvedModifier?: string } {
  const TAIL = "(?:\\s*\\+\\s*(?:PB|(?:your\\s+)?main\\s+stat|your\\s+modifier))*";
  const re = new RegExp(`(\\d+)d(\\d+)(${TAIL})`, "gi");
  const candidates: { dice: string; tail: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match[2] === "20") continue;
    candidates.push({ dice: `${match[1]}d${match[2]}`, tail: match[3] ?? "" });
  }
  if (candidates.length === 0) return {};

  const chosen = candidates.find((c) => /\bPB\b/i.test(c.tail)) ?? candidates[candidates.length - 1];
  const unnamed = [
    /your\s+modifier/i.test(chosen.tail) ? "your modifier" : undefined,
    /main\s+stat/i.test(chosen.tail) ? "your main stat" : undefined,
  ].filter(Boolean);

  return {
    dice: chosen.dice,
    formula: /\bPB\b/i.test(chosen.tail) ? `${chosen.dice}+@PROF` : chosen.dice,
    ...(unnamed.length
      ? { unresolvedModifier: `+ ${unnamed.join(" + ")} (v13 names no ability for it — table call; add it with + Additive)` }
      : {}),
  };
}

/**
 * The clause the effect die sits in, bounded by the nearest sentence or semicolon break.
 *
 * The KIND has to be read from this and not from the whole entry. Siphon's Sacrifice reads
 * "Take 1d4 damage (cannot be reduced or prevented); your next damaging action this turn deals
 * 1d6" — scanning the whole string finds "reduced", which belongs to the COST clause, and labels
 * a damage bond as a reduction. Every entry also ends in "This bond is not affected by bonuses",
 * which is commentary and must never reach the classifier either.
 */
function clauseAround(text: string, dice: string): string {
  const at = text.search(new RegExp(dice.replace("d", "d"), "i"));
  if (at < 0) return text;
  const before = Math.max(text.lastIndexOf(".", at), text.lastIndexOf(";", at));
  const afterDot = text.indexOf(".", at);
  const afterSemi = text.indexOf(";", at);
  const after = [afterDot, afterSemi].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? text.length;
  return text.slice(before + 1, after).trim();
}

/**
 * WHAT KIND OF DICE THESE ARE, in the document's own words.
 *
 * The four kinds already exist (`EFFECT_KINDS`: damage / healing / temp / reduction) and they
 * decide the roll button's wording, so a Guardian's Intercept reads "Roll Reduction" rather than
 * announcing prevented harm as damage dealt. Read from the text, never from the bond's category:
 * Devout is a support bond whose Smite path deals radiant damage.
 */
function effectKindFor(text: string): "damage" | "healing" | "temp" | "reduction" | undefined {
  if (/temporary\s+hp/i.test(text)) return "temp";
  if (/\b(?:reduce[sd]?|reduction|prevent(?:ed|s)?)\b/i.test(text)) return "reduction";
  if (/\b(?:heals?|healing|regains?|restore[sd]?)\b/i.test(text)) return "healing";
  return "damage";
}

type GeneratedRow = {
  key: string;
  label: string;
  text: string;
  /** Held at an earlier form because the other path was taken. */
  held?: boolean;
};

/** The live options at this stage, as rows, before they become actions. */
function rowsForResolvedBond(template: BondTemplate, resolved: ResolvedBond): GeneratedRow[] {
  const pair = stageTwoOptions(template);
  const names = pair.map((p) => p.name);

  // Stages I and II carry one shared `effect` string.
  if (resolved.effect) {
    if (resolved.stageIndex === 0) {
      const stage = template.stages[0];
      return [{ key: slug(stage?.optionName ?? "instinct"), label: stage?.optionName ?? template.name, text: resolved.effect }];
    }
    if (pair.length > 0) {
      return pair.map((option) => ({ key: slug(option.name), label: option.name, text: option.text }));
    }
    // A bond whose stage II is not written as a pair still gets one usable row rather than none.
    return [{ key: "realized", label: template.stages[1]?.optionName ?? template.name, text: resolved.effect }];
  }

  // Stages III+ once the permanent path is set: the chosen path at its current form, and the
  // other option HELD at whatever the ladder says it holds at. Both are live and both belong.
  const rows: GeneratedRow[] = [];
  if (resolved.chosen) {
    rows.push({ key: slug(resolved.chosen.name), label: resolved.chosen.name, text: resolved.chosen.text });
  }
  if (resolved.unchosen) {
    const split = splitLeadingOptionName(resolved.unchosen.text, names);
    rows.push({
      key: slug(split.name ?? resolved.unchosen.name),
      label: split.name ?? resolved.unchosen.name,
      text: split.rest || resolved.unchosen.text,
      held: true,
    });
  }
  if (rows.length > 0) return rows;

  /**
   * METAMORPHOSIS REACHED, NOTHING CHOSEN YET.
   *
   * The ladder has nothing to say at this stage until the path is picked, but the character has
   * not lost what they already had: the Realized pair is what they were using a moment ago and
   * nothing has replaced it. So the pair keeps rendering, and the prompt row below says why it
   * has not moved. The alternative - rendering no clickable bond at all - takes the bond off a
   * character mid-session for a choice the DM has simply not made yet.
   */
  if (resolved.awaitingPathChoice && pair.length > 0) {
    return pair.map((option) => ({ key: slug(option.name), label: option.name, text: option.text }));
  }
  return [];
}

/** One generated row, as a clickable bond-economy action. */
function toAction(template: BondTemplate, resolved: ResolvedBond, row: GeneratedRow): ActorAction {
  const dice = extractEffectDice(row.text);
  const kind = dice.dice ? effectKindFor(clauseAround(row.text, dice.dice)) : undefined;
  const stageTag = `${resolved.numeral} ${resolved.stageName}`;

  return {
    id: `${GENERATED_BOND_ID_PREFIX}-${template.id}-${row.key}`,
    label: row.label,
    description: row.text,
    actionKind: "bond",
    economyCost: BOND_COST,
    /**
     * ⚠ AN OFF-TURN OPTION IS LISTED WITH THE REACTIONS, AND STILL COSTS THE BOND.
     * `pinReaction` puts the row in the card's reactions strip beside the Opportunity Attack; the cost
     * stays `["bond"]`, so using it lights the BOND and leaves the Reaction free for Spirit Shield or an
     * Opportunity Attack. See `BondTemplate.offTurnOptions`.
     */
    ...(template.offTurnOptions?.includes(row.label) ? { pinReaction: true } : {}),
    category: template.name,
    tags: [stageTag, ...(row.held ? ["Held"] : [])],
    metadata: {
      ...(dice.formula ? { damage: dice.formula } : {}),
      ...(kind ? { effectKind: kind } : {}),
      ...(dice.unresolvedModifier ? { withModifier: dice.unresolvedModifier } : {}),
      cost: "bond",
      details: row.text,
      /**
       * A bond is a RIDER, not a straight roll: readying it arms it onto the next roll, which is
       * what `getReadiedRiderEffects` already does for every non-passive bond-tab row. Saying so
       * explicitly stops `inferOutcomeMode` reading "attack"/"save" out of the prose and turning
       * a bond into an attack roll of its own.
       */
      outcomeMode: "additive",
    },
  };
}

/** A non-clickable row that explains why the ladder is not where the level suggests. */
function noteRow(id: string, label: string, text: string): ActorAction {
  return {
    id: `${GENERATED_BOND_ID_PREFIX}-${id}`,
    label,
    description: text,
    actionKind: "bond",
    economyCost: [],
    category: "Bond",
    logMode: "silent",
    displayMode: "compact",
    metadata: { cost: "passive", details: text, outcomeMode: "passive" },
  };
}

/**
 * The bond tab, generated from an assignment.
 *
 * Returns [] when the actor carries no assignment or the template is not in the loaded mod, so a
 * campaign without bonds - or one whose bond content has not been loaded - renders exactly what
 * it authored.
 */
/**
 * THE OWNER'S BOND CHOICE, LANDING ON THE COMPANION THAT PERFORMS IT.
 *
 * The bond ladder is chosen on the character's sheet; a `actor: "companion"` bond is executed
 * from the companion's card using its own stat block and economy. Nothing joined the two, so
 * Lyrielle reached Metamorphosis, took Bonded Strike, and Faelar's Bonded Strike kept rolling
 * its Realized damage. Christopher: *"lyrielle got to pick the bond, choose the spec, but fealar
 * didnt get the added bonus."*
 *
 * ⚠ THE PATH IS KEYED ON ITS METAMORPHOSIS NAME, never its name at the current stage. A path
 * RENAMES as it evolves — Bonded Strike becomes Apex Bond at IV and Unbroken Bond at V — while
 * the companion's action is still labelled "Bonded Strike" on its sheet. Matching the stage name
 * would silently stop finding the action at level 9.
 *
 * Returns the SAME actor when there is no rider to fold, so a companion without a bonded owner
 * never gets a new identity on every render.
 */
export function withCompanionBondRider(
  actor: Actor,
  templates: readonly BondTemplate[],
  gates: BondStageContext["gates"],
): Actor {
  const ownerBond = actor.moduleData?.ownerBond;
  if (!ownerBond) return actor;

  /**
   * ⚠ THE TEMPLATE CAN COME FROM THE CARD; THE PATH CANNOT.
   *
   * An owner whose bond is authored rather than assigned still names their template on a bond row,
   * so the companion can tell WHICH bond it performs. What no card records is which Metamorphosis
   * path was taken — that is only ever on the assignment, and a rider without a chosen path is not
   * a rider that was earned. So this resolves the template either way and still requires the path,
   * rather than inventing one.
   */
  const assignedId = ownerBond.assignment?.templateId;
  const template = assignedId
    ? templates.find((t) => t.id === assignedId)
    : templates.find((t) => (ownerBond.cardBondLabels ?? [])
        .some(l => l.trim().toLowerCase().startsWith(t.name.trim().toLowerCase())));
  if (!template || template.actor !== "companion") return actor;

  const picked = ownerBond.assignment?.chosenPathIndex;
  if (picked === undefined) return actor;

  const resolved = resolveBond(template, ownerBond.assignment!, {
    level: ownerBond.ownerLevel ?? actor.level ?? 1,
    milestones: ownerBond.milestones ?? [],
    gates,
  });
  const rider = template.stages[resolved.stageIndex]?.paths?.[picked]?.chosenRider;
  if (!rider?.damage) return actor;

  // The stable key: what this path was called when it was chosen.
  const key = template.stages[BOND_METAMORPHOSIS_STAGE]?.paths?.[picked]?.name?.toLowerCase();
  if (!key) return actor;

  let touched = false;
  const tabs = Object.fromEntries(
    Object.entries(actor.tabs).map(([tabId, actions]) => {
      if (!Array.isArray(actions)) return [tabId, actions];
      return [tabId, actions.map((action) => {
        if (!action.label?.toLowerCase().includes(key)) return action;
        const damage = action.metadata?.damage;
        if (!damage) return action;
        // Idempotent: the card re-renders constantly and a rider must not stack on itself.
        if (damage.includes(rider.damage as string)) return action;
        touched = true;
        const note = rider.firstStrikeOnly ? " (first strike only)" : "";
        return {
          ...action,
          metadata: {
            ...action.metadata,
            damage: `${damage} + ${rider.damage}`,
            details: `${action.metadata?.details ?? ""}

${resolved.stageName} — ${template.name}: +${rider.damage}${note}, from ${resolved.chosen?.name ?? "the chosen path"}.`.trim(),
          },
        };
      })];
    }),
  ) as Actor["tabs"];

  return touched ? { ...actor, tabs } : actor;
}

/**
 * A CREATURE'S BOND ROWS — the same ladder, at a stage that is STATED rather than derived.
 *
 * Christopher, 2026-09-15: *"the bonds actions did not get generated on my mirrors."* An Elemental
 * Mirror is built with *"one legal inherent Bond and its Metamorphosis path"*, and the assignment rode
 * along on the body as data: the card printed the Inherent Bond trait — "it resolves with its printed
 * timing and one activation per round" — with nothing under it to resolve.
 *
 * A character's stage comes from level and gates; a creature is BUILT at a stage and never advances, so
 * it resolves at the stage it carries and nothing here asks about levels or milestones. Everything else
 * is the character path unchanged: the same rows, the same text, the same dice.
 */
export function creatureBondActions(
  template: BondTemplate,
  bond: { stage: BondStageIndex; chosenPathIndex?: 0 | 1 },
): ActorAction[] {
  const resolved = resolveBondAtStage(template, bond.chosenPathIndex, bond.stage);
  return rowsForResolvedBond(template, resolved).map(row => toAction(template, resolved, row));
}

export function generatedBondActions(
  template: BondTemplate,
  assignment: BondAssignment,
  ctx: BondStageContext,
  opts?: { characterActorId?: string; companionName?: string },
): ActorAction[] {
  const resolved = resolveBond(template, assignment, ctx);
  const actions = rowsForResolvedBond(template, resolved).map((row) => toAction(template, resolved, row));

  /**
   * A HELD BOND SAYS SO. Level 9 with the Act 3 boss still standing resolves to Metamorphosis,
   * and without this the card would simply look like a bond that stopped levelling.
   */
  if (resolved.blockedBy) {
    actions.push(noteRow(
      `${template.id}:blocked`,
      `Held at ${resolved.stageName}`,
      `${template.name} does not advance until the milestone is earned: ${resolved.blockedBy.label}`,
    ));
  }

  if (resolved.awaitingPathChoice) {
    actions.push(noteRow(
      `${template.id}:choose-path`,
      `${resolved.stageName} reached ${EM_DASH} choose the permanent path`,
      `The DM sets the path on the character sheet. It cannot be changed afterwards; the options below still run at their ${
        template.stages[BOND_METAMORPHOSIS_STAGE - 1]?.label ?? "previous"
      } form until it is chosen.`,
    ));
  }

  /**
   * A COMPANION BOND ACTS ON THE COMPANION'S CARD. `bondPerformer` already owns that decision,
   * including the case a template calls for a companion and none is designated - which it reports
   * rather than dropping the bond's actions on the floor.
   */
  if (template.actor === "companion") {
    const performer = bondPerformer(template, assignment, opts?.characterActorId ?? "");
    actions.push(noteRow(
      `${template.id}:performer`,
      performer.missingCompanion ? `No bonded companion set` : `Performed by ${opts?.companionName ?? "the bonded companion"}`,
      performer.missingCompanion
        ? `${template.name} is performed by a companion. Set the bonded companion on the character sheet, or run these rows from the companion's own card.`
        : `${template.name} is performed by the bonded companion, on its owner's turn, using its own economy.`,
    ));
  }

  return actions;
}

/**
 * THE ONE PLACE THE REPLACEMENT HAPPENS.
 *
 * Applied once at the top of the card so every path below it - the tab list, the readied-key
 * lookup, the rider derivation, the log - sees the same bond tab. Doing it per-surface is how a
 * row becomes clickable in one place and unresolvable in another.
 *
 * Returns the SAME actor object when there is nothing to replace, so an actor without a bond
 * never gets a new identity on every render.
 */
export function withGeneratedBondActions(
  actor: Actor,
  templates: readonly BondTemplate[],
  gates: BondStageContext["gates"],
  companionName?: (companionActorId: string) => string | undefined,
): Actor {
  const assignment = actor.moduleData?.bondAssignment;
  if (!assignment) return actor;
  const template = templates.find((t) => t.id === assignment.templateId);
  if (!template) return actor;

  /**
   * ⚠ A COMPANION-PERFORMED BOND LEAVES THE CHARACTER'S CARD ALONE.
   *
   * `pack` is `actor: "companion"`: Lyrielle chooses, Faelar swings. Her card carries a
   * hand-authored controller row — "Choose ONE each round: Faelar performs Bonded Strike or
   * Faelar protects" — and the companion's card carries the two things it can actually do.
   * That split is the design, not an omission.
   *
   * Generating here would do real damage: `isAuthoredBondLadderRow` treats every
   * `actionKind: "bond"` row without the generated prefix as a ladder row to be replaced, so
   * running this would DELETE `lyrielle-bond-reference` and emit the companion's rows on the
   * wrong sheet. Christopher, on a proposal to do exactly that: *"why did you change the model
   * of the pack bond when i was written to my instructions, it just needed to be tied to the
   * companion."*
   *
   * The tie is `withCompanionBondRider`, applied to the COMPANION.
   */
  if (template.actor === "companion") return actor;

  const generated = generatedBondActions(
    template,
    assignment,
    {
      level: actor.level ?? 1,
      milestones: actor.moduleData?.milestones ?? [],
      gates,
    },
    {
      characterActorId: actor.id,
      companionName: assignment.companionActorId ? companionName?.(assignment.companionActorId) : undefined,
    },
  );
  if (generated.length === 0) return actor;

  const kept = (actor.tabs.bond ?? []).filter((action) => !isAuthoredBondLadderRow(action));
  return { ...actor, tabs: { ...actor.tabs, bond: [...generated, ...kept] } };
}
