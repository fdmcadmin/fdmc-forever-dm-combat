import type { MonsterCombatCandidate, MonsterReaderAction } from "../MonsterJconScanner";
// Type-only (erased at compile), so this does not create a runtime import cycle with
// encounterRounds.ts, which imports MonsterClassification back from here.
import type { MonsterDefense } from "../../encounter-band/encounterRounds";

export type MainMonsterVisibilityState = "hidden" | "label-only" | "condition" | "hp-bar" | "full";

/**
 * How big a threat a creature is, in the campaign's own vocabulary.
 *
 * This exists because `kind: "monster" | "npc" | "boss"` was doing two unrelated jobs —
 * card styling AND threat weight — and answered neither well. `kind: "boss"` was worth a
 * hidden ×1.6 in the old threat model, which is how 2× Lesser Wendigo (a MID-BOSS you
 * field two of) got rated "Hard" for a party of four and then died in 4 rounds.
 *
 * Keep the two separate: `kind` = what it IS (creature vs NPC, drives the card).
 * `classification` = how big a threat it is (drives the expected fight length).
 */
export type MonsterClassification =
  | "normal"
  | "strong"
  | "elite"
  | "mid-boss"
  | "act-boss"
  /** The final three bosses of the story — the longest fights in the campaign.
   *  UI label: "Major Story Boss" (Christopher, Monster Gate). */
  | "final-boss";

/**
 * How a creature FIGHTS — the six FDMC styles (Monster Gate WS-A / A1).
 * A THIRD axis, distinct from both `kind` (what it is — drives the card) and
 * `classification` (how big a threat — drives fight length). The archetype does not
 * generate ability scores: scores come from the CHASSIS (or the encounter document),
 * and swapping the archetype REDISTRIBUTES that same score pool into a new shape
 * (see `creator/monsterCreatorModel.ts`).
 */
export type MonsterArchetype =
  | "bruiser"      // STR — brute, giant, mauler
  | "skirmisher"   // DEX — hunter, mobile striker
  | "guardian"     // CON — endurance, tank, undead wall
  | "tactician"    // INT — caster, controller, planner
  | "mystic"       // WIS — predator, divine/nature mystic
  | "commander";   // CHA — presence, leader, fear

export type MainMonsterTemplate = {
  templateId: string;
  name: string;
  encounterId?: string;
  encounterLabel?: string;
  stats: {
    kind: "monster" | "npc" | "boss";
    ac: number | string;
    maxHp: number;
    speed: string;
    /** Attacks this creature makes per turn. Set it here and the multiattack counter uses
     *  it directly — no action needs to be named "Multiattack". Falls back to the
     *  attackCount on an action when unset. */
    attacksPerTurn?: number;
    /**
     * Effective-HP multiplier from this creature's KIT, for the rounds-to-kill estimate.
     * Raw HP ÷ party DPR badly under-counts anything with resistances, teleports, or
     * control: the Wendigo Wight's aura + Hunger Leap + legendary-driven downs cost the
     * party ~25% of its uptime, so 340 raw plays like ~450 (1.37). 1.0 (or unset) = a
     * static punching bag that takes every hit.
     *
     * These are ESTIMATES read off stat blocks, not measurements — the widest error bar
     * in the encounter model. They live here, as visible data, precisely so they can be
     * corrected from real fights instead of hiding in code the way BOSS_MULT did.
     */
    kitMultiplier?: number;
    /**
     * ITEMISED defensive traits — the effective-HP side of the fight-length check, split out
     * of the old single `kitMultiplier` so each number means exactly one thing.
     *
     * AC is NOT in here: armour scales the party's damage (an offensive-side term computed
     * from `ac`), while these scale the creature's HP. A second life and a high AC are
     * different kinds of durable and must never share a dial.
     *
     * Multipliers compose. Each entry should carry the arithmetic in its `note` so a later
     * session can re-check it instead of trusting it.
     */
    defenses?: readonly MonsterDefense[];
    /**
     * How big a threat this creature is — drives the expected fight length (see
     * `ROUND_BAND` in `encounter-band/encounterRounds.ts`). Separate from `kind`,
     * which is only what the thing IS (creature vs NPC) and drives the card.
     *
     * The encounter's band comes from the HIGHEST classification it fields, so a
     * mid-boss with chaff is judged as a mid-boss fight. Unset = "normal".
     */
    classification?: MonsterClassification;
    /** How it FIGHTS — the six FDMC styles. First-class + editable after creation
     *  (Monster Gate A1; was flattened into the old JCON subtitle). */
    archetype?: MonsterArchetype;
    /** Creature type — "undead", "beast", "fiend"… First-class + editable after
     *  creation (Monster Gate A1; deferred item 1). */
    creatureType?: string;
    /** Size category — Tiny/Small/Medium/Large/Huge/Gargantuan. */
    size?: string;
    /** Legendary actions per round (Monster Gate A6). Actions carrying a
     *  `legendaryCost` spend from this pool; unset = no legendary actions. */
    legendaryPerRound?: number;
    /** Spell slots this creature has, per level. A slot-costed action (see
     *  MonsterReaderAction.spellSlotLevel) spends from the matching pool. Casters only. */
    spellSlots?: { level: number; max: number }[];
    /** The skills THIS creature actually has, with their modifiers. Per-creature because a
     *  Frost-Weaver and a Pale Drifter share no skill list — the card previously hardcoded
     *  Stealth/Perception/Acrobatics for every creature alike. Unset = derive nothing. */
    skills?: { label: string; modifier: number }[];
  };
  /** `save` is the saving-throw modifier when the creature is PROFICIENT in that save;
   *  omit it and the save equals the ability modifier. */
  abilities: { label: string; value: string; save?: number }[];
  traits: MonsterReaderAction[];
  actions: MonsterReaderAction[];
  reactions: MonsterReaderAction[];
  resources: { id: string; name: string; current?: number; max?: number; reset?: string; note?: string }[];
  notes: string[];
  visibility: {
    defaultState: MainMonsterVisibilityState;
    hiddenName: string;
    revealedName: string;
  };
};

