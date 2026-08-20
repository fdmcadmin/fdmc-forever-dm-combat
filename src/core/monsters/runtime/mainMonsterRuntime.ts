import type { MonsterCombatCandidate, MonsterReaderAction } from "../MonsterJconScanner";

/**
 * One named defensive trait and what it is worth as an effective-HP multiplier.
 *
 * ITEMISED ON PURPOSE. "Reknit in the Cold returns it at 40% once" is checkable at the table;
 * a bare 1.84 is not. `rosterFromLibrary` converts each of these into a checker sustain factor
 * — `ehpMultiplier: 1.40` is the workbook's `contribution: 0.40`, and the two columns differ by
 * exactly 1.0 — and the checker then combines them as a PRODUCT, rejecting duplicate stack
 * groups so one effect cannot be credited twice.
 *
 * ⚠ FOR A CAMPAIGN CREATURE THE WORKBOOK HAS MEASURED, ITS `tm` WINS OVER THIS. These stay as
 * the DM-facing itemisation and as the pricing for homebrew, but they do not get to contradict
 * a calibrated figure. Lives here rather than in the deleted `encounterRounds.ts`, next to the
 * `MonsterClassification` it used to import back — the cycle is gone with it.
 */
export type MonsterDefense = {
  /** The trait's actual name, as printed on the stat block. Doubles as its stack group. */
  name: string;
  /** Effective-HP multiplier. 1.40 = "this trait is worth 40% more HP". */
  ehpMultiplier: number;
  /** Why it is worth that — the arithmetic, so a future session can re-check it. */
  note?: string;
};

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
/**
 * What a creature IS — its D&D creature type.
 *
 * This used to be `"monster" | "npc" | "boss"`, which was three different questions in one
 * field: a type slot, a THREAT level ("boss"), and a disposition ("npc"). That is why the
 * Pale Drifter could read kind "boss" and classification "elite" at the same time and both
 * be "true" — they were answering different questions with contradictory words.
 *
 * Threat now lives entirely in `classification`. This field is identity only, and uses the
 * official 5e creature types because publication requires one of them — a campaign flavour
 * name like "cold-woven entity" is prose, not a type (the Frozen Cloak publishes as a fiend
 * on its Shadow Demon chassis). `npc` is kept as a value at Christopher's call.
 *
 * `unspecified` exists so an un-migrated creature is VISIBLY incomplete in the editor
 * rather than silently defaulting to a plausible-but-wrong type.
 */
export type MonsterKind =
  | "aberration" | "beast" | "celestial" | "construct" | "dragon" | "elemental"
  | "fey" | "fiend" | "giant" | "humanoid" | "monstrosity" | "ooze" | "plant" | "undead"
  | "npc"
  | "unspecified";

/** Every value, in menu order — the editor's dropdown reads from this. */
export const MONSTER_KINDS: readonly MonsterKind[] = [
  "aberration", "beast", "celestial", "construct", "dragon", "elemental",
  "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead",
  "npc", "unspecified",
];

export type MonsterClassification =
  | "normal"
  | "strong"
  | "elite"
  | "mid-boss"
  | "act-boss"
  /** The final three bosses of the story — the longest fights in the campaign.
   *  UI label: "Major Story Boss" (Christopher, Monster Gate). */
  | "final-boss";

export const CLASSIFICATION_LABEL: Record<MonsterClassification, string> = {
  normal: "Normal",
  strong: "Strong",
  elite: "Elite",
  "mid-boss": "Mid boss",
  "act-boss": "Act boss",
  "final-boss": "Final boss",
};

/** Weakest → strongest. A fight's tier comes from the strongest creature in it. */
export const CLASSIFICATION_ORDER: readonly MonsterClassification[] = [
  "normal", "strong", "elite", "mid-boss", "act-boss", "final-boss",
];

/**
 * The higher of two tiers — a declared encounter tier may only ESCALATE above what its roster
 * justifies, never soften it.
 */
