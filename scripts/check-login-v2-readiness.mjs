import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 値を実行・出力せず、単一行のdotenv設定だけを読み取る。
export function checkLocalAuthConfiguration(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      const end = value.indexOf(quote, 1);
      value = end < 0 ? '' : value.slice(1, end);
    } else value = value.replace(/\s+#.*$/, '').trim();
    values.set(match[1], value);
  }
  const present = (name) => Boolean(values.get(name));
  const validOrigin = () => {
    try {
      const url = new URL(values.get('BETTER_AUTH_URL'));
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  };
  const mailFrom = (values.get('MAIL_FROM') ?? '').trim();
  const checks = [
    ['BETTER_AUTH_SECRET', (values.get('BETTER_AUTH_SECRET')?.length ?? 0) >= 32],
    ['BETTER_AUTH_URL', validOrigin()],
    ['GOOGLE_CLIENT_ID', present('GOOGLE_CLIENT_ID')],
    ['GOOGLE_CLIENT_SECRET', present('GOOGLE_CLIENT_SECRET')],
    ['RESEND_API_KEY', present('RESEND_API_KEY')],
    [
      'MAIL_FROM',
      /^[^\r\n]+@[^\r\n]+$/.test(mailFrom) &&
        !/@(?:[^>]*\.)?example\.(?:com|net|org|invalid)>?$/i.test(mailFrom),
    ],
    ['ACCESS_PAIR', present('ACCESS_AUD') === present('ACCESS_TEAM_DOMAIN')],
  ].map(([name, ok]) => ({ name, status: ok ? 'configured' : 'missing_or_invalid' }));
  return {
    scope: 'local_configuration_only',
    ready: checks.every((check) => check.status === 'configured'),
    checks,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let source = '';
  try {
    source = readFileSync(new URL('../packages/api/.dev.vars', import.meta.url), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('ローカル認証設定を読み取れません');
  }
  const report = checkLocalAuthConfiguration(source);
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('Login v2 ローカル設定診断（本番設定・実Googleログイン・メール配送の疎通は別途確認）');
    for (const check of report.checks)
      console.log(`${check.name}: ${check.status === 'configured' ? '設定あり' : '未設定または不正'}`);
  }
  process.exitCode = report.ready ? 0 : 1;
}
