import supportBox from '@resources/images/promo-support-box.svg';
import { Heart } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BannerData } from '@/main/db/banners-api';
import { usePromoModalStore } from '../../store/usePromoModalStore';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Modal } from './Modal';

// Окремий компонент для контенту підтримки
interface SupportContentProps {
  dontShowAgain: boolean;
  setDontShowAgain: (value: boolean) => void;
  onDonateClick: () => void;
}

const SupportContent: React.FC<SupportContentProps> = ({
  dontShowAgain,
  setDontShowAgain,
  onDonateClick,
}) => (
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
        Ми розвиваємо цей лаунчер, щоб вам було зручно знаходити та завантажувати ігри.
        Покращуємо швидкість, стабільність і додаємо нові функції.
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
      <label htmlFor="dont-show-again" className="text-sm text-text-muted cursor-pointer">
        Більше не показувати
      </label>
    </div>

    {/* Button */}
    <div className="flex gap-6 justify-center">
      <Button
        variant="primary"
        icon={<Heart size={20} />}
        onClick={onDonateClick}
        data-gamepad-action
      >
        Задонатити
      </Button>
    </div>
  </>
);

export const PromoModal: React.FC = () => {
  const { isOpen, closeModal, shouldShowModal, checkAndResetNeverShow, openModal } =
    usePromoModalStore();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Ref для відстеження чи вже записано view impression для поточної сесії
  const viewImpressionRecorded = useRef(false);

  // Fetch banner data
  const fetchBanner = useCallback(async () => {
    if (!window.electronAPI?.fetchPromoBanner) return null;
    setIsLoading(true);

    try {
      const bannerData = await window.electronAPI.fetchPromoBanner();
      setBanner(bannerData);
      return bannerData;
    } catch (error) {
      console.error('[PromoModal] Error fetching banner:', error);
      return null;
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

  // Promo modal initialization - runs only once on mount
  useEffect(() => {
    const { devMode } = usePromoModalStore.getState();

    if (devMode === 'never') return;

    // Перш ніж перевіряти shouldShowModal, скидаємо neverShow якщо потрібно
    checkAndResetNeverShow();

    if (!shouldShowModal()) return;

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

    if (delay > 0) {
      const timer = setTimeout(async () => {
        // Double-check conditions before showing
        if (shouldShowModal()) {
          const bannerData = await fetchBanner();
          const { devMode: currentDevMode } = usePromoModalStore.getState();
          if (bannerData || currentDevMode === 'always') {
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
  }, [shouldShowModal, openModal, fetchBanner]);
  // Record view impression when modal opens - only once per session
  useEffect(() => {
    if (!isOpen) {
      // Скидаємо флаг при закритті модалки
      viewImpressionRecorded.current = false;
      return;
    }

    // Якщо вже записали impression для цієї сесії - не записуємо знову
    if (viewImpressionRecorded.current) return;

    viewImpressionRecorded.current = true;

    if (banner) {
      recordImpression('view');
      trackEvent('ads-placement', {
        type: 'pop-up_',
        action: 'view',
        banner_id: banner?.id,
      });
    } else {
      trackEvent('ads-placement', { type: 'pop-up_', ads: 'promo', action: 'view' });
    }
  }, [isOpen, banner, recordImpression]);

  const handleClose = () => {
    if (banner) {
      trackEvent('ads-placement', {
        type: 'pop-up_',
        action: 'skip',
        banner_id: banner?.id,
      });
    } else {
      trackEvent('ads-placement', { type: 'pop-up_', ads: 'promo', action: 'skip' });
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
        banner_id: banner?.id,
      });
    } else {
      trackEvent('ads-placement', { type: 'pop-up_', ads: 'promo', action: 'click' });
    }

    // Open banner link or fallback to default donation link
    if (window.electronAPI) {
      window.electronAPI.openExternal(
        banner?.link ||
          'https://donatello.to/atlantDeMaPeine?g=pidtrimka-roboti-lbk-launcher'
      );
    }

    setDontShowAgain(true);
    closeModal(true);
  }, [banner, closeModal, recordImpression]);

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
            <SupportContent
              dontShowAgain={dontShowAgain}
              setDontShowAgain={setDontShowAgain}
              onDonateClick={handleClick}
            />
          ))}
      </div>
    </Modal>
  );
};
