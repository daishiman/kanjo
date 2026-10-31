/**
 * トレードオフ画面 (spec-tradeoff-screen)。新しい支出を増やすとき、どの事業経費を見直して捻出するかを決める。
 *
 * 共通の PageShell (Layout) の中に描き、見出しは PageHeader、読込中・失敗は PageState に任せる。
 * 試算と推奨の数字は core の `tradeoffSimulation` / `tradeoffCombos` だけが作り、画面は式を持たない。
 * 記録 (POST) は入力と選んだ候補キーだけを送り、充足額・判定はサーバーが決める (FR-12)。
 */
import {
  type TradeoffCombo,
  type TradeoffLatestPlan,
  type TradeoffScreenCandidate,
  tradeoffCombos,
  tradeoffSimulation,
} from '@kanjo/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, type SummaryResponse, type TradeoffResponse, api } from '../../api.js';
import { PageHeader, PageState } from '../../components/Page.js';
import { usePeriod } from '../../period.js';
import { CalcExamples } from './CalcExamples.js';
import { CandidateTable } from './CandidateTable.js';
import { NewExpenseForm } from './NewExpenseForm.js';
import { RecommendationTable } from './RecommendationTable.js';
import { SelectionBar } from './SelectionBar.js';
import { SimulationPanel } from './SimulationPanel.js';
import {
  type ExpenseDraft,
  type NeedChoice,
  nextMonthKey,
  parseAmount,
  sameCandidateKeys,
} from './view-model.js';
import './tradeoff.css';

const LEAD = '新しい支出を増やすなら、何を見直しますか？';
const DESCRIPTION =
  '新しい支出の原資をつくるため、どの支出をどれだけ見直すかを試算します。現実的な候補を組み合わせて、無理のない実行計画を立てられます。';

function TradeoffHero({ period }: { period: string }) {
  return (
    <div className="tradeoff-hero">
      <div>
        <PageHeader route="tradeoff" lead={LEAD} showTask={false} />
        <p className="tradeoff-intro">{DESCRIPTION}</p>
      </div>
      <aside className="card tradeoff-period" aria-label="分析期間">
        <h2>分析期間（グローバル）</h2>
        <strong>{period}</strong>
        <p>ヘッダーで選んだ全体期間と同じ範囲で試算します。</p>
      </aside>
    </div>
  );
}

export function TradeoffPage() {
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['tradeoff', key],
    queryFn: () => api<TradeoffResponse>(withPeriod('/tradeoff')),
  });
  const summary = useQuery({
    queryKey: ['summary', key],
    queryFn: () => api<SummaryResponse>(withPeriod('/summary')),
  });
  const hero = <TradeoffHero period={summary.data?.period?.label ?? '—'} />;

  if (q.isLoading && !q.data)
    return (
      <>
        {hero}
        <PageState status="loading" />
      </>
    );
  if (!q.data)
    return (
      <>
        {hero}
        <PageState status="error" error={q.error} />
      </>
    );
  return (
    <>
      {hero}
      {q.isError && (
        <p className="tradeoff-inline-error" role="alert">
          最新情報を再取得できませんでした。表示中の入力と試算結果はそのまま確認できます。
        </p>
      )}
      <TradeoffScreen key={key} data={q.data} />
    </>
  );
}

/** 最新の記録から入力と選択を復元する。今の期間に無い候補キーは外し、その件数を返す (FR-13) */
function restore(latest: TradeoffLatestPlan | null, candidates: readonly TradeoffScreenCandidate[]) {
  if (!latest) {
    return {
      draft: { title: '', amount: '', recurring: true, startMonth: nextMonthKey(new Date()), memo: '' },
      selected: new Set<string>(),
      dropped: 0,
    };
  }
  const known = new Set(candidates.map((c) => c.key));
  const kept = latest.keys.filter((k) => known.has(k));
  return {
    draft: {
      title: latest.title ?? '',
      amount: String(latest.amount),
      recurring: latest.recurring,
      startMonth: latest.startMonth ?? nextMonthKey(new Date()),
      memo: latest.memo ?? '',
    },
    selected: new Set(kept),
    dropped: latest.keys.length - kept.length,
  };
}

/**
 * 取得済みの応答を受けて 1〜3 の段・計算例・右の試算結果・選択中バーを描く。
 * 入力と選択はここで持ち、取り直し (invalidate) で応答が変わっても消さない。
 */
