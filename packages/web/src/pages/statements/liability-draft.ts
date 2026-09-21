/**
 * 負債入力フォームの状態と、ブラウザ内の下書き (spec-statements-screen §4)。
 *
 * キーは `kanjo.statements.liabilityDraft.<userId>.<YYYY-MM>`、値は `{ savedAt, lines }`。
 * 別の利用者が同じブラウザを使っても下書きが混ざらないよう userId を鍵に入れ、
 * ログアウトで接頭辞の一致するキーを全て消す (Layout.tsx)。サーバへは送らない。
 * localStorage が使えない環境 (プライベートモード等) でも入力と保存はできる (period.tsx と同じ try/catch)。
 */
import { LIABILITY_AMOUNT_MAX, type LiabilityLineStatus, type StatementsBsLine } from '@kanjo/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const LIABILITY_DRAFT_PREFIX = 'kanjo.statements.liabilityDraft.';
const DRAFT_DELAY_MS = 800;

/** status=null は「まだ何も選んでいない」。必須項目では保存できない */
export interface LiabilityFormLine {
  status: LiabilityLineStatus | null;
  /** 金額欄の入力文字列 (桁区切りを含みうる)。status=amount のときだけ意味を持つ */
  amount: string;
}

export type LiabilityFormLines = Record<string, LiabilityFormLine>;

export interface LiabilityDraft {
  savedAt: string;
  lines: LiabilityFormLines;
}

export const draftKey = (userId: string, month: string) => `${LIABILITY_DRAFT_PREFIX}${userId}.${month}`;

/**
 * 保存済みの BS からフォームの初期値を作る。
 * 未入力 (行が無い) の項目は何も選ばない状態にし、利用者に「未入力のままでよいか」を選ばせる。
 */
export function formLinesFromBs(lines: ReadonlyArray<StatementsBsLine>): LiabilityFormLines {
  return Object.fromEntries(
    lines.map((line) => [
      line.category,
      line.status === 'unset'
        ? { status: null, amount: '' }
        : {
            status: line.status,
            amount: line.status === 'amount' ? formatAmount(String(line.amount ?? 0)) : '',
          },
    ]),
  );
}

/** 桁区切りを外した整数。空・数字以外・上限超えは null */
export function parseAmount(raw: string): number | null {
  const digits = raw.replace(/[,，\s¥￥]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value <= LIABILITY_AMOUNT_MAX ? value : null;
}

/** 入力中の値を桁区切りで見せる。数字として読めない値はそのまま返す (打ち間違いを消さない) */
export function formatAmount(raw: string): string {
  const value = parseAmount(raw);
  return value === null ? raw : value.toLocaleString('ja-JP');
}

/** 2 つのフォーム値が同じ事実を表すか。金額は数値で比べる (`1,000` と `1000` は同じ) */
function sameLine(a: LiabilityFormLine | undefined, b: LiabilityFormLine | undefined): boolean {
  const statusA = a?.status ?? null;
  const statusB = b?.status ?? null;
  if (statusA !== statusB) return false;
  if (statusA !== 'amount') return true;
  const valueA = parseAmount(a?.amount ?? '');
  const valueB = parseAmount(b?.amount ?? '');
  // どちらも数字として読めないときは、打った文字のまま比べる (空欄と打ち間違いを同じにしない)
  return valueA === null && valueB === null ? (a?.amount ?? '') === (b?.amount ?? '') : valueA === valueB;
}

/** 保存済みの値と違う項目の数 (未保存バーの N 件) */
export function countUnsaved(saved: LiabilityFormLines, draft: LiabilityFormLines): number {
  return changedLiabilityLines(saved, draft).length;
}

/** 保存APIへ送る必要がある行。保存済みと同じ行を再送せず、利用者が変えた事実だけを返す。 */
export function changedLiabilityLines(
  saved: LiabilityFormLines,
  draft: LiabilityFormLines,
): Array<[string, LiabilityFormLine]> {
  const categories = new Set([...Object.keys(saved), ...Object.keys(draft)]);
  return [...categories]
    .filter((category) => !sameLine(saved[category], draft[category]))
    .map((category) => [category, draft[category] ?? { status: null, amount: '' }]);
}

function readDraft(key: string | null): LiabilityDraft | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as LiabilityDraft;
    if (typeof value?.savedAt !== 'string' || typeof value.lines !== 'object' || value.lines === null)
      return null;
    return value;
  } catch {
    // 壊れた下書きは捨てる (保存済みの値から始める)
    return null;
  }
}

