/**
 * WHAT A SPENT PARTY ACTUALLY HITS FOR.
 *
 * Source: `wotc_party_resource_reference_l7_l9_v2.json` (sha256 31814295…), transcribed from
 * `broken_chain_encounter_checker_app_ready_v2.xlsx` → "Run Models" → A813:AI1196. 128 party
 * rows at each of levels 7, 8 and 9 — the SAME 128-party field the party curve is built from,
 * which is why these two tables compose.
 *
 * ⚠ WHY THIS FILE EXISTS. The checker's "arrives spent" control used to scale `sustain` and
 * nothing else, so a party that walked into a gate 60% down still opened with a full nova.
 *
 * Christopher: *"a nova party would always kill something in the same turn until they rest so
 * this has to be fixed sustain and dpr move with resource drain, a healer who spends half a
 * fight burning through L3 spell slots cant go into the next fight buring the same lvl 3 spell
 * slots."*
 *
 * That was not fixable before, and the reason matters: RULE 1A says the workbook is the law and
 * what it does not publish the app does not invent, and the party curve publishes only the fresh
 * round profile. There was no published depletion relationship to read. This reference IS that
 * relationship — it publishes both ends of the line, `baseFreshDpr` and `baseExpendedDpr`, for
 * every one of the 384 sampled parties.
 *
 * ─── WHAT THE 384 ROWS SAY ────────────────────────────────────────────────────────────────
 *
 *   level    n     median expended/fresh    p10     p90      median shortRestRecovery
 *     7     128         0.545348           0.497   0.584            0.255224
 *     8     128         0.540792           0.494   0.583            0.254592
 *     9     128         0.539914           0.489   0.584            0.256494
 *
 * The ratio is FLAT: it moves 0.0054 across the whole published window, drifting -0.0027 per
 * level, which is inside the noise of a 128-sample median. That is why one constant is used at
 * every level rather than a per-level table — a table would be reading structure into a line
 * that does not have any.
 *
 * ⚠ MEDIAN, NOT WEIGHTED MEDIAN. The party curve uses "weighted median using the workbook sample
 * weights". This reference does not carry the weights, so the plain median is what the data
 * supports. The mean sits at 0.538629, 0.002 away, so the choice does not move anything.
 */

/** Median of `baseExpendedDpr / baseFreshDpr` across all 384 published parties. */
export const EXPENDED_DPR_RATIO = 0.540602;

/**
 * Median `shortRestRecovery` across all 384 published parties — the share of the party's TOTAL
 * resource pool a short rest hands back, which is how `nextArrivalSpent` already consumes it.
 *
 * ⚠ THIS WAS DEFAULTING TO ZERO. `ActRun` has carried a `shortRestRecovery` parameter since the
 * act-run panel was built, and with nothing published to put in it the default was 0 — a short
 * rest recovered literally nothing and only a long rest moved the clock. The spread is wide
 * (p10 0.07, p90 0.40) because it tracks how much of a party's kit is short-rest-refreshed:
 * warlocks and battlemasters sit at the top, a full-caster party at the bottom.
 */
export const SHORT_REST_RECOVERY = 0.255401;

/** Levels the reference actually publishes. Outside this window the constants are applied anyway. */
export const PUBLISHED_LEVELS = { min: 7, max: 9 } as const;

/**
 * The damage multiplier for a party arriving with `spent` of its resources already gone.
 *
 * TWO ANCHORS, SO ONE LINE. The reference publishes fresh (spent = 0) and expended (spent = 1)
 * and nothing between them. A straight line is the only interpolation two points support;
 * anything with a curve to it would be invented shape.
 */
export function dprDepletionScale(spent: number): number {
  const s = Math.min(1, Math.max(0, spent));
  return 1 - s * (1 - EXPENDED_DPR_RATIO);
}

/**
 * ⚠ THE GIFT CHASSIS DOES NOT RUN OUT, SO IT DOES NOT DEPLETE.
 *
 * The published ratio is measured on WotC-standard parties, whose damage is overwhelmingly slots
 * and per-rest features. A Broken Chain party's extra output is the generalized gift chassis, and
 * the curve says exactly what that is: *"First-tab numbers add only UNCONDITIONAL explicit
 * damage/prevention."* A +2 weapon still swings on the party's last legal turn of the day.
 *
 * So depletion is applied to the WotC base and the campaign delta rides through untouched. The
 * expendable half of the campaign kit — Convergence, which is `uses_per_long_rest` — is added
 * separately in `resolvePartyProfile` and is deliberately not covered here.
 *
 * What that works out to, per round-1 damage:
 *
 *   level   wotc base   campaign   gift delta   fully expended   effective campaign ratio
 *     7       86.24      96.19        9.95          56.57                0.5881
 *     8       92.09     112.49       20.40          70.18                0.6239
 *     9      107.34     138.80       31.45          89.48                0.6447
 *
 * A campaign party at 9 keeps 64% of its damage when it is completely out, against 54% for a
 * standard one. Collapsing that to a single ratio would have over-taxed the campaign party by
 * about 10 points of round-1 damage at the exact levels the Act 3 gates are fought at.
 *
 * @param baseValue  the wotcStandard figure for this round, already party-size scaled
 * @param modeValue  the selected mode's figure for this round, already party-size scaled
 */
export function depleteRoundValue(baseValue: number, modeValue: number, spent: number): number {
  const giftDelta = modeValue - baseValue;
  return baseValue * dprDepletionScale(spent) + giftDelta;
}
