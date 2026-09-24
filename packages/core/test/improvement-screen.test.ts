/**
 * 改善リクエスト画面の規則 (SYS-IMPSCR-P04)。期待値の正本は docs/improvement-screen/rules.md の表と
 * specs/spec-improvement-screen.md「ビジネスルールと検証」。表を変えたらここも同時に直す。
 *
 * ## 置換前に落ちる理由
 * 旧実装は状態を 4 値 (wontfix を含む) で持ち遷移の表が無く、件名 (title) を一覧に出し、IMP 番号・検索・件数・関連する依頼・
 * アクティビティ・診断の要約が core に無い (import が解決しない)。マスクは口座・メール・秘匿値だけで、金額・電話・住所・辞書が無い。
 */
import { describe, expect, it } from 'vitest';
import {
  IMPROVEMENT_ACTIVITY_KINDS,
  IMPROVEMENT_DRAFT_MESSAGES,
  IMPROVEMENT_ROUTE_LABELS,
  IMPROVEMENT_STATUS_VALUES,
  type ImprovementListSource,
  type ImprovementStatus,
  allowedImprovementTransitions,
  buildImprovementList,
  buildMaskDictionary,
  canTransitionImprovement,
  checkImprovementDraft,
  describeImprovementActivity,
  formatImprovementNumber,
  improvementRouteLabel,
  improvementSummary,
  nextImprovementDoneAt,
  normalizeImprovementListQuery,
  orderImprovementActivities,
  redactPersonalInfo,
  relatedImprovements,
  sanitizeDiagnosticPayload,
  summarizeDiagnosticEnvironment,
} from '../src/index.js';

describe('AC-001 状態の遷移表', () => {
  const table: Record<ImprovementStatus, ImprovementStatus[]> = {
    open: ['in_progress', 'done'],
    in_progress: ['open', 'reconfirm', 'done'],
    reconfirm: ['in_progress', 'done'],
    done: ['in_progress', 'reconfirm'],
  };

  it('4×4 の全組み合わせが表のとおりに判定される (同じ状態は遷移ではない)', () => {
    const got: string[] = [];
    for (const from of IMPROVEMENT_STATUS_VALUES) {
      for (const to of IMPROVEMENT_STATUS_VALUES) {
        if (canTransitionImprovement(from, to)) got.push(`${from}->${to}`);
      }
    }
    const want = Object.entries(table).flatMap(([from, tos]) => tos.map((to) => `${from}->${to}`));
    expect(got.sort()).toEqual(want.sort());
    expect(got).toHaveLength(9);
  });

  it('移れる先は件数タブと同じ並びで返る', () => {
    expect(allowedImprovementTransitions('in_progress')).toEqual(['open', 'done', 'reconfirm']);
    expect(allowedImprovementTransitions('open')).toEqual(['in_progress', 'done']);
  });

  it('done_at は完了に入ったときだけ付き、完了のままなら保たれ、出たら外れる', () => {
    expect(nextImprovementDoneAt('in_progress', 'done', null, 'T1')).toBe('T1');
    expect(nextImprovementDoneAt('done', 'done', 'T0', 'T1')).toBe('T0');
    expect(nextImprovementDoneAt('done', 'reconfirm', 'T0', 'T1')).toBeNull();
  });

  it('状態は wontfix を含まない 4 値', () => {
    expect(IMPROVEMENT_STATUS_VALUES).toEqual(['open', 'in_progress', 'done', 'reconfirm']);
  });
});

describe('AC-002 概要と AC-015 の作成フォーム', () => {
  it('先頭の空行を飛ばし、最初の空でない行を trim する', () => {
    expect(improvementSummary('\n\n  一覧の並びが分かりにくい  \n二行目')).toBe('一覧の並びが分かりにくい');
  });

  it('40 字ちょうどは切らず、41 字は 40 字で切って「…」を付ける', () => {
    const forty = 'あ'.repeat(40);
    expect(improvementSummary(forty)).toBe(forty);
    expect(improvementSummary(`${forty}い`)).toBe(`${forty}…`);
  });

  it('空の本文は空の概要', () => {
    expect(improvementSummary('\n  \n')).toBe('');
  });

  it('本文の空・1000 字超・確認の未チェックで送信できない', () => {
    const ok = { body: 'a'.repeat(1000), privacyConfirmed: true, privacyConsented: true };
    expect(checkImprovementDraft(ok)).toEqual({ ok: true, fields: {}, message: null, length: 1000 });
    expect(checkImprovementDraft({ ...ok, body: '  ' })).toMatchObject({
      ok: false,
      fields: { body: IMPROVEMENT_DRAFT_MESSAGES.bodyEmpty },
    });
    expect(checkImprovementDraft({ ...ok, body: 'a'.repeat(1001) })).toMatchObject({
      ok: false,
      fields: { body: '1000 字以内で入力してください' },
    });
    expect(checkImprovementDraft({ ...ok, privacyConsented: false })).toMatchObject({
      ok: false,
      message: IMPROVEMENT_DRAFT_MESSAGES.privacy,
    });
    expect(checkImprovementDraft({ ...ok, privacyConfirmed: false })).toMatchObject({ ok: false });
  });
});

