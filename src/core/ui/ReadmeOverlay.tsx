/**
 * ReadmeOverlay (P-UX4 Phase 8)
 *
 * Clickable quick-guide / onboarding. Explains the intentional color system, actor
 * color-coding, the right-click-to-open-sheet gesture, and the basic table flow —
 * so the structure doesn't read as noise to a first-time user. Pure reference; it
 * changes no state.
 */

type ReadmeOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const COLOR_LEGEND: { swatch: string; label: string; meaning: string }[] = [
  { swatch: "#3f9d5f", label: "Green", meaning: "Creation — build party characters, monsters, equipment." },
  { swatch: "#5f8fd9", label: "Blue", meaning: "Execution — manage, load, and run what exists." },
  { swatch: "#e0b85a", label: "Yellow", meaning: "Cleanup — post-combat tidy-up of defeated monsters and stale state." },
  { swatch: "#6fe0e0", label: "Teal", meaning: "GM controls — session-save / room-metadata tools." },
];

const FLOW_STEPS = [
  "Create your actors (party characters, monsters, equipment).",
  "Build an encounter from the Library.",
  "Start combat.",
  "Use the rotation — each actor's seat color identifies whose turn it is.",
  "Cleanup after the fight.",
];

export function ReadmeOverlay({ open, onClose }: ReadmeOverlayProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Forever DM Combat quick guide"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)", maxHeight: "85vh", overflowY: "auto",
          background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)", color: "#dcdce6",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #2a2a3e", position: "sticky", top: 0, background: "#13131f" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Forever DM Combat — Quick Guide</h3>
          <button type="button" onClick={onClose} aria-label="Close guide"
            style={{ fontSize: 13, padding: "3px 10px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer" }}>✕ Close</button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Color system */}
          <section>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#9d8cff" }}>What the colors mean</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {COLOR_LEGEND.map(c => (
                <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, background: c.swatch, flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" }} />
                  <span style={{ fontSize: 12 }}><strong style={{ color: c.swatch }}>{c.label}</strong> — {c.meaning}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Actor color-coding */}
          <section>
            <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "#9d8cff" }}>Actor colors = rotation at a glance</h4>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
              Each party character has its own <strong>seat color</strong>. It appears on the
              card frame, the combat tracker, and the token panel — so you can tell whose turn
              it is and who owns which token instantly.
            </p>
          </section>

          {/* Right-click gesture */}
          <section>
            <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "#9d8cff" }}>Opening a sheet</h4>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
              <strong>Right-click</strong> an actor tile or an initiative entry to open that
              character or monster's sheet.
            </p>
          </section>

          {/* Basic flow */}
          <section>
            <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "#9d8cff" }}>Basic flow</h4>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
              {FLOW_STEPS.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
