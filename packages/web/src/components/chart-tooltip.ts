/**
 * AIレポートの図に触れたとき出る数値表示(ツールチップ)の文言。
 * - Chart.js の既定は「ラベル: 12345」のような素の数字で、画面の他の場所(用語ホバー・指標ガイド)と
 *   言葉づかいが合わない。ここで用語辞書(glossary.ts)と同じ言い方・同じ単位表記に揃える。
 * - 文字を作る部分はすべて純関数にして、Chart.js に渡すのは薄い入口だけにする(テストしやすさのため)。
 */
import type { TooltipItem } from 'chart.js';
import type { AiReportChart } from '../api.js';
import { GLOSSARY, TERM_ALIASES, type TermId } from '../glossary.js';

/** 系列名・軸ラベルから用語辞書の項目を引く(表記ゆれは TERM_ALIASES が吸収する) */
export function termInLabel(label: string): TermId | null {
  if (!label) return null;
  const hit = TERM_ALIASES.find((a) => label.includes(a.text));
  return hit ? hit.id : null;
}

/** 期間ラベルを日本語に開く。2026-01 →「2026年1月」/ 2026-Q1 →「2026年 第1四半期」 */
export function tooltipTitle(label: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(label);
  if (q) return `${q[1]}年 第${q[2]}四半期`;
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (m) return `${m[1]}年${Number(m[2])}月`;
  return label;
}

/**
 * 金額・割合の表記。
 * 軸の目盛りは「12万」のように丸めるが、触れたときは正確な値を知りたいので円単位まで出す。
 */
export function tooltipValue(value: number | null | undefined, unit: AiReportChart['unit']): string {
  if (value == null || Number.isNaN(value)) return '未記帳(まだ入力していない月)';
  if (unit === 'pct') return `${(Math.round(value * 1000) / 10).toLocaleString('ja-JP')}%`;
  if (unit === 'count') return `${value.toLocaleString('ja-JP')}件`;
  return `${Math.round(value).toLocaleString('ja-JP')}円`;
}

/** 1系列分の行。用語辞書に載っている言葉はそのまま使い、無ければ系列名を出す */
export function tooltipLine(
  label: string,
  value: number | null | undefined,
  unit: AiReportChart['unit'],
): string {
  const id = termInLabel(label);
  const name = id && !label.includes(GLOSSARY[id].term) ? `${label}(${GLOSSARY[id].term})` : label;
  return `${name}: ${tooltipValue(value, unit)}`;
}

/** 触れた系列に用語があれば、用語ホバーと同じ説明文を下に添える(最大1件で読みやすさを保つ) */
export function tooltipNote(labels: string[]): string[] {
  for (const l of labels) {
    const id = termInLabel(l);
    if (id) return [GLOSSARY[id].short];
  }
  return [];
}

/**
 * Chart.js の座標値を表示値へ戻す。
 * ウォーターフォールの負寄与は描画上 [低い座標, 高い座標] に並べ替えるため、
 * 座標差では符号を復元できない。builder が持つ元deltaを優先する。
 */
export function chartTooltipValue(
  raw: number | [number, number] | null | undefined,
  signedFloatingValue?: number | null,
): number | null {
  if (signedFloatingValue != null) return signedFloatingValue;
  if (Array.isArray(raw)) return raw[1] - raw[0];
  return raw == null ? null : Number(raw);
}

const rawValue = (
  item: TooltipItem<'bar' | 'line'>,
  signedFloatingValues: readonly (number | null)[],
): number | null =>
  chartTooltipValue(
    item.raw as number | [number, number] | null | undefined,
    signedFloatingValues[item.dataIndex],
  );

/**
 * Chart.js に渡すツールチップ設定。文言はすべて上の純関数が作る。
 * pctSeries には、図の単位が円でも割合で読む系列名(パレート図の累積構成比など)を渡す。
 */
export function tooltipOptions(
  unit: AiReportChart['unit'],
  pctSeries: readonly string[] = [],
  signedFloatingValues: readonly (number | null)[] = [],
) {
  const unitOf = (label: string): AiReportChart['unit'] => (pctSeries.includes(label) ? 'pct' : unit);
  return {
    callbacks: {
      title: (items: TooltipItem<'bar' | 'line'>[]) => (items[0] ? tooltipTitle(items[0].label) : ''),
      label: (item: TooltipItem<'bar' | 'line'>) => {
        const label = item.dataset.label ?? item.label;
        return tooltipLine(label, rawValue(item, signedFloatingValues), unitOf(label));
      },
      afterBody: (items: TooltipItem<'bar' | 'line'>[]) =>
        tooltipNote(items.map((i) => i.dataset.label ?? i.label)),
    },
  };
}
