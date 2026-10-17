import { Check } from 'lucide-react';
import * as React from 'react';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  id?: string;
  gamepadModalItem?: boolean;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, className, id, gamepadModalItem }, ref) => {
    return (
      <button
        ref={ref}
        role="checkbox"
        aria-checked={checked}
        type="button"
        id={id}
        data-gamepad-modal-item={gamepadModalItem}
        onClick={() => onCheckedChange(!checked)}
        className={`
          relative inline-flex h-5 w-5 items-center justify-center rounded border-2 
          transition-colors duration-200 ease-in-out focus:outline-none 
          ${
            checked
              ? 'bg-color-accent border-color-accent text-text-dark'
              : 'bg-transparent border-border hover:border-border-hover'
          } 
          ${className || ''}
        `}
      >
        {checked && <Check size={14} className="text-current" />}
      </button>
    );
  }
);

Checkbox.displayName = 'Checkbox';