describe('AC-003 IMP 番号', () => {
  it('3 桁のゼロ詰めで、4 桁以上はそのまま', () => {
    expect([1, 24, 1000].map(formatImprovementNumber)).toEqual(['IMP-001', 'IMP-024', 'IMP-1000']);
  });
});

const row = (seq: number, patch: Partial<ImprovementListSource> = {}): ImprovementListSource => ({
  id: `id-${seq}`,
  seq,
  body: `依頼 ${seq}`,
  route: '/budget',
  status: 'open',
  createdAt: `2026-09-${String(seq).padStart(2, '0')}T00:00:00.000Z`,
  updatedAt: `2026-09-${String(seq).padStart(2, '0')}T00:00:00.000Z`,
  deletedAt: null,
  ...patch,
});

describe('AC-004 検索・件数タブ・ページング・関連する依頼', () => {
  const rows: ImprovementListSource[] = [
    ...Array.from({ length: 12 }, (_, i) => row(i + 1)),
    row(13, { status: 'done', body: 'ＡＢＣ の表示が崩れる', route: '/cash' }),
    row(14, { status: 'in_progress', route: '/cash' }),
    row(15, { status: 'reconfirm', deletedAt: '2026-09-20T00:00:00.000Z' }),
  ];

  it('新しい順に 10 件、件数は削除中を除いた検索後の集合で数える', () => {
    const out = buildImprovementList(rows, { tab: 'all', page: 1 });
    expect(out.items.map((i) => i.number)).toEqual([
      'IMP-014',
      'IMP-013',
      'IMP-012',
      'IMP-011',
      'IMP-010',
      'IMP-009',
      'IMP-008',
      'IMP-007',
      'IMP-006',
      'IMP-005',
    ]);
    expect(out.counts).toEqual({ all: 14, open: 12, in_progress: 1, done: 1, reconfirm: 0 });
    expect(out).toMatchObject({ page: 1, pageSize: 10, total: 14, pageCount: 2 });
  });

  it('範囲外のページは最後のページに倒し、壊れた値は既定に倒す', () => {
    expect(buildImprovementList(rows, { page: 99 }).items.map((i) => i.seq)).toEqual([4, 3, 2, 1]);
    expect(normalizeImprovementListQuery({ q: null, tab: 'wontfix', page: '-3' })).toEqual({
      q: '',
      tab: 'all',
      page: 1,
    });
    expect(normalizeImprovementListQuery({ q: 'x'.repeat(150) }).q).toHaveLength(100);
  });

  it('タブで絞っても件数は検索後の集合のまま', () => {
    const out = buildImprovementList(rows, { tab: 'done' });
    expect(out.items.map((i) => i.number)).toEqual(['IMP-013']);
    expect(out.counts.all).toBe(14);
    expect(out.total).toBe(1);
  });

  it('全角半角・大小を同一視し、IMP 番号は 3 通りの書き方で当たる', () => {
    expect(buildImprovementList(rows, { q: 'abc' }).items.map((i) => i.seq)).toEqual([13]);
    for (const q of ['IMP-013', 'imp-13', '13', 'ｉｍｐ－０１３']) {
      expect(buildImprovementList(rows, { q }).items.map((i) => i.seq)).toContain(13);
    }
    expect(buildImprovementList(rows, { q: '現金入力' }).counts).toEqual({
      all: 2,
      open: 0,
      in_progress: 1,
      done: 1,
      reconfirm: 0,
    });
  });

  it('一覧の項目は概要・画面名・状態ラベルを持つ', () => {
    expect(buildImprovementList(rows, { q: 'IMP-013' }).items[0]).toEqual({
      id: 'id-13',
      seq: 13,
      number: 'IMP-013',
      route: '/cash',
      routeLabel: '現金入力',
      summary: 'ＡＢＣ の表示が崩れる',
      status: 'done',
      statusLabel: '完了',
      createdAt: '2026-09-13T00:00:00.000Z',
      updatedAt: '2026-09-13T00:00:00.000Z',
    });
  });

  it('関連する依頼は同じ route の新しい順に 3 件まで、自分・削除中・空の route を除く', () => {
    expect(relatedImprovements(row(12), rows).map((i) => i.seq)).toEqual([11, 10, 9]);
    expect(relatedImprovements(row(14, { route: '/cash' }), rows).map((i) => i.seq)).toEqual([13]);
    expect(relatedImprovements(row(99, { route: '' }), rows)).toEqual([]);
    expect(relatedImprovements(row(1), [row(1), row(15, { deletedAt: 'x' })])).toEqual([]);
  });

  it('画面名はクエリを落として引き、未知はパス、空は「記録なし」', () => {
    expect(improvementRouteLabel('/analysis/matrix?period=2026')).toBe('マトリックス');
    expect(improvementRouteLabel('/unknown')).toBe('/unknown');
    expect(improvementRouteLabel('')).toBe('記録なし');
    expect(IMPROVEMENT_ROUTE_LABELS['/improvement']).toBe('改善リクエスト');
  });
});

