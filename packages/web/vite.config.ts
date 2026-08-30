import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // 開発時のみAPIをwrangler dev(8787)へ中継。previewは8787単体で完結する
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // build後の初期JS budget検査だけに使い、検査スクリプトが削除する。
    manifest: true,
  },
  test: {
    // 実描画テスト(*-render.test.ts)は headless Chrome を起動し、複数の画面幅を順に描画する。
    // ユニットテストと同時に走らせると CPU の奪い合いで所要時間が 13秒→90秒超まで振れ、
    // render-script-test-helper.ts の 90秒タイムアウトに触れて偽の失敗になる。
    // かといって全体を --maxWorkers=1 で直列化すると全テストが10倍遅くなるため、
    // 「ユニットは並列のまま、実描画だけ後から単独で走らせる」形に切り分ける。
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: [...configDefaults.exclude, 'src/**/*-render.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'render',
          include: ['src/**/*-render.test.ts'],
          // groupOrder が大きい project は他が終わってから走る。
          sequence: { groupOrder: 1 },
          // 実描画同士も重ねない。fileParallelism は project 単位では効かないため
          // (実測: 2件が同時に走った)、単一 fork に閉じ込めて直列化する。
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
});
