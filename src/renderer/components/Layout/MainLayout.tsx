import { AnimatePresence, MotionConfig } from 'framer-motion';
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import mainBg from '../../../../resources/main-bg.webp';
import { useDeepLink } from '../../hooks/useDeepLink';
import { useGamepadModeNavigation } from '../../hooks/useGamepadModeNavigation';
import { useNavigateFromNotifications } from '../../hooks/useNavigateFromNotifications';
import { useGamepadModeStore } from '../../store/useGamepadModeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useStore } from '../../store/useStore';
import { AppLoader } from '../AppLoader/AppLoader';
import { GamepadHints } from '../GamepadHints/GamepadHints';
import { ConfirmModal } from '../Modal/ConfirmModal';
import { GlobalModal } from '../Modal/GlobalModal';
import { PromoModal } from '../Modal/PromoModal';
import { NotificationModal } from '../Notifications/NotificationModal';
import { ToastNotifications } from '../Notifications/ToastNotifications';
import { SettingsModal } from '../Settings/SettingsModal';
import { Sidebar } from '../Sidebar/Sidebar';
import { UpdateNotification } from '../UpdateNotification/UpdateNotification';
import { TitleBar } from './TitleBar';

interface MainLayoutProps {
  online: boolean;
  version: string;
  liquidGlassSupported: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  online,
  version,
  liquidGlassSupported,
}) => {
  const { animationsEnabled, liquidGlassEnabled } = useSettingsStore();
  const isGamepadMode = useGamepadModeStore((s) => s.isGamepadMode);
  const navigationArea = useGamepadModeStore((s) => s.navigationArea);
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);
  const loaderVisible = useStore((s) => s.loaderVisible);
  const syncStatus = useStore((s) => s.syncStatus);

  // Обробка deep link для навігації до перекладу
  useDeepLink();

  // Обробка навігації з системних нотифікацій
  useNavigateFromNotifications();

  // Геймпад навігація (потребує Router context)
  useGamepadModeNavigation(isGamepadMode);

  const isLiquidGlassActive = liquidGlassSupported && liquidGlassEnabled;

  return (
    <MotionConfig reducedMotion={animationsEnabled ? 'never' : 'always'}>
      {/* Loader overlay with fade animation */}
      <AnimatePresence>
        {loaderVisible && <AppLoader status={syncStatus} />}
      </AnimatePresence>

      <div
        className={`relative w-screen h-screen text-white ${!animationsEnabled ? 'no-animations' : ''} ${isLiquidGlassActive ? '' : 'bg-bg-dark'}`}
        data-gamepad-mode={isGamepadMode || undefined}
      >
        <TitleBar online={online} version={version} />

        {/* Main layout - changes based on gamepad mode */}
        {isGamepadMode ? (
          /* Gamepad layout: Header + Games strip on top, MainContent below */
          <div className="flex flex-col h-full pt-8 relative z-10">
            {/* Background image */}
            <img
              src={mainBg}
              alt=""
              className="absolute inset-0 w-full h-auto top-0 left-0 object-cover object-top -z-10 pointer-events-none"
              aria-hidden="true"
            />
            {/* Sidebar - hides when in main-content mode */}
            <div
              className={`transition-all duration-300 ease-in-out relative z-20 ${
                navigationArea === 'main-content'
                  ? 'max-h-0 opacity-0 overflow-hidden'
                  : 'max-h-[300px] opacity-100'
              }`}
            >
              <Sidebar
                onOpenHistory={() => setShowNotificationHistory(true)}
                isHorizontal={true}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <Outlet />
            </div>
          </div>
        ) : (
          /* Normal layout: Vertical sidebar on left, MainContent on right */
          <div className="relative flex h-full pt-8 px-2 pb-2 gap-2 z-10">
            {/* Background image */}
            <img
              src={mainBg}
              alt=""
              className="absolute inset-0 w-full h-auto top-0 left-0 object-cover object-top -z-10 pointer-events-none"
              aria-hidden="true"
            />
            <Sidebar
              onOpenHistory={() => setShowNotificationHistory(true)}
              isHorizontal={false}
            />
            <Outlet />
          </div>
        )}

        {/* Update notifications */}
        <UpdateNotification />
        <ToastNotifications />

        {/* Global modals — GlobalModal last so it renders on top of others */}
        <ConfirmModal />
        <SettingsModal />
        <GlobalModal />
        <NotificationModal
          isOpen={showNotificationHistory}
          onClose={() => setShowNotificationHistory(false)}
        />
        <PromoModal />

        {/* Gamepad hints */}
        <GamepadHints />
      </div>
    </MotionConfig>
  );
};
