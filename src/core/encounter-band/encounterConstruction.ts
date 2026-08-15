/**
 * Encounter CONSTRUCTION — the Broken Chain Monster Builder model.
 *
 * Source: `broken_chain_monster_builder_final.xlsx` (Christopher, 2026-07-31), which is the
 * governing workbook for building creatures. `encounterRounds.ts` answers "I built this, does
 * it pace right?"; this module answers the question a builder has first — **what should I
 * build?** — and carries the second clock that the rounds model never had.
 *
 * TWO CLOCKS, not one. The old model only ever projected fight length; this one pairs it with
 * the party-collapse clock, and the ratio between them is the actual risk statement:
 *
 *   PCER  = Monster Sustain ÷ PC Effective Damage      how long the fight lasts
 *   MER   = Party Sustain   ÷ Monster Sustained Damage how long until the party collapses
 *   Pressure     = PCER ÷ MER                          share of the collapse clock consumed
 *   Round Margin = MER − PCER                          space left between winning and dying
 *
 * MER is deliberately NOT the desired fight length. A fight that ends at PCER 4.5 with MER 6
 * is a boss; the same PCER with MER 4.6 is a coin flip.
 *
 * Authoring baseline is FOUR players (README §1). HP pools scale 0.75 / 1.00 / 1.25 for
 * 3P/4P/5P via `hpForPartySize` — and nothing else does: "Scale HP and guaranteed HP pools,
 * not damage or DCs."
 */

import { midpointDprForLevel } from "./encounterRounds";
// The action-budget predicates established at 0.7.1.10–0.7.1.12. Imported, never reimplemented:
// the DPR estimate and the combat card must not be able to disagree about what a creature's
// turn contains. (mainMonsterRuntime takes only a TYPE from encounter-band, so no cycle.)
import {
  isMonsterFullAction, isMonsterBonusAction, isMonsterLegendaryAction,
} from "../monsters/runtime/mainMonsterRuntime";
import type { MonsterClassification } from "../monsters/runtime/mainMonsterRuntime";

// ─── Party sustain — S_P50,4 ──────────────────────────────────────────────────

/**
 * Four-player balanced-middle PARTY SUSTAIN, in effective HP ("Model Inputs" →
 * Four-Player Balanced Sustain).
 *
 * This is raw party HP × a 1.25 recovery/mitigation factor — the healing and damage
 * prevention a party actually converts into extra survivable damage. It is the denominator's
 * partner to `midpointDprForLevel`: that says how fast the party kills, this says how long it
 * lives.
 */
const PARTY_SUSTAIN_4P: ReadonlyArray<readonly [level: number, rawPartyHp: number, sustain: number]> = [
  [3, 96, 120],
  [4, 124, 155],
  [5, 152, 190],
  [6, 180, 225],
  [7, 208, 260],
  [8, 236, 295],
  [9, 264, 330],
  [10, 292, 365],
  [11, 320, 400],
  [12, 348, 435],
];

/** The recovery/mitigation factor turning raw party HP into sustain. Authored, editable. */
export const PARTY_RECOVERY_FACTOR = 1.25;

function interpolate(
  pts: ReadonlyArray<readonly [number, ...number[]]>,
  level: number,
  idx: number,
): number {
  const lv = Math.max(1, Math.min(20, Math.floor(level || 1)));
  if (lv <= pts[0][0]) return pts[0][idx] as number;
  const last = pts[pts.length - 1];
  if (lv >= last[0]) return last[idx] as number;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (lv >= a[0] && lv <= b[0]) {
      if (b[0] === a[0]) return a[idx] as number;
      const t = (lv - a[0]) / (b[0] - a[0]);
      return (a[idx] as number) + ((b[idx] as number) - (a[idx] as number)) * t;
    }
  }
  return last[idx] as number;
}

/** S_P50,4 — four-player balanced-middle party sustain (effective HP) at a level. */
export function partySustainForLevel(level: number): number {
  return interpolate(PARTY_SUSTAIN_4P, level, 2);
}

/** Raw four-player party HP at a level, before the recovery factor. */
export function rawPartyHpForLevel(level: number): number {
  return interpolate(PARTY_SUSTAIN_4P, level, 1);
}

// ─── The escalation ladder ────────────────────────────────────────────────────

export type EscalationId =
  | "strong-opener"
  | "early-elite"
  | "late-elite"
  | "early-mid-boss"
  | "later-mid-boss"
  | "gate-mid-boss"
  | "high-output-act-boss"
  | "moderate-output-act-boss"
  | "final-boss-center";

