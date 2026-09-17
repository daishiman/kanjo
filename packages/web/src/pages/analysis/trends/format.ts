import type { TrendRow } from '../../../api.js';

export const DIRECTION_CLS: Record<TrendRow['direction'], string> = {
  増加: 'pill alert',
  減少: 'pill calm',
  横ばい: 'pill neutral',
  判定不可: 'pill neutral',
};

export const ACTION_CLS: Record<TrendRow['action'], string> = {
  削減を検討: 'pill alert',
  記録を整える: 'pill warn',
  継続監視: 'pill warn',
  対応不要: 'pill neutral',
};

export function signedYen(value: number | null | undefined): string {
  if (value == null) return '—';
  const amount = Math.abs(Math.round(value)).toLocaleString('ja-JP');
  if (value === 0) return `${amount} 円 (増減なし)`;
  return value > 0 ? `+${amount} 円 (増)` : `−${amount} 円 (減)`;
}

export type ChangeTone = 'favorable' | 'unfavorable' | 'neutral';

/** 符号そのものでなく、指標の「増える/減ると良い」との組み合わせで意味色を決める。 */
export function changeTone(
  value: number | null | undefined,
  betterWhen: 'higher' | 'lower' | 'neutral' | undefined,
): ChangeTone {
  if (value == null || value === 0 || !betterWhen || betterWhen === 'neutral') return 'neutral';
  const favorable = betterWhen === 'higher' ? value > 0 : value < 0;
  return favorable ? 'favorable' : 'unfavorable';
}

export function changeClass(
  value: number | null | undefined,
  betterWhen: 'higher' | 'lower' | 'neutral' | undefined,
): string {
  const tone = changeTone(value, betterWhen);
  if (tone === 'favorable') return 'neg';
  if (tone === 'unfavorable') return 'pos';
  return '';
}

export const sideLabel = (side: 'business' | 'household') => (side === 'business' ? '事業' : '家計');

export const drilldownLabel = (origin: 'mf' | 'freee' | 'mixed'): string =>
  origin === 'freee' ? '総収支で確認' : '該当明細を開く';

export const recommendedDrilldownLabel = (category: string, origin: 'mf' | 'freee' | 'mixed'): string =>
  origin === 'freee' ? `${category}を総収支で確認` : `${category}の該当明細を開く`;
