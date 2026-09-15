/**
 * 共通シェル用の遅延アイコン。
 * 概況ページの状態アイコン群を初期JSへ二重に抱えず、既存の110KiB budgetを守る。
 */
import { Suspense, lazy } from 'react';
import type { UiIconProps } from './UiIcon.js';

const LazyUiIcon = lazy(() => import('./UiIcon.js').then((module) => ({ default: module.UiIcon })));

export function DeferredUiIcon({ className = 'ui-icon', ...props }: UiIconProps) {
  return (
    <Suspense fallback={<span className={className} aria-hidden="true" />}>
      <LazyUiIcon className={className} {...props} />
    </Suspense>
  );
}
