import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Miniflare(workerd)の複数インスタンスを並べるとproxy socketが枯渇し、個別では
    // 再現しないfetch失敗になる。ルートはpackage単位でも直列なので、APIは1 workerで
    // 安定性を優先する。テスト内の独立ケースは引き続き各suiteで検証する。
    fileParallelism: false,
    maxWorkers: 1,

    // migration適用とworkerd起動を含む統合テストを既定の5秒で打ち切らない。
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
