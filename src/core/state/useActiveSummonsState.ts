/**
 * THE STANDING SUMMONS, SHARED THE WAY EVERY OTHER LIVE THING IS SHARED.
 *
 * Christopher, 2026-09-08: *"this has to be able to track rounds in combat or the covenant creature
 * would just always be on."*
 *
 * ─── ⚠ THIS COPIES `useActionEconomyState`, DELIBERATELY AND ALMOST LINE FOR LINE ────────────
 *
 * "cross-client state copies useActionEconomyState (channel + localStorage + mount re-broadcast);
 * never room metadata, never REMOTE." Room metadata is 16KB for every extension on the table
 * combined, and a summoned body carries a whole stat block — putting one there would spend the
 * table's shared budget on something that dies at the end of the fight. So what travels is the
 * RECORD (an id, an owner, a spec, a round), and every client materializes the body itself from
 * the library it already has.
 *
 * The combat window is a separate popover with its own React tree reading the same origin's
 * storage, which is exactly why the economy dots work there. A summon rides the same road.
 *
 * ─── ⚠ WHY THE LIST IS FLAT AND NOT KEYED BY ACTOR ──────────────────────────────────────────
 *
 * Every other store here is `Record<actorId, …>` because a character has one concentration and one
 * economy. A character can have TWO summons up at once — a Steed and a Cannon — so the collection
 * is the unit and the owner is a field on it. Keying by actor would have made the second casting
 * silently delete the first.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import { safeStorage } from "../utils/safeStorage";
import { resolveActiveSummons, withSummonRecord, type ActiveSummon, type ResolvedSummon } from "./activeSummons";

const SUMMON_STORAGE_KEY = "fdm:active-summons:v1";
const SUMMON_CHANNEL = "forever-dm-combat:active-summons:v1";

type SummonSyncMessage = { type: "replace"; summons: ActiveSummon[] };

function isSummonSyncMessage(data: unknown): data is SummonSyncMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as { type?: unknown; summons?: unknown };
  return message.type === "replace" && Array.isArray(message.summons);
}

/**
 * ⚠ EVERY FIELD IS CHECKED, because this crosses a storage boundary and a broadcast. A record with
 * no owner or no round would resolve to a body that can never expire, and a tracker showing a body
 * nothing can remove is worse than one that never showed it.
 */
function isRecord(value: unknown): value is ActiveSummon {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<ActiveSummon>;
  return typeof r.id === "string"
    && typeof r.ownerId === "string"
    && typeof r.actionId === "string"
    && typeof r.summonedOnRound === "number"
    && Boolean(r.spec) && typeof r.spec === "object";
}

export function readStoredSummons(): ActiveSummon[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = safeStorage().getItem(SUMMON_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function persistSummons(records: ActiveSummon[]) {
  if (typeof window === "undefined") return;
  try {
    safeStorage().setItem(SUMMON_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Keep the in-memory list usable when storage is not.
  }
}

export function useActiveSummonsState(actors: Actor[], round: number, library: readonly MainMonsterTemplate[] = []) {
  const [records, setRecords] = useState<ActiveSummon[]>(() => readStoredSummons());
  const recordsRef = useRef(records);
  recordsRef.current = records;

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SUMMON_STORAGE_KEY) return;
      setRecords(readStoredSummons());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!OBR.isAvailable) return;
    // Late-joining peers get the standing bodies — the same UX-6 re-broadcast the economy does.
    const stored = readStoredSummons();
    if (stored.length > 0) {
      void OBR.broadcast.sendMessage(SUMMON_CHANNEL, { type: "replace", summons: stored }, { destination: "ALL" })
        .catch(() => undefined);
    }
    return OBR.broadcast.onMessage(SUMMON_CHANNEL, (event) => {
      if (!isSummonSyncMessage(event.data)) return;
      const incoming = event.data.summons.filter(isRecord);
      persistSummons(incoming);
      setRecords(incoming);
    });
  }, []);

  const commit = useCallback((next: ActiveSummon[]) => {
    persistSummons(next);
    setRecords(next);
    if (OBR.isAvailable) {
      void OBR.broadcast.sendMessage(SUMMON_CHANNEL, { type: "replace", summons: next }, { destination: "ALL" })
        .catch(() => undefined);
    }
  }, []);

  const summonBody = useCallback((record: ActiveSummon) => {
    commit(withSummonRecord(recordsRef.current, record));
  }, [commit]);

  const dismissSummon = useCallback((id: string) => {
    commit(recordsRef.current.filter(r => r.id !== id));
  }, [commit]);

  const clearSummons = useCallback(() => {
    commit([]);
  }, [commit]);

  /**
   * The bodies to show THIS round. Recomputed per round, which is what makes a duration end on its
   * own and a rewind un-end it.
   */
  const resolved = useMemo(
    () => resolveActiveSummons(records, actors, round, library),
    [records, actors, round, library],
  );

  return {
    summonRecords: records,
    activeSummons: resolved.summons as ResolvedSummon[],
    summonProblems: resolved.problems,
    summonBody,
    dismissSummon,
    clearSummons,
  };
}
