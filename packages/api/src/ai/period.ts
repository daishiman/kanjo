/**
 * レポートの期間(開始年月〜終了年月)の表現と、型(月次/年次/長期)の決まり方。
 * contract.ts と catalog.ts の両方が使うため、循環参照を避けて独立させている。
 */
import { z } from 'zod';

/** レポートの型。期間の長さから機械的に決まる(利用者に選ばせない) */
export type ReportType = 'monthly' | 'annual' | 'longterm';

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  monthly: '月次',
  annual: '年次',
  longterm: '長期',
};

/** 1画面の説明文に使う、型の決まり方 */
export const REPORT_TYPE_RULE = '1ヶ月=月次 / 2〜13ヶ月=年次(四半期を含む) / 14ヶ月以上=長期';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 受け付ける最長期間(月数)。過去5年+当月 */
export const MAX_RANGE_MONTHS = 61;

export interface Period {
  from: string;
  to: string;
}

/** YYYY-MM の通し番号(月差の計算用) */
export const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
export const monthFromIndex = (i: number): string =>
  `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
export const addMonths = (m: string, n: number): string => monthFromIndex(monthIndex(m) + n);

export function rangeMonths(p: Period): string[] {
  const out: string[] = [];
  for (let i = monthIndex(p.from); i <= monthIndex(p.to); i++) out.push(monthFromIndex(i));
  return out;
}

export function rangeLength(p: Period): number {
  return monthIndex(p.to) - monthIndex(p.from) + 1;
}

export function reportTypeOf(p: Period): ReportType {
  const n = rangeLength(p);
  if (n <= 1) return 'monthly';
  if (n <= 13) return 'annual';
  return 'longterm';
}

export const periodSchema = z
  .object({
    from: z.string().regex(MONTH_RE, '開始年月は YYYY-MM で指定してください'),
    to: z.string().regex(MONTH_RE, '終了年月は YYYY-MM で指定してください'),
  })
  .refine((p) => monthIndex(p.from) <= monthIndex(p.to), {
    message: '開始年月が終了年月より後になっています',
  })
  .refine((p) => rangeLength(p) <= MAX_RANGE_MONTHS, {
    message: `期間は最長${MAX_RANGE_MONTHS}ヶ月(過去5年+当月)までです`,
  });

/** 依頼の作成(期間 + 任意の補足情報 + 再分析元のレポート) */
export const taskCreateSchema = periodSchema.and(
  z.object({
    supplement: z.string().max(4000).optional(),
    parentReportId: z.string().max(64).optional(),
  }),
);

const monthJa = (m: string): string => `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月`;

export function periodLabel(p: Period): string {
  const n = rangeLength(p);
  const type = REPORT_TYPE_LABEL[reportTypeOf(p)];
  if (n === 1) return `${monthJa(p.from)}(${type})`;
  return `${monthJa(p.from)}〜${monthJa(p.to)}(${n}ヶ月・${type})`;
}

/**
 * 旧データ(period_kind=month/year, period_key)から期間を復元する。
 * マイグレーション 0004 で列は埋めるが、念のため画面側でも同じ規則で解釈できるようにしておく。
 */
export function legacyPeriod(kind: string, key: string): Period {
  if (kind === 'year') return { from: `${key}-01`, to: `${key}-12` };
  return { from: key, to: key };
}
