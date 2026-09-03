/**
 * 取引先の決め事の一覧(T14)。設定画面の中に置く。
 *
 * 決め事は「同じ取引先には同じ手当てを当てる」という自動処理である。
 * 自動で動くものは、必ず次の3つが揃っていないと使い物にならない。
 *   1. 今どう動いているかが読める … 適用内容・確信度・適用件数・最終適用日
 *   2. 止められる … 取り消す
 *   3. 直せる … 留める(pin) / 内容を直す
 * この画面はその3つだけを担う。
 *
 * 「再判定」は、決め事を変えたあと過去の明細へ当て直す導線である。
 * 当て直しは過去に自動で当てた手当てを外す・当てるので、
 * 押す前に何件が動くかを言葉で示してから実行する。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type Cls,
  type Owner,
  type VendorMemoryReapply,
  type VendorMemoryRow,
  api,
  ownerLabel,
} from '../api.js';
import { dateTime } from '../format.js';
import { DataTable } from './DataTable.js';
import { describeError } from './Page.js';

const SCOPE_TEXT: Record<string, string> = { biz: '事業', per: '家計' };

const DISPOSITION_LABEL: Record<VendorMemoryRow['disposition'], string> = {
  'auto-apply': '自動で当てる',
  suggest: '候補として出す',
  inactive: '当てない',
};

const DISPOSITION_PILL: Record<VendorMemoryRow['disposition'], string> = {
  'auto-apply': 'pill calm',
  suggest: 'pill warn',
  inactive: 'pill',
};

/** 適用内容を1行の文にする。空欄は書かない(「— / — / —」を読ませない) */
export function appliedText(row: VendorMemoryRow): string {
  const parts = [
    row.cls ? SCOPE_TEXT[row.cls] : null,
    row.big || null,
    row.mid || null,
    row.owner ? ownerLabel(row.owner as Owner) : null,
  ].filter((part): part is string => !!part);
  return parts.length ? parts.join(' / ') : '(何も決めていません)';
}

/** 確信度は割合で出さない。「10件中9件」の形のほうが判断できる */
const hitsText = (row: VendorMemoryRow): string =>
  `${row.hitCount}件${row.disagreeCount ? `(食い違い${row.disagreeCount}件)` : ''}`;

/**
 * 1件の決め事に対する操作。取り消す・留める・直す・当て直す。
 * 表の行の中にフォームを開くと崩れるので、開いたときだけ行の下へ出す。
 */
