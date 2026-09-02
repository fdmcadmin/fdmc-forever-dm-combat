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
  /** `accuracy` — a to-hit penalty. `targeting` — forced targeting. `modifier` — the unnamed term. */
  reason: "accuracy" | "targeting" | "modifier";
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
};

const EMPTY: PartyBondMitigation = { perRound: 0, sources: [], unpriced: [], withoutBond: [] };

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
      if (imposesDisadvantage(text)) {
        unpriced.push({
          actor: actor.name, bond: template.name, option, reason: "accuracy",
          detail: "Imposes DISADVANTAGE on an attack — real mitigation, but a hit-chance effect. Pricing it needs the per-attack damage of the body being debuffed.",
        });
        continue;
      }
      if (kind !== "reduction" && kind !== "temp" && kind !== "healing") continue;

      const amount = averageWithProf(row.metadata?.damage as string | undefined, actor.level);
      if (amount <= 0) continue;
      const candidate: BondMitigationSource = {
        actor: actor.name, bond: template.name, option, kind: kind as MitigationKind, amount, held,
      };
      if (!best || candidate.amount > best.amount) best = candidate;
    }

    if (best) { sources.push(best); perRound += best.amount; }
  }

  return { perRound, sources, unpriced, withoutBond };
}
