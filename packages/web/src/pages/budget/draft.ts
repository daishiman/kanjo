/**
 * 予算一覧の入力状態と、ブラウザ内の下書き (spec-budget-screen §7.11)。
 *
 * キーは `kanjo:budget:draft:{userId}:{start}`、値は `{ v: 1, savedAt, rows }`。rows には保存済みの値と違う行だけを入れる。
 * 形が壊れている・v が 1 でない・30 日を過ぎた下書きは読込時に捨て、一覧に無い科目の行も捨てる。
 * ログアウトで接頭辞の一致するキーを全て消す (Layout.tsx)。サーバへは送らない。
 * localStorage が使えない環境でも入力と保存はできる (liability-draft.ts と同じ try/catch)。
 */
import { BUDGET_AMOUNT_LIMIT, BUDGET_REASON_MAX, type BudgetInput } from '@kanjo/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const BUDGET_DRAFT_PREFIX = 'kanjo:budget:draft:';
const DRAFT_DELAY_MS = 800;
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 1 行の入力欄の文字列 (桁区切りを含みうる) */
export interface BudgetFormRow {
  annualAmount: string;
  planAdjustment: string;
  planReason: string;
}

export type BudgetFormRows = Record<string, BudgetFormRow>;

interface BudgetDraft {
  v: 1;
  savedAt: string;
  rows: BudgetFormRows;
}

export const EMPTY_FORM_ROW: BudgetFormRow = { annualAmount: '', planAdjustment: '', planReason: '' };

export const budgetDraftKey = (userId: string, start: string) => `${BUDGET_DRAFT_PREFIX}${userId}:${start}`;

/** 桁区切り・空白・¥ を外した整数。空は null、読めない・範囲外は undefined (BR-17) */
export function parseBudgetAmount(raw: string): number | null | undefined {
  const text = raw.replace(/[,，\s¥￥]/g, '').replace(/^[−－]/, '-');
  if (text === '') return null;
  if (!/^-?\d+$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) && Math.abs(value) <= BUDGET_AMOUNT_LIMIT ? value : undefined;
}

/** 入力中の値を桁区切りで見せる。読めない値はそのまま返す (打ち間違いを消さない) */
export function formatBudgetAmount(raw: string): string {
  const value = parseBudgetAmount(raw);
  return value == null ? raw : value.toLocaleString('ja-JP');
}

/** 保存済みの値 (無ければ未設定) を入力欄の文字列にする */
export function formRowOf(saved: BudgetInput | null): BudgetFormRow {
  if (!saved) return EMPTY_FORM_ROW;
  return {
    annualAmount: saved.annualAmount == null ? '' : saved.annualAmount.toLocaleString('ja-JP'),
    planAdjustment: saved.planAdjustment === 0 ? '' : saved.planAdjustment.toLocaleString('ja-JP'),
    planReason: saved.planReason ?? '',
  };
}

/**
 * 入力欄を core の入力にする。読めない欄は null を返し、その行は保存できない。
 * 調整額の空は 0、理由は前後の空白を除いて空なら null。
 */
export function inputOf(row: BudgetFormRow): BudgetInput | null {
  const annualAmount = parseBudgetAmount(row.annualAmount);
  const adjustment = parseBudgetAmount(row.planAdjustment);
  if (annualAmount === undefined || adjustment === undefined) return null;
  const reason = row.planReason.trim();
  return { annualAmount, planAdjustment: adjustment ?? 0, planReason: reason === '' ? null : reason };
}

