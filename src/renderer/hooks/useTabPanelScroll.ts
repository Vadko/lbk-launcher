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
    const bar = barRef.current;
    // The actions bar sticks below the scroll area's padding, so the panel stops below the bar
    const barCover = bar?.parentElement
      ? Number.parseFloat(getComputedStyle(bar.parentElement).paddingTop) +
        bar.offsetHeight
      : 0;
    panel.style.scrollMarginTop = `${barCover + BAR_GAP}px`;
    void panel.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
  };
  return { barRef, panelRef, showPanel };
}
