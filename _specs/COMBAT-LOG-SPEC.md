# Combat Log & Encounter Summary — working spec

**Status:** partially shipped · **Live at:** 0.6.9.1 · **Owner decisions:** Christopher
**Why it matters:** export is a headline feature for the future subscription tier. A flat
transcript can be read once; totals answer *"who actually carried that fight"*, and only a
structured log can produce them.

> **RESUME CHECKPOINT — read this first**
>
> Done: structured entry model, attribution helper, summary aggregator, summary panel in
> the log, export payload, and the DM-adjusts-HP path feeding it.
> Next: **three wiring passes** — committed attack/damage rolls, healing, resource spends.
> See [§7 Remaining work](#7-remaining-work). Nothing else is blocked.

---

## 1 · The two logs (read before touching anything)

There are **two independent logs** and they are easy to confuse. Most of the wiring
difficulty in this build came from writing to the wrong one.

| | `CombatLogEntry` | `EncounterLogEntry` |
|---|---|---|
| Defined in | `core/types/combatLog.ts` | `core/events/encounterLog.ts` |
| Written by | `addEntry()` from `useCombatLog()` | `appendLogEntry()` |
| Stored | in-memory, session | `localStorage` (`fdmc.dm.encounterLog.v1`) |
| Shown in | **`CombatLog.tsx`** + `RecentEventsWidget` | not rendered directly |
| Carries | narrative + structured facts | short `code`, `val`, `type` |
| **Feeds the summary** | **YES** | no |

**The summary reads `CombatLogEntry`.** `logHpChange` originally wrote only to
`EncounterLogEntry`, which is why the panel shipped correct and empty — the aggregation had
nothing to aggregate. Any new event that should count toward totals **must** go through
`addEntry`.

`EncounterLogEntry` keeps its `code` shorthand deliberately: **shorthand goes to the dice
broadcast, the expanded sentence goes to the tracker** (Christopher). They are not
duplicates of each other.

---

## 2 · Data model

`CombatLogFacts` (in `core/types/combatLog.ts`) is mixed into both `CombatLogEntry` and
`AddCombatLogEntryInput`. Every field is optional and purely additive — all ~50 existing
`addEntry` call sites still compile untouched.

```ts
actorId?      // WHO ACTED. Names collide and get renamed; totals need an id.
actorSide?    // "party" | "monster"  — companions count as PARTY
targetId?
targetName?
targetSide?   // the TARGET's side, or a damaged monster lands in "Unassigned"
amount?       // damage / healing / resource points — ALWAYS POSITIVE
category?     // "damage" | "healing" | "resource" | "roll" | "flow"
sourceKind?   // "action" | "bonus" | "reaction" | "legendary" | "free"
turnOwnerId?  // whose turn it happened during, when that differs from the actor
turnOwnerName?
attribution?  // "attributed" (from a card's button) | "inferred" (from active turn)
round?
naturalRoll?  // the d20, for the sentence
outcome?      // hit / miss / crit / fumble / save-made / save-failed
damageType?
slotLevel?
riders?       // string[] — Hunter's Mark, Sacred Weapon, bond dice…
```

**`amount` is always positive.** Direction comes from `category`, never from the sign.
The old `type: "hp-change"` could not distinguish damage from healing, which is why three
of the four requested stats were not computable.

---

## 3 · Attribution — the core rule

> **A reaction or legendary action fires during SOMEONE ELSE'S turn.**
> Crediting events by "whose turn is it" hands a PC's opportunity-attack damage to the
> monster it interrupted, and silently corrupts every total built on top of it.

`attributeEvent()` in `core/events/encounterLog.ts` concentrates this decision so no call
site can re-derive it wrongly:

- **Came from a card's button** → `actorId` is exact, `attribution: "attributed"`.
  **Every reaction qualifies**, because a reaction is only ever committed from a button.
  When the actor differs from the turn owner, `turnOwnerId` records whose turn it
  interrupted — that is what makes the narrative line readable.
- **No card behind it** (a bare HP adjustment) → falls back to the active turn and is
  marked `attribution: "inferred"`.

Inference is **surfaced, never hidden**: the panel puts `~` on affected rows and footnotes
the count. A total resting partly on manual HP tweaks is a different claim from one built
from committed rolls, and the export must be able to say which.

---

## 4 · Locked decisions

| Decision | Rationale |
|---|---|
| **Companions count as party** | Faelar's damage is the ranger's damage. |
| **Slots valued by LEVEL, not count** | A warlock has two slots and would be structurally incapable of winning "most resources" if each spend counted as one. Slot level is the baseline unit; sorcery points and other class resources measure against the same scale. |
| **Leaders are PARTY-scoped** | Computed over the whole field the boss wins nearly every time — it is the thing all five PCs are fighting and the only thing swinging back at all of them. Verified: the Wight took "most damage dealt" off Ripsnarl 45→40 and "most damage taken" off Iskarn 49→31. Monsters keep their own table with real totals. Falls back to the whole field when nothing declares a side, so older logs still produce leaders. |
| **Summary lives in the log panel** | Where the log already lives (Christopher). Renders when the log is expanded. |
| **Shorthand for dice, expanded for tracker** | `code` stays on `EncounterLogEntry` for the dice broadcast; the full sentence is rendered from facts. |
| **Log spans initiative → End Combat** | Start Combat no longer clears. See §6. |

---

## 5 · The five stats

| Stat | Computed from |
|---|---|
| Most damage dealt | Σ `amount` where `category: "damage"`, by `actorId` |
| Most damage taken | Σ `amount` credited to `targetId` |
| Most healing | Σ `amount` where `category: "healing"` |
| Most resources | Σ `amount` where `category: "resource"` — **slot level, not 1 per spend** |
| Actions per combatant | count by `sourceKind`, shown **A · B · R · L** |

`summarizeEncounter(entries)` in `core/combat-log/encounterSummary.ts` is pure and fully
tested. Action counts come from `sourceKind` independent of `amount`, so **a miss still
counts as an action spent** — which is the point, since action economy is what blurs.

---

## 6 · Capacity (shipped 0.6.8.2)

Two bugs, both worst exactly where the log matters most.

**Initiative was being destroyed.** Initiative rolls *are* logged, during the setup phase —
and `handleStartCombat` then called `clearEncounterLog()`, wiping them before the fight
they belong to began. The tracked window is supposed to *start* at the first initiative
roll and never contained its own opening. Start Combat no longer clears; Combat Start /
Combat End system markers delimit sessions for export segmentation, and the DM clears by
hand from the log panel.

**Truncation scaled with action economy.** The cap was 150, oldest dropped first. One
attack is already **three** entries (attack roll, damage roll, HP change), so the count
grows with action economy — precisely where high-level combat blurs. Long fights silently
lost their opening rounds.

The cap is now **2500**, derived rather than guessed (the derivation is in the file):

```
11 combatants × 8 rounds (ABSOLUTE_ROUND_CAP) × ~22 entries/turn ≈ 1,940
  + legendary actions, initiative rolls, system markers            ≈ 2,050
```

Measured: a full 2500-entry log is **321KB** against a ~5MB localStorage budget, so there
is room to raise it if a real fight proves the estimate low.

---

## 7 · Remaining work

Three wiring passes. All mechanical; the model and aggregation are done and tested.

### 7a · Committed attack / damage rolls — **highest value**
Turns the `~` inferred rows into attributed credit **and fixes the reaction case end to
end**. Sites: `ActorCard.tsx` and `MonsterActorCard.tsx` `handleCommit` / `completeCommittedRoll`.

Emit on damage commit:
```ts
addEntry({
  actorId, actorSide, actionName,
  targetId, targetName, targetSide,
  amount, category: "damage", damageType,
  sourceKind,                       // "action" | "bonus" | "reaction" | "legendary"
  turnOwnerId, turnOwnerName,       // when it differs from the actor
  attribution: "attributed",
  naturalRoll, outcome, slotLevel, riders, round,
});
```
Use `attributeEvent()` rather than hand-rolling the actor/turn-owner decision.

### 7b · Healing
Same shape with `category: "healing"`. Cure Wounds, Lay on Hands, Second Wind, Protector.

### 7c · Resource spends
`category: "resource"`, `amount` = **slot level** (a 3rd-level slot = 3). Non-slot pools
(Rage, Ki, Psionic Energy, sorcery points) measure against that same scale. Hook into
`consumeActionResourcesOnCommit` / `useResourceCounterState`, which already know what was
spent and how much.

### 7d · Narrative rendering (not started)
Render the sentence **from the facts** rather than storing only a string — that is what
keeps an export re-aggregatable. Target reads:

> *Wendigo Wight's turn.*
> *↳ Raphael cast Fireball (3rd level), DC 15 DEX — Wendigo Wight failed, 24 fire damage.*
> *↳ Ripsnarl's 2nd attack with Greataxe +1 — rolled 18, hit, 17 slashing.*
> *↳ Iskarn used Protective Field (reaction), reducing 18 cold to 11.*

`turnOwnerName` + `sourceKind` are what make the interjected lines legible — the exact
moment high-level combat blurs, and the thing a flat log cannot reconstruct afterwards.

---

## 8 · Gotchas found the hard way

- **Two logs.** Writing to `appendLogEntry` does not feed the summary. See §1.
- **The panel only renders when the log is EXPANDED** (`isExpanded` defaults false). A
  render test against `<CombatLog>` will see nothing; test `EncounterSummaryPanel` directly
  — it is exported for this reason.
- **`amount` must be positive.** Passing a negative delta silently subtracts from a total.
- **Set `targetSide` as well as `actorSide`**, or damaged combatants land in "Unassigned".
- **Leaders being party-scoped is deliberate.** If a test expects the boss to top damage
  dealt, the test is wrong — check §4.
- **`\b` inside a `new RegExp("…")` string is a backspace, not a word boundary.** This
  caused a real data bug during the identity migration (duplicate object keys).
- Bash heredocs eat `\\(` and `\\s` in regex literals — write regexes via `Edit`, not a
  generated script.

---

## 9 · Shipped log

| Version | What |
|---|---|
| 0.6.8.2 | Log spans initiative → End Combat; cap 150 → 2500 with derivation |
| 0.6.8.3 | `attributeEvent()` + attribution fields — reactions credit the reactor |
| 0.6.9.0 | `summarizeEncounter()`, summary panel in the log, export carries totals |
| 0.6.9.1 | DM HP adjustments feed the summary; `targetSide`; companions = party |

**Test coverage:** 17 aggregator, 12 attribution, 10 panel render, 11 capacity, 9 end-to-end.
All pure functions — no framework harness required, run via `tsc` transpile + node.
