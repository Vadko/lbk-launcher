import React from 'react';

export const WarningFillIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      xmlns="http://www.w3.org/2000/svg"
      d="M30.7733 20.44L20 3.42671C19.0933 2.12004 17.5866 1.33337 16 1.33337C14.4133 1.33337 12.9066 2.10671 11.96 3.46671L1.23997 20.4134C-0.120034 22.36 -0.373368 24.6934 0.573299 26.4934C1.50663 28.2934 3.46663 29.32 5.91997 29.32H26.08C28.5466 29.32 30.4933 28.2934 31.4266 26.4934C32.36 24.6934 32.1066 22.3734 30.7733 20.44ZM14.6666 9.33337C14.6666 8.60004 15.2666 8.00004 16 8.00004C16.7333 8.00004 17.3333 8.60004 17.3333 9.33337V17.3334C17.3333 18.0667 16.7333 18.6667 16 18.6667C15.2666 18.6667 14.6666 18.0667 14.6666 17.3334V9.33337ZM16 25.3334C14.8933 25.3334 14 24.44 14 23.3334C14 22.2267 14.8933 21.3334 16 21.3334C17.1066 21.3334 18 22.2267 18 23.3334C18 24.44 17.1066 25.3334 16 25.3334Z"
      fill="url(#paint0_linear_533_3147)"
    />
    <defs xmlns="http://www.w3.org/2000/svg">
      <linearGradient
        id="paint0_linear_533_3147"
        x1="-0.194787"
        y1="16.4031"
        x2="34.1202"
        y2="16.4031"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#FFA47A" />
        <stop offset="1" stop-color="#A8CF96" />
      </linearGradient>
    </defs>
  </svg>
);
