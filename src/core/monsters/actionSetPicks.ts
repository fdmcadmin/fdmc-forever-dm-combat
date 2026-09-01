/**
 * ACTION SET PICKS — building one body from a template creature.
 *
 * Christopher: *"the DM say this is a one of them and then on veritable actions like the spells
 * there needs to be a how many of these types of actions are able to be chosen for this action
 * set."*
 *
 * A template carries every option a body COULD have; each body takes the stated number from each
 * pool. That is the same ABS-array shape used everywhere else in this app — the ability spine,
 * the equipment chassis, the spell-slot pool, the bond path — and it obeys the same rule
 * Christopher set for all of them: *"when you pick it you cant see it."* A taken option leaves
 * the pool, so two mirrors built from one template are genuinely different bodies.
 *
 * ⚠ THIS SITS BESIDE `spellSlotPicks.ts`, IT DOES NOT REPLACE IT. Slot-costed spells pool by
 * LEVEL because 5e counts slots for you; an action set is for the pools nothing counts. Both end
 * in the same place — a template plus a set of choices produces one concrete stat block.
 */

import type { MainMonsterTemplate, MonsterActionSet, MonsterArchetype, MonsterBond } from "./runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "./MonsterJconScanner";
import { redistributeAbilityEntries } from "./creator/monsterCreatorModel";
import { resolveMonsterActionFormulas } from "./resolveMonsterFormulaVars";

/** Which action names fill each set, by set id. `null` = that slot is still empty. */
export type ActionSetPicks = Record<string, (string | null)[]>;

/**
 * One choosable option in a set — a LABEL and the actions it brings.
 *
 * An option is often a bundle: the Elemental Mirror's six element packages carry three spells
 * each, so eighteen actions present as six choices. Actions sharing `setId` + `setOption` are
 * one option; an action with no `setOption` is an option of its own, named for itself.
 */
export type ActionSetOption = {
  /** What the DM picks, and what names the body when the set is `namesBody`. */
  name: string;
  /** Every action taken when this option is chosen. */
  actions: MonsterReaderAction[];
};

export type ActionSetPlan = {
  set: MonsterActionSet;
  /** Every OPTION authored for this set — bundles counted once, not per action. */
  candidates: ActionSetOption[];
  /** How many the body takes — the set's `pick`, capped at what actually exists. */
  slots: number;
  /** True when the set asks for more than it offers, which the DM should fix. */
  short: boolean;
};

/**
 * The OPTIONS in a set, in authored order.
 *
 * ⚠ COUNT OPTIONS, NOT ACTIONS. A set of six element packages holding three spells each offers
 * SIX choices; counting the eighteen actions would tell the DM they had eighteen options and
 * would let "pick 1" take a single spell out of a package.
 */
export function actionSetCandidates(template: MainMonsterTemplate, setId: string): ActionSetOption[] {
  const inSet = (template.actions ?? []).filter(a => a.setId === setId);
  const byOption = new Map<string, MonsterReaderAction[]>();
  for (const a of inSet) {
    const key = a.setOption?.trim() || a.name;
    const list = byOption.get(key);
    if (list) list.push(a); else byOption.set(key, [a]);
  }
  return [...byOption.entries()].map(([name, actions]) => ({ name, actions }));
}

/**
 * The sets this creature must be picked for.
 *
 * A set with no candidates is omitted — it asks a question with no answers, and raising a picker
 * with nothing in it just blocks generation.
 */
export function actionSetPlan(template: MainMonsterTemplate): ActionSetPlan[] {
  return (template.actionSets ?? [])
    .map(set => {
      const candidates = actionSetCandidates(template, set.id);
      return {
        set,
        candidates,
        // Never ask for more than exists: picks are distinct, so 5 slots from 3 candidates can
        // only ever fill 3 and the extra two would sit permanently empty, blocking the build.
        slots: Math.min(Math.max(0, set.pick), candidates.length),
        short: set.pick > candidates.length,
      };
    })
    .filter(p => p.candidates.length > 0 && p.slots > 0);
}

/** True when this creature needs choices before a body can be generated. */
export function needsActionSetPicks(template: MainMonsterTemplate): boolean {
  return actionSetPlan(template).length > 0;
}

/** An empty pick sheet — every slot of every set unfilled. */
export function emptyActionSetPicks(plan: ActionSetPlan[]): ActionSetPicks {
  return Object.fromEntries(plan.map(p => [p.set.id, Array<string | null>(p.slots).fill(null)]));
}

/**
 * What one slot may still be given: this set's candidates minus those already taken by OTHER
 * slots in the same set. The slot's own current pick stays listed, or re-choosing it would look
 * like an invalid selection.
 */
