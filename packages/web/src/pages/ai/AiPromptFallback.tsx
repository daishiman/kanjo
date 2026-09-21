/**
 * clipboard へ書けなかったときの逃げ道 (spec-ai-analysis-screen FR-3)。
 *
 * 依頼・再実行・詳細の 3 か所が同じ形を必要とするので 1 つにまとめる。
 * ここに出た時点では「コピー済み」と記録しない (利用者が自分で選んで写すため)。
 */
import { Button } from '../../components/Button.js';

export function AiPromptFallback({
  prompt,
  label,
  openLabel,
  onOpen,
}: {
  prompt: string;
  /** 欄の読み上げ名。依頼は「貼り付け用のプロンプト」、再実行は「再実行のプロンプト」 */
  label: string;
  openLabel?: string;
  /** 写したあとの行き先。無いときはボタンを出さない */
  onOpen?: () => void;
}) {
  return (
    <>
      <textarea
        className="ai-prompt-fallback"
        readOnly
        value={prompt}
        rows={10}
        aria-label={label}
        onFocus={(event) => event.target.select()}
      />
      {onOpen && <Button onClick={onOpen}>{openLabel ?? 'コピー後、新しい依頼を開く'}</Button>}
    </>
  );
}
