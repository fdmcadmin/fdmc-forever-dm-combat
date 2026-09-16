/**
 * EVERY CONVERGENCE ITEM SAYS WHERE IT CAME FROM, AND THE LABEL SURVIVES THE TRIP.
 *   npx tsx scripts/check-convergence-tags.ts
 *
 * Christopher, 2026-09-11: *"i want to add the A1-A4 back onto the convergence input items and then
 * the T1-T4 back onto the output items, this will help player to determine where they got those
 * items as well as … because with the system that seems to be the biggest limitation of getting
 * players to understand convergence."*
 *
 * ⚠ THE INPUTS NEVER LOST THEIR LABEL — THE APP LOST IT IN TRANSIT. All 33 have carried `actLabel`
 * since 0.7.1.0. `itemToAction` copied role and mechanicalTag only, so the moment a component was
 * attached to a character its provenance was gone; the chip then showed what it DID and never
 * where it came from, which is the half a recipe actually needs.
 *
 * So this gate asserts the whole road, not the data: labelled in the library, carried onto the
 * action, carried home by `actionToItem`, and printed on the chip.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BROKEN_CHAIN_EQUIPMENT_LIBRARY as LIB } from "../src/data/broken-chain/equipmentLibrary";
import { mergeAuthored } from "../src/data/broken-chain/authored.generated";
import { itemToAction, type EquipmentItem } from "../src/core/ui/EquipmentBagEditor";
import { LOOT_V9_ITEMS } from "../src/data/broken-chain/lootV9";
import { matchingForms } from "../src/core/constants/chassis";
import { BASE_WEAPONS } from "../src/core/constants/baseWeapons";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const codeOf = (p: string) => readFileSync(resolve(ROOT, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

type Conv = { role?: string; mechanicalTag?: string; actLabel?: string; tier?: string };
const conv = LIB.filter(i => (i as unknown as { convergence?: Conv }).convergence);
const convOf = (i: unknown) => (i as { convergence?: Conv }).convergence!;

console.log("Every convergence item says where it came from\n");

console.log("1. the library labels all of them");
{
  const inputs = conv.filter(i => convOf(i).role === "input");
  const outputs = conv.filter(i => convOf(i).role === "output");
  ok("33 inputs", inputs.length === 33, String(inputs.length));
  ok("40 outputs", outputs.length === 40, String(outputs.length));

  const unlabelledIn = inputs.filter(i => !/^A[1-4]$/.test(convOf(i).actLabel ?? ""));
  ok("every input carries A1-A4", unlabelledIn.length === 0,
    unlabelledIn.map(i => i.name).join(", "));

  const unlabelledOut = outputs.filter(i => !/^T[1-4]$/.test(convOf(i).tier ?? ""));
  ok("every output carries T1-T4", unlabelledOut.length === 0,
    unlabelledOut.map(i => i.name).join(", "));

  /**
   * ⚠ THE COUNTS ARE THE DOCUMENT'S, NOT A SHAPE TEST. v6 states six Tier 1, ten Tier 2 ("Tier 2
   * catalog complete: ten outputs") and eight Tier 4 Singulars. A tier that drifts by one is a
   * transcription error, and only a count catches it.
   */
  const tier = (t: string) => outputs.filter(i => convOf(i).tier === t).length;
  ok("six Tier 1", tier("T1") === 6, String(tier("T1")));
  ok("ten Tier 2 — the document calls this catalog complete", tier("T2") === 10, String(tier("T2")));
  ok("eight Tier 4 Singulars", tier("T4") === 8, String(tier("T4")));
  /** ⚠ TIER 3 ARRIVED WITH v6 — sixteen outputs the app had never built. See data/broken-chain/lootV9.ts. */
  ok("sixteen Tier 3", tier("T3") === 16, String(tier("T3")));

  const acts = (a: string) => conv.filter(i => convOf(i).actLabel === a).length;
  ok("inputs across all four acts", [acts("A1"), acts("A2"), acts("A3"), acts("A4")].every(n => n > 0),
    `A1=${acts("A1")} A2=${acts("A2")} A3=${acts("A3")} A4=${acts("A4")}`);
}

