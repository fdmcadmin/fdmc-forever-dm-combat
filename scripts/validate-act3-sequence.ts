/**
 * ACT 3 SEQUENTIAL VALIDATION — section 9 of the v7 Checker Implementation Audit.
 *
 * Run: npm run validate:act3
 *
 * *"Once the invariant tests pass, run the existing Act 3 encounters unchanged. Do not compare
 * them against an expected damage number supplied by the campaign author. Their results are
 * whatever the finalized engine calculates."*
 *
 * ⚠ NOTHING HERE HAS AN EXPECTED ANSWER. This script asserts no outcome. It runs each preset at
 * its own recorded entry state and prints what the engine says — clear/fail, completion round,
 * sustain spent, Party Clock, downs/standing, and the round each body was removed. If a number
 * looks wrong, the encounter is what changes, not the engine.
 *
 * ⚠ THE ROSTERS AND ENTRY STATES COME FROM THE v7 BUNDLE, not from my reading of the app. v7
 * `campaign_presets` carries all ten Act 3 encounters with their roster lines and entry party
 * level, Convergence state and Gift count, and `campaign_semantics.progression.stages` carries
 * the gates and what each one unlocks. RULE ONE: the document is the truth.
 */

import v7 from "../src/data/checker/v7-runtime.json";
import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { simulateEncounter, resolvePartyProfile } from "../src/core/encounter-band/checkerV2";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { diagnoseEncounter } from "../src/core/encounter-band/encounterDiagnostics";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const bundle = v7 as never as {
  campaign_presets: Array<{
    id: string; act: string; level: number; name: string; roster: string;
    stage_id: string; role: string; entry_party: Record<string, unknown>;
  }>;
};

const library = BROKEN_CHAIN_MONSTER_LIBRARY as MainMonsterTemplate[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "Snarlroot ×1; Hollow Warden ×1" → template + count pairs. */
function parseRoster(line: string): { template: MainMonsterTemplate; quantity: number; missing?: string }[] {
  return line.split(";").map(part => {
    const m = part.trim().match(/^(.*?)\s*[×x]\s*(\d+)$/i);
    const name = (m ? m[1] : part).trim();
    const quantity = m ? Number.parseInt(m[2], 10) : 1;
    const template = library.find(t => norm(t.name) === norm(name))
      ?? library.find(t => norm(t.name).includes(norm(name)) || norm(name).includes(norm(t.name)));
    return template ? { template, quantity } : { template: null as never, quantity, missing: name };
  });
}

const PARTY_SIZE = 4;
const MODE = "brokenChain" as const;

console.log("ACT 3 — F1 to F10, each at its own recorded entry state");
console.log(`party ${PARTY_SIZE} · equipment mode ${MODE} · allocation focus_fire (v7 default)\n`);
console.log("id      fight                         lvl  roster                                    result");
console.log("─".repeat(122));

const rows: string[] = [];
const notes: string[] = [];

for (const preset of bundle.campaign_presets.filter(p => /^A3-/.test(p.id))) {
  const entries = parseRoster(preset.roster);
  const missing = entries.filter(e => e.missing).map(e => e.missing);
  if (missing.length) {
    notes.push(`${preset.id}: not in the app library — ${missing.join(", ")}`);
    continue;
  }
  const level = preset.entry_party.level as number ?? preset.level;
  const defence = partyDefenceAt(level, MODE);
  const saves = {
    str: defence.str, dex: defence.dex, con: defence.con,
    int: defence.int, wis: defence.wis, cha: defence.cha,
  };
  const saveAvg = (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6;

  const built = rosterFromTemplates(entries, level, {
    ac: defence.ac, saveBonus: saveAvg, partySize: PARTY_SIZE, saves,
  });
  const profile = resolvePartyProfile({ level, size: PARTY_SIZE, equipmentMode: MODE });
  const result = simulateEncounter({
    party: { size: profile.size, sustain: profile.sustain, dpr: profile.dpr },
    roster: built.roster,
    settings: { damageAllocation: "focus_fire" },
  });
  const diag = diagnoseEncounter(result, built.roster, PARTY_SIZE, profile.sustain);

  const last = result.rounds[result.rounds.length - 1];
  const spent = last?.cumulativeMonsterDamage ?? 0;
  const clock = profile.sustain > 0 ? (spent / profile.sustain) * 100 : 0;
  const cleared = result.completionRound !== null;

  // The round each body was removed, in kill order.
  const removals: string[] = [];
  for (const r of diag.rounds) {
    for (const b of r.bodies) if (b.killedThisRound > 0) removals.push(`${b.creature}×${b.killedThisRound}@R${r.round}`);
  }

  const verdict = cleared
    ? `CLEAR R${result.completionRound}`
    : result.fatalRound !== null ? `FAIL R${result.fatalRound}` : "NO RESOLUTION";

  console.log(
    `${preset.id}  ${preset.name.slice(0, 28).padEnd(28)}  L${String(level).padEnd(2)}  ${preset.roster.slice(0, 40).padEnd(40)}  ${verdict}`,
  );
  rows.push([
    `  ${preset.id}  clock ${clock.toFixed(0)}%  sustain spent ${spent.toFixed(0)} of ${profile.sustain.toFixed(0)}`,
    `(left ${(profile.sustain - spent).toFixed(0)})  downs ${result.downsAtCompletion ?? "—"}  standing ${result.standingAtCompletion ?? "—"}`,
    `  EHP ${result.encounterEhp.toFixed(0)}  monster DPR ${result.startingEncounterDpr.toFixed(1)}  margin ${result.safetyMargin?.toFixed(2) ?? "—"}`,
    `  removals: ${removals.join(", ") || "none"}`,
    `  trace reconciles: ${diag.reconciles ? "yes" : "NO"}`,
  ].join("\n"));

  for (const a of built.assumptions) {
    if (a.flag === "NEEDS DM INPUT") notes.push(`${preset.id}: NOT PRICED — ${a.creature} · ${a.field}`);
  }
}

console.log("\n\nDETAIL\n" + "─".repeat(122));
rows.forEach(r => console.log(r + "\n"));

console.log("UNRESOLVED PRICING ASSUMPTIONS\n" + "─".repeat(122));
if (notes.length === 0) console.log("  none — every creature priced from its authored mechanics");
else notes.forEach(n => console.log("  " + n));

console.log(`
✓ FEYWILD GIFTS AND CONVERGENCE ARE IN THE CURVE, at the campaign's own gates.
  v7 party_curve.generalized_broken_chain_progression.gift_rule: "The existing validated gear
  curve already includes the generalized +2 Gift chassis and average rider for 2 bearers at
  level 8 and all 4 bearers from level 9." The Broken Chain mode says the same: "Gift counts and
  Convergence maturity come from the authored drop checkpoint for the selected level; the user
  never selects loot for the checker."

  generalizedGiftCount is 2 at L8 and 4 at L9 — exactly matching the reward ledger (2 Gifts after
  A3-06, all 4 after A3-09). So F7-F10 ARE priced with the rewards their entry state says the
  party carries, through the level-indexed curve.

  ⚠ An earlier version of this script warned the opposite, calling this the run's largest open
  item. That was wrong: I read an app-side comment about OPTIONAL hand-selected Convergence as a
  statement that the baseline was missing, and never checked the bundle. Christopher: "the
  workbook has the gifts and convergence built into the loot distribution at the gates they get
  them." It does.`);
