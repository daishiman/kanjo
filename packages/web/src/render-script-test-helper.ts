import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * 実描画スクリプトを子プロセスで走らせ、標準出力を返す。
 *
 * timeout は「合否を判定するための締切」ではなく「Chrome が固まったまま永久に居座るのを防ぐ最後の砦」。
 * 合否の締切は呼び出し側の vitest テストタイムアウト(120秒)が持つ。
 * かつてここが 90秒だったため、検査が3幅とも合格を出し終える直前(実測 90008ms)に
 * ヘルパー側が先に子プロセスを殺し、vitest が判定する前に偽の失敗になっていた。
 * vitest 側より必ず短く、かつ通常の所要時間(数秒〜十数秒)から十分に離す。
 */
const HARD_KILL_MS = 110_000;

export async function runRenderScript(
  script: string,
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(process.execPath, [script], {
      encoding: 'utf8',
      env: options.env,
      timeout: options.timeoutMs ?? HARD_KILL_MS,
    });
    return stdout;
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string; message: string };
    throw new Error(`${detail.message}\n${detail.stdout ?? ''}\n${detail.stderr ?? ''}`);
  }
}
