/**
 * LOOT REACHES THE CHARACTER, AND ARRIVES AS THE THING THAT WAS SENT.
 *   npm run check:loot
 *
 * Five faults, one thread. Christopher, 2026-10-08: *"the loot to seat still isnt working as well
 * as i dont have a way to give the gift in the chassis it appear in"*, and the chosen form
 * *"reverts before save, and it also reverts after the save."*
 *
 * ⚠ THE COMMON SHAPE IS RE-RESOLVING AN ITEM BY ID FROM THE LIBRARY. A chassis Gift is a SHAPE in
 * the library and a specific weapon on the character; every path that threw away the copy in hand
 * and looked the id up again replaced the shaped item with its blank template. Three different
 * places did it, and a fourth did it to the character's whole row on a timer.
 */
import type { OpenLootOffer } from "../src/core/ui/openLootOffer";
import { itemToAction, itemToAttackAction, resolveChassisItem, type EquipmentItem } from "../src/core/ui/EquipmentBagEditor";
import { readFileSync } from "node:fs";

/**
 * ⚠ LOADED DYNAMICALLY, AFTER A BROWSER STUB. `openLootOffer` reaches the Owlbear SDK, which
 * touches `window` at import time and would crash this script on its first line — the same reason
 * check:seattransport imports its seat modules as types only. But `offeredItem` is the one
 * function this gate most needs to exercise for real, so the globals are stubbed and the module is
 * pulled in by hand rather than being reduced to a source-text assertion.
 */
