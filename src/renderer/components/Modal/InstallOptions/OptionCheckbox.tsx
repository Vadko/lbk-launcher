import React from 'react';

interface OptionCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const OptionCheckbox: React.FC<OptionCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
}) => (
  <div className="relative flex items-center justify-center mt-0.5">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      data-gamepad-modal-item
      className={`appearance-none w-5 h-5 rounded-md bg-glass border border-border checked:bg-color-main checked:border-color-main transition-colors focus:ring-2 focus:ring-color-main/50 focus:outline-hidden disabled:opacity-50 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    />
    <svg
      className={`absolute w-3 h-3 text-text-dark pointer-events-none transition-opacity ${
        checked ? 'opacity-100' : 'opacity-0'
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </div>
);
