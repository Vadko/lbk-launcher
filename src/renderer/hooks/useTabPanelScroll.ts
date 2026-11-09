import { useRef } from 'react';
import { scrollBehavior } from '../utils/scrollBehavior';

// The panel sits below the actions, banners and author card, so a picked tab brings it into view
export function useTabPanelScroll() {
  const panelRef = useRef<HTMLDivElement>(null);
  const showPanel = () => {
    void panelRef.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
  };
  return { panelRef, showPanel };
}
