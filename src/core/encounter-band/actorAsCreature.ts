/**
 * A CHARACTER, IN THE SHAPE THE SCHEDULER ALREADY READS.
 *
 * The checker has an action scheduler. `actionTrace` fills a Multiattack budget, spends limited
 * abilities early because "use powerful limited abilities early, multiattack otherwise", honours
 * recharge, prices a save for half, and only lets a replacement take a routine slot when it is
 * worth more than what it displaces. All of it is built, gated, and unreachable from a PC — the
 * engine consumes `MainMonsterTemplate` and nothing adapts an `ActorAction` into one.
 *
 * Christopher, 2026-09-07: *"why do i have to do that for each of the actors why doesnt the
 * encounter checker already capable of doing that"*. It is capable. This is the missing adapter,
 * not a second model — RULE ZERO: import the implementation, never write a parallel one.
 *
 * ─── ⚠ THIS PRODUCES THE AT-WILL CHARACTER, AND THAT IS THE POINT ───────────────────────────
 *
 * `Resource Conversion` row 5: *"Base DPR must exclude every resource listed below … This keeps
 * each slot and feature from entering the checker twice."* So every action that spends a slot, a
 * pool, a free cast or a charge is LEFT OUT here and owned by `resourceLedger`. What remains is
 * what the character can do all day for nothing: weapon attacks and cantrips.
 *
 * ⚠ FORMULAS ARE RESOLVED AGAINST THE ACTOR FIRST. `parseCreature` re-resolves what it is handed
 * through `resolveMonsterActionFormulas`, which reads a CREATURE's ability block. An actor's
 * `@STR`/`@SPELL`/`@PROF` mean the character's, so they are resolved here and the monster resolver
 * then has nothing left to do. Handing it raw actor tokens would silently reprice them.
 */

import type { Actor } from "../types/actor";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import type { MonsterRider } from "../monsters/monsterRider";
import { resolveFormulaVars } from "../state/resolveFormulaVars";
import { proficiencyBonus } from "../rules/dnd5e";
import { resolveNamedResourceCost } from "../state/consumeActionResources";
import { itemChargesFor, itemChargeKey } from "../state/itemCharges";
import { readsAsHealing } from "../../modules/dnd-5e/slotCapability";
import { featPricing } from "../../modules/dnd-5e/featPricing";
import { damageExpressionAverage } from "./damageExpression";
import { standingStylesOf, styleRidesAction } from "../rules/weaponStyles";
import type { SummonSpec } from "../monsters/summon";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
type AbilityId = (typeof ABILITIES)[number];

