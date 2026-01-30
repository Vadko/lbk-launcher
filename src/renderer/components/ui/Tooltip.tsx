import React, { useEffect, useRef, useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  align?: 'center' | 'left' | 'right';
}

const getAlignClass = (align: 'center' | 'left' | 'right') => {
  switch (align) {
    case 'left':
      return 'right-0';
    case 'right':
      return 'left-0';
    default:
      return 'left-1/2 -translate-x-1/2';
  }
};

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = '',
  align = 'center',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [arrowPosition, setArrowPosition] = useState(50); // відсоток від лівого краю
  const [mouseX, setMouseX] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- intentional position calculation after visibility change */
  useEffect(() => {
    if (isVisible && containerRef.current && tooltipRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      // If tooltip would go above viewport, show it below
      if (rect.top < 40) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }

      // Calculate arrow position based on mouseX
      const relativeX = mouseX - tooltipRect.left;
      const percentage = (relativeX / tooltipRect.width) * 100;
      setArrowPosition(Math.max(5, Math.min(95, percentage)));
    }
  }, [isVisible, mouseX]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={(e) => {
        setMouseX(e.clientX);
        setIsVisible(true);
      }}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md shadow-lg pointer-events-none whitespace-nowrap
            ${position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}
            ${getAlignClass(align)}
            animate-fade-in`}
        >
          {content}
          <div
            className={`absolute w-0 h-0 border-4 border-transparent
              ${position === 'top' ? 'top-full border-t-gray-900' : 'bottom-full border-b-gray-900'}`}
            style={{ left: `${arrowPosition}%`, transform: 'translateX(-50%)' }}
          />
        </div>
      )}
    </span>
  );
};
