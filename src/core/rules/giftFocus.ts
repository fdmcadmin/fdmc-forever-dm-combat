/**
 * THE FOCUS GIFTS — what a spell focus and a weapon charm add to a roll, decided in one testable place.
 *
 * Christopher, 2026-09-16, after loot doc v11: *"any time a weapon or focus effects a attack or spell it
 * should add that +1/+2/+3, to any action that uses it. so a spell focus at +2 would add +2 to the
 * attack, +2 to the damage, +2 to the spell dc"* — and *"use version 11 and ensure that the 2 spell focus
 * gifts are correct in the app."*
 *
 * v11's two focus Gifts:
 *
 *   Gift of First Light   a Quarterstaff. +2 to spell attack, damage/healing and DC. Every spell cast with
 *                         the MAGIC ACTION adds 1d6 + PB to each damage or healing roll.
 *   Gift of Duskthorn     a charm fastened to a weapon the character already carries — the "Last Word
 *                         binds a weapon" model (0.7.24). The weapon becomes a focus (+2/+2/+2) and gets
 *                         +2 to attack and damage (the higher of that and its own bonus). Each turn the
 *                         wielder picks THORN (every hit with it +1d6 + PB) or SPELL (Magic-action spells
 *                         +1d6 + PB to each damage or healing roll).
 *
 * These are pure: an action or a sheet in, an answer out. The card applies them.
 */
import type { ActorAction } from "../types/tabs";

// ─── The Magic action ─────────────────────────────────────────────────────────

/**
 * Is this a spell cast with the Magic action — an ACTION, not a bonus action or reaction?
 *
 * The casting time is read first because it is the spell's own statement; the action's economy slot
 * (`main`) is the fallback for a sheet authored before casting times existed.
 */
export function isMagicActionSpell(action?: Pick<ActorAction, "actionKind" | "economyCost" | "metadata"> | null): boolean {
  if (!action || action.actionKind !== "spell") return false;
  const casting = action.metadata?.castingTimeType;
  if (casting) return casting === "action";
  const economy = action.economyCost ?? [];
  if (economy.includes("bonus") || economy.includes("reaction")) return false;
  if (economy.includes("main")) return true;
  return (action.metadata?.cost ?? "").trim().toLowerCase() === "action";
}

// ─── A weapon's own bonus ─────────────────────────────────────────────────────

/**
 * The magic bonus a weapon's attack line already carries: the bare numbers after the d20 and the @vars.
 * `1d20+@PROF+@STR+1` is +1; a mundane `1d20+@PROF+@DEX` is 0.
 */
export function weaponMagicBonus(attackFormula?: string): number {
  const terms = (attackFormula ?? "").replace(/\s+/g, "").match(/[+-]?[^+-]+/g) ?? [];
  return terms
    .filter(t => /^[+-]?\d+$/.test(t))
    .reduce((sum, t) => sum + Number.parseInt(t, 10), 0);
}

// ─── Weapon charms ────────────────────────────────────────────────────────────

/** What a charm that offers a choice is doing this turn. Thorn is the weapon; Spell is the Magic action. */
export type CharmMode = "weapon" | "spell";

export type BoundCharm = {
  /** The charm's item id (its equipment row is `equip-<id>`). */
  charmItemId: string;
  charmLabel: string;
  weaponItemId: string;
  /** The weapon's rollable attack row, which is what the charm's bonuses ride. */
  weaponAttackActionId: string;
  weaponLabel: string;
  /** What the charm adds on top of the weapon's own bonus — never below 0 (use the higher bonus). */
  bonusDelta: number;
  hitDamage?: string;
  magicActionDamage?: string;
  choosesMode: boolean;
};

type Tabs = Partial<Record<string, ActorAction[] | undefined>>;

const isEquipped = (a?: ActorAction) => Boolean(a) && a!.metadata?.equipped !== false;

/**
 * Every charm on this sheet that is bound to a weapon the character has EQUIPPED.
 *
 * A charm that is unbound, bound to a weapon no longer carried, or bound to one that is stowed, gives
 * nothing — the doc's properties all work *through the attached weapon*.
 */
