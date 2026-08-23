# Forever DM Combat — Architecture

Forever DM Combat is a **React + TypeScript Owlbear Rodeo extension** for running combat at a
table. It is built around a manual-first flow: the app tracks state, presents what a player or DM
needs to act, and rolls what they ask for. It does not resolve turns for them.

## Shape

A **Vite multi-entry build**. Each window the extension can open is its own HTML entry with its own
React root, so a popout carries only the code it needs and can be open beside the others.

| Entry | Window |
| --- | --- |
| `index.html` | the main action popover, anchored to the Owlbear toolbar |
| `dm-panel.html` | DM tools — actors, monsters, equipment, seats, balance |
| `combat-window.html` | the DM combat view: encounter roster, active creature, player view |
| `actor-popout.html` | one character sheet as its own window |
| `monster-popout.html` | one creature card as its own window |
| `levelup-popout.html` | level presets and the level-up request flow |
| `player-tracker.html` | turn order and party HP, for a player screen |
| `background.html` | context-menu registration; runs whether or not a window is open |

## State, and who may write it

Three tiers, and which one a fact belongs to is decided by **who needs to see it**:

- **Room metadata (`core/table-state/`)** — everything the table shares: combat phase and round,
  actor HP, initiative, seat bindings, the party purse. The **GM client is the single writer**; a
  player seat asks and the GM performs. That is what stops two browsers disagreeing about HP.
- **Broadcast channels** — live, per-session signals that need no history: readied actions, monster
  economy, dice results, turn resets.
- **Browser storage** — private prep and drafts: the DM's monster and equipment libraries, level
  presets, editor drafts, the encounter log.

Anything table-visible goes in the first tier. Anything a DM is still working on stays in the third
until it ships to the room.

## Layers

The engine runs a d20 game; a **module** is one way of using it.

- **Engine** (`core/`) — actions and action economy, resources and reset tiers, rolls and the dice
  bridge, seats, storage, import/export, the editors. Nothing here assumes 5e.
- **D&D mod** — 5e's answers: the creature estimator, the encounter checker's base model, SRD
  equipment, weapon masteries.
- **Campaign module** (`modules/the-broken-chain/`, `data/broken-chain/`) — one campaign's
  monsters, equipment, bonds, encounters and loot.

A different system would ship its own mod and the engine would not notice.

## What it deliberately is not

A rules database, an automatic hit/damage resolver, a character creator, or a clone of any
commercial toolset. Creatures, items and characters are **authored** — by hand, in the app's own
editors — and the app prices and presents what was authored.

## Building

```bash
npm install
npm run build      # tsc -b, then vite build, then stage dist/
npm run dev        # vite dev server
```

`@owlbear-rodeo/sdk` is required runtime infrastructure: room metadata, popovers, broadcast and the
extension bridge all go through it.
