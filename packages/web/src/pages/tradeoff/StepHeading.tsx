/**
 * 1〜3 の作業の見出し。番号の見た目と読み上げを分け、各カードで構造を複製しない。
 */
export function StepHeading({
  id,
  number,
  title,
  qualifier,
  description,
}: {
  id: string;
  number: 1 | 2 | 3;
  title: string;
  qualifier?: string;
  description: string;
}) {
  return (
    <header className="tradeoff-step-heading">
      <h2 id={id}>
        <span className="visually-hidden">{number}. </span>
        <span className="tradeoff-step-number" aria-hidden="true">
          {number}
        </span>
        <span>{title}</span>
        {qualifier && <span className="tradeoff-step-qualifier">{qualifier}</span>}
      </h2>
      <p>{description}</p>
    </header>
  );
}
