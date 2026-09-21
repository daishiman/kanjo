/**
 * 詳細画面から一覧へ戻るリンク (spec-ai-analysis-screen FR-6)。
 *
 * 3 ルート (依頼の詳細・レポート一覧・レポート詳細) が同じ形を出すので、
 * 矢印と見た目をここへ集める。行き先と名前だけが画面ごとに違う。
 */
import { Link } from 'react-router-dom';

export function AiBackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link className="ai-back-link" to={to}>
      ← {children}
    </Link>
  );
}