export type MainEncounterMonsterInstance = MonsterCombatCandidate & {
  instanceId: string;
  templateId: string;
  displayName: string;
  hiddenName: string;
  revealedName: string;
  isNameRevealed: boolean;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  status: string;
  visibilityState: MainMonsterVisibilityState;
  templateRef: string;
};

export function isStandardMonsterAction(action: MonsterReaderAction): boolean {
  if (action.kind === "trait" || action.kind === "reaction") {
    return false;
  }

  const economyCost = (action as MonsterReaderAction & { economyCost?: string }).economyCost;
  if (economyCost && economyCost !== "action") {
    return false;
  }

  return action.kind === "action" || action.kind === "attack" || action.kind === "spell";
}

function monsterActionMentionedInText(actionName: string, sourceText: string): boolean {
  const normalizedAction = actionName.trim().toLowerCase();
  const normalizedSource = sourceText.trim().toLowerCase();

  return Boolean(normalizedAction) && normalizedSource.includes(normalizedAction);
}

/**
 * Multiattack is driven by the creature's data, not by what its action is called.
 *
 * `attacksPerTurn` on the creature wins when set. Otherwise any action declaring
 * `attackCount > 1` supplies the counter, whatever its name — "Multiattack", "Raking
 * Multiattack" and "Hunger Multiattack" all count. The earlier rule required the name to
 * equal "multiattack" exactly, so every creature with a flavored multiattack name silently
 * lost its counter.
 */
export function deriveMonsterActionCounter(
  actions: MonsterReaderAction[],
  attacksPerTurn?: number,
): MonsterCombatCandidate["actionCounter"] {
  const explicitTotal = typeof attacksPerTurn === "number" && attacksPerTurn > 1
    ? Math.floor(attacksPerTurn)
    : undefined;
  const multiattackAction = actions.find((action) => (action.attackCount ?? 0) > 1);
  const total = explicitTotal ?? multiattackAction?.attackCount;

  if (!total || total < 2) {
    return undefined;
  }

  // With attacksPerTurn set and no multiattack-ish action, fall back to naming the counter
  // after the creature's own attacks rather than a non-existent "Multiattack" action.
  const sourceName = multiattackAction?.name ?? "Multiattack";
  const multiattackText = `${sourceName} ${multiattackAction?.text ?? ""}`;
  const referencedStandardActions = actions
    .filter((action) => action.name !== sourceName && isStandardMonsterAction(action))
    .filter((action) => monsterActionMentionedInText(action.name, multiattackText))
    .map((action) => action.name);
  // "Two Rime Claw attacks, or casts two Rime Bolts" is a CHOICE, not a combo — joining
  // those with "+" reads as one of each. The ", or" wording marks the choice; a bare "or"
  // is not enough ("one Dagger attack (melee or thrown)" is still a combo).
  const joiner = /,\s*or\b/i.test(multiattackAction?.text ?? "") ? " or " : " + ";
  const label = referencedStandardActions.length > 0
    ? `${sourceName}: ${referencedStandardActions.join(joiner)}`
    : `${sourceName} x${total}`;

  return {
    label,
    total,
    remaining: total,
    sourceActionName: sourceName,
    actionNames: referencedStandardActions,
  };
}

