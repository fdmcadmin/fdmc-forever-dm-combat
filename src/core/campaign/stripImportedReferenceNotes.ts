/**
 * MIGRATION — THE IMPORTED REFERENCE PROSE COMES OFF EVERY ACTOR.
 *
 * Christopher, 2026-09-10: *"why are there note being exported with my json when that character has
 * no notes"* → *"every one of my actors have them and i have not put in any of them and they dont
 * show up in any section or any place to remove them"* → *"none of this information should be
 * there, why is stuff like this hiding in a json for export, this leads to reading these wrong"* →
 * *"now i have to go through every single character and delete 2 to 3 different fields."*
 *
 * ⚠ THE FIRST ANSWER TO THIS WAS TO RENDER THEM, AND THAT WAS THE WRONG CALL. Making hidden data
 * visible is the right move for data that should EXIST. He had already said this should not — so
 * showing it on every card only moved the work onto him, five characters at a time. The fix for
 * "this should not be here" is to take it off, once, for everyone.
 *
 * ── WHAT IT REMOVES, AND THE EVIDENCE FOR EACH ──────────────────────────────────────────────
 *
 *   1. `tabs.notes` rows whose id begins `combat-notes-` or `proficiencies-`.
 *
 *      These are IMPORTER IDS, not hand-typed ones: a stable slug plus the actor's own suffix
 *      (`combat-notes-lst`, `proficiencies-lst`; `-rip` on Ripsnarl, whose Unarmed Strike is
 *      `unarmed-strike-rip`). Nothing in this repository writes either slug — they arrived with
 *      the original sheet import and have ridden in `actor.tabs` ever since. Their content is
 *      reference prose the app now derives or displays elsewhere: an AC breakdown, passives,
 *      darkvision, an armour/weapon/tool/language list.
 *
 *   2. `classFeatureTracker.note` when it is a saves-and-proficiency restatement.
 *
 *      Ripsnarl's read *"Saves: STR +7, DEX +2, CON +5, INT -1, WIS +0, CHA +1. Prof +3.
 *      Initiative +2."* Every one of those is DERIVED, from the ability scores and the SV ticks
 *      two panels up in the same editor. Nothing computes from the string — `classFeatureTracker`
 *      is display-only — so the engine was never wrong. A READER is: it states a stale number as
 *      fact, which is precisely *"this leads to reading these wrong."*
 *
 *      ⚠ MATCHED NARROWLY, ON PURPOSE. `label` and `value` are left alone — "Rage / Saves" and
 *      "Rage +2 dmg · 3/LR" are authored, and the note field itself stays for anything he wants
 *      in it. Only a note that OPENS with the derived saves line goes, because that is the shape
 *      the import wrote. This is the one place this sweep reads English, and it reads as little
 *      of it as the job allows.
 *
 * ── WHAT IT DOES NOT TOUCH ──────────────────────────────────────────────────────────────────
 * Any other `tabs.notes` row. A note somebody actually wrote has a different id and stays. The
 * sweep reports everything it LEAVES behind in those tabs, so a third row nobody has named yet
 * shows up by name in the console instead of being guessed at and deleted.
 */

import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";

/** Importer slugs. Anchored at the start, and the trailing `-` is required — an authored id that merely CONTAINS one of these words is not a match. */
const IMPORTED_NOTE_ID = /^(combat-notes|proficiencies)-/;

/** A tracker note that opens with the derived saves line. */
const DERIVED_TRACKER_NOTE = /^\s*saves\s*:/i;

export type ReferenceNoteStrip = {
  /** ids removed from `tabs.notes` */
  removed: string[];
  /** true when a derived tracker note was cleared */
  trackerNoteCleared: boolean;
  /** every row left behind in `tabs.notes` / `tabs.outOfCombat`, for the report */
  remaining: string[];
};

/** Pure — the caller decides what to persist. */
export function stripImportedReferenceNotes(actor: Actor): { actor: Actor; strip: ReferenceNoteStrip } {
  const notes = (actor.tabs?.notes ?? []) as ActorAction[];
  const keep = notes.filter(n => !IMPORTED_NOTE_ID.test(n.id));
  const removed = notes.filter(n => IMPORTED_NOTE_ID.test(n.id)).map(n => n.id);

  const tracker = actor.classFeatureTracker;
  const clearTracker = Boolean(tracker?.note && DERIVED_TRACKER_NOTE.test(tracker.note));

  const remaining = [
    ...keep.map(n => `notes/${n.id}`),
    ...((actor.tabs?.outOfCombat ?? []) as ActorAction[]).map(a => `outOfCombat/${a.id}`),
  ];

  if (removed.length === 0 && !clearTracker) return { actor, strip: { removed, trackerNoteCleared: false, remaining } };

  return {
    actor: {
      ...actor,
      tabs: { ...actor.tabs, notes: keep },
      /**
       * ⚠ THE NOTE IS EMPTIED, THE TRACKER IS NOT DROPPED. `label` and `value` are authored and
       * the Features tab renders them; removing the whole object would take a real feature
       * readout off the card to delete one stale sentence.
       */
      ...(clearTracker && tracker ? { classFeatureTracker: { ...tracker, note: "" } } : {}),
    },
    strip: { removed, trackerNoteCleared: clearTracker, remaining },
  };
}

export type ReferenceNoteReport = {
  actors: number;
  notesRemoved: number;
  trackerNotesCleared: number;
  /** actor name → what is still filed on its hidden-prone tabs */
  remaining: Record<string, string[]>;
};

/**
 * Sweep the whole actor library.
 *
 * ⚠ NO ONE-SHOT KEY. The feats migration was guarded by one and anything that reached the tab
 * afterwards stayed there for good: *"a tab that is not needed has to be empty EVERY time, not
 * once."* Re-importing a sheet would put these straight back, so the sweep runs on every load. It
 * costs nothing when there is nothing to remove — no match, no write.
 */
export function migrateImportedReferenceNotes(
  load: () => Record<string, Actor>,
  save: (actors: Record<string, Actor>) => void,
): ReferenceNoteReport {
  const report: ReferenceNoteReport = { actors: 0, notesRemoved: 0, trackerNotesCleared: 0, remaining: {} };
  const library = load();
  const next: Record<string, Actor> = {};
  let changed = false;

  for (const [id, actor] of Object.entries(library)) {
    const { actor: cleaned, strip } = stripImportedReferenceNotes(actor);
    if (strip.removed.length > 0 || strip.trackerNoteCleared) {
      changed = true;
      report.actors++;
      report.notesRemoved += strip.removed.length;
      if (strip.trackerNoteCleared) report.trackerNotesCleared++;
    }
    if (strip.remaining.length > 0) report.remaining[actor.name || id] = strip.remaining;
    next[id] = cleaned;
  }

  if (changed) save(next);
  return report;
}
