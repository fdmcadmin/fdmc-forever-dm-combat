import { DEFAULT_PLAYER_TABS } from "../constants/defaultTabs";
import type { TabId } from "../types/tabs";
import { tabAccent } from "./tabVisuals";

type TabBarProps = {
  activeTab: TabId;
  onChangeTab: (tabId: TabId) => void;
  visibleTabs?: TabId[];
  /** Per-tab item counts — renders a small badge next to the label when > 0. */
  counts?: Partial<Record<TabId, number>>;
};

export function TabBar({ activeTab, onChangeTab, visibleTabs, counts }: TabBarProps) {
  const visibleTabSet = visibleTabs ? new Set(visibleTabs) : null;
  const tabs = visibleTabSet ? DEFAULT_PLAYER_TABS.filter((tab) => visibleTabSet.has(tab.id)) : DEFAULT_PLAYER_TABS;

  return (
    <nav className="tab-bar" aria-label="Combat card tabs">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const accent = tabAccent(tab.id);
        const count = counts?.[tab.id] ?? 0;
        return (
          <button
            className={`tab-button ${isActive ? "active" : ""}`}
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            aria-current={isActive ? "true" : undefined}
            style={{
              // Color accent: active tab gets a solid accent underline + text tint;
              // inactive tabs keep a faint accent dot so each tab reads distinctly.
              borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
              color: isActive ? accent : undefined,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: accent, opacity: isActive ? 1 : 0.45, flexShrink: 0,
              }}
            />
            {tab.label}
            {count > 0 && (
              <span
                aria-label={`${count} items`}
                style={{
                  fontSize: 10, lineHeight: 1, fontWeight: 600,
                  padding: "1px 5px", borderRadius: 8,
                  background: isActive ? accent : "#2a2a3e",
                  color: isActive ? "#0d0d14" : "#9a9ab0",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
