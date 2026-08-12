/**
 * PartyWalletPanel — the shared purse.
 *
 * Campaign gold is party money. The loot doc says so outright ("Gold is shared party currency
 * and does not scale with party size"), but the app only had personal wallets, so a shared
 * total had to be parked in one character's pocket and mentally tracked by everyone else.
 *
 * The purse lives in room live state, so every seat sees the same number without asking, and
 * only the GM writes it. That is what makes it spendable by anyone without a race: a player
 * asks, the GM applies against the balance at that moment, and a second reach for the same
 * coin is refused rather than silently overdrawing.
 *
 * Two audiences, one panel:
 *   GM     — edits the purse directly and awards campaign gold.
 *   Player — takes from it or contributes to it, for their own character.
 */
import { useState } from "react";
import {
  COIN_TYPES, COIN_ABBR, COIN_LABEL, COIN_COPPER,
  nonZeroCoins, setCoin, coinsToCopper, formatCopperPrice,
  type Coins, type CoinType,
} from "../currency/currency";

const COIN_COLOR: Record<string, string> = {
  pp: "#d8dae6", gp: "#e0a030", sp: "#b9c2cc", cp: "#c08457",
};

export function PartyWalletPanel({
  coins,
  canEdit = false,
  actorName,
  actorCopper,
  onEdit,
  onTransfer,
}: {
  coins: Coins;
  /** GM only: edit the purse and award coin directly. */
  canEdit?: boolean;
  /** The character a player would take to / contribute from. Omit for a read-only view. */
  actorName?: string;
  /** That character's own balance, in copper — bounds what they can contribute. */
  actorCopper?: number;
  onEdit?: (coins: Coins) => void;
  /** Positive takes FROM the purse, negative contributes TO it. Copper. */
  onTransfer?: (copper: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(0);
  const [coin, setCoinType] = useState<CoinType>("gp");

  const shown = nonZeroCoins(coins);
  const partyCopper = coinsToCopper(coins);
  const moveCopper = Math.max(0, Math.floor(amount)) * COIN_COPPER[coin];
  const canTake = moveCopper > 0 && moveCopper <= partyCopper;
  const canGive = moveCopper > 0 && moveCopper <= (actorCopper ?? 0);

  return (
    <section style={{ background: "#11131a", border: "1px solid #2a2a3e", borderLeft: "3px solid #e0a030", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#e0a030", letterSpacing: 0.5 }}>👛 PARTY PURSE</span>
        {shown.length > 0 ? shown.map(c => (
          <span key={c.type} title={COIN_LABEL[c.type]}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: COIN_COLOR[c.type], fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COIN_COLOR[c.type], display: "inline-block" }} />
            {c.amount} {COIN_ABBR[c.type]}
          </span>
        )) : <span style={{ color: "#666", fontSize: 12 }}>empty</span>}
        {shown.length > 1 && (
          <span style={{ fontSize: 10, color: "#555" }}>= {formatCopperPrice(partyCopper)}</span>
        )}
        {canEdit && !editing && (
          <button type="button" onClick={() => setEditing(true)} title="Set the purse directly"
            style={{ marginLeft: "auto", padding: "2px 8px", background: "transparent", border: "1px solid #555", borderRadius: 4, color: "#aaa", cursor: "pointer", fontSize: 11 }}>
            ✎ Edit
          </button>
        )}
      </div>

      {canEdit && editing && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {COIN_TYPES.map(t => (
            <label key={t} style={{ fontSize: 10, color: "#999", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: COIN_COLOR[t], fontWeight: 700 }}>{COIN_ABBR[t]}</span>
              <input type="number" min={0} value={coins[t] ?? 0}
                onChange={e => onEdit?.(setCoin(coins, t, parseInt(e.target.value, 10) || 0))}
                style={{ width: 62, padding: "3px 5px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}
                title={COIN_LABEL[t]} />
            </label>
          ))}
          <button type="button" onClick={() => setEditing(false)}
            style={{ padding: "5px 10px", background: "#2a3a2a", border: "1px solid #4a6a4a", borderRadius: 5, color: "#bfe6c0", cursor: "pointer", fontSize: 12 }}>
            Done
          </button>
        </div>
      )}

      {/* Take / contribute. The two buttons are deliberately separate rather than one signed
          field — at a table "I'm taking 40 gp" and "I'm putting 40 gp in" are different
          sentences, and a minus sign is not worth misreading over shared money. */}
      {onTransfer && actorName && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8, paddingTop: 7, borderTop: "1px solid #1e1e2e" }}>
          <input type="number" min={0} value={amount || ""} placeholder="0"
            onChange={e => setAmount(parseInt(e.target.value, 10) || 0)}
            style={{ width: 64, padding: "3px 5px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }} />
          <select value={coin} onChange={e => setCoinType(e.target.value as CoinType)}
            style={{ padding: "3px 5px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}>
            {COIN_TYPES.map(t => <option key={t} value={t}>{COIN_ABBR[t]}</option>)}
          </select>
          <button type="button" disabled={!canTake}
            onClick={() => { onTransfer(moveCopper); setAmount(0); }}
            title={canTake ? `Take ${formatCopperPrice(moveCopper)} for ${actorName}` : "The purse cannot cover that"}
            style={{ fontSize: 11, padding: "3px 9px", borderRadius: 4, cursor: canTake ? "pointer" : "default", background: canTake ? "#2a2a4e" : "#1a1a1a", border: "1px solid #7b68ee55", color: canTake ? "#9d8cff" : "#555" }}>
            Take →
          </button>
          <button type="button" disabled={!canGive}
            onClick={() => { onTransfer(-moveCopper); setAmount(0); }}
            title={canGive ? `${actorName} puts in ${formatCopperPrice(moveCopper)}` : `${actorName} does not have that much`}
            style={{ fontSize: 11, padding: "3px 9px", borderRadius: 4, cursor: canGive ? "pointer" : "default", background: canGive ? "#16291b" : "#1a1a1a", border: "1px solid #2f7d3f55", color: canGive ? "#7be08a" : "#555" }}>
            ← Put in
          </button>
          <span style={{ fontSize: 10, color: "#555" }}>as {actorName}</span>
        </div>
      )}
    </section>
  );
}
