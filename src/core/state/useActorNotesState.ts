import { useCallback, useEffect, useMemo, useState } from "react";
import type { Actor } from "../types/actor";
import { safeStorage } from "../utils/safeStorage";

export type ActorNoteVisibility = "player" | "dm";

export type ActorNote = {
  id: string;
  text: string;
  createdAt: number;
  visibility: ActorNoteVisibility;
};

export type ActorNotesMap = Record<string, ActorNote[]>;

const storageKey = "forever-dm-combat.actor-notes.v0.3.0b";
const legacyStorageKeys = ["forever-dm-combat.actor-notes.v0.3.0a"];

function createInitialNotes(actors: Actor[]): ActorNotesMap {
  return actors.reduce<ActorNotesMap>((notes, actor) => {
    notes[actor.id] = [];
    return notes;
  }, {});
}

function normalizeNotes(notesByActorId: ActorNotesMap): ActorNotesMap {
  return Object.fromEntries(
    Object.entries(notesByActorId).map(([actorId, notes]) => [
      actorId,
      notes.map((note) => ({
        ...note,
        visibility: note.visibility ?? "player",
      })),
    ])
  );
}

function readStoredNotes(): ActorNotesMap | null {
  if (typeof window === "undefined") {
    return null;
  }

  const keysToTry = [storageKey, ...legacyStorageKeys];

  for (const key of keysToTry) {
    try {
      const raw = safeStorage().getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw) as ActorNotesMap;
      return parsed && typeof parsed === "object" ? normalizeNotes(parsed) : null;
    } catch {
      // Try the next storage key.
    }
  }

  return null;
}

function createNoteId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useActorNotesState(actors: Actor[]) {
  const initialNotes = useMemo(() => createInitialNotes(actors), [actors]);
  const [notesByActorId, setNotesByActorId] = useState<ActorNotesMap>(() => ({
    ...initialNotes,
    ...(readStoredNotes() ?? {}),
  }));

  useEffect(() => {
    setNotesByActorId((current) => ({ ...initialNotes, ...current }));
  }, [initialNotes]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    safeStorage().setItem(storageKey, JSON.stringify(notesByActorId));
  }, [notesByActorId]);

  const getActorNotes = useCallback(
    (actor: Actor) => notesByActorId[actor.id] ?? [],
    [notesByActorId]
  );

  const addActorNote = useCallback((actorId: string, text: string, visibility: ActorNoteVisibility = "player") => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return null;
    }

    const note: ActorNote = {
      id: createNoteId(),
      text: trimmedText,
      createdAt: Date.now(),
      visibility,
    };

    setNotesByActorId((current) => ({
      ...current,
      [actorId]: [...(current[actorId] ?? []), note],
    }));

    return note;
  }, []);

  const deleteActorNote = useCallback((actorId: string, noteId: string) => {
    setNotesByActorId((current) => ({
      ...current,
      [actorId]: (current[actorId] ?? []).filter((note) => note.id !== noteId),
    }));
  }, []);

  return {
    notesByActorId,
    getActorNotes,
    addActorNote,
    deleteActorNote,
  };
}
