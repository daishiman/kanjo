/**
 * 受信した診断情報をサーバ側でもう一度マスク・切り詰めする層。
 *
 * クライアント側のマスク(packages/web/src/diagnostics-buffer.ts)は改竄可能な経路にある。
 * 「クライアントが既にマスクしたはず」を信用すると、細工した本文をそのまま保存してしまう。
 * したがってここで同じ core の規則を再適用する。core の redactSecrets は冪等なので、
 * 二度掛けても正しくマスクされた値は変わらない。
 */
import {
  DIAGNOSTIC_MAX_ENTRIES,
  type DiagnosticPayload,
  redactSecrets,
  sanitizeDiagnosticPayload,
} from '@kanjo/core';
import { diagnosticPayloadSchema } from './contract.js';

/** 診断が無い/壊れているときの既定値。投稿そのものは成立させる */
export const emptyDiagnostics = (route: string, now: string): DiagnosticPayload => ({
  environment: { userAgent: '', language: '', viewport: '', route, capturedAt: now },
  entries: [],
  omittedCount: 0,
});

export interface ParsedDiagnostics {
  payload: DiagnosticPayload;
  /** 入力が診断として解釈できなかった場合に true。投稿は通すが画面へ知らせる */
  rejected: boolean;
}

/**
 * multipart の diagnostics フィールド(信頼できない JSON 文字列)を検証済み payload にする。
 *
 * 失敗しても例外にしない。診断が壊れていることは要望の投稿を止める理由にならない。
 */
export function parseDiagnosticsField(
  raw: string | null,
  fallbackRoute: string,
  now: string,
): ParsedDiagnostics {
  if (!raw || !raw.trim()) return { payload: emptyDiagnostics(fallbackRoute, now), rejected: false };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { payload: emptyDiagnostics(fallbackRoute, now), rejected: true };
  }
  const parsed = diagnosticPayloadSchema.safeParse(json);
  if (!parsed.success) return { payload: emptyDiagnostics(fallbackRoute, now), rejected: true };
  // 件数上限を超える入力は弾かずに切り詰め、捨てた件数を omittedCount へ足す
  return { payload: sanitizeDiagnosticPayload(parsed.data as DiagnosticPayload), rejected: false };
}

/** 本文と画面パスにもマスクを掛ける。利用者が誤ってトークンやメールを貼る経路がある */
export const redactText = (text: string, max: number): string => redactSecrets(text).slice(0, max);

/** 上限を超えた入力かどうか。画面へ「省略された」と出すために使う */
export const exceededEntryLimit = (payload: DiagnosticPayload): boolean =>
  payload.entries.length >= DIAGNOSTIC_MAX_ENTRIES;

/**
 * 画像のマジックナンバーだけで content-type を決める。
 * 拡張子や申告された type を信用しない(中身と食い違うと後で開けない)。
 */
export function sniffScreenshotType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'image/png';
  return null;
}
