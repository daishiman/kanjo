/**
 * 設定画面の書式と失敗の文言 (spec-settings-screen §7.5・§7.9・§7.10・§7.12 と Error contract)。
 *
 * 文言は spec の表と完全一致で比べる。書式は JST の境界 (UTC 15:00 = JST 翌日 0:00) を必ず含める。
 */
import type { SettingsDiff } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api-client.js';
import {
  CONFLICT,
  backupBadge,
  backupDateLabel,
  backupMemo,
  backupSizeLabel,
  canRetry,
  diffLines,
  memoCount,
  panelDateLabel,
  restoreErrorMessage,
  saveErrorMessage,
  updatedByLabel,
} from './view-model.js';

const bucket = (count: number) => ({ count, items: [] });

const diff = (patch: Partial<SettingsDiff> = {}): SettingsDiff => ({
  normRules: { added: bucket(1), changed: bucket(2), removed: bucket(0), reordered: bucket(0) },
  ownerLabels: { changed: [] },
  statMinMonths: null,
  cashOverrides: { added: bucket(0), changed: bucket(0), removed: bucket(1) },
  total: 4,
  ...patch,
});

describe('日付・サイズ・バッジ', () => {
  it('説明パネルの日付は JST で月日を 2 桁にする', () => {
    expect(panelDateLabel('2026-01-04T15:05:00.000Z')).toBe('2026年01月05日 00:05');
    expect(panelDateLabel('not-a-date')).toBe('—');
    expect(updatedByLabel('owner')).toBe('（owner）');
  });

  it('バックアップの日付は作成時刻を JST で出し、無ければ日付だけ', () => {
    expect(backupDateLabel({ date: '2026-09-01', uploaded: '2026-08-31T17:00:00.000Z' })).toBe(
      '2026/09/01 02:00',
    );
    expect(backupDateLabel({ date: '2026-09-01', uploaded: null })).toBe('2026/09/01');
  });

  it('サイズは KB の整数に切り上げ、無ければ『—』', () => {
    expect(backupSizeLabel(1)).toBe('1KB');
    expect(backupSizeLabel(1024)).toBe('1KB');
    expect(backupSizeLabel(1025)).toBe('2KB');
    expect(backupSizeLabel(2_000_000)).toBe('1,954KB');
    expect(backupSizeLabel(null)).toBe('—');
  });

  it('バッジは失敗を最新より優先し、メモは保存値を優先する', () => {
    expect(backupBadge({ status: 'failed', latest: true })).toBe('失敗');
    expect(backupBadge({ status: 'success', latest: true })).toBe('最新');
    expect(backupBadge({ status: 'success', latest: false })).toBe('成功');
    expect(backupMemo({ status: 'success', memo: '手動' })).toBe('手動');
    expect(backupMemo({ status: 'success', memo: '' })).toBe('自動バックアップ');
    expect(backupMemo({ status: 'failed', memo: '' })).toBe('バックアップの作成に失敗しました');
  });

  it('メモの文字数はコードポイントで数える', () => {
    expect(memoCount('')).toBe('0/100');
    expect(memoCount('🍣あ')).toBe('2/100');
  });
});

describe('差分プレビュー', () => {
  it('節ごとに 1 行で、並び順は 0 件なら出さない', () => {
    expect(diffLines(diff())).toEqual([
      '集計ルール（追加 1 件・変更 2 件・削除 0 件）',
      '名義（変更 0 件）',
      '統計（変更なし）',
      '現金上書き（追加 0 件・変更 0 件・削除 1 件）',
    ]);
  });

  it('並び順と統計の変化があれば数を出す', () => {
    const lines = diffLines(
      diff({
        normRules: { added: bucket(0), changed: bucket(0), removed: bucket(0), reordered: bucket(3) },
        ownerLabels: { changed: [{ owner: 'spouse', before: 'パートナー', after: '妻' }] },
        statMinMonths: { before: 6, after: 12 },
      }),
    );
    expect(lines[0]).toBe('集計ルール（追加 0 件・変更 0 件・削除 0 件・並び順 3 件）');
    expect(lines[1]).toBe('名義（変更 1 件）');
    expect(lines[2]).toBe('統計（6 か月 → 12 か月）');
  });
});

describe('失敗の文言', () => {
  it('保存の失敗は状態で分け、入力を直す失敗と競合には再試行を出さない', () => {
    const bad = new ApiError(400, 'invalid_request', 'x');
    const large = new ApiError(413, 'payload_too_large', 'x');
    const conflict = new ApiError(409, 'settings_conflict', 'x');
    const other409 = new ApiError(409, 'busy', '取込中のため保存できません。');
    const server = new ApiError(500, 'internal', 'x');
    expect(saveErrorMessage(bad)).toBe('設定を保存できませんでした。入力内容を確認してください。');
    expect(saveErrorMessage(large)).toBe('保存する内容が大きすぎます。');
    expect(saveErrorMessage(conflict)).toBe(CONFLICT);
    expect(saveErrorMessage(other409)).toBe('取込中のため保存できません。');
    expect(saveErrorMessage(server)).toBe('設定を保存できませんでした。時間をおいてもう一度お試しください。');
    expect(saveErrorMessage(new TypeError('network'))).toBe(
      '設定を保存できませんでした。時間をおいてもう一度お試しください。',
    );
    expect([bad, large, conflict].map(canRetry)).toEqual([false, false, false]);
    expect([other409, server, new TypeError('network')].map(canRetry)).toEqual([true, true, true]);
  });

  it('復元・比較の失敗は code ごとに spec の文言を出す', () => {
    const cases: Array<[string, number, string]> = [
      ['invalid_settings_file', 400, '設定ファイルの形式が正しくありません。'],
      ['unsupported_settings_version', 400, 'このファイルの版には対応していません。'],
      ['pre_restore_backup_failed', 500, '現在の設定を退避できなかったため、復元を中止しました。'],
      ['settings_conflict', 409, CONFLICT],
      ['backup_not_found', 404, 'そのバックアップは残っていません(保持は30日)'],
      ['backup_settings_unreadable', 422, 'このバックアップの設定は読み取れません。'],
      ['payload_too_large', 413, 'ファイルが大きすぎます。'],
      ['internal', 500, '設定を復元できませんでした。時間をおいてもう一度お試しください。'],
    ];
    for (const [code, status, text] of cases)
      expect(restoreErrorMessage(new ApiError(status, code, 'x')), code).toBe(text);
  });
});
