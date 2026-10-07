/**
 * YOU CANNOT HIT ANYTHING WITH A SHEATHED AXE — one rule, every reader.
 *
 * Christopher, 2026-10-06: *"i want to look into only having the actions of weapons that are
 * equipped on the character sheets, so if someone unequips it it removes the actions"*.
 *
 * ── WHAT WAS ACTUALLY HAPPENING ──────────────────────────────────────────────────────────────
 * Attaching a weapon writes TWO rows: `equip-<id>` on the equipment tab and `atk-<id>` on Actions.
 * Only the first carries `equipped`, and the equip toggle only ever flipped that one — so the
 * attack row was created the moment the item entered the bag and never left, whatever the player
 * did with it. `itemToAttackAction` sets no `equipped` at all.
 *
 * ⚠ AND IT WAS NOT ONLY THE CARD. `featContextFromActor` tests `equipped !== false`, which an
 * UNDEFINED flag passes, so a stowed greataxe still won the "representative weapon" contest for
 * feat pricing, and `actorAsCreature` still swung it in the encounter checker. The sheet and the
 * read disagreed about what was in hand — the same class of fault as the fighting styles.
 *
 * ── WHY THIS DERIVES RATHER THAN DELETES ─────────────────────────────────────────────────────
 * Removing the row on unequip would throw away whatever is armed on it — a once-per-turn rider,
 * a bound charm, the chosen grip — on every stow and draw. The row stays; what changes is who
 * counts it. One predicate, so the card and the checker cannot drift apart.
 */

/** The equipment row that owns an attack row, or undefined when the row is not item-derived. */
export function owningEquipmentId(actionId: string | undefined): string | undefined {
  return actionId?.startsWith("atk-") ? `equip-${actionId.slice("atk-".length)}` : undefined;
}

/** `id` is optional because the readers' own row types make it so; a row without one owns nothing. */
export type EquipmentRowLike = { id?: string; metadata?: { equipped?: boolean } };

/**
 * Is this Actions-tab row something the character can actually swing right now?
 *
 * ⚠ AN AUTHORED ATTACK IS ALWAYS LIVE. Only `atk-` rows belong to an item; a class feature, a
 * spell attack or a hand-written row has no equipment twin and is not gated by one.
 *
 * ⚠ AND A ROW WITH NO TWIN IS LIVE, which is the opposite of what this first said.
 *
 * The first version read an `atk-` row with no `equip-` row as a detached weapon and refused it.
 * `check:party` caught that immediately: the Wendigo Ember Heart is authored as `atk-heart` ON THE
 * EQUIPMENT TAB with no separate equipment row at all, and it is a real item with a real charge.
 * The twin pair is what `attachItem` writes, not what every attack row looks like — so the gate is
 * "this row HAS a twin and that twin is stowed", and anything else is left alone.
 */
export function attackRowIsLive(
  action: { id?: string },
  equipmentRows: readonly EquipmentRowLike[] = [],
): boolean {
  const ownerId = owningEquipmentId(action.id);
  if (!ownerId) return true;
  const owner = equipmentRows.find(row => row.id === ownerId);
  // No twin: not something `attachItem` wrote, so nothing equips or stows it.
  if (!owner) return true;
  return owner.metadata?.equipped !== false;
}

/** True when the row belongs to an item the character is carrying but has STOWED. */
export function attackRowIsStowed(
  action: { id?: string },
  equipmentRows: readonly EquipmentRowLike[] = [],
): boolean {
  const ownerId = owningEquipmentId(action.id);
  if (!ownerId) return false;
  const owner = equipmentRows.find(row => row.id === ownerId);
  return Boolean(owner) && owner!.metadata?.equipped === false;
}
