import { getHpStatus } from "../hp/hpStatus";
import type { Actor, HitPoints } from "../types/actor";
import { getReadiedCount, type ActorActionEconomyMap } from "../types/actionEconomy";

type ActorSelectorProps = {
  actors: Actor[];
  selectedActorId: string;
  hpByActorId: Record<string, HitPoints>;
  actionStateByActorId: ActorActionEconomyMap;
  onSelectActor: (actorId: string) => void;
  onOpenActorCard?: (actorId: string) => void;
};

export function ActorSelector({
  actors,
  selectedActorId,
  hpByActorId,
  actionStateByActorId,
  onSelectActor,
  onOpenActorCard,
}: ActorSelectorProps) {
  return (
    <section aria-label="Actor selector">
      <h2 className="panel-title">Actors</h2>
      <div className="actor-list actor-card-grid-2x3">
        {actors.map((actor) => {
          const hp = hpByActorId[actor.id] ?? actor.stats.hp;
          const hpStatus = getHpStatus(hp);
          const actionState = actionStateByActorId[actor.id];
          const readiedCount = getReadiedCount(actionState);

          return (
            <button
              className={`actor-select-button actor-grid-card ${actor.id === selectedActorId ? "active" : ""} ${hpStatus}`}
              key={actor.id}
              type="button"
              onClick={() => onSelectActor(actor.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelectActor(actor.id);
                onOpenActorCard?.(actor.id);
              }}
              aria-label={`Select ${actor.name}`}
            >
              <span className="actor-grid-name">
                {actor.name}
                {hpStatus === "down" && <span className="actor-select-skull" aria-label="0 HP">☠</span>}
              </span>
              <span className="actor-grid-meta">{readiedCount > 0 ? `${readiedCount} readied` : "ready"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
