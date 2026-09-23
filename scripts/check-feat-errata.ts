/**
 * AN ERRATUM CITES THE PRINTED FEAT, OR IT IS NOT AN ERRATUM.
 *   npm run check:featerrata
 *
 * Christopher, 2026-09-23: *"so the feat is priced wrong in the app and in the workbook pricer"*, and
 * on where the fix belongs: an in-app layer, *"but it needs to live in the dnd mod load since this
 * comes from the SRD material."*
 *
 * `featPricing.generated.ts` is the workbook's own copy and carries "do not hand-edit". So the
 * corrections live in `featPricingErrata` and are applied at read time by `featPricing.ts`. That is a
 * seam with two failure modes, and this gate closes both:
 *
 *   1. AN ERRATUM WITH NO SOURCE is just a number somebody preferred — the exact thing the bare
 *      coefficients it replaces already were. Every row must quote the printed text and say what the
 *      workbook row gets wrong.
 *   2. A READER THAT SKIPS THE SEAM gets the uncorrected row and disagrees with every other reader.
 *      Nothing outside the seam may import the generated table.
 *
 * ⚠ AND THE CORRECTIONS THEMSELVES ARE ASSERTED, not just their shape: Great Weapon Master must gate
 * on a Heavy weapon and must not pay for Hew; Spell Sniper must ask for nothing.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { FEAT_ERRATA } from "../src/modules/dnd-5e/featPricingErrata";
import { featPricing } from "../src/modules/dnd-5e/featPricing";
import { featPricing as generated } from "../src/modules/dnd-5e/featPricing.generated";
import { priceFeat } from "../src/modules/dnd-5e/featEvaluator";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log("The workbook is the law; the printed feat is the law above it\n");

console.log("1. every erratum says where it came from");
{
  ok("there is at least one", FEAT_ERRATA.length > 0, `${FEAT_ERRATA.length} rows`);
  for (const e of FEAT_ERRATA) {
    ok(`${e.key} cites its source`, e.source.trim().length > 10, e.source);
    ok(`${e.key} quotes the printed text`, e.printed.trim().length > 20);
    ok(`${e.key} says what the workbook row gets wrong`, e.why.trim().length > 20);
    ok(`${e.key} actually changes something`,
      e.dpr !== undefined || e.personalEhp !== undefined || e.partyEhp !== undefined || e.trigger !== undefined);
  }
  /** An erratum keyed to a feat the workbook does not have is dead text pretending to be a correction. */
  const orphans = FEAT_ERRATA.filter(e => generated(e.key) === undefined).map(e => e.key);
  ok("no erratum names a feat the workbook does not have", orphans.length === 0, orphans.join(", "));
}

