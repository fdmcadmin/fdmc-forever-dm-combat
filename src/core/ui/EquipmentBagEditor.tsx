/**
 * EquipmentBagEditor
 *
 * Equipment works differently from actions:
 *   - Items live in the DM equipment library (localStorage)
 *   - Attaching an item adds it to the actor's equipment tab
 *   - Detaching removes it from the actor but keeps it in the library
 *   - Items can be created on the fly and saved to library
 *
 * The actor's bag = actor.tabs.equipment (ActorAction[]) with actionKind "equipment"
 */

import { useEffect, useRef, useState, useMemo } from "react";
import type { ActorAction } from "../types/tabs";
import { FormulaInput } from "./FormulaInput";
import { ChassisFields } from "./ChassisFields";
import { ChargesFields } from "./ChargesFields";
import { WEAPON_CATEGORIES, WEAPON_MASTERIES, WEAPON_MASTERY_NAMES, masteryInfoLine, type WeaponMasteryName } from "../constants/weaponMastery";
import { ARMOR_TYPES, EFFECT_KINDS, ITEM_TYPE_BLURB, SELECTABLE_ITEM_TYPES, itemTypeAllows, outcomeModeForEffectKind, type ArmorTypeId, type EffectKind, type ItemType } from "../constants/itemTypeCapabilities";
import { BASE_WEAPONS } from "../constants/baseWeapons";
import { composeChassisAttack, findForm, isVersatileForm, type ChassisSpec, type WeaponGrip } from "../constants/chassis";
import { loadPendingDrafts, savePendingDraft, removePendingDraft, newPendingDraftId, type PendingDraft } from "../state/pendingDrafts";

// ─── Equipment library (dual localStorage) ───────────────────────────────────

export type EquipmentEffectType =
  | "tempHP"        // gain temp HP — player applies manually via HP Tools
  | "reroll"        // adds this item as a reroll source in the picker
  | "armedEffect"   // arms a formula rider (additive to next damage roll)
  | "spellSlotSub"  // can substitute for a spell slot
  | "advantage"     // grant advantage — player applies manually
  | "nullifyDamage" // nullify a damage type — player applies manually
  | "custom";       // freeform — description only

export type EquipmentEffect = {
  type: EquipmentEffectType;
  /** Human-readable label shown on the armed effect pill or picker */
  label?: string;
  /** Formula for armedEffect type e.g. "+1d6+1 radiant" */
  formula?: string;
  /** For tempHP: the amount. For spellSlotSub: the slot level "L1". For nullifyDamage: the damage type */
  value?: string;
  /** Condition that must be met to use e.g. "cantrip attack or damage roll" */
  condition?: string;
  /**
   * For `reroll`: HOW it changes the roll — throw again, or use the other side of the die
   * (21 − the natural). Explicit because reading it out of prose is a guess, and a wrong guess
   * silently turns a determined value into a random one. Absent falls back to the text.
   */
  rerollMethod?: "reroll" | "flip";
};

export type EquipmentCharges = {
  max: number;
  /**
   * When the pool refills. "encounter" is its own tier because a great many items read
   * "once per encounter" — more often than a short rest, and not tied to resting at all.
   * It refills at End Combat, and on either rest too, since a rest ends any encounter.
   */
  reset: "longRest" | "shortRest" | "encounter" | "manual";
  /**
   * How a MANUAL pool comes back, in words — "Recharges at dawn", "DM fiat".
   *
   * A dawn recharge is NOT a rest, so it cannot be automated off short/long: a party can take
   * two long rests before a dawn, or a dawn with no rest at all. Those pools are `manual` and
   * carry the cadence here, so the DM sees what to restore and when.
   */
  note?: string;
};

/**
 * A RIDER — an item's conditional extra, deliberately player-driven.
 *
 * Every Feywild Gift is "once on each of your turns when you hit, IF <something the table
 * judges>". Automating that condition would decide for the player: whether they are below half
 * HP, whether this is the same creature they hit earlier, whether the hit was an opportunity
 * attack. So a rider is a TOGGLE the player flips when it applies — the app tracks the cadence
 * and rolls the dice, the table rules on the trigger.
 *
 * `formula` is optional because not every rider rolls: "that creature cannot make opportunity
 * attacks until the start of your next turn" is a rider with no dice at all.
 */
export type RiderCadence = "perTurn" | "perRound" | "perEncounter" | "shortRest" | "longRest" | "atWill";

export type ItemRider = {
  id: string;
  label: string;
  /** Dice the rider adds, if any — "2d6", "1d8". Blank for a pure condition. */
  formula?: string;
  /** "the weapon's type" is normal; a fixed type (force, cold) when the rider overrides it. */
  damageType?: string;
  /** How often it can be used. Nearly all of these are once per turn. */
  cadence: RiderCadence;
  /** The trigger, in words — what the player is judging when they flip it. */
  condition?: string;
};

export type AbilityStatId = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type StatEffectType =
  | "setStat"   // force stat to a value (e.g. Belt of Giant Strength: STR → 21)
  | "addStat"   // add to stat (e.g. Gauntlets of Ogre Power: +2 STR)
  | "setAC"     // set base AC (armor that replaces the AC formula)
  | "addAC"     // add to AC (shield +2, ring of protection +1)
  | "addHP"     // add to HP max (Amulet of Health effect)
  | "addSpeed"; // add to speed

export type StatEffect = {
  type: StatEffectType;
  stat?: AbilityStatId;   // required for setStat/addStat
  value: number;
  /** Optional: "while equipped and not incapacitated" etc. */
  condition?: string;
};

/**
 * Where a worn item sits. Two items in the same slot can't both be on.
 *
 * This is what stops a forgotten piece from quietly contributing: body armour REPLACES your
 * AC, so a second suit left equipped can end up being the one counted. Weapons have no slot
 * — they're held, not worn, and the hand they occupy isn't tracked here.
 *
 * Capacity is one per slot except rings, which are worn two at a time.
 *
 * ONLY `body` and `shield` are in use — they come from the item's own `type`, which is the
 * one thing the library actually states. The rest are vocabulary for gear that declares a
 * slot later; nothing is tagged with them. An earlier pass inferred them from item names
 * and got it wrong (a "weapon wrap" is not a hand slot), so a slot is never guessed from
 * prose — an item wears a slot because its data says so, or it is simply carried.
 */
export type EquipmentSlot =
  | "body" | "shield" | "head" | "neck" | "cloak" | "shoulders"
  | "hands" | "wrist" | "belt" | "feet" | "ring";

export const SLOT_CAPACITY: Record<EquipmentSlot, number> = {
  body: 1, shield: 1, head: 1, neck: 1, cloak: 1, shoulders: 1,
  hands: 1, wrist: 1, belt: 1, feet: 1, ring: 2,
};

export const SLOT_LABEL: Record<EquipmentSlot, string> = {
  body: "Body armour", shield: "Shield", head: "Head", neck: "Neck", cloak: "Cloak",
  shoulders: "Shoulders", hands: "Hands", wrist: "Wrist", belt: "Belt", feet: "Feet", ring: "Ring",
};

export type EquipmentItem = {
  id: string;
  name: string;
  /**
   * ⚠ `magic` MEANS WONDROUS ITEM. A magical weapon is a `weapon` — being magical is a property
   * of the item (its +1), never its type. Wondrous is also the ONLY type that may be Convergence.
   * `passive` is retired; it is still in the union so old records parse, but it is never offered.
   * What each type may CARRY lives in `itemTypeCapabilities.ts`, read by both item editors.
   */
  type: ItemType;
  /** Light / medium / heavy — armour only. Decides how DEX applies to the AC it sets. */
  armorType?: ArmorTypeId;
  /**
   * WHAT THE EFFECT DICE MEAN — *"kind should be- damage, healing, temp, reduction."*
   *
   * ⚠ Effect dice were hardcoded to `damage-only`, so an item that ROLLS TO REDUCE damage got
   * logged as damage dealt — the reading I had wrongly called a missing outcome mode. It is not
   * missing: `healing` is the mode for all three HP kinds, because HP restored, temp HP granted
   * and damage prevented are all HP the bearer keeps.
   *
   * The MODE is shared; the KIND is not. They resolve identically and read differently, so the
   * card can say "Roll Temp HP" rather than flattening three distinct things into one word.
   * Defaults to damage when unset, which is what every current campaign item is.
   */
  effectKind?: EffectKind;
  /** How many are held. Consumables, gear and tools; a stack of 5 potions is one row. */
  count?: number;
  /** Worn slot. Absent = carried, not worn, and never displaces anything. */
  slot?: EquipmentSlot;
  description: string;
  isUsable: boolean;
  attack?: string;
  damage?: string;
  crit?: string;
  /**
   * The save this item forces before its damage lands — "CON DC 13".
   *
   * A magic item in this campaign does not roll to hit; the ones that hurt make the TARGET
   * roll. Setting this puts the action in `dc-check` mode, so using it announces the save and
   * the table knows to roll before the dice are applied, instead of damage appearing out of
   * nowhere. Absent = the dice just roll.
   */
  saveDc?: string;
  range?: string;
  ac?: string;
  /** Spellcasting focus (P-UX4 follow-up): bonuses this item adds to the SPELLS cast
   *  through it (e.g. Wand of the War Mage "+1"). Applied as a clickable additive on
   *  spell attack / damage rolls. An item can be both a weapon AND a focus. */
  spellFocusAttack?: string;
  spellFocusDamage?: string;
  /** The THIRD thing a focus buys: a shift to the spell save DC ("+1"). A number, not a
   *  formula — a DC is a printed target, so this moves the number rather than appending a
   *  term. Three campaign items say "+1 to spell attack rolls and spell save DC" and only
   *  the attack half existed, so half of each did nothing. */
  spellFocusSaveDc?: string;
  /** Marks the item as a spellcasting focus. A focus supplies @SPELL to every spell cast
   *  through it; the bonus fields above are only the item's OWN extra on top. */
  isSpellFocus?: boolean;
  /**
   * WHAT THE CAMPAIGN ITEM LOOKED LIKE WHEN THE DM UNLOCKED IT.
   *
   * Unlocking copies a bundled item into the DM store, where it WINS by id. That copy is a
   * snapshot, and a re-seed used to delete every one of them so a stale copy could not mask
   * newer module data. It could not tell a stale copy from a deliberate edit, so it threw
   * both away — which is why campaign changes never stayed changed.
   *
   * Holding the fingerprint makes the question answerable: still identical = untouched, drop
   * it and take the fresh bundled data; different = the DM changed it, keep their work.
   */
  unlockSnapshot?: string;
  value?: string;
  weight?: string;
  tags?: string[];
  /**
   * ADAPTIVE ITEM. Present = this is a chassis: one entry that becomes a specific weapon when
   * a form is chosen, instead of authoring the same Gift once per greatweapon. The spec is a
   * FILTER over BASE_WEAPONS; `formId` (the chosen form) is written on the ACTOR's copy so the
   * library entry stays generic and two characters can hold the same Gift in different shapes.
   */
  chassis?: ChassisSpec;
  /** Chassis items: the item makes the wielder proficient, so @PROF applies untrained. */
  grantsProficiency?: boolean;
  /** Chassis items: add Proficiency Bonus to the damage roll (the Feywild Gifts do). */
  pbToDamage?: boolean;
  /** Chassis items: magic bonus added to attack AND damage (+2 on the Feywild Gifts). */
  chassisBonus?: number;
  /**
   * Conditional extras the player toggles. An ARRAY because an item can carry more than one —
   * the focus Gifts have their spell bonus AND an effect, and nothing says a future item won't
   * have two riders.
   */
  riders?: ItemRider[];
  /** How a versatile form is currently held. Free to change; see the grip switch on the card. */
  grip?: WeaponGrip;
  /** Charge tracking for items with limited uses */
  charges?: EquipmentCharges;
  /** What happens when a charge is spent */
  effect?: EquipmentEffect;
  /** Passive stat modifications while this item is equipped */
  statEffects?: StatEffect[];
  // ── Campaign library fields (preserved from fdmc-items.json schema) ──
  /** Campaign item — DM cannot edit or delete */
  isLocked?: boolean;
  /** Item subkind from the canonical library (e.g. "Melee One-Handed", "Heavy Armor").
   *  Weapons use WEAPON_CATEGORIES: melee splits 1H / 2H / Versatile, ranged 1H / 2H. */
  category?: string;
  /** Weapon Mastery property (2024 rules). Picked in the equipment creator; its rules
   *  text is appended under Information on the generated attack. */
  mastery?: WeaponMasteryName;
  /** Item tier from campaign module (e.g. "Tier 1", "Tier 2") */
  tier?: string;
  /** Act tag from source library */
  act?: string;
  /** Session tag from source library */
  session?: string;
  /** Source encounter name */
  sourceEncounter?: string;
  /** Source type: "boss-loot" | "merchant" | "dm-reward" | "sendoff" */
  sourceType?: string;
  /** Full mechanics rules text (DM + player read) */
  mechanicsText?: string;
  /** DM-only note about the item */
  dmNote?: string;
  /** Attunement required flag */
  attunementRequired?: boolean;
  /** Convergence metadata from the canonical library */
  convergence?: {
    role: "input" | "output";
    enabled: boolean;
    mechanicalTag?: string;
    actLabel?: string;
    flavorTag?: string;
    inputIds?: string[];
    outputId?: string;
  };
};

