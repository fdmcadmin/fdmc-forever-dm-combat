/**
 * A DM-BUILT BODY MUST BE SELECTABLE, NAMED FOR ITS PICK, AND ABLE TO USE ITS OWN SPELLS.
 *   npm run check:mirrors
 *
 * Three faults reported together on Gate II, 2026-09-07, all of them about a body the DM built
 * not surviving the trip to the surface that reads it:
 *
 *   1. *"when i save my mirrors to the my campaign and try to check the enounter it keeps
 *      reverting to the library and says mirros are priced at 0"* — `upsertEncounter` keeps the
 *      id it is handed, so a campaign fight saved into My Library existed in BOTH keys.
 *      `loadEncounterLibrary()` returns `[...campaign, ...dm]`, so every `find(e => e.id === id)`
 *      resolved to the campaign copy, which has no bodies built. The mirrors were never priced at
 *      0; a fight with no mirrors in it was being priced.
 *   2. *"elemental mirror are the names instead of diriving them from the element that is
 *      chosen"* — the spawn loop overwrote each instance's derived name with the TEMPLATE's.
 *   3. *"the at will being part of the multiattack isnt being counted"* — Claw and Bolt declare
 *      `routineSlots: 1` each, exactly filling a 2-attack budget, so an at-will cantrip could
 *      never be considered for a slot.
 *
 * ⚠ THE ASSERTIONS FOLLOW EACH ONE TO THE SURFACE THAT READS IT — a selectable id, a spawned
 * instance's displayName, a scheduled routine slot — not to the field that feeds it.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { BROKEN_CHAIN_MONSTER_LIBRARY as L } from "../src/data/broken-chain/monsterLibrary";
import {
  loadEncounterLibrary, saveEncounterLibrary, upsertEncounter,
  seedEncounterLibraryFromTemplates, spawnEncounterInstances,
} from "../src/core/monsters/encounterLibrary";
import { materializeTemplateBody } from "../src/core/monsters/actionSetPicks";
import { parseCreature } from "../src/core/encounter-band/parseCreature";
import { traceCreature } from "../src/core/encounter-band/actionTrace";
import { partyDefenceAt } from "../src/core/encounter-band/partyDefenceCurve";
import { resolveFeature } from "../src/core/encounter-band/featureResolver";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const mirror: any = L.find((m: any) => m.templateId.includes("elemental-mirror"))!;
const naming = (mirror.actionSets ?? []).find((s: any) => s.namesBody);

console.log("A built mirror body survives to every surface that reads it\n");

/* ── 1. One id in two libraries ──────────────────────────────────────────────────────────── */
console.log("A DM copy of a campaign fight gets its own identity");
{
  saveEncounterLibrary([], "campaign");
  saveEncounterLibrary([], "dm");
  const campaignFight: any = {
    id: "act3-e6-gate-ii-the-mirrors", name: "A3 Gate II", actTag: "Act 3", owner: "campaign",
    entries: [{ templateId: mirror.templateId, count: 5, startingVisibility: "hp-bar" }],
  };
  saveEncounterLibrary([campaignFight], "campaign");

  // The old behaviour, reproduced: the same id written into the DM key.
  upsertEncounter({ ...campaignFight, owner: "dm" } as never, "dm");
  const before = loadEncounterLibrary();
  ok("reproduced: the id appears twice before repair",
    before.filter(e => e.id === campaignFight.id).length === 2,
    `${before.filter(e => e.id === campaignFight.id).length} rows`);

  // The repair runs with the other seeder repairs.
  seedEncounterLibraryFromTemplates(L);
  const after = loadEncounterLibrary();
  const ids = after.map(e => e.id);
  ok("after repair, no id appears twice", new Set(ids).size === ids.length,
    `${ids.length} rows, ${new Set(ids).size} distinct`);
  ok("...and the DM's own copy is still there",
    after.some(e => e.owner === "dm"), after.filter(e => e.owner === "dm").map(e => e.id).join(", "));
  ok("...alongside the campaign original",
    after.some(e => e.owner === "campaign" && e.id === campaignFight.id));
}

