import React from 'react';
import { Button } from '../../ui/Button';

interface FilterPillOption {
  label: string;
  value: string;
  count?: number;
  icon?: React.ReactNode;
}

interface FilterPillGroupProps {
  options: FilterPillOption[];
  isSelected: (value: string) => boolean;
  onToggle: (value: string) => void;
}

export const FilterPillGroup: React.FC<FilterPillGroupProps> = ({
  options,
  isSelected,
  onToggle,
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((option) => {
      const selected = isSelected(option.value);
      return (
        <Button
          variant="filter"
          key={option.value}
          onClick={() => onToggle(option.value)}
          data-gamepad-modal-item
          className={selected ? '!bg-glass-hover !text-text-main !border-color-main' : ''}
        >
          {option.icon}
          <span>{option.label}</span>
          {option.count !== undefined && (
            <span
              className={`text-xs leading-4 ${selected ? 'text-color-main' : 'text-text-muted'}`}
            >
              {option.count}
            </span>
          )}
        </Button>
      );
    })}
  </div>
);
