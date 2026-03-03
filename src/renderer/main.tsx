import { browserTracingIntegration, init as sentryInit } from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { queryClient } from './queries/queryClient';
import { initGlobalErrorHandlers } from './utils/global-error-handler';
import './styles/globals.css';
import './styles/animations.css';

// Initialize Sentry for renderer error reporting with React integration
sentryInit(
  {
    release: __SENTRY_RELEASE__,
    sendDefaultPii: true,
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 1.0,
    enableLogs: true,
  },
  reactInit
);

// Initialize global error handlers before React renders
initGlobalErrorHandlers();

console.log('[Renderer] Starting React application...');

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found');
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  console.log('[Renderer] React application rendered successfully');
} catch (error) {
  console.error('[Renderer] Failed to render React application:', error);
  // Error will be caught by global error handler
  throw error;
}
