/**
 * SavePromptBanner — fixed top banner shown on every client when an action calls for a
 * saving throw. Driven by the savePrompt broadcast. Dismissible; auto-clears after a few
 * seconds. Render it once near the top of each entry point (main app + popouts).
 */

import { useSavePrompt } from "../state/savePrompt";

export function SavePromptBanner() {
  const { prompt, dismiss } = useSavePrompt();
  if (!prompt) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed", top: 8, left: 8, right: 8, zIndex: 400,
        background: "#2a1d0a", border: "1px solid #e0a85a", borderRadius: 8,
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
        boxShadow: "0 6px 20px rgba(0,0,0,0.55)",
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>⚠</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f0c040" }}>
          Saving Throw — {prompt.save}
        </div>
        <div style={{ fontSize: 11, color: "#cfc7b8" }}>
          {prompt.source}: {prompt.action}. {prompt.targets && prompt.targets.length > 0
            ? `${prompt.targets.join(", ")} must roll a ${prompt.save} save.`
            : `Affected creatures roll a ${prompt.save} save.`}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        style={{
          flexShrink: 0, fontSize: 11, padding: "4px 10px", background: "transparent",
          border: "1px solid #e0a85a88", borderRadius: 4, color: "#e0c890", cursor: "pointer",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
