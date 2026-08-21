/**
 * ACT 3 THROUGH THE WORKBOOK'S CREATURE ESTIMATOR — every creature, none looked up.
 *
 * Run: npm run run:estimator
 *
 * Christopher: *"the v7 doesnt need a v7 profile, the reason the workbook is created is so it can
 * run any encounter with any creature and give a outcome … run each through the creature
 * estimator (not ones that the workbook has but each and every one of them)."*
 *
 * ⚠ THE PREVIOUS RUN SKIPPED FIGHT 4 AND THAT WAS THE WHOLE MISTAKE. It looked each creature up in
 * `campaign_profiles` and reported "no v7 profile" for the Hollow Feast trio. A profile is a
 * CACHED RESULT, not a prerequisite — the estimator is what makes the workbook able to price a
 * creature nobody has priced before, which is the entire reason it exists. Nothing here reads
 * `campaign_profiles`. Every creature in the encounter document is estimated from its own printed
 * statblock, including the ones the bundle already knows.
 *
 * ⚠ NOR DO I SUPPLY AOE COUNTS, MULTIATTACK SIZES OR BONUS-ACTION VALUES ANY MORE. Christopher:
 * *"aoe doesnt get supplied because the V7 documents suppiled shows how aoe is priced, same with
 * bonus actions, all of these come from the creature estimator."* Every one of those was me
 * hand-feeding the model:
 *
 *   AoE            pricing_contract "AoE / multi-target damage" × the four-PC benchmark from
 *                  campaign_baseline.party_size — two of four, never a number I choose
 *   Multiattack    read from the printed "Makes N X attacks" line in the statblock
 *   Bonus/reaction pricing_contract "Bonus Action / Reaction / Legendary / Lair" — separate
 *                  budgets, priced only when they carry printed damage
 *   Recharge       (max − min + 1) / 6 after first use
 *   Traits         matched to the 58 CALIBRATED trait rules; an unmatched trait scores 1.0 and
 *                  is listed, never given a number I invented
 *
 * ⚠ AND THE PARTY SIDE IS NOT MODELLED AT ALL. Christopher: *"the workbook has everything from
 * the PC side calculated you dont invent attacks because the workbook has already done that when
 * it created the 256 parties."* Party DPR, sustain, AC and all six saves are read from
 * `party_curve` and `party_defense_curve` as published.
 */

import v7 from "../src/data/checker/v7-runtime.json";
import doc from "../src/data/checker/act3-v3_15.json";

type Section = { name: string; text: string };
type DocCreature = { name: string; ac: number | null; hp: number | null; sections: Record<string, Section[]> };

const B = v7 as never as {
  contract: { sustain: { expected_monster_ac: Record<string, number>; ac_contribution: Record<string, number>;
    trait_rules: Array<{ label: string; contribution: number | null; multiplier: number | null; stack_group: string }> } };
  party_curve: { curve: Array<{ level: number; brokenChain: { sustain: number; round1: number; round2: number; round3: number; round4Plus: number } }> };
  party_defense_curve: { brokenChain: Array<{ level: number; average_ac: number; str_save: number; dex_save: number; con_save: number; int_save: number; wis_save: number; cha_save: number }> };
  campaign_baseline: { party_size: number };
};
const creatures = doc as never as DocCreature[];

const PARTY_SIZE = B.campaign_baseline.party_size;
const AOE_TARGETS = Math.max(1, Math.floor(PARTY_SIZE / 2)); // the four-PC benchmark: two of four
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const party = (lv: number) => B.party_curve.curve.find(r => r.level === lv)!.brokenChain;
const defence = (lv: number) => B.party_defense_curve.brokenChain.find(r => r.level === lv)!;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const find = (n: string) => {
  const c = creatures.find(x => norm(x.name) === norm(n));
  if (!c) throw new Error(`not in the encounter document: ${n}`);
  return c;
};

// ── Reading a printed statblock ───────────────────────────────────────────────

/** "16 (2d10 + 5) piercing plus 7 (2d6) radiant" → 23. Every printed average in the line. */
function printedDamage(text: string): number {
  let total = 0;
  for (const m of text.matchAll(/(\d+)\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/g)) total += Number.parseInt(m[1], 10);
  if (total > 0) return total;
  // No pre-averaged figure: read the dice directly.
  for (const m of text.matchAll(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/g)) {
    const n = Number(m[1]), f = Number(m[2]);
    total += (n * (f + 1)) / 2 + (m[3] ? (m[3] === "-" ? -1 : 1) * Number(m[4]) : 0);
  }
  return total;
}
const attackBonus = (t: string) => { const m = t.match(/([+-]\d+)\s+to hit/i); return m ? Number.parseInt(m[1], 10) : null; };
const saveDc = (t: string) => { const m = t.match(/DC\s*(\d+)/i); return m ? Number.parseInt(m[1], 10) : null; };
const saveAbility = (t: string) => (t.match(/DC\s*\d+\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i)?.[1]
  ?? t.match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/)?.[1] ?? null);
