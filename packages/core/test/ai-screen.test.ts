/**
 * AI分析画面の規則 (SYS-AI-P04)。期待値の正本は docs/ai-screen/design-decisions.md の表と
 * specs/spec-ai-analysis-screen.md「ビジネスルールと検証」。表を変えたらここも同時に直す。
 *
 * ## 置換前に落ちる理由
 * 旧実装は api の taskStatus (done / expired / waiting の3値) だけで、キャンセル・差し戻し・データ取得済みを
 * 区別できず、T-番号・版の説明・タブの振り分け・JSON エラー位置の関数が core に無い (import が解決しない)。
 */
import { describe, expect, it } from 'vitest';
import {
  AI_SUPPLEMENT_MAX,
  type AiDraftStorage,
  type AiTaskStageInput,
  aiDefaultSelectedTask,
  aiDraftKey,
  aiJsonErrorMessage,
  aiPeriodRangeLabel,
  aiPeriodShortLabel,
  aiReportMatches,
  aiReportTabs,
  aiTaskCapabilities,
  aiTaskDisplayId,
  aiTaskIsRetryable,
  aiTaskLegacyStatus,
  aiTaskStage,
  aiVersionNote,
  clearAiDraft,
  jsonErrorPosition,
  loadAiDraft,
  saveAiDraft,
} from '../src/index.js';

const NOW = Date.parse('2026-09-19T01:00:00.000Z');
const FUTURE = '2026-09-20T01:00:00.000Z';
const PAST = '2026-09-18T01:00:00.000Z';
const base: AiTaskStageInput = {
  usedAt: null,
  canceledAt: null,
  expiresAt: FUTURE,
  rejectedAt: null,
  dataFetchedAt: null,
};
const stage = (p: Partial<AiTaskStageInput>) => aiTaskStage({ ...base, ...p }, NOW);

describe('段階と進捗 (上から順に最初に当たったもの)', () => {
  it('1 キャンセル', () => {
    expect(stage({ canceledAt: PAST })).toEqual({ stage: 'canceled', progress: null });
  });
  it('2 完了', () => {
    expect(stage({ usedAt: PAST })).toEqual({ stage: 'done', progress: 100 });
  });
  it('3 失敗 (結果なしで期限切れ)', () => {
    expect(stage({ expiresAt: PAST })).toEqual({ stage: 'failed', progress: null });
  });
  it('4 差し戻し = 実行中 75', () => {
    expect(stage({ rejectedAt: PAST, dataFetchedAt: PAST })).toEqual({ stage: 'running', progress: 75 });
  });
  it('5 データ取得済み = 実行中 50', () => {
    expect(stage({ dataFetchedAt: PAST })).toEqual({ stage: 'running', progress: 50 });
  });
  it('6 それ以外 = 待機中 0', () => {
    expect(stage({})).toEqual({ stage: 'waiting', progress: 0 });
  });

  it('境界: 期限切れと受信が同時なら完了', () => {
    expect(stage({ usedAt: PAST, expiresAt: PAST }).stage).toBe('done');
  });
  it('境界: キャンセル後に期限が切れた行はキャンセル', () => {
    expect(stage({ canceledAt: PAST, expiresAt: PAST }).stage).toBe('canceled');
  });
  it('境界: 差し戻し後にデータを再取得しても 75 のまま', () => {
    const later = '2026-09-19T00:59:00.000Z';
    expect(stage({ rejectedAt: PAST, dataFetchedAt: later }).progress).toBe(75);
  });
  it('境界: 期限ちょうどの時刻は待機中', () => {
    expect(stage({ expiresAt: new Date(NOW).toISOString() }).stage).toBe('waiting');
  });

  it('旧来の status は段階から導く', () => {
    expect(aiTaskLegacyStatus('done')).toBe('done');
    expect(aiTaskLegacyStatus('failed')).toBe('expired');
    expect(aiTaskLegacyStatus('canceled')).toBe('expired');
    expect(aiTaskLegacyStatus('running')).toBe('waiting');
    expect(aiTaskLegacyStatus('waiting')).toBe('waiting');
  });
});

describe('T-番号', () => {
  it('4桁ゼロ埋め、10000 以上は桁をそのまま、NULL は「旧」と作成日 (Asia/Tokyo)', () => {
    expect(aiTaskDisplayId(1, FUTURE)).toBe('T-0001');
    expect(aiTaskDisplayId(9999, FUTURE)).toBe('T-9999');
    expect(aiTaskDisplayId(10000, FUTURE)).toBe('T-10000');
    // UTC 15:30 は日本時間で翌日
    expect(aiTaskDisplayId(null, '2026-09-09T15:30:00.000Z')).toBe('旧 2026/09/10');
  });
});

