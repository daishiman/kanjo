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
    expect(mfCount).toBe(20);
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
    ).toMatchObject({ total: 48, accepted: true });

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

  it('年別の確定申告判定をrestoreしてもFree枠の49 queriesに収める', () => {
    const data = emptyDataset();
    const writeSet = prepareRestoreWriteSet({
      userId: 'synthetic-user',
      data,
      restored: emptyDataset(),
      taxAccountSettings: [
        {
          taxYear: 2026,
          account: '架空通信費',
          taxAccount: '通信費',
          businessPercent: 100,
          basis: null,
        },
      ],
      existingTaxAccountSettings: [],
    });
    const statementsFor = (candidate: typeof writeSet) =>
      restoreCommitStatements({
        database: fakeDb,
        userId: 'synthetic-user',
        runId: 'synthetic-run',
        writeSet: candidate,
        importId: 1,
        contentHash: 'v2:synthetic',
        targetKeys: ['json:global'],
      }).length;
    const withoutTax = prepareRestoreWriteSet({
      userId: 'synthetic-user',
      data,
      restored: emptyDataset(),
    });
    const plan = planRestoreImportQueries(statementsFor(writeSet));
    expect(plan).toMatchObject({ accepted: true });
    expect(plan.total).toBeLessThan(D1_FREE_QUERY_LIMIT);
    expect(statementsFor(writeSet)).toBe(statementsFor(withoutTax) + 1);
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

  it('確定申告判定の内容は指紋に含め、宛先との差分有無は含めない', async () => {
    const setting = {
      taxYear: 2026,
      account: '架空通信費',
      taxAccount: '通信費',
      businessPercent: 100,
      basis: null,
    } as const;
    const make = (businessPercent: number, existing: (typeof setting)[] = []) =>
      prepareRestoreWriteSet({
        userId: 'synthetic-user',
        data: emptyDataset(),
        restored: emptyDataset(),
        taxAccountSettings: [{ ...setting, businessPercent }],
        existingTaxAccountSettings: existing,
      });

    expect(await restoreWriteSetFingerprint(make(100))).not.toBe(await restoreWriteSetFingerprint(make(80)));
    expect(await restoreWriteSetFingerprint(make(100))).toBe(
      await restoreWriteSetFingerprint(make(100, [setting])),
    );
  });

  it('証憑取得先と明細例外を指紋とrestore予算の両方に含める', async () => {
    const profile = {
      profileKey: '架空saas::架空クラウド',
      merchantKey: '架空saas',
      serviceName: '架空クラウド',
      sourceUrl: 'https://example.invalid/receipts',
      loginAccount: null,
      memo: null,
    };
    const override = {
      targetKind: 'mf' as const,
      targetKey: 'synthetic-mf-1',
      merchantKey: '架空店',
      profileKey: profile.profileKey,
      serviceName: null,
      sourceUrl: null,
      loginAccount: null,
      memo: null,
    };
    const make = (sourceUrl: string, existing = false) =>
      prepareRestoreWriteSet({
        userId: 'synthetic-user',
        data: emptyDataset(),
        restored: emptyDataset(),
        receiptSourceProfiles: [{ ...profile, sourceUrl }],
        existingReceiptSourceProfiles: existing ? [{ ...profile, sourceUrl }] : [],
        receiptSourceOverrides: [override],
        existingReceiptSourceOverrides: existing ? [override] : [],
      });

    expect(await restoreWriteSetFingerprint(make(profile.sourceUrl))).not.toBe(
      await restoreWriteSetFingerprint(make('https://changed.invalid/receipts')),
    );
    expect(await restoreWriteSetFingerprint(make(profile.sourceUrl))).toBe(
      await restoreWriteSetFingerprint(make(profile.sourceUrl, true)),
    );

    const withReceipt = restoreCommitStatements({
      database: fakeDb,
      userId: 'synthetic-user',
      runId: 'synthetic-run',
      writeSet: make(profile.sourceUrl),
      importId: 1,
      contentHash: 'v2:synthetic',
      targetKeys: ['json:global'],
    }).length;
    const withoutReceipt = restoreCommitStatements({
      database: fakeDb,
      userId: 'synthetic-user',
      runId: 'synthetic-run',
      writeSet: prepareRestoreWriteSet({
        userId: 'synthetic-user',
        data: emptyDataset(),
        restored: emptyDataset(),
      }),
      importId: 1,
      contentHash: 'v2:synthetic',
      targetKeys: ['json:global'],
    }).length;
    expect(withReceipt).toBe(withoutReceipt + 2);
    expect(planRestoreImportQueries(withReceipt)).toMatchObject({ accepted: true });
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
      'sub_vendor_exclusions',
      'analysis_settings',
      'tax_account_settings',
      'receipt_source_profiles',
      'receipt_source_overrides',
      'freee_deals',
      'mf_transactions',
      'restored_monthly_agg',
      'vendor_memory',
    ]);
  });
});

