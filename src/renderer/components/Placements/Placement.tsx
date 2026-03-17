import kuli from '@resources/kuli.png';
import team from '@resources/team.svg';
import React, { useCallback, useEffect, useRef } from 'react';
import type { BannerData } from '@/main/db/banners-api';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';

interface PlacementProps {
  banner: BannerData | null;
  placementType: 'small_square' | 'narrow';
  gameId: string;
  isKuli?: boolean;
  supportUrl?: string;
  onImpression?: (bannerId: string) => void;
  onClick?: (bannerId: string) => void;
  className?: string;
}

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
  const isNarrowType = placementType === 'narrow';

  // Відстеження impression при появі в viewport
  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasTrackedImpression.current || !banner?.id) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedImpression.current && banner?.id) {
          hasTrackedImpression.current = true;

          trackEvent('ads-placement', {
            banner_id: banner.id,
            type: banner.type,
            game_id: gameId,
            action: 'view',
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

  if (!banner && !isKuli && !supportUrl) {
    return null;
  }

  const handleClick = () => {
    if (banner) {
      trackEvent('ads-placement', {
        banner_id: banner.id,
        type: banner.type,
        game_id: gameId,
        action: 'click',
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
