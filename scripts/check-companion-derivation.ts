/**
 * A COMPANION IS PROFICIENT AT ITS OWNER'S LEVEL.
 *
 * Run: npm run check:companion
 *
 * Christopher, 2026-09-02: *"the PB it is reading for the attack, the save and checks are all
 * suppose to come from Lyrielle"* — the owner of that specific companion. A Primal Companion uses
 * its ranger's proficiency; deriving it from the beast's own level makes the card disagree with
 * the character it belongs to, on every attack, DC and check at once.
 *
 * ⚠ THE ASSERTION IS THAT IT REACHES A FORMULA. Stamping a field proves nothing — this codebase's
 * recurring fault is a correct value that no consumer reads. So the gate resolves `@PROF`, `@ATK`
 * and a save DC through `resolveFormulaVars`, which is what the card actually calls.
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE.
 */

import { resolveActor } from "../src/core/table-state/actorHydrationBoundary";
import { resolveFormulaVars } from "../src/core/state/resolveFormulaVars";
import { proficiencyBonus } from "../src/core/rules/dnd5e";
import type { Actor } from "../src/core/types/actor";
import type { FdmcRoomLiveState } from "../src/core/table-state/fdmcRoomLiveState";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

const LIVE = { actorLiveState: {} } as unknown as FdmcRoomLiveState;

const base = (over: Partial<Actor>): Actor => ({
  id: "x", kind: "player", name: "X", subtitle: "", level: 1,
  stats: { ac: 12, hp: { current: 10, max: 10 }, speed: "30 ft" },
  pinnedReactions: [], tabs: {},
  abilityScores: { str: { score: 14 }, dex: { score: 14 }, con: { score: 12 },
    int: { score: 10 }, wis: { score: 10 }, cha: { score: 10 } },
  ...over,
} as unknown as Actor);

/** Lyrielle at 6 (PB +3) and Faelar, her companion, sitting at a DIFFERENT level. */
const lyrielle = base({ id: "lyrielle", name: "Lyrielle", level: 6 });
const faelar = base({
  id: "faelar", kind: "companion", name: "Faelar", level: 2,
  moduleData: { act: 3, theme: "bc", statBlockStatus: "confirmed", ownerId: "lyrielle" },
} as never);
const library = { lyrielle, faelar } as Record<string, Actor>;

console.log("Companion proficiency comes from the owner\n");

/* ── The stamp ───────────────────────────────────────────────────────────────────────────── */
console.log("Stamped at the one boundary every surface resolves through");
{
  const resolved = resolveActor("faelar", library, {}, LIVE)!;
  ok("the companion carries the OWNER's proficiency bonus",
    resolved.proficiencyBonus === proficiencyBonus(6), `+${resolved.proficiencyBonus}`);
  ok("...which is NOT her own level's bonus",
    resolved.proficiencyBonus !== proficiencyBonus(2),
    `owner L6 = +${proficiencyBonus(6)}, her L2 would be +${proficiencyBonus(2)}`);

  const owner = resolveActor("lyrielle", library, {}, LIVE)!;
  ok("an ordinary character is left alone — her own level is the right source",
    owner.proficiencyBonus === undefined);
}

/* ── ⚠ IT REACHES THE FORMULA ────────────────────────────────────────────────────────────── */
console.log("\nIt arrives at the numbers on the card");
{
  const resolved = resolveActor("faelar", library, {}, LIVE)!;
  const raw = resolveFormulaVars("1d20+@PROF", faelar);              // unresolved actor
  const via = resolveFormulaVars("1d20+@PROF", resolved);            // through the boundary
  ok("@PROF on the resolved companion is the owner's", via.includes("+3"), via);
  ok("...and it genuinely differs from the unresolved actor", raw !== via, `${raw} → ${via}`);

  // @ATK is mod + proficiency: DEX 14 (+2) + PB 3 = +5, which is Faelar's printed attack bonus.
  const atk = resolveFormulaVars("1d20+@ATK", resolved);
  ok("@ATK folds the owner's proficiency in — the attack roll", atk.includes("+5"), atk);

  // A save DC written the campaign's way.
  const dc = resolveFormulaVars("8+@ATK", resolved);
  ok("a save DC written 8+@ATK follows it too", dc.includes("+5"), dc);
}

/* ── The override layer, not the bundled base ────────────────────────────────────────────── */
console.log("\nThe owner is read through the OVERRIDE layer");
{
  /**
   * ⚠ A DM WHO LEVELS THE OWNER WRITES AN OVERRIDE. Reading `library[ownerId].level` alone would
   * leave the companion proficient at whatever level shipped in the source file — stale from the
   * first level-up onward, and invisible because the number still looks plausible.
   */
  const levelled = resolveActor("faelar", library, { lyrielle: { level: 9 } }, LIVE)!;
  ok("levelling the owner moves the companion's proficiency",
    levelled.proficiencyBonus === proficiencyBonus(9), `+${levelled.proficiencyBonus}`);
  ok("...and it shows up in the attack", resolveFormulaVars("1d20+@ATK", levelled).includes("+6"),
    resolveFormulaVars("1d20+@ATK", levelled));
}

/* ── It fails safe ───────────────────────────────────────────────────────────────────────── */
console.log("\nAn unowned or dangling companion falls back to its own level");
{
  const orphan = base({ id: "orphan", kind: "companion", name: "Orphan", level: 5 } as never);
  const dangling = base({
    id: "dangling", kind: "companion", name: "Dangling", level: 5,
    moduleData: { act: 3, theme: "bc", statBlockStatus: "confirmed", ownerId: "nobody" },
  } as never);
  const lib2 = { ...library, orphan, dangling } as Record<string, Actor>;

  ok("no owner set — no stamp, so its own level decides",
    resolveActor("orphan", lib2, {}, LIVE)!.proficiencyBonus === undefined);
  ok("an owner id pointing at nothing does not stamp a wrong number",
    resolveActor("dangling", lib2, {}, LIVE)!.proficiencyBonus === undefined);
  ok("...and the formula still resolves rather than breaking",
    resolveFormulaVars("1d20+@PROF", resolveActor("orphan", lib2, {}, LIVE)!).includes("+3"),
    resolveFormulaVars("1d20+@PROF", resolveActor("orphan", lib2, {}, LIVE)!));
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
