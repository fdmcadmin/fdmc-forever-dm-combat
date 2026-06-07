import { MONSTER_COLOR } from "../seats/seatColors";

/**
 * FDMC accent tokens — the semantic colors the DM/navigation chrome uses to
 * signal *intent*, defined once so "create is green / use is blue / fix is cyan"
 * doesn't drift across files.
 *
 * Scope boundary:
 *  - Seat identity colors live in `core/seats/seatColors.ts`.
 *  - Per-character-tab accents live in `core/ui/tabVisuals.ts`.
 *  - This module is for DM-tool buttons, panel headers, and library/seat tabs.
 */
export const FDMC_ACCENTS = {
  create: "#34c759",   // build something new
  use: "#7db1ff",      // open / navigate existing tools (party / library)
  session: "#2a6e2a",  // broadcast / "go" action
  cleanup: "#e0b85a",  // tidy the encounter
  fix: "#6fe0e0",      // maintenance — only if something is broken
  approval: "#e0b85a", // pending approvals
  danger: "#ff5840",   // destructive
  seats: "#34c759",    // seat tools
  equipment: "#c0a062",// equipment
  monster: MONSTER_COLOR, // GM / monster family — mirrors the seat-system monster color
} as const;
