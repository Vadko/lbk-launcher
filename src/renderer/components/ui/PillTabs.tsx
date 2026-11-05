import { motion } from 'framer-motion';
import { useId } from 'react';

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
}: PillTabsProps<T>) => {
  const pillId = useId();

  return (
    <div className="glass-card-no-motion p-2! flex gap-2 w-fit">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={active === tab}
          onClick={() => onChange(tab)}
          data-gamepad-action
          className={`relative px-6 py-2 rounded-xl font-medium transition-colors duration-300 ${
            active === tab
              ? 'text-text-dark'
              : 'bg-surface-elevated text-text-muted hover:text-text-main hover:bg-surface-elevated/80'
          }`}
        >
          {active === tab && (
            <motion.span
              layoutId={pillId}
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              // Set as a style so the layout animation keeps the corners round while the pill resizes
              style={{ borderRadius: 12 }}
              className="absolute inset-0 bg-linear-to-r/srgb from-color-accent to-color-main"
            />
          )}
          <span className="relative z-10">{label(tab)}</span>
        </button>
      ))}
    </div>
  );
};
