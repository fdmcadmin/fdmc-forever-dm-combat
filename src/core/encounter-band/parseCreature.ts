/**
 * parseCreature — v3 App Contract row 10 (REQUIRED).
 *
 *   creature_input  "Read each entered creature's sections, features, action text, damage,
 *                    attack bonus, save DC, targets, recharge, uses, slot pool, and timing
 *                    into normalized features."
 *
 * The parser's own rules, from the compact import:
 *   source_of_truth     "Entered action text and numeric fields; do not use CR-band damage
 *                        for identified actions."
 *   action_type_source  "section heading"
 *   unknown_policy      "NEEDS DM INPUT or ESTIMATED with trace; never silently use a lower
 *                        spell tier or CR band."
 *
 * ⚠ ACTIVATION TYPE COMES FROM THE SECTION, NEVER FROM THE WORD "RECHARGE". Recharge controls
 * availability only — it never turns a Bonus Action into an Action. That distinction is the
 * one the contract repeats most often, because getting it wrong silently inflates a creature's
 * action budget.
 *
 * The workbook is the law here: a well-formed 5e stat block should parse completely. An
 * assumption coming out of this file means the block is written wrong or the mechanic is
 * inferred rather than printed — not that the checker is guessing.
 */

import type { MainMonsterTemplate } from "../monsters/runtime/mainMonsterRuntime";
import type { ParsedFeature, FeatureAssumption } from "./featureResolver";
import { spellProfile } from "./compactImport";

export type ActivationType = NonNullable<ParsedFeature["activationType"]>;

export type ParsedCreature = {
  name: string;
  ac: number | undefined;
  maxHp: number;
  /** Size of the routine Action budget — how many attacks a Multiattack makes. */
  attacksPerTurn: number;
  features: ParsedFeature[];
  assumptions: FeatureAssumption[];
};

/** "DC 17 Wisdom saving throw" / "WIS DC 17" / "DC 14 STR save" → 17. */
export function parseSaveDc(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.match(/DC\s*(\d+)/i);
  return m ? Number.parseInt(m[1], 10) : undefined;
}

/** "1d20 + 7" → 7. The printed attack bonus, never derived from ability scores. */
export function parseAttackBonus(roll: string | undefined): number | undefined {
  if (!roll) return undefined;
  const m = roll.match(/([+-])\s*(\d+)\s*$/);
  return m ? (m[1] === "-" ? -1 : 1) * Number.parseInt(m[2], 10) : undefined;
}

/**
 * Target count from the printed wording. Only counts what the text actually says — an area
 * effect with no stated target count is left undefined so the resolver can flag it, because
 * the catalog's two-target figure is a four-PC benchmark and not a default.
 */
export function parseTargets(text: string | undefined): number | undefined {
  if (!text) return undefined;
  if (/\bone (?:target|creature)\b/i.test(text)) return 1;
  if (/\btwo (?:targets|creatures)\b/i.test(text)) return 2;
  if (/\bthree (?:targets|creatures)\b/i.test(text)) return 3;
  const n = text.match(/\bup to (\w+) creatures\b/i);
  if (n) {
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    return words[n[1].toLowerCase()] ?? (Number.parseInt(n[1], 10) || undefined);
  }
  return undefined;
}

/** "Recharge 5-6" / "Recharge 6" → the printed range. Availability ONLY. */
export function parseRecharge(field: string | undefined, name: string | undefined): string | undefined {
  if (field) return field;
  const m = (name ?? "").match(/recharge\s*(\d\s*[-–]\s*\d|\d)/i);
  return m ? m[1].replace(/\s|–/g, m[1].includes("-") || m[1].includes("–") ? "-" : "") : undefined;
}

/** "(1/Day)" / "2/Day" / "Usable twice" → the number of uses. */
export function parseUses(name: string | undefined, text: string | undefined): number | undefined {
  const src = `${name ?? ""} ${text ?? ""}`;
  const perDay = src.match(/(\d+)\s*\/\s*day/i);
  if (perDay) return Number.parseInt(perDay[1], 10);
  if (/\bonce per (?:fight|day|combat)\b/i.test(src)) return 1;
  const twice = src.match(/\b(?:usable )?twice\b/i);
  if (twice) return 2;
  return undefined;
}

/**
 * ACTIVATION TYPE FROM THE SECTION, with the name only as a fallback for blocks that mark it
 * inline ("Drive the Pack (Bonus Action)") — which is how these stat blocks are authored.
 * The word "Recharge" is deliberately never consulted.
 */
