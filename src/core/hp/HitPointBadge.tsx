import { type ReactNode, useState } from "react";
import type { HitPoints } from "../types/actor";
import { getHpStatus } from "./hpStatus";

type HitPointBadgeProps = {
  hp: HitPoints;
  onDamageAmount: (amount: number) => void;
  onHealAmount: (amount: number) => void;
  onTempHpGain: (amount: number) => void;
  onTempHpLoss: (amount: number) => void;
  onResetTempHp: () => void;
  onSetZero: () => void;
  onResetHp: () => void;
  controlsSlot?: ReactNode;
};

function parseAmount(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 1;
  }

  return parsed;
}

export function HitPointBadge({
  hp,
  onDamageAmount,
  onHealAmount,
  onTempHpGain,
  onTempHpLoss,
  onResetTempHp,
  onSetZero,
  onResetHp,
  controlsSlot,
}: HitPointBadgeProps) {
  const status = getHpStatus(hp);
  const [amountText, setAmountText] = useState("1");
  const [toolsOpen, setToolsOpen] = useState(false);
  const amount = parseAmount(amountText);
  const tempHp = hp.temp ?? 0;

  return (
    <div className={`hp-field ${status}`}>
      <div className="hp-display-stack">
        <div className={`hp-core-box ${status}`}>
          <span className="stat-label">HP</span>
          <div className="hp-main-line">
            <span className="stat-value">
              {hp.current}/{hp.max}
            </span>
            {status === "down" && <span className="hp-skull" title="0 HP">KO</span>}
          </div>
        </div>

        <div className="temp-hp-box">
          <span className="stat-label">Temp HP</span>
          <strong>{tempHp}</strong>
        </div>
      </div>

      <div className="hp-tools-column">
        <button
          className={`hp-tools-toggle ${toolsOpen ? "open" : ""}`}
          type="button"
          onClick={() => setToolsOpen((current) => !current)}
          aria-expanded={toolsOpen}
        >
          {toolsOpen ? "Hide HP Tools" : "HP Tools"}
        </button>

        {controlsSlot}

        {toolsOpen && (
          <div className="hp-control-drawer" aria-label="HP and temporary HP controls">
            <label className="hp-amount-label">
              Amount
              <input
                aria-label="HP amount"
                className="hp-amount-input"
                inputMode="numeric"
                min="1"
                type="number"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                // Double-click selects the whole value so the next keystroke replaces it.
                // A number input has no "word" to select, so the browser's default
                // double-click does nothing here and the DM had to click then Ctrl+A
                // before every damage/heal entry.
                onDoubleClick={(event) => event.currentTarget.select()}
              />
            </label>

            <div className="hp-control-group" aria-label="Current HP controls">
              <span className="hp-control-group-label">HP</span>
              <div className="hp-control-buttons">
                <button type="button" onClick={() => onDamageAmount(amount)}>-HP</button>
                <button type="button" onClick={() => onHealAmount(amount)}>+HP</button>
                <button type="button" onClick={onSetZero}>0 HP</button>
                <button type="button" onClick={onResetHp}>Reset</button>
              </div>
            </div>

            <div className="hp-control-group" aria-label="Temporary HP controls">
              <span className="hp-control-group-label">Temp</span>
              <div className="hp-control-buttons">
                <button type="button" onClick={() => onTempHpLoss(amount)}>-Temp</button>
                <button type="button" onClick={() => onTempHpGain(amount)}>+Temp</button>
                <button type="button" onClick={onResetTempHp}>Clear Temp</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