console.log("\n1b. the revision, as the document states it");
{
  /**
   * Christopher, 2026-09-15: *"do a update on the items for the convergence input output for act 1- act 3
   * and the gifts."* The document is the source of truth; these are ITS counts and ITS rules, not a shape
   * test — a tier that drifts by one, or a recipe that misfires, is a transcription error.
   */
  const outputs = conv.filter(i => convOf(i).role === "output");
  const t3 = outputs.filter(i => convOf(i).tier === "T3");
  const completedOf = (i: { description?: string }) => (String(i.description ?? "").match(/Completed: (\w+)/) || [])[1];

  /** v6 "Completed identity counts": T3 reverses the early emphasis. */
  const t3By = (tag: string) => t3.filter(i => completedOf(i) === tag).length;
  ok("Tier 3 gives Utility, Offensive, Tactical and Continuity three each",
    ["Utility", "Offensive", "Tactical", "Continuity"].every(t => t3By(t) === 3),
    ["Utility", "Offensive", "Tactical", "Continuity"].map(t => `${t} ${t3By(t)}`).join(", "));
  ok("...and Movement, Defense, Stability and Cleanse one each",
    ["Movement", "Defense", "Stability", "Cleanse"].every(t => t3By(t) === 1),
    ["Movement", "Defense", "Stability", "Cleanse"].map(t => `${t} ${t3By(t)}`).join(", "));
  ok("eight Tier 3 items are attuned — the six passives and the two Utility reserves",
    t3.filter(i => (i as { attunementRequired?: boolean }).attunementRequired).length === 8,
    String(t3.filter(i => (i as { attunementRequired?: boolean }).attunementRequired).length));

  /**
   * v6's compatibility matrix. Yes = the tags resonate; T3 = reserved for a Tier 3 output; absent = misfire.
   * Same-tag Convergence is not used, so no pair may repeat a tag.
   */
  const YES: Record<string, string[]> = {
    Movement: ["Utility", "Defense", "Stability", "Offensive", "Tactical"],
    Utility: ["Movement", "Defense", "Stability", "Cleanse", "Continuity"],
    Defense: ["Movement", "Utility", "Stability", "Cleanse", "Continuity"],
    Stability: ["Movement", "Utility", "Defense", "Cleanse", "Continuity"],
    Cleanse: ["Utility", "Defense", "Stability", "Offensive", "Tactical"],
    Offensive: ["Movement", "Cleanse", "Tactical"],
    Tactical: ["Movement", "Cleanse", "Offensive", "Continuity"],
    Continuity: ["Utility", "Defense", "Stability", "Tactical"],
  };
  const T3_ONLY = [["Offensive", "Continuity"], ["Continuity", "Offensive"]];
  const illegal = outputs
    .filter(i => /^T[123]$/.test(convOf(i).tier ?? ""))
    .map(i => ({ name: i.name, tier: convOf(i).tier, pair: (convOf(i).mechanicalTag ?? "").split("+").map(s => s.trim()) }))
    .filter(({ tier, pair }) => {
      if (pair.length !== 2 || pair[0] === pair[1]) return true;
      const reserved = T3_ONLY.some(([a, b]) => a === pair[0] && b === pair[1]);
      if (reserved) return tier !== "T3";
      return !(YES[pair[0]] ?? []).includes(pair[1]);
    });
  ok("every completed output's recipe is a pair the matrix allows", illegal.length === 0,
    illegal.map(i => `${i.name} (${i.pair.join(" + ")})`).join(", "));
  /** ⚠ MUTATION: the matrix has to be able to refuse something. */
  ok("MUTATION: Offensive + Defense misfires, and Offensive + Continuity is Tier 3 only",
    !(YES.Offensive ?? []).includes("Defense") && !(YES.Offensive ?? []).includes("Continuity"));

  /**
   * ⚠ A RENAMED GIFT KEEPS ITS ID. v6 renamed six of the eight and v9 renamed all eight again; an item
   * attached to a character is referenced by id, so a rename that changed one would take the Gift off the
   * character holding it.
   */
  const gifts = LIB.filter(i => /^Gift of /.test(i.name));
  ok("eight Feywild Gifts, all attuned", gifts.length === 8 && gifts.every(g => (g as { attunementRequired?: boolean }).attunementRequired),
    String(gifts.length));
  /** v9's names, each on the id its weapon form has always had. */
  const GIFT_IDS: Record<string, string> = {
    "Gift of Oakheart": "item-mt4owsbd",
    "Gift of Winter's Mercy": "tbc-gift-of-the-last-measure",
    "Gift of Hartseeker": "tbc-gift-of-the-long-watch",
    "Gift of Rimefang": "tbc-gift-of-the-open-hand",
    "Gift of Thornrunner": "tbc-gift-of-the-quiet-step",
    "Gift of Winterwatch": "tbc-gift-of-the-standing-line",
    "Gift of First Light": "tbc-gift-of-the-deep-root",
    "Gift of Duskthorn": "tbc-gift-of-the-turning-season",
  };
  const misplaced = Object.entries(GIFT_IDS).filter(([name, id]) => gifts.find(g => g.name === name)?.id !== id);
  ok("...carrying v9's names, on the ids they already had — a renamed Gift stays attached", misplaced.length === 0,
    misplaced.map(([n]) => n).join(", ") || gifts.map(g => `${g.name}=${g.id}`).join(" · "));
  ok("...each with its signature effect as a rider the player toggles",
    gifts.every(g => ((g as { riders?: Array<{ condition?: string }> }).riders ?? []).some(r => Boolean(r.condition))),
    gifts.filter(g => !((g as { riders?: Array<{ condition?: string }> }).riders ?? []).some(r => r.condition)).map(g => g.name).join(", "));
}

