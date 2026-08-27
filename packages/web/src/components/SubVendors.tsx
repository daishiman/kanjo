import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type KeyboardEvent, useState } from 'react';
import { type SubVendorExclusionRow, type SubVendorRow, type SubsCandidate, api } from '../api.js';
import { monthLabel, yen } from '../format.js';

const SUBS_KEYS = [['subscriptions'], ['sub-vendors'], ['sub-candidates'], ['summary']];

/** カンマ・読点区切りの入力を配列へ(空要素は落とす) */
const splitList = (s: string): string[] =>
  s
    .split(/[,、]/)
    .map((x) => x.trim())
    .filter(Boolean);

function useInvalidateSubs() {
  const qc = useQueryClient();
  return () => {
    for (const k of SUBS_KEYS) void qc.invalidateQueries({ queryKey: k });
  };
}

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('duplicate')) return '同じ名前(表記ゆれを含む)のベンダーが既に登録されています。';
  return `保存できませんでした: ${msg}`;
}

/** 登録ベンダーの一覧と別名の編集 */
export function SubVendorsPanel() {
  const q = useQuery({
    queryKey: ['sub-vendors'],
    queryFn: () => api<{ vendors: SubVendorRow[]; accountOptions: string[] }>('/sub-vendors'),
  });
  const invalidate = useInvalidateSubs();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (name: string) =>
      api('/sub-vendors', { method: 'POST', body: JSON.stringify({ name, aliases: [], accounts: [] }) }),
    onSuccess: () => {
      setNewName('');
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/sub-vendors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorText(e)),
  });

  const vendors = q.data?.vendors ?? [];
  const accountOptions = q.data?.accountOptions ?? [];
  const submitNew = () => {
    const name = newName.trim();
    if (name) add.mutate(name);
  };

  return (
    <div className="card scroll-x">
      <h2>サブスクとして数える支払先</h2>
      <p className="sub">
        ここに登録した支払先は、既定では勘定科目に関係なくサブスクとして集計されます(例:
        note株式会社は支払手数料・新聞図書費・通信費のどれで記帳されていても合算)。
        別名は「支払先の表記ゆれ」をカンマ区切りで登録します(部分一致)。
        「対象科目」を入れると、その科目で記帳された支払だけを数えます(例: Amazon
        のように物販が混ざる支払先を「サブスク・通信」だけに絞る)。空欄なら全科目です。
      </p>
      {q.isLoading && <p className="sub">読み込み中…</p>}
      {q.isError && <p className="sub">登録一覧を読み込めませんでした。</p>}
      {vendors.length > 0 && (
        <table className="data stack-sm">
          <thead>
            <tr>
              <th>支払先</th>
              <th>別名(カンマ区切り)</th>
              <th>対象科目(空欄=全科目)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <VendorRow
                key={`${v.id}:${v.aliases.join('\u0000')}:${(v.accounts ?? []).join('\u0000')}`}
                vendor={v}
                accountOptions={accountOptions}
                onError={setError}
                onDelete={() => {
                  if (
                    window.confirm(
                      `「${v.name}」をサブスクの登録から外します。過去の集計は再計算され、この支払先は勘定科目がサブスク・通信のときだけ「その他」に含まれます。よろしいですか?`,
                    )
                  )
                    remove.mutate(v.id);
                }}
              />
            ))}
          </tbody>
        </table>
      )}
      <div className="toolbar" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={newName}
          placeholder="支払先の名前(freeeの取引先名)"
          aria-label="追加する支払先"
          style={{ minWidth: 220 }}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitNew();
          }}
        />
        <button type="button" disabled={!newName.trim() || add.isPending} onClick={submitNew}>
          支払先を追加
        </button>
      </div>
      {error && (
        <p className="sub" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function VendorRow({
  vendor,
  accountOptions,
  onDelete,
  onError,
}: {
  vendor: SubVendorRow;
  accountOptions: string[];
  onDelete: () => void;
  onError: (msg: string | null) => void;
}) {
  const invalidate = useInvalidateSubs();
  const savedAliases = vendor.aliases.join(', ');
  const savedAccounts = vendor.accounts ?? [];
  const [aliasDraft, setAliasDraft] = useState(savedAliases);
  const [accountDraft, setAccountDraft] = useState(savedAccounts);
  const dirty =
    aliasDraft.trim() !== savedAliases || accountDraft.join('\u0000') !== savedAccounts.join('\u0000');
  const save = useMutation({
    mutationFn: (body: { aliases: string[]; accounts: string[] }) =>
      api(`/sub-vendors/${vendor.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: vendor.name, ...body }),
      }),
    onSuccess: () => {
      onError(null);
      invalidate();
    },
    onError: (e) => onError(errorText(e)),
  });
  const commit = () => save.mutate({ aliases: splitList(aliasDraft), accounts: accountDraft });
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && dirty) commit();
  };
  return (
    <tr>
      <td data-label="支払先">{vendor.name}</td>
      <td data-label="別名">
        <input
          type="text"
          value={aliasDraft}
          aria-label={`${vendor.name}の別名`}
          placeholder="例: NOTE, note.com"
          style={{ minWidth: 160 }}
          onChange={(e) => setAliasDraft(e.target.value)}
          onKeyDown={onKey}
        />
      </td>
      <td data-label="対象科目">
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <MultiAccountField
            value={accountDraft}
            options={accountOptions}
            label={`${vendor.name}の対象科目`}
            onChange={setAccountDraft}
          />
          {dirty && (
            <button type="button" className="mini" disabled={save.isPending} onClick={commit}>
              保存
            </button>
          )}
        </span>
      </td>
      <td data-label="登録">
        <button type="button" className="mini danger-btn" onClick={onDelete}>
          登録を外す
        </button>
      </td>
    </tr>
  );
}

/** 複数科目を1つのカンマ文字列にせず、選択済みtokenとして明示する。 */
function MultiAccountField({
  value,
  options,
  label,
  onChange,
}: {
  value: string[];
  options: string[];
  label: string;
  onChange: (next: string[]) => void;
}) {
  const available = options.filter((option) => !value.includes(option));
  return (
    <span
      aria-label={label}
      style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
    >
      {value.map((account) => (
        <span key={account} className="pill neutral">
          {account}{' '}
          <button
            type="button"
            className="mini"
            aria-label={`${account}を対象から外す`}
            onClick={() => onChange(value.filter((item) => item !== account))}
          >
            ×
          </button>
        </span>
      ))}
      <select
        aria-label={`${label}を追加`}
        value=""
        onChange={(event) => {
          if (event.target.value) onChange([...value, event.target.value]);
        }}
      >
        <option value="">{value.length ? '科目を追加' : '全科目（絞り込まない）'}</option>
        {available.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * 採点の根拠。広い画面では常時表示、スマホ幅では <details> に畳む。
 * 表示の出し分けは CSS(display)だけで行い、JS で画面幅を見ない
 * (details は閉じている間 CSS で中身を開けないため、幅ごとに別の要素を用意している)。
 */
function Reasons({ partner, reasons }: { partner: string; reasons: string[] }) {
  const text = reasons.join(' / ');
  return (
    <>
      <div className="sub reasons-wide" style={{ margin: 0, whiteSpace: 'normal', maxWidth: 220 }}>
        {text}
      </div>
      <details className="reasons-narrow">
        <summary>{partner}の採点の根拠</summary>
        <div className="sub" style={{ margin: 0, whiteSpace: 'normal' }}>
          {text}
        </div>
      </details>
    </>
  );
}

/** 「その他」に含まれる支払先をサブスクらしさ順に並べ、1クリックで登録する */
export function SubsCandidatesPanel({ hasDeals }: { hasDeals: boolean }) {
  const q = useQuery({
    queryKey: ['sub-candidates'],
    queryFn: () =>
      api<{ candidates: SubsCandidate[]; excluded: SubVendorExclusionRow[]; dealRows: number }>(
        '/sub-vendors/candidates',
      ),
  });
  const invalidate = useInvalidateSubs();
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: (name: string) =>
      api('/sub-vendors', { method: 'POST', body: JSON.stringify({ name, aliases: [], accounts: [] }) }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorText(e)),
  });
  const exclude = useMutation({
    mutationFn: (partner: string) =>
      api('/sub-vendors/exclusions', { method: 'POST', body: JSON.stringify({ partner }) }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorText(e)),
  });
  const unexclude = useMutation({
    mutationFn: (id: number) => api(`/sub-vendors/exclusions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorText(e)),
  });

  const candidates = q.data?.candidates ?? [];
  const excluded = q.data?.excluded ?? [];
  const dealRows = q.data?.dealRows ?? 0;

  return (
    <div className="card scroll-x">
      <h2>サブスクかもしれない支払先(未登録)</h2>
      <p className="sub">
        freeeの経費取引のうち、まだ登録されていない支払先を「毎月払っているか・毎回同じ金額か・科目がサブスク・通信か」で採点しています。「これはサブスク」を押すと登録され、上の一覧と集計に加わります。候補は上位20件までなので、違うものは「サブスクではない」を押して候補から外してください(あとで取り消せます)。
      </p>
      {q.isLoading && <p className="sub">読み込み中…</p>}
      {q.isError && <p className="sub">候補を読み込めませんでした。</p>}
      {q.data && dealRows === 0 && (
        <p className="sub">
          freeeの取引データがまだ取り込まれていないため候補を出せません(取込画面でfreeeの取引エクスポートを読み込むと表示されます)。
        </p>
      )}
      {q.data && dealRows > 0 && candidates.length === 0 && (
        <p className="sub">
          2ヶ月以上支払のある未登録の支払先はありません
          {hasDeals ? '' : '(freeeの取引が未取込の可能性があります)'}。
        </p>
      )}
      {candidates.length > 0 && (
        <table className="data stack-sm">
          <thead>
            <tr>
              <th>支払先</th>
              <th>サブスクらしさ</th>
              <th>平均月額</th>
              <th>支払月数</th>
              <th>最終支払</th>
              <th>科目</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.partner}>
                <td data-label="支払先" style={{ whiteSpace: 'nowrap' }}>
                  {c.partner}
                  <Reasons partner={c.partner} reasons={c.reasons} />
                </td>
                <td data-label="サブスクらしさ" className="num">
                  {c.score}点
                </td>
                <td data-label="平均月額" className="num">
                  {yen(c.avgMonthly)}
                </td>
                <td data-label="支払月数" className="num">
                  {c.activeMonths}/{c.spanMonths}
                </td>
                <td data-label="最終支払" style={{ whiteSpace: 'nowrap' }}>
                  {monthLabel(c.lastMonth)}
                </td>
                <td data-label="科目" style={{ whiteSpace: 'nowrap' }}>
                  {c.accounts.join('・')}
                </td>
                <td data-label="判定">
                  <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="mini"
                      disabled={add.isPending}
                      onClick={() => add.mutate(c.partner)}
                    >
                      これはサブスク
                    </button>
                    <button
                      type="button"
                      className="mini"
                      disabled={exclude.isPending}
                      onClick={() => exclude.mutate(c.partner)}
                    >
                      サブスクではない
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {excluded.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 13, margin: '0 0 4px' }}>サブスクではないと記録した支払先</h3>
          <p className="sub" style={{ margin: '0 0 6px' }}>
            候補一覧から外しています。「候補に戻す」で取り消せます。
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
            {excluded.map((e) => (
              <li key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{e.partner}</span>
                <button
                  type="button"
                  className="mini"
                  disabled={unexclude.isPending}
                  onClick={() => unexclude.mutate(e.id)}
                >
                  候補に戻す
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className="sub" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
