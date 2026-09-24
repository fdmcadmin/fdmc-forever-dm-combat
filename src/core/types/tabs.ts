import type { ActionCost } from "./actionEconomy";
import type { SummonSpec } from "../monsters/summon";

export type TabId =
  | "main"
  | "bonus"
  | "spells"
  | "bond"
  | "checks"
  | "features"   // rendered as "Class Actions" (P-SHEET)
  | "feats"      // P-SHEET — feats (mechanical effects feed derived stats)
  | "status"
  | "equipment"
  | "resources"
  | "outOfCombat" // back-compat only; no longer rendered as its own tab (P-SHEET)
  | "notes";

export type TabDefinition = {
  id: TabId;
  label: string;
};

export type ActionKind =
  | "attack"
  | "spell"
  | "bond"
  | "check"
  | "equipment"
  | "resource"
  | "feature"
  | "utility"
  | "note"
  | "reminder";

export type ActionLogMode = "default" | "table-note" | "silent";
export type ActionDisplayMode = "card" | "compact";

/**
 * Explicit outcome mode — overrides TabPanel's inference when set.
 *
 * Two questions decide the mode: DOES IT ROLL, and WHOSE ROLL IS IT?
 *
 *   attack-roll    : rolls 1d20 to hit → hold result → Hit / Miss / Crit
 *   dc-check       : the TARGET rolls against a DC → Applies / No Effect
 *   ability-check  : the PLAYER rolls a skill/ability check → Pass / Fail
 *   damage-only    : straight dice, no hit/miss step (a burst, a save rider's damage)
 *   healing        : same as damage-only, logged as healing
 *
 *   triggered      : rolls its OWN dice, standalone, with no hit/miss step. Fires and resolves
 *                    by itself. Second Wind is triggered — press it, roll 1d10+level, done.
 *
 *   additive       : rolls NOTHING by itself; it ARMS a rider that attaches to a LATER roll.
 *                    Hunter's Mark is additive — using it adds 1d6 to your next weapon hits.
 *                    The distinction from `triggered` is whose roll the dice land on: its own,
 *                    or somebody else's.
 *
 *   utility        : CLICKABLE, and RESOLVES INSTANTLY — on the click, not on a later roll.
 *                    Rage, Great Weapon Master, Sacred Weapon, Celestial Revelation, Second Wind.
 *
 *                    ⚠ IT MAY ROLL. Christopher: *"we built utility to mean happens instantly
 *                    while additive is happens with a attack."* The line is about WHEN a thing
 *                    lands, never about whether it has dice. This paragraph used to read "rolls
 *                    nothing itself, and MODIFIES THE ATTACKS THAT PC MAKES THIS TURN" — a
 *                    description of `additive` wearing utility's name — and `hasAttachedDice`
 *                    enforced it, so an instant ability with its own damage was clickable and
 *                    could never produce a die. Second Wind — Tactical Shift printed 1d10+6 and
 *                    rolled nothing.
 *
 *   passive        : NOT clickable. ALWAYS affecting the character — no activation, nothing to
 *                    press. A standing bonus, an always-on defence, a spell that is simply on.
 *                    If it has an action cost it is not passive; if you turn it ON, it is
 *                    `utility`.
 *
 * ⚠ THE UTILITY / ADDITIVE LINE (Christopher, 2026-08-18). Both change a later roll, so the
 * test is WHAT they contribute:
 *   · `additive` contributes DICE that land when the attack is rolled — a bond like Overcharge.
 *   · `utility` contributes an EFFECT on the actions you take this turn — Rage, GWM, Sacred
 *     Weapon, Celestial Revelation. It is not "no dice anywhere"; it is "no dice of its own".
 * And `passive` is the always-on case, not the "I could not find a mode" case. An activated
 * thing is never passive, however little it rolls.
 */
export type ActionOutcomeMode =
  | "attack-roll"
  | "dc-check"
  | "ability-check"
  | "damage-only"
  | "healing"
  | "triggered"
  | "additive"
  | "utility"
  | "passive";

/**
 * LEGACY. "reference" meant two things at once — no dice AND (sometimes) not clickable — which
 * is why a bond tagged reference still spent the bond slot. It is split into `passive` and
 * `utility` and normalised away on read; nothing should author it any more.
 */
export type LegacyOutcomeMode = ActionOutcomeMode | "reference";