export function maxClassification(
  a: MonsterClassification | undefined,
  b: MonsterClassification,
): MonsterClassification {
  if (!a) return b;
  return CLASSIFICATION_ORDER.indexOf(a) >= CLASSIFICATION_ORDER.indexOf(b) ? a : b;
}

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
  /**
   * Set when a DM DELIBERATELY saved an edit to a CAMPAIGN creature.
   *
   * ⚠ This is what lets a stored copy outrank the shipped template. Without it, any stale
   * localStorage entry with a matching templateId silently shadowed corrected campaign data —
   * which is how a Hollow Warden saved by an older build kept reading 78 HP / AC 18 after the
   * library had shipped 76 / 16 all along. An unmarked stored copy is treated as a stale seed.
   *
   * Never author this in the bundled library; it is written by the editor on save.
   */
  dmEdited?: { at: string };
  stats: {
    kind: MonsterKind;
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
    /** Party damage uptime against this creature (tempo tax). 1.0 = attacks freely. */
    damageUptime?: number;
    /**
     * How big a threat this creature is — drives what the fight should COST in
     * characters (see `EXPECTED_LETHALITY` in `encounter-band/encounterChecker.ts`).
     * Separate from `kind`, which is only what the thing IS (creature vs NPC) and
     * drives the card.
     *
     * ⚠ A TIER IS A PRICE, NOT A CLOCK (Christopher, 2026-08-14). A mid-boss might last
     * three rounds and down one person; an act boss four rounds and down two. Round
     * length is still computed and shown, but nothing is judged by it.
     *
     * The encounter's tier comes from the HIGHEST classification it fields, so a
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
    /**
     * Challenge Rating. A printed statblock fact, and the source of the creature's PROFICIENCY
     * BONUS — the monster table steps at exactly the same points as the character one (CR 0–4 →
     * +2, 5–8 → +3, 9–12 → +4 …), so `proficiencyBonus` is reused rather than reimplemented.
     */
    cr?: number;
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
  /**
   * ⚠ PROFICIENCY IS A FLAG, EXACTLY AS ON THE PLAYER SIDE. `saveProficient` adds the creature's
   * proficiency bonus (derived from CR) to the ability modifier; `save` stays supported as the
   * explicit escape hatch and still wins when set.
   *
   * The typed-number-only shape was the whole problem: nothing in the editor ever offered it, so
   * every creature in the library saved at its bare ability modifier. A CR 9 boss proficient in
   * WIS should save at +4 over its modifier, and the checker was pricing it as if it were not
   * proficient at all — which under-prices every control effect aimed at it.
   */
  abilities: { label: string; value: string; save?: number; saveProficient?: boolean }[];
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
  /** Challenge Rating — the source of this creature's proficiency bonus for saves. */
  cr?: number;
};

/**
 * MID-FIGHT PACING DIAL — rescale a live creature's HP without the players seeing a jump.
 *
 * This is NOT the party-size band (`hpForPartySize`), which is Lever 1 and decided in prep.
 * This is the DM's live correction when a fight is not landing the way it was built to: the
 * Wight has downed two people and the table needs a win it can feel good about, or the dice
 * ran cold and an act boss is dying in three rounds like a normal fight.
 *
 * The alternative a DM is otherwise stuck with is lying — quietly dealing less damage than
 * the PC rolled, or "healing" the creature. Both are visible: the bar stops matching what
 * the table just did. This scales BOTH current and max by the same factor, so the bar sits
 * at exactly the same fraction the instant it is applied — nothing moves, nothing rewinds.
 * What changes is the PACE: every hit after it is a larger share of a smaller bar, so the
 * fight shortens without a single number the players can catch.
 *
 * Rounds, and never drops a living creature below 1 HP — a pacing tool must not kill.
 */
export function rescaleMonsterHp(
  instance: MainEncounterMonsterInstance,
  factor: number,
): MainEncounterMonsterInstance {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return instance;
  const maxHp = Math.max(1, Math.round(instance.maxHp * factor));
  const scaled = Math.round(instance.currentHp * factor);
  // A creature that was alive stays alive; a creature already at 0 stays down.
  const currentHp = instance.currentHp > 0
    ? Math.min(maxHp, Math.max(1, scaled))
    : 0;
  return { ...instance, maxHp, currentHp };
}

/**
 * Bonus-action detection reads the NAME as well as `economyCost`.
 *
 * Monster stat blocks mark the cost in the action's own name — "Rimestep (Bonus Action,
 * 1st slot)" — because that is how a printed block reads. A check that looks only at
 * `economyCost`, which monster templates do not set, files EVERY monster bonus action as a
 * main action and spends the whole action budget when it is used.
 */
