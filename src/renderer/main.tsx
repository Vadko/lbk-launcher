import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { initGlobalErrorHandlers } from './utils/global-error-handler';
import './styles/globals.css';
import './styles/animations.css';

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
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  console.log('[Renderer] React application rendered successfully');
} catch (error) {
  console.error('[Renderer] Failed to render React application:', error);
  // Error will be caught by global error handler
  throw error;
}
