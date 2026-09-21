/**
 * レポートの「背景仮説」タブ (spec-ai-analysis-screen FR-11)。
 *
 * 統計的事実 → 解釈 → 因果仮説の 3 層をこの順で出す。断定できるのは最初の層だけなので、
 * 層を混ぜずに並べること自体が「どこまでが事実か」の表示になる。
 */
import type { AiReportDetailResponse } from '../../api.js';

const QUESTION_TYPE_LABEL: Record<
  NonNullable<AiReportDetailResponse['report']['body']['contextAnalysis']>['questionType'],
  string
> = {
  distribution: '分布',
  comparison: '比較',
  relationship: '関係',
  decomposition: '分解',
  trend: '推移',
  concentration: '集中',
  anomaly: '異常',
};

const CONFIDENCE_LABEL = { low: '低', medium: '中', high: '高' } as const;
const EVIDENCE_LEVEL_LABEL = {
  data_confirmed: '主な根拠: 取込データ',
  user_reported: '主な根拠: 利用者回答',
  published_source: '主な根拠: 公表資料',
  assumption: '主な根拠: 想定',
} as const;

/** 支持・反証・別の説明候補は同じ「見出し + 箇条書き」。3 回書き写さずここで揃える */
function EvidenceGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

export function AiContextAnalysis({ body }: { body: AiReportDetailResponse['report']['body'] }) {
  const context = body.contextAnalysis;
  if (!context) {
    return (
      <section className="report-section">
        <h4>背景仮説</h4>
        <p className="sub">この版は背景仮説の契約追加前に作られたため、記録がありません。</p>
      </section>
    );
  }
  const sources = new Map(context.externalEvidence.map((source) => [source.id, source]));
  return (
    <>
      <section className="report-section">
        <h4>分析の問い</h4>
        <p className="sub">
          {QUESTION_TYPE_LABEL[context.questionType]}の視点 ·{' '}
          {context.externalResearch === 'used' ? '外部調査あり' : '取込データだけ'}
        </p>
        <dl className="ai-context-question">
          <div>
            <dt>決めたいこと</dt>
            <dd>{context.question.decision || '記録なし'}</dd>
          </div>
          <div>
            <dt>見る指標</dt>
            <dd>{context.question.metric || '記録なし'}</dd>
          </div>
          <div>
            <dt>比べる対象</dt>
            <dd>{context.question.comparison || '記録なし'}</dd>
          </div>
          <div>
            <dt>対象範囲</dt>
            <dd>{context.question.range || '記録なし'}</dd>
          </div>
        </dl>
      </section>

      <section className="report-section">
        <h4>ヒアリングで確認した事実</h4>
        {context.interviewFacts.length === 0 ? (
          <p className="sub">追加の回答はありません。未回答でも分析は続けられます。</p>
        ) : (
          <dl className="ai-context-facts">
            {context.interviewFacts.map((fact, index) => (
              <div key={`${index}-${fact.question}`}>
                <dt>{fact.question}</dt>
                <dd>{fact.answer}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="report-section">
        <h4>統計的事実</h4>
        {context.statisticalFacts.length === 0 ? (
          <p className="sub">分けて示せる統計的事実はありません。</p>
        ) : (
          <ol className="ai-context-layer-list">
            {context.statisticalFacts.map((fact) => (
              <li key={fact.id}>
                <strong>{fact.statement}</strong>
                <p className="sub">計算根拠: {fact.basis}</p>
                <p className="sub">参照: {fact.evidenceRefs.join(' / ')}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="report-section">
        <h4>解釈</h4>
        {context.interpretations.length === 0 ? (
          <p className="sub">統計的事実から分けて示せる解釈はありません。</p>
        ) : (
          <ol className="ai-context-layer-list">
            {context.interpretations.map((interpretation, index) => (
              <li key={`${index}-${interpretation.statement}`}>
                <strong>{interpretation.statement}</strong>
                <p className="sub">根拠の事実: {interpretation.factRefs.join(' / ')}</p>
                <p>限界: {interpretation.limitation}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="report-section">
        <h4>背景の仮説と反証</h4>
        <p className="sub lede">ここに出すのは因果の断定ではなく、関連から組み立てた未検証の仮説です。</p>
        {context.causalHypotheses.length === 0 ? (
          <p className="sub">根拠を分けて示せる背景仮説はありません。</p>
        ) : (
          <ol className="ai-causal-list">
            {context.causalHypotheses.map((hypothesis, index) => (
              <li key={`${index}-${hypothesis.hypothesis}`}>
                <header>
                  <strong>
                    {hypothesis.role === 'primary' ? '主仮説' : '対立仮説'}: {hypothesis.hypothesis}
                  </strong>
                  <span className="pill neutral">確度 {CONFIDENCE_LABEL[hypothesis.confidence]}</span>
                  <span className="pill neutral">{EVIDENCE_LEVEL_LABEL[hypothesis.evidenceLevel]}</span>
                </header>
                <div className="ai-causal-flow" aria-label="未検証の因果の流れ">
                  <span>
                    <small>背景</small>
                    {hypothesis.cause || hypothesis.hypothesis}
                  </span>
                  <span className="ai-causal-arrow" aria-hidden="true" />
                  <span>
                    <small>作用経路</small>
                    {hypothesis.mechanism || '未確認'}
                  </span>
                  <span className="ai-causal-arrow" aria-hidden="true" />
                  <span>
                    <small>観測指標</small>
                    {hypothesis.outcome || '会計指標との関連'}
                  </span>
                </div>
                <dl className="ai-causal-evidence">
                  <EvidenceGroup label="支持する情報" items={hypothesis.evidenceFor} />
                  <EvidenceGroup label="反証・限界" items={hypothesis.evidenceAgainst} />
                  <EvidenceGroup label="別の説明候補" items={hypothesis.confounders} />
                  <div>
                    <dt>仮説が崩れる条件</dt>
                    <dd>{hypothesis.falsificationCondition}</dd>
                  </div>
                  <div>
                    <dt>次に確認すること</dt>
                    <dd>{hypothesis.validationAction}</dd>
                  </div>
                </dl>
                {hypothesis.evidenceRefs.length > 0 && (
                  <p className="sub">
                    参照:{' '}
                    {hypothesis.evidenceRefs.map((reference, refIndex) => {
                      const source = sources.get(reference);
                      return source ? (
                        <span key={reference}>
                          {refIndex > 0 ? ' / ' : ''}
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>
                        </span>
                      ) : (
                        <span key={reference}>
                          {refIndex > 0 ? ' / ' : ''}
                          {reference}
                        </span>
                      );
                    })}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="report-section">
        <h4>外部情勢の出典</h4>
        {context.externalResearch === 'off' ? (
          <p className="sub">外部調査はOFFです。外部情報を補わず、取込データだけで分析しています。</p>
        ) : (
          <ul className="ai-source-list">
            {context.externalEvidence.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <p>{source.claim}</p>
                <p className="sub">
                  関連: {source.relevance} / 取得日: {source.accessedAt}
                  {source.publishedAt ? ` / 公表: ${source.publishedAt}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="notice info">
          外部情報は背景仮説の材料です。金額・科目の事実は取込データのみを根拠にしています。
        </p>
      </section>
    </>
  );
}
