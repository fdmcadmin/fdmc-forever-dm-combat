import { useMemo, useState } from "react";
import type { ActorNote, ActorNoteVisibility } from "../state/useActorNotesState";

type NoteMode = ActorNoteVisibility | null;

function noteModeLabel(mode: ActorNoteVisibility) {
  return mode === "dm" ? "DM Note" : "Player Note";
}

export function ActorNotesPanel({
  actorName,
  notes,
  onAddNote,
  onDeleteNote,
}: {
  actorName: string;
  notes: ActorNote[];
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
