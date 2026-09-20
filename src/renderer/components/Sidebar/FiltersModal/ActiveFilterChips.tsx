import { X } from 'lucide-react';
import React from 'react';

interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFilterChipsProps {
  chips: ActiveFilterChip[];
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({ chips }) => {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-glass-hover text-text-main text-sm"
        >
          <span className="truncate max-w-[220px]">{chip.label}</span>
          <button
            onClick={chip.onRemove}
            data-gamepad-modal-item
            title="Зняти фільтр"
            className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-glass text-text-muted hover:text-text-main flex-shrink-0"
          >
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
};
