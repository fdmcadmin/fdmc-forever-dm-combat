/**
 * PARTY DEFENCE CURVE — the target profile an encounter is priced against.
 *
 * Source: `encounter_checker_runtime_package_v7_pricing_ac_save.json` → `party_defense_curve`
 * (sha256 64a02109…), transcribed verbatim. LAYER: D&D MOD under RULE THREE — these are 5e party
 * numbers, not engine facts.
 *
 * ⚠ THIS REPLACES A DM-TYPED AC AND ONE FLAT SAVE BONUS. The checker used to ask for both, on the
 * stated grounds that the workbook published the hit and save FORMULAS but no party table. v7
 * publishes the table, so it is now read rather than requested — RULE ONE. The DM inputs stay as
 * an OVERRIDE, because a real table is not the average table.
 *
 * ⚠ SIX SAVES, NOT ONE. The bundle's targeting rule is explicit: *"saving_throw: Use the matching
 * ability save average."* A single flat bonus prices an INT save exactly like a DEX save, and at
 * level 7 those differ by 0.8 — INT is the party's weakest and DEX its strongest. Every INT-save
 * burst in the campaign was under-priced and every DEX-save burst over-priced.
 *
 * ⚠ STATUS IS PROVISIONAL, and the bundle says so on its face:
 * `PROVISIONAL_UNTIL_RUN_MODELS_SOURCE_ROWS_AVAILABLE`. v7 carries aggregated DPR/sustain curves
 * but NOT the individual 128-party AC/save rows, so these are a standard-progression proxy plus a
 * conservative Broken Chain unconditional-AC overlay. When Run Models A45:BD2092 is supplied,
 * replace the rows below and nothing downstream changes.
 *
 * ⚠ CONDITIONAL DEFENCE IS NOT IN HERE. Shield, cover, rerolls, resistance, condition-specific
 * advantage and Convergence defences are priced PER EVENT. Only UNCONDITIONAL AC belongs in an
 * average line — putting a conditional one here counts the same effect twice.
 */

export type SaveAbility = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type PartyDefenceRow = {
  level: number;
  /** Average party AC. Used for every attack roll unless a target profile is explicitly named. */
  ac: number;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
};

/** No assumed magic items — the generic progression. */
const WOTC_STANDARD: PartyDefenceRow[] = [
  { level: 1, ac: 15.2, str: 1.7, dex: 2.0, con: 2.0, int: 1.2, wis: 1.8, cha: 1.3 },
  { level: 2, ac: 15.4, str: 1.82, dex: 2.12, con: 2.15, int: 1.32, wis: 1.93, cha: 1.43 },
  { level: 3, ac: 15.6, str: 1.95, dex: 2.25, con: 2.3, int: 1.45, wis: 2.05, cha: 1.55 },
  { level: 4, ac: 15.8, str: 2.08, dex: 2.38, con: 2.45, int: 1.57, wis: 2.17, cha: 1.68 },
  { level: 5, ac: 16.0, str: 2.2, dex: 2.5, con: 2.6, int: 1.7, wis: 2.3, cha: 1.8 },
  { level: 6, ac: 16.1, str: 2.35, dex: 2.65, con: 2.75, int: 1.85, wis: 2.45, cha: 1.95 },
  { level: 7, ac: 16.2, str: 2.5, dex: 2.8, con: 2.9, int: 2.0, wis: 2.6, cha: 2.1 },
  { level: 8, ac: 16.3, str: 2.65, dex: 2.95, con: 3.05, int: 2.15, wis: 2.75, cha: 2.25 },
  { level: 9, ac: 16.4, str: 2.8, dex: 3.1, con: 3.2, int: 2.3, wis: 2.9, cha: 2.4 },
  { level: 10, ac: 16.5, str: 2.95, dex: 3.25, con: 3.35, int: 2.45, wis: 3.05, cha: 2.55 },
  { level: 11, ac: 16.6, str: 3.1, dex: 3.4, con: 3.5, int: 2.6, wis: 3.2, cha: 2.7 },
  { level: 12, ac: 16.7, str: 3.25, dex: 3.55, con: 3.65, int: 2.75, wis: 3.35, cha: 2.85 },
  { level: 13, ac: 16.8, str: 3.4, dex: 3.7, con: 3.8, int: 2.9, wis: 3.5, cha: 3.0 },
  { level: 14, ac: 16.9, str: 3.55, dex: 3.85, con: 3.95, int: 3.05, wis: 3.65, cha: 3.15 },
  { level: 15, ac: 17.0, str: 3.7, dex: 4.0, con: 4.1, int: 3.2, wis: 3.8, cha: 3.3 },
  { level: 16, ac: 17.1, str: 3.85, dex: 4.15, con: 4.25, int: 3.35, wis: 3.95, cha: 3.45 },
  { level: 17, ac: 17.2, str: 4.0, dex: 4.3, con: 4.4, int: 3.5, wis: 4.1, cha: 3.6 },
  { level: 18, ac: 17.3, str: 4.13, dex: 4.43, con: 4.53, int: 3.63, wis: 4.23, cha: 3.73 },
  { level: 19, ac: 17.4, str: 4.27, dex: 4.57, con: 4.67, int: 3.77, wis: 4.37, cha: 3.87 },
  { level: 20, ac: 17.5, str: 4.4, dex: 4.7, con: 4.8, int: 3.9, wis: 4.5, cha: 4.0 },
];