/** 2 つの入力が同じ事実を表すか。数値は解釈後の値で比べる (BR-21) */
export function sameFormRow(a: BudgetFormRow | undefined, b: BudgetFormRow | undefined): boolean {
  const left = a ?? EMPTY_FORM_ROW;
  const right = b ?? EMPTY_FORM_ROW;
  const inputA = inputOf(left);
  const inputB = inputOf(right);
  // 読めない欄を含む行は、打った文字のまま比べる (打ち間違いを保存済みと同じにしない)
  if (!inputA || !inputB)
    return (
      left.annualAmount === right.annualAmount &&
      left.planAdjustment === right.planAdjustment &&
      left.planReason.trim() === right.planReason.trim()
    );
  return (
    inputA.annualAmount === inputB.annualAmount &&
    inputA.planAdjustment === inputB.planAdjustment &&
    inputA.planReason === inputB.planReason
  );
}

/** 保存済みの値と違う行の科目 (未保存の項目。BR-21) */
export function unsavedAccounts(saved: BudgetFormRows, rows: BudgetFormRows): string[] {
  return Object.keys(saved).filter((account) => !sameFormRow(saved[account], rows[account]));
}

function isFormRow(value: unknown): value is BudgetFormRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.annualAmount === 'string' &&
    typeof row.planAdjustment === 'string' &&
    typeof row.planReason === 'string' &&
    row.planReason.length <= BUDGET_REASON_MAX
  );
}

/** 下書きを読む。捨てる条件に当たれば null。一覧に無い科目の行は落とす */
function readDraft(key: string | null, accounts: ReadonlySet<string>, now: number): BudgetDraft | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<BudgetDraft>;
    const savedAt = typeof value?.savedAt === 'string' ? Date.parse(value.savedAt) : Number.NaN;
    if (value?.v !== 1 || Number.isNaN(savedAt) || now - savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    if (typeof value.rows !== 'object' || value.rows === null) return null;
    const rows = Object.fromEntries(
      Object.entries(value.rows).filter(([account, row]) => accounts.has(account) && isFormRow(row)),
    );
    return { v: 1, savedAt: value.savedAt as string, rows };
  } catch {
    // 壊れた下書きは捨てる (保存済みの値から始める)
    return null;
  }
}

function writeDraft(key: string, draft: BudgetDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function removeDraft(key: string | null): void {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // 消せなくても、次の保存成功で上書きされる
  }
}

/** ログアウト時に全利用者・全期間の下書きを消す */
export function clearAllBudgetDrafts(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(BUDGET_DRAFT_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // localStorage が使えない環境では下書き自体が無い
  }
}

const overlay = (saved: BudgetFormRows, draftRows: BudgetFormRows): BudgetFormRows => ({
  ...saved,
  ...draftRows,
});

/**
 * dirty patch のうち、現在の一覧に存在し、保存済み値と異なる行だけを残す。
 * 未編集行を patch に入れないことが、外部更新を上書きしないための状態所有境界。
 */
function compactPatch(saved: BudgetFormRows, draftRows: BudgetFormRows): BudgetFormRows {
  return Object.fromEntries(
    Object.entries(draftRows).filter(
      ([account, row]) => Object.hasOwn(saved, account) && !sameFormRow(saved[account], row),
    ),
  );
}

function persistDraft(key: string | null, saved: BudgetFormRows, draftRows: BudgetFormRows): string | null {
  if (!key) return null;
  const rows = compactPatch(saved, draftRows);
  if (Object.keys(rows).length === 0) {
    removeDraft(key);
    return null;
  }
  const savedAt = new Date().toISOString();
  return writeDraft(key, { v: 1, savedAt, rows }) ? savedAt : null;
}

/**
 * 一覧の入力と下書き。userId が分からない間 (認証確認中) は下書きを読み書きしない。
 * 予算対象・利用者が変わるときは、切替前の dirty patch を同期的に保存する。
 * 同じ範囲で保存済み値が変わったときは、dirty 行だけを新しい値に rebase する。
 */
