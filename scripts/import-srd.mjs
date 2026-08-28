/**
 * IMPORT — SRD 5.2.1 creatures, from the official PDF, into the D&D mod's system library.
 *
 * Christopher's pipeline:
 *   Official D&D Beyond SRD 5.2.1 -> one-time parser/importer -> normalized SRD monster records
 *   -> D&D Mod read-only library -> resolved by ID at runtime
 *
 * ⚠ THE PDF IS THE AUTHORITY, AND THE APP NEVER PARSES IT. This runs at DEVELOPMENT time and emits
 * a generated file. Nothing in the shipped bundle reads a PDF, and no third-party document travels
 * with the app.
 *
 * ⚠ AND IT NEVER PARSES THE WORKBOOK EITHER. Christopher: *"the workbook is never moved into the
 * app [...] because the workbook has 3rd party creatures traits and other things we would need
 * licensing and approval to use."* The same rule applies here in reverse: the SRD is licensed
 * content the app may TRANSFORM and redistribute under CC-BY-4.0 with attribution, which the mod
 * carries in `SRD_ATTRIBUTION`. That licence is why this import is allowed at all, and why every
 * record it emits is `system` scope — usable in a fight, never a chassis, never re-exported.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────────────────────
 *   node scripts/import-srd.mjs <SRD_CC_v5.2.1.pdf> <out.ts> [exceptions.json]
 *
 * ── WHY A HAND-ROLLED PDF READER ────────────────────────────────────────────────────────────
 * There is no PDF library in this project and adding one for a one-time development import is a
 * dependency the shipped app would carry forever. Node's own zlib decompresses the content streams;
 * the text operators are simple enough to read directly.
 *
 * ⚠ EXTRACTION IS NOT PERFECT AND THE REPORT SAYS SO. A handful of blocks lose a value to the
 * PDF's text positioning — the Bat's HP is a real example, printed in a run this reader drops. Those
 * are written to the exception report with what IS known, never guessed at and never silently
 * defaulted. Christopher: *"Return NEEDS_INPUT when required information is unavailable — never
 * silently price it as zero."*
 */
import fs from "node:fs";
import zlib from "node:zlib";

const [, , PDF, OUT, EXCEPTIONS] = process.argv;
if (!PDF || !OUT) {
  console.error("usage: node scripts/import-srd.mjs <srd.pdf> <out.ts> [exceptions.json]");
  process.exit(1);
}

/* ── 1. PDF -> text ──────────────────────────────────────────────────────────────────────── */