console.log("\n1c. a published revision reaches the table over a stale app snapshot");
{
  /**
   * ⚠ THE REVISION COULD NOT ARRIVE WITHOUT THIS. Every item in the library is also in the author export,
   * which states the same fields, so the field-wise merge handed the table the OLD text. An item that
   * states `revisedAt` beats an export taken before it; an export taken after is the DM's later work.
   */
  type Row = { id: string; name: string; revisedAt?: string };
  const seed: Row[] = [{ id: "x", name: "v6 text", revisedAt: "2026-09-15T00:00:00.000Z" }];
  const snapshot: Row[] = [{ id: "x", name: "old snapshot" }];
  ok("a snapshot older than the revision loses the fields the revision states",
    mergeAuthored(seed, snapshot, i => i.id, { authoredAt: "2026-09-13T20:33:09.740Z" })[0].name === "v6 text");
  ok("...a later export wins again, as it always did",
    mergeAuthored(seed, snapshot, i => i.id, { authoredAt: "2026-09-20T00:00:00.000Z" })[0].name === "old snapshot");
  ok("...and with no date at all nothing changes for anyone else",
    mergeAuthored(seed, snapshot, i => i.id)[0].name === "old snapshot");
  ok("the shipped library reads the revision: Rootfast Loop is the Stability rescue, not the old Concentration one",
    String((LIB.find(i => i.name === "Rootfast Loop") as { mechanicsText?: string })?.mechanicsText ?? "").includes("Prone, Grappled, or Restrained"),
    String((LIB.find(i => i.name === "Rootfast Loop") as { mechanicsText?: string })?.mechanicsText ?? "").slice(0, 90));
}

