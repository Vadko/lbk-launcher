import React, { useCallback, useRef, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';

interface TooltipProps {
  content: string | null;
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
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [arrowPosition, setArrowPosition] = useState(50); // percent from the left edge
  const mouseXRef = useRef(0);
  const containerRef = useRef<HTMLSpanElement>(null);

  const measureTooltip = useCallback((node: HTMLDivElement | null) => {
    if (!node || !containerRef.current) {
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipRect = node.getBoundingClientRect();

    setPosition(rect.top < 40 ? 'bottom' : 'top');

    const relativeX = mouseXRef.current - tooltipRect.left;
    const percentage = (relativeX / tooltipRect.width) * 100;
    setArrowPosition(Math.max(5, Math.min(95, percentage)));
  }, []);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={(e) => {
        mouseXRef.current = e.clientX;
        setIsVisible(true);
      }}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={measureTooltip}
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md shadow-lg pointer-events-none whitespace-nowrap
            ${position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}
            ${getAlignClass(align)}
            ${animationsEnabled ? 'animate-fade-in' : ''}`}
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
