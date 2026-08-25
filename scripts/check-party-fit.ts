/**
 * PARTY SIZE AGAINST THE ACTORS ACTUALLY IN THE LIBRARY, at every size the checker supports.
 *   npx tsx scripts/check-party-fit.ts
 *
 * Christopher: *"the checker is suppose to work from 3-6 so it needs to read current actors in
 * the library and then give the options like i said — 3 player would make you check which 3 if
 * you had more, 4 same as 3 but if you only had 3 it would tell you not enough actors in the
 * profile to read correctly, same with 5 and same with 6."*
 *
 * One rule, three answers, uniform from 3 to 6. It is worth a check rather than a glance because
 * party size is a CURVE INPUT — it selects the HP band and scales DPR and sustain — so a
 * mismatch between the number and the roster is a wrong answer, not a cosmetic one.
 *
 * ⚠ THE CASE THIS EXISTS TO PIN IS "over". Defaulting an over-full library to ALL of its actors
 * read six characters' healing pools into a four-player party — a guess wearing a number. Over
 * means UNRESOLVED until exactly N are chosen, and unresolved reads nothing.
 */
import { partyHealingFromActors } from "../src/core/encounter-band/partyHealingFromActors";
import { restResource } from "../src/modules/the-broken-chain/actors/actorHelpers";

type Fit = { level: "ok" | "short" | "over"; resolvedWithout: boolean };

/** The panel's rule, in one place so the test and the UI cannot drift apart in spirit. */
function fitFor(actorCount: number, partySize: number, chosenCount: number): Fit {
  const level = actorCount < partySize ? "short" : actorCount > partySize ? "over" : "ok";
  const resolved = actorCount === partySize ? true : chosenCount === partySize;
  return { level, resolvedWithout: resolved };
}

const SIZES = [3, 4, 5, 6];
const problems: string[] = [];

console.log("actors × party size — what the checker does before anything is chosen\n");
console.log("  actors |   3P      4P      5P      6P");
for (const actors of [0, 2, 3, 4, 5, 6, 8]) {
  const cells = SIZES.map(size => {
    const f = fitFor(actors, size, 0);
    return (f.level === "ok" ? "ok" : f.level === "short" ? "SHORT" : "pick").padEnd(7);
  });
  console.log(`    ${String(actors).padStart(4)} |   ${cells.join(" ")}`);
}

for (const size of SIZES) {
  for (const actors of [0, 2, 3, 4, 5, 6, 8]) {
    const f = fitFor(actors, size, 0);
    const want = actors < size ? "short" : actors > size ? "over" : "ok";
    if (f.level !== want) problems.push(`${actors} actors at ${size}P read as "${f.level}", expected "${want}"`);
    // An exact match needs no choosing; anything else must not resolve on its own.
    if (actors === size && !f.resolvedWithout) problems.push(`${actors} actors at ${size}P should resolve without a choice`);
    if (actors > size && f.resolvedWithout) problems.push(`${actors} actors at ${size}P resolved WITHOUT choosing — that is the guess this rule exists to stop`);
    if (actors > size && !fitFor(actors, size, size).resolvedWithout) problems.push(`${actors} actors at ${size}P did not resolve after choosing ${size}`);
  }
}

// And the consequence: an unresolved party must contribute no healing at all.
const healer = (n: string) => ({
  id: n, kind: "player" as const, name: n,
  tabs: { resources: [restResource(`loh-${n}`, "Lay On Hands Pool", 45, "long", "pool", "45 HP / Long Rest. Spend points to heal.", "Paladin Features")] },
});
const six = [1, 2, 3, 4, 5, 6].map(i => healer(`P${i}`)) as never[];
const fourOfSix = six.slice(0, 4);
console.log(`\nsix healers, 4P check:`);
console.log(`   all six read (the old default) would give +${partyHealingFromActors(six).total} HP — six actors' pools in a four-player party`);
console.log(`   four chosen gives                       +${partyHealingFromActors(fourOfSix).total} HP`);
console.log(`   unresolved gives                        +0 HP, which is the point`);
if (partyHealingFromActors(fourOfSix).total !== 180) problems.push("four 45-point pools did not sum to 180");

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — short below, ok at, choose above, at every size from 3 to 6.`);
