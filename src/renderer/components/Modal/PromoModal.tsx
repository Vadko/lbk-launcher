import supportBox from '@resources/images/promo-support-box.svg';
import { Heart } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import type { BannerData } from '@/main/db/banners-api';
import { usePromoModalStore } from '../../store/usePromoModalStore';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Modal } from './Modal';

export const PromoModal: React.FC = () => {
  const { isOpen, closeModal, shouldShowModal, openModal } = usePromoModalStore();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch banner data
  const fetchBanner = useCallback(async () => {
    if (!window.electronAPI?.fetchPromoBanner) return;
    setIsLoading(true);

    try {
      const bannerData = await window.electronAPI.fetchPromoBanner();
      setBanner(bannerData);
    } catch (error) {
      console.error('[PromoModal] Error fetching banner:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Record banner impression
  const recordImpression = useCallback(
    async (impressionType: 'view' | 'click') => {
      if (!banner?.id || !window.electronAPI?.recordPromoBannerImpression) return;

      try {
        await window.electronAPI.recordPromoBannerImpression({
          campaignId: banner.id,
          impressionType,
        });
      } catch (error) {
        console.error('[PromoModal] Error recording impression:', error);
      }
    },
    [banner?.id]
  );

  // Promo modal logic - show after delay based on dev mode
  useEffect(() => {
    const { devMode } = usePromoModalStore.getState();

    if (devMode === 'never') return;

    // Listen to dev mode changes and close modal if set to 'never'
    const unsubscribe = usePromoModalStore.subscribe((state) => {
      if (state.devMode === 'never' && state.isOpen) {
        state.closeModal(false);
      }
    });

    // Determine delay based on dev mode
    const getDelay = () => {
      if (devMode === 'always') return 1000; // 1 second for testing
      if (devMode === 'normal') return 10000; // 10 seconds for normal use
      return 0;
    };

    const delay = getDelay();

    if (delay > 0 && shouldShowModal()) {
      const timer = setTimeout(async () => {
        if (shouldShowModal()) {
          // Fetch banner before showing modal
          await fetchBanner();
          // Only show modal if we have a banner or if it's dev mode
          const { devMode: currentDevMode } = usePromoModalStore.getState();
          if (banner || currentDevMode === 'always') {
            openModal();
          }
        }
      }, delay);

      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }

    return unsubscribe;
  }, [shouldShowModal, openModal, fetchBanner, banner]);

  // Record view impression when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (banner) {
      recordImpression('view');
      trackEvent('ads-placement', {
        type: 'pop-up_',
        action: 'view',
        bannerCampaignId: banner?.id,
      });
    } else {
      trackEvent('ads-placement', { type: 'pop-up_', action: 'view' });
    }
  }, [isOpen, banner, recordImpression]);

  const handleClose = () => {
    if (banner) {
      trackEvent('ads-placement', {
        type: 'pop-up_',
        action: 'skip',
        bannerCampaignId: banner?.id,
      });
    } else {
      trackEvent('ads-placement', { type: 'pop-up_', action: 'skip' });
    }
    closeModal(dontShowAgain);
  };

  const handleClick = useCallback(async () => {
    // Record click impression first
    if (banner) {
      await recordImpression('click');
      trackEvent('ads-placement', {
        type: 'pop-up_',
        action: 'click',
        bannerCampaignId: banner?.id,
      });
    } else {
      trackEvent('ads-placement', { type: 'pop-up_', action: 'click' });
    }

    // Open banner link or fallback to default donation link
    if (window.electronAPI) {
      window.electronAPI.openExternal(
        banner?.link || 'https://donatello.to/atlantDeMaPeine?g=pidtrimka-roboti-lbk-launcher'
      );
    }

    setDontShowAgain(true);
    closeModal(dontShowAgain);
  }, [banner, dontShowAgain, closeModal, recordImpression]);

  const supportContent = useCallback(
    () => (
      <>
        {/* Image */}
        <div className="flex justify-center">
          <img
            src={supportBox}
            alt="Підтримайте український лаунчер!"
            width={190}
            height={184}
          />
        </div>

        {/* Text content - use fallback if no banner */}
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-head font-semibold text-text-main">
            Трохи підтримки для лаунчера?
          </h2>
          <p>
            Ми розвиваємо цей лаунчер, щоб вам було зручно знаходити та завантажувати
            ігри. Покращуємо швидкість, стабільність і додаємо нові функції.
          </p>
          <div className="text-text-muted">Навіть маленький внесок має значення ✨</div>
        </div>

        {/* Checkbox */}
        <div className="flex items-center justify-center gap-3">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={setDontShowAgain}
          />
          <label
            htmlFor="dont-show-again"
            className="text-sm text-text-muted cursor-pointer"
          >
            Більше не показувати
          </label>
        </div>

        {/* Button */}
        <div className="flex gap-6 justify-center">
          <Button
            variant="primary"
            icon={<Heart size={20} />}
            onClick={handleClick}
            data-gamepad-action
          >
            Задонатити
          </Button>
        </div>
      </>
    ),
    [dontShowAgain, handleClick]
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} styleModal="promo">
      <div className={`flex flex-col gap-6 ${!banner ? 'p-8' : ''}`}>
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-color-accent"></div>
          </div>
        )}

        {!isLoading &&
          (banner?.image_path && banner?.link ? (
            <div
              className="flex justify-center"
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
              <img
                src={banner?.image_path}
                alt="Banner"
                className="w-full h-full max-h-[400px] object-cover"
                onError={(e) => {
                  console.error('[PromoModal] Image failed to load:', banner?.image_path);
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          ) : (
            supportContent()
          ))}
      </div>
    </Modal>
  );
};
