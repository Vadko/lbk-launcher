import React from 'react';

interface GOGIconProps {
  size?: number;
  className?: string;
}

export const GOGIcon: React.FC<GOGIconProps> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    {/* GOG Logo simplified */}
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14h-9v-1.5h9V16zm0-3h-9v-1.5h9V13zm0-3h-9V8.5h9V10z"/>
  </svg>
);