/**
 * SRD CREATURE → the template every panel already speaks.
 *
 * The Encounter Builder and the Estimator were never missing. They resolve creatures through
 * `resolveMonsterLibrary`, which composed exactly TWO sources — the bundled campaign library and
 * the DM's own stored one — so an SRD creature could not appear anywhere. One resolver is why the
 * gap was total, and why closing it is one adapter and one source rather than five new screens.
 *
 * ⚠ SYSTEM SCOPE TRAVELS WITH THE RECORD. Every template this produces carries the SRD provenance,
 * so `chassisSources`, `loadChassis` and `exportableRecords` keep refusing it exactly as they do
 * today — the restriction lives in the DATA MODEL, per the design, not in whether a button is
 * rendered. Wiring the source is what finally makes those refusals TESTED rather than vacuous:
 * until now they passed because nothing ever asked.
 *
 * ⚠ AND IT PARSES ONCE, THROUGH THE SHARED GRAMMAR. `statBlockGrammar` is the single reader for
 * 2024 phrasing; the campaign is authored in the same fields it produces. Nothing here invents a
 * second dialect.
 */

import type { MainMonsterTemplate } from "../../core/monsters/runtime/mainMonsterRuntime";
import type { MonsterReaderAction } from "../../core/monsters/MonsterJconScanner";
import type { SrdLibraryEntry } from "./srdLibrary";
import { SRD_USABLE } from "./srdLibrary";
import { parseStatBlockClause, cleanStatBlockText } from "./statBlockGrammar";
import type { MonsterKind } from "../../core/monsters/runtime/mainMonsterRuntime";

/** The SRD prints its type as prose ("Dragon (Chromatic)"); the engine holds a fixed vocabulary. */
const KINDS: MonsterKind[] = ["aberration", "beast", "celestial", "construct", "dragon", "elemental",
  "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"];
function toKind(creatureType: string): MonsterKind {
  const head = (creatureType || "").toLowerCase();
  return KINDS.find(k => head.startsWith(k)) ?? "unspecified";
}

/** CR as printed — "1/8", "0", "21" — to the number the estimator bands on. */
function crToNumber(cr: string | null): number | undefined {
  if (!cr) return undefined;
  const frac = cr.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(cr);
  return Number.isFinite(n) ? n : undefined;
}

function toAction(entry: { name: string; text: string }, kind: MonsterReaderAction["kind"]): MonsterReaderAction {
  const parsed = parseStatBlockClause(entry.text);
  return {
    name: cleanStatBlockText(entry.name),
    kind: parsed.roll ? "attack" : kind,
    ...(parsed.roll ? { roll: parsed.roll } : {}),
    ...(parsed.damage ? { damage: parsed.damage } : {}),
    ...(parsed.damageType ? { damageType: parsed.damageType } : {}),
    ...(parsed.save ? { save: parsed.save } : {}),
    ...(parsed.range ? { range: parsed.range } : {}),
    // ⚠ THE RIDER ONLY. The numbers are fields now, so the sentence never repeats them.
    ...(parsed.text ? { text: parsed.text } : {}),
  };
}

/**
 * ⚠ A CREATURE WITH NO ACTIONS IS NOT OFFERED. It would price at ZERO DPR, and a zero that looks
 * like an answer is worse than an absence. Five SRD blocks parse without actions; they stay out.
 */
export function srdToTemplate(c: SrdLibraryEntry): MainMonsterTemplate | null {
  const actions = (c.actions ?? []).map(a => toAction(a, "action"));
  if (actions.length === 0) return null;

  const hp = c.hp ?? 0;
  const ac = c.ac ?? 0;
  if (hp <= 0 || ac <= 0) return null;

  return {
    templateId: c.id,
    name: c.name,
    stats: {
      kind: toKind(c.creatureType),
      maxHp: hp,
      ac,
      speed: c.speed ? cleanStatBlockText(c.speed) : "30 ft.",
      cr: crToNumber(c.cr),
      size: c.size,
    },
    abilities: [],
    traits: (c.traits ?? []).map(t => toAction(t, "trait")),
    actions,
    reactions: (c.reactions ?? []).map(r => toAction(r, "reaction")),
    resources: [],
    notes: [
      c.chassis ? `SRD 5.2.1, printed page ${c.chassis.page}.` : "SRD 5.2.1.",
      ...(c.senses ? [`Senses: ${cleanStatBlockText(c.senses)}`] : []),
      ...(c.languages ? [`Languages: ${cleanStatBlockText(c.languages)}`] : []),
    ],
    provenance: c.provenance,
    // Reference content is never hidden from its own DM — an SRD creature has no reveal arc.
    visibility: { defaultState: "full" as const, hiddenName: c.name, revealedName: c.name },
  } as MainMonsterTemplate;
}

/**
 * Every SRD creature fit to put in a fight.
 *
 * Computed once — 330-odd records parsed per keystroke in a search box is the kind of cost that
 * gets a feature blamed for being slow when the work was never needed twice.
 */
export const SRD_TEMPLATES: MainMonsterTemplate[] = (() => {
  const out: MainMonsterTemplate[] = [];
  for (const c of SRD_USABLE) {
    const t = srdToTemplate(c);
    if (t) out.push(t);
  }
  return out;
})();
