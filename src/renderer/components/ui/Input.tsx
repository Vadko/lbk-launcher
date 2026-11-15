import { useCompositionSafeChange } from '../../hooks/useCompositionSafeChange';

interface InputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'className'> {
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
}

export function Input({
  value,
  onChange,
  icon,
  type = 'text',
  className = '',
  ...inputProps
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
        {...inputProps}
        type={type}
        value={value}
        {...changeHandlers}
        className={`w-full px-4 py-3 ${
          icon ? 'pl-12' : ''
        } bg-glass border border-border rounded-xl text-text-main placeholder:text-text-muted outline-hidden transition-all duration-300 backdrop-blur-lg relative z-0 glass-input`}
      />
    </div>
  );
}
