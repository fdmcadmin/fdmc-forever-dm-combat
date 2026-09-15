/**
 * A PC'S LOST TURN — what a stunning, paralyzing or incapacitating effect costs the party.
 *
 * Christopher, 2026-09-13: *"it should be charged on PC loses of turn not party loss of turn."* A PC
 * who is Paralyzed until the end of its next turn loses THAT PC's turn — its share of the party's
 * damage for the rounds the condition stands — never the whole party's round. Whole turns only: a
 * condition that leaves the PC acting at disadvantage is not charged here (his choice, same day).
 *
 * And it counts when the creature CHOOSES: *"Control counts."* A lost PC turn is worth that PC's share
 * of the party's damage, so the Hollow Mourner's Claws (4.8 damage + 14.7% to paralyze) is scheduled
 * over its Bite (5.8) — see `actionTrace`.
 *
 *   per use      P(hit) × P(fail)  — the attack roll and/or the save that decides whether it lands
 *   per PC       the chance each of its following turns is lost, from the printed duration:
 *                  until the start of the TARGET's next turn        0 turns (it ends before it acts)
 *                  until the start/end of its next turn             1
 *                  two turns / N rounds                             2 / N
 *                  a minute, an hour, concentration                 the encounter's horizon
 *                  a repeat save at the start / end of its turns    P_REPEAT_FAIL per turn (BR075/BR076)
 *
 * ⚠ NOTHING WITHOUT A RESOLUTION AND A DURATION IS CHARGED. No attack roll or save means nothing says
 * who it lands on; no printed duration is NEEDS_INPUT under Runtime Contract r35. Both are reported
 * instead — which is also what keeps the SRD import's rules-glossary sentences ("You have the
 * Incapacitated condition") from charging anyone.
 *
 * ⚠ A CONCENTRATION HOLD IS NOT APPLIED TO CONTROL YET — a concentrated condition is charged for the
 * turns it prints, as though the caster keeps it. Flagged in `basis`.
 */
import type { ParsedFeature } from "./featureResolver";
import { CONDITION_EFFECTS, conditionsImposedBy } from "./controlPricing";
import { readDurationReaders, withoutEndingClauses } from "./mechanicText";
import { repeatFailChance, saveEndsActiveTurns, type SaveEndsTiming } from "./durationPricing";

export type TurnDenial = {
  /** The action-removing conditions it imposes. */
  conditions: string[];
  /** The chance one target is caught by one use. */
  perTarget: number;
  /** For a caught PC, the chance each of its following turns is lost: turn 1, turn 2, … */
  turns: number[];
  expectedTurns: number;
  basis: string;
};
/** It imposes a turn-removing condition, but cannot be charged — and says why. */
export type TurnDenialUnpriced = { conditions: string[]; reason: string };

type Target = { ac: number; saveBonus: number; saves?: Partial<Record<string, number>> };

/** A minute, an hour or a concentration effect outlasts any fight; the simulation truncates at its end. */
const HORIZON_TURNS = 10;
const WORD: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function turnDenialFor(feature: ParsedFeature, target: Target): TurnDenial | TurnDenialUnpriced | undefined {
  const text = String(feature.text ?? "");
  const lower = text.toLowerCase();
  const imposing = withoutEndingClauses(lower);
  const conditions = conditionsImposedBy(feature)
    .filter(c => CONDITION_EFFECTS[c]?.actionsLost)
    .filter(c => !(lower.includes(c) && !imposing.includes(c)));   // named only in how it ends
  if (conditions.length === 0) return undefined;

  const hit = feature.attackBonus !== undefined
    ? Math.min(0.95, Math.max(0.05, (21 + feature.attackBonus - target.ac) / 20))
    : undefined;
  const saveBonus = feature.saveAbility ? target.saves?.[feature.saveAbility] ?? target.saveBonus : target.saveBonus;
  const fail = feature.saveDc !== undefined ? repeatFailChance(feature.saveDc, saveBonus) : undefined;
  if (hit === undefined && fail === undefined) {
    return { conditions, reason: "no attack roll or saving throw decides who it lands on" };
  }
  const perTarget = (hit ?? 1) * (fail ?? 1);

  const readers = readDurationReaders(text);
  const has = (id: string) => readers.some(r => r.value === id);
  const fixed: number[] = [];
  // BR061 "for the rest of the turn" closes with the turn it lands in: no following turn is lost.
  if (has("BR064") || has("BR061")) fixed.push(0);
  if (has("BR062") || has("BR063") || has("BR065")) fixed.push(1);
  if (has("BR066")) fixed.push(2);
  if (has("BR067")) {
    const n = lower.match(/\b(?:for |lasts? )(\d+|three|four|five|six|seven|eight|nine) (?:turns|rounds)\b/)?.[1];
    fixed.push(n ? Number(WORD[n] ?? n) : HORIZON_TURNS);
  }
  if (has("BR068") || has("BR069") || has("BR070") || has("BR071")) fixed.push(HORIZON_TURNS);
  const saveEnds = has("BR075") ? "BR075" : has("BR076") ? "BR076" : has("BR077") ? "BR077" : undefined;
  if (fixed.length === 0 && !saveEnds) {
    return { conditions, reason: "no printed duration — Runtime Contract r35" };
  }
  const cap = fixed.length ? Math.min(...fixed) : HORIZON_TURNS;

  let turns: number[];
  let durationNote: string;
  if (saveEnds && feature.saveDc !== undefined) {
    const timing: SaveEndsTiming = saveEnds === "BR075" ? "start" : saveEnds === "BR076" ? "end" : "interval";
    const repeat = repeatFailChance(feature.saveDc, saveBonus);
    turns = saveEndsActiveTurns(timing, repeat, cap).duringTurn;
    durationNote = `repeat save at the ${timing === "start" ? "start" : "end"} of each turn (${pct(repeat)} fail), up to ${cap}`;
  } else {
    turns = Array.from({ length: cap }, () => 1);
    durationNote = `${cap} turn${cap === 1 ? "" : "s"}${cap === HORIZON_TURNS ? " (the encounter)" : ""}`;
  }
  const expectedTurns = turns.reduce((s, p) => s + p, 0);
  const odds = [hit !== undefined ? `${pct(hit)} hit` : "", fail !== undefined ? `${pct(fail)} fail` : ""].filter(Boolean).join(" × ");
  return {
    conditions, perTarget, turns, expectedTurns,
    basis: `${conditions.join(" / ")}: ${odds} → ${durationNote} → ${expectedTurns.toFixed(2)} of a PC's turns per target caught`
      + (has("BR070") ? " (concentration hold not applied)" : ""),
  };
}
