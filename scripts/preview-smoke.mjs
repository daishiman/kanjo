#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
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
const previewPassword = 'preview-smoke-password';

mkdirSync(stateDir);
writeFileSync(
  envFile,
  [
    `AUTH_PASSWORD=${previewPassword}`,
    'SESSION_SECRET=preview-smoke-session-secret-32bytes',
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

  const login = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: previewPassword }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!login.ok) throw new Error(`login smoke failed: ${login.status}`);
  const cookie = login.headers.get('set-cookie');
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
  const target = `cash:${cash.entry.id}`;

  const png = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
    (byte) => byte.charCodeAt(0),
  );
  const upload = new FormData();
  upload.append('target', target);
  upload.append('file', new File([png], 'preview-smoke.png', { type: 'image/png' }));
  const attachmentCreated = await checkedRequest(
    cookie,
    'attachment upload',
    '/attachments',
    { method: 'POST', body: upload },
    201,
  );
  const created = await attachmentCreated.json();
  if (!Number.isInteger(created?.attachment?.id)) throw new Error('attachment upload contract failed');

  const listed = await checkedRequest(
    cookie,
    'attachment list',
    `/attachments?target=${encodeURIComponent(target)}`,
  );
  const listBody = await listed.json();
  if (
    listBody?.attachments?.length !== 1 ||
    listBody.attachments[0]?.originalAvailable !== true ||
    listBody.attachments[0]?.cleanupStage !== 'none'
  )
    throw new Error('attachment list availability contract failed');

  const cashList = await checkedRequest(cookie, 'cash attachment count', '/cash-entries');
  const cashListBody = await cashList.json();
  const parent = cashListBody?.entries?.find((entry) => entry.id === cash.entry.id);
  if (parent?.attachmentCount !== 1) throw new Error('cash attachment count contract failed');

  const content = await checkedRequest(
    cookie,
    'attachment content',
    `/attachments/${created.attachment.id}/content`,
  );
  const contentBytes = new Uint8Array(await content.arrayBuffer());
  if (content.headers.get('content-type') !== 'image/png' || contentBytes.length !== png.length)
    throw new Error('attachment content contract failed');

  await checkedRequest(cookie, 'attachment delete', `/attachments/${created.attachment.id}`, {
    method: 'DELETE',
  });
  const afterDelete = await checkedRequest(
    cookie,
    'attachment empty list',
    `/attachments?target=${encodeURIComponent(target)}`,
  );
  if ((await afterDelete.json())?.attachments?.length !== 0)
    throw new Error('attachment delete convergence contract failed');

  console.log(
    'local preview smoke passed: migrations, SPA, auth, cash, attachment upload/list/count/content/delete',
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