describe('AC-005 アクティビティと診断の要約', () => {
  it('6 種類の見出しと説明', () => {
    const got = IMPROVEMENT_ACTIVITY_KINDS.map((kind) => {
      const v = describeImprovementActivity({
        id: kind,
        kind,
        fromStatus: kind === 'status_changed' ? 'open' : null,
        toStatus: kind === 'status_changed' ? 'in_progress' : kind === 'created' ? 'open' : null,
        createdAt: 'T',
      });
      return [v.title, v.description];
    });
    expect(got).toEqual([
      ['改善リクエストを作成', '受付'],
      ['対応中に変更', '受付 → 対応中'],
      ['プロンプトを再発行', '前に発行したプロンプトは使えなくなりました'],
      ['削除', 'このリクエストを削除しました'],
      ['元に戻す', '削除を取り消しました'],
      ['完了に変更', '対応しない (wontfix) から完了へ移しました'],
    ]);
  });

  it('新しい順に並べ、同時刻は id の降順', () => {
    const base = { fromStatus: null, toStatus: null } as const;
    const out = orderImprovementActivities([
      { ...base, id: 'a', kind: 'created', createdAt: 'T1' },
      { ...base, id: 'c', kind: 'reissued', createdAt: 'T2' },
      { ...base, id: 'b', kind: 'migrated_wontfix', createdAt: 'T1' },
    ]);
    expect(out.map((a) => a.id)).toEqual(['c', 'b', 'a']);
  });

  it('OS・ブラウザ (版を伏せる)・画面サイズ・利用環境・末尾 4 桁のセッション ID', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    expect(
      summarizeDiagnosticEnvironment({
        userAgent: ua,
        viewport: '1440x900',
        sessionId: '0f1e2d3c-aaaa-bbbb-cccc-1234a3f2',
        origin: 'https://kanjo.example.com',
      }),
    ).toEqual({
      os: 'macOS',
      browser: 'Chrome（マスク済み）',
      viewport: '1440 × 900',
      environment: '本番環境',
      sessionIdMasked: '****-****-****-a3f2',
    });
    expect(
      summarizeDiagnosticEnvironment({ userAgent: '', viewport: '', origin: 'http://localhost:4175' }),
    ).toEqual({
      os: '不明',
      browser: '不明',
      viewport: '不明',
      environment: 'ローカル環境',
      sessionIdMasked: '記録なし',
    });
  });

  it('web が記録する「幅x高さ@倍率」の倍率を落として画面サイズにする', () => {
    expect(summarizeDiagnosticEnvironment({ userAgent: '', viewport: '1280x800@2' }).viewport).toBe(
      '1280 × 800',
    );
    expect(summarizeDiagnosticEnvironment({ userAgent: '', viewport: '390x844@3.5' }).viewport).toBe(
      '390 × 844',
    );
  });

  it('sessionId と origin は診断の正規化を通っても残り、識別子の文字以外は落ちる', () => {
    const out = sanitizeDiagnosticPayload({
      environment: {
        userAgent: 'ua',
        language: 'ja',
        viewport: '1x1',
        route: '/budget',
        capturedAt: '2026-09-24T00:00:00.000Z',
        sessionId: 'ab<c>d-1',
        origin: 'http://localhost:4175',
      },
      entries: [],
      omittedCount: 0,
    });
    expect(out.environment.sessionId).toBe('abcd-1');
    expect(out.environment.origin).toBe('http://localhost:4175');
  });
});

describe('AC-006 マスク (7 種と秘匿値)', () => {
  const dict = buildMaskDictionary(['スターバックス', '山田 太郎', ' ', 'A', '***x']);

  it('辞書は 2 字未満・伏字を含む語を除き、長い順', () => {
    expect(dict.terms).toEqual(['スターバックス', '山田 太郎']);
  });

  it.each([
    ['口座', '口座番号 1234567 に振込', '1234567'],
    ['取引先名', 'スターバックスの明細が二重', 'スターバックス'],
    ['金額 (円)', '12,800円 の支払いが出ない', '12,800'],
    ['金額 (記号)', '￥3,000 が合わない', '3,000'],
    ['個人名', '山田 太郎 さんの名義', '山田 太郎'],
    ['メール', '連絡は taro@example.com へ', 'taro@example.com'],
    ['電話', '電話 090-1234-5678 まで', '090-1234-5678'],
    ['住所', '東京都千代田区丸の内1-1 から', '千代田区'],
    ['秘匿値', 'Authorization: Bearer abcdef0123456789', 'abcdef0123456789'],
  ])('%s が伏せられる', (_kind, input, secret) => {
    const out = redactPersonalInfo(input, dict);
    expect(out).not.toContain(secret);
    expect(out).toContain('***');
  });

  it('状態コードや日付は伏せない', () => {
    expect(redactPersonalInfo('HTTP 500 が 2026-09-24 に出た', dict)).toBe('HTTP 500 が 2026-09-24 に出た');
  });
});