export type EscalationPosition = {
  id: EscalationId;
  order: number;
  label: string;
  classification: MonsterClassification;
  /** Target PCER — the fight-length center this position is built around. */
  targetPcer: number;
  /** Target Pressure — the share of the collapse clock the fight should consume. */
  pressure: number;
  intent: string;
};

/**
 * Generic Encounter Escalation ("Model Inputs" → Generic Encounter Escalation).
 *
 * A RISING SAWTOOTH (README §8): pressure climbs within an act, and a level-up resets it
 * before the climb resumes. Note two pairs share a kill clock and differ only in pressure —
 * early vs later mid-boss are both 4.75 rounds at 0.625 vs 0.65 — which is the whole point of
 * carrying MER separately: same fight length, more danger.
 */
export const ESCALATION_LADDER: readonly EscalationPosition[] = [
  { id: "strong-opener", order: 1, label: "Strong opener", classification: "strong", targetPcer: 3, pressure: 0.35, intent: "Baseline threat; comfortable collapse margin." },
  { id: "early-elite", order: 2, label: "Early elite", classification: "elite", targetPcer: 3.5, pressure: 0.45, intent: "First meaningful pressure step." },
  { id: "late-elite", order: 3, label: "Late elite", classification: "elite", targetPcer: 4, pressure: 0.525, intent: "Longer and more punishing than the early elite." },
  { id: "early-mid-boss", order: 4, label: "Early mid-boss", classification: "mid-boss", targetPcer: 4.75, pressure: 0.625, intent: "Major set piece with a clear safety margin." },
  { id: "later-mid-boss", order: 5, label: "Later mid-boss", classification: "mid-boss", targetPcer: 4.75, pressure: 0.65, intent: "Same kill clock, higher offensive pressure." },
  { id: "gate-mid-boss", order: 6, label: "Gate mid-boss", classification: "mid-boss", targetPcer: 5, pressure: 0.7, intent: "Late-act gate; tactics and resources matter." },
  { id: "high-output-act-boss", order: 7, label: "High-output act boss", classification: "act-boss", targetPcer: 4.5, pressure: 0.725, intent: "Shorter act boss with sharper damage." },
  { id: "moderate-output-act-boss", order: 8, label: "Moderate-output act boss", classification: "act-boss", targetPcer: 5.5, pressure: 0.8, intent: "Longer act boss; sustained pressure stays bounded." },
  { id: "final-boss-center", order: 9, label: "Final boss center", classification: "final-boss", targetPcer: 7, pressure: 0.85, intent: "Campaign-ceiling center; validate phases and recovery carefully." },
];

export function escalationById(id: EscalationId): EscalationPosition | undefined {
  return ESCALATION_LADDER.find(p => p.id === id);
}

// ─── The four clocks ──────────────────────────────────────────────────────────

/** PCER — how long the fight lasts. Monster Sustain is EFFECTIVE HP, kit included. */
export function pcer(monsterSustain: number, pcEffectiveDamage: number): number {
  return pcEffectiveDamage > 0 ? monsterSustain / pcEffectiveDamage : 0;
}

/** MER — how long until the party collapses. */
export function mer(partySustain: number, monsterSustainedDamage: number): number {
  return monsterSustainedDamage > 0 ? partySustain / monsterSustainedDamage : Infinity;
}

/** Pressure — share of the collapse clock the fight consumes. */
export function pressure(pcerValue: number, merValue: number): number {
  return merValue > 0 && Number.isFinite(merValue) ? pcerValue / merValue : 0;
}

/** Round margin — expected space between winning and collapsing. */
export function roundMargin(merValue: number, pcerValue: number): number {
  return merValue - pcerValue;
}

// ─── Building to a target ─────────────────────────────────────────────────────

export type BuildTarget = {
  position: EscalationPosition;
  level: number;
  /** Effective HP to build to — compare against rawHp × defensiveMultiplier(defenses). */
  monsterSustain: number;
  /** Sustained damage per round to cap at. */
  monsterDamage: number;
  /** The collapse clock this produces. */
  mer: number;
  roundMargin: number;
  pcDamage: number;
  partySustain: number;
};

/**
 * The two numbers that define a creature at an escalation position, for a four-player party.
 *
 *   Monster Sustain = PC Effective Damage × target PCER
 *   Monster Damage  = (Party Sustain × Pressure) ÷ target PCER
 *
 * Scale the resulting HP with `hpForPartySize` for 3P/5P. Do NOT scale the damage.
 */