export function isMonsterBonusAction(a: MonsterReaderAction): boolean {
  const ec = (a as MonsterReaderAction & { economyCost?: string }).economyCost?.toLowerCase() ?? "";
  if (ec === "bonus") return true;
  return /\(\s*bonus action/i.test(a.name ?? "");
}

/**
 * Legendary actions and legendary reactions run on OTHER creatures' turns, out of their own
 * pool — they are not part of this creature's action budget and must never cost it a swing.
 *
 * Like bonus actions, templates mark them in the NAME: "Mark Prey (Legendary Action,
 * 1/round)" reads as `kind: "action"`, so nothing but the name distinguishes it.
 */
export function isMonsterLegendaryAction(a: MonsterReaderAction): boolean {
  // `legendaryCost` is the STRUCTURED signal and comes first — it is what the Monster Creator
  // writes, and a creator-authored dragon has no reason to also put "(Legendary Action)" in
  // the name. Reading only the name filed every one of its legendary options as a normal
  // attack, handing the dragon three extra swings a turn.
  if (typeof a.legendaryCost === "number" && a.legendaryCost > 0) return true;
  const ec = (a as MonsterReaderAction & { economyCost?: string }).economyCost?.toLowerCase() ?? "";
  if (ec === "legendary") return true;
  // Name fallback for hand-authored blocks, which mark the cost in prose.
  return /\(\s*legendary/i.test(a.name ?? "");
}

/**
 * A spell is anything that spends a slot. That is the only unambiguous signal a monster stat
 * block gives — `kind: "spell"` is not set on templates, so the Frost-Weaver's Whiteout
 * (4th-level Sleet Storm) and Raise the Frozen (3rd-level Animate Dead) both read as
 * `kind: "action"`. The slot is what marks them.
 */
export function isMonsterSpellAction(a: MonsterReaderAction): boolean {
  return a.spellSlotLevel !== undefined || a.kind === "spell";
}

/**
 * Actions that cost the creature's WHOLE turn of attacks rather than one swing.
 *
 * Two kinds qualify, for the same reason — each one IS the creature's Action:
 *  · a spell action — casting is the action;
 *  · a RECHARGE action — "recharge" is not a separate economy, it is a limit on how often a
 *    normal action may be used. A dragon's Breath Weapon uses its Action for the turn and it
 *    cannot also multiattack. Unless a creature's action package explicitly says the recharge
 *    ability may be substituted for one of its attacks, it is either/or, never both.
 *
 * (An earlier pass had recharge costing a single swing. That was wrong: it let the Wight lead
 * with Hungering Leap and still take both its normal attacks.)
 */
export function isMonsterFullAction(a: MonsterReaderAction): boolean {
  return isMonsterSpellAction(a) || Boolean(a.recharge);
}

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

/**
 * The creature's action budget for a turn, and what it may spend it on.
 *
 * MULTIATTACK DOES NOT EXIST HERE. It was removed from the model entirely (13 rows deleted)
 * and replaced by `stats.attacksPerTurn` on the creature — built like a PC's Extra Attack.
 * What remained in this function was scaffolding for the deleted concept: it hunted for an
 * action declaring `attackCount > 1` (no creature declares one), scraped that action's text
 * for the names it mentioned, and fell back to labelling the counter with the literal string
 * "Multiattack". Live, every creature read "Multiattack x2" — named after a thing the design
 * had already deleted — with an empty list of what it could actually do.
 *
 * The model is Christopher's: *"claw is action and bolt is action and action count is 2 so
 * using either until that count is out."* The budget is a NUMBER on the creature; the actions
 * are just actions. Nothing needs to be named, and no text needs parsing — the DM spends the
 * count on whichever action they want.
 *
 * Eligibility is `isStandardMonsterAction`: traits and reactions never spend the budget, and
 * neither does anything carrying a non-action economy cost (a bonus-action teleport is not
 * one of your attacks).
 */
export function deriveMonsterActionCounter(
  actions: MonsterReaderAction[],
  attacksPerTurn?: number,
): MonsterCombatCandidate["actionCounter"] {
  const total = typeof attacksPerTurn === "number" && attacksPerTurn > 1
    ? Math.floor(attacksPerTurn)
    : undefined;
  if (!total) return undefined;

  // Bonus and legendary actions are not part of the attack budget at all — they run on their
  // own economy (and legendary ones on someone else's turn), so spending either must not cost
  // a swing. Traits and reactions were already out via isStandardMonsterAction.
  const eligible = actions.filter(a =>
    isStandardMonsterAction(a) && !isMonsterBonusAction(a) && !isMonsterLegendaryAction(a));
  // Spells and recharge abilities each ARE the creature's action, so they end the turn's
  // attacks rather than costing one swing out of two. See isMonsterFullAction.
  const spendable = eligible.filter(a => !isMonsterFullAction(a)).map(a => a.name).filter(Boolean);
  const fullActionNames = eligible.filter(isMonsterFullAction).map(a => a.name).filter(Boolean);

  // Name what the budget buys. Past a few options the list stops being readable on a card,
  // so it degrades to the count alone rather than wrapping to three lines.
  const label = spendable.length > 0 && spendable.length <= 3
    ? `${total} actions: ${spendable.join(" or ")}`
    : `${total} actions`;

  return {
    label,
    total,
    remaining: total,
    // No source action any more — the budget belongs to the creature, not to a named action.
    sourceActionName: undefined,
    actionNames: spendable,
    fullActionNames,
  };
}

export const MIRAGE_STALKER_TEMPLATE: MainMonsterTemplate = {
  templateId: "mirage-stalker-act-1-boss",
  name: "Mirage Stalker",
  encounterId: "act1-boss",
  encounterLabel: "Act 1 Boss",
  stats: {
    kind: "unspecified",
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
    // CR rides along so the card computes save proficiency at the creature's own bonus.
    cr: template.stats.cr,
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
    legendaryPerRound: template.stats.legendaryPerRound,
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
