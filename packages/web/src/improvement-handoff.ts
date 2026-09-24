/**
 * 撮影パネルと改善リクエスト画面の間の、メモリ上の受け渡し (spec FR-25)。
 *
 * 撮った画像・関連ページ・診断はここに置き、端末 (localStorage・sessionStorage・IndexedDB) には
 * 書かない。画面の写しには金額や取引先が写りうるため、タブを閉じたら消える場所に限る。
 *
 * このモジュールは撮影のコードを import しない。共通シェル (初期 JS) から読まれても
 * 撮影と範囲選択のコードは遅延読み込みのまま残る。
 */
import type { DiagnosticPayload } from '@kanjo/core';
import { useSyncExternalStore } from 'react';

export interface CaptureHandoff {
  /** 撮った画像。撮影に失敗したら null */
  screenshot: File | null;
  /** 撮影したときの画面 (パスと検索語) */
  route: string;
  diagnostics: DiagnosticPayload | null;
  /** 撮影を試みて失敗した。画像なしでも送れることを知らせる */
  captureFailed: boolean;
}

interface HandoffState {
  /** 浮動パネル「画面をキャプチャ」を開いているか */
  panelOpen: boolean;
  handoff: CaptureHandoff | null;
}

let state: HandoffState = { panelOpen: false, handoff: null };
const listeners = new Set<() => void>();

function emit(next: HandoffState): void {
  state = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => state;

export const openCapturePanel = () => emit({ ...state, panelOpen: true });
export const closeCapturePanel = () => emit({ ...state, panelOpen: false });

/** 撮り終えた結果を置き、パネルを閉じる */
export const putCaptureHandoff = (handoff: CaptureHandoff) => emit({ panelOpen: false, handoff });

/** 作成フォームの『画像を削除』。関連ページと診断は残し、画像だけを外す */
export const dropCaptureScreenshot = () =>
  emit({
    ...state,
    handoff: state.handoff ? { ...state.handoff, screenshot: null, captureFailed: false } : null,
  });

/** 送信が済んだら画像を手放す */
export const clearCaptureHandoff = () => emit({ ...state, handoff: null });

export function useCaptureHandoff(): HandoffState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** テスト用。モジュールの状態は test 間で残るため、各 test の前に戻す */
export function resetCaptureHandoffForTest(): void {
  emit({ panelOpen: false, handoff: null });
}
