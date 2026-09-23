/**
 * THE FOCUS GIFTS ARE CORRECT IN THE APP — the data, the binding, the card, and the retired caches.
 *   npx tsx scripts/check-gift-focus.ts
 *
 * Christopher, 2026-09-16: *"any time a weapon or focus effects a attack or spell it should add that +1/+2/+3,
 * to any action that uses it. so a spell focus at +2 would add +2 to the attack, +2 to the damage, +2 to the
 * spell dc"* · *"this is built … check the gifts because it was already built"* · *"use version 11 and ensure
 * that the 2 spell focus gifts are correct in the app"* · *"there is no act 1 field ward, or a act 2 ward cache."*
 *
 * What was wrong, each a check below:
 *   1  a layer could not REMOVE a field, so Duskthorn kept the chassis the author export states
 *   2  v11's +1d6 on every Gift hit had nowhere to live
 *   3  the weapon binding the editor saved (0.7.24) was dropped by `itemToAction` — no sheet ever held one
 *   4  nothing on the card read a binding, a Magic action, or a charm's mode
 *   5  a healing spell never met its focus
 *   6  retired items came back on every seed
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeAuthored, withoutClears } from "../src/data/broken-chain/mergeAuthored";
/**
 * ⚠ ITEMS ARE READ FROM THE DOCUMENT VIEW, NOT THE DM'S LIBRARY. The fixtures below are v11's Gifts as v11 prints
 * them; the DM may rename or rebalance any of them in-app, and that must never fail a check (Christopher,
 * 2026-09-21: *"everything you changed blocks me from making changes"*). `PUBLISHED` — the live library — is read
 * only for what the code guarantees whatever the DM authors: no null ships, no retired item ships.
 */
import {
  CAMPAIGN_DOCUMENT_EQUIPMENT as LIB, BROKEN_CHAIN_EQUIPMENT_LIBRARY as PUBLISHED, RETIRED_EQUIPMENT_IDS,
} from "../src/data/broken-chain/equipmentLibrary";
import { AUTHORED_EQUIPMENT } from "../src/data/broken-chain/authored.generated";
import {
  itemToAction, itemToAttackAction, resolveChassisItem, seedCampaignEquipmentLibrary, loadEquipmentLibrary, repairItemType,
  saveEquipmentLibrary, type EquipmentItem,
} from "../src/core/ui/EquipmentBagEditor";
import { composeChassisAttack, findForm, regripAttackRow } from "../src/core/constants/chassis";
import {
  boundCharms, charmWeaponFormulas, focusDamageFor, focusIsLive, focusMagicActionDamage, isMagicActionSpell,
  weaponMagicBonus,
} from "../src/core/rules/giftFocus";
import type { ActorAction } from "../src/core/types/tabs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*/gm, "");
const item = (name: string) => {
  const found = LIB.find(i => i.name === name);
  if (!found) throw new Error(`library has no ${name}`);
  return found as EquipmentItem;
};

console.log("The focus Gifts are correct in the app\n");

