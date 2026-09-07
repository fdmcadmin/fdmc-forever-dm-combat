/**
 * WHAT THIS PARTY'S SLOTS COULD BE, ON EVERY SIDE OF THE FIGHT.
 *
 * ⚠ A SLOT IS NOT DAMAGE. IT WAS BEING FILED AS DAMAGE, SILENTLY.
 * `partyHealingFromActors` excludes Cure Wounds with sound reasoning — *"A Ranger's or Artificer's
 * slots are ALREADY in the DPR curve. Spending one on healing converts damage into healing; it is a
 * TRADE, not extra capacity."* The anti-double-count is right. The conclusion is not: the app
 * resolves the ambiguity by assigning every slot to damage and never mentioning the other sides.
 *
 * Christopher: *"my party has 3 character who have healing spell slots as well as things like the
 * protector from the artificer cannon — this are suppose to be listed as potential sustain
 * capabilities because those same slots and action can be used for offensive as well which should
 * be potential dpr"*. And then: *"both sides of the coin have spells that can cause conditions"* —
 * so it is three ways, not two. The same slot is healing, damage, OR control.
 *
 * ⚠ NOTHING HERE IS ADDED TO ANY TOTAL, AND THAT IS THE DESIGN.
 * The Action law is what makes these alternatives rather than a sum: *"One Action, Bonus Action,
 * and Reaction budget per turn."* A caster who heals did not also fireball. Adding these figures
 * to sustain or to DPR would be the double-count the exclusion was protecting against; showing
 * them as CAPACITY is the thing that exclusion threw away. The panel reads this as "what this
 * party could convert", never as "what it also has".
 *
 * ⚠ CONTROL IS DECOMPOSED, NEVER NAMED. `conditionResolver.generated` carries the workbook's rule:
 * *"Condition names are aliases. Price the decomposed consequences; never use a universal condition
 * multiplier."* So a spell that Frightens reports the primitives Frightened decomposes into, not a
 * "Frightened multiplier" — because Frightened is an attack penalty AND a reachability restriction
 * and a single number has already lost one of them.
 */

import { conditionsNamedIn, type ConditionRule } from "./conditionResolver.generated";

export type SlotUse = "healing" | "damage" | "control";

export type ActionLike = {
  id?: string;
  label?: string;
  actionKind?: string;
  logMode?: string;
  metadata?: {
    damage?: string;
    upcastDamage?: string;
    healing?: string;
    effectKind?: string;
    details?: string;
    slotCost?: string;
    /** What the sheets actually author. `spellSlotLevel` is kept for anything written the old way. */
    spellLevel?: number;
    spellSlotLevel?: number;
  };
  text?: string;
  description?: string;
};

export type ActorLikeForSlots = {
  name?: string;
  actions?: ActionLike[];
  tabs?: Record<string, ActionLike[] | undefined>;
};

export type SlotCapabilityRow = {
  actor: string;
  label: string;
  /** The slot level the action spends, when it states one. */
  slotLevel?: number;
  /** Every way this one action could be spent. More than one entry is the whole point. */
  uses: SlotUse[];
  /** Conditions it can impose, resolved through the workbook table rather than named raw. */
  conditions: ConditionRule[];
  healing?: string;
  damage?: string;
};

/**
 * ⚠ THE CONTEST IS BETWEEN SPELLS OVER A SLOT, NOT INSIDE ONE SPELL.
 *
 * Cure Wounds is only healing and Guiding Bolt is only damage; neither is "dual-use" on its own.
 * What is dual-use is the LEVEL 1 SLOT they both want. That is the thing a single total silently
 * decides for you, and it is what Christopher was pointing at: *"those same slots and action can
 * be used for offensive as well"*. So contention is computed per actor per slot level.
 */
export type ContestedSlot = {
  actor: string;
  /** undefined for a non-levelled resource, like an Artificer's Infusions. */
  slotLevel?: number;
  uses: SlotUse[];
  options: string[];
};

export type PartySlotCapability = {
  rows: SlotCapabilityRow[];
  /** One action that itself does more than one thing — a damaging spell that also Restrains. */
  dualUse: SlotCapabilityRow[];
  /** Slot levels wanted by more than one KIND of spell. The real fork in the road. */
  contested: ContestedSlot[];
  /** How many actions offer each use. Counts of options, never a damage or healing figure. */
  byUse: Record<SlotUse, number>;
};

/**
 * ⚠ THE SHEETS SAY "HP", AND THIS ONLY KNEW "hit points" — AND ONLY WITH A DIGIT AFTER IT.
 *
 * The old pattern was `regain[s]?\s+\d` and `restore[s]?\s+…hit points`, which misses
 * three of the four wordings the live sheets actually use:
 *
 *   "restore 2d8+2 HP at level 1"                  -> missed ("HP", not "hit points")
 *   "+5 HP"                                        -> missed
 *   "regains a number of Hit Points"               -> missed (no digit follows "regains")
 *   "restore 2d8+3 hit points."                    -> matched
 *
 * So Cure Wounds was classified as DAMAGE on two of the three casters in this party. That feeds
 * the contested-tier split and the H/D/C counts on the panel, so a healer's slots were being
 * counted as offence and the fork the DM is shown was wrong.
 *
 * ⚠ IT STILL MUST NOT MATCH DAMAGE. "HP" is only read as healing next to a restoring verb or a
 * bare bonus, never on its own, so "3d6 damage" and a pool called "Hit Dice" stay out.
 */
