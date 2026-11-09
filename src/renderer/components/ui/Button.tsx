interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?:
    | 'primary'
    | 'secondary'
    | 'secondary_simple'
    | 'gradient'
    | 'amber'
    | 'pink'
    | 'accent'
    | 'ghost'
    | 'filter';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  width?: 'narrow' | 'normal' | 'wide';
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  width = 'normal',
  className = '',
  icon,
  ...props
}: ButtonProps) {
  const baseStyles =
    'group/button py-3.5 min-h-[54px] rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-color-main text-text-dark shadow-[0_4px_15px_rgba(168,207,150,0.4)] hover:shadow-[0_8px_25px_rgba(168,207,150,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    secondary: 'glass-button text-white',
    secondary_simple: 'bg-glass border border-border hover:bg-glass-hover',
    gradient:
      'bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark hover:opacity-90',
    amber:
      'bg-color-mixed text-text-dark shadow-[0_4px_15px_rgba(239,238,173,0.4)] hover:shadow-[0_8px_25px_rgba(239,238,173,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    pink: 'bg-linear-to-r/srgb from-[#ec4899] to-[#db2777] text-white shadow-[0_4px_15px_rgba(236,72,153,0.4)] hover:shadow-[0_8px_25px_rgba(236,72,153,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    accent:
      'bg-color-accent text-text-dark shadow-[0_4px_15px_rgba(255,164,122,0.4)] hover:shadow-[0_8px_25px_rgba(255,164,122,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    ghost:
      'px-2! py-1! gap-1! min-h-0! rounded-full! bg-transparent text-text-main hover:bg-white/5 focus-visible:bg-white/5 focus:bg-white/10 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-white outline-offset-0!',
    filter:
      'p-2! min-h-[38px]! min-w-[38px] gap-1! text-sm border bg-glass text-text-muted border-transparent hover:bg-glass-hover hover:text-text-main',
  };

  const widths = {
    narrow: 'px-4',
    normal: 'px-8',
    wide: 'px-12',
  };

  return (
    <button
      {...props}
      className={`${baseStyles} ${variants[variant]} ${widths[width]} ${className}`}
    >
      {icon && <span className="inline-flex shrink-0 items-center">{icon}</span>}
      {children}
    </button>
  );
}
