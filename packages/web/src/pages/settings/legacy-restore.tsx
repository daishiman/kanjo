/**
 * 旧HTML版の全データJSONからの初期移行 (POST /api/restore) の文言と結果表示。
 *
 * 設定だけの復元 (設定JSON・夜間バックアップ) とは別の経路で、取引・現金明細まで入れ替わる。
 * 旧 pages/Settings.tsx から移した。文言は settings-restore.dom.test.tsx が固定している。
 */
import type { LegacyRestoreResponse } from '../../api.js';

/**
 * 確認ダイアログの本文。「続けますか?」は付けない。問いは見出しが持っており、
 * 本文まで問いにすると、読む側は同じ問いを 2 回読んでから答えることになる。
 */
const RESTORE_CASH_IMPACT =
  '現金明細は、移行先の現金明細が空で処理上限内の場合に復元します。既存の現金明細は保持し、取込元から追加しません。処理上限を超えた明細は復元しません。';

function restoreConfirmation(subject: string): string {
  return `${subject}。${RESTORE_CASH_IMPACT}`;
}

function formatRestoreCashResult(result: LegacyRestoreResponse): string {
  return `現金明細: 復元 ${result.cashEntries}件 / 既存を保持 ${result.cashKept}件 / 処理上限で未復元 ${result.cashSkipped}件`;
}

export const LEGACY_RESTORE_CONFIRMATION = restoreConfirmation('集計・分類・設定データを初期移行します');

/**
 * 夜間バックアップの本文を /api/restore へ流していた頃の確認文。
 * 設定画面の夜間バックアップは設定だけを戻す経路 (POST /api/backups/:date/restore) に変わったので画面では使わない。
 * 全データのバックアップ JSON を初期移行の口から入れる場合に起きることは同じなので、文言の契約として残す。
 */
export const BACKUP_RESTORE_CONFIRMATION = restoreConfirmation(
  'この日の夜間バックアップで集計・分類・設定データを上書きします',
);

export function LegacyRestoreNotice({ result }: { result: LegacyRestoreResponse }) {
  if (result.duplicate)
    return <p className="sub">同じ集計データは取り込み済みです。{formatRestoreCashResult(result)}</p>;
  return (
    <p className="sub">
      集計データを取り込みました(対象月 {result.months.length}件 / MF明細 {result.mfTxCount}件 / 分類ルール{' '}
      {result.rules}件)。{formatRestoreCashResult(result)}
    </p>
  );
}