console.log("\n1d. the v9 sweep — every item, Act 1 to the last Act 4 drop");
{
  /**
   * Christopher, 2026-09-16: *"one more update to the loot section, do a full sweep up to the act 4 items,
   * this includes convergence output items."* The document is the source of truth; the build cannot read the
   * .docx, so the transcription is the fixture and the question is whether ALL of it reached the table.
   */
  type Row = EquipmentItem & { revisedAt?: string };
  const byId = new Map(LIB.map(i => [i.id, i as Row]));
  const byName = (n: string) => LIB.find(i => i.name === n) as Row | undefined;

  ok("the sweep carries every card — 122 in the document, Rimeguard as its three armour rows", LOOT_V9_ITEMS.length === 124,
    String(LOOT_V9_ITEMS.length));
  const lost = LOOT_V9_ITEMS.filter(r => {
    const shipped = byId.get(r.id);
    return !shipped || shipped.name !== r.name || shipped.mechanicsText !== r.mechanicsText || shipped.description !== r.description;
  });
  ok("...and every row's name, flavour and rules reach the shipped library over the older author export", lost.length === 0,
    lost.map(r => r.name).join(", "));

  // Structured facts the document prints, which a text refresh alone would not have moved.
  ok("Rimeguard is AC 17 heavy, 15 + DEX (max 2) medium, 13 + DEX light",
    byName("Rimeguard (Heavy)")?.ac === "17" && byName("Rimeguard (Medium)")?.ac === "15 + DEX (max 2)" && byName("Rimeguard (Light)")?.ac === "13 + DEX",
    ["Heavy", "Medium", "Light"].map(v => byName(`Rimeguard (${v})`)?.ac).join(" / "));

  /** "T2 and A3 properties recharge on a Long Rest." v6 said so too; that layer never wrote the pool. */
  const a3 = conv.filter(i => convOf(i).actLabel === "A3") as Row[];
  const t2 = conv.filter(i => convOf(i).tier === "T2") as Row[];
  const notLong = [...a3, ...t2].filter(i => i.charges?.reset !== "longRest" || Boolean(i.charges?.note));
  ok("all eight A3 inputs and ten Tier 2 outputs recharge on a Long Rest, with no dawn note left behind",
    a3.length === 8 && t2.length === 10 && notLong.length === 0, notLong.map(i => `${i.name} ${JSON.stringify(i.charges)}`).join(", "));
  /** ⚠ MUTATION GUARD: the sweep must not flatten the items whose own card still says dawn. */
  const dawn = ["Wendigo Ember Heart", "Frozen Lake Core", "North Wind Flask"].map(byName);
  ok("...while the items that print \"dawn\" still wait for the dawn",
    dawn.every(i => i?.charges?.reset === "manual" && /dawn/i.test(i.charges.note ?? "")), dawn.map(i => JSON.stringify(i?.charges)).join(" "));

  /**
   * ⚠ A TEXT SWEEP DOES NOT RELITIGATE A TABLE RULE. The +1 focus cards print "+1 to spell attack rolls and
   * spell save DC"; Christopher's rule is that *"a +1 adds to all 3 of the spell boxes"* (0.7.10.36). v9 changed
   * no focus line, so every focus keeps attack, damage and DC exactly as the app had them.
   */
  const plusOne = ["Rootknot Staff", "Staring-Knot Wand", "Icebound Reliquary", "Voidtempered Blade"].map(byName);
  ok("the four +1 focuses still add +1 to all three spell boxes",
    plusOne.every(f => f?.isSpellFocus && f.spellFocusAttack === "+1" && f.spellFocusDamage === "+1" && f.spellFocusSaveDc === "+1"),
    plusOne.map(f => `${f?.name}=${[f?.spellFocusAttack, f?.spellFocusDamage, f?.spellFocusSaveDc].join("/")}`).join(" "));
  ok("...and the two focus Gifts +2 to spell attack and save DC",
    ["Gift of First Light", "Gift of Duskthorn"].every(n => byName(n)?.isSpellFocus && byName(n)?.spellFocusAttack === "+2" && byName(n)?.spellFocusSaveDc === "+2"));

  /** Two Gifts changed FORM, not just name. */
  const firstLight = byName("Gift of First Light");
  ok("Gift of First Light is a Quarterstaff", firstLight?.chassis?.formId === "base-quarterstaff"
    && matchingForms(firstLight.chassis).some(f => f.id === "base-quarterstaff"), JSON.stringify(firstLight?.chassis));
  const duskthorn = byName("Gift of Duskthorn");
  ok("Gift of Duskthorn fits ANY weapon — a charm, no longer one-handed only",
    matchingForms(duskthorn?.chassis).length === BASE_WEAPONS.length, `${matchingForms(duskthorn?.chassis).length} of ${BASE_WEAPONS.length}`);
  /**
   * ⚠ BOTH FOCUS GIFTS COULD NEVER BE SHAPED, AND NOTHING SAID SO. Their chassis asked for a "one-handed" or
   * "two-handed" TAG; the base weapon table has no such tag — handedness is its CATEGORY — so each filter
   * matched no weapon at all, from the author export onward. A Gift that offers no form cannot be attached.
   */
  const gifts = LIB.filter(i => /^Gift of /.test(i.name));
  const formless = gifts.filter(g => matchingForms((g as Row).chassis).length === 0);
  ok("every Gift can take at least one weapon form", formless.length === 0, formless.map(g => g.name).join(", "));
  ok("MUTATION: the chassis the focus Gifts had matches no weapon, so the check above can fail",
    matchingForms({ requireTags: ["two-handed"] }).length === 0 && matchingForms({ requireTags: ["one-handed"] }).length === 0);
  ok("Gift of Winterwatch tracks Hold the Line — once per Short or Long Rest",
    byName("Gift of Winterwatch")?.charges?.reset === "shortRest");

  /** "Unless a property specifies an action, it requires none." These two print none. */
  ok("Blinkstep and True Ground, tempered, take no action",
    byName("Blinkstep — Tempered")?.activation === "free" && byName("True Ground — Tempered")?.activation === "free");

  /** The rider keeps its id — a claimed chip stays claimed — and wears the property's printed name. */
  const vigil = byName("Shattered Vigil")?.riders ?? [];
  ok("rider names follow the card: Shattered Vigil's Winter's Weight and Break the Vigil, on their old ids",
    vigil.find(r => r.id === "shattered-vigil-bite")?.label === "Winter's Weight" && vigil.find(r => r.id === "shattered-vigil-topple")?.label === "Break the Vigil",
    vigil.map(r => `${r.id}=${r.label}`).join(" "));

  /** Everything dropped in Act 1 says Act 1 — it said Act 2 since the first commit. */
  const act1 = LIB.filter(i => /^A1 |^ALDRIC|^HALE/.test(String(i.sourceEncounter ?? "")));
  const misfiled = act1.filter(i => i.act !== "Act 1");
  ok("every Act 1 drop and Aldric's stock is filed under Act 1", act1.length >= 23 && misfiled.length === 0,
    misfiled.map(i => i.name).join(", ") || `${act1.length} items`);
}

