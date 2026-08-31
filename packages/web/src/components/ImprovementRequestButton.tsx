/**
 * 改善要望ボタンとその投稿モーダル。
 *
 * 撮影とモーダル表示の順序がこの部品の主題。押下 → capture() を await →
 * 撮り終えてから open を立てる。この順序があるかぎり、撮れた画像にモーダルは写らない。
 * 「モーダルを除外リストに入れる」方式は採らない(将来モーダル外に出る要素を取りこぼす)。
 *
 * 撮影の失敗は投稿の失敗ではない。captureScreen() が null を返してもモーダルは開き、
 * スクリーンショットなしの本文だけで投稿が成立する。
 */
import { type DiagnosticPayload, highlightDiagnostics } from '@kanjo/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { type Annotation, burnAnnotations } from '../annotate-image.js';
import { createImprovement, markImprovementCopied } from '../api.js';
import { captureScreen } from '../capture-screen.js';
import { diagnosticsSnapshot } from '../diagnostics-buffer.js';
import { ScreenshotAnnotator } from './ScreenshotAnnotator.js';

type Phase = 'idle' | 'capturing' | 'form' | 'sending' | 'done';

/** 記録の種別を日本語にする。DevTools の用語をそのまま出しても利用者には読めない */
const KIND_LABEL: Record<string, string> = {
  error: 'エラー',
  unhandledrejection: '未処理の失敗',
  console_error: 'コンソール(エラー)',
  console_warn: 'コンソール(警告)',
  network: '通信',
};

export interface ImprovementRequestButtonProps {
  /** テストで差し替えるための撮影関数。既定は実際の画面撮影 */
  capture?: () => Promise<File | null>;
  /** テストで差し替えるための診断取得。既定は起動時から貯めているバッファ */
  snapshot?: (route: string) => DiagnosticPayload;
}

