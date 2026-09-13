/**
 * A SECOND DAMAGE TYPE ON THE SAME HIT — one packet, not a rider.
 *
 * Christopher, 2026-09-13: *"if a action has 2 damage types i should be able to write 1 action
 * choose a damage type and then write 2nd dice line and a damage type."* He had tried to express
 * Brandwing's Ember Lance — 2d12 + DEX fire plus 1d6 psychic — and the only tool the editor gave
 * him was a RIDER: a per-hit rider named "Ember Lance" whose dice box held `"1d6 Psychic"`, with the
 * rules text reduced to the fragment `"and 6 (1d6 Psychic)"`.
 *
 * ⚠ A RIDER IS THE WRONG SHAPE FOR THIS, AND THE WORKBOOK SAYS SO. Its Act 3 Action Pricing sheet
 * prices a hit as ONE "Damage / Hit" packet and keeps riders in a separate "Once/Turn Extra"
 * column. Pricing a same-hit second type as a rider gets three things wrong at once:
 *
 *   · a save-for-half halves the main dice and bills the rider in full
 *   · a critical hit doubles the main dice and not the rider's
 *   · the card rolls `action.damage` only, so the rider's dice never reached the table at all
 *
 * So a damage line is folded INTO the packet wherever the packet is priced or rolled — by
 * `damagePacket` below, which is the one reader every surface calls — and stays a separate typed
 * line wherever the TYPE matters: the stat block, the card's chips, the party damage mix.
 *
 * Riders remain for what they are for: extra damage with a cadence or a condition.
 */

export type DamageLine = {
  /** The dice of this line — `"1d6"`. Formula tokens resolve the same way the main line's do. */
  damage: string;
  /** Its own type, capitalised as the SRD prints it. */
  damageType?: string | readonly string[];
};

/**
 * The whole damage of one hit: the main line plus every extra line, as one expression.
 *
 * ⚠ BLANK LINES ARE DROPPED, NOT JOINED. The editor adds a line empty and the author fills it in;
 * joining an empty one would print `2d12 + 5 +` and parse to nothing.
 */
export function damagePacket(action: { damage?: string; extraDamage?: readonly DamageLine[] }): string | undefined {
  const parts = [action.damage, ...(action.extraDamage ?? []).map(line => line.damage)]
    .map(part => (part ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" + ") : undefined;
}
