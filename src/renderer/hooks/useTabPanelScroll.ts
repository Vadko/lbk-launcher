import { useRef } from 'react';
import { scrollBehavior } from '../utils/scrollBehavior';

// The page's gap-6 between the sticky actions bar and the panel
const BAR_GAP = 24;

// The panel sits below the actions, banners and author card, so a picked tab brings it into view
export function useTabPanelScroll() {
  const barRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const showPanel = () => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    // The actions bar sticks over the top of the scroll area, so the panel stops below it
    panel.style.scrollMarginTop = `${(barRef.current?.offsetHeight ?? 0) + BAR_GAP}px`;
    void panel.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
  };
  return { barRef, panelRef, showPanel };
}
