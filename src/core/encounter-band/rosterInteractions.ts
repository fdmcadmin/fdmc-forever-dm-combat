/**
 * THE ROSTER PASS — what one creature's action does to the OTHER creatures in the fight.
 *
 * Christopher, 2026-09-13: *"why can we price aoe spells that do damage but not aoe spells that buff
 * and hinder."* Every creature was priced alone, so an action whose value lands on an ally had no
 * step in which to be priced, and read 0. The v4 Roster Interaction workbook states the rule:
 *
 *   Act3 Pricing Readme r19  "Effects that change another creature's attacks, saves, target
 *                             assignment, or survival are priced only after the encounter roster is
 *                             assembled. They never become a flat multiplier on the source body."
 *   Runtime Contract r24     "A creature-level 0 or x1.000 is not a priced answer."
 *
 * ── WINTER'S TOLL + CRUEL INSTRUCTION ───────────────────────────────────────────────────────────
 *
 *   burden(round) = Σ ranked allies  coverage_k × (trace at AC − N − trace)       the zone's offence
 *                 + share of PCs inside × Σ allies (trace at PC saves − M − trace)  PCs' worse saves
 *                 + best ally's one normal attack at AC − N                         Cruel Instruction
 *                 − the source's own Action damage × (1 in round 1, 1/duration after)
 *
 *   and, while the source stands, the party's own damage × (1 − share of PCs inside × (1 − p′/p)).
 *
 * ⚠ WHO IS INSIDE — Christopher's placement, not the workbook's half-roster. *"the winter toll … would
 * always be centered on 1 ally, with it possibly hitting both in rare instances so maybe 30% for both
 * and 100% for a single"*, and for the party, *"the same style we did for the aoe pricing against
 * parties so about 1/3 the time for more then 1 and 75% for 1 in the area … each additional PC is lower
 * and lower % to be effected after 2nd one."* See `ZONE_COVERAGE`.
 *
 * The workbook's half-roster rule is kept as `coverage: "half-roster"`, because its Act3 Roster
 * Interactions burden cells were priced with it — `check:rosterinteractions` reproduces all four cells
 * to the last digit that way, which is what proves the FORMULA; the campaign prices with the placement.
 *
 * ⚠ THE PARTY'S HIT CHANCE IS READ, NEVER GUESSED. Without a chosen party `hitChance` is absent, and a
 * −N on the party's attacks is named as needing one rather than priced off an invented accuracy — the
 * same rule `PartyDefence.hitChance` states for every persistent defence.
 *
 * ── COMMANDING PRESENCE ─────────────────────────────────────────────────────────────────────────
 *
 * A PASSIVE forced target leads the kill order. A REACTION redirects ONE party Action a round — see
 * `RosterGroup.redirectsPartyActionsPerRound` and `checkerV2.damageIntoGroup`.
 *
 * ── COLD COUNSEL ────────────────────────────────────────────────────────────────────────────────
 *
 * *"ROSTER EVENT REQUIRED … Never silently treat this as zero."* Named on the roster line; the checker
 * has no per-attack target-event layer.
 */

import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { sameActionName, type RosterInteraction } from "../monsters/rosterInteraction";
import { riderWeight } from "../monsters/monsterRider";
import { parseCreature, type ParsedCreature } from "./parseCreature";
import { traceCreature } from "./actionTrace";
import { resolveFeature, expectedDamageForFeature, type ParsedFeature } from "./featureResolver";
import { damageExpressionAverage } from "./damageExpression";
import type { RosterGroup } from "./checkerV2";

type Target = Parameters<typeof traceCreature>[1] & {
  /** The chosen party's own chance to hit, 0–1. Absent without a chosen party — never guessed. */
  hitChance?: number;
};
type Zone = Extract<RosterInteraction, { kind: "roll_modifier_zone" }>;

/**
 * How likely the k-th body is to be inside a zone the creature places, first body first.
 *
 *   allies    1.00, 0.30, …   "always centered on 1 ally … maybe 30% for both"
 *   the party 0.75, 1/3,  …   "75% for 1 in the area … about 1/3 the time for more then 1"
 *
 * After the second, each body continues the SAME step — the ratio between the first two — so every
 * additional body is "lower and lower": allies 9%, 2.7%…; PCs 14.8%, 6.6%…
 */
