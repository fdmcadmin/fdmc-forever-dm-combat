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

console.log("\n3. min level is honoured");
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

console.log("\n4. a subclass rule is additive, never an override");
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

console.log("\n5. every class the SRD publishes has recovery rows");
{
  for (const c of SRD_CLASSES) {
    const rows = classRecoveryFor("5.2.1", c.name, null, 20);
    ok(`  ${c.name}`, rows.length > 0, `${rows.length} row(s)`);
  }
}

console.log("\n6. and the species tables agree on who exists");
{
  /**
   * ⚠ THIS IS A REPORT, NOT A DEMAND. The recovery workbook and `srdSpecies.ts` are different
   * authorities and one may legitimately cover a species the other does not — but a species the
   * app can RESOLVE and the registry has never heard of is a silent zero, so it is named.
   */
  /**
   * ⚠ ONE KNOWN GAP, LEDGERED RATHER THAN WAVED THROUGH.
   *
   * The workbook's "Race Species Recovery" sheet covers every 5.2.1 species EXCEPT the Aasimar,
   * which has two limited pools in the SRD — Healing Hands (once per Long Rest) and Celestial
   * Revelation (once per Long Rest). It matters today: Raphael is an Aasimar.
   *
   * Recorded here the way `check-wiring` records its orphans — a NEW gap fails, and a FIXED one
   * fails too, because a ledger nobody prunes stops being a ledger.
   */
  const KNOWN_GAPS = new Map([
    ["aasimar", "Healing Hands and Celestial Revelation are 1/Long Rest in the SRD; the workbook sheet has no Aasimar row"],
  ]);

  const known = new Set(SPECIES_RECOVERY.filter(r => r.ruleset === "5.2.1").map(r => r.species.toLowerCase()));
  const missing = SRD_SPECIES.filter(s => s.ruleset === "5.2.1" && !known.has(s.name.toLowerCase()));
  const unexpected = missing.filter(s => !KNOWN_GAPS.has(s.name.toLowerCase()));
  ok("no UNRECORDED species is missing a recovery row",
    unexpected.length === 0,
    unexpected.length ? `NOT IN THE WORKBOOK: ${unexpected.map(s => s.name).join(", ")}` : "");

  for (const [name, why] of KNOWN_GAPS) {
    ok(`  known gap still stands: ${name}`, missing.some(s => s.name.toLowerCase() === name),
      known.has(name) ? "FIXED in the workbook — remove it from KNOWN_GAPS" : why);
  }
}

console.log(failures ? `\nFAILED (${failures})` : "\nALL PASS");
process.exit(failures ? 1 : 0);