describe('期間の表示', () => {
  it('対象期間と依頼期間', () => {
    expect(aiPeriodRangeLabel('2025-09', '2026-08')).toBe('2025年9月 - 2026年8月（1年）');
    expect(aiPeriodRangeLabel('2024-09', '2026-08')).toBe('2024年9月 - 2026年8月（2年）');
    expect(aiPeriodRangeLabel('2026-02', '2026-08')).toBe('2026年2月 - 2026年8月（7か月）');
    expect(aiPeriodShortLabel('2025-09', '2026-08')).toBe('2025/9 - 2026/8');
  });
});

describe('版の説明', () => {
  it('補足指示の1行目', () => {
    expect(aiVersionNote('費用分析を追加\n2行目は使わない', 2)).toBe('費用分析を追加');
  });
  it('先頭が空行なら最初の空でない行', () => {
    expect(aiVersionNote('\n  \n  売上の増減要因  \n次', 1)).toBe('売上の増減要因');
  });
  it('補足指示なしの v1 と v2', () => {
    expect(aiVersionNote(null, 1)).toBe('初回レポート');
    expect(aiVersionNote('   ', 2)).toBe('最新のデータで再分析');
    expect(aiVersionNote(undefined, 3)).toBe('最新のデータで再分析');
  });
});

const finding = (label: string, priority: 'high' | 'mid' | 'low' | null) => ({
  label,
  fact: `${label}の事実`,
  basis: '',
  interpretation: '',
  action: `${label}の対策`,
  expectedEffect: null,
  amount: null,
  priority,
  chart: null,
});

describe('タブの振り分け', () => {
  const body = {
    version: 3 as const,
    generatedBy: 'claude-code',
    model: null,
    title: 't',
    summary: '総評',
    keyFindings: {
      improvements: [finding('改善A', 'low'), finding('改善B', null)],
      wasted: [finding('ムダA', 'high'), finding('ムダB', 'mid')],
      quickWins: [finding('即効A', 'high')],
      notes: { improvements: '', wasted: '', quickWins: '' },
    },
    sections: [{ id: 'spend', title: '支出', body: '', items: [], gap: null }],
    followUp: { body: '前回', items: [] },
    needs: [{ gap: 'g', action: 'a', screen: 'budget' }],
    charts: [{ id: 'monthly-pl', figure: 1 }],
    dataGaps: ['不足'],
  };

  it('旧契約の本文も5タブへ写し、背景タブは null にする', () => {
    expect(aiReportTabs(body)).toEqual({
      summary: {
        summary: '総評',
        highlights: [
          { label: 'ムダA', fact: 'ムダAの事実' },
          { label: '即効A', fact: '即効Aの事実' },
          { label: 'ムダB', fact: 'ムダBの事実' },
        ],
        actions: ['ムダAの対策', '即効Aの対策', 'ムダBの対策'],
      },
      evidence: { charts: body.charts, sections: body.sections, dataGaps: ['不足'] },
      improvements: { keyFindings: body.keyFindings, followUp: body.followUp },
      context: null,
      links: { needs: body.needs },
    });
  });
});

describe('JSON 取り込みエラーの行と位置', () => {
  it('正しい JSON は null', () => {
    expect(jsonErrorPosition('{"a": [1, -2.5e3, true, null, "x\\n\\u00e9"]}')).toBeNull();
  });
  it('10行目に不正な文字を置いた入力で 10 を返す', () => {
    const lines = ['{'];
    for (let k = 1; k <= 7; k++) lines.push(`  "k${k}": ${k},`);
    lines.push('  "k8": 8,'); // 9行目
    lines.push('  "bad": @'); // 10行目
    lines.push('}');
    const pos = jsonErrorPosition(lines.join('\n'));
    expect(pos).toEqual({ line: 10, column: 10 });
    expect(aiJsonErrorMessage(pos as { line: number; column: number })).toBe(
      'JSONの形式が正しくありません。10行目で不正な文字があります。入力内容は保持されています。修正後、再度取り込んでください。',
    );
  });
  it('末尾カンマ・途切れ・余分な文字', () => {
    expect(jsonErrorPosition('{"a":1,}')).toEqual({ line: 1, column: 8 });
    expect(jsonErrorPosition('{"a":')).toEqual({ line: 1, column: 6 });
    expect(jsonErrorPosition('{} x')).toEqual({ line: 1, column: 4 });
    expect(jsonErrorPosition('')).toEqual({ line: 1, column: 1 });
  });
});

const memory = (): AiDraftStorage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
};

