/**
 * ヘッダーの「書き出し」メニュー。
 *
 * 開いている間だけ Escape と外側クリックを監視する(常時listenだと、閉じている
 * ほとんどの時間に無駄なハンドラが走る)。書き出しは見ている期間に対して行うので、
 * マトリクスCSVのURLには現在の期間選択を必ず載せる。
 */
import { useEffect, useRef, useState } from 'react';
import { usePeriod } from '../period.js';

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const { withPeriod } = usePeriod();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span className="popover-host" ref={ref}>
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        書き出し ▾
      </button>
      {open && (
        <span className="popover" role="menu">
          <a className="btn" role="menuitem" href="/api/export/json" onClick={() => setOpen(false)}>
            統合データJSON
          </a>
          <a
            className="btn"
            role="menuitem"
            href={withPeriod('/api/export/matrix.csv')}
            onClick={() => setOpen(false)}
          >
            マトリクスCSV
          </a>
        </span>
      )}
    </span>
  );
}
