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

  /**
   * ⚠ THE TEXT IS WINDOWS-1252, NOT LATIN-1, AND THE DIFFERENCE IS ONE RANGE.
   *
   * Decoding the stream as latin1 leaves 0x80-0x9F as C1 control characters. In CP1252 that range
   * holds the typographic punctuation — curly quotes, en/em dashes, the ellipsis — so an apostrophe
   * came out as char 146 rather than "'".
   *
   * It cost a creature: the Will-o'-Wisp's name in the PDF is "Will-o\x92-Wisp", so searching for
   * the printed spelling found nothing, and the block was reported missing. Nothing was wrong with
   * the PDF or the search — one byte range was being read as the wrong character set.
   *
   * Mapping it here fixes every extracted string at once: names, trait text and action prose.
   */
  const CP1252 = {
    0x80: "\u20ac", 0x82: "\u201a", 0x83: "\u0192", 0x84: "\u201e", 0x85: "\u2026",
    0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02c6", 0x89: "\u2030", 0x8a: "\u0160",
    0x8b: "\u2039", 0x8c: "\u0152", 0x8e: "\u017d", 0x91: "\u2018", 0x92: "\u2019",
    0x93: "\u201c", 0x94: "\u201d", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
    0x98: "\u02dc", 0x99: "\u2122", 0x9a: "\u0161", 0x9b: "\u203a", 0x9c: "\u0153",
    0x9e: "\u017e", 0x9f: "\u0178",
  };
  const dec1252 = s => s.replace(/[\u0080-\u009f]/g, c => CP1252[c.charCodeAt(0)] ?? c);
  for (let p = 0; p < pages.length; p++) pages[p] = dec1252(pages[p]);
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
const HEAD_ONE = new RegExp(`((?:${SIZES})(?: or (?:${SIZES}))?)\\s*(${TYPES})([^\\n]*)`);
const HEAD = new RegExp(`((?:${SIZES})(?: or (?:${SIZES}))?) (${TYPES})([^\\n]*)`, "g");

/* ── 2. ANCHOR ON KNOWN NAMES, NOT ON LAYOUT ─────────────────────────────────────────────────
 *
 * ⚠ THE OLD PASS GUESSED THE NAME FROM WHATEVER PRECEDED THE SIZE LINE, AND DROPPED IT SILENTLY
 * WHEN THE GUESS LOOKED WRONG (`continue`, no exception). It cost 33 creatures — Aboleth, Kraken,
 * Treant, Unicorn, Djinni, every swarm — and reported 301 of 330 as a success.
 *
 * Two things defeated it, both of them ordinary SRD typesetting:
 *
 *   · A SWARM'S SIZE LINE CONTAINS THE WORD "of". "Swarm of Crawling Claws" is followed by
 *     "Medium Swarm of Tiny Undead", so the size/type regex matched INSIDE the size line and the
 *     name was read as "Medium Swarm of".
 *   · A GROUP HEADING RUNS INTO THE NAME. "Fungi" + "Shrieker Fungus" = "FungiShrieker Fungus".
 *
 * The audit knows all 330 names. So the parser is handed them and only has to LOCATE each one,
 * which is a far smaller problem than inferring where a name starts. A name is accepted as an
 * anchor only when a size line follows it immediately — that is what separates the stat block from
 * the same name mentioned in another creature's prose.
 */
const AUDIT_TS = new URL("../src/modules/dnd-5e/srdAuditChassis.generated.ts", import.meta.url);
const auditSrc = fs.readFileSync(AUDIT_TS, "utf8");
const auditJson = auditSrc.slice(
  auditSrc.indexOf("SRD_AUDIT_CHASSIS: SrdAuditChassis[] = ") + "SRD_AUDIT_CHASSIS: SrdAuditChassis[] = ".length,
  auditSrc.indexOf("] as SrdAuditChassis[]") >= 0
    ? auditSrc.indexOf("] as SrdAuditChassis[]") + 1
    : auditSrc.indexOf("];", auditSrc.indexOf("SRD_AUDIT_CHASSIS")) + 1);
const AUDIT = JSON.parse(auditJson);

/**
 * Blocks the audit does not list because they are not on the monster pages: three bodies a SPELL
 * creates, one form of the Giant Insect summon, and the Deck of Many Things' Avatar of Death.
 * Named here so their absence from the chassis map is a fact rather than a hole.
 */
const OFF_PAGE = ["Otherworldly Steed", "Giant Insect", "Draconic Spirit", "Giant Fly", "Avatar of Death"];

