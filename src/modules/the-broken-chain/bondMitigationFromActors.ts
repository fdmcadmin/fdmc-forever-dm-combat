/**
 * WHAT THE PARTY'S BONDS PREVENT, PER ROUND — read from the characters' own assignments.
 *
 * Christopher, 2026-09-01: *"there is no healing being shown at all even though we have a bond
 * that heals and a tank bond that give temp hp on one side and prevented or forced attack
 * priority."* Then, on the scope of it: *"almost every bond has some version of damage reduction
 * for self or others."*
 *
 * He is right, and the inventory is not close: of the fourteen bonds, all but the purely mobile
 * ones carry mitigation on at least one branch, and the UNCHOSEN branch keeps a weaker version of
 * it — so a Devout who took Wrath still has Shelter's temporary HP available every round.
 *
 * ─── ⚠ WHY THE CHECKER SAW NONE OF IT ───────────────────────────────────────────────────────
 *
 * `SimulationRound` has `partyDamage`, `monsterDamage`, `downs`, `standing`. There was no term
 * for a hit that never landed. `partyHealingFromActors` existed but reached only a caption, and
 * by design counted flat healing-only pools (Lay on Hands) — bonds were never in its vocabulary.
 * So every Act 3 gate was priced against a party with no Guardian's Stand, no Aegis, no Lifeline
 * and no Iron Ward, which is not the party anyone is playing.
 *
 * ─── ⚠ THIS PARSES NOTHING. RULE 0: WIRE, DO NOT REWRITE ────────────────────────────────────
 *
 * `bondActions.generatedBondActions` already turns an assignment into the live options at the
 * character's stage — both of them, chosen and held — and already tags each with the die
 * (`metadata.damage`), the kind (`metadata.effectKind`: damage / healing / temp / reduction) and
 * the unresolved-modifier note. Every one of those decisions is load-bearing and was made against
 * real bond text. Re-reading the prose here would be a second classifier to keep in step with the
 * first, and it would be wrong in different places.
 *
 * One thing is refined rather than re-derived: `effectKindFor` calls BOTH
 * *"reduces the hit by 1d8 + PB"* and *"reduce the next attack roll against you by 1d8"* a
 * `reduction`, because for a roll button they are the same word. They are not the same mechanic —
 * one removes damage, the other removes ACCURACY — so this separates them, and prices only the
 * first.
 *
 * ─── WHAT IS PRICED, AND WHAT IS REPORTED INSTEAD ───────────────────────────────────────────
 *
 * PRICED, because each is HP that does not leave the party:
 *   reduction  Guardian's Stand, Iron Ward, Shielding Bond, Breach — the hit is smaller.
 *   temp       Aegis, Ironward — HP that absorbs before real HP does.
 *   healing    Lifeline, Rallying Surge — HP that comes back.
 *
 * REPORTED, NEVER PRICED — nothing is silent, but nothing is invented either:
 *   accuracy   *"reduce the next attack roll against you by 1d8"* (Vanguard, Tactician) and the
 *              disadvantage riders (Precise, Suppressing). These reduce HIT CHANCE. Converting
 *              them needs the per-attack damage of the body being debuffed, which the roster
 *              holds as a round total and not per swing. A guess here is a guess applied to every
 *              fight in the campaign.
 *   body       Covenant's Call manifests a bond-creature with its own HP. It is a legal target,
 *              so attacks spent on it are attacks not spent on a PC. Christopher: *"same with
 *              covenant."* Pricing it needs a hostile TARGETING model, not just the summon's HP.
 *   cost       Siphon's Sacrifice TAKES party HP, un-preventably, to buy damage. The only
 *              negative entry in the ladder, and it is never netted against the capacity.
 *   avoidance  An opportunity attack that never happens. Skirmish's Dart moves the character out
 *              without provoking; Precise's Disrupt denies the enemy its OA outright. Christopher:
 *              *"dart lets the POC move without OA happening."* A defense need not print a die.
 *   targeting  Challenge and Sovereign's Cry REDIRECT damage onto the tank. They change WHO goes
 *              down under focus fire, not how much the party takes. That is the allocator's
 *              question, not this one.
 *
 * ⚠ `+ your modifier` IS NOT RESOLVED, and that is the existing ruling, not a new one.
 * `bondActions` records it: *"the document never says WHICH modifier. It is carried as a printed
 * note on the row, never folded into the rollable formula."* Unbroken bonds therefore price at
 * `1d12 + PB` and the missing term is reported. Inventing an ability here would silently inflate
 * every level-13+ party.
 */