console.log("1. a layer can remove a field, through both merges");
{
  type Row = { id: string; name: string; chassis?: unknown; revisedAt?: string };
  const base: Row[] = [];
  const revision: Row[] = [{ id: "dusk", name: "Gift of Duskthorn", chassis: null, revisedAt: "2026-09-16T12:41:00.000Z" }];
  const exported: Row[] = [{ id: "dusk", name: "Gift of the Last Word", chassis: { requireTags: ["one-handed"] } }];
  const at = { authoredAt: "2026-09-13T20:33:09.740Z" };
  const published = mergeAuthored(mergeAuthored(base, revision, r => r.id), exported, r => r.id, at).map(withoutClears);
  ok("a revision's null clears the chassis an older export still states", published[0] && !("chassis" in published[0]) && published[0].name === "Gift of Duskthorn",
    JSON.stringify(published[0]));
  /** ⚠ MUTATION: the first build stripped the null inside the first merge — and the old chassis came back. */
  const early = mergeAuthored(mergeAuthored(base, revision, r => r.id).map(withoutClears), exported, r => r.id, at).map(withoutClears);
  ok("MUTATION: stripping the null before the last merge lets the old chassis win", Boolean(early[0]?.chassis));
  ok("nothing published carries a null", !PUBLISHED.some(i => Object.values(i).some(v => v === null)));

  /**
   * ⚠ THE DM'S LATER EDIT WINS AT THE TABLE, AND NO CHECK HOLDS IT TO THE DOCUMENT.
   *
   * Christopher, 2026-09-21: *"you have been … writting them to a seed that i can never change and when i publish
   * something everything you changed blocks me from making changes."* Both halves are the same rule: an export
   * NEWER than the revision is the DM's word (the live library), and the document checks read the revision as
   * published (the export treated as older), so an edit the DM makes can never turn a document check red.
   */
  const doc: Row[] = [{ id: "rimeguard", name: "Rimeguard (Medium)", chassis: "15 + DEX", revisedAt: "2026-09-16T12:41:00.000Z" }];
  const theirEdit: Row[] = [{ id: "rimeguard", name: "Rimeguard (Medium)", chassis: "16 + DEX" }];
  ok("an export published AFTER the revision wins at the table",
    mergeAuthored(doc, theirEdit, r => r.id, { authoredAt: "2026-09-21T19:12:53.028Z" })[0].chassis === "16 + DEX");
  ok("...while the document view still reads the revision, so the DM's edit fails no document check",
    mergeAuthored(doc, theirEdit, r => r.id, { authoredAt: "1970-01-01T00:00:00.000Z" })[0].chassis === "15 + DEX");
  const lib = codeOf("src/data/broken-chain/equipmentLibrary.ts");
  ok("CAMPAIGN_DOCUMENT_EQUIPMENT is built that way", lib.includes('{ authoredAt: "1970-01-01T00:00:00.000Z" }'));
  ok("...and the document gates read it, not the live library",
    ["scripts/check-convergence-tags.ts", "scripts/check-gift-focus.ts"].every(f => codeOf(f).includes("CAMPAIGN_DOCUMENT_EQUIPMENT as LIB")));

  const generated = codeOf("src/data/broken-chain/authored.generated.ts");
  const template = codeOf("scripts/fold-authoring.mjs");
  ok("the merge has ONE copy — the generated file and the fold template re-export it",
    generated.includes('export { mergeAuthored } from "./mergeAuthored";') && !generated.includes("export function mergeAuthored")
    && template.includes('export { mergeAuthored } from "./mergeAuthored";') && !template.includes("export function mergeAuthored"));
}

console.log("\n2. every weapon Gift adds 1d6 on a hit, and a crit doubles it");
{
  const staff = findForm("base-quarterstaff")!;
  const one = composeChassisAttack(staff, "1h", 2, true, "1d6");
  ok("damage carries the form's die, the extra die, the ability, +2 and PB", one.damage === "1d6+1d6+@STR+2+@PROF", one.damage);
  ok("...and a critical doubles both dice, not the +2 or PB", one.crit === "2d6+2d6+@STR+2+@PROF", one.crit);
  const two = composeChassisAttack(staff, "2h", 2, true, "1d6");
  ok("two-handed, the versatile die grows and the extra die stays", two.damage === "1d8+1d6+@STR+2+@PROF", two.damage);
  ok("MUTATION: with no extra dice there is no 1d6", composeChassisAttack(staff, "1h", 2, true).damage === "1d6+@STR+2+@PROF");

  const firstLight = resolveChassisItem(item("Gift of First Light"));
  ok("Gift of First Light resolves to a Quarterstaff that rolls it", firstLight.damage === "1d6+1d6+@STR+2+@PROF", String(firstLight.damage));

  /**
   * ⚠ THE GRIP SWITCH NEVER REACHED THE ROLL. First Light is a two-handed focus; in both hands the Quarterstaff is
   * a d8. The switch wrote `grip` on the equipment row and the attack row kept the dice it was attached with.
   */
  const attackRow = itemToAttackAction(item("Gift of First Light"));
  const equipRow = itemToAction(item("Gift of First Light"), true);
  const twoHanded = regripAttackRow(attackRow, equipRow.metadata ?? {}, "2h");
  ok("taking First Light in both hands re-rolls its attack row on the d8", twoHanded.metadata?.damage === "1d8+1d6+@STR+2+@PROF"
    && twoHanded.metadata?.crit === "2d8+2d6+@STR+2+@PROF", `${twoHanded.metadata?.damage} / ${twoHanded.metadata?.crit}`);
  ok("MUTATION: the row as attached is still the one-handed d6", attackRow.metadata?.damage === "1d6+1d6+@STR+2+@PROF");
  const app = codeOf("src/App.tsx");
  ok("the DM's grip change recomposes the attack row", app.includes("regripAttackRow(a, target.metadata ?? {}, grip)")
    && app.includes("main: regripped(actor.tabs.main)"));
}