const esc = s => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/**
 * ⚠ TWO THINGS SIT BETWEEN A NAME AND ITS SIZE LINE, AND NEITHER IS A REASON TO GIVE UP.
 *
 *   · THE NAME IS OFTEN PRINTED TWICE — a running header and the block title land next to each
 *     other in the text layer: "Gray OozeGray\n OozeMedium Ooze, Unaligned",
 *     "Will-o-WispWill-o-WispTiny Undead". A strict "size follows the name" test rejects both.
 *   · THE TEXT LAYER DROPS THE APOSTROPHE. The audit says "Will-o'-Wisp"; the PDF says
 *     "Will-o-Wisp". Searching for the audited spelling finds nothing.
 *
 * So the lookahead allows ONE optional repeat of the name, and the needle is tried in a few
 * punctuation variants. These two alone were the last two missing creatures.
 */
function needleVariants(name) {
  const out = [name];
  const noApos = name.replace(/[’‘ʼ']/g, "");
  const plain = name.replace(/[’‘ʼ]/g, "'");
  if (noApos !== name) out.push(noApos);
  if (plain !== name && !out.includes(plain)) out.push(plain);
  return out;
}

/** Every position where this name is followed by its size line, allowing a repeated header. */
function anchorsFor(name) {
  for (const needle of needleVariants(name)) {
    // The repeat may carry line breaks inside it: "Gray\n Ooze".
    const repeat = esc(needle).replace(/\\?\s/g, "\\s*");
    const after = new RegExp(`^(?:\\s*${repeat})?\\s*(?:${SIZES})\\b`);
    const hits = [];
    let from = 0;
    for (;;) {
      const at = raw.indexOf(needle, from);
      if (at < 0) break;
      from = at + 1;
      if (after.test(raw.slice(at + needle.length, at + needle.length + 120))) hits.push({ at, len: needle.length });
    }
    if (hits.length) return hits;
  }
  return [];
}

const TARGETS = [...AUDIT, ...OFF_PAGE.map(name => ({ name }))];

/**
 * ⚠ A SHORT NAME LIVES INSIDE A LONGER ONE, AND THAT IS NOT AN ANCHOR.
 *
 * "Rat" occurs inside "Giant Rat" — and because the size line follows the LONGER name, the short
 * name passes the size-line test too, six characters further on. Sorting by position then put "Rat"
 * immediately after "Giant Rat", so the Giant Rat's body was six characters long and it lost AC, HP
 * and CR. The same collision hits Hawk/Blood Hawk, Wolf/Winter Wolf, Spider/Phase Spider and every
 * "Giant <animal>" in the book.
 *
 * So candidates are gathered for EVERY name first, and any hit sitting inside a LONGER name's span
 * is discarded. The real "Rat" block elsewhere in the PDF is untouched — only the one hiding inside
 * its bigger cousin goes.
 */
const candidates = [];
for (const row of TARGETS) {
  for (const h of anchorsFor(row.name)) candidates.push({ row, name: row.name, at: h.at, len: h.len });
}

const swallowed = new Set();
for (const a of candidates) {
  for (const b of candidates) {
    if (a === b || b.len <= a.len) continue;
    if (a.at > b.at && a.at < b.at + b.len) { swallowed.add(a); break; }
  }
}
const surviving = candidates.filter(c => !swallowed.has(c));

const missingBlocks = [];
const chosen = [];
for (const row of TARGETS) {
  const hits = surviving.filter(c => c.row === row).map(c => c.at);
  if (hits.length === 0) {
    // ⚠ REPORTED, NEVER SKIPPED. This is exactly the line the old parser did not have.
    missingBlocks.push({ name: row.name, reason: "no stat-block anchor found in the PDF text layer" });
    continue;
  }
  // More than one occurrence is settled by the audit's own numbers: the real block has them nearby.
  let best = hits[0];
  if (hits.length > 1 && row.ac) {
    const scored = hits.map(at => {
      const win = raw.slice(at, at + 2600);
      return { at, score: (win.includes(`AC ${row.ac}`) ? 2 : 0) + (win.includes(`HP ${row.hp}`) ? 2 : 0) };
    }).sort((a, b) => b.score - a.score);
    best = scored[0].at;
  }
  chosen.push({ name: row.name, at: best });
}

chosen.sort((a, b) => a.at - b.at);

// A body runs from its own name to the next block's name.
const blocks = chosen.map((c, i) => {
  const head = raw.slice(c.at, c.at + 260).match(HEAD_ONE);
  return {
    name: c.name,
    nameAt: c.at,
    at: c.at,
    end: i + 1 < chosen.length ? chosen[i + 1].at : c.at + 9000,
    size: head ? head[1] : null,
    type: head ? head[2] : null,
    tail: head ? (head[3] || "").trim() : "",
  };
});

const records = [];
const exceptions = [];

for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  const body = raw.slice(b.nameAt, b.end);

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

// ⚠ A BLOCK THE PARSER COULD NOT LOCATE IS A LOUDER FAILURE THAN ONE WITH A HOLE IN IT.
for (const m of missingBlocks) exceptions.push({ name: m.name, missing: ["BLOCK"], reason: m.reason });

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
