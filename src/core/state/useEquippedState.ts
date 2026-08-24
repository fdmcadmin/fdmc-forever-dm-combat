/**
 * WHAT EACH CHARACTER IS WEARING — synced the way readied actions are.
 *
 * Equipping lived only in the actor document, and a document reaches another window only on
 * an explicit push. So the DM's card and the player's card could both be faithfully rendering
 * the last thing they were handed, and disagree for minutes — and the only way to see a change
 * was to close the window and open it again.
 *
 * Readying an action does not have that problem, and this is built the same way it is: a small
 * dedicated map, broadcast whole to ALL on every change, mirrored to localStorage, and
 * re-broadcast on mount so a window that opens late catches up. It deliberately does NOT live
 * in room state — that is a shared document with a size budget, and one entry per item per
 * character is exactly the kind of thing that should not be spent on it.
 *
 * This is an OVERLAY. The actor document keeps `metadata.equipped` as the authored default; an
 * item with no entry here reads exactly as written. So nothing has to be migrated, and a
 * character who has never been touched behaves as before.
 */

import { useCallback, useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { safeStorage } from "../utils/safeStorage";

const EQUIPPED_CHANNEL = "forever-dm-combat:equipped-state:v1";
const EQUIPPED_STORAGE_KEY = "fdmc.equipped.state.v1";

/** actorId → (equipment action id → worn). */
export type EquippedMap = Record<string, Record<string, boolean>>;

function readStored(): EquippedMap {
  try {
    const raw = safeStorage().getItem(EQUIPPED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed as EquippedMap : {};
  } catch {
    return {};
  }
}

function persist(state: EquippedMap): void {
  try { safeStorage().setItem(EQUIPPED_STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

function isSyncMessage(msg: unknown): msg is { type: "replace"; state: EquippedMap } {
  return Boolean(msg && typeof msg === "object"
    && (msg as { type?: unknown }).type === "replace"
    && (msg as { state?: unknown }).state && typeof (msg as { state?: unknown }).state === "object");
}

export function useEquippedState() {
  const [equippedByActorId, setEquippedByActorId] = useState<EquippedMap>(() => readStored());

  // Another tab on this machine (the popout beside the main window) changed it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === EQUIPPED_STORAGE_KEY) setEquippedByActorId(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!OBR.isAvailable) return;

    // Late joiners: say what we have, so a window opening mid-session is not the only one
    // that does not know. Harmless when everyone already agrees.
    const stored = readStored();
    if (Object.keys(stored).length > 0) {
      void OBR.broadcast.sendMessage(EQUIPPED_CHANNEL, { type: "replace", state: stored }, { destination: "ALL" })
        .catch(() => undefined);
    }

    return OBR.broadcast.onMessage(EQUIPPED_CHANNEL, (event) => {
      if (!isSyncMessage(event.data)) return;
      // MERGE per actor rather than replacing the map: a popout knows about one character and
      // must not wipe everyone else's state by broadcasting its narrow view.
      const incoming = event.data.state;
      setEquippedByActorId(current => {
        const next: EquippedMap = { ...current };
        for (const [actorId, items] of Object.entries(incoming)) {
          next[actorId] = { ...(next[actorId] ?? {}), ...items };
        }
        persist(next);
        return next;
      });
    });
  }, []);

  /** Worn state for one item, or undefined when the document's own value should be used. */
  const isEquipped = useCallback(
    (actorId: string, actionId: string): boolean | undefined => equippedByActorId[actorId]?.[actionId],
    [equippedByActorId],
  );

  /**
   * Set one item, and tell everyone.
   *
   * Only the single item that changed is broadcast. That keeps a lost update impossible by
   * construction — two items toggled in the same breath touch different keys, so neither can
   * overwrite the other, which is the trap the document-level write fell into.
   */
  const setEquipped = useCallback((actorId: string, actionId: string, equipped: boolean) => {
    setEquippedByActorId(current => {
      const next: EquippedMap = {
        ...current,
        [actorId]: { ...(current[actorId] ?? {}), [actionId]: equipped },
      };
      persist(next);
      if (OBR.isAvailable) {
        void OBR.broadcast.sendMessage(
          EQUIPPED_CHANNEL,
          { type: "replace", state: { [actorId]: { [actionId]: equipped } } },
          { destination: "ALL" },
        ).catch(() => undefined);
      }
      return next;
    });
  }, []);

  return { equippedByActorId, isEquipped, setEquipped };
}

/**
 * Apply the overlay to a character's equipment tab.
 *
 * Pure, so the card and the stat derivation can share one answer about what is worn.
 */
export function applyEquippedOverlay<T extends { id: string; metadata?: { equipped?: boolean } }>(
  items: T[],
  overlay: Record<string, boolean> | undefined,
): T[] {
  if (!overlay || Object.keys(overlay).length === 0) return items;
  return items.map(item => {
    const worn = overlay[item.id];
    return worn === undefined ? item : { ...item, metadata: { ...item.metadata, equipped: worn } };
  });
}