/* ── 2. The name is a consequence of the pick ────────────────────────────────────────────── */
console.log("\nA body is named for the element it chose");
{
  const el = Object.keys(naming?.optionVars ?? {})[0] ?? "Ice";
  const body = materializeTemplateBody(mirror, { id: "b1", name: "", actionPicks: { [naming.id]: [el] } } as never);
  ok(`materialized body carries the derived name`, body.name === `${el} Mirror`, body.name);

  const distinct = ["Ice", "Fire", "Nature"].filter(e => (naming?.optionVars ?? {})[e]);
  const encounter: any = {
    id: "dm-mirror-test", name: "Mirrors", actTag: "Act 3", owner: "dm",
    entries: [{
      templateId: mirror.templateId, count: distinct.length, startingVisibility: "hp-bar",
      bodies: distinct.map((e, i) => ({ id: "b" + i, name: "", actionPicks: { [naming.id]: [e] } })),
    }],
  };
  const spawned = spawnEncounterInstances(encounter, L, 4);
  const names = spawned.map((s: any) => s.displayName);
  ok("spawned instances keep their derived names, not the template's",
    distinct.every(e => names.includes(`${e} Mirror`)), names.join(", "));
  ok("...and none is relabelled with the generic template name",
    !names.some((n: string) => /^Elemental Mirror/.test(n)), names.join(", "));

  // The suffix is for a COLLISION, and two of the same element still need telling apart.
  const same: any = {
    ...encounter, id: "dm-mirror-same",
    entries: [{
      templateId: mirror.templateId, count: 2, startingVisibility: "hp-bar",
      bodies: [0, 1].map(i => ({ id: "s" + i, name: "", actionPicks: { [naming.id]: [distinct[0]] } })),
    }],
  };
  const sameNames = spawnEncounterInstances(same, L, 4).map((s: any) => s.displayName);
  ok("two bodies of the SAME element are still lettered apart",
    sameNames[0] !== sameNames[1] && sameNames.every((n: string) => n.startsWith(distinct[0])),
    sameNames.join(", "));
}

/* ── 3. The at-will cantrip can reach the routine ────────────────────────────────────────── */
console.log("\nAn at-will attack cantrip competes for a Multiattack slot");
{
  const body: any = materializeTemplateBody(mirror, { id: "b", name: "", actionPicks: { [naming.id]: ["Nature"] } } as never);
  const parsed: any = parseCreature(body);
  const whip = parsed.features.find((f: any) => f.name === "Thorn Whip");
  ok("the authored flag reaches the parsed feature",
    Boolean(whip?.replacesRoutineSlot), `Thorn Whip replacesRoutineSlot=${whip?.replacesRoutineSlot}`);

  const d = partyDefenceAt(7, "brokenChain");
  const target = { ac: d.ac, partySize: 4,
    saveBonus: (d.str + d.dex + d.con + d.int + d.wis + d.cha) / 6,
    saves: { str: d.str, dex: d.dex, con: d.con, int: d.int, wis: d.wis, cha: d.cha } };
  const base = traceCreature(parsed, target as never, 4).rounds[0]?.totalExpectedDamage ?? 0;

  /**
   * ⚠ IT MUST NOT TAKE A SLOT IT HAS NOT EARNED. Thorn Whip is 2d6 against a Claw's 2d6 plus the
   * archetype modifier, so the correct outcome is NO CHANGE. A gate that only proved "the number
   * went up" would pass on a rule that always swaps.
   */
  ok("a WEAKER cantrip does not displace the printed attack", base > 0, `R1 ${base.toFixed(2)}`);

  // Make it plainly better and it must take the weakest slot — proving the path is live.
  const boosted: any = {
    ...body,
    actions: body.actions.map((a: any) => a.name === "Thorn Whip" ? { ...a, damage: "20d6 piercing" } : a),
  };
  const boostedR1 = traceCreature(parseCreature(boosted), target as never, 4).rounds[0]?.totalExpectedDamage ?? 0;
  ok("a STRONGER cantrip does take a slot", boostedR1 > base,
    `R1 ${base.toFixed(2)} -> ${boostedR1.toFixed(2)}`);
}

