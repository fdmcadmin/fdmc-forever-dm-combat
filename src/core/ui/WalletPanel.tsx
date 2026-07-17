/**
 * WalletPanel — a character's coin wallet. Display mode shows only coin types with a
 * positive balance (so a gold-only campaign just shows gold); edit mode shows all four
 * so the player can set/add any coin. Used on the actor sheet and the DM editor.
 */
import { useState } from "react";
import {
  COIN_TYPES,
  COIN_ABBR,
  COIN_LABEL,
  nonZeroCoins,
  setCoin,
  type Coins,
} from "../currency/currency";

const COIN_COLOR: Record<string, string> = {
  pp: "#d8dae6",
  gp: "#e0a030",
  sp: "#b9c2cc",
  cp: "#c08457",
};

export function WalletPanel({
  coins,
  editable = false,
  onChange,
}: {
  coins: Coins;
  editable?: boolean;
  onChange?: (coins: Coins) => void;
}) {
  const [editing, setEditing] = useState(false);
  const shown = nonZeroCoins(coins);

  if (editing && editable) {
    return (
      <div className="wallet-edit" style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
        {COIN_TYPES.map((t) => (
          <label key={t} style={{ fontSize: 10, color: "#999", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: COIN_COLOR[t], fontWeight: 700 }}>{COIN_ABBR[t]}</span>
            <input
              type="number"
              min={0}
              value={coins[t] ?? 0}
              onChange={(e) => onChange?.(setCoin(coins, t, parseInt(e.target.value, 10) || 0))}
              style={{ width: 56, padding: "3px 5px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}
              title={COIN_LABEL[t]}
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{ padding: "5px 10px", background: "#2a3a2a", border: "1px solid #4a6a4a", borderRadius: 5, color: "#bfe6c0", cursor: "pointer", fontSize: 12 }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span className="stat-label">Wallet</span>
      {shown.length > 0 ? (
        shown.map((c) => (
          <span
            key={c.type}
            title={COIN_LABEL[c.type]}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: COIN_COLOR[c.type] }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COIN_COLOR[c.type], display: "inline-block" }} />
            {c.amount} {COIN_ABBR[c.type]}
          </span>
        ))
      ) : (
        <span style={{ color: "#666", fontSize: 12 }}>—</span>
      )}
      {editable && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Edit wallet"
          style={{ marginLeft: "auto", padding: "2px 8px", background: "transparent", border: "1px solid #555", borderRadius: 4, color: "#aaa", cursor: "pointer", fontSize: 11 }}
        >
          ✎ Edit
        </button>
      )}
    </div>
  );
}
