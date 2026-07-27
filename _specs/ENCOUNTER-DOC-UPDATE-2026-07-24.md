# Encounter Doc Update — App ↔ Final Pack reconciliation

**Date:** 2026-07-24 · **Source of truth for DPR:** `broken_chain_full_dpr_3-4-5_final_pack.xlsx`
· **App model:** `core/encounter-band/encounterRounds.ts` (v12, LOCKED) · **Creatures:** `data/broken-chain/monsterLibrary.ts`

Every rounds/effective-HP number below was produced by **running the app's own `estimateRounds`**, not
by hand. The app is a **4-player balance model** (`BASELINE_PARTY_SIZE = 4`, the 1.00 WotC CR baseline);
it scales the *party's DPR* by size (`× size/4`) rather than scaling monster HP, which is why a 5-player
readout is intentionally short — the doc scales HP up for 5P instead, the app scales DPR up. Same lever,
opposite side of the ratio.

---

## Part A — Kit multipliers vs. the attached DPR (the two flagged fights)

The app's `MIDPOINT_DPR_4P` at **L5 = 110.4** already equals the final pack's 4P Balance Total (110.4).
L6/L9/L12 match too (122.2 / 153.1 / 185.3). So at the levels the Drifter and Wendigo Wight are fought,
**the DPR the app uses is already the correct DPR from this pack.** Running the model against it:

| Fight (L5, Realized) | Roster | Kit ×  | Raw HP | Eff HP | Rounds @4P | Band | Pack Monte-Carlo mean |
|---|---|---|---|---|---|---|---|
| **Pale Drifter + Frozen Cloak** | Drifter + Cloak | 1.531 · 1.540 | 221 | 339.1 | **3.39** | elite 3–4.5 | **3.39** (balance) |
| **Wendigo Wight** | solo act-boss | 1.63 | 288 | 469.4 | **5.03** | act-boss 5–6.5 | **5.05** (balance) |

**Finding: the current kit multipliers do not need to change.** The app's deterministic rounds land on
the final pack's 100k-trial Monte-Carlo means almost exactly (3.39 vs 3.39; 5.03 vs 5.05). The kit values
— Drifter 1.32×1.16, Cloak 1.40×1.10, Wight 1.25×1.06×1.23 — are correctly calibrated to the attached DPR.

### CORRECTION (2026-07-24, same day): the WW "discrepancy" below was my own sourcing error