function pdfText(file) {
  const buf = fs.readFileSync(file);
  const parts = [];
  let i = 0;
  while (true) {
    const s = buf.indexOf("stream", i);
    if (s < 0) break;
    let start = s + 6;
    if (buf[start] === 0x0d) start++;
    if (buf[start] === 0x0a) start++;
    const e = buf.indexOf("endstream", start);
    if (e < 0) break;
    try {
      const out = zlib.inflateSync(buf.subarray(start, e)).toString("latin1");
      if (/(Tj|TJ)/.test(out.slice(0, 4000))) parts.push(out);
    } catch { /* image or non-flate stream */ }
    i = e + 9;
  }

  const ESC = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
  const unesc = s => s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m, g) =>
    ESC[g] ?? (/^[0-7]+$/.test(g) ? String.fromCharCode(parseInt(g, 8)) : g));

  const pages = [];
  for (const c of parts) {
    let out = "";
    for (const m of c.matchAll(/\[((?:[^\[\]\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*Tj|(T\*|TD|Td)/g)) {
      if (m[1] !== undefined) {
        for (const p of m[1].matchAll(/\(((?:[^()\\]|\\.)*)\)|(-?\d+(?:\.\d+)?)/g)) {
          if (p[1] !== undefined) out += unesc(p[1]);
          else if (Number(p[2]) < -140) out += " ";      // a wide kern reads as a space
        }
      } else if (m[2] !== undefined) out += unesc(m[2]);
      else out += "\n";
    }
    if (out.trim()) pages.push(out);
  }
  // Drop control bytes the font encoding leaves behind; keep the printable range plus punctuation.
  return pages.join("\n").replace(
    /[^\x09\x0a\x20-\x7e -ɏ‐-‧‰-⁞]/g, " ");
}

/* ── 2. text -> stat blocks ──────────────────────────────────────────────────────────────── */

const SIZES = "Tiny|Small|Medium|Large|Huge|Gargantuan";
const TYPES = "Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead";

/**
 * The creature name sits immediately before the "Size Type, Alignment" line, with no separator.
 *
 * ⚠ A GROUP HEADING RUNS STRAIGHT INTO IT: "Blue DragonsBlue Dragon Wyrmling". The heading is a
 * plural stem of what follows, which is what makes it separable at all — anything else here would
 * have to guess where a name starts.
 */
function nameBefore(text) {
  let s = text.slice(-90);
  const cut = Math.max(s.lastIndexOf("."), s.lastIndexOf("\n"), s.lastIndexOf(")"), s.lastIndexOf(":"));
  if (cut >= 0) s = s.slice(cut + 1);
  s = s.trim();
  if (!s) return null;
  for (const m of [...s.matchAll(/[a-z](?=[A-Z])/g)].reverse()) {
    const at = m.index + 1;
    const head = s.slice(0, at), tail = s.slice(at);
    if (tail.startsWith(head.replace(/s$/, "")) || head.endsWith("s")) return tail.trim();
  }
  return s;
}

const SECTIONS = ["Traits", "Actions", "Bonus Actions", "Reactions", "Legendary Actions"];

function section(body, label) {
  const i = body.indexOf(label);
  if (i < 0) return "";
  let end = body.length;
  for (const other of SECTIONS) {
    if (other === label) continue;
    const j = body.indexOf(other, i + label.length);
    if (j >= 0 && j < end) end = j;
  }
  return body.slice(i + label.length, end);
}

/**
 * Split a section into named entries: "Bite. Melee Attack Roll: +5 ...".
 *
 * ⚠ "ft." IS NOT THE END OF AN ENTRY, and treating it as one shreds every attack. The Ankheg's
 * Bite reads "... reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage ...", so a naive split on ". " cuts
 * it into an entry named "Melee Attack Roll: +5 (with Advantage if the target is Grappled by the
 * ankheg), reach 5" and loses the damage. Ankheg reported six actions where it has two.
 *
 * Two guards, and both are needed:
 *   1. abbreviations are masked before splitting, so their dots cannot end anything;
 *   2. an entry NAME must look like one — at most five Title-Case words, optionally followed by a
 *      parenthetical like "(Recharge 5-6)". Prose that happens to precede a dot does not qualify.
 */
const ABBREV = /\b(ft|in|lb|sq|hp|dc|cr|pb|vs|etc|approx|Mr|St)\./g;
const DOT = "\u0001";

/**
 * Words that end a SENTENCE inside a rules line and are not the name of anything.
 *
 * ⚠ "5-foot-wide Line." LOOKS EXACTLY LIKE AN ENTRY HEADER. Acid Spray reads "...each creature in a
 * 30-foot-long, 5-foot-wide Line. Failure: 14 (4d6) Acid damage", so "Line" matched as a name and
 * split one action into two — the second of which was the first one's damage.
 *
 * These are the 2024 shape and outcome keywords. None is ever an entry name, so refusing them costs
 * nothing and removes the whole class.
 */
const NOT_A_NAME = new Set([
  "Line", "Cone", "Cube", "Sphere", "Cylinder", "Emanation", "Radius",
  "Failure", "Success", "Hit", "Miss", "Hit or Miss",
  "Melee", "Ranged", "Strength", "Dexterity", "Constitution",
  "Intelligence", "Wisdom", "Charisma",
]);

/**
 * ⚠ THE LAST ENTRY OF A BLOCK RUNS INTO THE NEXT CREATURE. The page footer sits between them —
 * "...Success: Half damage. 260AssassinAssassinMedium or Small Humanoid" — because the next block
 * starts at its SECOND printed name and the first one is left behind on this side of the cut.
 *
 * A page number immediately followed by a capital is that seam, and nothing legitimate looks like
 * it: rules text never runs a bare 2-4 digit number straight into a capitalised word.
 */
function trimBleed(s) {
  return s.replace(/\s*\d{2,4}[A-Z][A-Za-z'’ -]*$/, "").trim();
}

function entries(text) {
  const guarded = text.replace(ABBREV, m => m.slice(0, -1) + DOT);

  // A plausible entry name: 1-5 Title-Case words, an optional "(...)" qualifier, then ". ".
  // ⚠ THE LOOKBEHIND ALLOWS A NAME TO START AFTER A LOWERCASE LETTER, because the section labels
  // run straight into the first entry with no separator: "ActionsBite.", "TraitsTunneler.".
  // Requiring whitespace there found only 193 creatures with actions where 298 have them.
  const NAME = /(?<=^|[\s\n]|[a-z)’])((?:[A-Z][A-Za-z'’\-]*)(?:[ ](?:[A-Z][A-Za-z'’\-]*|of|the|and|or|in|to|with)){0,4}(?:[ ]\([^)]{1,32}\))?)\.\s+(?=[A-Z(])/g;

  const marks = [];
  for (const m of guarded.matchAll(NAME)) {
    const name = m[1].trim();
    if (NOT_A_NAME.has(name)) continue;
    marks.push({ name, from: m.index + m[0].length });
  }
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? guarded.lastIndexOf(marks[i + 1].name, marks[i + 1].from) : guarded.length;
    const body = trimBleed(
      guarded.slice(marks[i].from, end).split(DOT).join(".").replace(/\s+/g, " ").trim());
    if (body.length > 2) out.push({ name: marks[i].name.split(DOT).join("."), text: body });
  }
  return out;
}


const raw = pdfText(PDF);
const HEAD = new RegExp(`((?:${SIZES})(?: or (?:${SIZES}))?) (${TYPES})([^\\n]*)`, "g");

const anchors = [];
for (const m of raw.matchAll(HEAD)) {
  const name = nameBefore(raw.slice(0, m.index));
  if (!name || name.length < 3 || name.length > 42 || !/^[A-Z]/.test(name)) continue;
  anchors.push({ nameAt: m.index, at: m.index - name.length, name, size: m[1], type: m[2], tail: (m[3] || "").trim() });
}
const seen = new Set();
const blocks = anchors.filter(a => {
  const k = a.name.toLowerCase();
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const records = [];
const exceptions = [];

for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  const body = raw.slice(b.nameAt, i + 1 < blocks.length ? blocks[i + 1].at : b.nameAt + 9000);

  const ac = body.match(/\bAC\s*\n?\s*(\d+)/);
  const hp = body.match(/\bHP\s*\n?\s*(\d+)(?:\s*\(([^)]*)\))?/);
  const cr = body.match(/\bCR\s*([\d/]+)\s*\(XP\s*([\d,]+)(?:[^)]*PB\s*\+(\d+))?/);
  const speed = body.match(/\bSpeed\s*\n?\s*([^\n]*)/);
  const senses = body.match(/\bSenses\s*([^\n]*)/);
  const langs = body.match(/\bLanguages\s*([^\n]*)/);

  const missing = [];
  if (!ac) missing.push("AC");
  if (!hp) missing.push("HP");
  if (!cr) missing.push("CR");

  const rec = {
    name: b.name,
    size: b.size,
    creatureType: b.type,
    alignment: (b.tail.match(/,\s*(.+)$/) || [])[1]?.trim() ?? null,
    ac: ac ? Number(ac[1]) : null,
    hp: hp ? Number(hp[1]) : null,
    hpFormula: hp && hp[2] ? hp[2].replace(/\s+/g, " ").trim() : null,
    speed: speed ? speed[1].replace(/\s+/g, " ").trim() : null,
    cr: cr ? cr[1] : null,
    xp: cr ? Number(cr[2].replace(/,/g, "")) : null,
    proficiencyBonus: cr && cr[3] ? Number(cr[3]) : null,
    senses: senses ? senses[1].replace(/\s+/g, " ").trim() : null,
    languages: langs ? langs[1].replace(/\s+/g, " ").trim() : null,
    traits: entries(section(body, "Traits")),
    actions: entries(section(body, "Actions")),
    bonusActions: entries(section(body, "Bonus Actions")),
    reactions: entries(section(body, "Reactions")),
    legendaryActions: entries(section(body, "Legendary Actions")),
  };

  if (missing.length) {
    // ⚠ REPORTED, NOT DROPPED AND NOT GUESSED. A record with a hole is still evidence.
    exceptions.push({ name: rec.name, missing, reason: "value not recoverable from the PDF text layer" });
  }
  records.push(rec);
}

/* ── 3. emit ─────────────────────────────────────────────────────────────────────────────── */

const complete = records.filter(r => r.ac !== null && r.hp !== null && r.cr !== null);

const out = `/**
 * SRD 5.2.1 CREATURES — generated. Do not hand-edit.
 *
 * ⚠ GENERATED by \`scripts/import-srd.mjs\` from the official SRD 5.2.1 PDF. The PDF is the
 * authority and is never shipped or parsed at runtime; this file is the transformed result, which
 * CC-BY-4.0 permits provided the attribution in \`srdContent.ts\` travels with it.
 *
 * ⚠ EVERY RECORD IS \`system\` SCOPE. Usable in an encounter; never a chassis, never saved into a
 * personal library, never carried in an export. See \`core/content/contentScope.ts\` for why that is
 * enforced in the data model rather than by hiding buttons.
 *
 * Parsed ${records.length} blocks · ${complete.length} complete · ${exceptions.length} with a missing value.
 */

import type { ContentProvenance } from "../../core/content/contentScope";
import { SRD_PROVENANCE, srdId } from "./srdContent";

export type SrdEntry = { name: string; text: string };

export type SrdCreature = {
  id: string;
  name: string;
  size: string;
  creatureType: string;
  alignment: string | null;
  ac: number | null;
  hp: number | null;
  hpFormula: string | null;
  speed: string | null;
  cr: string | null;
  xp: number | null;
  proficiencyBonus: number | null;
  senses: string | null;
  languages: string | null;
  traits: SrdEntry[];
  actions: SrdEntry[];
  bonusActions: SrdEntry[];
  reactions: SrdEntry[];
  legendaryActions: SrdEntry[];
  /** Fields the PDF text layer did not yield. Non-empty means NEEDS_INPUT, never a zero. */
  missing: string[];
  provenance: ContentProvenance;
};

const RAW = ${JSON.stringify(records.map(r => ({ ...r, missing: exceptions.find(e => e.name === r.name)?.missing ?? [] })), null, 1)} as const;

/**
 * ⚠ ONE SHARED FROZEN PROVENANCE. Every record points at the same object, so there is exactly one
 * place the answer can be wrong and no way for a single creature to drift into being authorable.
 */
export const SRD_CREATURES: SrdCreature[] = RAW.map(r => ({
  ...(r as unknown as Omit<SrdCreature, "id" | "provenance">),
  id: srdId(r.name),
  provenance: SRD_PROVENANCE,
}));

export const SRD_BY_ID = new Map(SRD_CREATURES.map(c => [c.id, c]));

/** Records the importer could not fully read. Surfaced, never silently defaulted. */
export const SRD_NEEDS_INPUT: SrdCreature[] = SRD_CREATURES.filter(c => c.missing.length > 0);
`;

fs.writeFileSync(OUT, out);
if (EXCEPTIONS) fs.writeFileSync(EXCEPTIONS, JSON.stringify(exceptions, null, 2));

console.log(`SRD creatures parsed:      ${records.length}`);
console.log(`  complete:                ${complete.length}`);
console.log(`  missing a value:         ${exceptions.length}`);
console.log(`  with actions:            ${records.filter(r => r.actions.length > 0).length}`);
console.log(`  with legendary actions:  ${records.filter(r => r.legendaryActions.length > 0).length}`);
if (exceptions.length) {
  console.log("\nNEEDS_INPUT:");
  for (const e of exceptions) console.log(`  ${e.name.padEnd(28)} missing ${e.missing.join(", ")}`);
}
