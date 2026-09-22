/**
 * データ取込画面の規則 (SYS-IMPORT-P04)。期待値の正本は docs/import-screen/rules.md の表と
 * specs/spec-import-screen.md「ビジネスルールと検証」。表を変えたらここも同時に直す。
 *
 * ## 置換前に落ちる理由
 * 旧実装は上限を routes/imports.ts の `25 * 1024 * 1024` と web の注記の文字列に別々に持ち、ファイル数・合計・展開後・
 * エントリ数の上限もファイルの 6 状態・履歴の操作表も core に無い (import が解決しない)。
 */
import { describe, expect, it } from 'vitest';
import {
  IMPORT_FILE_STATE_LABEL,
  IMPORT_LIMITS,
  IMPORT_LIMIT_BOUNDARY_CASES,
  IMPORT_MB,
  IMPORT_RESULT_LABEL,
  IMPORT_SOURCE_LABEL,
  IMPORT_SOURCE_SHORT,
  type ImportFileStateInput,
  type ImportSummaryFile,
  formatImportDateTime,
  formatImportDateTimeLong,
  formatImportFileSize,
  formatImportPeriod,
  importArchiveViolation,
  importBodyLimitBytes,
  importDuplicate,
  importDuplicateLabel,
  importExclusionNote,
  importFileActions,
  importFileSelectable,
  importFileState,
  importHistoryActions,
  importHistoryDetail,
  importHistoryHideable,
  importInspectionSummary,
  importLimitViolation,
  importLimitsNote,
  importPeriodFromMonths,
  importResultHeadline,
  importRunResult,
  importRunResultText,
  importStep,
  importUndoDeadline,
  importValidation,
  importValidationLabel,
  orderedImportSources,
} from '../src/index.js';

const MB = 1_048_576;
const files = (count: number, size = 1) =>
  Array.from({ length: count }, (_, i) => ({ name: `f${i}.csv`, size }));

describe('上限値の定数', () => {
  it('1 MB は 1,048,576 bytes で、上限は仕様の数値そのもの', () => {
    expect(IMPORT_MB).toBe(1_048_576);
    expect(IMPORT_LIMITS.maxFileBytes).toBe(26_214_400);
    expect(IMPORT_LIMITS.maxFiles).toBe(10);
    expect(IMPORT_LIMITS.maxTotalBytes).toBe(31_457_280);
    expect(IMPORT_LIMITS.maxExpandedBytes).toBe(62_914_560);
    expect(IMPORT_LIMITS.maxArchiveEntries).toBe(1_000);
    expect(IMPORT_LIMITS.maxHideIds).toBe(100);
    expect(IMPORT_LIMITS.cleanupBatch).toBe(500);
    expect(IMPORT_LIMITS.maxFilenameLength).toBe(255);
    expect(IMPORT_LIMITS.inspectionsPerMinute).toBe(30);
    expect(IMPORT_LIMITS.commitsPerMinute).toBe(5);
    expect(IMPORT_LIMITS.stagingTtlMs).toBe(86_400_000);
    expect(IMPORT_LIMITS.undoWindowMs).toBe(2_592_000_000);
  });

  it('本文の上限は合計サイズより大きく、区切りの分だけ余裕を持つ', () => {
    expect(importBodyLimitBytes()).toBe(31_457_280 + 65_536);
  });

  it('画面の注記は定数から描く', () => {
    expect(importLimitsNote()).toBe('1 回に 10 ファイル・合計 30MB まで、1 ファイル 25MB まで');
  });
});