export const ZONE_COVERAGE = {
  allies: { first: 1, second: 0.3 },
  party: { first: 0.75, second: 1 / 3 },
} as const;

export function rankedCoverage(model: { first: number; second: number }, bodies: number): number[] {
  const out: number[] = [];
  const step = model.first > 0 ? model.second / model.first : 0;
  for (let k = 0; k < Math.max(0, Math.floor(bodies)); k++) {
    out.push(k === 0 ? model.first : model.second * Math.pow(step, k - 1));
  }
  return out;
}

export type InteractionEntry = {
  /** The roster group id — a creature's templateId. */
  id: string;
  name: string;
  template: MainMonsterTemplate;
  quantity: number;
  initiativeMod?: number;
};

export type InteractionAssumption = { creature: string; flag: "NEEDS DM INPUT" | "ESTIMATED"; field: string; detail: string };

export type ZoneBurden = {
  source: string;
  zone: string;
  extraAttackName?: string;
  /** Expected allied attack bodies inside the zone. */
  alliesInside: number;
  /** Expected PCs inside the zone. */
  pcsInside: number;
  /** Per round 1..4+: the +N on the allies it covers. */
  allyGain: number[];
  /** Per round: the allies' save effects landing more often on the PCs inside. */
  saveGain: number[];
  /** Per round: the best ally's extra attack. */
  extraAttack?: number[];
  extraAttackFrom?: string;
  /** Per round: what the source gives up of its own Action. */
  actionGivenUp: number[];
  /** Per round: the burden added to the encounter. */
  burden: number[];
  /** What survives of the party's damage while the zone stands, or undefined if it cannot be priced. */
  partyDamageFactor?: number;
};

export type RosterInteractionResult = {
  /** Bodiless rows carrying the added burden, each ending with its source. */
  rows: RosterGroup[];
  /** Group ids that must lead the kill order — a PASSIVE forced target. */
  killOrderFirst: string[];
  /** Groups a forced-target REACTION sends party Actions to, once a round. */
  redirects: { id: string; actionsPerRound: number }[];
  assumptions: InteractionAssumption[];
  burdens: ZoneBurden[];
};

export type RosterInteractionOptions = {
  /**
   * `placement` (default) — Christopher's placement, `ZONE_COVERAGE`.
   * `half-roster` — the workbook's own convention, (roster bodies / 2) spread evenly over the allied
   * attack bodies and half the party; what its Act3 Roster Interactions cells were priced with.
   */
  coverage?: "placement" | "half-roster";
};

const ROUNDS = [0, 1, 2, 3] as const;

/** An attack roll this creature actually makes — what a +N to attack rolls can move. */
function makesAttackRolls(parsed: ParsedCreature): boolean {
  return parsed.features.some(f => f.attackBonus !== undefined && !f.gated && f.activationType !== "trait");
}

/** "One normal attack": an Action attack that is not a spell, a recharge or a limited use. */
function isNormalAttack(f: ParsedFeature): boolean {
  return f.activationType === "action" && f.attackBonus !== undefined && !f.gated
    && f.spellSlotLevel === undefined && !f.recharge && f.uses === undefined;
}

function bestSingleAttack(parsed: ParsedCreature, target: Target): { name: string; value: number } | undefined {
  let best: { name: string; value: number } | undefined;
  for (const f of parsed.features) {
    if (!isNormalAttack(f)) continue;
    const resolved = resolveFeature(f, { recordedDefences: parsed.recordedDefences });
    const { expected } = expectedDamageForFeature(resolved, f, target);
    const hit = Math.min(0.95, Math.max(0.05, (21 + (f.attackBonus as number) - target.ac) / 20));
    // A per-hit rider rides this attack; a once-per-turn one belongs to the turn, not to one swing.
    const perHit = (f.riders ?? []).filter(r => r.cadence === "per-hit")
      .reduce((sum, r) => sum + damageExpressionAverage(r.damage) * riderWeight(r, hit, 1), 0);
    const value = expected + perHit;
    if (!best || value > best.value) best = { name: f.name, value };
  }
  return best;
}

function roundTotals(parsed: ParsedCreature, target: Target): number[] {
  const rounds = traceCreature(parsed, target, 4).rounds;
  return ROUNDS.map(i => rounds[i]?.totalExpectedDamage ?? rounds[rounds.length - 1]?.totalExpectedDamage ?? 0);
}

