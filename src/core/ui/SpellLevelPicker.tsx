/**
 * SpellLevelPicker
 *
 * Runtime upcast control on a levelled spell card: pick the slot the cast spends, up to 9.
 *
 * Before this, upcasting was data-authored — an action always spent the level it was written
 * at, so casting Scorching Ray at L4 meant authoring a second card for it. The picked level
 * now drives the slot that is spent, the out-of-charges gate, and the number of attack rolls
 * a multi-roll spell makes.
 *
 * Damage is NOT auto-scaled: upcast damage stays authored (the spell's `upcastNote` / crit
 * field), because per-level scaling differs per spell and guessing it would be wrong more
 * often than useful.
 */

export type CastLevelOption = {
  level: number;
  /** Charges left in that level's slot pool. null = the actor tracks no pool for it. */
  remaining: number | null;
  max: number | null;
};

import { scaleUpcastRider } from "../dice/diceFormula";

type SpellLevelPickerProps = {
  options: CastLevelOption[];
  selected: number;
  onSelect: (level: number) => void;
  /** Shown under the row when the spell says what upcasting adds. */
  upcastNote?: string;
  /** The rider `withUpcastRiders` will add per extra level, when the spell authors one. */
  upcastDamage?: string;
  disabled?: boolean;
};

export function SpellLevelPicker({ options, selected, onSelect, upcastNote, upcastDamage, disabled }: SpellLevelPickerProps) {
  if (options.length <= 1) {
    return null;
  }

  const base = options[0].level;
  const steps = selected - base;
  // Scaled the same way `withUpcastRiders` scales it, so the label states the real addition.
  const upcastRider = upcastDamage?.trim() && steps > 0 ? scaleUpcastRider(upcastDamage.trim(), steps) : "";
  const autoScaled = Boolean(upcastRider);

  return (
    <div className="spell-level-picker" aria-label="Cast at level">
      <span className="spell-level-picker-label">Cast at</span>
      <span className="spell-level-picker-row" role="group">
        {options.map((option) => {
          const isSelected = option.level === selected;
          // No slots left is not castable — the same rule the out-of-charges gate applies,
          // so the picker can never offer a level the cast would then be refused for.
          const empty = option.remaining !== null && option.remaining <= 0;
          const untracked = option.remaining === null;

          return (
            <button
              key={option.level}
              type="button"
              className={`spell-level-chip ${isSelected ? "selected" : ""} ${empty ? "empty" : ""}`}
              aria-pressed={isSelected}
              disabled={disabled || empty}
              title={
                empty
                  ? `No Level ${option.level} slots left`
                  : untracked
                    ? `Cast at Level ${option.level} — no slot pool tracked for this level`
                    : `Cast at Level ${option.level} — ${option.remaining}/${option.max} slots left`
              }
              onClick={(event) => {
                event.stopPropagation();
                onSelect(option.level);
              }}
            >
              <span className="spell-level-chip-level">L{option.level}</span>
              {option.remaining !== null && (
                <span className="spell-level-chip-count">{option.remaining}</span>
              )}
            </button>
          );
        })}
      </span>
      {selected > base && (
        <span className="spell-level-picker-note">
          Upcast +{selected - base}
          {/*
            ⚠ "ADD IT MANUALLY" WAS ADVICE TO DOUBLE-COUNT.

            This said so whenever the spell carried no upcast NOTE — a human-readable blurb — with
            no reference to whether there was upcast DAMAGE. But `withUpcastRiders` scales an
            authored `upcastDamage` into the rolled formula on its own, so a DM told to add the
            dice by hand would have added them twice. Cure Wounds at L2 rolls 2d8+2 + 2d8 already.

            The note is the explanation; `autoScaled` is the fact. Only a spell with no rider to
            apply asks for anything by hand.
          */}
          {autoScaled
            ? ` — ${upcastRider} added automatically${upcastNote ? ` · ${upcastNote}` : ""}`
            : upcastNote ? ` — ${upcastNote}` : " — add upcast damage manually"}
        </span>
      )}
    </div>
  );
}
