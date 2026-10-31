/**
 * 作成フォーム「新しい改善リクエストを作成」(spec FR-3〜FR-7、FR-27)。
 *
 * 画像・関連ページ・診断は撮影パネルからメモリ上の受け渡しで届く (FR-25)。端末には保存しない。
 * 端末の画像ファイルは受け付けない。撮影用の複製で掛ける伏字を通らない画像が送れてしまうため (spec OI-04)。
 * 送信を止める理由は core の checkImprovementDraft が決め、ここは送信ボタンの近くに文で出すだけ。
 * 入力はこの部品が持ち、一覧の失敗や再読み込みでは消えない (FR-22)。
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type Annotation,
  type AnnotationHistory,
  EMPTY_ANNOTATION_HISTORY,
  MaskBurnError,
  burnAnnotations,
  recordAnnotations,
  undoAnnotations,
} from '../../annotate-image.js';
import { type ImprovementCreateResponse, createImprovement } from '../../api.js';
import { Button } from '../../components/Button.js';
import { ScreenshotAnnotator } from '../../components/ScreenshotAnnotator.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { useConfirmDialog } from '../../components/use-confirm-dialog.js';
import { diagnosticsSnapshot } from '../../diagnostics-buffer.js';
import {
  clearCaptureHandoff,
  dropCaptureScreenshot,
  openCapturePanel,
  useCaptureHandoff,
} from '../../improvement-handoff.js';
import { DisclosureLists } from './ImprovementParts.js';
import {
  BODY_PLACEHOLDER,
  type CreateDraft,
  EMPTY_CREATE_DRAFT,
  IMPROVEMENT_DRAFT_MESSAGES,
  MASK_TARGETS,
  PRIVACY_CONFIRM_LABEL,
  PRIVACY_CONSENT_LABEL,
  TEXT,
  actionErrorText,
  bodyCountText,
  checkDraft,
} from './view-model.js';

export const IMPROVEMENT_BODY_ID = 'improvement-body';

/** マスクを焼き込めなかったとき。元の画像では隠したはずの文字が届くので、送らずに止める */
const TEXT_MASK_BURN_FAILED =
  'マスクを画像に焼き込めませんでした。画像を削除するか撮り直してから、もう一度送ってください。';

