/**
 * MIGRATION — one tab for feats and class features, and it is FEATURES.
 *
 * Christopher: *"feats and features are both a thing, and they are suppose to be shown on the actor
 * under features [...] we need to merge both of them and one needs to go away"*, then, deciding the
 * direction: *"fix the feats to be movable to the features tab and then make sure features tab is
 * what is shown on new dnd mod actors as well as existing actors."*
 *
 * ⚠ THIS REVERSES A DECISION ALREADY IN THE CODE, ON PURPOSE. Three files carried the note
 * *"`features` is being retired into `feats`"* — `deriveActorStats`, and two readers in `ActorCard`.
 * That was the earlier plan; this is the current one, and it is Christopher's to make. The note is
 * corrected wherever it appears rather than left to contradict the behaviour.
 *
 * ── WHY THE READERS STILL READ BOTH ─────────────────────────────────────────────────────────
 * They always did, which is the only reason this migration is safe to run at all: a character that
 * has not migrated yet keeps working, and one that has works identically. The migration MOVES the
 * data so a DM sees one tab; the readers stay tolerant so nothing depends on the move having
 * happened.
 *
 * ⚠ AND IT MOVES RATHER THAN COPIES. A duplicated entry would be counted twice by
 * `deriveActorStats`, which concatenates both tabs — an ASI feat appearing on both would silently
 * double its own ability increase.
 */

import type { Actor } from "../types/actor";
import type { ActorAction } from "../types/tabs";

const KEY = "fdmc.featsIntoFeatures.migration.v1";
const VERSION = "0.8.5.0-feats-into-features";

export type FeatMergeReport = { actors: number; moved: number };

/** Move one actor's feats onto its features tab. Pure — the caller decides what to persist. */
export function mergeFeatsIntoFeatures(actor: Actor): { actor: Actor; moved: number } {
  const feats = (actor.tabs?.feats ?? []) as ActorAction[];
  if (feats.length === 0) return { actor, moved: 0 };

  const features = (actor.tabs?.features ?? []) as ActorAction[];
  /**
   * ⚠ DE-DUPLICATED BY ID. A previous partial run, or a DM who already moved one by hand, must not
   * leave the same entry on the tab twice — `deriveActorStats` would price its stat effects twice.
   */
  const have = new Set(features.map(f => f.id));
  const incoming = feats.filter(f => !have.has(f.id));

  return {
    actor: {
      ...actor,
      tabs: { ...actor.tabs, features: [...features, ...incoming], feats: [] },
    },
    moved: incoming.length,
  };
}

/**
 * Run across a whole actor library, once, keyed by version — the same shape as
 * `migrateEncounterNames` and `repairDuplicateResistance`.
 *
 * @param load  read the library
 * @param save  persist it, only when something actually moved
 */
export function migrateFeatsIntoFeatures(
  load: () => Record<string, Actor>,
  save: (actors: Record<string, Actor>) => void,
  force = false,
): FeatMergeReport {
  const report: FeatMergeReport = { actors: 0, moved: 0 };
  try {
    if (!force && window.localStorage.getItem(KEY) === VERSION) return report;
  } catch { return report; }

  const library = load();
  const next: Record<string, Actor> = {};
  let changed = false;
  for (const [id, actor] of Object.entries(library)) {
    const r = mergeFeatsIntoFeatures(actor);
    if (r.moved > 0) { changed = true; report.actors++; report.moved += r.moved; }
    next[id] = r.actor;
  }
  if (changed) save(next);

  try { window.localStorage.setItem(KEY, VERSION); } catch { /* ok */ }
  return report;
}
