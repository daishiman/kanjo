/**
 * 浮動パネル「画面をキャプチャ」と範囲選択 (spec FR-23)。
 *
 * 右下の『改善を送る』か、作成フォームの『キャプチャを撮り直す』で開く。撮り終えたら
 * 画像・関連ページ・診断をメモリ上の受け渡しへ置き、/improvement の作成フォームへ移る。
 *
 * パネルと範囲選択の覆いには data-capture-hide を付ける。撮影用の複製から落ちるので、
 * 撮れた画像にこの部品は写らない。撮影のコードはこのファイルからだけ読むので、
 * 共通シェルの初期 JS には入らない (ImprovementRequestButton が遅延読み込みする)。
 */
import type { DiagnosticPayload } from '@kanjo/core';
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { type CaptureRegion, captureScreen, clampRegion } from '../capture-screen.js';
import { diagnosticsSnapshot } from '../diagnostics-buffer.js';
import { closeCapturePanel, putCaptureHandoff, useCaptureHandoff } from '../improvement-handoff.js';
import { Button } from './Button.js';
import { DeferredUiIcon as UiIcon } from './DeferredUiIcon.js';
import './capture-panel.css';

export interface CapturePanelProps {
  /** テストで差し替えるための撮影関数。範囲を渡すとその範囲だけを撮る */
  capture?: (region?: CaptureRegion) => Promise<File | null>;
  /** テストで差し替えるための診断取得 */
  snapshot?: (route: string) => DiagnosticPayload;
}

/** 矢印キー 1 回の移動量 (px)。Shift を押しながらだと大きさを変える */
const KEY_STEP = 10;
/** 範囲の最小の辺。これより小さい画像は改善の手掛かりにならない */
const MIN_EDGE = 24;

const viewportSize = () => ({
  width:
    typeof window === 'undefined'
      ? 1024
      : Math.max(1, document.documentElement.clientWidth || window.innerWidth),
  height:
    typeof window === 'undefined'
      ? 768
      : Math.max(1, document.documentElement.clientHeight || window.innerHeight),
});

/** 選んだ範囲を文で言う。色や枠だけでなく読み上げでも範囲が分かるようにする */
export const describeRegion = (r: CaptureRegion): string =>
  `選択範囲: 左 ${r.x}px・上 ${r.y}px・幅 ${r.width}px・高さ ${r.height}px`;

/** 範囲選択の初期値。画面の中央に半分の大きさで置く */
function initialRegion(): CaptureRegion {
  const { width, height } = viewportSize();
  return clampRegion({ x: width / 4, y: height / 4, width: width / 2, height: height / 2 }, width, height);
}

/** 矢印キーで範囲を動かす。Shift で幅・高さを変える。Enter の確定は呼び出し側 */
export function moveRegion(region: CaptureRegion, key: string, resize: boolean): CaptureRegion | null {
  const dx = key === 'ArrowRight' ? KEY_STEP : key === 'ArrowLeft' ? -KEY_STEP : 0;
  const dy = key === 'ArrowDown' ? KEY_STEP : key === 'ArrowUp' ? -KEY_STEP : 0;
  if (dx === 0 && dy === 0) return null;
  const { width, height } = viewportSize();
  const next = resize
    ? {
        ...region,
        width: Math.max(MIN_EDGE, region.width + dx),
        height: Math.max(MIN_EDGE, region.height + dy),
      }
    : {
        ...region,
        x: Math.min(Math.max(0, region.x + dx), width - region.width),
        y: Math.min(Math.max(0, region.y + dy), height - region.height),
      };
  return clampRegion(next, width, height);
}

