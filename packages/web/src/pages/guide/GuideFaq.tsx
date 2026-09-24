/**
 * よくある疑問と対処法 (spec-guide-screen FR-12)。全幅で 5 行を出す。
 * 信頼度と防衛ラインの「確認の条件」は core の定数から組んだ文 (GUIDE_FAQ が正本)。
 */
import { Link } from 'react-router-dom';
import { GUIDE_FAQ, type GuideFaqRow, guideOpenLabel } from './view-model.js';

export function GuideFaq({ rows }: { rows: readonly GuideFaqRow[] }) {
  const [question, source, condition, related] = GUIDE_FAQ.columns;
  return (
    <section className="card guide-faq" aria-labelledby="guide-faq-title">
      <h2 id="guide-faq-title">{GUIDE_FAQ.title}</h2>
      <p className="sub">{GUIDE_FAQ.lead}</p>
      {rows.length === 0 ? (
        <p className="sub guide-faq-none">検索語に当たる疑問はありません。</p>
      ) : (
        <div className="scroll-x">
          <table
            className="data stack-sm guide-faq-table"
            data-table-kind="workflow"
            data-sort-reason="疑問ごとに確認の手順を並べた一覧で、行の順は画面の案内順を保つ"
          >
            <thead>
              <tr>
                <th scope="col" className="left">
                  {question}
                </th>
                <th scope="col" className="left">
                  {source}
                </th>
                <th scope="col" className="left">
                  {condition}
                </th>
                <th scope="col" className="left">
                  {related}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="guide-faq-question">
                    <strong>{row.question}</strong>
                    <span className="sub">{row.note}</span>
                  </th>
                  <td data-label={source}>{row.source}</td>
                  <td data-label={condition}>{row.condition}</td>
                  <td data-label={related}>
                    <Link to={row.destination.path}>{guideOpenLabel(row.destination)} →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
