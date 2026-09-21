import { AI_COPY_TARGETS, AI_COPY_TARGET_LABEL, type AiCopyTarget } from '@kanjo/core';
import { api } from '../../api.js';

export { AI_COPY_TARGETS, AI_COPY_TARGET_LABEL, type AiCopyTarget };

/** clipboard が使えない環境では false。呼び出し側が選択可能な欄へ切り替える。 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** コピー成功とDBの監査記録を、初回依頼・再実行のどちらでも同じ順序で行う。 */
export async function copyTaskPrompt(taskId: string, prompt: string, target: AiCopyTarget): Promise<boolean> {
  if (!(await writeClipboard(prompt))) return false;
  try {
    await api(`/ai/tasks/${taskId}/copied`, { method: 'POST', body: JSON.stringify({ target }) });
  } catch {
    // コピー自体は成功している。補助的な監査記録の失敗で利用者に再コピーを強いない。
  }
  return true;
}
