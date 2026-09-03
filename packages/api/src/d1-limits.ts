/**
 * D1(SQLite)が1文に課す上限。破ると文ごと SQLITE_ERROR になり、そのAPIは500で落ちる。
 *
 * ここに集めているのは、上限を「分割数」として直に使う書き方を防ぐため。
 * IN() に載せる件数は、同じ文に載る他のバインド(user_id や SET 句の値)のぶんだけ
 * 上限より小さくなければならない。この関係が定数の名前から読めないと、
 * 条件を1つ足した日に、件数が増えたときだけ落ちる不具合になる。
 */

/** 1文あたりのバインド変数の最大数 */
export const D1_MAX_BOUND_PARAMS = 100;

/**
 * IN() に並べてよい値の数。fixed は同じ文に載る IN() 以外のバインド数。
 * 1文に載せきれない場合は呼び出し側で分割する。
 */
export const inClauseChunkSize = (fixed: number): number => Math.max(1, D1_MAX_BOUND_PARAMS - fixed);

/** 予算を超えた実行を止めたときに投げる。呼び出し側が 413 などへ翻訳する。 */
export class QueryBudgetExceededError extends Error {
  constructor(
    readonly planned: number,
    readonly actual: number,
    readonly limit: number,
  ) {
    // 件数だけを載せる。範囲や明細IDはメッセージへ入れない(DR-9)
    super(`query budget exceeded: actual=${actual} planned=${planned} limit=${limit}`);
    this.name = 'QueryBudgetExceededError';
  }
}

/**
 * 実際に発行するクエリ数が見積りを超えていないことを、書き込みの直前に確かめる。
 *
 * 見積りだけを検査しても意味が薄い。見積りは書いた本人の思い込みで、
 * 実装を1文足した日に静かにずれる。ずれたまま本番へ出ると、1回の呼び出しの
 * 途中でクエリ上限に当たり、「半分書けた取込」で止まる。
 * だから超えているときは1文も発行せずに落とす(fail-closed)。
 */
export function assertQueryBudget(
  plan: { total: number; limit: number; accepted: boolean },
  actual: number,
): void {
  if (!plan.accepted || actual > plan.total || actual >= plan.limit) {
    throw new QueryBudgetExceededError(plan.total, actual, plan.limit);
  }
}