import type { Actor } from "../../core/types/actor";
import type { BondStageGate } from "../../core/types/bond";
import { generatedBondActions } from "../../core/rules/bondActions";
import { proficiencyBonus } from "../../core/rules/dnd5e";
import { damageExpressionAverage } from "../../core/encounter-band/damageExpression";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "./content/bondTemplates";
import { BROKEN_CHAIN_BOND_GATES } from "./content/bondGates";

/** What a bond option does for the party's survival. */
export type MitigationKind = "reduction" | "temp" | "healing";

export type BondMitigationSource = {
  actor: string;
  bond: string;
  /** The option this figure came from — "Guardian's Stand", "Shelter". */
  option: string;
  kind: MitigationKind;
  /** Expected HP per round, already averaged and with PB resolved. */
  amount: number;
  /** True when this option is the HELD form of the path the character did not take. */
  held: boolean;
};

export type BondUnpriced = {
  actor: string;
  bond: string;
  option: string;
  /**
   * `accuracy`  a to-hit penalty or disadvantage.
   * `avoidance` an opportunity attack that never happens — Dart, Ghoststep, Disrupt.
   * `targeting` forced targeting, which redirects rather than reduces.
   * `body`      a summoned creature that soaks attacks — Covenant's Call.
   * `cost`      the option COSTS the party HP — Siphon's Sacrifice. Negative mitigation.
   * `modifier`  the term v13 names no ability for.
   */
  reason: "accuracy" | "avoidance" | "targeting" | "body" | "cost" | "modifier";
  detail: string;
};

export type PartyBondMitigation = {
  /** Expected HP per round the party's bonds prevent, absorb or restore. */
  perRound: number;
  sources: BondMitigationSource[];
  /** Everything real that this deliberately did not price. */
  unpriced: BondUnpriced[];
  /** Characters carrying no bond assignment at all — so a zero is never mistaken for a bug. */
  withoutBond: string[];
  /**
   * Characters whose bond is real, resolved, and simply has no mitigation on either branch.
   *
   * ⚠ THIS FIELD EXISTS BECAUSE A LIVE PARTY EXPOSED THE HOLE. Ripsnarl carries Skirmish Instinct
   * at Metamorphosis — Momentum and Dart, pure damage and movement. He produced no source, no
   * `unpriced` note and no `withoutBond` entry, so a DM reading a four-person party would see
   * three characters named and no account of the fourth. "Nothing is silent" is not satisfied by
   * a correct zero; it is satisfied by a zero that says whose it is.
   */
  bondWithoutMitigation: Array<{ actor: string; bond: string }>;
};

const EMPTY: PartyBondMitigation = {
  perRound: 0, sources: [], unpriced: [], withoutBond: [], bondWithoutMitigation: [],
};

/** Resolve `1d8+@PROF` with this character's proficiency, then average it. */
function averageWithProf(formula: string | undefined, level: number): number {
  if (!formula) return 0;
  const withPb = formula.replace(/@PROF/gi, `+${proficiencyBonus(Math.max(1, level))}`).replace(/\+\s*\+/g, "+");
  return damageExpressionAverage(withPb);
}

