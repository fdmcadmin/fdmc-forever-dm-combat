import { getHpStatus } from "../hp/hpStatus";
import type { Actor, HitPoints } from "../types/actor";
import { getReadiedCount, type ActorActionEconomyMap } from "../types/actionEconomy";
import { withAlpha } from "../seats/seatColors";

type ActorSelectorProps = {
  actors: Actor[];
  selectedActorId: string;
  hpByActorId: Record<string, HitPoints>;
  actionStateByActorId: ActorActionEconomyMap;
  /** actorId → seat color, so each character card carries its seat identity (P-UX1). */
  seatColorById?: Record<string, string>;
  onSelectActor: (actorId: string) => void;
  onOpenActorCard?: (actorId: string) => void;
};

export function ActorSelector({
  actors,
  selectedActorId,
  hpByActorId,
  actionStateByActorId,
  seatColorById,
  onSelectActor,
  onOpenActorCard,
}: ActorSelectorProps) {
  return (
    <section aria-label="Party character selector">
      <h2 className="panel-title">Party Characters</h2>
      <div className="actor-list actor-card-grid-2x3">
        {actors.map((actor) => {
          const hp = hpByActorId[actor.id] ?? actor.stats.hp;
          const hpStatus = getHpStatus(hp);
          const actionState = actionStateByActorId[actor.id];
          const readiedCount = getReadiedCount(actionState);
          const isActive = actor.id === selectedActorId;
          const seatColor = seatColorById?.[actor.id];

          return (
            <button
              className={`actor-select-button actor-grid-card ${isActive ? "active" : ""} ${hpStatus}`}
              key={actor.id}
              type="button"
              onClick={() => onSelectActor(actor.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelectActor(actor.id);
                onOpenActorCard?.(actor.id);
              }}
              aria-label={`Select ${actor.name}`}
              style={seatColor ? {
                // Seat identity: left rail + soft wash, brighter when selected.
                borderLeft: `4px solid ${seatColor}`,
                background: isActive ? withAlpha(seatColor, 0.22) : withAlpha(seatColor, 0.08),
              } : undefined}
            >
              <span className="actor-grid-name" style={seatColor && hpStatus !== "down" ? { color: isActive ? "#fff" : seatColor } : undefined}>
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
