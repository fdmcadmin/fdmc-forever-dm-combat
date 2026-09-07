/**
 * CAN THE HEALING READER STILL FIND A POOL? — a SHAPE test, on its own fixture.
 *   npx tsx scripts/check-party-healing.ts
 *
 * ⚠ THIS MUST NOT IMPORT `src/private/`. The first version did, and it would have failed the
 * moment CI ran it: `src/private/` is gitignored (`.gitignore:8`) and tracked by nothing, so the
 * six characters in it exist on one machine and in no checkout. A check that passes only on the
 * author's disk is not a check.
 *
 * That is also the honest answer to *"if there is no built in party why did you give me the 2
 * paladin, illrigger, ranger, barbarian, and artificer"* — those came off a local gitignored
 * folder, not from the app, which ships no party at all (`brokenChainActors` is empty and `dist`
 * contains none of those names). The distinction matters: any figure derived from those files
 * describes the LEVEL 1 seed sheets on one disk, not a live party at level 8 or 9.
 *
 * So the fixture is built here, with the same `restResource` helper a real actor uses, which is
 * what makes this a test of the SHAPE rather than of anyone's characters. Two wrong guesses about
 * that shape — `tabs` as an array of tabs, then as `{ actions }` — each returned ZERO pools
 * instead of throwing, which is the failure this exists to catch.
 */
import { partyHealingFromActors } from "../src/core/encounter-band/partyHealingFromActors";
import { restResource } from "../src/modules/the-broken-chain/actors/actorHelpers";

/** A player actor carries its resources under `tabs.resources` — the real shape, not a guess. */
const actor = (name: string, resources: ReturnType<typeof restResource>[]) => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "player" as const,
  name,
  tabs: { resources },
});

const party = [
  actor("Test Paladin A", [
    restResource("loh-a", "Lay On Hands Pool", 45, "long", "pool", "45 HP / Long Rest. Spend points to heal (any amount) or purify poison (5 pts).", "Paladin Features"),
    restResource("hd-a", "Hit Dice (d10)", 9, "long", "pool", "9 d10 Hit Dice. Spend on a Short Rest to heal 1d10 + CON; resets on a Long Rest.", "Hit Dice"),
    restResource("slots-a", "Spell Slots L2", 3, "long", "spellSlot", "3 / Long Rest.", "Spell Slots"),
  ]),
  actor("Test Paladin B", [
    restResource("loh-b", "Lay On Hands Pool", 45, "long", "pool", "45 HP / Long Rest. Spend points to heal (any amount).", "Paladin Features"),
  ]),
  actor("Test Paladin C", [
    /**
     * WARNING: THE REAL SHEETS SAY "HEALING POINTS", NOT "HP".
     *
     * Both fixtures above were worded "45 HP / Long Rest" and passed a denomination test that the
     * live party failed. A campaign Paladin authors "25 healing points / Long Rest", so the reader
     * excluded her as counted-in-uses and the whole party healing total came out 0. A fixture that
     * only says the phrasing the code already accepted is a gate that cannot fail.
     */
    restResource("loh-c", "Lay On Hands", 25, "long", "pool", "Pool: 25 · Reset: Long Rest · 25 healing points / Long Rest. Healing spends any amount.", "Paladin Features"),
  ]),
  actor("Test Aasimar", [
    // Heals, but counted in USES — a 1 is not 1 HP, so it must be excluded rather than summed.
    restResource("hh", "Healing Hands", 1, "long", "pool", "1 / Long Rest. Touch a creature to heal it.", "Aasimar"),
  ]),
  actor("Test Dwarf", [
    // A pool that is not healing at all — it must not be picked up by a loose match.
    restResource("stone", "Stonecunning", 2, "long", "pool", "2 / Long Rest. Tremorsense 60 ft for 10 min on or near stone.", "Dwarf"),
  ]),
] as never[];

const h = partyHealingFromActors(party);
console.log(`same-encounter healing read from the fixture: +${h.total} HP`);
for (const s of h.sources) console.log(`   ${s.actor.padEnd(16)} ${s.label.padEnd(21)} +${s.amount}   "${s.evidence}"`);
console.log(`\nexcluded (${h.excluded.length}) — shown, never silently dropped:`);
for (const e of h.excluded) console.log(`   ${e.actor.padEnd(16)} ${e.label.padEnd(21)} ${e.reason.slice(0, 92)}`);

const problems: string[] = [];
const has = (label: RegExp) => h.sources.some(s => label.test(s.label));
const excluded = (label: RegExp) => h.excluded.some(e => label.test(e.label));

if (h.sources.length === 0) problems.push("no healing pools found at all — the actor shape has probably changed");
if (!has(/lay on hands/i)) problems.push("Lay on Hands was not read");
/**
 * WARNING: THE REAL SHEETS SAY "HEALING POINTS". A pool worded that way was excluded as
 * counted-in-uses, so the live party read +0 healing while both fixtures here said "HP".
 */
if (!h.sources.some(s => /healing points/i.test(String(s.evidence ?? ""))))
  problems.push("a pool denominated in HEALING POINTS was not read as hit points");
if (h.total !== 115) problems.push(`expected 115 HP from two 45-point pools and one 25-point pool, got ${h.total}`);
if (!excluded(/hit dice/i)) problems.push("Hit Dice were not excluded — they are short-rest recovery and already counted by SHORT_REST_RECOVERY");
if (!excluded(/healing hands/i)) problems.push("a heal counted in USES was summed as if it were hit points");
if (has(/stonecunning/i)) problems.push("Stonecunning was read as healing — the match is too loose");

if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — pools read, hit dice and use-counted heals excluded, non-healing pools ignored.`);
