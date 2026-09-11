/**
 * THE CORRECTED RECOVERY REGISTRY — classes, subclasses and species, short rest AND long.
 *   npx tsx scripts/check-recovery-registry.ts
 *
 * Christopher, 2026-09-10: *"ensure the recovery from the workbooks is in the app since it under
 * represents what each class and subclass could be recovered on short."*
 *
 * ⚠ THE EDITION KEYING IS THE WHOLE CORRECTION, so it is the first thing asserted. The 5.1
 * Dragonborn's Breath Weapon comes back on a short OR long rest; the 5.2.1 one does not. A registry
 * that flattened the two would hand one edition a free recharge every hour, and it is the exact
 * shape of error the workbook's own header warns about: *"Strict edition lookup. Long-Rest-only
 * limited traits are retained when needed to prevent a false Short-Rest refresh."*
 */
import { CLASS_RECOVERY, SPECIES_RECOVERY, classRecoveryFor, speciesRecoveryFor } from "../src/modules/dnd-5e/recoveryRegistry.generated";
import { SRD_CLASSES } from "../src/modules/dnd-5e/srdClasses.generated";
import { SRD_SPECIES } from "../src/modules/dnd-5e/srdSpecies";
import { deriveDmReference } from "../src/core/rules/sheetSummary";
import { deriveActorStats } from "../src/core/state/deriveActorStats";
import type { Actor } from "../src/core/types/actor";

/** A minimal sheet; only race, ruleset and level matter to these assertions. */
const ACTOR = {
  id: "x", name: "T", className: "Fighter", level: 5, proficiencyBonus: 3,
  stats: { ac: 15, hp: { current: 40, max: 40 }, speed: "30 ft" },
  abilityScores: { str: { score: 14 }, dex: { score: 12 }, con: { score: 14 }, int: { score: 10 }, wis: { score: 10 }, cha: { score: 10 } },
  tabs: { resources: [] },
};

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("The corrected recovery registry\n");

console.log("1. both editions are present and kept apart");
{
  const c521 = CLASS_RECOVERY.filter(r => r.ruleset === "5.2.1").length;
  const c51 = CLASS_RECOVERY.filter(r => r.ruleset === "5.1").length;
  ok("class rows in both editions", c521 > 0 && c51 > 0, `5.2.1=${c521} 5.1=${c51}`);
  ok("species rows in both editions",
    SPECIES_RECOVERY.some(r => r.ruleset === "5.2.1") && SPECIES_RECOVERY.some(r => r.ruleset === "5.1"));

  /**
   * ⚠ THE MUTATION THAT MATTERS. If these two ever return the same answer, the editions have been
   * flattened and a 5.2.1 Dragonborn is recharging its breath every short rest.
   */
  const d51 = speciesRecoveryFor("5.1", "Dragonborn", 1).find(r => /Breath Weapon/i.test(r.resource));
  const d521 = speciesRecoveryFor("5.2.1", "Dragonborn", 1).find(r => /Breath Weapon/i.test(r.resource));
  ok("5.1 Breath Weapon refreshes on a SHORT rest", d51?.shortRestMode === "REGAIN_ALL", String(d51?.shortRestMode));
  ok("5.2.1 Breath Weapon does NOT", d521?.shortRestMode === "NONE", String(d521?.shortRestMode));
  ok("mutation: the two editions disagree, and the registry keeps them apart",
    d51?.shortRestMode !== d521?.shortRestMode);
}

console.log("\n2. a \"none\" row is an answer, not a pool");
{
  /**
   * ⚠ MOST SPECIES GRANT NOTHING AND THE SHEET SAYS SO EXPLICITLY. Surfacing those as pools would
   * tell a DM every Halfling is missing something; dropping them would turn "checked, has nothing"
   * into "never checked". The lookup filters them and the raw table keeps them.
   */
  const noneRows = SPECIES_RECOVERY.filter(r => r.engineKind === "none");
  ok("the table keeps the 'none' rows", noneRows.length > 0, String(noneRows.length));
  ok("...and the lookup returns none of them",
    speciesRecoveryFor("5.2.1", "Halfling", 20).every(r => r.engineKind !== "none"));
  ok("mutation: a species whose only row is 'none' yields no pool",
    speciesRecoveryFor("5.1", "Halfling", 20).length === 0);
}

console.log("\n3. the ruleset that ANSWERED is the one the registry is asked about");
{
  /**
   * ⚠ A SHEET'S STATED EDITION IS A REQUEST, NOT AN ANSWER. `resolveSpecies` says so itself —
   * *"Which document actually answered — not always the one requested"* — because a race present in
   * only ONE of the two resolves there whatever the sheet says.
   *
   * `deriveDmReference` passed `actor.srdRuleset` straight through, so a sheet stating 5.2.1 with a
   * Half-Orc resolved its TRAITS from 5.1 and then asked the recovery registry about a 5.2.1
   * Half-Orc, which does not exist. Relentless Endurance came back as no pool at all — silently,
   * which is the only way this kind of fault ever arrives.
   *
   * Found while running down Christopher's note that *"wood elf is on the SRD 5.1 not the 5.2.1"*.
   * That one turned out not to be this bug — the Elf resolves in both — but hunting it found this.
   */
  const halfOrc = { ...ACTOR, race: "Half-Orc", srdRuleset: "5.2.1" } as unknown as Actor;
  const ref = deriveDmReference(halfOrc, deriveActorStats(halfOrc));
  ok("a 5.1-only race on a 5.2.1 sheet answers from 5.1", ref.speciesRuleset === "5.1", String(ref.speciesRuleset));
  ok("...and its pool is found", ref.speciesPools.some(p => /Relentless Endurance/i.test(p.resource)),
    ref.speciesPools.map(p => p.resource).join(", ") || "(none)");

  /**
   * ⚠ THE MUTATION IS THE OTHER DIRECTION: asking the registry with the SHEET's edition returns
   * nothing for this race, which is exactly what shipped. If these two ever agree, the fix is gone.
   */
  ok("mutation: asking with the sheet's stated edition finds nothing",
    speciesRecoveryFor("5.2.1", "Half-Orc", 20).length === 0);

  /**
   * And an edition the sheet states DOES decide things the document covers twice. A Wood Elf
   * resolves in both, and only one of them grants the lineage's free casts.
   */
  const wood = (rs: "5.2.1" | "5.1") => {
    const a = { ...ACTOR, race: "Wood Elf", srdRuleset: rs } as unknown as Actor;
    return deriveDmReference(a, deriveActorStats(a)).speciesPools.map(p => p.resource);
  };
  ok("a 5.2.1 Wood Elf has the lineage's free casts", wood("5.2.1").some(r => /Elven Lineage/i.test(r)), wood("5.2.1").join(", "));
  ok("a 5.1 Wood Elf has none", wood("5.1").length === 0, wood("5.1").join(", "));
}

