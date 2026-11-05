import { motion } from 'framer-motion';
import { type ReactNode, useId } from 'react';
import { Tooltip } from './Tooltip';

type SlidingTabsVariant = 'pill' | 'icon' | 'chip';

interface VariantStyle {
  list: string;
  tab: string;
  content: string;
  idle: string;
  current: string;
  indicator: string;
  // A style radius, so the layout animation keeps the corners round while the indicator resizes
  radius: number;
  // Tabs switch a panel; toggles only filter, and a second press may clear them
  semantics: 'tabs' | 'toggles';
}

const VARIANTS: Record<SlidingTabsVariant, VariantStyle> = {
  pill: {
    list: 'glass-card-no-motion p-2! flex gap-2 w-fit',
    tab: 'px-6 py-2 rounded-xl font-medium',
    content: '',
    idle: 'text-text-muted hover:text-text-main',
    current: 'text-text-dark',
    indicator: 'bg-linear-to-r/srgb from-color-accent to-color-main',
    radius: 12,
    semantics: 'toggles',
  },
  icon: {
    list: 'inline-flex shrink-0 gap-1 p-1 rounded-xl border border-white/10 bg-white/5',
    tab: 'p-3 rounded-[9px]',
    content: 'flex items-center gap-1.5',
    idle: 'text-text-muted hover:text-text-main hover:bg-white/5',
    current: 'text-text-main',
    indicator: 'bg-white/10',
    radius: 9,
    semantics: 'tabs',
  },
  chip: {
    list: 'flex flex-wrap items-center gap-2',
    tab: 'px-3.5 py-1.5 rounded-full text-sm leading-5 bg-white/5',
    content: 'flex items-center gap-1.5',
    idle: 'text-white hover:bg-white/10',
    current: 'text-text-dark',
    indicator: 'bg-color-main',
    radius: 9999,
    semantics: 'toggles',
  },
};

interface SlidingTabsProps<T extends string> {
  tabs: readonly T[];
  active: T | null;
  onChange: (tab: T) => void;
  label: (tab: T, isActive: boolean) => ReactNode;
  variant?: SlidingTabsVariant;
  tooltip?: (tab: T) => string;
}

export const SlidingTabs = <T extends string>({
  tabs,
  active,
  onChange,
  label,
  variant = 'pill',
  tooltip,
}: SlidingTabsProps<T>) => {
  const indicatorId = useId();
  const style = VARIANTS[variant];
  const isTabs = style.semantics === 'tabs';

  return (
    <div role={isTabs ? 'tablist' : undefined} className={style.list}>
      {tabs.map((tab) => {
        const isActive = active === tab;
        const button = (
          <button
            key={tab}
            type="button"
            role={isTabs ? 'tab' : undefined}
            aria-selected={isTabs ? isActive : undefined}
            aria-pressed={isTabs ? undefined : isActive}
            onClick={() => onChange(tab)}
            data-gamepad-action
            className={`relative transition-colors duration-300 ${style.tab} ${isActive ? style.current : style.idle}`}
          >
            {isActive && (
              <motion.span
                layoutId={indicatorId}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                style={{ borderRadius: style.radius }}
                className={`absolute inset-0 ${style.indicator}`}
              />
            )}
            <span className={`relative z-10 ${style.content}`}>
              {label(tab, isActive)}
            </span>
          </button>
        );
        return tooltip ? (
          <Tooltip key={tab} content={tooltip(tab)}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </div>
  );
};
