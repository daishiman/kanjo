/**
 * 数値の枠 1 つ分。読込中は骨組み、失敗は「取得できませんでした」を出す (spec-guide-screen の状態表)。
 * 本文 (core の定数) はこの状態に関わらず描くので、状態を持つのは数値の枠だけにする。
 */
import type { ReactNode } from 'react';

export type GuideLoad = 'loading' | 'error' | 'ready';

export const GUIDE_FAILED_TEXT = '取得できませんでした';

export function GuideValue({ load, children }: { load: GuideLoad; children: () => ReactNode }) {
  if (load === 'loading')
    return (
      <span className="guide-skeleton">
        <span aria-hidden="true" />
        <span className="visually-hidden">読み込み中</span>
      </span>
    );
  if (load === 'error') return <span className="guide-failed">{GUIDE_FAILED_TEXT}</span>;
  return <>{children()}</>;
}