/**
 * The same party field plus the campaign's authored UNCONDITIONAL AC overlay by checkpoint.
 * The saves are identical — the campaign's loot moves AC, not save bonuses.
 */
const BROKEN_CHAIN: PartyDefenceRow[] = [
  { level: 1, ac: 15.2, str: 1.7, dex: 2.0, con: 2.0, int: 1.2, wis: 1.8, cha: 1.3 },
  { level: 2, ac: 15.4, str: 1.82, dex: 2.12, con: 2.15, int: 1.32, wis: 1.93, cha: 1.43 },
  { level: 3, ac: 15.65, str: 1.95, dex: 2.25, con: 2.3, int: 1.45, wis: 2.05, cha: 1.55 },
  { level: 4, ac: 15.85, str: 2.08, dex: 2.38, con: 2.45, int: 1.57, wis: 2.17, cha: 1.68 },
  { level: 5, ac: 16.1, str: 2.2, dex: 2.5, con: 2.6, int: 1.7, wis: 2.3, cha: 1.8 },
  { level: 6, ac: 16.25, str: 2.35, dex: 2.65, con: 2.75, int: 1.85, wis: 2.45, cha: 1.95 },
  { level: 7, ac: 16.35, str: 2.5, dex: 2.8, con: 2.9, int: 2.0, wis: 2.6, cha: 2.1 },
  { level: 8, ac: 16.5, str: 2.65, dex: 2.95, con: 3.05, int: 2.15, wis: 2.75, cha: 2.25 },
  { level: 9, ac: 16.65, str: 2.8, dex: 3.1, con: 3.2, int: 2.3, wis: 2.9, cha: 2.4 },
  { level: 10, ac: 16.75, str: 2.95, dex: 3.25, con: 3.35, int: 2.45, wis: 3.05, cha: 2.55 },
  { level: 11, ac: 16.85, str: 3.1, dex: 3.4, con: 3.5, int: 2.6, wis: 3.2, cha: 2.7 },
  { level: 12, ac: 16.95, str: 3.25, dex: 3.55, con: 3.65, int: 2.75, wis: 3.35, cha: 2.85 },
  { level: 13, ac: 17.1, str: 3.4, dex: 3.7, con: 3.8, int: 2.9, wis: 3.5, cha: 3.0 },
  { level: 14, ac: 17.2, str: 3.55, dex: 3.85, con: 3.95, int: 3.05, wis: 3.65, cha: 3.15 },
  { level: 15, ac: 17.3, str: 3.7, dex: 4.0, con: 4.1, int: 3.2, wis: 3.8, cha: 3.3 },
  { level: 16, ac: 17.4, str: 3.85, dex: 4.15, con: 4.25, int: 3.35, wis: 3.95, cha: 3.45 },
  { level: 17, ac: 17.5, str: 4.0, dex: 4.3, con: 4.4, int: 3.5, wis: 4.1, cha: 3.6 },
  { level: 18, ac: 17.6, str: 4.13, dex: 4.43, con: 4.53, int: 3.63, wis: 4.23, cha: 3.73 },
  { level: 19, ac: 17.7, str: 4.27, dex: 4.57, con: 4.67, int: 3.77, wis: 4.37, cha: 3.87 },
  { level: 20, ac: 17.8, str: 4.4, dex: 4.7, con: 4.8, int: 3.9, wis: 4.5, cha: 4.0 },
];

export type PartyDefenceMode = "wotcStandard" | "brokenChain";

/** The party profile at a level. CLAMPED to the table rather than extrapolated past it. */
export function partyDefenceAt(level: number, mode: PartyDefenceMode): PartyDefenceRow {
  const table = mode === "brokenChain" ? BROKEN_CHAIN : WOTC_STANDARD;
  const lv = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return table.find(r => r.level === lv) ?? table[table.length - 1];
}

/**
 * The save bonus for the ability a feature actually targets.
 *
 * An unreadable ability falls back to the AVERAGE of the six, never to a particular one: picking
 * DEX would flatter every creature and picking INT would punish every creature, and neither is
 * knowable from a block that did not say which save it calls for.
 */
export function saveBonusFor(row: PartyDefenceRow, ability: SaveAbility | undefined): number {
  if (ability) return row[ability];
  return (row.str + row.dex + row.con + row.int + row.wis + row.cha) / 6;
}

/** "DC 18 Intelligence saving throw" / "INT DC 18" / "STR DC 13" → the ability. */
export function parseSaveAbility(text: string | undefined): SaveAbility | undefined {
  const t = (text ?? "").toLowerCase();
  if (!t) return undefined;
  const map: Array<[RegExp, SaveAbility]> = [
    [/\b(?:str|strength)\b/, "str"],
    [/\b(?:dex|dexterity)\b/, "dex"],
    [/\b(?:con|constitution)\b/, "con"],
    [/\b(?:int|intelligence)\b/, "int"],
    [/\b(?:wis|wisdom)\b/, "wis"],
    [/\b(?:cha|charisma)\b/, "cha"],
  ];
  for (const [re, id] of map) if (re.test(t)) return id;
  return undefined;
}
