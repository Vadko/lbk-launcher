import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGamepadModeStore } from '../store/useGamepadModeStore';
import { useStore } from '../store/useStore';

const SITE_ORIGIN = 'https://lbklauncher.com';

/**
 * Page for pages from the site
 */
export const SitePage: React.FC = () => {
  const setSelectedGame = useStore((state) => state.setSelectedGame);
  const { page } = useParams<{ page: string }>();
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);

  // Clear the selected game when navigating to this page
  // This prevents the animation from the previous game to the new one
  useEffect(() => {
    setSelectedGame(null);
  }, [setSelectedGame]);

  // Reset the height when navigating to another site page, to avoid briefly
  // showing the previous page's height before the new postMessage arrives
  useEffect(() => {
    setIframeHeight(null);
  }, [page]);

  // The site reports its actual height via postMessage (a cross-origin
  // iframe doesn't allow reading scrollHeight directly), so scrolling happens
  // at the launcher page level rather than inside the iframe
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
      <div className="main-page w-full max-w-[1564px] py-4">
        <iframe
          src={`${SITE_ORIGIN}/${page}?page=only`}
          title="Site Page"
          scrolling="no"
          style={{ height: iframeHeight ? `${iframeHeight}px` : '80vh' }}
          allowTransparency={true}
          className="block w-full border-none rounded-xl"
        />
      </div>
    </div>
  );
};
