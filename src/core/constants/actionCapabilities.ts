/**
 * WHAT AN ACTION'S OUTCOME MODE ACTUALLY NEEDS ASKED.
 *
 * The companion to `ITEM_TYPE_CAPABILITIES`: one table, read by every editor, saying which
 * fields a given shape of action uses. Items have been gated by type since 0.7.9.15; actions
 * never were, and the action editor grew to forty inputs with exactly four of them conditional.
 *
 * Christopher, 2026-10-11: *"the current builder has too much options for both new DMs and
 * players who are not used to working with it."* The diagnosis that came with it is the right
 * one — the app *"asks players to understand its entire mechanical system before they've even
 * described what their ability does."* Someone authoring Cure Wounds should not be walking past
 * attack formulas, crit behaviour, weapon buffs and reroll settings to reach a healing die.
 *
 * ### ⛔ THE PRINCIPLE: THE MODE DECIDES WHAT IS ASKED, NOT WHAT IS POSSIBLE
 *
 * *"We're simplifying creation, not reducing what the app can do."* Nothing here removes a
 * capability. A field this table does not list for a mode still exists, still saves, and is
 * still reachable under **Advanced** — it is simply not in the way of the ninety per cent case.
 * That is why `MODE_AGNOSTIC` below is a first-class list rather than a leftover: riders, reroll
 * sources and resource costs work in ANY mode and must never be treated as debris.
 *
 * ### Two kinds of field, and the difference matters
 *
 *   MODE-SPECIFIC   — belongs to particular modes. An attack formula on a Healing action is
 *                     dead data: nothing will ever roll it. Worth warning about.
 *   MODE-AGNOSTIC   — works whatever the mode is. A once-per-turn rider on a healing spell is
 *                     perfectly legitimate. Never warn about these.
 *
 * `strandedCapabilities` exists for exactly that distinction. Hidden values are KEPT — a mode
 * switched by accident must not destroy what someone typed — and the editor says plainly when
 * any are stranded, rather than letting them ride along invisibly into the export. That is the
 * failure Christopher named in another context: *"why is stuff like this hiding in a json for
 * export, this leads to reading these wrong."*
 */

import type { PcRollMode } from "../ui/pcActionTypes";

/**
 * A field group an action may need. Grouped by the QUESTION it asks, not by the draft key, so
 * one entry can gate several inputs that only make sense together (a save DC and the ability it
 * is rolled against are one question).
 */
export type ActionCapability =
  /** The d20 that decides a hit. */
  | "attackFormula"
  /** The d20 the CHARACTER rolls against a DC — a skill/ability check. */
  | "checkFormula"
  /** A DC the TARGET rolls against, plus which save. */
  | "saveDc"
  /** Dice that hurt. */
  | "damageFormula"
  /** What kind of damage those dice are. Never on healing — nothing is being typed. */
  | "damageType"
  /** The bigger dice on a natural 20. Only a roll that can crit has one. */
  | "critDamage"
  /** Dice that restore hit points. */
  | "healingFormula"
  /** How far away this reaches. */
  | "range"
  /** Keeps applying while the target keeps failing — only a save can "save-end". */
  | "ongoingDamage"
  /** Max-roll dice explode and roll again. */
  | "explodingDamage"
  /** More than one swing from one use. */
  | "attackRolls";

/**
 * ⚠ KEYED ON `PcRollMode`, NOT `ActionOutcomeMode`, and deliberately. The editors work in
 * `PcRollMode` (`rollModeToOutcomeMode` converts on save), so keying on the canonical type would
 * put a translation between this table and every reader of it — and a translation is where a
 * mode silently falls through to "no capabilities" and the whole form empties out.
 *
 * `reference` is the retired tag; it resolves to `passive` and is listed so a draft still
 * carrying it renders something rather than nothing.
 */
