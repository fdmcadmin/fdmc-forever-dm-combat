import { safeStorage } from "../utils/safeStorage";
/**
 * GM settings — the table's own choices, kept apart from campaign data.
 *
 * The ruleset is here because FDMC is a run-anything engine: the D&D pieces (ability
 * modifier, proficiency bonus, feats as a concept, the 2024 weapon and mastery tables) are a
 * MODULE, not the system. Today that module is the only one, so the choice has one option —
 * but it is a real stored choice rather than an assumption, which is what makes a second
 * ruleset an addition instead of an excavation.
 *
 * See `core/rules/dnd5e.ts` for the arithmetic this selects.
 */

export type RulesetId = "dnd-5e-2024";

export type RulesetOption = {
  id: RulesetId;
  label: string;
  blurb: string;
  /** False once a ruleset is real but not finished — keeps a half-built option unpickable. */
  available: boolean;
};

export const RULESET_OPTIONS: RulesetOption[] = [
  {
    id: "dnd-5e-2024",
    label: "D&D 5e / 5.5e (2024)",
    blurb: "Ability modifier from score, proficiency bonus by level, feats, the 2024 weapon and mastery tables.",
    available: true,
  },
];

export type GmSettings = {
  ruleset: RulesetId;
};

const SETTINGS_KEY = "fdmc.gm.settings.v1";
const DEFAULTS: GmSettings = { ruleset: "dnd-5e-2024" };

export function loadGmSettings(): GmSettings {
  try {
    const raw = safeStorage().getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<GmSettings>;
    const known = RULESET_OPTIONS.some(o => o.id === parsed.ruleset && o.available);
    return { ruleset: known ? parsed.ruleset as RulesetId : DEFAULTS.ruleset };
  } catch { return DEFAULTS; }
}

export function saveGmSettings(settings: GmSettings): void {
  try { safeStorage().setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* quota */ }
}
