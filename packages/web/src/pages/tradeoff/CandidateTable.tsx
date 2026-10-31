import type { TradeoffScreenCandidate } from '@kanjo/core';
import { useId, useState } from 'react';
import { Button } from '../../components/Button.js';
import { CandidateRow } from './CandidateRow.js';
import { StepHeading } from './StepHeading.js';
import { INITIAL_ROWS, type NeedChoice, accountOptions, filterCandidates } from './view-model.js';

/**
 * 2.見直し候補の選択 (FR-5 / FR-6 / FR-7)。検索・カテゴリ絞込・選択・必要度とメモの上書きを持つ。
 * 候補の並びと必要度は API (core) が決めた値をそのまま出し、画面で並べ替えない。
 */
export function CandidateTable({
  candidates,
  selected,
  pendingKey,
  failedKey,
  onToggle,
  onClearAll,
  onNeed,
  onMemo,
}: {
  candidates: readonly TradeoffScreenCandidate[];
  selected: ReadonlySet<string>;
  /** 上書きを送信中の候補 (その行の操作を止める) */
  pendingKey: string | null;
  /** 上書きに失敗した候補 (その行に文を出す) */
  failedKey: string | null;
  onToggle: (key: string) => void;
  onClearAll: () => void;
  onNeed: (candidate: TradeoffScreenCandidate, choice: NeedChoice) => void;
  onMemo: (candidate: TradeoffScreenCandidate, memo: string) => Promise<boolean>;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = filterCandidates(candidates, search, account);
  const rows = showAll ? filtered : filtered.slice(0, INITIAL_ROWS);

  return (
    <section className="card tradeoff-step" aria-labelledby={`${id}-h`}>
      <StepHeading
        id={`${id}-h`}
        number={2}
        title="見直し候補の選択"
        description="見直す支出を選びます。複数の候補を組み合わせて試算できます。"
      />
      <div className="tradeoff-toolbar">
        <input
          type="search"
          aria-label="候補を検索"
          placeholder="カテゴリ名・取引先名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="カテゴリ" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="">すべてのカテゴリ</option>
          {accountOptions(candidates).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <Button onClick={onClearAll}>選択をすべてクリア</Button>
      </div>

      {candidates.length === 0 ? (
        <p className="empty">直近 3 か月に月 1,000 円以上の事業経費がありません</p>
      ) : (
        <>
          <div className="tradeoff-scroll">
            <table
              className="data tradeoff-candidates"
              aria-label="見直し候補"
              data-table-kind="workflow"
              data-sort-reason="月額の降順は候補を選ぶ作業の順番で、推奨の組み合わせと同じ順を保つ"
            >
              <thead>
                <tr>
                  <th scope="col">選択</th>
                  <th scope="col">#</th>
                  <th scope="col" className="left">
                    カテゴリ・取引先
                  </th>
                  <th scope="col">月額</th>
                  <th scope="col">年額</th>
                  <th scope="col">必要度</th>
                  <th scope="col">直近の推移</th>
                  <th scope="col" className="left">
                    損益・メモ
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((candidate, index) => (
                  <CandidateRow
                    key={candidate.key}
                    candidate={candidate}
                    index={index}
                    selected={selected.has(candidate.key)}
                    pending={pendingKey === candidate.key}
                    failed={failedKey === candidate.key}
                    onToggle={() => onToggle(candidate.key)}
                    onNeed={(choice) => onNeed(candidate, choice)}
                    onMemo={(memo) => onMemo(candidate, memo)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="tradeoff-table-foot">
            <span aria-live="polite">
              {filtered.length} 件中 {rows.length} 件を表示
            </span>
            {!showAll && filtered.length > INITIAL_ROWS && (
              <Button variant="text" onClick={() => setShowAll(true)}>
                すべて表示
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
