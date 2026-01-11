import React from 'react';

interface EpicIconProps {
  size?: number;
  className?: string;
}

export const EpicIcon: React.FC<EpicIconProps> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    {/* Epic Games Logo simplified */}
    <path d="M3 3h18v18H3V3zm15.5 14.5v-11h-13v11h13zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/>
  </svg>
);