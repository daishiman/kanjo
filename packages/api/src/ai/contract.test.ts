import { describe, expect, it } from 'vitest';
import {
  SECTION_IDS,
  buildPrompt,
  legacyPeriod,
  normalizeReport,
  periodLabel,
  periodSchema,
  rangeMonths,
  reportInputSchema,
  reportTypeOf,
  sanitizeText,
  taskCreateSchema,
  upgradeBody,
} from './contract.js';

import { CHART_CATALOG, type ChartResult } from './catalog.js';

const LONG = '本文'.repeat(50); // 100字(節の最低文字数80を満たす)
const SUMMARY = '要約'.repeat(40); // 80字(サマリーの最低文字数60を満たす)
const section = (id: (typeof SECTION_IDS)[number], body = LONG) => ({
  id,
  body,
  items: Array.from({ length: 3 }, (_, i) => ({ label: `行${i}`, amount: 1000 })),
});
const fiveSections = () => SECTION_IDS.map((id) => section(id));
const finding = (label: string) => ({
  label,
  fact: '通信費が3ヶ月平均で月42,000円(前期比+12,000円)',
  basis: 'biz.expenseByAccount.通信費 の 2026-06〜2026-08 合計÷3',
  interpretation: '固定費(CV 0.2)で水準が一段上がっており、一時的なブレではない',
  action: '回線契約を1本にまとめる',
  expectedEffect: 8000,
  amount: 42000,
  priority: 'high' as const,
});
const keyFindings = () => ({
  improvements: [finding('通信費')],
  wasted: [finding('重複サブスク')],
  quickWins: [],
  notes: { quickWins: '今期は即効性のある削減対象が見当たらなかった' },
});
/** 図表カタログ全図の枠。available にした図だけダミーの数値を入れる */
const chartsWith = (available: string[]): ChartResult[] =>
  CHART_CATALOG.map((c) => ({
    id: c.id,
    figure: c.figure,
    title: c.title,
    kind: c.kind,
    unit: c.unit,
    purpose: c.purpose,
    readingGuide: c.readingGuide,
    requiredData: c.requiredData,
    available: available.includes(c.id),
    reason: available.includes(c.id) ? null : 'データ不足',
    monthsNeeded: available.includes(c.id) ? null : 3,
    granularity: available.includes(c.id) ? 'month' : null,
    data: available.includes(c.id) ? { labels: ['2026-08'], series: [{ label: 'x', data: [1] }] } : null,
    status: available.includes(c.id) ? 'ok' : 'source_missing',
    detail: '',
  }));
const validInput = () => ({
  generatedBy: 'test',
  analysisDepth: 'standard' as const,
  summary: `${SUMMARY} 図2が示すとおり上位2科目で6割を占める。`,
  keyFindings: keyFindings(),
  sections: fiveSections(),
  charts: [{ catalogId: 'composition', caption: '上位2科目(通信費・外注費)で経費の62%を占める' }],
  contextAnalysis: {
    externalResearch: 'off' as const,
    questionType: 'trend' as const,
    question: { decision: '費用を見直す', metric: '通信費', comparison: '直近3ヶ月', range: '対象期間' },
    interviewFacts: [],
    statisticalFacts: [],
    interpretations: [],
    externalEvidence: [],
    causalHypotheses: [],
  },
});
const PERIOD = { from: '2026-08', to: '2026-08' };

