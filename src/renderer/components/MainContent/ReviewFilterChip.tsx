import React from 'react';

interface ReviewFilterChipProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

export const ReviewFilterChip: React.FC<ReviewFilterChipProps> = ({
  label,
  count,
  isActive,
  onClick,
}) => (
  <button
    type="button"
    aria-pressed={isActive}
    onClick={onClick}
    data-gamepad-action
    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm leading-5 transition-colors ${
      isActive
        ? 'bg-color-main text-text-dark'
        : 'bg-white/5 text-white hover:bg-white/10'
    }`}
  >
    <span className="font-semibold">{label}</span>
    <span
      className={`font-normal tabular-nums ${isActive ? 'text-text-dark/60' : 'text-text-muted'}`}
    >
      {count}
    </span>
  </button>
);
