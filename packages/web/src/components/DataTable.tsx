/**
 * 並べ替えのできる表。既存の `<table className="data">` を丸ごと置き換えて使う。
 *
 * 行の中身には手を入れない。行は `<tr>` 直書きのこともあれば `<TxLine>` のような
 * コンポーネントのこともあるので、React 要素の中を覗いて値を取る方式は使えない。
 * 代わりに描画後の DOM からセルの文字列を読み、React 側は children の並び順だけを差し替える。
 * 行に key があるので、React は行を作り直さず移動させる(入力中のセルが消えない)。
 *
 * セルに `data-sort` があればそれを、無ければ表示文字列を比較の材料にする。
 * 表示が「¥1,234」でも並びは数として正しくしたい列は、表示のままで足りる(table-sort.ts が解釈する)。
 * 表示から順序が決まらない列(進捗バーだけのセルなど)にだけ `data-sort` を置く。
 */
import {
  type CSSProperties,
  Children,
  type ReactNode,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { GLOSSARY, type TermId } from '../glossary.js';
import { type SortDir, sortedRowOrder } from '../table-sort.js';
import { Term } from './Term.js';

/**
 * この表は表示に使う HTML から並び順を読むので、描く前に走る useLayoutEffect でないと一瞬ちらつく。
 * ただしサーバ側の描画には layout が無く、React が警告を出す。
 * サーバでは並べ替えが起きようがない(押す人がいない)ので、そちらでは普通の effect に落とす。
 */
const useLayoutEffectSafe = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** 見出し1つ。並べ替えさせない列(操作ボタンなど)は sortable: false にする */
export type DataColumn =
  | ReactNode
  | {
      label: ReactNode;
      sortable?: boolean;
      className?: string;
      title?: string;
      /**
       * 並べ替えボタンの外側に置く要素。用語ヘルプのように、それ自体が押せるものを入れる。
       * ボタンの中にボタンは置けず(HTML として不正)、置けても押すと並べ替えまで動いてしまう。
       */
      after?: ReactNode;
    };

const columnOf = (
  c: DataColumn,
): {
  label: ReactNode;
  sortable: boolean;
  className?: string;
  title?: string;
  after?: ReactNode;
} =>
  c !== null && typeof c === 'object' && 'label' in c
    ? {
        label: c.label,
        sortable: c.sortable !== false,
        className: c.className,
        title: c.title,
        after: c.after,
      }
    : { label: c as ReactNode, sortable: true };

/**
 * 辞書の用語を見出しにした列。
 * label を渡すと見出し文だけ差し替える(「元の勘定科目」のように文脈で言い換えたいが、
 * ホバーは同じ辞書項目を出したい場合)。ヘルプは並べ替えボタンの外に出し、
 * data-label と揃える必要があるlabel差し替えは明示指定にする。
 */
export const termColumn = (
  id: TermId,
  rest?: { className?: string; sortable?: boolean; label?: string },
): DataColumn => ({
  label: GLOSSARY[id].term,
  // 用語名は label 側で出しているので、ヘルプ側は印だけにする(同じ文字が二度並ぶのを避ける)
  after: <Term id={id}>?</Term>,
  ...rest,
});

export function DataTable({
  className = 'data',
  style,
  caption,
  columns,
  children,
  foot,
}: {
  className?: string;
  style?: CSSProperties;
  /** 読み上げ向けの表の説明(<caption>) */
  caption?: ReactNode;
  columns: readonly DataColumn[];
  children: ReactNode;
  /** 並べ替えの対象外にする行(合計など)。tbody の末尾に固定で置く */
  foot?: ReactNode;
}) {
  const items = Children.toArray(children);
  const [sort, setSort] = useState<{ col: number; dir: SortDir } | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  // 効果の中から「いま画面に出ている行と並び」を読む。
  // どちらも毎回作り直される値なので、依存配列に入れると再実行が止まらない。
  const orderRef = useRef<number[]>([]);
  const itemsRef = useRef(items);
  orderRef.current = order;
  itemsRef.current = items;

  // 行の入れ替わり(取込・絞り込み)の目印。key の並びが変われば、前の並び順は対応先を失う
  const rowsKey = items.map((c) => (isValidElement(c) ? String(c.key) : '')).join('|');
  const rowsKeyRef = useRef(rowsKey);

  useLayoutEffectSafe(() => {
    const el = tbodyRef.current;
    const rows = itemsRef.current;
    // 行が入れ替わった直後は、前の並び順が別の行を指している。元の順から読み直す
    const rowsChanged = rowsKeyRef.current !== rowsKey;
    rowsKeyRef.current = rowsKey;
    if (!sort || !el) {
      setOrder([]);
      return;
    }
    const displayed =
      !rowsChanged && orderRef.current.length === rows.length ? orderRef.current : rows.map((_, i) => i);
    const cells: string[][] = [];
    const pinned: boolean[] = [];
    [...el.rows].forEach((tr, i) => {
      const child = displayed[i] ?? i;
      if (child >= rows.length) return; // foot の行は読まない
      cells[child] = [...tr.cells].map((c) => c.dataset.sort ?? c.textContent ?? '');
      // 合計行と、セルを横に結合した小計・見出し行は動かさない(並べ替えで中に紛れると表が嘘になる)
      pinned[child] = tr.classList.contains('total') || [...tr.cells].some((c) => c.colSpan > 1);
    });
    const next = sortedRowOrder(cells, sort.col, sort.dir, pinned);
    if (next.join() !== displayed.join()) setOrder(next);
  }, [sort, rowsKey]);

  const shown = order.length === items.length ? order.map((i) => items[i]) : items;

  const toggle = (col: number) =>
    setSort((cur) =>
      // 同じ列を押したら向きを反転、3回目で並べ替え前に戻す(元の順に意味がある表があるため)
      cur?.col !== col ? { col, dir: 'asc' } : cur.dir === 'asc' ? { col, dir: 'desc' } : null,
    );

  return (
    <table className={className} style={style}>
      {caption}
      <thead>
        <tr>
          {columns.map((c, i) => {
            const { label, sortable, className: thClass, title, after } = columnOf(c);
            const active = sort?.col === i;
            return (
              <th
                // 見出しは並び替えても増減しないので、位置を key にしてよい
                // biome-ignore lint/suspicious/noArrayIndexKey: 列は固定
                key={i}
                scope="col"
                className={thClass}
                title={title}
                aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {sortable ? (
                  // 矢印は styles.css が th の aria-sort を読んで描く。
                  // ここで文字として出すと、見出しの文言そのものが「金額▲」になってしまう
                  <button type="button" className="th-sort" onClick={() => toggle(i)}>
                    {label}
                  </button>
                ) : (
                  label
                )}
                {after}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody ref={tbodyRef}>
        {shown}
        {foot}
      </tbody>
    </table>
  );
}
