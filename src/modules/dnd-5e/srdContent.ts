/**
 * D&D MOD — the SRD 5.2.1 runtime library and the terms it ships under.
 *
 * ⚠ THIS IS MOD CONTENT AND IT STAYS HERE. RULE 3: the engine holds the vocabulary, a mod holds
 * the answers. `core/content/contentScope.ts` knows what a "system" record may not do; it does not
 * know what an SRD is, and it must not learn. Christopher: *"these are only in the dnd mod, [make]
 * sure that they don't bleed into the new portability side"* — the portability side being *"the way
 * we built the app so that it isnt lock[ed] to OBR."*
 *
 * The same argument covers rulesets. An engine that names the SRD cannot ship a mod for a game that
 * has no SRD, exactly as an engine that names OBR cannot ship on another VTT.
 *
 * ── WHY SRD CREATURES ARE `system` SCOPE ────────────────────────────────────────────────────
 * *"The SRD library should be runtime-only reference content, not an authoring source. It can
 * appear in encounters, estimators, random/rest tables, and stat-block display, but it should be
 * completely excluded from chassis/template selection and from anything that creates persistent
 * homebrew content."*
 *
 * Two reasons, and the licence is only the second one.
 *
 * The first is what this app is FOR: *"The app is not trying to become 'pick an official monster
 * and tweak it.' Its core value is homebrew creation and campaign-specific encounter building."*
 * A chassis picker full of official monsters turns a homebrew tool into a stat-block editor.
 *
 * The second is redistribution. SRD 5.2.1 is released under CC-BY-4.0, which permits transforming
 * and redistributing the content provided the attribution below travels with it. Letting a DM save
 * an SRD creature into their own library and then export it as their own work is precisely the
 * case that attribution exists to prevent — so `system` scope blocks the export path too.
 *
 * ── WHY 5.2.1 AND NOT 5.2.0 ─────────────────────────────────────────────────────────────────
 * 5.2.1 corrected the initial release: it added fifteen missing magic items and replaced an
 * accidental duplicate Iron Golem block with the Knight. Pinning the version in `SRD_SOURCE` is
 * what makes an imported record answerable — a record that says only "SRD" cannot be checked.
 */

import type { ContentProvenance } from "../../core/content/contentScope";

/** The version string every imported record carries. Pinned deliberately — see the header. */
export const SRD_VERSION = "5.2.1" as const;

/** The id namespace for imported SRD records: `dnd:srd521:air_elemental`. */
export const SRD_ID_PREFIX = "dnd:srd521:" as const;

/** Stable id for one SRD record, from its printed name. */
export function srdId(name: string): string {
  return SRD_ID_PREFIX + name.trim().toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * The attribution CC-BY-4.0 requires, carried in the mod's own about/legal metadata.
 *
 * ⚠ IT TRAVELS WITH THE CONTENT OR THE CONTENT DOES NOT SHIP. This string is not decoration; it is
 * the condition under which the records below may exist in the app at all.
 */
/**
 * SRD 5.1 IS ALSO CC-BY-4.0, AND SAYING OTHERWISE WAS WRONG.
 *
 * Wizards released SRD 5.1 under Creative Commons Attribution 4.0 in January 2023 — the same
 * licence 5.2.1 ships under, needing only its own attribution string. Christopher, 2026-09-07:
 * *"the srd is suppose to be both 5.1 and 5.2.1 because wood elf is the class she has, and 5.1
 * has a SRD as well that can be used."* He is right; the app may carry both, and the campaign
 * characters are built on 5.1, where Wood Elf is a subrace with Mask of the Wild and Fleet of Foot.
 */
export const SRD_51_VERSION = "5.1" as const;

export const SRD_51_ATTRIBUTION =
  "This work includes material from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of "
  + "the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The "
  + "SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License, available "
  + "at https://creativecommons.org/licenses/by/4.0/legalcode.";

export const SRD_ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by "
  + "Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is "
  + "licensed under the Creative Commons Attribution 4.0 International License, available at "
  + "https://creativecommons.org/licenses/by/4.0/legalcode.";

/**
 * The provenance stamped on every imported SRD record.
 *
 * ⚠ ONE OBJECT, SHARED, FROZEN. Every SRD record points at this rather than carrying its own copy,
 * so there is exactly one place the answer can be wrong and no way for a single record to drift
 * into being authorable.
 */
export const SRD_PROVENANCE: Readonly<ContentProvenance> = Object.freeze({
  scope: "system",
  source: `SRD ${SRD_VERSION}`,
  sourceMod: "dnd",
  systemLocked: true,
  authoringAvailable: false,
});

/**
 * What the D&D mod's own content — as opposed to imported reference content — carries.
 *
 * Kept beside the SRD stamp on purpose: the difference between "the mod ships this so you can
 * build on it" and "the mod shows you this and you may not" is the single most important
 * distinction in this file, and separating them across two files would hide it.
 */
export const DND_MOD_PROVENANCE: Readonly<ContentProvenance> = Object.freeze({
  scope: "homebrew",
  source: "D&D module",
  sourceMod: "dnd",
});

/** Does this record come from the SRD import? Answered from provenance, never from the id. */
export function isSrdRecord(record: { provenance?: ContentProvenance } | undefined | null): boolean {
  return record?.provenance?.sourceMod === "dnd"
    && record?.provenance?.scope === "system";
}
