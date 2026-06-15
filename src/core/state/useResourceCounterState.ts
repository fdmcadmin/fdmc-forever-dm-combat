/**
 * useResourceCounterState
 *
 * Tracks current remaining count per named resource per actor.
 * Resources are identified by their action ID from actor.tabs.resources.
 *
 * Structure: { [actorId]: { [resourceActionId]: currentRemaining } }
 *
 * On spell commit → decrement matching resource.
 * On Short/Long Rest → reset based on the resource's reset type.
 * Broadcasts via OBR so all windows stay in sync.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResourceCounterMap = Record<string, Record<string, number>>;
// { actorId: { resourceActionId: currentRemaining } }

/** Result of a slot/resource spend (P11) — drives the combat-log entry. */
export type ConsumeResult = {
  outcome: "spent" | "empty" | "no-resource";
  /** The matched resource's label (absent for "no-resource"). */
  label?: string;
  /** Charges left after the spend (0 for "empty"). */
  remaining?: number;
  /** Max charges for the resource. */
  max?: number;
};

const STORAGE_KEY = "fdmc.resource.counters.v1";
const BROADCAST_CHANNEL = "forever-dm-combat:resource-counters:v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMaxFromAction(action: ActorAction): number {
  const poolStr = action.metadata?.additive ?? "";
  const parsed = Number.parseInt(poolStr, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readStored(): ResourceCounterMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as ResourceCounterMap : {};
  } catch {
    return {};
  }
}

function persist(state: ResourceCounterMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ok
  }
}

// ─── Initialize actor resources from actor.tabs.resources ────────────────────

