import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- intentional position calculation after visibility change */
  useEffect(() => {
    if (isVisible && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // If tooltip would go above viewport, show it below
      if (rect.top < 40) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [isVisible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap pointer-events-none
            ${position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}
            left-1/2 -translate-x-1/2
            animate-fade-in`}
        >
          {content}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent
              ${position === 'top' ? 'top-full border-t-gray-900' : 'bottom-full border-b-gray-900'}`}
          />
        </div>
      )}
    </span>
  );
};