/**
 * A NUMERIC accuracy debuff — it reads as a `reduction` to the roll button but removes no damage.
 *
 * ⚠ THE TEST IS THE CLAUSE, NOT THE WORD. "reduces the hit by 1d8 + PB" and "reduce the next
 * attack roll against you by 1d8" differ only in what follows "reduce".
 */
function reducesAttackRoll(text: string): boolean {
  return /\battack\s+roll\b/i.test(text) && /\breduc/i.test(text);
}

/**
 * ⚠ DISADVANTAGE IS AN ACCURACY EFFECT AND IT WAS FALLING THROUGH SILENTLY.
 *
 * The first version of this file tested only for "reduce … attack roll", which catches Vanguard's
 * Iron Guard and Tactician's Destabilize. It caught NONE of the disadvantage bonds — Precise's
 * Expose, Suppressing's Steady Aim, Resonant's Runic Ward — because their text carries no die and
 * no "reduce", so `effectKindFor` never called them a reduction and they dropped out of the loop
 * with nothing said about them.
 *
 * That is the exact failure this codebase keeps paying for: not a wrong number, an ABSENT one. A
 * Resonant carrying Runic Bastion — two enemies at disadvantage every round — read as a bond with
 * no defensive value at all, and the panel had nothing to show a DM who knew better.
 */
function imposesDisadvantage(text: string): boolean {
  return /\bdisadvantage\b/i.test(text) && /\battack/i.test(text);
}

function isForcedTargeting(text: string): boolean {
  return /must\s+target\s+you\b/i.test(text);
}

/**
 * ⚠ AN OPPORTUNITY ATTACK THAT NEVER HAPPENS IS PREVENTED DAMAGE.
 *
 * Christopher, 2026-09-02, on Skirmish: *"this is one of the only bonds that doesnt have a stated
 * defense because dart lets the POC move without OA happening."*
 *
 * Exactly right, and the first version of this file got it wrong in a way worth recording. It
 * classified Skirmish as a bond with NO mitigation, because it looked for a stated number and Dart
 * states none. But "move up to 10 ft without provoking opportunity attacks" removes a whole attack
 * from the fight, and Precise's Disrupt does the same from the other side — *"the target cannot
 * make opportunity attacks"*. A defense does not have to print a die to be a defense.
 *
 * It stays UNPRICED for the same reason the accuracy bonds do: converting a denied opportunity
 * attack into HP needs that body's per-attack damage and how often the party would have provoked,
 * and the roster carries neither. Unpriced and named is the honest answer; "no mitigation" was
 * simply false.
 */
