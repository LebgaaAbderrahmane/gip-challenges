import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Puts the page back at the top when the route changes.
 *
 * A single-page application does not do this by itself: the browser keeps
 * the scroll position, so following a link to a new page drops you into the
 * middle of it. That is disorienting, and it is worse here than usual —
 * every challenge page is long, and the part worth seeing is at the top.
 *
 * A link to an anchor is left alone, because the browser is about to
 * scroll to it and doing both at once fights.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;

    // 'instant', not the default smooth: the page is changing, and a slow
    // slide to the top of a different page reads as a glitch.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}
