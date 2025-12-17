import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'green' | 'amber' | 'pink';
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
    'px-8 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-neon-blue focus:ring-offset-2 focus:ring-offset-transparent';

  const variants = {
    primary:
      'bg-gradient-to-r from-[#00c6ff] to-[#0072ff] text-white shadow-[0_4px_15px_rgba(0,114,255,0.4)] hover:shadow-[0_8px_25px_rgba(0,114,255,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    secondary: 'glass-button text-white',
    glass: 'glass-button text-white',
    green:
      'bg-gradient-to-r from-[#00ff88] to-[#00cc44] text-white shadow-[0_4px_15px_rgba(0,255,136,0.4)] hover:shadow-[0_8px_25px_rgba(0,255,136,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    amber:
      'bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] hover:shadow-[0_8px_25px_rgba(245,158,11,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    pink: 'bg-gradient-to-r from-[#ec4899] to-[#db2777] text-white shadow-[0_4px_15px_rgba(236,72,153,0.4)] hover:shadow-[0_8px_25px_rgba(236,72,153,0.6)] hover:brightness-110 hover:-translate-y-0.5',
  };

  return (
    <button
      {...props}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};
