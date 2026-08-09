import type { AbilityId, AbilityScore, AbilityScores } from "../types/actor";
import type { DerivedStats } from "../state/deriveActorStats";
import { formatDerivedScore, formatModifier as formatDerivedModifier } from "../state/deriveActorStats";
import { abilityModifier, savingThrowModifier } from "../rules/dnd5e";

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
  if (typeof score.score === "number") return abilityModifier(score.score);
  return null;
}

// The saving-throw modifier: proficiency is a FLAG that adds the proficiency bonus, so the
// save follows the score and the level on its own. An explicit `save` still wins — that's
// the escape hatch for a summon whose saves key off its summoner.
function getSave(score: AbilityScore | undefined, modifier: number | null, level: number) {
  if (modifier === null) return typeof score?.save === "number" ? score.save : null;
  return savingThrowModifier({
    modifier,
    saveProficient: score?.saveProficient,
    explicit: score?.save,
    level,
  });
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
  /** Character level — proficient saves add the bonus for it. Defaults to 1. */
  level?: number;
};

export function AbilityScoreRow({ abilityScores, derivedStats, level = 1 }: AbilityScoreRowProps) {
  return (
    <section className="ability-score-row" aria-label="Ability scores">
      {abilityOrder.map((abilityId) => {
        const score = abilityScores?.[abilityId];
        const derived = derivedStats?.[abilityId];

        if (derived) {
          // Show derived stats from equipment. Saves aren't touched by equipment
          // beyond the score change, so the save tracks the derived modifier unless
          // an explicit `save` override is present (summoner-keyed / proficient).
          const save = getSave(score, derived.modifier, level);
          const saveDiffers = save !== null && save !== derived.modifier;
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
              <span className={`ability-save${saveDiffers ? " ability-save-proficient" : ""}`}>
                SV {formatModifier(save)}
              </span>
            </div>
          );
        }

        // Fallback: plain base stats
        const modifier = getModifier(score);
        const save = getSave(score, modifier, level);
        const saveDiffers = save !== null && save !== modifier;

        return (
          <div className="ability-score-box" key={abilityId}>
            <span className="ability-label">{abilityLabels[abilityId]}</span>
            <strong className="ability-score">{formatScore(score)}</strong>
            <span className="ability-modifier">{formatModifier(modifier)}</span>
            <span className={`ability-save${saveDiffers ? " ability-save-proficient" : ""}`}>
              SV {formatModifier(save)}
            </span>
          </div>
        );
      })}
    </section>
  );
}
