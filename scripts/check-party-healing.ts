/**
 * WHAT THE PARTY CAN HEAL, READ FROM THE ACTORS — and what is deliberately left out.
 *   npx tsx scripts/check-party-healing.ts
 *
 * The v9 run's methods sheet flags class healing as a BLOCKER: "Class/subclass identities absent
 * from 128 source profiles." Our party is not abstract, so this reads it. Run it against the
 * private seed party as a shape test — it fails if the reader stops finding pools at all, which
 * is how two silently-wrong `tabs` guesses were caught.
 */
import { partyHealingFromActors } from "../src/core/encounter-band/partyHealingFromActors";
import { lightsStone } from "../src/private/lights_stone";
import { king } from "../src/private/king";
import { ash } from "../src/private/ash";
import { lyrielle } from "../src/private/lyrielle";
import { ripsnarl } from "../src/private/ripsnarl";
import { ignatiusVoid } from "../src/private/ignatius_void";

const party = [lightsStone, king, ash, lyrielle, ripsnarl, ignatiusVoid] as never[];
const h = partyHealingFromActors(party);
console.log(`same-encounter healing read from the party: +${h.total} HP`);
for (const s of h.sources) console.log(`   ${s.actor.padEnd(15)} ${s.label.padEnd(21)} +${s.amount}   "${s.evidence}"`);
console.log(`\nexcluded (${h.excluded.length}) — shown, never silently dropped:`);
for (const e of h.excluded) console.log(`   ${e.actor.padEnd(15)} ${e.label.padEnd(21)} ${e.reason.slice(0, 92)}`);

const problems: string[] = [];
if (h.sources.length === 0) problems.push("no healing pools found at all — the actor shape probably changed");
if (!h.sources.some(s => /lay on hands/i.test(s.label))) problems.push("Lay on Hands not found on either paladin");
if (!h.excluded.some(e => /hit dic?e/i.test(e.label))) problems.push("Hit Dice were not excluded — they are short-rest recovery and are already counted");
if (problems.length) { console.error(`\nFAILED:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log(`\nPASS — pools found, Lay on Hands read, Hit Dice excluded.`);