/**
 * "reference" -> passive, when all you have is the mode.
 *
 * ⚠ PREFER `resolveOutcomeMode(action)`. This overload cannot see whether the action carries a
 * cost, and a `reference` action that spends something was never passive — mapping it to
 * `passive` makes it unclickable and therefore unspendable. Kept for call sites that genuinely
 * only hold a mode.
 */
export function normalizeOutcomeMode(mode: LegacyOutcomeMode | undefined): ActionOutcomeMode | undefined {
  return mode === "reference" ? "passive" : mode;
}

/**
 * The retired `reference` tag, resolved with the ACTION in hand.
 *
 * `reference` meant two things at once — no dice, and (sometimes) not clickable. Splitting it
 * needed information the tag never carried: whether the entry costs anything. The rule was
 * written down when the split landed and then could not be applied, because the normaliser only
 * received the mode:
 *
 *   spends something  -> `utility`  (clickable, the click IS the action, never rolls)
 *   costs nothing     -> `passive`  (display text, no button)
 *
 * Applying it here rather than asking Christopher to re-author every legacy entry is the point.
 * Three options of one class feature sat in the sheet with two of them tagged `reference` and
 * one untagged; the editor showed all three as "Utility" because `reference` matched none of its
 * checks and fell to that fallback, while the runtime mapped it to `passive` and killed two of
 * them. Same display, opposite behaviour, and nothing on screen to explain it.
 *
 * ⚠ A DM cannot debug this class of bug. The stored value is invisible, the editor disagrees
 * with the engine, and the only symptom is "I made this action and it will not work." Resolve
 * legacy tags in code; never make the table re-author around them.
 */
export function resolveOutcomeMode(action: {
  metadata?: { outcomeMode?: LegacyOutcomeMode; slotCost?: string; cost?: string; damage?: string };
  economyCost?: readonly string[];
}): ActionOutcomeMode | undefined {
  const mode = action.metadata?.outcomeMode;
  if (mode !== "reference") return mode;
  /**
   * WARNING: "free" AND "passive" ARE COST STRINGS THAT SAY THE COST IS NOTHING.
   *
   * This tested the cost for truthiness, so the word "free" was read as evidence that the
   * action spends something, and a legacy reference row authored free was promoted to
   * `utility` -- a live, instant action. That is how the Bond tab ended up with (Meta) rows
   * that are pure instruction text ("Choose ONE each round: Rallying Surge or Fortify") sitting
   * on the sheet as pressable buttons that could never do anything when pressed.
   *
   * `authoredEconomy` already names the two economies that consume nothing; ask it instead of
   * inferring spending from the presence of a string.
   */
  const named = authoredEconomy(action);
  const namesNoCost = named === "free" || named === "passive";
  const spends = Boolean(action.metadata?.slotCost?.trim())
    || (!namesNoCost && Boolean(action.metadata?.cost?.trim()))
    || (action.economyCost?.length ?? 0) > 0;
  return spends ? "utility" : "passive";
}

/**
 * Every economy the editor offers — including the two that consume no slot.
 *
 * `free` and `passive` are the pair that keep getting conflated: both consume nothing, and only
 * one of them is inert.
 */
export type ActionEconomyKind = "action" | "bonus" | "reaction" | "bond" | "free" | "passive";

/** The authored economy, when it is one of the known kinds. */
export function authoredEconomy(action: { metadata?: { cost?: string } }): ActionEconomyKind | undefined {
  const c = action.metadata?.cost?.trim().toLowerCase();
  return c === "action" || c === "bonus" || c === "reaction" || c === "bond" || c === "free" || c === "passive"
    ? c : undefined;
}

/** A FREE action costs no slot and is fully usable. The distinction slots cannot express. */
export function isFreeEconomy(action: { metadata?: { cost?: string } }): boolean {
  return authoredEconomy(action) === "free";
}

