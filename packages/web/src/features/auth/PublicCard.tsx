/**
 * 認証前の画面すべてに共通の型 (§7.1): カードの外の上にロゴ、中央にカード1枚、カードの下端にフッター。
 *
 * アプリ枠 (ヘッダー・サイドバー) を一切持たない。枠の中に置くと、未認証のまま業務 API を叩く経路が残る。
 * フッターは main の外に置き、ページ全体の contentinfo として読ませる。
 */
import type { ReactNode } from 'react';
import { LoginFooter } from './LoginFooter.js';
import { LogoMark } from './icons.js';

export function PublicCard({ children, labelledBy }: { children: ReactNode; labelledBy?: string }) {
  return (
    <div className="login-page">
      <p className="login-logo">
        <LogoMark />
        <span>Focus Ledger</span>
      </p>
      <div className="login-card">
        <main className="login-main" aria-labelledby={labelledBy}>
          {children}
        </main>
        <LoginFooter />
      </div>
    </div>
  );
}
