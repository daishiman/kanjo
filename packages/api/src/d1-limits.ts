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
