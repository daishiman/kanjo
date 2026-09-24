/**
 * 目次で選んだトピックの本文 (spec-guide-screen FR-5〜FR-8・FR-14・FR-15)。
 * 文言はすべて core の定数。数値 (総収支・ステッパーの進捗) だけが /api/guide の応答に依存する。
 * 画像どおり、『月次の流れ』では流れの下に総収支の読み方までを続けて出す。
 */
import { yen } from '../../format.js';
import { GuideTerms } from './GuideTerms.js';
import { GUIDE_FAILED_TEXT, type GuideLoad, GuideValue } from './GuideValue.js';
import {
  GUIDE_FLOW_LEAD,
  GUIDE_INCLUDES,
  GUIDE_PERIOD_TABLE,
  GUIDE_TOPIC_BODY,
  GUIDE_TOTALS_LABELS,
  GUIDE_TOTALS_LEAD,
  type GuideScreen,
  type GuideTopicId,
  guideFlowStages,
  guideTopic,
  signedYen,
} from './view-model.js';

function FlowSection({ load, screen }: { load: GuideLoad; screen: GuideScreen | undefined }) {
  // 読めた応答で進捗が無い (データ 0 件) ときは未完了。null は読込中・失敗のときだけ残す
  const stages =
    load === 'ready'
      ? guideFlowStages(screen?.closeStatus).map((stage) => ({ ...stage, done: stage.done ?? false }))
      : guideFlowStages(null);
  return (
    <section className="guide-section" aria-labelledby="guide-flow-title">
      <h3 id="guide-flow-title">月次の流れ</h3>
      <p className="sub">{GUIDE_FLOW_LEAD}</p>
      <ol className="guide-stepper" aria-busy={load === 'loading'}>
        {stages.map((stage, index) => (
          <li
            key={stage.label}
            className={`guide-stepper-item${stage.done ? ' is-done' : ''}${stage.done === null ? ' is-unknown' : ''}`}
          >
            <span className="guide-stepper-dot" aria-hidden="true">
              {stage.done ? '✓' : index + 1}
            </span>
            <span className="guide-stepper-label">{stage.label}</span>
            <span className="guide-stepper-state">
              {stage.done === null
                ? load === 'loading' && <GuideValue load="loading">{() => null}</GuideValue>
                : stage.done
                  ? '完了'
                  : '未完了'}
            </span>
          </li>
        ))}
      </ol>
      {load === 'error' && <p className="sub guide-failed">進捗を{GUIDE_FAILED_TEXT}</p>}
    </section>
  );
}

function TotalsSection({ load, screen }: { load: GuideLoad; screen: GuideScreen | undefined }) {
  const totals = screen?.totals;
  const card = (label: string, value: () => string, tone?: string) => (
    <div className={`guide-total${tone ? ` ${tone}` : ''}`}>
      <span className="guide-total-label">{label}</span>
      <strong className="guide-total-value">
        <GuideValue load={load}>{value}</GuideValue>
      </strong>
    </div>
  );
  return (
    <section className="guide-section" aria-labelledby="guide-totals-title">
      <h3 id="guide-totals-title">総収支の読み方</h3>
      <p className="sub">{GUIDE_TOTALS_LEAD}</p>
      <div className="guide-totals">
        {card(GUIDE_TOTALS_LABELS.income, () => yen(totals?.income ?? 0))}
        <span className="guide-totals-op" aria-hidden="true">
          −
        </span>
        {card(GUIDE_TOTALS_LABELS.expense, () => yen(totals?.expense ?? 0))}
        <span className="guide-totals-op" aria-hidden="true">
          =
        </span>
        {card(GUIDE_TOTALS_LABELS.net, () => signedYen(totals?.net ?? 0), 'is-net')}
      </div>
      <ul className="guide-includes">
        {GUIDE_INCLUDES.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <span className="sub">{item.text}</span>
          </li>
        ))}
      </ul>
      <h4 className="guide-period-title">{GUIDE_PERIOD_TABLE.title}</h4>
      <div className="scroll-x">
        <table
          className="data guide-period-table"
          data-table-kind="comparison"
          data-sort-reason="期間タブ4種の表示の違いを、タブと同じ順に比べる表"
        >
          <thead>
            <tr>
              {GUIDE_PERIOD_TABLE.columns.map((column) => (
                <th key={column} scope="col" className="left">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GUIDE_PERIOD_TABLE.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td className="left">{row.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TextSection({ topic }: { topic: GuideTopicId }) {
  const current = guideTopic(topic);
  return (
    <section className="guide-section" aria-labelledby={`guide-${topic}-title`}>
      <h3 id={`guide-${topic}-title`}>{current.label}</h3>
      {GUIDE_TOPIC_BODY[topic].map((text) => (
        <p key={text}>{text}</p>
      ))}
    </section>
  );
}

export function GuideTopicBody({
  topic,
  load,
  screen,
}: {
  topic: GuideTopicId;
  load: GuideLoad;
  screen: GuideScreen | undefined;
}) {
  if (topic === 'flow')
    return (
      <>
        <FlowSection load={load} screen={screen} />
        <TotalsSection load={load} screen={screen} />
      </>
    );
  if (topic === 'totals') return <TotalsSection load={load} screen={screen} />;
  if (topic === 'terms')
    return (
      <section className="guide-section" aria-labelledby="guide-terms-title">
        <h3 id="guide-terms-title">{guideTopic('terms').label}</h3>
        <p className="sub">{GUIDE_TOPIC_BODY.terms[0]}</p>
        <GuideTerms />
      </section>
    );
  return <TextSection topic={topic} />;
}
