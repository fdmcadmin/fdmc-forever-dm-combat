import type { ActorConcentrationState } from "../state/useActorConcentrationState";
import type { ActorActionEconomyState } from "../types/actionEconomy";
import { hasReadiedCost, type ActionCost } from "../types/actionEconomy";

const slotOrder: { cost: ActionCost; label: string }[] = [
  { cost: "main",     label: "Action"   },
  { cost: "bonus",    label: "Bonus"    },
  { cost: "bond",     label: "Bond"     },
  { cost: "reaction", label: "Reaction" },
];

// Dot colors per state
const DOT_READY   = "#4bb469";  // green
const DOT_READIED = "#d7b36a";  // amber
const DOT_USED    = "#ff5840";  // red
const DOT_NONE    = "#2a2a3e";  // dark — no cost active

type ActionEconomyPanelProps = {
  state: ActorActionEconomyState;
  usedCostSlots?: ActionCost[];
  concentration: ActorConcentrationState;
  isPlayerMode?: boolean;
  onResetTurn: () => void;
  onClearConcentration: () => void;
};

function dotState(state: ActorActionEconomyState, usedCostSlots: ActionCost[], cost: ActionCost): "ready" | "readied" | "used" {
  if (usedCostSlots.includes(cost)) return "used";
  if (hasReadiedCost(state, cost)) return "readied";
  return "ready";
}

function dotColor(s: "ready" | "readied" | "used"): string {
  if (s === "used")    return DOT_USED;
  if (s === "readied") return DOT_READIED;
  return DOT_READY;
}

function Dot({ color, label, title }: { color: string; label: string; title: string }) {
  return (
    <div
      title={title}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "default" }}
    >
      <div style={{
        width: 12, height: 12, borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}88`,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
}

export function ActionEconomyPanel({
  state,
  usedCostSlots = [],
  concentration,
  isPlayerMode = false,
  onResetTurn,
  onClearConcentration,
}: ActionEconomyPanelProps) {
  const concColor = concentration ? "#9b8ac4" : DOT_NONE;
  const concBorder = concentration ? "none" : "1px solid #444";
  const concLabel = concentration
    ? (concentration.active ? concentration.actionLabel : `↻ ${concentration.actionLabel}`)
    : "—";

  return (
    <section className="action-economy-panel" aria-label="Slot readiness tracker">
      {/* Dot row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        {slotOrder.map(({ cost, label }) => {
          const s = dotState(state, usedCostSlots, cost);
          return (
            <Dot
              key={cost}
              color={dotColor(s)}
              label={label}
              title={`${label}: ${s}`}
            />
          );
        })}

        {/* Concentration dot */}
        <div
          title={concentration ? `Concentration: ${concLabel}` : "No concentration"}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: concentration ? "pointer" : "default" }}
          onClick={concentration ? onClearConcentration : undefined}
        >
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            background: concColor,
            border: concBorder,
            boxShadow: concentration ? `0 0 6px ${concColor}88` : "none",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
            Conc
          </span>
        </div>

        {/* Concentration label if active */}
        {concentration && (
          <span style={{ fontSize: 10, color: "#9b8ac4", marginLeft: -8, alignSelf: "flex-start", marginTop: 1 }}>
            {concLabel}
          </span>
        )}
      </div>

      <div className="economy-actions">
        {concentration && (
          <button className="secondary-button compact concentration-clear-button" type="button" onClick={onClearConcentration}>
            Clear Conc
          </button>
        )}
        {/* Player: End My Turn broadcasts to DM — no local reset (reset comes from DM broadcast).
            DM: Next Turn does full local reset + advances combat. */}
        <button className="secondary-button compact" type="button" onClick={onResetTurn}>
          {isPlayerMode ? "End My Turn" : "Next Turn"}
        </button>
      </div>
    </section>
  );
}
