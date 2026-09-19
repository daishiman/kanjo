import type { DiagnosisScreen } from '../../../api.js';

export type Scope = DiagnosisScreen['selection']['scope'];
export type Metric = DiagnosisScreen['selection']['metric'];
export type Compare = DiagnosisScreen['selection']['compare'];

export const SCOPES: readonly { id: Scope; label: string }[] = [
  { id: 'total', label: '総合' },
  { id: 'business', label: '事業' },
  { id: 'household', label: '家計' },
];

export const METRICS: readonly { id: Metric; label: string }[] = [
  { id: 'expense', label: '支出' },
  { id: 'income', label: '収入' },
  { id: 'net', label: '収支' },
];

export const METRIC_ANNUAL_LABEL: Record<Metric, string> = {
  expense: '年間支出',
  income: '年間収入',
  net: '年間純収支',
};

export const COMPARES: readonly { id: Compare; label: string }[] = [
  { id: 'previous', label: '前期間' },
  { id: 'yoy', label: '前年' },
];

/**
 * URL が持つ画面の状態。期間 (1年/2年/3年) はここに無い。
 * 期間は usePeriod が localStorage で画面間に共有しており、本サイクルでその方針を変えない。
 */
export interface UrlState {
  scope: Scope;
  metric: Metric;
  compare: Compare;
  /** 選択中の action_key。null = 未選択 */
  action: string | null;
  /** 対応済み・見送りも表に出す */
  done: boolean;
  /** 科目別プロファイルと自動診断を開く */
  stats: boolean;
}

export type Update = (patch: Partial<Record<keyof UrlState, string | null>>) => void;

/*
 * 3 段階の語彙を日本語へ写す表。表・詳細パネル・選択バーが同じ文字列を使う。
 * 色 (pill) は補助で、文字ラベルを必ず併記する (WCAG 2.2 1.4.1)。
 */
export const SEVERITY_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const SEVERITY_PILL: Record<'high' | 'medium' | 'low', string> = {
  high: 'pill alert',
  medium: 'pill warn',
  low: 'pill neutral',
};

export const EFFORT_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: '大きい',
  medium: 'ふつう',
  low: '小さい',
};

export const CONFIDENCE_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: '高い',
  medium: 'ふつう',
  low: '低い',
};

/** 改善見込みの時間軸。単発を「月額」と誤読させないため、表と詳細で共用する。 */
export const IMPACT_BASIS_LABEL: Record<DiagnosisScreen['improvements'][number]['impactBasis'], string> = {
  recurring_monthly: '月次継続',
  one_off: '単発',
};

export const STATUS_PILL: Record<string, string> = {
  未着手: 'pill neutral',
  対応中: 'pill warn',
  対応済み: 'pill calm',
  見送り: 'pill neutral',
};

export const TONE_PILL: Record<'alert' | 'watch' | 'good', string> = {
  alert: 'pill alert',
  watch: 'pill warn',
  good: 'pill calm',
};

export const TONE_LABEL: Record<'alert' | 'watch' | 'good', string> = {
  alert: '要対応',
  watch: '注視',
  good: '良好',
};
