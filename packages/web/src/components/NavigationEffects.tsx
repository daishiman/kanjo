import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { routePageTitle } from '../routeMetadata.js';

/**
 * SPA遷移を通常のページ遷移と同じ感覚に揃える共通境界。
 * PUSHだけ先頭へ移動し、Back/Forward(POP)のブラウザによる位置復元は上書きしない。
 */
export function NavigationEffects() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    document.title = routePageTitle(location.pathname);

    if (navigationType === 'PUSH') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    let timer = 0;
    let observer: MutationObserver | null = null;
    const focusHeading = (): boolean => {
      const main = document.getElementById('main-content');
      const target = main?.querySelector<HTMLElement>('h1') ?? main;
      if (!target) return false;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      return target !== main;
    };

    timer = window.setTimeout(() => {
      if (focusHeading()) return;
      const main = document.getElementById('main-content');
      if (!main || typeof MutationObserver === 'undefined') return;
      observer = new MutationObserver(() => {
        if (focusHeading()) observer?.disconnect();
      });
      observer.observe(main, { childList: true, subtree: true });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [location.pathname, navigationType]);

  return null;
}