(globalThis as unknown as Record<string, unknown>).window = {
  location: { search: "" }, addEventListener() {}, removeEventListener() {},
};
const { offeredItem } = await import("../src/core/ui/openLootOffer");

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const bag = readFileSync("src/core/ui/EquipmentBagEditor.tsx", "utf8");
const panel = readFileSync("src/dm-panel.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const lib = readFileSync("src/core/ui/EquipmentLibraryStandalone.tsx", "utf8");

/** A Gift as the library holds it: a shape, no form, no dice. */
const template = {
  id: "gift-oakheart", name: "Gift of Oakheart", type: "weapon", description: "A living branch.",
  isUsable: true, attunementRequired: true, grantsProficiency: true, mechanicsText: "+2 and 1d6.",
  chassisBonus: 2, pbToDamage: true, chassisBonusDice: "1d6",
  chassis: { categories: [], requireTags: [], formIds: ["base-handaxe", "base-scimitar"] },
} as unknown as EquipmentItem;
/** The same Gift after the DM picks a weapon at hand-over. */
const shaped = { ...template, chassis: { ...(template.chassis as object), formId: "base-handaxe" } } as EquipmentItem;

console.log("Loot reaches the character\n");

console.log("1. the offered copy outranks the library");
{
  const offer = { offeredItems: [shaped] } as Pick<OpenLootOffer, "offeredItems">;
  const catalogue = [template];
  const got = offeredItem(offer, "gift-oakheart", catalogue);
  ok("the SENT copy is returned, not the template", got?.chassis?.formId === "base-handaxe");
  /**
   * ⚠ THE WHOLE BUG, IN ONE ASSERT. The claim handler and every re-broadcast used to read the
   * catalogue by id, so the DM's pick was displayed to the player and then discarded at the
   * moment it became equipment.
   */
  ok("...and the catalogue's template is NOT what lands",
    offeredItem(offer, "gift-oakheart", catalogue)?.chassis?.formId !== undefined);
  ok("an offer with no stored copies falls back to the catalogue",
    offeredItem({ offeredItems: undefined }, "gift-oakheart", catalogue)?.id === "gift-oakheart");
  ok("an unknown id resolves to nothing", offeredItem(offer, "nope", catalogue) === undefined);
}

console.log("\n2. a shaped Gift is a real weapon");
{
  const r = resolveChassisItem(shaped);
  ok("it has dice once formed", Boolean(r.attack && r.damage), `${r.attack} / ${r.damage}`);
  ok("it takes the base weapon's mastery", r.mastery === "Vex");
  /** The template has none — which is why a blank one arrives unusable. */
  ok("the UNFORMED template has no dice at all", !resolveChassisItem(template).attack);

  const atk = itemToAttackAction(shaped);
  ok("its attack row carries the composed dice", Boolean(atk.metadata?.attack && atk.metadata?.damage));
}

console.log("\n3. the item round-trip keeps what the Gift IS");
{
  const m = (itemToAction(shaped, false).metadata ?? {}) as Record<string, unknown>;
  /**
   * ⚠ NEVER WRITTEN, SO ALWAYS LOST. Every v14 Gift grants proficiency — *"While attuned to the
   * weapon, you are proficient with it"* — and the grant died the instant the item was attached.
   */
  ok("grantsProficiency survives attach", m.grantsProficiency === true);
  ok("mechanicsText survives attach", typeof m.mechanicsText === "string" && m.mechanicsText.length > 0);
  ok("the chosen form survives attach", (m.chassis as { formId?: string })?.formId === "base-handaxe");
  ok("the authored form LIST survives too", ((m.chassis as { formIds?: string[] })?.formIds ?? []).length === 2);

  ok("saveDc is read back by actionToItem", /saveDc: m\.saveDc/.test(bag));
  ok("grantsProficiency is read back", /grantsProficiency: m\.grantsProficiency/.test(bag));
  ok("mechanicsText is read back", /mechanicsText: m\.mechanicsText/.test(bag));
}

console.log("\n4. the bag editor's mount migration PATCHES, never replaces");
{
  /**
   * ⚠ THE REVERT. The migration read staleness as `statEffects === undefined` — true forever for
   * any weapon, since `bakeStatEffects` returns undefined when there is nothing to bake — and
   * then REPLACED the character's row with `itemToAction(libraryItem)`. So every visit to the
   * Equipment tab overwrote the shaped Gift with the blank template, before any save.
   */
  const weaponRow = itemToAction(shaped, true);
  ok("a weapon's row legitimately has no statEffects", weaponRow.metadata?.statEffects === undefined);
  ok("...so the old sentinel would have fired forever on it", true, "which is why it never settled");

  ok("staleness now asks whether the LIBRARY has something to give",
    /staleStatEffects\s*=\s*[\s\S]{0,120}fresh\.metadata\?\.statEffects !== undefined/.test(bag));
  ok("the row is patched, not replaced", bag.includes("PATCH, never replace")
    && /if \(!needsRefresh\) return a;/.test(bag));
  ok("...and `return needsRefresh ? fresh : a` is GONE", !/return needsRefresh \? fresh : a;/.test(bag));
  ok("the attack row is rebuilt from the CHARACTER's row, not the library item",
    /const own = actionToItem\(a, itemId\);/.test(bag) && /itemToAttackAction\(own\)/.test(bag));
}

console.log("\n5. a delivery that cannot land says so");
{
  /**
   * ⚠ `seats[seatId]` IS THE LOCAL CONFIG. A claimed seat can live only in room live state —
   * `pushActorsToSeat` has always fallen back to it. These handlers did not, so the attach block
   * was skipped in silence while the player was still told the item had arrived.
   */
  ok("the seat falls back to room live state",
    /seats\[seatId\] \?\? roomLiveState\.seats\?\.\[seatId\]/.test(panel));
  ok("the actor is RESOLVED, not read raw from the base library",
    /resolveSeatTarget[\s\S]{0,400}resolveActorFromLibrary\(actorId, actorLibrary, actorOverrides, roomLiveState\)/.test(panel));
  ok("...and the raw base read is gone from the loot handlers",
    !/const actor = actorId \? actorLibrary\[actorId\] : undefined;/.test(panel));
  ok("a failure is returned rather than swallowed", panel.includes("function deliveryTargetProblem"));
  ok("...and the Library shows it instead of reporting success",
    lib.includes("setDeliveryProblem(problem)"));
}

console.log("\n6. the claim attaches the offered copy AND its attack row");
{
  ok("the claim reads the offered copy", /offeredItem\(loadOpenLootOffer\(\), msg\.chosenItemId, allItems\)/.test(app));
  ok("...and no longer re-resolves from the library",
    !/const item = isPass \? undefined : allItems\.find\(i => i\.id === msg\.chosenItemId\);/.test(app));
  /**
   * A weapon is TWO rows. This path wrote only the bag row, so loot won from an offer could be
   * carried and equipped and never swung.
   */
  ok("a claimed weapon gets its attack row", /itemToAttackAction\(item\)/.test(app)
    && /equipment: \[\.\.\.\(actor\.tabs\.equipment \?\? \[\]\), equipAction\], main: newMain/.test(app));
  ok("the sent pool stores the copies, not just ids", lib.includes("offeredItems: opts.items"));
  ok("...and re-broadcasts read them", readFileSync("src/core/ui/openLootOffer.ts", "utf8")
    .includes("offeredItem(offer, id, catalogue)"));
}

console.log("\n7. the single-item send asks a template which weapon it is");
{
  ok("the send dialog offers the forms", /matchingForms\(lootTarget\.item\.chassis\)/.test(lib));
  ok("...and refuses to send a template with no form",
    /disabled=\{Boolean\(lootTarget\.item\.chassis && !lootTarget\.item\.chassis\.formId\)\}/.test(lib));
  ok("a shaped copy can be filed in the campaign library", lib.includes("function formedCampaignCopy"));
  /**
   * ⚠ BESIDE THE TEMPLATE, NEVER OVER IT — the generic entry has to survive so the next character
   * can take the same Gift as something else.
   */
  ok("...under its OWN id, so the template survives", /id: `\$\{item\.id\}--\$\{formId\}`/.test(lib));
  ok("...and the campaign library is MERGED, not re-seeded",
    /loadEquipmentLibrary\("campaign"\)\.filter\(i => i\.id !== copy\.id\)/.test(lib));
}

console.log("\n8. there is a WAY IN to loot distribution");
{
  /**
   * ⚠ SENDING EXISTED ONLY AS A PER-ROW BUTTON, which meant the DM had to already know which
   * group an item was filed under and expand it before any send control appeared at all.
   * Christopher, 2026-10-09: *"there isnt a way to open a loot panel for loot distribution."*
   */
  ok("the toolbar has a Send Loot button", panel.includes("🎁 Send Loot")
    && /setEquipSendSignal\(s => s \+ 1\)/.test(panel));
  ok("...and it reaches the library panel", /sendSignal=\{equipSendSignal\}/.test(panel));
  ok("the library opens its send picker on that signal",
    /if \(!sendSignal\) return;[\s\S]{0,60}setSendPicker/.test(lib));
  ok("the picker searches BOTH libraries", /loadEquipmentLibrary\("dm"\), \.\.\.loadEquipmentLibrary\("campaign"\)/.test(lib));
  /**
   * It hands over to the EXISTING send dialog rather than duplicating it, so a template picked
   * here goes through the same form question and the same refusal reporting.
   */
  ok("...and hands over to the one send dialog", /setLootTarget\(\{ item, seatId: seats\[0\]\?\.seatId \?\? "" \}\); setSendPicker\(null\);/.test(lib));
  ok("a template is flagged in the results list", lib.includes("template · picks a form"));
  ok("no seats is said up front, not after choosing", lib.includes("No player seats yet"));
}

console.log("\n9. campaign loot is read-only without author mode");
{
  ok("the unlock control is gated on author mode", /authorOn \? \(/.test(lib) && lib.includes("isAuthorMode"));
  ok("a locked item still READS, it just cannot be rewritten", lib.includes("Campaign item — read-only"));
  /**
   * ⚠ A DETACHED CAMPAIGN ITEM USED TO SHADOW ITS OWN TEMPLATE. `upsertItem` writes a DM entry
   * under the SAME id and DM items outrank campaign items — so banking a shaped Gift rewrote the
   * generic one for every future character.
   */
  ok("a detached campaign item banks under its own id", /id: `\$\{itemId\}--own-\$\{form\?\.id \?\? "copy"\}`/.test(bag));
  ok("...so the campaign row is left as authored", bag.includes("IT USED TO\n         * OVERWRITE THE CAMPAIGN ENTRY")
    || bag.includes("OVERWRITE THE CAMPAIGN ENTRY FOR THE WHOLE TABLE"));
}

console.log(failures === 0
  ? "\nOK — loot lands, as the thing that was sent, and stays that way"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
