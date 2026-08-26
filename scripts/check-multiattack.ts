/**
 * THE MULTIATTACK SPLIT — a routine, or a choice between routines.
 *   npx tsx scripts/check-multiattack.ts
 *
 * Christopher: *"we need to change how multi-attack works, it shows 2 correctly but i need to be
 * able to say of the 2 this is how many of those action it can do, case and point for the guards
 * it makes 3 attacks but it does 1 of each of its actions (tail, claw, bite), then if it says 2
 * and both have a 2 on them then the app should be able to read it can make either of these 2
 * combined as dpr and finds the middle damage of those."*
 *
 * Two cases, and which one applies falls out of comparing the declared counts against the budget:
 *
 *   Σ counts == budget    ONE routine — every declared attack happens.
 *   Σ counts >  budget    ALTERNATIVES — they cannot all fit, so the creature picks one, and the
 *                         checker prices the MIDDLE rather than the best or the sum.
 *
 * The workbook's `multiattack_sequence` primitive asks for exactly that: *"Schedule only the legal
 * ordered routine [...] Follow the printed sequence and alternatives; do not add every option."*
 */
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { formatAbilityEntry } from "../src/core/monsters/creator/monsterCreatorModel";
import type { MainMonsterTemplate } from "../src/core/monsters/runtime/mainMonsterRuntime";

const problems: string[] = [];
const near = (a: number, b: number, tol = 0.05) => Math.abs(a - b) < tol;

/** AC 10 and no saves, so every attack lands at a flat, checkable rate. */
const TARGET = { ac: 10, saveBonus: 0, partySize: 4 } as const;

function creature(attacksPerTurn: number, actions: Array<{ name: string; damage: string; slots?: number }>): MainMonsterTemplate {
  return {
    templateId: "probe", name: "Multiattack Probe",
    stats: { maxHp: 100, ac: 15, cr: 5, attacksPerTurn },
    abilities: [
      formatAbilityEntry("STR", 16), formatAbilityEntry("DEX", 12), formatAbilityEntry("CON", 14),
      formatAbilityEntry("INT", 10), formatAbilityEntry("WIS", 10), formatAbilityEntry("CHA", 10),
    ],
    actions: actions.map(a => ({
      name: a.name, kind: "attack" as const, roll: "1d20 + 10", damage: a.damage,
      ...(a.slots ? { routineSlots: a.slots } : {}),
      text: `Melee Weapon Attack: +10 to hit. Hit: ${a.damage} damage.`,
    })),
    visibility: { defaultState: "hp-bar", hiddenName: "Probe", revealedName: "Probe" },
  } as unknown as MainMonsterTemplate;
}

const round1 = (t: MainMonsterTemplate) => {
  const trace = traceCreature(parseCreature(t), TARGET as never, 1);
  return trace.rounds[0];
};

// ─── 1. THE DRAKE GUARD: three attacks, one of each ──────────────────────────────────────────
{
  const r = round1(creature(3, [
    { name: "Bite", damage: "12", slots: 1 },
    { name: "Claw", damage: "8", slots: 1 },
    { name: "Tail", damage: "4", slots: 1 },
  ]));
  const names = r.scheduled.map(s => s.feature).sort().join(", ");
  console.log(`3 attacks, 1+1+1  -> ${r.scheduled.length} scheduled: ${names}  total ${r.totalExpectedDamage.toFixed(1)}`);
  if (r.scheduled.length !== 3) problems.push(`a 1+1+1 split scheduled ${r.scheduled.length} attacks, expected 3`);
  for (const want of ["Bite", "Claw", "Tail"]) {
    if (!r.scheduled.some(s => s.feature === want)) problems.push(`${want} was not in the routine — a declared split must field every attack it names`);
  }
  /**
   * ⚠ THIS IS THE CASE THE CONVENTION GETS WRONG, which is why the control has to exist. Without
   * a declared split the routine is "the best attack, repeated" — 12/12/12 = 36 rather than 24.
   */
  if (!near(r.totalExpectedDamage, 24, 1.5)) {
    problems.push(`1+1+1 of 12/8/4 came to ${r.totalExpectedDamage.toFixed(1)}, expected ~24 — the convention would give ~36`);
  }
}

// ─── 2. ALTERNATIVES: two attacks, two options each declared 2 ───────────────────────────────
{
  const r = round1(creature(2, [
    { name: "Heavy", damage: "20", slots: 2 },
    { name: "Quick", damage: "10", slots: 2 },
  ]));
  console.log(`2 attacks, 2 and 2 -> ${r.scheduled.length} scheduled: ${r.scheduled.map(s => s.feature).join(", ")}  total ${r.totalExpectedDamage.toFixed(1)}`);
  // Either routine is 2 uses; the mean per use is (20 + 10) / 2 = 15, so the turn is ~30.
  if (!near(r.totalExpectedDamage, 30, 2)) {
    problems.push(`alternatives came to ${r.totalExpectedDamage.toFixed(1)}, expected ~30 — the middle of a 40 routine and a 20 one`);
  }
  if (r.totalExpectedDamage >= 39) problems.push("alternatives priced at the BEST option — a creature does not always pick right");
  if (r.totalExpectedDamage >= 55) problems.push("alternatives priced as the SUM — that routine does not exist");
  if (!r.scheduled.some(s => /either/i.test(s.feature))) {
    problems.push("an averaged routine must say so in the trace, or the number looks like an attack the block does not have");
  }
}

