/**
 * 取込前の差分プレビューと衝突の解決(T13)。
 *
 * ここで守っていること:
 *  - まず件数だけを見せる。追加・変更・削除・不変の4つ。
 *    自動で決まった分は要約のままにして、行としては出さない。
 *    全件を目で追わせる作りにすると、人は結局全部を「そのまま」で通す。
 *  - 行として出すのは2種類だけ。
 *      1. 真の衝突 … 前回の取込値と今回の取込値が違い、かつ人が手当てしている行
 *      2. 閾値未満の候補 … 決め事にはまだ足りないが、繰り返し同じ手当てが出ている取引先
 *  - 何もしないまま取込を確定しても、手当ては消えない(DR-11)。
 *    選ばないことが「今の手当てを残す」であり、それが既定である。
 *  - 同じ取引先はひとまとめにして1回で選ぶ。1件ずつ選ばせない。
 *    そのうえで「次からは決め事にする」を同じ場で選べるようにする。
 *
 * 取引先名について:
 *   差分のAPIは明細の中身を返さない(DR-9)。返るのは tx_id と3つ組だけである。
 *   そこで画面側が、対象月の一覧(手元にすでにある情報)から取引先名を引き当てる。
 *   引き当てられなかった行は「取引先の名前が取れなかった分」としてまとめる。
 */
import { normalizeVendorKey } from '@kanjo/core';
import { useMutation, useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  type Cls,
  type ImportDiffConflict,
  type ImportDiffResult,
  type ImportVendorCandidate,
  type Owner,
  type TxRow,
  api,
  apiUpload,
  ownerLabel,
} from '../api.js';
import { describeError } from './Page.js';

/** 手当ての3属性の呼び名。画面に出す語はここだけで決める */
const ATTR_LABEL = { cls: '公私', big: '大項目', mid: '中項目', owner: '名義' } as const;
type Attr = keyof typeof ATTR_LABEL;

/** 一度にまとめて適用できる件数。これを超えるときは月を分けてもらう */
export const MAX_DECISION_TXS = 200;

const SCOPE_TEXT: Record<string, string> = { biz: '事業', per: '家計' };

/** 属性値を人の読む語にする。空欄は「—」に寄せて、無指定と空文字を同じに見せない */
const valueText = (attr: Attr, raw: string | null): string => {
  if (raw === null || raw === '') return '—';
  if (attr === 'cls') return SCOPE_TEXT[raw] ?? raw;
  if (attr === 'owner') return ownerLabel(raw as Owner);
  return raw;
};

/** 取引先ごとにまとめた衝突。1グループ = 画面の1行 = 1回の選択 */
export interface ConflictGroup {
  vendorKey: string;
  vendorLabel: string;
  txIds: string[];
  /** そのグループを代表する3点比較。属性ごとに、最初の行の値を見出しに使う */
  sample: ImportDiffConflict['attrs'];
}

/** 利用者が決めたこと。取込と同じ確定単位で適用する */
export interface ConflictDecision {
  vendorKey: string;
  vendorLabel: string;
  /** keep = 今の手当てを残す(既定) / incoming = 取り込んだ内容に合わせる */
  choice: 'keep' | 'incoming';
  /** 選んだ内容を、その取引先の決め事として覚えるか */
  remember: boolean;
  txIds: string[];
  /** 覚えるときに使う値。keep なら今の手当て、incoming なら取込値 */
  memoryValue: { cls: Cls | null; big: string | null; mid: string | null; owner: Owner | null };
}

/**
 * 衝突を取引先ごとにまとめる。
 * 取引先が引けなかった行は、tx_id をキーにした1件だけのグループにする
 * (まとめられないものを勝手に1つの束にすると、別の取引先へまとめて当ててしまう)。
 */
export function groupConflicts(
  conflicts: readonly ImportDiffConflict[],
  descriptionOf: (txId: string) => string | null,
): ConflictGroup[] {
  const groups = new Map<string, ConflictGroup>();
  for (const conflict of conflicts) {
    const description = descriptionOf(conflict.txId);
    const key = description ? normalizeVendorKey(description) : `tx:${conflict.txId}`;
    const existing = groups.get(key);
    if (existing) existing.txIds.push(conflict.txId);
    else
      groups.set(key, {
        vendorKey: description ? key : '',
        vendorLabel: description ?? '(取引先の名前が取れませんでした)',
        txIds: [conflict.txId],
        sample: conflict.attrs,
      });
  }
  return [...groups.values()];
}

/** グループの既定の決定。「今の手当てを残す・覚えない」= 何もしないのと同じ */
const defaultDecision = (group: ConflictGroup): ConflictDecision => ({
  vendorKey: group.vendorKey,
  vendorLabel: group.vendorLabel,
  choice: 'keep',
  remember: false,
  txIds: group.txIds,
  memoryValue: memoryValueOf(group, 'keep'),
});

