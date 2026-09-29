/**
 * THE TACTICAL AI'S TARGET POLICY — the party kills the biggest threat, not the first one written.
 *   npm run check:tactical
 *
 * Source: `Tactical_AI` in `Broken_Chain_Act3_Tactical_AI.xlsx`, built by `apply_tactical_ai.py`, in
 * `Act Run Auditor\Current Model\Tactical AI Runtime`. Its own README: *"This is a deterministic
 * expected-value model. The 70% settings are weighting shares, not measured 70% tactical accuracy."*
 *
 * Until now the roster's authored order WAS the kill priority, full stop — a stunner written last was
 * killed last, however many turns it took off the party.
 *
 * ⚠ THE WEIGHTS ARE THE SHEET'S AND THE GATE SAYS SO. A weight that drifts from the workbook is a
 * silent disagreement with the model this is supposed to reproduce, so each one is asserted against
 * the value printed in its cell.
 */
import { TACTICAL_AI, LOST_TURN_THREAT, bodyThreat, targetScores } from "../src/core/encounter-band/tacticalAi";
import { prepareRoster, type RosterGroup } from "../src/core/encounter-band/checkerV2";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const body = (id: string, dpr: number, hp = 60, extra: Partial<RosterGroup> = {}): RosterGroup => ({
  id, name: id, quantity: 1, baseHp: hp,
  dpr: { round1: dpr, round2: dpr, round3: dpr, round4Plus: dpr },
  ...extra,
} as RosterGroup);

console.log("The party kills the biggest threat, not the first one written\n");

console.log("1. the weights are the workbook's own");
{
  ok("target weight is B4 = 0.70", TACTICAL_AI.targetWeight === 0.70);
  ok("focus-fire weight is B5 = 0.70", TACTICAL_AI.focusFireWeight === 0.70);
  ok("party cluster factor is B6 = 0.50", TACTICAL_AI.partyClusterFactor === 0.50);
  ok("creature cluster factor is B7 = 0.60", TACTICAL_AI.creatureClusterFactor === 0.60);
  ok("surround advantage quality is B8 = 0.70", TACTICAL_AI.surroundAdvantageQuality === 0.70);
  ok("guardian challenge share is B9 = 0.70", TACTICAL_AI.guardianChallengeShare === 0.70);
  ok("bond defence threshold is B10 = 0.60", TACTICAL_AI.bondDefenceThreshold === 0.60);
  ok("heal trigger is B11 = 0.40", TACTICAL_AI.healTrigger === 0.40);
  ok("a lost turn is worth ten damage of threat", LOST_TURN_THREAT === 10);
}

console.log("\n2. threat is damage plus ten a lost turn");
{
  ok("a body with no control is worth its damage",
    bodyThreat({ damagePerRound: 20 }) === 20);
  ok("one that takes a turn a round is worth ten more",
    bodyThreat({ damagePerRound: 20, pcTurnsDeniedPerRound: 1 }) === 30);
  /**
   * ⚠ THE CASE THE WEIGHT EXISTS FOR. A 12-damage stunner outranks a 20-damage bruiser, because
   * what it removes is worth more than what it deals. That is the whole reason the model scores
   * threat rather than reading the roster top to bottom.
   */
  ok("a light-hitting stunner outranks a heavy hitter",
    bodyThreat({ damagePerRound: 12, pcTurnsDeniedPerRound: 1 }) > bodyThreat({ damagePerRound: 20 }),
    `${bodyThreat({ damagePerRound: 12, pcTurnsDeniedPerRound: 1 })} vs ${bodyThreat({ damagePerRound: 20 })}`);
  ok("damage and turns are never negative", bodyThreat({ damagePerRound: -5, pcTurnsDeniedPerRound: -3 }) === 0);
}

console.log("\n3. the score is the workbook's 70/30 blend");
{
  /**
   * ⚠ THE SHAPE, CHECKED AGAINST THE FORMULA ITSELF:
   *     B4 * 4 * threat / MAX(0.001, MAX(threats)) + (1 - B4) * (5 - b) + 0.00001 * (5 - b)
   * with 4 = N and (5 - b) = N + 1 - order. Four equal threats therefore score purely on the
   * authored term, and the top of the list keeps the top of the order.
   */
  const equal = targetScores([1, 2, 3, 4].map(o => ({ threat: 10, authoredOrder: o })));
  ok("equal threats keep the authored order", equal[0] > equal[1] && equal[1] > equal[2] && equal[2] > equal[3],
    equal.map(v => v.toFixed(4)).join(" > "));
  ok("...and the top body scores exactly the formula's value",
    Math.abs(equal[0] - (0.70 * 4 * 1 + 0.30 * 4 + 0.00001 * 4)) < 1e-9, String(equal[0]));

  const skewed = targetScores([{ threat: 5, authoredOrder: 1 }, { threat: 50, authoredOrder: 2 }]);
  ok("a far bigger threat outscores an earlier authored place", skewed[1] > skewed[0],
    skewed.map(v => v.toFixed(3)).join(" vs "));

  /** ⚠ MUTATION: at weight 0 the score IS the authored order, which is the old behaviour exactly. */
  const authoredOnly = targetScores([{ threat: 5, authoredOrder: 1 }, { threat: 50, authoredOrder: 2 }], 0);
  ok("mutation: at weight 0 the authored order wins outright", authoredOnly[0] > authoredOnly[1],
    authoredOnly.map(v => v.toFixed(3)).join(" vs "));
  /** ⚠ MUTATION: at weight 1 the authored order is worth nothing but the tie-break. */
  const threatOnly = targetScores([{ threat: 5, authoredOrder: 1 }, { threat: 50, authoredOrder: 2 }], 1);
  ok("mutation: at weight 1 only threat counts", threatOnly[1] > threatOnly[0] * 5,
    threatOnly.map(v => v.toFixed(3)).join(" vs "));

  ok("an all-zero roster does not divide by zero",
    targetScores([{ threat: 0, authoredOrder: 1 }, { threat: 0, authoredOrder: 2 }]).every(Number.isFinite));
  ok("an empty roster scores nothing", targetScores([]).length === 0);
}

