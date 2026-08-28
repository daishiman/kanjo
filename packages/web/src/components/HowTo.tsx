/**
 * 図・表の見方(figure-guides.ts の1件)を、図の「上」に3行で出す。
 *
 * 説明を図の下に置くと、読み手は数字を眺めて分からないまま次のカードへ行ってしまう。
 * 先に「何を見る図か」を1行渡してから図を見せるほうが、同じ文章でも伝わる。
 *
 * 3行のラベルは全図で固定(何を表す → どこを見る → 次の一手)。
 * 位置が同じなら、2枚目以降は必要な行だけ拾い読みできる。
 */
import { FIGURE_GUIDES, type FigureId } from '../figure-guides.js';

const LABELS = ['何を表す', 'どこを見る', '次の一手'] as const;

export function HowTo({ id }: { id: FigureId }) {
  const g = FIGURE_GUIDES[id];
  const rows = [g.shows, g.read, g.act];
  return (
    <dl className="howto">
      {rows.map((text, i) => (
        <div key={LABELS[i]} className="howto-row">
          <dt>{LABELS[i]}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}
