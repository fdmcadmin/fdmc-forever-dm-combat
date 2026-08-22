/**
 * THE BROKEN CHAIN — ACT RUN SEQUENCES.
 *
 * Extracted from the "Act Run Setup" sheet of
 * `broken_chain_encounter_checker_v7_4_UR_corrected.xlsx` (RULE 1: that workbook is the truth).
 *
 * ⚠ CAMPAIGN CONTENT. Which fights an act contains, and where its rests and level gates fall, is
 * Broken Chain. The MODEL that runs a sequence and applies rest state is engine, in
 * `core/encounter-band/actRun.ts` (RULE 3).
 *
 * ⚠ THESE ARE NOT ENCOUNTER PRESETS. The sheet: *"References an encounter assembled from
 * estimator-priced creatures; not a built-in monster preset."* An id here says WHICH fight and
 * WHEN — never what is in it or what it costs.
 */

import type { ActRunStep } from "../../../core/encounter-band/actRun";

export const BROKEN_CHAIN_ACT_RUNS: ActRunStep[] = [
  {
    act: "Act 3", sequence: 1,
    encounterId: "A3-F1", name: "First Court",
    partyLevel: 6, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "None", restStatus: "—", restDefault: "Skip",
    levelAfter: 6,
    notes: "First fight in the pre-Gate I attrition block.",
  },
  {
    act: "Act 3", sequence: 2,
    encounterId: "A3-F2", name: "Cut Below",
    partyLevel: 6, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "None", restStatus: "—", restDefault: "Skip",
    levelAfter: 6,
    notes: "No reset between F1–F3.",
  },
  {
    act: "Act 3", sequence: 3,
    encounterId: "A3-F3", name: "Twilight Pond — Crone & Darkmare",
    partyLevel: 6, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "Long", restStatus: "Set", restDefault: "Complete",
    levelAfter: 7,
    notes: "Major rest after Gate I; advance to Level 7.",
  },
  {
    act: "Act 3", sequence: 4,
    encounterId: "A3-F4", name: "Hollow Feast",
    partyLevel: 7, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "None", restStatus: "—", restDefault: "Skip",
    levelAfter: 7,
    notes: "Post-Gate I segment.",
  },
  {
    act: "Act 3", sequence: 5,
    encounterId: "A3-F5", name: "Scar Line",
    partyLevel: 7, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "Short", restStatus: "Available", restDefault: "Take",
    levelAfter: 7,
    notes: "Expected short-rest window before the Mirrors; normally safe enough to complete.",
  },
  {
    act: "Act 3", sequence: 6,
    encounterId: "A3-F6", name: "Open Clearing — Mirrors",
    partyLevel: 7, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "Long", restStatus: "Set", restDefault: "Complete",
    levelAfter: 8,
    notes: "Major rest after Gate II; advance to Level 8 and apply the authored Gift state.",
  },
  {
    act: "Act 3", sequence: 7,
    encounterId: "A3-F7", name: "Last Court",
    partyLevel: 8, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "None", restStatus: "—", restDefault: "Skip",
    levelAfter: 8,
    notes: "Post-Mirror pressure segment.",
  },
  {
    act: "Act 3", sequence: 8,
    encounterId: "A3-F8", name: "Occupied Acre",
    partyLevel: 8, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "Short", restStatus: "Available", restDefault: "Take",
    levelAfter: 8,
    notes: "Expected short-rest window before the Moonstone Dragon.",
  },
  {
    act: "Act 3", sequence: 9,
    encounterId: "A3-F9", name: "Moonstone Dragon Lair",
    partyLevel: 8, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "Long", restStatus: "Set", restDefault: "Complete",
    levelAfter: 9,
    notes: "Major rest after Gate III; advance to Level 9 and apply remaining Gifts.",
  },
  {
    act: "Act 3", sequence: 10,
    encounterId: "A3-F10", name: "The Center",
    partyLevel: 9, partyMode: "Broken Chain", bcState: "Metamorphosis",
    vsEntity: false,
    restType: "None", restStatus: "—", restDefault: "Skip",
    levelAfter: 9,
    notes: "Fresh Level 9 finale state.",
  },
];
