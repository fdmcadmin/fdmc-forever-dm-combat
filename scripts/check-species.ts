/**
 * SRD 5.2.1 SPECIES — the traits and the movement, added without eating the sheet.
 *   npm run check:species
 *
 * Christopher, 2026-09-07: *"the baseline class traits and such should be in the SRD already and
 * should be set to automatically add the traits and movement, the same could be done with health
 * but its fine to have to enter it."*
 *
 * "Automatically add" is the easy half. The half this file is mostly about is the other one: the
 * live sheets ALREADY carry hand-typed trait paragraphs and hand-typed speeds, and an applier that
 * rewrites a features tab is one bad match away from deleting a DM's own work. So every assertion
 * about adding is paired with one about not destroying.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { SRD_SPECIES, resolveSpecies, speciesTraitId, SPECIES_TRAIT_PREFIX } from "../src/modules/dnd-5e/srdSpecies";
import { applySpeciesToTabs } from "../src/modules/dnd-5e/applySpecies";
import { classDamageResponsesFor } from "../src/modules/dnd-5e/classDamageResponses";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("A species states its own traits, speed and resistances\n");

/* ── 1. The table itself ─────────────────────────────────────────────────────────────────── */
console.log("The ten SRD 5.2.1 species");
{
  ok("all ten are present", SRD_SPECIES.length === 10, SRD_SPECIES.map(s => s.name).join(", "));
  ok("every species states a walking speed",
    SRD_SPECIES.every(s => s.speedFt > 0),
    SRD_SPECIES.filter(s => !(s.speedFt > 0)).map(s => s.name).join(", ") || "all");
  ok("every trait states what it does",
    SRD_SPECIES.every(s => s.traits.every(t => t.name.trim() !== "" && t.text.trim().length > 20)));
  /** ⚠ EVERY RESISTANCE NAMES THE TRAIT THAT GRANTS IT, or a derived number cannot be traced. */
  ok("every damage response names its granting feature",
    SRD_SPECIES.every(s => (s.damageResponses ?? []).every(r => r.feature.trim() !== "")
      && (s.lineages ?? []).every(l => (l.damageResponses ?? []).every(r => r.feature.trim() !== ""))));
}

/* ── 2. The lineage is read from the stated race string ──────────────────────────────────── */
console.log("\nA lineage is read from the race the sheet states");
{
  const wood = resolveSpecies("Wood Elf")!;
  ok("Wood Elf resolves to the Elf species", wood.species.name === "Elf", wood.species.name);
  ok("...with the Wood Elf lineage", wood.lineage?.name === "Wood Elf", wood.lineage?.name);
  /** The whole point of the screenshot: Fleet of Foot's 35 ft, arriving without being typed. */
  ok("...and a speed of 35, from the lineage and not the species",
    wood.speedFt === 35, `${wood.speedFt} ft`);
  ok("...carrying both the species traits AND the lineage's",
    wood.traits.some(t => t.name === "Fey Ancestry")
    && wood.traits.some(t => t.name === "Trance")
    && wood.traits.some(t => /Wood Elf/.test(t.name)),
    wood.traits.map(t => t.name).join(", "));

  const plain = resolveSpecies("Elf")!;
  ok("a bare Elf keeps the species speed and gains no lineage",
    plain.speedFt === 30 && plain.lineage === undefined, `${plain.speedFt} ft`);
  ok("a Drow's darkvision is the lineage's 120, not the species' 60",
    resolveSpecies("Drow")?.darkvisionFt === 120, String(resolveSpecies("Drow")?.darkvisionFt));

  ok("a Mountain Dwarf still resolves as a Dwarf",
    resolveSpecies("Mountain Dwarf")?.species.name === "Dwarf");
  /** ⚠ A RACE THE SRD DOES NOT COVER IS UNDEFINED, NOT A DEFAULT. */
  ok("a Kobold resolves to nothing at all", resolveSpecies("Kobold") === undefined);
  ok("an empty race resolves to nothing", resolveSpecies("") === undefined && resolveSpecies(undefined) === undefined);
}

