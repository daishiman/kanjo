/**
 * 明細の分割記帳。1つの引き落としを用途ごとに小分けする。
 *
 * 銀行の明細には「10万円 引き落とし」としか書かれていない。
 * 中身が現金払いだと、何にいくら使ったかはどこにも残っていない。
 * ここで「食品に3万、交通費に2万、残りは日用品」と後から割る。
 *
 * 入力の仕方は2通り用意する。
 *   金額 … 「食品に30,000円」とはっきり分かっているとき
 *   割合 … 「だいたい6割が食費」としか言えないとき
 * ただし保存するのは常に金額のほうだけ。
 * 割合で保存すると、元の金額が変わったときに確定した記帳が勝手に動く。
 *
 * 合計が元の金額と1円でも違うと保存できない。
 * 押してから知るのでは遅いので、残額は入力中ずっと出しておく。
 */
import { type RatioLine, splitByRatio, validateSplits } from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { type Candidates, type Cls, type SplitsResponse, api } from '../api.js';
import { yen } from '../format.js';
import { CategoryPicker } from './CategoryPicker.js';
import { DataTable } from './DataTable.js';
import { useInvalidateClassification } from './classification-invalidate.js';

/** 画面で編集している最中の1行。金額と割合の両方を持つ(入力欄の状態そのもの) */
interface DraftLine {
  /** React key兼API identity。並び(seq)とは独立して維持する */
  lineId: string;
  cls: Cls;
  big: string;
  mid: string;
  memo: string;
  /** 金額モードの入力値。空文字は「まだ入れていない」 */
  amount: string;
  /** 割合モードの入力値 */
  ratio: string;
}

type Mode = 'amount' | 'ratio';

const newLine = (cls: Cls): DraftLine => ({
  lineId: crypto.randomUUID(),
  cls,
  big: '',
  mid: '',
  memo: '',
  amount: '',
  ratio: '',
});

