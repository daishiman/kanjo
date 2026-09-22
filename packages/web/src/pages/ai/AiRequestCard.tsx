/**
 * 1. 依頼 (spec-ai-analysis-screen FR-1〜FR-3)。
 *
 * 期間は共通の期間タブと同じ状態 (`usePeriod`) を読み書きする。ここで別の期間を持つと、
 * 上のタブと依頼の範囲が食い違い、「見ている期間」と「AIに渡した期間」が別物になる。
 * 補足指示は利用者ごとに localStorage へ下書き保存する (保存できない環境では表示を出さないだけで止めない)。
 */
import {
  AI_ANALYSIS_DEPTH_CHOICES,
  AI_ANALYSIS_DEPTH_LABEL,
  AI_SUPPLEMENT_MAX,
  type AiAnalysisDepth,
  aiClockLabel,
  aiPeriodRangeLabel,
  clearAiDraft,
  loadAiDraft,
  saveAiDraft,
} from '@kanjo/core';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { type AiTaskCreateBody, type AiTaskCreateResponse, type AiTaskView, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { describeError } from '../../components/Page.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { type PeriodMeta, usePeriod } from '../../period.js';
import { AiInventoryCard } from './AiInventoryCard.js';
import { AiPromptFallback } from './AiPromptFallback.js';
import type { Reanalyze } from './AiReportDetail.js';
import { AI_COPY_TARGETS, AI_COPY_TARGET_LABEL, type AiCopyTarget, copyTaskPrompt } from './copy-prompt.js';
import { AI_PERIOD_CHOICES, aiPeriodChoiceOf, aiPeriodSelectionFor } from './view-model.js';

/** localStorage は private window 等で取得そのものが例外になる。取れなければ null (保存しない) */
function draftStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function AiRequestCard({
  range,
  periodMeta,
  periodLoading,
  userId,
  tasks,
  reanalyze,
  onCancelReanalyze,
  onCreated,
  onCopied,
}: {
  range: { from: string; to: string } | null;
  periodMeta: PeriodMeta | undefined;
  periodLoading: boolean;
  userId: string | null;
  /** 右カードが「この期間の依頼」を選ぶために使う。一覧と同じ配列 */
  tasks: AiTaskView[];
  reanalyze: Reanalyze | null;
  onCancelReanalyze: () => void;
  onCreated: (task: AiTaskView) => void;
  onCopied: () => void;
}) {
  const { selection, setSelection } = usePeriod();
  const choice = aiPeriodChoiceOf(selection);
  // 再分析は元レポートの期間で固定する (期間を変えると比較の前提が崩れる)
  const target = reanalyze ? reanalyze.period : range;

  const [supplement, setSupplement] = useState('');
  const [questionPreset, setQuestionPreset] = useState('');
  const [backgroundFact, setBackgroundFact] = useState('');
  const [externalResearch, setExternalResearch] = useState(false);
  const [analysisDepth, setAnalysisDepth] = useState<AiAnalysisDepth>('standard');
  // 宛先は依頼の条件の一部。プロンプトは作成時にしか組み立てられないので、コピー後には変えられない
  const [copyTarget, setCopyTarget] = useState<AiCopyTarget>('claude_code');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // clipboard に書けなかったときだけ出す、選択してコピーするための欄
  const [fallbackPrompt, setFallbackPrompt] = useState<string | null>(null);
  const [fallbackTask, setFallbackTask] = useState<AiTaskView | null>(null);

  // 利用者が決まったら下書きを戻す。利用者が変われば別の下書き
  useEffect(() => {
    if (!userId) return;
    const draft = loadAiDraft(draftStorage(), userId);
    setSupplement(draft?.text ?? '');
    setSavedAt(draft?.savedAt ?? null);
  }, [userId]);

  const changeSupplement = (text: string) => {
    const next = text.slice(0, AI_SUPPLEMENT_MAX);
    setSupplement(next);
    if (!userId) return;
    const saved = saveAiDraft(draftStorage(), userId, next, new Date().toISOString());
    // 保存できなかったとき (例外・空文字) は「保存しました」を出さない
    setSavedAt(saved?.savedAt ?? null);
  };

  const create = useMutation({
    mutationFn: (body: AiTaskCreateBody) =>
      api<AiTaskCreateResponse>('/ai/tasks', { method: 'POST', body: JSON.stringify(body) }),
  });

  const copy = async (to: AiCopyTarget) => {
    if (!target) return;
    setMessage(null);
    setFallbackPrompt(null);
    setFallbackTask(null);
    let created: AiTaskCreateResponse;
    try {
      created = await create.mutateAsync({
        from: target.from,
        to: target.to,
        supplement: buildAnalysisSupplement({
          questionPreset,
          backgroundFact,
          externalResearch,
          analysisDepth,
          detail: supplement,
        }),
        parentReportId: reanalyze?.reportId,
        // 指示文の宛先は依頼を作るときにしか決められない (プロンプトはトークンを含み、保存しないため後から作り直せない)
        target: to,
      });
    } catch {
      return; // 失敗の文は create.error から出す
    }
    if (userId) clearAiDraft(draftStorage(), userId);
    setSupplement('');
    setSavedAt(null);
    if (await copyTaskPrompt(created.task.id, created.prompt, to)) {
      setMessage(`コピーしました。${AI_COPY_TARGET_LABEL[to]} に貼り付けて実行してください。`);
      onCopied();
      // コピーの成功を確定してから詳細へ遷移する。先に遷移すると fallback が失われる。
      onCreated(created.task);
    } else {
      setMessage('自動でコピーできませんでした。下の枠の中を全選択してコピーしてください。');
      setFallbackPrompt(created.prompt);
      setFallbackTask(created.task);
      onCopied();
    }
  };

  return (
    <section className="card ai-step" aria-labelledby="ai-step-request">
      <header className="ai-step-head">
        <h2 id="ai-step-request">1. 依頼</h2>
        <p className="sub">分析の条件を指定して、プロンプトをコピーします</p>
      </header>
      <div className="ai-request-grid">
        <div className="ai-request-main">
          {reanalyze && (
            <p className="notice info">
              「{reanalyze.title}」(第{reanalyze.version}版)を元に
              {reanalyze.mode === 'revise'
                ? '改訂版(次の版)を作ります。同じ期間で作り直し、前回の指摘の追跡が入ります。必要なら補足指示に、実行した対策や変わった事情を書いてください。'
                : '再分析します。補足指示に、前回のレポートで足りないとされた情報や、実行した対策を書いてください。'}{' '}
              <Button size="mini" onClick={onCancelReanalyze}>
                再分析をやめる
              </Button>
            </p>
          )}
          <fieldset className="ai-period">
            <legend>対象期間</legend>
            <span className="segment">
              {AI_PERIOD_CHOICES.map((c) => (
                <button
                  key={String(c.id)}
                  data-native-control="toggle"
                  type="button"
                  className={choice === c.id ? 'on' : ''}
                  aria-pressed={choice === c.id}
                  disabled={!!reanalyze}
                  onClick={() => setSelection(aiPeriodSelectionFor(c.id, periodMeta))}
                >
                  {c.label}
                </button>
              ))}
            </span>
            {selection.mode === 'custom' && !reanalyze && (
              <span className="ai-period-custom">
                <input
                  type="month"
                  aria-label="開始月"
                  value={selection.from}
                  min={periodMeta?.full?.from}
                  max={periodMeta?.full?.to}
                  onChange={(e) => setSelection({ ...selection, from: e.target.value })}
                />
                <span aria-hidden="true">〜</span>
                <input
                  type="month"
                  aria-label="終了月"
                  value={selection.to}
                  min={periodMeta?.full?.from}
                  max={periodMeta?.full?.to}
                  onChange={(e) => setSelection({ ...selection, to: e.target.value })}
                />
              </span>
            )}
            <p className="ai-period-range" aria-live="polite">
              {target
                ? aiPeriodRangeLabel(target.from, target.to)
                : periodLoading
                  ? '期間を読み込み中…'
                  : '取込済みのデータがありません。先に「データ取込」で取り込んでください。'}
            </p>
          </fieldset>

          <div className="ai-supplement">
            <strong className="ai-label">分析の設定</strong>
            <span className="sub">レポート量を選び、数字の背景は分かる範囲だけ回答してください。</span>
            <label htmlFor="ai-analysis-depth">レポートの量</label>
            <select
              id="ai-analysis-depth"
              value={analysisDepth}
              onChange={(event) => setAnalysisDepth(event.target.value as typeof analysisDepth)}
            >
              {AI_ANALYSIS_DEPTH_CHOICES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <label htmlFor="ai-copy-target">実行する相手</label>
            <select
              id="ai-copy-target"
              value={copyTarget}
              onChange={(event) => setCopyTarget(event.target.value as AiCopyTarget)}
            >
              {AI_COPY_TARGETS.map((id) => (
                <option key={id} value={id}>
                  {AI_COPY_TARGET_LABEL[id]}
                </option>
              ))}
            </select>
            <label htmlFor="ai-question-preset">今回いちばん知りたいこと</label>
            <select
              id="ai-question-preset"
              aria-label="今回いちばん知りたいこと"
              value={questionPreset}
              onChange={(event) => setQuestionPreset(event.target.value)}
            >
              <option value="">選ばない（AIに任せる）</option>
              <option value="売上・収入が変わった理由を知りたい">売上・収入の変化</option>
              <option value="費用が増減した理由を知りたい">費用の変化</option>
              <option value="一時的な出費と継続費用を分けたい">一時費用と継続費用</option>
              <option value="事業と家計の構成変化を知りたい">事業・家計の構成変化</option>
              <option value="すぐに着手できる削減策を知りたい">すぐに効く削減策</option>
            </select>
            <label htmlFor="ai-background-fact">対象期間に起きた変化</label>
            <input
              id="ai-background-fact"
              type="text"
              aria-label="対象期間に起きた変化"
              value={backgroundFact}
              maxLength={500}
              onChange={(event) => setBackgroundFact(event.target.value)}
              placeholder="例：4月に事業所を移転した、6月から新サービスを始めた"
            />
            <SelectionCheckbox
              className="ai-external-research"
              label="公的資料など外部情勢も調べる"
              checked={externalResearch}
              onChange={(event) => setExternalResearch(event.target.checked)}
            />
            <span className="sub">
              既定はOFF。ONでも取引先名・個人名・具体的な金額・明細は検索語へ送りません。
            </span>
            <label className="ai-label" htmlFor="ai-supplement-detail">
              その他の補足（任意）
            </label>
            <textarea
              id="ai-supplement-detail"
              value={supplement}
              rows={4}
              maxLength={AI_SUPPLEMENT_MAX}
              onChange={(e) => changeSupplement(e.target.value)}
              placeholder="例：売上の増減要因を分析し、費用の削減余地がある項目を特定してください。前期と比較し、主な変動要因も示してください。"
            />
            {/* 数えているのは直上の欄だけ。「分析の設定」全体の字数と読み違えないよう欄名を添える */}
            <span className="sub num ai-supplement-count">
              その他の補足 {supplement.length}/{AI_SUPPLEMENT_MAX}
            </span>
          </div>
          <div className="ai-supplement-foot">
            <span className="sub" aria-live="polite">
              {savedAt ? `✓ 下書きを自動保存しました ${aiClockLabel(savedAt)}` : ''}
            </span>
          </div>

          <div className="toolbar">
            <Button
              variant="primary"
              disabled={!target || create.isPending}
              onClick={() => void copy(copyTarget)}
            >
              {create.isPending ? '作成中…' : 'プロンプトをコピー'}
            </Button>
            <span className="sub">コピーするたびに新しい依頼 (T-番号) ができます。</span>
          </div>
          {create.isError && (
            <p className="notice" role="alert">
              {describeError(create.error)}
            </p>
          )}
          {message && <output className="sub">{message}</output>}
          {fallbackPrompt && (
            <AiPromptFallback
              prompt={fallbackPrompt}
              label="貼り付け用のプロンプト"
              openLabel="コピー後、この依頼の状況を開く"
              onOpen={fallbackTask ? () => onCreated(fallbackTask) : undefined}
            />
          )}
          <p className="notice info">
            データは自動送信されません。コピーしたプロンプトを各AI（Claude Code /
            Codex）に貼り付けて、実行してください。
          </p>
        </div>
        <AiInventoryCard range={target} tasks={tasks} />
      </div>
    </section>
  );
}

function buildAnalysisSupplement(input: {
  questionPreset: string;
  backgroundFact: string;
  externalResearch: boolean;
  analysisDepth: AiAnalysisDepth;
  detail: string;
}): string {
  const question = input.questionPreset.trim();
  const background = input.backgroundFact.trim();
  const detail = input.detail.trim();
  const depthLabel = AI_ANALYSIS_DEPTH_LABEL[input.analysisDepth];
  const summary = question || background || detail.split('\n')[0] || `AIに任せる（${depthLabel}）`;
  const lines = [
    `分析の目的: ${summary}`,
    '[分析前ヒアリング]',
    `レポート量: ${input.analysisDepth}`,
    `知りたいこと: ${question || '未回答'}`,
    `対象期間に起きた変化: ${background || '未回答'}`,
    `外部調査: ${input.externalResearch ? '希望する' : '希望しない'}`,
    '外部調査では取引先名・個人名・具体金額・明細を検索語に含めない。',
  ];
  if (detail) lines.push('[その他の補足]', detail);
  return lines.join('\n');
}