export function availableInSet(plan: ActionSetPlan, slotIndex: number, picks: ActionSetPicks): ActionSetOption[] {
  const taken = new Set((picks[plan.set.id] ?? []).filter((name, i) => i !== slotIndex && name));
  return plan.candidates.filter(c => !taken.has(c.name));
}

/** Slots still empty, as "Elemental package slot 2" labels — what a generate button reports. */
export function unfilledActionSlots(plan: ActionSetPlan[], picks: ActionSetPicks): string[] {
  return plan.flatMap(p =>
    (picks[p.set.id] ?? []).flatMap((name, i) => (name ? [] : [`${p.set.label} slot ${i + 1}`])),
  );
}

/**
 * One BODY built from the template: a copy whose pools have collapsed to the chosen actions.
 *
 * Candidates that were not picked are removed outright — they are options this body did not
 * take, and leaving them on the card would offer the DM an action the creature cannot use.
 * Anything with no `setId` is untouched, so fixed attacks, traits and reactions all survive.
 *
 * ⚠ THE TEMPLATE IS NOT MUTATED. Every body is a fresh copy and the template stays generic:
 * one mirror per adventurer, each different, all from the same authored shape. Mutating here
 * would make the first body generated permanent for every body after it.
 */
export function buildBodyFromTemplate(
  template: MainMonsterTemplate,
  picks: ActionSetPicks,
  opts?: { name?: string; templateIdSuffix?: string },
): MainMonsterTemplate {
  const chosen = new Set(Object.values(picks).flat().filter((n): n is string => Boolean(n)));
  return {
    ...template,
    templateId: opts?.templateIdSuffix ? `${template.templateId}:${opts.templateIdSuffix}` : template.templateId,
    ...(opts?.name ? { name: opts.name } : {}),
    // A generated body is a concrete creature, never itself a template to build more from.
    isTemplate: undefined,
    actionSets: undefined,
    // An action survives when ITS OPTION was chosen — so a picked package brings all three of
    // its spells, not just the one whose name happened to match.
    actions: (template.actions ?? []).filter(a => !a.setId || chosen.has(a.setOption?.trim() || a.name)),
  };
}

/**
 * Every value the body's chosen options supply, flattened into one lookup.
 *
 * Later sets win on a name collision, which is only reachable if a DM names two sets' variables
 * the same — an unusual enough choice that a rule beats a crash.
 */
export function optionVarsFor(template: MainMonsterTemplate, picks: ActionSetPicks | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const set of template.actionSets ?? []) {
    const chosen = (picks?.[set.id] ?? []).filter(Boolean) as string[];
    for (const name of chosen) Object.assign(out, set.optionVars?.[name] ?? {});
  }
  return out;
}

/**
 * Substitute `{name}` tokens in one action's text fields.
 *
 * ⚠ AN UNKNOWN TOKEN IS LEFT ALONE. Blanking it would turn "2d6 {primry}" into "2d6" — damage
 * with no type, which reads as correct and is not. Left in place, the typo is visible on the card.
 */
function substituteVars<T extends Record<string, unknown>>(action: T, vars: Record<string, string>): T {
  if (Object.keys(vars).length === 0) return action;
  const fix = (s: unknown) =>
    typeof s === "string" ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
  return {
    ...action,
    name: fix((action as { name?: unknown }).name),
    damage: fix((action as { damage?: unknown }).damage),
    roll: fix((action as { roll?: unknown }).roll),
    save: fix((action as { save?: unknown }).save),
    text: fix((action as { text?: unknown }).text),
  } as T;
}

/**
 * One concrete creature from a template plus a body's authored choices.
 *
 * This is where a "Mirror of Thayla" actually becomes a stat block: the template's locked stats
 * carry through untouched, the archetype reshapes the ability spread, the action pools collapse
 * to what this body took, and the bond rides along.
 *
 * ⚠ STATS ARE NOT NEGOTIABLE HERE. AC, HP and speed come from the template and nothing in a
 * body's choices can move them — *"it would give them the 5 with the locked stats and only the
 * choices of the templet."* Every mirror is AC 15 / 90 HP; what differs is archetype, package,
 * bond, and which actions it took.
 *
 * ⚠ THE ARCHETYPE RESHAPES, IT DOES NOT GENERATE. `redistributeAbilityEntries` deals the
 * template's OWN six scores into the archetype's priority order — the same dealing the creator's
 * "♻ Reshape" button does, and read off the same Elemental Mirror ABS table. A body never
 * invents a score the template did not have.
 */