export function parseActivationType(
  section: "traits" | "actions" | "reactions" | "legendary" | "lair",
  name: string | undefined,
): ActivationType {
  if (section === "traits") return "trait";
  if (section === "reactions") return "reaction";
  if (section === "legendary") return "legendary_action";
  if (section === "lair") return "lair_action";
  const n = name ?? "";
  if (/\(\s*bonus action/i.test(n)) return "bonus_action";
  if (/\(\s*reaction/i.test(n)) return "reaction";
  if (/legendary action/i.test(n)) return "legendary_action";
  if (/lair action/i.test(n)) return "lair_action";
  return "action";
}

/** A recognised spell named by the feature, so the resolver can price an abbreviated one. */
export function detectSpell(name: string | undefined, text: string | undefined): string | undefined {
  for (const candidate of [name, text]) {
    if (!candidate) continue;
    // Prefer an explicit "casts X" / "(X)" mention, then the bare feature name.
    const cast = candidate.match(/\bcasts?\s+([A-Z][A-Za-z' ]+)/);
    if (cast && spellProfile(cast[1])) return cast[1].trim();
    const paren = candidate.match(/\(([^)]+)\)/);
    if (paren && spellProfile(paren[1])) return paren[1].trim();
  }
  if (name && spellProfile(name.replace(/\s*\(.*$/, ""))) return name.replace(/\s*\(.*$/, "").trim();
  return undefined;
}

type RawAction = {
  name?: string; kind?: string; roll?: string; damage?: string; save?: string;
  text?: string; recharge?: string; attackCount?: number; spellSlotLevel?: number;
  legendaryCost?: number; economyCost?: string; gated?: boolean;
};

function parseSection(
  entries: readonly RawAction[] | undefined,
  section: "traits" | "actions" | "reactions" | "legendary" | "lair",
  creature: string,
  assumptions: FeatureAssumption[],
): ParsedFeature[] {
  const out: ParsedFeature[] = [];
  for (const a of entries ?? []) {
    if (!a) continue;
    const name = a.name ?? "unnamed";
    const activationType = a.economyCost === "bonus"
      ? "bonus_action"
      : a.legendaryCost !== undefined
        ? "legendary_action"
        : parseActivationType(section, name);

    const feature: ParsedFeature = {
      name,
      activationType,
      damage: a.damage,
      attackBonus: parseAttackBonus(a.roll),
      saveDc: parseSaveDc(a.save ?? a.text),
      targets: parseTargets(a.text),
      recharge: parseRecharge(a.recharge, name),
      uses: parseUses(name, a.text),
      spellSlotLevel: a.spellSlotLevel,
      spellName: detectSpell(name, a.text),
      gated: a.gated,
      text: a.text,
    };

    // A save-based feature with no readable DC is a real gap, not a default.
    if (!feature.attackBonus && !feature.saveDc && feature.damage) {
      assumptions.push({
        feature: name, flag: "ESTIMATED", field: "action_cost",
        detail: `"${name}" has damage but neither an attack bonus nor a save DC, so it is treated as automatic.`,
      });
    }
    if (a.gated) {
      assumptions.push({
        feature: name, flag: "ESTIMATED", field: "timing",
        detail: `"${name}" is authored as unavailable under this encounter's conditions and is not counted.`,
      });
    }
    out.push(feature);
  }
  return out;
}

/**
 * Normalise an entered creature into features the resolver and the trace can consume.
 *
 * Traits are parsed too — a trait can carry a damaging rider, and the contract's effect
 * families explicitly include auras, retaliation and death bursts, which live in that section.
 */
export function parseCreature(template: MainMonsterTemplate): ParsedCreature {
  const assumptions: FeatureAssumption[] = [];
  const name = template.name;
  const acRaw = typeof template.stats.ac === "number"
    ? template.stats.ac
    : Number.parseInt(String(template.stats.ac), 10);
  const ac = Number.isFinite(acRaw) ? acRaw : undefined;
  if (ac === undefined) {
    assumptions.push({ feature: name, flag: "NEEDS DM INPUT", field: "action_cost",
      detail: "No readable AC on this creature." });
  }

  const t = template as MainMonsterTemplate & {
    reactions?: RawAction[]; legendaryActions?: RawAction[]; lairActions?: RawAction[];
  };

  const features = [
    ...parseSection(template.traits as RawAction[] | undefined, "traits", name, assumptions),
    ...parseSection(template.actions as RawAction[] | undefined, "actions", name, assumptions),
    ...parseSection(t.reactions, "reactions", name, assumptions),
    ...parseSection(t.legendaryActions, "legendary", name, assumptions),
    ...parseSection(t.lairActions, "lair", name, assumptions),
  ];

  const attacksPerTurn = template.stats.attacksPerTurn ?? 1;
  if (!template.stats.attacksPerTurn && features.some(f => f.activationType === "action" && f.attackBonus !== undefined)) {
    assumptions.push({ feature: name, flag: "ESTIMATED", field: "action_cost",
      detail: "No Multiattack size printed, so the Action budget is one attack per turn." });
  }

  return { name, ac, maxHp: template.stats.maxHp, attacksPerTurn, features, assumptions };
}