/**
 * ⛔ THE ONE PLACE THAT DECIDES WHETHER AN ACTION IS INERT. Call this; never re-derive it.
 *
 * Every previous gate asked `logMode === "silent" && costs.length === 0` and got it wrong for
 * free actions, because "consumes no slot" and "cannot be used" are different statements that
 * happened to share a representation. Shield Bash — a dc-check with a real save DC, authored
 * Free and hidden from the log — sat dead on the sheet for exactly that reason.
 *
 * The rule, in precedence order:
 *   1. Spends a named resource  -> USABLE. A pool can only be spent by clicking.
 *   2. Authored Free            -> USABLE. Free is an economy, not an absence.
 *   3. Outcome mode passive     -> INERT. Always-on, nothing to press.
 *   4. Silent with no slot      -> INERT. The reference-text convention.
 *
 * 1 and 2 come first deliberately: a contradiction between "this costs something" and "this is
 * passive" resolves toward usable, because a visible no-op is debuggable and an invisible dead
 * row is not.
 */
export function isInertAction(
  action: { logMode?: string; metadata?: { cost?: string; slotCost?: string; outcomeMode?: LegacyOutcomeMode }; economyCost?: readonly string[] },
  slotsConsumed: readonly unknown[],
): boolean {
  if (action.metadata?.slotCost?.trim()) return false;
  if (isFreeEconomy(action)) return false;
  // The PASSIVE economy is inert by definition. This was missing entirely: only the passive
  // outcome MODE was checked, so an action authored "Passive" in the economy dropdown stayed
  // clickable and the choice did nothing at all.
  if (authoredEconomy(action) === "passive") return true;
  if (resolveOutcomeMode(action) === "passive") return true;
  return action.logMode === "silent" && slotsConsumed.length === 0;
}

// F05 — resource kind determines rest reset behavior
export type ResourceKind = "spellSlot" | "pactSlot" | "freeCast" | "pool" | "toggle" | "counter";

// F02 — spell casting time type
export type CastingTimeType = "action" | "bonus" | "reaction" | "ritual" | "special";

