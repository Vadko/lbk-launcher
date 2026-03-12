import React, { useEffect, useRef } from 'react';
import { usePlacements } from '../../queries/usePlacements';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';

interface PlacementProps {
  placementId: string;
  gameId?: string;
  onImpression?: (placementId: string) => void;
  onClick?: (placementId: string) => void;
  className?: string;
  type?: 'small_square'  | 'narrow' | 'large_popup';
}

/**
 * Компонент для відображення одного placement
 * Отримує дані за ID самостійно
 */
export const Placement: React.FC<PlacementProps> = ({
  placementId,
  gameId,
  onImpression,
  onClick,
  className = '',
  type = 'small_square',
}) => {
  const { data: placements } = usePlacements();
  const elementRef = useRef<HTMLDivElement>(null);
  const impressionTrackedRef = useRef(false);

  // Шукаємо placement за ID
  const placement = placements?.find((p) => p.id === placementId);

  // Відстеження impression при появі в viewport
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !placement || impressionTrackedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionTrackedRef.current) {
          impressionTrackedRef.current = true;

          // Відправляємо івент в Mixpanel
          trackEvent('Placement Viewed', {
            placement_id: placement.id,
            placement_type: placement.type,
            game_id: gameId || placement.gameId,
          });

          onImpression?.(placement.id);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [placement, gameId, onImpression]);

  // Якщо placement не знайдений, не рендеримо нічого
  if (!placement) {
    return null;
  }

  const handleClick = () => {
    // Відправляємо івент в Mixpanel
    trackEvent('Placement Clicked', {
      placement_id: placement.id,
      placement_type: placement.type,
      game_id: gameId || placement.gameId,
      target_url: placement.link,
    });

    onClick?.(placement.id);

    // Відкриваємо посилання
    window.electronAPI.openExternal(placement.link);
  };

  return (
    <div
      ref={elementRef}
      className={`glass-card glass-card-gold cursor-pointer flex items-center justify-between ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <img
        src={placement.image_path || placement.icon_path}
        alt={placement.title}
        className={`w-auto h-full object-contain object-top ${type === 'small_square' ? 'mx-auto' : ''}`}
        loading="lazy"
      />
      {type === 'narrow' && (
        <>
          <div className="flex">
            {placement.title}
            {' '}
            {placement.subtitle && (
              <span className="text-color-mixed">
                {placement.subtitle.replace('{number}', '100')}
              </span>
            )}
          </div>
          {placement.button_text && <Button variant="primary">{placement.button_text}</Button>}
        </>
      )}
    </div>
  );
};