export function materializeTemplateBody(
  template: MainMonsterTemplate,
  body: {
    id: string;
    name: string;
    archetype?: MonsterArchetype;
    actionPicks?: ActionSetPicks;
    bond?: MonsterBond;
  },
): MainMonsterTemplate {
  const built = buildBodyFromTemplate(template, body.actionPicks ?? {}, {
    // The naming set wins over a stored name: the name is a CONSEQUENCE of the element pick,
    // so an old label left behind by an earlier choice must not survive the change.
    name: bodyNameFor(template, body.actionPicks, body.name),
    templateIdSuffix: body.id,
  });
  /**
   * The element decides the Claws' damage type and the Guard's immunities, so the substitution
   * runs over EVERY action the body kept — the always-on ones especially, since those are exactly
   * the actions that cannot be authored per element without authoring six of each.
   */
  const vars = optionVarsFor(template, body.actionPicks);
  /**
   * ⚠ RESOLVE @VARS AGAINST THE FINISHED BODY, NOT THE TEMPLATE.
   *
   * The archetype reshapes the ability scores, so a Guardian body and a Bruiser body built from
   * one template have DIFFERENT highest stats and therefore different @MAIN. Resolving before the
   * reshape would give every body the template array’s modifiers and quietly hand them all the
   * same attack bonus — the exact silent-wrong-number failure this resolver exists to end.
   */
  const reshaped: MainMonsterTemplate = {
    ...built,
    ...(body.archetype
      ? { abilities: redistributeAbilityEntries(built.abilities, body.archetype), stats: { ...built.stats, archetype: body.archetype } }
      : {}),
  };
  /**
   * ⚠ TRAITS AND REACTIONS TOO, not just actions.
   *
   * Elemental Guard is a TRAIT — "immune to {primary} and {secondary} damage" — and it is the
   * first thing a mirror needs the element for. Substituting only over `actions` left the one
   * feature the element package exists to drive still printing its own placeholders.
   */
  const finish = <T extends { roll?: string; damage?: string; save?: string }>(list: T[] | undefined) =>
    (list ?? []).map(a => resolveMonsterActionFormulas(substituteVars(a, vars), reshaped));

  /**
   * ⚠ TYPED RESPONSES TOO — the element decides what the BODY resists, not just what it deals.
   *
   * Christopher, 2026-09-01: *"the front line should be ice, earth and nature, these have
   * resistance to bludgeoning … and the back line has resistance to slashing and piercing as well
   * as their intended elements having the alternating."*
   *
   * That is per-body and per-packet, exactly as V2.2's handoff requires — *"this is per target
   * body and per damage packet. Do not create one universal Mirror resistance profile."* Which
   * means it belongs in `damageResponses`, and substitution never reached them: it ran over
   * actions, traits and reactions only, so a `{physical}` row would have shipped its own
   * placeholder as a damage type.
   *
   * ⚠ AN UNRESOLVED PLACEHOLDER IS DROPPED, NOT PRICED. A template with no pick yet leaves
   * `{physical1}` in place, and `normalizeDamageType` would report that as an unreadable type on
   * every unbuilt Mirror. A row whose type is still a placeholder is not yet a fact about anything.
   */
  // ⚠ SUBSTITUTED DIRECTLY. `substituteVars` fixes a fixed list of action FIELDS — name, text,
  // damage, roll, save — and `type` is not one of them, so routing through it silently did nothing.
  const fillType = (s: string) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const responses = (built.stats.damageResponses ?? [])
    .map(r => ({ ...r, type: fillType(r.type ?? "") }))
    .filter(r => r.type.trim() !== "" && !r.type.includes("{"));

  return {
    ...built,
    stats: { ...built.stats, damageResponses: responses },
    actions: finish(built.actions),
    traits: finish(built.traits),
    reactions: finish(built.reactions),
    ...(body.bond ? { bond: body.bond } : {}),
    ...(body.archetype
      ? {
        abilities: redistributeAbilityEntries(built.abilities, body.archetype),
        stats: { ...built.stats, archetype: body.archetype },
      }
      : {}),
  };
}

/**
 * The name a body carries, derived from the set marked `namesBody`.
 *
 * *"it should be X mirror where X is the element it is chosen in the templet."* The name is a
 * consequence of a choice already made, so it is computed rather than typed — a DM cannot end up
 * with an "Earth Mirror" carrying the Ice package.
 *
 * Falls back to the body's own name (then the template's) when nothing names it: an ordinary
 * template whose bodies are just called what the DM called them still works.
 */
export function bodyNameFor(
  template: MainMonsterTemplate,
  picks: ActionSetPicks | undefined,
  fallback?: string,
): string {
  const namingSet = (template.actionSets ?? []).find(s => s.namesBody);
  const pick = namingSet ? (picks?.[namingSet.id] ?? []).find(Boolean) : undefined;
  if (!namingSet || !pick) return fallback?.trim() || template.name;
  return (template.bodyNameFormat || "{pick} {name}")
    .replace(/\{pick\}/g, pick)
    .replace(/\{name\}/g, template.name)
    .trim();
}