console.log("\n2. the label reaches the attached action");
{
  const input = LIB.find(i => i.name === "Crosspath Token")! as EquipmentItem;
  const output = LIB.find(i => i.name === "Anchor Thread")! as EquipmentItem;

  const a = itemToAction(input, false) as unknown as { metadata?: { convergence?: Conv; details?: string } };
  ok("an input carries its act onto the action", a.metadata?.convergence?.actLabel === "A3",
    JSON.stringify(a.metadata?.convergence));
  ok("...and the chip prints it", /◈ Convergence · A3/.test(a.metadata?.details ?? ""),
    a.metadata?.details?.slice(0, 80));

  const b = itemToAction(output, false) as unknown as { metadata?: { convergence?: Conv; details?: string } };
  ok("an output carries its tier", b.metadata?.convergence?.tier === "T1");
  ok("...and the chip prints that", /◈ Convergence · T1/.test(b.metadata?.details ?? ""),
    b.metadata?.details?.slice(0, 80));
}

console.log("\n3. and opening the editor does not strip it");
{
  /**
   * ⚠ THE RIDERS SHIPPED WITH EXACTLY THIS HOLE. `actionToItem` reads an attached action back into
   * an item and saving writes that item down, so a field missing there is deleted by the act of
   * LOOKING at the character: *"it deletes it if i open up the character editor."*
   */
  /**
   * Asserted on the SOURCE because `actionToItem` is component-local — the same reason
   * `check-item-riders` reads it this way. The list has to stay complete; `charges`, `riders` and
   * `convergence` are already here and each was a bug first.
   */
  const equip = codeOf("src/core/ui/EquipmentBagEditor.tsx");
  const at = equip.indexOf("function actionToItem");
  const body = equip.slice(at, equip.indexOf("\n  }", at));
  ok("actionToItem carries the act home", /actLabel: m\.convergence\.actLabel/.test(body));
  ok("...and the tier with it", /tier: m\.convergence\.tier/.test(body));

  const card = codeOf("src/core/ui/ActorCard.tsx");
  /**
   * The card backfills a mark for items attached before the field existed; it has to backfill the
   * provenance too or an old item reads as "convergence, source unknown".
   */
  ok("the card's backfill carries the act and tier",
    /actLabel: item\.convergence\.actLabel/.test(card) && /tier: item\.convergence\.tier/.test(card));
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