function writeDraft(key: string, draft: LiabilityDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(key: string | null): void {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // 消せなくても、次の保存成功で上書きされる
  }
}

/** ログアウト時に全利用者・全月の下書きを消す */
export function clearAllLiabilityDrafts(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(LIABILITY_DRAFT_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // localStorage が使えない環境では下書き自体が無い
  }
}

/**
 * フォームの値と下書き。userId が分からない間 (認証確認中) は下書きを読み書きしない。
 * 月や保存済みの値が変わったら、その月の下書き (無ければ保存済みの値) から始め直す。
 */
export function useLiabilityDraft({
  userId,
  month,
  saved,
}: {
  userId: string | null;
  month: string;
  saved: LiabilityFormLines;
}) {
  const key = userId && month ? draftKey(userId, month) : null;
  const savedSignature = JSON.stringify(saved);
  const [lines, setLines] = useState<LiabilityFormLines>(() => readDraft(key)?.lines ?? saved);
  const [savedAt, setSavedAt] = useState<string | null>(() => readDraft(key)?.savedAt ?? null);
  const touched = useRef(false);
  const scope = useRef({ userId, month });

  // biome-ignore lint/correctness/useExhaustiveDependencies: 月・利用者・保存済みの値が変わったときだけ始め直す。
  useEffect(() => {
    const previous = scope.current;
    const monthChanged = previous.month !== month;
    const userChanged = previous.userId !== userId;
    const authCompleted = previous.userId === null && userId !== null;
    scope.current = { userId, month };
    // 認証確認中に先に入力された値は userId 確定時も守る。
    // 一方、月や利用者が変わったときは前の範囲の下書きを持ち越さない。
    if (touched.current && !monthChanged && (!userChanged || authCompleted)) return;
    const draft = readDraft(key);
    setLines(draft?.lines ?? saved);
    setSavedAt(draft?.savedAt ?? null);
    touched.current = false;
  }, [key, savedSignature]);

  // 入力が止まって 800ms 後に下書きへ書く。保存済みの値に戻したら下書きを消す
  useEffect(() => {
    if (!touched.current || !key) return;
    const timer = window.setTimeout(() => {
      if (countUnsaved(saved, lines) === 0) {
        removeDraft(key);
        setSavedAt(null);
        return;
      }
      const draft = { savedAt: new Date().toISOString(), lines };
      if (writeDraft(key, draft)) setSavedAt(draft.savedAt);
    }, DRAFT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, lines, saved]);

  const setLine = useCallback((category: string, patch: Partial<LiabilityFormLine>) => {
    touched.current = true;
    setLines((previous) => ({
      ...previous,
      [category]: { ...(previous[category] ?? { status: null, amount: '' }), ...patch },
    }));
  }, []);

  /** 保存済みの値へ戻し、下書きを消す */
  const reset = useCallback(() => {
    touched.current = false;
    removeDraft(key);
    setSavedAt(null);
    setLines(saved);
  }, [key, saved]);

  /** 保存成功時。下書きを消す (フォームの値は応答の BS から作り直される) */
  const clear = useCallback(() => {
    touched.current = false;
    removeDraft(key);
    setSavedAt(null);
  }, [key]);

  const unsaved = useMemo(() => countUnsaved(saved, lines), [saved, lines]);
  return { lines, setLine, reset, clear, savedAt, unsaved };
}
