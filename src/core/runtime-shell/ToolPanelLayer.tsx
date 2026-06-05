import type { ReactNode } from "react";
import type { ToolPanelId, ToolPanelMode } from "./toolPanelTypes";

export type ToolPanelLayerProps = {
  openPanel: ToolPanelId;
  title: string;
  mode?: ToolPanelMode;
  isAllowed: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function ToolPanelLayer({
  openPanel,
  title,
  mode = "drawer",
  isAllowed,
  onClose,
  children,
}: ToolPanelLayerProps) {
  if (!isAllowed || !openPanel) {
    return null;
  }

  return (
    <div className={`fdmc-tool-panel-layer fdmc-tool-panel-layer--${mode}`} role="presentation">
      <button
        type="button"
        className="fdmc-tool-panel-backdrop"
        aria-label="Close DM tool panel"
        onClick={onClose}
      />
      <section className="fdmc-tool-panel-shell" role="dialog" aria-modal={mode === "modal"} aria-label={title}>
        <header className="fdmc-tool-panel-header">
          <h2>{title}</h2>
          <button type="button" className="fdmc-tool-panel-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="fdmc-tool-panel-body">{children}</div>
      </section>
    </div>
  );
}
