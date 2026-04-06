import supportBox from '@resources/images/promo-support-box.svg';
import { Heart } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BannerData } from '@/main/db/banners-api';
import { usePromoModalStore } from '../../store/usePromoModalStore';
import { trackEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Modal } from './Modal';

// Separate component for support content
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

  // Ref to track if view impression was already recorded for current session
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

    // Dev mode only works in development
    if (import.meta.env.DEV && devMode === 'never') return;

    // Reset neverShowAgain if needed before checking shouldShowModal
    checkAndResetNeverShow();

    // Basic check (ignore checkbox - we don't know yet if there's a banner)
    // Full check with checkbox will be in setTimeout after fetch
    if (!shouldShowModal(true)) return;

    // Listen to dev mode changes and close modal if set to 'never' (dev only)
    const unsubscribe = usePromoModalStore.subscribe((state) => {
      if (import.meta.env.DEV && state.devMode === 'never' && state.isOpen) {
        state.closeModal(false);
      }
    });

    const delay = import.meta.env.DEV && devMode === 'always' ? 1000 : 10000;

    const timer = setTimeout(async () => {
      // Fetch banner first to know if we have ad content
      const bannerData = await fetchBanner();
      const hasBanner = !!(bannerData?.image_path && bannerData?.link);

      // For ad banners - ignore "don't show again" checkbox
      // For SupportContent - respect the checkbox
      if (shouldShowModal(hasBanner)) {
        openModal();
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [shouldShowModal, openModal, fetchBanner, checkAndResetNeverShow]);
  // Record view impression when modal opens - only once per session
  useEffect(() => {
    if (!isOpen) {
      // Reset flag when modal closes
      viewImpressionRecorded.current = false;
      return;
    }

    // If already recorded impression for this session - don't record again
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
