import { useEffect, useState } from 'react';

// Tailwind's `lg`. The board needs this in JS, not only in CSS: the phone and
// the desktop layouts cannot both be mounted, because each registers the same
// dnd-kit droppable and sortable ids and the duplicates fight over every drop.
export const LG = '(min-width: 1024px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    // Read once on mount as well: the query may have changed between the lazy
    // initial state and this effect running.
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function useIsDesktop(): boolean {
  return useMediaQuery(LG);
}