export function buildTargetFor(id: EscalationId, level: number): BuildTarget | undefined {
  const position = escalationById(id);
  if (!position) return undefined;

  const pcDamage = midpointDprForLevel(level);
  const partySustain = partySustainForLevel(level);
  const monsterSustain = pcDamage * position.targetPcer;
  const monsterDamage = (partySustain * position.pressure) / position.targetPcer;
  const merValue = mer(partySustain, monsterDamage);

  return {
    position,
    level,
    monsterSustain,
    monsterDamage,
    mer: merValue,
    roundMargin: roundMargin(merValue, position.targetPcer),
    pcDamage,
    partySustain,
  };
}

/** Every position at a level, in escalation order — the builder's ladder view. */
export function buildLadderFor(level: number): BuildTarget[] {
  return ESCALATION_LADDER.map(p => buildTargetFor(p.id, level)).filter((b): b is BuildTarget => Boolean(b));
}

// ─── Auditing what a creature ACTUALLY does ───────────────────────────────────

/** Average of a dice expression's rolled part: "2d10" → 11. */
function diceAverage(count: number, faces: number): number {
  return (count * (faces + 1)) / 2;
}

/**
 * Expected value of a damage string. Handles the shapes the scanner and creature editor
 * actually produce:
 *   "2d10 + 4"                     → 15
 *   "1d8 + 2 slashing + 1d4 cold"  → 9   (every die and flat term counts, types ignored)
 *   "15 (2d10 + 4)"                → 15  (a leading pre-averaged total wins)
 */