console.log("\n2. the correction reaches the reader, and the note travels with it");
{
  for (const e of FEAT_ERRATA) {
    const corrected = featPricing(e.key);
    const raw = generated(e.key);
    ok(`${e.key} reads corrected`, e.dpr === undefined || corrected?.dpr === e.dpr, String(corrected?.dpr));
    ok(`${e.key} — the generated table is untouched`, raw?.dpr !== undefined && (e.dpr === undefined || raw.dpr !== e.dpr),
      String(raw?.dpr));
    ok(`${e.key} — the row says it was corrected`, /ERRATUM \(/.test(String(corrected?.note)));
    if (e.unpriced) ok(`${e.key} — and names what is still unpriced`, /STILL UNPRICED:/.test(String(corrected?.note)));
  }
  /** A feat with no erratum must come back byte-identical, or the seam is rewriting rows it was not given. */
  const untouched = featPricing("Dueling");
  ok("a feat with no erratum is unchanged", JSON.stringify(untouched) === JSON.stringify(generated("Dueling")));
}

console.log("\n3. Great Weapon Master prices the printed benefit, and not a guess at Hew");
{
  const gwm = featPricing("2024:Great Weapon Master");
  ok("it gates on a Heavy weapon", String(gwm?.dpr).includes("heavyWeaponEquipped"), String(gwm?.dpr));
  ok("it pays the printed 3, not PB", String(gwm?.dpr).includes("3*onceHit") && !String(gwm?.dpr).includes("PB*"),
    String(gwm?.dpr));
  ok("the 0.10 guess at Hew is gone", !String(gwm?.dpr).includes("0.10"), String(gwm?.dpr));
  ok("...and Hew is named as unpriced rather than dropped", /Hew is NOT priced/.test(String(gwm?.note)));

  /** ⚠ THE NUMBERS. A greataxe character earns it; the same character leading with a rapier does not. */
  const heavy = priceFeat("2024:Great Weapon Master", { heavyWeaponEquipped: 1, onceHit: 0.84 } as never);
  ok("a Heavy weapon at 84% once-hit prices 2.52", heavy?.dpr.ok === true && Math.abs(heavy.dpr.value - 2.52) < 1e-9,
    heavy?.dpr.ok ? String(heavy.dpr.value) : JSON.stringify(heavy?.dpr));
  const light = priceFeat("2024:Great Weapon Master", { heavyWeaponEquipped: 0, onceHit: 0.84 } as never);
  ok("mutation: not Heavy, worth nothing", light?.dpr.ok === true && light.dpr.value === 0,
    light?.dpr.ok ? String(light.dpr.value) : JSON.stringify(light?.dpr));
  const blind = priceFeat("2024:Great Weapon Master", { onceHit: 0.84 } as never);
  ok("mutation: no weapon read at all still reports NEEDS_INPUT", blind?.dpr.ok === false,
    JSON.stringify(blind?.dpr));

  const legacy = featPricing("2014:Great Weapon Master");
  ok("the 2014 row keeps its power-attack EV", String(legacy?.dpr).includes("hit(attackBonus-5,targetAC)"));
  ok("...and loses its 0.12 guess", !String(legacy?.dpr).includes("0.12"), String(legacy?.dpr));
}

console.log("\n4. Spell Sniper asks for nothing");
{
  for (const key of ["2024:Spell Sniper", "2014:Spell Sniper"]) {
    const row = featPricing(key);
    ok(`${key} needs no exposure input`, !String(row?.dpr).includes("Exposure"), String(row?.dpr));
    const priced = priceFeat(key, {} as never);
    /**
     * ⚠ ZERO IS AN ANSWER HERE, NOT A GAP. Both benefits REMOVE a penalty this checker never applies:
     * it has no terrain, so nothing is ever in cover, and it never gives a caster disadvantage for an
     * adjacent hostile. Christopher: *"it shouldnt need a DM input"*.
     */
    ok(`${key} prices with an empty context`, priced?.dpr.ok === true, JSON.stringify(priced?.dpr));
    ok(`${key} is worth zero in a checker with no cover`, priced?.dpr.ok === true && priced.dpr.value === 0);
    ok(`${key} says it must be revisited if cover is ever modelled`, /revisit/i.test(String(row?.note)));
  }
}

console.log("\n5. nothing reads around the seam");
{
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (name === "node_modules" || name === "dist") continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs)$/.test(name)) files.push(full);
    }
  };
  walk(join(ROOT, "src"));
  walk(join(ROOT, "scripts"));

  /**
   * The seam itself, the errata it applies, the generator that writes the table, and this gate are
   * the only readers allowed to name the generated file.
   */
  const allowed = new Set([
    "src/modules/dnd-5e/featPricing.ts",
    "src/modules/dnd-5e/featPricingErrata.ts",
    "src/modules/dnd-5e/featPricing.generated.ts",
    "scripts/gen-feats.mjs",
    "scripts/check-feat-errata.ts",
  ]);
  const offenders = files.filter(f => {
    const rel = relative(ROOT, f).replace(/\\/g, "/");
    if (allowed.has(rel)) return false;
    return /from\s+["'][^"']*featPricing\.generated["']/.test(readFileSync(f, "utf8"));
  }).map(f => relative(ROOT, f).replace(/\\/g, "/"));
  ok("no file outside the seam imports the generated table", offenders.length === 0, offenders.join(", "));
}

console.log(failures === 0 ? "\nOK — every correction cites the book, and every reader goes through the seam"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