console.log("\n4. the roster is prepared in that order");
{
  const roster = [body("written-first", 10), body("bruiser", 40), body("middling", 22)];
  const prepared = prepareRoster(roster, 4, TACTICAL_AI.targetWeight);
  ok("the hardest hitter is killed first", prepared[0].id === "bruiser",
    prepared.map(g => g.id).join(" -> "));
  ok("...and the kill line is cumulative in that order",
    prepared[0].cumulativeEnd < prepared[1].cumulativeEnd && prepared[1].cumulativeEnd < prepared[2].cumulativeEnd,
    prepared.map(g => `${g.id} ${g.cumulativeEnd.toFixed(0)}`).join(" | "));

  /**
   * ⚠ THE CONTROL CASE, END TO END. A creature that stuns a PC every round is killed before one
   * that hits harder — ten damage a turn is what makes that true, and nothing else in the app
   * would have ranked it there.
   */
  /** Three PCs held for a turn: 12 damage + 3 × 10 = 42 of threat, against the bruiser's 30. */
  const withStunner = [
    body("bruiser", 30),
    body("stunner", 12, 60, { pcTurnDenials: { round1: [{ pcs: 3, turns: [1] }] } } as Partial<RosterGroup>),
  ];
  ok("a stunner that holds most of the party is killed before a harder hitter",
    prepareRoster(withStunner, 4, TACTICAL_AI.targetWeight)[0].id === "stunner",
    prepareRoster(withStunner, 4, TACTICAL_AI.targetWeight).map(g => g.id).join(" -> "));

  /**
   * ⚠ AND A NARROW LEAD DOES NOT FLIP THE ORDER — which is the whole job of the 30%.
   *
   * Hold TWO PCs instead of three and the same creature is worth 32 against the bruiser's 30. It is
   * the bigger threat and it is still killed second, because a 6% edge does not buy back being
   * written second. A weight of 0.70 that overturned every near-tie would not be a weight.
   */
  const narrow = [
    body("bruiser", 30),
    body("stunner", 12, 60, { pcTurnDenials: { round1: [{ pcs: 2, turns: [1] }] } } as Partial<RosterGroup>),
  ];
  ok("...but a 32-against-30 lead does not, because the authored order is worth 30%",
    prepareRoster(narrow, 4, TACTICAL_AI.targetWeight)[0].id === "bruiser",
    prepareRoster(narrow, 4, TACTICAL_AI.targetWeight).map(g => g.id).join(" -> "));

  /** ⚠ MUTATION: at weight 0 the roster comes back exactly as authored — the old kill order. */
  const asAuthored = prepareRoster(roster, 4, 0);
  ok("mutation: at weight 0 the authored order is preserved intact",
    asAuthored.map(g => g.id).join(",") === roster.map(g => g.id).join(","),
    asAuthored.map(g => g.id).join(" -> "));

  /** ⚠ THREAT IS THE SUSTAINED ROUND, so a one-round nova is not ranked as though it repeated. */
  const nova = [
    body("nova", 0, 60, { dpr: { round1: 90, round2: 0, round3: 0, round4Plus: 0 } } as Partial<RosterGroup>),
    body("steady", 25),
  ];
  ok("a nova that fires once is not ranked on its opening round",
    prepareRoster(nova, 4, TACTICAL_AI.targetWeight)[0].id === "steady",
    prepareRoster(nova, 4, TACTICAL_AI.targetWeight).map(g => g.id).join(" -> "));

  /** A group nobody is fighting is not in the order at all. */
  ok("an empty group is dropped, as it always was",
    prepareRoster([body("gone", 30), { ...body("here", 10), quantity: 0 }], 4, TACTICAL_AI.targetWeight).length === 1);
}

console.log(failures === 0
  ? "\nOK — the party's target choice is the workbook's policy"
  : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
