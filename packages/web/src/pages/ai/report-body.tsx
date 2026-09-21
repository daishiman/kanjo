/**
 * レポート本文の表示部品 (旧 pages/Ai.tsx から移設。中身は変えていない)。
 * 要点カード・項目表・図番号リンク・本文の段落整形を、詳細の各タブが共有する。
 */
import type { AiAnalysisDepth } from '@kanjo/core';
import { Fragment, type ReactNode } from 'react';
import type { AiFindingKey, AiReportFinding, AiReportItem } from '../../api.js';
import { DataTable } from '../../components/DataTable.js';
import { linkTerms } from '../../components/Term.js';
import { yen } from '../../format.js';

export const PRIORITY: Record<string, { cls: string; label: string }> = {
  high: { cls: 'pill alert', label: '優先 高' },
  mid: { cls: 'pill warn', label: '優先 中' },
  low: { cls: 'pill neutral', label: '優先 低' },
};

export const FINDING_KEYS: AiFindingKey[] = ['improvements', 'wasted', 'quickWins'];

/** 一覧の「要点1行」: 総評の最初の1文(長ければ切る) */
export const firstLine = (text: string, max = 70): string => {
  const one = text.split('\n').find((l) => l.trim()) ?? '';
  const m = /^(.*?[。!?])/.exec(one);
  const t = (m ? m[1] : one).trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

/**
 * 要点カードで最初から見せる部分と、<details>「根拠と詳しい説明」へ畳む部分の境界を決める。
 * true = 常時表示、false = 畳む。
 *
 * 認知負荷はここでほぼ決まる。6件すべてが 事実+根拠+解釈+次の一手 を全展開すると、
 * 「まず何をすればいいか」が本文の量に埋もれる。逆に畳みすぎると、
 * AIの主張を数字で確かめられなくなり、レポートへの信頼が下がる。
 */
function findingDisclosure(depth: AiAnalysisDepth): {
  fact: boolean;
  basis: boolean;
  interpretation: boolean;
  action: boolean;
} {
  // 段階開示。1件あたり4段落を常に出すと、10件で40段落を一度に読むことになる。
  // 読み手が次の行動を決めるのに要るのは「何が起きたか(fact)」と「どうするか(action)」で、
  // 「どのキーから計算したか(basis)」は検算のときだけ要るので既定で畳む。
  // interpretation はその中間なので、優先度 high の要点だけ最初から見せる。
  return {
    fact: true,
    basis: depth === 'detailed',
    interpretation: depth !== 'concise',
    action: true,
  };
}

export function FindingList({
  title,
  items,
  note,
  depth,
}: { title: string; items: AiReportFinding[]; note: string; depth: AiAnalysisDepth }) {
  return (
    <div className="finding">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="sub">なし{note ? `: ${note}` : ''}</p>
      ) : (
        <ol className="finding-cards">
          {items.map((it, i) => {
            const show = findingDisclosure(depth);
            const folded: { term: string; node: ReactNode }[] = [];
            if (!show.fact) folded.push({ term: '事実', node: <Prose text={it.fact} /> });
            if (!show.basis) folded.push({ term: '根拠', node: linkTerms(it.basis) });
            if (!show.interpretation) folded.push({ term: '解釈', node: <Prose text={it.interpretation} /> });
            if (!show.action) folded.push({ term: '次の一手', node: linkFigures(it.action) });
            if (!show.action && it.expectedEffect != null)
              folded.push({ term: '期待効果', node: <span className="num">{yen(it.expectedEffect)}</span> });
            return (
              <li key={`${i}-${it.label}`} className="finding-card">
                <div className="finding-head">
                  <span className="finding-label">{it.label}</span>
                  {it.priority && (
                    <span className={PRIORITY[it.priority].cls}>{PRIORITY[it.priority].label}</span>
                  )}
                  {it.amount != null && <span className="num finding-amount">{yen(it.amount)}</span>}
                </div>
                {show.fact && (
                  <div className="finding-part">
                    <span className="finding-tag">事実</span>
                    <Prose text={it.fact} className="finding-fact" />
                  </div>
                )}
                {show.basis && <p className="finding-basis">{linkTerms(it.basis)}</p>}
                {show.interpretation && (
                  <div className="finding-part">
                    <span className="finding-tag">解釈</span>
                    <Prose text={it.interpretation} className="finding-interp" />
                  </div>
                )}
                {show.action && (
                  <p className="finding-action">
                    <span className="finding-action__tag">次の一手</span>
                    {linkFigures(it.action)}
                    {it.expectedEffect != null && (
                      <span className="finding-effect">
                        期待効果 <span className="num">{yen(it.expectedEffect)}</span>
                      </span>
                    )}
                  </p>
                )}
                {folded.length > 0 && (
                  <details className="finding-more">
                    <summary>根拠と詳しい説明</summary>
                    <dl className="finding-steps">
                      {folded.map((f) => (
                        <Fragment key={f.term}>
                          <dt>{f.term}</dt>
                          <dd>{f.node}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function ItemTable({ items }: { items: AiReportItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="scroll-x">
      <DataTable
        className="data ai-table report-item-table"
        columns={['項目', { label: '金額(円)', className: 'num' }, '優先度', '補足']}
      >
        {items.map((it, i) => (
          <tr key={`${i}-${it.label}`}>
            <td className="wrap">{it.label}</td>
            <td className="num">{it.amount == null ? '—' : yen(it.amount)}</td>
            <td>
              {it.priority ? (
                <span className={PRIORITY[it.priority].cls}>{PRIORITY[it.priority].label}</span>
              ) : (
                ''
              )}
            </td>
            <td className="wrap">{it.note}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

/** 本文中の「図N」を図へのリンクにし、残りは用語ホバー化する */
export function linkFigures(text: string): ReactNode[] {
  const parts = text.split(/(図\d+)/);
  return parts.map((p, i) => {
    const m = /^図(\d+)$/.exec(p);
    if (m)
      return (
        <a key={`f-${i}-${p}`} href={`#fig-${m[1]}`} className="figure-ref">
          {p}
        </a>
      );
    return <span key={`t-${i}-${p.slice(0, 8)}`}>{linkTerms(p)}</span>;
  });
}

/** プレーンテキストを段落と「- 」箇条書きに整えて表示する(HTMLとしては解釈しない) */
// 日本語の分析文は「。」ごとに1論点で書かれていることが多い。段落のまま流すとその
// 区切りが消えて「文章の羅列」になるので、文へ割って1行ずつ並べる。
// 「(58.2%)。」のような閉じ括弧は前の文に残す(次の行の頭へ飛ばさない)。
const SENTENCE_SPLIT = /(?<=。)(?![)）」』】])/;
// 2文までは段落のほうが素直に読める。3文以上から構造化する
const SENTENCE_MIN = 3;

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 地の文を1文1行へ割って並べる。2文以下なら段落のまま返す。
 * レポート側が箇条書き(行頭「- 」)で書いていればそちらが優先で、ここは通らない。
 */
function Prose({
  text,
  className,
  render = linkFigures,
}: {
  text: string;
  className?: string;
  render?: (s: string) => ReactNode;
}) {
  const parts = splitSentences(text);
  if (parts.length < SENTENCE_MIN) return <p className={className}>{render(text)}</p>;
  return (
    <ul className={className ? `prose-lines ${className}` : 'prose-lines'}>
      {parts.map((s, i) => (
        <li key={`${i}-${s}`}>{render(s)}</li>
      ))}
    </ul>
  );
}

export function ReportText({ text }: { text: string }) {
  const blocks: { kind: 'p' | 'ul'; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      if (blocks.length && blocks[blocks.length - 1].lines.length) blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const li = /^[-・*]\s*(.+)$/.exec(line.trim());
    const last = blocks[blocks.length - 1];
    if (li) {
      if (last && last.kind === 'ul') last.lines.push(li[1]);
      else blocks.push({ kind: 'ul', lines: [li[1]] });
    } else if (last && last.kind === 'p') last.lines.push(line);
    else blocks.push({ kind: 'p', lines: [line] });
  }
  // 箇条書きを持つ本文の段落はリード文なので割らない。持たない本文(箇条書き規約より
  // 前に作られたレポート)だけを文へ割って、地の文の塊にならないようにする。
  const hasBullets = blocks.some((bl) => bl.kind === 'ul' && bl.lines.length);
  return (
    <div className="report-text">
      {blocks
        .filter((bl) => bl.lines.length)
        .map((bl, i) =>
          bl.kind === 'ul' ? (
            <ul key={`ul-${i}-${bl.lines[0]}`}>
              {bl.lines.map((l, j) => (
                <li key={`${j}-${l}`}>{linkFigures(l)}</li>
              ))}
            </ul>
          ) : hasBullets ? (
            <p key={`p-${i}-${bl.lines[0]}`}>{linkFigures(bl.lines.join('\n'))}</p>
          ) : (
            <Prose key={`p-${i}-${bl.lines[0]}`} text={bl.lines.join('\n')} />
          ),
        )}
    </div>
  );
}