export function useBudgetDraft({
  userId,
  start,
  saved,
}: {
  userId: string | null;
  start: string | null;
  saved: BudgetFormRows;
}) {
  const key = userId && start ? budgetDraftKey(userId, start) : null;
  const savedSignature = JSON.stringify(saved);
  const accounts = useMemo(() => new Set(Object.keys(saved)), [saved]);
  const initial = useMemo(() => readDraft(key, accounts, Date.now()), [key, accounts]);
  const [draftRows, setDraftRows] = useState<BudgetFormRows>(() => initial?.rows ?? {});
  const [savedAt, setSavedAt] = useState<string | null>(() => initial?.savedAt ?? null);
  const scope = useRef({ key, saved, draftRows });

  // 同じ scope の最新値だけ ref に反映する。key が変わった render では旧scopeを保ち、effectでflushする。
  if (scope.current.key === key) scope.current = { key, saved, draftRows };

  const rows = useMemo(() => overlay(saved, draftRows), [saved, draftRows]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 範囲・利用者・保存済みの値が変わったときだけ始め直す。
  useEffect(() => {
    const previous = scope.current;
    if (previous.key === key) {
      setDraftRows((current) => compactPatch(saved, current));
      scope.current = { key, saved, draftRows: compactPatch(saved, previous.draftRows) };
      return;
    }
    persistDraft(previous.key, previous.saved, previous.draftRows);
    const draft = readDraft(key, accounts, Date.now());
    const nextRows = draft?.rows ?? {};
    setDraftRows(nextRows);
    setSavedAt(draft?.savedAt ?? null);
    scope.current = { key, saved, draftRows: nextRows };
  }, [key, savedSignature]);

  // 入力が止まって 800ms 後に下書きへ書く。保存済みの値に戻したら下書きを消す
  useEffect(() => {
    if (!key) return;
    const timer = window.setTimeout(() => {
      setSavedAt(persistDraft(key, saved, draftRows));
    }, DRAFT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [key, draftRows, saved]);

  // debounce待ちの間にタブを閉じたりコンポーネントを外しても、最後の入力を失わない。
  useEffect(() => {
    const flush = () => {
      const current = scope.current;
      persistDraft(current.key, current.saved, current.draftRows);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const setRow = useCallback(
    (account: string, patch: Partial<BudgetFormRow>) => {
      setDraftRows((previous) => {
        const next = { ...previous };
        const row = { ...(previous[account] ?? saved[account] ?? EMPTY_FORM_ROW), ...patch };
        if (sameFormRow(saved[account], row)) delete next[account];
        else next[account] = row;
        return next;
      });
    },
    [saved],
  );

  /** 複数行の来期予算をまとめて入れる (実績から提案) */
  const setAnnualAmounts = useCallback(
    (values: Record<string, number>) => {
      setDraftRows((previous) => {
        const next = { ...previous };
        for (const [account, value] of Object.entries(values)) {
          const row = {
            ...(previous[account] ?? saved[account] ?? EMPTY_FORM_ROW),
            annualAmount: value.toLocaleString('ja-JP'),
          };
          if (sameFormRow(saved[account], row)) delete next[account];
          else next[account] = row;
        }
        return next;
      });
    },
    [saved],
  );

  /**
   * 指定した行 (null は全行) を保存済みの値へ戻す。全行なら下書きのキーごと消す。
   * 一部の行なら、残りの未保存の行で下書きを書き直す (800ms の書込みに任せる)。
   */
  const revert = useCallback(
    (targets: readonly string[] | null) => {
      if (targets === null) {
        removeDraft(key);
        setSavedAt(null);
        setDraftRows({});
        return;
      }
      setDraftRows((previous) => {
        const next = { ...previous };
        for (const account of targets) delete next[account];
        return next;
      });
    },
    [key],
  );

  /** 保存成功時。下書きを消す (入力は再取得した保存済みの値から作り直される) */
  const clear = useCallback(() => {
    removeDraft(key);
    setSavedAt(null);
    setDraftRows({});
  }, [key]);

  const unsaved = useMemo(() => Object.keys(compactPatch(saved, draftRows)), [saved, draftRows]);
  return { rows, setRow, setAnnualAmounts, revert, clear, savedAt, unsaved };
}