An earlier version of this doc compared the app's 288 HP against the "Encounter Inputs" sheet's 340 (labelled
`4P HP` in that sheet) and recommended reverting to 340. That was wrong — "Encounter Inputs" is the **older,
superseded** band. The Dashboard sheet says so explicitly: *"Final S4/S5 tuning is on **Last 3 Rerun**:
... Wendigo Wight **360 HP**... The **425-HP** Wendigo row above is retained only as the encounter document's
authored **five-player** scale."* 425 (old, superseded 5P) → 340 (old, superseded 4P). **360 is the FINAL 5P
number** (confirmed by that sheet's own "Party count: 5" locked test input). Converting the final number to
4P: 360 ÷ 1.25 = **288 — exactly the app's current value.**

Cross-checked against the other two fights using the *same* final sheet, both match exactly too — not just
the total, but the individual creature split:

| Fight | Last 3 Rerun final (5P) | ÷1.25 → 4P | App's live value |
|---|---|---|---|
| Frozen Sentinels | 215 | 172 | 52+75+45 = **172** ✓ |
| Drifter + Cloak | 170 + 106 = 276 | 136 + 85 = 221 | 136+85 = **221** ✓ |
| Wendigo Wight | 360 | 288 | **288** ✓ |

**Conclusion: no HP change needed on any of the three fights.** The app already carries the correct,
final-tuned HP, correctly converted to its 4P-baseline convention. The kit multipliers are also correct
(confirmed above — app rounds match the pack's Monte-Carlo means). Nothing to change in Part A.

---

## Part B — App creature changes that may not be in the encounter doc

Changes made in the app since the encounter doc was authored. Confirm each is reflected in the doc's stat blocks.

| Creature | Change in app | In encounter doc? | Action |
|---|---|---|---|
| **All 10 encounter creatures** | "Multiattack" action rows removed; attacks now driven by `attacksPerTurn` (2, Reaver 3). Build-like-a-PC. | Cosmetic to the doc (same # attacks). | Note only. |
| **Frozen Sentinel / Frost-Weaver** | Structured spell slots added — Sentinel 1st(4)/2nd(3)/3rd(2); Weaver 1st(3)/2nd(2)/3rd(2)/4th(1). Slot-costed actions tag their level. | Doc describes slots in prose. | Verify slot counts match. |
| **Pale Drifter — Death Burst** | Fixed at **6d6 cold, DC 14 CON, 15 ft**, flat at every party size (band moves HP, not abilities). | Check — doc may still have a scaling version. | Confirm 6d6/DC14. |
| **Frozen Cloak** | Present as a full creature: AC 15, HP 85, Frostshadow Claw **3d8+3 psychic**, Reknit in the Cold (returns once at **34/85** in dim light; radiant or bright light prevents), radiant-vulnerable, Fold Into the Cold hides in the Drifter's aura. | Doc pairs it with the Drifter. | Verify the Cloak's own stat block (psychic claw, 34-HP reknit, radiant vuln). |
| **Wendigo Wight — HP/AC/kit** | **288 HP, AC 17**, kit 1.25×1.06×1.23 = 1.63. Bone Armor "revealed at half HP (180 of 360 @5P)". | Doc final = 360 HP / AC 17 / Bone Armor at 180. | **HP mismatch — see Part A.** AC matches. |
| **Wendigo Wight — Bone Field Raise** | Roster-gated: the trait always exists, but the body to raise only exists at 6P (add 1× Lesser Wendigo). At 4–5P it never fires. "Count changes with the band; abilities do not." | Doc excludes Bone Field Raise. | Consistent — note the 6P roster rule. |
| **Wendigo Wight — Frozen Endurance** | First drop to 0 → 1 instead, once/fight; **fire/radiant bypass**. | Check bypass clause. | Confirm fire/radiant note. |
| **Frozen Sentinel — Rime Bolt** | First Rime Bolt each turn restrains (DC 15 STR, as a rider on 2d8+3+1d8). | Check. | Confirm restraint rider. |
| **Frozen Sentinel — Glacial Freeze** | 1/day Counterspell (auto-fail ≤3rd; INT check DC 10+level for 4th+). Sentinel only, **not** the Frost-Weaver. | Check. | Confirm Sentinel-only. |
| **Raise the Frozen (husk)** | On any line-member death a caster may raise it as a **Frozen Husk** — its own new instance (AC 14, HP 25, Rime Claw only), not a reduced copy. | Check the husk stat line. | Confirm AC14/HP25. |
| **All damage dice** | Now colour/icon-coded by damage type on the card (cosmetic). | N/A | None. |

Roster reference (app raw HP, single body): Frozen Sentinel 52 · Frost-Weaver 75 · Rime Wight 45 (formation
52+75+45 = **172 = doc 4P-authored**) · Lesser Wendigo 120 (×2 = 240 = doc 4P) · Pale Drifter 136 · Frozen
Cloak 85 (pair = **221 = doc 4P**) · Wendigo Wight **288** (doc 4P = 340 — the mismatch).

---

## Part C — Stale DPR anchors at L3 / L4 (does NOT touch Drifter/WW)

The app's `MIDPOINT_DPR_4P` still **extrapolates** L3/L4 (the old workbook started at L5). The final pack now
has real anchors, and they're much lower:

| Level | App `MIDPOINT_DPR_4P` | Final pack 4P Balance Total | Δ |
|---|---|---|---|
| 3 | 92.0 | **67.6** | app +36% |
| 4 | 101.0 | **77.8** | app +30% |
| 5 | 110.4 | 110.4 | ✓ |
| 6 | 122.2 | 122.2 | ✓ |
| 9 | 153.1 | 153.0 | ✓ |
| 12 | 185.3 | 185.3 | ✓ |

The app currently **over-states party DPR at L3–L4 by ~30%**, which makes the four early fights (Hollow Pack,
Frozen Hollow, Last Directive, Lesser Wendigos) read shorter than the pack's real curve. It does **not** affect
the Drifter or Wight (both L5). `encounterRounds.ts` is LOCKED, so this is a **flag, not an edit**: updating
those two anchors to 67.6 / 77.8 would bring the app's L3/L4 estimates in line with the final pack.

---

## Summary / decisions for you

1. **Kit multipliers AND raw HP for all three fights are already correct** against the final tuning in this
   pack (Last 3 Rerun, not the older Encounter Inputs sheet). Verified against BOTH the pack's Monte-Carlo
   means (Drifter+Cloak 3.39, Wight 5.05) AND the final-tuned HP converted to the app's 4P baseline (Sentinels
   172, Drifter+Cloak 221, Wight 288) — every one matches the app exactly. **Nothing to change.**
2. **L3/L4 DPR anchors are stale** (app 92/101 vs pack 67.6/77.8). Doesn't touch the flagged fights; flagged
   for a LOCKED-file update if you want the early fights re-aligned.
3. **Creature-change checklist (Part B)** — confirm Death Burst (6d6/DC14), the Frozen Cloak stat block,
   Frozen Endurance's fire/radiant bypass, and the spell-slot counts made it into the doc.
