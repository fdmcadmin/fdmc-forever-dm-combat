import { useMemo, useState } from "react";
import type { ActorNote, ActorNoteVisibility } from "../state/useActorNotesState";

type NoteMode = ActorNoteVisibility | null;

function noteModeLabel(mode: ActorNoteVisibility) {
  return mode === "dm" ? "DM Note" : "Player Note";
}

/**
 * A note that lives ON THE CHARACTER — `actor.tabs.notes` — as opposed to the session notes
 * this panel was built for.
 */
export type SheetNote = { id: string; label: string; details?: string };

export function ActorNotesPanel({
  actorName,
  notes,
  sheetNotes = [],
  onAddNote,
  onDeleteNote,
}: {
  actorName: string;
  notes: ActorNote[];
  /**
   * ⚠ TWO THINGS WERE CALLED "NOTES" AND ONLY ONE OF THEM HAD A SCREEN.
   *
   * Christopher, 2026-09-10: *"why are there note being exported with my json when that character
   * has no notes"*, then *"every one of my actors have them and i have not put in any of them and
   * they dont show up in any section or any place to remove them."*
   *
   * `actor.tabs.notes` is a real tab in `TabId`, is written by the character editor's Notes step,
   * and rides in every export because export writes `actor.tabs` whole. The CARD's Notes tab
   * rendered `getActorNotes(actor)` instead — the session note store, a different list with a
   * different shape — so anything filed on the sheet had no reader on the play surface at all.
   * Reference rows imported with the original sheets (an AC breakdown, a proficiency list) have
   * been riding along invisibly ever since, surfacing only in the JSON where they read as fact.
   *
   * They are shown here READ-ONLY: the card has no path that writes `actor.tabs`, and inventing
   * one to delete a note would be a second writer for a thing the editor already owns.
   */
  sheetNotes?: readonly SheetNote[];
  onAddNote: (text: string, visibility?: ActorNoteVisibility) => ActorNote | null;
  onDeleteNote: (noteId: string) => void;
}) {
  const [draftText, setDraftText] = useState("");
  const [noteMode, setNoteMode] = useState<NoteMode>(null);
  const [showDmNotes, setShowDmNotes] = useState(false);

  const playerNotes = useMemo(() => notes.filter((note) => (note.visibility ?? "player") === "player"), [notes]);
  const dmNotes = useMemo(() => notes.filter((note) => note.visibility === "dm"), [notes]);

  function openEditor(mode: ActorNoteVisibility) {
    setDraftText("");
    setNoteMode(mode);

    if (mode === "dm") {
      setShowDmNotes(true);
    }
  }

  function closeEditor() {
    setDraftText("");
    setNoteMode(null);
  }

  function handleSaveNote() {
    if (!noteMode) {
      return;
    }

    const savedNote = onAddNote(draftText, noteMode);

    if (!savedNote) {
      return;
    }

    closeEditor();
  }

  return (
    <section className="tab-panel notes-panel" aria-label={`${actorName} notes tab panel`}>
      <div className="notes-header-row">
        <p className="placeholder-note">
          Player notes stay visible on the card. DM notes are hidden unless the DM opens the DM Notes section.
        </p>
        <div className="notes-button-row">
          <button className="secondary-button compact" type="button" onClick={() => openEditor("player")}>
            Add Note
          </button>
          <button className="secondary-button compact dm-note-button" type="button" onClick={() => openEditor("dm")}>
            DM Note
          </button>
        </div>
      </div>

      {noteMode && (
        <div className={`note-editor-card ${noteMode === "dm" ? "dm-note-editor" : ""}`}>
          <div className="note-editor-title-row">
            <strong>{noteModeLabel(noteMode)}</strong>
            <span>{noteMode === "dm" ? "Hidden by default" : "Visible actor note"}</span>
          </div>
          <textarea
            aria-label={`New ${noteModeLabel(noteMode).toLowerCase()} for ${actorName}`}
            className="note-textarea"
            placeholder={
              noteMode === "dm"
                ? "Type a DM-facing note for this actor..."
                : "Type the note to keep on this actor card..."
            }
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
          />
          <div className="note-editor-actions">
            <button className="secondary-button compact" type="button" onClick={handleSaveNote}>
              Save {noteModeLabel(noteMode)}
            </button>
            <button className="secondary-button compact quiet-button" type="button" onClick={closeEditor}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {sheetNotes.length > 0 && (
        <div className="sheet-notes-section">
          <div className="notes-section-heading-row">
            <h3>On the Sheet</h3>
            <span>{sheetNotes.length}</span>
          </div>
          <p className="placeholder-note">
            Saved on {actorName} and carried in every export. Edit or delete them in the character
            editor&rsquo;s Notes step.
          </p>
          <div className="notes-stack">
            {sheetNotes.map((note) => (
              <article className="saved-note-card sheet-note-card" key={note.id}>
                <strong>{note.label}</strong>
                {note.details && <p>{note.details}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="notes-section-heading-row">
        <h3>Player Notes</h3>
        <span>{playerNotes.length}</span>
      </div>

      <div className="notes-stack">
        {playerNotes.map((note) => (
          <article className="saved-note-card" key={note.id}>
            <p>{note.text}</p>
            <button className="note-delete-button" type="button" onClick={() => onDeleteNote(note.id)}>
              Delete
            </button>
          </article>
        ))}
      </div>

      {playerNotes.length === 0 && <p className="empty-log">No player notes for {actorName} yet.</p>}

      <div className="dm-notes-toggle-row">
        <button className="secondary-button compact quiet-button" type="button" onClick={() => setShowDmNotes((current) => !current)}>
          {showDmNotes ? "Hide DM Notes" : `Show DM Notes (${dmNotes.length})`}
        </button>
      </div>

      {showDmNotes && (
        <div className="dm-notes-section">
          <div className="notes-section-heading-row">
            <h3>DM Notes</h3>
            <span>{dmNotes.length}</span>
          </div>

          <div className="notes-stack">
            {dmNotes.map((note) => (
              <article className="saved-note-card dm-note-card" key={note.id}>
                <p>{note.text}</p>
                <button className="note-delete-button" type="button" onClick={() => onDeleteNote(note.id)}>
                  Delete
                </button>
              </article>
            ))}
          </div>

          {dmNotes.length === 0 && <p className="empty-log">No DM notes for {actorName} yet.</p>}
        </div>
      )}
    </section>
  );
}
