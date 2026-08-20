/**
 * The four things a player can do to a d20 that has been rolled but not yet committed.
 *
 * ⚠ THIS LIVES IN ITS OWN LEAF FILE ON PURPOSE. It was declared in `rerollSources.ts`, which
 * imports `EquipmentBagEditor` — so the item and action editors, which is exactly where a reroll
 * source is AUTHORED, could not import it back without a cycle. They each wrote their own
 * narrowed copy instead: `"reroll" | "flip"`, two of the four.
 *
 * That is why the pickers offered Advantage and Add-dice while the authoring types said neither
 * could exist. Both were reachable through an `as` cast and stored fine, so nothing failed
 * loudly — but the type was a lie, and any future `switch` over it would have been treated as
 * exhaustive after two cases while two real values fell through.
 *
 *   reroll    — throw it again. A new random result, and it can come out worse.
 *   flip      — the OTHER SIDE of the die: 21 − natural. Determined, so it never re-rolls.
 *   advantage — roll a SECOND d20 and keep the higher. Lucky. The first die is not discarded,
 *               which is what separates it from a reroll.
 *   bonus     — ADD dice to the roll already made (+1d4, +1d10). Bardic Inspiration, Bend Luck.
 *               The d20 stands; the total moves.
 *
 * Christopher, 2026-08-17: *"luck lets them add advantage to a roll, there are also feat that let
 * PC add 1dx to a roll, so if a miss they should be able to use something like this to add to the
 * rolls before it is committed as a full miss."*
 */
export type RerollMethod = "reroll" | "flip" | "advantage" | "bonus";
