interface PillTabsProps<T extends string> {
  tabs: readonly T[];
  active: T;
  label: (tab: T) => string;
  onChange: (tab: T) => void;
}

export const PillTabs = <T extends string>({
  tabs,
  active,
  label,
  onChange,
}: PillTabsProps<T>) => (
  <div className="glass-card-no-motion p-2! flex gap-2 w-fit">
    {tabs.map((tab) => (
      <button
        key={tab}
        type="button"
        aria-pressed={active === tab}
        onClick={() => onChange(tab)}
        data-gamepad-action
        className={`px-6 py-2 rounded-xl font-medium transition-all ${
          active === tab
            ? 'bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark'
            : 'bg-surface-elevated text-text-muted hover:text-text-main hover:bg-surface-elevated/80'
        }`}
      >
        {label(tab)}
      </button>
    ))}
  </div>
);
