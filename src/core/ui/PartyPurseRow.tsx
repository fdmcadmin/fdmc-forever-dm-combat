/**
 * PartyPurseRow — the shared purse, as one line under the character's own wallet.
 *
 * Campaign gold is party money (the loot doc: "shared party currency"), and it lives in room
 * live state so every seat reads the same number and only the GM writes it. What this file is
 * about is where it SITS.
 *
 * It began as a banner above the card, which cost two rows and pushed the character down the
 * sheet before you could see their HP. Money belongs next to money: this mirrors WalletPanel's
 * markup exactly — same `stat-label`, same coin dots — so PURSE reads as a sibling of WALLET
 * rather than a separate feature bolted above the sheet.
 *
 * The controls stay folded away behind ⇄ because taking from the purse is an occasional act,
 * while seeing the balance is constant. One line by default, three when you are actually
 * moving coin.
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

export function PartyPurseRow({
  coins,
  canEdit = false,
  actorName,
  actorCopper = 0,
  onEdit,
  onTransfer,
}: {
  coins: Coins;
  /** GM only — set the purse directly. */
  canEdit?: boolean;
  /** The character this sheet belongs to; they are who takes or contributes. */
  actorName?: string;
  /** Their own balance in copper, which bounds what they can put in. */
  actorCopper?: number;
  onEdit?: (coins: Coins) => void;
  /** Positive takes FROM the purse, negative contributes TO it. Copper. */
  onTransfer?: (copper: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(0);
  const [coin, setCoinType] = useState<CoinType>("gp");

  const shown = nonZeroCoins(coins);
  const partyCopper = coinsToCopper(coins);
  const move = Math.max(0, Math.floor(amount)) * COIN_COPPER[coin];
  const canTake = move > 0 && move <= partyCopper;
  const canGive = move > 0 && move <= actorCopper;

  return (
    <>
      <div className="wallet-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="stat-label" title="The party's shared purse — campaign gold. Everyone sees it; anyone can draw on it.">Purse</span>
        {shown.length > 0 ? shown.map(c => (
          <span key={c.type} title={COIN_LABEL[c.type]}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: COIN_COLOR[c.type] }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COIN_COLOR[c.type], display: "inline-block" }} />
            {c.amount} {COIN_ABBR[c.type]}
          </span>
        )) : <span style={{ color: "#666", fontSize: 12 }}>—</span>}

        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
          {onTransfer && actorName && (
            <button type="button" onClick={() => { setOpen(o => !o); setEditing(false); }}
              title={open ? "Hide" : `Take from the purse, or put coin into it, as ${actorName}`}
              style={{ padding: "2px 8px", background: open ? "#2a2a4e" : "transparent", border: "1px solid #555", borderRadius: 4, color: open ? "#9d8cff" : "#aaa", cursor: "pointer", fontSize: 11 }}>
              ⇄
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => { setEditing(e => !e); setOpen(false); }}
              title="Set the party purse"
              style={{ padding: "2px 8px", background: "transparent", border: "1px solid #555", borderRadius: 4, color: "#aaa", cursor: "pointer", fontSize: 11 }}>
              ✎
            </button>
          )}
        </span>
      </div>

      {editing && canEdit && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {COIN_TYPES.map(t => (
            <label key={t} style={{ fontSize: 10, color: "#999", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: COIN_COLOR[t], fontWeight: 700 }}>{COIN_ABBR[t]}</span>
              <input type="number" min={0} value={coins[t] ?? 0}
                onChange={e => onEdit?.(setCoin(coins, t, parseInt(e.target.value, 10) || 0))}
                style={{ width: 54, padding: "2px 4px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}
                title={COIN_LABEL[t]} />
            </label>
          ))}
        </div>
      )}

      {/* Take and Put in are separate buttons rather than one signed field — at a table those
          are different sentences, and over shared money a minus sign is not worth misreading. */}
      {open && onTransfer && actorName && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
          <input type="number" min={0} value={amount || ""} placeholder="0"
            onChange={e => setAmount(parseInt(e.target.value, 10) || 0)}
            style={{ width: 54, padding: "2px 4px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }} />
          <select value={coin} onChange={e => setCoinType(e.target.value as CoinType)}
            style={{ padding: "2px 4px", borderRadius: 4, border: "1px solid #444", background: "#111", color: "#fff", fontSize: 12 }}>
            {COIN_TYPES.map(t => <option key={t} value={t}>{COIN_ABBR[t]}</option>)}
          </select>
          <button type="button" disabled={!canTake}
            onClick={() => { onTransfer(move); setAmount(0); }}
            title={canTake ? `Take ${formatCopperPrice(move)} for ${actorName}` : "The purse cannot cover that"}
            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, cursor: canTake ? "pointer" : "default", background: canTake ? "#2a2a4e" : "#1a1a1a", border: "1px solid #7b68ee55", color: canTake ? "#9d8cff" : "#555" }}>
            Take →
          </button>
          <button type="button" disabled={!canGive}
            onClick={() => { onTransfer(-move); setAmount(0); }}
            title={canGive ? `${actorName} puts in ${formatCopperPrice(move)}` : `${actorName} does not have that much`}
            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, cursor: canGive ? "pointer" : "default", background: canGive ? "#16291b" : "#1a1a1a", border: "1px solid #2f7d3f55", color: canGive ? "#7be08a" : "#555" }}>
            ← Put in
          </button>
        </div>
      )}
    </>
  );
}
