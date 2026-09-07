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

/* ── 5. Both documents ship, and they disagree ───────────────────────────────────────────── */
console.log("\nSRD 5.1 and 5.2.1 are both available, and the sheet says which");
{
  /**
   * Christopher, 2026-09-07: *"the srd is suppose to be both 5.1 and 5.2.1 because wood elf is the
   * class she has, and 5.1 has a SRD as well that can be used."* He is right — Wizards released
   * SRD 5.1 under CC-BY-4.0 in January 2023, the same licence 5.2.1 ships under.
   *
   * ⚠ THE DISAGREEMENT IS NUMERIC, NOT COSMETIC, which is why a default would have been a guess.
   */
  const wood51 = resolveSpecies("Wood Elf", "5.1")!;
  const wood52 = resolveSpecies("Wood Elf", "5.2.1")!;
  ok("5.1's Wood Elf has Mask of the Wild and Fleet of Foot",
    wood51.traits.some(t => t.name === "Mask of the Wild") && wood51.traits.some(t => t.name === "Fleet of Foot"),
    wood51.traits.map(t => t.name).join(", "));
  ok("5.2.1's does NOT — it is an Elven Lineage instead",
    !wood52.traits.some(t => t.name === "Mask of the Wild")
    && wood52.traits.some(t => /Elven Lineage/.test(t.name)),
    wood52.traits.map(t => t.name).join(", "));
  ok("...and both still arrive at 35 feet", wood51.speedFt === 35 && wood52.speedFt === 35);
  ok("each says which document answered", wood51.ruleset === "5.1" && wood52.ruleset === "5.2.1");

  /** ⚠ A NUMBER THE CHECKER READS DIFFERS BETWEEN THEM. */
  ok("a 5.1 Dwarf walks 25 feet and a 5.2.1 Dwarf walks 30",
    resolveSpecies("Dwarf", "5.1")!.speedFt === 25 && resolveSpecies("Dwarf", "5.2.1")!.speedFt === 30,
    `${resolveSpecies("Dwarf", "5.1")!.speedFt} vs ${resolveSpecies("Dwarf", "5.2.1")!.speedFt}`);
  ok("...so applying the wrong one would write the wrong speed",
    applySpeciesToTabs("Dwarf", { features: [] }, "5.1")!.speed === "25 ft"
    && applySpeciesToTabs("Dwarf", { features: [] }, "5.2.1")!.speed === "30 ft");

  /** ⚠ AND A RACE ONLY ONE DOCUMENT PUBLISHES RESOLVES THERE ANYWAY. */
  ok("a Half-Orc resolves from 5.1 even when 5.2.1 is asked for",
    resolveSpecies("Half-Orc", "5.2.1")?.ruleset === "5.1",
    String(resolveSpecies("Half-Orc", "5.2.1")?.ruleset));
  ok("a Goliath resolves from 5.2.1 even when 5.1 is asked for",
    resolveSpecies("Goliath", "5.1")?.ruleset === "5.2.1",
    String(resolveSpecies("Goliath", "5.1")?.ruleset));

  /**
   * ⚠ "Half-Elf" AND "Half-Orc" CONTAIN THEIR PARENT SPECIES AS A WHOLE WORD, because a hyphen is
   * a word boundary. Without a lookbehind a Half-Elf was handed full Elf darkvision, Trance and
   * Keen Senses. Both halves are asserted, in BOTH rulesets, because the Orc twin was caught and
   * the Elf one survived a version for want of this line.
   */
  for (const rules of ["5.1", "5.2.1"] as const) {
    ok(`${rules}: a Half-Elf is not read as an Elf`,
      resolveSpecies("Half-Elf", rules)?.name === "Half-Elf",
      String(resolveSpecies("Half-Elf", rules)?.name));
    ok(`${rules}: ...nor "Half Elf" without the hyphen`,
      resolveSpecies("Half Elf", rules)?.name === "Half-Elf");
    ok(`${rules}: a Half-Orc is not read as an Orc`,
      resolveSpecies("Half-Orc", rules)?.name === "Half-Orc",
      String(resolveSpecies("Half-Orc", rules)?.name));
  }
  /** ⚠ AND THE PARENTS MUST STILL MATCH THEMSELVES. */
  ok("a plain Elf and a plain Orc still resolve",
    resolveSpecies("Elf", "5.2.1")?.name === "Elf" && resolveSpecies("Orc", "5.2.1")?.name === "Orc");
  ok("the default is the app's pinned 5.2.1",
    resolveSpecies("Dwarf")?.ruleset === "5.2.1");

  /** A 5.1 Tiefling resists fire outright; a 5.2.1 one has to pick a legacy first. */
  ok("5.1 grants a Tiefling fire resistance; 5.2.1 waits for the legacy",
    resolveSpecies("Tiefling", "5.1")!.damageResponses.length === 1
    && resolveSpecies("Tiefling", "5.2.1")!.damageResponses.length === 0);
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
