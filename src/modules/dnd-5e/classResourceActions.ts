/**
 * A CLASS POOL THE TABLES GRANT, AS A RESOURCE ROW THE SHEET CAN SPEND.
 *
 * Christopher, 2026-09-10: *"the derived is suppose to add those fields to the resources correct?
 * if it isnt then we have the srd in the mod in the actor section for no reason."*
 *
 * ⚠ HE IS RIGHT, AND THE BUILDER ALREADY EXISTED — INLINE, WHERE NOTHING ELSE COULD REACH IT.
 *
 * 0.7.10.25 put an auto-fill button on the Resources step and wrote the row-building inside an
 * anonymous IIFE in `ActorEditor`. That is why the DM Reference could only WARN that a pool was
 * missing: the thing that creates one was not callable from anywhere else. Extracted here, both
 * surfaces add the identical row — a second hand-written copy would be two builders free to
 * disagree about `shortRestRegain`, which is the field that decides whether a Rage comes back.
 *
 * ⚠ AND IT STILL ONLY ADDS WHAT IS MISSING. The rule from 0.7.10.25 holds: *"an existing pool
 * keeps its current count, because a half-spent Rage must not be silently refilled."* Nothing here
 * edits or removes a row that exists.
 */

import type { ActorAction } from "../../core/types/tabs";
import { slugifyForActionId } from "../../core/ui/pcActionTypes";
import { resourcesForClasses, type ClassResource } from "./classResources";

export type GrantedResource = ClassResource & { className: string };

export type ClassRow = { name: string; level: number; subclassName?: string | null };

/** Every pool the class tables grant these rows at their level. */
export function grantedClassResources(rows: readonly ClassRow[]): GrantedResource[] {
  return resourcesForClasses(rows.filter(r => (r.name ?? "").trim() !== ""));
}

/**
 * Those of them the sheet has no pool for.
 *
 * ⚠ MATCHED ON THE LABEL, CASE-FOLDED, AND ON THE DISAMBIGUATED FORM TOO. `resourcesForClasses`
 * renames a collision to "Channel Divinity (Cleric)"; a sheet holding a plain "Channel Divinity"
 * already has that pool and must not be told to add a second.
 */
export function missingClassResources(
  rows: readonly ClassRow[],
  existingLabels: readonly (string | undefined)[],
): GrantedResource[] {
  const have = new Set(existingLabels.map(l => (l ?? "").trim().toLowerCase()).filter(Boolean));
  return grantedClassResources(rows).filter(g => {
    const label = g.label.trim().toLowerCase();
    return !have.has(label) && !have.has(label.replace(/\s*\([^)]*\)\s*$/, "").trim());
  });
}

/** One granted pool as the resource row the Resources step writes. */
export function classResourceToAction(g: GrantedResource): ActorAction {
  return {
    id: `res-${slugifyForActionId(g.label)}`,
    label: g.label,
    actionKind: "resource",
    economyCost: [],
    logMode: "silent",
    displayMode: "compact",
    category: "Resources",
    tags: [],
    metadata: {
      resourceKind: g.kind,
      /**
       * From the workbook registry, so an auto-granted Rage returns one use on a short rest
       * instead of waiting for a DM to type it in by hand.
       */
      ...(g.shortRestRegain !== undefined ? { shortRestRegain: g.shortRestRegain } : {}),
      cost: g.reset === "shortRest" ? "Short Rest" : g.reset === "longRest" ? "Long Rest" : g.reset,
      details: [
        `Pool: ${g.max}`,
        `Reset: ${g.reset}`,
        g.shortRest ? `Short rest: ${g.shortRest}` : "",
        g.note,
      ].filter(Boolean).join(" · "),
      additive: String(g.max),
    },
  } as ActorAction;
}

/** The rows to append for everything missing. Empty when nothing is. */
export function classResourceRowsToAdd(
  rows: readonly ClassRow[],
  existingLabels: readonly (string | undefined)[],
): ActorAction[] {
  return missingClassResources(rows, existingLabels).map(classResourceToAction);
}
