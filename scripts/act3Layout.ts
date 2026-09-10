/**
 * ACT 3 AS IT IS PLAYED — one copy, for every script that walks the act.
 *
 * Christopher, 2026-09-08: *"why would something as a validate need to care about the act when
 * something like this is suppose to be engine based"*.
 *
 * ─── ⚠ WHAT THIS FILE IS, AND WHAT IT DELIBERATELY IS NOT ───────────────────────────────────
 *
 * It is NOT a rest model. The rest model is `actRun.ts`, which is tagged *"LAYER: engine. Acts,
 * rests and level gates are not a 5e idea and not a Broken Chain one"* and already owns every
 * rule: `RestType`, `RestStatus`, `RestDefault`, `nextArrivalSpent()` and the published
 * `SHORT_REST_RECOVERY` of 0.2554. Nothing here decides what a rest DOES.
 *
 * All this carries is the one campaign fact the encounter records do not: WHICH fight, at WHAT
 * level, with WHAT rest opportunity after it. An encounter knows its roster, not when in the act
 * it is met.
 *
 * ⚠ AND IT LIVES IN `scripts/`, NOT IN `src/data/`, ON PURPOSE. `actRun.ts` opens with *"NOTHING
 * HERE IS BUNDLED, AND THAT IS THE POINT"* and quotes v7.4's architecture rule: *"No campaign
 * encounter preset or built-in monster roster may supply those values."* A run the app SHIPS is a
 * preset; a run two validation scripts agree on is a fixture. Shipping this would break the rule
 * it exists to respect.
 *
 * ─── ⚠ WHY IT IS SHARED, WHICH IS THE WHOLE REASON IT EXISTS ────────────────────────────────
 *
 * `act3-run.ts` and `validate-act3-segments.ts` each carried their OWN `SEGMENTS` array, and they
 * disagreed. The report modelled the act correctly — short rests, the long rest at each level
 * gate, and `arrivingSpent` so a depleted party also kills slower. The validator modelled no rests
 * at all and carried raw sustain, so every fight after the first arrived lower than it ever would
 * and Gate II was reported as a round-2 wipe it does not suffer.
 *
 * Both of those were mistakes ALREADY FOUND ONCE, in the report, and written down there:
 *
 *   *"are these using the fresh/25%/40/60 doesn't model that the fight should be fought at with
 *   the short rest being 25-30% recovery."*   — 2026-09-01
 *   *"you are wrong that the % of spent didn't effect dpr."*   — 2026-09-01
 *
 * A second copy is how a correction gets un-made. RULE ZERO, in its usual shape.
 */

export type ActStepRest = "Short" | "Long" | "None";

export type ActStep = {
  /** The authored encounter's id. Never the fight's contents — those are looked up. */
  id: string;
  restAfter: ActStepRest;
  /**
   * Whether the campaign GUARANTEES the window, in the sense of `actRun`'s Rest Semantics: a
   * confirmed rest is `Set`/`Safe`, an unconfirmed one is an `Available` opportunity a run should
   * not silently assume. Recorded so a future run can branch on it rather than re-deciding.
   */
  restConfirmed: boolean;
};

/**
 * The act, segment by segment. A segment ends at a level gate, which is where the long rest falls.
 *
 * ⚠ F4 AND F5 ARE FOUGHT BACK TO BACK. Christopher, 2026-09-01: *"the rest happens between the
 * scar line and the mirrors."* An earlier version rested after every fight, which walked the party
 * into the Mirrors at full — and they do not arrive at full. With the short rest where it belongs,
 * Gate II is entered around a quarter spent, which is the band Christopher states outright:
 * *"gate 2 starts from 25-30% not at fresh."*
 */
export const ACT3_SEGMENTS: Array<{ level: number; steps: ActStep[] }> = [
  { level: 6, steps: [
    { id: "act3-e1-the-first-court", restAfter: "Short", restConfirmed: false },
    { id: "act3-e2-the-cut-below", restAfter: "Short", restConfirmed: false },
    { id: "act3-e3-gate-i-crone-and-mare", restAfter: "Long", restConfirmed: true },
  ] },
  { level: 7, steps: [
    { id: "act3-e4-the-hollow-feast", restAfter: "None", restConfirmed: true },
    { id: "act3-e5-the-scar-line", restAfter: "Short", restConfirmed: true },
    { id: "campaign-mt3nm2j9", restAfter: "Long", restConfirmed: true },
  ] },
  { level: 8, steps: [
    { id: "act3-e7-the-last-court", restAfter: "Short", restConfirmed: false },
    { id: "act3-e8-the-occupied-acre", restAfter: "Short", restConfirmed: false },
    { id: "act3-e9-gate-iii-veil-torn-dragon", restAfter: "Long", restConfirmed: true },
  ] },
  { level: 9, steps: [
    { id: "act3-e10-the-center", restAfter: "Long", restConfirmed: true },
  ] },
];
