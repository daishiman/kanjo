/** D1起動不要のquery budget・restore projection契約。fixtureはすべて架空値。 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type FreeeDeal, type MfTx, emptyDataset } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_MUTATION_ROUTES,
  SELF_MANAGED_IMPORT_CONSUMERS,
  classifyCanonicalMutation,
} from './canonical-mutation-fence.js';
import { JSON_SNAPSHOT_MUTATION_CONSUMERS } from './import-active.js';
import {
  D1_FREE_QUERY_LIMIT,
  D1_JSON_PAYLOAD_MAX_BYTES,
  buildMfResolutionAuditStatements,
  chunkJsonRowsByBytes,
  freeeCommitStatements,
  mfCommitStatements,
  planMultipartImportQueries,
  planRestoreImportQueries,
  prepareRestoreWriteSet,
  restoreCommitStatements,
  restoreWriteSetFingerprint,
  shrinkingMonths,
} from './import-lifecycle.js';

const fakeStatement = {
  bind() {
    return fakeStatement;
  },
} as unknown as D1PreparedStatement;
const fakeDb = { prepare: () => fakeStatement } as unknown as D1Database;

describe('D1 statement budget', () => {
  it('0046で追加したルールと編集の列をJSON復元で落とさない', () => {
    const data = emptyDataset();
    data.rules = [
      {
        k: '会議',
        cls: 'biz',
        big: '会議費',
        mid: '打合せ',
        owner: 'business',
        payee: '架空商店',
        scope: 'unconfirmed',
        splitTemplate: {
          lines: [
            { kind: 'fixed', amount: 300, cls: 'biz', big: '会議費', memo: '架空固定' },
            { kind: 'remainder', cls: 'biz', big: '雑費', memo: '架空残額' },
          ],
        },
      },
    ];
    data.edits['synthetic-0046'] = {
      cls: 'biz',
      paymentMethod: 'card',
      matchedProposal: 1,
    };

    const writeSet = prepareRestoreWriteSet({
      userId: 'synthetic-user',
      data,
      restored: emptyDataset(),
    });

    expect(writeSet.ruleRows[0]).toEqual([
      '会議',
      'biz',
      '会議費',
      '打合せ',
      'business',
      '架空商店',
      'unconfirmed',
      JSON.stringify(data.rules[0].splitTemplate),
      0,
    ]);
    expect(writeSet.editRows[0].slice(-2)).toEqual(['card', 1]);

    const sql: string[] = [];
    const statement = {
      bind() {
        return statement;
      },
    } as unknown as D1PreparedStatement;
    const recordingDb = {
      prepare(query: string) {
        sql.push(query);
        return statement;
      },
    } as unknown as D1Database;
    restoreCommitStatements({
      database: recordingDb,
      userId: 'synthetic-user',
      runId: 'synthetic-run',
      writeSet,
      importId: 1,
      contentHash: 'v2:synthetic',
      targetKeys: ['json:global'],
    });
    expect(sql.join('\n')).toContain('split_template_json');
    expect(sql.join('\n')).toContain('payment_method');
    expect(sql.join('\n')).toContain('matched_proposal');
  });

  it('import-resolution監査のstatement数をcanonical commitと同じ予算に足す', async () => {
    const common = {
      database: fakeDb,
      userId: 'synthetic-user',
      runId: 'synthetic-run',
      months: ['2026-07'],
      importId: 1,
      contentHash: 'v2:synthetic',
      targetKeys: ['mf:2026-07'],
      data: emptyDataset(),
      txs: [] as MfTx[],
    };
    const resolution = {
      edits: [],
      memories: [],
      autoEdits: [],
      auditDecisions: [
        {
          txIdentity: 'synthetic-tx',
          attribute: 'cls' as const,
          before: 'per',
          after: 'biz',
          reason: 'rule_match',
          sourceType: 'rule' as const,
          sourceIdentity: 'synthetic-rule',
        },
      ],
    };
    const audit = await buildMfResolutionAuditStatements({
      database: fakeDb,
      userId: common.userId,
      runId: common.runId,
      importId: common.importId,
      resolution,
      occurredAt: '2026-09-03T00:00:00.000Z',
    });
    const withoutAudit = mfCommitStatements({ ...common, resolution }).length;
    const withAudit = mfCommitStatements({ ...common, resolution, audit }).length;
    expect(audit).not.toBeNull();
    expect(withAudit).toBe(withoutAudit + (audit?.queryCount ?? 0));
    expect(
      planMultipartImportQueries({
        fileCount: 1,
        unitCount: 1,
        applicableUnitCount: 1,
        jsonUnitCount: 0,
        commitStatementCounts: [withAudit],
      }).breakdown.commitStatements,
    ).toBe(withAudit);
  });

  it('5,000行のfreee/MF unitと自動適用planを実builderで予算判定する', () => {
    const data = emptyDataset();
    const deals: FreeeDeal[] = Array.from({ length: 5_000 }, (_, index) => ({
      month: '2026-07',
      date: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
      io: 'expense',
      partner: `架空取引先-${index}`,
      accountRaw: '架空通信費',
      accountNorm: '架空通信費',
      amount: index + 1,
    }));
    const txs: MfTx[] = Array.from({ length: 5_000 }, (_, index) => ({
      id: `synthetic-${index}`,
      m: '2026-07',
      d: `07/${String((index % 28) + 1).padStart(2, '0')}`,
      c: `架空明細-${index}`,
      a: -(index + 1),
      big: '架空費',
      mid: '架空内訳',
      inst: '架空口座',
    }));
    const common = {
      database: fakeDb,
      userId: 'synthetic-user',
      runId: 'synthetic-run',
      months: ['2026-07'],
      importId: 1,
      contentHash: 'v2:synthetic',
      data,
    };
    const freeeQueries = freeeCommitStatements({ ...common, deals, targetKeys: ['freee:2026-07'] }).length;
    const mfQueries = mfCommitStatements({ ...common, txs, targetKeys: ['mf:2026-07'] }).length;
    const mfAutoQueries = mfCommitStatements({
      ...common,
      txs,
      targetKeys: ['mf:2026-07'],
      resolution: {
        edits: [],
        memories: [],
        autoEdits: txs.map((tx, index) => ({
          txId: tx.id,
          vendorKey: `synthetic-vendor-${index}`,
          cls: 'biz',
          big: '架空費',
          mid: '架空内訳',
          owner: 'business',
          stableKey: `v1:mf:synthetic-${index}`,
        })),
      },
    }).length;
    const plan = (commitStatements: number) =>
      planMultipartImportQueries({
        fileCount: 1,
        unitCount: 1,
        applicableUnitCount: 1,
        jsonUnitCount: 0,
        commitStatementCounts: [commitStatements],
      });
    expect(plan(freeeQueries)).toMatchObject({ accepted: true });
    expect(plan(mfQueries)).toMatchObject({ accepted: true });
    // 5,000件すべてへ長いprovenanceを保存するケースは、
    // payloadの分割数を含めた実行前見積りでFree枠超過として拒否する。
    expect(plan(mfAutoQueries)).toMatchObject({ accepted: false });
    expect(plan(freeeQueries).total).toBeLessThan(D1_FREE_QUERY_LIMIT);
    expect(plan(mfQueries).total).toBeLessThan(D1_FREE_QUERY_LIMIT);
    expect(plan(mfAutoQueries).total).toBeGreaterThanOrEqual(D1_FREE_QUERY_LIMIT);
  });

  it('cache行も実builderから予算化し、49 queriesは受理、50 queriesは拒否する', () => {
    const base = {
      fileCount: 1,
      unitCount: 1,
      applicableUnitCount: 1,
      jsonUnitCount: 0,
    };
    const accepted = planMultipartImportQueries({ ...base, commitStatementCounts: [21] });
    const rejected = planMultipartImportQueries({ ...base, commitStatementCounts: [22] });
    expect(accepted).toMatchObject({ total: 49, accepted: true });
    expect(rejected).toMatchObject({ total: 50, accepted: false });

    const aggregateHeavy = emptyDataset();
    aggregateHeavy.months = ['2026-07'];
    aggregateHeavy.personal['2026-07'] = {
      income: {},
      expense: Object.fromEntries(
        Array.from({ length: 5_000 }, (_, index) => [`架空集計-${index}-${'長'.repeat(320)}`, index + 1]),
      ),
    };
    const commitStatements = freeeCommitStatements({
      database: fakeDb,
      userId: 'synthetic-user',
      runId: 'synthetic-run',
      deals: [],
      months: ['2026-07'],
      importId: 1,
      contentHash: 'v2:synthetic',
      targetKeys: ['freee:2026-07'],
      data: aggregateHeavy,
    }).length;
    expect(planMultipartImportQueries({ ...base, commitStatementCounts: [commitStatements] }).accepted).toBe(
      false,
    );
  });

  it('freee/MF/restoreの各plannerで49 queriesを受理し50を拒否する', () => {
    const multipartBase = {
      fileCount: 1,
      unitCount: 1,
      applicableUnitCount: 1,
      jsonUnitCount: 0,
    };
    for (const kind of ['freee', 'mf'] as const) {
      const accepted = planMultipartImportQueries({ ...multipartBase, commitStatementCounts: [21] });
      const rejected = planMultipartImportQueries({ ...multipartBase, commitStatementCounts: [22] });
      expect({ kind, total: accepted.total, accepted: accepted.accepted }).toEqual({
        kind,
        total: 49,
        accepted: true,
      });
      expect(rejected).toMatchObject({ total: 50, accepted: false });
    }
    const restoreBase = planRestoreImportQueries(0).total;
    expect(planRestoreImportQueries(49 - restoreBase)).toMatchObject({ total: 49, accepted: true });
    expect(planRestoreImportQueries(50 - restoreBase)).toMatchObject({ total: 50, accepted: false });
  });

  it('実builderがfreee/MF/restoreすべて49未満のenvelopeに収まる', () => {
    const wide = '幅'.repeat(20_000);
    const data = emptyDataset();
    const common = {
      database: fakeDb,
      userId: 'synthetic-user',
      runId: 'synthetic-run',
      months: ['2026-07'],
      importId: 1,
      contentHash: 'v2:synthetic',
      data,
    };
    const deals: FreeeDeal[] = Array.from({ length: 10 }, (_, index) => ({
      month: '2026-07',
      date: '2026-07-01',
      io: 'expense',
      partner: `${index}-${wide}`,
      accountRaw: '架空費',
      accountNorm: '架空費',
      amount: index + 1,
    }));
    const txs: MfTx[] = Array.from({ length: 10 }, (_, index) => ({
      id: `synthetic-${index}`,
      m: '2026-07',
      d: '07/01',
      c: `${index}-${wide}`,
      a: -(index + 1),
      big: '架空費',
      mid: '架空内訳',
      inst: '架空口座',
    }));
    const freeeCount = freeeCommitStatements({
      ...common,
      deals,
      targetKeys: ['freee:2026-07'],
    }).length;
    const mfCount = mfCommitStatements({ ...common, txs, targetKeys: ['mf:2026-07'] }).length;
    expect(freeeCount).toBe(19);
    // 証憑の親付け替え(reconcileMfAttachmentParents)が無くなり、MFもfreeeと同じ19本
    expect(mfCount).toBe(19);
    expect(
      planMultipartImportQueries({
        fileCount: 1,
        unitCount: 1,
        applicableUnitCount: 1,
        jsonUnitCount: 0,
        commitStatementCounts: [freeeCount],
      }),
    ).toMatchObject({ total: 47, accepted: true });
    expect(
      planMultipartImportQueries({
        fileCount: 1,
        unitCount: 1,
        applicableUnitCount: 1,
        jsonUnitCount: 0,
        commitStatementCounts: [mfCount],
      }),
    ).toMatchObject({ total: 47, accepted: true });

    const writeSet = prepareRestoreWriteSet({ userId: common.userId, data, restored: emptyDataset() });
    writeSet.editRows = Array.from({ length: 6 }, (_, index) => [
      `synthetic-${index}`,
      null,
      null,
      null,
      null,
      null,
      null,
      wide,
      null,
    ]);
    const restoreCount = restoreCommitStatements({
      database: fakeDb,
      userId: common.userId,
      runId: common.runId,
      writeSet,
      importId: common.importId,
      contentHash: common.contentHash,
      targetKeys: ['json:global'],
    }).length;
    expect(planRestoreImportQueries(restoreCount)).toMatchObject({ total: 48, accepted: true });
  });

  /**
   * 0041 で総収支の判断3表が復元対象へ入り、復元1回の statement が3本増えた。
   * 移行先が空なら DELETE を撃たない経路が効いていないと、この3本ぶんで上限に当たり、
   * freee 明細を1件でも持つ利用者のバックアップ復元が必ず 413 になる。
   */
  it('総収支の判断3表を積んだ復元が、白紙の移行先で上限未満に収まる', () => {
    const decisions = {
      subVendorReviewDecisions: [],
      // 0040 の2表。key があれば置き換え対象なので、行が空でも DELETE の条件判定に入る
      reviewSnoozes: [],
      monthlyCloseReviews: [],
      duplicateVerdicts: [
        {
          txId: 'synthetic-tx',
          verdict: 'same',
          stableKey: null,
          fingerprintVersion: null,
          decidedAt: null,
          updatedAt: null,
          freeeKey: null,
        },
      ],
      freeeDealExclusions: [
        {
          freeeKey: 'synthetic-freee',
          reason: '架空の理由',
          reasonCode: 'other',
          memo: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
      totalCashflowOperations: [
        {
          id: 'synthetic-op',
          kind: 'exclude',
          itemsJson: '[]',
          itemCount: 0,
          undoesId: null,
          undoneAt: null,
          createdAt: '2026-08-20T00:00:00.000Z',
        },
      ],
    };
    const emptyDestination = {
      subVendorReviewDecisions: 0,
      reviewSnoozes: 0,
      monthlyCloseReviews: 0,
      duplicateVerdicts: 0,
      freeeDealExclusions: 0,
      totalCashflowOperations: 0,
      rules: 0,
      txEdits: 0,
      institutionOwners: 0,
      budgets: 0,
      cashOverrides: 0,
    };
    const countFor = (existingDestinationRowCounts?: typeof emptyDestination) =>
      restoreCommitStatements({
        database: fakeDb,
        userId: 'synthetic-user',
        runId: 'synthetic-run',
        writeSet: prepareRestoreWriteSet({
          userId: 'synthetic-user',
          data: emptyDataset(),
          restored: emptyDataset(),
          ...decisions,
          existingDestinationRowCounts,
        }),
        importId: 1,
        contentHash: 'v2:synthetic',
        targetKeys: ['json:global'],
      }).length;

    const plan = planRestoreImportQueries(countFor(emptyDestination));
    expect(plan.accepted).toBe(true);
    expect(plan.total).toBeLessThan(plan.limit);
    // 件数を渡さない側は「行があるかもしれない」として置換対象11表すべてを消す。
    // 差が 11 でなければ、条件化した DELETE のどれかが素通りしている
    expect(countFor()).toBe(countFor(emptyDestination) + 11);
  });

  it('各JSON payloadをUTF-8 80KiB以下に分け、1行超過は拒否する', () => {
    const chunks = chunkJsonRowsByBytes(Array.from({ length: 5_000 }, (_, index) => [`架空-${index}`]));
    for (const payload of chunks)
      expect(new TextEncoder().encode(payload).byteLength).toBeLessThanOrEqual(D1_JSON_PAYLOAD_MAX_BYTES);
    expect(() => chunkJsonRowsByBytes([['架'.repeat(D1_JSON_PAYLOAD_MAX_BYTES)]])).toThrow(/1行/);
  });

  it('post-plan runtime値をscalar bindに分離し、高桁IDでも全builderのchunk数を不変にする', () => {
    const data = emptyDataset();
    const restored = emptyDataset();
    const writeSet = prepareRestoreWriteSet({ userId: 'synthetic-user', data, restored });
    const deal: FreeeDeal = {
      month: '2026-07',
      date: '2026-07-01',
      io: 'expense',
      partner: `架空-${'幅'.repeat(8_000)}`,
      accountRaw: '架空通信費',
      accountNorm: '架空通信費',
      amount: 123,
    };
    const tx: MfTx = {
      id: 'synthetic-high-id',
      m: '2026-07',
      d: '07/01',
      c: `架空-${'幅'.repeat(8_000)}`,
      a: -123,
      big: '架空費',
      mid: '架空内訳',
      inst: '架空口座',
    };
    const common = {
      database: fakeDb,
      userId: 'synthetic-user',
      runId: 'runtime-run',
      months: ['2026-07'],
      contentHash: 'v2:synthetic',
      data,
    };
    const counts = (importId: number) => [
      freeeCommitStatements({ ...common, deals: [deal], importId, targetKeys: ['freee:2026-07'] }).length,
      mfCommitStatements({ ...common, txs: [tx], importId, targetKeys: ['mf:2026-07'] }).length,
      restoreCommitStatements({
        database: fakeDb,
        userId: common.userId,
        runId: common.runId,
        writeSet,
        importId,
        contentHash: common.contentHash,
        targetKeys: ['json:global'],
      }).length,
    ];
    expect(counts(1)).toEqual(counts(9_007_199_254_740_000));

    const binds: unknown[][] = [];
    const recordingStatement = {
      bind(...values: unknown[]) {
        binds.push(values);
        return recordingStatement;
      },
    } as unknown as D1PreparedStatement;
    const recordingDb = { prepare: () => recordingStatement } as unknown as D1Database;
    const highId = 9_007_199_254_740_000;
    freeeCommitStatements({
      ...common,
      database: recordingDb,
      deals: [deal],
      importId: highId,
      targetKeys: ['freee:2026-07'],
    });
    const payloads = binds
      .flat()
      .filter((value): value is string => typeof value === 'string' && value[0] === '[');
    expect(binds.some((values) => values.includes(highId))).toBe(true);
    expect(payloads.every((payload) => !payload.includes(String(highId)))).toBe(true);
    expect(
      payloads.every((payload) => new TextEncoder().encode(payload).byteLength <= D1_JSON_PAYLOAD_MAX_BYTES),
    ).toBe(true);
  });

  it('freee/MF/restoreの全commit builderがlease guard→processing CASで始まる', () => {
    const database = {
      prepare(query: string) {
        const statement = {
          query,
          bind() {
            return statement;
          },
        };
        return statement as unknown as D1PreparedStatement;
      },
    } as unknown as D1Database;
    const data = emptyDataset();
    const common = {
      database,
      userId: 'synthetic-user',
      runId: 'synthetic-run',
      months: ['2026-07'],
      importId: 1,
      contentHash: 'v2:synthetic',
      data,
    };
    const builders = [
      () => freeeCommitStatements({ ...common, deals: [], targetKeys: ['freee:2026-07'] }),
      () => mfCommitStatements({ ...common, txs: [], targetKeys: ['mf:2026-07'] }),
      () =>
        restoreCommitStatements({
          database,
          userId: common.userId,
          runId: common.runId,
          writeSet: prepareRestoreWriteSet({ userId: common.userId, data, restored: emptyDataset() }),
          importId: common.importId,
          contentHash: common.contentHash,
          targetKeys: ['json:global'],
        }),
    ];
    for (const build of builders) {
      const statements = build() as Array<D1PreparedStatement & { query: string }>;
      expect(statements[0]?.query).toContain('INSERT INTO import_writer_claims');
      expect(statements[0]?.query).toContain("status='processing'");
      expect(statements[1]?.query).toContain("SET status='applying'");
      expect(
        statements.some(
          ({ query }) => query.includes("status='committed'") && query.includes("status='applying'"),
        ),
      ).toBe(true);
    }
  });
});

