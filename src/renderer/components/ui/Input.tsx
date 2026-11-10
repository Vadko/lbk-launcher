import { useCompositionSafeChange } from '../../hooks/useCompositionSafeChange';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  type?: string;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
  onFocus?: () => void;
  'aria-label'?: string;
  'data-gamepad-action'?: boolean;
}

export function Input({
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
  className = '',
  ref,
  onFocus,
  'aria-label': ariaLabel,
  'data-gamepad-action': gamepadAction,
}: InputProps) {
  const changeHandlers = useCompositionSafeChange(onChange);

  return (
    <div className={`relative ${className}`}>
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        ref={ref}
        type={type}
        value={value}
        {...changeHandlers}
        onFocus={onFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-gamepad-action={gamepadAction}
        className={`w-full px-4 py-3 ${
          icon ? 'pl-12' : ''
        } bg-glass border border-border rounded-xl text-text-main placeholder:text-text-muted outline-hidden transition-all duration-300 backdrop-blur-lg relative z-0 glass-input`}
      />
    </div>
  );
}
