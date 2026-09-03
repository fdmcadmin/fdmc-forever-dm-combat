/**
 * THE OWNER'S BOND CHOICE HAS TO REACH THE COMPANION THAT PERFORMS IT.
 *
 * Run: npm run check:bondrider
 *
 * Christopher, 2026-09-03: *"lyrielle got to pick the bond, choose the spec, but fealar didnt get
 * the added bonus... the bonded strike on faelar's sheet is missing the rider for meta."* The pack
 * bond is `actor: "companion"` — the ladder is chosen on the character's sheet and executed from
 * the companion's card, and nothing joined the two.
 *
 * ⚠ THE ASSERTIONS ARE THAT IT ARRIVES AT A NUMBER. This codebase's recurring fault is a correct
 * value that nothing reads, so the rider is chased all the way through `resolveFormulaVars` — the
 * function the card itself calls — and not merely observed sitting on the object.
 *
 * ⚠ THE NEGATIVE CASES CAN FAIL. A gate that only proved the happy path would still pass if the
 * rider were applied unconditionally to everything, which is a worse bug than the one it fixes.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { resolveActor } from "../src/core/table-state/actorHydrationBoundary";
import { resolveFormulaVars } from "../src/core/state/resolveFormulaVars";
import { withCompanionBondRider, withGeneratedBondActions } from "../src/core/rules/bondActions";
import { BROKEN_CHAIN_BOND_TEMPLATES } from "../src/modules/the-broken-chain/content/bondTemplates";
import { BROKEN_CHAIN_BOND_GATES } from "../src/modules/the-broken-chain/content/bondGates";
import { proficiencyBonus } from "../src/core/rules/dnd5e";
import type { Actor } from "../src/core/types/actor";
import type { FdmcRoomLiveState } from "../src/core/table-state/fdmcRoomLiveState";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const LIVE = { actorLiveState: {} } as unknown as FdmcRoomLiveState;
const TEMPLATES = BROKEN_CHAIN_BOND_TEMPLATES;
const GATES = BROKEN_CHAIN_BOND_GATES;

const base = (over: Partial<Actor>): Actor => ({
  id: "x", kind: "player", name: "X", subtitle: "", level: 1,
  stats: { ac: 12, hp: { current: 10, max: 10 }, speed: "30 ft" },
  pinnedReactions: [], tabs: {},
  abilityScores: { str: { score: 14 }, dex: { score: 14 }, con: { score: 12 },
    int: { score: 10 }, wis: { score: 18 }, cha: { score: 10 } },
  ...over,
} as unknown as Actor);

/** Lyrielle at 6 — Metamorphosis — having taken path 0, Bonded Strike. WIS 18 against a WIS 8 beast. */
const lyrielle = base({
  id: "lyrielle", name: "Lyrielle", level: 6,
  moduleData: {
    act: 1, theme: "the-broken-chain", statBlockStatus: "confirmed",
    bondAssignment: { templateId: "pack", chosenPathIndex: 0, companionActorId: "faelar" },
  },
} as never);

/** Faelar. Deliberately WEAKER and LOWER level, so an inherited value is visible in the output. */
const faelarSheet = base({
  id: "faelar", kind: "companion", name: "Faelar", level: 2,
  abilityScores: { str: { score: 16 }, dex: { score: 14 }, con: { score: 14 },
    int: { score: 6 }, wis: { score: 8 }, cha: { score: 6 } },
  moduleData: { act: 1, theme: "the-broken-chain", statBlockStatus: "confirmed", ownerId: "lyrielle" },
  tabs: {
    main: [{
      id: "faelar-bonded-strike", label: "Bonded Strike", actionKind: "attack",
      economyCost: [], logMode: "default",
      metadata: { attack: "1d20+@PROF", damage: "1d8+@WIS+@PROF", details: "Companion attack." },
    }],
  },
} as never);

const library = { lyrielle, faelar: faelarSheet } as Record<string, Actor>;
const strike = (a: Actor) => (a.tabs.main ?? []).find(x => x.label === "Bonded Strike");
const dmgOf = (a: Actor) => strike(a)?.metadata?.damage ?? "";

console.log("The owner's bond reaches the companion that performs it\n");

