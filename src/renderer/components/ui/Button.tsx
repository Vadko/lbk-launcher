import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'amber' | 'pink' | 'accent' | 'ghost';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  icon,
  ...props
}) => {
  const baseStyles =
    'px-8 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-color-main text-text-dark shadow-[0_4px_15px_rgba(168,207,150,0.4)] hover:shadow-[0_8px_25px_rgba(168,207,150,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    secondary: 'glass-button text-white',
    glass: 'glass-button text-white',
    amber:
      'bg-color-mixed text-text-dark shadow-[0_4px_15px_rgba(239,238,173,0.4)] hover:shadow-[0_8px_25px_rgba(239,238,173,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    pink: 'bg-gradient-to-r from-[#ec4899] to-[#db2777] text-white shadow-[0_4px_15px_rgba(236,72,153,0.4)] hover:shadow-[0_8px_25px_rgba(236,72,153,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    accent:
      'bg-color-accent text-text-dark shadow-[0_4px_15px_rgba(255,164,122,0.4)] hover:shadow-[0_8px_25px_rgba(255,164,122,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    ghost:
      '!px-2 !py-1 !gap-1 !rounded-full bg-transparent text-text-main hover:bg-white/5 focus-visible:bg-white/5 focus:bg-white/10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white !outline-offset-0',
  };

  return (
    <button {...props} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};