console.log("\n4. min level is honoured");
{
  const orcAt1 = speciesRecoveryFor("5.2.1", "Orc", 1).map(r => r.resource);
  ok("an Orc has pools at level 1", orcAt1.length > 0, orcAt1.join(", "));
  /** Every row states a min level; a level-0 actor must not collect a level-5 feature. */
  const gated = SPECIES_RECOVERY.filter(r => r.minLevel > 1);
  for (const g of gated.slice(0, 3)) {
    ok(`  ${g.species} · ${g.resource} needs level ${g.minLevel}`,
      speciesRecoveryFor(g.ruleset, g.species, g.minLevel - 1).every(r => r.resource !== g.resource));
  }
  if (gated.length === 0) ok("  (no level-gated species rows in this workbook)", true);
}

console.log("\n5. a subclass rule is additive, never an override");
{
  const druid = classRecoveryFor("5.2.1", "Druid", "Circle of the Land", 20);
  const plain = classRecoveryFor("5.2.1", "Druid", null, 20);
  ok("the subclass adds Natural Recovery", druid.some(r => /Natural Recovery/i.test(r.resource)),
    druid.map(r => r.resource).join(", "));
  /**
   * ⚠ ADDITIVE. A subclass lookup must return the CLASS rows too — a Circle of the Land Druid still
   * has Hit Dice and spell slots. Returning only the subclass rows would silently drop them.
   */
  ok("...on top of everything the class already had", druid.length > plain.length);
  ok("mutation: a Druid with no subclass gets no subclass rule",
    plain.every(r => !/Natural Recovery/i.test(r.resource)));
}

console.log("\n6. every class the SRD publishes has recovery rows");
{
  for (const c of SRD_CLASSES) {
    const rows = classRecoveryFor("5.2.1", c.name, null, 20);
    ok(`  ${c.name}`, rows.length > 0, `${rows.length} row(s)`);
  }
}

console.log("\n7. and the species tables agree on who exists");
{
  /**
   * ⚠ THIS IS A REPORT, NOT A DEMAND. The recovery workbook and `srdSpecies.ts` are different
   * authorities and one may legitimately cover a species the other does not — but a species the
   * app can RESOLVE and the registry has never heard of is a silent zero, so it is named.
   */
  /**
   * ⚠ NOT A GAP — A DECIDED CASE, AND THE DISTINCTION IS CHRISTOPHER'S.
   *
   * The workbook's "Race Species Recovery" sheet covers every 5.2.1 species except the Aasimar.
   * I reported that as a data fault awaiting a workbook fix. It is not:
   *
   *   *"It will be handled the same way the Rimekin is as a entered race and a authored rest pool."*
   *
   * Rimekin comes from a book neither SRD covers, so its race is typed and its pools are authored
   * on the sheet. The Aasimar takes the same route. That is a THIRD category beside "derived" and
   * "missing", and the audit must not print it as either — a species reported as missing something
   * it was never going to derive is noise, and noise buries the two rows that are real.
   *
   * Ledgered the way `check-wiring` ledgers its orphans, so the list cannot rot: a species that
   * silently stops resolving fails, and one the workbook LATER covers fails too, because an entry
   * nobody prunes stops being a record of a decision.
   */
  const AUTHORED_POOL_SPECIES = new Map([
    ["aasimar", "Healing Hands and Celestial Revelation are 1/Long Rest; authored on the sheet, the Rimekin route"],
  ]);

  const known = new Set(SPECIES_RECOVERY.filter(r => r.ruleset === "5.2.1").map(r => r.species.toLowerCase()));
  const absent = SRD_SPECIES.filter(s => s.ruleset === "5.2.1" && !known.has(s.name.toLowerCase()));
  const unexpected = absent.filter(s => !AUTHORED_POOL_SPECIES.has(s.name.toLowerCase()));
  ok("no UNRECORDED species is absent from the registry",
    unexpected.length === 0,
    unexpected.length ? `NOT IN THE WORKBOOK AND NOT DECIDED: ${unexpected.map(s => s.name).join(", ")}` : "");

  for (const [name, why] of AUTHORED_POOL_SPECIES) {
    ok(`  decided — ${name} authors its pools`,
      absent.some(s => s.name.toLowerCase() === name),
      known.has(name)
        ? "the workbook now covers it — remove it from AUTHORED_POOL_SPECIES"
        : why);
    /** And the species must still RESOLVE, or "authored" is hiding a species the app lost. */
    ok(`  ...and ${name} still resolves as a species`,
      SRD_SPECIES.some(s => s.ruleset === "5.2.1" && s.name.toLowerCase() === name));
  }
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
