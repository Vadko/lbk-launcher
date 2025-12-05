import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'green';
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  title?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  onClick,
  className = '',
  disabled = false,
  icon,
  title,
}) => {
  const baseStyles = 'px-8 py-3.5 rounded-xl font-semibold text-base flex items-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-gradient-to-r from-[#00c6ff] to-[#0072ff] text-white shadow-[0_4px_15px_rgba(0,114,255,0.4)] hover:shadow-[0_8px_25px_rgba(0,114,255,0.6)] hover:brightness-110 hover:-translate-y-0.5',
    secondary: 'glass-button text-white',
    glass: 'glass-button text-white',
    green: 'bg-gradient-to-r from-[#00ff88] to-[#00cc44] text-white shadow-[0_4px_15px_rgba(0,255,136,0.4)] hover:shadow-[0_8px_25px_rgba(0,255,136,0.6)] hover:brightness-110 hover:-translate-y-0.5',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};
