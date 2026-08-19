/**
 * SaveDcComposer — a save DC built from two toggles, never typed.
 *
 * ⚠ THE 8 IS CONSTANT, SO IT SHOULD NOT BE AUTHORED. Christopher: *"since we have stated that
 * the DC is suppose to be a base 8 we shouldnt have to have the DC be a typed box… under DC check
 * the toggle for str/dex/wis/int/con/cha, then a toggle for magical or martial."*
 *
 * Two independent questions, and conflating them is what made this a free-text box:
 *
 *   WHICH SAVE does the target roll?   → the ability toggles. Pure flavour of the effect; a
 *                                        shove is STR, a poison is CON. Stored as `saveAbility`.
 *   WHAT NUMBER do they roll against?  → the basis toggle. A martial effect keys off the attack
 *                                        modifier (`@ATK`), a magical one off spell attack
 *                                        (`@SPELL`). Both already carry proficiency.
 *
 * The DC is then `8+@ATK` or `8+@SPELL` and moves with the character forever. Typing "STR DC 14"
 * — which is what every existing action does — freezes the number at the level it was written,
 * and nothing ever tells you it has gone stale.
 *
 * An authored string that is not one of the two shapes is left ALONE and shown as custom. Legacy
 * DCs are the majority today, and silently rewriting them would change live numbers mid-campaign.
 */

import { useMemo } from "react";

const SAVE_ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
export type SaveAbility = (typeof SAVE_ABILITIES)[number];

/** The two ways a DC is derived. Both tokens already include proficiency. */
const BASIS = {
  martial: { token: "@ATK", label: "Martial", hint: "Best of STR/DEX + proficiency — a shove, a shield bash, a weapon rider" },
  magical: { token: "@SPELL", label: "Magical", hint: "Spellcasting modifier + proficiency — a spell or a magical effect" },
} as const;
export type DcBasis = keyof typeof BASIS;

export function composeSaveDc(basis: DcBasis): string {
  return `8+${BASIS[basis].token}`;
}

/** Which basis an authored DC uses, or null when it is neither (legacy or hand-written). */
export function readDcBasis(saveDc: string | undefined): DcBasis | null {
  const v = (saveDc ?? "").replace(/\s+/g, "").toUpperCase();
  if (v === "8+@ATK") return "martial";
  if (v === "8+@SPELL") return "magical";
  return null;
}

type Props = {
  /** The stored DC expression. */
  saveDc: string;
  onSaveDc: (value: string) => void;
  /** Which save the TARGET rolls — independent of how the number is derived. */
  saveAbility: string;
  onSaveAbility: (value: string) => void;
  /** Shows the resolved number beside the formula, so the DM sees 14 rather than "8+@SPELL". */
  resolveFormula?: (formula: string) => string;
};

export function SaveDcComposer({ saveDc, onSaveDc, saveAbility, onSaveAbility, resolveFormula }: Props) {
  const basis = readDcBasis(saveDc);
  const isCustom = Boolean(saveDc.trim()) && basis === null;

  const preview = useMemo(() => {
    if (!saveDc.trim() || !resolveFormula) return null;
    const resolved = resolveFormula(saveDc);
    // "8+6" → 14. Only sums a pure numeric expression; anything else is shown as-is.
    if (/^[\d+\s-]+$/.test(resolved)) {
      try {
        const total = resolved.split("+").reduce((n, part) => n + Number(part.trim() || 0), 0);
        if (Number.isFinite(total)) return `DC ${total}`;
      } catch { /* fall through to the raw string */ }
    }
    return resolved;
  }, [saveDc, resolveFormula]);

  const chip = (active: boolean) => ({
    fontSize: 11,
    padding: "3px 9px",
    borderRadius: 4,
    cursor: "pointer",
    background: active ? "#2a3550" : "#111",
    border: `1px solid ${active ? "#7b68ee" : "#3a3a52"}`,
    color: active ? "#dfe4ff" : "#8a8aa0",
  } as const);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div>
        <span style={{ fontSize: 12, display: "block" }}>Save ability <span style={{ color: "#667" }}>— which save the target rolls</span></span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
          {SAVE_ABILITIES.map(a => (
            <button key={a} type="button" style={chip(saveAbility.toUpperCase() === a)}
              onClick={() => onSaveAbility(saveAbility.toUpperCase() === a ? "" : a)}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={{ fontSize: 12, display: "block" }}>DC from <span style={{ color: "#667" }}>— base 8 is automatic</span></span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3, alignItems: "center" }}>
          {(Object.keys(BASIS) as DcBasis[]).map(k => (
            <button key={k} type="button" title={BASIS[k].hint} style={chip(basis === k)}
              onClick={() => onSaveDc(basis === k ? "" : composeSaveDc(k))}>
              {BASIS[k].label}
            </button>
          ))}
          {saveDc.trim() && (
            <span style={{ fontSize: 11, color: "#7be08a", marginLeft: 4 }}>
              {saveDc}{preview && preview !== saveDc ? ` → ${preview}` : ""}
            </span>
          )}
        </div>
        {isCustom && (
          <span style={{ fontSize: 10, color: "#e8b64c", display: "block", marginTop: 3 }}>
            ⚠ Typed DC — this number will not move when the character levels. Pick Martial or
            Magical to derive it instead.
          </span>
        )}
      </div>
    </div>
  );
}
