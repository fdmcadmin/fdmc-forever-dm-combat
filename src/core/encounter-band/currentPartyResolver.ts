/**
 * THE CURRENT PARTY — R1/R2/R3/R4+ and five-round Sustain, read off the chosen characters.
 *
 * Authority: `broken_chain_checker_runtime_v3_3_slot_resource_budget.xlsx`, `Resource Conversion`.
 * Row 8 states the job in order: *"Schedule the legal actions, then write party R1/R2/R3/R4+ and
 * Sustain to Runtime Inputs."*
 *
 * This is the third piece. `actorAsCreature` (1) puts a PC into the shape the checker's own action
 * scheduler reads; `resourceLedger` (2) counts what each character may legally spend across the
 * day and reserves every use once. This one prices those uses and places them in rounds.
 *
 * ─── ⚠ ROUND SCHEDULING, NOT A DAILY AVERAGE ────────────────────────────────────────────────
 *
 * Row 45: *"Schedule legal resource uses by round, then write R1/R2/R3/R4+. The daily average is
 * an audit result, not a replacement for round scheduling."* A flat `damage/day ÷ 25` uplift adds
 * the same number to every round and flattens the curve; the certified rows decline (165 → 120)
 * because a party opens with its best and falls back to swinging. The audit figure is still
 * computed — and labelled `audit`, so it can never be mistaken for the round profile.
 *
 * ─── ⚠ WHAT A USE IS WORTH, IN THREE CASES ──────────────────────────────────────────────────
 *
 * Row 5: *"Marginal damage/use is damage above the Action that would otherwise be taken; on-hit
 * riders and extra Actions use their full incremental damage."* Christopher sharpened the chance
 * rule on top of it, and getting this wrong understates every smite in the campaign:
 *
 *   rider         a resource expended only AFTER the hit lands. Its per-use value is the FULL
 *                 rider damage and is NOT discounted by hit chance again — the hit already
 *                 happened, which is why the resource was spent at all.
 *   spell action  spent BEFORE the roll resolves, so its value is expected damage after hit or
 *                 save chance, MINUS the at-will action it displaces. A spell replacing a
 *                 20-damage swing with 35 contributes +15, never +35.
 *   extra action  resolves its own hit chance normally and displaces nothing — it is another
 *                 action, so it is worth another at-will routine.
 *
 * ─── ⚠ SUSTAIN IS PER ACTOR, NEVER A POOL ───────────────────────────────────────────────────
 *
 * `runtimeExecutionContract.actorState`: *"Per-PC HP, THP, Hit Dice, spell slots, class resources,
 * Reaction budget… No pooled party Sustain is a combat resource."* And `Runtime Contract!B87:B89`
 * excludes Hit Dice from in-fight sustain — they are spent on a Short Rest, which
 * `shortRestRecoveryFromActors` already owns. So sustain here is HP plus healing the ledger
 * allocated to sustain, counted once and capped, and it is a COMPARISON metric.
 */

import type { Actor } from "../types/actor";
import { actorAsCreature, type ResourceSpendingAction } from "./actorAsCreature";
import { resourceLedgerFromActor, RESOURCE_DAY, type ResourceLean } from "./resourceLedger";
import { reachOfFeature } from "./reachability";
import { parseCreature } from "./parseCreature";
import { traceCreature } from "./actionTrace";
import { damageExpressionAverage } from "./damageExpression";
// BR075-BR077, shared with the monster side so a save-ends effect is counted one way only.
import { saveEndsActiveTurns, repeatFailChance } from "./durationPricing";
// RULE ZERO: the card's own reroll reader, so the checker prices exactly what the table can press.
import { getRerollSources } from "../state/rerollSources";
import { itemChargeKey } from "../state/itemCharges";
import { rerollGain } from "./rerollPricing";
import { attackHitProbability } from "./checkerV2";
import { resolveFormulaVars } from "../state/resolveFormulaVars";
import { scoresFromTemplate } from "../monsters/creator/monsterCreatorModel";
import { abilityModifier } from "../rules/dnd5e";

export type ResolvedTarget = {
  ac: number;
  saveBonus: number;
  partySize: number;
  saves: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
};

