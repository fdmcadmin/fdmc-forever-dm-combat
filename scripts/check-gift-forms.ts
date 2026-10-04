/**
 * A FEYWILD GIFT'S FORMS ARE THE DOCUMENT'S LIST, NOT A FILTER SOMEBODY DERIVED.
 *   npm run check:giftforms
 *
 * Source: `Broken_Chain_Loot_and_Convergence_v14_Clear_Item_Wording.docx`, "DM NOTE GIFT FORMS":
 * *"The seven weapon lists cover all 38 weapons in the SRD 5.2.1 Weapons table. Each weapon Gift
 * has 5–8 eligible forms."*
 *
 * ⚠ THIS GATE EXISTS BECAUSE A FILTER WAS GUESSED AND WAS WRONG. Winter's Mercy is "two-handed
 * melee", so an earlier pass expressed it as `Melee Two-Handed + heavy` — which admits Glaive,
 * Halberd and Pike (the document excludes all three) and rejects Battleaxe, Warhammer and War Pick
 * (the document grants all three). The categories and tags do not describe these lists, and the
 * only safe reading of a stated list is the list.
 */
import { AUTHORED_EQUIPMENT } from "../src/data/broken-chain/authored.generated";
import { matchingForms } from "../src/core/constants/chassis";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

/**
 * The document's table, by the name it prints. `Musket` and `Pistol` are listed there and are NOT
 * expected here: the document gates them on firearms being available, and `BASE_WEAPONS` carries
 * none. A finesse weapon's "(STR)" twin IS expected — it is the same weapon, offered at the other
 * ability the document's "keep its normal attack ability" rule preserves.
 */
const DOCUMENT: Record<string, string[]> = {
  "Gift of Oakheart": ["Longsword", "Battleaxe", "Warhammer", "War Pick", "Mace", "Flail", "Morningstar"],
  "Gift of Winter's Mercy": ["Greatclub", "Greataxe", "Greatsword", "Maul", "Battleaxe", "Warhammer", "War Pick"],
  "Gift of Thornrunner": ["Club", "Dagger", "Dagger (STR)", "Sickle", "Scimitar", "Scimitar (STR)",
    "Shortsword", "Shortsword (STR)", "Rapier", "Rapier (STR)", "Whip"],
  "Gift of Winterwatch": ["Glaive", "Halberd", "Lance", "Pike", "Quarterstaff", "Spear", "Trident"],
  "Gift of Rimefang": ["Dagger", "Dagger (STR)", "Handaxe", "Javelin", "Light Hammer", "Spear", "Trident", "Dart"],
  "Gift of Hartseeker": ["Shortbow", "Longbow", "Light Crossbow", "Heavy Crossbow"],
};

console.log("A Gift's forms are the document's list\n");

const items = AUTHORED_EQUIPMENT as unknown as Array<{ name?: string; chassis?: { formIds?: string[] } }>;

console.log("1. every Gift the document states offers exactly those forms");
for (const [name, expected] of Object.entries(DOCUMENT)) {
  const item = items.find(i => i.name === name);
  if (!item) { ok(`${name} is in the library`, false); continue; }
  const forms = matchingForms(item.chassis as never).map(f => f.name);
  ok(name, JSON.stringify(forms) === JSON.stringify(expected),
    forms.length === expected.length ? forms.join(", ") : `${forms.length} forms, expected ${expected.length}: ${forms.join(", ")}`);
}

console.log("\n2. a stated list is stated, not derived");
{
  for (const [name] of Object.entries(DOCUMENT)) {
    const item = items.find(i => i.name === name);
    const spec = item?.chassis as { formIds?: string[]; categories?: string[]; requireTags?: string[]; anyOfTags?: string[] } | undefined;
    ok(`${name} names its forms outright`, (spec?.formIds ?? []).length > 0);
    /**
     * ⚠ AND CARRIES NO LEFTOVER FILTER. A `categories` beside a stated list is a second opinion on
     * the same question, and `matchingForms` ignores it — so it would sit there reading as though
     * it still decided something while the list quietly overruled it.
     */
    ok(`...and keeps no filter beside it`,
      !(spec?.categories?.length || spec?.requireTags?.length || spec?.anyOfTags?.length),
      JSON.stringify(spec));
  }
}

console.log("\n3. the allow-list beats the filters, and a missing form is skipped not invented");
{
  /** Filters that would match the whole melee table, with a two-item list stated beside them. */
  const both = matchingForms({
    formIds: ["base-greatsword", "base-maul"],
    categories: ["Melee One-Handed"], requireTags: ["light"],
  } as never).map(f => f.name);
  ok("a stated list wins outright", JSON.stringify(both) === JSON.stringify(["Greatsword", "Maul"]), both.join(", "));

  const withFirearm = matchingForms({ formIds: ["base-longbow", "base-musket", "base-shortbow"] } as never).map(f => f.name);
  ok("a form the base table does not carry is skipped, not invented",
    JSON.stringify(withFirearm) === JSON.stringify(["Longbow", "Shortbow"]), withFirearm.join(", "));

  ok("an empty list falls through to the filters",
    matchingForms({ formIds: [], categories: ["Ranged Two-Handed"] } as never).length === 5);
}

console.log(failures === 0
  ? "\nOK — every stated Gift offers the document's own forms"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
