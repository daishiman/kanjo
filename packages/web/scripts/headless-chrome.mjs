import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chromePath() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found)
    throw new Error(
      `Chrome が見つかりません。CHROME_PATH を指定してください: ${CHROME_CANDIDATES.join(', ')}`,
    );
  return found;
}

const waitForExit = (chrome, timeoutMs) => {
  if (chrome.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      chrome.off('exit', onExit);
      resolve(false);
    }, timeoutMs);
    chrome.once('exit', onExit);
  });
};

export async function stopHeadlessChrome(chrome) {
  if (!chrome || chrome.exitCode !== null) return;
  chrome.kill('SIGTERM');
  if (!(await waitForExit(chrome, 5_000)) && chrome.exitCode === null) {
    chrome.kill('SIGKILL');
    await waitForExit(chrome, 1_000);
  }
}

/**
 * 使い終わったプロファイルを消す。
 *
 * 親プロセスの exit を待っても、Chrome の子プロセス(zygote / renderer)が
 * まだプロファイルへ書いていることがあり、その最中の削除は ENOTEMPTY になる。
 * rmSync の maxRetries だけでは CI で足りなかったので、先に猶予を置く。
 * 消せなくても検査結果は変わらないので、警告だけ出して続ける。
 */
export async function removeProfileRoot(dir, { graceMs = 500 } = {}) {
  await delay(graceMs);
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 40, retryDelay: 100 });
  } catch (error) {
    console.warn(`一時ディレクトリを削除できませんでした(検査結果には影響しません): ${dir}\n${error}`);
  }
}

export async function launchHeadlessChrome({ profileRoot, windowSize, attempts = 2 }) {
  const failures = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const profileDir = join(profileRoot, `profile-${attempt}`);
    const portFile = join(profileDir, 'DevToolsActivePort');
    let stderr = '';
    let spawnError;
    const chrome = spawn(
      chromePath(),
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--remote-debugging-port=0',
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        `--window-size=${windowSize}`,
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    chrome.once('error', (error) => {
      spawnError = error;
    });
    chrome.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8_000);
    });

    let port;
    let targets;
    for (let i = 0; i < 140; i += 1) {
      await delay(250);
      if (spawnError || chrome.exitCode !== null) break;
      if (!port && existsSync(portFile)) {
        const [value] = readFileSync(portFile, 'utf8').split(/\r?\n/);
        const parsed = Number(value);
        if (Number.isInteger(parsed) && parsed > 0) port = parsed;
      }
      if (!port) continue;
      try {
        targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        break;
      } catch {}
    }

    if (targets) return { chrome, port, targets };

    failures.push(
      `試行${attempt}: ${spawnError?.message ?? `exit=${chrome.exitCode ?? 'timeout'}`}${stderr.trim() ? `\n${stderr.trim()}` : ''}`,
    );
    await stopHeadlessChrome(chrome);
  }

  throw new Error(`Chrome が起動しませんでした\n${failures.join('\n')}`);
}
