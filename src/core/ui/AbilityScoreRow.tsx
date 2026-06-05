import type { AbilityId, AbilityScore, AbilityScores } from "../types/actor";
import type { DerivedStats } from "../state/deriveActorStats";
import { formatDerivedScore, formatModifier as formatDerivedModifier } from "../state/deriveActorStats";

const abilityOrder: AbilityId[] = ["str", "dex", "con", "int", "wis", "cha"];

const abilityLabels: Record<AbilityId, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

function getModifier(score?: AbilityScore) {
  if (!score) return null;
  if (typeof score.modifier === "number") return score.modifier;
  if (typeof score.score === "number") return Math.floor((score.score - 10) / 2);
  return null;
}

function formatModifier(modifier: number | null) {
  if (modifier === null) return "—";
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

function formatScore(score?: AbilityScore) {
  if (typeof score?.score === "number") return `${score.score}`;
  return "—";
}

type AbilityScoreRowProps = {
  abilityScores?: AbilityScores;
  /** If provided, shows derived (equipment-modified) values instead of base */
  derivedStats?: DerivedStats;
};

export function AbilityScoreRow({ abilityScores, derivedStats }: AbilityScoreRowProps) {
  return (
    <section className="ability-score-row" aria-label="Ability scores">
      {abilityOrder.map((abilityId) => {
        const derived = derivedStats?.[abilityId];

        if (derived) {
          // Show derived stats from equipment
          return (
            <div
              className="ability-score-box"
              key={abilityId}
              title={derived.isModified ? `Base: ${derived.baseScore} · Modified by: ${derived.modifiedBy}` : undefined}
            >
              <span className="ability-label">{abilityLabels[abilityId]}</span>
              <strong
                className="ability-score"
                style={derived.isModified ? { color: "#7b68ee" } : undefined}
              >
                {formatDerivedScore(derived)}
              </strong>
              <span className="ability-modifier">
                {formatDerivedModifier(derived.modifier)}
              </span>
            </div>
          );
        }

        // Fallback: plain base stats
        const score = abilityScores?.[abilityId];
        const modifier = getModifier(score);

        return (
          <div className="ability-score-box" key={abilityId}>
            <span className="ability-label">{abilityLabels[abilityId]}</span>
            <strong className="ability-score">{formatScore(score)}</strong>
            <span className="ability-modifier">{formatModifier(modifier)}</span>
          </div>
        );
      })}
    </section>
  );
}
