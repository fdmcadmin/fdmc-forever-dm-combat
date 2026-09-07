/**
 * A HALF OR THIRD CASTER LEANS BY ITS CLASS, WITH OR WITHOUT A BOND.
 *
 * A contested slot tier is broken by the role the character plays. The bond states that role for a
 * bonded PC — but the bond is not the only thing that says it. Christopher, 2026-09-07:
 * *"any half or 1/3 classes should have a lean."*
 *
 * He is right, and the reason is in the progression itself. A full caster's slots ARE their engine,
 * so which way they point is genuinely a question about that character. A HALF caster's slots are a
 * supplement to a weapon routine they are already taking — a Ranger or a Paladin spends a slot to
 * make an attack hurt more, and reaches for healing second. The class has already answered.
 *
 * ⚠ SO ONLY THE CLASSES THAT HAVE ANSWERED ARE LISTED. A full caster returns undefined and keeps
 * whatever the bond says, or the prepared loadout when there is no bond. Inventing a lean for a
 * Wizard would be this file deciding how somebody plays their character, which is the opposite of
 * reading it off the sheet.
 *
 * ⚠ AND IT IS THE FALLBACK, NEVER THE OVERRIDE. A bond is a stated choice about this character in
 * this campaign; a class is a default. `bond ?? class` and never the other way round.
 */

import type { Actor } from "../../core/types/actor";
import { classLevels } from "../../core/rules/multiclass";

/** Half casters: slots supplement a weapon routine they were taking anyway. */
const HALF_CASTERS = new Set(["paladin", "ranger", "artificer"]);

/**
 * Third casters, which are SUBCLASSES rather than classes — a Fighter is not a caster and an
 * Eldritch Knight is. Read from `subclassName` for that reason.
 */
const THIRD_CASTER_SUBCLASSES = new Set(["eldritch knight", "arcane trickster"]);

/** Every class name on this sheet, from the structured rows when present and the label when not. */
function classNames(actor: Actor): string[] {
  const rows = classLevels(actor as never);
  if (rows.length > 0) return rows.map(r => r.name.toLowerCase().trim());
  return String(actor.className ?? "")
    .split(/[/,]/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The lean this character's CLASS implies, or undefined when the class does not imply one.
 *
 * Undefined is the honest answer for a full caster and for a class with no slots at all: there is
 * nothing about "Wizard" that says whether this Wizard heals or blasts.
 */
export function classResourceLean(actor: Actor): "offense" | undefined {
  const subclass = String(actor.subclassName ?? "").toLowerCase().trim();
  if (THIRD_CASTER_SUBCLASSES.has(subclass)) return "offense";
  return classNames(actor).some(n => HALF_CASTERS.has(n)) ? "offense" : undefined;
}
