/**
 * 右カラム: このページの数値 (FR-9)・関連ページ (FR-10)・ガイド内を検索 (FR-11)。
 * 検索はブラウザ内の core の関数だけで行い、検索語はサーバへ送らない。
 */
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button.js';
import { UiIcon } from '../../components/UiIcon.js';
import { GUIDE_FAILED_TEXT, type GuideLoad, GuideValue } from './GuideValue.js';
import { GUIDE_FACT_LABELS, GUIDE_RELATED_PAGES, GUIDE_SEARCH, type GuideFact } from './view-model.js';

function PageFacts({ load, facts, onRetry }: { load: GuideLoad; facts: GuideFact[]; onRetry: () => void }) {
  return (
    <section className="card guide-aside-card" aria-labelledby="guide-facts-title">
      <h2 id="guide-facts-title">このページの数値</h2>
      <dl className="guide-facts">
        {Object.entries(GUIDE_FACT_LABELS).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              <GuideValue load={load}>
                {() => facts.find((fact) => fact.key === key)?.value ?? '—'}
              </GuideValue>
            </dd>
          </div>
        ))}
      </dl>
      {load === 'error' && (
        <div className="guide-retry" role="alert">
          <span>数値を{GUIDE_FAILED_TEXT}。本文・目次・検索はそのまま使えます。</span>
          <Button size="mini" onClick={onRetry}>
            再読み込みする
          </Button>
        </div>
      )}
    </section>
  );
}

function RelatedPages() {
  return (
    <nav className="card guide-aside-card" aria-labelledby="guide-related-title">
      <h2 id="guide-related-title">関連ページ</h2>
      <ul className="guide-related">
        {GUIDE_RELATED_PAGES.map((page) => (
          <li key={page.path}>
            <Link to={page.path}>
              <span>{page.label}</span>
              <UiIcon name="chevron-right" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function GuideSearch({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  return (
    <section className="card guide-aside-card" aria-labelledby="guide-search-title">
      <h2 id="guide-search-title">{GUIDE_SEARCH.title}</h2>
      {/* biome-ignore lint/a11y/useSemanticElements: React 18 の型は <search> 要素を持たない。送信先の無い入力なので form にもしない */}
      <div role="search">
        <label className="guide-search">
          <UiIcon name="search" aria-hidden="true" />
          <input
            type="search"
            aria-label={GUIDE_SEARCH.title}
            placeholder={GUIDE_SEARCH.placeholder}
            maxLength={GUIDE_SEARCH.maxLength}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
      </div>
      <p className="sub">例：{GUIDE_SEARCH.examples.join('、')}</p>
    </section>
  );
}

export function GuideAside({
  load,
  facts,
  onRetry,
  query,
  onQuery,
}: {
  load: GuideLoad;
  facts: GuideFact[];
  onRetry: () => void;
  query: string;
  onQuery: (q: string) => void;
}) {
  return (
    <aside className="guide-aside" aria-label="このページの補足">
      <PageFacts load={load} facts={facts} onRetry={onRetry} />
      <RelatedPages />
      <GuideSearch query={query} onQuery={onQuery} />
    </aside>
  );
}
