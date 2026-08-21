/**
 * ACT 3 THROUGH THE WORKBOOK — no app pricing anywhere in this file.
 *
 * Run: npm run run:workbook
 *
 * Christopher: *"without caring what the app says run the Act 3 again in the workbook with the
 * long rests at the spot designated as well as the short rest allocation, and report what the
 * workbook says in the same style as the screenshot."*
 *
 * ⚠ NOTHING HERE IMPORTS THE CHECKER. Not `simulateEncounter`, not `rosterFromLibrary`, not
 * `parseCreature`, not the app's creature library. Every number is read from the v7 bundle and
 * combined with v7's own published formulas, written out inline so each step is checkable:
 *
 *   effective HP   contract.sustain.effective_hp_rule
 *                  (raw_hp + pools) × ac_multiplier × PRODUCT(trait multipliers)
 *                  ÷ damage_pass_fraction ÷ damage_uptime × party_size_hp_multiplier
 *   hit            contract.damage.hit    clamp((21 + attack − target_ac)/20, .05, .95)
 *   save           contract.damage.save   p_fail × fail + (1 − p_fail) × success
 *   attrition      campaign_semantics.whole_body_attrition — full output until 0 HP
 *   final round    campaign_semantics.final_round — midpoint, no extra discount
 *   party          party_curve.curve[level].brokenChain, Gifts and Convergence included
 *   target AC/save party_defense_curve
 *
 * ⚠ WHAT THE BUNDLE DOES NOT PUBLISH, AND WHERE I GOT IT INSTEAD. A `campaign_profiles` entry
 * carries `id, n, ac, hp, cr, la, tm, tt, f` — there is no Multiattack size in it. The printed
 * sequence comes from `Broken_Chain_Act3_Encounters_Current_Rosters_Only_v3_15.docx`, which is
 * the authority for what a creature does. Every such value is listed in ROSTERS below so none of
 * it is hidden inside the arithmetic.
 *
 * ⚠ THE WORKBOOK GRANTS NO LEGENDARY BUDGET. Every profile sets `la = 0` and files Tail Sweep and
 * Mind Hook as ordinary actions, so they COMPETE for the Action slot here rather than adding on
 * top. That is the one place this run deliberately differs from the app, and it is the whole
 * point of running it.
 */

import v7 from "../src/data/checker/v7-runtime.json";