function TradeoffScreen({ data }: { data: TradeoffResponse }) {
  const qc = useQueryClient();
  const [initial] = useState(() => restore(data.latest, data.candidates));
  const [draft, setDraft] = useState<ExpenseDraft>(initial.draft);
  const [picked, setPicked] = useState<ReadonlySet<string>>(initial.selected);
  const [chosenKeys, setChosenKeys] = useState<readonly string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(
    initial.dropped ? `${initial.dropped} 件の候補は現在の期間に無いため外しました` : null,
  );
  const [saveStatus, setSaveStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const refetch = () => qc.invalidateQueries({ queryKey: ['tradeoff'] });

  // 取り直しで候補が消えたら、その選択は数えない (候補の並び順で持つ)
  const selectedCandidates = data.candidates.filter((c) => picked.has(c.key));
  const selected = new Set(selectedCandidates.map((c) => c.key));
  const amount = parseAmount(draft.amount);
  const sim = tradeoffSimulation(
    { amount: amount ?? 0, recurring: draft.recurring },
    selectedCandidates.map((c) => c.monthly),
    data.defense.monthlyMargin,
  );
  const combos = tradeoffCombos(data.candidates, amount ? sim.annualCost : 0);
  const selectedKeys = selectedCandidates.map((c) => c.key);
  // 組み合わせを選んだあと、選択を手で変えたら理由は出さない
  const chosen: TradeoffCombo | null =
    chosenKeys && sameCandidateKeys(chosenKeys, selectedKeys)
      ? (combos.find((combo) => sameCandidateKeys(combo.keys, chosenKeys)) ?? null)
      : null;

  const save = useMutation({
    mutationFn: () =>
      api('/tradeoff', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title.trim() || null,
          amount,
          recurring: draft.recurring,
          startMonth: draft.startMonth || null,
          memo: draft.memo.trim() || null,
          keys: selectedCandidates.map((c) => c.key),
        }),
      }),
    onMutate: () => setSaveStatus(null),
    onSuccess: () => {
      setSaveStatus({ tone: 'success', text: 'この試算を記録しました' });
      return refetch();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'unknown_candidate') {
        const text = '選んだ候補が現在の期間にありません。取り直しました';
        setSaveStatus({ tone: 'error', text });
        void refetch();
        return;
      }
      setSaveStatus({ tone: 'error', text: '記録できませんでした。入力は残っています' });
    },
  });

  const override = useMutation({
    mutationFn: (v: { key: string; need: string | null; memo: string | null }) =>
      api(`/tradeoff/candidates/${encodeURIComponent(v.key)}`, {
        method: 'PUT',
        body: JSON.stringify({ need: v.need, memo: v.memo }),
      }),
    onMutate: () => setFailedKey(null),
    onSuccess: () => refetch(),
    onError: (_err, v) => setFailedKey(v.key),
  });

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPicked(next);
    setChosenKeys(null);
  };
  const clear = () => {
    setPicked(new Set());
    setChosenKeys(null);
  };
  const onNeed = (c: TradeoffScreenCandidate, choice: NeedChoice) =>
    override.mutate({ key: c.key, need: choice === 'auto' ? null : choice, memo: c.memo });
  const onMemo = async (c: TradeoffScreenCandidate, memo: string): Promise<boolean> => {
    try {
      await override.mutateAsync({
        key: c.key,
        need: c.needSource === 'manual' ? c.need : null,
        memo: memo.trim() || null,
      });
      return true;
    } catch {
      return false;
    }
  };
  const choose = (combo: TradeoffCombo) => {
    setPicked(new Set(combo.keys));
    // 理由の一致判定は候補の並び順で作るので、組み合わせのキーも同じ順に揃える
    setChosenKeys(data.candidates.filter((c) => combo.keys.includes(c.key)).map((c) => c.key));
  };

  const disabledReason =
    amount !== null
      ? null
      : draft.amount.trim()
        ? '金額を 1 円〜1 億円の整数に直すと記録できます'
        : '新しい支出の金額を入力すると記録できます';

  return (
    <div className="tradeoff-layout">
      {notice && <output className="tradeoff-notice">{notice}</output>}
      <div className="tradeoff-primary">
        <NewExpenseForm draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        <CandidateTable
          candidates={data.candidates}
          selected={selected}
          pendingKey={override.isPending ? (override.variables?.key ?? null) : null}
          failedKey={failedKey}
          onToggle={toggle}
          onClearAll={clear}
          onNeed={onNeed}
          onMemo={onMemo}
        />
      </div>
      <div className="tradeoff-side">
        <SimulationPanel
          result={sim}
          hasAmount={amount !== null}
          expense={{ title: draft.title, amount, recurring: draft.recurring }}
          selectedCount={selectedCandidates.length}
        />
      </div>
      <RecommendationTable combos={combos} candidates={data.candidates} chosen={chosen} onChoose={choose} />
      <CalcExamples />
      <SelectionBar
        count={selectedCandidates.length}
        result={sim}
        canSubmit={amount !== null}
        disabledReason={disabledReason}
        busy={save.isPending}
        status={saveStatus}
        onClear={clear}
        onSubmit={() => save.mutate()}
      />
    </div>
  );
}
