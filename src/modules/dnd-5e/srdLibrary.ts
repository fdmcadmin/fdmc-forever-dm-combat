/**
 * THE SRD CREATURE LIBRARY — the parse, corrected by the audit.
 *
 * Two sources, and they are not equals:
 *
 *   `srdMonsters.generated.ts`   what `import-srd.mjs` read out of the PDF's TEXT LAYER. It has
 *                                the traits, actions and damage, and it drops digits.
 *   `srdAuditChassis.generated.ts`  what Christopher's audit read off the PRINTED PAGES for all
 *                                330 blocks. Header line only — no actions — and it is right.
 *
 * ⚠ RULE 1: THE AUDIT WINS. Where the two disagree on CR, AC or HP the audit's value is taken and
 * the parse's value is RECORDED, so a correction is always traceable rather than a silent edit.
 * The parser read a text layer; the audit read the page.
 *
 * ⚠ AND IT CAN ONLY CORRECT, NEVER SUPPLY. A creature the parser never produced cannot be
 * recovered from here — the audit has no actions, and a creature with AC and HP and no actions
 * prices at ZERO DPR, which is a wrong answer wearing the shape of an answer. Those are reported
 * as `SRD_ABSENT` and need the PDF re-parsed.
 */

import { SRD_CREATURES, type SrdCreature } from "./srdMonsters.generated";
import { SRD_AUDIT_CHASSIS, type SrdAuditChassis } from "./srdAuditChassis.generated";

/**
 * ⚠ THE PDF'S TEXT LAYER MANGLES TYPOGRAPHIC PUNCTUATION. "Will-o'-Wisp" comes back as
 * "Will-o -Wisp": the curly apostrophe became a space. Matching on the raw string reports a
 * creature we HAVE as one we are missing, and then a repair pass "adds" a duplicate.
 *
 * Fold punctuation and whitespace before comparing. Nothing here changes a displayed name.
 */
export function srdNameKey(name: string): string {
  return name
    .replace(/[‘’ʼ'`]/g, "")   // apostrophes, curly or straight
    .replace(/[‐-―]/g, "-")          // dash variants
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim()
    .toLowerCase();
}

/**
 * Stat blocks that are NOT on the audit's pages because they are not monsters — they are the
 * bodies a SPELL creates, printed with the spell.
 *
 * ⚠ A SUMMON HAS NO CR, AND THAT IS NOT A MISSING VALUE. Its whole profile is a function of the
 * casting: the Otherworldly Steed's AC is "10 + 1 per spell level", the Draconic Spirit's HP scales
 * with the slot. `check:summons` proves exactly this for the Steed's three forms. Reporting CR as
 * NEEDS_INPUT sends a DM looking for a number the stat block never printed — the honest field is
 * "this scales with the slot".
 */
export const SLOT_SCALED_SUMMONS: readonly string[] = [
  "Otherworldly Steed",
  "Giant Insect",
  "Draconic Spirit",
];

const SLOT_SCALED_KEYS = new Set(SLOT_SCALED_SUMMONS.map(srdNameKey));

export type SrdCorrection = {
  field: "cr" | "ac" | "hp";
  /** What the text layer produced — null when it produced nothing at all. */
  parsed: string | number | null;
  /** What the audit read off the printed page. */
  audit: string | number;
};

export type SrdLibraryEntry = SrdCreature & {
  /** The audit row this was checked against, when it has one. */
  chassis?: SrdAuditChassis;
  /** Every value the audit changed or supplied. Empty when the parse already agreed. */
  corrections: SrdCorrection[];
  /**
   * `cr` — an ordinary creature rated by Challenge Rating.
   * `slot` — a spell's summoned body; its profile is a function of the casting, not a CR.
   */
  scaling: "cr" | "slot";
  /** What is STILL unknown after the audit has been applied. */
  missing: string[];
};

const auditByKey = new Map(SRD_AUDIT_CHASSIS.map(c => [srdNameKey(c.name), c]));

function correct(creature: SrdCreature): SrdLibraryEntry {
  const key = srdNameKey(creature.name);
  const chassis = auditByKey.get(key);
  const corrections: SrdCorrection[] = [];
  const scaling: "cr" | "slot" = SLOT_SCALED_KEYS.has(key) ? "slot" : "cr";

  let { cr, ac, hp } = creature;

  if (chassis) {
    if (cr === null || String(cr) !== chassis.cr) {
      corrections.push({ field: "cr", parsed: cr, audit: chassis.cr });
      cr = chassis.cr;
    }
    if (ac === null || ac !== chassis.ac) {
      corrections.push({ field: "ac", parsed: ac, audit: chassis.ac });
      ac = chassis.ac;
    }
    if (hp === null || hp !== chassis.hp) {
      corrections.push({ field: "hp", parsed: hp, audit: chassis.hp });
      hp = chassis.hp;
    }
  }

  // What remains unknown. A slot-scaled body is not missing a CR — it never had one.
  const missing: string[] = [];
  if (cr === null && scaling === "cr") missing.push("CR");
  if (ac === null) missing.push("AC");
  if (hp === null) missing.push("HP");

  return { ...creature, cr, ac, hp, chassis, corrections, scaling, missing };
}

export const SRD_LIBRARY: SrdLibraryEntry[] = SRD_CREATURES.map(correct);

export const SRD_LIBRARY_BY_ID = new Map(SRD_LIBRARY.map(c => [c.id, c]));

/** Still incomplete after the audit. Surfaced, never defaulted. */
export const SRD_STILL_INCOMPLETE: SrdLibraryEntry[] = SRD_LIBRARY.filter(c => c.missing.length > 0);

/** Every value the audit corrected or supplied — the blast radius of adopting the document. */
export const SRD_CORRECTED: SrdLibraryEntry[] = SRD_LIBRARY.filter(c => c.corrections.length > 0);

/**
 * ⚠ IN THE AUDIT AND NOT IN THE LIBRARY — the honest deficit.
 *
 * These stat blocks exist in the SRD and our parse never produced them. They CANNOT be filled in
 * from the audit: it has no actions, and a body with no actions prices at zero. Closing this needs
 * `import-srd.mjs` re-run against the PDF, which is not in the repository.
 */
export const SRD_ABSENT: SrdAuditChassis[] = (() => {
  const have = new Set(SRD_LIBRARY.map(c => srdNameKey(c.name)));
  return SRD_AUDIT_CHASSIS.filter(c => !have.has(srdNameKey(c.name)));
})();

/**
 * In the library and not in the audit. A spell summon legitimately is; anything else is a stat
 * block the parser invented out of a page break — "Medium Swarm of", "Ooze" — and is not a
 * creature a DM should ever be offered.
 */
export const SRD_UNMATCHED: SrdLibraryEntry[] =
  SRD_LIBRARY.filter(c => !c.chassis && c.scaling !== "slot");

/** Creatures fit to offer: matched to a printed page, or a summon that scales with its slot. */
export const SRD_USABLE: SrdLibraryEntry[] =
  SRD_LIBRARY.filter(c => (c.chassis || c.scaling === "slot") && c.missing.length === 0);