describe('canonical mutation lease predicate', () => {
  it('全mutating routeを3分類にMECEで固定する', () => {
    const canonical = [
      ['POST', '/api/cash-entries'],
      ['PUT', '/api/cash-entries/1'],
      ['DELETE', '/api/cash-entries/1'],
      ['POST', '/api/attachments'],
      ['POST', '/api/attachments/archive/recover'],
      ['DELETE', '/api/attachments/1'],
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
      ['POST', '/api/rules'],
      ['PUT', '/api/rules/1'],
      ['DELETE', '/api/rules/1'],
      ['PATCH', '/api/rules'],
      ['PUT', '/api/budgets'],
      ['PUT', '/api/settings'],
      ['PUT', '/api/tax/accounts'],
      ['PUT', '/api/tax/receipt-sources'],
      ['POST', '/api/category-options'],
      ['PUT', '/api/category-options'],
      ['DELETE', '/api/category-options'],
      ['PUT', '/api/classification'],
      ['POST', '/api/sub-vendors'],
      ['PUT', '/api/sub-vendors/1'],
      ['DELETE', '/api/sub-vendors/1'],
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
      ['POST', '/api/ai/tasks'],
      ['POST', '/api/ai/tasks/1/paste'],
      ['POST', '/api/ai/tasks/1/report'],
      ['DELETE', '/api/ai/tasks/1'],
      ['DELETE', '/api/ai/reports/1'],
      // アーカイブは表示の出し分けだけを変え、記帳の正本には触れない。
      ['PUT', '/api/ai/reports/1/archive'],
      ['POST', '/api/tradeoff'],
      // 見直し記録・コピー記録はどちらも「いつ操作したか」だけで、記帳の正本に触れない。
      ['POST', '/api/sub-vendors/1/review'],
      ['POST', '/api/ai/tasks/1/copied'],
      // suggestionは読み取りのみでbudgetを書かない。
      ['POST', '/api/budgets/suggest'],
      ['POST', '/api/attachments/archive/reconcile'],
      // preflight は「何がどうなるか」を数えて返すだけで、1件も書き換えない(DR-1)。
      ['POST', '/api/data/deletions/preflight'],
      ['POST', '/api/imports/1/undo/preflight'],
      ['POST', '/api/imports/1/discard/preflight'],
      // 差分previewは完全にread-only。writer claimすら書かない。
      ['POST', '/api/imports/diff'],
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
      'routes/analytics.ts',
      'routes/attachments.ts',
      'routes/cash.ts',
      'routes/classify.ts',
      'routes/deletions.ts',
      'routes/import-diff.ts',
      'routes/imports.ts',
      'routes/settings.ts',
      'routes/subs.ts',
      'routes/tax.ts',
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
      'POST /api/attachments',
      'POST /api/attachments/archive/reconcile',
      'POST /api/attachments/archive/recover',
      'DELETE /api/attachments/:id',
      'PUT /api/transactions/:txId/class',
      'PUT /api/transactions/:txId/edit',
      'PUT /api/transactions/:txId/splits',
      'POST /api/rules',
      'PUT /api/rules/:id',
      'DELETE /api/rules/:id',
      'PATCH /api/rules',
      'PUT /api/budgets',
      'POST /api/budgets/suggest',
      'PUT /api/settings',
      'PUT /api/tax/accounts',
      'PUT /api/tax/receipt-sources',
      'POST /api/category-options',
      'PUT /api/category-options',
      'DELETE /api/category-options',
      'PUT /api/classification',
      'POST /api/sub-vendors',
      'PUT /api/sub-vendors/:id',
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
