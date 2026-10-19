import React from "react";

/**
 * THE APP MUST NEVER GO BLANK AGAIN.
 *
 * Christopher, 2026-10-19, mid-session: *"i have a blank app on my gm screen"* — blank after a
 * reload, blank after toggling the extension off and on. There was no error boundary on any of
 * the eight surfaces, so one throw during render unmounted the whole tree and React left an
 * empty div. No message, no stack, nothing to act on. We rolled 0.8.78.0 back without ever
 * learning which line threw, because by the time anyone could look, the evidence was a white
 * rectangle.
 *
 * A crash is going to happen again. What must not happen again is a crash that says NOTHING.
 * This turns the worst failure mode — silence — into the second best: a screen that names what
 * broke, and offers the two ways out of it.
 *
 * ⚠ THE RESET BUTTON IS THE POINT. The crash that caused this looked like code that only threw
 * when a particular thing was in storage: it survived a reload and an extension restart because
 * the trigger was saved, not cached. A player at the table cannot open devtools, and telling a
 * DM mid-session to paste `localStorage.removeItem(...)` is not a fix. So the escape hatch is a
 * button. It clears THIS SURFACE'S stored state and nothing else — the actor library, the room
 * and the campaign are untouched, because those are the things nobody can afford to lose to a
 * panicked click.
 */

type Props = { surface: string; children: React.ReactNode };
type State = { error: Error | null; info: string };

/** Keys safe to drop on a reset: per-surface UI and queue state, never library or campaign data. */
const RESETTABLE = /^fdmc\.(levelup|loot|outbox|ui|panel|window|combat|recent|draft)/i;

export class CrashScreen extends React.Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep it in the console too — whoever has devtools open should see the real thing.
    console.error(`[FDMC crash: ${this.props.surface}]`, error, info.componentStack);
    this.setState({ info: info.componentStack ?? "" });
  }

  private reset = () => {
    try {
      const doomed = Object.keys(localStorage).filter(k => RESETTABLE.test(k));
      for (const k of doomed) localStorage.removeItem(k);
    } catch { /* private mode — reloading is still worth a try */ }
    location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const detail = `${this.props.surface}: ${error.message}\n\n${error.stack ?? ""}\n${info}`.trim();

    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#ddd", background: "#1a1014", minHeight: "100vh", boxSizing: "border-box" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 15, color: "#ff9999" }}>This panel hit an error</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#aaa", lineHeight: 1.5 }}>
          The rest of your game is fine — the room, your characters and the campaign are untouched.
          Reload first. If it keeps happening, Reset clears this panel's saved state only.
        </p>

        <pre style={{
          margin: "0 0 12px", padding: 10, background: "#120c0f", border: "1px solid #3a2228",
          borderRadius: 4, fontSize: 11, lineHeight: 1.45, color: "#e0b8b8",
          maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>{detail}</pre>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => location.reload()}
            style={{ fontSize: 12, padding: "5px 14px", background: "#7b68ee", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer" }}>
            Reload
          </button>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(detail).catch(() => undefined)}
            style={{ fontSize: 12, padding: "5px 14px", background: "transparent", border: "1px solid #444", borderRadius: 4, color: "#aaa", cursor: "pointer" }}>
            Copy error
          </button>
          <button type="button" onClick={this.reset}
            title="Clears this panel's saved state (pending level-ups, loot offers, panel layout). Your characters, room and campaign are NOT touched."
            style={{ fontSize: 12, padding: "5px 14px", background: "transparent", border: "1px solid #5a2a2a", borderRadius: 4, color: "#ff9999", cursor: "pointer" }}>
            Reset this panel
          </button>
        </div>
      </div>
    );
  }
}
