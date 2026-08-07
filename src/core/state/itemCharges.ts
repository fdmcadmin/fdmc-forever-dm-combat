/**
 * itemCharges
 *
 * Charge pools that belong to an ITEM rather than to a row in the Resources tab.
 *
 * Every other pool in the app is a Resources-tab action: the counter map is keyed by that
 * action's id and `metadata.additive` holds its max. Magic items don't work that way. An
 * attached Gapstep Boots carries `metadata.charges = { max: 2, reset: "shortRest" }` and has
 * no Resources row at all, so before this module its charges were inert data — nothing spent
 * them, nothing gated on them, and a rest neither drained nor restored them.
 *
 * ONE ITEM, ONE POOL. A single item can produce two actions — `equip-<id>` on the equipment
 * tab and `atk-<id>` on the main tab — and both must draw from the same charges. Keying the
 * pool by the ITEM id rather than the action id is what makes "expend 1 charge when you hit"
 * on a weapon spend the same charge the equipment tab shows.
 */

import type { ActorAction, TabActionMap } from "../types/tabs";

/** Reset behaviour of an item pool. `manual` is only ever restored by hand. */
export type ItemChargeReset = "longRest" | "shortRest" | "manual";

export type ItemChargeSpec = { max: number; reset: ItemChargeReset };

/** Action-id prefixes minted by itemToAction / itemToAttackAction. */
const ACTION_ID_PREFIX = /^(?:equip|atk)-/;

/**
 * Counter-map key for an item-charge action.
 *
 * Strips the action prefix so the equipment entry and the attack entry for one item land on
 * the same key. `rerollSources` already looks up `chargesRemaining[item.id]`, so the bare
 * item id is the key that surface expects too.
 */
export function itemChargeKey(actionId: string): string {
  return actionId.replace(ACTION_ID_PREFIX, "");
}

/** The item pool this action draws on, or undefined when it has none. */
export function itemChargesFor(action: ActorAction): ItemChargeSpec | undefined {
  const charges = action.metadata?.charges;
  if (!charges) return undefined;
  const max = Math.floor(charges.max);
  if (!Number.isFinite(max) || max <= 0) return undefined;
  return { max, reset: charges.reset };
}

/**
 * Every charge-bearing action on a sheet, one per pool.
 *
 * Deduplicated by pool key: an item with both an equipment row and an attack row yields a
 * single entry, so seeding and rest-restore can't process the same pool twice (which for a
 * partial restore would hand back double).
 */
export function chargeBearingActions(tabs: TabActionMap): Array<{ key: string; action: ActorAction; charges: ItemChargeSpec }> {
  const byKey = new Map<string, { key: string; action: ActorAction; charges: ItemChargeSpec }>();
  for (const actions of Object.values(tabs)) {
    for (const action of actions ?? []) {
      const charges = itemChargesFor(action);
      if (!charges) continue;
      const key = itemChargeKey(action.id);
      // Prefer the attack row when an item has both — it is the one a player clicks in
      // combat, so its label is the one worth showing in the log.
      const existing = byKey.get(key);
      if (!existing || action.id.startsWith("atk-")) byKey.set(key, { key, action, charges });
    }
  }
  return [...byKey.values()];
}
