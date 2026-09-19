const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_TEXT_LENGTH = 200;

/** 診断から渡る絞り込み値。空・長すぎる値は利用者入力として扱わない。 */
export function targetText(params: URLSearchParams, name: string): string | null {
  const value = params.get(name)?.trim();
  return value && value.length <= MAX_TEXT_LENGTH ? value : null;
}

/** 実在する候補だけを採用する。表記ゆれを増やさず、受信側の正本へ寄せる。 */
export function targetChoice(
  params: URLSearchParams,
  name: string,
  choices: readonly string[],
): string | null {
  const value = targetText(params, name);
  if (!value) return null;
  const normalized = value.normalize('NFKC').toLocaleLowerCase('ja');
  return choices.find((choice) => choice.normalize('NFKC').toLocaleLowerCase('ja') === normalized) ?? null;
}

export function targetMonth(params: URLSearchParams, choices: readonly string[]): string | null {
  const value = targetText(params, 'month');
  return value && MONTH_PATTERN.test(value) && choices.includes(value) ? value : null;
}

export function targetAmount(params: URLSearchParams): number | null {
  const raw = targetText(params, 'amount');
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
