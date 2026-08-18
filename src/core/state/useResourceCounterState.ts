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
import { chargeBearingActions, itemChargeKey } from "./itemCharges";

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
  actor: Actor,
  existing: ResourceCounterMap
): ResourceCounterMap {
  const actorCounters = existing[actor.id] ?? {};
  let changed = false;

  for (const action of actor.tabs.resources ?? []) {
    if (!(action.id in actorCounters)) {
      actorCounters[action.id] = getMaxFromAction(action);
      changed = true;
    }
  }

  // Item pools live on the item, not on a Resources row, and are keyed by item id so an
  // item's equipment row and attack row share one pool. Seeding them here is what makes a
  // newly attached magic item start at full charges instead of at zero.
  for (const { key, charges } of chargeBearingActions(actor.tabs)) {
    if (!(key in actorCounters)) {
      actorCounters[key] = charges.max;
      changed = true;
    }
  }

  if (!changed) return existing;
  return { ...existing, [actor.id]: actorCounters };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useResourceCounterState(actors: Actor[]) {
  const [counters, setCounters] = useState<ResourceCounterMap>(() => {
    const stored = readStored();
    let state = stored;
    for (const actor of actors) state = seedActorResources(actor, state);
    return state;
  });

  const stateRef = useRef(counters);
  useEffect(() => { stateRef.current = counters; }, [counters]);

  // Attaching an item mid-session adds a pool that wasn't there at mount, so seed on change
  // too — otherwise a freshly attached item reads 0/N and its first click is gated as empty.
  // Must sit below stateRef: reading it above the declaration is a TDZ crash, not a warning.
  useEffect(() => {
    let next = stateRef.current;
    for (const actor of actors) next = seedActorResources(actor, next);
    if (next !== stateRef.current) {
      persist(next);
      stateRef.current = next;
      setCounters(next);
    }
  }, [actors]);

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

  // ── Spend a variable amount from a pool (Lay on Hands, Ki points, etc.) ────
  const spendResource = useCallback((actorId: string, resourceActionId: string, amount: number): ConsumeResult => {
    const actor = actors.find(a => a.id === actorId);
    const action = actor?.tabs.resources?.find(r => r.id === resourceActionId);
    const label = action?.label;
    const max = action ? getMaxFromAction(action) : undefined;
    const current = stateRef.current[actorId]?.[resourceActionId] ?? max ?? 0;
    const spend = Math.max(0, Math.floor(amount));
    if (spend <= 0) return { outcome: "empty", label, remaining: current, max };
    if (current <= 0) return { outcome: "empty", label, remaining: 0, max };
    const applied = Math.min(spend, current);
    const next = {
      ...stateRef.current,
      [actorId]: { ...(stateRef.current[actorId] ?? {}), [resourceActionId]: current - applied },
    };
    broadcastAndPersist(next);
    return { outcome: "spent", label, remaining: current - applied, max };
  }, [actors]);

  // ── Consume one charge from an item's own pool ────────────────────────────
  // Keyed by item id, so a weapon's "expend 1 charge when you hit" and the same item's
  // equipment row draw down the one pool.

  const consumeItemCharge = useCallback((actorId: string, action: ActorAction): ConsumeResult => {
    const max = action.metadata?.charges?.max ?? 0;
    if (max <= 0) return { outcome: "no-resource" };
    const key = itemChargeKey(action.id);
    const label = action.label;
    const current = stateRef.current[actorId]?.[key] ?? max;
    if (current <= 0) return { outcome: "empty", label, remaining: 0, max };
    const next = {
      ...stateRef.current,
      [actorId]: { ...(stateRef.current[actorId] ?? {}), [key]: current - 1 },
    };
    broadcastAndPersist(next);
    return { outcome: "spent", label, remaining: current - 1, max };
  }, []);

  /**
   * Give a charge back — the recharge gate for a pool no rest will refill.
   *
   * An item that says "recharges at dawn" has no rest that restores it: a party can take two
   * long rests before a dawn, or see a dawn without resting at all. So the pool needs a hand
   * on it, and the DM is the one who says the condition happened. Without this a dawn item
   * could be spent exactly once and was then dead for the campaign.
   *
   * Clamped to the pool max, so it can restore but never inflate.
   */
  const restoreItemCharge = useCallback((actorId: string, action: ActorAction, amount = 1): ConsumeResult => {
    const max = action.metadata?.charges?.max ?? 0;
    if (max <= 0) return { outcome: "no-resource" };
    const key = itemChargeKey(action.id);
    const current = stateRef.current[actorId]?.[key] ?? max;
    const next = Math.min(max, current + amount);
    if (next === current) return { outcome: "spent", label: action.label, remaining: current, max };
    broadcastAndPersist({
      ...stateRef.current,
      [actorId]: { ...(stateRef.current[actorId] ?? {}), [key]: next },
    });
    return { outcome: "spent", label: action.label, remaining: next, max };
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
        // A long rest restores EVERY pool, counters included.
        //
        // `counter` used to be excluded as "manual-only". That was wrong in practice: a
        // manual counter is the FALLBACK a DM reaches for when a resource isn't pulling
        // automatically or got tagged wrong — it still represents a real class resource,
        // so it is still tied to the rest. Excluding it meant the fallback silently became
        // the one pool that never came back, and the DM had to top it up by hand forever.
        actorCounters[action.id] = max;
      } else if (restType === "short") {
        // An explicit shortRestRegain wins over everything and is the only way to express
        // PARTIAL recovery — "2 per Long Rest, regain one after a Short Rest" (Channel
        // Divinity, Rage, Bardic Inspiration, Superiority Dice). It also bypasses the prose
        // scan below, which is a trap: a cost reading "Long Rest; one back on a Short Rest"
        // contains "short" and would otherwise restore the pool to FULL.
        const regain = action.metadata?.shortRestRegain;
        if (regain !== undefined) {
          if (regain === "all") {
            actorCounters[action.id] = max;
          } else if (typeof regain === "number" && regain > 0) {
            const current = actorCounters[action.id] ?? max;
            actorCounters[action.id] = Math.min(max, current + regain);
          }
          // regain 0 / anything else → deliberately nothing on a short rest
          continue;
        }
        // Legacy fallback for resources authored before shortRestRegain existed. Note this
        // only ever restores to FULL — partial recovery is not expressible this way.
        // `counter` is included here for the same reason as the long-rest branch: it is a
        // fallback for a mis-tagged resource, not a resource that opts out of resting. If
        // its cadence says short rest, it comes back on a short rest.
        const resetsOnShort = kind === "pactSlot" || kind === "toggle" ||
          ((kind === "pool" || kind === "counter") && reset.includes("short")) ||
          (!kind && reset.includes("short"));
        if (resetsOnShort) actorCounters[action.id] = max;
      }
    }

    // Item pools carry their own reset on the item ("Regains 1 charge on a short rest, all on
    // a long rest"), so they don't follow the Resources-tab rules above. A long rest fills
    // anything that isn't manual-only; a short rest fills the shortRest items — and the
    // encounter ones too, since resting necessarily ends the encounter.
    for (const { key, charges } of chargeBearingActions(actor.tabs)) {
      /**
       * A LONG rest fills every item pool EXCEPT a `manual` one that names its own cadence.
       *
       * Two rulings collide here and the NOTE is what separates them:
       *   · *"manual counters are the fallback and should follow the rest"* — a bare `manual`
       *     tag means "this isn't pulling automatically", not "this opts out of resting". Those
       *     still fill, or the fallback becomes the one pool that never comes back.
       *   · *"dawn is not a rest — a party can take two long rests before a dawn."* An item
       *     whose note says **Recharges at dawn** is DELIBERATELY gated. Refilling it on a long
       *     rest hands the party a second use the item does not have.
       *
       * So: `manual` + a cadence note = only the manual +1 restores it. All 21 dawn items in the
       * Broken Chain library carry that note, and every one of them was refilling on a dusk long
       * rest before this.
       *
       * A SHORT rest still only fills the pools that say short rest (or encounter, since resting
       * necessarily ends the encounter) — manual is not assumed to be short.
       */
      const manuallyGated = charges.reset === "manual" && Boolean(charges.note?.trim());
      if ((restType === "long" && !manuallyGated)
        || charges.reset === "shortRest" || charges.reset === "encounter") {
        actorCounters[key] = charges.max;
      }
    }

    const next = { ...stateRef.current, [actorId]: actorCounters };
    broadcastAndPersist(next);
  }, [actors]);

  // ── Refill every "once per encounter" item pool ───────────────────────────
  //
  // Called at End Combat. These are the only pools that come back without a rest, which is
  // why they need their own trigger: a party that fights twice between short rests would
  // otherwise carry an empty Quickstep Boots into the second fight forever.
  const resetEncounterCharges = useCallback(() => {
    let next = stateRef.current;
    for (const actor of actors) {
      const counters = { ...(next[actor.id] ?? {}) };
      let touched = false;
      for (const { key, charges } of chargeBearingActions(actor.tabs)) {
        if (charges.reset !== "encounter") continue;
        if (counters[key] === charges.max) continue;
        counters[key] = charges.max;
        touched = true;
      }
      if (touched) next = { ...next, [actor.id]: counters };
    }
    if (next !== stateRef.current) broadcastAndPersist(next);
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
    spendResource,
    resetActorResources,
    findResourceByLabel,
    consumeSpellSlot,
    consumeNamedResource,
    consumeItemCharge,
    restoreItemCharge,
    resetEncounterCharges,
  };
}
