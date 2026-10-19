import { fetchNoCors, type Plugin } from '@decky/api';
import pageScript from '@lbk/bridge-core/achievement-page.iife.js?raw';
import { type BridgeStatus, browserEnv, createBridge } from '@lbk/bridge-core/bridge';
import { createPageInjector } from '@lbk/bridge-core/page-injector';
import { BridgeIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

const bridge = createBridge({
  host: 'decky',
  // Decky serves <homebrew>/data/<plugin dir>/ at /plugins/<name>/data/, where LBK writes bridge.json and achievements.json.
  dataBase: new URL('../data/', import.meta.url),
  env: browserEnv(),
});

const pages = createPageInjector({
  env: {
    fetchJson: (url) =>
      fetchNoCors(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
    openSocket: (url) => new WebSocket(url),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle),
  },
  script: pageScript,
  strings: bridge.achievementStrings,
});

// Stops on dismount, and when Millennium's copy takes over the SharedJSContext and with it Steam's web pages.
bridge.events.addEventListener('change', () => {
  if (bridge.state.status === 'disposed') {
    pages.dispose();
  }
});
bridge.events.addEventListener('achievements', () =>
  pages.setHint(bridge.achievementApps())
);

const WAITING = 'Очікування LBK Launcher';

const STATUS_TEXT: Record<BridgeStatus, string> = {
  idle: WAITING,
  waiting: WAITING,
  connecting: WAITING,
  connected: 'Підключено до LBK Launcher',
  disposed: WAITING,
};

const statusText = (): string =>
  bridge.state.idle ? 'Працює через Millennium' : STATUS_TEXT[bridge.state.status];

const subscribe = (onChange: () => void): (() => void) => {
  bridge.events.addEventListener('change', onChange);
  return () => bridge.events.removeEventListener('change', onChange);
};

const Status = () => {
  const text = useSyncExternalStore(subscribe, statusText);
  return (
    <div style={{ padding: '8px 16px', fontSize: '14px', lineHeight: '20px' }}>
      {text}
    </div>
  );
};

// Decky calls onDismount before it uninstalls, updates or reloads the plugin.
export default (): Plugin => {
  bridge.start();
  // An idle copy leaves Steam's web pages to Millennium's webkit.js.
  if (!bridge.state.idle) {
    pages.start();
  }
  return {
    name: 'LBK Bridge',
    icon: <BridgeIcon size="1em" />,
    content: <Status />,
    onDismount: bridge.dispose,
  };
};
