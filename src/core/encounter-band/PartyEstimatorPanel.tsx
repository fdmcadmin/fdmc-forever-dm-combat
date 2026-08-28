/**
 * PARTY ESTIMATOR — the PC side, per character.
 *
 * Christopher: *"i still dont see the healing estimator we b[ui]lt from before so the feats and the
 * healing needs to be on the per party PC estimator."*
 *
 * ⚠ THE HEALING READER WAS NEVER MISSING — IT WAS IN THE WRONG PLACE. `partyHealingFromActors` has
 * shipped for a while and is wired into `EncounterDifficultyPanel`, where it answers "what does
 * THIS FIGHT cost the party". It was never surfaced per character, so a DM asking "what does this
 * party bring" had nowhere to look. That is the gap this panel fills.
 *
 * ⚠ AND THE CREATURE ESTIMATOR IS THE OTHER SIDE OF THE SAME COIN. `CreatureEstimatorPanel` prices
 * one monster. This prices one PARTY. They deliberately do not share a panel: a monster is measured
 * against a party benchmark, and a party is measured against nothing at all — it just is what it is.
 *
 * ── THREE CHANNELS, NEVER SUMMED ────────────────────────────────────────────────────────────
 * The feat contract: *"Keep personal EHP, party EHP, and DPR separate."* They are rendered in three
 * columns and this file never adds them together. A single "power" number would be the blanket
 * multiplier the same contract forbids.
 *
 * ── ⚠ AND NOTHING HERE INVENTS A MISSING INPUT ──────────────────────────────────────────────
 * *"Return NEEDS_INPUT when required information is unavailable — never silently price it as
 * zero."* A feat whose accuracy inputs are unknown is listed as a QUESTION, under its own heading,
 * and is excluded from the totals rather than folded in as nothing.
 */

import { useMemo, useState } from "react";
import { partyHealingFromActors } from "./partyHealingFromActors";
import { loadPcFeats, setPcFeats } from "./pcFeatSelection";
import { FEAT_PRICING } from "../../modules/dnd-5e/featPricing.generated";
import { priceFeats, type PartyFeatTotals } from "../../modules/dnd-5e/featEvaluator";

const box: React.CSSProperties = {
  background: "#12121c", border: "1px solid #23233a", borderRadius: 6, padding: 10,
};

type PcLike = {
  id?: string;
  name?: string;
  kind?: string;
  level?: number;
  stats?: { maxHp?: number; ac?: number };
};