describe('importLimitViolation の境界', () => {
  it('10 ファイルは通り、11 ファイルは「10 ファイル超」', () => {
    expect(importLimitViolation({ files: files(10) })).toBeNull();
    expect(importLimitViolation({ files: files(11) })?.reason).toBe('10 ファイル超');
  });

  it('追加は既存の件数と合わせて数える', () => {
    expect(importLimitViolation({ files: files(1), prior: { count: 9, totalBytes: 0 } })).toBeNull();
    expect(importLimitViolation({ files: files(1), prior: { count: 10, totalBytes: 0 } })?.kind).toBe(
      'count',
    );
  });

  it('25MB ちょうどは通り、+1 byte は「25MB 超」で位置を返す', () => {
    expect(importLimitViolation({ files: [{ name: 'a.csv', size: 25 * MB }] })).toBeNull();
    const v = importLimitViolation({
      files: [
        { name: 'a.csv', size: 1 },
        { name: 'b.csv', size: 25 * MB + 1 },
      ],
    });
    expect(v?.kind).toBe('file');
    expect(v?.reason).toBe('25MB 超');
    expect(v?.index).toBe(1);
  });

  it('合計 30MB ちょうどは通り、+1 byte は「合計 30MB 超」', () => {
    expect(
      importLimitViolation({
        files: [
          { name: 'a', size: 20 * MB },
          { name: 'b', size: 10 * MB },
        ],
      }),
    ).toBeNull();
    expect(
      importLimitViolation({
        files: [
          { name: 'a', size: 20 * MB },
          { name: 'b', size: 10 * MB + 1 },
        ],
      })?.reason,
    ).toBe('合計 30MB 超');
  });

  it('追加の合計は既存の累計を含める', () => {
    expect(
      importLimitViolation({ files: [{ name: 'a', size: MB }], prior: { count: 1, totalBytes: 29 * MB } }),
    ).toBeNull();
    expect(
      importLimitViolation({ files: [{ name: 'a', size: MB + 1 }], prior: { count: 1, totalBytes: 29 * MB } })
        ?.kind,
    ).toBe('total');
  });

  it('判定の順はファイル数 → 1 ファイル → 合計', () => {
    const many = [...files(10, 26 * MB), { name: 'x', size: 1 }];
    expect(importLimitViolation({ files: many })?.kind).toBe('count');
    expect(
      importLimitViolation({
        files: [
          { name: 'a', size: 26 * MB },
          { name: 'b', size: 5 * MB },
        ],
      })?.kind,
    ).toBe('file');
  });

  it('ファイル名の長さでは拒まない。api が 255 文字に切って記録する (qa-imp-decision-010)', () => {
    expect(importLimitViolation({ files: [{ name: 'あ'.repeat(255), size: 1 }] })).toBeNull();
    expect(importLimitViolation({ files: [{ name: 'あ'.repeat(256), size: 1 }] })).toBeNull();
    expect(importLimitViolation({ files: [{ name: 'x'.repeat(10_000), size: 1 }] })).toBeNull();
  });
});

describe('web・api と共通の境界表', () => {
  const sum = (files: ReadonlyArray<{ size: number }>) => files.reduce((total, file) => total + file.size, 0);

  it('ちょうどと +1 の組が、ファイル数・1 ファイル・合計・追加の累計で揃い、ファイル名は +1 でも通る', () => {
    const kinds = IMPORT_LIMIT_BOUNDARY_CASES.map((entry) => entry.expected);
    expect(kinds.filter((kind) => kind === null)).toHaveLength(7);
    expect(kinds.filter((kind) => kind !== null).sort()).toEqual(
      ['count', 'count', 'file', 'total', 'total'].sort(),
    );
  });

  it.each(IMPORT_LIMIT_BOUNDARY_CASES)('要求単位の判定 (api): $name', (entry) => {
    const violation = importLimitViolation({
      files: entry.files,
      prior: { count: entry.before.length, totalBytes: sum(entry.before) },
    });
    expect(violation?.kind ?? null).toBe(entry.expected);
  });

  it.each(IMPORT_LIMIT_BOUNDARY_CASES)('1 件ずつの累計判定 (web): $name', (entry) => {
    expect(importLimitViolation({ files: entry.before })).toBeNull();
    let prior = { count: entry.before.length, totalBytes: sum(entry.before) };
    const kinds = entry.files.map((file) => {
      const violation = importLimitViolation({ files: [file], prior });
      if (!violation) prior = { count: prior.count + 1, totalBytes: prior.totalBytes + file.size };
      return violation?.kind ?? null;
    });
    // 超過は最後の 1 件だけで起こる
    expect(kinds.slice(0, -1).every((kind) => kind === null)).toBe(true);
    expect(kinds.at(-1)).toBe(entry.expected);
  });
});

describe('importArchiveViolation の境界', () => {
  it('展開後 60MB ちょうどは通り、+1 byte は「展開後 60MB 超」', () => {
    expect(importArchiveViolation({ entries: 10, expandedBytes: 60 * MB })).toBeNull();
    expect(importArchiveViolation({ entries: 10, expandedBytes: 60 * MB + 1 })?.reason).toBe(
      '展開後 60MB 超',
    );
  });

  it('エントリ 1,000 件は通り、1,001 件は「エントリ数 1,000 件超」', () => {
    expect(importArchiveViolation({ entries: 1_000, expandedBytes: 1 })).toBeNull();
    expect(importArchiveViolation({ entries: 1_001, expandedBytes: 1 })?.reason).toBe(
      'エントリ数 1,000 件超',
    );
  });

  it('両方超えるときはエントリ数を先に返す', () => {
    expect(importArchiveViolation({ entries: 1_001, expandedBytes: 61 * MB })?.kind).toBe('entries');
  });
});

