#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const REPO = 'daishiman/kanjo';
const ENVIRONMENT = 'production';
const BRANCH = 'main';
const ACCOUNT_NAME = 'Worker「kanjo-console」を所有する既存Account';
const ACCOUNT_MODE = 'existing';
const APP_URL = 'https://kanjo-console.daishimanju.workers.dev';
const WRANGLER_COMMAND = ['pnpm', '--dir', 'packages/api', 'exec', 'wrangler'];
const BETTER_AUTH_SECRET = 'BETTER_AUTH_SECRET';
const PROVIDER_SECRETS = [
  { name: 'GOOGLE_CLIENT_ID', label: 'Google OAuth Client ID' },
  { name: 'GOOGLE_CLIENT_SECRET', label: 'Google OAuth Client Secret' },
  { name: 'RESEND_API_KEY', label: 'Resend API Key' },
];
const DRY_RUN = process.argv.includes('--dry-run');
const ROTATE_BETTER_AUTH_SECRET = process.argv.includes('--rotate-better-auth-secret');
const REPLACE_PROVIDER_SECRETS = process.argv.includes('--replace-provider-secrets');

function executable(command) {
  return process.platform === 'win32' && ['gh', 'pnpm', 'npm', 'npx', 'yarn'].includes(command)
    ? `${command}.cmd`
    : command;
}

function run(command, args, options = {}) {
  const result = spawnSync(executable(command), args, {
    encoding: 'utf8',
    input: options.input,
    env: options.env ?? process.env,
    stdio: options.capture ? [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(' ')} に失敗しました。`);
  }
  return result.stdout || '';
}

function runGh(args, options = {}) {
  return run('gh', args, options);
}

function probeGh(args) {
  const result = spawnSync(executable('gh'), args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  return result;
}

function runWrangler(args, options = {}) {
  const [command, ...baseArgs] = WRANGLER_COMMAND;
  return run(command, [...baseArgs, ...args], options);
}

function putStdin(command, args, value, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable(command), args, { env, stdio: ['pipe', 'inherit', 'inherit'] });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command}の登録処理に失敗しました。`)),
    );
    child.stdin.end(`${value}\n`);
  });
}

function putGithubSecret(name, value) {
  return putStdin('gh', ['secret', 'set', name, '--env', ENVIRONMENT, '--repo', REPO], value);
}

export function putGithubVariable(name, value, { run = runGh, probe = probeGh } = {}) {
  // gh variable を持たない旧CLIでも、安定したREST APIとstdinで登録する。
  const endpoint = `repos/${REPO}/actions/variables`;
  const current = probe(['api', `${endpoint}/${encodeURIComponent(name)}`]);
  const exists = current.status === 0;
  if (!exists && !/HTTP 404|Not Found/i.test(current.stderr || '')) {
    throw new Error(`GitHub Variable ${name}の確認に失敗しました。`);
  }
  run(
    [
      'api',
      '--method',
      exists ? 'PATCH' : 'POST',
      exists ? `${endpoint}/${encodeURIComponent(name)}` : endpoint,
      '--input',
      '-',
    ],
    {
      input: JSON.stringify({ name, value }),
      capture: true,
    },
  );
}

function validateMailFrom(value) {
  const normalized = value.trim();
  if (
    !normalized ||
    /[\r\n]/.test(normalized) ||
    !normalized.includes('@') ||
    /@(?:[^>]*\.)?example\.(?:com|net|org|invalid)>?$/i.test(normalized)
  ) {
    throw new Error('MAIL_FROMはResendで検証済みの実在送信元を入力してください。');
  }
  return normalized;
}

function putWorkerSecret(name, value, credentials) {
  const [command, ...baseArgs] = WRANGLER_COMMAND;
  return putStdin(command, [...baseArgs, 'secret', 'put', name], value, credentials);
}

