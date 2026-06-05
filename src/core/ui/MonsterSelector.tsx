import type { MainEncounterMonsterInstance } from "../monsters/runtime/mainMonsterRuntime";

type MonsterSelectorProps = {
  monsters: MainEncounterMonsterInstance[];
  activeInstanceId: string;
  isDmView: boolean;
  onSelectMonster: (instanceId: string) => void;
  onOpenMonsterCard?: (instanceId: string) => void;
};

function hpCondition(current: number, max: number): string {
  if (current <= 0) return "down";
  const ratio = max > 0 ? current / max : 0;
  if (ratio <= 0.25) return "critical";
  if (ratio <= 0.5) return "bloodied";
  if (ratio <= 0.75) return "wounded";
  return "healthy";
}

function hpLabel(current: number, max: number): string {
  if (current <= 0) return "Down";
  const ratio = max > 0 ? current / max : 0;
  if (ratio <= 0.25) return "Critical";
  if (ratio <= 0.5) return "Bloodied";
  if (ratio <= 0.75) return "Wounded";
  return "Healthy";
}

export function MonsterSelector({
  monsters,
  activeInstanceId,
  isDmView,
  onSelectMonster,
  onOpenMonsterCard,
}: MonsterSelectorProps) {
  if (monsters.length === 0) return null;

  return (
    <section aria-label="Monster roster">
      <h2 className="panel-title">Monsters</h2>
      <div className="actor-list actor-card-grid-2x3">
        {monsters.map((monster) => {
          const condition = hpCondition(monster.currentHp, monster.maxHp);
          const isActive = monster.instanceId === activeInstanceId;

          // Name shown depends on reveal state
          const displayName = isDmView
            ? (monster.revealedName || monster.displayName || monster.name)
            : monster.isNameRevealed
              ? (monster.revealedName || monster.displayName || monster.name)
              : (monster.hiddenName || "Unknown creature");

          return (
            <button
              key={monster.instanceId}
              className={`actor-select-button actor-grid-card ${isActive ? "active" : ""} ${condition}`}
              type="button"
              onClick={() => onSelectMonster(monster.instanceId)}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelectMonster(monster.instanceId);
                onOpenMonsterCard?.(monster.instanceId);
              }}
              aria-label={`Select ${displayName}`}
            >
              <span className="actor-grid-name">
                {displayName}
                {condition === "down" && <span className="actor-select-skull" aria-label="0 HP">☠</span>}
              </span>
              <span className="actor-grid-meta">
                {isDmView
                  ? `${monster.currentHp}/${monster.maxHp} HP`
                  : hpLabel(monster.currentHp, monster.maxHp)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