function avoidsOpportunityAttack(text: string): boolean {
  /**
   * ⚠ "WITHOUT PROVOKING" ALONE IS ENOUGH, and requiring the full phrase missed the real data.
   * Skirmish's HELD Dart row reads only *"Move up to 10 ft without provoking."* — the ladder
   * abbreviates once the option has been named, so the words "opportunity attacks" are absent from
   * the very row a Momentum character actually carries. Nothing else in 5e is provoked.
   */
  if (/\bwithout\s+provoking\b/i.test(text)) return true;
  if (/\bopportunity\s+attacks?\b/i.test(text)
    && /\bcannot\s+make\b|\bcan't\s+make\b|\bprevents?\b|\bno\s+OAs?\b/i.test(text)) return true;
  /**
   * ⚠ A SUPPRESSED REACTION IS AN ATTACK THAT NEVER HAPPENS. Suppressing's Keen Eye and Overwatch
   * *"suppress ALL of the target's reactions"*, which is the same prevented damage as denying an
   * opportunity attack — an OA is simply the commonest reaction. Left out, a Suppressing character
   * on the Keen Eye path read as carrying no defence whatsoever.
   */
  return /\bsuppress\w*\b/i.test(text) && /\breactions?\b/i.test(text);
}

/**
 * ⚠ A DRAIN THAT RETURNS THE DAMAGE AS HP IS HEALING, and the shared classifier cannot see it.
 *
 * Siphon's Exchange reads *"drain 1d8 from a creature you hit; regain that much HP."*
 * `effectKindFor` reads the CLAUSE the die sits in — "drain 1d8 from a creature you hit" — which
 * carries no healing word at all, so it lands on `damage` and the row was skipped entirely. The
 * healing is in the NEXT clause, and it is exactly the die's own value.
 *
 * This is not a fix to the shared classifier: for a ROLL BUTTON, "drain 1d8" genuinely is damage
 * and the button is right to say so. It is only for THIS question — what comes back to the party —
 * that the second clause decides.
 */
function healsViaDrain(text: string): boolean {
  return /\bdrains?\b/i.test(text) && /\bregain\b/i.test(text);
}

/**
 * ⚠ A SUMMONED BODY IS A DEFENCE — Christopher: *"same with covenant."*
 *
 * Covenant's Call manifests a bond-creature *"in an unoccupied space within 15 ft… Its HP equals
 * your class Hit Die maximum + your level."* That creature stands on the field for two turns and
 * is a legal target. Every attack spent on it is an attack not spent on a PC, and the roster's
 * focus-fire allocator has no idea it exists.
 *
 * Unpriced, and for a sharper reason than the others: pricing it needs a hostile TARGETING model —
 * how often the enemy chooses the summon over a character — which is exactly the "no tactical
 * invention" line the Initiative Scheduler draws. The HP is knowable; the share of attacks it eats
 * is not.
 */
function summonsBody(text: string): boolean {
  return /\bmanifest\b|\bbond-creature\b/i.test(text);
}

/**
 * ⚠ SIPHON'S SACRIFICE IS NEGATIVE MITIGATION AND NOTHING ELSE IN THE LADDER IS.
 *
 * *"Take 1d6 damage (cannot be reduced or prevented); your next damaging action this turn deals
 * 1d8."* A party running Sacrifice every round is spending its own HP for damage — the opposite of
 * everything else this file measures, and explicitly un-preventable, so no other bond's reduction
 * can offset it.
 *
 * It is reported rather than subtracted because this figure is the party's mitigation CAPACITY: it
 * already assumes the defensive option is the one played, and a table playing Sacrifice has chosen
 * the offensive line. Silently netting a cost against a capacity would describe neither.
 */
function costsOwnHp(text: string): boolean {
  // ⚠ THE LADDER DROPS THE NOUN AS IT ABBREVIATES: stage I writes "Take 1d4 damage", Deeper Cut
  // writes only "take 1d6;". Requiring the word "damage" missed every stage above the first.
  return /\btake\s+\d+d\d+\b/i.test(text);
}

/**
 * ⚠ MILESTONES ARE PER CHARACTER AND THE GATES ARE THE CAMPAIGN'S — the same pair `BondSummary`
 * reads. Passing neither would resolve every level-9 character to Tempered whether or not the
 * party has killed the Act 3 boss, which is exactly the overstatement the gate exists to prevent:
 * *"the party needs to have killed the act 3 boss for the bond upgrade."* A held bond must price
 * at the stage it is actually held at.
 */
export function partyBondMitigationFromActors(
  actors: readonly Actor[],
  ctx?: { gates?: readonly BondStageGate[] },
): PartyBondMitigation {
  if (!actors.length) return EMPTY;

  const sources: BondMitigationSource[] = [];
  const unpriced: BondUnpriced[] = [];
  const withoutBond: string[] = [];
  const bondWithoutMitigation: Array<{ actor: string; bond: string }> = [];
  let perRound = 0;

  for (const actor of actors) {
    const assignment = actor.moduleData?.bondAssignment;
    if (!assignment) { withoutBond.push(actor.name); continue; }
    const template = BROKEN_CHAIN_BOND_TEMPLATES.find(t => t.id === assignment.templateId);
    if (!template) { withoutBond.push(actor.name); continue; }

    const rows = generatedBondActions(template, assignment, {
      level: actor.level,
      milestones: actor.moduleData?.milestones ?? [],
      gates: ctx?.gates ?? BROKEN_CHAIN_BOND_GATES,
    });

    /**
     * ⚠ ONE BOND, ONE OPTION, ONE ROUND. Every stage from Realized up reads *"choose one"*, so a
     * Guardian either intercepts OR challenges on a given round — never both. Summing the options
     * would give a bond twice the effect its own text allows.
     *
     * The party's MITIGATION CAPACITY is therefore the best defensive option available, which is
     * what a table plays when survival is the question the checker is being asked. The panel names
     * the option so a DM who expects the offensive line instead can see exactly what was assumed.
     */
    let best: BondMitigationSource | null = null;

    for (const row of rows) {
      const text = String(row.description ?? row.metadata?.details ?? "");
      const kind = row.metadata?.effectKind as string | undefined;
      const held = (row.tags ?? []).includes("Held");
      const option = row.label;

      if (row.metadata?.withModifier) {
        unpriced.push({
          actor: actor.name, bond: template.name, option, reason: "modifier",
          detail: String(row.metadata.withModifier),
        });
      }
      if (isForcedTargeting(text)) {
        unpriced.push({
          actor: actor.name, bond: template.name, option, reason: "targeting",
          detail: "Redirects damage onto the tank rather than reducing it — an allocation effect.",
        });
        continue;
      }
      if (kind === "reduction" && reducesAttackRoll(text)) {
        unpriced.push({
          actor: actor.name, bond: template.name, option, reason: "accuracy",
          detail: "Reduces an ATTACK ROLL, not damage. Pricing it needs per-attack damage the roster does not carry.",
        });
        continue;
      }
      if (summonsBody(text)) {
        unpriced.push({
          actor: actor.name, bond: template.name, option, reason: "body",
          detail: "Manifests a bond-creature with real HP that is a legal target. Attacks spent on it are attacks not spent on a PC; pricing it needs a hostile targeting model the roster does not carry.",
        });
        continue;
      }
      if (costsOwnHp(text)) {
        unpriced.push({
          actor: actor.name, bond: template.name, option, reason: "cost",
          detail: "This option COSTS the party HP — damage that cannot be reduced or prevented. Not netted off the capacity above, which already assumes the defensive option is the one played.",
        });
        continue;
      }
      if (avoidsOpportunityAttack(text)) {
        unpriced.push({
          actor: actor.name, bond: template.name, option, reason: "avoidance",
          detail: "Removes an opportunity attack from the fight — real prevented damage, but pricing it needs that body's per-attack damage and how often the party would have provoked.",
        });
        continue;
      }
      if (imposesDisadvantage(text)) {
        unpriced.push({
          actor: actor.name, bond: template.name, option, reason: "accuracy",
          detail: "Imposes DISADVANTAGE on an attack — real mitigation, but a hit-chance effect. Pricing it needs the per-attack damage of the body being debuffed.",
        });
        continue;
      }
      const drainHeals = healsViaDrain(text);
      if (!drainHeals && kind !== "reduction" && kind !== "temp" && kind !== "healing") continue;

      const amount = averageWithProf(row.metadata?.damage as string | undefined, actor.level);
      if (amount <= 0) continue;
      const candidate: BondMitigationSource = {
        actor: actor.name, bond: template.name, option,
        kind: (drainHeals ? "healing" : kind) as MitigationKind, amount, held,
      };
      if (!best || candidate.amount > best.amount) best = candidate;
    }

    if (best) { sources.push(best); perRound += best.amount; }
    else if (!unpriced.some(u => u.actor === actor.name)) {
      // A real bond that simply does not mitigate — Skirmish is the case. Named, not omitted.
      bondWithoutMitigation.push({ actor: actor.name, bond: template.name });
    }
  }

  return { perRound, sources, unpriced, withoutBond, bondWithoutMitigation };
}
