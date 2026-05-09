// packages/frontend/src/hooks/useMediaQuery.ts
import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 *
 * @example
 * import { MEDIA } from '@/styles/breakpoints';
 * const isMobile = useMediaQuery(MEDIA.mobile);
 */
const useMediaQuery = (query: string): boolean => {
  const getMatches = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    // Sync once on mount in case `query` changed between render and effect.
    setMatches(mql.matches);

    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};

export default useMediaQuery;
