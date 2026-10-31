#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), 'kanjo-preview-smoke-'));
const stateDir = join(workDir, 'state');
const envFile = join(workDir, 'preview.env');
const port = await new Promise((resolve, reject) => {
  const reservation = createServer();
  reservation.unref();
  reservation.once('error', reject);
  reservation.listen(0, '127.0.0.1', () => {
    const address = reservation.address();
    if (!address || typeof address === 'string') {
      reservation.close();
      reject(new Error('could not reserve a local preview port'));
      return;
    }
    reservation.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
const origin = `http://127.0.0.1:${port}`;
// 一時D1に合成招待を作り、本人承諾と Better Auth ログインの実経路を通す。
const previewEmail = 'preview-smoke@example.test';
const previewPassword = 'Local-Smoke-Credential-2026!';
const previewInviteToken = randomBytes(32).toString('base64url');
const seedSqlPath = join(workDir, 'local-invitation.sql');

mkdirSync(stateDir);
writeFileSync(
  envFile,
  [
    'BETTER_AUTH_SECRET=synthetic-preview-better-auth-secret-32-chars',
    'ACCESS_AUD=',
    'ACCESS_TEAM_DOMAIN=',
    '',
  ].join('\n'),
  { mode: 0o600 },
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(' ')} failed (${result.signal ?? result.status})`);
  }
  process.stdout.write(result.stdout);
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return response;
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('preview did not become ready within 30 seconds');
}

async function stopServer(server) {
  const signalGroup = (signal) => {
    try {
      if (process.platform === 'win32') server.kill(signal);
      else process.kill(-server.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  signalGroup('SIGTERM');
  if (server.exitCode === null)
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  signalGroup('SIGKILL');
}

async function checkedRequest(cookie, label, path, init = {}, expectedStatus = 200) {
  const response = await fetch(`${origin}/api${path}`, {
    ...init,
    headers: { cookie, ...init.headers },
    signal: AbortSignal.timeout(5_000),
  });
  if (response.status !== expectedStatus) {
    let code = 'unknown';
    try {
      const body = await response.clone().json();
      if (typeof body?.error?.code === 'string') code = body.error.code;
    } catch {
      // Failure details stay limited to status and the public structured error code.
    }
    throw new Error(`${label} failed: status=${response.status} code=${code}`);
  }
  return response;
}

async function checkedNotFound(cookie, label, path) {
  const response = await checkedRequest(cookie, label, path, {}, 404);
  const body = await response.json();
  if (body?.error?.code !== 'not_found') {
    throw new Error(`${label} failed: expected the retired endpoint JSON contract`);
  }
}

const jsonBody = (value) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

let server;
try {
  run('pnpm', [
    '--filter',
    '@kanjo/api',
    'exec',
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'kanjo-db',
    '--local',
    '--persist-to',
    stateDir,
  ]);
  // migration直後の空DBに、ローカル専用の合成招待だけを作る。
  // 平文tokenはstdinだけで渡し、SQLにはSHA-256のみが入る。
  const seedSql = spawnSync(
    'node',
    [
      join(projectRoot, 'scripts', 'seed-admin.mjs'),
      '--print-sql',
      '--local-fixture',
      '--email',
      previewEmail,
      '--role',
      'member',
      '--token-stdin',
    ],
    { cwd: projectRoot, encoding: 'utf8', input: `${previewInviteToken}\n` },
  );
  if (seedSql.status !== 0) throw new Error(`local invitation SQL failed (${seedSql.status})`);
  writeFileSync(seedSqlPath, seedSql.stdout, { mode: 0o600 });
  run('pnpm', [
    '--filter',
    '@kanjo/api',
    'exec',
    'wrangler',
    'd1',
    'execute',
    'kanjo-db',
    '--local',
    '--persist-to',
    stateDir,
    '--file',
    seedSqlPath,
  ]);
  run('pnpm', ['--filter', '@kanjo/web', 'build']);

  server = spawn(
    'pnpm',
    [
      '--filter',
      '@kanjo/api',
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--persist-to',
      stateDir,
      '--env-file',
      envFile,
      '--port',
      String(port),
      '--show-interactive-dev-session=false',
    ],
    { cwd: projectRoot, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  server.stdout.resume();
  server.stderr.resume();

  const top = await waitForServer();
  const html = await top.text();
  if (!html.includes('<title>収支統合管理</title>')) throw new Error('SPA title smoke failed');

  const unauthenticated = await fetch(`${origin}/api/not-found`, { signal: AbortSignal.timeout(5_000) });
  if (unauthenticated.status !== 401) {
    throw new Error(`unauthenticated API smoke failed: ${unauthenticated.status}`);
  }

  const invite = await fetch(`${origin}/api/auth/invite/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: previewInviteToken, password: previewPassword }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!invite.ok) throw new Error(`invitation acceptance smoke failed: ${invite.status}`);

  const login = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email: previewEmail, password: previewPassword, rememberMe: true }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!login.ok) {
    const body = await login.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code : (body?.error?.code ?? 'unknown');
    throw new Error(`login smoke failed: status=${login.status} code=${code}`);
  }
  const cookie = (login.headers.getSetCookie?.() ?? []).map((value) => value.split(';', 1)[0]).join('; ');
  if (!cookie) throw new Error('login smoke did not issue a session cookie');

  const me = await fetch(`${origin}/api/auth/me`, {
    headers: { cookie },
    signal: AbortSignal.timeout(5_000),
  });
  if (!me.ok) throw new Error(`authenticated API smoke failed: ${me.status}`);

  await checkedRequest(
    cookie,
    'category setup',
    '/category-options',
    jsonBody({ scope: 'biz', major: '架空プレビュー費' }),
    201,
  );
  const cashCreated = await checkedRequest(
    cookie,
    'cash create',
    '/cash-entries',
    jsonBody({
      date: '2026-01-15',
      side: 'biz',
      io: 'expense',
      amount: 100,
      description: '架空プレビュー支出',
      big: '架空プレビュー費',
      mid: '',
      memo: null,
    }),
    201,
  );
  const cash = await cashCreated.json();
  if (!Number.isInteger(cash?.entry?.id)) throw new Error('cash create contract failed');
  const cashList = await checkedRequest(cookie, 'cash list', '/cash-entries');
  const cashListBody = await cashList.json();
  const parent = cashListBody?.entries?.find((entry) => entry.id === cash.entry.id);
  if (parent?.date !== '2026-01-15' || parent?.amount !== 100 || parent?.description !== '架空プレビュー支出')
    throw new Error('cash list contract failed');

  // 廃止した route が SPA や別 API に吸い込まれず、JSON 404 のままであることを本番相当で固定する。
  await checkedNotFound(cookie, 'retired attachments API', `/attachments?target=cash:${cash.entry.id}`);
  await checkedNotFound(cookie, 'retired tax API', '/tax/overview?year=2026');
  await checkedNotFound(cookie, 'retired tax export API', '/export/tax/statement.csv?year=2026');

  const cashDeleted = await checkedRequest(cookie, 'cash delete', `/cash-entries/${cash.entry.id}`, {
    method: 'DELETE',
  });
  const cashDeletedBody = await cashDeleted.json();
  if (cashDeletedBody?.ok !== true) throw new Error('cash delete contract failed');

  const emptyCashList = await checkedRequest(cookie, 'empty cash list', '/cash-entries');
  const emptyCashListBody = await emptyCashList.json();
  if (!Array.isArray(emptyCashListBody?.entries) || emptyCashListBody.entries.length !== 0) {
    throw new Error('empty cash list contract failed');
  }

  console.log(
    'local preview smoke passed: migrations, SPA, auth, cash create/list/delete/empty list, retired API 404',
  );
} catch (error) {
  if (server && server.exitCode !== null) {
    console.error('wrangler exited before smoke completed');
  }
  throw error;
} finally {
  if (server) await stopServer(server);
  rmSync(workDir, { recursive: true, force: true });
}
