/**
 * 画面検索パレット(Cmd+K / Ctrl+K)。
 *
 * サイドバーを目で走査する代わりに、名前で直接辿り着く経路。
 * サイドバーに行が無いもの(支出分析のタブ)もここからは名前で引ける。
 * 絞り込みの規則は route-search.ts が持ち、ここは開閉・キー操作・表示だけを持つ。
 *
 * role="listbox" + aria-activedescendant ではなく、ネイティブ <dialog> と
 * 実フォーカスの移動で組む。Escape・フォーカストラップ・背面の不活性化を
 * ブラウザ実装に任せられ、候補は素の button なので支援技術に嘘をつかない。
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchRoutes, withResolvedGroups } from '../route-search.js';
import { SEARCH_ROUTES } from '../routeMetadata.js';
import { RouteIcon } from './RouteIcon.js';

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  // Cmd+K(mac) / Ctrl+K(win) で開く。入力欄にいても開けるよう window で受ける
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (dialog.open) dialog.close();
        // 前回の絞り込みが残っていると開いた直後が一覧に見えないので捨てる
        else {
          setQuery('');
          dialog.showModal();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 群名(「見る」など)でもその群の画面をまとめて引けるようにしてから絞り込む
  const hits = searchRoutes(query, withResolvedGroups(SEARCH_ROUTES));

  const go = (path: string) => {
    dialogRef.current?.close();
    navigate(path);
  };

  /** 候補間をループで移動する。入力欄からの ArrowDown は先頭へ入る */
  const moveFocus = (from: number, delta: number) => {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('.palette-opt');
    if (!items?.length) return;
    items[(from + delta + items.length) % items.length].focus();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 閉じるキー操作は <dialog> の Escape が持つ
    <dialog
      ref={dialogRef}
      className="palette"
      aria-label="画面を検索"
      onClick={(e) => {
        // <dialog> のクリックは ::backdrop でも発火する。中身の外側なら閉じる
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <input
        className="palette-input"
        type="text"
        value={query}
        placeholder="画面名で検索(Esc で閉じる)"
        aria-label="画面名で検索"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveFocus(-1, 1);
          } else if (e.key === 'Enter' && hits.length) {
            e.preventDefault();
            go(hits[0].path);
          }
        }}
      />
      <ul className="palette-list" ref={listRef}>
        {hits.map((route, i) => (
          <li key={route.id}>
            <button
              type="button"
              className="palette-opt"
              onClick={() => go(route.path)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  moveFocus(i, 1);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  moveFocus(i, -1);
                }
              }}
            >
              <RouteIcon name={route.icon} />
              <span className="palette-label">{route.label}</span>
              <span className="palette-task sub">{route.task}</span>
            </button>
          </li>
        ))}
      </ul>
      {hits.length === 0 && <p className="palette-empty sub">当てはまる画面がありません。</p>}
    </dialog>
  );
}
