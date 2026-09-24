/**
 * 使い方画面のページ制御 (spec-guide-screen)。
 *
 * URL 状態 (`topic` / `q`) と /api/guide の取得だけを持ち、各節の表示は同じディレクトリの部品へ分ける。
 * 本文・目次・検索・よくある疑問は core の定数なので、取得の成否に関わらず描く。
 * 取得に依存するのは数値の枠 (総収支・このページの数値・ステッパーの進捗) だけ。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type GuideResponse, api } from '../../api.js';
import { PageHeader } from '../../components/Page.js';
import { PeriodRange } from '../../components/PeriodRange.js';
import { usePeriod } from '../../period.js';
import { GuideAside } from './GuideAside.js';
import { GuideBottomBar } from './GuideBottomBar.js';
import { GuideFaq } from './GuideFaq.js';
import { GuideSteps } from './GuideSteps.js';
import { GUIDE_PANEL_ID, GuideToc, guideTabId } from './GuideToc.js';
import { GuideTopicBody } from './GuideTopicBody.js';
import type { GuideLoad } from './GuideValue.js';
import {
  GUIDE_HEADING,
  GUIDE_SEARCH,
  type GuideUrlState,
  pageFacts,
  readGuideUrl,
  searchGuideTopics,
  selectedGuideTopic,
  visibleFaqRows,
  visibleTopics,
  writeGuideUrl,
} from './view-model.js';
import './guide.css';

export function GuidePage() {
  const [params, setParams] = useSearchParams();
  const url = readGuideUrl(params);
  const { key, withPeriod } = usePeriod();
  const query = useQuery({
    queryKey: ['guide', key],
    queryFn: () => api<GuideResponse>(withPeriod('/guide')),
    placeholderData: keepPreviousData,
  });
  // keepPreviousData は切替前の応答を保持する。別期間の数値を新期間の結果として出さない。
  const screen = query.isPlaceholderData ? undefined : query.data?.screen;
  const load: GuideLoad = query.isLoading || query.isPlaceholderData ? 'loading' : screen ? 'ready' : 'error';

  const update = useCallback(
    (patch: Partial<GuideUrlState>) =>
      setParams((previous) => writeGuideUrl(previous, patch), { replace: true }),
    [setParams],
  );

  const search = searchGuideTopics(url.q);
  const topics = visibleTopics(search);
  const selectedTopic = selectedGuideTopic(search, url.topic);

  // 共有 URL で検索語と topic が食い違っても、URL・タブ・本文を同じ結果へ揃える。
  useEffect(() => {
    if (selectedTopic && selectedTopic !== url.topic) update({ topic: selectedTopic });
  }, [selectedTopic, url.topic, update]);

  const onQuery = (q: string) => {
    const nextTopic = selectedGuideTopic(searchGuideTopics(q), url.topic);
    update({ q, ...(nextTopic ? { topic: nextTopic } : {}) });
  };

  return (
    <div className="guide-page">
      <div className="guide-intro">
        <PageHeader
          route="guide"
          title={GUIDE_HEADING.title}
          question={GUIDE_HEADING.question}
          lead={GUIDE_HEADING.lead}
          showTask={false}
        />
        <PeriodRange
          navigation={screen?.period}
          label={load === 'error' ? '期間を取得できませんでした' : screen?.period.label}
          loading={load === 'loading'}
        />
      </div>

      <div className="guide-grid">
        <div className="guide-main">
          <GuideSteps emphasizeImport={load === 'ready' && !screen?.dataUpdatedAt} />

          <section className="card guide-body" aria-labelledby="guide-body-title">
            <h2 id="guide-body-title">使い方ガイド</h2>
            <div className="guide-body-grid">
              <div className="guide-body-toc">
                {selectedTopic === null ? (
                  <output className="guide-search-none">
                    <strong>{search.none ? GUIDE_SEARCH.empty : '本文に一致する項目はありません'}</strong>
                    <span className="sub">
                      {search.none
                        ? `別の語でお試しください。例：${GUIDE_SEARCH.examples.join('、')}`
                        : '下の「よくある疑問」に一致する結果があります。'}
                    </span>
                  </output>
                ) : (
                  <GuideToc topics={topics} current={selectedTopic} onSelect={(topic) => update({ topic })} />
                )}
              </div>
              <div
                className="guide-panel"
                id={GUIDE_PANEL_ID}
                role={selectedTopic ? 'tabpanel' : 'region'}
                aria-labelledby={selectedTopic ? guideTabId(selectedTopic) : undefined}
                aria-label={selectedTopic ? undefined : '検索結果'}
              >
                {selectedTopic ? (
                  <GuideTopicBody topic={selectedTopic} load={load} screen={screen} />
                ) : (
                  <p className="sub">
                    {search.none
                      ? '一致する項目がありません。別のキーワードで検索してください。'
                      : '一致する疑問を下で確認できます。'}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <GuideAside
          load={load}
          facts={load === 'ready' && screen ? pageFacts(screen) : []}
          onRetry={() => void query.refetch()}
          query={url.q}
          onQuery={onQuery}
        />
      </div>

      <GuideFaq rows={visibleFaqRows(search)} />
      {selectedTopic && <GuideBottomBar topic={selectedTopic} />}
    </div>
  );
}