/** 覚えるときの値を3点比較から取り出す。current/incoming のどちらを見るかだけが違う */
function memoryValueOf(group: ConflictGroup, choice: 'keep' | 'incoming') {
  const pick = (attr: Attr) => {
    const cell = group.sample[attr];
    if (!cell) return null;
    return choice === 'keep' ? cell.current : cell.incoming;
  };
  return {
    cls: (pick('cls') as Cls | null) ?? null,
    big: pick('big'),
    mid: pick('mid'),
    owner: (pick('owner') as Owner | null) ?? null,
  };
}

/** 対象月の一覧から tx_id → 取引先名 の対応を作る。差分APIは中身を返さないため画面が補う */
function useDescriptions(months: readonly string[]) {
  const queries = useQueries({
    queries: months.map((month) => ({
      queryKey: ['transactions', month],
      queryFn: () => api<{ transactions: TxRow[] }>(`/transactions?month=${encodeURIComponent(month)}`),
    })),
  });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const query of queries) {
      for (const row of query.data?.transactions ?? []) map.set(row.id, row.description);
    }
    return map;
  }, [queries]);
}

/** 3点比較の1行。base(前回の取込値)・current(今の手当て)・incoming(今回の取込値) */
function ThreeWayRow({ attr, cell }: { attr: Attr; cell: NonNullable<ImportDiffConflict['attrs'][Attr]> }) {
  return (
    <tr>
      <th scope="row" style={{ textAlign: 'left', fontWeight: 'normal' }}>
        {ATTR_LABEL[attr]}
      </th>
      <td className="sub">{valueText(attr, cell.base)}</td>
      <td>
        <strong>{valueText(attr, cell.current)}</strong>
      </td>
      <td>{valueText(attr, cell.incoming)}</td>
    </tr>
  );
}

/** 取引先1件分の衝突。ここで1回選べば、その取引先の全件に効く */
function ConflictCard({
  group,
  decision,
  onChange,
}: {
  group: ConflictGroup;
  decision: ConflictDecision;
  onChange: (next: ConflictDecision) => void;
}) {
  const attrs = (Object.keys(ATTR_LABEL) as Attr[]).filter((attr) => group.sample[attr]);
  const set = (patch: Partial<ConflictDecision>) => {
    const next = { ...decision, ...patch };
    onChange({ ...next, memoryValue: memoryValueOf(group, next.choice) });
  };
  return (
    <div className="notice import-conflict">
      <div className="import-conflict-heading">
        <strong>{group.vendorLabel}</strong>
        <span className="sub">
          {group.txIds.length}件{group.txIds.length > 1 ? '(まとめて選べます)' : ''}
        </span>
      </div>
      <div className="import-conflict-table">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left' }}>
                {' '}
              </th>
              <th scope="col" style={{ textAlign: 'left' }}>
                前回の取込値
              </th>
              <th scope="col" style={{ textAlign: 'left' }}>
                今の手当て
              </th>
              <th scope="col" style={{ textAlign: 'left' }}>
                今回の取込値
              </th>
            </tr>
          </thead>
          <tbody>
            {attrs.map((attr) => {
              const cell = group.sample[attr];
              return cell ? <ThreeWayRow key={attr} attr={attr} cell={cell} /> : null;
            })}
          </tbody>
        </table>
      </div>
      <div className="import-conflict-options">
        <label>
          <input
            type="radio"
            name={`conflict-${group.vendorKey || group.txIds[0]}`}
            checked={decision.choice === 'keep'}
            onChange={() => set({ choice: 'keep' })}
          />
          <span>今の手当てを残す（既定）</span>
        </label>
        <label>
          <input
            type="radio"
            name={`conflict-${group.vendorKey || group.txIds[0]}`}
            checked={decision.choice === 'incoming'}
            onChange={() => set({ choice: 'incoming' })}
          />
          <span>取り込んだ内容に合わせる</span>
        </label>
      </div>
      {group.vendorKey && (
        <label className="import-remember-choice">
          <input
            type="checkbox"
            checked={decision.remember}
            onChange={(e) => set({ remember: e.target.checked })}
          />
          <span>次からもこの取引先はこの内容にする（決め事として覚える）</span>
        </label>
      )}
    </div>
  );
}

/**
 * まだ決め事に足りない取引先。
 * 件数か確信度が閾値に届いていないだけで、当て方自体はもう決まっている。
 * ここで「これでいい」と言えれば、次の取込から自動で当たるようになる。
 */
