import type { LairSpec } from "../lair";
import type { ContentProvenance } from "../../content/contentScope";
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
  /**
   * WHICH CALIBRATED RULE THIS TRAIT IS, by the workbook's own label.
   *
   * ⚠ A TRAIT'S NAME IS ITS FLAVOUR, NOT ITS PRICE. The Grief Colossus's "Body Between" IS the
   * workbook's "Fixed prevention - 12/round" — same effect, same ×1.232313, different word. The
   * checker matched `traitRule()` on the DISPLAY name, so every campaign creature whose author gave
   * a trait a campaign name was reported as *"not a calibrated rule; its authored multiplier is
   * used as entered"* — an assumption notice on a figure that came straight out of the 58 rules.
   * Christopher: *"we have enough data that there should be no 'stated' or 'assumption' for any
   * campaign monster."* He was right; nothing was ever being guessed.
   *
   * This is RULE 2's shape, which MASTER already states for exactly this field: **the author PICKS
   * the rule; the multiplier is DERIVED from it.** Set this and the trait prices as calibrated and
   * inherits the rule's stack group — which is also what stops two differently-named traits that
   * are the same effect from stacking.
   *
   * Absent on a creature a DM built from scratch with a hand-typed multiplier, and that is the one
   * case the assumption notice is FOR.
   */
  rule?: string;
  /**
   * WHERE THIS MULTIPLIER CAME FROM, when it did not come from a calibrated rule.
   *
   * ⚠ THIS IS THE COVERAGE GATE'S FIELD. `CLEANUP-V4-PLAN.md` retired `validate:parity` — the
   * diff that once caught Frozen Sentinel, Rime Wight and Frost-Weaver carrying three invented
   * multipliers whose product was x1.867 against the workbook's x1.436 — and named its
   * replacement: *"the coverage gate now constrains WHERE a multiplier may come from (58
   * calibrated rules, `unpriced` when the workbook is silent), which is a stronger guarantee
   * than a diff."* That gate is `check:traits`, and this is what it reads.
   *
   * A defence whose multiplier is not 1.0 must carry EITHER a `rule` that resolves to one of the
   * 58 and matches it, OR one of these. A bare number with neither is what the gate rejects.
   *
   *   "workbook-profile"  the workbook's own per-creature tm column, not a trait rule
   *   "interpolated"      between two published rows, with the interpolation stated in the note
   *   "derived"           computed from the block, with the arithmetic shown in the note
   *   "uncalibrated"      hand-authored, pre-workbook, awaiting recalibration — a DECLARED debt
   *
   * "uncalibrated" is not an escape hatch. It is a signature: it says a person looked at this
   * number and knowingly left it, and the gate counts and prints every one of them on each run.
   */
  provenance?: "workbook-profile" | "interpolated" | "derived" | "uncalibrated";
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

/**
 * A bond on a CREATURE rather than a character.
 *
 * Same templates, same paths, same permanence — the difference is only that a creature does not
 * level, so its stage is authored instead of derived. See `core/types/bond.ts` for the ladder.
 */
export type MonsterBond = {
  /** Which bond, by `BondTemplate.id`. */
  templateId: string;
  /** 0=Instinct … 4=Unbroken. Mirrors are built at 2 (Metamorphosis). */
  stage: 0 | 1 | 2 | 3 | 4;
  /** The permanent path index, required from Metamorphosis up. */
  chosenPathIndex?: 0 | 1;
};

/**
 * AN ACTION SET — a pool of candidate actions and how many of them a body gets.
 *
 * Christopher: *"on veritable actions like the spells there needs to be a how many of these
 * types of actions are able to be chosen for this action set."*
 *
 * This is the ABS-array pattern applied to actions rather than ability scores: the template
 * carries every option, each body takes `pick` of them, and a taken option leaves the pool so
 * two bodies in the same set differ. Hale and the Unmarked Ranger are authored this way — every
 * spell they COULD have is written down, and which ones they walk in with is decided per body.
 *
 * ⚠ THIS GENERALISES THE SPELL-SLOT POOL, it does not replace it. A slot-costed spell already
 * pools by LEVEL (`spellSlotLevel` + `slotCandidate`), because "3 level-1 slots" is a count the
 * ruleset states. An action set is for everything the ruleset does NOT count for you — a
 * mirror's two attacks out of five, an elemental package, a chosen reaction.
 */
