# Runtime-unreachable, archived 2026-08-24

Moved here by `CLEANUP-V4-PLAN.md` §4. **Nothing here was deleted** — git holds the full history
either way, so this folder exists for reading, not for safety.

Every file was verified to have **zero importers** across `src/` and `scripts/` immediately before
the move, and the build plus all seven checks passed after it. Nothing outside `src/` is compiled:
`tsconfig.json` includes only `src`, and every Vite entry is a root HTML file.

| Folder | Files | Why it was unreachable |
|---|---|---|
| `monster-state/` | 6 | The Sunday shared-monster proof. A closed island — every importer was another file in the same folder, and nothing outside imported any of it. |
| `ui/` | 2 | `MonsterJconBuilder`, `MonsterWarningsPanel` — superseded by the Monster Creator / Template Editor. |
| `engine/` | 2 | `types/module.ts` (module schema types, never referenced); `buildProvenance.ts` (constants, and its `buildLabel` had drifted to `0.7.33`). |
| `module-content/` | 4 | Superseded campaign content: `bonds.ts` is the pre-v13 flat bond table replaced by the v13 ladder; `drainTrackers`, `pinnedReactions`, `act2Encounters`. |

## Before deleting any of it

⚠ **`buildProvenance.ts` is a decision, not a leftover.** It carries publisher/ownership metadata
with a version string that was already stale. Either wire it to `package.json` or delete it — do not
restore it as-is, or a wrong version ships the first time something reads it.

⚠ **`module-content/` is campaign content (RULE 3), which is Christopher's layer.** It was archived
on his instruction to execute the plan, not on a judgement that the campaign no longer wants it.

The rest can be deleted once a session of play has passed without anyone reaching for it.
