/**
 * THE READ-ME GATE — the delta, and who each note is for.
 *
 * Run: npm run check:notes
 *
 * Two rules, both of them Christopher's, and both easy to break by accident:
 *
 *   *"i want only the whats changed to show up on the panel."*
 *   *"ensure that if the pop up for the non GM should only show if it something that effects them."*
 *
 * ⚠ THE EXIT CHECK IS THE LAST THING IN THIS FILE. See MASTER on `check:summons`.
 */

import { RELEASE_HISTORY, unseenNotes, forAudience } from "../src/core/ui/WhatsNewPopup";

let failures = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

console.log(`Read-me — ${RELEASE_HISTORY.length} versions with notes\n`);

/* ── The delta ──────────────────────────────────────────────────────────────────────────── */
console.log("Only what changed");
{
  const newest = RELEASE_HISTORY[0].version;
  ok("a fresh install sees the newest version only",
    unseenNotes(null).length === 1 && unseenNotes(null)[0].version === newest);
  ok("an install already at the newest sees NOTHING — the panel does not open",
    unseenNotes(newest).length === 0);
  ok("an install two versions back sees exactly those two",
    unseenNotes(RELEASE_HISTORY[2].version).length === 2);
  ok("an unknown marker falls back to the newest only, never the whole history",
    unseenNotes("0.0.0-not-a-release").length === 1);

  // ⚠ ORDER IS THE ARRAY'S, NEVER A PARSED NUMBER. The versions in this project have collided.
  ok("no version appears twice",
    new Set(RELEASE_HISTORY.map(v => v.version)).size === RELEASE_HISTORY.length);
  ok("every version carries at least one note",
    RELEASE_HISTORY.every(v => v.notes.length > 0 && v.notes.every(n => n.points.length > 0)),
    "a version with nothing to say should have no entry at all");
}

/* ── Who it is for ──────────────────────────────────────────────────────────────────────── */
console.log("\nA player is only told what reaches a player");
{
  const all = unseenNotes(null);
  ok("a GM sees everything in the delta", forAudience(all, "gm").length === all.length);

  const everyone = forAudience(RELEASE_HISTORY, "everyone");
  ok("a player sees only areas marked for everyone",
    everyone.every(v => v.notes.every(n => n.audience === "everyone")),
    everyone.flatMap(v => v.notes.map(n => n.area)).join(", "));

  /**
   * ⚠ A VERSION WITH NO PLAYER-FACING NOTE DISAPPEARS RATHER THAN SHOWING EMPTY. Filtering the
   * list but still opening the modal would interrupt a player to tell them nothing — worse than
   * not filtering at all.
   */
  ok("versions left with nothing are dropped, not shown empty",
    everyone.every(v => v.notes.length > 0));
  const gmOnly = RELEASE_HISTORY.filter(v => v.notes.every(n => n.audience !== "everyone"));
  ok("and a GM-only version is genuinely absent for a player",
    gmOnly.length > 0 && gmOnly.every(v => !everyone.some(e => e.version === v.version)),
    `${gmOnly.length} GM-only version(s)`);

  // The default is the safe one: an untagged note reaches the DM, never the table.
  const untagged = RELEASE_HISTORY.flatMap(v => v.notes).filter(n => !n.audience);
  ok("an untagged note defaults to GM-only",
    untagged.length > 0 && !forAudience(RELEASE_HISTORY, "everyone")
      .flatMap(v => v.notes).some(n => !n.audience),
    `${untagged.length} untagged`);

  ok("something IS marked for everyone — the audience split is real, not vacuous",
    RELEASE_HISTORY.flatMap(v => v.notes).some(n => n.audience === "everyone"));
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
