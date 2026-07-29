# FDMC 0.6.0 Clean Rebuild - Master Phase Tracker

**Project:** Forever DM Combat Engine  
**Campaign Module:** The Broken Chain  
**Rebuild Start:** 2026-06-03  
**Authorized By:** Christopher (Coach)  
**Claude Role:** Active builder. Executes phase specs in order. No explicit patch permission needed - the spec IS the authorization.  
**Last Session:** 2026-07-24→25 — **0.6.4.5 → 0.6.9.1.** The longest single arc in the rebuild: the
encounter model reconciled against the final DPR pack, the monster card finished, the PC party
rebuilt and verified against the real sheets, three long-standing data-model contradictions
resolved, and the combat log turned into an exportable record. Every step built green (tsc → vite)
→ version bump → commit → push on `main`. Working spec for the unfinished half:
**`_specs/COMBAT-LOG-SPEC.md`** (its Resume Checkpoint is the live status board).

**Encounter model — HOLD LIFTED, and `encounterRounds.ts` WAS edited (deliberately).**
- v12/final-pack applied: baseline party **4** (not 5), supported spread 3/4/5, `REALIZATION` 1.0,
  revised `ROUND_BAND`, AC split out of the kit into its own offensive `acFactor` term with itemised
  `defenses: MonsterDefense[]` on the defensive side.
- Reconciled against `broken_chain_full_dpr_3-4-5_final_pack.xlsx` by RUNNING the model: kit
  multipliers and raw HP for all three S4/S5 fights already match the pack's Monte-Carlo means
  (Drifter+Cloak 3.39 vs 3.39; Wight 5.03 vs 5.05). **Nothing needed changing.** An earlier draft of
  that write-up wrongly flagged the Wight's 288 HP against the pack's *superseded* Encounter-Inputs
  sheet; Christopher caught it. Final tuning lives on **Last 3 Rerun** (WW 360 @5P ÷ 1.25 = 288 @4P).
  Write-up: `_specs/ENCOUNTER-DOC-UPDATE-2026-07-24.md`.
- **Round band is now escalation-only (0.6.7.2).** `estimateRounds` did `encounterTier ?? derived`,
  so a declared tier beat the roster *in either direction* — an act boss in an encounter tagged
  "normal" was judged against a 2–3 round band. That is a de-escalation lever, which
  ENCOUNTER-BALANCE-RULES forbids. The band now always derives from the strongest creature and a
  declared tier may only raise it (`maxClassification`).
- **STILL STALE:** `MIDPOINT_DPR_4P` extrapolates L3/L4 at 92.0/101.0 where the pack anchors
  **67.6/77.8** — the app over-reads party DPR ~30% at those levels, affecting the four early
  fights only (L5+ all match). Flagged, not edited.

**Three data-model contradictions resolved.**
- **`kind` was doing three jobs (0.6.8.0).** It was `monster | npc | boss` — a type slot, a THREAT
  level, and a disposition in one field, which is why the Pale Drifter read kind "boss" AND
  classification "elite" and both were "true". `kind` is now the creature's D&D type (14 official
  types + `npc` + `unspecified`); the separate free-text Creature Type box is deleted. Two threat
  behaviours moved off it first, both bugs in their own right: boss-kill logging, and
  **`BOSS_MULT` — the hidden ×1.6 that `MonsterClassification` was created to kill, still live in
  the legacy `encounterDifficulty` path.** 20 of 26 creatures migrated from the encounter doc; **6
  are `unspecified` and need Christopher's call** (Greenwood Reaver, Swamp Ambusher, Mirage Stalker,
  Cervan Thornwarden, Fortbreaker Reaver, Gloamknife Stray).
- **Identity was empty (0.6.7.1).** Across 26 creatures: archetype set **0** times, creatureType
  **0**, classification **3**. The library that models how identity drives a build demonstrated
  nothing. All seven Act 2 creatures now carry their authored size/type/classification/archetype.
- **Frozen line traits (0.6.6.6–.7).** `Frozen Nature` was split 2/2 *inside one formation*
  (Sentinel/Weaver "unhindered" vs Rime Wight/Husk "vulnerability to both") — unified to unhindered.
  Pale Drifter's `Soul-Touched` / `Wrought Cold` names sat on each other's text; Wrought Cold is
  replaced by the shared Frozen Nature. Frozen Cloak keeps `Cold-Woven` as its own unique trait and
  publishes as a **fiend** (Shadow Demon chassis — publication needs an official type).

**Monster card finished (0.6.5.2 → 0.6.8.1).** Expandable text · damage dice coloured by type
(`damageTypeVisuals.ts`) · **Multiattack removed entirely** (13 rows deleted; the budget comes from
`stats.attacksPerTurn`, built like a PC) · structured per-level `spellSlots` · combined header with
an identity line · sections coloured per type from the PC sheet's own `tabVisuals` palette, collapsed
by default · per-creature skills · **per-ability saving throws** (checks and saves are different
numbers; the card had one doing both) · a **Spells** section, which exposed that monster bonus
actions were marked in the NAME and so had been filed as MAIN actions — casting Rimestep ended the
creature's turn.