/** An action the ledger owns rather than the routine — it spends something. */
export type ResourceSpendingAction = {
  id: string;
  label: string;
  tab: string;
  /** The slot level it spends, when it is a levelled spell. */
  spellLevel?: number;
  /** The named pool it spends, when the sheet says one. */
  resourceId?: string;
  resourceCost?: number;
  /** The pool label `resolveNamedResourceCost` matched, when the cost is named rather than id'd. */
  poolLabel?: string;
  /**
   * A printed usage LIMIT that matches no pool on this sheet — "No Slot 2/LR" with no
   * `Hunter's Mark (Free)` row linked to it.
   *
   * ⚠ IT MUST STILL COUNT AS A SPEND. The action is limited, so it cannot join the at-will base:
   * a 2-per-day rider left in the base would give Lyrielle +1d6 on every attack all day. But
   * nothing sizes it either, so it cannot be scheduled — it is carried here so the resolver can
   * name it with the cost it actually printed instead of a generic apology.
   */
  unsizedCost?: string;
  /** The item pool it draws on — `itemChargeKey`, the same key the ledger's item row carries. */
  chargeKey?: string;
  /** Full damage expression, already resolved against this actor. */
  damage?: string;
  attack?: string;
  saveDc?: string;
  /**
   * What a SUCCESSFUL save still takes — "half" or a formula, and NEVER assumed. The field is on
   * `ActorActionMetadata` and neither this adapter nor the resolver read it, so every authored
   * save-for-half spell was priced all-or-nothing: a Fireball whose text says half was worth
   * `damage x P(fail)` and lost the other half outright.
   */
  successDamage?: string;
  /**
   * AN EFFECT THAT KEEPS DEALING DAMAGE WHILE ITS TARGET KEEPS FAILING — see
   * `ActorActionMetadata.ongoingDamage`. An absent `damage` means the WEAPON's damage, which is
   * Ensnaring Strike's own shape and is resolved by the caller that knows what the weapon is.
   */
  ongoing?: { repeat: "save-ends"; timing?: "start" | "end"; damage?: string; maxTurns?: number };
  /**
   * ⚠ WHICH OF THE THREE CHANCE CASES THIS IS. Christopher, 2026-09-07:
   *   · `rider`        spent only AFTER the hit lands, so its value is NOT discounted again
   *   · `spell-action` spent before the roll resolves, so its value is already expected
   *   · `extra-action` resolves its own hit chance normally
   */
  trigger: "rider" | "spell-action" | "extra-action";
  /**
   * ⚠ DOES IT COST THE ACTION, OR DOES IT COST SOMETHING ELSE?
   *
   * `Resource Conversion` row 43: *"Use marginal damage above the action that the spell or feature
   * replaces. Action spells cannot be added on top of the actor's normal Action."* The converse is
   * just as load-bearing and is what `economyCost` already records: a BONUS action spell replaces
   * nothing, so subtracting the at-will routine from it would price Spiritual Weapon as worth less
   * than the swing it never gave up.
   */
  costsTheAction: boolean;
};

/** A body this character can put on the board — see `ActorActionMetadata.summon` and BR099. */
export type SummonedBody = {
  /** The action that calls it, so its cost can be found in the ledger. */
  sourceId: string;
  sourceLabel: string;
  tab: string;
  spec: SummonSpec;
  /** True when calling it spends nothing — a companion that is simply THERE. */
  free: boolean;
};

export type ActorAsCreature = {
  /** At-will only — the shape `parseCreature` and `traceCreature` consume. */
  creature: MainMonsterTemplate;
  /** Everything excluded from the base, for `resourceLedger` to price. */
  spends: ResourceSpendingAction[];
  /**
   * ⚠ BODIES THIS CHARACTER BRINGS — and the read had NO handling at all.
   *
   * Christopher, 2026-09-23: *"the beast of the land is a constant not a timed summon and it can be
   * revived"*, *"the artificer cannon ... would almost always have the cannon out"*, and the Covenant
   * bond *"has a action that summons and then buffs with the summon lasting 2 round so its a cycle"*.
   * Three bodies fighting beside the party, each worth nothing in every fight the checker priced.
   */
  summons: SummonedBody[];
  /** Anything that carries damage and could not be classified, named rather than dropped. */
  unreadable: string[];
  /**
   * Counted, but resting on a stated assumption — the contract's `ESTIMATED`, not its
   * `NEEDS DM INPUT`. A printed requirement the app cannot evaluate is recorded here so the number
   * it produced can be argued with, rather than silently discounted or silently ignored.
   */
  assumptions: string[];
};

/**
 * A PRINTED REQUIREMENT ON A FREE RIDER — read, recorded, and NOT quietly discounted.
 *
 * Christopher, 2026-09-07: *"momentum strike has a movement requirement, spirit shield has a range
 * it requires but should be considered usable in most fights per round."*
 *
 * Both are conditions, and the workbook is explicit about what to do with a positional one.
 * `Pricing Resolver` rows 50 and 56: *"Change each side's reachable-target fraction ONLY when
 * terrain and ranges make the movement relevant."* The checker has no terrain, so the honest
 * reading is that the requirement is met — which is exactly what Christopher says about the range
 * one — and the requirement is carried as an assumption rather than as a number pulled from
 * nowhere. `MonsterRider.chance` is left unset, which the pricer reads as "always", and a DM who
 * knows this fight is fought in a corridor can say so.
 */
