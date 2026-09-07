/**
 * THE LICENCE NOTICES THIS INSTALL OWES — the one place that names them.
 *
 * ⚠ AN ATTRIBUTION THAT NOTHING DISPLAYS IS NOT AN ATTRIBUTION. `srdContent` has said it plainly
 * since it was written: *"IT TRAVELS WITH THE CONTENT OR THE CONTENT DOES NOT SHIP. This string is
 * not decoration; it is the condition under which the records below may exist in the app at all."*
 * And then nothing imported it — `check:wiring` had it ledgered as an accepted orphan export, which
 * is a fair description of a wiring fact and a poor description of a licence obligation.
 *
 * Christopher, 2026-09-07: *"make sure the dnd mod has both SRD attribution in it."* Two CC-BY-4.0
 * documents now ship — SRD 5.2.1 (creatures, species, traits) and SRD 5.1 (species) — and each
 * carries its own required notice.
 *
 * ⚠ THIS IS THE MOD LAYER, NOT THE ENGINE, and it is the twin of `monsterSourceRoster`. Something
 * has to know that this install ships D&D 5e SRD content under Creative Commons; `core/` must not,
 * because an engine that names the SRD cannot ship a mod for a game that has no SRD. Swapping this
 * roster is part of the cost of running a different system.
 */

import { SRD_ATTRIBUTION, SRD_51_ATTRIBUTION, SRD_VERSION, SRD_51_VERSION } from "./dnd-5e/srdContent";

export type ContentAttribution = {
  /** Short label for the line — "SRD 5.2.1". */
  label: string;
  /** The licence, named so a reader can check the terms rather than take our word for it. */
  licence: string;
  licenceUrl: string;
  /** The notice as the licence requires it, verbatim. */
  notice: string;
  /** What in this app came from it, so the notice is answerable rather than boilerplate. */
  covers: string;
};

/**
 * Every notice this install must display.
 *
 * ⚠ BOTH DOCUMENTS, AND BOTH ARE REQUIRED. They are separate works under separate notices even
 * though the licence is the same one; showing 5.2.1's alone would leave the 5.1 species content
 * unattributed, and 5.1 is what the campaign's own characters are built on.
 */
export const CONTENT_ATTRIBUTIONS: readonly ContentAttribution[] = [
  {
    label: `SRD ${SRD_VERSION}`,
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/legalcode",
    notice: SRD_ATTRIBUTION,
    covers: "Reference creatures, and the species traits, speeds and damage responses the character editor adds.",
  },
  {
    label: `SRD ${SRD_51_VERSION}`,
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/legalcode",
    notice: SRD_51_ATTRIBUTION,
    covers: "The 2014 species and subraces, for sheets built on that document.",
  },
];