export function boundCharms(tabs: Tabs): BoundCharm[] {
  const equipment = tabs.equipment ?? [];
  const everything = Object.values(tabs).flat().filter(Boolean) as ActorAction[];
  const out: BoundCharm[] = [];
  for (const charm of equipment) {
    const m = charm.metadata;
    if (!m?.attachesToWeapon || !m.bindsToItemId || !isEquipped(charm)) continue;
    const weaponRow = equipment.find(a => a.id === `equip-${m.bindsToItemId}`);
    if (!isEquipped(weaponRow)) continue;
    const attackRow = everything.find(a => a.id === `atk-${m.bindsToItemId}`);
    const own = weaponMagicBonus(attackRow?.metadata?.attack ?? weaponRow!.metadata?.attack);
    out.push({
      charmItemId: charm.id.replace(/^equip-/, ""),
      charmLabel: charm.label,
      weaponItemId: m.bindsToItemId,
      weaponAttackActionId: `atk-${m.bindsToItemId}`,
      weaponLabel: weaponRow!.label,
      bonusDelta: Math.max(0, (m.boundWeaponBonus ?? 0) - own),
      hitDamage: m.boundWeaponHitDamage?.trim() || undefined,
      magicActionDamage: m.spellFocusMagicActionDamage?.trim() || undefined,
      choosesMode: Boolean(m.weaponOrSpellChoice),
    });
  }
  return out;
}

/**
 * What a bound charm adds to ITS WEAPON's rolls, in the mode the wielder picked.
 *
 * The flat part (the higher-bonus difference) is always on; the per-hit dice only in Thorn, or always
 * when the charm offers no choice.
 */
export function charmWeaponFormulas(charm: BoundCharm, mode: CharmMode): { attack?: string; damage?: string } {
  const flat = charm.bonusDelta > 0 ? String(charm.bonusDelta) : "";
  const hit = charm.hitDamage && (!charm.choosesMode || mode === "weapon") ? charm.hitDamage : "";
  const damage = [flat, hit].filter(Boolean).join("+");
  return {
    attack: flat ? `+${flat}` : undefined,
    damage: damage ? `+${damage}` : undefined,
  };
}

/**
 * Is this focus row one the character can actually cast through right now?
 *
 * A plain focus: yes, once equipped. A CHARM: only while it is bound to an equipped weapon — Duskthorn on
 * its own is a thorn on a loop of root.
 */
export function focusIsLive(focusRow: ActorAction, tabs: Tabs): boolean {
  if (!focusRow.metadata?.attachesToWeapon) return true;
  const id = focusRow.id.replace(/^equip-/, "");
  return boundCharms(tabs).some(c => c.charmItemId === id);
}

/**
 * The Magic-action extra a focus row carries, in the charm's current mode.
 *
 * First Light always has it. Duskthorn has it only in SPELL — in THORN it rides the weapon instead, and
 * *"A damage or healing roll receives the Gifts' PB + 1d6 benefit only once."*
 */
export function focusMagicActionDamage(focusRow: ActorAction, mode: CharmMode): string | undefined {
  const extra = focusRow.metadata?.spellFocusMagicActionDamage?.trim();
  if (!extra) return undefined;
  if (focusRow.metadata?.weaponOrSpellChoice && mode !== "spell") return undefined;
  return extra;
}

/**
 * The damage a focus adds to ONE spell roll: its flat bonus on every spell, plus the Magic-action extra
 * when this spell takes the Magic action.
 */
export function focusDamageFor(
  focus: { damage?: string; magicActionDamage?: string },
  spell?: Pick<ActorAction, "actionKind" | "economyCost" | "metadata"> | null,
): string {
  const parts = [focus.damage?.trim().replace(/^\+/, "")];
  if (focus.magicActionDamage && isMagicActionSpell(spell)) parts.push(focus.magicActionDamage.trim().replace(/^\+/, ""));
  const joined = parts.filter(Boolean).join("+");
  return joined ? `+${joined}` : "";
}

/** The armed-effect id a charm's weapon bonus and chosen mode live under. */
export const charmEffectId = (charmItemId: string) => `buff:charm:${charmItemId}`;
