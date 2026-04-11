import kuli from '@resources/kuli.png';
import team from '@resources/team.svg';
import { AnimatePresence, motion } from 'framer-motion';
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

          if (banner) {
            trackEvent('ads-placement', {
              banner_id: banner.id,
              type: placementType,
              game_id: gameId,
              action: 'view',
            });

            onImpression?.(banner.id);
          } else {
            trackEvent('ads-placement', {
              ads: isKuli ? 'kuli' : 'support',
              type: placementType,
              game_id: gameId,
              action: 'view',
            });
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [banner, gameId, onImpression, placementType, isKuli]);

  const staticBanner = useCallback(
    () => (
      <>
        <img
          src={isNarrowType ? kuli : team}
          className={`${isNarrowType ? 'w-auto h-full max-h-11' : 'h-auto w-full mx-auto mb-auto support-banner'} object-contain object-top`}
          loading="lazy"
        />
        {isNarrowType && (
          <>
            <div>
              <p>Переклад наявний за підтримки KULI</p>{' '}
              <p className="text-color-mixed">
                Будь <span className="font-semibold">першим</span>, хто зіграє з
                перекладом!
              </p>
            </div>

            <Button variant="primary" className="flex-shrink-0">
              Перейти на KULI →
            </Button>
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
        type: placementType,
        game_id: gameId,
        action: 'click',
      });

      onClick?.(banner.id);
    } else {
      trackEvent('ads-placement', {
        ads: isKuli ? 'kuli' : 'support',
        type: placementType,
        game_id: gameId,
        action: 'click',
      });
    }

    let link: string;
    if (banner?.link && banner?.image_path) {
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
      className={`glass-card glass-card-gold cursor-pointer flex items-center justify-between overflow-hidden gap-3 ${isNarrowType ? 'max-h-[90px]' : ''} ${banner ? '!p-0' : ''} ${className}`}
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
      <AnimatePresence mode="wait">
        <motion.div
          key={banner?.id ?? (isKuli ? 'kuli' : 'support')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={`${banner?.image_path ? '' : 'flex items-center justify-between gap-3'} w-full h-full`}
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