async function readHidden(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('VS Code等の対話Terminalから実行してください。');
  }
  process.stdout.write(`${label}（入力内容は表示されません）: `);
  const wasRaw = Boolean(process.stdin.isRaw);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write('\n');
      error ? reject(error) : resolve(value.trim());
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('中止しました。'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

function clipboard(inputValue) {
  const attempts =
    process.platform === 'darwin'
      ? [['pbcopy', []]]
      : process.platform === 'win32'
        ? [['clip', []]]
        : [
            ['wl-copy', []],
            ['xclip', ['-selection', 'clipboard']],
          ];
  for (const [command, args] of attempts) {
    const result = spawnSync(executable(command), args, { input: inputValue, encoding: 'utf8' });
    if (!result.error && result.status === 0) return;
  }
  throw new Error(
    'クリップボードへ安全にコピーできません。macOSはpbcopy、Windowsはclip、Linuxはwl-copyを使える状態にしてください。',
  );
}

async function confirmTeamAccount() {
  const rl = createInterface({ input, output });
  const expected = ACCOUNT_MODE === 'team' ? 'TEAM' : ACCOUNT_MODE === 'personal' ? 'PERSONAL' : 'EXISTING';
  const answer = await rl.question(`Cloudflareの対象は「${ACCOUNT_NAME}」です。${expected} と入力して続行: `);
  rl.close();
  if (answer.trim() !== expected) throw new Error('対象Accountの確認が一致しないため停止しました。');
}

async function verifyToken(accountId, apiToken) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true || body?.result?.status !== 'active') {
    throw new Error('API Tokenがactiveではないか、選択したAccountのTokenではありません。');
  }
}

function ensureGitHubEnvironment() {
  const environmentEndpoint = `repos/${REPO}/environments/${ENVIRONMENT}`;
  const currentResult = probeGh(['api', environmentEndpoint]);
  if (currentResult.status === 0) {
    const current = JSON.parse(currentResult.stdout || '{}');
    const policy = current.deployment_branch_policy;
    if (policy?.protected_branches !== false || policy?.custom_branch_policies !== true) {
      throw new Error(
        `既存${ENVIRONMENT} Environmentのbranch policyが想定外です。既存のreviewer等を上書きしないため停止しました。AIへ設定名だけを伝えてください。`,
      );
    }
  } else if (/HTTP 404|Not Found/i.test(currentResult.stderr || '')) {
    runGh(['api', '--method', 'PUT', environmentEndpoint, '--input', '-'], {
      input: JSON.stringify({
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      }),
      capture: true,
    });
  } else {
    if (currentResult.stderr) process.stderr.write(currentResult.stderr);
    throw new Error(`${ENVIRONMENT} Environmentの確認に失敗しました。`);
  }

  const policiesText = runGh(
    ['api', `repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies`],
    { capture: true },
  );
  const policies = JSON.parse(policiesText || '{}').branch_policies || [];
  const names = policies.map((policy) => policy.name);
  const unexpected = names.filter((name) => name !== BRANCH);
  if (unexpected.length) {
    throw new Error(
      `${ENVIRONMENT}が${BRANCH}以外も許可しています。既存policyを削除せず停止しました。AIへ許可ブランチ名だけを伝えてください。`,
    );
  }
  if (!names.includes(BRANCH)) {
    runGh(
      [
        'api',
        '--method',
        'POST',
        `repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies`,
        '-f',
        `name=${BRANCH}`,
        '-f',
        'type=branch',
      ],
      { capture: true },
    );
  }
}

function listWorkerSecrets(credentials) {
  return runWrangler(['secret', 'list'], { capture: true, env: credentials });
}

function workerSecretNames(credentials) {
  const output = listWorkerSecrets(credentials);
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((entry) => entry?.name).filter((name) => typeof name === 'string'));
    }
  } catch {
    // 旧Wranglerの表形式は次の行単位検査で扱う。
  }
  const required = [BETTER_AUTH_SECRET, ...PROVIDER_SECRETS.map(({ name }) => name)];
  return new Set(required.filter((name) => new RegExp(`(^|\\s)${name}(\\s|$)`, 'm').test(output)));
}

