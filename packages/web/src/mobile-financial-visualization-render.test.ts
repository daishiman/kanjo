import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runRenderScript } from './render-script-test-helper';

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RESPONSIVE_SCRIPT = fileURLToPath(
  new URL('../scripts/check-mobile-financial-layout.mjs', import.meta.url),
);
const ROUTE_SCRIPT = fileURLToPath(new URL('../scripts/check-financial-visuals.mjs', import.meta.url));
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((path): path is string => Boolean(path));
const hasChrome = CHROME_CANDIDATES.some((path) => existsSync(path));

let server: ChildProcess | undefined;
let origin = '';

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const reservation = createServer();
    reservation.unref();
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', () => {
      const address = reservation.address();
      if (!address || typeof address === 'string') return reject(new Error('local port unavailable'));
      reservation.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForVite(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('anonymous Vite fixture did not start');
}

function stopServer(): void {
  if (!server || server.exitCode !== null || server.pid === undefined) return;
  if (process.platform === 'win32') server.kill('SIGTERM');
  else process.kill(-server.pid, 'SIGTERM');
}

describe('financial visualization real-browser gate', () => {
  if (!hasChrome && process.env.CI) {
    it('CIではChromeが必須', () => {
      throw new Error('CI環境にChromeが見つかりません');
    });
    return;
  }
  const run = hasChrome ? it : it.skip;

  beforeAll(async () => {
    if (!hasChrome) return;
    const port = await reservePort();
    origin = `http://127.0.0.1:${port}`;
    server = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: WEB_ROOT,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.resume();
    server.stderr?.resume();
    await waitForVite();
  }, 40_000);

  afterAll(() => stopServer());

  run(
    'static shell and real React/Chart.js routes retain non-zero financial figures',
    async () => {
      const responsive = await runRenderScript(RESPONSIVE_SCRIPT);
      expect(responsive).toContain('mobile financial layout: すべて合格');

      const coreRoutes = await runRenderScript(ROUTE_SCRIPT, {
        env: { ...process.env, KANJO_VISUAL_BASE_URL: origin, KANJO_VISUAL_SCOPE: 'core' },
        timeoutMs: 420_000,
      });
      expect(coreRoutes).toContain('財務画面の実描画検査: すべて合格');

      const additionalRoutes = await runRenderScript(ROUTE_SCRIPT, {
        env: { ...process.env, KANJO_VISUAL_BASE_URL: origin, KANJO_VISUAL_SCOPE: 'additional' },
        timeoutMs: 420_000,
      });
      expect(additionalRoutes).toContain('財務画面の実描画検査: すべて合格');
    },
    900_000,
  );
});
