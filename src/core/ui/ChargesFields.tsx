/**
 * ChargesFields — the uses / reset-cadence / note block, shared by both equipment editors.
 *
 * It existed twice, near-identically, in `EquipmentBagEditor` and `EquipmentLibraryStandalone`.
 * The four reset tiers were listed in both, so the tier vocabulary could drift between the two
 * places an item is authored and nothing would flag it.
 *
 * ⚠ `manual` + a cadence note is load-bearing, not a comment. A pool tagged `manual` with a note
 * ("Recharges at dawn") is DELIBERATELY gated: the rest logic skips it on a long rest, because a
 * party can take two long rests before a dawn. A bare `manual` with no note is the fallback tag
 * and still refills. Changing either option's meaning here changes what rests restore.
 */

import type { EquipmentCharges } from "./EquipmentBagEditor";

type Props = {
  charges: EquipmentCharges | undefined;
  onChange: (charges: EquipmentCharges | undefined) => void;
  /** Each editor brings its own input styling; the fields are the shared part, not the skin. */
  inputStyle: React.CSSProperties;
  /**
   * Grey the cadence controls out rather than hiding them when there are no charges. The bag
   * editor hides the row instead — both are fine, so the caller picks.
   */
  dimWhenEmpty?: boolean;
};

export function ChargesFields({ charges, onChange, inputStyle, dimWhenEmpty }: Props) {
  const dim = dimWhenEmpty && !charges ? { opacity: 0.4 } : {};
  const disabled = dimWhenEmpty ? !charges : false;

  return (
    <>
      <label style={{ fontSize: 12 }}>Uses
        <input
          type="number" min={0} value={charges?.max ?? ""} placeholder="0"
          onChange={e => {
            const max = Number.parseInt(e.target.value, 10);
            onChange(Number.isFinite(max) && max > 0
              ? { max, reset: charges?.reset ?? "longRest", note: charges?.note }
              : undefined);
          }}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 12 }}>Comes back on
        <select
          value={charges?.reset ?? "longRest"} disabled={disabled}
          onChange={e => charges && onChange({ ...charges, reset: e.target.value as EquipmentCharges["reset"] })}
          style={{ ...inputStyle, marginTop: 2, ...dim }}
        >
          <option value="longRest">Long rest</option>
          <option value="shortRest">Short rest</option>
          <option value="encounter">Each encounter</option>
          <option value="manual">Manual — no rest restores it</option>
        </select>
      </label>

      <label style={{ fontSize: 12 }}>Cadence note
        <input
          type="text" value={charges?.note ?? ""} disabled={disabled}
          onChange={e => charges && onChange({ ...charges, note: e.target.value || undefined })}
          placeholder="Recharges at dawn"
          style={{ ...inputStyle, ...dim }}
        />
      </label>
    </>
  );
}
