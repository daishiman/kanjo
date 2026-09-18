# 診断画面 (feat-diagnosis-screen) の検証証跡

本書には実行済みの結果だけを置く。仕様・設計・予定・レビュー所見は各正本へ置き、ここへ複製しない。

最終再測定: 2026-09-18T11:12:57Z

## 1. 4 条件ゲート

| 条件 | 判定 | 実測根拠 |
|---|---|---|
| 矛盾なし | PASS | 継続課金と一回性支出を分離し、一回性支出を年換算しない。支出は改善額を引き、収入・純収支は改善額を足す契約を core → API → web で統一した |
| 漏れなし | PASS | 支出・収入・純収支の候補、主要診断、上位 6 件、詳細 3 タブ、固定 CTA、空状態、遷移先の絞込、無効クエリの安全なフォールバックをテストで固定した |
| 整合性あり | PASS | claim の重複排除後の集合を、合計・ウォーターフォール・シグナルで共有した。期間切替と URL 更新は共通部品へ集約した |
| 依存関係整合 | PASS | core → API → web の型・ビルドが通り、`vendorAccounts` と `nextAction` の生成側・受信側を同時に検証した |

## 2. 診断契約のテスト

| 対象 | ファイル | 件数 | 結果 |
|---|---|---:|---|
| core 検知器・impact・claim・nextAction | `packages/core/test/diagnosis-detectors-contract.test.ts` | 35 | PASS |
| core 健全性スコア | `packages/core/test/diagnosis-health-contract.test.ts` | 9 | PASS |
| core 範囲別合計 | `packages/core/test/diagnosis-scope-totals-contract.test.ts` | 7 | PASS |
| core 支出予測・取引先口座 | `packages/core/test/expense-projection.test.ts` | 8 | PASS |
| API 契約・統合 | `packages/api/test/diagnosis-screen.integration.test.ts` | 17 | PASS |
| web 診断画面 | `packages/web/src/diagnosis-screen.dom.test.tsx` | 17 | PASS |
| web 遷移先クエリ | `packages/web/src/diagnosis-next-action-receivers.dom.test.tsx` | 3 | PASS |
| web 照合画面 | `packages/web/src/reconciliation.dom.test.tsx` | 36 | PASS |

再測定合計は core 59 件、API 17 件、web 56 件で、すべて PASS。web パッケージ全体でも 87 ファイル 716 件が PASS している。

## 3. 品質ゲート

| ゲート | 結果 | 実測値 |
|---|---|---|
| `pnpm lint` | PASS | Biome 493 ファイル、用語 59 語、グラフ系譜 94 ノード、デザイントークン直書き 0 件 / 131 ファイル、公開文書の実データ参照検査を通過 |
| `pnpm typecheck` | PASS | 3 パッケージとも通過 |
| core 全テスト | PASS | 785 passed / 6 skipped |
| web 全テスト | PASS | 87 files / 716 passed |
| `pnpm build` | PASS | 初期 JS 102.97 KiB / 上限 110 KiB。診断チャンク 24,579 bytes、gzip 7,844 bytes。Wrangler deploy dry-run も通過 |
| `pnpm run preview:smoke` | PASS | ローカル D1 migration、SPA、認証、現金 CRUD、廃止 API の 404 を確認 |
| `pnpm audit --audit-level high` | PASS | high / critical 0 件 |
| 変更範囲の危険 API 検査 | PASS | HTML 直挿し、動的コード実行、子プロセス、token の localStorage 保存、`passThroughOnException`、危険な型回避はいずれも 0 件 |
| `git diff --check` | PASS | 空白エラーなし |

ルートの `pnpm test` は core 785 件 / skip 6 件の完了後、後続 runner の無出力待機が続いたため中断した。上記の診断関連 132 件はパッケージ単位で再実行して完走している。

`package.json` / `pnpm-lock.yaml` に追加依存はなく、新規依存は 0 件。

## 4. migration

| 項目 | 状態 |
|---|---|
| migration | `migrations/0043_diagnosis_action_states.sql` |
| 主キー | `(user_id, action_key)` の複合主キー |
| ローカル適用 | 0001〜0043 を適用し、0043 を含めて PASS |
| 実行時ガード | `packages/api/src/schema-guard.ts` の期待 head を 0043 に更新済み |
| 本番適用 | 未実施 |

## 5. 制約下の確認

- 12UI の画像変換はサインイン待ちで停止したため、ユーザー承認済みの参照画像を直接、設計判断の正本として使用した。
- この環境では操作可能なブラウザを取得できなかった。代替として responsive / mobile-layout / financial-figure / preview smoke の自動検証を通した。
- 今回の診断変更では `data/` と実データを操作していない。worktree に先行して存在した対象外の変更 (取込・照合の作業分) は、そのまま維持し commit にも含めていない。
- ローカル画面確認のために `packages/api/.dev.vars` を新規作成し (`.gitignore` 対象・値は非出力)、`node scripts/seed-local.mjs` で匿名サンプルを投入した。`samples/*.csv` は生成し直されたが、git 正規化後の差分は 0 行で追跡内容は変わっていない。

## 6. ローカル実機での接地 (実測 2026-09-18T09:04:30Z)

`wrangler dev --local --port 8788` + `db:migrate:local` (0001〜0043) + `seed-admin.mjs` + `seed-local.mjs` の環境で、node の `fetch` から次を確認した。

| 対象 | 実測 |
|---|---|
| `GET /api/diagnosis` | 200。健全性 94 / 健全。寄与点 30 + 30 + 18.8963745069941 + 15 = 93.896 → 表示 94 (AC-003) |
| 範囲別合計 | 総合 9,704,835 = 事業 2,055,449 + 家計 7,649,386 (BR-004) |
| `PATCH /api/diagnosis/actions/:action_key` | 200。再取得で `対応中` / note / `decided_at` が保持される (AC-004) |
| 不正 status (`done`) の PATCH | 400 (BR-005) |
