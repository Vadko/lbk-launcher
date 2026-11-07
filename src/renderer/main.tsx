import { browserTracingIntegration, init as sentryInit } from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/shared/i18n/i18n';
import { App } from './App';
import { queryClient } from './queries/queryClient';
import { initEverInstalled } from './store/everInstalledBridge';
import { initFacetData } from './store/facetDataBridge';
import { initHomeInstalledGames } from './store/homeInstalledGamesBridge';
import { initLikes } from './store/likesBridge';
import { initRatings } from './store/ratingsBridge';
import { initReviewEvents } from './store/reviewEventsBridge';
import { initRunInstallerPrompts } from './store/runInstallerPromptBridge';
import { initStoreDiscounts } from './store/storeDiscountsBridge';
import { useSettingsStore } from './store/useSettingsStore';
import { initWeeklyPicks } from './store/weeklyPicksBridge';
import { initGlobalErrorHandlers } from './utils/global-error-handler';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './styles/globals.css';
import './styles/animations.css';
import './styles/slotMachine.css';

// Initialize Sentry for renderer error reporting with React integration
sentryInit(
  {
    release: __SENTRY_RELEASE__,
    enabled:
      !window.electronAPI?.isE2E?.() &&
      useSettingsStore.getState().crashDiagnosticsEnabled,
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 1.0,
    // GlitchTip ignores streamed span items, so keep sending whole transactions
    traceLifecycle: 'static',
    attachStacktrace: false,
  },
  reactInit
);

// Initialize global error handlers before React renders
initGlobalErrorHandlers();

// Bridge review events (IPC) into the notifications and the reviews cache — once, outside React.
initReviewEvents();

// Bridge the liked set (IPC) into the likes store — once, outside React.
initLikes();

// Bridge the catalog's ratings (IPC) into the ratings store — once, outside React.
initRatings();

// Bridge store discount and library changes (IPC) into the discounts store — once, outside React.
initStoreDiscounts();

// Bridge the weekly picks and catalog changes (IPC) into the weekly picks store — once, outside React.
initWeeklyPicks();

// Bridge the filters' catalog rows, options, store libraries and installed translations (IPC) into the facet data store — once, outside React.
initFacetData();

// Bridge the catalog games installed on this machine (IPC) into the home page's store — once, outside React.
initHomeInstalledGames();

// Copy every installed translation (files and Workshop) into the ever-installed store, for likes and reviews — once, outside React.
initEverInstalled();

// Bridge main's run-installer prompts (IPC) into the global modal — once, outside React, so no page leaves one unanswered.
initRunInstallerPrompts();

console.log('[Renderer] Starting React application...');

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found');
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </I18nextProvider>
    </React.StrictMode>
  );

  console.log('[Renderer] React application rendered successfully');
} catch (error) {
  console.error('[Renderer] Failed to render React application:', error);
  // Error will be caught by global error handler
  throw error;
}
