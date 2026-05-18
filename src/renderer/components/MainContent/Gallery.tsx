import { useState } from 'react';
import {
  A11y,
  Autoplay,
  Navigation,
  Pagination,
  Scrollbar,
  Thumbs,
  Zoom,
} from 'swiper/modules';
import { Swiper, SwiperClass, SwiperSlide } from 'swiper/react';

import 'swiper/css';
import 'swiper/css/a11y';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';
import 'swiper/css/thumbs';
import 'swiper/css/zoom';
import { getGameImageUrl } from '@/renderer/utils/imageUrl';

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

export default function SwiperSlider({
  slides,
  spaceBetween = 10,
  slidesPerView = 1,
  loop = true,
  pagination = true,
  thumbs = false,
  autoplay = false,
  updated_at,
}: Props) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperClass | null>(null);
  //   const [mainSwiper, setMainSwiper] = useState<SwiperClass | null>(null);

  //   const handlePrev = () => {
  //     mainSwiper?.slidePrev();
  //   };

  //   const handleNext = () => {
  //     mainSwiper?.slideNext();
  //   };

  const slidesUrls = slides
    .filter((slide): slide is string => typeof slide === 'string')
    .map((slide) => getGameImageUrl(slide, updated_at) || '')
    .filter(Boolean);

  return (
    <div
      className={`slider-container slider-container--same-height ${thumbs && 'slider-container--thumbs'}`}
    >
      {/* Великий слайдер */}
      <div className="main-slider overflow-hidden rounded-lg">
        <Swiper
          spaceBetween={spaceBetween}
          slidesPerView={thumbs ? 1 : slidesPerView}
          loop={loop}
          pagination={pagination ? { clickable: true } : false}
          navigation={false}
          zoom={true}
          thumbs={{ swiper: thumbsSwiper }}
          autoplay={autoplay ? { delay: 3000, disableOnInteraction: false } : false}
          modules={[Navigation, Pagination, Autoplay, Thumbs, Zoom]}
          //   onSwiper={(swiper) => {
          //     setMainSwiper(swiper);
          //   }}
        >
          {slidesUrls.map((slide, index) => (
            <SwiperSlide key={index} className="overflow-hidden rounded-lg">
              <img
                src={slide}
                className="absolute inset-0 !object-cover blur-xl opacity-40 -z-10 pointer-events-none"
              />
              <div className="swiper-zoom-container">
                <img src={slide} alt={`slide-${index}`} className="rounded-lg" />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* <div className="slider-nav-buttons">
          <button
            type="button"
            className="slider-nav slider-nav--prev"
            onClick={handlePrev}
          >
            Prev
          </button>
          <button
            type="button"
            className="slider-nav slider-nav--next"
            onClick={handleNext}
          >
            Next
          </button>
        </div> */}
      </div>

      {/* Вертикальні прев’ю */}
      {thumbs && (
        <div className="main-slider-thumbs overflow-hidden">
          <Swiper
            onSwiper={setThumbsSwiper}
            spaceBetween={spaceBetween - 10}
            slidesPerView={slidesPerView}
            watchSlidesProgress
            scrollbar={{ draggable: true }}
            breakpoints={{
              1441: {
                direction: 'vertical',
                spaceBetween: spaceBetween,
              },
            }}
            modules={[Thumbs, Scrollbar, A11y]}
          >
            {slidesUrls.map((thumbSrc, index) => (
              <SwiperSlide key={index} className="cursor-pointer">
                <img
                  src={thumbSrc}
                  alt={`thumb-${index}`}
                  className="!object-cover rounded-lg"
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
    </div>
  );
}
