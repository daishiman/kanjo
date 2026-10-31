/**
 * 画面下の固定バー (spec-guide-screen FR-13)。
 * 左に「現在のトピック {名前}」、右に現在のトピックに対応する元画面へのリンク「{画面名}を開く →」。
 */
import { Link } from 'react-router-dom';
import { type GuideTopicId, guideOpenLabel, guideTopic } from './view-model.js';

export function GuideBottomBar({ topic }: { topic: GuideTopicId }) {
  const current = guideTopic(topic);
  return (
    <div className="guide-bottom-bar">
      <p className="guide-bottom-topic">
        <span className="sub">現在のトピック</span>
        <strong>{current.label}</strong>
      </p>
      <Link className="btn primary" to={current.destination.path}>
        {guideOpenLabel(current.destination)} →
      </Link>
    </div>
  );
}