export const ACTION_CAPABILITIES: Record<PcRollMode, readonly ActionCapability[]> = {
  attack: ["attackFormula", "damageFormula", "damageType", "critDamage", "range", "attackRolls", "explodingDamage"],
  // A save-for-damage spell: the DC, what it deals, and whether it keeps dealing it.
  save: ["saveDc", "damageFormula", "damageType", "range", "ongoingDamage", "explodingDamage"],
  // A check rolls a d20 and nothing else happens mechanically — Athletics to shove.
  check: ["checkFormula", "range"],
  // Dice with no to-hit and no save: a burst, a rider someone else's hit carries.
  damageOnly: ["damageFormula", "damageType", "range", "explodingDamage"],
  /**
   * ⚠ HEALING GETS `healingFormula`, NOT `damageFormula`, AND THAT IS A FIX IN ITSELF. The two
   * share one draft field (`damage`), so the editor rendered "Damage Formula" to anyone writing
   * Cure Wounds. Same storage, honest label — see `capabilityLabel`.
   */
  healing: ["healingFormula", "range"],
  triggered: ["damageFormula", "damageType", "range", "explodingDamage"],
  // Rides a LATER roll, so it has no range and no delivery of its own.
  additive: ["damageFormula", "damageType"],
  // The click IS the action. Vow of Enmity, a stance: it spends something and rolls nothing.
  utility: ["range"],
  // Always on. Nothing is rolled; what it grants is folded into the sheet's derived stats.
  /**
   * ⚠ A PASSIVE ROLLS NOTHING, so it asks for nothing here. The AC and initiative a feat grants
   * are NOT mode-specific — a feat with an attack can still give +1 AC — so they stay governed
   * by the tab/cost gate they already had. Listing them here would have reported a perfectly
   * good Dual Wielder as "a value this mode ignores".
   */
  passive: [],
  reference: [],
};

/**
 * Fields that work in ANY mode.
 *
 * Not "everything else" — an explicit list, because the difference between a field that is
 * irrelevant here and a field that is merely advanced is the difference between warning someone
 * and nagging them. A once-per-turn rider on a healing spell is a legitimate build.
 *
 * These are never hidden on grounds of mode and never reported as stranded. They live under
 * Advanced because they are rare, not because they are wrong.
 */
export const MODE_AGNOSTIC_FIELDS = [
  "armedAttack", "weaponBuff", "combatStyle", "turnRider", "reroll", "resourceCost", "uses",
  // AC / initiative from a feat or feature: granted by HAVING it, whatever the thing rolls.
  "passiveBonuses",
] as const;

export type ModeAgnosticField = typeof MODE_AGNOSTIC_FIELDS[number];

/**
 * What to call each one where the author can see it.
 *
 * ⚠ THE ADVANCED SUMMARY IS BUILT FROM THIS LIST, not typed out beside it. A hand-written
 * summary is a second copy of the list, and the two drift the first time a field is added —
 * leaving a disclosure that promises five things and contains six.
 */
export const MODE_AGNOSTIC_LABELS: Record<ModeAgnosticField, string> = {
  armedAttack: "armed attack",
  weaponBuff: "weapon buff",
  combatStyle: "fighting style",
  turnRider: "once-per-turn rider",
  reroll: "reroll source",
  resourceCost: "resource cost",
  uses: "uses",
  passiveBonuses: "AC / initiative",
};

/** The Advanced disclosure's one-line contents, in the order the fields are laid out. */
export function advancedSummaryText(): string {
  return MODE_AGNOSTIC_FIELDS.map(f => MODE_AGNOSTIC_LABELS[f]).join(" · ");
}

/** Every capability some mode asks for — the full set this table can gate. */
export const ALL_ACTION_CAPABILITIES = [...new Set(
  Object.values(ACTION_CAPABILITIES).flat(),
)] as ActionCapability[];

/** Does this outcome mode ask for this field? */
export function actionModeAllows(mode: PcRollMode | undefined, capability: ActionCapability): boolean {
  if (!mode) return false;
  return (ACTION_CAPABILITIES[mode] ?? []).includes(capability);
}

/**
 * What to call a field in THIS mode.
 *
 * One field can be two questions. `damage` holds the dice for both a fireball and a cure wound,
 * and calling it "Damage Formula" on a healing spell is how the form taught people it was for
 * something else. The storage is unchanged; only the question is.
 */
