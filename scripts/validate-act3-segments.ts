/**
 * ACT 3 SEQUENTIAL RUN — the record style from Christopher's own table.
 *
 * Run: npm run validate:segments
 *
 * ⚠ THIS IS NOT THE SECTION 9 RUN. That one priced each encounter independently at its recorded
 * entry state, which is v7's `runner_default`. This one carries SUSTAIN ACROSS the fights in a
 * segment and resets it only at a full rest, which is how the party actually walks the act — and
 * it is the shape of the reference table, so it is the only shape a comparison can be made in.
 *
 * ⚠ NOTHING IS TUNED TO MATCH. Christopher: *"do not fabricate the number to match tell me why
 * they dont match."* Every figure below is whatever the engine calculates. Where it disagrees
 * with the reference, the disagreement is printed, not closed.
 *
 * Rosters are read from `Broken_Chain_Act3_Encounters_Current_Rosters_Only_v3_15.docx`, which is
 * the current authority for what is in each fight.
 */

import { BROKEN_CHAIN_MONSTER_LIBRARY } from "../src/data/broken-chain/monsterLibrary";
import { rosterFromTemplates } from "../src/core/encounter-band/rosterFromLibrary";
import { simulateEncounter, resolvePartyProfile } from "../src/core/encounter-band/checkerV2";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const lib = BROKEN_CHAIN_MONSTER_LIBRARY as MainMonsterTemplate[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/**
 * ⚠ THE AUTHORED ID IS THE REFERENCE. A NAME IS NOT.
 *
 * This validator crashed with `not in library: Veil-Torn Wyrmling`, because the authored entry for
 * `broken-chain:act3:veil-torn-wyrmling:v1` is now named "Veilbound Drake Guard". The creature never
 * moved; only its label did, which is what authoring is for.
 *
 * Christopher: *"there should be no 'snapshot' only my authored id, because snapshot means it
 * reverts to things from before the changes."* So this does NOT keep a table of old names. A roster
 * entry may be written as the authored templateId, and where a name has drifted the id is what this
 * file records — nothing here remembers what a creature used to be called, because remembering that
 * is how a validator quietly starts measuring the wrong creature.
 *
 * ⚠ AND NOTHING CAUGHT THE CRASH, because this validator is not in `.github/workflows/gates.yml`.
 * A gate that is never run is not a gate — one step earlier than the `check:summons` exit-code
 * fault MASTER records: that one could not fail, this one could not be reached.
 */
const find = (n: string) => {
  const byId = lib.find(m => m.templateId === n);
  if (byId) return byId;
  const t = lib.find(m => norm(m.name) === norm(n));
  if (!t) throw new Error(`not in library: ${n}`);
  return t;
};

type Fight = {
  id: string; label: string; level: number;
  roster?: Array<[string, number]>;
  /** Set when the fight cannot be priced, with the reason. */
  blocked?: string;
  /** Reference row from Christopher's table, for comparison only — never an input. */
  doc?: { completion: string; monsterDamage: number; usedPct: number; leftPct: number };
  /** A second kill order to report separately, where order materially changes the trace. */
  altOrder?: Array<[string, number]>;
  altLabel?: string;
  /** F6 only: the roster is four built Mirrors rather than library creatures. */
  mirrors?: boolean;
  altDoc?: { completion: string; monsterDamage: number; usedPct: number; leftPct: number };
  /** What the CURRENT library actually produces. Drift from this fails the gate. */
  ref?: { completion: string; monsterDamage: number; usedPct: number; leftPct: number };
  altRef?: { completion: string; monsterDamage: number; usedPct: number; leftPct: number };
};

/** Segments reset sustain at a full rest, exactly as the reference table does. */
const SEGMENTS: Array<{ label: string; level: number; fights: Fight[] }> = [
  {
    label: "Level 6", level: 6, fights: [
      { id: "F1", label: "First Court", level: 6, roster: [["Snarlroot", 1], ["Hollow Warden", 1], ["Larkskein", 1]],
        doc: { completion: "R3", monsterDamage: 44, usedPct: 13, leftPct: 87 },
        ref: { completion: "R3", monsterDamage: 45, usedPct: 13, leftPct: 87 } },
      { id: "F2", label: "Cut Below", level: 6, roster: [["Quillshrike", 1], ["Marrowstalk", 1], ["Shardbound", 1]],
        doc: { completion: "R3", monsterDamage: 93, usedPct: 27, leftPct: 60 },
        ref: { completion: "R2", monsterDamage: 82, usedPct: 24, leftPct: 62 } },
      { id: "F3", label: "Crone + Mare", level: 6, roster: [["Veilwood Crone", 1], ["Darkmare", 1]],
        doc: { completion: "R4", monsterDamage: 113, usedPct: 33, leftPct: 26 },
        ref: { completion: "R3", monsterDamage: 124, usedPct: 37, leftPct: 26 } },
    ],
  },
  {
    label: "Level 7", level: 7, fights: [
      { id: "F4", label: "Hollow Feast", level: 7, roster: [["Briar Regent", 1], ["Velvet Host", 1], ["Folded Bulwark", 1]],
        doc: { completion: "R3", monsterDamage: 59, usedPct: 15, leftPct: 85 },
        ref: { completion: "R3", monsterDamage: 55, usedPct: 14, leftPct: 86 } },
      { id: "F5", label: "Scar Line", level: 7, roster: [["Moss-Crowned Charger", 1], ["Rift-Slick", 1], ["Nail Saint", 1]],
        doc: { completion: "R3", monsterDamage: 86, usedPct: 22, leftPct: 63 },
        ref: { completion: "R3", monsterDamage: 91, usedPct: 23, leftPct: 63 } },
      { id: "F6", label: "Mirrors (4 built)", level: 7, mirrors: true,
        doc: { completion: "R5", monsterDamage: 135, usedPct: 34, leftPct: 29 },
        ref: { completion: "R5", monsterDamage: 70, usedPct: 18, leftPct: 45 } },
    ],
  },
  {
    label: "Level 8 + 2 Gifts", level: 8, fights: [
      { id: "F7", label: "(redesign)", level: 8, blocked: "Not in v3_15 — the document jumps from FIGHT 6 to FIGHT 9." },
      { id: "F8", label: "(rough redesign)", level: 8, blocked: "Not in v3_15 — the document jumps from FIGHT 6 to FIGHT 9." },
      { id: "F9", label: "Dragon", level: 8, roster: [["Veil-Torn Dragon", 1], ["broken-chain:act3:veil-torn-wyrmling:v1", 2]],
        doc: { completion: "R4", monsterDamage: 204, usedPct: 46, leftPct: 5 },
        ref: { completion: "R4", monsterDamage: 238, usedPct: 54, leftPct: 46 } },
    ],
  },
  {
    label: "Level 9 + 4 Gifts", level: 9, fights: [
      { id: "F10", label: "The Center", level: 9,
        roster: [["Thought Harrower", 1], ["Grief Colossus", 1]],
        doc: { completion: "R5", monsterDamage: 208, usedPct: 41, leftPct: 59 },
        ref: { completion: "R4", monsterDamage: 249, usedPct: 50, leftPct: 50 },
        altOrder: [["Grief Colossus", 1], ["Thought Harrower", 1]],
        altLabel: "Colossus first",
        altDoc: { completion: "R5", monsterDamage: 254, usedPct: 51, leftPct: 50 },
        altRef: { completion: "R4", monsterDamage: 320, usedPct: 64, leftPct: 36 } },
    ],
  },
];

/**
 * THE FOUR ELEMENTAL MIRRORS, built from the v3_15 archetype table.
 *
 * Christopher, 2026-08-20: *"use 4 mirrors since you can not pick the same, and the bond
 * restrictions is how you generate them, 1 tank 1 healer 1 flex/bruiser, 1 specialty."* Four
 * distinct archetypes, one per role — Guardian, Mystic, Bruiser, Tactician.
 *
 * Every number is the document's own. AC 15 / HP 90 are fixed for every mirror; the Attack line
 * comes from the chosen archetype and `Role Attack` says the claws and bolts deal 2d6 plus that
 * archetype's damage modifier. No Multiattack is printed, so each mirror makes ONE attack.
 *
 * ⚠ ELEMENTAL GUARD IS A REAL DEFENCE AND IT IS ALREADY CALIBRATED. *"At the start of each turn,
 * choose one element in the mirror's pair as the active guard: the mirror is immune to that damage
 * type and resistant to the paired type."* That is the workbook's own trait rule "Telegraphed
 * alternating immunity/resistance" (×1.0759, stack group dynamic_resistance) — read from the
 * calibration, not invented.
 *
 * ⚠ THE SPECIALITY SLOT IS MY READING, and it is the one choice here that is not spelled out.
 * Tank → Guardian, healer → Mystic and flex/bruiser → Bruiser are named directly; "specialty" is
 * taken as Tactician, the remaining caster archetype with the +7 · DC 15 spell line. Skirmisher
 * or Commander would fit the word equally, and both carry the same attack line, so the Role
 * Attack total is unchanged either way — only the signature-spell identity would move.
 */
const MIRROR_ARCHETYPES: Array<{ role: string; archetype: string; attack: number; damageMod: number }> = [
  { role: "tank", archetype: "Guardian", attack: 6, damageMod: 3 },
  { role: "healer", archetype: "Mystic", attack: 7, damageMod: 4 },
  { role: "flex/bruiser", archetype: "Bruiser", attack: 7, damageMod: 4 },
  { role: "specialty", archetype: "Tactician", attack: 7, damageMod: 4 },
];

function mirrorTemplate(m: (typeof MIRROR_ARCHETYPES)[number]): MainMonsterTemplate {
  return {
    templateId: `broken-chain:elemental-mirror-${m.archetype.toLowerCase()}`,
    name: `Elemental Mirror (${m.archetype})`,
    stats: {
      kind: "monster", ac: 15, maxHp: 90, speed: "30 ft.", size: "Medium",
      classification: "strong", creatureType: "Aberration",
      attacksPerTurn: 1,
      // The workbook's own calibrated rule for a telegraphed alternating immunity/resistance.
      defenses: [{ name: "Telegraphed alternating immunity/resistance", ehpMultiplier: 1.075915990842233 }],
    },
    abilities: [], traits: [],
    actions: [
      { name: "Role Attack", kind: "attack", roll: `1d20 + ${m.attack}`, damage: `2d6 + ${m.damageMod}`,
        text: `Melee or ranged attack, +${m.attack} to hit, reach 5 ft. or range 60 ft.; Hit: 2d6 + ${m.damageMod}.` },
    ],
    reactions: [], resources: [], notes: [],
    visibility: { defaultState: "full", hiddenName: "Mirror", revealedName: `Elemental Mirror (${m.archetype})` },
  } as unknown as MainMonsterTemplate;
}

const PARTY_SIZE = 4;
const MODE = "brokenChain" as const;

function runFight(fight: Fight, roster: Array<[string, number]>, sustainNow: number, fullSustain: number) {
  const defence = partyDefenceAt(fight.level, MODE);
  const saves = { str: defence.str, dex: defence.dex, con: defence.con, int: defence.int, wis: defence.wis, cha: defence.cha };
  const saveAvg = (defence.str + defence.dex + defence.con + defence.int + defence.wis + defence.cha) / 6;
  const entries = fight.mirrors
    ? MIRROR_ARCHETYPES.map(m => ({ template: mirrorTemplate(m), quantity: 1 }))
    : roster.map(([name, quantity]) => ({ template: find(name), quantity }));
  const built = rosterFromTemplates(entries, fight.level, { ac: defence.ac, saveBonus: saveAvg, partySize: PARTY_SIZE, saves });
  // The party walks in with what the segment left it — that is the whole point of this run.
  const profile = resolvePartyProfile({ level: fight.level, size: PARTY_SIZE, equipmentMode: MODE, customSustain: sustainNow });
  const result = simulateEncounter({
    party: { size: PARTY_SIZE, sustain: sustainNow, dpr: profile.dpr },
    roster: built.roster, settings: { damageAllocation: "focus_fire" },
  });
  const last = result.rounds[result.rounds.length - 1];
  const spent = last?.cumulativeMonsterDamage ?? 0;
  return {
    completion: result.completionRound !== null ? `R${result.completionRound}` : result.fatalRound !== null ? `FAIL R${result.fatalRound}` : "—",
    monsterDamage: spent,
    usedPct: (spent / fullSustain) * 100,
    left: sustainNow - spent,
    leftPct: ((sustainNow - spent) / fullSustain) * 100,
    assumptions: built.assumptions,
  };
}

const W = (s: string, n: number) => s.padEnd(n).slice(0, n);
console.log("BROKEN CHAIN — ACT 3, sequential with sustain carried inside each segment");
console.log(`party ${PARTY_SIZE} · Broken Chain mode · focus fire · v7 curve\n`);
console.log(`${W("Fight", 24)}${W("Completion", 12)}${W("Monster dmg", 14)}${W("Used", 8)}${W("Left in segment", 20)}  vs reference`);
console.log("─".repeat(112));

/**
 * ⚠ THREE KINDS OF DISAGREEMENT, AND ONLY ONE IS A FAILURE.
 *
 *   drift      the engine moved away from what it MEASURED at 0.8.9.4. Something changed; this
 *              fails the build, which is the whole point of re-measuring.
 *   notPriced  a typed damage response that prices at nothing because this script runs HEADLESS —
 *              there are no party actors, so there is no damage mix to weigh a resistance against.
 *              Structural, not a regression, and it makes the affected fights a LOWER BOUND.
 *   docGap     the measured value differs from Christopher's Act 3 document. Context, never a
 *              failure: 0.7.32 deliberately raised the Veil-Torn Dragon and Thought Harrower, so
 *              the document is older than the creatures on purpose.
 */
const drift: string[] = [];
const notPriced: string[] = [];
const docGap: string[] = [];

for (const seg of SEGMENTS) {
  const full = resolvePartyProfile({ level: seg.level, size: PARTY_SIZE, equipmentMode: MODE }).sustain;
  console.log(`${W(`FULL REST / ${seg.label}`, 24)}${W("—", 12)}${W("—", 14)}${W("—", 8)}${full.toFixed(0)} / ${full.toFixed(0)}`);
  let sustainNow = full;

  for (const fight of seg.fights) {
    if (fight.blocked || (!fight.roster && !fight.mirrors)) {
      console.log(`${W(`${fight.id} ${fight.label}`, 24)}${W("NOT RUN", 12)}${W("—", 14)}${W("—", 8)}${W("—", 20)}`);
      docGap.push(`${fight.id}: NOT RUN — ${fight.blocked}`);
      continue;
    }
    const r = runFight(fight, fight.roster ?? [], sustainNow, full);
    const ref = fight.ref;
    const delta = ref
      ? `ref ${ref.completion} ${ref.monsterDamage} (${ref.monsterDamage - Math.round(r.monsterDamage) >= 0 ? "+" : ""}${(ref.monsterDamage - r.monsterDamage).toFixed(0)})`
      : "";
    console.log(`${W(`${fight.id} ${fight.label}`, 24)}${W(r.completion, 12)}${W(r.monsterDamage.toFixed(0), 14)}${W(`${r.usedPct.toFixed(0)}%`, 8)}${W(`${r.left.toFixed(0)} / ${full.toFixed(0)} — ${r.leftPct.toFixed(0)}%`, 20)}  ${delta}`);
    if (ref && Math.abs(ref.monsterDamage - r.monsterDamage) > 5) {
      drift.push(`${fight.id}: engine ${r.monsterDamage.toFixed(0)} vs measured ${ref.monsterDamage} (${(r.monsterDamage - ref.monsterDamage).toFixed(0)})`);
    }
    if (ref && fight.doc && Math.abs(fight.doc.monsterDamage - ref.monsterDamage) > 5) {
      docGap.push(`${fight.id}: measured ${ref.monsterDamage} vs the document's ${fight.doc.monsterDamage} (${(ref.monsterDamage - fight.doc.monsterDamage > 0 ? "+" : "")}${ref.monsterDamage - fight.doc.monsterDamage})`);
    }
    for (const a of r.assumptions) if (a.flag === "NEEDS DM INPUT") notPriced.push(`${fight.id}: ${a.creature} · ${a.field}`);
    sustainNow = r.left;

    if (fight.altOrder) {
      const alt = runFight(fight, fight.altOrder, full, full);
      const aref = fight.altRef;
      console.log(`${W(`   ${fight.altLabel}`, 24)}${W(alt.completion, 12)}${W(alt.monsterDamage.toFixed(0), 14)}${W(`${alt.usedPct.toFixed(0)}%`, 8)}${W(`${alt.left.toFixed(0)} / ${full.toFixed(0)} — ${alt.leftPct.toFixed(0)}%`, 20)}  ${aref ? `ref ${aref.completion} ${aref.monsterDamage} (${(aref.monsterDamage - alt.monsterDamage).toFixed(0)})` : ""}`);
      if (aref && Math.abs(aref.monsterDamage - alt.monsterDamage) > 5) {
        drift.push(`${fight.id} ${fight.altLabel}: engine ${alt.monsterDamage.toFixed(0)} vs measured ${aref.monsterDamage} (${(alt.monsterDamage - aref.monsterDamage).toFixed(0)})`);
      }
      if (aref && fight.altDoc && Math.abs(fight.altDoc.monsterDamage - aref.monsterDamage) > 5) {
        docGap.push(`${fight.id} ${fight.altLabel}: measured ${aref.monsterDamage} vs the document's ${fight.altDoc.monsterDamage}`);
      }
    }
  }
  console.log("");
}

console.log("DRIFT FROM THE MEASURED REFERENCE — this is what fails the build\n" + "─".repeat(112));
if (drift.length === 0) console.log("  none — every fight is within 5 damage of what it measured at 0.8.9.4");
else drift.forEach(m => console.log("  " + m));

console.log("\nNOT PRICED — structural, because this script runs headless\n" + "─".repeat(112));
if (notPriced.length === 0) console.log("  none");
else {
  notPriced.forEach(m => console.log("  " + m));
  console.log("  ⚠ A typed resistance is weighed by the PARTY'S share of that damage type, and there are");
  console.log("    no party actors in a script. So these price at nothing and their fights read LOW —");
  console.log("    the measured figures above are a lower bound for F2, F4 and F5.");
}

console.log("\nAGAINST THE ACT 3 DOCUMENT — context, never a failure\n" + "─".repeat(112));
if (docGap.length === 0) console.log("  the measured figures agree with the document");
else {
  docGap.forEach(m => console.log("  " + m));
  console.log("  ⚠ The document predates 0.7.32, which deliberately RAISED the Veil-Torn Dragon and the");
  console.log("    Thought Harrower — so F9 and F10 reading high is the content being newer, not wrong.");
  console.log("  ⚠ F6 (Mirrors) is the one gap with no such explanation. It is built in THIS script from");
  console.log("    the document's own archetype table, so a 65-damage gap is a question about the build,");
  console.log("    not about drift. Left visible rather than normalised away.");
}

/**
 * ⚠ THIS FILE HAD NO EXIT CALL AT ALL, WHICH IS WHY IT WAS GREEN FOR MONTHS.
 *
 * It printed deviations and returned 0, so CI reported success no matter what it found — one step
 * worse than the `check:summons` fault MASTER records, because that one at least had an exit check
 * in the wrong place. Only DRIFT fails: the other two sections are known conditions, and a gate
 * that fails on a known condition is one that gets ignored.
 */
console.log(`\n${drift.length === 0 ? "PASS" : `FAIL — ${drift.length} fight(s) drifted`}`);
process.exit(drift.length === 0 ? 0 : 1);
