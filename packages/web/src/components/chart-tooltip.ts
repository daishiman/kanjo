/**
 * AIレポートの図に触れたとき出る数値表示(ツールチップ)の文言。
 * - Chart.js の既定は「ラベル: 12345」のような素の数字で、画面の他の場所(用語ホバー・指標ガイド)と
 *   言葉づかいが合わない。ここで用語辞書(glossary.ts)と同じ言い方・同じ単位表記に揃える。
 * - 文字を作る部分はすべて純関数にして、Chart.js に渡すのは薄い入口だけにする(テストしやすさのため)。
 */
import type { TooltipItem } from 'chart.js';
import type { AiReportChart } from '../api.js';
import { GLOSSARY, TERM_ALIASES, type TermId } from '../glossary.js';
import { formatFinancialValue } from './figure-view-model.js';

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
 *
 * 表記そのものは figure-view-model.ts の formatFinancialValue が正本。ここで別に組み立てると
 * 同じ値が図では「1,234円」表では「¥1,234」になる。図に固有なのは「値が無い月の言い方」だけで、
 * 表は列の中の空欄なので「—」で足りるが、ツールチップは触れて初めて出るので理由まで書く。
 *
 * signed は表側(FinancialFigureSeries.signed)と同じ意味・同じ値を渡すこと。
 * 片方だけ立てると、同じ増減が図で「¥1,234」表で「+¥1,234」になる。
 */
export function tooltipValue(
  value: number | null | undefined,
  unit: AiReportChart['unit'],
  options: { signed?: boolean } = {},
): string {
  return formatFinancialValue(value, unit, {
    signed: options.signed,
    nullText: '未記帳(まだ入力していない月)',
  });
}

/** 1系列分の行。用語辞書に載っている言葉はそのまま使い、無ければ系列名を出す */
export function tooltipLine(
  label: string,
  value: number | null | undefined,
  unit: AiReportChart['unit'],
  options: { signed?: boolean } = {},
): string {
  const id = termInLabel(label);
  const name = id && !label.includes(GLOSSARY[id].term) ? `${label}(${GLOSSARY[id].term})` : label;
  return `${name}: ${tooltipValue(value, unit, options)}`;
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

/** kind ごとの読み方の差。位置引数で並べると呼び出し側で `[], []` が続いて意味が消えるので名前で渡す */
export interface TooltipConfig {
  /** 図の単位が円でも割合で読む系列名(パレート図の累積構成比など) */
  pctSeries?: readonly string[];
  /** 浮動棒の座標から符号を復元できない図(ウォーターフォール)で、builder が持つ元delta */
  signedFloatingValues?: readonly (number | null)[];
  /** 増減そのものを見る図で +/- を明示する。表の series.signed と必ず同じ値にする */
  signed?: boolean;
}

/**
 * Chart.js に渡すツールチップ設定。文言はすべて上の純関数が作る。
 */
export function tooltipOptions(unit: AiReportChart['unit'], config: TooltipConfig = {}) {
  const { pctSeries = [], signedFloatingValues = [], signed = false } = config;
  const unitOf = (label: string): AiReportChart['unit'] => (pctSeries.includes(label) ? 'pct' : unit);
  return {
    callbacks: {
      title: (items: TooltipItem<'bar' | 'line'>[]) => (items[0] ? tooltipTitle(items[0].label) : ''),
      label: (item: TooltipItem<'bar' | 'line'>) => {
        const label = item.dataset.label ?? item.label;
        return tooltipLine(label, rawValue(item, signedFloatingValues), unitOf(label), { signed });
      },
      afterBody: (items: TooltipItem<'bar' | 'line'>[]) =>
        tooltipNote(items.map((i) => i.dataset.label ?? i.label)),
    },
  };
}
