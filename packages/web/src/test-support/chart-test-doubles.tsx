interface ChartDoubleProps {
  'aria-label'?: string;
}

/** ChartのDOMを検証しないテスト用。呼び出し側が明示的に選ぶ。 */
export function SilentChart() {
  return null;
}

/** Chartのアクセシブル名だけを検証するテスト用。 */
export function AccessibleChart({ 'aria-label': ariaLabel }: ChartDoubleProps) {
  return <div role="img" aria-label={ariaLabel} />;
}
