/**
 * DevTools 相当の診断情報を、アプリ起動時から上限つきで貯めておく。
 *
 * エラーは改善要望ボタンを押す「前」に起きている。だから収集はモーダルを開いた時ではなく、
 * アプリの起動時から始まっていなければならない。ここは App.tsx がモジュールとして
 * 読み込まれた時点(=最初の描画より前)で install される。
 *
 * 記録するのは未捕捉例外 / unhandledrejection / console error・warn / 失敗した通信の4種。
 * 通信はメソッド・パス・ステータスだけを持ち、レスポンス本文は持たない。
 * 金融明細が診断経路へ漏れる余地を、構造として残さないため。
 */
import {
  DIAGNOSTIC_MAX_ENTRIES,
  type DiagnosticEntry,
  type DiagnosticKind,
  type DiagnosticPayload,
  normalizeDiagnosticEntry,
  trimDiagnostics,
} from '@kanjo/core';

/** 保持する生データの上限。snapshot 時にバイト上限でもう一段絞る */
const CAPACITY = DIAGNOSTIC_MAX_ENTRIES;

/** スタックは先頭数フレームだけ残す。それ以上は原因特定にほぼ寄与せず、量だけ増える */
const STACK_FRAMES = 4;

const entries: DiagnosticEntry[] = [];
/** 上限で捨てた件数。黙って捨てないための数え上げ */
let droppedCount = 0;
let installed = false;

export function recordDiagnostic(kind: DiagnosticKind, message: string, detail = ''): void {
  const entry = normalizeDiagnosticEntry({
    at: new Date().toISOString(),
    kind,
    message,
    detail,
  });
  entries.push(entry);
  while (entries.length > CAPACITY) {
    entries.shift();
    droppedCount += 1;
  }
}

/** 現在の記録を、送信できる形へ固める。呼んでもバッファは空にしない(投稿失敗時に再送できる) */
export function diagnosticsSnapshot(route: string): DiagnosticPayload {
  const trimmed = trimDiagnostics(entries);
  return {
    environment: {
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      language: typeof navigator === 'undefined' ? '' : navigator.language,
      viewport:
        typeof window === 'undefined'
          ? ''
          : `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
      route,
      capturedAt: new Date().toISOString(),
    },
    entries: trimmed.entries,
    omittedCount: droppedCount + trimmed.omittedCount,
  };
}

/** テスト用。install 済みフラグは戻さない(二重パッチを防ぐため) */
export function resetDiagnosticsForTest(): void {
  entries.length = 0;
  droppedCount = 0;
}

const shortStack = (stack: string | undefined): string =>
  (stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .slice(0, STACK_FRAMES)
    .join(' / ');

/** console.error/warn の引数を1行にする。Error は message とスタック先頭だけを採る */
function formatArgs(args: unknown[]): { message: string; detail: string } {
  const parts: string[] = [];
  let detail = '';
  for (const arg of args) {
    if (arg instanceof Error) {
      parts.push(`${arg.name}: ${arg.message}`);
      if (!detail) detail = shortStack(arg.stack);
      continue;
    }
    if (typeof arg === 'string') {
      parts.push(arg);
      continue;
    }
    try {
      parts.push(JSON.stringify(arg));
    } catch {
      parts.push(String(arg));
    }
  }
  return { message: parts.join(' '), detail };
}

/** クエリ文字列はここでは落とさない。core の redactSecrets が値だけをマスクする */
const pathOf = (input: RequestInfo | URL): string => {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return new URL(raw, typeof location === 'undefined' ? 'http://localhost' : location.href).pathname;
  } catch {
    return String(input);
  }
};

/**
 * 収集を開始する。二度呼んでも二重にパッチしない。
 * 返り値は解除関数(テストで使う)。
 */
export function installDiagnostics(): () => void {
  if (installed || typeof window === 'undefined') return () => undefined;
  installed = true;

  const onError = (event: ErrorEvent) => {
    const error = event.error;
    recordDiagnostic(
      'error',
      error instanceof Error ? `${error.name}: ${error.message}` : event.message,
      error instanceof Error ? shortStack(error.stack) : `${event.filename}:${event.lineno}`,
    );
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    recordDiagnostic(
      'unhandledrejection',
      reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason),
      reason instanceof Error ? shortStack(reason.stack) : '',
    );
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  const originalError = console.error;
  const originalWarn = console.warn;
  const patch =
    (original: typeof console.error, kind: DiagnosticKind) =>
    (...args: unknown[]) => {
      // 先に元の出力を済ませる。記録側で失敗しても DevTools の表示は失わない
      original.apply(console, args);
      try {
        const { message, detail } = formatArgs(args);
        recordDiagnostic(kind, message, detail);
      } catch {
        // 記録の失敗はアプリの失敗ではない。ここで投げると console.error 自身が壊れる
      }
    };
  console.error = patch(originalError, 'console_error');
  console.warn = patch(originalWarn, 'console_warn');

  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const started = Date.now();
    try {
      const res = await originalFetch(input, init);
      if (!res.ok) {
        recordDiagnostic('network', `${method} ${pathOf(input)} ${res.status}`, `${Date.now() - started}ms`);
      }
      return res;
    } catch (error) {
      recordDiagnostic(
        'network',
        `${method} ${pathOf(input)} failed`,
        error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      );
      throw error;
    }
  };

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    console.error = originalError;
    console.warn = originalWarn;
    window.fetch = originalFetch;
    installed = false;
  };
}
