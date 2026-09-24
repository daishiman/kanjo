/**
 * 目次 (spec-guide-screen FR-4)。選んだ項目は URL の topic に持つ。
 * 幅 1024px 以上は左の縦並び、それ未満は本文の上の横スクロールのタブ (guide.css)。
 * 検索語があるときは当たった項目だけを出す。
 */
import type { GuideTopic, GuideTopicId } from './view-model.js';

export const guideTabId = (id: GuideTopicId) => `guide-tab-${id}`;
export const GUIDE_PANEL_ID = 'guide-topic-panel';

export function GuideToc({
  topics,
  current,
  onSelect,
}: {
  topics: readonly GuideTopic[];
  current: GuideTopicId;
  onSelect: (id: GuideTopicId) => void;
}) {
  return (
    <div className="guide-toc" role="tablist" aria-label="使い方ガイドの目次">
      {topics.map((topic) => (
        <button
          key={topic.id}
          type="button"
          data-native-control="tab"
          role="tab"
          id={guideTabId(topic.id)}
          aria-selected={topic.id === current}
          aria-controls={GUIDE_PANEL_ID}
          className={`guide-toc-item${topic.id === current ? ' is-active' : ''}`}
          onClick={() => onSelect(topic.id)}
        >
          {topic.label}
        </button>
      ))}
    </div>
  );
}
