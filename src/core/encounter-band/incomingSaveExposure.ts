/**
 * HOW THIS FIGHT ACTUALLY THREATENS THE PARTY — by save, and at what AC.
 *
 * Shield Master prices as `shieldEquipped*baseEhp*0.045*DexSaveExposure`: the shield only helps
 * against the Dexterity saves that are actually being thrown at you. A fight with no Dex saves in
 * it is a fight where that half of the feat is worth nothing, and one built out of breath weapons
 * is where it is worth the most.
 *
 * ⚠ THE ENCOUNTER ALREADY KNOWS THIS AND WAS NEVER ASKED. The same reasoning `partyDamageMix`
 * uses for typed resistances — Christopher: *"the resistances should always only care about what an
 * actor has as a damage type"* — applies to saves. The monsters are right there, their actions
 * carry a save ability and a damage formula, and the answer is a weighted share rather than a
 * number a DM has to estimate.
 *
 * ⚠ WEIGHTED BY DAMAGE, NOT BY COUNT. Three cantrip-sized Dex saves and one Con save that deals
 * forty are not a 75% Dex fight. The weight is expected damage, exactly as the damage mix does it.
 *
 * ⚠ AND AN EMPTY ANSWER IS `undefined`, NEVER 0. A roster nothing can read produces no exposure,
 * so the feat reports NEEDS_INPUT. Zero is a real answer here — "no Dex saves in this fight" — and
 * it must not be indistinguishable from "nobody looked".
 */

import { damageExpressionAverage } from "./damageExpression";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { damagePacket, type DamageLine } from "../monsters/damageLines";

type ActionLike = { save?: string; damage?: string; extraDamage?: readonly DamageLine[] };

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type SaveAbility = (typeof ABILITIES)[number];

/** "DEX DC 15", "Dexterity Saving Throw: DC 18" — the ability, however it is written. */
function saveAbilityOf(raw: string | undefined): SaveAbility | undefined {
  const t = String(raw ?? "").toLowerCase();
  if (!t) return undefined;
  const long: Record<string, SaveAbility> = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha",
  };
  for (const [word, ab] of Object.entries(long)) if (t.includes(word)) return ab;
  const m = t.match(/\b(str|dex|con|int|wis|cha)\b/);
  return m ? (m[1] as SaveAbility) : undefined;
}

function actionsOf(t: MainMonsterTemplate): ActionLike[] {
  const any = t as unknown as Record<string, ActionLike[] | undefined>;
  return [...(any.actions ?? []), ...(any.traits ?? []), ...(any.reactions ?? [])];
}

/**
 * The share of this encounter's damaging output that arrives through each saving throw.
 *
 * Attack rolls are counted in the denominator — they are damage the party takes that a Dex save
 * cannot mitigate, and leaving them out would report a fight as pure Dex because its only SAVE
 * happens to be one.
 */
export function incomingSaveExposure(
  entries: ReadonlyArray<{ template: MainMonsterTemplate; quantity: number }>,
): Partial<Record<SaveAbility, number>> | undefined {
  const bySave = new Map<SaveAbility, number>();
  let total = 0;

  for (const { template, quantity } of entries) {
    const bodies = Math.max(1, Number(quantity) || 1);
    for (const a of actionsOf(template)) {
      // The whole hit — a second damage line lands through the same save as the first.
      const damage = damageExpressionAverage(damagePacket(a)) * bodies;
      if (!(damage > 0)) continue;
      total += damage;
      const ability = saveAbilityOf(a.save);
      if (ability) bySave.set(ability, (bySave.get(ability) ?? 0) + damage);
    }
  }

  if (total <= 0) return undefined;
  const out: Partial<Record<SaveAbility, number>> = {};
  for (const ab of ABILITIES) out[ab] = (bySave.get(ab) ?? 0) / total;
  return out;
}

/**
 * The AC a party attack is rolling against in this fight, weighted by how many bodies carry it.
 *
 * ⚠ WEIGHTED BY BODY COUNT, because six goblins and one dragon is a fight fought mostly against
 * goblin AC. An unweighted mean would report an accuracy nobody experiences.
 */
export function meanTargetAc(
  entries: ReadonlyArray<{ template: MainMonsterTemplate; quantity: number }>,
): number | undefined {
  let weighted = 0;
  let bodies = 0;
  for (const { template, quantity } of entries) {
    const ac = Number(template.stats?.ac);
    const n = Math.max(1, Number(quantity) || 1);
    if (!Number.isFinite(ac) || ac <= 0) continue;
    weighted += ac * n;
    bodies += n;
  }
  return bodies > 0 ? weighted / bodies : undefined;
}