console.log("\n3. a binding reaches the character, and comes back from the editor");
{
  const dusk = item("Gift of Duskthorn");
  const row = itemToAction({ ...dusk, bindsToItemId: "tbc-frostedge" }, true);
  const m = row.metadata!;
  ok("itemToAction carries the binding", m.bindsToItemId === "tbc-frostedge", String(m.bindsToItemId));
  ok("...and what the charm gives its weapon",
    m.attachesToWeapon === true && m.boundWeaponBonus === 2 && m.boundWeaponHitDamage === "1d6+@PROF"
    && m.weaponOrSpellChoice === true && m.spellFocusMagicActionDamage === "1d6+@PROF",
    JSON.stringify({ a: m.attachesToWeapon, b: m.boundWeaponBonus, h: m.boundWeaponHitDamage, c: m.weaponOrSpellChoice, s: m.spellFocusMagicActionDamage }));
  ok("...and the Gift's extra die", itemToAction(item("Gift of Oakheart"), true).metadata?.chassisBonusDice === "1d6");
  const editor = codeOf("src/core/ui/EquipmentBagEditor.tsx");
  const home = editor.slice(editor.indexOf("function actionToItem"), editor.indexOf("function detachItem"));
  ok("actionToItem brings every one of them home — opening the editor must not unbind the charm",
    ["bindsToItemId: m.bindsToItemId", "attachesToWeapon: m.attachesToWeapon", "boundWeaponBonus: m.boundWeaponBonus",
      "boundWeaponHitDamage: m.boundWeaponHitDamage", "weaponOrSpellChoice: m.weaponOrSpellChoice",
      "spellFocusMagicActionDamage: m.spellFocusMagicActionDamage", "chassisBonusDice: m.chassisBonusDice"].every(s => home.includes(s)));
}