export function PartyEstimatorPanel({ actors = [] }: { actors?: unknown[] }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState(loadPcFeats);
  const [adding, setAdding] = useState<string | null>(null);

  const party = useMemo(
    () => (actors as PcLike[]).filter(a => a?.kind === "player"),
    [actors],
  );

  /**
   * The party's same-encounter healing, read from the actors themselves.
   *
   * ⚠ THE SAME READER THE ENCOUNTER PANEL USES. Not a second implementation — a second one would
   * be free to disagree, and two healing numbers on two screens is worse than none.
   */
  const healing = useMemo(() => partyHealingFromActors(party as never[]), [party]);

  /**
   * Feat pricing per PC.
   *
   * ⚠ THE CONTEXT IS ONLY WHAT THE APP ACTUALLY KNOWS. level, PB, party size, resolved HP/AC — and
   * nothing else. Accuracy inputs (`targetAC`, `perHitDamage`, `attacks`) belong to a specific
   * attack against a specific enemy, which this panel is not looking at, so they are deliberately
   * absent and every feat that needs them reports NEEDS_INPUT. Supplying a plausible-looking guess
   * here is exactly what the contract forbids.
   */
  const priced = useMemo(() => {
    const out: Array<{ pc: PcLike; totals: PartyFeatTotals }> = [];
    for (const pc of party) {
      const id = pc.id ?? pc.name ?? "";
      const level = pc.level ?? 1;
      const totals = priceFeats(selection[id] ?? [], {
        level,
        PB: Math.floor((level - 1) / 4) + 2,
        partySize: party.length,
        round: 1,
        maxHp: pc.stats?.maxHp,
        AC: pc.stats?.ac,
        // The resolved-actor flags: the app reads a FINAL sheet, so static feat benefits are
        // already inside these numbers and must not be added twice.
        resolvedMaxHp: true,
        resolvedAC: true,
        resolvedAttackBonus: true,
        resolvedSaves: true,
      });
      out.push({ pc, totals });
    }
    return out;
  }, [party, selection]);

  const partyTotals = useMemo(() => {
    let dpr = 0, personal = 0, party_ = 0, questions = 0;
    for (const p of priced) {
      dpr += p.totals.dpr;
      personal += p.totals.personalEhp;
      party_ += p.totals.partyEhp;
      questions += p.totals.needsInput.length;
    }
    return { dpr, personal, party: party_, questions };
  }, [priced]);

  const featNames = useMemo(
    () => [...FEAT_PRICING].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div style={{ ...box, marginTop: 10 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
          background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "#4f9dff" }}>
        <span style={{ fontSize: 11, width: 12 }}>{open ? "▼" : "▶"}</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Party Estimator</span>
        <span style={{ fontSize: 10, color: "#667" }}>
          {party.length} PC{party.length === 1 ? "" : "s"} · feats and healing
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          {party.length === 0 ? (
            <p style={{ fontSize: 11, color: "#8a6a2a", fontStyle: "italic", margin: 0 }}>
              No player actors in the library — nothing about this party can be read.
            </p>
          ) : (
            <>
              {/* ── The three channels, side by side and never summed. ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
                {([
                  ["DPR from feats", partyTotals.dpr, "#e0b070"],
                  ["Personal EHP", partyTotals.personal, "#7bb0e0"],
                  ["Party EHP", partyTotals.party, "#7be08a"],
                ] as const).map(([label, value, colour]) => (
                  <div key={label} style={{ background: "#16162a", border: "1px solid #2a2a3e", borderRadius: 4, padding: "6px 8px" }}>
                    <div style={{ fontSize: 9, color: "#667", letterSpacing: 0.4 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 15, color: colour, fontWeight: 600 }}>{value.toFixed(1)}</div>
                  </div>
                ))}
              </div>

              {/* ── Healing: the reader that already existed, finally on the party side. ── */}
              <div style={{ background: "#12181a", border: "1px solid #24402c", borderRadius: 4, padding: "6px 9px", marginBottom: 8, fontSize: 11 }}>
                <span style={{ color: "#7be08a", letterSpacing: 0.4 }}>SAME-ENCOUNTER HEALING</span>
                <strong style={{ color: "#ddd", marginLeft: 8 }}>{healing.total.toFixed(0)}</strong>
                <span style={{ color: "#667" }}> across {healing.sources.length} pool{healing.sources.length === 1 ? "" : "s"}</span>
                {healing.sources.length > 0 && (
                  <div style={{ marginTop: 4, color: "#8a9a8a", fontSize: 10, lineHeight: 1.5 }}>
                    {healing.sources.map((s, i) => (
                      <div key={i}>{s.actor} · {s.label} — {s.amount.toFixed(0)} <span style={{ color: "#5a6a5a" }}>({s.evidence})</span></div>
                    ))}
                  </div>
                )}
                {healing.excluded.length > 0 && (
                  <div style={{ marginTop: 4, color: "#8a7a5a", fontSize: 10 }}>
                    {healing.excluded.length} pool{healing.excluded.length === 1 ? "" : "s"} deliberately excluded:{" "}
                    {healing.excluded.map(e => `${e.label} (${e.reason})`).join("; ")}
                  </div>
                )}
              </div>

              {/* ── Per PC. ── */}
              {priced.map(({ pc, totals }) => {
                const id = pc.id ?? pc.name ?? "";
                const feats = selection[id] ?? [];
                return (
                  <div key={id} style={{ background: "#14141f", border: "1px solid #24243a", borderRadius: 4, padding: "6px 9px", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 12, color: "#dfe4ff" }}>{pc.name ?? "Unnamed"}</strong>
                      <span style={{ fontSize: 10, color: "#667" }}>level {pc.level ?? "?"}</span>
                      <span style={{ fontSize: 10, color: "#8a8aa0" }}>
                        DPR {totals.dpr.toFixed(1)} · personal {totals.personalEhp.toFixed(1)} · party {totals.partyEhp.toFixed(1)}
                      </span>
                      <button type="button" onClick={() => setAdding(adding === id ? null : id)}
                        style={{ marginLeft: "auto", fontSize: 10, padding: "2px 7px", background: "#7b68ee22",
                          color: "#7b68ee", border: "1px solid #7b68ee55", borderRadius: 3, cursor: "pointer" }}>
                        + feat
                      </button>
                    </div>

                    {adding === id && (
                      <select
                        autoFocus
                        value=""
                        onChange={e => {
                          const v = e.target.value;
                          if (!v) return;
                          setSelection(setPcFeats(id, [...feats, v]));
                          setAdding(null);
                        }}
                        style={{ marginTop: 5, width: "100%", fontSize: 11, padding: "3px 6px",
                          borderRadius: 3, border: "1px solid #444", background: "#111", color: "#fff" }}
                      >
                        <option value="">Pick a feat…</option>
                        {featNames.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.name} · {f.edition} · {f.category} {f.channels.includes("NONE") ? "(no combat price)" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    {feats.length === 0 ? (
                      // ⚠ NOT "no feats" — "nobody has said yet". The difference is the whole point.
                      <div style={{ fontSize: 10, color: "#8a6a2a", marginTop: 4, fontStyle: "italic" }}>
                        No feats recorded. The sheet does not carry them, so this is unknown rather than none.
                      </div>
                    ) : (
                      <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {feats.map((f, i) => (
                          <span key={i} style={{ fontSize: 10, padding: "1px 6px", background: "#1c1c30",
                            border: "1px solid #2f2f4a", borderRadius: 10, color: "#b9c0e0" }}>
                            {f.replace(/^\d+:/, "")}
                            <button type="button"
                              onClick={() => setSelection(setPcFeats(id, feats.filter((_, j) => j !== i)))}
                              style={{ marginLeft: 5, background: "transparent", border: "none", color: "#777", cursor: "pointer", padding: 0 }}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {totals.unknown.length > 0 && (
                      <div style={{ fontSize: 10, color: "#e07b8a", marginTop: 4 }}>
                        Not in the workbook: {totals.unknown.join(", ")}
                      </div>
                    )}

                    {/* ⚠ QUESTIONS, NOT ZEROES. Excluded from the totals above and said out loud. */}
                    {totals.needsInput.length > 0 && (
                      <div style={{ marginTop: 4, fontSize: 10, color: "#c0a060", lineHeight: 1.5 }}>
                        <strong>NEEDS_INPUT</strong> — priced at nothing until these are known:
                        {totals.needsInput.map((n, i) => (
                          <div key={i} style={{ paddingLeft: 8, color: "#a08b6a" }}>
                            {n.feat} · {n.channel} — {n.missing.join(", ")}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {partyTotals.questions > 0 && (
                <p style={{ fontSize: 10, color: "#8a7a5a", margin: "6px 0 0", lineHeight: 1.5 }}>
                  {partyTotals.questions} feat channel{partyTotals.questions === 1 ? " is" : "s are"} unanswered and
                  excluded from the totals above. Most need a specific target — accuracy, damage per hit, or
                  exposure — which belongs to one attack against one enemy, not to a party at rest.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
