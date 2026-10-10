import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getGameImageUrl } from '@/renderer/utils/imageUrl';

interface ReviewImagesProps {
  images: string[];
}

const NAV_BUTTON =
  'absolute top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer';

export const ReviewImages: React.FC<ReviewImagesProps> = ({ images }) => {
  const urls = images.map((path) => getGameImageUrl(path)).filter(Boolean) as string[];
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (direction: -1 | 1) =>
      setOpenIndex((current) =>
        current === null ? current : (current + direction + urls.length) % urls.length
      ),
    [urls.length]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'ArrowLeft') {
        step(-1);
      } else if (e.key === 'ArrowRight') {
        step(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close, step]);

  if (urls.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="w-16 h-16 overflow-hidden rounded-lg border border-white/10 hover:border-color-main transition-colors cursor-zoom-in"
            data-gamepad-action
          >
            <img
              src={url}
              alt={`Скриншот ${index + 1}`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {openIndex !== null &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl cursor-zoom-out"
            onClick={close}
          >
            <button
              type="button"
              onClick={close}
              data-gamepad-cancel
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={22} className="text-white" />
            </button>
            {urls.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${NAV_BUTTON} left-6`}
                  onClick={(e) => {
                    e.stopPropagation();
                    step(-1);
                  }}
                >
                  <ChevronLeft size={26} className="text-white" />
                </button>
                <button
                  type="button"
                  className={`${NAV_BUTTON} right-6`}
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                >
                  <ChevronRight size={26} className="text-white" />
                </button>
              </>
            )}
            <img
              src={urls[openIndex]}
              alt={`Скриншот ${openIndex + 1}`}
              className="max-w-[90vw] max-h-[95vh] object-contain rounded-lg cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.getElementById('root') ?? document.body
        )}
    </>
  );
};