console.log("\n4. the rules the card applies");
{
  const spell = (over: Partial<ActorAction> & { metadata?: ActorAction["metadata"] }) =>
    ({ id: "s", label: "Spell", actionKind: "spell", ...over } as ActorAction);
  ok("an action-cast spell takes the Magic action", isMagicActionSpell(spell({ metadata: { castingTimeType: "action" } })));
  ok("...a bonus-action spell does not", !isMagicActionSpell(spell({ metadata: { castingTimeType: "bonus" } })));
  ok("...nor a reaction spell by its slot", !isMagicActionSpell(spell({ economyCost: ["reaction"] })));
  ok("...a spell authored only with the main slot does", isMagicActionSpell(spell({ economyCost: ["main"] })));
  ok("...and a weapon attack is not a spell at all", !isMagicActionSpell({ id: "a", label: "Sword", actionKind: "attack", economyCost: ["main"] } as ActorAction));

  ok("a weapon's own bonus is read off its attack line", weaponMagicBonus("1d20+@PROF+@STR+1") === 1 && weaponMagicBonus("1d20+@PROF+@DEX") === 0
    && weaponMagicBonus("1d20+@PROF+@STR+2") === 2);

  // A character carrying Frostedge (+1) with Duskthorn fastened to it.
  const frostedge = item("Frostedge");
  const sheet = (opts: { weaponEquipped?: boolean; bound?: string; weapon?: EquipmentItem } = {}) => {
    const weapon = opts.weapon ?? frostedge;
    return {
      equipment: [
        itemToAction(weapon, opts.weaponEquipped ?? true),
        itemToAction({ ...item("Gift of Duskthorn"), bindsToItemId: opts.bound ?? weapon.id }, true),
      ],
      main: [itemToAttackAction(weapon)],
    };
  };
  const [charm] = boundCharms(sheet());
  ok("Duskthorn bound to an equipped Frostedge is a live charm on Frostedge's attack",
    Boolean(charm) && charm.weaponAttackActionId === "atk-tbc-frostedge" && charm.choosesMode, JSON.stringify(charm));
  ok("...adding +1, because Frostedge is already +1 — the HIGHER bonus, not both", charm?.bonusDelta === 1, String(charm?.bonusDelta));
  // A mundane longsword straight from the base weapon table — the library's copy comes from the author export.
  const longsword = findForm("base-longsword")!;
  const mundane = { id: longsword.id, name: longsword.name, type: "weapon", description: "", isUsable: true,
    attack: longsword.attack, damage: longsword.damage, category: longsword.category } as EquipmentItem;
  ok("...+2 on a mundane longsword", boundCharms(sheet({ weapon: mundane }))[0]?.bonusDelta === 2);
  ok("...nothing on a stowed weapon", boundCharms(sheet({ weaponEquipped: false })).length === 0);
  ok("...nothing when bound to a weapon the character does not carry", boundCharms(sheet({ bound: "tbc-coldshot" })).length === 0);

  const thorn = charmWeaponFormulas(charm, "weapon");
  const spellMode = charmWeaponFormulas(charm, "spell");
  ok("Thorn: +1 to hit, +1 and 1d6 + PB to damage", thorn.attack === "+1" && thorn.damage === "+1+1d6+@PROF", JSON.stringify(thorn));
  ok("Spell: the weapon keeps its +1 and loses the Thorn dice", spellMode.attack === "+1" && spellMode.damage === "+1", JSON.stringify(spellMode));

  const duskRow = sheet().equipment[1];
  const firstLightRow = itemToAction(item("Gift of First Light"), true);
  ok("the charm is a focus only through its bound, equipped weapon",
    focusIsLive(duskRow, sheet()) && !focusIsLive(duskRow, sheet({ weaponEquipped: false })));
  ok("...a staff is a focus on its own", focusIsLive(firstLightRow, { equipment: [firstLightRow] }));
  ok("Duskthorn's Magic-action extra only in Spell — never both halves on one roll",
    focusMagicActionDamage(duskRow, "spell") === "1d6+@PROF" && focusMagicActionDamage(duskRow, "weapon") === undefined);
  ok("First Light's is always on", focusMagicActionDamage(firstLightRow, "weapon") === "1d6+@PROF");

  const focus = { damage: "+2", magicActionDamage: "1d6+@PROF" };
  ok("a +2 focus on an action-cast spell adds +2 and 1d6 + PB",
    focusDamageFor(focus, spell({ metadata: { castingTimeType: "action" } })) === "+2+1d6+@PROF");
  ok("...on a bonus-action spell, the +2 alone", focusDamageFor(focus, spell({ metadata: { castingTimeType: "bonus" } })) === "+2");
}

console.log("\n5. the card applies them");
{
  const card = codeOf("src/core/ui/ActorCard.tsx");
  ok("a charm is listed as a focus only while its weapon is", card.includes(".filter(a => focusIsLive(a, actor.tabs))"));
  ok("the focus carries its Magic-action extra onto the armed effect", card.includes("magicActionFormula: focus.magicActionDamage"));
  ok("committed spell damage asks focusDamageFor", card.includes("focusDamageFor({ damage: effect.formula, magicActionDamage: effect.magicActionFormula }, entry?.action)"));
  /** ⚠ The path that rolls Cure Wounds. A focus never reached it. */
  ok("a spell that rolls without committing gets its focus too", card.includes("combineRollFormulas([rollFormula, ...focusParts])")
    && card.includes('triggeredAction.actionKind === "spell" && triggeredAction.metadata?.damage'));
  /**
   * ⚠ THE RULE MOVED, SO THE ASSERTION FOLLOWED IT. "Which attacks does this buff ride" now lives in
   * `core/rules/weaponStyles`, because the encounter checker has to answer the same question about a
   * standing fighting style and a second copy of it is exactly the drift this gate guards. The card
   * imports it back, so the two call sites below are still the card's own.
   */
  const styles = codeOf("src/core/rules/weaponStyles.ts");
  ok("a buff that names one weapon rides only that weapon",
    styles.includes("if (appliesToActionId) return action.id === appliesToActionId;")
    && card.includes("buffMatchesAttack(e.appliesTo, entry.action, e.appliesToActionId)")
    && card.includes("buffMatchesAttack(effect.appliesTo, entry?.action, effect.appliesToActionId)"));
  ok("...and the card reads that one rule rather than keeping its own",
    card.includes('styleRidesAction as buffMatchesAttack') && card.includes('from "../rules/weaponStyles"')
    && !card.includes("function buffMatchesAttack"));
  ok("a bound charm arms itself on its weapon's attack row", card.includes("appliesToActionId: charm.weaponAttackActionId"));
  ok("...and the wielder switches Thorn / Spell on the card", card.includes("onClick={() => armCharm(charm, option)}"));
}

