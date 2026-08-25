/**
 * 用語ホバー: 画面上の専門用語に点線の下線を付け、hover / フォーカス / タップで辞書(glossary.ts)の説明を出す。
 * - マウス: hoverで表示。キーボード: フォーカスで表示、Escapeで閉じる。タッチ: タップで開閉。
 * - 説明文は body 直下へ portal で描き position: fixed にするので、横スクロールする表の中でも切れず、ページ幅も広げない。
 */
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY, TERM_ALIASES, type TermId } from '../glossary.js';

const GAP = 6;
const WIDTH = 288;

export function Term({ id, children }: { id: TermId; children?: ReactNode }) {
  const entry = GLOSSARY[id];
  const tipId = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const w = Math.min(WIDTH, vw - 16);
    const left = Math.min(Math.max(8, r.left), vw - w - 8);
    setPos({ top: r.bottom + GAP, left });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  // 外側クリック・Escape・スクロールで閉じる(ピン留め中も含む)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    const onScroll = () => {
      setOpen(false);
      setPinned(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const style = pos
    ? { top: pos.top, left: pos.left, width: Math.min(WIDTH, window.innerWidth - 16) }
    : undefined;

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="term"
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        onFocus={show}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setOpen(false);
          } else {
            setPinned(true);
            show();
          }
        }}
      >
        {children ?? entry.term}
      </button>
      {open &&
        pos &&
        createPortal(
          <span role="tooltip" id={tipId} className="term-tip" style={style}>
            <strong>{entry.term}</strong>
            {entry.short}
          </span>,
          document.body,
        )}
    </>
  );
}

/**
 * 自由文(AIレポート本文など)の中に出てくる辞書の用語を、段落ごとに最初の1回だけホバー化する。
 * 同じ段落で何度も下線が出ると読みにくいため、2回目以降はそのまま。
 */
export function linkTerms(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const seen = new Set<TermId>();
  let rest = text;
  let key = 0;
  while (rest.length) {
    let best: { idx: number; alias: (typeof TERM_ALIASES)[number] } | null = null;
    for (const alias of TERM_ALIASES) {
      if (seen.has(alias.id)) continue;
      const idx = rest.indexOf(alias.text);
      if (idx === -1) continue;
      if (!best || idx < best.idx || (idx === best.idx && alias.text.length > best.alias.text.length))
        best = { idx, alias };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    seen.add(best.alias.id);
    out.push(
      <Term key={`t${key++}`} id={best.alias.id}>
        {best.alias.text}
      </Term>,
    );
    rest = rest.slice(best.idx + best.alias.text.length);
  }
  return out;
}
