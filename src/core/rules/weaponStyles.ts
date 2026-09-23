/**
 * WHICH ATTACKS A FIGHTING STYLE RIDES — one rule, two readers.
 *
 * Christopher, 2026-09-23: *"archery ... its a added +2 and effects all ranged attacks so those would be
 * accounted for if the character has those feats"*. The card arms these as STANDING toggles; the encounter
 * checker arms nothing, so a read party swung without Archery, Dueling or Great Weapon Fighting and those
 * styles were worth exactly zero in every fight it priced.
 *
 * ⚠ LIFTED FROM `ActorCard`, NOT REWRITTEN (RULE 0) — the card imports them back. A second copy of "is
 * this a two-handed weapon attack" is the drift this rule exists to prevent. Pure module, no React, so the
 * packaged engine can read it.
 */
import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";

/** What a style says it rides. `undefined` means any weapon attack. */
export type StyleTarget = "any" | "spell" | "ranged" | "melee" | "two-handed" | "weapon" | undefined;

export function isRangedAttackAction(action?: ActorAction | null) {
  if (!action) {
    return false;
  }

  const range = action.metadata?.range ?? "";
  // A "normal/long" range like "150/600 ft" or "20/60" means a ranged/thrown weapon.
  if (/\d+\s*\/\s*\d+/.test(range)) {
    return true;
  }

  const searchableText = `${action.label} ${action.description ?? ""} ${action.metadata?.details ?? ""} ${range} ${(action.tags ?? []).join(" ")}`;
  return /\b(?:ranged|range|bow|longbow|shortbow|crossbow|sling|dart|javelin|blowgun|revolver|firearm|pistol|rifle|shot|thrown)\b/i.test(searchableText);
}

// Whether the attacked weapon is a TWO-HANDED / Heavy melee weapon — the gate for Great
// Weapon Fighting / Great Weapon Master, which apply only when swinging one. Mirrors
// isRangedAttackAction: reads the action's name/description/details/tags. A weapon flagged
// "versatile" is treated as two-handed here (the wielder is assumed to grip it two-handed
// to qualify the style). Ranged weapons never count, even the two-handed ones (a longbow is
// a ranged style's business, not GWF's).
export function isTwoHandedAttack(action?: ActorAction | null) {
  if (!action || isRangedAttackAction(action)) return false;
  const text = `${action.label} ${action.description ?? ""} ${action.metadata?.details ?? ""} ${action.category ?? ""} ${(action.tags ?? []).join(" ")}`;
  // Structural flags the loot already uses ("Melee Two-Handed", "Versatile") + unambiguous
  // heavy two-handed weapon names. Versatile weapons match via their flag/category, since a
  // player only toggles the style on while actually gripping such a weapon two-handed.
  return /\b(?:two[-\s]?handed|2h|versatile|heavy|pole\s?arm|greatsword|greataxe|greatclub|maul|glaive|halberd|pike|lance)\b/i.test(text);
}

/**
 * Is this action a WEAPON attack — the only thing a fighting style may ride?
 *
 * Positive test, not "everything that isn't a spell". Archery is +2 to ranged WEAPON attacks;
 * it does not touch a ranged spell attack, a bond strike, or an artificer's cannon just
 * because those happen to be ranged. Same for Great Weapon Master and Two-Weapon Fighting.
 *
 * `equipment` counts because a magic weapon is authored on the equipment tab (Stillstep
 * Blade, Rimecleaver) and is still a weapon in hand.
 */
export function isWeaponAttackAction(action: ActorAction): boolean {
  return action.actionKind === "attack" || action.actionKind === "equipment";
}

// Whether a weapon buff / fighting style (Archery, TWF, GWF) rides the attacked action.
// Styles/buffs ride WEAPON attacks only, gated by their target.
export function styleRidesAction(appliesTo: StyleTarget, action?: ActorAction | null, appliesToActionId?: string) {
  if (!action) return false;
  // A charm names its weapon. Nothing about the kind of attack matters then — only whether this is that one.
  if (appliesToActionId) return action.id === appliesToActionId;
  if (appliesTo === "any") return true;
  if (appliesTo === "spell") return action.actionKind === "spell";
  // Every weapon-targeted style requires an actual weapon attack. Excluding only spells left
  // bond strikes, cannons and feature attacks collecting Archery/GWM because they were
  // "ranged" or "two-handed" — the target says which weapon attacks, never whether it is one.
  if (!isWeaponAttackAction(action)) return false;
  if (appliesTo === "ranged") return isRangedAttackAction(action);
  if (appliesTo === "melee") return !isRangedAttackAction(action);
  if (appliesTo === "two-handed") return isTwoHandedAttack(action);
  return true; // "weapon" / undefined → any weapon attack
}

/** One standing fighting style read off a sheet: Archery's +2 to hit, Dueling's +2 damage, and the rest. */
export type StandingStyle = { label: string; attack: number; damage: number; target: StyleTarget };

/**
 * The PASSIVE fighting styles a character always has — the card's own "standing toggles".
 *
 * Authored on an action row as `combatStyleAttack` / `combatStyleDamage` with a target saying which
 * attacks it rides. At the table they are lit permanently; in a headless read there is nobody to light
 * them, so they are read as what they are: always on.
 */
export function standingStylesOf(actor: Actor): StandingStyle[] {
  const out: StandingStyle[] = [];
  const tabs = (actor.tabs ?? {}) as Record<string, ActorAction[] | undefined>;
  for (const rows of Object.values(tabs)) {
    for (const row of rows ?? []) {
      const m = (row?.metadata ?? {}) as Record<string, unknown>;
      const attack = Number.parseFloat(String(m.combatStyleAttack ?? "")) || 0;
      const damage = Number.parseFloat(String(m.combatStyleDamage ?? "")) || 0;
      if (!attack && !damage) continue;
      out.push({ label: String(row.label ?? "fighting style"), attack, damage, target: m.combatStyleTarget as StyleTarget });
    }
  }
  return out;
}
