import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useStore } from '../store/useStore';

const SITE_ORIGIN = 'https://lbklauncher.com';

/**
 * Cторінка для сторінок з сайту
 */
export const SitePage: React.FC = () => {
  const setSelectedGame = useStore((state) => state.setSelectedGame);
  const { page } = useParams<{ page: string }>();
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);

  // Очищаємо вибрану гру при переході на цю сторінку
  // Це запобігає анімації від попередньої гри до нової
  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  // Скидаємо висоту при переході на іншу сторінку сайту, щоб не показати
  // на мить висоту попередньої сторінки до приходу нового postMessage
  useEffect(() => {
    setIframeHeight(null);
  }, [page]);

  // Сайт репортить свою реальну висоту через postMessage (крос-доменний
  // iframe не дає прочитати scrollHeight напряму), щоб скрол відбувався
  // на рівні сторінки лаунчера, а не всередині iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== SITE_ORIGIN) {
        return;
      }
      const { data } = event;
      if (
        data &&
        typeof data === 'object' &&
        data.type === 'resize' &&
        typeof data.height === 'number'
      ) {
        setIframeHeight(data.height);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div
      data-gamepad-main-content
      className={`flex-1 flex justify-center px-8 ${useGamepadModeStore.getState().isGamepadMode && 'py-4'} overflow-y-auto custom-scrollbar`}
    >
      <div className="main-page w-full max-w-[1317px] py-4">
        {/* <div className="glass-card-no-motion !p-2"> */}
        <iframe
          src={`${SITE_ORIGIN}/${page}?page=only`}
          title="Site Page"
          scrolling="no"
          style={{ height: iframeHeight ? `${iframeHeight}px` : '80vh' }}
          allowTransparency={true}
          className="block w-full border-none rounded-xl"
        />
        {/* </div> */}
      </div>
    </div>
  );
};