async function configureWorkerSecrets(current, credentials) {
  if (current.has(BETTER_AUTH_SECRET) && !ROTATE_BETTER_AUTH_SECRET) {
    console.log(`✓ ${BETTER_AUTH_SECRET}: 登録済みのため変更しません`);
  } else {
    await putWorkerSecret(BETTER_AUTH_SECRET, randomBytes(32).toString('hex'), credentials);
    console.log(`✓ ${BETTER_AUTH_SECRET}: 値を表示せず登録しました`);
  }

  for (const { name, label } of PROVIDER_SECRETS) {
    if (current.has(name) && !REPLACE_PROVIDER_SECRETS) {
      console.log(`✓ ${name}: 登録済みのため変更しません`);
      continue;
    }
    const value = await readHidden(`${label}を貼り付けてEnter`);
    if (!value) throw new Error(`${name}が空のため停止しました。`);
    await putWorkerSecret(name, value, credentials);
    console.log(`✓ ${name}: 値を表示せず登録しました`);
  }
}

async function main() {
  if (DRY_RUN) {
    console.log('✓ helperの構文と生成値を確認しました。外部設定とsecretは変更していません。');
    return;
  }

  runGh(['auth', 'status'], { capture: true });
  const actualRepo = JSON.parse(runGh(['api', `repos/${REPO}`], { capture: true })).full_name;
  if (actualRepo !== REPO) throw new Error(`対象リポジトリが違います（期待: ${REPO}）。`);
  await confirmTeamAccount();

  const accountId = await readHidden('Cloudflare Account IDを貼り付けてEnter');
  if (!/^[a-f0-9]{32}$/i.test(accountId))
    throw new Error('Account IDの形式が正しくありません。Zone IDと取り違えていないか確認してください。');
  let apiToken = await readHidden('Cloudflare Account API Tokenを貼り付けてEnter');
  if (apiToken.startsWith('cfut_') || apiToken.startsWith('cfk_')) {
    throw new Error('user-owned tokenまたはGlobal API Keyです。Account API Tokenを作り直してください。');
  }
  await verifyToken(accountId, apiToken);
  console.log('✓ Cloudflare Account API Token: active');

  // 本人が検証したAccount/Tokenを子プロセスの環境だけへ渡し、別のOAuthログイン先へ書き込まない。
  const workerCredentials = {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_API_TOKEN: apiToken,
  };
  const whoami = runWrangler(['whoami'], { capture: true, env: workerCredentials });
  if (!whoami.includes(accountId)) {
    throw new Error(
      'Wranglerのログイン先と選択したCloudflare Accountが一致しません。wrangler login後にやり直してください。',
    );
  }

  // Worker所有先と必要APIへの読取権限を、外部設定の変更前に確認する。
  const currentWorkerSecrets = workerSecretNames(workerCredentials);
  runGh(['api', `repos/${REPO}/actions/variables`], { capture: true });
  ensureGitHubEnvironment();
  await putGithubSecret('CLOUDFLARE_ACCOUNT_ID', accountId);
  await putGithubSecret('CLOUDFLARE_API_TOKEN', apiToken);
  apiToken = null;
  putGithubVariable('APP_URL', APP_URL);
  const rl = createInterface({ input, output });
  const mailFrom = validateMailFrom(
    await rl.question('Resendで検証済みのMAIL_FROM（例: Focus Ledger <no-reply@your-domain.jp>）を入力: '),
  );
  rl.close();
  putGithubVariable('MAIL_FROM', mailFrom);
  console.log(`✓ GitHub ${ENVIRONMENT}: Environment secretsとAPP_URL・MAIL_FROMを登録しました`);

  await configureWorkerSecrets(currentWorkerSecrets, workerCredentials);
  workerCredentials.CLOUDFLARE_API_TOKEN = undefined;
  console.log(
    '完了しました。秘密値はGitHub/Cloudflareの登録先にだけ送信し、画面やファイルへ出していません。',
  );
  console.log('このTerminalの完了メッセージだけをAIへ伝えてください。');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    try {
      clipboard('');
    } catch {}
    console.error(`エラー: ${error.message}`);
    console.error('secret値ではなく、このエラー文だけをAIへ伝えてください。');
    process.exitCode = 1;
  });