const POSITIONAL_REQUIREMENT = new RegExp(
  [
    "\\b(?:if|when|after)\\s+you\\s+(?:have\\s+)?move",
    "\\bmoved?\\s+at\\s+least\\s+\\d+",
    "\\bwithin\\s+\\d+\\s*(?:feet|ft)",
    "\\brange\\s+of\\s+\\d+",
  ].join("|"),
  "i",
);

/** A stated frequency — "2/LR", "1 per encounter". A body that prints one is not simply there. */
const PRINTED_LIMIT = /\d+\s*(?:\/|per\s+)\s*(?:LR|SR|day|turn|round|encounter|long rest|short rest)\b/i;

function resolved(text: string | undefined, actor: Actor): string | undefined {
  if (!text) return undefined;
  try {
    const out = resolveFormulaVars(text, actor as never);
    return /@[A-Za-z]/.test(out) ? undefined : out;
  } catch {
    return undefined;
  }
}

/** "18 (+4)" — the printed form the creature reader expects. */
function abilityValue(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return `${score} (${mod >= 0 ? "+" : ""}${mod})`;
}

/**
 * A SPELL ATTACK'S BONUS IS OFTEN NOT IN THE STRING.
 *
 * Sheets author cantrips as a bare "1d20" — the roll, with the bonus left to the character.
 * `@SPELL` is the actor's spell attack bonus and is what the card adds, so it is what this adds
 * when the string carries no signed term of its own.
 */
function attackRollFor(raw: string | undefined, actor: Actor, isSpell: boolean): string | undefined {
  const text = resolved(raw, actor);
  if (!text) return undefined;
  if (/[+-]\s*\d/.test(text.replace(/\d*\s*d\s*\d+/gi, " "))) return text;
  if (!isSpell) return text;
  const spellBonus = resolved("@SPELL", actor);
  return spellBonus ? `${text}${spellBonus}` : text;
}

function actionsOf(actor: Actor): Array<{ tab: string; action: Record<string, unknown> }> {
  const out: Array<{ tab: string; action: Record<string, unknown> }> = [];
  for (const [tab, list] of Object.entries(actor.tabs ?? {})) {
    if (!Array.isArray(list) || tab === "resources" || tab === "notes" || tab === "status") continue;
    for (const a of list as Record<string, unknown>[]) if (a) out.push({ tab, action: a });
  }
  return out;
}

/**
 * HOW OFTEN A STYLE'S DAMAGE LANDS — read off the workbook's own trigger line, never assumed.
 *
 * Christopher, 2026-09-23: *"things like great weapon fighting effect 1 attack per turn so they cant
 * read as always on since that would effect one hit"*. He is right that a style is not automatically a
 * bonus on every hit, and the workbook already says which is which per style, in `trigger`:
 *
 *   Archery                "Every eligible ranged-weapon attack"
 *   Dueling                "Each hit with an eligible one-handed melee weapon"
 *   Great Weapon Fighting  "Every damage roll with an eligible two-handed/versatile melee weapon"
 *   Great Weapon Master    "Heavy Weapon Master ONCE PER TURN; Hew only on critical hit or ..."
 *
 * So the cadence comes from the same table that prices the feat, rather than from a rule written
 * here — and a style the workbook does not know is read the conservative way, once a turn.
 */
function styleCadence(label: string): "per-hit" | "once-per-turn" {
  const trigger = String(featPricing(label)?.trigger ?? "");
  if (/once per turn/i.test(trigger)) return "once-per-turn";
  if (/(?:every|each)/i.test(trigger)) return "per-hit";
  return "once-per-turn";
}