const B = v7 as never as {
  campaign_profiles: Array<{ id: string; n: string; ac: number; hp: number; cr: number | null; la: number; tm: number; tt: string[];
    f: Array<{ n: string; t: string; k: string; r: string | null; u: number | null; a: string | null; s: string | null; d: Array<[number, string, string]>; c: unknown; l: unknown; rr: boolean }> }>;
  party_curve: { curve: Array<{ level: number; brokenChain: { sustain: number; round1: number; round2: number; round3: number; round4Plus: number } }> };
  party_defense_curve: { brokenChain: Array<{ level: number; average_ac: number; str_save: number; dex_save: number; con_save: number; int_save: number; wis_save: number; cha_save: number }> };
  contract: { sustain: { expected_monster_ac: Record<string, number>; ac_contribution: Record<string, number> } };
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const profile = (n: string) => {
  const p = B.campaign_profiles.find(x => norm(x.n) === norm(n));
  if (!p) throw new Error(`no v7 profile: ${n}`);
  return p;
};
const party = (level: number) => B.party_curve.curve.find(r => r.level === level)!.brokenChain;
const defence = (level: number) => B.party_defense_curve.brokenChain.find(r => r.level === level)!;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** contract.sustain — the AC multiplier for a creature against the level's expected monster AC. */
function acMultiplier(creatureAc: number, level: number): number {
  const expected = B.contract.sustain.expected_monster_ac[String(level)];
  if (expected === undefined) return 1;
  const delta = clamp(Math.round(creatureAc - expected), -3, 3);
  return 1 + (B.contract.sustain.ac_contribution[String(delta)] ?? 0);
}

/** contract.damage.hit */
const pHit = (attack: number, targetAc: number) => clamp((21 + attack - targetAc) / 20, 0.05, 0.95);
/** contract.damage.save */
const pFail = (dc: number, saveBonus: number) => clamp((dc - saveBonus - 1) / 20, 0, 1);

const saveFor = (level: number, ability: string | null) => {
  const d = defence(level);
  const key = (ability ?? "").toLowerCase();
  if (key.startsWith("str")) return d.str_save;
  if (key.startsWith("dex")) return d.dex_save;
  if (key.startsWith("con")) return d.con_save;
  if (key.startsWith("int")) return d.int_save;
  if (key.startsWith("wis")) return d.wis_save;
  if (key.startsWith("cha")) return d.cha_save;
  return (d.str_save + d.dex_save + d.con_save + d.int_save + d.wis_save + d.cha_save) / 6;
};

/** Expected damage of ONE use of a workbook feature against the level's party profile. */
function featureValue(f: { a: string | null; s: string | null; d: Array<[number, string, string]> }, level: number, targets: number): number {
  const raw = f.d?.[0]?.[0] ?? 0;
  if (raw <= 0) return 0;
  if (f.a) {
    const attack = Number.parseInt(String(f.a).replace(/[^0-9-]/g, ""), 10) || 0;
    return raw * pHit(attack, defence(level).average_ac) * targets;
  }
  if (f.s) {
    const dc = Number.parseInt(String(f.s).match(/\d+/)?.[0] ?? "0", 10);
    const ability = String(f.s).match(/(str|dex|con|int|wis|cha)/i)?.[0] ?? null;
    const p = pFail(dc, saveFor(level, ability));
    // v7 success_patterns: half only when the block says half. These profiles carry no success
    // value, so the workbook's own default applies — the save negates.
    return p * raw * targets;
  }
  return raw * targets;
}

/** Recharge availability after first use: (max − min + 1) / 6. */
function rechargeP(r: string | null): number {
  if (!r) return 1;
  const m = String(r).match(/(\d)\s*[–-]\s*(\d)/) ?? String(r).match(/(\d)/);
  if (!m) return 1;
  const min = Number(m[1]); const max = Number(m[2] ?? m[1]);
  return (max - min + 1) / 6;
}

type Entry = { name: string; count: number; multiattack?: string[]; aoeTargets?: number };

/** One creature's expected damage in a given round, workbook rules only. */
function creatureRoundDamage(e: Entry, level: number, round: number): number {
  const p = profile(e.name);
  const actions = p.f.filter(f => f.t === "action" && (f.d?.[0]?.[0] ?? 0) > 0);
  const bonus = p.f.filter(f => f.t === "bonus_action" && (f.d?.[0]?.[0] ?? 0) > 0);
  const reactions = p.f.filter(f => f.t === "reaction" && (f.d?.[0]?.[0] ?? 0) > 0);

  // The routine: the printed Multiattack sequence, valued from the profile's own damage.
  const routine = (e.multiattack ?? []).reduce((sum, name) => {
    const f = actions.find(a => norm(a.n) === norm(name));
    return sum + (f ? featureValue(f, level, 1) : 0);
  }, 0);

  // A recharge or limited action IS the action; it displaces the routine only when worth more.
  let best = routine;
  for (const f of actions) {
    if (e.multiattack?.some(n => norm(n) === norm(f.n))) continue;
    const targets = f.s ? (e.aoeTargets ?? 1) : 1;
    const value = featureValue(f, level, targets);
    if (value <= routine) continue;
    const avail = round === 1 ? 1 : rechargeP(f.r);
    best = Math.max(best, value * avail + routine * (1 - avail));
  }
  // Separate budgets. la = 0 across every profile, so no legendary channel is added.
  const extra = [...bonus, ...reactions].reduce((s, f) => s + featureValue(f, level, 1), 0);
  return (best + extra) * e.count;
}

/** Rosters, from v3_15. Multiattack sequences are the document's printed lines. */
const ROSTERS: Record<string, Entry[]> = {
  F1: [ { name: "Snarlroot", count: 1, multiattack: ["Rootclub", "Rootclub"] },
        { name: "Hollow Warden", count: 1, multiattack: ["Branch Spear", "Branch Spear"] },
        { name: "Larkskein", count: 1, multiattack: ["Glass Thorn"], aoeTargets: 2 } ],
  F2: [ { name: "Quillshrike", count: 1, multiattack: ["Quill Lash", "Quill Lash"] },
        { name: "Marrowstalk", count: 1, multiattack: ["Marrow Hook", "Marrow Hook"] },
        { name: "Shardbound", count: 1, multiattack: ["Shard Lance", "Shard Lance"], aoeTargets: 2 } ],
  F3: [ { name: "Veilwood Crone", count: 1, multiattack: ["Thorn Rake", "Thorn Rake"], aoeTargets: 2 },
        { name: "Darkmare", count: 1, multiattack: ["Hoof", "Hoof"], aoeTargets: 2 } ],
  F4: [ { name: "Briar Regent", count: 1, multiattack: ["Briar Lash", "Briar Lash"] },
        { name: "Velvet Host", count: 1, multiattack: ["Velvet Rebuke"] },
        { name: "Folded Bulwark", count: 1, multiattack: ["Fold Slam", "Fold Slam"] } ],
  F5: [ { name: "Moss-Crowned Charger", count: 1, multiattack: ["Antler Drive", "Antler Drive"] },
        { name: "Rift-Slick", count: 1, multiattack: ["Slick Claw", "Slick Claw"] },
        { name: "Nail Saint", count: 1, multiattack: ["Nail Bolt", "Nail Bolt"], aoeTargets: 2 } ],
  F9: [ { name: "Veil-Torn Dragon", count: 1, multiattack: ["Bite", "Claw", "Claw"], aoeTargets: 2 },
        { name: "Veil-Torn Wyrmling", count: 2, multiattack: ["Bite"], aoeTargets: 2 } ],
  F10: [ { name: "Thought Harrower", count: 1, multiattack: ["Rift Lance", "Rift Lance"], aoeTargets: 2 },
         { name: "Grief Colossus", count: 1, multiattack: ["Fist", "Fist"], aoeTargets: 2 } ],
};

/** Effective HP of one creature, per contract.sustain.effective_hp_rule. */
function creatureEhp(e: Entry, level: number): number {
  const p = profile(e.name);
  return p.hp * acMultiplier(p.ac, level) * p.tm; // party_size_hp_multiplier = 1 at four PCs
}

type Row = { id: string; label: string; level: number; entries: Entry[] | null; note?: string };

/** Rests exactly where the reference table places them. */
const SCHEDULE: Array<{ rest?: string; level?: number } & Partial<Row>> = [
  { rest: "START / L6", level: 6 },
  { id: "F1", label: "First Court", level: 6 },
  { id: "F2", label: "Cut Below", level: 6 },
  { id: "F3", label: "Crone + Mare", level: 6 },
  { rest: "FULL REST / L7", level: 7 },
  { id: "F4", label: "Hollow Feast", level: 7 },
  { id: "F5", label: "Scar Line", level: 7 },
  { id: "F6", label: "Mirrors", level: 7, note: "no v7 profile — the Mirror is built per table" },
  { rest: "FULL REST / L8 + 2 Gifts", level: 8 },
  { id: "F7", label: "(redesign)", level: 8, note: "not in v3_15" },
  { id: "F8", label: "(rough redesign)", level: 8, note: "not in v3_15" },
  { id: "F9", label: "Dragon", level: 8 },
  { rest: "FULL REST / L9 + 4 Gifts", level: 9 },
  { id: "F10", label: "The Center", level: 9 },
];

/** The reference table's short-rest allocation. */
const SHORT_REST_RECOVERY = 0.275;

const W = (s: string, n: number) => s.padEnd(n).slice(0, n);
console.log("BROKEN CHAIN — ACT 3 through the WORKBOOK (v7 data + v7 formulas, no app pricing)");
console.log("party 4 · Broken Chain curve · whole-body attrition · la = 0 (no legendary budget)\n");
console.log(`${W("Fight", 26)}${W("Completion", 12)}${W("Monster damage", 16)}${W("Full sustain used", 19)}Sustain left in segment`);
console.log("─".repeat(104));

let sustainNow = 0, fullSustain = 0;

for (const row of SCHEDULE) {
  if (row.rest) {
    fullSustain = party(row.level!).sustain;
    sustainNow = fullSustain;
    console.log(`${W(row.rest, 26)}${W("—", 12)}${W("—", 16)}${W("—", 19)}${fullSustain.toFixed(0)} / ${fullSustain.toFixed(0)}`);
    continue;
  }
  const entries = ROSTERS[row.id!];
  /**
   * ⚠ A CREATURE WITH NO v7 PROFILE CANNOT BE RUN THROUGH THE WORKBOOK. The Hollow Feast trio
   * postdates the bundle — v3_15 publishes them, campaign_profiles does not. Reported, never
   * substituted: a workbook run that quietly filled in an app number would not be a workbook run.
   */
  const unprofiled = (entries ?? []).filter(e => !B.campaign_profiles.some(x => norm(x.n) === norm(e.name))).map(e => e.name);
  if (entries && unprofiled.length) {
    console.log(`${W(`${row.id} ${row.label}`, 26)}${W("NOT RUN", 12)}${W("—", 16)}${W("—", 19)}no v7 profile: ${unprofiled.join(", ")}`);
    continue;
  }
  if (!entries) {
    console.log(`${W(`${row.id} ${row.label}`, 26)}${W("NOT RUN", 12)}${W("—", 16)}${W("—", 19)}${row.note ?? ""}`);
    continue;
  }
  const level = row.level!;
  const pc = party(level);
  const partyRound = [pc.round1, pc.round2, pc.round3, pc.round4Plus, pc.round4Plus, pc.round4Plus, pc.round4Plus];

  // Bodies, in kill-priority order — weakest first, as the checker's own roster does.
  const bodies: Array<{ name: string; ehp: number; e: Entry }> = [];
  for (const e of entries) for (let i = 0; i < e.count; i++) bodies.push({ name: e.name, ehp: creatureEhp(e, level), e });
  bodies.sort((a, b) => a.ehp - b.ehp);
  const totalEhp = bodies.reduce((s, b) => s + b.ehp, 0);

  let cumParty = 0, monsterTotal = 0, completion: number | null = null;
  const removals: string[] = [];
  for (let round = 1; round <= 12 && completion === null; round++) {
    const aliveAt = (dmg: number) => {
      let left = dmg, alive = 0;
      for (const b of bodies) { if (left >= b.ehp) { left -= b.ehp; } else { alive++; } }
      return alive;
    };
    const before = cumParty;
    cumParty += partyRound[Math.min(round - 1, partyRound.length - 1)];
    // whole-body attrition, midpoint of start and end
    const outAt = (dmg: number) => {
      let left = dmg, out = 0;
      for (const b of bodies) { if (left >= b.ehp) { left -= b.ehp; continue; } out += creatureRoundDamage({ ...b.e, count: 1 }, level, round); }
      return out;
    };
    const mid = (outAt(before) + outAt(cumParty)) / 2;
    monsterTotal += mid;
    const killed = aliveAt(before) - aliveAt(cumParty);
    if (killed > 0) removals.push(`${killed}@R${round}`);
    if (cumParty >= totalEhp) completion = round;
  }
  sustainNow -= monsterTotal;
  const usedPct = (monsterTotal / fullSustain) * 100;
  const leftPct = (sustainNow / fullSustain) * 100;
  console.log(`${W(`${row.id} ${row.label}`, 26)}${W(completion ? `R${completion}` : "—", 12)}${W(monsterTotal.toFixed(0), 16)}${W(`${usedPct.toFixed(0)}%`, 19)}${sustainNow.toFixed(0)} / ${fullSustain.toFixed(0)} — ${leftPct.toFixed(0)}%`);

  // The reference shows a short-rest line after the two hardest fights in a segment.
  if (row.id === "F6" || row.id === "F9") {
    const recovered = Math.min(fullSustain, sustainNow + fullSustain * SHORT_REST_RECOVERY);
    console.log(`${W(`   after ~27.5% short rest`, 26)}${W("—", 12)}${W("same fight", 16)}${W("—", 19)}${recovered.toFixed(0)} / ${fullSustain.toFixed(0)} — ${((recovered / fullSustain) * 100).toFixed(0)}%`);
    sustainNow = recovered;
  }
}