**Combat window + player-facing (0.6.6.8, 0.6.7.0).** **Minimize** collapses the popover to its
title bar so the map is usable without leaving combat (it was sized from `window.screen` — the
physical monitor — with floors larger than a laptop's usable area, so it could not shrink to fit).
New `ThreatHpBar`: thin bars everywhere, **heavy tier-coloured bars for mid-boss+**, reveal-gated in
one function so an unrevealed boss cannot be telegraphed. `classification` had to be threaded
template → instance → player broadcast; it had never reached the instance at all.

**Party rebuilt and verified.** All 30 PC saves filled in and **checked against the D&D Beyond PDFs
— 30 compared, 0 mismatches.** Faelar upgraded to **Beast of the Land**, computed from three ranger
inputs (AC 13+WIS, HP 5+5×level, to-hit = spell attack mod). **Companions could not act at all** —
an owned companion's tracker row rendered its name as a plain `<span>` while every other row is a
button, so her card could never be opened. Also: deleting an actor left its live state, seat
membership and bindings in room metadata, so viewers kept seeing removed characters.

**Combat log → exportable record (0.6.8.2 → 0.6.9.1).** ⚠ **THERE ARE TWO LOGS** —
`CombatLogEntry` (feeds the summary) and `EncounterLogEntry` (localStorage, dice shorthand). Writing
to the wrong one is why the summary panel shipped correct and empty. The log now spans **initiative
→ End Combat** (Start Combat was clearing it, destroying the initiative rolls it was meant to begin
with) and holds **2500** entries, derived (11 combatants × 8 rounds × ~22 entries ≈ 2,050; measured
321KB). New `summarizeEncounter` + panel: most damage dealt/taken, healing, resources, and action
economy A·B·R·L, **party-scoped** (over the whole field the boss wins every time). Attribution is
the core rule — a reaction fires on someone else's turn, so crediting by turn owner hands a PC's
opportunity-attack damage to the monster it interrupted; inferred entries are marked `~`, never
hidden. **Remaining: 3 wiring passes** (committed rolls, healing, resource spends) + narrative
rendering — see COMBAT-LOG-SPEC.md.

**Also shipped:** Weapon Mastery database (8 properties, 38-weapon index) as an explicit per-item
choice, never auto-derived · weapon categories melee 1H/2H/Versatile + ranged 1H/2H · two-weapon
fighting + Nick · a tabbed in-app guide (Seats/Companions/Combat/Dice/Building) · a **local math
roller** that fires when no dice app answers, so the table is never stuck on "Waiting for roll".

**Open items for Christopher:** the 6 `unspecified` creature types · the stale L3/L4 DPR anchors ·
the Wendigo Wight has **no proficient saves** (a solo act boss is very exposed to save-or-suck) ·
`lyrielle.ts` still says level 2 in the bundled module (live room is 5) · the JSON monster importer
(parked) · the Monster Gate live-room verify (still the only Monster Gate item outstanding).

---

**Prior Session:** 2026-07-19→21 — **MONSTER GATE BUILD (0.6.3.12 → 0.6.4.4).** ⚠ HANDOVER — READ FOR
2ND-USAGE PICKUP. Everything below built green (encoding scan → tsc → vite) → version bump → commit →
push at each step; deployed on `main` (Cloudflare auto-deploy). Full detail: `MONSTER-GATE-SPEC.md`
(its **Resume checkpoint** is the live status board) + LIVING-BUILD-LOG.md.

- **Wendigo Wight CR pass (0.6.3.12–.13):** AC 17→15, STR 20→18, both melee all-cold at reduced dice;
  Hunger Bite max-HP drain = HALF the cold dealt, **no lifesteal** (a stray heal was a typo — see the
  [[flag-power-increase-before-change]] rule: a buff inside a nerf pass gets confirmed BEFORE editing).
- **The "monster gate" = Monster Creator + Combat Window rebuild.** Source model:
  `Downloads/fdmc-monster-creator-archetype-stat-ac-model-v1.md`. **S0 windowing spike = GO** (OBR
  supports concurrent distinct-id popovers; the app already does it). **All four pieces SHIPPED:**
  - **B1 combat window (0.6.4.0):** `combat-window.html`/`src/combat-window.tsx`, popover `fdm-combat`,
    opened by the **⚔ Combat** button (DM toolbar Manage row). 3 panes: roster · keep-ALL-mounted
    `MonsterActorCard`s (visibility-toggled so swapping a creature never resets its per-round state —
    the load-bearing S0 finding) · player-safe view. No metadata rework (in-combat monsters are
    DM-local roster copies).
  - **B2 player overlay (0.6.4.1):** `player-tracker.html`/`src/player-tracker.tsx`, popover
    `fdm-player-tracker`, **⚔ Tracker** button in the player status bar. Party turn order + real HP +
    nested companions; monsters player-safe per visibility. Read-only v1 (initiative stays on cards).
  - **WS-A creator (0.6.4.2–.3):** `MonsterTemplateEditor.tsx` = A1–A7 PC-style stepper (both create
    AND edit open it → the axes are editable after creation). Model in
    `core/monsters/creator/monsterCreatorModel.ts`: chassis picker + pool-preserving archetype
    redistribution. New first-class fields on `MainMonsterTemplate.stats`: `archetype`, `creatureType`,
    `size`, `legendaryPerRound` (+ `legendaryCost` on actions). The old `MonsterJconBuilder` is
    DORMANT (deletion candidate).
  - **B3 condensed tracker (0.6.4.4):** `condensed` prop on `CombatTracker` → names+order strip;
    mount gated to a staged fight.
- **Only Monster Gate item left:** a **live-room verify** (walk B1/B2/B3 + the creator in a real OBR
  room; check C1–C4 in the spec's S0 Findings).
- **PC characters lost (not our bug):** Christopher's DM localStorage partition was evicted (returned
  `null`) — a code deploy can't clear it; the seed version was unchanged. ~~Party is being rebuilt from PDFs~~ — **DONE 2026-07-25:** the party is rebuilt and all 30 saves
  verified against the D&D Beyond PDFs (0 mismatches). Schema: `_specs/PC-JCON-IMPORT-MAP.md`;
  import via Edit Actors → ↑ Import → ↺ Sync. **STILL QUEUED, not built:** a party **backup system** (localStorage snapshot ring +
  downloadable file + stale nudge) — start after the party is re-imported.
- ~~**Encounter DPR model — retune PENDING, DO NOT touch `encounterRounds.ts`**~~ **SUPERSEDED
  2026-07-24:** the hold is LIFTED. v12/final-pack is applied, Balance Center is the publication
  target, and `encounterRounds.ts` has since been edited deliberately (AC/defence split, and the
  escalation-only band fix). See the Last Session block at the top.

**Prior Session:** 2026-07-17 — **0.6.3.0 · TRUNK UNIFICATION.** ⚠ READ THIS BEFORE TOUCHING THE TREE. The build had **forked at 0.6.2.7**: the Act 2 line (`candidates/0.6.0-act2-deathlock-frostweaver`, **no git**) held the rounds-to-kill model, the multi-coin wallet, the Deathlock family, Extra Attack and recharge; this git tree held 0.6.2.8–.15 (bench, bonds, free-cast, riders). **Neither had the other** (25 files differed). Per Christopher the Act 2 line became the trunk, was merged forward, and was **copied into this folder**, which owns `.git` + the deploy — so THIS folder is canonical again and the frostweaver candidate is now a historical snapshot. The 0.6.2.9–.11 gold-chip work was **dropped as superseded** by the multi-coin wallet (its DM-lock intent was preserved: coin editing is GM-only; legacy `gold` migrates to `coins.gp`, no money lost; zero coins stay hidden). **NEW:** `classification` (now incl. `final-boss`) drives fight length via `ROUND_BAND` — normal 2–2.5 · strong 2.25–3.5 · elite 3.25–4.5 · mid-boss 4–5.5 · act-boss 5–6.5 · final-boss 6–8
(**revised by v12 to** normal 2–3 · strong 2.5–3.5 · elite 3–4.5 · mid-boss 4–5.5 · act-boss 5–6.5 ·
final-boss 6–7.5, hard cap 8, floor tolerance 0.1); the band IS the wiggle room, replacing the old single 3–6.5 window. **Next:** ~~no library creature sets `stats.classification`~~ — **DONE 2026-07-24:** all seven Act 2
creatures carry their authored classification, so the band derives from the roster rather than
defaulting to `normal`. Full detail: LIVING-BUILD-LOG.md (0.6.3.0) + `candidates/0.6.0-act2-deathlock-frostweaver/CHECKPOINT-REPORT.md` (Stages 1–6).

**Prior Session:** 2026-06-30 — **0.6.2.7**. Post-0.6.1.9 live-session combat hardening (0.6.1.10 -> 0.6.2.7): the **armed-effects subsystem** (cast-to-arm focus / weapon-buff / fighting-style / Rage / Hunter's Mark / additive riders; persistent vs one-off; cleared at End Combat), the **save-call system** (shared-log announce + SavePromptBanner pop-up + attack-rider saves that fire after damage + a multi-select target picker for PCs and monsters), **Dice+ bridge hardening** + the canonical **resolve-@vars-before-normalize** formula fix that ended the "invalid dice notation" saga, **player-owned rolls + HP privacy**, **resource/economy automation**, the **level-up popout with hand-built presets**, and the **mandatory pre-build encoding scan**. Built green and pushed to main at every step. Full arc in the "Post-0.6.1.9" section below + LIVING-BUILD-LOG.md; see also "Version & Road-to-Alpha Assessment" below.

**Prior Session:** 2026-06-15 — P-UX4 Phases 1-8 (v0.6.1.1 -> v0.6.1.9); see the P-UX4 row in the phase log.

**Earlier Session:** 2026-06-14 (**0.6.1.0 foundation patch** — P-SHEET S3/S4, P10 Nat-1 table, P11 slot-spend log all COMPLETE; equipment editability pass (locked campaign gear now editable as DM overrides + library seeded app-wide). Manifest 0.6.1.0, pushed to main (Cloudflare auto-deploy). Full P0–P12 audit PASS: tsc -b strict 0 errors, vite build green, 0 `as any`. One crash bug found + fixed: conditional `useState` in the player convergence panel IIFE (rules-of-hooks). Low-severity: ~7 dead source files flagged (tree-shaken, not shipped) — left in place. Rollback tag `v0.6.0.9-stable`.)

**Prior Session:** 2026-06-11 (0.6.0→0.6.9 deep-dive audit PASS — tsc -b strict 0 errors, vite build green, tree clean. Closed last P9 pre-work flag: CombatLog Export downloads JSON. **Checkpoint:** `candidates/0.6.9-stable/source`. Manifest 0.6.9.)

**Deferred (intentional, not bugs):** Patreon unlock "coming soon" placeholder (moduleUnlock.tsx); two `// TODO: remove at 0.9.0 alpha lock` markers (EquipmentLibraryStandalone). Reserved feature phases P10/P11/P12 (Nat-1 table, spell-bridge runtime, cross-actor effects) and the staged P-SHEET (Class Actions/Feats tabs + rest automation) remain NET-NEW work, not 0.6 finishing items.

---

## Phase Completion Log

| Phase | Title | Status |
|-------|-------|--------|
| P0 | Salvage + Spec Setup | [COMPLETE] 2026-06-03 |
| P1 | State Architecture Foundation | [COMPLETE] 2026-06-03 |
| P2 | Seat System + Actor Broadcast | [COMPLETE] 2026-06-03 |
| P3 | Actor Editor + Level-Up | [COMPLETE] 2026-06-03 — fixes applied 2026-06-04, RETEST REQUIRED |
| P4 | Combat Tracker + Monster Pop-Out + Encounter Wipe | [COMPLETE] 2026-06-04 — fixes applied 2026-06-04, RETEST REQUIRED |
| P5 | Library View + Resource Schema + Spell Action Schema | [COMPLETE] 2026-06-04 — fixes applied 2026-06-04, RETEST REQUIRED |
| P6 | Token Assignment | [COMPLETE] 2026-06-04 — NOT YET MANUALLY TESTED |
| P7 | Ring Buffer Event Log | [COMPLETE] 2026-06-04 |
| P8 | Export + Post-Combat Stats | [COMPLETE] 2026-06-04 |
| P9 | Actor Profile Hardening (F09, F03) + UX Polish (UX-1,3,6,7,9,10a,10b) | [COMPLETE] 2026-06-06 |
| P9.5 | Encounter party-size/level difficulty band (homebrew threat heuristic; add/remove recommendation; party size 4/5/6 + pseudo-level) | [COMPLETE] 2026-06-08 — `core/encounter-band/`, wired into EncounterLibraryPanel; build green, no P0–P9 regressions. NOT an official CR calc (homebrew guide). |
| P-UX1 | First-Time User / Visual Hierarchy Overhaul (seat colors, tab visuals, guided creator, monster bands, token discoverability, Party Character language, module-unlock reframe) | [IN PROGRESS] 2026-06-07 — see P-UX1-SPEC.md |
| P-UX3 | Equipment loot pools + library create/manage split + module-gate rework + token-menu fixes | [COMPLETE] 2026-06-07 — see section below + LIVING-BUILD-LOG.md |
| P-ROLL | Table-roll streamlining: monster ability checks + adv/disadv · additive-bonus button · builder 1d20/dice picker + pending drafts | [COMPLETE] 2026-06-09 — see P-ROLL-SPEC.md. All sub-phases done: monster checks + adv/disadv, additive-bonus button (both cards), builder 1d20/dice picker (FormulaInput), and pending-draft library for actor/monster/equipment creators. Build green. Distinct from reserved P10. |
| P-SHEET | Character-sheet restructure: Class Actions + Feats tabs · rest automation (HP + Hit Dice) · feat-driven derived stats | [COMPLETE] 2026-06-14 (0.6.1.0) — S1–S4 built. Feats editor tab + Class Actions split; `restResource()`/`feat()` helpers; Long Rest heals to full; `deriveActorStats` folds feat statEffects. |
| P10 | Roll Flow: Nat 1 Table + Adv/Dis Mode (F01, F04) | [COMPLETE] 2026-06-14 (0.6.1.0) — `core/data/criticalFailureTables.ts` (standard + double d6) wired into `CommittedRollPanel` (First/Second-Nat-1 toggle, d6 picker, DM-only table reference, player-safe log). Adv/Dis roll-mode toggle on PC cards shipped earlier (P-ROLL). |
| P11 | Spell Bridge Runtime + Log Polish (F02 runtime, F08) | [COMPLETE] 2026-06-14 (0.6.1.0) — `consumeSpellSlot`/`consumeNamedResource` return `ConsumeResult`; slot spends + out-of-charge now post combat-log entries. Upcast is data-authored (spell carries its cast level). |
| P12 | Cross-Actor Effects + Enemy Opening (F06, F07) | [DEFERRED] — superseded for now by the additive-button workflow (per Christopher). Convergence (cross-actor item forging) already covers part of F06. |
| Monster Gate | Monster Creator + Combat Window rebuild — see MONSTER-GATE-SPEC.md (CHECKPOINT doc). WS-A: monster creator rebuilt as a PC-style stepper (classification incl. `normal`, archetype, actions up to legendary + true reactions; scores from CHASSIS/encounter-doc, archetype REDISTRIBUTES points). WS-B: one DM combat window (`fdm-combat`) + player overlay (`fdm-player-tracker`) + condensed in-app tracker. | **[BUILD COMPLETE]** 2026-07-19→21 — S0 spike GO; B1 combat window (0.6.4.0), B2 player overlay (0.6.4.1), WS-A stepper (0.6.4.2–.3), B3 condensed tracker (0.6.4.4). Only **live-room verify** (C1–C4) remains. Card reskin voided (current colors stay). |
| P-UX4 | Post-peer-review UI restructure + feature additions (8 phases) — see P-UX4-SPEC.md | [IN PROGRESS] 2026-06-15 — **P1 VERIFIED + live as v0.6.1.1** (commit `635fa7f`; "works" per Christopher). Single Combat Actions editor tab. Wired in-app `APP_VERSION` to read `public/manifest.json` (single source of truth). **Interleaved bug fixes:** v0.6.1.2 (`8b017bd`) combat-tracker initiative ignored player DEX + trait bonuses (rolled 1d20+0) — extracted `core/state/initiative.ts` (DEX + trait bonuses), used by ActorCard + CombatTracker; Initiative Bonus field now on Feats tab. v0.6.1.3 (`a713e34`) armor AC formulas (`12+@DEX`) set base but never added DEX — `deriveActorStats` now resolves armor DEX (capped for medium). v0.6.1.4 (`a727ff2`) `@PROF`/`@VAR` unresolved in damage/crit chips + the triggered/damage-only send (raw `@PROF` sent to Dice+ → no roll) — resolve in `ActionButton` display + `completeTriggeredCandidate`. **P2 v0.6.1.5** (`adf5e4a`): bond/Homebrew tab hides the Action Economy chooser + auto-fills Category="Bond". **P3+P4 built + pushed v0.6.1.6** (`e646b3c`): P3 — damage-type dropdown (standard D&D types + Custom free text) on the PC action builder via new `core/constants/damageTypes.ts`, threaded to the Damage chip (full die set already in FormulaInput); P4 — new `passive` equipment type (reference/effect display only, no roll/use, non-logging) that surfaces its effect text inline on the actor card. **Interleaved feature v0.6.1.7** (`7557a32`): class-feature spells — Spell builder "Class feature uses / Long Rest" field marks a spell `spellSlotMode:"freeCast"`; it spends a dedicated named resource (auto-synced into `tabs.resources` by `ActorEditor`, id `cf-spell-*`, label = spell name, pool = uses, reset Long Rest) instead of a spell slot; App.tsx consume routing spends it before the slot branch. **P5–P8 built + pushed v0.6.1.9** (`94038bf`): P5 — top Create buttons removed from the main toolbar, colored per-tab Create buttons added to the Library (EncounterLibraryPanel gained `createSignal`); P6 — DM control icons clarified (🧹 Cleanup yellow, 🛠 GM Data teal hammer/wrench, ✕ Close All red, hover labels); P7 — removed the standalone 🎯 Assign Token button (seat/token assignment lives in Seats & Tokens / anchor model); P8 — new `ReadmeOverlay` quick guide opened via 📖 Guide on the DM toolbars. **All 8 P-UX4 phases built + pushed; awaiting live verify.** Deferred per brief: staged combat view; setup-friction (D&D Beyond import). Note: v0.6.1.1 push also carried the previously-unpushed `46b3a1d` "Loot overhaul" commit. Standing rule: push each completed change so Christopher can test. Phase 5 reverses P-UX3; Phase 7 keeps token panel as a Maintenance fallback. |

---

## Post-0.6.1.9 — Live-Session Combat Hardening (0.6.1.10 -> 0.6.2.7)

Live-play-driven (no pre-written phase spec). Christopher's standing rule held throughout:
each fix builds green (encoding scan -> tsc -b -> vite build) -> version bump -> commit ->
push, so the deployed build can be tested. Grouped by theme; version tags in parentheses.
Chronological commit-by-commit log is in LIVING-BUILD-LOG.md.

### Armed-effects system (cast-to-arm buffs) — the headline new subsystem
Temporary damage/attack riders a PC arms by *using* an ability (cast), shown as chips on the
card, applied to the next qualifying roll, and cleared at End Combat.
- Spellcasting focus on equipment: config layer (0.6.1.11), clickable toggle adding to spell
  attack + damage (0.6.1.12), @var resolution so "@SPELL+1" adds the full bonus not just the 1
  (0.6.1.13).
- Weapon-buff rider (Hungering Blade) as an assisted clickable toggle (0.6.1.14).
- Fighting Style toggles (Archery / Two-Weapon / Great Weapon) wired to ranged + melee
  attack/damage, with corrected TWF guidance text (0.6.1.16, 0.6.1.17).
- "Additive" outcome mode: a general bond-style rider from any tab (0.6.1.19); Outcome Mode now
  persists, so Triggered no longer reverts to Straight Damage (0.6.1.18).
- Activated buffs (Rage / Hunter's Mark / weaponBuffDamage) now ARM their chip on cast instead
  of being an always-on standing toggle (0.6.2.1). End Combat clears all armed effects and ends
  rage (0.6.2.0). A "Weapon buff (activated)" field was added to the general action editor so
  these are editable outside the Spell tab (0.6.2.3).
- Persistent vs one-off split: rage-active / focus: / buff: persist across rolls; additive:
  riders are one-off.

### Resource / action-economy automation
Lay on Hands spends a chosen amount from a pool (variable spend) (0.6.1.38); an explicit
"Spends resource" dropdown in the action editor sets slotCost (0.6.1.39); automated resource
countdown for activated abilities, plus a custom-Rage fix so the built-in Rage interceptor only
fires when a Rage counter exists (0.6.2.2); fixed a resource note accumulating duplicate
"Pool: X" text on every save (0.6.1.37).

### Dice+ bridge + formula resolution (the "invalid dice notation" saga)
- Bridge: send the roll immediately + de-dupe in-flight rolls so one click can't double-fire
  (0.6.1.22); audit follow-ups for var-display, rider formula, and result clobber-resistance
  (0.6.1.23).
- Formula resolution: the canonical fix is RESOLVE @vars BEFORE normalizing the formula
  (0.6.1.34) — running normalize first left stray letters (e.g. a lone "D" from @DEX).
  Supporting fixes: strip fighting-style annotations like "+2 (Archery)" that left empty parens
  (0.6.1.31); Archery ranged detection + resolve buff/focus panel labels (0.6.1.32); stop a
  one-off bonus die corrupting notation past the Dice+ "# label" (0.6.1.33); condense flat
  modifiers in chips and roll formulas (0.6.1.35, 0.6.1.36); and finally sanitize the Dice+ roll
  label so additive shorthand (dice/operators) in the "# Label" can't break parsing (0.6.2.4 —
  the final root cause of the MATH-token errors).

### Player-owned rolls + HP privacy
Players roll their own dice: combat-tracker initiative goes through Dice+, and spell-slot
pulling works on all cards (0.6.1.24). The combat tracker abstracts other players' exact HP to
a condition band for non-controllers (0.6.1.25).

### Save-call system (request -> announce -> target)
Announce required saving throws in the shared combat log (0.6.2.5); a screen pop-up
(SavePromptBanner) for save-required actions, plus attack-rider saves that fire AFTER the damage
roll ("hit, then DC X save") (0.6.2.6); a multi-select target picker so the DM/PC chooses exactly
which roster tokens must roll — the banner + log name just those creatures, popped-out cards fall
back to "each target" (0.6.2.7). Monster save actions + attack riders route through the same
system.

### Monsters
Added Cervan's Band (Thornwarden, Reaver, Gloamknife Stray) to the monster library (0.6.1.20);
monster combat gained named skill checks (Stealth/Perception/Acrobatics) + clearer action
classification (0.6.1.21).

### Level-up + actor sheet
Level-up moved to its own popout window with hand-built per-level presets to step through
(0.6.1.27; auto-progression stays banned, hand-built presets are allowed). INT damage-modifier
chips + "unequip but keep" equipment (0.6.1.28); bonds never crit — bond rider dice not doubled
on a critical hit (0.6.1.29); a Features editor step so stale tabs.features entries are editable
(0.6.1.15); feats can grant AC alongside Initiative (0.6.1.8).

### Reliability / hygiene
Fixed saves silently failing by surfacing save errors in the UI + hardening resource sync
(0.6.1.10); fixed mojibake in ActorCard and added scripts/scan-encoding.mjs as a mandatory
pre-build gate (0.6.1.30 — now standing policy); audit cleanups — slotCost guard, init-ref TTL,
result fallback, dead-code removal (0.6.1.26).

---

## Version & Road-to-Alpha Assessment (2026-06-30)

**Where we are: 0.6.2.7 — and that is accurate to the work.** The last ~40 commits
(0.6.1.10 -> 0.6.2.7) are combat-engine hardening from live play: dice-bridge reliability,
@var formula resolution, the armed-effects subsystem, resource automation, the save-call
system, player-owned rolls, and HP privacy. This is 0.6.x finishing/deepening work. It is NOT
0.8.0 feature work (none of the five ROADMAP-0.8.0 candidates have been started) and NOT 0.9.0
alpha-lock work (the module gate is still front-end base64; the "remove at 0.9.0 alpha lock"
dev-unlock TODOs are still present). **So we are NOT closer to 0.9.0 — we are solidly mid-0.6.x.**

**Suggested milestone shape to alpha:**
- **0.7.0 — "Combat Engine, Live-Hardened."** The armed-effects + save-call + dice-bridge +
  player-roll + formula-resolution work this cycle is arguably a milestone in its own right
  (more than "finishing 0.6.0"). Recommend cutting a 0.7.0 checkpoint to mark the combat engine
  feature-complete for live play, once a manual test pass is green.
- **0.8.0 — the five held big-ticket features** (on-map token aura, server-side entitlement,
  enemy opening / reaction window, condition chips + auto-tick, round scrubber + recap export)
  per ROADMAP-0.8.0-CANDIDATES.md.
- **0.9.0 — alpha lock.** Hard gates: (1) real server-side module entitlement replacing the
  base64 soft gate [longest lead time — start early]; (2) remove the dev-unlock "0.9.0 alpha
  lock" TODOs; (3) a green manual test pass (many P1-P9 items still read RETEST REQUIRED).

**Distance to alpha: ~2 milestones.** The long pole is the entitlement server (roadmap #2),
which is infra and should not ride a feature patch. Condition chips (#4) and enemy opening (#3)
would most improve the alpha experience but are not strict blockers.

---

## Design / Security Backlog

- **Module Unlock is front-end only (NOT secure).** The campaign module password
  (`MODULE_UNLOCK_HASH` in `core/campaign/moduleUnlock.tsx` — extracted there 2026-06-07,
  shared by the monster + equipment panels) is plain base64 and can be trivially recovered
  from dev tools / the bundle. It is a local demo soft gate, not content protection. Before
  any paid distribution it must be replaced with a real server-side entitlement check +
  signed tokens and content gated behind an authenticated fetch. Do not present it to users
  as protecting paid content. Note (2026-06-07): the gate now only guards the **Broken Chain
  (campaign) library** — a DM's own "My Library" monsters/encounters/equipment are always
  open and need no code. (Flagged P-UX1, 2026-06-07.)

---

## P-CODE1 — Code Quality / Maintainability Pass (2026-06-07, initial slice)

Conservative, high-impact, build-green cleanup. No P0 / authority / combat changes.

**Done this slice:**
- **Centralized magic strings.** New `core/constants/channels.ts` (OBR broadcast channel
  names) and `core/constants/storageKeys.ts` (localStorage keys). Removed the duplicated
  inline copies in `App.tsx` and `dm-panel.tsx` (`dm-library-updated`, `encounter-load-request`,
  `encounterLoadQueue`, `pending-level-up-requests` were each spelled out in 2–4 places).
- **Centralized DM-chrome accent tokens.** New `core/constants/theme.ts` (`FDMC_ACCENTS`);
  `dm-panel.tsx` panel/library/seat-tab accent maps now reference it instead of bare hex.
  Monster accent mirrors `seatColors.MONSTER_COLOR` to prevent drift.
- **Single source of truth for tab color.** `ActorEditor` step accents now derive from the
  shared `tabVisuals` so the DM's creator tabs and the player's character-sheet tabs match.
- **Key dedup.** `FDMC_KEEP_KEYS` now references `FDMC_ROOM_LIVE_STATE_KEY` /
  `FDMC_TABLE_BINDING_KEY` instead of re-typing the literal strings.
- **Authority-boundary comments** added at the new constant modules (channels carry only
  compact player-safe payloads; localStorage is DM/browser-local, never room truth).

**Recommended next cleanup pass (not done — flagged to avoid risky churn):**
- Break up `App.tsx` (~2800 lines) into the DM shell, player shell, and the broadcast-effect
  hooks (`useMonsterRosterBroadcast`, `useViewerPartyBroadcast`, `useLevelUpInbox`).
- Extract `ActorCard.tsx` (~3000 lines) sub-sections (header, HP controls, roll workspace).
- Extract repeated room-metadata scan/purge into one `roomMetadataMaintenance` helper used by
  both `App.tsx` and `dm-panel.tsx` (currently near-duplicate logic in two places).
- Extract small components flagged in the brief (`SeatCard`, `SeatActorChip`, `CombatTrackerRow`,
  `LibrarySectionCard`) once the file-splitting above lands.

---

## P-UX2 — Finishing Pass (COMPLETE 2026-06-07)

The visual-polish backlog below was closed out in a finishing pass. Build stays green
(`tsc -b && vite build`, 4 entry points). All changes were presentational (colors, accents,
typography, labels, CSS tokens) plus identical-value constant centralization — **no P0
authority, room-metadata shape, broadcast values, storage keys, or combat logic changed**,
so the P0–P9 behavior is intact for the next dev assessment.

**Closed:**
- **Typography** — removed the inline `fontFamily: monospace` "dev tool" look from the DM
  panel shell, token panel, monster card, boot/empty screens, and popout error states; they
  now inherit the app's Inter UI font. (Mono intentionally kept for `FormulaInput` dice
  formulas and the compact `RecentEventsWidget`.)
- **Design tokens** — added `:root` `--fdmc-*` accent variables + a reusable
  `.fdmc-section-head` class in `styles.css`, mirroring `core/constants/theme.ts`.
- **Monster card** — GM/monster-red header + left rail + role pill on both DM and
  player-safe cards, so it never reads as a party card.
- **Player character card** — seat-color left rail on the card frame + seat-tinted header,
  plus a seat-colored **▶ Your turn** badge in the player status bar.
- **Character sheet name** — tinted with the seat color (threaded to the popout via param).
- **Creator ↔ sheet tabs** — share one accent source (`tabVisuals`), so they match.
- **Field editor** — the action editor now opens with an accented, labeled section header +
  count badge instead of a bare list.
- **Cleanup / Maintenance / Approvals** — accent headers (amber / cyan / amber).
- **Tracker** — phase label colored by state; monster marker uses GM color.

**Backup:** `candidates/0.6.0-p9-ux-finished/` (full source mirror + `_specs`, builds clean).

**Deferred — these are FEATURE work, not UX polish (left out to protect P0–P9 integrity):**
1. **Guided equipment creator** — bringing equipment creation up to the character/monster
   guided-stepper pattern is a creator-flow build, not a restyle.
2. **On-map token tint/star** — drawing the seat color onto the actual Owlbear token art
   requires creating/attaching scene marker items. That's a scene mutation with real risk to
   the token/P0 model and needs its own careful, tested pass — not a cosmetic change.
   (Seat color already shows in the token panel, cards, tracker, and seat UI.)
3. **Table editors** (`SpellTableEditor` / `ResourceTableEditor`) remain grid-shaped by
   nature; a deeper card-ification is optional future polish.

---

## P-UX2 — Original Backlog (for reference; see Finishing Pass above for status)

P-UX1 (2026-06-07) established the color identity system: seat palette, GM/monster color,
tab accents, color-coded DM toolbar, guided creators, colored DM-panel headers/tabs, and
seat-colored combat tracker + character selectors. What still reads as "an LLM made it"
and should be tackled in a follow-up pass when usage resets:

1. **Actor combat card (`core/ui/ActorCard.tsx`) — biggest remaining purple surface.**
   — _Partial (2026-06-07): the character **name** now carries the seat color (threaded via a
   `seatColor` prop + a `seatColor` URL param into the actor popout), and the player's sheet
   tabs now match the DM's creator tabs (shared `tabVisuals` source)._ Still pending: restyle
   the card header/border, HP/initiative controls, and tab body to the new color language;
   primary vs secondary vs destructive buttons inside the card are still same-weight.
2. **Monster card (`core/ui/MonsterActorCard.tsx`).** Should adopt the GM-red identity and
   the section-accent language (Actions/Bonus/Reaction/Recharge/Traits) used elsewhere.
3. **Field editors feel like raw data-entry grids** — `ActorEditorActionTab`,
   `SpellTableEditor`, `ResourceTableEditor`, `EquipmentBagEditor`. Rows of same-weight
   inputs with little hierarchy. Add section headers, spacing, grouped cards, and carry the
   per-tab accent color into the field groups.
4. **Global palette is still ad-hoc inline hex.** Hundreds of inline `#7b68ee / #161622 /
   #2a2a3e / #0d0d14` values. Define design tokens (surfaces, borders, text tiers, accents)
   in `styles.css` and replace inline hex with tokens. Consolidate the repeated inline
   button styles into shared button-variant components (extend the `DM_BTN` idea).
5. **Monospace everywhere reads "developer tool."** Consider a UI font for headings/labels
   while keeping mono for numbers/dice.
6. **Equipment creation is not guided** like characters and monsters (no stepper/scaffold,
   no accents). Bring it up to the same guided-creator bar.
7. **Player-side view + seat picker** still use the old purple chrome; the player should
   see *their own seat color* prominently (card frame, header, "your turn" banner).
   — _Partial (minor pass 2026-06-07): the player's seat status bar now shows their seat
   color (rail + wash + label). Card frame / seat picker / "your turn" banner still pending._
8. **Approvals / Maintenance / Cleanup panels** are functionally fine but visually plain —
   give them the accent-header treatment and a clear primary action.
   — _Done for Cleanup (amber) + Maintenance (cyan) accent headers (minor pass 2026-06-07).
   Approvals panel header still pending; primary-action emphasis still pending._
9. **Combat tracker round/phase label** is still `#7b68ee`; align to the accent system.
   — _Done (minor pass 2026-06-07): phase label is green/amber/muted by phase; monster ⚔
   marker now uses the GM color._
10. **On-map token marker (SDK follow-up).** The seat color shows in the token *panel* and
    on cards/tracker, but the actual Owlbear token art is not yet tinted/starred with the
    seat color on the map. Would require attaching a marker item or aura to the token —
    investigate SDK support and cost before committing.
11. **ActorCard header initiative/HP controls** — dense and undifferentiated; needs the
    primary/secondary hierarchy pass.

---

## P-UX3 — Equipment Loot Pools / Library Gating / Token Menu Fixes (COMPLETE 2026-06-07)

Feature + bug-fix pass authorized by Christopher. Build stays green
(`tsc -b && vite build`, 4 entry points, 208 modules). **No P0 authority, room-metadata
shape, broadcast value, storage key, or combat logic changed.** Full blow-by-blow in
`_specs/LIVING-BUILD-LOG.md` (Post-P9 Session 3 + the fix entries that follow it).

### 1. Equipment condensed into per-boss / per-merchant collapsible views
- `EquipmentLibraryStandalone.tsx`: items group by `sourceEncounter` into **collapsible
  bands** (default collapsed; click ▶ to expand). Untagged items render flat under
  "Unsorted". A live filter auto-expands every group so matches are never hidden.
- `ItemForm` gained **Encounter / Boss / Merchant** + **Act Tag** fields; a gold banner
  shows the target loot pool when an item is created pre-tagged.

### 2. Loot pools tied to encounters
- `EncounterDefinition` gained `lootPool?: string` (the `sourceEncounter` tag whose items
  form the encounter's drops; defaults to the encounter name).
- The encounter editor has a **🎁 Loot Pool** section: a dropdown to choose an existing
  pool (distinct tags) or keep "this encounter", a list of the pool's items, and — when
  empty — a **+ Create loot for this encounter** button that jumps straight into equipment
  creation pre-tagged to the pool (`onCreateLootForEncounter`). Wired in `dm-panel.tsx`
  (`handleCreateLootForEncounter` switches to the Equipment tab + bumps `equipCreateSignal`;
  standalone monster panel uses a `?lootEncounter=` reopen fallback).

### 3. Create view separated from Manage library
- The DM Library panel is the **manage** view; its redundant in-panel create buttons are
  hidden (`hideCreate`). Creation is driven by the toolbar's **+ Party Character /
  + Monster / + Equipment**. ("+ Encounter" kept — no toolbar equivalent.)
- `EquipmentLibraryStandalone` gained `autoCreate`, `presetEncounter`, `createSignal`,
  `hideCreate`.

### 4. Module unlock only gates the Broken Chain library (My Library always open)
- **Bug:** `EncounterLibraryPanel` returned a full-screen lock wall when locked — a new DM
  couldn't create their own monsters/encounters without the code.
- New shared `core/campaign/moduleUnlock.tsx` — `isModuleUnlocked` / `unlockModule` /
  `lockModule`, `useModuleUnlock()` hook (with snap-back watcher), and an inline
  `ModuleUnlockPrompt` (code box + placeholder Patreon button). Extracted from the old
  inline copy so the monster + equipment panels share one source of truth.
- Both panels now show **My Library** (always open, no password) and a separate
  **🔒 Broken Chain Library** drawer.

### 5. Broken Chain section is a click-to-open drawer
- In both panels the **🔒 Broken Chain Library** row is collapsed by default; clicking it
  reveals the lock prompt (when locked) or the campaign content (when unlocked). "The
  locked panel lives behind the Broken Chain option."

### 6. Token Assignment panel — couldn't pick a seat / control
- **Bug:** `TokenAssignmentPanel` polled selection every 1s and reset the whole form on
  every tick for unbound tokens — wiping the seat choice and flipping "Seat can move" back
  to "DM-only" before Assign could be clicked.
- **Fix:** form fields only refill when the selection actually changes (guarded by a
  selection-signature ref); switched to event-driven `OBR.player.onChange` + slow fallback
  poll; relaxed save validation (only the seat is required — actor defaults to the seat's
  primary/first character); added a "no seats yet" empty-state hint.

### 7. Right-click token menu didn't appear (FOUR bugs, incl. the architectural one)
- **Wrong execution context (the real blocker):** the menu was registered from `App.tsx`,
  which is the OBR **action popover** (`manifest.action.popover = "/"`) — it only runs while
  open, so the menu never registered when the DM was working from the map. **Fix:** moved
  registration to a persistent **background page** (`src/background.ts` + `background.html`,
  new Vite entry, `manifest.background = "/background.html"`). OBR loads it invisibly for the
  whole session; it reads/subscribes room state to keep the per-seat "Assign to" entries in
  sync. Registration removed from `App.tsx`.
- **Icon URI rejected (`tokenContextMenu.ts`):** OBR validates icons with a strict URI
  check; the percent-encoded SVG data URIs failed with `"icons[0].icon" must be a valid
  uri` (seen in the console). Switched `svgDataUri` to **base64** data URIs.
- **GM Lock filter never matched:** `locked == false` doesn't match a token whose `locked`
  is `undefined`; changed to `locked != true`.
- **Teardown/re-sync race + readiness:** addressed during debugging (gate on
  `OBR.isReady`/`onReady`, no teardown-on-resync). Added `console.warn`/`info` diagnostics so
  any future registration failure (or background-page load) is visible.
- **Players could move tokens:** downstream of the above — with no working assign/lock path,
  nothing was ever `locked`. Menu live ⇒ "Assign / DM-only" calls `lockToken` (OBR enforces
  it). Honest limit: OBR `locked` is binary (no per-player movement flag); DM repositions via
  GM Unlock.

### 8. Security reality note (module unlock)
- A front-end-only gate **cannot** stop an experienced engineer: the unlock token,
  `unlockModule()`, and the campaign data all ship in the JS bundle. The derived-token +
  snap-back watcher only deter casual users. Real protection requires not shipping the
  content — gate it behind login + server-side entitlement (what the Patreon button stands
  in for). Documented in `moduleUnlock.tsx` + the Design/Security Backlog above.

### New / changed files (P-UX3)
- **New:** `src/background.ts` + `background.html` — persistent OBR background page that owns
  the token context menu (manifest `background`, Vite `background` entry).
- **New:** `core/campaign/moduleUnlock.tsx` (shared unlock logic + hook + inline prompt).
- `vite.config.ts` (+`background` input), `public/manifest.json` (+`background`),
  `public/_headers` (+no-cache for background).
- `core/ui/EquipmentLibraryStandalone.tsx` — encounter grouping, loot-pool tagging fields,
  create flow props, Broken Chain drawer + gate.
- `core/monsters/EncounterLibraryPanel.tsx` — loot-pool section, `lootPool`/`hideCreate`/
  `onCreateLootForEncounter` props, removed full-panel lock, Broken Chain drawer + gate.
- `core/monsters/encounterLibrary.ts` — added `lootPool?` to `EncounterDefinition`.
- `core/tokens/TokenAssignmentPanel.tsx` — selection-signature guard, onChange trigger,
  relaxed validation, empty-state.
- `core/tokens/tokenContextMenu.ts` — base64 icon URIs, `locked != true` filter, warn logs.
- `App.tsx` — split token-menu register/teardown effects + readiness gate.
- `dm-panel.tsx` — loot-pool create wiring, hideCreate/create props on library tabs.

---

## Build Location

Candidate:       candidates/0.6.0-clean-rebuild/source/  
Specs:           candidates/0.6.0-clean-rebuild/_specs/  
Rollback base:   candidates/0.5.8-actor-snapshot-monster-rollbox/source/  
P3 stable:       candidates/0.6.0-p3-stable/source/
P4 stable:       candidates/0.6.0-p4-stable/source/
P5 stable:       candidates/0.6.0-p5-stable/source/
P6 stable:       candidates/0.6.0-p6-stable/source/ (overwritten with post-fix build)
P7+P8 stable:    candidates/0.6.0-p7p8-stable/source/  
P9 stable:       candidates/0.6.0-p9-stable/source/ (REFRESHED 2026-06-08 to current canonical after full P0–P9 audit PASS; prior content backed up at candidates/0.6.0-p9-stable.pre-audit-bak/)  
0.6.2.7 stable:  candidates/0.6.2.7-stable/source/ (checkpoint snapshot of canonical at 0.6.2.7; ACTIVE editing + git + Cloudflare deploy stay in 0.6.0-clean-rebuild/source)  
Private actors:  candidates/0.6.0-clean-rebuild/source/src/private/  
Actor export:    candidates/0.6.0-clean-rebuild/source/fdmc-actor-library-export.json  

---

## Current Build State — What Is Built (2026-06-04)

### P1-P3 Core (Complete)
- FdmcRoomLiveState schema with HP/initiative/trackers/seats/monsters/ring buffer types
- useActorLiveState — HP writes to room metadata, subscribes cross-browser
- actorHydrationBoundary — three-layer merge (base + override + live)
- Seat system — seat-claim broadcast, DM actor library, player cache
- Actor editor — tabbed form, add/edit/remove/archive actions, level-up request flow
- Bond roll gate fixed — bond actions with damage prime through onPrimeRoll

### Actor Editor Tabs (Built beyond original P3 spec)
- **SpellTableEditor** — multi-slot level checkboxes, upcast notes, variable formulas
- **ResourceTableEditor** — table rows with Name/Pool/Reset/Note columns
- **EquipmentBagEditor** — bag/library system, attach/detach items, charge tracking
- **FormulaInput** — variable quick-insert buttons (@STR, @DEX, @PROF, @SPELL, @ATK)

### Formula Variable System
- @STR @DEX @CON @INT @WIS @CHA @PROF @SPELL @ATK in any formula field
- resolveFormulaVars() runs before Dice+ sends — uses derived stats (equipment + drain)
- deriveActorStats() — equipment stacks on base profile: setStat, addStat, setAC, addAC
- Drain integration — STR drain / life drain reduces effective score, @STR reflects it
- No hardcoded feat names — initiative bonus comes from metadata.initiativeBonus only
- No hardcoded spell names for healing detection — uses explicit metadata.outcomeMode

### Derived Stats + Equipment Effects
- EquipmentItem.statEffects[] — setStat, addStat, setAC, addAC, addHP, addSpeed
- AbilityScoreRow shows 21(9) format when equipment modifies a stat (purple highlight)
- AC display shows 18(16) when shield/armor modifies base AC
- Belt of Hill Giant Strength example: set STR to 21, formula @STR resolves to +5

### Resource + Spell Slot Tracking
- useResourceCounterState — tracks current remaining per named resource
- consumeSpellSlot() — decrements matching "Spell Slots LX" resource on spell commit
- consumeNamedResource() — decrements Channel Divinity, Rage, etc. on action commit
- Matched by label (fuzzy) — "Channel Divinity 2/LR" matched by "Channel Divinity" slotCost

### Roll System Fixes
- CommittedRollPanel auto-captures Dice+ result (no manual Hold click needed)
- RerollSourcePicker — scans items (effect.type=reroll) + features (tag="reroll") + DM Approved
- Shows both results (original + new), player picks either
- Outcome mode system: attack-roll / dc-check / ability-check / damage-only / healing / triggered / reference
- Healing spells: no hit/miss prompt, straight dice roll ("Roll Healing" button)
- Reference actions: no Roll button ever rendered
- Right-click to unready action before committing (ActionButton.onContextMenu)
- "Reset roll" link on commit-blocked actions — DM mode only, not on player cards

### DM Panel Windows (OBR Popovers)
- dm-panel.html — separate Vite entry point for all DM tools
- Seats / Edit Actors / Monsters / Equipment / Maintenance as full-height popover windows
- Positioned right edge using anchorReference: "POSITION"
- disableClickAway: false — clicking map closes actor cards
- Actor card toggle — second right-click closes the popover
- Close All button — closes all DM panels simultaneously
- One DM panel at a time — opening new panel closes previous

### Actor Library (Private, Not Bundled)
- src/private/ — 5 party actors (klydon.ts, kolakanathi.ts, lights_stone.ts, lyrielle_new.ts, vaelith_new.ts)
- Ward items — 6 campaign items with charges and effects (src/private/wardItems.ts)
- npm run generate-export — builds fdmc-actor-library-export.json
- Edit Actors → ↑ Import → pick JSON → ↺ Sync Library

### Encounter Library + Monster System
- EncounterLibraryPanel — campaign module lock (code: "brokenchain")
- Dual library: Campaign Library (locked) + My Library (personal)
- Staged encounter queue — pre-stage Wave 2, send to combat when ready
- encounterLibrary.ts — seed from templates, spawn instances, charge per encounter
- Monster nameplate grid (MonsterSelector) — shows AC/HP/condition tiles
- dmMonsterLibrary.ts + normalizedToTemplate() adapter

### Seat System Extensions
- Viewer seat — always available, read-only combat view (no interactive card)
- Viewer sees actor nameplates, monster nameplates, combat log
- "Leave viewer" restores seat selection
- Player seat selection screen — self-select, auto-claim single open seat
- "▶ Players Join" DM button — broadcasts seats-ready, players auto-refresh
- Seat status covers loading → shows "Connecting..." instead of empty library

### Combat Tracker (P4 Part 1 — Built)
- CombatTracker component — sorted turn order, initiative editable inline
- Companion initiative — companions inherit owner's initiative (Faelar = Lyrielle)
- Companion display — sub-entry under owner "└ Faelar acts on Lyrielle's turn"
- ⇅ Swap button — DM swaps two combatants' initiative (Alert feat, class features)
- ⚡ Mid-combat initiative prompt — new monsters flag for initiative before slotting
- Start Combat / Next Turn / End Combat — full phase management
- handleStartCombat → sorts, sets Round 1, activates first combatant
- handleNextTurn → resets action economy, advances active ID, increments round on wrap
- patchCombat() writes phase/activeActorId/round to room metadata (cross-browser)

### Infrastructure
- Stable Cloudflare filenames (main.js, styles.js — no hash)
- manifest.json v0.6.0 with icons in dist/
- _headers file — Cache-Control: no-cache for all assets
- OBR.popover API used directly (typed, no casting)
- broadcastLibraryUpdate() — DM panel notifies main window on actor save
- ↺ Sync Library button — manual reload from localStorage

---

## What Is NOT Yet Built (Remaining Work)

### P4 — Complete
- monster-popout.html / monster-popout.tsx — OBR popover entry, cold-boots from ?instanceId=
- useMonsterPopout.ts — reads template from localStorage (monsterRosterStorage), HP from room metadata
- monsterRosterStorage.ts — DM localStorage for full monster instances (saveMonsterRoster / loadMonsterRoster / clearMonsterRoster)
- addMonsterInstance now writes FdmcMonsterLiveState to room metadata + full instance to localStorage
- updateMonsterInstance now writes HP changes to room metadata via patchMonsterHp
- removeMonsterInstance now deregisters from room metadata via deregisterMonsterInstance
- onOpenMonsterCard wired to open OBR popover (monster-popout.html?instanceId=xxx)
- Encounter wipe writes monsterLiveState:{}, combat reset, recentEvents wipe to room metadata; broadcasts fdmc:action-economy-reset
- MonsterActorCard.onActionCommit — fires when action committed, logs to combat log
- MonsterActorCard listens for fdmc:monster-turn-reset broadcast — clears usedActionKeys on turn advance
- handleNextTurn broadcasts fdmc:monster-turn-reset when advancing past a monster's turn

### P1-P6 Manual Test Results + Fixes (2026-06-04)

#### Test Sheet: `_specs/P1-P6-MANUAL-TEST-SHEET.md`
Retest after next deploy. Items marked with (FIXED) were addressed this session.

#### P1 — PASS 5/5
All state architecture checks passed. No fixes needed.

#### P2 — PASS 9/9
All seat system checks passed including viewer seat, refresh persistence, and seat picker flow.
Additional fixes applied this session:
- Seat auto-claim on single open seat REMOVED — players always choose their seat
- `releaseSeat()` added — returns to seat picker without page reload, suppresses auto-reclaim (`browsingRef`)
- DM "Kick" button added to SeatAssignmentPanel — clears binding from room metadata, player returns to seat picker
- "← Change Seat" button on viewer bar and "← Seats" button on seated player bar

#### P3 — PARTIAL (fixes applied, retest required)
Failures: P3.2, P3.3, P3.4, P3.6 (actor edits not broadcasting), P3.8 (no archive from list), P3.9 (no player level-up UI)
Notes: "edits do not save unless DM reloads but players do not get changes unless DM takes the actor away and gives it back"

Fixes applied:
- (FIXED P3.2/3/4/6) `handleActorEditorSave` now always calls `upsertActorInLibrary + setActorLibrary + pushActorsToAllSeats + broadcastLibraryUpdate` — edit broadcasts to players immediately on save
- (FIXED P3.8) Archive button added directly on actor list row in dm-panel — no need to open editor
- (FIXED P3.9) ⬆ Level button in player status bar opens `LevelUpRequestPanel` inline
- (FIXED P3.11/12) DM reconnect/reload now auto-pushes current actor library to all seated players (1.5s delay after seats load) — covers saves from previous sessions

#### P4 — PARTIAL (fixes applied, retest required)
Failures: P4.7 (economy sync between popout/inline), P4.8 (economy reset timing)
Notes:
- P4.7: "only on the card they are viewing, inline needs to be hidden unless pop-out fails"
- P4.8: "should reset on next time that monster/player's turn happens, not when they leave"

Fixes applied:
- (FIXED P4.7) Inline MonsterActorCard now only renders when `!OBR.isAvailable` — when OBR is active the popout is the only card; economy sync between popout↔inline via `MONSTER_ECONOMY_CHANNEL` was already in place
- (FIXED P4.8) ALL economy resets (actor + monster) now happen on TURN START not turn end — `resetActorTurn` moved from "current leaves" to "next combatant enters"; monster reset same pattern; dots persist through full round until that combatant's name highlights again

#### P5 — PARTIAL (fixes applied, retest required)
Failures: P5.2 (same as P3 broadcast), P5.11 (filter bug), P5.16 (loot delivery)
Notes:
- P5.10: Equipment not password-protected — NOT a spec requirement, 🔒 badge = locked from editing, not module-gated
- P5.11: Rimecleaver shows when filtering Act 1 ("+1" in name matches single-char "1" search)
- P5.16: Player doesn't receive loot delivery message

Fixes applied:
- (FIXED P5.2) Covered by P3 actor broadcast fix
- (FIXED P5.11) Equipment name filter now requires 3+ chars before matching names — short searches only match act/encounter fields
- (FIXED P5.16) Added `fdmc:loot-delivery` listener in player mode — shows 🎁 green toast for 6s + logs to combat log

P5.17-20 (Resources tab, Short Rest, Long Rest, Spell slot decrement) — NOT YET RETESTED

#### P6 — NOT YET TESTED
Token assignment flow requires manual OBR session test. No test results recorded.
Additional fixes applied this session based on observed behavior:
- Viewer mode: viewer party broadcast added — viewers now see actor nameplates (name + HP condition)
- Flag 1: My Token button only shows when player's viewerSeatKey appears in a seat binding
- Flag 2: Economy strip on non-active player's panel shows ⏳ [Name] + that actor's dots during their turn
- Flag 3: Viewer "Leave viewer" → uses `releaseSeat()` not page reload

#### P1-P5 Audit — All Complete (2026-06-04)
Gaps found and fixed in audit pass:
- patchMonsterHp() added to fdmcRoomLiveState.ts + FdmcMonsterLiveState.hp field added
- updateMonsterInstance() now calls patchMonsterHp → monster HP survives DM reload from room metadata
- Monster popout HP broadcast gap fixed: commitHp → MONSTER_POPOUT_HP_CHANNEL → App.tsx syncs + re-broadcasts to players
- isActiveTurn prop added to ActorCard — gates main/bonus/bond actions when not active turn during combat; reactions always open
- initiativeBonus field added to feature/action editor (PcActionDraft + ActionForm + pcActionAdapters)
- statEffects configuration UI added to equipment ItemForm
- ActorCard encoding fixed: Â· → · (3 locations), Checks â–¼/â–¶ → ▼/▶
- Actor seed version bumped to force re-seed from correct UTF-8 source
- seedActorLiveState HP repair: detects 1/1 stored HP and fixes from actor definition max
- buildCombatants now reads live HP from liveHpByActorId — combat tracker shows actual current HP
- Monster economy broadcast (MONSTER_ECONOMY_CHANNEL) from MonsterActorCard dots and action commits
- Context-aware economy strip: switches between actor 5-dots and monster 2-dots by active combatant
- Monster economy resets on Next Turn (broadcast + local clear)
- Players request monster roster on join; DM re-sends current roster
- Player refresh keeps actor card visible when seatActors.length > 0
- Viewer seat bug fixed: viewer state not overwritten by seat binding effect
- Actor-popout rest props (Short/Long Rest) wired
- Auto-claim skips viewer-mode seats
- Monster HP max sync in useEffect (fixes 47/75 → 47/47)

### P6-P8
- Token assignment (P6) — binding, lock model, DM owns all
- Ring buffer event log I1-I7 (P7) — Act 2 monster content is NOT a build phase; populates through library UI / JCON pack import
- Export + post-combat stats (P8)

### P9-P12 (Post-P8, Blueprint Features)
- P9: Actor-side initiative notes display (F09), bonus action completeness audit overlay (F03)
- P10: Standard Nat 1 critical failure table (F01), Advantage/Disadvantage roll mode (F04 — depends on F01 kept-die detection)
- P11: Spell upcast + slot spend runtime bridge (F02 runtime — depends on F05 schema from P5), actor log concentration name display (F08)
- P12: Granted effects + transferable charges (F06), enemy opening window player-response side (F07 — depends on F01)

---

## P9 Pre-Work Flags (fix after live-session bugs cleared, before P9 spec)

- **Export button** — ✅ DONE 2026-06-11. `CombatLog.tsx` Export now downloads the full encounter log as JSON (`fdmc.encounter-log.v1`), disabled only when the log is empty.
- **Initiative button removed from actor card** — staged but not committed (held for P8 batch). Dice+ initiative bridge is P9 scope.
- See `_specs/P8-UX-FLAGS.md` for full P8 queue (items 1–10).

---

## How to Resume Next Session

1. Read MASTER.md (this file) for current state
2. Check Phase Completion Log — phases marked RETEST REQUIRED need manual test before contract lock
3. Current build: `candidates/0.6.0-clean-rebuild/source/` — always run `npm run build` to verify zero errors
4. Manual test sheet: `_specs/P1-P6-MANUAL-TEST-SHEET.md` — work through 0-rated items and notes
5. Stable snapshots: P5 at `0.6.0-p5-stable/source/`, P6 at `0.6.0-p6-stable/source/`
6. Contract files: NOT YET WRITTEN — waiting for Christopher manual sign-off on P1-P6
7. Next phase: P7 (Ring Buffer Event Log) — do not start until P3/P4/P5 retest passes
8. Cloudflare deployment: upload entire `dist/` folder after any build
9. npm run generate-export: regenerate actor JSON if private actors changed

### Current Outstanding Issues (as of last session)
- P3 retest: actor edit → broadcast → player receives (was broken, fix applied)
- P4 retest: economy dots reset on turn START (fix applied), inline monster card hidden when popout active (fix applied)
- P5 retest: loot delivery toast (fix applied), equipment filter (fix applied), Resources tab 17-20 (not yet tested)
- P6 full test: token assignment, lock model, player move — NOT STARTED
- Short Rest / Long Rest on Resources tab (P5.17-20) — needs in-session test
- Seat system flags: viewer party data, seat change, DM kick — fixes applied, need retest

---

## Do-Not-Build Boundaries (Permanent)

- Full D&D character creator  
- Automatic class progression database  
- Official spell database  
- Rules validator / legality checker  
- Auto-hit / auto-damage resolver  
- D&D Beyond clone  
- Official monster database clone  
- Public CR calculator  
- Universal VTT adapter ecosystem  

---

## Phase Spec Files

| File | Phase |
|------|-------|
| P0-SALVAGE.md | Salvage checklist |
| P1-SPEC.md | State architecture |
| P2-SPEC.md | Seat system |
| P3-SPEC.md | Actor editor |
| P4-SPEC.md | Monster pop-out + encounter wipe (original spec — combat tracker added to P4 scope) |
| P5-SPEC.md | Library view |
| P6-SPEC.md | Token assignment |
| P7-SPEC.md | Ring buffer event log (Act 2 content via library, not a build phase) |
| P8-SPEC.md | Export + post-combat stats |
| P9-SPEC.md | Actor profile hardening (F09, F03) — to be written after P8 |
| P10-SPEC.md | Roll flow: Nat 1 table + Adv/Dis (F01, F04) — to be written after P8 |
| P11-SPEC.md | Spell bridge runtime + log polish (F02 runtime, F08) — to be written after P8 |
| P12-SPEC.md | Cross-actor effects + enemy opening (F06, F07) — to be written after P8 |
