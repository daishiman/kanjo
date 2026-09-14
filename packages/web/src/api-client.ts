/** JSON APIの共通transport。認証イベントとerror envelopeの解釈はここだけに置く。 */
export class ApiError extends Error {
  status: number;
  code: string;
  /** 409 partial-safe responseなど、UIが失敗内訳を正直に表示するための検証済み候補body。 */
  body: unknown;

  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export const AUTH_EVENT = 'kanjo:unauthorized';

async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // JSONでないエラーは状態コードだけを使う。
  }
  return apiErrorFromBody(res.status, body);
}

function apiErrorFromBody(status: number, body: unknown): ApiError {
  let code = 'error';
  let message = `エラー(${status})`;
  const error = (body as { error?: { code?: string; message?: string } } | undefined)?.error;
  if (error?.code) code = error.code;
  if (error?.message) message = error.message;
  return new ApiError(status, code, message, body);
}

export interface ApiRequestPolicy {
  /** この画面内の資格情報再入力だけで回復できる401 code。列挙外の401は認証失効として通知する。 */
  recoverableUnauthorizedCodes?: readonly string[];
}

export async function api<T>(path: string, init?: RequestInit, policy: ApiRequestPolicy = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    const error = await apiErrorFromResponse(res);
    if (!policy.recoverableUnauthorizedCodes?.includes(error.code)) {
      window.dispatchEvent(new Event(AUTH_EVENT));
    }
    throw error;
  }
  if (!res.ok) throw await apiErrorFromResponse(res);
  return (await res.json()) as T;
}

/** multipartは境界付きContent-Typeをブラウザへ任せる。 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  options: { acceptErrorBody?: (body: unknown) => boolean } = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', body: form });
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT));
    throw new ApiError(401, 'unauthorized', '認証が必要です');
  }
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw apiErrorFromBody(res.status, undefined);
    }
    if (options.acceptErrorBody?.(body)) return body as T;
    throw apiErrorFromBody(res.status, body);
  }
  return (await res.json()) as T;
}