describe('検証の段階', () => {
  it('重複: 取込済みと同一 → 重複の可能性 → 重複なし', () => {
    expect(importDuplicateLabel(importDuplicate({ identical: true, possibleCount: 3 }))).toBe(
      '取込済みと同一',
    );
    expect(importDuplicateLabel(importDuplicate({ identical: false, possibleCount: 3 }))).toBe(
      '重複の可能性 3件',
    );
    expect(importDuplicateLabel(importDuplicate({ identical: false, possibleCount: 0 }))).toBe('重複なし');
  });

  it('バリデーション: エラー → 警告あり → 問題なし。0 行はエラー', () => {
    expect(importValidationLabel(importValidation({ error: true, rows: 10, skipped: 0 }))).toBe('エラー 1件');
    expect(importValidationLabel(importValidation({ error: false, rows: 0, skipped: 0 }))).toBe('エラー 1件');
    expect(importValidationLabel(importValidation({ error: false, rows: 10, skipped: 2 }))).toBe('警告あり');
    expect(importValidation({ error: false, rows: 10, skipped: 2 }).count).toBe(2);
    expect(importValidationLabel(importValidation({ error: false, rows: 10, skipped: 0 }))).toBe('問題なし');
    expect(importValidationLabel({ kind: 'checking', count: 0 })).toBe('チェック中');
  });
});

const ok = {
  validation: { kind: 'ok' as const, count: 0 },
  duplicate: { kind: 'none' as const, count: 0 },
  errorReason: null,
};
const base: ImportFileStateInput = {
  commit: null,
  limitViolation: null,
  uploaded: true,
  inspection: ok,
  force: false,
};

describe('importFileState の優先順位', () => {
  it('ラベルは 6 種', () => {
    expect(Object.values(IMPORT_FILE_STATE_LABEL)).toEqual([
      'アップロード中',
      '検査中',
      '取込準備完了',
      '取込不可',
      '取込済み',
      '失敗',
    ]);
  });

  it('失敗 → 取込済み → 取込不可 → 取込準備完了 → 検査中 → アップロード中', () => {
    expect(importFileState({ ...base, commit: 'failed', limitViolation: '25MB 超' }).state).toBe('failed');
    expect(importFileState({ ...base, commit: 'committed', limitViolation: '25MB 超' }).state).toBe(
      'imported',
    );
    expect(importFileState({ ...base, limitViolation: '25MB 超' })).toEqual({
      state: 'blocked',
      reason: '25MB 超',
    });
    expect(importFileState(base).state).toBe('ready');
    expect(importFileState({ ...base, inspection: null }).state).toBe('inspecting');
    expect(importFileState({ ...base, inspection: null, uploaded: false }).state).toBe('uploading');
  });

  it('送信の失敗は確定の結果より弱く、上限違反・検査結果より強い', () => {
    const uploadError = '通信が切れました';
    expect(importFileState({ ...base, commit: 'committed', uploadError }).state).toBe('imported');
    expect(importFileState({ ...base, commit: 'failed', uploadError })).toEqual({
      state: 'failed',
      reason: null,
    });
    expect(importFileState({ ...base, limitViolation: '25MB 超', uploadError })).toEqual({
      state: 'failed',
      reason: uploadError,
    });
    expect(importFileState({ ...base, inspection: null, uploaded: false, uploadError }).state).toBe('failed');
    expect(importFileState({ ...base, uploadError: null }).state).toBe('ready');
  });

  it('エラーは取込不可で理由を持ち、取込済みと同一は強制再取込のときだけ準備完了', () => {
    const error = { ...ok, validation: { kind: 'error' as const, count: 1 }, errorReason: '列が足りません' };
    expect(importFileState({ ...base, inspection: error })).toEqual({
      state: 'blocked',
      reason: '列が足りません',
    });
    const identical = { ...ok, duplicate: { kind: 'identical' as const, count: 0 } };
    expect(importFileState({ ...base, inspection: identical })).toEqual({
      state: 'blocked',
      reason: '取込済みと同一',
    });
    expect(importFileState({ ...base, inspection: identical, force: true }).state).toBe('ready');
  });

  it('警告と重複の可能性は取込準備完了のまま', () => {
    const warn = {
      ...ok,
      validation: { kind: 'warning' as const, count: 2 },
      duplicate: { kind: 'possible' as const, count: 4 },
    };
    expect(importFileState({ ...base, inspection: warn }).state).toBe('ready');
  });
});

