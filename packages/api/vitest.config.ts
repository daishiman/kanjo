import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Miniflare(workerd)を使うファイルは並列化するが、proxy socketの枯渇を
    // 避けるためworker数を制限する。測定履歴と再測定条件は運用文書を参照。
    // ルートはパッケージを直列実行するため、その並列度を変える際も再測定する。
    fileParallelism: true,
    maxWorkers: 2,

    // migration適用とworkerd起動を含む統合テストを既定の5秒で打ち切らない。
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