describe('JSON restore persisted projection', () => {
  it('subs aliases/accountsと、実際に永続化するcash/non-cash editを区別する', async () => {
    const data = emptyDataset();
    data.subs.vendors = ['架空SaaS'];
    data.subs.aliases = { 架空SaaS: ['ALIAS-A'] };
    data.edits['cash:1'] = { note: 'A' };
    const restored = emptyDataset();
    const base = prepareRestoreWriteSet({ userId: 'synthetic-user', data, restored });
    const aliasesChanged = structuredClone(data);
    aliasesChanged.subs.aliases = { 架空SaaS: ['ALIAS-B'] };
    const semanticSame = prepareRestoreWriteSet({ userId: 'synthetic-user', data: aliasesChanged, restored });
    expect(await restoreWriteSetFingerprint(base)).not.toBe(await restoreWriteSetFingerprint(semanticSame));

    const accountsChanged = structuredClone(data);
    accountsChanged.subs.accounts = { 架空SaaS: ['架空原科目'] };
    expect(
      await restoreWriteSetFingerprint(
        prepareRestoreWriteSet({ userId: 'synthetic-user', data: accountsChanged, restored }),
      ),
    ).not.toBe(await restoreWriteSetFingerprint(base));

    const cashChanged = structuredClone(data);
    cashChanged.edits['cash:1'] = { note: 'B' };
    expect(
      await restoreWriteSetFingerprint(
        prepareRestoreWriteSet({ userId: 'synthetic-user', data: cashChanged, restored }),
      ),
    ).not.toBe(await restoreWriteSetFingerprint(base));

    const nonCashChanged = structuredClone(data);
    nonCashChanged.edits['mf-1'] = { note: '意味のある変更' };
    const different = prepareRestoreWriteSet({ userId: 'synthetic-user', data: nonCashChanged, restored });
    expect(await restoreWriteSetFingerprint(base)).not.toBe(await restoreWriteSetFingerprint(different));
  });

  it('サブスクの補助属性と見直し判断もrestore fingerprintの正本に含める', async () => {
    const data = emptyDataset();
    data.subs.vendors = ['架空SaaS'];
    const restored = emptyDataset();
    const base = prepareRestoreWriteSet({ userId: 'synthetic-user', data, restored });
    const withMetadata = prepareRestoreWriteSet({
      userId: 'synthetic-user',
      data,
      restored,
      subVendorMetadata: [
        {
          name: '架空SaaS',
          category: '仕事効率化',
          reviewedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });
    const withDecisions = prepareRestoreWriteSet({
      userId: 'synthetic-user',
      data,
      restored,
      subVendorReviewDecisions: [
        {
          vendorKey: '架空saas',
          decision: 'confirmed',
          ruleFingerprint: 'reviewDue:100',
          decidedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    });
    expect(await restoreWriteSetFingerprint(withMetadata)).not.toBe(await restoreWriteSetFingerprint(base));
    expect(await restoreWriteSetFingerprint(withDecisions)).not.toBe(await restoreWriteSetFingerprint(base));
    expect(
      await restoreWriteSetFingerprint(
        prepareRestoreWriteSet({
          userId: 'synthetic-user',
          data,
          restored,
          subVendorReviewDecisions: [],
        }),
      ),
    ).not.toBe(await restoreWriteSetFingerprint(base));
  });

  it('partial payloadで保持される既存値をfingerprintへ含める', async () => {
    const a = emptyDataset();
    const b = emptyDataset();
    a.budgets.架空費 = 100;
    b.budgets.架空費 = 200;
    const restored = emptyDataset();
    const hash = (data: typeof a) =>
      restoreWriteSetFingerprint(prepareRestoreWriteSet({ userId: 'synthetic-user', data, restored }));
    expect(await hash(a)).not.toBe(await hash(b));
  });

  it('MF配列順とedit object挿入順はDB write-setと同じく同一視する', async () => {
    const txA: MfTx = {
      id: 'synthetic-a',
      m: '2026-07',
      d: '07/01',
      c: '架空A',
      a: -100,
      big: '架空費',
      mid: '架空内訳',
    };
    const txB: MfTx = { ...txA, id: 'synthetic-b', d: '07-02', c: '架空B', a: -200 };
    const a = emptyDataset();
    a.mfTx = [txA, txB];
    a.edits = { 'synthetic-a': { note: 'A' }, 'synthetic-b': { note: 'B' } };
    const b = emptyDataset();
    b.mfTx = [txB, txA];
    b.edits = { 'synthetic-b': { note: 'B' }, 'synthetic-a': { note: 'A' } };
    const restored = emptyDataset();
    const hash = (data: typeof a) =>
      restoreWriteSetFingerprint(prepareRestoreWriteSet({ userId: 'synthetic-user', data, restored }));
    expect(await hash(a)).toBe(await hash(b));
  });
});

describe('JSON pointer invalidation consumers', () => {
  it('restore write-setを変える全canonical consumerを固定する', () => {
    expect(JSON_SNAPSHOT_MUTATION_CONSUMERS).toEqual([
      'cash_entries',
      'rules',
      'tx_edits',
      'tx_splits',
      'institution_owners',
      'budgets',
      'account_norm_map',
      'unrecorded_months',
      'cash_overrides',
      'sub_vendors',
      'sub_vendor_review_decisions',
      'sub_vendor_exclusions',
      'analysis_settings',
      'freee_deals',
      'mf_transactions',
      'restored_monthly_agg',
      'vendor_memory',
      'review_snoozes',
      'monthly_close_reviews',
      'duplicate_verdicts',
      'freee_deal_exclusions',
      'total_cashflow_operations',
    ]);
  });
});

describe('canonical mutation lease predicate', () => {
  it('全mutating routeを3分類にMECEで固定する', () => {
    const canonical = [
      ['POST', '/api/cash-entries'],
      ['PUT', '/api/cash-entries/1'],
      ['DELETE', '/api/cash-entries/1'],
      ['PUT', '/api/transactions/tx-1/class'],
      ['PUT', '/api/transactions/tx-1/edit'],
      ['PUT', '/api/transactions/tx-1/splits'],
      ['PUT', '/api/balances/liabilities'],
      // 取込データの削除・取り消しと取引先の決め事は正本を書くためleaseで直列化する。
      ['POST', '/api/imports/1/undo'],
      ['POST', '/api/imports/1/discard'],
      ['POST', '/api/data/deletions'],
      ['POST', '/api/data/undo/op-1'],
      ['PATCH', '/api/vendor-memory/abc'],
      ['POST', '/api/vendor-memory/abc/reapply'],
      // 概況の保留と月次レビューは復元の write-set に入る
      ['PUT', '/api/review-queue/snoozes/classification/mf-1'],
      ['DELETE', '/api/review-queue/snoozes/classification/mf-1'],
      ['PUT', '/api/monthly-close/2026-09/review'],
      ['DELETE', '/api/monthly-close/2026-09/review'],
      // 照合と総収支の判断・除外・取り消しは明細を読んでから書く。
      // 同じ明細に二つの判断が同時に入ると、総額がどちらの結果か決まらない
      ['POST', '/api/total-cashflow/verdicts'],
      ['POST', '/api/total-cashflow/freee-exclusions'],
      ['DELETE', '/api/total-cashflow/freee-exclusions'],
      ['POST', '/api/total-cashflow/operations/op-1/undo'],
      ['POST', '/api/reconciliation/actions'],
      ['POST', '/api/reconciliation/actions/op-1/undo'],
      ['POST', '/api/rules'],
      // 0046: 一括保存・ルール適用・保存したフィルタ。
      // どれも明細を読んでから書くので、取込の洗い替えと重ねない
      ['POST', '/api/transactions/bulk'],
      ['POST', '/api/rules/apply'],
      ['POST', '/api/rules/1/apply'],
      ['POST', '/api/saved-filters'],
      ['DELETE', '/api/saved-filters/f-1'],
      ['PUT', '/api/rules/1'],
      ['DELETE', '/api/rules/1'],
      ['PATCH', '/api/rules'],
      ['PUT', '/api/budgets'],
      ['PUT', '/api/settings'],
      ['POST', '/api/category-options'],
      ['PUT', '/api/category-options'],
      ['DELETE', '/api/category-options'],
      ['PUT', '/api/classification'],
      // 名義の表示名は 4 名義を 1 回で差し替える。重なった保存が名義ごとに混ざらないよう直列化する
      ['PUT', '/api/settings/owner-labels'],
      ['POST', '/api/sub-vendors'],
      ['PUT', '/api/sub-vendors/1'],
      ['POST', '/api/sub-vendors/1/aliases'],
      ['DELETE', '/api/sub-vendors/1'],
      ['POST', '/api/sub-vendors/1/review'],
      ['POST', '/api/subscriptions/review-decisions'],
      ['DELETE', '/api/subscriptions/review-decisions'],
      ['POST', '/api/sub-vendors/exclusions'],
      ['DELETE', '/api/sub-vendors/exclusions/1'],
    ] as const;
    const selfManaged = [
      ['POST', '/api/imports'],
      ['POST', '/api/restore'],
    ] as const;
    const nonCanonicalMutations = [
      ['POST', '/api/auth/login'],
      ['POST', '/api/auth/logout'],
      // 自分のパスワード変更。users 1行と監査だけを触り、明細のlease層には一切入らない。
      ['POST', '/api/auth/password'],
      ['POST', '/api/ai/tasks'],
      ['POST', '/api/ai/tasks/1/paste'],
      ['POST', '/api/ai/tasks/1/report'],
      ['DELETE', '/api/ai/tasks/1'],
      ['DELETE', '/api/ai/reports/1'],
      // アーカイブは表示の出し分けだけを変え、記帳の正本には触れない。
      ['PUT', '/api/ai/reports/1/archive'],
      ['POST', '/api/tradeoff'],
      // コピー記録は「いつ操作したか」だけで、記帳の正本に触れない。
      ['POST', '/api/ai/tasks/1/copied'],
      // 診断の対応状態も action_key ごとの判断記録だけ(ADR-002)。明細を読んでから書く
      // read-modify-write ではなく、総収支の判断表 (duplicate_verdicts) にも触れない。
      ['PATCH', '/api/diagnosis/actions/fixed_cost_review'],
      // suggestionは読み取りのみでbudgetを書かない。
      ['POST', '/api/budgets/suggest'],
      // preflight は「何がどうなるか」を数えて返すだけで、1件も書き換えない(DR-1)。
      ['POST', '/api/data/deletions/preflight'],
      ['POST', '/api/imports/1/undo/preflight'],
      ['POST', '/api/imports/1/discard/preflight'],
      // 差分previewは完全にread-only。writer claimすら書かない。
      ['POST', '/api/imports/diff'],
      // ルールのプレビューも同じく読むだけ。何が変わるかを数えて返す
      ['POST', '/api/rules/preview'],
    ] as const;
    for (const [method, path] of canonical) {
      expect(classifyCanonicalMutation(method, path), `${method} ${path}`).toBe('canonical-mutation');
    }
    for (const [method, path] of selfManaged) {
      expect(classifyCanonicalMutation(method, path), `${method} ${path}`).toBe('self-managed-import');
    }
    for (const [method, path] of nonCanonicalMutations) {
      expect(classifyCanonicalMutation(method, path), `${method} ${path}`).toBe('not-canonical-mutation');
    }
    expect(CANONICAL_MUTATION_ROUTES).toHaveLength(canonical.length - 1);

    const sourceDir = dirname(fileURLToPath(import.meta.url));
    const routeSources = [
      'index.ts',
      'routes/ai.ts',
      'routes/auth.ts',
      'routes/analytics.ts',
      'routes/cash.ts',
      'routes/classify.ts',
      'routes/classify-bulk.ts',
      'routes/deletions.ts',
      'routes/import-diff.ts',
      'routes/imports.ts',
      'routes/reconciliation.ts',
      'routes/saved-filters.ts',
      'routes/settings.ts',
      'routes/subs.ts',
      'routes/total-cashflow.ts',
      'routes/vendor-memory.ts',
    ];
    const discovered = routeSources.flatMap((filename) => {
      const source = readFileSync(resolve(sourceDir, filename), 'utf8');
      return [...source.matchAll(/\.(post|put|patch|delete)\(\s*'([^']+)'/g)].map((match) => {
        const routePath = match[2] ?? '';
        return `${(match[1] ?? '').toUpperCase()} ${routePath.startsWith('/api/') ? routePath : `/api${routePath}`}`;
      });
    });
    const expected = [
      'POST /api/cash-entries',
      'PUT /api/cash-entries/:id',
      'DELETE /api/cash-entries/:id',
      'PUT /api/transactions/:txId/class',
      'PUT /api/transactions/:txId/edit',
      'PUT /api/transactions/:txId/splits',
      'POST /api/rules',
      'POST /api/rules/preview',
      'POST /api/rules/apply',
      'POST /api/rules/:id/apply',
      'POST /api/transactions/bulk',
      'POST /api/saved-filters',
      'DELETE /api/saved-filters/:id',
      'PUT /api/rules/:id',
      'DELETE /api/rules/:id',
      'PATCH /api/rules',
      'PUT /api/budgets',
      'POST /api/budgets/suggest',
      'PUT /api/settings',
      'POST /api/category-options',
      'PUT /api/category-options',
      'DELETE /api/category-options',
      'PUT /api/classification',
      'PUT /api/settings/owner-labels',
      'POST /api/sub-vendors',
      'PUT /api/sub-vendors/:id',
      'POST /api/sub-vendors/:id/aliases',
      'POST /api/subscriptions/review-decisions',
      'DELETE /api/subscriptions/review-decisions',
      'DELETE /api/sub-vendors/:id',
      'POST /api/sub-vendors/:id/review',
      'POST /api/sub-vendors/exclusions',
      'DELETE /api/sub-vendors/exclusions/:id',
      'POST /api/imports',
      'POST /api/imports/diff',
      'POST /api/imports/:id/undo',
      'POST /api/imports/:id/undo/preflight',
      'POST /api/imports/:id/discard',
      'POST /api/imports/:id/discard/preflight',
      'POST /api/data/deletions',
      'POST /api/data/deletions/preflight',
      'POST /api/data/undo/:operationId',
      'PATCH /api/vendor-memory/:vendorKey',
      'POST /api/vendor-memory/:vendorKey/reapply',
      'PUT /api/review-queue/snoozes/:kind/:itemKey',
      'DELETE /api/review-queue/snoozes/:kind/:itemKey',
      'PUT /api/monthly-close/:month/review',
      'DELETE /api/monthly-close/:month/review',
      'POST /api/total-cashflow/verdicts',
      'POST /api/total-cashflow/freee-exclusions',
      'DELETE /api/total-cashflow/freee-exclusions',
      'POST /api/reconciliation/actions',
      'POST /api/reconciliation/actions/:id/undo',
      'POST /api/restore',
      'POST /api/tradeoff',
      'POST /api/ai/tasks',
      'POST /api/ai/tasks/:id/copied',
      'POST /api/ai/tasks/:id/paste',
      'POST /api/ai/tasks/:id/report',
      'PUT /api/ai/reports/:id/archive',
      'DELETE /api/ai/reports/:id',
      'DELETE /api/ai/tasks/:id',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'POST /api/auth/password',
      'POST /api/total-cashflow/operations/:id/undo',
      'PATCH /api/diagnosis/actions/:action_key',
    ].sort();
    expect(discovered.sort()).toEqual(expected);
  });

  it('JSON snapshot consumerに対する全writerをmiddlewareまたはimport自身が所有する', () => {
    const fencedConsumers = new Set([
      ...CANONICAL_MUTATION_ROUTES.flatMap((route) => route.consumers),
      ...SELF_MANAGED_IMPORT_CONSUMERS,
    ]);
    expect(JSON_SNAPSHOT_MUTATION_CONSUMERS.every((consumer) => fencedConsumers.has(consumer))).toBe(true);
  });
});

describe('件数が減る洗い替えの検知', () => {
  const counts = (pairs: [string, number][]) => new Map(pairs);

  it('減る月だけを返す', () => {
    const got = shrinkingMonths(
      ['2026-07', '2026-08'],
      counts([
        ['2026-07', 120],
        ['2026-08', 30],
      ]),
      counts([
        ['2026-07', 60],
        ['2026-08', 45],
      ]),
    );
    expect(got).toEqual([{ month: '2026-07', before: 120, after: 60 }]);
  });

  it('件数が同じなら返さない(洗い替え直しを妨げない)', () => {
    expect(shrinkingMonths(['2026-07'], counts([['2026-07', 10]]), counts([['2026-07', 10]]))).toEqual([]);
  });

  it('初めて取り込む月は before 0 のため減らない', () => {
    expect(shrinkingMonths(['2026-09'], counts([]), counts([['2026-09', 5]]))).toEqual([]);
  });

  it('対象月なのに1件も無いファイルは「全消し」として減少に数える', () => {
    expect(shrinkingMonths(['2026-07'], counts([['2026-07', 3]]), counts([]))).toEqual([
      { month: '2026-07', before: 3, after: 0 },
    ]);
  });
});
