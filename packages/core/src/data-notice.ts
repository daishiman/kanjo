/**
 * 取込データと AI 送信の扱いを伝える文 (spec-guide-screen FR-12・R-2)。
 *
 * 共通シェルのフッタは初期 JS に入るため、使い方画面の本文表を持つ guide-screen.ts とは
 * 別のモジュールに置く (同じモジュールから値を import すると本文表ごと初期 JS に載る)。
 */

/** AI 送信の補足 (フッタの title・プライバシー欄・使い方画面の 3 か所で同じ文、qa-guide-decision-011) */
export const AI_DATA_NOTICE = 'AI 実行時は、確認した集計データを選択した AI へ渡します';