/** The same party with every save moved by `delta` — a −3 to hostile saving throws. */
function withSavesShifted(target: Target, delta: number): Target {
  const saves = target.saves
    ? Object.fromEntries(Object.entries(target.saves).map(([k, v]) => [k, Number(v) + delta])) as Target["saves"]
    : undefined;
  return { ...target, saveBonus: target.saveBonus + delta, ...(saves ? { saves } : {}) };
}

export function rosterInteractions(
  entries: readonly InteractionEntry[],
  target: Target,
  options: RosterInteractionOptions = {},
): RosterInteractionResult {
  const out: RosterInteractionResult = { rows: [], killOrderFirst: [], redirects: [], assumptions: [], burdens: [] };
  const live = entries.filter(e => Number(e.quantity) > 0);
  // An interaction needs somebody to interact WITH. A creature priced alone keeps its own numbers.
  if (live.length < 2) return out;

  const coverageModel = options.coverage ?? "placement";
  const all = live.map(entry => ({ entry, parsed: parseCreature(entry.template) }));
  const rosterBodies = live.reduce((sum, e) => sum + Number(e.quantity), 0);
  const partySize = Math.max(1, Math.round(Number(target.partySize ?? 4)));
  const note = (creature: string, flag: InteractionAssumption["flag"], detail: string) =>
    out.assumptions.push({ creature, flag, field: "roster", detail });
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  for (const source of all) {
    const { entry, parsed } = source;
    const withInteraction = parsed.features.filter(f => f.rosterInteraction);
    if (withInteraction.length === 0) continue;
    const of = (kind: RosterInteraction["kind"]) => withInteraction.filter(f => f.rosterInteraction?.kind === kind);

    // ── forced target order ────────────────────────────────────────────────────────────────
    /**
     * ⚠ A REACTION IS ONCE A ROUND, AND THAT IS THE DIFFERENCE BETWEEN THE TWO BRANCHES.
     *
     * Christopher: *"it should be once per turn, not a constant passive, so the read is still a
     * reaction."* A PASSIVE forced target (a trait) sends every creature-targeting Action at it, so it
     * leads the kill order. A REACTION spends the creature's one Reaction to redirect ONE Action a
     * round — one PC's share of the party's damage goes into it, and the rest follows the order.
     */
    const forced = of("forced_target_order")[0];
    if (forced) {
      const persistent = forced.activationType === "trait" || forced.activationType === "free";
      if (persistent) {
        out.killOrderFirst.push(entry.id);
        note(entry.name, "ESTIMATED",
          `${forced.name}: ${entry.name} is first in the kill order — every creature-targeting Action must target it while it is legal, so its allies stay up longer. No EHP multiplier; area and point effects keep their own targeting.`);
      } else {
        out.redirects.push({ id: entry.id, actionsPerRound: 1 });
        note(entry.name, "ESTIMATED",
          `${forced.name} (once a round): one party Action each round must target ${entry.name} while it stands — 1 of ${partySize} PCs' damage goes into it before the kill order, so its allies are reached later. No EHP multiplier.`);
      }
    }

    // ── a zone, and an extra attack from an ally ───────────────────────────────────────────
    const zones = of("roll_modifier_zone");
    const zoneF = zones[0];
    const extraF = of("ally_extra_attack")[0];
    if (zones.length > 1) {
      note(entry.name, "ESTIMATED", `"${zoneF.name}" is authored ${zones.length} times on ${entry.name}; it is priced once.`);
    }

    if (zoneF || extraF) {
      const zone = zoneF?.rosterInteraction as Zone | undefined;
      const allies = all.filter(a => a !== source && makesAttackRolls(a.parsed));
      const eligibleBodies = allies.reduce((sum, a) => sum + Number(a.entry.quantity), 0);
      const allyAttack = Number(zone?.allyAttack ?? 0);
      const hostileAttack = Number(zone?.hostileAttack ?? 0);
      const hostileSave = Number(zone?.hostileSave ?? 0);
      const duration = Math.max(1, Math.round(Number(zone?.durationRounds ?? 1)));
      const shifted: Target = { ...target, ac: target.ac - allyAttack };

      // ── the +N on allied attacks: who is inside, best ally first ──
      const allyGain = ROUNDS.map(() => 0);
      let alliesInside = 0;
      if (zone && allyAttack !== 0 && eligibleBodies > 0) {
        const perBody = allies.flatMap(ally => {
          const base = roundTotals(ally.parsed, target);
          const boosted = roundTotals(ally.parsed, shifted);
          const gain = ROUNDS.map(i => boosted[i] - base[i]);
          return Array.from({ length: Number(ally.entry.quantity) }, () => gain);
        });
        if (coverageModel === "half-roster") {
          const even = Math.min(1, (rosterBodies / 2) / eligibleBodies);
          alliesInside = even * eligibleBodies;
          for (const gain of perBody) for (const i of ROUNDS) allyGain[i] += even * gain[i];
        } else {
          // The zone is centred on the ally it helps most; the rest are caught less and less often.
          const ranked = [...perBody].sort((a, b) => b[1] - a[1]);
          const weights = rankedCoverage(ZONE_COVERAGE.allies, ranked.length);
          alliesInside = weights.reduce((s, w) => s + w, 0);
          ranked.forEach((gain, k) => { for (const i of ROUNDS) allyGain[i] += weights[k] * gain[i]; });
        }
      }

      // ── the PCs inside: their −M saves, and their −N attacks ──
      const pcsInside = !zone ? 0
        : coverageModel === "half-roster" ? partySize / 2
        : rankedCoverage(ZONE_COVERAGE.party, partySize).reduce((s, w) => s + w, 0);
      const pcShare = Math.min(1, pcsInside / partySize);

      const saveGain = ROUNDS.map(() => 0);
      if (zone && hostileSave !== 0 && pcShare > 0) {
        const worseSaves = withSavesShifted(target, hostileSave);
        // Every other creature — one whose damage is all saves makes no attack roll and still gains.
        for (const ally of all.filter(a => a !== source)) {
          const base = roundTotals(ally.parsed, target);
          const landed = roundTotals(ally.parsed, worseSaves);
          for (const i of ROUNDS) saveGain[i] += pcShare * Number(ally.entry.quantity) * Math.max(0, landed[i] - base[i]);
        }
      }

      let partyDamageFactor: number | undefined;
      if (zone && hostileAttack !== 0 && pcShare > 0) {
        const p = Number(target.hitChance);
        if (Number.isFinite(p) && p > 0) {
          const pShifted = Math.min(0.95, Math.max(0.05, p + hostileAttack * 0.05));
          partyDamageFactor = 1 - pcShare * (1 - pShifted / p);
        }
      }

      // ── Cruel Instruction: one ally inside makes one normal attack ──
      let extraAttack: number[] | undefined;
      let extraAttackFrom: string | undefined;
      if (extraF) {
        const required = (extraF.rosterInteraction as { requiresZone?: string }).requiresZone;
        if (required && !(zoneF && sameActionName(required, zoneF.name))) {
          note(entry.name, "NEEDS DM INPUT",
            `${extraF.name} needs an ally inside "${required}", but ${entry.name} has no zone action by that name.`);
        } else {
          const against = required ? shifted : target;
          let best: { name: string; value: number; who: string } | undefined;
          for (const ally of allies) {
            const attack = bestSingleAttack(ally.parsed, against);
            if (attack && (!best || attack.value > best.value)) best = { ...attack, who: ally.entry.name };
          }
          if (best) {
            // The zone is centred on an ally, so one is always inside to be instructed.
            extraAttack = ROUNDS.map(() => best!.value);
            extraAttackFrom = `${best.who}'s ${best.name}`;
          }
        }
      }

      /**
       * What the source gives up of its own Action to do this.
       *
       *   a zone cast as an Action          all of round 1, then once per `duration` to keep it up
       *   an extra attack given as an Action (no zone)   every round it is used
       *
       * A Bonus Action costs no Action — the Harrow's Cruel Instruction is that case.
       */
      const sourceRounds = traceCreature(parsed, target, 4).rounds;
      const ownAction = (i: number) => ((sourceRounds[i] ?? sourceRounds[sourceRounds.length - 1])?.scheduled ?? [])
        .filter(s => s.channel === "action").reduce((sum, s) => sum + s.expectedDamage, 0);
      const actionGivenUp = ROUNDS.map(i => {
        if (zoneF && zoneF.activationType === "action") return ownAction(i) * (i === 0 ? 1 : 1 / duration);
        /**
         * ⚠ A BLOCK THAT PRINTS "Bonus Action." COSTS NO ACTION, whatever channel its row landed in.
         * The Greenwood Reaver's Cruel Command opens with exactly that sentence and is authored as a
         * plain action, so the channel alone would charge the Reaver a whole routine for it.
         */
        const printedBonus = /^\s*bonus action\b/i.test(extraF?.text ?? "");
        if (!zoneF && extraF && extraF.activationType === "action" && !printedBonus) return ownAction(i);
        return 0;
      });

      const burden = ROUNDS.map(i => Math.max(0, allyGain[i] + saveGain[i] + (extraAttack?.[i] ?? 0) - actionGivenUp[i]));
      const label = [zoneF?.name, extraF?.name].filter(Boolean).join(" + ");
      out.burdens.push({
        source: entry.name, zone: zoneF?.name ?? "", extraAttackName: extraF?.name, alliesInside, pcsInside,
        allyGain, saveGain, extraAttack, extraAttackFrom, actionGivenUp, burden, partyDamageFactor,
      });

      if (burden.some(b => b > 0) || (partyDamageFactor !== undefined && partyDamageFactor < 1)) {
        out.rows.push({
          id: `${entry.id}:roster`,
          name: `${entry.name} — ${label} (on its allies)`,
          quantity: 1,
          baseHp: 0,
          bodiless: true,
          acMultiplier: 1,
          traitFactors: [],
          dpr: { round1: burden[0], round2: burden[1], round3: burden[2], round4Plus: burden[3] },
          damageUptime: 1,
          arrivesRound: 1,
          // The zone ends when its source is Incapacitated — the roster's nearest statement of that.
          endsWithGroupId: entry.id,
          initiativeMod: entry.initiativeMod,
          ...(partyDamageFactor !== undefined ? { partyDamageFactor } : {}),
        });
      }

      const parts = [
        zone && allyAttack !== 0
          ? `${allyAttack > 0 ? "+" : ""}${allyAttack} to hit for ${alliesInside.toFixed(2)} of ${eligibleBodies} allied attack bod${eligibleBodies === 1 ? "y" : "ies"} inside (+${allyGain[1].toFixed(1)})`
          : undefined,
        zone && hostileSave !== 0 && saveGain[1] > 0
          ? `${hostileSave} to the saves of ${pcsInside.toFixed(2)} PCs inside (+${saveGain[1].toFixed(1)})`
          : undefined,
        extraAttack ? `${extraAttackFrom} as the extra attack (+${extraAttack[1].toFixed(1)})` : undefined,
        actionGivenUp[0] > 0 ? `less ${actionGivenUp[0].toFixed(1)} of ${entry.name}'s own Action in round 1, ${actionGivenUp[1].toFixed(1)} after` : undefined,
        partyDamageFactor !== undefined
          ? `the party deals ${pct(1 - partyDamageFactor)} less while it stands (${hostileAttack} to hit for ${pcsInside.toFixed(2)} of ${partySize} PCs)`
          : undefined,
      ].filter(Boolean);
      const unresolved = [
        zone && hostileAttack !== 0 && partyDamageFactor === undefined
          ? `${hostileAttack} to the party's attacks needs a chosen party's hit chance`
          : "",
        zone?.allySave ? `${zone.allySave > 0 ? "+" : ""}${zone.allySave} to allies' saves needs the party's save DCs, which the checker does not read` : "",
      ].filter(Boolean);
      note(entry.name, "ESTIMATED",
        `${label}: +${burden[0].toFixed(1)} damage in round 1, +${burden[1].toFixed(1)} a round after — ${parts.join("; ") || "nothing it can add"}.`
        + (unresolved.length ? ` Not priced: ${unresolved.join("; ")}.` : ""));
    }

    // ── target substitution — a target event, named rather than priced ─────────────────────
    for (const sub of of("target_substitution")) {
      const required = (sub.rosterInteraction as { requiresZone?: string }).requiresZone;
      note(entry.name, "ESTIMATED",
        `${sub.name}: moves a targeted ally${required ? ` inside ${required}` : ""} and re-checks the attack's target — a target event the checker does not resolve yet. The workbook publishes no numeric burden for it.`);
    }
  }
  return out;
}
