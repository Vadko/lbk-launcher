import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGamepadModeStore } from '@/renderer/store/useGamepadModeStore';
import { playNavigateSound } from '@/renderer/utils/gamepadSounds';
import { getGameImageUrl } from '@/renderer/utils/imageUrl';
import { isValidGamepad } from '@/renderer/utils/isValidGamepad';

// D-pad/stick тільки для навігації по слайдах у повноекранному перегляді;
// решта кнопок (A/B) вже обробляється спільним useGamepadModeNavigation
// через role="dialog" + data-gamepad-cancel.
const GAMEPAD_DPAD_LEFT = 14;
const GAMEPAD_DPAD_RIGHT = 15;
const GAMEPAD_AXIS_LEFT_X = 0;
const GAMEPAD_DEADZONE = 0.5;
const GAMEPAD_INPUT_DELAY = 220;

type Props = {
  slides: Array<string>;
  updated_at?: string;
  spaceBetween?: number;
  slidesPerView?: number;
  loop?: boolean;
  pagination?: boolean;
  thumbs?: boolean;
  autoplay?: boolean;
};

export default function Gallery({
  slides,
  spaceBetween = 10,
  slidesPerView = 1,
  loop = true,
  pagination = true,
  thumbs = false,
  autoplay = false,
  updated_at,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isVertical, setIsVertical] = useState(false);

  const [mainEmblaRef, mainEmblaApi] = useEmblaCarousel(
    {
      loop,
      align: 'start',
    },
    autoplay ? [Autoplay({ delay: 3000, stopOnInteraction: false })] : []
  );

  const [thumbEmblaRef, thumbEmblaApi] = useEmblaCarousel({
    containScroll: 'keepSnaps',
    axis: isVertical ? 'y' : 'x',
  });

  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const isGamepadMode = useGamepadModeStore((s) => s.isGamepadMode);

  const slidesUrls = slides
    .filter((slide): slide is string => typeof slide === 'string')
    .map((slide) => getGameImageUrl(slide, updated_at) || '')
    .filter(Boolean);

  // Відслідковування розміру вікна для адаптивності thumbs
  useEffect(() => {
    const handleResize = () => {
      setIsVertical(window.innerWidth >= 1441);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Перезапуск thumbs carousel при зміні орієнтації
  useEffect(() => {
    if (thumbEmblaApi) {
      thumbEmblaApi.reInit();
    }
  }, [isVertical, thumbEmblaApi]);

  const onThumbClick = useCallback(
    (index: number) => {
      if (!mainEmblaApi || !thumbEmblaApi) {
        return;
      }
      mainEmblaApi.scrollTo(index);
    },
    [mainEmblaApi, thumbEmblaApi]
  );

  const onSelect = useCallback(() => {
    if (!mainEmblaApi || !thumbEmblaApi) {
      return;
    }
    const index = mainEmblaApi.selectedScrollSnap();
    setSelectedIndex(index);
    thumbEmblaApi.scrollTo(index);
  }, [mainEmblaApi, thumbEmblaApi]);

  useEffect(() => {
    if (!mainEmblaApi) {
      return;
    }
    onSelect();
    mainEmblaApi.on('select', onSelect);
    mainEmblaApi.on('reInit', onSelect);

    return () => {
      mainEmblaApi.off('select', onSelect);
      mainEmblaApi.off('reInit', onSelect);
    };
  }, [mainEmblaApi, onSelect]);

  const openFullscreen = (index: number) => setFullscreenIndex(index);
  const closeFullscreen = () => setFullscreenIndex(null);

  const stepFullscreenSlide = useCallback(
    (direction: -1 | 1) => {
      if (slidesUrls.length === 0) {
        return;
      }
      setFullscreenIndex((current) => {
        if (current === null) {
          return current;
        }
        const next = (current + direction + slidesUrls.length) % slidesUrls.length;
        mainEmblaApi?.scrollTo(next);
        return next;
      });
    },
    [slidesUrls.length, mainEmblaApi]
  );

  const isFullscreenOpen = fullscreenIndex !== null;

  useEffect(() => {
    if (!isFullscreenOpen) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFullscreen();
      } else if (e.key === 'ArrowLeft') {
        stepFullscreenSlide(-1);
      } else if (e.key === 'ArrowRight') {
        stepFullscreenSlide(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenOpen, stepFullscreenSlide]);

  // Гортання слайдів у повноекранному перегляді хрестовиною/стіком геймпада.
  // A/B тут вже обробляються спільним useGamepadModeNavigation через
  // role="dialog" + data-gamepad-cancel на кнопці закриття.
  // Важливо: залежність саме від булевого isFullscreenOpen, а не від
  // fullscreenIndex — інакше кожен крок гортання перезапускає ефект і
  // обнуляє lastInputAt, і дебаунс нижче ніколи не встигає спрацювати.
  useEffect(() => {
    if (!isFullscreenOpen || !isGamepadMode) {
      return;
    }

    let rafId = 0;
    let lastInputAt = 0;

    const tick = () => {
      const pads = navigator.getGamepads();
      const gp = pads.find((pad) => pad?.connected && isValidGamepad(pad)) ?? null;

      if (gp) {
        const leftPressed =
          gp.buttons[GAMEPAD_DPAD_LEFT]?.pressed ||
          gp.axes[GAMEPAD_AXIS_LEFT_X] < -GAMEPAD_DEADZONE;
        const rightPressed =
          gp.buttons[GAMEPAD_DPAD_RIGHT]?.pressed ||
          gp.axes[GAMEPAD_AXIS_LEFT_X] > GAMEPAD_DEADZONE;

        if (
          (leftPressed || rightPressed) &&
          Date.now() - lastInputAt > GAMEPAD_INPUT_DELAY
        ) {
          lastInputAt = Date.now();
          playNavigateSound();
          stepFullscreenSlide(leftPressed ? -1 : 1);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isFullscreenOpen, isGamepadMode, stepFullscreenSlide]);

  // Розмір одного thumb-слайда з урахуванням gap, щоб усі slidesPerView вкладались у висоту без скролу
  const thumbSlideBasis = `calc((100% - ${(slidesPerView - 1) * spaceBetween}px) / ${slidesPerView})`;

  return (
    <>
      <div
        className={`slider-container slider-container--same-height ${thumbs && 'slider-container--thumbs'}`}
      >
        {/* Великий слайдер */}
        <div className="main-slider overflow-hidden rounded-lg relative">
          <div className="embla" ref={mainEmblaRef}>
            <div className="embla__container" style={{ gap: `${spaceBetween}px` }}>
              {slidesUrls.map((slide, index) => (
                <div
                  key={index}
                  className="embla__slide overflow-hidden rounded-lg relative"
                  style={{
                    flex: `0 0 ${100 / (thumbs ? 1 : slidesPerView)}%`,
                    minWidth: 0,
                  }}
                >
                  <img
                    src={slide}
                    className="absolute inset-0 !object-cover w-full h-full blur-xl opacity-40 -z-10 pointer-events-none"
                    alt=""
                  />
                  <div
                    className="embla__slide__img-container"
                    onClick={() => openFullscreen(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openFullscreen(index);
                      }
                    }}
                    style={{ cursor: 'zoom-in' }}
                    tabIndex={index === selectedIndex ? 0 : -1}
                    {...(index === selectedIndex
                      ? { 'data-gamepad-action': 'true' }
                      : {})}
                  >
                    <img
                      src={slide}
                      alt={`slide-${index}`}
                      className="rounded-lg embla__slide__img"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination dots */}
          {pagination && (
            <div className="embla__dots">
              {slidesUrls.map((_, index) => (
                <button
                  key={index}
                  className={`embla__dot ${index === selectedIndex ? 'embla__dot--selected' : ''}`}
                  type="button"
                  onClick={() => mainEmblaApi?.scrollTo(index)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Вертикальні прев'ю */}
        {thumbs && (
          <div className="main-slider-thumbs overflow-hidden">
            <div className="embla-thumbs" ref={thumbEmblaRef}>
              <div
                className="embla__container embla-thumbs__container"
                style={{
                  gap: `${spaceBetween}px`,
                  flexDirection: isVertical ? 'column' : 'row',
                }}
              >
                {slidesUrls.map((thumbSrc, index) => (
                  <div
                    key={index}
                    className={`embla__slide embla-thumbs__slide ${index === selectedIndex ? 'embla-thumbs__slide--selected' : ''}`}
                    style={{
                      flex: `0 0 ${thumbSlideBasis}`,
                      minWidth: 0,
                      minHeight: 0,
                    }}
                  >
                    <button
                      onClick={() => onThumbClick(index)}
                      className="embla-thumbs__slide__button w-full h-full"
                      type="button"
                    >
                      <img
                        src={thumbSrc}
                        alt={`thumb-${index}`}
                        className="embla-thumbs__slide__img !object-cover rounded-lg w-full h-full"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Повноекранний перегляд слайду */}
      {fullscreenIndex !== null &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl cursor-zoom-out"
            onClick={closeFullscreen}
          >
            <button
              onClick={closeFullscreen}
              data-gamepad-cancel
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              type="button"
            >
              <X size={22} className="text-white" />
            </button>
            <img
              src={slidesUrls[fullscreenIndex]}
              alt={`slide-${fullscreenIndex}`}
              className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.getElementById('root') ?? document.body
        )}
    </>
  );
}