describe('ファイルの操作と取込可否', () => {
  it('状態ごとの操作', () => {
    expect(importFileActions('uploading')).toEqual(['cancel']);
    expect(importFileActions('inspecting')).toEqual([]);
    expect(importFileActions('ready')).toEqual(['remove']);
    expect(importFileActions('blocked')).toEqual(['retry', 'remove']);
    expect(importFileActions('imported')).toEqual([]);
    expect(importFileActions('failed')).toEqual(['retry']);
  });

  it('選べるのは取込準備完了だけ', () => {
    const states = ['uploading', 'inspecting', 'ready', 'blocked', 'imported', 'failed'] as const;
    expect(states.filter(importFileSelectable)).toEqual(['ready']);
  });
});

describe('ステッパー', () => {
  it('検査 ID が無い = 1、あり未確定 = 2、確定 = 3', () => {
    expect(importStep({ inspectionId: null, committed: false })).toBe(1);
    expect(importStep({ inspectionId: 'i1', committed: false })).toBe(2);
    expect(importStep({ inspectionId: 'i1', committed: true })).toBe(3);
  });
});

const sfile = (over: Partial<ImportSummaryFile>): ImportSummaryFile => ({
  state: 'ready',
  source: 'mf',
  rowCount: 10,
  periodFrom: '2026-08-01',
  periodTo: '2026-08-31',
  duplicate: { kind: 'none', count: 0 },
  subsEstimate: 0,
  ...over,
});

describe('内容確認の要約', () => {
  it('取込可能なファイルだけを数え、取込不可はエラーに数える', () => {
    const summary = importInspectionSummary([
      sfile({ rowCount: 120, periodFrom: '2026-07-01', periodTo: '2026-07-31', subsEstimate: 2 }),
      sfile({ source: 'freee', rowCount: 30, duplicate: { kind: 'possible', count: 3 }, subsEstimate: 1 }),
      sfile({
        state: 'blocked',
        rowCount: 999,
        periodFrom: '2020-01-01',
        periodTo: '2030-12-31',
        subsEstimate: 9,
      }),
    ]);
    expect(summary).toEqual({
      fileCount: 3,
      importableCount: 2,
      errorCount: 1,
      rowCount: 150,
      periodFrom: '2026-07-01',
      periodTo: '2026-08-31',
      sources: [
        { source: 'mf', count: 1 },
        { source: 'freee', count: 1 },
      ],
      duplicateCount: 3,
      subsCandidates: 3,
    });
  });

  it('取込可能が 0 件なら期間は空', () => {
    const summary = importInspectionSummary([sfile({ state: 'blocked' })]);
    expect(summary.periodFrom).toBeNull();
    expect(summary.rowCount).toBe(0);
  });

  it('除外の注記は 1 件以上のときだけ', () => {
    expect(importExclusionNote(0)).toBeNull();
    expect(importExclusionNote(1)).toBe(
      'エラーのあるファイル（1件）は取り込み対象から除外されます。エラーを修正して再試行してください。',
    );
  });
});

describe('取込 1 回の結果', () => {
  it('全成功 = 成功、混在 = 一部成功、全失敗 = 失敗', () => {
    expect(importRunResult(3, 0)).toBe('success');
    expect(importRunResult(3, 1)).toBe('partial');
    expect(importRunResult(0, 2)).toBe('failed');
    expect(importRunResult(0, 0)).toBe('failed');
    expect(Object.values(IMPORT_RESULT_LABEL)).toEqual(['成功', '一部成功', '失敗', '取り消し済み']);
  });

  it('詳細ペインの結果と見出し', () => {
    expect(importRunResultText('partial', 3, 1)).toBe('一部成功（3件成功、1件失敗）');
    expect(importRunResultText('undone', 3, 1)).toBe('取り消し済み');
    expect(importResultHeadline(3, 1)).toEqual([
      '3 件のファイルを正常に取り込みました',
      'エラーのあった 1 件のファイルは取り込みませんでした。',
      '取り込んだデータは会計データに追加されています。',
    ]);
    expect(importResultHeadline(0, 2)).toEqual(['エラーのあった 2 件のファイルは取り込みませんでした。']);
  });

  it('履歴の詳細列', () => {
    expect(importHistoryDetail({ succeeded: 3, failed: 0, failureSummary: null })).toBe('-');
    expect(importHistoryDetail({ succeeded: 0, failed: 1, failureSummary: '列が足りません' })).toBe(
      '列が足りません',
    );
    expect(importHistoryDetail({ succeeded: 3, failed: 1, failureSummary: null })).toBe('成功 3 / 失敗 1');
  });
});

