import kuli from '@resources/kuli.png';
import team from '@resources/team.svg';
import React, { useCallback, useEffect, useRef } from 'react';
import type { BannerData } from '@/main/db/banners-api';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';

interface PlacementProps {
  banner: BannerData | null; // Готові дані банера або null
  placementType: 'small_square' | 'narrow';
  gameId: string; // ID гри для аналітики
  isKuli?: boolean; // Чи відображати статичний контент Kuli
  supportUrl?: string; // URL для донату (якщо немає банера)
  onImpression?: (bannerId: string) => void;
  onClick?: (bannerId: string) => void;
  className?: string;
}

/**
 * Компонент для відображення банерів, статичного контенту або донатів
 * Отримує готові дані від батьківського компонента
 */
export const Placement: React.FC<PlacementProps> = ({
  banner,
  placementType,
  gameId,
  isKuli = false,
  supportUrl,
  onImpression,
  onClick,
  className = '',
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasTrackedImpression = useRef(false);

  // Відстеження impression при появі в viewport
  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasTrackedImpression.current) return;

    // Для статичного контенту (Kuli або донат) не треба реєструвати impression
    const shouldTrackImpression = banner?.id;

    if (!shouldTrackImpression) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedImpression.current && banner?.id) {
          hasTrackedImpression.current = true;

          // Записуємо impression через API
          window.electronAPI.recordBannerImpression(banner.id);

          // Відправляємо івент в Mixpanel
          trackEvent('Banner Viewed', {
            banner_id: banner.id,
            placement_type: banner.type,
            game_id: gameId,
          });

          onImpression?.(banner.id);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [banner, gameId, onImpression]);

  // Визначаємо чи це narrow тип для адаптивного рендерингу
  const isNarrowType = placementType === 'narrow';

  const staticBanner = useCallback(
    () => (
      <>
        <img
          src={isNarrowType ? kuli : team}
          className={`w-auto h-full object-contain object-top ${!isNarrowType ? 'mx-auto' : ''}`}
          loading="lazy"
        />
        {isNarrowType && (
          <>
            <div className="flex">
              Скільки вже зіграли з цим перекладом годин:
              {' '}
              <span className="text-color-mixed">
                {`З цим перекладом вже награли ${100} годин`}
              </span>
            </div>

            <Button variant="primary">Перейти на KULI →</Button>
          </>
        )}
      </>
    ),
    [isNarrowType]
  );

  // Не відображаємо компонент, якщо немає контенту
  if (!banner && !isKuli && !supportUrl) {
    return null;
  }

  const handleClick = () => {
    if (banner) {
      trackEvent('Banner Clicked', {
        banner_id: banner.id,
        placement_type: banner.type,
        game_id: gameId,
      });

      onClick?.(banner.id);
    }

    let link: string;
    if (banner?.link) {
      link = banner.link;
    } else if (isKuli) {
      link = 'https://kuli.com.ua/';
    } else if (supportUrl) {
      link = supportUrl;
    } else {
      return;
    }

    window.electronAPI.openExternal(link);
  };

  return (
    <div
      ref={elementRef}
      className={`glass-card glass-card-gold cursor-pointer flex items-center justify-between overflow-hidden ${isNarrowType ? 'max-h-[90px]' : ''} ${banner ? '!p-0' : ''} ${className}`}
      onClick={handleClick}
      role="button"
      data-gamepad-action="true"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {banner?.image_path ? (
        <img
          src={banner.image_path}
          className={`w-full h-full object-cover object-top ${!isNarrowType ? 'mx-auto' : ''}`}
          loading="lazy"
          alt="Banner"
        />
      ) : (
        staticBanner()
      )}
    </div>
  );
};