// ─── 3. ONE DECLARED OPTION IS A ROUTINE, NOT A CHOICE ───────────────────────────────────────
{
  const r = round1(creature(2, [{ name: "Slam", damage: "10", slots: 2 }]));
  console.log(`2 attacks, one action marked 2 -> ${r.scheduled.length} scheduled, total ${r.totalExpectedDamage.toFixed(1)}`);
  if (r.scheduled.length !== 2) problems.push(`a single declared option scheduled ${r.scheduled.length}, expected 2 — it is a routine with one entry`);
  if (r.scheduled.some(s => /either/i.test(s.feature))) problems.push("a single option was priced as a choice between it and nothing");
}

// ─── 4. NOTHING DECLARED KEEPS THE OLD CONVENTION ────────────────────────────────────────────
{
  const r = round1(creature(3, [{ name: "Bite", damage: "12" }, { name: "Claw", damage: "8" }]));
  console.log(`3 attacks, nothing declared -> ${r.scheduled.map(s => s.feature).join(", ")}  total ${r.totalExpectedDamage.toFixed(1)}`);
  if (r.scheduled.length !== 3) problems.push(`the convention scheduled ${r.scheduled.length}, expected 3`);
  // bite-claw-claw: the distinct attacks in order, the last repeated to fill.
  if (!near(r.totalExpectedDamage, 28, 2)) {
    problems.push(`the convention came to ${r.totalExpectedDamage.toFixed(1)}, expected ~28 (12 + 8 + 8)`);
  }
}


/**
 * ─── RIDERS — EXTRA DAMAGE ON A HIT, PRICED BY CADENCE ──────────────────────────────────────
 *
 * Christopher: *"there is no way for me to create a rider for the Reeve."*
 *
 * ⚠ CADENCE IS THE FIELD THAT CHANGES THE ANSWER, and it is why a rider has to be a fact rather
 * than dice folded into the damage string. Folded in, it is billed on every attack; left in the
 * prose, it is billed on none. On a two-attack creature those differ by a whole attack.
 *
 * The workbook prices them as two different primitives:
 *   conditional_extra_damage           P(condition) × P(trigger) × EV
 *   first_hit_or_once_per_turn_rider   P(at least one qualifying trigger in the turn) × EV
 */
function withRiders(attacks: number, riders: Array<Record<string, unknown>>): MainMonsterTemplate {
  const t = creature(attacks, [{ name: "Claw", damage: "10" }]);
  (t.actions as Array<Record<string, unknown>>)[0].riders = riders;
  return t;
}

/**
 * ⚠ MEASURED AT A 50% HIT CHANCE, ON THREE ATTACKS, AND THAT CHOICE IS THE TEST.
 *
 * At 95% on two attacks the two cadences are 0.9975 riders and 1.9 riders — but a broken
 * implementation that ignores cadence entirely lands on 0.95, which is within spitting distance
 * of the once-per-turn answer. The first version of this check passed against exactly that bug.
 *
 * Three attacks at 50% separates all three:  per-hit 1.5  ·  once-per-turn 0.875  ·  broken 0.5.
 */
const RIDER_TARGET = { ac: 21, saveBonus: 0, partySize: 4 } as const;   // +10 vs AC 21 = 50%
const P_HIT = 0.5;
const riderRound = (t: MainMonsterTemplate) => traceCreature(parseCreature(t), RIDER_TARGET as never, 1).rounds[0];
{
  const bare = riderRound(creature(3, [{ name: "Claw", damage: "10" }])).totalExpectedDamage;

  // PER HIT: rides both attacks.
  const perHit = riderRound(withRiders(3, [{ name: "Ember", damage: "6", cadence: "per-hit" }])).totalExpectedDamage;
  console.log(`\n3 attacks, +6 every hit      -> ${perHit.toFixed(1)}  (bare ${bare.toFixed(1)})`);
  if (!near(perHit - bare, 3 * 6 * P_HIT, 0.6)) {
    problems.push(`a per-hit rider added ${(perHit - bare).toFixed(1)}, expected ~${(3 * 6 * P_HIT).toFixed(1)} — it rides EVERY attack`);
  }

  // ONCE PER TURN: fires when at least one of the two attacks lands, so it is worth ONE rider,
  // not two — 1 − (1 − 0.95)² = 99.75% of 6.
  const once = riderRound(withRiders(3, [{ name: "Ember", damage: "6", cadence: "once-per-turn" }])).totalExpectedDamage;
  const wantOnce = 6 * (1 - Math.pow(1 - P_HIT, 3));
  console.log(`3 attacks, +6 once per turn  -> ${once.toFixed(1)}  (adds ${(once - bare).toFixed(1)}, expected ~${wantOnce.toFixed(1)})`);
  if (!near(once - bare, wantOnce, 0.6)) {
    problems.push(`a once-per-turn rider added ${(once - bare).toFixed(1)}, expected ~${wantOnce.toFixed(1)}`);
  }
  if (once - bare > 3 * 6 * P_HIT - 0.5) {
    problems.push("a once-per-turn rider was billed per attack — that is the commonest way one gets overpriced");
  }

  // A CONDITION IS A WEIGHT, NOT A TOGGLE: half the time is half the rider.
  const half = riderRound(withRiders(3, [{ name: "Ember", damage: "6", cadence: "per-hit", chance: 0.5 }])).totalExpectedDamage;
  console.log(`3 attacks, +6 every hit @50% -> ${half.toFixed(1)}  (adds ${(half - bare).toFixed(1)})`);
  if (!near(half - bare, 3 * 6 * P_HIT * 0.5, 0.6)) {
    problems.push(`a 50% rider added ${(half - bare).toFixed(1)}, expected half of ${(3 * 6 * P_HIT).toFixed(1)}`);
  }

  // A rider with no dice or no name is an unfilled row, not a rider worth zero damage.
  const blank = riderRound(withRiders(3, [{ name: "", damage: "", cadence: "per-hit" }])).totalExpectedDamage;
  if (!near(blank, bare, 0.01)) problems.push("an unfilled rider row changed the damage");
}


