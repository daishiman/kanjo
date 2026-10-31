/**
 * 自動の送り直しの途中経過 (何回目か) を、操作ごとに持つ外部 store。
 * mutation の状態 (pending) は「送り直し中か」を区別しないので、mutationFn がここへ書き、
 * 操作の行は useSyncExternalStore で読む (SM-FE-07)。送り直しが終われば消す。
 */
import { useSyncExternalStore } from 'react';

export interface RetryProgress {
  kind: 'busy' | 'revision';
  /** 何回目の自動の送り直しか (1 始まり) */
  attempt: number;
}

let snapshot: ReadonlyMap<number, RetryProgress> = new Map();
const listeners = new Set<() => void>();

function publish(next: Map<number, RetryProgress>) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function setProgress(clientOpId: number, progress: RetryProgress) {
  const next = new Map(snapshot);
  next.set(clientOpId, progress);
  publish(next);
}

export function clearProgress(clientOpId: number) {
  if (!snapshot.has(clientOpId)) return;
  const next = new Map(snapshot);
  next.delete(clientOpId);
  publish(next);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

export const useRetryProgress = (): ReadonlyMap<number, RetryProgress> =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** テスト用。モジュールの状態は test 間で残るため、各 test の後に戻す */
export function resetRetryProgressForTest(): void {
  publish(new Map());
}
