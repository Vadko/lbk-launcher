/**
 * Global error handlers for uncaught errors and unhandled promise rejections
 */

let errorDisplayed = false;

function showErrorScreen(title: string, message: string, stack?: string): void {
  // Prevent showing multiple error screens
  if (errorDisplayed) return;
  errorDisplayed = true;

  // Log to console
  console.error(`[GlobalErrorHandler] ${title}:`, message);
  if (stack) {
    console.error('[GlobalErrorHandler] Stack:', stack);
  }

  // Send to main process
  if (window.api?.logError) {
    window.api.logError(`[${title}] ${message}`, stack || '');
  }

  // Create error screen
  const errorScreen = document.createElement('div');
  errorScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #0a0e14;
    color: #e0e0e0;
    font-family: system-ui, -apple-system, sans-serif;
    padding: 40px;
  `;

  errorScreen.innerHTML = `
    <div style="
      max-width: 800px;
      width: 100%;
      background-color: #141922;
      border-radius: 12px;
      padding: 32px;
      border: 1px solid #1e2530;
    ">
      <h1 style="
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 16px;
        color: #ff6b6b;
      ">${title}</h1>

      <p style="
        font-size: 16px;
        margin-bottom: 24px;
        line-height: 1.5;
      ">
        На жаль, сталася критична помилка. Спробуйте один з варіантів нижче:
      </p>

      <div style="
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 32px;
      ">
        <button id="reload-btn" style="
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 500;
          background-color: #4a9eff;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
        ">
          <div style="font-weight: bold; margin-bottom: 4px;">1. Перезавантажити</div>
          <div style="font-size: 12px; opacity: 0.9;">Швидке виправлення (зберігає всі дані)</div>
        </button>

        <button id="clear-cache-only-btn" style="
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 500;
          background-color: #ffa834;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
        ">
          <div style="font-weight: bold; margin-bottom: 4px;">2. Очистити кеш</div>
          <div style="font-size: 12px; opacity: 0.9;">Видалить тимчасові файли (зберігає налаштування)</div>
        </button>

        <button id="clear-all-data-btn" style="
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 500;
          background-color: #ff6b6b;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
        ">
          <div style="font-weight: bold; margin-bottom: 4px;">3. Очистити всі дані ⚠️</div>
          <div style="font-size: 12px; opacity: 0.9;">Видалить налаштування, підписки та всі дані</div>
        </button>
      </div>

      <details style="
        background-color: #0f1419;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #1e2530;
      ">
        <summary style="
          cursor: pointer;
          font-weight: 500;
          margin-bottom: 12px;
          user-select: none;
        ">Технічна інформація</summary>

        <div style="font-size: 12px; font-family: monospace;">
          <strong style="color: #ff6b6b;">Помилка:</strong>
          <pre style="
            margin-top: 8px;
            padding: 12px;
            background-color: #000;
            border-radius: 4px;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-word;
          ">${message}</pre>

          ${
            stack
              ? `
            <strong style="color: #ffd93d; display: block; margin-top: 16px;">Stack trace:</strong>
            <pre style="
              margin-top: 8px;
              padding: 12px;
              background-color: #000;
              border-radius: 4px;
              overflow: auto;
              white-space: pre-wrap;
              word-break: break-word;
              font-size: 11px;
            ">${stack}</pre>
          `
              : ''
          }
        </div>
      </details>
    </div>
  `;

  // Add to DOM
  document.body.appendChild(errorScreen);

  // Add button handlers
  const reloadBtn = errorScreen.querySelector('#reload-btn');
  const clearCacheOnlyBtn = errorScreen.querySelector('#clear-cache-only-btn');
  const clearAllDataBtn = errorScreen.querySelector('#clear-all-data-btn');

  reloadBtn?.addEventListener('click', () => {
    window.location.reload();
  });

  clearCacheOnlyBtn?.addEventListener('click', () => {
    if (window.api?.clearCacheOnly) {
      window.api.clearCacheOnly().then(() => {
        // App will restart automatically
      });
    } else {
      window.location.reload();
    }
  });

  clearAllDataBtn?.addEventListener('click', () => {
    if (window.api?.clearAllData) {
      window.api.clearAllData().then(() => {
        // App will restart automatically
      });
    } else {
      window.location.reload();
    }
  });
}

export function initGlobalErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    console.error('[GlobalErrorHandler] Uncaught error:', event.error);

    showErrorScreen(
      'Необроблена помилка',
      event.error?.message || event.message || 'Unknown error',
      event.error?.stack
    );

    // Prevent default error handling
    event.preventDefault();
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[GlobalErrorHandler] Unhandled promise rejection:', event.reason);

    const message =
      event.reason?.message || event.reason?.toString() || 'Unknown rejection';
    const stack = event.reason?.stack;

    showErrorScreen('Необроблений Promise rejection', message, stack);

    // Prevent default error handling
    event.preventDefault();
  });

  console.log('[GlobalErrorHandler] Global error handlers initialized');
}