describe('履歴の操作', () => {
  const created = '2026-08-01T00:00:00.000Z';
  const within = Date.parse(created) + IMPORT_LIMITS.undoWindowMs;
  it('成功 30 日以内は置換と取り消し、一部成功は取り消しだけ', () => {
    expect(importHistoryActions({ result: 'success', createdAt: created, now: within })).toEqual([
      'detail',
      'files',
      'replace',
      'undo',
    ]);
    expect(importHistoryActions({ result: 'partial', createdAt: created, now: within })).toEqual([
      'detail',
      'files',
      'undo',
    ]);
  });

  it('30 日を 1 ms でも過ぎると詳細とファイルだけ', () => {
    expect(importHistoryActions({ result: 'success', createdAt: created, now: within + 1 })).toEqual([
      'detail',
      'files',
    ]);
  });

  it('失敗と取り消し済みは削除でき、一括削除の対象になる', () => {
    expect(importHistoryActions({ result: 'failed', createdAt: created, now: within })).toEqual([
      'detail',
      'files',
      'delete',
    ]);
    expect(importHistoryActions({ result: 'undone', createdAt: created, now: within + 1 })).toEqual([
      'detail',
      'files',
      'delete',
    ]);
    expect(importHistoryHideable('undone')).toBe(true);
    expect(importHistoryHideable('failed')).toBe(true);
    expect(importHistoryHideable('success')).toBe(false);
    expect(importHistoryHideable('partial')).toBe(false);
  });

  it('取り消しの期限は作成から 30 日後', () => {
    expect(importUndoDeadline(created)).toBe('2026-08-31T00:00:00.000Z');
  });
});

describe('表示の書式', () => {
  it('期間', () => {
    expect(formatImportPeriod('2026-08-01', '2026-08-31')).toBe('2026/08/01 - 2026/08/31');
    expect(formatImportPeriod(null, '2026-08-31')).toBe('-');
  });

  it('サイズ', () => {
    expect(formatImportFileSize(2.4 * MB)).toBe('2.4 MB');
    expect(formatImportFileSize(980 * 1024)).toBe('980 KB');
    expect(formatImportFileSize(10)).toBe('1 KB');
  });

  it('日時は JST', () => {
    expect(formatImportDateTime('2026-09-10T01:15:00.000Z')).toBe('2026/09/10 10:15');
    expect(formatImportDateTime('2026-09-09T15:00:00.000Z')).toBe('2026/09/10 00:00');
    expect(formatImportDateTimeLong('2026-09-10T01:15:00.000Z')).toBe('2026年9月10日 10:15');
    expect(formatImportDateTime('bad')).toBe('-');
  });

  it('月の一覧から対象期間', () => {
    expect(importPeriodFromMonths(['2026-08', '2026-02', '2026-07'])).toEqual({
      from: '2026-02-01',
      to: '2026-08-31',
    });
    expect(importPeriodFromMonths(['2028-02'])).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(importPeriodFromMonths([])).toEqual({ from: null, to: null });
  });
});

describe('取込元', () => {
  it('名前と略称', () => {
    expect(IMPORT_SOURCE_LABEL).toEqual({
      mf: 'マネーフォワード',
      freee: 'freee',
      assets: 'MF資産推移',
      json: '復元JSON',
    });
    expect(IMPORT_SOURCE_SHORT).toEqual({ mf: 'MF', freee: 'freee', assets: 'MF資産', json: 'JSON' });
  });

  it('表示順で重複を除く', () => {
    expect(orderedImportSources(['json', 'freee', null, 'mf', 'freee', 'unknown'])).toEqual([
      'mf',
      'freee',
      'json',
    ]);
  });
});