export const MIRAGE_STALKER_TEMPLATE: MainMonsterTemplate = {
  templateId: "mirage-stalker-act-1-boss",
  name: "Mirage Stalker",
  encounterId: "act1-boss",
  encounterLabel: "Act 1 Boss",
  stats: {
    kind: "boss",
    ac: 14,
    maxHp: 100,
    speed: "50 ft",
  },
  abilities: [
    { label: "STR", value: "19 (+4)" },
    { label: "DEX", value: "14 (+2)" },
    { label: "CON", value: "16 (+3)" },
    { label: "INT", value: "4 (-3)" },
    { label: "WIS", value: "12 (+1)" },
    { label: "CHA", value: "6 (-2)" },
  ],
  traits: [
    {
      name: "Phantom Step",
      kind: "trait",
      text: "When the Stalker moves, it leaves an afterimage. Attack rolls against the Stalker have disadvantage until it takes damage that round. Uses and recharge are tracked by the DM.",
    },
    {
      name: "Mirage Hide",
      kind: "trait",
      text: "The Stalker is difficult to read in broken light and corrupted ruins. Use as encounter fiction/visibility support, not as an automatic rules resolver.",
    },
  ],
  actions: [
    {
      name: "Multiattack",
      kind: "action",
      text: "The Mirage Stalker makes one Phantom Rake attack and one Hollow Stamp attack.",
      attackCount: 2,
    },
    {
      name: "Phantom Rake",
      kind: "attack",
      roll: "1d20 + 6",
      damage: "2d8 + 4 piercing",
      text: "Reach 10 ft. The strike lands a half-second before the creature appears to move.",
    },
    {
      name: "Hollow Stamp",
      kind: "attack",
      roll: "1d20 + 6",
      damage: "2d6 + 4 bludgeoning",
      text: "Reach 5 ft. The impact sounds too hollow for the stone beneath it.",
    },
    {
      name: "Phantom Charge",
      kind: "attack",
      roll: "1d20 + 6",
      damage: "2d8 + 4 piercing",
      save: "DC 14 STR on hit after 20 ft movement; fail: prone + push 10 ft",
      text: "Recharge 5–6. Hit-gated rider only; do not fire rider on click or miss.",
    },
  ],
  reactions: [
    {
      name: "Phantom Lunge",
      kind: "reaction",
      roll: "1d20 + 6",
      damage: "2d6 + 4 bludgeoning",
      text: "When a creature within 10 ft misses because of Phantom Step's afterimage, the Stalker can make one Hollow Stamp attack.",
    },
  ],
  resources: [
    {
      id: "phantom-step-uses",
      name: "Phantom Step",
      current: 2,
      max: 2,
      reset: "encounter",
      note: "DM tracked defensive layer.",
    },
    {
      id: "phantom-charge-recharge",
      name: "Phantom Charge Recharge",
      reset: "start-turn",
      note: "Roll recharge 5–6 at the start of the creature's turn.",
    },
  ],
  notes: [
    "First Main absorption test monster from Monster Cards BUILD 0.3.0c.",
    "Template/source record is separate from encounter instance HP, visibility, and action usage state.",
  ],
  visibility: {
    defaultState: "hp-bar",
    hiddenName: "Unrevealed creature",
    revealedName: "Mirage Stalker",
  },
};

export function makeMonsterInstanceId(templateId: string) {
  return `${templateId}-instance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createEncounterMonsterInstance(template: MainMonsterTemplate, displayName = template.name): MainEncounterMonsterInstance {
  const instanceId = makeMonsterInstanceId(template.templateId);

  return {
    id: instanceId,
    instanceId,
    templateId: template.templateId,
    displayName,
    hiddenName: template.visibility.hiddenName,
    revealedName: template.visibility.revealedName,
    isNameRevealed: false,
    templateRef: template.templateId,
    name: displayName,
    kind: template.stats.kind,
    hp: `${template.stats.maxHp}/${template.stats.maxHp}`,
    currentHp: template.stats.maxHp,
    maxHp: template.stats.maxHp,
    tempHp: 0,
    status: "ready",
    visibilityState: template.visibility.defaultState,
    ac: String(template.stats.ac),
    speed: template.stats.speed,
    sourceFlavor: "FDMC Monster Template",
    abilityScores: template.abilities,
    actions: template.actions,
    reactions: template.reactions,
    traits: template.traits,
    spells: [],
    attacksPerTurn: template.stats.attacksPerTurn,
    classification: template.stats.classification,
    creatureType: template.stats.creatureType,
    archetype: template.stats.archetype,
    skills: template.stats.skills,
    spellSlots: template.stats.spellSlots,
    actionCounter: deriveMonsterActionCounter(template.actions, template.stats.attacksPerTurn),
    usedActionNames: [],
  };
}

export function makePlayerSafeMonsterLabel(instance: MainEncounterMonsterInstance) {
  if (!instance.isNameRevealed && (instance.visibilityState === "hidden" || instance.visibilityState === "label-only" || instance.visibilityState === "condition" || instance.visibilityState === "hp-bar")) {
    return instance.hiddenName || "Unrevealed creature";
  }

  return instance.revealedName || instance.displayName || instance.name;
}