/* ── 3. Resistances come from this table and nowhere else ────────────────────────────────── */
console.log("\nThe checker's resistances and the sheet's traits are ONE table");
{
  const pc = (race: string) => ({ name: "X", race, tabs: {} }) as never;
  const dwarf = classDamageResponsesFor(pc("Mountain Dwarf"));
  ok("a Dwarf's poison resistance reaches the checker from the species table",
    dwarf.length === 1 && dwarf[0].type === "poison" && dwarf[0].response === "resistant");
  ok("...naming the species and the trait", dwarf[0].source === "Dwarf · Dwarven Resilience", dwarf[0].source);

  const inf = classDamageResponsesFor(pc("Infernal Tiefling"));
  ok("a lineage resistance resolves from the lineage",
    inf.length === 1 && inf[0].type === "fire", inf.map(r => r.type).join(", "));
  /** ⚠ AND A LEGACY THE SHEET DOES NOT NAME GRANTS NONE — it is a choice, not a rule. */
  ok("a bare Tiefling is given no resistance, because the legacy is a choice",
    classDamageResponsesFor(pc("Tiefling")).length === 0);
  ok("a Dragonborn likewise — the ancestry is a choice",
    classDamageResponsesFor(pc("Dragonborn")).length === 0);
}

/* ── 4. Applying it ADDS, and never eats the sheet ───────────────────────────────────────── */
console.log("\nApplying a species is additive");
{
  const applied = applySpeciesToTabs("Wood Elf", { features: [] })!;
  ok("it returns the species' speed", applied.speed === "35 ft", applied.speed);
  ok("...and adds every trait as its own row",
    (applied.tabs.features ?? []).length === applied.added.length && applied.added.length >= 5,
    applied.added.join(", "));
  ok("...each with a namespaced id so it can be replaced later",
    (applied.tabs.features ?? []).every(a => String(a.id).startsWith(SPECIES_TRAIT_PREFIX)));
  ok("...and each carrying its printed text",
    (applied.tabs.features ?? []).every(a => String(a.description ?? "").trim().length > 20));

  /** ⚠ IDEMPOTENT. Applying the same species twice must not double the rows. */
  const twice = applySpeciesToTabs("Wood Elf", applied.tabs)!;
  ok("applying the same species twice adds nothing the second time",
    (twice.tabs.features ?? []).length === (applied.tabs.features ?? []).length,
    `${(applied.tabs.features ?? []).length} → ${(twice.tabs.features ?? []).length}`);

  /** ⚠ CHANGING SPECIES REPLACES ONLY WHAT THIS FUNCTION ADDED. */
  const hand = { id: "my-own-note", label: "Mask of the Wild", actionKind: "feature", economyCost: [], logMode: "silent", description: "Christopher's own 2014 wording, typed by hand." } as never;
  const withHand = { features: [...(applied.tabs.features ?? []), hand] };
  const changed = applySpeciesToTabs("Orc", withHand)!;
  ok("changing species removes the old species' rows", changed.removed.length >= 5, `${changed.removed.length} removed`);
  ok("...and the DM's own row SURVIVES",
    (changed.tabs.features ?? []).some(a => a.id === "my-own-note"),
    (changed.tabs.features ?? []).map(a => a.id).join(", "));
  ok("...with the new species' traits added", changed.added.includes("Relentless Endurance"), changed.added.join(", "));
  ok("...and the new speed", changed.speed === "30 ft", changed.speed);

  /**
   * ⚠ A HAND-TYPED ROW OF THE SAME NAME IS NOT DUPLICATED. Lyrielle's sheet already says
   * "Darkvision 60 ft" in her own words; adding a second Darkvision row beside it would be the
   * app arguing with the sheet inside the DM's own feature list.
   */
  const owned = { features: [{ id: "mine", label: "Darkvision", actionKind: "feature", economyCost: [], logMode: "silent", description: "Mine." }] } as never;
  const merged = applySpeciesToTabs("Wood Elf", owned)!;
  ok("a hand-typed row of the same name is not duplicated",
    (merged.tabs.features ?? []).filter(a => String(a.label) === "Darkvision").length === 1
    && !merged.added.includes("Darkvision"),
    merged.added.join(", "));
  ok("...and that row is still the DM's, not the app's",
    (merged.tabs.features ?? []).find(a => String(a.label) === "Darkvision")?.id === "mine");

  /** ⚠ AN UNRECOGNISED RACE CHANGES NOTHING AT ALL. */
  ok("a Kobold leaves the sheet exactly as it was", applySpeciesToTabs("Kobold", withHand) === null);

  /** The id is stable, or a species change would orphan rows instead of replacing them. */
  ok("a trait id is derived from its name and is stable",
    speciesTraitId("Fey Ancestry") === "srd-species:fey-ancestry", speciesTraitId("Fey Ancestry"));
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