export function CreateForm({ onCreated }: { onCreated: (res: ImprovementCreateResponse) => void }) {
  const { handoff } = useCaptureHandoff();
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  /** 一度でも送信を押したか。押す前から赤い文を並べると、書き始める前に叱られる */
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * 書き込んだ枠・線・文字・マスクと、その操作の履歴。元画像は触らず、送信直前にだけ焼き込む。
   * 履歴をここで持つのは、縮小表示と拡大表示のどちらで書いても「1つ戻す」が同じ順に戻るようにするため
   */
  const [history, setHistory] = useState<AnnotationHistory>(EMPTY_ANNOTATION_HISTORY);
  const annotations = history.current;
  const changeAnnotations = useCallback(
    (next: Annotation[]) => setHistory((h) => recordAnnotations(h, next)),
    [],
  );
  const undoAnnotation = useCallback(() => setHistory(undoAnnotations), []);
  // 拡大して書き込むダイアログ。開閉とフォーカスの戻し方は確認ダイアログと同じ作法に揃える
  const expand = useConfirmDialog();
  const navigate = useNavigate();
  const reasonId = useId();
  const countId = useId();

  const shot = handoff?.screenshot ?? null;
  const related = handoff?.route ?? '';

  /** 添付画像と関連ページを同じ画面に保つため、元画面へ戻って撮影する。 */
  function retake() {
    const path = related.split(/[?#]/)[0] ?? '';
    if (path !== '' && path !== '/improvement') navigate(related);
    openCapturePanel();
  }
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    // 画像が変わったら前の画像への書き込みは意味を失う
    setHistory(EMPTY_ANNOTATION_HISTORY);
    if (!shot || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(shot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [shot]);

  const check = checkDraft(draft);
  // 本文の 1000 字超えは、送信を押す前から知らせる (書き足すほど直す量が増えるため)
  const tooLong = check.fields.body === IMPROVEMENT_DRAFT_MESSAGES.bodyTooLong;
  const showReason = !check.ok && (tried || tooLong);

  async function submit() {
    setTried(true);
    setError(null);
    if (!check.ok || sending) return;
    setSending(true);
    const route = handoff?.route ?? '/improvement';
    try {
      // 書き込みを焼き込むのはここだけ。枠と線だけなら、失敗しても元画像が返るので送信は続く。
      // マスクを含む失敗は MaskBurnError になり、隠したはずの情報を送らないよう送信を止める
      const image = shot ? await burnAnnotations(shot, annotations) : null;
      const res = await createImprovement({
        body: draft.body.trim(),
        route,
        diagnostics: handoff?.diagnostics ?? diagnosticsSnapshot(route),
        screenshot: image,
        privacyConfirmed: draft.privacyConfirmed,
        privacyConsented: draft.privacyConsented,
      });
      setDraft(EMPTY_CREATE_DRAFT);
      setTried(false);
      clearCaptureHandoff();
      onCreated(res);
    } catch (e) {
      // 失敗しても入力は保つ。API の message をそのまま近くに出す
      setError(e instanceof MaskBurnError ? TEXT_MASK_BURN_FAILED : actionErrorText(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card improvement-create" aria-labelledby="improvement-create-title">
      <h2 id="improvement-create-title">新しい改善リクエストを作成</h2>
      <div className="improvement-create-grid">
        <div className="improvement-create-left">
          <h3 className="improvement-field-label">スクリーンショット（任意）</h3>
          {shot && previewUrl ? (
            <>
              {/* 書き込みの道具は最初から出す。奥に隠すと、あることに気づかれない */}
              <ScreenshotAnnotator
                src={previewUrl}
                annotations={annotations}
                onChange={changeAnnotations}
                onUndo={undoAnnotation}
                canUndo={history.past.length > 0}
                onExpand={() => expand.setOpen(true)}
                expandButtonRef={expand.triggerRef}
              />
              {expand.open && (
                <dialog
                  ref={expand.bind}
                  className="improve-annotate-dialog"
                  aria-labelledby={expand.titleId}
                  onClose={expand.close}
                  onCancel={(event) => {
                    // Esc でも閉じる経路を close に一本化し、フォーカスを「拡大して書き込む」へ戻す
                    event.preventDefault();
                    expand.close();
                  }}
                >
                  <div className="improve-annotate-dialog-head">
                    <h3 ref={expand.titleRef} id={expand.titleId} tabIndex={-1}>
                      画像を拡大して書き込む
                    </h3>
                    <Button variant="primary" onClick={expand.close}>
                      書き込みを終える
                    </Button>
                  </div>
                  {/* 同じ配列を渡す。ここで書いたものは閉じた後の縮小画像にもそのまま残る */}
                  <ScreenshotAnnotator
                    src={previewUrl}
                    annotations={annotations}
                    onChange={changeAnnotations}
                    onUndo={undoAnnotation}
                    canUndo={history.past.length > 0}
                    expanded
                  />
                </dialog>
              )}
              <div className="improvement-shot-actions">
                <Button size="mini" onClick={retake}>
                  キャプチャを撮り直す
                </Button>
                <Button size="mini" onClick={dropCaptureScreenshot}>
                  画像を削除
                </Button>
              </div>
              <p className="sub improvement-preview-note">
                送信前に縮小画像を確認し、個人情報や機密情報が残っていないか確かめてください。
              </p>
              {annotations.length > 0 && (
                <p className="sub">書き込み {annotations.length} 件は、送信するときに画像へ焼き込みます。</p>
              )}
            </>
          ) : (
            <div className="improvement-shot-empty">
              {handoff?.captureFailed ? (
                <output className="improvement-note">{TEXT.captureFailed}</output>
              ) : (
                <p className="sub">画面を撮影すると、ここに縮小画像が出ます。</p>
              )}
              <div className="improvement-shot-actions">
                <Button size="mini" onClick={retake}>
                  画面をキャプチャする
                </Button>
              </div>
            </div>
          )}

          <fieldset className="improvement-privacy">
            <legend>
              プライバシーに関する確認<span className="improvement-required">必須</span>
            </legend>
            <SelectionCheckbox
              label={PRIVACY_CONFIRM_LABEL}
              checked={draft.privacyConfirmed}
              onChange={(e) => setDraft((d) => ({ ...d, privacyConfirmed: e.target.checked }))}
            />
            <SelectionCheckbox
              label={PRIVACY_CONSENT_LABEL}
              checked={draft.privacyConsented}
              onChange={(e) => setDraft((d) => ({ ...d, privacyConsented: e.target.checked }))}
            />
          </fieldset>
        </div>

        <div className="improvement-create-right">
          <label className="improvement-field-label" htmlFor={IMPROVEMENT_BODY_ID}>
            どのような改善を希望しますか？<span className="improvement-required">必須</span>
          </label>
          <textarea
            id={IMPROVEMENT_BODY_ID}
            className="improvement-body-input"
            rows={7}
            value={draft.body}
            placeholder={BODY_PLACEHOLDER}
            aria-describedby={`${countId}${showReason ? ` ${reasonId}` : ''}`}
            aria-invalid={tooLong || (tried && Boolean(check.fields.body))}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          />
          <p id={countId} className={`improvement-count${tooLong ? ' is-over' : ''}`}>
            {bodyCountText(check.length)}
          </p>

          <section className="improvement-mask" aria-labelledby="improvement-mask-title">
            <h3 id="improvement-mask-title">自動マスキングの対象</h3>
            <p className="sub">
              画面内の文字は次の情報を検出して伏せます。画像内の文字など、検出できない情報もあるため送信前に確認してください。
            </p>
            <ul>
              {MASK_TARGETS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <details className="improvement-disclosure">
              <summary>詳細を確認する</summary>
              <DisclosureLists />
            </details>
          </section>
        </div>
      </div>

      <div className="improvement-submit">
        {showReason && (
          <output id={reasonId} className="improvement-reason">
            {check.message}
          </output>
        )}
        {error && (
          <p className="improvement-reason" role="alert">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          className="improvement-submit-btn"
          aria-disabled={!check.ok || sending}
          aria-describedby={showReason ? reasonId : undefined}
          onClick={() => void submit()}
        >
          {sending ? '送信しています…' : '改善リクエストを送信'}
        </Button>
      </div>
    </section>
  );
}