describe('補足指示の下書き', () => {
  it('キーに利用者 ID を含め、保存・復元・消去できる', () => {
    const s = memory();
    expect(aiDraftKey('u1')).toContain('u1');
    expect(saveAiDraft(s, 'u1', '売上の要因', FUTURE)).toEqual({ text: '売上の要因', savedAt: FUTURE });
    expect(loadAiDraft(s, 'u2')).toBeNull();
    expect(loadAiDraft(s, 'u1')).toEqual({ text: '売上の要因', savedAt: FUTURE });
    clearAiDraft(s, 'u1');
    expect(loadAiDraft(s, 'u1')).toBeNull();
  });
  it('1000字を超える値は保存しない', () => {
    const s = memory();
    expect(saveAiDraft(s, 'u1', 'あ'.repeat(AI_SUPPLEMENT_MAX), FUTURE)).not.toBeNull();
    expect(saveAiDraft(s, 'u1', 'あ'.repeat(AI_SUPPLEMENT_MAX + 1), FUTURE)).toBeNull();
    expect(loadAiDraft(s, 'u1')?.text.length).toBe(AI_SUPPLEMENT_MAX);
  });
  it('読み書きの例外は握る', () => {
    const broken: AiDraftStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(saveAiDraft(broken, 'u1', 'x', FUTURE)).toBeNull();
    expect(loadAiDraft(broken, 'u1')).toBeNull();
    expect(() => clearAiDraft(broken, 'u1')).not.toThrow();
    expect(loadAiDraft(null, 'u1')).toBeNull();
  });
});

describe('レポート一覧の検索と既定の選択', () => {
  it('レポート名・要約・対象期間に大文字小文字を区別しない部分一致', () => {
    const r = { title: 'Annual Review 2026', summary: '通信費の削減余地', label: '2025年9月〜2026年8月' };
    expect(aiReportMatches(r, 'annual')).toBe(true);
    expect(aiReportMatches(r, '2025年9月')).toBe(true);
    expect(aiReportMatches(r, '削減余地')).toBe(true);
    expect(aiReportMatches(r, '広告費')).toBe(false);
    expect(aiReportMatches(r, '  ')).toBe(true);
  });
  it('全角で打った検索語も半角の表記に当たる (NFKC で揃える)', () => {
    const reports = [
      { title: 'Annual Review 2026', summary: '通信費の削減余地', label: '2025年9月〜2026年8月' },
      { title: 'Monthly Review 2026', summary: '広告費の増加', label: '2026年8月' },
    ];
    // 全角英字: 旧実装は小文字化だけなので「ａｎｎｕａｌ」が「annual」に当たらず 0 件になる
    const byName = reports.filter((r) => aiReportMatches(r, 'Ａｎｎｕａｌ'));
    expect(byName.map((r) => r.title)).toEqual(['Annual Review 2026']);
    // 全角数字: 対象期間も同様に 0 件になる
    const byPeriod = reports.filter((r) => aiReportMatches(r, '２０２５年９月'));
    expect(byPeriod.map((r) => r.title)).toEqual(['Annual Review 2026']);
    // 要約も同じ規則で当たる
    const bySummary = reports.filter((r) => aiReportMatches(r, '広告費'));
    expect(bySummary.map((r) => r.title)).toEqual(['Monthly Review 2026']);
    // 揃えても無関係な語は当たらない
    expect(reports.filter((r) => aiReportMatches(r, 'ｑｕａｒｔｅｒｌｙ'))).toHaveLength(0);
  });
  it('実行中 → 待機中 → 最新の完了', () => {
    const t = (id: string, s: 'waiting' | 'running' | 'done' | 'failed') => ({ id, stage: s });
    expect(aiDefaultSelectedTask([t('a', 'done'), t('b', 'waiting'), t('c', 'running')])?.id).toBe('c');
    expect(aiDefaultSelectedTask([t('a', 'done'), t('b', 'waiting')])?.id).toBe('b');
    expect(aiDefaultSelectedTask([t('a', 'failed'), t('b', 'done'), t('c', 'done')])?.id).toBe('b');
    expect(aiDefaultSelectedTask([t('a', 'failed')])).toBeNull();
  });
});

describe('依頼の能力表', () => {
  it('待機中・実行中だけが取り消しと結果受付を許可する', () => {
    for (const stage of ['waiting', 'running'] as const) {
      expect(aiTaskCapabilities(stage)).toMatchObject({ cancel: true, acceptResult: true, retry: false });
    }
    for (const stage of ['done', 'failed', 'canceled'] as const) {
      expect(aiTaskCapabilities(stage).acceptResult).toBe(false);
    }
  });

  it('失敗・キャンセルは再実行と削除、完了は詳細だけを許可する', () => {
    expect(aiTaskCapabilities('failed')).toMatchObject({ retry: true, delete: true, openReport: false });
    expect(aiTaskCapabilities('canceled')).toMatchObject({ retry: true, delete: true, openReport: false });
    expect(aiTaskCapabilities('done')).toMatchObject({ retry: false, delete: false, openReport: true });
    for (const stage of ['waiting', 'running', 'done', 'failed', 'canceled'] as const) {
      expect(aiTaskIsRetryable(stage)).toBe(aiTaskCapabilities(stage).retry);
    }
  });
});
