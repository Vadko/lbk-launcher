import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { GameTab } from '../components/MainContent/GameTabs';
import { type ReviewFocus, readReviewLink } from '../utils/readReviewLink';

interface TabState {
  gameId?: string;
  // The navigation whose review link already chose the tab
  linkKey?: string;
  tab: GameTab;
}

// selectedGameId lags the URL while the next game loads, so a link waits for its own game
export function useGameTabFromUrl(
  selectedGameId: string | undefined,
  onTabOnlyLink: () => void
) {
  const { gameId } = useParams<{ gameId: string }>();
  const { search, key } = useLocation();
  const navigate = useNavigate();
  const link = readReviewLink(search);
  const isLinkReady =
    link !== null && selectedGameId !== undefined && selectedGameId === gameId;

  const [state, setState] = useState<TabState>({ gameId: selectedGameId, tab: 'info' });
  let next =
    state.gameId === selectedGameId
      ? state
      : { gameId: selectedGameId, tab: 'info' as const };
  if (isLinkReady && next.linkKey !== key) {
    next = { ...next, linkKey: key, tab: 'reviews' };
  }
  if (next !== state) {
    setState(next);
  }

  const clearLink = useCallback(
    () => navigate({ search: '' }, { replace: true }),
    [navigate]
  );
  // A link without a focus is done once the tab shows
  const isTabOnlyLink = isLinkReady && link.focus === null;
  useEffect(() => {
    if (isTabOnlyLink) {
      clearLink();
      onTabOnlyLink();
    }
  }, [isTabOnlyLink, clearLink, onTabOnlyLink]);

  const linkFocus = isLinkReady ? link.focus : null;
  const focus: ReviewFocus | null = linkFocus && { ...linkFocus, key };
  const setTab = (tab: GameTab) => setState((current) => ({ ...current, tab }));

  return { tab: next.tab, setTab, focus, clearFocus: clearLink };
}
