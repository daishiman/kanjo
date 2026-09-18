import type { BalanceSheet } from '../api.js';

/** 純資産まで確定している最新月。未入力の負債を0円に見せない。 */
export function latestCompleteBalance(data: BalanceSheet) {
  for (let index = data.months.length - 1; index >= 0; index -= 1) {
    const month = data.months[index];
    if (month?.netAssets !== null) return month ?? null;
  }
  return null;
}