export function damageExpressionAverage(expr: string | undefined): number {
  if (!expr) return 0;
  const text = expr.trim();
  if (!text) return 0;

  const preAveraged = text.match(/^\s*(\d+)\s*\(/);
  if (preAveraged) return Number.parseInt(preAveraged[1], 10);

  let total = 0;
  for (const m of text.matchAll(/([+-]?)\s*(\d*)d(\d+)/gi)) {
    const sign = m[1] === "-" ? -1 : 1;
    const count = m[2] === "" ? 1 : Number.parseInt(m[2], 10);
    const faces = Number.parseInt(m[3], 10);
    if (Number.isFinite(count) && Number.isFinite(faces) && faces > 0) {
      total += sign * diceAverage(count, faces);
    }
  }
  const withoutDice = text.replace(/[+-]?\s*\d*d\d+/gi, " ");
  for (const m of withoutDice.matchAll(/([+-])\s*(\d+)/g)) {
    total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
  }
  return Math.max(0, total);
}

/** Probability a recharge ability is up on an average round. "5-6" → 1/3. */
export function rechargeAvailability(recharge: string | undefined): number {
  if (!recharge) return 1;
  const m = recharge.match(/(\d)\s*(?:-\s*(\d))?/);
  if (!m) return 1;
  const lo = Number.parseInt(m[1], 10);
  const hi = m[2] ? Number.parseInt(m[2], 10) : 6;
  if (!Number.isFinite(lo)) return 1;
  const faces = Math.max(0, Math.min(6, hi) - lo + 1);
  return faces > 0 ? faces / 6 : 1;
}

/** Chance a +N attack lands against AC, clamped to the nat-1/nat-20 rails. */
export function hitChance(attackBonus: number, targetAc: number): number {
  const raw = (21 - (targetAc - attackBonus)) / 20;
  return Math.max(0.05, Math.min(0.95, raw));
}

/** Pulls "+7" out of "1d20 + 7". */
export function attackBonusFromRoll(roll: string | undefined): number {
  if (!roll) return 0;
  const m = roll.match(/([+-])\s*(\d+)\s*$/);
  return m ? (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10) : 0;
}

/**
 * Party AC and save bonus by level ("Model Inputs" → Target AC / Damage Save). The DPR
 * progression is already target-resolved against these, which is why a monster's own AC must
 * never be folded in a second time.
 */
const PARTY_DEFENCE_BY_LEVEL: ReadonlyArray<readonly [level: number, targetAc: number, damageSave: number]> = [
  [3, 14, 2], [4, 15, 2], [5, 16, 3], [6, 16, 3], [7, 16, 3],
  [8, 17, 4], [9, 17, 4], [10, 18, 4], [11, 18, 5], [12, 18, 5],
];

/** The AC a monster's attacks are landing against at this party level. */
export function partyTargetAcForLevel(level: number): number {
  return Math.round(interpolate(PARTY_DEFENCE_BY_LEVEL, level, 1));
}

/** The party's damage-save bonus at this level. */
export function partyDamageSaveForLevel(level: number): number {
  return interpolate(PARTY_DEFENCE_BY_LEVEL, level, 2);
}

export type DprEstimateAction = {
  name?: string;
  kind?: string;
  roll?: string;
  damage?: string;
  save?: string;
  attackCount?: number;
  recharge?: string;
  legendaryCost?: number;
  /** The discriminator for a spell action — see `isMonsterSpellAction`. NOT `kind`. */
  spellSlotLevel?: number;
  economyCost?: string;
  /** Authored: the creature cannot use this under the encounter's conditions. Never inferred. */
  gated?: boolean;
};

export type MonsterDamageEstimate = {
  /** Sustained damage per round — the MER denominator. */
  dpr: number;
  /** Per-action contribution, largest first, so a builder sees WHERE the damage is. */
  breakdown: { name: string; dpr: number; note: string }[];
  /** What could not be parsed — never silently counted as zero. */
  unread: string[];
};

/**
 * Estimate a creature's SUSTAINED damage per round from its abilities, for the MER clock.
 *
 * A reference estimate, in the same spirit as the rest of the creator. It reads what the
 * creature can actually roll; it does not model burst, focus fire, control, or recovery
 * timing — README §7 is explicit that those stay a second axis to be validated separately
 * even when the clocks look healthy.
 */
export function estimateMonsterDamage(
  actions: readonly DprEstimateAction[] | undefined,
  options: {
    attacksPerTurn?: number;
    /** Defaults to the authored party AC for the level. */
    targetAc?: number;
    partyLevel?: number;
    /** Chance a party member saves. Defaults from the level's damage-save bonus vs the DC. */
    partySaveRate?: number;
    saveDc?: number;
  } = {},
): MonsterDamageEstimate {
  const level = options.partyLevel ?? 5;
  const targetAc = options.targetAc ?? partyTargetAcForLevel(level);
  const saveRate = options.partySaveRate
    ?? (options.saveDc
      ? Math.max(0.05, Math.min(0.95, (21 - (options.saveDc - partyDamageSaveForLevel(level))) / 20))
      : 0.5);

  const breakdown: MonsterDamageEstimate["breakdown"] = [];
  const unread: string[] = [];

  /** One damaging entry, already resolved to expected damage for a single use. */
  type Priced = {
    name: string; per: number; note: string; recharge?: string; limited: boolean;
    /** Spell or recharge — IS the creature's Action, so it replaces the whole routine. */
    fullAction: boolean;
    /** Bonus / legendary — runs on its own economy, so it adds instead of competing. */
    outOfBudget: boolean;
    /** Authored as unusable in this encounter — counted as zero, and said out loud. */
    gated: boolean;
  };
  const priced: Priced[] = [];

  for (const a of actions ?? []) {
    if (!a || a.kind === "trait") continue;

    const avg = damageExpressionAverage(a.damage);
    if (avg <= 0) {
      if (a.damage) unread.push(`${a.name ?? "unnamed"} — could not read "${a.damage}"`);
      continue;
    }

    let per: number;
    let note: string;
    if (a.roll) {
      const hit = hitChance(attackBonusFromRoll(a.roll), targetAc);
      per = avg * hit;
      note = `${avg.toFixed(1)} × ${(hit * 100).toFixed(0)}% hit`;
    } else if (a.save) {
      per = avg * (1 - saveRate) + avg * 0.5 * saveRate;
      note = `${avg.toFixed(1)}, ${(saveRate * 100).toFixed(0)}% save for half`;
    } else {
      per = avg;
      note = `${avg.toFixed(1)} automatic`;
    }
    // An entry carrying its own attackCount states its full routine on its own.
    const own = a.attackCount ?? 0;
    if (own > 1) { per *= own; note += ` × ${own}`; }
    // The SAME predicates the combat card spends the budget with — never a parallel rule set.
    const ra = a as unknown as Parameters<typeof isMonsterFullAction>[0];
    priced.push({ name: a.name ?? "unnamed", per, note, recharge: a.recharge,
      limited: own > 1,
      fullAction: isMonsterFullAction(ra),
      outOfBudget: isMonsterBonusAction(ra) || isMonsterLegendaryAction(ra),
      gated: Boolean(a.gated) });
  }

  if (priced.length === 0) return { dpr: 0, breakdown, unread };

  /**
   * THE ACTION BUDGET — the model established at 0.7.1.10–0.7.1.12, not a new one.
   *
   * Christopher, 2026-08-14: *"action economy was already established when we were going over
   * the frost weaver and the wendigo wight."* It was, and this function was ignoring it: it
   * SUMMED every damaging entry, charging the party for a creature performing its whole stat
   * block every round. The Mirage Stalker read 48.1 DPR for a creature that cannot exceed ~16.
   *
   * So the budget is read through the SAME predicates the combat card uses, rather than a
   * parallel set of rules that could drift from them:
   *
   *  · THE ROUTINE — `attacksPerTurn` is the SIZE OF THE BUDGET, not a multiplier on every
   *    line ("claw is action and bolt is action and action count is 2 so using either until
   *    that count is out"). One Claw with attacksPerTurn 2 makes two Claws; three named
   *    attacks with attacksPerTurn 2 makes the best TWO, not all three doubled. Getting this
   *    backwards caused both the under-read (Lesser Wendigo 6.05) and the over-read (48.1).
   *
   *  · `isMonsterFullAction` — a SPELL or a RECHARGE action IS the creature's Action, so it
   *    replaces the entire routine rather than adding to it or costing one swing. Either/or,
   *    never both. ⚠ The spell discriminator is `spellSlotLevel`, NOT `kind` — no template
   *    sets `kind: "spell"`, and the Frost-Weaver is the test case for exactly that.
   *
   *  · `isMonsterBonusAction` / `isMonsterLegendaryAction` — OUTSIDE the budget entirely, so
   *    they ADD. A legendary action runs on someone else's turn from its own pool.
   *
   * Still not modelled, because the data has nowhere to say it: per-day limits (a 2/day
   * ability is priced as always available) and abilities gated on another ability firing.
   */
  const routineSize = Math.max(1, options.attacksPerTurn ?? 1);
  // Out of the budget → they add on top of whatever the turn's action was.
  const additive = priced.filter(x => x.outOfBudget);
  // Each IS the Action → an alternative to the whole routine.
  const alternatives = priced.filter(x => !x.outOfBudget && x.fullAction);
  // Ordinary attacks → spend one swing each out of `routineSize`.
  const routinePool = priced.filter(x => !x.outOfBudget && !x.fullAction);

  let routine = 0;
  if (routinePool.length > 0) {
    const sorted = [...routinePool].sort((a, b) => b.per - a.per);
    // Fill the routine from the best entries, repeating the best when the block names fewer
    // distinct attacks than the routine has swings.
    for (let i = 0; i < routineSize; i++) {
      const pick = sorted[Math.min(i, sorted.length - 1)];
      // An entry that states its own attackCount already IS a whole routine; do not stack it.
      if (pick.limited && i > 0) break;
      routine += pick.per;
    }
    const used = Math.min(routineSize, sorted.length);
    for (let i = 0; i < used; i++) {
      const pick = sorted[i];
      const reps = i === used - 1 && routineSize > sorted.length && !pick.limited
        ? routineSize - sorted.length + 1 : 1;
      breakdown.push({ name: pick.name, dpr: pick.per * reps,
        note: pick.note + (reps > 1 ? ` × ${reps} (routine of ${routineSize})` : "") });
    }
  }

  /**
   * A RECHARGE ACTION IS TAKEN WHEN IT IS UP — it is not compared against the routine
   * (Christopher, 2026-08-14): *"a recharge is always available action unless the creature
   * can't use it."*
   *
   * An earlier pass clamped this to `max(0, alt − routine)`, i.e. the creature only used its
   * recharge when it out-damaged a full multiattack. That is wrong twice over. It made the
   * Stalker's Phantom Charge score a flat 0 and print "weaker than the routine", when the
   * Charge is simply what the Stalker does on the turns it has it — the push-and-prone rider
   * is the reason it exists, and a boss trading damage for control is a real turn, not a
   * mistake to be optimised away. And it silently made recharge abilities incapable of ever
   * LOWERING a creature's DPR, which is exactly what a control-flavoured one should do.
   *
   * So the recharge simply replaces the routine on its share of turns, up or down:
   *     expected = p·alt + (1−p)·routine
   *
   * Turns are then claimed in damage order, so two recharge abilities cannot both spend the
   * same turn. `gated` is the *"unless the creature can't use it"* case — the Pale Stalker's
   * Cold Breath is "locked while both Pack Hunters are alive", so it is not available at the
   * start of its own authored fight.
   */
  let dpr = routine;
  let turnsLeft = 1;
  for (const alt of [...alternatives].sort((a, b) => b.per - a.per)) {
    if (alt.gated) {
      breakdown.push({ name: alt.name, dpr: 0,
        note: `${alt.note} — GATED: not available under this encounter's conditions, so it is not counted` });
      continue;
    }
    const p = Math.min(turnsLeft, rechargeAvailability(alt.recharge));
    turnsLeft -= p;
    // Replaces the routine on those turns — which can LOWER total damage, and should.
    const delta = p * (alt.per - routine);
    dpr += delta;
    breakdown.push({ name: alt.name, dpr: delta,
      note: `${alt.note} — full action, taken on ${(p * 100).toFixed(0)}% of turns`
        + (alt.per < routine
          ? ` (trades ${(routine - alt.per).toFixed(1)} damage for its rider)` : "") });
  }
  // Bonus and legendary actions are not competing for the Action, so they simply add.
  for (const extra of additive) {
    const p = rechargeAvailability(extra.recharge);
    dpr += extra.per * p;
    breakdown.push({ name: extra.name, dpr: extra.per * p,
      note: `${extra.note} — outside the action budget, so it adds${p < 1 ? ` × ${(p * 100).toFixed(0)}% uptime` : ""}` });
  }

  breakdown.sort((x, y) => y.dpr - x.dpr);
  return { dpr, breakdown, unread };
}

// ─── Auditing a built creature against the ladder ─────────────────────────────

export type EncounterAudit = {
  pcer: number;
  mer: number;
  pressure: number;
  roundMargin: number;
  /** Nearest ladder position by PCER, for "what did I actually build?" */
  nearest: EscalationPosition;
  /** Set when a target was named: how far off each clock is. */
  target?: { position: EscalationPosition; pcerDelta: number; pressureDelta: number };
};

/**
 * PC EFFECTIVE damage — the PCER denominator.
 *
 * Two adjustments sit between the published balanced center and what the party actually lands,
 * and the Wight calibration shows both: the generic L5 4P center is 84.84 (already resolved
 * against the level's baseline AC 16), target-resolving it against the Wight's AC 17 and save
 * profile gives 79.49, and an 0.86 uptime for "leap, aura, and repositioning tax" gives the
 * 68.36 the sheet divides by.
 *
 * Uptime is a CLOCK factor, not resistance — it reduces damage delivered, it does not multiply
 * the creature's HP. Counting it as sustain would be the double-count the model forbids.
 */
export function pcEffectiveDamage(targetResolvedDpr: number, uptime = 1): number {
  return targetResolvedDpr * Math.max(0, Math.min(1, uptime));
}

/**
 * The worked four-player level-5 Wendigo Wight calibration, kept as a regression anchor.
 *
 * It is a CALIBRATION EXAMPLE, not a rule for future monsters — the generic model is the
 * ladder above. Recorded so a later change to the clocks can be checked against a case whose
 * answer is published.
 */
export const WIGHT_L5_CALIBRATION = {
  hpByPartySize: { 3: 98, 4: 130, 5: 163 },
  lesserHpByPartySize: { 3: 34, 4: 45, 5: 56 },
  targetResolvedDpr: 79.492684475,
  uptime: 0.86,
  pcEffectiveDamage: 68.36370864850001,
  monsterSustain: 281.2,
  monsterSustainedDamage: 34,
  partySustain: 190,
  pcer: 4.1132935231150585,
  mer: 5.588235294117647,
  pressure: 0.7360630515048,
  roundMargin: 1.4749417710025883,
} as const;

/** Read a creature's two clocks and place it on the ladder. */
export function auditEncounter(params: {
  monsterSustain: number;
  monsterDamage: number;
  level: number;
  target?: EscalationId;
}): EncounterAudit {
  const pcDamage = midpointDprForLevel(params.level);
  const partySustain = partySustainForLevel(params.level);
  const p = pcer(params.monsterSustain, pcDamage);
  const m = mer(partySustain, params.monsterDamage);
  const pr = pressure(p, m);

  let nearest = ESCALATION_LADDER[0];
  for (const pos of ESCALATION_LADDER) {
    if (Math.abs(pos.targetPcer - p) < Math.abs(nearest.targetPcer - p)) nearest = pos;
  }

  const targetPos = params.target ? escalationById(params.target) : undefined;
  return {
    pcer: p,
    mer: m,
    pressure: pr,
    roundMargin: roundMargin(m, p),
    nearest,
    target: targetPos
      ? { position: targetPos, pcerDelta: p - targetPos.targetPcer, pressureDelta: pr - targetPos.pressure }
      : undefined,
  };
}
