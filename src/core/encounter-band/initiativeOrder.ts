/**
 * BODY-LEVEL INITIATIVE — who resolves their turn before the party's damage lands.
 *
 * Christopher, 2026-09-02: *"i want the way the workbooks operates to be the same way the app
 * operates like we had talked about without making the workbook a requirement to be built into
 * the app."* And earlier, on what the workbook was doing that the app was not: *"it also takes
 * into account the dex and initiative of the creatures vs each other and then our app would place
 * the initiative of the PC into those spots around them."*
 *
 * ─── WHAT THIS REPLACES ─────────────────────────────────────────────────────────────────────
 *
 * The simulation resolved a round's monster output as the MIDPOINT of its start-of-round and
 * end-of-round DPR:
 *
 *     monsterDamage = (monsterDprStart + monsterDprEnd) / 2
 *
 * That is a real initiative model — v7 calls it "a single initiative model" and forbids stacking a
 * second discount on top of it — but it is a fixed one. It asserts that exactly half the roster's
 * output resolves before the party's damage arrives, every round, in every fight, whatever is
 * standing on either side.
 *
 * The workbook's `Initiative Scheduler` contract says the share is not fixed, it is READ:
 *
 *     Decisive round — A body that acts earlier resolves its legal turn before a later body can
 *     remove it. A body removed before its count contributes no later turn output.
 *
 *     No tactical invention — Initiative comes from imported rules/stats. If an encounter needs
 *     Creature A to reliably act before Creature B, that must come from its actual initiative
 *     modifier or an authored initiative mechanic.
 *
 * ⚠ THIS IS A GENERALISATION, NOT A REWRITE. `hostileFractionActingFirst` returns exactly 0.5 for
 * a roster whose initiative matches the party's, so a fight between evenly-matched bodies produces
 * the identical number the midpoint produced. What changes is the fight where it should: a Darkmare
 * at DEX +4 against a party at +1 now lands more of its output before the party can remove it, and
 * a siege engine at −2 lands less. That difference was previously unrepresentable.
 *
 * ─── ⚠ WHY A PROBABILITY AND NOT AN ORDER ───────────────────────────────────────────────────
 *
 * The scheduler sheet lists an `Order` column and fills its example with an expected roll of 10.5
 * for every body, which orders them by modifier alone. Its own runtime rule then says why that
 * example is not the model: *"Use actual d20 rolls in simulation/playtest traces. Expected-roll
 * rows are only a readable example; they are not a probability substitute for the real body
 * scheduler."*
 *
 * A hard order off expected rolls would make this a cliff: +0 against +1 would send a body's ENTIRE
 * round of output from "after the party" to "before the party", and a checker that swings a whole
 * body on one point of DEX is not reporting anything a DM can use. The checker is a projection over
 * every way the dice can fall, so the honest figure is the actual probability that this body's
 * d20 + modifier beats the party's — exact, closed form, and derived only from imported stats,
 * which is what "no tactical invention" asks for. Live play rolls real dice; that is the combat
 * tracker's job, and it already does it with `getActorInitiativeModifier`.
 */

// Both from the ruleset: this file is inside the packaged engine, and the monster creator is not (see dnd5e.ts).
import { abilityModifier, parseAbilityScore } from "../rules/dnd5e";

/**
 * P(a body with `mod` acts before a body with `partyMod`), both rolling a d20.
 *
 * Exact rather than sampled: the difference of two d20s is triangular, so
 * P(dA − dB > k) is a closed sum. A tie on the total is broken by the higher modifier, and a
 * genuine tie on both is a coin flip — the same convention a table uses.
 */
export function initiativeWinProbability(mod: number, partyMod: number): number {
  const k = partyMod - mod;
  let strictlyGreater = 0;
  let equal = 0;
  // dA − dB spans −19..19; the count of ways to make m is 20 − |m|.
  for (let m = -19; m <= 19; m += 1) {
    const ways = 20 - Math.abs(m);
    if (m > k) strictlyGreater += ways;
    else if (m === k) equal += ways;
  }
  const tieShare = mod > partyMod ? 1 : mod < partyMod ? 0 : 0.5;
  return (strictlyGreater + equal * tieShare) / 400;
}

/** A creature's initiative modifier: its DEX, unless the sheet states one outright. */
export function creatureInitiativeModifier(source: {
  initiative?: number | null;
  abilities?: { label: string; value: string }[];
} | undefined): number {
  if (!source) return 0;
  if (typeof source.initiative === "number" && Number.isFinite(source.initiative)) return source.initiative;
  const dex = source.abilities?.find(a => a.label?.trim().toUpperCase() === "DEX");
  return dex ? abilityModifier(parseAbilityScore(dex.value)) : 0;
}

export type InitiativeBody = {
  name?: string;
  /** Bodies in this group. Each rolls its own d20, but they share a modifier. */
  quantity: number;
  initiativeMod: number;
  /** Round-1 output, used to weight this group's share of the roster's damage. */
  weight: number;
};

/**
 * The share of the roster's output that resolves BEFORE the party's damage for the round —
 * weighted by how much damage each body actually contributes.
 *
 * ⚠ WEIGHTED BY OUTPUT, NOT BY HEAD COUNT. Six goblins winning initiative matter less than one
 * dragon winning it, and a body-count average would say the opposite. The question this answers is
 * "how much of the incoming damage is already committed before the party can act", so damage is
 * the unit.
 *
 * Returns 0.5 for an empty or weightless roster — the midpoint this generalises, so a roster with
 * no readable output behaves exactly as it did before.
 */
export function hostileFractionActingFirst(bodies: readonly InitiativeBody[], partyMod: number): number {
  let weighted = 0;
  let total = 0;
  for (const b of bodies) {
    const w = Math.max(0, b.weight) * Math.max(0, b.quantity);
    if (w <= 0) continue;
    total += w;
    weighted += w * initiativeWinProbability(b.initiativeMod, partyMod);
  }
  return total > 0 ? weighted / total : 0.5;
}

/**
 * Each hostile body's rank against the OTHER HOSTILE BODIES — the scheduler's
 * *"Relative hostile order"* row. Ranked by modifier, highest first; the display is about which
 * of the DM's own creatures moves first, so the party is not in it.
 */
export function relativeHostileOrder(bodies: readonly InitiativeBody[]): Array<{ name: string; initiativeMod: number; rank: number }> {
  return [...bodies]
    .map(b => ({ name: b.name ?? "body", initiativeMod: b.initiativeMod }))
    .sort((a, b) => b.initiativeMod - a.initiativeMod)
    .map((b, i) => ({ ...b, rank: i + 1 }));
}