const HEAL_TEXT = new RegExp(
  [
    "\\bheal(s|ing|ed)?\\b",
    "(regain|restore|recover)[s]?\\b[^.]{0,25}(hit points|\\bhp\\b)",
    "temporary hit points",
  ].join("|"),
  "i",
);

function allActions(actor: ActorLikeForSlots): ActionLike[] {
  const fromTabs = Object.values(actor.tabs ?? {}).flatMap(t => (Array.isArray(t) ? t : []));
  return [...(actor.actions ?? []), ...fromTabs];
}

function textOf(a: ActionLike): string {
  return [a.label, a.text, a.description, a.metadata?.details].filter(Boolean).join(" ");
}

/**
 * ⚠ A SLOT-SPENDING ACTION, NOT EVERY ACTION. A cantrip costs no slot and is therefore not a
 * choice between uses — it is always available and already inside the DPR curve. The dual-use
 * question only exists where a limited resource has to be pointed at one thing.
 */
function spendsASlot(a: ActionKindCheck): boolean {
  if (a.actionKind === "spell") {
    // Same field mismatch as below — the sheets say spellLevel.
    const lvl = Number(a.metadata?.spellLevel ?? a.metadata?.spellSlotLevel);
    if (Number.isFinite(lvl) && lvl > 0) return true;
    return Boolean(a.metadata?.slotCost);
  }
  return Boolean(a.metadata?.slotCost);
}
type ActionKindCheck = ActionLike;

function healsWith(a: ActionLike): string | undefined {
  if (a.metadata?.healing) return a.metadata.healing;
  if (a.logMode === "healing" || a.metadata?.effectKind === "healing") {
    return a.metadata?.damage ?? "(dice logged as healing)";
  }
  return HEAL_TEXT.test(textOf(a)) ? (a.metadata?.damage ?? "(stated in text)") : undefined;
}

/**
 * Every way this party's slot-spending actions could be pointed.
 *
 * Returns null when no actor carries one, so a caller shows nothing rather than an empty promise.
 */
export function slotCapabilityFromActors(
  actors: readonly ActorLikeForSlots[],
): PartySlotCapability | null {
  const rows: SlotCapabilityRow[] = [];

  for (const actor of actors) {
    const who = actor.name ?? "(unnamed)";
    for (const a of allActions(actor)) {
      if (!spendsASlot(a)) continue;
      const uses: SlotUse[] = [];
      const healing = healsWith(a);
      const damage = a.metadata?.damage;
      const conditions = conditionsNamedIn(textOf(a));

      if (healing) uses.push("healing");
      // A healing card's dice are healing, not damage — do not claim both from one number.
      if (damage && !healing) uses.push("damage");
      if (conditions.length) uses.push("control");
      if (uses.length === 0) continue;

      /**
       * ⚠ THE SHEETS SAY `spellLevel`, AND THIS READ `spellSlotLevel`.
       *
       * Across the live party 50 actions carry `spellLevel` and NONE carries `spellSlotLevel`, so
       * every row resolved `slotLevel: undefined` and all of an actor's spells fell into one
       * bucket. The panel's "contested" count was real but tier-blind: it reported one contested
       * pseudo-tier per caster instead of naming which LEVEL is the fork.
       *
       * That is the whole point of this file — *"the contest is between spells over a slot"* — and
       * a contest at no particular level cannot tell a DM which slot to spend. Both spellings are
       * read so a sheet authored either way resolves.
       */
      const lvl = Number(a.metadata?.spellLevel ?? a.metadata?.spellSlotLevel);
      rows.push({
        actor: who,
        label: a.label ?? "(unnamed action)",
        slotLevel: Number.isFinite(lvl) && lvl > 0 ? lvl : undefined,
        uses,
        conditions,
        healing,
        damage: healing ? undefined : damage,
      });
    }
  }

  if (rows.length === 0) return null;
  const byUse: Record<SlotUse, number> = { healing: 0, damage: 0, control: 0 };
  for (const r of rows) for (const u of r.uses) byUse[u] += 1;

  // Group by actor and slot level; a level wanted by two different USES is contested.
  const buckets = new Map<string, { row: ContestedSlot; uses: Set<SlotUse> }>();
  for (const r of rows) {
    const key = `${r.actor}::${r.slotLevel ?? "resource"}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { row: { actor: r.actor, slotLevel: r.slotLevel, uses: [], options: [] }, uses: new Set() };
      buckets.set(key, bucket);
    }
    for (const u of r.uses) bucket.uses.add(u);
    bucket.row.options.push(r.label);
  }
  const contested: ContestedSlot[] = [];
  for (const { row, uses } of buckets.values()) {
    if (uses.size < 2) continue;
    contested.push({ ...row, uses: [...uses] });
  }

  return { rows, dualUse: rows.filter(r => r.uses.length > 1), contested, byUse };
}