export function capabilityLabel(capability: ActionCapability): string {
  switch (capability) {
    case "attackFormula": return "Attack Roll";
    case "checkFormula": return "Check Formula";
    case "saveDc": return "Save DC";
    case "damageFormula": return "Damage Formula";
    case "damageType": return "Damage Type";
    case "critDamage": return "Crit Damage";
    case "healingFormula": return "Healing Amount";
    case "range": return "Range";
    case "ongoingDamage": return "Ongoing damage";
    case "explodingDamage": return "Exploding dice";
    case "attackRolls": return "Attacks per use";
  }
}

/** The draft shape this module needs. Structural, so the table never depends on the editor. */
export type CapabilityProbeDraft = {
  rollMode: PcRollMode;
  attackBonus?: string | number;
  saveDc?: string | number;
  saveAbility?: string;
  damage?: string;
  damageType?: string;
  critDamage?: string;
  range?: string;
  ongoingDamage?: unknown;
  explodingDamage?: unknown;
  attackRolls?: unknown;
};

/** Is there anything in the field(s) this capability covers? */
function capabilityHasValue(draft: CapabilityProbeDraft, capability: ActionCapability): boolean {
  const filled = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
  switch (capability) {
    // `attackBonus` is the d20 box for BOTH attack and check, so a value in it is only
    // stranded when neither of those modes is live — handled by the caller's mode check.
    case "attackFormula":
    case "checkFormula": return filled(draft.attackBonus);
    case "saveDc": return filled(draft.saveDc) || filled(draft.saveAbility);
    case "damageFormula":
    case "healingFormula": return filled(draft.damage);
    case "damageType": return filled(draft.damageType);
    case "critDamage": return filled(draft.critDamage);
    case "range": return filled(draft.range);
    case "ongoingDamage": return Boolean(draft.ongoingDamage);
    case "explodingDamage": return Boolean(draft.explodingDamage);
    case "attackRolls": return filled(draft.attackRolls);
  }
}

/**
 * MODE-SPECIFIC FIELDS THAT HOLD A VALUE THIS MODE WILL NEVER READ.
 *
 * ⚠ THE POINT IS THAT THE VALUE SURVIVES. Switching a draft from Attack Roll to Healing does not
 * delete the attack formula — a mode changed by accident, or while exploring, must not destroy
 * someone's work. But a value nothing will ever roll is also not allowed to ride silently into
 * the saved action, so the editor names them and offers to clear them. Keep OR clear is the
 * author's call; what the app owes them is knowing.
 *
 * `damageFormula` / `healingFormula` share one field, so a mode that uses either is never
 * stranded by the other — the dice are the same dice.
 */
export function strandedCapabilities(draft: CapabilityProbeDraft): ActionCapability[] {
  const live = new Set(ACTION_CAPABILITIES[draft.rollMode] ?? []);
  // The shared-storage pairs: holding one means the other's box is not orphaned.
  if (live.has("damageFormula")) live.add("healingFormula");
  if (live.has("healingFormula")) live.add("damageFormula");
  if (live.has("attackFormula")) live.add("checkFormula");
  if (live.has("checkFormula")) live.add("attackFormula");
  const out = ALL_ACTION_CAPABILITIES
    .filter(c => !live.has(c))
    .filter(c => capabilityHasValue(draft, c));

  /**
   * ⚠ ONE BOX, ONE NAME. Two capabilities can share a draft field, and when NEITHER is live both
   * match — so a utility action with dice in it reported "Damage Formula, Healing Amount" for a
   * single input, and a healing action reported "Attack Roll, Check Formula" for another. The
   * author is being told how many fields to look at; counting one box twice makes that a lie.
   *
   * The first of each pair is the one named, because it is the commoner reading.
   */
  const collapse = (keep: ActionCapability, drop: ActionCapability) => {
    if (out.includes(keep) && out.includes(drop)) out.splice(out.indexOf(drop), 1);
  };
  collapse("attackFormula", "checkFormula");
  collapse("damageFormula", "healingFormula");
  return out;
}
