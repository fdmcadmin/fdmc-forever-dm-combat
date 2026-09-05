/**
 * CONDITION RESOLVER - the D&D mod's copy of the workbook's condition decomposition.
 *
 * ⚠ GENERATED from `Broken_Chain_V3_0_Feat_Pricing_Recovery.xlsx` (sheet "Condition Resolver")
 * by `scripts/gen-condition-resolver.mjs`. Do not hand-edit.
 *
 * ⚠ THIS IS MOD CONTENT, NOT ENGINE. Conditions are a 5e concept.
 *
 * ── THE RULE THIS TABLE EXISTS TO ENFORCE ───────────────
 *   *"Condition names are aliases. Price the decomposed consequences; never use a universal
 *   condition multiplier."*
 *
 * Frightened is an attack penalty AND a reachability restriction. Paralyzed is lost actions AND
 * advantage against AND a critical rider. A single "Frightened multiplier" has already thrown the
 * parts away, and the parts are what the runtime resolves against real bodies.
 *
 * ── COVERAGE ─────────────────────
 *   15 conditions · channels: attack, attack + reachability, attack / legality, legality, lost actions, lost actions + attack, lost actions + attack/save, lost actions + sustain, movement + attack, movement + attack/save, reachability, roll/state, targeting, targeting / attack
 */

export type ConditionRule = {
  /** The condition as the ruleset names it. */
  condition: string;
  /** Where its cost lands first - attack, targeting, lost actions, movement, legality. */
  channel: string;
  /** What it actually does in a fight, in the workbook's words. */
  consequence: string;
  /** The primitive IDs it decomposes into. This is what a pricer resolves, never the name. */
  decomposition: string;
  /** What must be known before any of it can be priced. Missing context is NEEDS_INPUT. */
  requiredContext: string;
};

export const CONDITION_RULES: readonly ConditionRule[] = [
  {
    condition: "Blinded",
    channel: "attack / legality",
    consequence: "Own attacks disadvantage; attacks against it advantage; sight-required effects may be illegal.",
    decomposition: "blindness",
    requiredContext: "duration; repeat/end save; senses"
  },
  {
    condition: "Charmed",
    channel: "targeting",
    consequence: "Apply harmful-target restriction against charmer; authored extra control remains separate.",
    decomposition: "charmed / forced_targeting",
    requiredContext: "charmer; duration; extra clauses"
  },
  {
    condition: "Deafened",
    channel: "legality",
    consequence: "Usually no combat price unless an action/trigger requires hearing.",
    decomposition: "feature legality",
    requiredContext: "hearing-dependent effects"
  },
  {
    condition: "Frightened",
    channel: "attack + reachability",
    consequence: "Attacks/checks disadvantage while source visible; cannot willingly approach.",
    decomposition: "frightened",
    requiredContext: "visibility; distance; ranged options"
  },
  {
    condition: "Grappled",
    channel: "reachability",
    consequence: "Speed 0.",
    decomposition: "grappled_speed_zero",
    requiredContext: "position; action reach/range; escape rule"
  },
  {
    condition: "Incapacitated",
    channel: "lost actions",
    consequence: "Remove actions/bonus actions/reactions according to ruleset.",
    decomposition: "stunned_or_incapacitated",
    requiredContext: "duration; repeat/end save"
  },
  {
    condition: "Invisible",
    channel: "targeting / attack",
    consequence: "Apply invisibility targetability/attack matrix and reveal rules.",
    decomposition: "invisibility_or_concealment",
    requiredContext: "detection; special senses; reveal"
  },
  {
    condition: "Paralyzed",
    channel: "lost actions + attack",
    consequence: "Incapacitated/immobile; attacks against advantage; qualifying nearby hits may crit.",
    decomposition: "stunned_or_incapacitated + critical_rider",
    requiredContext: "duration; attacker distance"
  },
  {
    condition: "Petrified",
    channel: "lost actions + sustain",
    consequence: "Incapacitated/immobile plus authored defense changes.",
    decomposition: "stunned_or_incapacitated + typed defenses",
    requiredContext: "duration; defense profile"
  },
  {
    condition: "Poisoned",
    channel: "attack",
    consequence: "Every eligible attack at disadvantage for duration.",
    decomposition: "condition_poisoned",
    requiredContext: "duration; repeat/end save"
  },
  {
    condition: "Prone",
    channel: "movement + attack",
    consequence: "Standing costs half speed; own attacks disadvantage; incoming near/far matrix.",
    decomposition: "prone",
    requiredContext: "movement; position; attack mix"
  },
  {
    condition: "Restrained",
    channel: "movement + attack/save",
    consequence: "Speed 0; own attacks disadvantage; incoming attacks advantage; DEX saves disadvantage.",
    decomposition: "restrained",
    requiredContext: "duration; escape/repeat saves"
  },
  {
    condition: "Stunned",
    channel: "lost actions + attack/save",
    consequence: "Incapacitated/immobile; incoming attacks advantage; STR/DEX save consequences.",
    decomposition: "stunned_or_incapacitated",
    requiredContext: "duration; repeat/end save"
  },
  {
    condition: "Unconscious",
    channel: "lost actions + attack",
    consequence: "Incapacitated, prone, immobile; incoming advantage; nearby qualifying hits may crit.",
    decomposition: "stunned_or_incapacitated + prone + critical_rider",
    requiredContext: "wake/end rule"
  },
  {
    condition: "Exhaustion / staged penalty",
    channel: "roll/state",
    consequence: "Price only the selected ruleset/version's actual stage effects event by event.",
    decomposition: "roll modifier / movement / HP state",
    requiredContext: "ruleset version; stage"
  }
];

/*
 * ⚠ ONE LOOKUP SHIPS, AND ONLY BECAUSE SOMETHING CALLS IT. A resolveCondition(name) was
 * written here and removed again when check:wiring failed it as a NEW ORPHAN EXPORT - the same
 * rule that took knownShortRestClass out of gen-short-rest-rules and only let it back when
 * shortRestRecovery needed it. Add it back WITH the code that needs it, not before.
 */
/** Every condition named anywhere in a piece of authored text, in the order the table lists them. */
export function conditionsNamedIn(text: string): ConditionRule[] {
  const hay = String(text ?? "").toLowerCase();
  if (!hay) return [];
  return CONDITION_RULES.filter(r => hay.includes(r.condition.toLowerCase()));
}
