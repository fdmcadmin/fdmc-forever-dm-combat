/**
 * WORKBOOK PARITY — every creature in the app against its v7 profile.
 *
 * Run: npm run validate:parity
 *
 * ⚠ NOTHING IN THE APP BEATS THE WORKBOOK. Christopher, 2026-08-20. v7 `campaign_profiles`
 * publishes each creature's own AC, HP and TRAIT MULTIPLIER, so parity is checkable directly
 * rather than argued about — and a divergence in EITHER direction is an error.
 *
 * ⚠ WHAT THIS CAUGHT ON ITS FIRST RUN: four creatures, and three of them beat the workbook by 30%.
 *
 *   Frozen Sentinel, Rime Wight and Frost-Weaver each carried three hand-written multipliers —
 *   1.30, 1.14 and 1.26 — whose product was ×1.867 against the workbook's ×1.436. None of those
 *   three numbers appears anywhere in the 58 calibrated trait rules. They were invented, and they
 *   made every Act 2 formation fight 30% harder to kill than the workbook says it is.
 *
 *   Velvet Host was the mirror error: "No effective-HP trait ×1" asserted in the app where the
 *   workbook credits ×1.108. Under-counting diverges just as much as over-counting.
 *
 * ⚠ ONE CONFLICT REMAINS AND IT IS NOT AN APP ERROR. Velvet Host reads AC 16 / HP 75 in the v7
 * profile and AC 17 / HP 82 in the app. The app matches
 * `Broken_Chain_Act3_Encounters_Current_Rosters_Only_v3_15.docx`, which POSTDATES the profile —
 * the Velvet Host is part of the Hollow Feast replacement and the bundled profile predates it.
 * RULE ONE: the newer document Christopher handed over is the truth for the statblock; the
 * workbook stays the truth for the pricing weight. Reported here so the pair is never silently
 * reconciled in the wrong direction.
 */
import v7 from "../src/data/checker/v7-runtime.json";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
const profiles = (v7 as any).campaign_profiles as Array<{ id: string; n: string; ac: number; hp: number; cr: number|null; la: number; tm: number; tt: string[] }>;
const lib = BROKEN_CHAIN_MONSTER_LIBRARY as any[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
console.log("creature                workbook            app                 delta");
console.log("                        AC   HP    tm       AC   HP    tm");
console.log("─".repeat(84));
let acBad = 0, hpBad = 0, tmBad = 0, missing = 0;
for (const p of profiles) {
  const t = lib.find(m => norm(m.name) === norm(p.n));
  if (!t) { missing++; continue; }
  const appTm = (t.stats.defenses ?? []).reduce((x: number, d: any) => x * (d.ehpMultiplier || 1), 1);
  const appAc = Number(t.stats.ac), appHp = Number(t.stats.maxHp);
  const dAc = appAc !== p.ac, dHp = appHp !== p.hp, dTm = Math.abs(appTm - p.tm) > 0.005;
  if (dAc) acBad++; if (dHp) hpBad++; if (dTm) tmBad++;
  if (dAc || dHp || dTm) {
    console.log(`${p.n.slice(0,22).padEnd(24)}${String(p.ac).padStart(3)}${String(p.hp).padStart(5)}  ${p.tm.toFixed(3)}    ${String(appAc).padStart(3)}${String(appHp).padStart(5)}  ${appTm.toFixed(3)}    ${dAc?"AC ":""}${dHp?"HP ":""}${dTm?`tm ${((appTm/p.tm-1)*100).toFixed(1)}%`:""}`);
  }
}
console.log(`\nprofiles ${profiles.length} · matched ${profiles.length-missing} · AC differs ${acBad} · HP differs ${hpBad} · trait multiplier differs ${tmBad}`);

/**
 * ⚠ ACTION-CHANNEL PARITY — the check that found the app giving free damage.
 *
 * `la` is the workbook's legendary-actions-per-round for a creature, and every profile in the
 * bundle sets it to 0. Where the app grants a legendary channel anyway, the creature gets an
 * extra attack EVERY round that the workbook never counted — a legendary action has its own
 * budget and adds on top, where an action competes for the one Action slot.
 */
import { parseCreature as parseForChannels } from "../src/core/encounter-band/parseCreature";
console.log("\nACTION-CHANNEL PARITY\n" + "─".repeat(84));
let chan = 0;
for (const p of profiles) {
  const t = lib.find(m => norm(m.name) === norm(p.n));
  if (!t) continue;
  const parsed = parseForChannels(t);
  for (const f of parsed.features) {
    if (f.activationType !== "legendary_action") continue;
    const wb = (p.f ?? []).find((x: any) => norm(x.n).includes(norm(f.name)) || norm(f.name).includes(norm(x.n)));
    if (wb && wb.t !== "legendary_action") {
      chan++;
      console.log(`  ${p.n.padEnd(22)} "${f.name}" — app: legendary_action (own budget, adds on top)  ·  workbook: ${wb.t} (competes for the Action), la=${p.la}`);
    }
  }
}
console.log(chan === 0 ? "  every action channel matches the workbook" : `  ${chan} feature(s) priced in a richer channel than the workbook allows`);
