/**
 * APPLYING A SPECIES TO A SHEET — additive, reversible, and it never eats what a DM typed.
 *
 * Christopher: *"should be set to automatically add the traits and movement."* Automatic is the
 * easy half. The half that matters is that Lyrielle already HAS a hand-typed "Wood Elf Traits"
 * row and a hand-typed speed, on a sheet the app has no business rewriting — so this adds what is
 * missing and removes only what it previously added itself.
 *
 * ⚠ THE ID PREFIX IS THE WHOLE SAFETY MECHANISM. Changing a character's species must remove the
 * old species' rows, and doing that by NAME would delete a DM's own "Darkvision" row. Only rows
 * whose id starts `srd-species:` are ever removed — every hand-authored row is invisible to this
 * function by construction. Memory of the same lesson at the library level: seeded content MERGES,
 * a wholesale re-seed wipes co-residents.
 */

import type { ActorAction, TabActionMap } from "../../core/types/tabs";
import { resolveSpecies, speciesTraitId, SPECIES_TRAIT_PREFIX } from "./srdSpecies";

export type SpeciesApplication = {
  tabs: TabActionMap;
  /** The speed the species states, formatted the way the sheet writes it. */
  speed: string;
  /** Rows added by this call, named so the editor can say what it did. */
  added: string[];
  /** Rows from a PREVIOUS species that were removed. */
  removed: string[];
  /** What the species is, for the note beside the change. */
  source: string;
} | null;

/**
 * Fold a species' traits into the features tab and return the speed it grants.
 *
 * Returns null for a race the SRD does not cover, which leaves the sheet exactly as it was — a
 * Kobold and a homebrew lineage both take that path, and neither is an error.
 */
export function applySpeciesToTabs(race: string | undefined, tabs: TabActionMap): SpeciesApplication {
  const resolved = resolveSpecies(race);
  if (!resolved) return null;

  const existing = (tabs.features ?? []) as ActorAction[];
  const removed = existing
    .filter(a => String(a.id ?? "").startsWith(SPECIES_TRAIT_PREFIX))
    .map(a => String(a.label ?? a.id));
  const kept = existing.filter(a => !String(a.id ?? "").startsWith(SPECIES_TRAIT_PREFIX));

  /**
   * ⚠ A HAND-TYPED ROW OF THE SAME NAME WINS AND IS NOT DUPLICATED. Lyrielle's sheet says
   * "Darkvision 60 ft" inside her own trait blob; adding a second "Darkvision" row beside it would
   * be the app arguing with the sheet in the DM's own feature list. Matching on the label is safe
   * HERE — unlike removal, the cost of a false match is one row not added, not one row destroyed.
   */
  const heldLabels = new Set(kept.map(a => String(a.label ?? "").trim().toLowerCase()).filter(Boolean));

  const added: string[] = [];
  const rows: ActorAction[] = [];
  for (const trait of resolved.traits) {
    if (heldLabels.has(trait.name.trim().toLowerCase())) continue;
    added.push(trait.name);
    rows.push({
      id: speciesTraitId(trait.name),
      label: trait.name,
      actionKind: "feature",
      economyCost: [],
      logMode: "silent",
      description: trait.text,
      category: resolved.source,
      metadata: { details: trait.text },
    } as ActorAction);
  }

  return {
    tabs: { ...tabs, features: [...kept, ...rows] },
    speed: `${resolved.speedFt} ft`,
    added,
    removed,
    source: resolved.source,
  };
}