// ─── Dual library storage ─────────────────────────────────────────────────────

const CAMPAIGN_EQUIPMENT_KEY = "fdmc.dm.equipmentLibrary.campaign.v1";
const DM_EQUIPMENT_KEY = "fdmc.dm.equipmentLibrary.dm.v1";
const CAMPAIGN_EQUIPMENT_SEED_KEY = "fdmc.dm.equipmentLibrary.campaign.seeded.v1";
// Bump to re-seed the campaign equipment library after editing the bundled items.
// v0.3.0 — Act 2 armor is now +1 magical (loot doc v5): Permafrost Hide 11→12,
// Hollowbone Halfplate 15→16, Bonemarch Plate 16→17, Wight Iron Plate 17→18,
// Frosted Sentinel Wrap 14→15, Veilstitched Leathers 12→13.
// v0.3.1 — Rimeguard 12-16→13-17 (all three modes) and Marrow Shield +2→+3.
// v0.4.0 — library regenerated from broken_chain_loot.docx (the doc is the source of truth).
// Renames keep their id (Stillstep Blade→Mace, Lake Ice Blade→Lake-Ice Flail, The Staring
// Knot→Staring-Knot Wand); Shattered Vigil is now a two-handed great hammer, not a focus. Adds
// the convergence output pools and a STR variant of every finesse weapon. Seven items the doc
// dropped are retired via RETIRED_EQUIPMENT_IDS.
// v0.6.0 — CONVERGENCE REWORK. Outputs rebuilt as Tier 1 / Tier 2 (the old 1.5/2/2.5/3 pools
// are retired), inputs re-tagged, merchant stock now sells Convergence-capable Wondrous Items
// with gold. The mundane catalog is retired — the doc replaces it with two ledger lines. Boss
// armor and weapons are LOCKED and unchanged.
// v0.7.3 — ACT 3 CONVERGENCE, from loot doc v12 (Acts 1-3). Adds the eight Act 3 inputs, which
// drop from Gate I and Gate III rather than a merchant, and the four Tier 2 outputs that finish
// that catalogue at ten. Tactical and Continuity join the tag vocabulary. Tier 3 weapons and
// Tier 3 convergence are deliberately NOT seeded — the doc leaves that tier unbuilt and
// Christopher is authoring part of it himself.
const CAMPAIGN_EQUIPMENT_SEED_VERSION = "tbc-acts1-4-v5-focus-all-three";

export function loadEquipmentLibrary(owner?: "campaign" | "dm"): EquipmentItem[] {
  const key = owner === "campaign" ? CAMPAIGN_EQUIPMENT_KEY : owner === "dm" ? DM_EQUIPMENT_KEY : null;
  if (key) {
    // REPAIRED ON READ. Years of the round-trip guessing the type left live libraries full
    // of armour and wands filed as gear; this heals them wherever they load rather than needing
    // a hand-edit each. It only ever promotes OUT of the catch-all, from stated fields.
    try { return (JSON.parse(window.localStorage.getItem(key) ?? "[]") as EquipmentItem[]).map(repairItemType); } catch { return []; }
  }
  // Both combined — DM items override campaign items with same ID (so edits to campaign items persist)
  const campaign = loadEquipmentLibrary("campaign");
  const dm = loadEquipmentLibrary("dm");
  const dmIds = new Set(dm.map(i => i.id));
  return [...campaign.filter(i => !dmIds.has(i.id)), ...dm];
}

export function saveEquipmentLibrary(library: EquipmentItem[], owner: "campaign" | "dm" = "dm"): void {
  const key = owner === "campaign" ? CAMPAIGN_EQUIPMENT_KEY : DM_EQUIPMENT_KEY;
  try { window.localStorage.setItem(key, JSON.stringify(library)); } catch { /* ok */ }
}

/**
 * Re-seed the bundled campaign items.
 *
 * MERGES by id rather than replacing the library wholesale. The campaign library is
 * shared: `seedBaseWeapons` puts the mundane 2024 weapons in it too. The old wholesale
 * `saveEquipmentLibrary(items, "campaign")` therefore DELETED every base weapon the
 * moment CAMPAIGN_EQUIPMENT_SEED_VERSION was bumped — and because seedBaseWeapons is
 * gated on its own separate version key, it early-returned and never put them back.
 * (That is exactly what happened on the 0.6.5.4 armour bump.)
 *
 * Bundled items win for their own ids, so edits to the shipped module data still land;
 * anything else already in the library is preserved.
 */
/**
 * A stable fingerprint of an item's content, ignoring the bookkeeping fields that unlocking
 * itself writes. Key order is normalised so a re-serialised item still matches.
 */