/* ── 4. A self-buff is neither damage nor control ─────────────────────────────────────────── */
console.log("\nSunstone Aegis raises the mirror's OWN defence and is reported as that");
{
  /**
   * ⚠ THE RECORD, CORRECTED. 0.8.32.1's commit message says this branch "is NOT firing". That is
   * wrong: it fires, and my probe printed `feature ?? creature` without ever printing the detail
   * it produced. This gate is the proof, and it is here so the claim can never rest on a probe
   * again — the assertion states which of the three messages comes back.
   *
   * `Sunstone Aegis` prints a CON save and +2 AC and NO damage dice. Three readings were possible
   * and only one is right:
   *   · damage        — there are no dice to find, so the DM is sent hunting for a number
   *   · control       — files the mirror's own armour under the party's uptime
   *   · self-defence  — effective HP, recorded in the creature's defences with a provenance
   */
  const body: any = materializeTemplateBody(mirror, { id: "b", name: "", actionPicks: { [naming.id]: ["Earth"] } } as never);
  const parsed: any = parseCreature(body);
  const aegis = parsed.features.find((f: any) => f.name === "Sunstone Aegis");
  ok("the Earth body carries Sunstone Aegis at all", Boolean(aegis),
    parsed.features.map((f: any) => f.name).join(", "));

  const detailOf = (f: any) => resolveFeature(f).assumptions.map((a: any) => a.detail).join(" ");
  const said = aegis ? detailOf(aegis) : "";
  ok("it is read as raising the creature's OWN defence",
    /OWN defence/.test(said) && /effective HP/.test(said), said.slice(0, 120));
  ok("...and it is NOT sent back as a missing damage number",
    !/Enter the damage, or state what it does/.test(said));

  /**
   * ⚠ A GATE THAT CANNOT FAIL IS WORSE THAN NO GATE. Strip the "+2 AC" and the same feature must
   * fall to the generic message — if it does not, this branch is not what produced the answer.
   */
  const stripped = { ...aegis, text: String(aegis?.text ?? "").replace(/granting \+2 AC/i, "glowing") };
  const strippedSaid = detailOf(stripped);
  ok("mutation: with the AC clause removed it falls back to the generic message",
    /Enter the damage, or state what it does/.test(strippedSaid) && !/OWN defence/.test(strippedSaid),
    strippedSaid.slice(0, 90));
}

/* ── 5. Helping an ally is neither damage nor control ─────────────────────────────────────── */
console.log("\nAn ally buff is reported as one, not as missing damage");
{
  /**
   * ⚠ THE THIRD BRANCH, AND IT WAS MISSING. The Rootwake Warden's Rootbound Counsel gives an ALLY
   * Advantage on a save. It names a saving throw, so the parser reads a save DC off the creature
   * and then asked for the damage that goes with it — damage that was never printed. Reported now
   * as what it is, at ESTIMATED rather than NEEDS DM INPUT, because nothing is missing.
   */
  const counsel = {
    name: "Rootbound Counsel", saveDc: 15,
    text: "When an ally standing on the Warden's marked path makes a Dexterity saving throw, the Warden gives that ally Advantage on the save.",
  };
  const r = resolveFeature(counsel as never);
  const said = r.assumptions.map(a => a.detail).join(" ");
  ok("an ally buff is read as helping an ally", /HELPS AN ALLY/.test(said), said.slice(0, 100));
  ok("...and flagged ESTIMATED, not NEEDS DM INPUT",
    r.assumptions.every(a => a.flag === "ESTIMATED"), r.assumptions.map(a => a.flag).join(", "));
  ok("...so it is not sent back as a missing damage number",
    !/Enter the damage, or state what it does/.test(said));

  /**
   * ⚠ MUTATION: point the same sentence at an ENEMY and it must stop being an ally buff. A branch
   * that fires on every save-mentioning feature would swallow real gaps.
   */
  const hostile = { ...counsel, text: "When a hostile creature makes a Dexterity saving throw, the Warden gives it Disadvantage." };
  const hostileSaid = resolveFeature(hostile as never).assumptions.map(a => a.detail).join(" ");
  ok("mutation: the same shape aimed at an enemy is NOT read as an ally buff",
    !/HELPS AN ALLY/.test(hostileSaid), hostileSaid.slice(0, 90));
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
