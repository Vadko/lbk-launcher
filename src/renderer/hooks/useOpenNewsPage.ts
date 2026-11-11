import { useLocation, useNavigate } from 'react-router-dom';
import { trackEvent } from '../utils/analytics';

// Counted where the player opens the page, since a language switch remounts the page itself
export function useOpenNewsPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return () => {
    if (pathname !== '/news') {
      trackEvent('News Page Open');
    }
    navigate('/news');
  };
}