/**
 * ─── A BONUS ACTION IS NOT A MULTIATTACK SLOT ───────────────────────────────────────────────
 *
 * Christopher: *"if you read the anchor it is a BONUS action which i cant put on a monster so i
 * have to make it read some what [...] all there counts go up, this is only until a bonus monster
 * action is recreated, which i dont know why one wouldnt have been when even as early as act 1 i
 * had bonus actions."*
 *
 * ⚠ THE WORKAROUND HE IS DESCRIBING IS A REAL COST, NOT A COSMETIC ONE. With no way to say
 * "bonus action", the only way to make one count is to raise `attacksPerTurn` so the Multiattack
 * budget swallows it — and then it competes for Action slots it should never have touched, and
 * the creature reads as having more attacks than it has. The Grief Colossus reads 3 and the
 * Breaker 5 for exactly this reason.
 *
 * The channel has always existed in the trace. What was missing was any way to author it.
 */
{
  const withBonus = creature(2, [{ name: "Fist", damage: "10" }]);
  (withBonus.actions as Array<Record<string, unknown>>).push({
    name: "Anchor the Wrong", kind: "action", roll: "1d20 + 10", damage: "6",
    economyCost: "bonus", text: "Bonus Action. Hit: 6 damage.",
  });
  const r = round1(withBonus);
  const names = r.scheduled.map(s => s.feature);
  console.log(`\n2 attacks + a bonus action -> ${names.join(", ")}  total ${r.totalExpectedDamage.toFixed(1)}`);

  // The routine is still TWO Fists — the bonus action did not take a slot.
  const fists = names.filter(n => n === "Fist").length;
  if (fists !== 2) problems.push(`the Multiattack fielded ${fists} Fist(s), expected 2 — a bonus action must not consume an Action slot`);
  if (!names.includes("Anchor the Wrong")) problems.push("the bonus action was not scheduled at all");
  // 2 Fists + the bonus, all at 95%: (10 + 10 + 6) x 0.95 = 24.7
  if (!near(r.totalExpectedDamage, 24.7, 0.6)) {
    problems.push(`came to ${r.totalExpectedDamage.toFixed(1)}, expected ~24.7 — two Fists AND the bonus action`);
  }

  // ⚠ AND IT IS ON ITS OWN CHANNEL, which is what stops it competing for the Action.
  const bonus = r.scheduled.find(s => s.feature === "Anchor the Wrong");
  if (bonus?.channel !== "bonus_action") {
    problems.push(`the bonus action landed on the "${bonus?.channel}" channel — it must have its own budget`);
  }

  // FREE / start of turn: costs nothing, still happens every round.
  const withFree = creature(1, [{ name: "Slam", damage: "10" }]);
  (withFree.actions as Array<Record<string, unknown>>).push({
    name: "Grief Aura", kind: "action", damage: "5", economyCost: "free",
    text: "At the start of its turn, each creature within 10 feet takes 5 damage.",
  });
  const rf = round1(withFree);
  const aura = rf.scheduled.find(s => s.feature === "Grief Aura");
  console.log(`1 attack + a free start-of-turn tick -> ${rf.scheduled.map(s => s.feature).join(", ")}`);
  if (!aura) problems.push("a free start-of-turn action was not scheduled");
  if (aura && aura.channel !== "free") problems.push(`a free action landed on the "${aura.channel}" channel`);
  if (rf.scheduled.filter(s => s.feature === "Slam").length !== 1) {
    problems.push("a free action displaced the creature's Action");
  }
}


if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — a declared split is a routine, an overflowing one is a choice priced at its middle, a rider is priced by its cadence, and a bonus action never takes a Multiattack slot.`);