export function ImprovementRequestButton({
  capture = captureScreen,
  snapshot = diagnosticsSnapshot,
}: ImprovementRequestButtonProps = {}) {
  const loc = useLocation();
  const qc = useQueryClient();
  const titleId = useId();
  const bodyId = useId();

  const [phase, setPhase] = useState<Phase>('idle');
  const [shot, setShot] = useState<File | null>(null);
  const [attach, setAttach] = useState(true);
  /** 書き込んだ枠。元画像は触らず、送信直前にだけ焼き込む */
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticPayload | null>(null);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<'claude_code' | 'codex' | null>(null);
  // ref callback から代入するので、書き換え可能な MutableRefObject にする
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const open = phase !== 'idle' && phase !== 'capturing';

  /**
   * マウントと同時に modal として開く。焦点の閉じ込めと Escape は <dialog> が持つので、
   * ここで keydown を自前監視しない。
   */
  const openDialog = (node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (node && !node.open) node.showModal?.();
  };

  // プレビュー用の Object URL は開放しないと leak する
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!shot || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(shot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [shot]);

  function close() {
    setPhase('idle');
    setShot(null);
    setAttach(true);
    setAnnotations([]);
    setDiagnostics(null);
    setCaptureFailed(false);
    setTitle('');
    setBody('');
    setError(null);
    setPrompt(null);
    setCreatedId(null);
    setCopied(null);
  }

  /**
   * 押下から撮影完了までを直列にする。
   * 「setPhase('capturing') → await capture() → setPhase('form')」の順序が
   * この機能の受入条件そのもの。await を外すとモーダルが写り込む。
   */
  async function start() {
    setPhase('capturing');
    const route = `${loc.pathname}${loc.search}`;
    let file: File | null = null;
    try {
      file = await capture();
    } catch {
      file = null;
    }
    setShot(file);
    setCaptureFailed(file === null);
    setDiagnostics(snapshot(route));
    // ここで初めてモーダルを開く。撮影は既に終わっている
    setPhase('form');
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setError('件名と内容を入力してください');
      return;
    }
    setPhase('sending');
    setError(null);
    try {
      // 書き込みを焼き込むのはここだけ。焼き込みに失敗しても元画像が返るので送信は続く
      const image = attach && shot ? await burnAnnotations(shot, annotations) : null;
      const res = await createImprovement({
        title: title.trim(),
        body: body.trim(),
        route: `${loc.pathname}${loc.search}`,
        diagnostics: diagnostics ?? snapshot(`${loc.pathname}${loc.search}`),
        screenshot: image,
      });
      setPrompt(res.prompt);
      setCreatedId(res.request.id);
      setPhase('done');
      void qc.invalidateQueries({ queryKey: ['improvements'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信できませんでした');
      setPhase('form');
    }
  }

  async function copyPrompt(target: 'claude_code' | 'codex') {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(target);
      if (createdId) await markImprovementCopied(createdId, target);
    } catch {
      setError('コピーできませんでした。指示文を選択して手動でコピーしてください');
    }
  }

  const omitted = diagnostics?.omittedCount ?? 0;
  const entries = diagnostics?.entries ?? [];
  const env = diagnostics?.environment;
  // 何を「問題点」として先に出すかの判断は core が正本。画面はその結果を並べるだけ
  const highlights = highlightDiagnostics(entries);

  return (
    <>
      <button
        type="button"
        className="improve-trigger"
        // 右下に固定した結果、このボタン自身が撮影対象の右下を必ず覆う。自分だけ除く
        data-capture-hide=""
        onClick={() => void start()}
        disabled={phase === 'capturing'}
        aria-busy={phase === 'capturing'}
      >
        {phase === 'capturing' ? '画面を撮影中…' : '改善要望'}
      </button>
      {phase === 'capturing' && (
        <output className="improve-capturing" aria-live="polite">
          モーダルを開く前に画面を撮影しています…
        </output>
      )}

      {/* 開いている間だけ DOM に置く。閉じている <dialog> を残すと、撮影対象の
          複製にモーダルの markup が(非表示とはいえ)混ざる */}
      {open && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape での閉じは <dialog> が持つ
        <dialog
          className="improve-modal"
          aria-labelledby={titleId}
          ref={openDialog}
          onClose={close}
          onClick={(e) => {
            // ::backdrop のクリックは dialog 自身に届く。中身の外側なら閉じる
            if (e.target === dialogRef.current) close();
          }}
        >
          <div className="improve-modal-body">
            <h2 id={titleId}>改善要望</h2>

            {phase === 'done' ? (
              <div className="improve-done">
                <p>
                  受け付けました。下の指示文を Claude Code か Codex に貼り付けると、
                  スクリーンショットと診断情報を読みに行って対応します。
                </p>
                <textarea className="improve-prompt" readOnly value={prompt ?? ''} rows={12} />
                <div className="improve-actions">
                  <button type="button" onClick={() => void copyPrompt('claude_code')}>
                    Claude Code 用にコピー
                  </button>
                  <button type="button" onClick={() => void copyPrompt('codex')}>
                    Codex 用にコピー
                  </button>
                  {copied && <span className="improve-copied">コピーしました</span>}
                </div>
                <p className="improve-note">
                  この指示文にはトークンの原文が含まれます。表示はこの1回だけです。
                  なくした場合は改善要望の一覧から作り直してください。
                </p>
                <div className="improve-actions">
                  <Link to="/improvement" onClick={close}>
                    改善要望の一覧を見る
                  </Link>
                  <button type="button" onClick={close}>
                    閉じる
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label htmlFor={`${titleId}-t`}>件名</label>
                <input
                  id={`${titleId}-t`}
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: 分類画面で保存ボタンが反応しない"
                />
                <label htmlFor={bodyId}>内容</label>
                <textarea
                  id={bodyId}
                  value={body}
                  maxLength={4000}
                  rows={6}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="どの操作で、何が起きて、どうなってほしいかを書いてください"
                />

                <section className="improve-attach">
                  <h3>添付</h3>
                  {captureFailed ? (
                    <p className="improve-note">画面の撮影ができませんでした。本文だけで送信できます。</p>
                  ) : (
                    <>
                      {previewUrl &&
                        (attach ? (
                          <ScreenshotAnnotator
                            src={previewUrl}
                            annotations={annotations}
                            onChange={setAnnotations}
                          />
                        ) : (
                          <img
                            className="improve-preview"
                            src={previewUrl}
                            alt="送信されるスクリーンショットのプレビュー"
                          />
                        ))}
                      <label>
                        <input
                          type="checkbox"
                          checked={attach}
                          onChange={(e) => setAttach(e.target.checked)}
                        />
                        このスクリーンショットを添付する
                      </label>
                    </>
                  )}
                </section>

                {/*
                  何が一緒に送られるかを、件数ではなく現物で見せる。
                  「勝手に何か送られている」という不安は、中身が見えないことから来る。
                  折りたたみの既定は閉。普段は邪魔で、疑ったときだけ開けばよい
                */}
                <section className="improve-context">
                  <h3>一緒に送られる情報</h3>
                  <dl className="improve-envinfo">
                    <div>
                      <dt>画面</dt>
                      <dd>{env?.route || `${loc.pathname}${loc.search}`}</dd>
                    </div>
                    <div>
                      <dt>表示サイズ</dt>
                      <dd>{env?.viewport ?? '(記録なし)'}</dd>
                    </div>
                    <div>
                      <dt>取得時刻</dt>
                      <dd>{env?.capturedAt ?? '(記録なし)'}</dd>
                    </div>
                    <div>
                      <dt>ブラウザ</dt>
                      <dd className="improve-ua">{env?.userAgent ?? '(記録なし)'}</dd>
                    </div>
                    <div>
                      <dt>言語</dt>
                      <dd>{env?.language ?? '(記録なし)'}</dd>
                    </div>
                  </dl>

                  {/*
                    全件は下の折りたたみに置く。ここは「先に目を向けるべき数件」だけ。
                    0件のときは節ごと出さない。空の見出しは読む人を止めるだけになる
                  */}
                  {highlights.length > 0 && (
                    <div className="improve-highlights">
                      <h4>気になっている点</h4>
                      <ul>
                        {highlights.map((h) => (
                          <li key={`${h.entry.at}-${h.entry.kind}-${h.entry.message}`}>
                            <span className={`improve-kind kind-${h.entry.kind}`}>
                              {KIND_LABEL[h.entry.kind]}
                            </span>
                            <span className="improve-diagmsg">{h.entry.message}</span>
                            <span className="improve-note">{h.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <details className="improve-diaglist">
                    <summary>
                      画面の裏で起きていた記録 {entries.length} 件
                      {omitted > 0 && `(上限を超えた ${omitted} 件は省略)`}
                    </summary>
                    {entries.length === 0 ? (
                      <p className="improve-note">記録はありません。エラーが出ていなくても要望は送れます。</p>
                    ) : (
                      <ol className="improve-diagentries">
                        {entries.map((e) => (
                          <li key={`${e.at}-${e.kind}-${e.message}`}>
                            <span className={`improve-kind kind-${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                            <span className="improve-diagmsg">{e.message}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </details>
                  <p className="improve-note">
                    パスワード・合言葉・メールアドレス・長い数字の並びは、送る前と保存するときの
                    2回、伏せ字に置き換えられます。通信の中身(金額や明細)は最初から記録していません。
                  </p>
                </section>

                {error && (
                  <p className="improve-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="improve-actions">
                  <button type="button" onClick={() => void submit()} disabled={phase === 'sending'}>
                    {phase === 'sending' ? '送信中…' : '送信する'}
                  </button>
                  <button type="button" onClick={close}>
                    やめる
                  </button>
                </div>
              </>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