describe('AI分析レポートの契約', () => {
  it('v4は深度と事実→解釈の参照を必須にする', () => {
    const base = validInput();
    expect(reportInputSchema.safeParse({ ...base, analysisDepth: undefined }).success).toBe(false);
    // 背景分析は兄弟の節と同じく任意。契約 v3 のまま送ってくるレポートを 400 にしない
    expect(reportInputSchema.safeParse({ ...base, contextAnalysis: undefined }).success).toBe(true);
    const withBrokenRef = {
      ...base,
      contextAnalysis: {
        ...base.contextAnalysis,
        statisticalFacts: [
          {
            id: 'fact-1',
            statement: '通信費は3ヶ月連続で増加している',
            basis: 'biz.expenseByAccount',
            evidenceRefs: ['biz.expenseByAccount'],
          },
        ],
        interpretations: [
          { statement: '固定費化した可能性がある', factRefs: ['missing'], limitation: '契約内容は未確認' },
        ],
      },
    };
    expect(reportInputSchema.safeParse(withBrokenRef).success).toBe(false);
  });

  it('背景仮説は主/対立と根拠種別の参照先を整合させる', () => {
    const base = validInput();
    const hypothesis = {
      role: 'primary' as const,
      hypothesis: '利用者が回答した事業変化と通信費が関連した可能性がある',
      cause: '新しい事業の開始',
      mechanism: '回線を追加した',
      outcome: '通信費が増えた',
      evidenceFor: ['開始後に通信費が増えた'],
      evidenceAgainst: ['回線別請求は未確認'],
      confounders: ['単価改定でも説明できる'],
      falsificationCondition: '回線が追加されていない',
      evidenceLevel: 'user_reported' as const,
      evidenceRefs: ['interview-change'],
      confidence: 'low' as const,
      validationAction: '通信契約を確認する',
    };
    const context = {
      ...base.contextAnalysis,
      interviewFacts: [
        {
          id: 'interview-change',
          source: 'user_reported' as const,
          question: '期間中の変化',
          answer: '新しい事業を始めた',
        },
      ],
      causalHypotheses: [hypothesis],
    };
    expect(reportInputSchema.safeParse({ ...base, contextAnalysis: context }).success).toBe(false);
    expect(
      reportInputSchema.safeParse({
        ...base,
        contextAnalysis: {
          ...context,
          causalHypotheses: [hypothesis, { ...hypothesis, role: 'alternative', evidenceRefs: ['missing'] }],
        },
      }).success,
    ).toBe(false);
    expect(
      reportInputSchema.safeParse({
        ...base,
        contextAnalysis: {
          ...context,
          causalHypotheses: [hypothesis, { ...hypothesis, role: 'alternative' }],
        },
      }).success,
    ).toBe(true);
  });

  it('期間は 開始年月<=終了年月 かつ 61ヶ月以内だけを受け付ける', () => {
    expect(periodSchema.safeParse({ from: '2026-08', to: '2026-08' }).success).toBe(true);
    expect(periodSchema.safeParse({ from: '2025-08', to: '2026-08' }).success).toBe(true);
    expect(periodSchema.safeParse({ from: '2026-09', to: '2026-08' }).success).toBe(false);
    expect(periodSchema.safeParse({ from: '2026-13', to: '2026-13' }).success).toBe(false);
    expect(periodSchema.safeParse({ from: '2020-01', to: '2026-08' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ from: '2026-08', to: '2026-08', supplement: 'x' }).success).toBe(
      true,
    );
  });

  it('期間の長さからレポートの型を決める(1=月次, 2〜13=年次, 14以上=長期)', () => {
    expect(reportTypeOf({ from: '2026-08', to: '2026-08' })).toBe('monthly');
    expect(reportTypeOf({ from: '2026-06', to: '2026-08' })).toBe('annual');
    expect(reportTypeOf({ from: '2025-08', to: '2026-08' })).toBe('annual');
    expect(reportTypeOf({ from: '2025-07', to: '2026-08' })).toBe('longterm');
    expect(rangeMonths({ from: '2025-11', to: '2026-02' })).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(periodLabel({ from: '2026-08', to: '2026-08' })).toBe('2026年8月(月次)');
    expect(periodLabel({ from: '2025-08', to: '2026-08' })).toBe('2025年8月〜2026年8月(13ヶ月・年次)');
    expect(legacyPeriod('year', '2026')).toEqual({ from: '2026-01', to: '2026-12' });
    expect(legacyPeriod('month', '2026-08')).toEqual({ from: '2026-08', to: '2026-08' });
  });

  it('HTMLタグ・制御文字を落とし、改行は2連続までに丸める', () => {
    expect(sanitizeText('a<script>alert(1)</script>bc\n\n\n\nd')).toBe('aalert(1)bc\n\nd');
    expect(sanitizeText('<b>太字</b> と &lt;x&gt;')).toBe('太字 と  x');
    expect(sanitizeText('a\u0007bc')).toBe('abc');
  });

  it('5節が揃わないレポートは受け付けない', () => {
    const input = reportInputSchema.parse(validInput());
    const r = normalizeReport(
      { ...input, sections: input.sections.filter((x) => x.id !== 'split') },
      PERIOD,
      chartsWith(['composition']),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected ng');
    expect(r.code).toBe('missing_sections');
    expect(r.missing).toEqual(['split']);
  });

  it('任意の文字列欄(note / title / gap / notes)は null でも受け付ける(ローカル検査と同じ扱い)', () => {
    const v = validInput();
    const input = {
      ...v,
      title: null,
      model: null,
      keyFindings: { ...v.keyFindings, notes: { quickWins: v.keyFindings.notes.quickWins, wasted: null } },
      sections: v.sections.map((s) => ({
        ...s,
        title: null,
        gap: null,
        items: s.items.map((it) => ({ ...it, note: null, priority: null })),
      })),
    };
    const parsed = reportInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error('expected ok');
    const r = normalizeReport(parsed.data, PERIOD, chartsWith(['composition']));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('expected ok');
    expect(r.body.sections[0].items[0].note).toBe('');
    expect(r.body.keyFindings.notes.wasted).toBe('');
  });

  it('短すぎる本文・3段のない要点はスキーマで弾く(要望23)', () => {
    expect(reportInputSchema.safeParse({ ...validInput(), summary: '短い' }).success).toBe(false);
    expect(
      reportInputSchema.safeParse({
        ...validInput(),
        sections: SECTION_IDS.map((id) => section(id, '短い本文')),
      }).success,
    ).toBe(false);
    const noAction = { ...finding('x'), action: '' };
    expect(
      reportInputSchema.safeParse({ ...validInput(), keyFindings: { ...keyFindings(), wasted: [noAction] } })
        .success,
    ).toBe(false);
    // 図の数値は受け取らない(catalogId と caption だけ)
    expect(
      reportInputSchema.safeParse({
        ...validInput(),
        charts: [{ id: 'exp', kind: 'bar', title: 't', labels: ['a'], series: [{ label: 's', data: [1] }] }],
      }).success,
    ).toBe(false);
  });

  it('節の最低行数・空の要点分類・図の参照を規則として検査する(要望23)', () => {
    const base = reportInputSchema.parse(validInput());
    // 行数不足 + gap なし
    const fewItems = {
      ...base,
      sections: base.sections.map((x) => (x.id === 'spend' ? { ...x, items: [] } : x)),
    };
    let r = normalizeReport(fewItems, PERIOD, chartsWith(['composition']));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected ng');
    expect(r.code).toBe('report_rules');
    expect(r.issues.join('\n')).toContain('節 spend');
    // 行数不足でも gap に理由があれば通る
    const withGap = {
      ...base,
      sections: base.sections.map((x) =>
        x.id === 'spend' ? { ...x, items: [], gap: '対象月の経費が未記帳のため' } : x,
      ),
    };
    expect(normalizeReport(withGap, PERIOD, chartsWith(['composition'])).ok).toBe(true);
    // 空の分類に notes が無い
    r = normalizeReport(
      { ...base, keyFindings: { ...base.keyFindings, notes: {} } },
      PERIOD,
      chartsWith(['composition']),
    );
    if (r.ok) throw new Error('expected ng');
    expect(r.issues.join('\n')).toContain('keyFindings.quickWins');
    // 出せる図に caption が無い / 本文で参照されていない
    r = normalizeReport(base, PERIOD, chartsWith(['composition', 'pareto']));
    if (r.ok) throw new Error('expected ng');
    expect(r.issues.join('\n')).toContain('図7');
    // カタログ外の id
    r = normalizeReport(
      {
        ...base,
        charts: [...(base.charts ?? []), { catalogId: 'made_up', caption: '架空の図の説明文です' }],
      },
      PERIOD,
      chartsWith(['composition']),
    );
    if (r.ok) throw new Error('expected ng');
    expect(r.issues.join('\n')).toContain('made_up');
    // 出せない図を本文が参照している
    r = normalizeReport(base, PERIOD, chartsWith([]));
    if (r.ok) throw new Error('expected ng');
    expect(r.issues.join('\n')).toContain('図2');
  });

  it('節を既定の順に並べ、題名の既定値と無害化を適用する', () => {
    const input = reportInputSchema.parse({
      ...validInput(),
      generatedBy: 'claude-code',
      summary: `<p>${SUMMARY}</p>`,
      sections: [...SECTION_IDS].reverse().map((id) => ({
        id,
        body: `<i>${LONG}</i>`,
        items: [{ label: '<b>Adobe</b>', amount: 6480, priority: 'high' }],
        gap: '<b>行数が足りない理由</b>(データ不足)',
      })),
      charts: [],
      dataGaps: ['', '前年の個人支出が無い'],
    });
    const r = normalizeReport(input, { from: '2026-01', to: '2026-12' }, chartsWith([]));
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.body.version).toBe(4);
    expect(r.body.sections.map((x) => x.id)).toEqual([...SECTION_IDS]);
    expect(r.body.title).toBe('2026年1月〜2026年12月(12ヶ月・年次)の会計分析');
    expect(r.body.summary).toBe(SUMMARY);
    expect(r.body.sections[0].title).toBe('何にいくらかかっているか');
    expect(r.body.sections[0].items[0]).toEqual({ label: 'Adobe', amount: 6480, note: '', priority: 'high' });
    expect(r.body.sections[0].gap).toBe('行数が足りない理由(データ不足)');
    expect(r.body.dataGaps).toEqual(['前年の個人支出が無い']);
    expect(r.body.keyFindings.quickWins).toEqual([]);
    expect(r.body.keyFindings.notes.quickWins).toContain('見当たらなかった');
    // 図は出せない図も枠として全件保存される(要望23c)
    expect(r.body.charts).toHaveLength(CHART_CATALOG.length);
    expect(r.body.charts.every((c) => !c.available && c.reason)).toBe(true);
    expect(r.body.needs).toEqual([]);
    expect(r.body.followUp).toBeNull();
  });

  it('要点の3段・図のスナップショット・必要な情報を整える(要望25b: 数値はアプリ側)', () => {
    const input = reportInputSchema.parse({
      ...validInput(),
      generatedBy: 'codex',
      keyFindings: {
        ...keyFindings(),
        wasted: [
          { ...finding('<b>重複サブスク</b>'), chart: 'subs_vendor' },
          { ...finding('x'), chart: 'nope' },
        ],
      },
      needs: [
        { gap: '個人の家賃が未仕分け', action: '公私仕分けで家賃を「個人」にする', screen: 'classify' },
        { gap: '不明画面', action: 'x', screen: 'nowhere' },
      ],
      followUp: { body: '前回の指摘のうち Adobe 解約は実行済み', items: [] },
    });
    const r = normalizeReport(input, { from: '2026-06', to: '2026-08' }, chartsWith(['composition']));
    if (!r.ok) throw new Error(r.issues.join('\n'));
    expect(r.body.keyFindings.wasted[0].label).toBe('重複サブスク');
    expect(r.body.keyFindings.wasted[0].chart).toBe('subs_vendor');
    expect(r.body.keyFindings.wasted[1].chart).toBeNull();
    expect(r.body.keyFindings.wasted[0].expectedEffect).toBe(8000);
    const fig2 = r.body.charts.find((c) => c.id === 'composition');
    expect(fig2?.available).toBe(true);
    expect(fig2?.caption).toContain('62%');
    // 数値は AI の入力ではなくアプリの計算結果がそのまま入る
    expect(fig2?.data).toEqual({ labels: ['2026-08'], series: [{ label: 'x', data: [1] }] });
    expect(r.body.needs.map((n) => n.screen)).toEqual(['classify', null]);
    expect(r.body.followUp?.body).toContain('Adobe');
  });

  it('保存済みの旧形式(version 1 / 2)も v4 の形に読み替える', () => {
    const b = upgradeBody({
      version: 1,
      generatedBy: 'x',
      title: 't',
      summary: 's',
      sections: [],
      dataGaps: ['a'],
    });
    expect(b.version).toBe(4);
    expect(b.keyFindings.improvements).toEqual([]);
    expect(b.keyFindings.notes.wasted).toBe('');
    expect(b.charts).toEqual([]);
    expect(b.needs).toEqual([]);
    expect(b.dataGaps).toEqual(['a']);
    const v2 = upgradeBody({
      version: 2,
      generatedBy: 'x',
      summary: 's',
      keyFindings: { wasted: [{ label: '重複', amount: 12000, note: '二重契約', priority: 'high' }] },
      sections: [{ id: 'spend', title: 't', body: 'b', items: [] }],
      charts: [
        {
          id: 'exp',
          kind: 'line',
          title: '月別',
          labels: ['2026-08'],
          series: [{ label: 'e', data: [1] }],
          note: 'n',
        },
      ],
    });
    expect(v2.keyFindings.wasted[0].fact).toBe('重複 12,000円');
    expect(v2.keyFindings.wasted[0].interpretation).toBe('二重契約');
    expect(v2.keyFindings.wasted[0].action).toBe('');
    expect(v2.sections[0].gap).toBeNull();
    expect(v2.charts[0]).toMatchObject({ id: 'exp', kind: 'line', figure: 0, available: true, caption: 'n' });
    expect(v2.charts[0].data?.labels).toEqual(['2026-08']);
  });

  it('指示文にスキル名・取得先・送信先・トークン・期間・補足情報が入る', () => {
    const p = buildPrompt({
      origin: 'http://localhost:8787',
      taskId: 't1',
      token: 'kjo_abc',
      period: { from: '2025-08', to: '2026-08' },
      expiresAt: '2026-08-26T01:02:00.000Z',
      target: 'claude_code',
      supplement: '家賃は事業用に按分済み',
      parentReportId: 'r0',
    });
    expect(p).toContain('Skill「run-kanjo-accounting-report」');
    expect(p).toContain('http://localhost:8787/api/ai/tasks/t1/data');
    expect(p).toContain('http://localhost:8787/api/ai/tasks/t1/report');
    expect(p).toContain('Bearer kjo_abc');
    expect(p).toContain('2025年8月〜2026年8月(13ヶ月・年次)');
    expect(p).toContain('家賃は事業用に按分済み');
    expect(p).toContain('データ不足');
    expect(p).toContain('図N');
    expect(p).toContain('expectedEffect');
  });

  it('背景分析の無いレポートを受け付け、空の節を作らず null で残す', () => {
    const { contextAnalysis: _omitted, ...withoutContext } = validInput();
    const parsed = reportInputSchema.safeParse(withoutContext);
    expect(parsed.success).toBe(true);
    const r = normalizeReport(
      parsed.success ? parsed.data : (withoutContext as never),
      PERIOD,
      chartsWith(['composition']),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.contextAnalysis).toBeNull();
    // 他の節は今までどおり保存される (任意化が本文全体を落としていないことの確認)
    expect(r.body.sections).toHaveLength(SECTION_IDS.length);
  });

  it('指示文はコピー先ごとに道具名と Skill の置き場所が変わる', () => {
    const base = {
      origin: 'http://localhost:8787',
      taskId: 't1',
      token: 'kjo_abc',
      period: { from: '2026-08', to: '2026-08' },
      expiresAt: '2026-08-26T01:02:00.000Z',
    };
    const claude = buildPrompt({ ...base, target: 'claude_code' });
    const codex = buildPrompt({ ...base, target: 'codex' });
    expect(claude).toContain('Claude Code で');
    expect(claude).toContain('.claude/skills/run-kanjo-accounting-report/SKILL.md');
    expect(codex).toContain('Codex で');
    expect(codex).toContain('.agents/skills/run-kanjo-accounting-report/SKILL.md');
    expect(claude).not.toBe(codex);
    // 変わるのは宛先の1行だけ。トークン・期間・期限・守ることは同じ依頼のまま
    const rest = (p: string) => p.split('\n').slice(1).join('\n');
    expect(rest(claude)).toBe(rest(codex));
    expect(rest(claude)).toContain('Bearer kjo_abc');
  });
});