export function actorAsCreature(actor: Actor): ActorAsCreature {
  const md = (a: Record<string, unknown>) => (a.metadata ?? {}) as Record<string, string | number | undefined>;
  const spends: ResourceSpendingAction[] = [];
  const unreadable: string[] = [];
  const assumptions: string[] = [];
  const atWill: MainMonsterTemplate["actions"] = [];
  /** At-will damage that has no roll of its own — it rides an attack this character already makes. */
  const freeRiders: MonsterRider[] = [];
  /**
   * ⚠ THE READ PARTY HAD NO REACTIONS AT ALL — `reactions: []`, hard-coded, on every character.
   *
   * Christopher, 2026-09-23: *"reactions because of my 5 party memeber everyone of them except iskarn
   * has a reaction that interacts with the creatures and iskarn only doesnt have a reaction because he
   * doesnt have a shield at this point."* Four of five characters were read without the thing they do on
   * every round that is not their own.
   *
   * A reaction is NOT part of the turn routine, so it cannot go in `actions` — that would hand the
   * character an extra attack on their own turn, every turn. It goes where a monster's reactions go, and
   * `actionTrace` already owns the economy: one Reaction a turn, shared with the Bonus Action, with the
   * printed "this does not use your reaction" disclaimers honoured.
   */
  const reactions: MainMonsterTemplate["reactions"] = [];
  const summons: SummonedBody[] = [];
  /** This actor's own pool labels — what `resolveNamedResourceCost` matches a cost against. */
  const poolRefs = ((actor.tabs?.resources ?? []) as unknown as Array<{ id?: string; label?: string }>)
    .filter(x => x?.label).map(x => ({ id: x.id, label: String(x.label) }));

  /**
   * ⚠ THE FIGHTING STYLES THIS CHARACTER ALWAYS HAS. Christopher, 2026-09-23: Archery *"is a added +2 and
   * effects all ranged attacks"*. The card arms a passive style permanently; nothing armed them here, so
   * every read party swung without Archery, Dueling or Great Weapon Fighting. `weaponStyles` owns which
   * attacks each one rides — the same rule the card uses, not a second copy of it.
   */
  const standingStyles = standingStylesOf(actor);
  /**
   * Which ROWS each damage style turned out to ride. A style nothing rides earns nothing, and its
   * once-a-turn rider has to sit on the best of the attacks it actually rides — Dueling does not ride
   * a greatsword just because the greatsword hits hardest.
   */
  const styleRows = new Map<string, MainMonsterTemplate["actions"]>();

  for (const { tab, action } of actionsOf(actor)) {
    const m = md(action);
    const label = String(action.label ?? "(unnamed)");
    const damage = resolved(String(m.damage ?? ""), actor);
    const isSpell = action.actionKind === "spell" || m.spellLevel !== undefined;
    const spellLevel = Number(m.spellLevel ?? 0) || 0;

    /**
     * ⚠ HEALING IS NOT ALWAYS TAGGED, AND AN UNTAGGED HEAL WAS BEING PRICED AS DAMAGE.
     *
     * `outcomeMode: "healing"` is authored on some sheets and not others — the campaign Paladin's
     * Cure Wounds carries none — so a heal with a damage expression and no attack roll fell
     * through and was classified as an ON-HIT RIDER. Cure Wounds, Healing Word and Aid were all
     * being scheduled as offence.
     *
     * The text is read the same way `slotCapability` reads it, so one answer to "does this heal"
     * rather than two that can disagree. Sustain is owned by `partyHealingFromActors`.
     */
    const healText = `${label} ${m.details ?? ""} ${(action as { description?: string }).description ?? ""}`;
    /**
     * ⚠ A SUMMON IS READ BEFORE THE DAMAGE GUARDS, because the body IS the damage and the action
     * that calls it usually has none of its own. `if (!damage && !m.attack) continue` dropped every
     * one of them — the cannon, the Beast, the Covenant bond-creature — before anything could look.
     */
    const summonSpec = ((action.metadata ?? {}) as Record<string, unknown>).summon as SummonSpec | undefined;
    if (summonSpec) {
      summons.push({
        sourceId: String(action.id ?? label), sourceLabel: label, tab, spec: summonSpec,
        // Nothing named, nothing levelled, no charge, no printed limit: it is simply there.
        free: !(spellLevel > 0
          || m.resourceId
          || itemChargesFor(action as never)
          || resolveNamedResourceCost(action as never, poolRefs as never)
          || PRINTED_LIMIT.test(`${m.slotCost ?? ""} ${m.cost ?? ""}`)),
      });
      continue;
    }
    if (m.outcomeMode === "healing" || readsAsHealing(healText)) continue;
    if (!damage && !m.attack) continue;

    /**
     * ⚠ SPENDS SOMETHING -> THE LEDGER, NOT THE ROUTINE. A levelled spell, a named pool, an item
     * charge or a free cast is a resource; the base must exclude it or it enters the checker
     * twice. `metadata.resourceId` is the authored link the sheets have always carried.
     */
    /**
     * ⚠ ASK THE RESOLVER, NOT A LIST OF FIELDS. Checking `resourceId` and `spellLevel` alone
     * missed every action that names its cost through `slotCost` or its prose — Psionic Strike
     * spends a Psionic Energy Die and was read as spending NOTHING, so it sat in the at-will base
     * where "base DPR must exclude every resource" says it must not be.
     */
    const namedPool = resolveNamedResourceCost(action as never, poolRefs as never);
    /**
     * ⚠ AN ITEM POOL IS ASKED FOR THROUGH `itemCharges`, NOT BY LOOKING AT THE FIELD.
     *
     * `Boolean(m.charges)` was true for `{ max: 0 }` and for a malformed value, and it produced no
     * KEY — so the spend it created could never be matched to the ledger row that sizes it, and an
     * item that spends a charge was excluded from the base and then priced at zero. The key is
     * what links the two, and `itemChargeKey` is the one that already links an item's equipment
     * row to its attack row.
     */
    const itemPool = itemChargesFor(action as never);
    /**
     * ⚠ A PRINTED LIMIT WITH NO POOL BEHIND IT IS STILL A LIMIT.
     *
     * `slotCost: "No Slot 2/LR"` says two things: no slot, and twice per Long Rest. The first
     * half is why `resolveNamedResourceCost` correctly declines to call it a pool. The second
     * half is why the action must NOT fall through into the at-will base — a twice-a-day rider
     * counted as free would give a Ranger +1d6 on every attack of every fight.
     *
     * So a stated frequency counts as a spend even when nothing sizes it, and the resolver says
     * so by name. The pattern reads a COUNT PER PERIOD and nothing else; "Bonus Action" and
     * "Action" carry no frequency and are untouched.
     */
    const limitText = `${m.slotCost ?? ""} ${m.cost ?? ""}`;
    // One pattern, shared with the summon branch — a second copy of "what a stated frequency looks
    // like" is the drift this file's other shared readers exist to prevent.
    const printedLimit = limitText.match(PRINTED_LIMIT)?.[0];
    const spendsResource = spellLevel > 0
      || Boolean(m.resourceId)
      || Boolean(itemPool)
      || Boolean(namedPool)
      || Boolean(printedLimit)
      || m.spellSlotMode === "freeCast";

    // Structured, so it is read off the raw metadata rather than the string-shaped view above.
    const ongoingSpec = ((action.metadata ?? {}) as Record<string, unknown>).ongoingDamage as
      ResourceSpendingAction["ongoing"] | undefined;
    if (spendsResource) {
      const trigger: ResourceSpendingAction["trigger"] = m.attack
        ? "spell-action"
        : damage && !m.saveDc
          ? "rider"          // damage, no roll of its own: it lands on someone else's hit
          : "spell-action";
      spends.push({
        id: String(action.id ?? label), label, tab,
        ...(spellLevel > 0 ? { spellLevel } : {}),
        ...(m.resourceId ? { resourceId: String(m.resourceId) } : {}),
        ...(namedPool ? { poolLabel: namedPool } : {}),
        ...(!namedPool && !itemPool && spellLevel === 0 && !m.resourceId && printedLimit
          ? { unsizedCost: (String(m.slotCost ?? "").trim() || printedLimit) } : {}),
        ...(itemPool ? { chargeKey: itemChargeKey(String(action.id ?? label)) } : {}),
        ...(m.resourceCost !== undefined ? { resourceCost: Number(m.resourceCost) } : {}),
        ...(damage ? { damage } : {}),
        ...(m.attack ? { attack: String(m.attack) } : {}),
        ...(m.saveDc ? { saveDc: String(m.saveDc) } : {}),
        ...(m.successDamage ? { successDamage: String(m.successDamage) } : {}),
        ...(ongoingSpec ? { ongoing: ongoingSpec } : {}),
        trigger,
        /**
         * An authored `economyCost` of "bonus", "reaction" or "bond" says plainly that this does
         * not cost the Action. An UNSET one is not a claim either way, and the safe reading for a
         * spell is that it costs the Action — pricing it as free would add it on top of the
         * routine, which row 43 forbids in as many words.
         */
        /**
         * ⚠ AND A SPELL'S PRINTED CASTING TIME IS A STATEMENT TOO.
         *
         * Christopher, 2026-09-23: *"ensnaring strike isnt a spell action its a bonus action."* A sheet
         * that authored the casting time and left `economyCost` unset fell into the default above and
         * was charged the whole at-will routine — row 43's marginal-damage rule, applied to a spell
         * that displaces nothing. On a two-attack character that is the difference between a Bonus
         * Action spell being worth its dice and being worth its dice MINUS a full round of swinging,
         * which can price it below zero and drop it out of the schedule entirely.
         *
         * `castingTimeType` is the printed line, not an inference from prose, so it is read before the
         * default is reached. An explicit `economyCost` still outranks it: that is the card's own
         * economy and it is what the table actually spends.
         */
        costsTheAction: (action.economyCost as string[] | undefined)?.length
          ? (action.economyCost as string[]).includes("main")
          : m.castingTimeType !== undefined
            ? m.castingTimeType === "action" || m.castingTimeType === "ritual"
            : true,
      });
      continue;
    }

    /**
     * ⚠ SPENDS THE REACTION -> IT IS A REACTION, not a second attack on this character's own turn.
     *
     * A row that costs the Reaction and no resource used to fall straight into `atWill`, where the
     * routine swings it every turn alongside the character's actual attacks. Riposte, Hellish Rebuke,
     * an opportunity attack rider — each was worth a full extra action a round.
     */
    const costs = (action.economyCost as string[] | undefined) ?? [];
    if (costs.includes("reaction")) {
      const reactionRoll = attackRollFor(m.attack ? String(m.attack) : undefined, actor, isSpell);
      if (!reactionRoll && !m.saveDc && !damage) continue;
      reactions.push({
        name: label,
        ...(reactionRoll ? { roll: reactionRoll } : {}),
        ...(damage ? { damage } : {}),
        ...(m.damageType ? { damageType: String(m.damageType) } : {}),
        ...(m.saveDc ? { save: resolved(String(m.saveDc), actor) ?? String(m.saveDc) } : {}),
        ...(m.successDamage ? { successDamage: String(m.successDamage) } : {}),
        ...(m.range ? { range: String(m.range) } : {}),
        // The printed text, so the trace can read a "this does not use your reaction" disclaimer.
        ...(healText.trim() ? { text: healText.trim() } : {}),
      } as never);
      assumptions.push(`${label} (${tab}): read as a REACTION, not as part of this character's turn. It resolves once a round on somebody else's turn, on the same Reaction budget as everything else they hold.`);
      continue;
    }

    // ── At-will: it costs nothing but the action it is already taking ────────
    const roll = attackRollFor(m.attack ? String(m.attack) : undefined, actor, isSpell);
    if (!roll && !m.saveDc) {
      /**
       * ⚠ FREE DAMAGE WITH NO ROLL OF ITS OWN IS A RIDER, AND IT WAS BEING THROWN AWAY.
       *
       * This branch used to name the action and drop it. But damage, no attack roll, no save and
       * no cost is not unreadable — it is the exact shape of a rider, and `spends` above already
       * classifies the same shape that way for a resource ("damage, no roll of its own: it lands
       * on someone else's hit"). The only difference is that this one is free, so it rides EVERY
       * turn rather than as many turns as the pool allows.
       *
       * ⚠ CADENCE IS `once-per-turn`, NOT `per-hit`. A character takes one turn; the rider fires
       * when at least one of that turn's attacks connects. Charging it per attack would double it
       * on an Extra Attack character, which `monsterRider` calls the commonest way to overprice a
       * rider.
       */
      const average = damageExpressionAverage(damage);
      if (average > 0) {
        const requirement = POSITIONAL_REQUIREMENT.test(healText);
        freeRiders.push({
          name: label,
          damage: damage!,
          cadence: "once-per-turn",
          ...(m.damageType ? { damageType: String(m.damageType) } : {}),
          note: requirement
            ? "printed positional requirement, counted as met — the checker has no terrain"
            : "free damage with no roll of its own — it rides this character's attack",
        });
        if (requirement) {
          assumptions.push(`${label} (${tab}): prints a movement or range requirement. It is counted as met every turn, because the checker has no terrain and the workbook only reprices reach "when terrain and ranges make the movement relevant". Say otherwise if this fight is fought somewhere that stops it.`);
        }
      } else if (damage || m.damage) {
        unreadable.push(`${label} (${tab}): rolls ${m.damage} with neither an attack roll nor a save DC, and spends nothing`);
      }
      continue;
    }
    // A standing style rides only the attacks its target names — Archery a ranged WEAPON attack, never a
    // ranged spell, a bond strike or a cannon. `styleRidesAction` is that test, shared with the card.
    const rides = roll ? standingStyles.filter(st => styleRidesAction(st.target, action as never)) : [];
    // Accuracy is per attack by definition — "its a added +2 and effects all ranged attacks".
    const styleAttack = rides.reduce((n, st) => n + st.attack, 0);
    // Damage is not. Each style lands as often as the workbook says it lands, and no more often.
    const damageStyles = rides.filter(st => st.damage > 0);
    const perHit = damageStyles.filter(st => styleCadence(st.label) === "per-hit");
    const onceATurn = damageStyles.filter(st => styleCadence(st.label) === "once-per-turn");
    const perHitDamage = perHit.reduce((n, st) => n + st.damage, 0);
    if (rides.length > 0) {
      const parts = [
        styleAttack ? `+${styleAttack} to hit on every attack it rides` : "",
        perHitDamage ? `+${perHitDamage} damage on each hit (${perHit.map(st => st.label).join(", ")})` : "",
        onceATurn.length ? `${onceATurn.map(st => `+${st.damage} damage once a turn (${st.label})`).join(", ")}` : "",
      ].filter(Boolean).join("; ");
      assumptions.push(`${label} (${tab}): ${rides.map(st => st.label).join(", ")} applied — ${parts}. The style is always armed, so it is read as standing; how often its damage lands is the workbook's own trigger line for that style, not an assumption made here.`);
    }
    /**
     * ⚠ ACCURACY RIDES EVERY ATTACK; STYLE DAMAGE RIDES WHAT ITS TRIGGER SAYS.
     *
     * Christopher, 2026-09-23: *"great weapon fighting effect 1 attack per turn so they cant read as always
     * on since that would effect one hit"*. A style's TO-HIT lands on every attack it rides — that is what
     * accuracy is, and the trace rolls each attack separately. Its DAMAGE lands on each hit or once a turn,
     * per `styleCadence`; a once-a-turn one becomes a rider below, priced at P(one of the turn's attacks
     * connects) instead of being paid out on every swing.
     */
    const styledRoll = roll && styleAttack ? `${roll}+${styleAttack}` : roll;
    const styledDamage = damage && perHitDamage ? `${damage} + ${perHitDamage}` : damage;
    const entry = {
      name: label,
      kind: styledRoll ? "attack" : "action",
      ...(styledRoll ? { roll: styledRoll } : {}),
      ...(styledDamage ? { damage: styledDamage } : {}),
      ...(m.damageType ? { damageType: String(m.damageType) } : {}),
      ...(m.saveDc ? { save: resolved(String(m.saveDc), actor) ?? String(m.saveDc) } : {}),
      ...(m.successDamage ? { successDamage: String(m.successDamage) } : {}),
      ...(m.range ? { range: String(m.range) } : {}),
    } as never;
    atWill.push(entry);
    for (const st of onceATurn) {
      const rows = styleRows.get(st.label) ?? [];
      rows.push(entry);
      styleRows.set(st.label, rows);
    }
  }

  /**
   * A STYLE'S DAMAGE IS ONE ATTACK A TURN, so it is a once-per-turn rider rather than a bonus on every
   * hit — Great Weapon Fighting is the case that says so. It rides the best attack, like every other
   * once-per-turn rider, and the trace prices it at P(at least one of this turn's attacks connects).
   */
  for (const st of standingStyles) {
    const rows = st.damage > 0 ? styleRows.get(st.label) ?? [] : [];
    if (rows.length === 0) continue;
    const best = rows.reduce((b, a) =>
      damageExpressionAverage((a as { damage?: string }).damage) > damageExpressionAverage((b as { damage?: string }).damage) ? a : b);
    (best as { riders?: MonsterRider[] }).riders = [
      ...((best as { riders?: MonsterRider[] }).riders ?? []),
      {
        name: st.label,
        damage: String(st.damage),
        cadence: "once-per-turn",
        note: "fighting style damage — one attack a turn",
      },
    ];
  }

  /**
   * ⚠ A RIDER NEEDS SOMETHING TO RIDE, AND IT IS THE BEST ATTACK, NOT THE FIRST ONE.
   *
   * The trace prices a once-per-turn rider at "P(at least one of this turn's attacks connects)",
   * so the rider has to sit on the attack the routine will actually schedule — attaching it to a
   * weak backup would price it against an attack this character never makes. Highest per-hit
   * damage is the same ordering the scheduler itself uses to fill the routine.
   *
   * ⚠ AND WHEN THERE IS NO ATTACK, IT IS UNREADABLE AGAIN. A pure caster with a free damage rider
   * and no weapon has nothing for it to land on, and inventing an attack for it to ride would be
   * the fabrication this whole file exists to avoid.
   */
  if (freeRiders.length > 0) {
    const attacks = atWill.filter(a => (a as { roll?: string }).roll);
    const best = attacks.length > 0
      ? attacks.reduce((b, a) =>
        damageExpressionAverage((a as { damage?: string }).damage) > damageExpressionAverage((b as { damage?: string }).damage) ? a : b)
      : undefined;
    if (best) {
      (best as { riders?: MonsterRider[] }).riders = [
        ...((best as { riders?: MonsterRider[] }).riders ?? []), ...freeRiders,
      ];
    } else {
      for (const r of freeRiders) {
        unreadable.push(`${r.name}: ${r.damage} that rides an attack, but this character has no at-will attack for it to ride`);
      }
    }
  }

  const scores = (actor.abilityScores ?? {}) as Partial<Record<AbilityId, { score?: number }>>;
  const level = Math.max(1, Number(actor.level ?? 1));

  const creature: MainMonsterTemplate = {
    templateId: `actor:${actor.id}`,
    name: actor.name,
    stats: {
      kind: "humanoid",
      ac: Number(actor.stats?.ac ?? 10),
      maxHp: Number(actor.stats?.hp?.max ?? 1),
      speed: String(actor.stats?.speed ?? "30 ft."),
      attacksPerTurn: Math.max(1, Number(actor.attacksPerAction ?? 1)),
      size: "Medium",
      classification: "elite",
      /**
       * The character's own proficiency, which `@PROF` and every save tick already resolve from.
       * A companion carries its OWNER's, stamped at the hydration boundary — read it when present
       * rather than re-deriving from the beast's level.
       */
      proficiencyBonus: Number(actor.proficiencyBonus ?? proficiencyBonus(level)),
      defenses: [],
    },
    abilities: ABILITIES.map(id => ({
      label: id.toUpperCase(),
      value: abilityValue(Number(scores[id]?.score ?? 10)),
    })),
    actions: atWill,
    traits: [],
    reactions,
  } as never;

  return { creature, spends, summons, unreadable, assumptions };
}
