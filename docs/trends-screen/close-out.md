# 推移画面 完了記録 (SYS-TRENDS-P13)

## ローカルの完了条件

| 項目 | 結果 |
|---|---|
| package 全件 | core 718 / api 608 / web 648 tests 緑。API は単一 worker の Miniflare 実行で 825.75 秒を要したが完走 |
| typecheck / lint | 緑。biome 454 files、graph lineage、design token、security:content を含む |
| build / Worker dry-run | 緑。既存 D1 / R2 / ASSETS binding を解決し、新しい migration・secret・Cloudflare resource は無し |
| 初期 JS budget | 109.88 KiB / 110 KiB で合格。推移 chunk は 27.31 kB / gzip 8.85 kB |
| 実描画 | core / additional 各 11 条件で緑。2主要図・8列・初期CTA・旧判定なし・同一viewport・200% zoomを確認 |
| preview | `http://127.0.0.1:8787/analysis/trends` 200、未認証 API 401、`preview:smoke` 緑。確認後に停止 |
| launch security | CRITICAL 0 / HIGH 0。実装判定 GO (`pnpm audit --prod --audit-level high` も 0) |
| migration | 追加なし (0042 のまま) |
| scope 外の変更 | 0 件 (`final-review.md`) |

## 未実施 (利用者の指示)

| 項目 | 状態 |
|---|---|
| commit / push | 未実施 |
| PR 作成・CI | 未実施 |
| 本番反映 | 未実施。既存 URL `https://kanjo-console.daishimanju.workers.dev/` の 200 応答だけを読取確認し、今回の差分は公開していない |

## マージ後に確認すること

1. 本番の `/analysis/trends` で期間を切り替え、総収支画面の同じ期間の合計と一致すること。
2. 要確認がある期間で、帯の注記の件数が総収支画面と同じであること。
3. 取引先行から `/classify` へ移り、取引先で絞られた明細だけが出ること。
4. 初期 JS が上限に近いため、次の依存追加前に共通 shell の分割余地を確認すること。
