/**
 * ENCOUNTER SCENE RENAMES — Acts 1–3, from the current encounter documents.
 *
 * Sources (RULE 1):
 *   `broken_chain_act1_encounters_named_scenes_v2.html`
 *   `broken_chain_act2_encounters_named_scenes_v2.html`
 *   `Broken_Chain_Act3_Encounters_Clean_v3_14_Publication_Identity_Clean.docx`
 *
 * Christopher: *"the encounter for all 3 are fixes to names and loot locations so this would be a
 * fix not a content because all of the loot and encounter are there."*
 *
 * ── THE NAMING RULE ──────────────────────────────────────────────────────────────────────────
 * *"no A3 E1, simple A3 then the name of the encounter."* So `A3 The First Court`, not
 * `Act 3 E1 - The First Court`. The sequence number lives in the encounter's `order`, where it can
 * be re-ordered without renaming anything; baking it into the name meant every insertion renamed
 * the tail of the act and orphaned its loot.
 *
 * ⚠ RENAMING AN ENCOUNTER MOVES ITS LOOT POOL. A pool IS its name — every item is tied to a fight
 * by the STRING in `sourceEncounter`. Rename one side only and the pool silently empties: the
 * Gifts would still exist, still say "Act 3 - Gate II: The Mirrors", and appear under no fight the
 * app knows about. `migrateEncounterNames` moves both together or neither.
 *
 * ⚠ FIGHT 7 AND FIGHT 8 ARE DELIBERATELY ABSENT. *"hold off on anything for F7 and F8."* The Last
 * Court and The Occupied Acre keep their current names until told otherwise — an omission, not an
 * oversight.
 */

export type EncounterRename = {
  /** The encounter id, which never changes — the stable handle across a rename. */
  id: string;
  /** What it is called now, so an already-migrated library is left alone. */
  to: string;
  /** Pool names to re-tag, oldest first. Loot tagged to any of these moves to `to`. */
  fromPools: string[];
};

export const BROKEN_CHAIN_ENCOUNTER_RENAMES: EncounterRename[] = [
  // ── Act 1 — named scenes v2 ────────────────────────────────────────────────
  { id: "act1-thornfang-pack", to: "A1 The Split Treeline", fromPools: ["Act 1 — Thornfang Pack", "Act 1 - Thornfang Pack", "THORNFANG PACK"] },
  { id: "act1-greenwood-reaver", to: "A1 The Eastern Farmstead", fromPools: ["Act 1 — Greenwood Raider Band", "Act 1 - Greenwood Raider Band", "GREENWOOD RAIDER BAND"] },
  { id: "act1-mosshide-owlbear", to: "A1 The Creekside Den", fromPools: ["Act 1 — Mosshide Owlbear", "Act 1 - Mosshide Owlbear", "DISPLACED OWLBEAR", "MOSSHIDE OWLBEAR"] },
  { id: "act1-threadbare-spider-nest", to: "A1 The Webbed Crossing", fromPools: ["Act 1 — Threadbare Spider Nest", "Act 1 - Threadbare Spider Nest"] },
  { id: "act1-swamp-ambush", to: "A1 The Swamp Road", fromPools: ["Act 1 — Swamp Ambush", "Act 1 - Swamp Ambush"] },
  { id: "fort-cervan-band", to: "A1 The Road Fort", fromPools: ["Act 1 — The Fort", "Act 1 - The Fort", "Act 1 — The Fort "] },
  { id: "act1-boss", to: "A1 The Ruined Keep", fromPools: ["Act 1 - The Ruined Keep", "MIRAGE STALKER"] },

  // ── Act 2 — named scenes v2 ────────────────────────────────────────────────
  { id: "act2-s1-e1-hollow-pack", to: "A2 The Northgate Road", fromPools: ["Act 2 - Hollow Pack", "Act 2 — Hollow Pack"] },
  { id: "act2-s1-e2-frozen-hollow", to: "A2 The Frozen Hollow", fromPools: ["Act 2 - Frozen Hollow", "Act 2 — Frozen Hollow"] },
  { id: "act2-s2-e2-last-directive", to: "A2 The Desecrated Cemetery", fromPools: ["Act 2 - Last Directive", "Act 2 — Last Directive", "Last Directive"] },
  { id: "act2-s3-village-defense", to: "A2 Northgate Night Defense", fromPools: ["Act 2 - Lesser Wendigos (Village Night Defense)", "LESSER WENDIGOS"] },
  { id: "act2-s4-frozen-sentinels", to: "A2 The River Crossing", fromPools: ["Act 2 - Frozen Sentinels", "FROZEN SENTINELS"] },
  { id: "act2-s4-pale-drifter", to: "A2 The Hill Clearing", fromPools: ["Act 2 - Pale Drifter", "PALE DRIFTER + FROZEN CLOAK", "PALE DRIFTER"] },
  { id: "act2-s5-wendigo-wight", to: "A2 The Frozen Lake", fromPools: ["Act 2 - Wendigo Wight", "FULL WENDIGO"] },

  // ── Act 3 — v3.14 publication identity ─────────────────────────────────────
  { id: "act3-e1-the-first-court", to: "A3 The First Court", fromPools: ["Act 3 - The First Court", "Act 3 E1 - The First Court"] },
  { id: "act3-e2-the-cut-below", to: "A3 The Cut Below", fromPools: ["Act 3 - The Cut Below", "Act 3 E2 - The Cut Below"] },
  // Gate I is renamed in the document: "The Crone and the Mare" -> "Twilight Pond".
  { id: "act3-e3-gate-i-crone-and-mare", to: "A3 Gate I: Twilight Pond", fromPools: ["Act 3 - Gate I: The Crone and the Mare", "Act 3 E3 - Gate I: The Crone and the Mare"] },
  { id: "act3-e4-the-hollow-feast", to: "A3 The Hollow Feast", fromPools: ["Act 3 - The Hollow Feast", "Act 3 E4 - The Hollow Feast"] },
  { id: "act3-e5-the-scar-line", to: "A3 The Scar Line", fromPools: ["Act 3 - The Scar Line", "Act 3 E5 - The Scar Line"] },
  // Gate II: "The Mirrors" -> "Open Clearing". THIS ONE CARRIES THE GIFTS.
  { id: "campaign-mt3nm2j9", to: "A3 Gate II: Open Clearing", fromPools: ["Act 3 - Gate II: The Mirrors", "Act 3 E6 - Gate II: The Mirrors"] },
  // ⚠ F7 (The Last Court) and F8 (The Occupied Acre) are HELD — see the header.
  // Gate III: "The Veil-Torn Dragon" -> "Veilscar Hollow".
  { id: "act3-e9-gate-iii-veil-torn-dragon", to: "A3 Gate III: Veilscar Hollow", fromPools: ["Act 3 - Gate III: The Veil-Torn Dragon", "Act 3 E9 - Gate III: The Veil-Torn Dragon"] },
  { id: "act3-e10-the-center", to: "A3 The Center", fromPools: ["Act 3 - The Center", "Act 3 E10 - The Center"] },
];
