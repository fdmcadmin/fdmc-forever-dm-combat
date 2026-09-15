/**
 * THE UNCHOSEN PARTY'S ACCURACY — the balanced centre line's own actors, resolved against THIS fight.
 *
 * Christopher, 2026-09-13: *"make sure the checker can price against the unchosen party dpr balanced
 * center line."* With no chosen party the checker already runs the certified centre curve for DPR and
 * sustain. That curve has no accuracy in it, so everything priced through the party's hit chance — a
 * zone's −3 to the party's attacks, a persistent disadvantage defence — fell back to a floor or went
 * unpriced, and a fight read differently depending on whether anyone had picked characters.
 *
 * ⚠ A HIT CHANCE IS NEVER STORED OR ASSUMED. The runtime authority: *"Resolve real actor attack
 * bonuses/save DCs against real target AC/saves; do not store 65% as an outcome."* The table holds the
 * endpoint ACTORS' final attack bonuses and save DCs (`centerLineAccuracy.generated.ts`); this module
 * resolves each one against the fight's own AC or saves and takes the mean, which is exactly the centre:
 * (BOS + BDS + WOS + ODS) / 4 over parties of equal size.
 *
 * Levels 17-20 carry no population run ("NOT USED BY CHECKER") and return undefined — absent, not guessed.
 * Party size is the certification's own 3-6; outside that it is clamped to the nearest published size.
 */
import { CENTER_LINE_ACTORS, type CenterActor } from "./centerLineAccuracy.generated";
import type { PartyEquipmentMode } from "./partyCurveV2";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);

/** Every member of the four endpoint parties at this size, level and mode. */
export function centerLineActors(level: number, mode: PartyEquipmentMode, partySize: number): CenterActor[] | undefined {
  const size = clamp(Math.round(Number(partySize) || 4), 3, 6);
  const row = CENTER_LINE_ACTORS[`${size}P|${Math.round(Number(level))}|${mode}`];
  const actors = row?.endpoints.flatMap(e => e.members);
  return actors && actors.length > 0 ? actors : undefined;
}

/** The centre party's chance to hit THIS AC: each actor's own bonus through the d20, then the mean. */
export function centerLineHitChance(level: number, mode: PartyEquipmentMode, partySize: number, targetAc: number | undefined): number | undefined {
  const actors = centerLineActors(level, mode, partySize);
  if (!actors || typeof targetAc !== "number" || !Number.isFinite(targetAc)) return undefined;
  return mean(actors.map(a => clamp((21 + a.attackBonus - targetAc) / 20, 0.05, 0.95)));
}

/**
 * The share of the centre party's damage delivered by ATTACK ROLLS rather than saves — the part a −N
 * to its attacks can touch. The mean of the actors' own `attackShare`.
 */
export function centerLineAttackShare(level: number, mode: PartyEquipmentMode, partySize: number): number | undefined {
  const actors = centerLineActors(level, mode, partySize);
  return actors ? mean(actors.map(a => a.attackShare)) : undefined;
}

/**
 * ONE MELEE ATTACK, as a share of one centre actor's round — what a target-substitution Reaction moves.
 *
 * Christopher, 2026-09-15: *"cold counsel should use the 4 parties the balanced center was based line to
 * determine the melee share."* Cold Counsel moves a targeted ally out of reach, so what it can touch is the
 * part of the party's damage delivered INSIDE 5 ft: each actor's attack-delivered share when its own weapon
 * is a melee weapon, and none of it when the weapon throws, shoots or is a focus (`CenterActor.melee`).
 *
 * ⚠ ONE SWING, NOT A TURN. The Reaction re-checks ONE attack, so an actor's melee share is divided by the
 * swings its Attack action makes at this level (`CenterActor.attacks`) — at L11 a fighter's three attacks are
 * not all moved by one Reaction. The mean is over every endpoint actor, a non-melee actor counting as 0.
 *
 * The caller divides by party size to turn "one actor's round" into a share of the PARTY's round.
 */
export function centerLineMeleeAttackShare(level: number, mode: PartyEquipmentMode, partySize: number): number | undefined {
  const actors = centerLineActors(level, mode, partySize);
  return actors ? mean(actors.map(a => (a.melee ? a.attackShare / Math.max(1, a.attacks) : 0))) : undefined;
}

/**
 * The centre party's save DCs, one per actor that HAS one — for a +N to the saves of the creatures they
 * target. A non-caster before its first save DC has none, and is left out rather than given a zero.
 */
export function centerLineSaveDcs(level: number, mode: PartyEquipmentMode, partySize: number): number[] | undefined {
  const dcs = centerLineActors(level, mode, partySize)
    ?.map(a => a.spellSaveDc)
    .filter((dc): dc is number => typeof dc === "number" && Number.isFinite(dc));
  return dcs && dcs.length > 0 ? dcs : undefined;
}