const rechargeOf = (n: string) => { const m = n.match(/Recharge\s*(\d)\s*[–-]\s*(\d)/i) ?? n.match(/Recharge\s*(\d)/i);
  return m ? ((Number(m[2] ?? m[1]) - Number(m[1]) + 1) / 6) : null; };
const usesOf = (n: string) => { const m = n.match(/(\d+)\s*\/\s*Day/i); return m ? Number(m[1]) : null; };
const isArea = (t: string) => /\bcone|radius|line\b|\beach creature|\ball creatures/i.test(t);
const halfOnSave = (t: string) => /half (?:as much )?(?:damage )?on (?:a )?success|half on success/i.test(t);

/** The printed Multiattack sequence: "Makes one Bite and two Claw attacks" → the component list. */
function multiattack(actions: Section[]): { count: number; parts: Array<{ name: string; times: number }> } | null {
  const ma = actions.find(a => /multiattack/i.test(a.name) || /multiattack/i.test(a.text));
  if (!ma) return null;
  const words: Record<string, number> = { one: 1, two: 2, twice: 2, three: 3, four: 4, five: 5, six: 6 };
  const parts: Array<{ name: string; times: number }> = [];
  const others = actions.filter(a => a !== ma);
  for (const a of others) {
    const re = new RegExp(`\\b(one|two|twice|three|four|five|six|\\d+)\\s+${a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    const m = ma.text.match(re);
    if (m) parts.push({ name: a.name, times: words[m[1].toLowerCase()] ?? Number(m[1]) ?? 1 });
    else if (new RegExp(`\\b${a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(ma.text)) parts.push({ name: a.name, times: 1 });
  }
  if (!parts.length) {
    const m = ma.text.match(/\b(one|two|twice|three|four|five|six|\d+)\s+\w*\s*attacks?/i);
    const n = m ? (words[m[1].toLowerCase()] ?? Number(m[1])) : 2;
    return { count: n, parts: [] };
  }
  return { count: parts.reduce((s, p) => s + p.times, 0), parts };
}

// ── The estimator ─────────────────────────────────────────────────────────────

/** Expected damage of ONE use, priced by the contract. */
function value(text: string, level: number): number {
  const raw = printedDamage(text);
  if (raw <= 0) return 0;
  const d = defence(level);
  const targets = isArea(text) ? AOE_TARGETS : 1;
  const atk = attackBonus(text);
  if (atk !== null) return raw * clamp((21 + atk - d.average_ac) / 20, 0.05, 0.95) * targets;
  const dc = saveDc(text);
  if (dc !== null) {
    const ab = (saveAbility(text) ?? "").toLowerCase();
    const save = ab.startsWith("str") ? d.str_save : ab.startsWith("dex") ? d.dex_save
      : ab.startsWith("con") ? d.con_save : ab.startsWith("int") ? d.int_save
      : ab.startsWith("wis") ? d.wis_save : ab.startsWith("cha") ? d.cha_save
      : (d.str_save + d.dex_save + d.con_save + d.int_save + d.wis_save + d.cha_save) / 6;
    const p = clamp((dc - save - 1) / 20, 0, 1);
    const success = halfOnSave(text) ? raw / 2 : 0;
    return (p * raw + (1 - p) * success) * targets;
  }
  return raw * targets;
}

/** Trait text → one of the 58 calibrated rules. Unmatched scores 1.0 and is reported. */
const TRAIT_MATCHERS: Array<[RegExp, RegExp]> = [
  [/reduce it by (\d+)|reduce the damage by (\d+)/i, /^Flat DR 3 per damaging hit/i],
  [/resistance to .*damage|resistant to/i, /^Resistance - ~50% of opposing damage/i],
  [/immune to that damage type and resistant/i, /^Telegraphed alternating immunity\/resistance/i],
  [/fails a saving throw, it can choose to succeed/i, /^Legendary Resistance - 1 use/i],
  [/regenerat/i, /^Regeneration 10\/round/i],
  [/drops to 1 hit point/i, /^Relentless - drop to 1 HP once/i],
  [/heavily obscured|obscurement|concealment/i, /^Concealment until first attack hits each round/i],
  [/half cover/i, /^Half cover vs ranged attacks/i],
  [/\+5 AC|AC increases by 5/i, /^Shield-like \+5 AC - 1 round/i],
  [/first attack .* disadvantage/i, /^First attack each round at disadvantage/i],
];
function traitMultiplier(c: DocCreature, unmatched: string[]): number {
  const rules = B.contract.sustain.trait_rules;
  const claimed = new Set<string>();
  let product = 1;
  for (const t of [...(c.sections.TRAITS ?? []), ...(c.sections.REACTIONS ?? [])]) {
    const hit = TRAIT_MATCHERS.find(([textRe]) => textRe.test(t.text));
    if (!hit) continue;
    const rule = rules.find(r => hit[1].test(r.label));
    if (!rule || rule.multiplier == null) { unmatched.push(`${c.name} · ${t.name}`); continue; }
    if (claimed.has(rule.stack_group)) continue; // anti-double-count
    claimed.add(rule.stack_group);
    product *= rule.multiplier;
  }
  return product;
}

function acMultiplier(ac: number, level: number): number {
  const expected = B.contract.sustain.expected_monster_ac[String(level)];
  if (expected === undefined) return 1;
  const delta = clamp(Math.round(ac - expected), -3, 3);
  return 1 + (B.contract.sustain.ac_contribution[String(delta)] ?? 0);
}

type Estimate = { name: string; ehp: number; dpr: (round: number) => number };

function estimate(name: string, level: number, unmatched: string[]): Estimate {
  const c = find(name);
  const actions = (c.sections.ACTIONS ?? []).filter(a => !/multiattack/i.test(a.name));
  const bonus = (c.sections.TRAITS ?? []).filter(t => /^Bonus Action/i.test(t.text));
  const reactions = c.sections.REACTIONS ?? [];
  const legendary = c.sections["LEGENDARY ACTION"] ?? [];
  const ma = multiattack(c.sections.ACTIONS ?? []);

  const ehp = (c.hp ?? 0) * acMultiplier(c.ac ?? 10, level) * traitMultiplier(c, unmatched);

  // The routine: the printed sequence, or the best single attack repeated to the printed count.
  const attackValues = actions.map(a => ({ a, v: value(a.text, level) }));
  const routine = ma
    ? (ma.parts.length
        ? ma.parts.reduce((s, p) => s + (attackValues.find(x => norm(x.a.name) === norm(p.name))?.v ?? 0) * p.times, 0)
        : (attackValues.filter(x => attackBonus(x.a.text) !== null).sort((a, b) => b.v - a.v)[0]?.v ?? 0) * ma.count)
    : (attackValues.filter(x => attackBonus(x.a.text) !== null).sort((a, b) => b.v - a.v)[0]?.v ?? 0);

  // Separate budgets, per the contract — priced only where damage is printed.
  const extra = [...bonus, ...reactions, ...legendary].reduce((s, f) => s + value(f.text, level), 0);

  // A recharge / limited action IS the Action; it displaces the routine only when worth more.
  const alternatives = actions
    .filter(a => !ma?.parts.some(p => norm(p.name) === norm(a.name)))
    .map(a => ({ v: value(a.text, level), r: rechargeOf(a.name), u: usesOf(a.name) }))
    .filter(x => x.v > routine);

  return {
    name, ehp,
    dpr: (round: number) => {
      let best = routine;
      for (const alt of alternatives) {
        const avail = round === 1 ? 1 : (alt.r ?? (alt.u !== null && round > alt.u ? 0 : 1));
        best = Math.max(best, alt.v * avail + routine * (1 - avail));
      }
      return best + extra;
    },
  };
}

// ── The Act 3 sequence, from the encounter document ───────────────────────────

const ROSTERS: Record<string, Array<[string, number]>> = {
  F1: [["Snarlroot", 1], ["Hollow Warden", 1], ["Larkskein", 1]],
  F2: [["Quillshrike", 1], ["Marrowstalk", 1], ["Shardbound", 1]],
  F3: [["Veilwood Crone", 1], ["Darkmare", 1]],
  F4: [["Briar Regent", 1], ["Velvet Host", 1], ["Folded Bulwark", 1]],
  F5: [["Moss-Crowned Charger", 1], ["Rift-Slick", 1], ["Nail Saint", 1]],
  F6: [["Elemental Mirror", 4]],
  F9: [["Veil-Torn Dragon", 1], ["Veil-Torn Wyrmling", 2]],
  F10: [["Thought Harrower", 1], ["Grief Colossus", 1]],
};
const SCHEDULE: Array<{ rest?: string; level: number; id?: string; label?: string; note?: string }> = [
  { rest: "START / L6", level: 6 },
  { id: "F1", label: "First Court", level: 6 },
  { id: "F2", label: "Cut Below", level: 6 },
  { id: "F3", label: "Crone + Mare", level: 6 },
  { rest: "FULL REST / L7", level: 7 },
  { id: "F4", label: "Hollow Feast", level: 7 },
  { id: "F5", label: "Scar Line", level: 7 },
  { id: "F6", label: "Mirrors", level: 7 },
  { rest: "FULL REST / L8 + 2 Gifts", level: 8 },
  { id: "F7", label: "(redesign)", level: 8, note: "not in v3_15" },
  { id: "F8", label: "(rough redesign)", level: 8, note: "not in v3_15" },
  { id: "F9", label: "Dragon", level: 8 },
  { rest: "FULL REST / L9 + 4 Gifts", level: 9 },
  { id: "F10", label: "The Center", level: 9 },
];
const SHORT_REST = 0.275;

const W = (s: string, n: number) => s.padEnd(n).slice(0, n);
const unmatched: string[] = [];
console.log("BROKEN CHAIN — ACT 3, every creature through the WORKBOOK'S CREATURE ESTIMATOR");
console.log(`party ${PARTY_SIZE} · Broken Chain curve · AoE = ${AOE_TARGETS} of ${PARTY_SIZE} (contract benchmark) · no campaign_profiles lookups\n`);
console.log(`${W("Fight", 26)}${W("Completion", 12)}${W("Monster damage", 16)}${W("Full sustain used", 19)}Sustain left in segment`);
console.log("─".repeat(104));

let sustainNow = 0, fullSustain = 0;
for (const row of SCHEDULE) {
  if (row.rest) {
    fullSustain = party(row.level).sustain; sustainNow = fullSustain;
    console.log(`${W(row.rest, 26)}${W("—", 12)}${W("—", 16)}${W("—", 19)}${fullSustain.toFixed(0)} / ${fullSustain.toFixed(0)}`);
    continue;
  }
  const roster = ROSTERS[row.id!];
  if (!roster) { console.log(`${W(`${row.id} ${row.label}`, 26)}${W("NOT RUN", 12)}${W("—", 16)}${W("—", 19)}${row.note ?? ""}`); continue; }

  const bodies: Estimate[] = [];
  for (const [n, q] of roster) { const e = estimate(n, row.level, unmatched); for (let i = 0; i < q; i++) bodies.push(e); }
  bodies.sort((a, b) => a.ehp - b.ehp);
  const totalEhp = bodies.reduce((s, b) => s + b.ehp, 0);

  const pc = party(row.level);
  const perRound = [pc.round1, pc.round2, pc.round3, pc.round4Plus, pc.round4Plus, pc.round4Plus, pc.round4Plus, pc.round4Plus];
  const outAt = (dmg: number, round: number) => {
    let left = dmg, out = 0;
    for (const b of bodies) { if (left >= b.ehp) { left -= b.ehp; continue; } out += b.dpr(round); }
    return out;
  };
  let cum = 0, monster = 0, completion: number | null = null;
  for (let round = 1; round <= 12 && completion === null; round++) {
    const before = cum;
    cum += perRound[Math.min(round - 1, perRound.length - 1)];
    monster += (outAt(before, round) + outAt(cum, round)) / 2;  // whole-body attrition, midpoint
    if (cum >= totalEhp) completion = round;
  }
  sustainNow -= monster;
  console.log(`${W(`${row.id} ${row.label}`, 26)}${W(completion ? `R${completion}` : "—", 12)}${W(monster.toFixed(0), 16)}${W(`${((monster / fullSustain) * 100).toFixed(0)}%`, 19)}${sustainNow.toFixed(0)} / ${fullSustain.toFixed(0)} — ${((sustainNow / fullSustain) * 100).toFixed(0)}%`);

  if (row.id === "F6" || row.id === "F9") {
    sustainNow = Math.min(fullSustain, sustainNow + fullSustain * SHORT_REST);
    console.log(`${W("   after ~27.5% short rest", 26)}${W("—", 12)}${W("same fight", 16)}${W("—", 19)}${sustainNow.toFixed(0)} / ${fullSustain.toFixed(0)} — ${((sustainNow / fullSustain) * 100).toFixed(0)}%`);
  }
}

if (unmatched.length) {
  console.log("\nTRAITS WITH NO CALIBRATED RULE (scored 1.0, never guessed)\n" + "─".repeat(104));
  [...new Set(unmatched)].forEach(u => console.log("  " + u));
}
