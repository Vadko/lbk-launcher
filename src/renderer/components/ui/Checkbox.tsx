import { Check } from 'lucide-react';
import * as React from 'react';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  id?: string;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, className, id }, ref) => {
    return (
      <button
        ref={ref}
        role="checkbox"
        aria-checked={checked}
        type="button"
        id={id}
        onClick={() => onCheckedChange(!checked)}
        className={`
          relative inline-flex h-5 w-5 items-center justify-center rounded border-2 
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 
          focus:ring-color-accent focus:ring-offset-2 focus:ring-offset-background
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