/**
 * THE THING THE PARTY IS SWINGING AT — the fight's own bodies, weighted by how many there are.
 *
 * ⚠ THE DIRECTION IS THE OPPOSITE OF EVERY OTHER TARGET IN THIS FOLDER. `rosterFromLibrary` and
 * `traceCreature` price a CREATURE against the party, so their target is `partyDefenceAt`. Here
 * the party is the attacker, so the target is the roster — and using the party's own defence
 * curve by mistake would price this party's smites against this party's AC.
 *
 * ⚠ A MONSTER'S SAVE IS ITS BARE ABILITY MODIFIER. A stat block states proficient saves only when
 * it prints a Saving Throws line, which `MainMonsterTemplate` does not carry; `initiativeOrder`
 * already reads a creature's DEX the same way, so this is the same reading and not a second one.
 */
export function targetFromRoster(
  entries: ReadonlyArray<{ template: { stats?: { ac?: unknown }; abilities?: ReadonlyArray<{ label: string; value: string }> }; quantity: number }>,
  partySize: number,
): ResolvedTarget | null {
  let bodies = 0, acWeighted = 0;
  const totals = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  for (const { template, quantity } of entries) {
    const n = Math.max(1, Number(quantity) || 1);
    const ac = Number(template.stats?.ac);
    if (!Number.isFinite(ac) || ac <= 0) continue;
    bodies += n;
    acWeighted += ac * n;
    const scores = scoresFromTemplate([...(template.abilities ?? [])] as never);
    for (const k of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[k] += abilityModifier(Number(scores[k.toUpperCase() as never] ?? 10)) * n;
    }
  }
  if (bodies === 0) return null;
  const saves = Object.fromEntries(
    (Object.keys(totals) as Array<keyof typeof totals>).map(k => [k, totals[k] / bodies]),
  ) as ResolvedTarget["saves"];
  return {
    ac: acWeighted / bodies,
    saveBonus: (saves.str + saves.dex + saves.con + saves.int + saves.wis + saves.cha) / 6,
    partySize,
    saves,
  };
}

export type ScheduledUse = {
  actor: string;
  action: string;
  trigger: ResourceSpendingAction["trigger"];
  /** Expected damage this ONE use adds, after the marginal/full rule and its chance case. */
  valuePerUse: number;
  /** Uses this character can bring to ONE fight — the day's allocation spread over the day. */
  usesPerFight: number;
  round: number;
};

export type CurrentPartyMetrics = {
  round1Dpr: number;
  round2Dpr: number;
  round3Dpr: number;
  round4PlusDpr: number;
  fiveRoundSustain: number;
  /**
   * HOW THE PARTY DELIVERS ITS DAMAGE — attack rolls against saves — read off the uses this resolver
   * actually scheduled. The chosen-party twin of `centerLineAttackShare` / `centerLineSaveDcs`.
   *
   * Christopher, 2026-09-15, of *"A zone's +N to its allies' saves is unpriced against a chosen party"*:
   * *"none of this should still be open."* It was unpriced because a chosen party supplied no save DCs,
   * and MASTER said *"the sheets supply no save DCs"*. They do — every save action resolves one through
   * `8+@SPELL` / `8+@ATK`, and this loop was already resolving it to price the save. It just never kept it.
   */
  delivery: {
    /** Attack-roll share of the party's damage per fight, 0–1. Undefined when nothing damaging was read. */
    attackShare?: number;
    /** One save DC per character that deals save damage — the highest they use. Absent characters have none. */
    saveDcs: number[];
    /** Of the save damage, the share that still deals half on a success — so a +N save bonus is not all-or-nothing. */
    saveHalfShare: number;
    /**
     * ONE MELEE ATTACK as a share of one character's round — the chosen-party twin of
     * `centerLineMeleeAttackShare`, and what a target-substitution Reaction (Cold Counsel) moves.
     * Each character contributes its at-will attack damage delivered inside 5 ft divided by the number of
     * such swings it makes in a round; a character who never swings in reach contributes 0.
     */
    meleeAttackShare?: number;
  };
  /** Per-actor at-will contribution, before any resource is spent. */
  atWill: { round1: number; round2: number; round3: number; round4Plus: number };
  schedule: ScheduledUse[];
  /** ⚠ AUDIT ONLY — row 45. Never the round profile. */
  audit: { damagePerDay: number; flatUpliftPerRound: number };
  /**
   * The contract's NEEDS DM INPUT: something DAMAGING that could not be read at all — a formula
   * with an unresolved token, an action with neither a roll nor a save.
   *
   * ⚠ IT IS NOT "THINGS THE SHEET COULD SAY BETTER". Christopher, 2026-09-07: *"why do we still
   * have unread actions if nothing except the homebrew bonds and convergence are outside of the
   * SRD"* — because this list had a pool-linkage advisory folded into it and the panel counted
   * the total as "unread". A pool nothing spends is a WIRING note about the sheet, not a damaging
   * action the app failed to read, and conflating them made the app look like it could not read
   * SRD content it reads perfectly well.
   */
  needsInput: string[];
  /**
   * Sheet-wiring advice: nothing is unreadable, but something on the sheet is not connected and
   * is therefore contributing zero. Separate from `needsInput` because the answer is different —
   * one asks for a number the app cannot derive, the other says "link these two rows".
   */
  unlinked: string[];
  /**
   * The contract's ESTIMATED: counted, but on a stated assumption. Kept apart from `needsInput`
   * because they ask the DM for different things — one for a number, one for a ruling.
   */
  estimated: string[];
};

