import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type KeyboardEvent, useState } from 'react';
import { type SubVendorRow, type SubsCandidate, api } from '../api.js';
import { monthLabel, yen } from '../format.js';

const SUBS_KEYS = [['subscriptions'], ['sub-vendors'], ['sub-candidates'], ['summary']];

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
    queryFn: () => api<{ vendors: SubVendorRow[] }>('/sub-vendors'),
  });
  const invalidate = useInvalidateSubs();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (name: string) =>
      api('/sub-vendors', { method: 'POST', body: JSON.stringify({ name, aliases: [] }) }),
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
  const submitNew = () => {
    const name = newName.trim();
    if (name) add.mutate(name);
  };

  return (
    <div className="card scroll-x">
      <h2>サブスクとして数える支払先</h2>
      <p className="sub">
        ここに登録した支払先は、勘定科目に関係なくサブスクとして集計されます(例:
        note株式会社は支払手数料・新聞図書費・通信費のどれで記帳されていても合算)。
        別名は「支払先の表記ゆれ」をカンマ区切りで登録します(部分一致)。
      </p>
      {q.isLoading && <p className="sub">読み込み中…</p>}
      {q.isError && <p className="sub">登録一覧を読み込めませんでした。</p>}
      {vendors.length > 0 && (
        <table className="data">
          <thead>
            <tr>
              <th>支払先</th>
              <th>別名(カンマ区切り)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <VendorRow
                key={v.id}
                vendor={v}
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
  onDelete,
  onError,
}: {
  vendor: SubVendorRow;
  onDelete: () => void;
  onError: (msg: string | null) => void;
}) {
  const invalidate = useInvalidateSubs();
  const saved = vendor.aliases.join(', ');
  const [draft, setDraft] = useState(saved);
  const dirty = draft.trim() !== saved;
  const save = useMutation({
    mutationFn: (aliases: string[]) =>
      api(`/sub-vendors/${vendor.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: vendor.name, aliases }),
      }),
    onSuccess: () => {
      onError(null);
      invalidate();
    },
    onError: (e) => onError(errorText(e)),
  });
  const commit = () => {
    const aliases = draft
      .split(/[,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
    save.mutate(aliases);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && dirty) commit();
  };
  return (
    <tr>
      <td>{vendor.name}</td>
      <td>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={draft}
            aria-label={`${vendor.name}の別名`}
            placeholder="例: NOTE, note.com"
            style={{ minWidth: 200 }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
          />
          {dirty && (
            <button type="button" className="mini" disabled={save.isPending} onClick={commit}>
              別名を保存
            </button>
          )}
        </span>
      </td>
      <td>
        <button type="button" className="mini danger-btn" onClick={onDelete}>
          登録を外す
        </button>
      </td>
    </tr>
  );
}

/** 「その他」に含まれる支払先をサブスクらしさ順に並べ、1クリックで登録する */
export function SubsCandidatesPanel({ hasDeals }: { hasDeals: boolean }) {
  const q = useQuery({
    queryKey: ['sub-candidates'],
    queryFn: () => api<{ candidates: SubsCandidate[]; dealRows: number }>('/sub-vendors/candidates'),
  });
  const invalidate = useInvalidateSubs();
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: (name: string) =>
      api('/sub-vendors', { method: 'POST', body: JSON.stringify({ name, aliases: [] }) }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorText(e)),
  });

  const candidates = q.data?.candidates ?? [];
  const dealRows = q.data?.dealRows ?? 0;

  return (
    <div className="card scroll-x">
      <h2>サブスクかもしれない支払先(未登録)</h2>
      <p className="sub">
        freeeの経費取引のうち、まだ登録されていない支払先を「毎月払っているか・毎回同じ金額か・科目がサブスク・通信か」で採点しています。「これはサブスク」を押すと登録され、上の一覧と集計に加わります。
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
        <table className="data">
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
                <td style={{ whiteSpace: 'nowrap' }}>
                  {c.partner}
                  <div className="sub" style={{ margin: 0, whiteSpace: 'normal', maxWidth: 220 }}>
                    {c.reasons.join(' / ')}
                  </div>
                </td>
                <td className="num">{c.score}点</td>
                <td className="num">{yen(c.avgMonthly)}</td>
                <td className="num">
                  {c.activeMonths}/{c.spanMonths}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{monthLabel(c.lastMonth)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.accounts.join('・')}</td>
                <td>
                  <button
                    type="button"
                    className="mini"
                    disabled={add.isPending}
                    onClick={() => add.mutate(c.partner)}
                  >
                    これはサブスク
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && (
        <p className="sub" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
