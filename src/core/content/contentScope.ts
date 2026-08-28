/**
 * CONTENT SCOPE — where a record came from, and therefore what may be done with it.
 *
 * ⚠ THIS FILE IS ENGINE. It names no ruleset, no publisher, no licence and no VTT. "SRD", "5e",
 * "D&D" and "Owlbear" must never appear here.
 *
 * Christopher: *"these are only in the dnd mod, [make] sure that they don't bleed into the new
 * portability side"* — the portability side being *"the way we built the app so that it isnt
 * lock[ed] to OBR."* That is RULE 3 with a second axis. The engine must stay portable across VTTs
 * AND across rulesets, so the ENGINE owns the QUESTION ("may this record be used as a chassis?")
 * and a mod owns the ANSWER for its own content.
 *
 * A mod declares provenance on its records; the engine reads three booleans off it and never asks
 * what edition anything is.
 *
 * ── WHY A SCOPE AND NOT A FLAG ──────────────────────────────────────────────────────────────
 * Christopher, on read-only reference content: *"That restriction should be implemented in the
 * data model, not just by hiding buttons"* and *"the template picker should never even query the
 * [system] runtime library."*
 *
 * Both sentences describe the same thing: a hidden button is a UI accident away from being a
 * shipped bug, and a filter applied at the point of RENDER has already let the record into the
 * list. So the scope travels ON the record, the predicates below are the only gate, and the
 * selectors return a NARROWER LIST rather than a list plus a warning.
 *
 * ── THE THREE SCOPES ────────────────────────────────────────────────────────────────────────
 *
 *   system    Reference content the app ships and the DM may not author against. Usable in a
 *             fight; never a chassis, never saved into a personal library, never exported.
 *   campaign  Content belonging to ONE campaign — imported, or entered by the DM for that
 *             campaign. Usable there; it does not become reusable app-wide content.
 *   homebrew  The DM's own originals, and unlocked mod content they are licensed to build on.
 *             The only scope a chassis may come from.
 *
 * ⚠ THE DEFAULT IS `homebrew`, AND THAT IS DELIBERATE. Every record that existed before this file
 * was written is something a DM made or a mod shipped for building on, and defaulting those to
 * `system` would have silently revoked authoring across the whole library. A restricted scope is
 * something a mod OPTS IN to, on records it knows it may not let anyone author against.
 */

export type ContentScope = "system" | "campaign" | "homebrew";

export type ContentProvenance = {
  /**
   * Which store the record belongs to. This, not a guess about its id, decides what is allowed.
   */
  scope: ContentScope;
  /**
   * Human-readable origin, carried verbatim for attribution and for the DM to see. A mod sets it
   * to whatever names its source; the engine only ever displays it.
   */
  source?: string;
  /**
   * Which mod owns the record. Namespacing only — the engine never branches on the value.
   */
  sourceMod?: string;
  /**
   * The app may not let anyone edit this record, in place or as a copy that keeps its identity.
   */
  systemLocked?: boolean;
  /**
   * The record may be used as a chassis/template, and saved into a personal library.
   * Absent means "decide from the scope", which is the common case.
   */
  authoringAvailable?: boolean;
};

/** Anything the engine can ask these questions about. */
export type ScopedRecord = { provenance?: ContentProvenance };

/**
 * The provenance of a record that declares none.
 *
 * ⚠ NOT A GUESS — A CONTRACT. An undeclared record is the DM's, because until a mod says otherwise
 * every record in this app was authored in it or shipped to be built on.
 */
export const DEFAULT_PROVENANCE: Readonly<ContentProvenance> = Object.freeze({
  scope: "homebrew",
});

export function provenanceOf(record: ScopedRecord | undefined | null): ContentProvenance {
  return record?.provenance ?? DEFAULT_PROVENANCE;
}

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * THE PREDICATES — the only gate. Every caller asks here; nobody re-derives the rule.
 * ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * May this record be the basis of new authored content — a chassis, a template, a starting point?
 *
 * ⚠ SYSTEM CONTENT NEVER CAN, whatever else it says. A mod may still withhold authoring from its
 * own campaign or homebrew records by setting `authoringAvailable: false`, but it may not grant it
 * to a system record: the whole point of the system scope is that the answer is fixed.
 */
export function canBeChassis(record: ScopedRecord | undefined | null): boolean {
  const p = provenanceOf(record);
  if (p.scope === "system") return false;
  if (p.systemLocked) return false;
  return p.authoringAvailable !== false;
}

/**
 * May this record be saved into the DM's own reusable library?
 *
 * The same answer as `canBeChassis`, and deliberately a separate function: they are two different
 * questions that happen to share a rule today, and a caller that means one should not read the
 * other. If they ever diverge, they diverge here rather than at thirty call sites.
 */
export function canSaveToPersonalLibrary(record: ScopedRecord | undefined | null): boolean {
  return canBeChassis(record);
}

/**
 * May this record leave the app inside an export?
 *
 * ⚠ SYSTEM CONTENT DOES NOT TRAVEL. An export is redistribution, and reference content the app
 * merely displays under someone else's terms is not the app's to redistribute. Campaign content
 * does travel — it is the DM's own campaign, and carrying it is the point of the export.
 */
export function canExport(record: ScopedRecord | undefined | null): boolean {
  const p = provenanceOf(record);
  return p.scope !== "system" && !p.systemLocked;
}

/**
 * May this record be dropped into a fight?
 *
 * Everything can. System content exists to be USED — that is the whole reason to ship it — and the
 * restriction was never about play, only about authoring and redistribution.
 */
export function canUseInEncounter(_record: ScopedRecord | undefined | null): boolean {
  return true;
}

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * THE SELECTORS — hand a caller a narrower list, never a list plus a caveat.
 * ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The only list a chassis/template picker may be given.
 *
 * ⚠ CALL THIS INSTEAD OF FILTERING AT RENDER. A picker that receives the whole library and hides
 * rows is one refactor away from showing them, and one `.map()` away from letting a hidden row be
 * selected by keyboard. Give it a list that never contained them.
 */
export function chassisSources<T extends ScopedRecord>(records: readonly T[]): T[] {
  return records.filter(canBeChassis);
}

/** Everything that may be written into an export payload. */
export function exportableRecords<T extends ScopedRecord>(records: readonly T[]): T[] {
  return records.filter(canExport);
}

/** Records grouped by scope, for a UI that wants to show the split honestly. */
export function byScope<T extends ScopedRecord>(records: readonly T[]): Record<ContentScope, T[]> {
  const out: Record<ContentScope, T[]> = { system: [], campaign: [], homebrew: [] };
  for (const r of records) out[provenanceOf(r).scope].push(r);
  return out;
}

/**
 * Why a record cannot be authored against, in words a DM can act on.
 *
 * Returns null when it can. Used to explain a refusal rather than silently dropping a row, in the
 * one place that matters: a DM who went looking for a creature and cannot find it.
 */
export function authoringRefusal(record: ScopedRecord | undefined | null): string | null {
  const p = provenanceOf(record);
  if (p.scope === "system") {
    return `${p.source ?? "This"} is reference content. It can be used in an encounter, but not `
      + "edited, used as a chassis, or saved into your library.";
  }
  if (p.systemLocked) return "This record is locked by the module that ships it.";
  if (p.authoringAvailable === false) {
    return "The module that ships this record does not allow authoring against it.";
  }
  return null;
}
