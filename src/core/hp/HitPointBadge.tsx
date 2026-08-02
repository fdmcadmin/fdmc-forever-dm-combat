import { type ReactNode, useState } from "react";
import { effectiveMaxHp, type HitPoints } from "../types/actor";
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
  /** Raise max HP for a duration (Aid, Heroes' Feast). Authored max is untouched. */
  onBonusMaxGain?: (amount: number) => void;
  /** Effect ended — drop the bonus and trim current HP back to the authored max. */
  onClearBonusMax?: () => void;
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
  onBonusMaxGain,
  onClearBonusMax,
  controlsSlot,
}: HitPointBadgeProps) {
  const status = getHpStatus(hp);
  const [amountText, setAmountText] = useState("1");
  const [toolsOpen, setToolsOpen] = useState(false);
  const amount = parseAmount(amountText);
  const tempHp = hp.temp ?? 0;
  const bonusMax = hp.bonusMax ?? 0;
  const shownMax = effectiveMaxHp(hp);

  return (
    <div className={`hp-field ${status}`}>
      <div className="hp-display-stack">
        <div className={`hp-core-box ${status}`}>
          <span className="stat-label">HP</span>
          <div className="hp-main-line">
            <span className="stat-value">
              {hp.current}/{shownMax}
            </span>
            {/* A timed max-HP boost shows as "+N" beside the max so the raised ceiling is
                visible and obviously temporary — the authored max is never overwritten. */}
            {bonusMax > 0 && (
              <span
                className="hp-bonus-max"
                title={`+${bonusMax} temporary max HP (base max ${hp.max}). Clear it in HP Tools when the effect ends.`}
                style={{ fontSize: 10, color: "#7ec8e3", marginLeft: 4 }}
              >
                +{bonusMax}
              </span>
            )}
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

            {/* Timed max-HP boost (Aid, Heroes' Feast): raises the ceiling for a duration
                WITHOUT touching the authored max, so when it expires "Clear Max" restores
                the true value instead of the sheet being permanently edited. */}
            {(onBonusMaxGain || onClearBonusMax) && (
              <div className="hp-control-group" aria-label="Temporary maximum HP controls">
                <span className="hp-control-group-label" title="Temporary increase to MAX HP for a duration — not temp HP">
                  Max{bonusMax > 0 ? ` +${bonusMax}` : ""}
                </span>
                <div className="hp-control-buttons">
                  {onBonusMaxGain && (
                    <button type="button" title="Raise max HP by the Amount for a duration (also heals that much, like Aid)"
                      onClick={() => onBonusMaxGain(amount)}>+Max</button>
                  )}
                  {onClearBonusMax && (
                    <button type="button" disabled={bonusMax <= 0}
                      title="Effect ended — remove the bonus and trim current HP back to the authored max"
                      onClick={onClearBonusMax}>Clear Max</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