const toInt = (v: string): number => {
  const n = Number.parseInt(v.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};
const toNum = (v: string): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function SplitEditor({
  txId,
  candidates,
  defaultCls,
  onClose,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: {
  txId: string;
  candidates: Candidates;
  /** 元の明細の公私。行を足すたびに選び直させない */
  defaultCls: Cls;
  onClose: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const q = useQuery({
    queryKey: ['splits', txId],
    queryFn: () => api<SplitsResponse>(`/transactions/${encodeURIComponent(txId)}/splits`),
  });
  const [mode, setMode] = useState<Mode>('amount');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [baseline, setBaseline] = useState('');

  // 保存済みの内訳があれば、それを開いた状態から始める
  useEffect(() => {
    if (!q.data || loaded) return;
    const initial = q.data.lines.length
      ? q.data.lines.map((l) => ({
          lineId: l.lineId,
          cls: l.cls,
          big: l.big,
          mid: l.mid,
          memo: l.memo,
          amount: String(l.amount),
          ratio: '',
        }))
      : [newLine(defaultCls), newLine(defaultCls)];
    setLines(initial);
    setBaseline(JSON.stringify(initial));
    setLoaded(true);
  }, [q.data, loaded, defaultCls]);

  const total = q.data?.total ?? 0;

  /** 割合モードのときは、その場で金額に直したものを本体とする */
  const resolved = useMemo(() => {
    if (mode === 'amount') return lines.map((l) => toInt(l.amount));
    const ratios: RatioLine[] = lines.map((l) => ({
      cls: l.cls,
      categoryMajor: l.big,
      categoryMid: l.mid,
      ratio: toNum(l.ratio),
    }));
    const out = splitByRatio(total, ratios);
    return out.length ? out.map((l) => l.amount) : lines.map(() => 0);
  }, [mode, lines, total]);

  const assigned = resolved.reduce((s, v) => s + v, 0);
  const rest = total - assigned;

  const issues = useMemo(
    () =>
      validateSplits(
        total,
        lines.map((l, i) => ({
          cls: l.cls,
          categoryMajor: l.big,
          categoryMid: l.mid,
          amount: resolved[i],
          ...(l.memo ? { memo: l.memo } : {}),
        })),
      ),
    [total, lines, resolved],
  );

  const qc = useQueryClient();
  const invalidate = useInvalidateClassification();
  const save = useMutation({
    mutationFn: (body: { lines: unknown[] }) =>
      api(`/transactions/${encodeURIComponent(txId)}/splits`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      // 分割は明細そのものを差し替えるので、集計を見ている画面を全部引き直す
      void qc.invalidateQueries({ queryKey: ['splits', txId] });
      invalidate();
      onSaved();
    },
  });

  const dirty = loaded && JSON.stringify(lines) !== baseline;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onBusyChange(save.isPending), [save.isPending, onBusyChange]);

  const update = (lineId: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)));

  /** 残額を1行に入れる。最後の1行の金額を手で計算させない */
  const fillRest = (lineId: string) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const others = prev.filter((o) => o.lineId !== lineId).reduce((s, o) => s + toInt(o.amount), 0);
        return { ...l, amount: String(Math.max(0, total - others)) };
      }),
    );

  if (q.isLoading) return <p className="sub">読み込み中…</p>;
  if (q.isError || !q.data)
    return (
      <p className="notice warn">
        分割の情報を取得できませんでした。いったん閉じて、もう一度「分割する」を開いてください。
      </p>
    );

  return (
    <div className="split-editor">
      <p className="sub lines">
        {q.data.date} {q.data.description} の {yen(total)} を、用途ごとに分けます。
        <br />
        分けた合計が {yen(total)} になると保存できます。
      </p>
      {q.data.state === 'amount_conflict' && (
        <p className="notice warn">
          再取込で元の金額が変わりました。現在の合計に合わせて内訳を保存し直してください。
        </p>
      )}

      <fieldset className="split-mode">
        <legend className="visually-hidden">入力の仕方</legend>
        <button
          type="button"
          className="mini"
          aria-pressed={mode === 'amount'}
          onClick={() => setMode('amount')}
        >
          {mode === 'amount' && <span aria-hidden="true">✓ </span>}金額で入れる
        </button>
        <button
          type="button"
          className="mini"
          aria-pressed={mode === 'ratio'}
          onClick={() => setMode('ratio')}
        >
          {mode === 'ratio' && <span aria-hidden="true">✓ </span>}割合で入れる
        </button>
      </fieldset>
      {mode === 'ratio' && (
        <p className="sub lines">
          割合の合計が100でなくても構いません。
          <br />
          「6と4」でも「60と40」でも同じ結果になります。
        </p>
      )}

      <div className="split-lines">
        <DataTable
          className="data stack-sm"
          columns={[
            '公私',
            '科目',
            mode === 'amount' ? '金額' : '割合',
            ...(mode === 'ratio' ? ['金額'] : []),
            'メモ',
            { label: '操作', sortable: false },
          ]}
        >
          {lines.map((l, i) => (
            <tr key={l.lineId}>
              <td data-label="公私">
                <select
                  aria-label={`${i + 1}行目の公私`}
                  value={l.cls}
                  onChange={(e) => {
                    // 系統が変わると科目候補も変わるので選び直す
                    update(l.lineId, { cls: e.target.value as Cls, big: '', mid: '' });
                  }}
                >
                  <option value="per">個人</option>
                  <option value="biz">事業</option>
                </select>
              </td>
              <td data-label="科目">
                <CategoryPicker
                  candidates={candidates}
                  scope={l.cls}
                  big={l.big}
                  mid={l.mid}
                  onChange={(v) => update(l.lineId, { big: v.big, mid: v.mid })}
                  hintText={q.data.description}
                />
              </td>
              <td className="num" data-label={mode === 'amount' ? '金額' : '割合'}>
                {mode === 'amount' ? (
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`${i + 1}行目の金額`}
                    value={l.amount}
                    onChange={(e) => update(l.lineId, { amount: e.target.value })}
                  />
                ) : (
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label={`${i + 1}行目の割合`}
                    value={l.ratio}
                    onChange={(e) => update(l.lineId, { ratio: e.target.value })}
                  />
                )}
              </td>
              {mode === 'ratio' && (
                <td className="num" data-label="金額">
                  {yen(resolved[i])}
                </td>
              )}
              <td data-label="メモ">
                <input
                  type="text"
                  aria-label={`${i + 1}行目のメモ`}
                  value={l.memo}
                  maxLength={q.data.constraints.memoMaxLength}
                  onChange={(e) => update(l.lineId, { memo: e.target.value })}
                />
              </td>
              <td data-label="操作">
                {mode === 'amount' && (
                  <button type="button" className="mini" onClick={() => fillRest(l.lineId)}>
                    残りを入れる
                  </button>
                )}{' '}
                <button
                  type="button"
                  className="mini"
                  disabled={lines.length <= q.data.constraints.minLines}
                  onClick={() => setLines((prev) => prev.filter((o) => o.lineId !== l.lineId))}
                >
                  この行を消す
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <p className={`notice ${rest === 0 ? 'info' : 'warn'} lines`}>
        分けた金額の合計は {yen(assigned)} です。
        <br />
        {rest === 0
          ? '元の金額とぴったり合っています。保存できます。'
          : rest > 0
            ? `あと ${yen(rest)} 残っています。`
            : `${yen(-rest)} はみ出しています。`}
      </p>

      <div className="split-actions">
        <button
          type="button"
          disabled={lines.length >= q.data.constraints.maxLines}
          onClick={() => setLines((prev) => [...prev, newLine(defaultCls)])}
        >
          行を足す（{lines.length}/{q.data.constraints.maxLines}）
        </button>
        <button
          type="button"
          className="primary"
          disabled={issues.length > 0 || save.isPending}
          onClick={() =>
            save.mutate({
              lines: lines.map((l, i) => ({
                lineId: l.lineId,
                amount: resolved[i],
                cls: l.cls,
                big: l.big,
                mid: l.mid,
                ...(l.memo ? { memo: l.memo } : {}),
              })),
            })
          }
        >
          分割を保存
        </button>
        {q.data.lines.length > 0 && (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate({ lines: [] })}
            title="内訳を消して、元の1行に戻します"
          >
            分割をやめる
          </button>
        )}
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>

      {issues.length > 0 && lines.some((l) => l.big) && (
        <p className="sub lines">
          {issues.map((it) => (
            <span key={`${it.index}-${it.message}`}>
              {it.index === null ? '' : `${it.index + 1}行目: `}
              {it.message}
              <br />
            </span>
          ))}
        </p>
      )}
      {save.isError && (
        <p className="notice warn">
          <span>{save.error instanceof Error ? save.error.message : '保存できませんでした。'}</span>
          <br />
          <span>入力内容は残っています。内容を確認して、もう一度保存してください。</span>
        </p>
      )}
    </div>
  );
}