function seedActorResources(
  actorId: string,
  resourceActions: ActorAction[],
  existing: ResourceCounterMap
): ResourceCounterMap {
  const actorCounters = existing[actorId] ?? {};
  let changed = false;

  for (const action of resourceActions) {
    if (!(action.id in actorCounters)) {
      actorCounters[action.id] = getMaxFromAction(action);
      changed = true;
    }
  }

  if (!changed) return existing;
  return { ...existing, [actorId]: actorCounters };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useResourceCounterState(actors: Actor[]) {
  const [counters, setCounters] = useState<ResourceCounterMap>(() => {
    const stored = readStored();
    let state = stored;
    for (const actor of actors) {
      const resources = actor.tabs.resources ?? [];
      state = seedActorResources(actor.id, resources, state);
    }
    return state;
  });

  const stateRef = useRef(counters);
  useEffect(() => { stateRef.current = counters; }, [counters]);

  // Broadcast listener — keeps other windows in sync
  useEffect(() => {
    if (!OBR.isAvailable) return;
    return OBR.broadcast.onMessage(BROADCAST_CHANNEL, (event) => {
      const msg = event.data as unknown;
      if (msg && typeof msg === "object" && (msg as { type?: unknown }).type === "fdmc:resource-counters:update") {
        const next = (msg as { state: ResourceCounterMap }).state;
        persist(next);
        stateRef.current = next;
        setCounters(next);
      }
    });
  }, []);

  function broadcastAndPersist(next: ResourceCounterMap) {
    persist(next);
    stateRef.current = next;
    setCounters(next);
    if (OBR.isAvailable) {
      void OBR.broadcast.sendMessage(
        BROADCAST_CHANNEL,
        { type: "fdmc:resource-counters:update", state: next },
        { destination: "REMOTE" }
      ).catch(() => undefined);
    }
  }

  // ── Get remaining count ───────────────────────────────────────────────────

  const getRemaining = useCallback((actorId: string, resourceActionId: string): number => {
    return stateRef.current[actorId]?.[resourceActionId] ?? 0;
  }, []);

  const getMax = useCallback((actorId: string, resourceAction: ActorAction): number => {
    return getMaxFromAction(resourceAction);
  }, []);

  // ── Decrement (use one slot) ──────────────────────────────────────────────

  const decrementResource = useCallback((actorId: string, resourceActionId: string) => {
    const current = stateRef.current[actorId]?.[resourceActionId] ?? 0;
    if (current <= 0) return;
    const next = {
      ...stateRef.current,
      [actorId]: { ...(stateRef.current[actorId] ?? {}), [resourceActionId]: current - 1 },
    };
    broadcastAndPersist(next);
  }, []);

  // ── Reset resources by reset type ─────────────────────────────────────────

  const resetActorResources = useCallback((actorId: string, restType: "short" | "long") => {
    const actor = actors.find(a => a.id === actorId);
    if (!actor) return;

    const resourceActions = actor.tabs.resources ?? [];
    const actorCounters = { ...(stateRef.current[actorId] ?? {}) };

    for (const action of resourceActions) {
      const kind = action.metadata?.resourceKind;
      const reset = action.metadata?.cost?.toLowerCase() ?? "";
      const max = getMaxFromAction(action);
      if (restType === "long") {
        // Long rest resets everything except manual-only counters
        if (kind !== "counter") actorCounters[action.id] = max;
      } else if (restType === "short") {
        // Short rest resets: pactSlot, toggle, pool(short), and explicit "short rest" reset
        const resetsOnShort = kind === "pactSlot" || kind === "toggle" ||
          (kind === "pool" && reset.includes("short")) ||
          (!kind && reset.includes("short"));
        if (resetsOnShort) actorCounters[action.id] = max;
      }
    }

    const next = { ...stateRef.current, [actorId]: actorCounters };
    broadcastAndPersist(next);
  }, [actors]);

  // ── Find resource action by label match (for spell slot linking) ──────────

  const findResourceByLabel = useCallback((actorId: string, labelFragment: string): ActorAction | undefined => {
    const actor = actors.find(a => a.id === actorId);
    if (!actor) return undefined;
    const lower = labelFragment.toLowerCase();
    return (actor.tabs.resources ?? []).find(r =>
      r.label.toLowerCase().includes(lower)
    );
  }, [actors]);

  // ── Consume result (P11) ──────────────────────────────────────────────────
  // Richer than a bare boolean so the caller can post a precise combat-log entry.
  //   outcome "spent"   → a charge was decremented (remaining is post-spend)
  //   outcome "empty"   → resource exists but had 0 left (nothing decremented)
  //   outcome "no-resource" → actor has no matching resource (untracked — silent)

  // ── Consume spell slot by level ───────────────────────────────────────────
  // Matches "Spell Slots L2", "Pact Slots", etc. by level number in label.
  // Upcasting is data-authored: the spell action carries the level it is cast at
  // (metadata.spellLevel), so passing that level here spends the correct slot.

  const consumeSpellSlot = useCallback((actorId: string, level: number): ConsumeResult => {
    const actor = actors.find(a => a.id === actorId);
    if (!actor) return { outcome: "no-resource" };

    const resources = actor.tabs.resources ?? [];

    const matchingResource = resources.find(r => {
      const lbl = r.label.toLowerCase();
      return lbl.includes(`l${level}`) || lbl.includes(`level ${level}`) ||
        lbl.includes(`${level}th`) || lbl.includes(`${level}nd`) ||
        lbl.includes(`${level}rd`) || lbl.includes(`${level}st`);
    });

    if (!matchingResource) return { outcome: "no-resource" };
    const current = stateRef.current[actorId]?.[matchingResource.id] ?? 0;
    const max = getMaxFromAction(matchingResource);
    if (current <= 0) return { outcome: "empty", label: matchingResource.label, remaining: 0, max };

    decrementResource(actorId, matchingResource.id);
    return { outcome: "spent", label: matchingResource.label, remaining: current - 1, max };
  }, [actors, decrementResource]);

  // ── Consume named resource by label ──────────────────────────────────────
  // Used for class features: Channel Divinity, Rage, Bardic Inspiration, etc.
  // The action's slotCost field should match (or partially match) the resource label.
  // e.g. slotCost "Channel Divinity" matches resource "Channel Divinity: 2 uses"

  const consumeNamedResource = useCallback((actorId: string, resourceLabel: string): ConsumeResult => {
    if (!resourceLabel.trim()) return { outcome: "no-resource" };

    const actor = actors.find(a => a.id === actorId);
    if (!actor) return { outcome: "no-resource" };

    const resources = actor.tabs.resources ?? [];
    const needle = resourceLabel.trim().toLowerCase();

    // Match: resource label contains the action's slotCost, or vice versa
    const matchingResource = resources.find(r => {
      const haystack = r.label.toLowerCase();
      return haystack.includes(needle) || needle.includes(haystack);
    });

    if (!matchingResource) return { outcome: "no-resource" };
    const current = stateRef.current[actorId]?.[matchingResource.id] ?? 0;
    const max = getMaxFromAction(matchingResource);
    if (current <= 0) return { outcome: "empty", label: matchingResource.label, remaining: 0, max };

    decrementResource(actorId, matchingResource.id);
    return { outcome: "spent", label: matchingResource.label, remaining: current - 1, max };
  }, [actors, decrementResource]);

  return {
    counters,
    getRemaining,
    getMax,
    decrementResource,
    resetActorResources,
    findResourceByLabel,
    consumeSpellSlot,
    consumeNamedResource,
  };
}
