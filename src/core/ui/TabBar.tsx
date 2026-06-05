import { DEFAULT_PLAYER_TABS } from "../constants/defaultTabs";
import type { TabId } from "../types/tabs";

type TabBarProps = {
  activeTab: TabId;
  onChangeTab: (tabId: TabId) => void;
  visibleTabs?: TabId[];
};

export function TabBar({ activeTab, onChangeTab, visibleTabs }: TabBarProps) {
  const visibleTabSet = visibleTabs ? new Set(visibleTabs) : null;
  const tabs = visibleTabSet ? DEFAULT_PLAYER_TABS.filter((tab) => visibleTabSet.has(tab.id)) : DEFAULT_PLAYER_TABS;

  return (
    <nav className="tab-bar" aria-label="Combat card tabs">
      {tabs.map((tab) => (
        <button
          className={`tab-button ${tab.id === activeTab ? "active" : ""}`}
          key={tab.id}
          type="button"
          onClick={() => onChangeTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
