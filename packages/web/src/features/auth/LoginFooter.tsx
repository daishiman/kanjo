/**
 * 認証前のカードのフッター (§7.1 の 10・§7.8)。サービス状況・ヘルプ・プライバシーの3つ。
 *
 * サービス状況は画面を開いたときに1回だけ照会する。認証前の画面どうしを行き来しても
 * 取り直さない (staleTime: Infinity)。5秒で打ち切り、答えが無いことも「確認できません」として出す。
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ICONS, Icon } from './icons.js';
import { SERVICE_STATE_LABEL, type ServiceState, serviceStateOf } from './view-model.js';

const STATUS_TIMEOUT_MS = 5_000;

async function fetchServiceState(): Promise<ServiceState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    // api() を通さない。稼働状態の失敗は「確認できません」に畳むだけで、認証失効の合図にもしない
    const res = await fetch('/api/status', { signal: controller.signal });
    if (!res.ok) return 'unknown';
    return serviceStateOf(await res.json());
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

export function LoginFooter() {
  const status = useQuery({
    queryKey: ['service-status'],
    queryFn: fetchServiceState,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return (
    <footer className="login-footer">
      <span className="login-footer-item">
        <Icon>{ICONS.shieldCheck}</Icon>
        サービス状況：
        {/* 取得中は空。値の幅が変わっても行の高さは動かない */}
        <span className="login-service-state" data-service-state={status.data ?? ''}>
          {status.data ? SERVICE_STATE_LABEL[status.data] : ''}
        </span>
      </span>
      <Link className="login-footer-item" to="/help">
        <Icon>{ICONS.help}</Icon>
        ヘルプ
      </Link>
      <Link className="login-footer-item" to="/privacy">
        <Icon>{ICONS.shield}</Icon>
        プライバシー
      </Link>
    </footer>
  );
}