function RegionSelector({
  onConfirm,
  onCancel,
}: {
  onConfirm: (region: CaptureRegion) => void;
  onCancel: () => void;
}) {
  const [region, setRegion] = useState<CaptureRegion>(initialRegion);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const surface = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    surface.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm(region);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    const next = moveRegion(region, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    setRegion(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    drag.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setRegion({ x: event.clientX, y: event.clientY, width: 1, height: 1 });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const { width, height } = viewportSize();
    setRegion(
      clampRegion(
        {
          x: Math.min(start.x, event.clientX),
          y: Math.min(start.y, event.clientY),
          width: Math.abs(event.clientX - start.x),
          height: Math.abs(event.clientY - start.y),
        },
        width,
        height,
      ),
    );
  };
  const onPointerUp = () => {
    drag.current = null;
    setRegion((current) => {
      const { width, height } = viewportSize();
      return clampRegion(
        { ...current, width: Math.max(MIN_EDGE, current.width), height: Math.max(MIN_EDGE, current.height) },
        width,
        height,
      );
    });
  };

  return (
    <div className="capture-region" data-capture-hide="">
      <div
        ref={surface}
        className="capture-region-surface"
        role="application"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: 範囲選択は矢印キーで動かすので、面そのものがフォーカスを受ける
        tabIndex={0}
        aria-label="撮影する範囲を選ぶ。矢印キーで移動、Shift と矢印キーで大きさを変え、Enter で確定、Escape で取り消し"
        aria-describedby="capture-region-text"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          className="capture-region-box"
          style={{ left: region.x, top: region.y, width: region.width, height: region.height }}
          aria-hidden="true"
        />
      </div>
      <div className="capture-region-bar">
        <output id="capture-region-text" aria-live="polite">
          {describeRegion(region)}
        </output>
        <p className="sub">ドラッグ、または矢印キーで範囲を動かし、Enter で撮影します。</p>
        <div className="capture-region-actions">
          <Button variant="primary" onClick={() => onConfirm(region)}>
            この範囲を撮影
          </Button>
          <Button onClick={onCancel}>取り消す</Button>
        </div>
      </div>
    </div>
  );
}

/** captureScreen の第 1 引数は document。範囲だけを受ける形へ包む */
const captureDocument = (region?: CaptureRegion) => captureScreen(document, region);

export function CapturePanel({
  capture = captureDocument,
  snapshot = diagnosticsSnapshot,
}: CapturePanelProps) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { handoff } = useCaptureHandoff();
  const [phase, setPhase] = useState<'idle' | 'selecting' | 'capturing'>('idle');

  // 縮小表示の Object URL は開放しないと leak する
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const shot = handoff?.screenshot ?? null;
  useEffect(() => {
    if (!shot || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(shot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [shot]);

  /**
   * 撮る → 受け渡しへ置く → 作成フォームへ移る、を直列にする。
   * 関連ページは実際に撮った画面に固定する。フォームからの撮り直しは元画面へ先に戻る。
   */
  async function run(region?: CaptureRegion) {
    setPhase('capturing');
    const here = `${loc.pathname}${loc.search}`;
    const route = here;
    let file: File | null = null;
    try {
      file = await capture(region);
    } catch {
      file = null;
    }
    putCaptureHandoff({
      screenshot: file,
      route,
      diagnostics: snapshot(route),
      captureFailed: file === null,
    });
    setPhase('idle');
    if (loc.pathname !== '/improvement') navigate('/improvement');
  }

  if (phase === 'selecting') {
    return <RegionSelector onConfirm={(region) => void run(region)} onCancel={() => setPhase('idle')} />;
  }

  return (
    <section className="capture-panel card" aria-labelledby="capture-panel-title" data-capture-hide="">
      <header className="capture-panel-head">
        <h2 id="capture-panel-title">画面をキャプチャ</h2>
        <Button variant="text" size="mini" aria-label="撮影パネルを閉じる" onClick={closeCapturePanel}>
          <UiIcon name="close" />
        </Button>
      </header>
      <div className="capture-panel-thumb">
        {previewUrl ? (
          <img src={previewUrl} alt="前回撮影した画面の縮小画像" />
        ) : (
          <p className="sub">
            撮影すると、ここに縮小画像が出ます。文字はできる限り伏字にします。送信前に画像を確認してください。
          </p>
        )}
      </div>
      <div className="capture-panel-actions">
        <Button variant="primary" disabled={phase === 'capturing'} onClick={() => void run()}>
          {phase === 'capturing' ? '撮影しています…' : 'キャプチャする'}
        </Button>
        <Button disabled={phase === 'capturing'} onClick={() => setPhase('selecting')}>
          範囲を選択する
        </Button>
      </div>
    </section>
  );
}