function SuggestList({ candidates }: { candidates: readonly ImportVendorCandidate[] }) {
  const pin = useMutation({
    mutationFn: (vendorKey: string) =>
      api(`/vendor-memory/${encodeURIComponent(vendorKey)}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: true }),
      }),
  });
  const rows = [...new Map(candidates.map((row) => [row.vendorKey, row])).values()];
  if (!rows.length) return null;
  return (
    <section className="import-suggestions">
      <strong>まだ自動で当てていない取引先 {rows.length}件</strong>
      <p className="sub">確認すると、次回から自動で当てられます。</p>
      <ul>
        {rows.map((row) => (
          <li key={row.vendorKey}>
            <span>
              <strong>{row.vendorLabel}</strong>
              <small>
                {valueText('cls', row.cls)} / {valueText('big', row.big)} / {valueText('owner', row.owner)}・
                {candidates.filter((candidate) => candidate.vendorKey === row.vendorKey).length}件
              </small>
            </span>
            <button type="button" disabled={pin.isPending} onClick={() => pin.mutate(row.vendorKey)}>
              これで自動にする
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 差分プレビュー本体。
 * 取り込む前に押す。ここでは1文字も書き換えない(サーバ側も既定は読むだけ)。
 */
export function DiffPreview({
  files,
  decisions,
  onDecisionsChange,
  onFingerprintChange,
}: {
  files: File[];
  decisions: ConflictDecision[];
  onDecisionsChange: (next: ConflictDecision[]) => void;
  onFingerprintChange: (fingerprint: string | null) => void;
}) {
  const [diff, setDiff] = useState<ImportDiffResult | null>(null);
  const check = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      for (const file of files) form.append('file', file);
      return apiUpload<ImportDiffResult>('/imports/diff', form);
    },
    onSuccess: (result) => {
      setDiff(result);
      onDecisionsChange([]);
      onFingerprintChange(result.fingerprint);
    },
    onError: () => onFingerprintChange(null),
  });

  const descriptions = useDescriptions(diff?.months ?? []);
  const groups = useMemo(
    () => (diff ? groupConflicts(diff.conflicts, (txId) => descriptions.get(txId) ?? null) : []),
    [diff, descriptions],
  );
  const decisionOf = (group: ConflictGroup) =>
    decisions.find((d) => d.txIds[0] === group.txIds[0]) ?? defaultDecision(group);
  const changeDecision = (next: ConflictDecision) =>
    onDecisionsChange([...decisions.filter((d) => d.txIds[0] !== next.txIds[0]), next]);

  const tooMany = groups.reduce((sum, group) => sum + group.txIds.length, 0) > MAX_DECISION_TXS;

  return (
    <div className="import-diff">
      <button
        type="button"
        aria-label="取り込む前に差分を見る"
        onClick={() => check.mutate()}
        disabled={check.isPending || !files.length}
      >
        {check.isPending ? '確認中…' : '取込前の変更を確認'}
      </button>
      {check.isError && (
        <div className="notice" role="alert">
          差分を確認できませんでした: {describeError(check.error)}
        </div>
      )}

      {diff && (
        <section className="import-diff-result" aria-labelledby="import-diff-title" aria-live="polite">
          <div className="import-diff-heading">
            <div>
              <span className="import-eyebrow">取込前の確認</span>
              <strong id="import-diff-title">取り込むとこうなります</strong>
            </div>
            <span className="sub">対象月: {diff.months.join(', ') || '—'}</span>
          </div>
          <dl className="import-diff-counts">
            <div>
              <dt>増える明細</dt>
              <dd className="num">{diff.counts.added}件</dd>
            </div>
            <div>
              <dt>変わる明細</dt>
              <dd className="num">{diff.counts.changed}件</dd>
            </div>
            <div>
              <dt>無くなる明細</dt>
              <dd className="num">{diff.counts.deleted}件</dd>
            </div>
            <div>
              <dt>そのままの明細</dt>
              <dd className="num">{diff.counts.unchanged}件</dd>
            </div>
          </dl>

          {groups.length === 0 ? (
            <p className="import-diff-message calm">
              あなたの手当てと今回の取込値がぶつかる明細はありません。このまま取り込めます。
            </p>
          ) : tooMany ? (
            <p className="import-diff-message" role="alert">
              ぶつかる明細が多すぎます({MAX_DECISION_TXS}
              件まで)。月を分けて取り込んでください。何も選ばずに取り込めば、今の手当てはそのまま残ります。
            </p>
          ) : (
            <>
              <p className="import-diff-message">
                <strong>選ぶ必要があるのは {groups.length}件の取引先だけです。</strong>
                <span className="sub">
                  何も選ばずに取り込んでも、今の手当てはそのまま残ります。変えたいものだけ選んでください。
                </span>
              </p>
              {groups.map((group) => (
                <ConflictCard
                  key={group.vendorKey || group.txIds[0]}
                  group={group}
                  decision={decisionOf(group)}
                  onChange={changeDecision}
                />
              ))}
            </>
          )}

          <SuggestList candidates={diff.candidates} />
        </section>
      )}
    </div>
  );
}
