import type { Plugin } from '@decky/api';
import { browserEnv, createBridge } from '@lbk/bridge-core/bridge';
import { useEffect, useState } from 'react';

const bridge = createBridge({
  host: 'decky',
  // Decky serves <homebrew>/data/<plugin dir>/ at /plugins/<name>/data/, where LBK writes bridge.json and achievements.json.
  dataBase: new URL('../data/', import.meta.url),
  env: browserEnv(),
});

const statusText = (): string => {
  if (bridge.state.idle) {
    return 'Працює через Millennium';
  }
  return bridge.state.status === 'connected'
    ? 'Підключено до LBK Launcher'
    : 'Очікування LBK Launcher';
};

const Status = () => {
  const [text, setText] = useState(statusText);
  useEffect(() => {
    const t = setInterval(() => setText(statusText()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ padding: '8px 16px', fontSize: '14px', lineHeight: '20px' }}>
      {text}
    </div>
  );
};

const BridgeIcon = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 18h20M5 18v-7M19 18v-7M12 18v-5M3 11c5-6 13-6 18 0" />
  </svg>
);

// Decky calls onDismount before it uninstalls, updates or reloads the plugin.
export default (): Plugin => {
  bridge.start();
  return {
    name: 'LBK Bridge',
    icon: <BridgeIcon />,
    content: <Status />,
    onDismount: bridge.dispose,
  };
};