export function fingerprintEquipmentItem(item: EquipmentItem): string {
  const { isLocked: _l, unlockSnapshot: _s, ...rest } = item as EquipmentItem & Record<string, unknown>;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

export function seedCampaignEquipmentLibrary(items: EquipmentItem[], retiredIds: string[] = []): void {
  if (window.localStorage.getItem(CAMPAIGN_EQUIPMENT_SEED_KEY) === CAMPAIGN_EQUIPMENT_SEED_VERSION) return;
  const byId = new Map(loadEquipmentLibrary("campaign").map(i => [i.id, i]));
  // Merging alone can only ever add. Items the campaign module dropped have to be named
  // explicitly or they stay in the library forever.
  for (const id of retiredIds) byId.delete(id);
  for (const item of items) byId.set(item.id, item);
  saveEquipmentLibrary(Array.from(byId.values()), "campaign");

  /**
   * CLEAR STALE UNLOCK SHADOWS.
   *
   * `handleUnlockItem` copies a campaign item into the DM store so the DM can edit it, and
   * `loadEquipmentLibrary()` resolves with the DM copy WINNING by id. That copy is a snapshot
   * frozen at the moment of unlocking, and nothing ever refreshed it — so once an item had been
   * unlocked, every later re-seed rewrote the campaign side while the panel kept reading the old
   * DM copy. Rimecleaver stayed a one-handed thrown weapon through three rebuilds that each
   * verified "correct" against the campaign store, because the campaign store was never what
   * was being displayed.
   *
   * A re-seed means the module data is newer than any unlock taken before it, so a shadow of a
   * seeded id is dropped. DM items that are NOT shadowing a campaign id — genuinely custom
   * gear — are untouched.
   */
  const seededIds = new Set(items.map(i => i.id));
  const dm = loadEquipmentLibrary("dm");
  /**
   * ⚠ ONLY UNTOUCHED SHADOWS ARE DROPPED.
   *
   * A shadow whose content still matches its unlock fingerprint is a pure snapshot — nothing
   * is lost by dropping it, and dropping it is what keeps Rimecleaver from staying a one-handed
   * thrown weapon across rebuilds. A shadow that no longer matches holds DM work, and a version
   * bump is not consent to delete it.
   *
   * Shadows unlocked before this existed carry no fingerprint. They are KEPT: a stale item is
   * visible and one re-unlock away from fixed, whereas silently destroyed work is neither.
   */
  const keep = dm.filter(i => {
    if (!seededIds.has(i.id)) return true;              // genuinely custom gear
    if (!i.unlockSnapshot) return true;                 // pre-fingerprint, assume it is work
    return i.unlockSnapshot !== fingerprintEquipmentItem(i);
  });
  if (keep.length !== dm.length) saveEquipmentLibrary(keep, "dm");

  window.localStorage.setItem(CAMPAIGN_EQUIPMENT_SEED_KEY, CAMPAIGN_EQUIPMENT_SEED_VERSION);
}

/** Seed version for the base weapon set — bump to re-seed after editing BASE_WEAPONS. */
const BASE_WEAPON_SEED_KEY = "fdmc.equipment.baseWeapons.seedVersion";
// v2 is a REPAIR bump, not a content change: the 0.6.5.4 campaign re-seed wiped the base
// weapons out of the shared campaign library, and this key's own guard meant they were
// never restored. Bumping re-runs the (id-preserving) weapon seed for anyone affected.
const BASE_WEAPON_SEED_VERSION = "2024-phb-v2-restore";

/**
 * Put the mundane 2024 weapons in the library.
 *
 * The library shipped with campaign magic items only, so a basic Longbow or Scimitar could
 * not be attached — which is exactly why every character's basic weapons were hand-authored
 * as main-tab attacks instead of generated from a built weapon.
 *
 * Seeded into the CAMPAIGN library alongside the module items and marked `isLocked`, so a DM
 * editing one writes an unlocked override under the same id (see `upsertItem`) rather than
 * mutating the shared base. Never overwrites an existing id.
 */
export function seedBaseWeapons(): void {
  if (window.localStorage.getItem(BASE_WEAPON_SEED_KEY) === BASE_WEAPON_SEED_VERSION) return;

  const existing = loadEquipmentLibrary("campaign");
  const byId = new Map(existing.map(i => [i.id, i]));

  for (const w of BASE_WEAPONS) {
    if (byId.has(w.id)) continue;
    byId.set(w.id, {
      id: w.id,
      name: w.name,
      type: "weapon",
      description: w.description,
      isUsable: true,
      attack: w.attack,
      damage: w.damage,
      crit: w.crit,
      range: w.range,
      category: w.category,
      mastery: w.mastery,
      tags: w.tags,
      isLocked: true,
    });
  }

  saveEquipmentLibrary(Array.from(byId.values()), "campaign");
  window.localStorage.setItem(BASE_WEAPON_SEED_KEY, BASE_WEAPON_SEED_VERSION);
}

function upsertItem(item: EquipmentItem): void {
  // Editing a locked campaign item writes an UNLOCKED DM override under the same id.
  // The combined loadEquipmentLibrary() gives DM items priority over campaign items
  // with the same id, so the edit takes effect everywhere it's referenced.
  // (Previously this silently returned for isLocked items, so library/bag edits to
  //  campaign gear appeared to do nothing.)
  const toSave: EquipmentItem = item.isLocked ? { ...item, isLocked: false } : item;
  const library = loadEquipmentLibrary("dm");
  const idx = library.findIndex(i => i.id === toSave.id);
  if (idx === -1) library.push(toSave);
  else library[idx] = toSave;
  saveEquipmentLibrary(library, "dm");
}

// ─── Export / Import ─────────────────────────────────────────────────────────

export function exportEquipmentLibrary(): void {
  const library = loadEquipmentLibrary("dm"); // only export DM custom items
  if (library.length === 0) return;
  const blob = new Blob([JSON.stringify({ schema: "fdmc.equipment-library.v1", exportedAt: new Date().toISOString(), items: library }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fdmc-equipment-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type EquipmentImportResult = {
  ok: boolean;
  added: number;
  updated: number;
  skipped: number;
  message: string;
};

export async function importEquipmentLibrary(file: File): Promise<EquipmentImportResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as { items?: unknown[]; schema?: string };
    const items = parsed.items ?? (Array.isArray(parsed) ? parsed : null);
    if (!Array.isArray(items)) {
      return { ok: false, added: 0, updated: 0, skipped: 0, message: "Invalid file — expected { items: [...] } or a raw array." };
    }
    const existing = loadEquipmentLibrary("dm");
    const existingIds = new Set(existing.map(i => i.id));
    let added = 0, updated = 0, skipped = 0;
    for (const raw of items) {
      const item = raw as EquipmentItem;
      if (!item.id || !item.name) { skipped++; continue; }
      if (existingIds.has(item.id)) updated++; else added++;
      upsertItem(item);
    }
    return { ok: true, added, updated, skipped, message: `Imported ${added + updated} item${added + updated === 1 ? "" : "s"} (${added} new, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ""}).` };
  } catch (e) {
    return { ok: false, added: 0, updated: 0, skipped: 0, message: `Import failed: ${String(e)}` };
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

// ─── AC synthesis (local copy — avoids circular dep with deriveActorStats) ───

function synthesizeAcEquipEffect(item: EquipmentItem): { type: string; value: number } | undefined {
  const ac = item.ac?.trim();
  if (!ac) return undefined;
  if (ac.startsWith("+")) {
    const val = parseInt(ac.slice(1), 10);
    if (!isNaN(val) && val > 0) return { type: "addAC", value: val };
  } else {
    const match = /^(\d+)/.exec(ac);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > 0) return { type: "setAC", value: val };
    }
  }
  return undefined;
}

/**
 * Build the full statEffects array for an item — baked at attach time so the
 * actor record is self-contained.  Includes:
 *   - All explicit statEffects from the library item
 *   - A synthesized setAC/addAC if the item has an ac string but no explicit AC effect
 */
function bakeStatEffects(item: EquipmentItem): Array<{ type: string; stat?: string; value: number; condition?: string }> | undefined {
  const effects: Array<{ type: string; stat?: string; value: number; condition?: string }> = [
    ...(item.statEffects ?? []).map(e => ({ type: e.type, stat: e.stat, value: e.value, condition: e.condition })),
  ];
  const hasAcEffect = effects.some(e => e.type === "setAC" || e.type === "addAC");
  if (!hasAcEffect && item.ac) {
    const synth = synthesizeAcEquipEffect(item);
    if (synth) effects.push(synth);
  }
  return effects.length > 0 ? effects : undefined;
}

// ─── Convert EquipmentItem → ActorAction (EQUIPMENT TAB — display/inventory) ─
//
// Equipment tab entries are INVENTORY DISPLAY ONLY.
// Weapons with attack/damage rolls live in tabs.main as attack actions.
// Armor/shields appear here with their AC info displayed but no dice.
// Consumables (charges, no attack/damage) remain clickable here (Use button).
//
// Key: metadata.statEffects is baked at attach time — actor is self-contained.
// Library changes do NOT silently alter already-equipped items.

/**
 * @param equipped Whether the item arrives worn. Stamped EXPLICITLY rather than left to the
 *   `undefined = equipped` default, so an actor's record says what is actually equipped
 *   instead of implying it. Building a sheet equips (the default); anything arriving during
 *   play — DM loot, a hand-off from another player — lands in the bag at `false` and the
 *   player equips it deliberately. That also stops a granted item from silently claiming one
 *   of the three attunement slots.
 *
 *   Reading still treats `undefined` as equipped, so actors saved before this keep working.
 */
/**
 * Repair an item whose TYPE is wrong, from what the item itself states.
 *
 * Christopher, 2026-08-17: *"why would i need to tell you armor types of things that are a clear
 * understanding a shield is a shield, and if you looked at attached stat blocks they read as what
 * they do."* Correct — and I had over-applied my own "never infer from prose" rule, which is about
 * inventing a taxonomy from FLAVOUR. These are stat lines: `Chain Mail` carries
 * *"Heavy armor. AC 16; Strength 13; Disadvantage on Stealth"* and an `ac` of "16". Nothing is
 * being guessed; it is being READ.
 *
 * Two stated facts do the work, and neither is a name:
 *   · `ac` EXISTS → this is not gear. Gear has no armour class.
 *   · `ac` STARTS WITH "+" → it ADDS to AC, which is what a shield does; a bare number SETS AC,
 *     which is what body armour does. That is a mechanical distinction, not a word.
 *   · the armour weight is taken only from an explicit "<Heavy|Medium|Light> armor" statement.
 *     No statement, no armourType — an unset field is safe, a wrong one is not.
 *
 * This exists because the round-trip GUESSED the type for years (`attack||damage ? weapon : gear`),
 * so live libraries are full of armour typed `gear`. Repairing on read means those heal wherever
 * they are loaded instead of needing a hand-edit each.
 */
export function repairItemType(item: EquipmentItem): EquipmentItem {
  const ac = item.ac?.trim();
  const stated = `${item.description ?? ""} ${item.mechanicsText ?? ""}`;
  const weight = /\b(heavy|medium|light)\s+armor\b/i.exec(stated)?.[1]?.toLowerCase() as
    ArmorTypeId | undefined;

  let type = item.type;
  // Only ever promotes OUT of the catch-all. An item already typed armor/shield/weapon is left
  // alone — a DM's explicit choice outranks a re-read.
  if ((type === "gear" || type === "tool") && ac) {
    type = ac.startsWith("+") ? "shield" : "armor";
  }
  const armorType = type === "armor" ? (item.armorType ?? weight) : item.armorType;
  return type === item.type && armorType === item.armorType ? item : { ...item, type, armorType };
}

/**
 * The mastery an item INHERITS, when it resolves to a base weapon.
 *
 * Two ways an item resolves to one: it IS a seeded base weapon (its id names the form), or it is
 * a chassis whose form has been chosen. Either way the 2024 PHB table is the source of truth and
 * the value is not the DM's to type. Returns null for everything else — a magic weapon with no
 * base form, a homebrew, an unformed chassis — and those keep the free choice.
 */
export function inheritedMasteryFor(
  item: { id?: string; chassis?: ChassisSpec },
): { mastery: WeaponMasteryName; source: string } | null {
  const own = item.id?.startsWith("base-") ? findForm(item.id) : undefined;
  const form = own ?? findForm(item.chassis?.formId);
  return form?.mastery ? { mastery: form.mastery, source: form.name } : null;
}

/**
 * Fill a chassis item's dice in from its chosen form.
 *
 * Returns the item untouched when it is not a chassis, or when no form has been picked yet —
 * an unformed chassis is a real state (the DM built it, nobody has shaped it), and it should
 * render as an item with no attack rather than throw or invent one.
 *
 * Everything downstream — itemToAction, itemToAttackAction, the card, the roll — then treats it
 * as an ordinary weapon, because by this point it IS one.
 */
export function resolveChassisItem(item: EquipmentItem): EquipmentItem {
  const form = findForm(item.chassis?.formId);
  if (!form) return item;

  // The bonus is AUTHORED, never inferred. Reading it out of the name ("+2") or the gold field
  // is the kind of guess that mis-tagged the armour slots — the builder asks for it.
  const grip: WeaponGrip = item.grip ?? "1h";
  const dice = composeChassisAttack(form, grip, item.chassisBonus ?? 0, item.pbToDamage);

  return {
    ...item,
    ...dice,
    category: form.category,
    /**
     * ⚠ THE FORM'S MASTERY WINS. This was `item.mastery ?? form.mastery`, so a stale or
     * hand-typed value on the item outranked the base weapon it is built on — a handaxe chassis
     * could read as anything but Vex. The base weapon table is the source of truth.
     *
     * HAVING the mastery is still a separate question and still the character's: it is live only
     * with a feature unlocking it. A Gift grants proficiency, not mastery freedom.
     */
    mastery: form.mastery ?? item.mastery,
    range: item.range ?? form.range,
  };
}

export function itemToAction(item: EquipmentItem, equipped = true): ActorAction {
  item = resolveChassisItem(item);
  // A TO-HIT is what makes something a weapon — not the presence of dice.
  //
  // This used to read `attack || damage`, which meant giving a magic item its damage dice
  // reclassified it as a weapon: no Use button, and `reference` mode so no roll either. Magic
  // items in this campaign do not roll to hit — checked across the library, every convergence
  // item resolves by a save or by nothing at all, and the only "magic" items with a to-hit
  // (Voidtempered Blade, Rootknot Staff) are literally a +1 shortsword and a +1 quarterstaff.
  const isWeapon = Boolean(item.attack);
  // Dice that resolve without a to-hit: a save rider, a burst, a heal. These are the ones that
  // need a committable roll ON the equipment row, since they have no main-tab attack to roll from.
  const hasEffectDice = Boolean(item.damage) && !isWeapon;
  // A save the TARGET rolls, not a to-hit. This is how a magic item threatens damage.
  const hasSave = Boolean(item.saveDc) && !isWeapon;
  // Consumables with charges but no attack dice: usable from equipment tab (e.g. Elixir, Potion)
  const isConsumable = Boolean(item.charges) && !isWeapon;
  const isPassive = item.type === "passive";

  return {
    id: `equip-${item.id}`,
    label: item.name,
    // WHAT IT DOES, not what it is. `mechanicsText` wins over `description` on every item
    // type, because `description` is campaign FLAVOUR — authoring reference for building the
    // item, written for the loot doc. On a player's card it is worse than useless: Shattered
    // Vigil read "A Ward field instrument recovered from the base at the lake's edge" with
    // its +1 to spell attack and its 2d8 rider nowhere in sight, and `mechanicsText` rendered
    // only in the merchant view. Flavour stays on the library item for the DM.
    description: item.mechanicsText || item.description,
    actionKind: "equipment",
    // Weapons: reference-only on equipment tab (roll lives in main tab)
    // Consumables: logged when used so DM/player knows a charge was spent
    // Armor/gear: silent reference
    logMode: isConsumable ? "table-note" : "silent",
    displayMode: "compact",
    // A CHARGE POOL IS A DEFINED USE. Gating the Use button on `isConsumable` alone meant
    // every charged magic item — the whole convergence output set, each "1/day, recharges at
    // dawn" — carried a pool with nothing able to spend it. All 30 charged items in the
    // campaign library also carry `isUsable: false`, so the flag could not rescue them
    // either; deriving it from the pool fixes them all at once and stays true for any item
    // authored later. Weapons without charges still roll from the main tab, not from here.
    hasDefinedUse: isConsumable || Boolean(item.charges),
    economyCost: undefined,        // equipment bag never costs action economy slots
    category: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    tags: item.tags,
    metadata: {
      // Keep attack/damage for display text in the bag — but outcomeMode blocks dice button
      attack: item.attack,
      damage: item.damage,
      crit: item.crit,
      range: item.range,
      // Drives dc-check mode and shows the Save row on the action.
      saveDc: item.saveDc,
      // Weapons: "reference" → TabPanel.hasAttachedDice returns false → no Roll button
      // Consumables: "triggered" → Use button fires a log entry (no dice on equip tab)
      // Armor/gear: "reference"
      // Weapons stay "reference" here — TabPanel.hasAttachedDice returns false, so the
      // equipment row shows no Roll button and the weapon rolls from its main-tab attack.
      // Effect dice get "damage-only": a straight roll with no hit/miss step, which is what
      // a save rider or a burst needs — the save is adjudicated at the table, the dice are
      // rolled and committed here.
      // A save comes FIRST: dc-check announces it and waits on Applies / No Effect, so the
      // table rolls the save before the damage is applied rather than seeing damage appear
      // and being asked to un-apply it. Without a save, effect dice just roll.
      // HEALING IS ITS OWN MODE and it covers HP restored, temp HP AND damage prevented — all
      // three are HP the bearer keeps. Effect dice used to be hardcoded to "damage-only", so an
      // item that rolls to REDUCE damage announced itself as damage dealt.
      outcomeMode: isWeapon ? "passive"
        : hasSave ? "dc-check"
        : hasEffectDice ? outcomeModeForEffectKind(item.effectKind)
        : isConsumable ? "triggered"
        : "passive",
      // Carried on the action, like statEffects, so the card can enforce slot exclusivity
      // without resolving the item back out of the library.
      slot: item.slot,
      details: [
        item.ac ? `AC ${item.ac}` : undefined,
        item.attack ? `⚔ ${item.attack}` : undefined,
        item.damage ? `💥 ${item.damage}` : undefined,
        (item.spellFocusAttack || item.spellFocusDamage)
          ? `🪄 Spell focus${item.spellFocusAttack ? ` · atk ${item.spellFocusAttack}` : ""}${item.spellFocusDamage ? ` · dmg ${item.spellFocusDamage}` : ""}`
          : undefined,
        item.range ? `Range: ${item.range}` : undefined,
        item.mastery ? `Mastery: ${item.mastery}` : undefined,
        // Attunement is a hard limit (three at a time) and was visible nowhere on the card.
        item.attunementRequired ? "Requires attunement" : undefined,
        // ◈ is the Convergence mark used in the library and the forge picker; it belongs on
        // the player's own item too, or they cannot tell an input from ordinary kit.
        item.convergence ? `◈ Convergence${item.convergence.mechanicalTag ? ` · ${item.convergence.mechanicalTag}` : ""}` : undefined,
        item.value ? `Value: ${item.value}` : undefined,
        item.weight ? `Weight: ${item.weight}` : undefined,
      ].filter(Boolean).join(" · "),
      // Baked at attach time — no library lookup needed for AC/stat derivation
      statEffects: bakeStatEffects(item),
      acDisplay: item.ac,
      /**
       * ⚠ WHAT THE ITEM IS, CARRIED WITH IT. Without this the round-trip GUESSED the type from
       * whether the item had dice — anything without an attack or damage became "gear". That is
       * why armour, shields and a wand all read as gear on a live sheet, why the wand stopped
       * qualifying as a focus, and why editing an item on a character and saving it "regressed":
       * the guess was written back over the real type every time.
       */
      itemType: item.type,
      mastery: item.mastery,
      effectKind: item.effectKind,
      armorType: item.armorType,
      count: item.count,
      // Carried so the card can enforce the one-T4-per-character cap without a library lookup.
      tier: item.tier,
      // Spellcasting focus bonuses — read by the spell roll workspace (clickable additive).
      spellFocusAttack: item.spellFocusAttack,
      spellFocusDamage: item.spellFocusDamage,
      spellFocusSaveDc: item.spellFocusSaveDc,
      isSpellFocus: item.isSpellFocus,
      equipped,
      charges: item.charges,
      // Carried so the card can count attunement against what's equipped, without a library
      // lookup. The details string above is prose — not something a checker can read.
      attunementRequired: item.attunementRequired,
      // Convergence identity travels WITH the item. Players cannot author these, but they
      // must be able to see they are holding one — the forge panel is player-initiated, so
      // an unmarked input is an item the player never knows to bring.
      convergence: item.convergence
        ? { role: item.convergence.role, mechanicalTag: item.convergence.mechanicalTag }
        : undefined,
      // Chassis state rides the action so the card can offer the grip switch and re-derive the
      // dice without resolving the item back out of the library — same rule as statEffects.
      chassis: item.chassis,
      grip: item.grip,
      chassisBonus: item.chassisBonus,
      pbToDamage: item.pbToDamage,
      riders: item.riders,
      effect: item.effect ? {
        type: item.effect.type as string,
        label: item.effect.label,
        formula: item.effect.formula,
        value: item.effect.value,
        condition: item.effect.condition,
      } : undefined,
    },
  };
}

// ─── Convert EquipmentItem → ActorAction (MAIN/ACTIONS TAB — rollable attack) ─
//
// Only called for items with attack or damage formulas.
// This is the action the player actually uses during combat.
// id prefix "atk-" distinguishes it from the equipment display entry "equip-".

export function itemToAttackAction(item: EquipmentItem): ActorAction {
  item = resolveChassisItem(item);
  return {
    id: `atk-${item.id}`,
    label: item.name,
    // Mechanics, not flavour — see itemToAction. A player swinging this needs the rider,
    // not the story of where it was found.
    description: item.mechanicsText || item.description,
    actionKind: "attack",
    logMode: "table-note",
    displayMode: "compact",
    hasDefinedUse: true,
    economyCost: ["main"],
    category: item.category ?? (item.type.charAt(0).toUpperCase() + item.type.slice(1)),
    tags: item.tags,
    metadata: {
      attack: item.attack,
      damage: item.damage,
      crit: item.crit,
      range: item.range,
      cost: "Action",
      // Information on the attack: range, then the chosen Weapon Mastery's rules text.
      details: [
        item.range ? `Range: ${item.range}` : undefined,
        masteryInfoLine(item.mastery),
      ].filter(Boolean).join("\n\n") || undefined,
      // No outcomeMode — TabPanel infers "attack-roll" from attack formula (correct behavior)
    },
  };
}

// ─── Item form ────────────────────────────────────────────────────────────────

// Types a DM may choose.  is deliberately absent — retired, not gated.
const ITEM_TYPES: EquipmentItem["type"][] = SELECTABLE_ITEM_TYPES;

type ItemFormProps = {
  initial?: EquipmentItem;
  onSave: (item: EquipmentItem) => void;
  onCancel: () => void;
};

function ItemForm({ initial, onSave, onCancel }: ItemFormProps) {
  const [draft, setDraft] = useState<EquipmentItem>(() => initial ?? {
    id: `item-${Date.now().toString(36)}`,
    name: "",
    type: "gear",
    description: "",
    isUsable: false,
  });

  const [errors, setErrors] = useState<string[]>([]);
  /**
   * Non-null when this item resolves to a base weapon, in which case its mastery is INHERITED
   * from the 2024 PHB table rather than chosen. Recomputed as the chassis form changes, so
   * picking a handaxe form immediately shows Vex.
   */
  const inheritedMastery = useMemo(() => inheritedMasteryFor(draft), [draft]);
  // Pending drafts (P-ROLL3b) — only meaningful when creating a brand-new item
  const [equipDrafts, setEquipDrafts] = useState<PendingDraft<EquipmentItem>[]>(
    () => loadPendingDrafts<EquipmentItem>("equipment"),
  );
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  function set<K extends keyof EquipmentItem>(key: K, value: EquipmentItem[K]) {
    setDraft(d => ({ ...d, [key]: value }));
    setErrors([]);
  }

  function handleSave() {
    if (!draft.name.trim()) { setErrors(["Item name is required."]); return; }
    const item: EquipmentItem = {
      ...draft,
      id: draft.id || `item-${slugify(draft.name)}-${Date.now().toString(36)}`,
      name: draft.name.trim(),
    };
    // Finalize: this item is now truly created, so clear its pending draft.
    if (activeDraftId) removePendingDraft("equipment", activeDraftId);
    onSave(item);
  }

  function handleSaveDraft() {
    if (!draft.name.trim()) { setErrors(["Name the item before saving a draft."]); return; }
    const id = activeDraftId ?? newPendingDraftId("equipment");
    setEquipDrafts(savePendingDraft<EquipmentItem>("equipment", {
      id, name: draft.name.trim(), savedAt: new Date().toISOString(), payload: draft,
    }));
    setActiveDraftId(id);
  }

  function handleResumeDraft(d: PendingDraft<EquipmentItem>) {
    setDraft(d.payload);
    setActiveDraftId(d.id);
    setErrors([]);
  }

  function handleDiscardDraft(id: string) {
    setEquipDrafts(removePendingDraft<EquipmentItem>("equipment", id));
    if (activeDraftId === id) setActiveDraftId(null);
  }

  const inputStyle = {
    display: "block" as const, width: "100%", marginTop: 2,
    padding: "4px 8px", borderRadius: 4, border: "1px solid #444",
    background: "#111", color: "#fff", fontSize: 13,
  };

  /**
   * ⚠ WHAT SHOWS IS DECIDED BY THE TYPE, from the shared capability table.
   *
   * This used to be `isWeapon = type === "weapon" || type === "magic"`, which handed a wondrous
   * item the full weapon dice block — and every item, whatever its type, got every other field
   * underneath. *"right now the long scroll of creating any item is too much."*
   *
   * `magic` no longer means "might be a weapon": a magical weapon is a `weapon`, and wondrous is
   * the one type that may be Convergence.
   */
  const allows = (c: Parameters<typeof itemTypeAllows>[1]) => itemTypeAllows(draft.type, c);
  const isWeapon = allows("attackDice");
  const isArmor = allows("ac");

  return (
    // Scrolls, same as the library panel's form — the chassis block pushed the Save button
    // past the bottom of the character editor, so an item could be filled in but not finished.
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, background: "#1a1a2e", borderRadius: 8, maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>
      <h4 style={{ margin: 0, position: "sticky", top: 0, background: "#1a1a2e", paddingBottom: 6, zIndex: 1 }}>{initial ? "Edit Item" : "New Item"}</h4>

      {/* Pending / Drafts — parked in-progress items (new-item mode only) */}
      {!initial && equipDrafts.length > 0 && (
        <div style={{ padding: "8px 10px", background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#9d8cff", textTransform: "uppercase", letterSpacing: 1 }}>Pending / Drafts · {equipDrafts.length}</span>
          {equipDrafts.map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ flex: 1, minWidth: 100, fontSize: 12 }}>{d.name}{activeDraftId === d.id ? " · editing" : ""}</strong>
              <span style={{ fontSize: 10, color: "#666" }}>{new Date(d.savedAt).toLocaleString()}</span>
              <button type="button" onClick={() => handleResumeDraft(d)} style={{ fontSize: 11, padding: "2px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#9d8cff", cursor: "pointer" }}>Resume</button>
              <button type="button" onClick={() => handleDiscardDraft(d.id)} style={{ fontSize: 11, padding: "2px 8px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>Discard</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>
          Name *
          <input type="text" value={draft.name} onChange={e => set("name", e.target.value)} style={inputStyle} autoFocus />
        </label>
        <label style={{ fontSize: 12 }}>
          Type
          <select value={draft.type} onChange={e => set("type", e.target.value as EquipmentItem["type"])} style={{ ...inputStyle, marginTop: 2 }}>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t === "magic" ? "Magic (wondrous)" : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          {/* THE TYPE DECIDES WHAT THE REST OF THIS FORM EVEN SHOWS, so it has to say what it
              means. "Magic" reading as "magical" is what got a +1 sword filed as wondrous. */}
          <span style={{ fontSize: 10, color: "#5a5a6e" }}>{ITEM_TYPE_BLURB[draft.type]}</span>
        </label>
      </div>

      {/* Weapon fields */}
      {/* ADAPTIVE sits at the top and REPLACES the weapon/armour fields — see the library
          form for the reasoning. Both editors carry it, because a field in only one of them
          is a field the DM cannot reach from half the app. */}
      <ChassisFields draft={draft} set={set} />

      {isWeapon && !draft.chassis && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Attack roll — dice picker (1d20 + dice + @vars) since this weapon makes an attack roll */}
          <FormulaInput label="Attack" value={draft.attack ?? ""} onChange={v => set("attack", v || undefined)} placeholder="1d20+@STR+@PROF" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 12 }}>Damage <input type="text" value={draft.damage ?? ""} onChange={e => set("damage", e.target.value || undefined)} placeholder="1d8+3" style={inputStyle} /></label>
            <label style={{ fontSize: 12 }}>Crit <input type="text" value={draft.crit ?? ""} onChange={e => set("crit", e.target.value || undefined)} placeholder="2d8+3" style={inputStyle} /></label>
            <label style={{ fontSize: 12 }}>Range <input type="text" value={draft.range ?? ""} onChange={e => set("range", e.target.value || undefined)} placeholder="5 ft, 150/600 ft..." style={inputStyle} /></label>
          </div>
          {/* The save the TARGET rolls. A magic item does not roll to hit — set this and the
              card announces the save and waits, so the damage is applied after it is rolled
              rather than before. Leave blank and the dice simply roll. */}
          <label style={{ fontSize: 12 }}>
            Save DC <span style={{ color: "#666" }}>— target rolls this before damage lands</span>
            <input type="text" value={draft.saveDc ?? ""} onChange={e => set("saveDc", e.target.value || undefined)}
              placeholder="CON DC 13" style={inputStyle} />
          </label>

          {/* Hand count + Weapon Mastery.

              ⚠ MASTERY COMES FROM THE BASE WEAPON — BUT THE PICKER STAYS. Christopher,
              2026-08-17: *"base weapons need to be where the mastery comes from but there are
              other wapons in DN so we cant just remove the mastery choice, but if it is a base
              weapon it should get the inherited mastery."*

              A Thornback Hatchet on a handaxe chassis is Vex because the handaxe is Vex, not
              because someone typed it — so when the item resolves to a base weapon the value is
              INHERITED and shown as such, never re-chosen. The game has weapons outside that
              table, so anything that does NOT resolve to one keeps a free choice.

              Whether the character can USE the mastery is a separate question and still theirs:
              it is live only with a feature unlocking it, which is why the note below stays. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 12 }}>
              Category
              <select
                value={draft.category ?? ""}
                onChange={e => set("category", e.target.value || undefined)}
                style={{ ...inputStyle, marginTop: 2 }}
              >
                <option value="">— none —</option>
                {WEAPON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {inheritedMastery ? (
              <div style={{ fontSize: 12 }}>
                Weapon Mastery
                <div style={{
                  ...inputStyle, marginTop: 2, display: "flex", alignItems: "center",
                  background: "#0d0d14", color: "#d7b36a", cursor: "default",
                }}>
                  {inheritedMastery.mastery}
                </div>
                <span style={{ fontSize: 10, color: "#5a5a6e" }}>
                  Inherited from the {inheritedMastery.source} — a base weapon's mastery is not a choice.
                </span>
              </div>
            ) : (
              <label style={{ fontSize: 12 }}>
                Weapon Mastery
                <select
                  value={draft.mastery ?? ""}
                  onChange={e => set("mastery", (e.target.value || undefined) as WeaponMasteryName | undefined)}
                  style={{ ...inputStyle, marginTop: 2 }}
                >
                  <option value="">— none —</option>
                  {WEAPON_MASTERY_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <span style={{ fontSize: 10, color: "#5a5a6e" }}>
                  Not a base weapon — choose its mastery.
                </span>
              </label>
            )}
          </div>
          {draft.mastery && WEAPON_MASTERIES[draft.mastery] && (
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "#8a8aa0", background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
              <strong style={{ color: "#d7b36a" }}>{draft.mastery}.</strong>{" "}
              {WEAPON_MASTERIES[draft.mastery].summary}
              <br />
              <span style={{ color: "#5a5a6e" }}>
                Officially on: {WEAPON_MASTERIES[draft.mastery].weapons.join(", ")}. Applies only if the character has a feature unlocking it.
              </span>
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <span />
          </div>
        </div>
      )}

      {/* AC — armour, shields and wondrous items only.
          *"you shouldnt be able to add a AC on anything except armor, and magical items."* */}
      {isArmor && !draft.chassis && (
        <div style={{ display: "grid", gridTemplateColumns: allows("armorType") ? "1fr 1fr" : "1fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>
            AC Value / Formula
            <input type="text" value={draft.ac ?? ""} onChange={e => set("ac", e.target.value || undefined)}
              placeholder={draft.type === "shield" ? "+2" : "14, 12 + DEX mod..."} style={inputStyle} />
          </label>
          {/* ARMOUR CARRIES ITS TYPE — *"armor is armor with armor type."* It is what decides
              whether DEX applies to the AC above, and at what cap. */}
          {allows("armorType") && (
            <label style={{ fontSize: 12 }}>
              Armour type
              <select value={draft.armorType ?? ""} onChange={e => set("armorType", (e.target.value || undefined) as ArmorTypeId | undefined)}
                style={{ ...inputStyle, marginTop: 2 }}>
                <option value="">— none —</option>
                {ARMOR_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <span style={{ fontSize: 10, color: "#5a5a6e" }}>
                {ARMOR_TYPES.find(a => a.id === draft.armorType)?.note ?? "Decides how DEX applies."}
              </span>
            </label>
          )}
        </div>
      )}

      {/* DICE THAT ARE NOT AN ATTACK — a wondrous item rolls, it just never rolls to hit.
          Every A3/T3/T4 Convergence item is a Rider, Reaction, Bonus/Magic Action or Passive,
          and several of them roll: "+2d8 when you deal damage with an attack", "roll 2d8, reduce
          the triggering damage", "add 1d10" to a failed check. Removing the attack block from
          wondrous items was right; removing their dice with it was not. */}
      {allows("effectDice") && !allows("attackDice") && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>
            Effect dice <span style={{ color: "#666" }}>— what it rolls, when it is not an attack</span>
            <input type="text" value={draft.damage ?? ""} onChange={e => set("damage", e.target.value || undefined)}
              placeholder="2d8, 1d10, +2d10..." style={inputStyle} />
          </label>
          {/* FOUR KINDS, TWO MODES. Healing, temp HP and reduction all resolve through the
              `healing` outcome mode — they are HP the bearer keeps, so none may be announced as
              damage dealt — but they are three different things at the table and the button says
              which. Collapsing them into one word is what had me reporting a missing mode. */}
          <label style={{ fontSize: 12 }}>
            Rolls as
            <select value={draft.effectKind ?? "damage"}
              onChange={e => set("effectKind", e.target.value === "damage" ? undefined : e.target.value as EffectKind)}
              style={{ ...inputStyle, marginTop: 2 }}>
              {EFFECT_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <span style={{ fontSize: 10, color: "#5a5a6e" }}>
              {(EFFECT_KINDS.find(k => k.id === (draft.effectKind ?? "damage")) ?? EFFECT_KINDS[0]).note}
            </span>
          </label>
        </div>
      )}

      {/* ⚠ REROLL SOURCE — the option that had no way to be authored. The scanner has always
          looked for `effect.type === "reroll"`, and NEITHER item editor ever offered it, so the
          only reroll-capable item in the whole library was one seeded in code. Every reroll on a
          live sheet — a Staring-Knot Wand, a Clarity Hood — was invisible to the picker.

          The METHOD is chosen, not read from the description: prose-reading is a guess, and
          guessing "other side of the die" turns a determined value into a random one. */}
      <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={draft.effect?.type === "reroll"}
            onChange={e => set("effect", e.target.checked
              ? { ...(draft.effect ?? {}), type: "reroll", rerollMethod: draft.effect?.rerollMethod ?? "reroll" }
              : (draft.effect?.type === "reroll" ? undefined : draft.effect))} />
          🎲 This can reroll a d20
          <span style={{ color: "#555", fontSize: 10 }}>— offers it in the reroll picker</span>
        </label>
        {draft.effect?.type === "reroll" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 6 }}>
            <label style={{ fontSize: 12 }}>
              Method
              <select value={draft.effect.rerollMethod ?? "reroll"}
                onChange={e => set("effect", { ...draft.effect!, rerollMethod: e.target.value as "reroll" | "flip" })}
                style={{ ...inputStyle, marginTop: 2 }}>
                <option value="reroll">Reroll — throw it again</option>
                <option value="advantage">Advantage — second d20, keep the higher</option>
                <option value="bonus">Add dice to the roll (+1d4, +1d10)</option>
                <option value="flip">Other side of the die (21 − roll)</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              When it applies
              <input type="text" value={draft.effect.condition ?? ""}
                onChange={e => set("effect", { ...draft.effect!, condition: e.target.value || undefined })}
                placeholder="a failed save vs Charmed or Frightened" style={inputStyle} />
            </label>
          </div>
        )}
        {draft.effect?.type === "reroll" && !draft.charges && (
          <div style={{ fontSize: 10, color: "#e07b39", marginTop: 4 }}>
            ⚠ Give it charges above, or it will never appear — the picker skips a reroll item with no pool to spend.
          </div>
        )}
      </div>

      {/* HOW MANY ARE HELD — consumables, gear and tools. A stack of five potions is one row
          with a count, not five rows. */}
      {allows("count") && (
        <label style={{ fontSize: 12 }}>
          Count <span style={{ color: "#666" }}>— how many are carried</span>
          <input type="number" min={0} value={draft.count ?? ""} placeholder="1"
            onChange={e => set("count", e.target.value ? Math.max(0, Number(e.target.value)) : undefined)}
            style={inputStyle} />
        </label>
      )}

      {/* Spellcasting focus — weapons and wondrous items. A staff or a blade can be a focus;
          armour and rations cannot. */}
      {allows("spellFocus") && (
      <div style={{ border: "1px solid #2a2a3e", borderRadius: 6, padding: "6px 8px" }}>
        <div style={{ fontSize: 11, color: "#9d8cff", marginBottom: 4 }}>🪄 Spellcasting focus</div>
        {/* ⚠ BEING A FOCUS IS ITS OWN FACT. A plain focus with no magical plus is still what
            every spell is cast through, and it is what supplies @SPELL to the roll — spells
            carry no @SPELL of their own. Before this, an item only counted as a focus if it
            stated a bonus, so a plain wand never appeared in the caster's focus list at all. */}
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <input type="checkbox" checked={Boolean(draft.isSpellFocus)}
            onChange={e => set("isSpellFocus", e.target.checked || undefined)} />
          This item is a spellcasting focus
          <span style={{ color: "#555", fontSize: 10 }}>— supplies @SPELL to every spell cast through it</span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 12 }}>Spell Attack Bonus <input type="text" value={draft.spellFocusAttack ?? ""} onChange={e => set("spellFocusAttack", e.target.value || undefined)} placeholder="+1" style={inputStyle} /></label>
          <label style={{ fontSize: 12 }}>Spell Damage Bonus <input type="text" value={draft.spellFocusDamage ?? ""} onChange={e => set("spellFocusDamage", e.target.value || undefined)} placeholder="+1, +1d4..." style={inputStyle} /></label>
          <label style={{ fontSize: 12 }}>Spell Save DC <input type="text" value={draft.spellFocusSaveDc ?? ""} onChange={e => set("spellFocusSaveDc", e.target.value || undefined)} placeholder="+1" style={inputStyle} /></label>
        </div>
        {/* WRITE THE ITEM'S OWN EXTRA ONLY. @SPELL comes from being a focus, so a +1 wand is
            "+1" and not "@SPELL+1" — writing the variable in as well is harmless (it is
            normalised out) but reads as though the item granted it. */}
        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
          The item's OWN extra, on top of the @SPELL every focus supplies — "+1", not "@SPELL+1".
          Attack and damage ride the spell's rolls; the DC bonus shifts its printed save DC.
          Put riders (e.g. "ignore Half Cover") in Description.
        </div>
      </div>
      )}

      <label style={{ fontSize: 12 }}>
        Description
        <textarea value={draft.description} onChange={e => set("description", e.target.value)} rows={2}
          style={{ ...inputStyle, resize: "vertical" as const }} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Value <input type="text" value={draft.value ?? ""} onChange={e => set("value", e.target.value || undefined)} placeholder="25 gp" style={inputStyle} /></label>
        <label style={{ fontSize: 12 }}>Weight <input type="text" value={draft.weight ?? ""} onChange={e => set("weight", e.target.value || undefined)} placeholder="3 lb" style={inputStyle} /></label>
      </div>

      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={draft.isUsable} onChange={e => set("isUsable", e.target.checked)} />
        Has a usable action (shows Use button on actor card)
      </label>
      {/* What the item DOES. This is the block the card shows the player — itemToAction
          renders `mechanicsText || description`, so an item with mechanics never displays
          its flavour. An artificer writing their own wand needs to say what it does. */}
      <label style={{ fontSize: 12 }}>
        Mechanics <span style={{ color: "#7b68ee" }}>— what the card shows</span>
        <textarea value={draft.mechanicsText ?? ""} onChange={e => set("mechanicsText", e.target.value || undefined)}
          rows={2} placeholder="While worn, reduce force damage you take by 2."
          style={{ ...inputStyle, resize: "vertical" as const }} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ fontSize: 12 }}>Worn slot
          <select value={draft.slot ?? ""} onChange={e => set("slot", (e.target.value || undefined) as EquipmentItem["slot"])}
            style={{ ...inputStyle, marginTop: 2 }}>
            <option value="">Carried — no slot</option>
            {(Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]).map(sl => (
              <option key={sl} value={sl}>{SLOT_LABEL[sl]}{SLOT_CAPACITY[sl] > 1 ? ` (${SLOT_CAPACITY[sl]})` : ""}</option>
            ))}
          </select>
        </label>
        {/* Uses, for a thing they are building — a wand with three charges. How it comes
            back is a rest cadence; "manual" means nothing restores it but a hand on the
            card, which is what a dawn recharge needs. */}
        <ChargesFields charges={draft.charges} onChange={v => set("charges", v)} inputStyle={inputStyle} />
      </div>

      {/* An artificer's own creations can require attunement just as campaign loot does, so
          this has to be authorable here — not only a property of shipped items. It feeds the
          card's attunement count, which is why it is a flag and not just prose. */}
      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={Boolean(draft.attunementRequired)} onChange={e => set("attunementRequired", e.target.checked || undefined)} />
        Requires attunement (counts against the 3 attuned slots while equipped)
      </label>


      {/* Stat effects — passive stat modifications while item is equipped */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "#aaa" }}>Stat Effects (while equipped)</span>
          <button type="button"
            onClick={() => set("statEffects", [...(draft.statEffects ?? []), { type: "addStat", stat: "str", value: 0 }])}
            style={{ fontSize: 10, padding: "1px 7px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
            + Add Effect
          </button>
        </div>
        {(draft.statEffects ?? []).map((eff, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 70px 60px 28px", gap: 4, marginBottom: 4, alignItems: "center" }}>
            <select value={eff.type} onChange={e => {
              const next = [...(draft.statEffects ?? [])];
              next[i] = { ...eff, type: e.target.value as StatEffect["type"] };
              set("statEffects", next);
            }} style={{ ...inputStyle, fontSize: 11, padding: "2px 4px" }}>
              <option value="setStat">Set Stat</option>
              <option value="addStat">Add to Stat</option>
              <option value="setAC">Set AC</option>
              <option value="addAC">Add to AC</option>
              <option value="addHP">Add to HP Max</option>
              <option value="addSpeed">Add to Speed</option>
            </select>
            {(eff.type === "setStat" || eff.type === "addStat") && (
              <select value={eff.stat ?? "str"} onChange={e => {
                const next = [...(draft.statEffects ?? [])];
                next[i] = { ...eff, stat: e.target.value as StatEffect["stat"] };
                set("statEffects", next);
              }} style={{ ...inputStyle, fontSize: 11, padding: "2px 4px" }}>
                {(["str","dex","con","int","wis","cha"] as const).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            )}
            <input type="number" value={eff.value} onChange={e => {
              const next = [...(draft.statEffects ?? [])];
              next[i] = { ...eff, value: Number(e.target.value) };
              set("statEffects", next);
            }} style={{ ...inputStyle, fontSize: 11, padding: "2px 4px", textAlign: "center" }} />
            <button type="button" onClick={() => set("statEffects", (draft.statEffects ?? []).filter((_, j) => j !== i))}
              style={{ fontSize: 12, background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer", padding: "1px 4px" }}>
              ✕
            </button>
          </div>
        ))}
        {(draft.statEffects ?? []).length === 0 && (
          <p style={{ fontSize: 11, color: "#444", fontStyle: "italic", margin: 0 }}>None — passive items with no stat modifications.</p>
        )}
      </div>

      {errors.map(e => <p key={e} style={{ margin: 0, fontSize: 12, color: "#ff9999" }}>{e}</p>)}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={handleSave} style={{ padding: "5px 16px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {initial ? "Save Item" : "Create & Attach"}
        </button>
        {!initial && (
          <button type="button" onClick={handleSaveDraft} title="Park this in-progress item as a pending draft (survives reloads)"
            style={{ padding: "5px 16px", background: "transparent", color: "#9d8cff", border: "1px solid #7b68ee44", borderRadius: 4, cursor: "pointer" }}>
            {activeDraftId ? "Update Draft" : "Save as Draft"}
          </button>
        )}
        <button type="button" onClick={onCancel} style={{ padding: "5px 16px", background: "transparent", color: "#888", border: "1px solid #444", borderRadius: 4, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Bag editor ───────────────────────────────────────────────────────────────

type EquipmentBagEditorProps = {
  /** Current equipped items — actor.tabs.equipment (display/inventory) */
  equippedActions: ActorAction[];
  /** Current main-tab actions — actor.tabs.main (weapons attach rollable actions here) */
  mainActions: ActorAction[];
  /**
   * Called with tab updates when equipment changes.
   * Always includes `equipment`. Includes `main` when a weapon is attached/detached.
   */
  onChange: (updates: { equipment?: ActorAction[]; main?: ActorAction[] }) => void;
  /**
   * The person at this editor is a PLAYER, not the DM.
   *
   * A player may author the things they made — an artificer's own armour or wand — and may
   * not touch campaign loot. Every campaign item carries `isLocked`, which is what tells the
   * two apart. They can still SEE a locked item in full; they just cannot rewrite it.
   */
  playerMode?: boolean;
};

export function EquipmentBagEditor({ equippedActions, mainActions, onChange, playerMode = false }: EquipmentBagEditorProps) {
  const [view, setView] = useState<"bag" | "library" | "create">("bag");
  /**
   * Library search + type filter. Declared HERE, above the view switch, on purpose: editing an
   * item swaps to the "create" view and back, and state scoped to the library view would be
   * lost each time — which is exactly the "find it, edit it, now find it again" problem.
   */
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryTypeFilter, setLibraryTypeFilter] = useState("");
  /** Action id being edited in place on this actor. Null = the form is editing the library. */
  const [editingAttached, setEditingAttached] = useState<string | null>(null);
  const [library, setLibrary] = useState<EquipmentItem[]>(() => loadEquipmentLibrary());
  /**
   * Whether the person here may rewrite this item.
   *
   * A player owns what they MADE — an artificer's armour, a wand they built. Campaign loot
   * and convergence items are not theirs to rewrite, and every campaign item carries
   * `isLocked`, so that flag is the whole test. The DM is unaffected.
   *
   * They can still see a locked item in full; the difference is authoring, not visibility.
   */
  const canEditItem = (item: { isLocked?: boolean } | undefined) => !playerMode || !item?.isLocked;

  /**
   * What the picker actually shows. Matches across everything a DM would reach for — name,
   * type, category, tags, and the weapon mastery — so "light", "finesse", "bow", "Vex" and
   * "Rimecleaver" all find their item without knowing which field holds the word.
   */
  const visibleLibrary = library.filter(item => {
    if (libraryTypeFilter && item.type !== libraryTypeFilter) return false;
    const q = librarySearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      item.name, item.type, item.category, item.mastery, item.tier, item.act,
      ...(item.tags ?? []),
    ].filter(Boolean).join(" ").toLowerCase();
    // Every whitespace-separated term must appear, so "light armor" narrows rather than widens.
    return q.split(/\s+/).every(term => haystack.includes(term));
  });
  const [editingItem, setEditingItem] = useState<EquipmentItem | undefined>(undefined);

  // ── Migration: bake statEffects into pre-snapshot equipment entries; create
  //              missing attack actions in main for weapons already equipped. ──
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const equippedActionsRef = useRef(equippedActions);
  equippedActionsRef.current = equippedActions;
  const mainActionsRef = useRef(mainActions);
  mainActionsRef.current = mainActions;

  useEffect(() => {
    const allItems = loadEquipmentLibrary();
    const current = equippedActionsRef.current;
    const currentMain = mainActionsRef.current;
    let equipChanged = false;
    let mainChanged = false;
    const newMain = [...currentMain];

    const refreshed = current.map(a => {
      const itemId = a.id.replace(/^equip-/, "");
      const item = allItems.find(i => i.id === itemId || `equip-${i.id}` === a.id);
      if (!item) return a;

      // Re-derive as fresh snapshot if statEffects are missing or logMode is stale.
      // Carry the CURRENT equipped state through: this refresh is about stale library data,
      // and rebuilding at the default would silently re-equip something the player stowed.
      const fresh = itemToAction(item, a.metadata?.equipped !== false);
      const needsRefresh =
        a.metadata?.statEffects === undefined ||
        a.logMode !== fresh.logMode ||
        a.hasDefinedUse !== fresh.hasDefinedUse ||
        // Convergence identity used to stop at the library, so anything attached before this
        // is carrying none. Without it the ◈ cannot render and the player has no way to know
        // the item is a forge input — re-snapshot it from the library on the way in.
        (Boolean(item.convergence) && a.metadata?.convergence === undefined);

      if (needsRefresh) equipChanged = true;

      // If this is a weapon, ensure it has an attack action in main tab
      if (item.attack || item.damage) {
        const atkId = `atk-${item.id}`;
        if (!newMain.some(m => m.id === atkId)) {
          newMain.push(itemToAttackAction(item));
          mainChanged = true;
        }
      }

      return needsRefresh ? fresh : a;
    });

    const updates: { equipment?: ActorAction[]; main?: ActorAction[] } = {};
    if (equipChanged) updates.equipment = refreshed;
    if (mainChanged) updates.main = newMain;
    if (equipChanged || mainChanged) onChangeRef.current(updates);
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const equippedIds = new Set(equippedActions.map(a => a.id.replace("equip-", "")));

  function refreshLibrary() {
    setLibrary(loadEquipmentLibrary());
  }

  function attachItem(item: EquipmentItem) {
    if (equippedIds.has(item.id)) return; // already equipped
    const newEquipment = [...equippedActions, itemToAction(item)];
    const updates: { equipment: ActorAction[]; main?: ActorAction[] } = { equipment: newEquipment };
    // Weapons also get a rollable attack action in the main (Actions) tab
    if (item.attack || item.damage) {
      const atkEntry = itemToAttackAction(item);
      if (!mainActions.some(a => a.id === atkEntry.id)) {
        updates.main = [...mainActions, atkEntry];
      }
    }
    onChange(updates);
  }

  /**
   * Rebuild an EquipmentItem from the actor's copy, for anything not already in the library.
   *
   * Attaching bakes the item onto the actor, so the actor's entry is a complete record — this
   * reads it back out. Only ever used to RESCUE an item on detach; a library item is never
   * overwritten from an actor's baked copy, because that copy may carry attach-time edits.
   */
  function actionToItem(action: ActorAction, itemId: string): EquipmentItem {
    const m = action.metadata ?? {};
    return repairItemType({
      id: itemId,
      name: action.label,
      /**
       * ⚠ READ THE TYPE, DO NOT GUESS IT. The old `(m.attack || m.damage) ? "weapon" : "gear"`
       * turned every non-dice item into gear — armour, shields, wands, tools alike — and since
       * the on-character editor loads through this function, saving an item wrote that guess
       * back over its real type. The guess survives only as a fallback for a copy baked before
       * `itemType` existed.
       */
      type: (m.itemType as EquipmentItem["type"] | undefined)
        ?? ((m.attack || m.damage) ? "weapon" : "gear"),
      mastery: m.mastery as EquipmentItem["mastery"],
      effectKind: m.effectKind as EffectKind | undefined,
      tier: m.tier,
      armorType: m.armorType as EquipmentItem["armorType"],
      count: m.count,
      description: action.description ?? "",
      isUsable: Boolean(action.hasDefinedUse),
      attack: m.attack,
      damage: m.damage,
      crit: m.crit,
      range: m.range,
      ac: m.acDisplay,
      spellFocusAttack: m.spellFocusAttack,
      spellFocusDamage: m.spellFocusDamage,
      spellFocusSaveDc: m.spellFocusSaveDc,
      isSpellFocus: m.isSpellFocus,
      charges: m.charges,
      attunementRequired: m.attunementRequired,
      // Round-tripped so editing a sheet's copy does not quietly strip the item's Convergence
      // identity — the one thing about it a player is not allowed to author.
      convergence: (m.convergence?.role === "input" || m.convergence?.role === "output")
        ? { role: m.convergence.role, enabled: true, mechanicalTag: m.convergence.mechanicalTag }
        : undefined,
      // `metadata` stores these with widened `string` types (it is the generic action shape),
      // so narrow them back on the way home. Same objects, round-tripped.
      effect: m.effect as EquipmentEffect | undefined,
      statEffects: m.statEffects as StatEffect[] | undefined,
      category: action.category,
      tags: action.tags,
    });
  }

  function detachItem(actionId: string) {
    const itemId = actionId.replace(/^equip-/, "");
    const detached = equippedActions.find(a => a.id === actionId);

    // NEVER lose a player-created item. Detach was written assuming everything came FROM the
    // library ("stays in library"), which is false for anything a player built on the fly —
    // an artificer's replicated or infused gear, a DM-improvised item. Those existed only on
    // the actor, so detaching destroyed them. Anything unknown to the library is banked there
    // on the way out; items already in the library are left exactly as they are.
    if (detached) {
      const libraryItem = loadEquipmentLibrary().find(i => i.id === itemId);
      const carried = actionToItem(detached, itemId);

      // THE LIBRARY WINS, but the character's version is never destroyed.
      //   · unknown to the library  → bank it (an artificer's replicated/infused gear, or
      //     anything a player built on the fly, existed ONLY on the actor)
      //   · known and identical     → nothing to do
      //   · known and DIFFERENT     → the library copy stays canonical; the diverged version
      //     is written to the DM library, which `upsertItem` does by writing an unlocked
      //     entry under the same id. A campaign item is never mutated by a character's copy.
      const diverged = libraryItem && ["attack", "damage", "crit", "range", "ac"].some(
        k => (libraryItem as Record<string, unknown>)[k] !== (carried as Record<string, unknown>)[k]);

      if (!libraryItem || diverged) {
        upsertItem(carried);
        refreshLibrary();
      }
    }

    const newEquipment = equippedActions.filter(a => a.id !== actionId);
    const newMain = mainActions.filter(a => a.id !== `atk-${itemId}`);
    const hadAtkEntry = newMain.length !== mainActions.length;
    onChange({ equipment: newEquipment, ...(hadAtkEntry ? { main: newMain } : {}) });
  }

  /**
   * Edit the character's OWN copy of an attached item.
   *
   * Changing it used to mean detach → hunt it down in the library → edit → re-attach, which
   * also edited it for every other character holding one. Attaching bakes a complete record
   * onto the actor (that is what actionToItem reads back), so the copy can simply be edited
   * where it sits — a +1 someone earned on their blade stays theirs.
   */
  function editAttachedItem(action: ActorAction) {
    setEditingAttached(action.id);
    setEditingItem(actionToItem(action, action.id.replace(/^equip-/, "")));
    setView("create");
  }

  /**
   * Save an in-place edit: replaces this actor's rows only, never the library.
   *
   * Equipped state is preserved — editing a stat is not a decision about whether it is
   * worn. A weapon's rollable main-tab row is rebuilt too, or its dice would still be the
   * old ones while the bag showed the new.
   */
  function handleSaveAttachedItem(item: EquipmentItem) {
    const actionId = editingAttached;
    if (!actionId) return;
    const current = equippedActions.find(a => a.id === actionId);
    const stillEquipped = current?.metadata?.equipped !== false;
    const itemId = actionId.replace(/^equip-/, "");
    const edited = { ...item, id: itemId };

    const newEquipment = equippedActions.map(a => a.id === actionId ? itemToAction(edited, stillEquipped) : a);
    const updates: { equipment: ActorAction[]; main?: ActorAction[] } = { equipment: newEquipment };
    const atkId = `atk-${itemId}`;
    const hadAttack = mainActions.some(a => a.id === atkId);
    if (edited.attack || edited.damage) {
      updates.main = hadAttack
        ? mainActions.map(a => a.id === atkId ? itemToAttackAction(edited) : a)
        : [...mainActions, itemToAttackAction(edited)];
    } else if (hadAttack) {
      // Edited down to a non-weapon — drop the attack row rather than leave it rolling.
      updates.main = mainActions.filter(a => a.id !== atkId);
    }

    onChange(updates);
    setEditingAttached(null);
    setEditingItem(undefined);
    setView("bag");
  }

  function handleCreateItem(item: EquipmentItem) {
    upsertItem(item);
    refreshLibrary();
    attachItem(item);
    setView("bag");
  }

  function handleSaveLibraryItem(item: EquipmentItem) {
    upsertItem(item);
    refreshLibrary();
    // Update both equipment display entry and attack action if already equipped
    if (equippedIds.has(item.id)) {
      // Editing an item's stats must not change whether it is worn — keep the current state.
      const newEquipment = equippedActions.map(a => a.id === `equip-${item.id}`
        ? itemToAction(item, a.metadata?.equipped !== false)
        : a);
      const updates: { equipment: ActorAction[]; main?: ActorAction[] } = { equipment: newEquipment };
      if (item.attack || item.damage) {
        updates.main = mainActions.map(a => a.id === `atk-${item.id}` ? itemToAttackAction(item) : a);
      }
      onChange(updates);
    }
    setEditingItem(undefined);
    setView("library");
  }

  function removeFromLibrary(itemId: string) {
    // Cannot remove locked campaign items
    const dmLib = loadEquipmentLibrary("dm").filter(i => i.id !== itemId);
    saveEquipmentLibrary(dmLib, "dm");
    setLibrary(loadEquipmentLibrary());
    const newEquipment = equippedActions.filter(a => a.id !== `equip-${itemId}`);
    const newMain = mainActions.filter(a => a.id !== `atk-${itemId}`);
    const hadAtkEntry = newMain.length !== mainActions.length;
    onChange({ equipment: newEquipment, ...(hadAtkEntry ? { main: newMain } : {}) });
  }

  // ── Bag view ────────────────────────────────────────────────────────────────
  if (view === "bag") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
            {equippedActions.length === 0 ? "No items equipped." : `${equippedActions.length} item${equippedActions.length === 1 ? "" : "s"} equipped.`}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => { refreshLibrary(); setView("library"); }}
              style={{ fontSize: 11, padding: "3px 10px", background: "#2a3a4e", border: "1px solid #444", borderRadius: 3, color: "#aaa", cursor: "pointer" }}>
              From Library
            </button>
            <button type="button" onClick={() => { setEditingItem(undefined); setView("create"); }}
              style={{ fontSize: 11, padding: "3px 10px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
              + New Item
            </button>
          </div>
        </div>

        {equippedActions.length === 0 ? (
          <p style={{ fontSize: 11, color: "#444", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
            Click "From Library" to attach existing items or "New Item" to create one.
          </p>
        ) : (
          equippedActions.map(action => {
            const isUnequipped = action.metadata?.equipped === false;
            return (
            <div key={action.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#161622", borderRadius: 8, border: `1px solid ${isUnequipped ? "#3a3a1a" : "#2a2a3e"}`, opacity: isUnequipped ? 0.6 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{action.label}</span>
                  {isUnequipped && <span style={{ fontSize: 10, color: "#c9a227", background: "#2a2410", padding: "1px 6px", borderRadius: 10 }}>○ Unequipped</span>}
                  {action.category && <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 6px", borderRadius: 10 }}>{action.category}</span>}
                  {action.hasDefinedUse && <span style={{ fontSize: 10, color: "#7b68ee" }}>● Usable</span>}
                  {/* Same ◈ the library and the forge picker use. A player may not author a
                      convergence item, but they have to be able to see they are holding one. */}
                  {action.metadata?.convergence && (
                    <span style={{ fontSize: 10, color: "#4caf50" }}
                      title={`Convergence ${action.metadata.convergence.role ?? "item"}${action.metadata.convergence.mechanicalTag ? ` · ${action.metadata.convergence.mechanicalTag}` : ""}`}>
                      ◈{action.metadata.convergence.mechanicalTag ? ` ${action.metadata.convergence.mechanicalTag}` : ""}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  {action.metadata?.attack && <span style={{ fontSize: 11, color: "#7b68ee" }}>⚔ {action.metadata.attack}</span>}
                  {action.metadata?.damage && <span style={{ fontSize: 11, color: "#e07b39" }}>💥 {action.metadata.damage}</span>}
                  {action.metadata?.details && !action.metadata?.attack && (
                    <span style={{ fontSize: 11, color: "#666" }}>{action.metadata.details.slice(0, 60)}</span>
                  )}
                </div>
              </div>
              {/* Equipping is the PLAYER's, on their own sheet's CARRIED panel — this editor
                  builds the kit, it doesn't decide what is worn right now. The row still
                  SHOWS the state above so the DM can see it. */}
              {canEditItem(actionToItem(action, action.id.replace(/^equip-/, ""))) ? (
                <button type="button" onClick={() => editAttachedItem(action)}
                  style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #4a4a6e", borderRadius: 3, color: "#9d8cff", cursor: "pointer" }}
                  title="Edit this character's copy — changes stay on this sheet and do not touch the library">
                  Edit
                </button>
              ) : (
                <span style={{ fontSize: 10, padding: "3px 8px", border: "1px solid #333", borderRadius: 3, color: "#666" }}
                  title="Campaign item — yours to carry and use, not to rewrite. Ask the DM for a change.">
                  🔒 campaign
                </span>
              )}
              <button type="button" onClick={() => detachItem(action.id)}
                style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #5a3a1a", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}
                title="Detach from actor — removes the item (stays in library)">
                Detach
              </button>
            </div>
            );
          })
        )}
      </div>
    );
  }

  // ── Create new item view ────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <ItemForm
        initial={editingItem}
        // Three destinations, not two: this actor's own copy, an existing library item, or
        // a brand-new one. editingAttached is what distinguishes the first.
        onSave={editingAttached ? handleSaveAttachedItem : editingItem ? handleSaveLibraryItem : handleCreateItem}
        onCancel={() => { setEditingAttached(null); setEditingItem(undefined); setView("bag"); }}
      />
    );
  }

  // ── Library view ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#888" }}>Equipment Library — click to attach</p>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => { setEditingItem(undefined); setView("create"); }}
            style={{ fontSize: 11, padding: "3px 10px", background: "#7b68ee", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
            + New Item
          </button>
          <button type="button" onClick={() => setView("bag")}
            style={{ fontSize: 11, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 3, color: "#888", cursor: "pointer" }}>
            ← Bag
          </button>
        </div>
      </div>

      {/* FIND, don't scroll. The library is 60+ items and grows every session; hunting for
          one by eye — and then hunting for it AGAIN after editing it — was the whole cost of
          attaching anything. The query survives an edit (it lives above this view), so you
          come back to the same short list you left. */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
        <input
          type="text"
          value={librarySearch}
          onChange={e => setLibrarySearch(e.target.value)}
          placeholder="Search name, type, category, tag…"
          style={{ flex: 1, fontSize: 12, padding: "5px 8px", background: "#0d0d14", border: "1px solid #2a2a3e", borderRadius: 4, color: "#fff" }}
        />
        <select
          value={libraryTypeFilter}
          onChange={e => setLibraryTypeFilter(e.target.value)}
          style={{ fontSize: 11, padding: "5px 6px", background: "#0d0d14", border: "1px solid #2a2a3e", borderRadius: 4, color: "#aaa" }}
        >
          <option value="">All types</option>
          {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(librarySearch || libraryTypeFilter) && (
          <button type="button" onClick={() => { setLibrarySearch(""); setLibraryTypeFilter(""); }}
            title="Clear search and filter"
            style={{ fontSize: 11, padding: "5px 8px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#888", cursor: "pointer" }}>
            ✕
          </button>
        )}
      </div>
      {(librarySearch || libraryTypeFilter) && (
        <p style={{ margin: 0, fontSize: 10, color: "#555" }}>
          {visibleLibrary.length} of {library.length} shown
        </p>
      )}

      {library.length === 0 ? (
        <p style={{ fontSize: 11, color: "#444", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          No items in library. Create one with + New Item.
        </p>
      ) : visibleLibrary.length === 0 ? (
        <p style={{ fontSize: 11, color: "#444", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
          Nothing matches “{librarySearch}”{libraryTypeFilter ? ` in ${libraryTypeFilter}` : ""}.
        </p>
      ) : (
        visibleLibrary.map(item => {
          const isEquipped = equippedIds.has(item.id);
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: isEquipped ? "#1a2a1a" : "#161622", borderRadius: 8, border: `1px solid ${isEquipped ? "#2a6e2a44" : "#2a2a3e"}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                  <span style={{ fontSize: 10, color: "#555", background: "#2a2a2a", padding: "1px 6px", borderRadius: 10 }}>{item.type}</span>
                  {isEquipped && <span style={{ fontSize: 10, color: "#4caf50" }}>● Equipped</span>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  {item.attack && <span style={{ fontSize: 11, color: "#7b68ee" }}>⚔ {item.attack}</span>}
                  {item.damage && <span style={{ fontSize: 11, color: "#e07b39" }}>💥 {item.damage}</span>}
                  {item.description && <span style={{ fontSize: 11, color: "#555" }}>{item.description.slice(0, 50)}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {!isEquipped ? (
                  <button type="button" onClick={() => { attachItem(item); setView("bag"); }}
                    style={{ fontSize: 11, padding: "3px 8px", background: "#2a6e2a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
                    Attach
                  </button>
                ) : (
                  <button type="button" onClick={() => { detachItem(`equip-${item.id}`); }}
                    style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #5a3a1a", borderRadius: 3, color: "#e07b39", cursor: "pointer" }}>
                    Detach
                  </button>
                )}
                {canEditItem(item) && (
                  <button type="button" onClick={() => { setEditingItem(item); setView("create"); }}
                    style={{ fontSize: 11, padding: "3px 8px", background: "#7b68ee22", border: "1px solid #7b68ee44", borderRadius: 3, color: "#7b68ee", cursor: "pointer" }}>
                    Edit
                  </button>
                )}
                <button type="button" onClick={() => removeFromLibrary(item.id)}
                  style={{ fontSize: 11, padding: "3px 6px", background: "transparent", border: "1px solid #5a1a1a", borderRadius: 3, color: "#ff9999", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
