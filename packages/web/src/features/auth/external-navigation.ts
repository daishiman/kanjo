/**
 * 同じ SPA の外 (Google の認可画面) へ移る唯一の出口。
 *
 * window.location.assign を部品から直に呼ぶと、jsdom では遷移が実装されておらず、
 * テストは「どこへ移ろうとしたか」を確かめられない。出口を1つのオブジェクトに寄せ、
 * テストはこのメソッドだけを差し替える。
 */
export const externalNavigation = {
  assign(url: string): void {
    window.location.assign(url);
  },
};
