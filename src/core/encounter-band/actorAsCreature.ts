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
import { resolveFormulaVars } from "../state/resolveFormulaVars";
import { proficiencyBonus } from "../rules/dnd5e";

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
  /** Full damage expression, already resolved against this actor. */
  damage?: string;
  attack?: string;
  saveDc?: string;
  /**
   * ⚠ WHICH OF THE THREE CHANCE CASES THIS IS. Christopher, 2026-09-07:
   *   · `rider`        spent only AFTER the hit lands, so its value is NOT discounted again
   *   · `spell-action` spent before the roll resolves, so its value is already expected
   *   · `extra-action` resolves its own hit chance normally
   */
  trigger: "rider" | "spell-action" | "extra-action";
};

export type ActorAsCreature = {
  /** At-will only — the shape `parseCreature` and `traceCreature` consume. */
  creature: MainMonsterTemplate;
  /** Everything excluded from the base, for `resourceLedger` to price. */
  spends: ResourceSpendingAction[];
  /** Anything that carries damage and could not be classified, named rather than dropped. */
  unreadable: string[];
};

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

export function actorAsCreature(actor: Actor): ActorAsCreature {
  const md = (a: Record<string, unknown>) => (a.metadata ?? {}) as Record<string, string | number | undefined>;
  const spends: ResourceSpendingAction[] = [];
  const unreadable: string[] = [];
  const atWill: MainMonsterTemplate["actions"] = [];

  for (const { tab, action } of actionsOf(actor)) {
    const m = md(action);
    const label = String(action.label ?? "(unnamed)");
    const damage = resolved(String(m.damage ?? ""), actor);
    const isSpell = action.actionKind === "spell" || m.spellLevel !== undefined;
    const spellLevel = Number(m.spellLevel ?? 0) || 0;

    // Healing is sustain, and `partyHealingFromActors` owns it. It is not offence.
    if (m.outcomeMode === "healing") continue;
    if (!damage && !m.attack) continue;

    /**
     * ⚠ SPENDS SOMETHING -> THE LEDGER, NOT THE ROUTINE. A levelled spell, a named pool, an item
     * charge or a free cast is a resource; the base must exclude it or it enters the checker
     * twice. `metadata.resourceId` is the authored link the sheets have always carried.
     */
    const spendsResource = spellLevel > 0
      || Boolean(m.resourceId)
      || Boolean(m.charges)
      || m.spellSlotMode === "freeCast";

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
        ...(m.resourceCost !== undefined ? { resourceCost: Number(m.resourceCost) } : {}),
        ...(damage ? { damage } : {}),
        ...(m.attack ? { attack: String(m.attack) } : {}),
        ...(m.saveDc ? { saveDc: String(m.saveDc) } : {}),
        trigger,
      });
      continue;
    }

    // ── At-will: it costs nothing but the action it is already taking ────────
    const roll = attackRollFor(m.attack ? String(m.attack) : undefined, actor, isSpell);
    if (!roll && !m.saveDc) {
      if (damage) unreadable.push(`${label} (${tab}): rolls ${m.damage} with neither an attack roll nor a save DC, and spends nothing`);
      continue;
    }
    atWill.push({
      name: label,
      kind: roll ? "attack" : "action",
      ...(roll ? { roll } : {}),
      ...(damage ? { damage } : {}),
      ...(m.damageType ? { damageType: String(m.damageType) } : {}),
      ...(m.saveDc ? { save: resolved(String(m.saveDc), actor) ?? String(m.saveDc) } : {}),
      ...(m.range ? { range: String(m.range) } : {}),
    } as never);
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
    reactions: [],
  } as never;

  return { creature, spends, unreadable };
}
