/**
 * P5 公私仕分け: 明細の事業/個人・科目(大項目/中項目)・名義(本人/妻)を確定する。
 * 行内3ボタン(個人/事業/自動)は楽観的更新+失敗時ロールバック。キーボード J/K移動・B/P/A判定。
 * 編集は取込値(MFのCSV)とは別枠に保存され、再取込しても残る。ルール・名義・編集一覧の管理は設定画面。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type Candidates,
  type Cls,
  type Owner,
  SCOPE_LABEL,
  type TransactionsResponse,
  type TxRow,
  api,
  ownerLabel,
} from '../api.js';
import {
  CategoryInputs,
  OwnerSelect,
  useInvalidateClassification,
} from '../components/ClassificationSettings.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { yen, yenS } from '../format.js';

export function ClassifyPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string | null>(null);
  const [cls, setCls] = useState('');
  const [owner, setOwner] = useState('');
  const [qtext, setQtext] = useState('');
  const [manualOnly, setManualOnly] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (cls) params.set('cls', cls);
  if (owner) params.set('owner', owner);
  if (qtext) params.set('q', qtext);
  if (manualOnly) params.set('manual', '1');
  const key = ['transactions', month, cls, owner, qtext, manualOnly] as const;

  const q = useQuery({
    queryKey: key,
    queryFn: () => api<TransactionsResponse>(`/transactions?${params.toString()}`),
  });

  const setClass = useMutation({
    mutationFn: ({ txId, next }: { txId: string; next: Cls | null }) =>
      api(`/transactions/${encodeURIComponent(txId)}/class`, {
        method: 'PUT',
        body: JSON.stringify({ cls: next }),
      }),
    onMutate: async ({ txId, next }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TransactionsResponse>(key);
      if (prev) {
        qc.setQueryData<TransactionsResponse>(key, {
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.id === txId
              ? { ...t, cls: next ?? t.cls, src: next ? ('手動' as const) : ('既定' as const) }
              : t,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev); // 失敗時ロールバック
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['classification'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
      void qc.invalidateQueries({ queryKey: ['household'] });
    },
  });

  const rows = q.data?.transactions ?? [];

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if (k === 'j') setFocusIdx((i) => Math.min(i + 1, rows.length - 1));
      else if (k === 'k') setFocusIdx((i) => Math.max(i - 1, 0));
      else if ((k === 'b' || k === 'p' || k === 'a') && rows[focusIdx]) {
        const tx = rows[focusIdx];
        setClass.mutate({ txId: tx.id, next: k === 'b' ? 'biz' : k === 'p' ? 'per' : null });
      }
    },
    [rows, focusIdx, setClass],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (q.isLoading)
    return (
      <>
        <PageHeader route="classify" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="classify" />
        <PageState status="error" error={q.error} />
      </>
    );
  const d = q.data;
  const s = d.summary;

  return (
    <>
      <PageHeader route="classify" />
      <p className="kbd-help">
        <kbd>J</kbd>/<kbd>K</kbd> 移動・<kbd>B</kbd> 事業・<kbd>P</kbd> 個人・<kbd>A</kbd> 自動
      </p>

      <div className="notice info">
        事業立替 <strong className="num">{yen(s.bizExpense)}</strong>{' '}
        は「freeeへ記帳すべき金額」。税務上の正はfreeeの記帳です。
      </div>
      {s.conflictCount > 0 && (
        <div className="notice">
          再取込で取込値が変わった編集済み明細が {s.conflictCount}{' '}
          件あります(「編集済み」の行に元の値を表示)。
          <Link to="/settings">設定の「手動で編集した明細」</Link>で見直せます。
        </div>
      )}
      {s.noInstitutionCount > 0 && (
        <div className="notice info">
          口座(保有金融機関)が記録されていない明細が {s.noInstitutionCount}{' '}
          件あります。MF明細を取り込み直すと口座が入り、名義の自動判定が効きます。
        </div>
      )}

      <div className="kpis">
        <KpiCard
          label="明細数"
          value={String(s.count)}
          note={s.editedCount ? `うち手動編集 ${s.editedCount}件` : undefined}
        />
        <KpiCard label="総収入" value={yen(s.totalIncome)} />
        <KpiCard label="事業入金" value={yen(s.bizIncome)} tone="biz" />
        <KpiCard
          label="個人収入"
          value={yen(s.personalIncome)}
          tone="per"
          note={`本人 ${yen(s.incomeByOwner.self)} / 妻 ${yen(s.incomeByOwner.spouse)}${
            s.incomeByOwner.unset ? ` / 未設定 ${yen(s.incomeByOwner.unset)}` : ''
          }`}
        />
        <KpiCard label="総支出" value={yen(s.totalExpense)} />
        <KpiCard label="事業立替" value={yen(s.bizExpense)} tone="biz" />
        <KpiCard label="個人支出" value={yen(s.personalExpense)} tone="per" />
      </div>

      <div className="toolbar">
        <select value={month ?? d.month ?? ''} onChange={(e) => setMonth(e.target.value)}>
          {d.months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="segment">
          {(
            [
              ['', 'すべて'],
              ['biz', '事業'],
              ['per', '個人'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={cls === k ? 'on' : ''} onClick={() => setCls(k)}>
              {label}
            </button>
          ))}
        </span>
        <span className="segment">
          {(
            [
              ['', '名義: すべて'],
              ['self', '本人'],
              ['spouse', '妻'],
              ['unset', '未設定'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={owner === k ? 'on' : ''} onClick={() => setOwner(k)}>
              {label}
            </button>
          ))}
        </span>
        <span className="segment">
          <button type="button" className={manualOnly ? 'on' : ''} onClick={() => setManualOnly((v) => !v)}>
            編集済みのみ
          </button>
        </span>
        <input
          type="text"
          placeholder="キーワード検索(内容・科目・口座)"
          value={qtext}
          onChange={(e) => setQtext(e.target.value)}
        />
        <Link to="/settings" className="btn">
          ルール・名義の設定
        </Link>
      </div>

      <div className="card scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>日付</th>
              <th>内容</th>
              <th>口座</th>
              <th>大項目/中項目</th>
              <th>金額</th>
              <th>判定</th>
              <th>名義</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <TxLine
                key={t.id}
                t={t}
                focused={i === focusIdx}
                editing={editingId === t.id}
                candidates={d.candidates}
                onFocus={() => setFocusIdx(i)}
                onSet={(next) => setClass.mutate({ txId: t.id, next })}
                onToggleEdit={() => setEditingId((cur) => (cur === t.id ? null : t.id))}
                onSaved={() => setEditingId(null)}
              />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="empty">
                  該当する明細がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TxLine({
  t,
  focused,
  editing,
  candidates,
  onFocus,
  onSet,
  onToggleEdit,
  onSaved,
}: {
  t: TxRow;
  focused: boolean;
  editing: boolean;
  candidates: Candidates;
  onFocus: () => void;
  onSet: (next: Cls | null) => void;
  onToggleEdit: () => void;
  onSaved: () => void;
}) {
  const catEdited = t.catSrc === '手動';
  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: キーボード操作はページ全体のJ/K/B/P/Aハンドラで提供 */}
      <tr className={focused ? 'kbd-focus' : ''} onClick={onFocus}>
        <td className="num">{t.date}</td>
        <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.description}
        </td>
        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.institution ?? '—'}
        </td>
        <td>
          {t.big}
          {t.mid ? ` / ${t.mid}` : ''}
          {catEdited && (
            <>
              {' '}
              <span className="pill edited">{t.conflict ? '編集済み・取込値が変更' : '編集済み'}</span>
              {t.scopeMismatch && (
                <span
                  className="pill warn"
                  title="公私を変えたため、科目が今の系統(事業=freee科目 / 個人=MF内訳)の候補にありません"
                >
                  科目が
                  <Term id="publicPrivate" />
                  と不一致
                </span>
              )}
              <span className="orig">
                取込値: {t.csvBig}
                {t.csvMid ? ` / ${t.csvMid}` : ''}
              </span>
            </>
          )}
          {t.catSrc === 'ルール' && (
            <>
              {' '}
              <span className="pill neutral">ルール</span>
              <span className="orig">
                取込値: {t.csvBig}
                {t.csvMid ? ` / ${t.csvMid}` : ''}
              </span>
            </>
          )}
        </td>
        <td className="num">{yenS(t.amount)}</td>
        <td>
          <span className={`pill ${t.cls}`}>{t.cls === 'biz' ? '事業' : '個人'}</span>{' '}
          <span className="pill neutral">{t.src}</span>
        </td>
        <td>
          {t.owner ? ownerLabel(t.owner) : <span className="pill neutral">未設定</span>}
          {t.owner && (
            <span className="orig" style={{ textDecoration: 'none' }}>
              {t.ownerSrc}
            </span>
          )}
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <button
            type="button"
            className={`mini ${t.cls === 'per' && t.src === '手動' ? 'on-per' : ''}`}
            onClick={() => onSet('per')}
          >
            個人
          </button>{' '}
          <button
            type="button"
            className={`mini ${t.cls === 'biz' && t.src === '手動' ? 'on-biz' : ''}`}
            onClick={() => onSet('biz')}
          >
            事業
          </button>{' '}
          <button type="button" className="mini" disabled={t.src !== '手動'} onClick={() => onSet(null)}>
            自動
          </button>{' '}
          <button type="button" className={`mini ${editing ? 'on-biz' : ''}`} onClick={onToggleEdit}>
            編集
          </button>
        </td>
      </tr>
      {editing && <EditorRow t={t} candidates={candidates} onSaved={onSaved} />}
    </>
  );
}

