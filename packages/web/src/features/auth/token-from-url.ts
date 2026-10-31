import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * `?token=` (設定画面の確認リンクは `?link_token=`) を1回だけ読んでメモリに持ち、URL からは消す (§7.11・§7.12・§7.14)。
 * 画面に残った URL の共有・履歴・Referer からトークンが漏れないようにする。消すのは token だけではなく query 全体。
 * トークンを持たない URL の query には触れない。
 */
export function useTokenFromUrl(name = 'token'): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.search).get(name));
  useEffect(() => {
    if (new URLSearchParams(location.search).has(name)) navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, name, navigate]);
  return token;
}