const clamp0 = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

function resolved(text: string | undefined, actor: Actor): string | undefined {
  if (!text) return undefined;
  try {
    const out = resolveFormulaVars(text, actor as never);
    return /@[A-Za-z]/.test(out) ? undefined : out;
  } catch { return undefined; }
}

/** Signed terms of a resolved formula, dice stripped. Undefined when nothing is readable. */
function flatBonus(text: string | undefined): number | undefined {
  if (!text || /@[A-Za-z]/.test(text)) return undefined;
  const withoutDice = text.replace(/\d*\s*d\s*\d+/gi, " ");
  let total = 0, found = false;
  for (const m of withoutDice.matchAll(/([+-])\s*(\d+)/g)) {
    total += (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10);
    found = true;
  }
  return found ? total : undefined;
}

/** The chance a target with this save bonus BEATS the DC — the workbook's published clamp. */
function saveChance(saveBonus: number, dc: number): number {
  return Math.min(0.95, Math.max(0.05, (21 + saveBonus - dc) / 20));
}

export function currentPartyMetrics(
  actors: readonly Actor[],
  target: ResolvedTarget,
  opts: {
    leanFor?: (actor: Actor) => ResourceLean | undefined;
    rounds?: number;
    /**
     * How much of the party's day is already gone when this fight starts, 0..1.
     *
     * ⚠ IT DEPLETES THE RESOURCE HALF AND LEAVES THE AT-WILL HALF ALONE, which is the whole
     * advantage of having read the party instead of a curve. `partyResourceCurve` has to apply a
     * published median (`dprDepletionScale`, 0.5406 at fully expended) to a party it cannot see
     * inside, so it taxes weapons and slots together. This one knows which is which: a Barbarian
     * out of rages still swings the axe, and a Wizard out of slots still throws the cantrip.
     * Christopher: *"shouldnt the 25%, 40%, and 60% spent move the damage they do instead of
     * still showing their damage at full."* It should, and this is where it now does.
     */
    arrivingSpent?: number;
  } = {},
): CurrentPartyMetrics | null {
  if (actors.length === 0) return null;
  const roundsPerFight = opts.rounds ?? RESOURCE_DAY.roundsPerFight;
  /** Share of the day already gone. Clamped, because a caller can hand this anything. */
  const spent = Math.min(1, Math.max(0, Number(opts.arrivingSpent ?? 0) || 0));
  const needsInput: string[] = [];
  const unlinked: string[] = [];
  const estimated: string[] = [];
  const schedule: ScheduledUse[] = [];
  const atWill = { round1: 0, round2: 0, round3: 0, round4Plus: 0 };
  const perRound = new Array(roundsPerFight).fill(0) as number[];
  let sustain = 0;
  let damagePerDay = 0;
  let attackDamage = 0;
  let saveDamage = 0;
  let saveHalfDamage = 0;
  const saveDcs: number[] = [];
  /** Per character: one melee swing as a share of that character's own round — see delivery.meleeAttackShare. */
  const meleeAttackShares: number[] = [];

  for (const actor of actors) {
    const { creature, spends, unreadable, assumptions } = actorAsCreature(actor);
    for (const u of unreadable) needsInput.push(`${actor.name} — ${u}`);
    for (const a of assumptions) estimated.push(`${actor.name} — ${a}`);

    // ── The at-will floor, scheduled by the checker's own tracer ──────────────
    let atWillRound: number[] = [];
    let actorDc = 0;
    let actorMeleeDamage = 0;
    let actorMeleeSwings = 0;
    try {
      const parsedAtWill = parseCreature(creature);
      const trace = traceCreature(parsedAtWill, target as never, roundsPerFight);
      atWillRound = trace.rounds.map(r => clamp0(r.totalExpectedDamage ?? 0));
      // How the at-will routine delivers: each scheduled feature is an attack roll or a save.
      for (const rd of trace.rounds) {
        for (const s of rd.scheduled) {
          const f = parsedAtWill.features.find(x => x.name === s.feature);
          const dealt = clamp0(s.expectedDamage);
          if (!f || !(dealt > 0)) continue;
          if (f.attackBonus !== undefined) {
            attackDamage += dealt;
            /**
             * ⚠ INSIDE 5 FT, AND COUNTED PER SWING. A target-substitution Reaction (Cold Counsel) moves a
             * targeted ally out of reach and re-checks ONE attack, so what it can touch is a single melee
             * swing — not a turn, and nothing a ranged attack or a save does. `reachOfFeature` is the same
             * reading the prone pricer uses: a printed reach of 5 ft or less is melee.
             */
            if (rd.round === 1 && reachOfFeature(f) <= 5) { actorMeleeDamage += dealt; actorMeleeSwings += 1; }
          }
          else if (f.saveDc !== undefined) {
            saveDamage += dealt;
            if (/^s*halfs*$/i.test(String(f.successDamage ?? ""))) saveHalfDamage += dealt;
            actorDc = Math.max(actorDc, f.saveDc);
          }
        }
      }
    } catch {
      needsInput.push(`${actor.name} — at-will actions could not be scheduled`);
    }
    const atWillFor = (i: number) => atWillRound[Math.min(i, atWillRound.length - 1)] ?? 0;
    /**
     * The best single swing this character has — what "the weapon's damage" means for an ongoing
     * effect that deals it. The same ordering the scheduler uses to fill a routine.
     */
    const bestAtWill = ((creature.actions ?? []) as Array<{ roll?: string; damage?: string }>)
      .filter(a => Boolean(a.roll))
      .reduce<{ roll?: string; damage?: string } | undefined>(
        (best, a) => (damageExpressionAverage(a.damage) > damageExpressionAverage(best?.damage) ? a : best),
        undefined);
    const bestAtWillDamage = damageExpressionAverage(bestAtWill?.damage);
    /** The bonus on that same swing — what a reroll is rerolling. */
    const bestAtWillBonus = flatBonus(bestAtWill?.roll);
    // A character with no melee swing contributes 0 — it is part of the party's mix, not absent from it.
    meleeAttackShares.push(actorMeleeSwings > 0 && atWillFor(0) > 0
      ? (actorMeleeDamage / actorMeleeSwings) / atWillFor(0)
      : 0);
    atWill.round1 += atWillFor(0);
    atWill.round2 += atWillFor(1);
    atWill.round3 += atWillFor(2);
    atWill.round4Plus += atWillFor(3);

    // ── What each resource use is worth ───────────────────────────────────────
    const ledger = resourceLedgerFromActor(actor, {
      ...(opts.leanFor?.(actor) ? { lean: opts.leanFor(actor)! } : {}),
    });
    for (const n of ledger.needsInput) needsInput.push(n);

    /**
     * ⚠ A POOL NOTHING SPENDS IS THE COMMONEST REASON A PARTY READS FLAT, AND IT WAS ONLY A NOTE
     * ON A ROW NOBODY OPENS.
     *
     * Every one of the six live sheets carries pools — Rage, Lay on Hands, Baleful Interdict
     * Seals — with no action linked to them, so the ledger correctly allocated all of them to
     * `other` and the round profile came out as the at-will floor repeated four times. That is an
     * honest reading of those sheets and a completely misleading thing to show without saying
     * why, so it is said: once per character, naming the pools, with the fix.
     */
    const unspent = ledger.rows.filter(r =>
      r.offense === 0 && r.sustain === 0 && r.other === r.totalUses
      && r.notes.some(n => /no action on this sheet spends it/.test(n)));
    if (unspent.length > 0) {
      unlinked.push(`${actor.name} — ${unspent.length} pool${unspent.length === 1 ? "" : "s"} nothing on the sheet spends, so ${unspent.length === 1 ? "it is" : "they are"} counted as available and scheduled as nothing: ${unspent.map(r => `${r.resource} (${r.totalUses})`).join(", ")}. Give the action that uses one a resourceId pointing at its Resources row.`);
    }

    /**
     * The ledger row that sizes this spend, or undefined when NOTHING sizes it.
     *
     * ⚠ "NO ROW" AND "A ROW THAT ALLOCATED NOTHING TO OFFENCE" ARE DIFFERENT ANSWERS, and
     * collapsing them is how the Wendigo Ember Heart vanished: it was correctly excluded from the
     * at-will base, found no row, returned zero uses, and was skipped in silence. A tier the lean
     * pointed entirely at healing also returns zero — and that one is CORRECT and must stay quiet.
     */
    /**
     * ⚠ ASK THE ADAPTER, DO NOT RE-ASK THE RESOLVER FROM A STUB. This rebuilt a fake action out of
     * `{ label, resourceId }` and ran `resolveNamedResourceCost` on it a second time — with the
     * `slotCost` and the cost prose stripped off, so the answer could differ from the one the
     * adapter got with the whole action in hand. `actorAsCreature` already resolved it and put the
     * answer on `poolLabel`; using that is the same match rather than a second opinion.
     */
    /**
     * ⚠ AND THE LAST HOP IS A NAME, SO IT GETS THE SAME NORMALISATION THE FIRST ONE DID.
     *
     * Christopher, 2026-09-23: *"every one of the 6 should be tied to a pool, all the items have a
     * charge count, and class actions as well as spells already have the pools they would pull
     * from."* `resolveNamedResourceCost` now lands a named cost on a real Resources row, which
     * fixes the card and most of this. What was left is the ledger's own labelling: an item pool is
     * named after its ACTION and a class pool after its row, so a spend whose label differs by a
     * plural, a bracket or a "Pool" suffix still missed — and a missed row is not "unreadable", it
     * is a link the sheet has and the reader threw away.
     */
    const loose = (value: string) => value
      .toLowerCase()
      .replace(/\bdice\b/g, "die")
      .replace(/\b(\w{3,}?)s\b/g, "$1")
      .replace(/[()]/g, " ")
      .replace(/\b(?:pool|points?|uses?|charges?)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const rowFor = (spend: ResourceSpendingAction) => ledger.rows.find(r =>
      (spend.chargeKey !== undefined && r.chargeKey === spend.chargeKey)
      || (spend.spellLevel !== undefined && r.tier === spend.spellLevel)
      || (spend.poolLabel !== undefined
        && r.resource.trim().toLowerCase() === spend.poolLabel.trim().toLowerCase()))
      /** Only once the exact pass has found nothing, so an exact name always wins over a near one. */
      ?? ledger.rows.find(r => {
        if (spend.poolLabel === undefined) return false;
        const want = loose(spend.poolLabel);
        const have = loose(r.resource);
        return want.length > 2 && have.length > 2 && (want === have || have.includes(want) || want.includes(have));
      });

    const priced: Array<{ spend: ResourceSpendingAction; value: number; uses: number; dc?: number }> = [];
    for (const spend of spends) {
      const row = rowFor(spend);
      if (!row) {
        /**
         * ⚠ THIS IS WIRING, NOT AN UNREADABLE ACTION. The app read Hunter's Mark perfectly well —
         * its dice, its type, its cadence. What it could not do is find the pool that limits it,
         * which is a link missing between two rows on the same sheet. Filing it under "unread"
         * said the app could not read SRD content, which was never true and sent the DM looking
         * in the wrong place.
         */
        unlinked.push(spend.unsizedCost
          ? `${actor.name} — ${spend.label}: prints the cost "${spend.unsizedCost}" and no pool on this sheet matches it, so it is left out of the base AND out of the total. Link it to a Resources row (or give that row the action's resourceId) and it will schedule.`
          : `${actor.name} — ${spend.label}: spends a resource the ledger cannot size, so it is left out of the base and out of the total. Give the pool a size, or say what it spends.`);
        continue;
      }
      /** Uses this resource brings to ONE fight — the day's offence allocation over the day. */
      const uses = row.offense / RESOURCE_DAY.fightsPerLongRest;
      if (!(uses > 0)) continue;
      const average = damageExpressionAverage(resolved(spend.damage, actor));
      if (!(average > 0)) {
        needsInput.push(`${actor.name} — ${spend.label}: no readable damage, so it is worth nothing rather than a guess`);
        continue;
      }

      /**
       * ⚠ WHAT IT DISPLACES IS WHAT IT COSTS — row 43, read in both directions. An Action spell
       * gives up the whole at-will routine for that round; a Bonus Action spell gives up nothing,
       * and charging it the routine anyway would price Spiritual Weapon below zero.
       */
      const displaced = spend.costsTheAction ? atWillFor(0) : 0;

      let value = 0;
      let spendDc: number | undefined;
      if (spend.trigger === "rider") {
        /** ⚠ NOT DISCOUNTED AGAIN — the hit already landed; that is why it was spent. */
        value = average;
      } else if (spend.attack) {
        let bonus = flatBonus(resolved(spend.attack, actor));
        if (bonus === undefined) bonus = flatBonus(resolved("@SPELL", actor));
        if (bonus === undefined) {
          needsInput.push(`${actor.name} — ${spend.label}: attack roll resolves to no readable bonus`);
          continue;
        }
        // Expected, then MINUS the at-will action it displaces.
        value = Math.max(0, attackHitProbability(bonus, target.ac) * average - displaced);
      } else if (spend.saveDc) {
        const dcText = resolved(spend.saveDc, actor) ?? "";
        const dc = Number((dcText.match(/(\d+)\s*$/) ?? dcText.match(/(\d+)/) ?? [])[1]);
        if (!Number.isFinite(dc)) {
          needsInput.push(`${actor.name} — ${spend.label}: save DC resolves to no number`);
          continue;
        }
        spendDc = dc;
        const saved = saveChance(target.saveBonus, dc);
        /**
         * ⚠ WHAT A SUCCESSFUL SAVE STILL TAKES, READ AND NEVER ASSUMED.
         *
         * `metadata.successDamage` is a field the sheets carry and this ignored, so an authored
         * save-for-half spell was priced all-or-nothing and lost the half it explicitly keeps.
         * Half is only half when the action SAYS half — an unset field stays all-or-nothing,
         * because defaulting to half would quietly halve every save that has none.
         */
        const onSuccess = /^\s*half\s*$/i.test(spend.successDamage ?? "")
          ? average / 2
          : damageExpressionAverage(resolved(spend.successDamage, actor));
        value = Math.max(0, average * (1 - saved) + onSuccess * saved - displaced);

        /**
         * ⚠ AN EFFECT THAT KEEPS DEALING DAMAGE WAS WORTH EXACTLY ONE HIT.
         *
         * Christopher, 2026-09-23: *"ensnaring strike isnt a spell action its a bonus action that
         * continues to do the weapon damage if the target fails the STR save."* The read priced the
         * first landing and stopped, so a spell that holds a body for several of its turns was worth
         * its dice once.
         *
         * The turns come from `saveEndsActiveTurns` — the same BR075-077 pricing the monster side has
         * used since 0.8.56.0, so a PC's save-ends effect and a monster's are counted the same way
         * rather than by two rules that can disagree. The FIRST landing is already in `value` above;
         * this adds the turns AFTER it, which is why turn one is dropped from the total.
         *
         * ⚠ AND AN ABSENT `damage` MEANS THE WEAPON'S. That is the shape he described, and the weapon
         * is this character's own best at-will swing — resolved here because this is where it is known.
         */
        if (spend.ongoing?.repeat === "save-ends") {
          const perTurn = spend.ongoing.damage
            ? damageExpressionAverage(resolved(spend.ongoing.damage, actor))
            : bestAtWillDamage;
          const cap = Math.max(1, Math.floor(spend.ongoing.maxTurns ?? roundsPerFight));
          const { expectedTurns } = saveEndsActiveTurns(
            spend.ongoing.timing === "start" ? "start" : "end",
            repeatFailChance(dc, target.saveBonus),
            cap,
          );
          /** Turn one is the landing itself, already priced; only what it holds beyond that is new. */
          const extraTurns = Math.max(0, expectedTurns - 1);
          if (perTurn > 0 && extraTurns > 0) {
            value += perTurn * extraTurns * (1 - saved);
            estimated.push(`${actor.name} — ${spend.label}: holds for ${expectedTurns.toFixed(2)} of the target's turns against a +${target.saveBonus.toFixed(1)} save, so ${extraTurns.toFixed(2)} turns beyond the landing are counted at ${perTurn.toFixed(1)} damage each${spend.ongoing.damage ? "" : " — the weapon's own damage, because the effect deals that"}.`);
          }
        }
      } else {
        needsInput.push(`${actor.name} — ${spend.label}: neither an attack roll nor a save DC, and not a rider`);
        continue;
      }
      if (value > 0) priced.push({ spend, value, uses, ...(spendDc !== undefined ? { dc: spendDc } : {}) });
    }

    /**
     * ⚠ BEST FIRST, ONE PER ROUND. "Use powerful limited abilities early" is the scheduler's own
     * rule and it is why the certified profile declines. A character takes one Action a turn, so a
     * round accepts one resource use however many are available.
     */
    /**
     * ⚠ A REROLL IS A RESOURCE THAT BUYS ACCURACY, AND IT WAS WORTH NOTHING.
     *
     * Christopher, 2026-09-23: *"ok but feat pricing such as lucky is there show how is the item reroll
     * not priced the same"*. It carries no damage of its own, so it never became a spend at all — the
     * Unfinished Thorn's charges, a Stabilized Band, a Luck point: zero, however many the sheet held.
     *
     * ⚠ AND THE SOURCES COME FROM `getRerollSources`, NOT FROM A SECOND SCAN. It is the same reader the
     * card's reroll picker uses, so what the checker prices is exactly what the table can press —
     * including the method, which is the whole of the arithmetic (see `rerollPricing`).
     */
    for (const src of getRerollSources(actor)) {
      /**
       * ⚠ THE DM'S OWN OVERRIDE IS NOT A CHARACTER RESOURCE. `getRerollSources` always offers three
       * "DM Approved" entries so a DM can grant a reroll at the table. They belong to nobody, cost
       * nothing and are sized by nothing — counting them would invent damage, and ADVISING about them
       * would put three permanent "link this" notes on every character in the party, which is the
       * exact noise that made the app look like it could not read sheets it reads perfectly well.
       */
      if (src.kind === "dm") continue;
      const key = src.spendActionId ? itemChargeKey(src.spendActionId) : undefined;
      const row = key !== undefined ? ledger.rows.find(r => r.chargeKey === key) : undefined;
      if (!row) {
        unlinked.push(`${actor.name} — ${src.label}: can reroll a d20, but no pool on this sheet sizes it${src.costLabel ? ` (it prints "${src.costLabel}")` : ""}, so it is left out of the total. Give it a charge count or link it to a Resources row.`);
        continue;
      }
      const uses = row.offense / RESOURCE_DAY.fightsPerLongRest;
      if (!(uses > 0)) continue;
      if (bestAtWillBonus === undefined || !(bestAtWillDamage > 0)) {
        needsInput.push(`${actor.name} — ${src.label}: rerolls a d20, but this character has no readable at-will attack for it to rescue`);
        continue;
      }
      const gain = rerollGain({
        method: src.method,
        attackBonus: bestAtWillBonus,
        targetAc: target.ac,
        perHitDamage: bestAtWillDamage,
        ...(src.bonusDice ? { bonusDice: src.bonusDice } : {}),
      });
      if (!gain) {
        needsInput.push(`${actor.name} — ${src.label}: adds dice to a roll but does not say which, so what it rescues cannot be counted`);
        continue;
      }
      /**
       * ⚠ `rider`, BECAUSE IT IS SPENT AFTER THE ROLL IS SEEN. The gain is already the expected value of
       * a use — discounting it by hit chance again would charge it for the miss it exists to undo.
       */
      priced.push({
        spend: {
          id: src.id, label: src.label, tab: src.kind === "item" ? "equipment" : "feats",
          trigger: "rider", costsTheAction: false,
        },
        value: gain.value,
        uses,
      });
      estimated.push(`${actor.name} — ${src.label}: counted as accuracy, not dice — ${gain.basis}, worth ${gain.value.toFixed(1)} a use against AC ${target.ac.toFixed(0)}. A use spent on a hit to fish for a critical is not counted.`);
    }

    priced.sort((a, b) => b.value - a.value);
    let round = 0;
    for (const entry of priced) {
      /**
       * ⚠ ARRIVING SPENT TAKES USES AWAY, NOT DAMAGE PER USE. A Smite still hits for 2d8 on the
       * last fight of the day; what a depleted party has fewer of is SLOTS. Scaling the value
       * would say the same spell got weaker, which is not what running low means.
       */
      let left = entry.uses * (1 - spent);
      if (!(left > 0)) continue;
      while (left > 0 && round < roundsPerFight) {
        const share = Math.min(1, left);
        perRound[round] += entry.value * share;
        // A rider lands because a hit did; a save spend is a save. The scheduled share is what counts.
        if (entry.dc !== undefined) {
          saveDamage += entry.value * share;
          if (/^s*halfs*$/i.test(entry.spend.successDamage ?? "")) saveHalfDamage += entry.value * share;
          actorDc = Math.max(actorDc, entry.dc);
        } else {
          attackDamage += entry.value * share;
        }
        schedule.push({
          actor: actor.name, action: entry.spend.label, trigger: entry.spend.trigger,
          valuePerUse: entry.value, usesPerFight: share, round: round + 1,
        });
        left -= share;
        round++;
      }
      damagePerDay += entry.value * entry.uses * RESOURCE_DAY.fightsPerLongRest;
    }

    /**
     * ⚠ SUSTAIN IS THIS ACTOR'S OWN, AND HIT DICE ARE NOT IN IT. Per-PC HP, plus what the ledger
     * reserved for sustain — never a shared pool, and never the short rest's dice.
     */
    if (actorDc > 0) saveDcs.push(actorDc);
    sustain += clamp0(Number(actor.stats?.hp?.max ?? 0));
    for (const row of ledger.rows) {
      if (row.sustain <= 0) continue;
      // A sustain use is worth what that pool restores per use; pools sized in HP say so directly.
      const perUse = /\bhp\b|hit points|healing points?/i.test(row.resource) ? 1 : 0;
      if (perUse > 0) sustain += row.sustain;
    }
  }

  const r = (i: number) => atWill[(["round1", "round2", "round3", "round4Plus"] as const)[Math.min(i, 3)]]
    + (perRound[i] ?? 0);

  return {
    round1Dpr: r(0), round2Dpr: r(1), round3Dpr: r(2), round4PlusDpr: r(3),
    fiveRoundSustain: sustain,
    delivery: {
      ...(attackDamage + saveDamage > 0 ? { attackShare: attackDamage / (attackDamage + saveDamage) } : {}),
      saveDcs,
      saveHalfShare: saveDamage > 0 ? saveHalfDamage / saveDamage : 0,
      ...(meleeAttackShares.length > 0
        ? { meleeAttackShare: meleeAttackShares.reduce((sum, x) => sum + x, 0) / meleeAttackShares.length }
        : {}),
    },
    atWill,
    schedule,
    audit: {
      damagePerDay,
      flatUpliftPerRound: damagePerDay / RESOURCE_DAY.combatRoundsPerLongRest,
    },
    needsInput,
    unlinked,
    estimated,
  };
}