/** 科目・名義・公私の編集行。保存 / 取込値に戻す / 同じ内容をルール化 */
function EditorRow({ t, candidates, onSaved }: { t: TxRow; candidates: Candidates; onSaved: () => void }) {
  const invalidate = useInvalidateClassification();
  const [big, setBig] = useState(t.edit?.big ?? '');
  const [mid, setMid] = useState(t.edit?.mid ?? '');
  const [own, setOwn] = useState<Owner | null>(t.edit?.owner ?? null);
  const [c, setC] = useState<Cls | null>(t.edit?.cls ?? null);
  const [keyword, setKeyword] = useState(t.description);
  const [ruleDone, setRuleDone] = useState(false);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/transactions/${encodeURIComponent(t.id)}/edit`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidate();
      onSaved();
    },
  });
  const rule = useMutation({
    mutationFn: () =>
      api('/rules', {
        method: 'POST',
        body: JSON.stringify({ keyword, cls: c, big: big || null, mid: mid || null, owner: own, top: true }),
      }),
    onSuccess: () => {
      setRuleDone(true);
      invalidate();
    },
  });
  /** 科目候補の系統 = 編集後の公私(未指定なら現在の有効値) */
  const scope: Cls = c ?? t.cls;
  const dirty =
    big !== (t.edit?.big ?? '') ||
    mid !== (t.edit?.mid ?? '') ||
    own !== (t.edit?.owner ?? null) ||
    c !== (t.edit?.cls ?? null);
  const ruleAttr = !!(c || big || mid || own);

  return (
    <tr className="editor">
      <td colSpan={8}>
        <div className="editor-form">
          <span className="sub" style={{ margin: 0 }}>
            取込値: {t.csvBig}
            {t.csvMid ? ` / ${t.csvMid}` : ''}
            {t.institution ? `・口座: ${t.institution}` : ''}
          </span>
          <label>
            公私
            <select
              value={c ?? ''}
              onChange={(e) => {
                const next = (e.target.value || null) as Cls | null;
                setC(next);
                // 系統(事業/個人)が変わると候補も変わるので科目は選び直す
                if ((next ?? t.cls) !== scope) {
                  setBig('');
                  setMid('');
                }
              }}
            >
              <option value="">
                {t.cls === 'biz' ? '事業' : '個人'}のまま({t.src})
              </option>
              <option value="biz">事業</option>
              <option value="per">個人</option>
            </select>
          </label>
          <div className="field">
            <span className="sub" style={{ margin: 0 }}>
              {SCOPE_LABEL[scope]}(空欄=取込値/ルールのまま)
            </span>
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              <CategoryInputs
                candidates={candidates}
                scope={scope}
                big={big}
                mid={mid}
                onChange={(v) => {
                  setBig(v.big);
                  setMid(v.mid);
                }}
              />
            </span>
          </div>
          <div className="field">
            <span className="sub" style={{ margin: 0 }}>
              名義
            </span>
            <OwnerSelect value={own} onChange={setOwn} />
          </div>
          <button
            type="button"
            className="primary"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ big: big || null, mid: mid || null, owner: own, cls: c })}
          >
            保存
          </button>
          <button
            type="button"
            disabled={!t.edited || save.isPending}
            onClick={() => save.mutate({ reset: true })}
          >
            取込値に戻す
          </button>
          <span style={{ borderLeft: '1px solid var(--line)', height: 24 }} />
          <label>
            同じ内容をルールにする(キーワード)
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
            />
          </label>
          <button
            type="button"
            disabled={!keyword.trim() || !ruleAttr || rule.isPending || ruleDone}
            onClick={() => rule.mutate()}
          >
            {ruleDone ? 'ルールを追加しました' : 'ルール化(最優先)'}
          </button>
          {(save.isError || rule.isError) && (
            <span className="notice" style={{ margin: 0 }}>
              {((save.error ?? rule.error) as Error).message}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