/* ── The stamp ───────────────────────────────────────────────────────────────────────────── */
console.log("What the hydration boundary carries over");
{
  const f = resolveActor("faelar", library, {}, LIVE)!;
  ok("the companion sees its owner's bond assignment",
    f.moduleData?.ownerBond?.assignment.templateId === "pack",
    String(f.moduleData?.ownerBond?.assignment.templateId));
  ok("...at the OWNER's level, not its own",
    f.moduleData?.ownerBond?.ownerLevel === 6,
    `ownerLevel ${f.moduleData?.ownerBond?.ownerLevel}, the beast is L2`);
  ok("WIS is the owner's", f.abilityScores?.wis?.score === 18,
    `WIS ${f.abilityScores?.wis?.score}, the beast's own is 8`);
  ok("PB is the owner's", f.proficiencyBonus === proficiencyBonus(6), `+${f.proficiencyBonus}`);
  ok("every OTHER ability score is still the beast's",
    f.abilityScores?.str?.score === 16 && f.abilityScores?.int?.score === 6,
    `STR ${f.abilityScores?.str?.score}, INT ${f.abilityScores?.int?.score}`);
}

/* ── ⚠ IT REACHES THE FORMULA ────────────────────────────────────────────────────────────── */
console.log("\nThe Metamorphosis rider arrives on the attack that swings it");
{
  const f = withCompanionBondRider(resolveActor("faelar", library, {}, LIVE)!, TEMPLATES, GATES);
  ok("Bonded Strike's damage carries the +1d4", dmgOf(f).includes("1d4"), dmgOf(f));

  const resolved = resolveFormulaVars(dmgOf(f), f);
  ok("...and it survives token resolution", resolved.includes("1d4"), resolved);
  ok("...alongside the OWNER's WIS (+4), never the beast's (-1)",
    resolved.includes("+4") && !resolved.includes("-1"), resolved);
  ok("...and the OWNER's PB (+3), never the beast's (+2)",
    resolved.includes("+3"), resolved);

  const twice = withCompanionBondRider(f, TEMPLATES, GATES);
  ok("applying it again does not stack the rider",
    dmgOf(twice).split("1d4").length - 1 === 1, dmgOf(twice));
}

/* ── The character's own card is not touched ─────────────────────────────────────────────── */
console.log("\nA companion-performed bond leaves the CHARACTER's card alone");
{
  const authored = { ...lyrielle, tabs: { bond: [
    { id: "lyrielle-bond-reference", label: "Pack Instinct (Meta)", actionKind: "bond",
      economyCost: [], logMode: "silent", metadata: { cost: "free" } },
  ] } } as unknown as Actor;
  const after = withGeneratedBondActions(authored, TEMPLATES, GATES, () => "Faelar");
  ok("the hand-authored controller row survives",
    (after.tabs.bond ?? []).some(a => a.id === "lyrielle-bond-reference"));
  ok("...and nothing is generated onto her sheet",
    (after.tabs.bond ?? []).length === 1, `${(after.tabs.bond ?? []).length} rows`);
}

/* ── ⚠ NEGATIVE CONTROLS — what makes this gate able to fail ─────────────────────────────── */
console.log("\nIt does NOT fire where it should not");
{
  const orphan = resolveActor("faelar", { faelar: faelarSheet } as Record<string, Actor>, {}, LIVE)!;
  ok("no owner in the library → no rider",
    !dmgOf(withCompanionBondRider(orphan, TEMPLATES, GATES)).includes("1d4"),
    dmgOf(withCompanionBondRider(orphan, TEMPLATES, GATES)));

  const preMeta = { ...lyrielle, level: 3 } as Actor;   // Realized — no path exists yet
  const f2 = withCompanionBondRider(
    resolveActor("faelar", { lyrielle: preMeta, faelar: faelarSheet } as Record<string, Actor>, {}, LIVE)!,
    TEMPLATES, GATES);
  ok("owner below Metamorphosis → no rider", !dmgOf(f2).includes("1d4"), dmgOf(f2));

  const otherPath = {
    ...lyrielle,
    moduleData: {
      ...lyrielle.moduleData!,
      bondAssignment: { templateId: "pack", chosenPathIndex: 1, companionActorId: "faelar" },
    },
  } as Actor;
  const f3 = withCompanionBondRider(
    resolveActor("faelar", { lyrielle: otherPath, faelar: faelarSheet } as Record<string, Actor>, {}, LIVE)!,
    TEMPLATES, GATES);
  ok("the OTHER path carries no damage rider for Bonded Strike",
    !dmgOf(f3).includes("1d4"), dmgOf(f3));
}

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