export type MonsterActionSet = {
  /** Stable key. Actions join a set by writing this into `setId`. */
  id: string;
  /** What the DM sees: "Elemental package", "Mirror attacks", "Chosen reactions". */
  label: string;
  /** How many of the set's candidates each body takes. */
  pick: number;
  /**
   * THIS SET'S PICK NAMES THE BODY.
   *
   * Christopher: *"it should be X mirror where X is the element it is chosen in the templet"*.
   * A mirror is not "Mirror of Thayla" — it is an **Earth Mirror**, named for the element it
   * was built with. That makes the name a DERIVED fact, so the DM never types it and two
   * bodies cannot end up mislabelled against their own packages.
   *
   * Only the first set marked this way is used. `pick: 1` is the sensible shape for it.
   */
  namesBody?: boolean;
  /**
   * VALUES EACH OPTION CARRIES, keyed by option name.
   *
   * Christopher: *"each claw or bolt needs to do the damage type that the element is set"* and
   * *"i can build the elemental guard but again it would need to pull from the element that those
   * are (ice/necrotic, etc)"*.
   *
   * An option is not only a bundle of actions — it also SUPPLIES FACTS that always-on actions
   * need. The Elemental Mirror's Claws and Bolt are one attack each whose damage TYPE is whatever
   * element the body was built with, and Elemental Guard's immunities are that element's pair.
   * Authoring six Claws and six Elemental Guards would be six chances to get one wrong.
   *
   * So an option declares named values, and any action may reference them as `{name}` in its
   * damage, save, text or its own name. `materializeTemplateBody` substitutes them for the body's
   * chosen options.
   *
   *   optionVars: { Earth: { primary: "earth", secondary: "radiant" } }
   *   Claws damage: "2d6 {primary}"          -> "2d6 earth"
   *   Elemental Guard: "immune to {primary} and {secondary} damage"
   *
   * A token with no value is left ALONE rather than blanked, so a typo reads as "{primry}" on the
   * card instead of silently deleting the damage type.
   */
  optionVars?: Record<string, Record<string, string>>;
  /** Optional note shown at generation. */
  note?: string;
};

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
  /**
   * A BOND CARRIED BY A CREATURE.
   *
   * The Elemental Mirrors are built from three choices, and the third is *"one legal inherent
   * Bond and its Metamorphosis path"* — every mirror mirrors a player, bond included. The
   * archetype (choice 1) and the elemental package (choice 2) were already expressible here;
   * the bond was not, so a mirror could not be finished in the creator at all.
   *
   * ⚠ A CREATURE'S STAGE IS EXPLICIT, unlike a character's. A PC's bond stage is derived from
   * level (3/6/9/13) because a PC levels; a mirror is BUILT at a stage and never advances, so
   * storing one here is the fact rather than a duplicate of one. Mirrors are built at
   * Metamorphosis, which is also the first stage that needs `chosenPathIndex`.
   */
  bond?: MonsterBond;
  /**
   * THIS CREATURE IS A TEMPLATE — bodies are BUILT from it, one per party member.
   *
   * *"The Wood builds one mirror for each adventurer."* A template is not a stat block you drop
   * on the map; it is the shape each body is generated from, and every body differs by its own
   * archetype, bond and action-set picks. Marking it says the creature is never used raw.
   */
  isTemplate?: boolean;
  /**
   * WHERE THIS RECORD CAME FROM, and therefore what may be done with it.
   *
   * Absent means the DM's own content — see `core/content/contentScope.ts` for why that default
   * is the safe one. A mod stamps this on records it ships as read-only reference, which is how
   * the chassis picker and the export path learn to leave them alone without either of them
   * knowing what edition or publisher is involved.
   */
  provenance?: ContentProvenance;
  /**
   * Pools of candidate actions and how many of each a body takes. Empty/absent = every action
   * on the creature is simply on it, which is the normal case.
   */
  actionSets?: MonsterActionSet[];
  /**
   * THE LAIR THIS CREATURE FIGHTS IN — its options, its cadence, and anything it calls at the
   * start of combat. See `lair.ts`.
   *
   * ⚠ NOT AN ACTION LIST, DELIBERATELY. A lair action is not something the creature does on its
   * own turn; it is the environment taking a turn on initiative 20. Filing them as ordinary
   * actions is exactly what the parked note in `monsterLibrary.ts` refused to do, and it was
   * right — the checker would have scheduled them into the creature's own action budget and
   * handed a dragon three extra turns' worth of options it never had.
   */
  lair?: LairSpec;
  /**
   * How a body built from this template is named, when a set is marked `namesBody`.
   *
   * `{pick}` is the chosen candidate's name; `{name}` is the template's. "{pick} Mirror" over a
   * package called "Earth" gives **Earth Mirror**. Unset falls back to "{pick} {name}".
   *
   * Authorable rather than hardcoded (RULE 2) — "Earth Mirror" is this campaign's phrasing, and
   * another template naming its bodies some other way must not need a code change.
   */
  bodyNameFormat?: string;
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
    /**
     * TYPED DAMAGE RESPONSES — "Damage Immunities Cold", "Damage Vulnerabilities Radiant".
     *
     * ⚠ THIS IS A DIFFERENT KIND OF FACT FROM `defenses`, AND CONFLATING THEM WAS THE PROBLEM.
     * Christopher: *"i cant enter specific resistance or vulnerable to a element, this is why i
     * didnt want the defensives to be a drop down box which they are unless i build a trait for
     * the 2 types."*
     *
     * `defenses` is a PRICE — one of the 58 calibrated rules and the effective-HP weight it
     * carries. A damage response is what the STAT BLOCK SAYS: this creature is immune to cold.
     * There is no dropdown entry for "immune to cold", and there should not be, because the
     * calibrated rows are shares of opposing damage rather than named types.
     *
     * Until this existed the only home for it was `notes` — free prose, invisible to the card,
     * the editor and the checker alike. Twenty-odd creatures carry lines like
     * "Damage Immunities: Cold, Poison." in a note right now, which is data the app cannot read.
     *
     * ⚠ RECORDING IS NOT PRICING. The workbook's `resistance_immunity_vulnerability` primitive
     * says to "weight actual damage-type share and bypass", and the type share is not published,
     * so entering a response does NOT move effective HP on its own. A DM who wants it priced adds
     * the calibrated `Resistance - ~25/50/75% of opposing damage` row alongside — one control for
     * the fact, one for the weight, which is the same split `rule` and `ehpMultiplier` already
     * use.
     */
    damageResponses?: readonly {
      /** The damage type as printed: "cold", "radiant", "bludgeoning". */
      type: string;
      response: "resistant" | "immune" | "vulnerable";
      /** "from nonmagical attacks", "while Bone Armor is active" — the printed condition, if any. */
      qualifier?: string;
      /**
       * This type's share of the party's ELIGIBLE damage, 0–1 — the one input the formula needs.
       *
       * `pricing_contract.rules.21.formula`: *"Weight by the opposing side's actual eligible
       * damage-type share and bypass rules; immunity passes 0 eligible damage, resistance 0.5,
       * vulnerability 2.0."* The multipliers are published; the share is a fact about the party
       * and no table of it is, so an unset share records the response and prices it at nothing
       * rather than inventing a plausible-looking figure.
       *
       * ELIGIBLE is what the qualifier changes. "Resistant to nonmagical bludgeoning" against a
       * party carrying magic weapons has a share near zero even though bludgeoning is most of
       * their damage.
       */
      share?: number;
    }[];
    /** Party damage uptime against this creature (tempo tax). 1.0 = attacks freely. */
    damageUptime?: number;
    /**
     * ONE BODY PER PC, AT FLAT HP — the campaign's single body-count exception.
     *
     * The Mirrors doc: *"This is the sole body-count exception. Each mirror remains at 90 HP;
     * use one mirror per PC."* Party size is expressed as HOW MANY bodies, so the party-size HP
     * band must NOT also apply — three mirrors at 67 HP for a 3-player party is the same lever
     * pulled twice.
     *
     * ⚠ THE COUNT IS DERIVED, NOT AUTHORED. RULE 2: one control per fact. Party size is the
     * control; the number of bodies follows from it, so an authored `count` on the encounter
     * entry is a placeholder and is ignored for these.
     *
     * The map-spawn path has honoured this since it was written (`spawnEncounterInstances`
     * exempts template entries from `hpForPartySize`). The CHECKER did not: it read `count: 1`
     * and then applied the HP band on top, pricing Gate II at exactly a quarter of its authored
     * size at every party count — 82.7 EHP against 331.0 at 4P.
     */
    oneBodyPerPc?: boolean;
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
    /**
     * The PRINTED proficiency bonus, when the block states one.
     *
     * ⚠ READ BEFORE `cr`, because the blocks print this and often print no CR at all. Every
     * creature in the Act 3 v3.23 packet carries "Proficiency Bonus: +3" or "+4" on its face and
     * no challenge rating, so deriving from `cr` there means deriving from something the block
     * never said — and backing a specific CR out of a bonus invents a number, since +3 spans the
     * whole CR 5-8 band.
     *
     * This is what makes a library creature behave like a hand-authored one. Christopher: *"this
     * is why they need to be hand authored for all creatures in the library so it isnt locked."*
     * With a bonus in hand a save is a TICK that follows the score; without one every save is a
     * typed number that goes stale the moment a score changes, invisibly.
     */
    proficiencyBonus?: number;
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
  /**
   * WHICH FIGHT THIS BODY BELONGS TO, carried down from its template.
   *
   * The template has always had `encounterId`; the instance dropped it, so at the end of a fight
   * nothing on the roster could say which encounter had just been won. That is the one fact
   * `bondMilestoneForEncounter` needs, and it is why the Act 3 → Tempered gate had to be set by
   * hand. Optional, because a DM-built one-off creature belongs to no authored encounter.
   */
  encounterId?: string;
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
  if (/\(\s*legendary/i.test(a.name ?? "")) return true;
  /**
   * ⚠ THE TIMING WINDOW IS THE TELL. Christopher: *"if something says 'once per round at the end
   * of another creature's turn' you can read that is a legendary action."*
   *
   * He is right, and it is the same reasoning as the name fallback above: a hand-authored block
   * states the cost in prose rather than in a field. Nothing else in the economy acts at the end
   * of ANOTHER creature's turn — an action is taken on your own turn, a bonus action likewise, and
   * a reaction fires on a TRIGGER ("when a creature does X"), not in a timing window.
   *
   * ⚠ CHANGES NOTHING TODAY, ON PURPOSE. Both blocks that carry the phrase — the Veil-Torn
   * Dragon's Tail Sweep and the Thought Harrower's Mind Hook — already state `legendaryCost: 1`
   * and were already read correctly. This is a guard for the next block authored by hand, so the
   * phrase never has to be backed up by a field that someone remembered to set.
   *
   * Curly apostrophe included deliberately: every authored block in this campaign uses U+2019, and
   * a straight-quote-only pattern silently matches none of them.
   */
  return /at the end of (another|each other|the other|a) creature[’'`]?s turn/i.test(a.text ?? "");
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
    // The fight this body belongs to. Only set when the template names one — see the field.
    ...(template.encounterId ? { encounterId: template.encounterId } : {}),
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