export type ActorActionMetadata = {
  attack?: string;
  damage?: string;
  /** Damage type for the damage formula — standard D&D type or a custom free-text value. */
  damageType?: string;
  /**
   * The types the CASTER may pick from, when the spell says the choice is theirs.
   *
   * `damageType` stays the default/pre-selected one; this is the permitted set. Absent means
   * the type is fixed, which is every ordinary action — Chromatic Orb and Sorcerous Burst are
   * the shapes that need it, and they could not be expressed at all while type was one string.
   */
  damageTypeOptions?: string[];
  /**
   * On a MAXIMUM damage die, roll another and add it — Sorcerous Burst.
   *
   * Same detector shape as the crit rider that grants Great Weapon Master its extra attack:
   * watch the result, and when it hits the trigger, add one more. The difference is which die
   * is watched — GWM reads the d20, this reads the DAMAGE die.
   */
  explodingDamage?: boolean;
  crit?: string;
  saveDc?: string;
  /**
   * Which save the TARGET rolls (STR/DEX/CON/INT/WIS/CHA).
   *
   * Separate from `saveDc`, which is the NUMBER. Two questions the old free-text box ran
   * together: a shove is a STR save whose DC comes off the attacker’s martial modifier, and
   * nothing in "STR DC 14" says which half is which.
   */
  saveAbility?: string;
  range?: string;
  /**
   * The AUTHORED economy — what the DM picked in the editor.
   *
   * ⚠ NOT the same thing as `economyCost`, and the difference is load-bearing. `economyCost`
   * lists the SLOTS an action consumes, so "free" and "passive" both correctly produce `[]`.
   * That made them indistinguishable to every gate that asked "does this cost anything?", and
   * several of those gates were really asking "is this usable?" — a different question with the
   * same wrong answer. Read this field for the second question. Never infer it from slots.
   */
  cost?: ActionEconomyKind | string;
  slotCost?: string;
  /**
   * THE AUTHORED ACTION -> POOL LINK: the exact `id` of a row in this actor's Resources tab,
   * and how many that row loses per use.
   *
   * The sheets have carried both for a long time; neither was declared here and nothing read
   * either one, so every action fell back to matching its English `cost` prose against pool
   * LABELS. A pool whose label the prose did not literally contain was unreachable - see the
   * long note on `resolveNamedResourceCost`, which is where these are now read first.
   *
   * `resourceCost` defaults to 1. Lay on Hands is the reason it must not be assumed: purifying
   * poison costs 5 points, not one use.
   */
  resourceId?: string;
  resourceCost?: number;
  spellLevel?: number;
  /**
   * WHICH CLASS CASTS THIS — a slot, not an ability.
   *
   * `@SPELL` resolves through the named class's spellcasting ability, so a Paladin 5 /
   * Sorcerer 1 can carry both a Paladin spell and a Sorcerer spell and each gets the right
   * modifier. Naming the SLOT rather than the stat means it keeps working if the character
   * multiclasses differently later, and it matches how `@MAIN`/`@SECOND`/`@THIRD` already read.
   *
   * ⚠ THIS EXISTS BECAUSE THE OLD BEHAVIOUR WAS ACTOR-WIDE. `getSpellcastingMod` scanned EVERY
   * action on the sheet for a `spell-uses-*` tag and returned on the first hit, so one action
   * tagged for INT silently made every spell on that character resolve as INT. The tag looked
   * per-action and was not.
   *
   * Unset falls back to the main class, then to the legacy tag scan — so nothing that works
   * today stops working.
   */
  castingClass?: "main" | "second" | "third";
  details?: string;
  concentration?: string;
  /** How long the effect lasts, e.g. "1 minute", "Concentration, up to 10 min", "Instantaneous". Display only. */
  duration?: string;
  /**
   * AN EFFECT THAT KEEPS DEALING DAMAGE WHILE ITS TARGET KEEPS FAILING THE SAVE.
   *
   * Christopher, 2026-09-23: *"ensnaring strike isnt a spell action its a bonus action that continues to
   * do the weapon damage if the target fails the STR save."* The first half is `castingTimeType`; this is
   * the second. Without it the spell was worth ONE hit's dice and nothing after, which is not what the
   * spell does and is a large part of why a Ranger read low.
   *
   * ⚠ `damage` ABSENT MEANS THE WEAPON'S OWN DAMAGE — that is the shape he described, and it is why the
   * field is optional rather than defaulting to the action's own dice. `timing` is the printed one: a
   * save at the END of the target's turns leaves the first turn standing, a save at the START does not.
   * `maxTurns` is the printed maximum, capped by the encounter horizon where the text says "1 minute".
   */
  ongoingDamage?: { repeat: "save-ends"; timing?: "start" | "end"; damage?: string; maxTurns?: number };
  withModifier?: string;
  additive?: string;
  critThreshold?: number;
  attackUses?: number;
  /**
   * Multi-roll spells — ONE cast, ONE slot, but several separate attack rolls that are each
   * resolved hit/miss with their own damage. Scorching Ray is the canonical case: 3 rays at
   * L2, each its own ranged spell attack. Eldritch Blast, Eldritch Spear, Hail of Thorns and
   * every "make N attacks" spell use the same shape.
   *
   * This is NOT `attackUses` (weapon Extra Attack) — that scales off the actor and grants
   * repeat uses of the Attack ACTION. A ray count belongs to the spell and must never let the
   * cast spend its slot more than once.
   *
   * `attackRolls` is the count at the spell's BASE level; `attackRollsPerLevel` is how many
   * more rays each slot level above base adds (Scorching Ray: 3 and 1).
   */
  attackRolls?: number;
  attackRollsPerLevel?: number;
  /**
   * Upcast rider: what ONE extra slot level adds to this spell's damage (or healing).
   *
   * Authored once — "1d6" for Fireball, "2d8" for Cure Wounds — and multiplied by how far
   * above its base level the spell is actually cast. This replaces authoring a separate card
   * per level: the base formula stays the base, and the level picker decides the rider.
   *
   * Leave blank when a spell upcasts by something OTHER than damage — Scorching Ray adds a
   * ray (`attackRollsPerLevel`), not dice; setting both would double-count.
   */
  upcastDamage?: string;
  /**
   * THE DAMAGE IS THE WEAPON'S, not a printed die — so `damage` is legitimately empty and
   * `upcastDamage` is what gets ADDED to it, rather than the whole amount.
   *
   * Perforating Shot is the case: *"Each creature within the Line makes a Dexterity saving throw,
   * taking Force damage equal to the weapon's normal damage"* and *"the weapon's damage increases
   * by 1d8 for each slot level above 1."* The app cannot know which weapon fired, so the base is
   * rolled at the table — but without this flag the upcast rider looks like the TOTAL, and a
   * player casting at L2 would roll 1d8 instead of the weapon's damage plus 1d8.
   */
  damageSource?: "weapon";
  /**
   * THIS BONUS ACTION IS TAKEN *DURING* A MAIN ACTION, not after it.
   *
   * Christopher, 2026-08-17: *"we are creating the ability to use bonus actions during a main
   * action so things like this and other bonus spells can be triggered during a main action,
   * because this and other spell say hit or miss, not miss then trigger a bonus spell that can do
   * nothing expect take a spell slot and someone has to roll manually."*
   *
   * The spells themselves say so — Perforating Shot is *"1 bonus action, which you take
   * immediately after hitting or missing with a ranged attack using a weapon"*, and its damage is
   * the weapon's. Resolving the attack FIRST and casting afterwards throws away the very thing the
   * spell needs: which weapon fired and what it rolled. So an action flagged here is offered while
   * the attack is still in flight, and its effect merges INTO that roll — one damage number, rolled
   * once, with the weapon's own dice already in it.
   *
   * `attack` is the only trigger so far; the field is named for the shape rather than the spell so
   * a save-triggered or check-triggered rider can join later without renaming anything.
   */
  triggersDuring?: "attack";
  /**
   * WHEN it may fire. Read from the spell's printed text, never assumed:
   *   "after hitting or missing"  → `either`
   *   "after a weapon hit"        → `hit`   (Ensnaring Strike)
   *   a miss-only rider           → `miss`
   * Defaulting to `either` would offer Ensnaring Strike on a miss, which its text forbids.
   */
  triggerOn?: "hit" | "miss" | "either";
  /**
   * What a SUCCESSFUL save still takes — "half", or an explicit formula.
   *
   * ⚠ Never assumed. Half is only half when the spell says half; plenty of saves are all-or-
   * nothing, and defaulting to half would quietly halve those. Creature parsing has carried this
   * distinction since row 10; PC actions had no field for it at all.
   */
  /**
   * WHAT THIS ACTION CALLS — the Divine Steed, the Eldritch Cannon, the Covenant bond-creature.
   *
   * ⚠ THE SUMMON SYSTEM WAS BUILT FOR THIS AND HAD NO WAY IN. `summon.ts` resolves every formula
   * the three named cases need — the Steed's AC `10+@SLOT` and HP `5+10*@SLOT`, the Cannon's
   * `5*@LEVEL`, the bond-creature's `@HITDIEMAX + @LEVEL` — each against the CASTER's proficiency,
   * spell attack and save DC, and `check:summons` proves the arithmetic with a Paladin as the
   * summoner. But `summon` sat on `MonsterReaderAction` only, so the one thing that could declare
   * a summon was a CREATURE, and the Paladin whose spell it is could not.
   *
   * Christopher, 2026-09-08: *"the whole reason there is a summon system was for things like
   * this."* Same `SummonSpec` the creature side uses — one model, two callers, never two shapes.
   */
  summon?: SummonSpec;
  successDamage?: string;
  diceLabel?: string;
  initiativeBonus?: number;
  /** Equipment-tab items only: false = carried but NOT equipped (its stat effects /
   *  AC / spell-focus bonuses stop applying). undefined/true = equipped. Lets a player
   *  unequip an item without removing it from the character. */
  equipped?: boolean;
  /** Equipment-tab items only: this item must be attuned to work. Carried on the action (not
   *  looked up in the library) so the card can count attunement without resolving items —
   *  the same reason statEffects are baked at attach time. Only EQUIPPED items count. */
  attunementRequired?: boolean;
  /** Equipment-tab items only: the worn slot, carried so the card can enforce exclusivity
   *  without a library lookup. Absent = carried, not worn. See EquipmentSlot. */
  slot?: string;
  /**
   * Equipment-tab items only: this item is part of the Convergence system.
   *
   * A player cannot CREATE a convergence item, but they have to be able to see that they are
   * holding one — otherwise the forge panel offers up inputs the player had no way to know
   * they owned. Authority and knowledge are different things: the lock is on authoring, not
   * on being told what the item is.
   *
   * Carried on the action rather than resolved from the library for the same reason as
   * `attunementRequired` and `slot` — the card must not need a library lookup to render.
   */
  convergence?: {
    role?: string;
    mechanicalTag?: string;
    /** Inputs: the act it drops in, "A1".."A4" — where the player got it. */
    actLabel?: string;
    /** Outputs: the completed tier, "T1".."T4". */
    tier?: string;
  };
  /** F05 — resource kind for rest reset behavior */
  resourceKind?: ResourceKind;
  /**
   * How much of this pool comes back on a SHORT rest.
   *
   * D&D is full of "N per Long Rest, regain ONE after a Short Rest" — Channel Divinity
   * (PHB-2024 p.110), Rage, Bardic Inspiration, Superiority Dice. The reset used to be
   * binary (short OR long), so partial recovery could not be expressed at all: authoring it
   * as Long under-restored, and as Short over-restored to full.
   *
   *   undefined → nothing on a short rest (unless the legacy `cost` prose says "short")
   *   a number  → regain that many, capped at max
   *   "all"     → full reset, same as a long rest
   *
   * The LONG rest always restores fully, which is true of every D&D resource that recovers
   * at all — so there is deliberately no `longRestRegain` counterpart.
   */
  shortRestRegain?: number | "all";
  /** F02 — spell slot mode: which resource pool this spell uses.
   *  "freeCast" = class-feature spell: spends a dedicated named resource (not a spell
   *  slot), tracked in the resource list. See classFeatureUses. */
  spellSlotMode?: "standard" | "pact" | "freeCast" | "none";
  /** Class-feature spell: number of uses per long rest. Drives the auto-generated
   *  dedicated resource (pool = this value, reset = Long Rest). */
  classFeatureUses?: number;
  /** F02 — level the spell is currently set to cast at */
  selectedCastLevel?: number | null;
  /** F02 — levels this spell can be cast at (empty = any level) */
  /**
   * LEGACY — no longer written or read. Every spell is castable from its own level upward;
   * where a spell stops is `maxSpellLevel`, one number instead of a list. Kept on the type
   * only so actors saved before that change still parse.
   */
  usableSpellLevels?: number[];
  /**
   * Feats/features only: how many extra WEAPON MASTERY properties this grants.
   *
   * The Weapon Master feat gives a non-martial one mastery. An explicit number, never inferred
   * from the feat's name — "Weapon Master" is a title, and titles are not data.
   */
  masteryGrant?: number;
  /**
   * CANTRIP SCALING — the damage this cantrip deals at character levels 5, 11 and 17.
   *
   * A cantrip has no slot to upcast, so `upcastDamage` cannot describe it: it steps on
   * CHARACTER level, at three fixed points, and it REPLACES the base rather than adding to
   * it — Fire Bolt is 2d10 at 5th, not 1d10 + 1d10. Each tier is a whole damage expression
   * for that reason, and a blank tier simply means "no change yet".
   */
  cantripTiers?: { l5?: string; l11?: string; l17?: string };
  /**
   * A ONCE-PER-TURN rider this action arms rather than resolves.
   *
   * Two shapes, one mechanism: `extraAttack` arms "+1 attack available" (Hew, Distant Strike)
   * and `damage` arms a damage rider (the Tier 3 weapons). Both are claimed by clicking, both
   * are spent once, and both come back at the start of the character's turn.
   */
  /**
   * ⚠ `cost` IS WHAT THE EXTRA ATTACK SPENDS, and an extra attack is not always free.
   *
   * Christopher, 2026-09-23, quoting the 2024 PHB p.204: *"Hew. Immediately after you score a
   * Critical Hit with a Melee weapon or reduce a creature to 0 HP with one, you can make one attack
   * with the same weapon as a Bonus Action"* — *"Hew: 1 Bonus Action"*. An empty or absent cost is a
   * free extra attack (Distant Strike); `["bonus"]` makes the claim spend the Bonus Action.
   */
  turnRider?: { kind: "extraAttack" | "damage"; damage?: string; label?: string; cost?: ActionCost[] };
  /**
   * Highest slot level this spell may be cast at. Absent = up to 9th.
   *
   * For the few things that genuinely stop scaling — Divine Smite caps at a 5th-level slot,
   * so a 6th adds nothing and offering it only invites a wasted slot.
   */
  maxSpellLevel?: number;
  /** F02 — casting time type */
  castingTimeType?: CastingTimeType;
  /** Explicit outcome mode — set this to skip inference and lock the roll behavior */
  outcomeMode?: ActionOutcomeMode;
  /** Adaptive/chassis state, carried from EquipmentItem so the card can offer the grip switch
   *  and re-derive dice without a library lookup. `chassis.formId` is the chosen weapon form. */
  chassis?: { categories?: string[]; ability?: string; requireTags?: string[]; anyOfTags?: string[]; formId?: string };
  /** How a versatile chassis form is held right now. Changing it is free — see the grip switch. */
  grip?: "1h" | "2h";
  chassisBonus?: number;
  pbToDamage?: boolean;
  /** Chassis extra damage dice on every hit — see `EquipmentItem.chassisBonusDice`. */
  chassisBonusDice?: string;
  /**
   * A WEAPON CHARM'S BINDING, carried on the character's copy — see `EquipmentItem.bindsToItemId`.
   *
   * ⚠ THE BIND WAS SAVED BY THE EDITOR AND DROPPED HERE. `itemToAction` never copied it, so choosing a weapon
   * in the bag editor wrote a value the character's sheet could not hold, and nothing on the card could act
   * on it. The four fields after it are what the charm gives the weapon it is bound to.
   */
  bindsToItemId?: string;
  attachesToWeapon?: boolean;
  boundWeaponBonus?: number;
  boundWeaponHitDamage?: string;
  weaponOrSpellChoice?: boolean;
  /** Focus extra on damage/healing of a spell cast with the Magic action — `EquipmentItem.spellFocusMagicActionDamage`. */
  spellFocusMagicActionDamage?: string;
  /** Player-toggled conditional extras carried from the item — see ItemRider. The app tracks
   *  the cadence and rolls the dice; the table rules on whether the trigger happened. */
  riders?: Array<{ id: string; label: string; formula?: string; damageType?: string; cadence: string; condition?: string }>;
  /** Charge tracking — carried from EquipmentItem for items with limited uses */
  charges?: { max: number; reset: "longRest" | "shortRest" | "encounter" | "manual"; note?: string };
  /** Live "remaining/max" for the item pool above, stamped at render by the card (the counter
   *  is state, not authored data). Shown as an always-visible chip on the action row. */
  chargeReadout?: string;
  /** Effect descriptor — carried from EquipmentItem for charge-gated effects */
  effect?: { type: string; label?: string; formula?: string; value?: string; condition?: string };
  /**
   * Passive stat effects baked in at attach time.
   * Includes both explicit statEffects from the library item AND synthesized AC effects
   * from the item's ac string (e.g. "14", "+2").
   * deriveActorStats reads these directly — no library lookup needed.
   * Actor records are self-contained: library changes don't silently affect equipped items.
   */
  statEffects?: Array<{ type: string; stat?: string; value: number; condition?: string }>;
  /** AC display string carried from item (e.g. "14", "+2", "11 + DEX") — for equipment tab display only */
  acDisplay?: string;
  /** Spellcasting focus bonuses carried from an EquipmentItem — added to the spells cast
   *  through it (clickable additive on spell attack / damage rolls). */
  spellFocusAttack?: string;
  spellFocusDamage?: string;
  /** How a reroll source changes the roll: "reroll" or "flip" (the other side of the die). */
  rerollMethod?: string;
  /** Shift to the spell SAVE DC from the same focus ("+1"). The DC is a printed target, so
   *  this moves the number rather than appending a term to a roll. */
  spellFocusSaveDc?: string;
  /** THIS ITEM IS A SPELLCASTING FOCUS. Its own fact, not inferred from carrying a bonus —
   *  a plain focus with no magical plus is still what every spell is cast through, and it is
   *  what supplies @SPELL to the roll. Spells themselves carry no @SPELL. */
  isSpellFocus?: boolean;
  /**
   * WHAT THE ITEM IS — "weapon" | "armor" | "shield" | "magic" | "gear" | "consumable".
   *
   * ⚠ Carried on the actor's baked copy because the round-trip out of it used to GUESS: anything
   * without an attack or damage formula became "gear", so armour, shields and wands all read as
   * gear, and editing an item on a character wrote that guess back over its real type.
   */
  itemType?: string;
  /** Weapon mastery property carried with the item so the round-trip does not drop it. */
  mastery?: string;
  /** What an item's effect dice MEAN — "damage" | "healing" | "temp" | "reduction". The last
   *  three all resolve through the  outcome mode (HP the bearer keeps) but are named
   *  separately so the roll button never calls a reduction "Roll Damage". */
  effectKind?: string;
  /** Light / medium / heavy, carried so the round-trip does not drop it. */
  armorType?: string;
  /** How many are held. */
  count?: number;
  /** Convergence tier, carried so the card can cap T4 at one per character. Free text. */
  tier?: string;
  /** Weapon-buff rider (e.g. Hungering Blade): when this spell/ability is toggled on, the
   *  formula is added to the actor's WEAPON attack damage (clickable persistent additive). */
  weaponBuffDamage?: string;
  /** Activated ATTACK-roll rider — the counterpart to weaponBuffDamage, for abilities that
   *  buff to-hit rather than damage (Sacred Weapon +CHA, Bless-style bonuses). Using the
   *  action arms a persistent chip that rides weapon attack rolls until cleared or End
   *  Combat. An ability may set both fields to buff attack and damage together. */
  weaponBuffAttack?: string;
  /**
   * CONJURED-WEAPON spells: casting this ARMS a reusable attack for the spell's duration.
   *
   * Flame Blade, Shadow Blade, finger guns, a Storm cleric holding a spell it may re-cast
   * free — they all share one shape the app could not express. The CAST and the ATTACK are
   * different actions with different costs, and the attack repeats for the duration without
   * spending the resource again:
   *
   *   click the spell  → pay `economyCost` (usually bonus) + its resource → arm the chip
   *   click the chip   → pay `grantsArmedAttack.cost` (usually the Magic action) → roll
   *   chip persists    → until concentration drops or End Combat clears it
   *
   * Authoring it as one card with an attack on it (which is what Flame Blade does today)
   * conflates the two: the bonus action appears to buy the attack, which is right only on
   * the turn it is cast and wrong on every turn after.
   *
   * The armed attack is NOT a weapon attack. It never inherits `attacksPerAction`, never
   * benefits from Extra Attack, and can never be the second Light weapon that enables Nick —
   * it is the specific action the spell grants, not the Attack action.
   */
  grantsArmedAttack?: {
    /** Defaults to the spell's own label. */
    label?: string;
    /**
     * ⚠ ALWAYS write the explicit `+` — `1d20+@SPELL`, never `1d20@SPELL`. It is not
     * cosmetic. It guarantees the term is READ: in `1d20@STR@PROF+1` a var that fails to
     * resolve can swallow the segment and leave `1d20+1`. It is also what makes stacking
     * legible — `1d20+@SPELL+@CHA` with Sacred Weapon up, or a weapon's
     * `1d20+@PROF+@STR+1`. `normalizeRollFormula` already collapses `++`, so the separator
     * costs nothing and fails safe.
     *
     * Attack formula. OMIT IT — it defaults to `1d20+@SPELL`, which the card already knows:
     * `@SPELL` resolves to the spellcasting modifier plus proficiency, following the actor's
     * own class and any `spell-uses-*` tag that swaps the stat.
     *
     * Hard-coding a number here ("1d20+6") freezes the bonus at the level it was authored,
     * so it silently stops being right the moment the character levels or the stat changes.
     * Only set it for a spell that deliberately attacks off something other than the caster's
     * own spell attack bonus.
     */
    attack?: string;
    damage: string;
    damageType?: string;
    crit?: string;
    range?: string;
    /** What each USE costs. Usually ["main"] — the Magic action. */
    cost?: ActionCost[];
    /** Free-text duration for the chip, e.g. "Concentration, up to 10 min". */
    duration?: string;
  };
  /** Fighting style (Archery, Two-Weapon, Great Weapon): a clickable toggle adding a bonus
   *  to matching weapon attacks. target gates which attacks it rides. */
  combatStyleAttack?: string;
  combatStyleDamage?: string;
  combatStyleTarget?: "ranged" | "melee" | "weapon" | "two-handed";
};

export type ActorAction = {
  id: string;
  label: string;
  description?: string;
  logMessage?: string;
  rollResult?: string;
  actionKind?: ActionKind;
  economyCost?: ActionCost[];
  logMode?: ActionLogMode;
  displayMode?: ActionDisplayMode;
  disabled?: boolean;
  category?: string;
  tags?: string[];
  metadata?: ActorActionMetadata;
  hasDefinedUse?: boolean;
  pinned?: boolean;
  pinReaction?: boolean;
  concentration?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
};

export type TabActionMap = Record<TabId, ActorAction[]>;
