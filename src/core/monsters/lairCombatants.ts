/**
 * THE LAIR AS A ROW ON THE TRACKER — initiative 20, losing ties.
 *
 * Christopher, 2026-11-10: *"we need to make sure the lair for the dragon fight is working as
 * intended or there is a entry for it that locks it at initiative 20 with the built-in effects
 * from the encounter sheet."*
 *
 * ── ⚠ IT WAS AUTHORED, PRICED, AND UNPLAYABLE ───────────────────────────────────────────────
 *
 * The Veil-Torn Dragon has carried a complete `lair` since lair support landed — initiative 20,
 * `noRepeatConsecutive`, three options with their saves and printed text — and the CHECKER reads
 * it (`encounter-band/lairRoster.ts` prices it). The TRACKER never did. There was no row, nothing
 * acted on 20, and `legalLairOptions` — the no-repeat rule, written for exactly this — was never
 * called from anywhere in the app. The library's own note still says the quiet part: *"LAIR
 * ACTIONS (not yet playable from the tracker — a lair is a SUMMON at initiative 20, and the summon
 * mechanism is unbuilt)"*. The summon mechanism has existed since `summon.ts`; the note outlived
 * its reason.
 *
 * This is the play side: the roster goes in, lair rows come out.
 *
 * ── ⚠ ONE ROW PER LAIR, NOT PER BODY ────────────────────────────────────────────────────────
 *
 * A lair belongs to the PLACE, not to each creature standing in it. Two bodies of the same
 * template is still one clearing that remembers being somewhere else, and emitting a row each
 * would hand the DM two initiative-20 turns for one environment.
 *
 * ── ⚠ AND IT LEAVES WHEN ITS CREATURE DOES ──────────────────────────────────────────────────
 *
 * A lair acts while the creature whose lair it is still lives. With every body down, the ground
 * stops arguing — so a row whose creatures are all dead is not emitted. That is also what stops a
 * finished fight keeping a turn on the tracker forever.
 */

import type { LairSpec } from "./lair";

/** The minimum a roster entry has to expose for a lair to be read off it. */
export type LairBearing = {
  instanceId: string;
  templateId: string;
  lair?: LairSpec;
  /** Player-safe or DM name, whichever the caller wants the row titled after. */
  displayName?: string;
  revealedName?: string;
  name?: string;
};

export type LairRow = {
  /** Stable across rounds and distinct from any creature id — the row is not a body. */
  id: string;
  /** "The Veil-Torn Dragon's Lair". */
  name: string;
  /** The creature the lair belongs to, for the card's note. */
  sourceName: string;
  /** 20 unless the spec says otherwise. Never rolled, never editable. */
  initiative: number;
  lair: LairSpec;
};

/** The id a lair row carries, derived so the same lair keeps its row across re-renders. */
export function lairRowId(templateId: string): string {
  return `lair:${templateId}`;
}

/** True when this row is a lair rather than a creature. */
export function isLairRowId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("lair:");
}

/**
 * The lair rows a fight should show, given its monster roster.
 *
 * `isDown` decides which bodies still count — passed in rather than read here, because what
 * counts as down is the roster's business and it already knows (0 HP, removed, benched).
 */
export function lairRowsFor(
  instances: readonly LairBearing[],
  isDown: (instanceId: string) => boolean = () => false,
): LairRow[] {
  const byTemplate = new Map<string, LairRow>();
  for (const inst of instances) {
    if (!inst.lair || inst.lair.options.length === 0) continue;
    // Every body of this creature is down -> the lair goes quiet. Checked per body below.
    if (isDown(inst.instanceId)) continue;
    if (byTemplate.has(inst.templateId)) continue;
    const sourceName = inst.revealedName || inst.displayName || inst.name || "The lair";
    byTemplate.set(inst.templateId, {
      id: lairRowId(inst.templateId),
      name: `${sourceName}'s Lair`,
      sourceName,
      initiative: inst.lair.initiative ?? 20,
      lair: inst.lair,
    });
  }
  return [...byTemplate.values()];
}