function MemoryActions({ row }: { row: VendorMemoryRow }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [big, setBig] = useState(row.big ?? '');
  const [mid, setMid] = useState(row.mid ?? '');
  const [reapplied, setReapplied] = useState<VendorMemoryReapply | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['vendor-memory'] });
  };

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<VendorMemoryRow>(`/vendor-memory/${encodeURIComponent(row.vendorKey)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });

  const reapply = useMutation({
    mutationFn: () =>
      api<VendorMemoryReapply>(`/vendor-memory/${encodeURIComponent(row.vendorKey)}/reapply`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: (result) => {
      setReapplied(result);
      void qc.invalidateQueries();
    },
  });

  return (
    <>
      <button
        type="button"
        disabled={patch.isPending}
        onClick={() => patch.mutate({ revoked: !row.revoked })}
      >
        {row.revoked ? '取り消しをやめる' : '取り消す'}
      </button>{' '}
      <button type="button" disabled={patch.isPending} onClick={() => patch.mutate({ pinned: !row.pinned })}>
        {row.pinned ? '留めるのをやめる' : '件数によらず当てる'}
      </button>{' '}
      <button type="button" onClick={() => setEditing((prev) => !prev)}>
        {editing ? '直すのをやめる' : '内容を直す'}
      </button>{' '}
      <button type="button" disabled={reapply.isPending} onClick={() => reapply.mutate()}>
        {reapply.isPending ? '当て直しています…' : '過去の明細へ当て直す'}
      </button>
      {editing && (
        <div style={{ marginTop: 6 }}>
          <label>
            大項目{' '}
            <input
              value={big}
              onChange={(e) => setBig(e.target.value)}
              aria-label={`${row.vendorLabel}の大項目`}
            />
          </label>{' '}
          <label>
            中項目{' '}
            <input
              value={mid}
              onChange={(e) => setMid(e.target.value)}
              aria-label={`${row.vendorLabel}の中項目`}
            />
          </label>{' '}
          <button
            type="button"
            className="primary"
            disabled={patch.isPending}
            onClick={() =>
              patch.mutate({ big: big || null, mid: mid || null }, { onSuccess: () => setEditing(false) })
            }
          >
            保存
          </button>
        </div>
      )}
      {patch.isError && (
        <div className="sub" role="alert">
          変えられませんでした: {describeError(patch.error)}
        </div>
      )}
      {reapply.isError && (
        <div className="sub" role="alert">
          当て直せませんでした: {describeError(reapply.error)}
        </div>
      )}
      {reapplied && (
        <output className="sub" style={{ display: 'block' }}>
          同じ取引先の明細 {reapplied.matched}件のうち、{reapplied.applied}件に当て、{reapplied.withdrawn}
          件から外しました。あなたが選んだ手当ては外していません。
        </output>
      )}
    </>
  );
}

/**
 * 決め事の一覧。設定画面から開く。
 * 1件も無いときは表を出さず、どうすれば増えるのかだけを書く。
 */
export function VendorMemorySettings() {
  const memories = useQuery({
    queryKey: ['vendor-memory'],
    queryFn: () => api<{ memories: VendorMemoryRow[] }>('/vendor-memory'),
  });
  const rows = memories.data?.memories ?? [];

  return (
    <div className="card">
      <h2>取引先の決め事</h2>
      <p className="sub">
        同じ取引先に同じ手当てが続くと、次から自動で当てます。ここで止めたり、内容を直したりできます。
        あなたが手で選んだ手当ては、決め事を取り消しても消えません。
      </p>
      {memories.isError && (
        <div className="notice" role="alert">
          決め事を読み込めませんでした: {describeError(memories.error)}
        </div>
      )}
      {!rows.length ? (
        <p className="sub">
          まだ決め事はありません。同じ取引先を3回以上同じように手当てすると、ここに出ます。
        </p>
      ) : (
        <div className="scroll-x">
          <DataTable
            columns={[
              '取引先',
              '適用内容',
              { label: '扱い', title: '自動で当てる / 候補として出す / 当てない' },
              { label: '確信度', title: '同じ手当てが続いた度合いです。1.00 に近いほど揺れがありません' },
              { label: '適用件数', title: 'この決め事のもとになった手当ての件数です' },
              '最終適用日',
              { label: '操作', sortable: false },
            ]}
          >
            {rows.map((row) => (
              <tr key={row.vendorKey}>
                <td>{row.vendorLabel || row.vendorKey}</td>
                <td>{appliedText(row)}</td>
                <td>
                  <span className={DISPOSITION_PILL[row.disposition]}>
                    {DISPOSITION_LABEL[row.disposition]}
                  </span>
                  {row.pinned && <span className="pill calm">留めています</span>}
                  {row.revoked && <span className="pill alert">取り消し済み</span>}
                  <div className="sub" style={{ whiteSpace: 'normal', textAlign: 'left' }}>
                    {row.reason}
                  </div>
                </td>
                <td className="num">{row.confidence.toFixed(2)}</td>
                <td className="num">{hitsText(row)}</td>
                <td className="num">{dateTime(row.updatedAt)}</td>
                <td>
                  <MemoryActions row={row} />
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}

/**
 * 明細に付ける「決め事で当たっています」の印。
 *
 * 自動で当たった手当てと、自分で選んだ手当てが見た目で同じだと、
 * 「なぜこの科目になっているのか」が分からないまま放置される。
 * 印の先を決め事の一覧にしておくことで、その場から止めに行ける。
 */
export function VendorMemoryBadge({
  origin,
  originKey,
}: {
  origin: 'manual' | 'vendor_memory' | null;
  originKey: string | null;
}) {
  // 値が一致しているだけでは自動適用と断定しない。0031の保存済みprovenanceだけを表示条件にする。
  if (origin !== 'vendor_memory' || !originKey) return null;
  return (
    <Link
      to="/settings#vendor-memory"
      className="pill calm"
      title="保存された適用由来が「取引先の決め事」です。押すと決め事の一覧へ移ります"
    >
      決め事
    </Link>
  );
}
