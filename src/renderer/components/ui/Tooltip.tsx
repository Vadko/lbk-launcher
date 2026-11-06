import React, { useCallback, useRef, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { type TooltipAlign, tooltipArrowLeft } from './tooltipArrowLeft';

interface TooltipProps {
  content: string | null;
  children: React.ReactNode;
  className?: string;
  align?: TooltipAlign;
}

const getAlignClass = (align: TooltipAlign) => {
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
  const [arrowLeft, setArrowLeft] = useState<number | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Layout widths, not rects, so the fade-in transform does not skew where the arrow points
  const measureTooltip = useCallback(
    (node: HTMLDivElement | null) => {
      const container = containerRef.current;
      if (!node || !container) {
        return;
      }
      setPosition(container.getBoundingClientRect().top < 40 ? 'bottom' : 'top');
      setArrowLeft(tooltipArrowLeft(align, container.offsetWidth, node.offsetWidth));
    },
    [align]
  );

  if (!content) {
    return <>{children}</>;
  }

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
            style={{ left: arrowLeft ?? '50%', transform: 'translateX(-50%)' }}
          />
        </div>
      )}
    </span>
  );
};
