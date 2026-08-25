/**
 * 分類の設定(一元編集): 口座の名義 / 仕分けルール / 候補科目 / 手動編集の一覧。
 * 仕分け画面(Classify)と設定画面(Settings)の両方から使う。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import {
  type CandidateMajor,
  type CandidateSource,
  type Candidates,
  type CategoryOptionRow,
  type ClassificationResponse,
  type Cls,
  type Owner,
  type RuleBody,
  type RuleRow,
  SCOPE_LABEL,
  SCOPE_SHORT,
  api,
  ownerLabel,
} from '../api.js';
import { dateTime, yenS } from '../format.js';

export function useInvalidateClassification() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['rules'] });
    void qc.invalidateQueries({ queryKey: ['classification'] });
    void qc.invalidateQueries({ queryKey: ['transactions'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
    void qc.invalidateQueries({ queryKey: ['household'] });
  };
}

/**
 * 科目の選択(候補からのみ)。公私(scope)で候補を切り替える:
 * 事業 = freee の勘定科目(中項目なし) / 個人 = MF の大項目→中項目。
 * 候補に無い科目は「候補にない科目を追加」から系統を指定して登録するとすぐ選べる。
 */
export function CategoryInputs({
  candidates,
  scope,
  big,
  mid,
  onChange,
  placeholderBig = '科目(変えない)',
  placeholderMid = '中項目(変えない)',
  allowAdd = true,
}: {
  candidates: Candidates;
  scope: Cls | null;
  big: string;
  mid: string;
  onChange: (v: { big: string; mid: string }) => void;
  placeholderBig?: string;
  placeholderMid?: string;
  allowAdd?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  if (!scope) {
    return (
      <span className="sub" style={{ margin: 0 }}>
        科目を指定するには先に公私(事業/個人)を選びます
      </span>
    );
  }
  const list = candidates[scope];
  const major = list.find((m) => m.name === big);
  const grouped = (src: CandidateSource) => list.filter((m) => m.source === src);
  const groups: [string, CandidateMajor[]][] =
    scope === 'biz'
      ? [
          ['freeeに実在する勘定科目', grouped('freee')],
          ['追加した事業の科目', grouped('custom')],
        ]
      : [
          ['MF明細に実在する大項目', grouped('mf')],
          ['追加した家計の科目', grouped('custom')],
        ];
  return (
    <>
      <select
        value={major ? big : ''}
        onChange={(e) => onChange({ big: e.target.value, mid: '' })}
        title={SCOPE_LABEL[scope]}
      >
        <option value="">{placeholderBig}</option>
        {groups
          .filter(([, g]) => g.length)
          .map(([label, g]) => (
            <optgroup key={label} label={label}>
              {g.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
      </select>
      {scope === 'per' && (
        <select value={mid} onChange={(e) => onChange({ big, mid: e.target.value })} disabled={!major}>
          <option value="">{placeholderMid}</option>
          {(major?.mids ?? []).map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
              {m.source === 'custom' ? '(追加)' : ''}
            </option>
          ))}
        </select>
      )}
      {allowAdd &&
        (adding ? (
          <AddCategoryInline
            scope={scope}
            defaultMajor={scope === 'per' && major ? major.name : ''}
            onDone={(v) => {
              setAdding(false);
              if (v) onChange(v);
            }}
          />
        ) : (
          <button type="button" className="mini" onClick={() => setAdding(true)}>
            候補にない科目を追加
          </button>
        ))}
    </>
  );
}

/** その場で候補科目を追加する(系統は現在の公私で決まる)。登録後すぐ選択状態にする */
export function AddCategoryInline({
  scope,
  defaultMajor,
  onDone,
}: {
  scope: Cls;
  defaultMajor: string;
  onDone: (v: { big: string; mid: string } | null) => void;
}) {
  const invalidate = useInvalidateClassification();
  const [major, setMajor] = useState(defaultMajor);
  const [mid, setMid] = useState('');
  const add = useMutation({
    mutationFn: () =>
      api('/category-options', {
        method: 'POST',
        body: JSON.stringify({ scope, major: major.trim(), mid: scope === 'per' ? mid.trim() : '' }),
      }),
    onSuccess: () => {
      invalidate();
      onDone({ big: major.trim(), mid: scope === 'per' ? mid.trim() : '' });
    },
  });
  return (
    <span className="editor-form" style={{ display: 'inline-flex' }}>
      <span className="pill neutral">{SCOPE_SHORT[scope]}の科目として追加</span>
      <input
        type="text"
        placeholder={scope === 'biz' ? '勘定科目名(例: 通信費)' : '大項目'}
        value={major}
        onChange={(e) => setMajor(e.target.value)}
        style={{ width: 140 }}
      />
      {scope === 'per' && (
        <input
          type="text"
          placeholder="中項目(任意)"
          value={mid}
          onChange={(e) => setMid(e.target.value)}
          style={{ width: 120 }}
        />
      )}
      <button
        type="button"
        className="primary"
        disabled={!major.trim() || add.isPending}
        onClick={() => add.mutate()}
      >
        追加して選ぶ
      </button>
      <button type="button" onClick={() => onDone(null)}>
        やめる
      </button>
      {add.isError && (
        <span className="notice" style={{ margin: 0 }}>
          {(add.error as Error).message}
        </span>
      )}
    </span>
  );
}

export function OwnerSelect({
  value,
  onChange,
  allowEmpty = true,
}: {
  value: Owner | null;
  onChange: (v: Owner | null) => void;
  allowEmpty?: boolean;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as Owner | null)}>
      {allowEmpty && <option value="">名義(変えない)</option>}
      <option value="self">本人</option>
      <option value="spouse">妻</option>
    </select>
  );
}

const clsLabel = (c: Cls | null) => (c === 'biz' ? '事業' : c === 'per' ? '個人' : '—');

/* -------- 口座の名義 -------- */

export function InstitutionOwnersCard({ data }: { data: ClassificationResponse }) {
  const invalidate = useInvalidateClassification();
  const save = useMutation({
    mutationFn: (body: { institutionOwners: Record<string, Owner | null> }) =>
      api('/classification', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
  return (
    <div className="card">
      <h2>口座の名義(本人/妻)</h2>
      <p className="sub">
        根拠はMF明細の「保有金融機関」列。口座ごとに名義を決めると、その口座の明細が名義別の収入・支出に入ります(明細ごとの手動編集が優先)。
      </p>
      {data.noInstitutionCount > 0 && (
        <div className="notice info">
          保有金融機関が記録されていない明細が {data.noInstitutionCount}{' '}
          件あります(名義の設定より前に取り込んだ分)。MF明細を取り込み直すと埋まります。
        </div>
      )}
      {!data.institutions.length ? (
        <p className="empty">保有金融機関つきの明細がまだありません。MF明細を取り込むと口座が並びます。</p>
      ) : (
        <table className="data" style={{ maxWidth: 560 }}>
          <thead>
            <tr>
              <th>保有金融機関</th>
              <th>明細数</th>
              <th>名義</th>
            </tr>
          </thead>
          <tbody>
            {data.institutions.map((r) => (
              <tr key={r.institution}>
                <td>{r.institution}</td>
                <td className="num">{r.count}件</td>
                <td>
                  <select
                    value={r.owner ?? ''}
                    disabled={save.isPending}
                    onChange={(e) =>
                      save.mutate({
                        institutionOwners: { [r.institution]: (e.target.value || null) as Owner | null },
                      })
                    }
                  >
                    <option value="">未設定</option>
                    <option value="self">本人</option>
                    <option value="spouse">妻</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* -------- 仕分けルール -------- */

const emptyRule = (): RuleBody => ({ keyword: '', cls: null, big: null, mid: null, owner: null });
const hasAttr = (r: RuleBody) => !!(r.cls || r.big || r.mid || r.owner);

function RuleFields({
  value,
  onChange,
  candidates,
}: {
  value: RuleBody;
  onChange: (v: RuleBody) => void;
  candidates: Candidates;
}) {
  return (
    <>
      <input
        type="text"
        placeholder="キーワード(内容/大項目/中項目に部分一致)"
        value={value.keyword}
        onChange={(e) => onChange({ ...value, keyword: e.target.value })}
        style={{ width: 240 }}
      />
      <select
        value={value.cls ?? ''}
        onChange={(e) => {
          const cls = (e.target.value || null) as Cls | null;
          // 系統が変わるので科目は選び直す
          onChange({
            ...value,
            cls,
            big: cls === value.cls ? value.big : null,
            mid: cls === value.cls ? value.mid : null,
          });
        }}
      >
        <option value="">公私(変えない)</option>
        <option value="biz">事業</option>
        <option value="per">個人</option>
      </select>
      <CategoryInputs
        candidates={candidates}
        scope={value.cls}
        big={value.big ?? ''}
        mid={value.mid ?? ''}
        onChange={(v) => onChange({ ...value, big: v.big || null, mid: v.mid || null })}
      />
      <OwnerSelect value={value.owner} onChange={(owner) => onChange({ ...value, owner })} />
    </>
  );
}

export function RulesCard({ candidates, initial }: { candidates: Candidates; initial?: Partial<RuleBody> }) {
  const invalidate = useInvalidateClassification();
  const q = useQuery({
    queryKey: ['rules'],
    queryFn: () => api<{ rules: RuleRow[]; usingDefaults: boolean }>('/rules'),
  });
  const [draft, setDraft] = useState<RuleBody>({ ...emptyRule(), ...initial });
  const [top, setTop] = useState(false);
  const [editing, setEditing] = useState<{ id: number; body: RuleBody } | null>(null);

  const add = useMutation({
    mutationFn: () => api('/rules', { method: 'POST', body: JSON.stringify({ ...draft, top }) }),
    onSuccess: () => {
      setDraft(emptyRule());
      invalidate();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: RuleBody }) =>
      api(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/rules/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  const move = useMutation({
    mutationFn: (order: number[]) => api('/rules', { method: 'PATCH', body: JSON.stringify({ order }) }),
    onSuccess: invalidate,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.keyword.trim() && hasAttr(draft)) add.mutate();
  };
  const rules = q.data?.rules ?? [];
  const reorder = (i: number, dir: -1 | 1) => {
    const order = rules.map((r) => r.id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    move.mutate(order);
  };

  return (
    <div className="card">
      <h2>仕分けルール(上から先勝ちで評価)</h2>
      <p className="sub">
        キーワードに一致した明細の公私・大項目・中項目・名義を自動で決めます。空欄の項目は変えません。属性ごとに「その項目を持つ最初のルール」が有効です。明細ごとの手動編集はルールより優先されます。
      </p>
      {q.data?.usingDefaults && (
        <p className="sub">現在はHTML版の既定ルールを使用中。追加すると編集可能になります。</p>
      )}
      <form onSubmit={submit} className="toolbar">
        <RuleFields value={draft} onChange={setDraft} candidates={candidates} />
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={top} onChange={(e) => setTop(e.target.checked)} /> 最優先に追加
        </label>
        <button
          type="submit"
          className="primary"
          disabled={!draft.keyword.trim() || !hasAttr(draft) || add.isPending}
        >
          追加
        </button>
      </form>
      {add.isError && <div className="notice">{(add.error as Error).message}</div>}
      <div className="scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>優先</th>
              <th>キーワード</th>
              <th>公私</th>
              <th>大項目 / 中項目</th>
              <th>名義</th>
              <th>影響件数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) =>
              editing?.id === r.id ? (
                <tr key={r.id} className="editor">
                  <td className="num">{i + 1}</td>
                  <td colSpan={5}>
                    <div className="editor-form">
                      <RuleFields
                        value={editing.body}
                        onChange={(body) => setEditing({ id: r.id, body })}
                        candidates={candidates}
                      />
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="mini primary"
                      disabled={!editing.body.keyword.trim() || !hasAttr(editing.body) || update.isPending}
                      onClick={() => update.mutate(editing)}
                    >
                      保存
                    </button>{' '}
                    <button type="button" className="mini" onClick={() => setEditing(null)}>
                      取消
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td className="num">{i + 1}</td>
                  <td>{r.keyword}</td>
                  <td>{r.cls ? <span className={`pill ${r.cls}`}>{clsLabel(r.cls)}</span> : '—'}</td>
                  <td>{r.big || r.mid ? `${r.big ?? '（変えない）'} / ${r.mid ?? '（変えない）'}` : '—'}</td>
                  <td>{r.owner ? ownerLabel(r.owner) : '—'}</td>
                  <td className="num">{r.hits}件</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="mini" onClick={() => reorder(i, -1)} disabled={i === 0}>
                      ↑
                    </button>{' '}
                    <button
                      type="button"
                      className="mini"
                      onClick={() => reorder(i, 1)}
                      disabled={i === rules.length - 1}
                    >
                      ↓
                    </button>{' '}
                    <button
                      type="button"
                      className="mini"
                      onClick={() =>
                        setEditing({
                          id: r.id,
                          body: { keyword: r.keyword, cls: r.cls, big: r.big, mid: r.mid, owner: r.owner },
                        })
                      }
                    >
                      変更
                    </button>{' '}
                    <button
                      type="button"
                      className="mini danger-btn"
                      onClick={() => {
                        if (window.confirm(`ルール「${r.keyword}」を削除しますか?`)) del.mutate(r.id);
                      }}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ),
            )}
            {!rules.length && !q.data?.usingDefaults && (
              <tr>
                <td colSpan={7} className="empty">
                  ルールがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------- 候補科目 -------- */

export function CategoryOptionsCard({ data }: { data: ClassificationResponse }) {
  const invalidate = useInvalidateClassification();
  const [scope, setScope] = useState<Cls>('per');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ key: string; major: string; mid: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rename = useMutation({
    mutationFn: (v: { from: CategoryOptionRow; to: { major: string; mid: string } }) =>
      api('/category-options', {
        method: 'PUT',
        body: JSON.stringify({
          from: { scope: v.from.scope, major: v.from.major, mid: v.from.mid },
          to: v.to,
        }),
      }),
    onSuccess: () => {
      setEditing(null);
      setErr(null);
      invalidate();
    },
    onError: (e) => setErr((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (v: { o: CategoryOptionRow; force: boolean }) =>
      api('/category-options', {
        method: 'DELETE',
        body: JSON.stringify({ scope: v.o.scope, major: v.o.major, mid: v.o.mid, force: v.force }),
      }),
    onSuccess: () => {
      setErr(null);
      invalidate();
    },
    onError: (e) => setErr((e as Error).message),
  });
  const removeOption = (o: CategoryOptionRow) => {
    const inUse = o.uses.edits + o.uses.rules;
    if (inUse) {
      if (
        !window.confirm(
          `「${o.major}${o.mid ? ` / ${o.mid}` : ''}」は手動編集 ${o.uses.edits} 件・ルール ${o.uses.rules} 件で使われています。\n削除しても編集・ルールの値は残りますが候補から外れ、新しく選べなくなります。削除しますか?`,
        )
      )
        return;
      del.mutate({ o, force: true });
    } else del.mutate({ o, force: false });
  };
  const key = (o: CategoryOptionRow) => `${o.scope}\t${o.major}\t${o.mid}`;
  const count = (c: Cls) => data.candidates[c].length;
  return (
    <div className="card">
      <h2>科目の候補</h2>
      <p className="sub">
        候補はデータから自動で作られます: 事業=freeeに実在する勘定科目({count('biz')}件、決算書に載る科目) /
        家計=MF明細に実在する大項目・中項目({count('per')}
        件)。取込値に無い科目はここか仕分け画面の編集欄から追加できます。
      </p>
      <div className="toolbar">
        <span className="segment">
          {(['per', 'biz'] as const).map((c) => (
            <button key={c} type="button" className={scope === c ? 'on' : ''} onClick={() => setScope(c)}>
              {SCOPE_SHORT[c]}の科目
            </button>
          ))}
        </span>
        {adding ? (
          <AddCategoryInline scope={scope} defaultMajor="" onDone={() => setAdding(false)} />
        ) : (
          <button type="button" className="primary" onClick={() => setAdding(true)}>
            {SCOPE_SHORT[scope]}の科目を追加
          </button>
        )}
      </div>
      {err && <div className="notice">{err}</div>}
      <table className="data" style={{ maxWidth: 640 }}>
        <thead>
          <tr>
            <th>{scope === 'biz' ? '勘定科目' : '大項目'}</th>
            {scope === 'per' && <th>中項目</th>}
            <th>使用中</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.categoryOptions
            .filter((o) => o.scope === scope)
            .map((o) => {
              const k = key(o);
              const inUse = o.uses.edits + o.uses.rules;
              if (editing?.key === k)
                return (
                  <tr key={k} className="editor">
                    <td colSpan={scope === 'per' ? 4 : 3}>
                      <div className="editor-form">
                        <input
                          type="text"
                          value={editing.major}
                          onChange={(e) => setEditing({ ...editing, major: e.target.value })}
                          style={{ width: 140 }}
                        />
                        {scope === 'per' && (
                          <input
                            type="text"
                            placeholder="中項目(任意)"
                            value={editing.mid}
                            onChange={(e) => setEditing({ ...editing, mid: e.target.value })}
                            style={{ width: 120 }}
                          />
                        )}
                        {inUse > 0 && (
                          <span className="sub" style={{ margin: 0 }}>
                            使用中の編集 {o.uses.edits} 件・ルール {o.uses.rules} 件も新しい名前に変わります
                          </span>
                        )}
                        <button
                          type="button"
                          className="primary"
                          disabled={!editing.major.trim() || rename.isPending}
                          onClick={() =>
                            rename.mutate({
                              from: o,
                              to: { major: editing.major.trim(), mid: editing.mid.trim() },
                            })
                          }
                        >
                          保存
                        </button>
                        <button type="button" onClick={() => setEditing(null)}>
                          やめる
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              return (
                <tr key={k}>
                  <td>{o.major}</td>
                  {scope === 'per' && <td>{o.mid || '—'}</td>}
                  <td>
                    {inUse ? (
                      <span className="pill neutral">
                        編集 {o.uses.edits} / ルール {o.uses.rules}
                      </span>
                    ) : (
                      <span className="sub" style={{ margin: 0 }}>
                        未使用
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="mini"
                      onClick={() => setEditing({ key: k, major: o.major, mid: o.mid })}
                    >
                      変更
                    </button>{' '}
                    <button
                      type="button"
                      className="mini danger-btn"
                      disabled={del.isPending}
                      onClick={() => removeOption(o)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
          {!data.categoryOptions.some((o) => o.scope === scope) && (
            <tr>
              <td colSpan={scope === 'per' ? 4 : 3} className="empty">
                追加した{SCOPE_SHORT[scope]}の科目はありません(データに実在する科目はそのまま候補に出ます)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* -------- 手動編集の一覧 -------- */

const STATUS_LABEL = {
  ok: { label: '有効', cls: 'calm' },
  changed: { label: '取込値が変更', cls: 'warn' },
  orphan: { label: '元明細なし', cls: 'neutral' },
} as const;

export function EditsCard({ data }: { data: ClassificationResponse }) {
  const invalidate = useInvalidateClassification();
  const reset = useMutation({
    mutationFn: (txIds: string[]) =>
      api('/classification', { method: 'PUT', body: JSON.stringify({ resetEdits: txIds }) }),
    onSuccess: invalidate,
  });
  const changed = data.edits.filter((e) => e.status === 'changed').length;
  return (
    <div className="card">
      <h2>手動で編集した明細({data.edits.length}件)</h2>
      <p className="sub">
        編集は元のCSV(取込値)とは別に保存され、再取込しても残ります。「取込値が変更」はMF側で分類が変わった明細です。内容を見直すか、取込値に戻してください。
      </p>
      {changed > 0 && <div className="notice">再取込で取込値が変わった編集が {changed} 件あります。</div>}
      {!data.edits.length ? (
        <p className="empty">
          手動編集はまだありません。仕分け画面の「編集」から科目・公私・名義を直せます。
        </p>
      ) : (
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>状態</th>
                <th>日付</th>
                <th>内容</th>
                <th>金額</th>
                <th>取込値(大項目/中項目)</th>
                <th>編集値</th>
                <th>編集日時</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.edits.map((e) => {
                const st = STATUS_LABEL[e.status];
                const parts: string[] = [];
                if (e.cls) parts.push(`公私: ${clsLabel(e.cls)}`);
                if (e.big || e.mid)
                  parts.push(`科目: ${e.big ?? e.csvBig ?? ''} / ${e.mid ?? e.csvMid ?? ''}`);
                if (e.owner) parts.push(`名義: ${ownerLabel(e.owner)}`);
                return (
                  <tr key={e.txId}>
                    <td>
                      <span className={`pill ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="num">{e.date ?? '—'}</td>
                    <td
                      style={{
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.description ?? `(ID: ${e.txId})`}
                    </td>
                    <td className="num">{e.amount === null ? '—' : yenS(e.amount)}</td>
                    <td>
                      {e.csvBig === null ? (
                        '—'
                      ) : (
                        <>
                          {e.csvBig} / {e.csvMid}
                          {e.status === 'changed' && (
                            <span className="orig">
                              編集時: {e.baseBig} / {e.baseMid}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td>{parts.join(' ・ ')}</td>
                    <td className="num">{dateTime(e.updatedAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="mini"
                        disabled={reset.isPending}
                        onClick={() => reset.mutate([e.txId])}
                      >
                        取込値に戻す
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 設定画面用: 4カードをまとめて表示 */
export function ClassificationSettings() {
  const q = useQuery({
    queryKey: ['classification'],
    queryFn: () => api<ClassificationResponse>('/classification'),
  });
  if (!q.data) return q.isError ? <div className="notice">分類の設定を読み込めませんでした。</div> : null;
  return (
    <>
      <InstitutionOwnersCard data={q.data} />
      <RulesCard candidates={q.data.candidates} />
      <CategoryOptionsCard data={q.data} />
      <EditsCard data={q.data} />
    </>
  );
}
