interface PillTabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}

export const PillTabs = <T extends string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: PillTabsProps<T>) => (
  <div
    role="tablist"
    className={`glass-card-no-motion !p-2 flex gap-2 w-fit ${className}`}
  >
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        onClick={() => onChange(tab.id)}
        data-gamepad-action
        className={`px-6 py-2 rounded-xl font-medium transition-all ${
          activeTab === tab.id
            ? 'bg-gradient-to-r from-color-accent to-color-main text-text-dark'
            : 'bg-surface-elevated text-text-muted hover:text-text-main hover:bg-surface-elevated/80'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