console.log("\n6. a DM can author all of it");
{
  const chassis = codeOf("src/core/ui/ChassisFields.tsx");
  const mechanics = codeOf("src/core/ui/ItemMechanicsFields.tsx");
  ok("the extra die on the chassis block", chassis.includes('set("chassisBonusDice"'));
  ok("the charm fields", ["attachesToWeapon", "boundWeaponBonus", "boundWeaponHitDamage", "weaponOrSpellChoice"].every(f => chassis.includes(`set("${f}"`)));
  ok("the Magic-action extra on the focus block", mechanics.includes('set("spellFocusMagicActionDamage"'));
}

console.log("\n7. a retired item stays retired");
{
  /**
   * The author export carried the Hollow Pack Ward Token when this was written, and the fold keeps any item a new
   * payload does not mention — so it may carry it for good, or a later publish may drop it. The check must not
   * depend on which: a stand-in with the retired id is the same case.
   */
  const cache = (AUTHORED_EQUIPMENT.find(i => i.id === "tbc-hollow-pack-ward-token")
    ?? { id: "tbc-hollow-pack-ward-token", name: "Hollow Pack Ward Token", type: "magic", description: "", isUsable: true }) as EquipmentItem;
  ok("the published library does not carry a retired item the export still holds",
    !PUBLISHED.some(i => i.id === "tbc-hollow-pack-ward-token"));
  ok("the Act 1 Ward Field pool is retired", ["bc-sentrys-knot", "bc-unspent-mark"].every(id => RETIRED_EQUIPMENT_IDS.includes(id)));

  // A browser that already holds cache items in both stores, seeded with a list that still names one.
  saveEquipmentLibrary([cache, ...PUBLISHED.slice(0, 3)], "campaign");
  saveEquipmentLibrary([{ ...cache, name: "Hollow Pack Ward Token (unlocked)" }], "dm");
  seedCampaignEquipmentLibrary([...PUBLISHED, cache], RETIRED_EQUIPMENT_IDS);
  const all = [...loadEquipmentLibrary("campaign"), ...loadEquipmentLibrary("dm")];
  ok("a seed handed a retired item does not write it back", !all.some(i => i.id === "tbc-hollow-pack-ward-token"),
    all.filter(i => i.id === "tbc-hollow-pack-ward-token").map(i => i.name).join(", "));
}

console.log("\n8. publishing does not undo the revision");
{
  /**
   * Christopher, 2026-09-21: *"wont i be rewriting the item you changed since the author publish has been sending old
   * items with it."* Replaying his publish found two ways it could, and neither was his payload being old:
   *   · Duskthorn's removed chassis came back from the PREVIOUS fold, because the fold keeps what a payload omits
   *   · Rimeguard's shared adaptive text ("17 for Heavy armor, 15 … Medium armor, or 13 … Light armor") made the
   *     browser type all three rows heavy, and the publish carried that
   */
  const adaptive = repairItemType({ id: "r", name: "Rimeguard (Medium)", type: "armor", description: "",
    mechanicsText: "Your base Armor Class is 17 for Heavy armor, 15 plus your Dexterity modifier for Medium armor, or 13 plus your Dexterity modifier for Light armor.",
    isUsable: false, ac: "15 + DEX (max 2)" } as EquipmentItem);
  ok("text naming more than one armour weight states none — Rimeguard is not read as heavy", adaptive.armorType === undefined, String(adaptive.armorType));
  ok("...text naming one still does", repairItemType({ id: "c", name: "Chain Mail", type: "armor", description: "Heavy armor. AC 16.", isUsable: false, ac: "16" } as EquipmentItem).armorType === "heavy");
  ok("each Rimeguard row states its own weight",
    ["heavy", "medium", "light"].every(w => LIB.find(i => i.id === `tbc-rimeguard-${w}`)?.armorType === w));
  const fold = codeOf("scripts/fold-authoring.mjs");
  ok("the fold keeps a revision's cleared field cleared unless the payload states it",
    fold.includes("const foldedEquipment = applyRevisionClears(")
    && fold.includes("(stated[k] === undefined || stated[k] === null)"));
  ok("...reading the current revision file", fold.includes('for (const name of ["lootV11.ts"])'));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
