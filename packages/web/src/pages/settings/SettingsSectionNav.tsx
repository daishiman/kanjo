/**
 * 節ナビ (spec-settings-screen §7.1・§7.2)。
 *
 * 8 節へのページ内リンク。いま読んでいる節を IntersectionObserver で追い、aria-current で示す。
 * リンクは同じ画面の中の移動なので、離脱確認の対象から外す (data-settings-internal)。
 */
import { useEffect, useState } from 'react';
import { SECTION_NAV, type SectionId } from './view-model.js';

export function SettingsSectionNav() {
  const [current, setCurrent] = useState<SectionId>(SECTION_NAV[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        // 画面に入っている節のうち、上にあるものを現在の節にする
        const top = SECTION_NAV.find((item) => visible.has(item.id));
        if (top) setCurrent(top.id);
      },
      { rootMargin: '0px 0px -60% 0px' },
    );
    for (const item of SECTION_NAV) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="settings-nav" aria-label="設定の節">
      <ul>
        {SECTION_NAV.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              data-settings-internal
              aria-current={current === item.id ? 'location' : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
