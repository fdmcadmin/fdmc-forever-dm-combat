/**
 * WEAPON RIDERS ARE TOGGLES THAT RIDE THE ROLL — the rules for one, decided in one testable place.
 *
 * Christopher, 2026-09-18: *"also ensure any weapon riders are toggleables like GWF and HM, right now they are
 * click and it turns shows used but it may or may not add to the rolls."*
 *
 * It did not. Clicking a rider chip marked it spent and wrote "1d6 Cold added to this hit" to the log — and
 * nothing added anything: the chip was a claim, never an armed effect, so `getDamageAdditives` never saw it.
 * Every "once per turn / once per round" weapon extra (Rimecut, Lake's Bite, Winter's Weight, the Gift
 * signatures) was a log line.
 *
 * Now a rider ARMS like Great Weapon Fighting or Hunter's Mark: lit on the card, shown on the damage step,
 * added to the next damage roll of ITS weapon, and spent for the turn when that roll goes out. Pressed again
 * before the hit, it disarms without being spent.
 *
 * Three kinds, because not every rider is damage:
 *   damage   dice that join the weapon's damage roll (Rimecut 1d6 Cold) — doubled on a crit like any dice
 *   healing  dice for someone's HP, not the target's (Sheltering Bough, 1d6 temporary HP) — rolled on their own
 *            beside the hit, never added to it
 *   none     no dice (Parting Strike, Winter's Grasp) — applied to the hit and logged, so the table sees it
 */

export type RiderSide = "damage" | "healing" | "none";

export function riderSide(formula?: string, damageType?: string): RiderSide {
  if (!/\d*d\d+/i.test(formula ?? "")) return "none";
  return /heal|temp|hit points|\bhp\b/i.test(damageType ?? "") ? "healing" : "damage";
}

/**
 * The attack row a rider rides.
 *
 * An item reaches the sheet as `equip-<id>` and `atk-<id>`, and the rider belongs to the ITEM, so either
 * carrier points at `atk-<id>`: a rider printed on Rimecleaver adds to Rimecleaver, not to the dagger in the
 * other hand. An authored rider on an attack action rides that action. Anything else rides any weapon attack.
 */
export function riderWeaponActionId(carrierId: string, carrierIsWeaponAttack: boolean): string | undefined {
  if (carrierId.startsWith("atk-")) return carrierId;
  if (carrierId.startsWith("equip-")) return `atk-${carrierId.slice("equip-".length)}`;
  return carrierIsWeaponAttack ? carrierId : undefined;
}

/** The armed-effect id a rider lives under while it waits for its hit. */
export const riderEffectId = (chipId: string) => `rider:${chipId}`;
