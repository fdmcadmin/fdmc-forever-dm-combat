/**
 * ThreatHpBar — the one HP bar used by the roster, the DM's player-view pane, and the
 * players' own tracker overlay.
 *
 * Two jobs:
 *
 *  1. **Give the side panes their space back.** A roster entry used to spend three rows
 *     (name / "31 / 45 HP" / bar). The compact form puts the readout inline with the name
 *     and drops the bar to 3px, which is ~22px per creature — real money across a roster.
 *
 *  2. **Make a boss read as a boss.** Same bar shape at every tier (Christopher: "same
 *     bar"), but from mid-boss up it gets taller, takes a tier colour, gains a marker and
 *     a soft outer glow. Players should feel the difference across the table without
 *     being told a number.
 *
 * REVEAL-GATED. `tier` must only be passed once the creature's name is revealed —
 * otherwise the heavy bar telegraphs "this one is the boss" while it is still standing
 * there as "Something Standing That Shouldn't". Callers building player-facing payloads
 * are responsible for withholding it; see `playerSafeTier`.
 */

import type { MonsterClassification } from "../monsters/runtime/mainMonsterRuntime";

/** Tiers that get the heavy treatment. Below this a creature is just a health bar. */
const HEAVY_TIERS: readonly MonsterClassification[] = ["mid-boss", "act-boss", "final-boss"];

export function isHeavyTier(tier?: MonsterClassification | null): boolean {
  return !!tier && HEAVY_TIERS.includes(tier);
}

/** Per-tier accent for the heavy bar. Escalates toward the final boss. */
const TIER_ACCENT: Partial<Record<MonsterClassification, string>> = {
  "mid-boss": "#e0913a",
  "act-boss": "#e0553a",
  "final-boss": "#d13ae0",
};

const TIER_MARK: Partial<Record<MonsterClassification, string>> = {
  "mid-boss": "◆",
  "act-boss": "✦",
  "final-boss": "✷",
};

export function tierAccent(tier?: MonsterClassification | null): string | undefined {
  return tier ? TIER_ACCENT[tier] : undefined;
}

export function tierMark(tier?: MonsterClassification | null): string | undefined {
  return tier ? TIER_MARK[tier] : undefined;
}

/**
 * The tier a PLAYER-facing payload may carry: only once the name is revealed. Keeping
 * this decision in one function stops each call site from re-deciding it and leaking.
 */
export function playerSafeTier(
  tier: MonsterClassification | undefined,
  isNameRevealed: boolean,
): MonsterClassification | undefined {
  return isNameRevealed ? tier : undefined;
}

/** Standard HP colour ramp — matches the rest of the app. */
export function hpRatioColor(ratio: number): string {
  if (ratio <= 0) return "#5a5a6a";
  if (ratio <= 0.25) return "#ff5840";
  if (ratio <= 0.5) return "#e0913a";
  if (ratio <= 0.75) return "#e0c93a";
  return "#4bb469";
}

type ThreatHpBarProps = {
  /** 0..1. Callers that must not reveal exact HP pass a ratio only. */
  ratio: number;
  /** Reveal-gated threat tier. Undefined / normal tiers render the compact bar. */
  tier?: MonsterClassification | null;
  /** Dead creatures grey out regardless of tier. */
  isDown?: boolean;
};

export function ThreatHpBar({ ratio, tier, isDown }: ThreatHpBarProps) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const heavy = isHeavyTier(tier) && !isDown;
  const accent = heavy ? tierAccent(tier) : undefined;
  const fill = isDown ? "#5a5a6a" : hpRatioColor(ratio);

  if (!heavy) {
    // Compact: 3px, no frame, no glow. This is the default for every ordinary creature.
    return (
      <div style={{ height: 3, background: "#1c1c2c", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: fill, transition: "width 0.25s" }} />
      </div>
    );
  }

  // Heavy: taller, tier-framed, with an outer glow so it separates from the stack of
  // ordinary bars above and below it.
  return (
    <div
      style={{
        height: 8,
        background: "#14141f",
        borderRadius: 4,
        overflow: "hidden",
        border: `1px solid ${accent}`,
        boxShadow: `0 0 6px ${accent}55`,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${fill}, ${accent})`,
          transition: "width 0.25s",
        }}
      />
    </div>
  );
}
