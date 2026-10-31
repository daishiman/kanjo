/**
 * 現金入力の下書きを置く localStorage の鍵の接頭辞 (spec-cash-screen FR-8)。
 *
 * cash-screen.ts ではなくこのファイルに置く理由: ログアウト処理 (web の Layout) は下書きを
 * 消すためにこの接頭辞だけを要る。cash-screen.ts に置くと、同ファイル内の相互参照のせいで
 * 検証関数一式が初期バンドルへ引き込まれ、初期 JS budget (110KiB) を超える。
 * 接頭辞を変えると既存の下書きは読めなくなるので、版を上げるときは v2 のように末尾で区別する。
 */
export const CASH_DRAFT_KEY_PREFIX = 'kanjo:cash-draft:v1:';
