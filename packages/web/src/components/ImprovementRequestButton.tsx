/**
 * 右下の『改善を送る』と、浮動パネル「画面をキャプチャ」の入口 (spec FR-23)。
 *
 * このボタンはパネルを開くだけで、撮影そのものは持たない。撮影・範囲選択のコードは
 * CapturePanel に置いて遅延読み込みする。共通シェルの初期 JS に html-to-image が入らない。
 *
 * 撮影とパネルの順序: パネルと範囲選択の覆いは data-capture-hide を持ち、撮影用の複製から
 * 落ちる。以前のモーダル方式 (撮り終えてから開く) から、写り込みを除外する方式へ変えたのは、
 * パネルが撮影の前から出ている必要があるため。除外の印はパネルの外枠 1 か所だけに付ける。
 */
import type { DiagnosticPayload } from '@kanjo/core';
import { Suspense, lazy } from 'react';
import type { CaptureRegion } from '../capture-screen.js';
import { openCapturePanel, useCaptureHandoff } from '../improvement-handoff.js';
import { Button } from './Button.js';
import { DeferredUiIcon as UiIcon } from './DeferredUiIcon.js';

const CapturePanel = lazy(() =>
  import('./CapturePanel.js').then((module) => ({ default: module.CapturePanel })),
);

export interface ImprovementRequestButtonProps {
  /** テストで差し替えるための撮影関数。既定は実際の画面撮影 */
  capture?: (region?: CaptureRegion) => Promise<File | null>;
  /** テストで差し替えるための診断取得。既定は起動時から貯めているバッファ */
  snapshot?: (route: string) => DiagnosticPayload;
}

export function ImprovementRequestButton({ capture, snapshot }: ImprovementRequestButtonProps = {}) {
  const { panelOpen } = useCaptureHandoff();
  return (
    <>
      <Button
        className="improve-trigger"
        aria-label="改善を送る"
        aria-expanded={panelOpen}
        // 右下に固定した結果、このボタン自身が撮影対象の右下を必ず覆う。自分だけ除く
        data-capture-hide=""
        onClick={openCapturePanel}
      >
        <UiIcon name="message-circle" className="action-icon" />
        <span className="improve-trigger-label">改善を送る</span>
      </Button>
      {panelOpen && (
        <Suspense
          fallback={
            <output className="capture-panel card" data-capture-hide="" aria-live="polite">
              撮影の準備をしています…
            </output>
          }
        >
          <CapturePanel {...(capture ? { capture } : {})} {...(snapshot ? { snapshot } : {})} />
        </Suspense>
      )}
    </>
  );
}
