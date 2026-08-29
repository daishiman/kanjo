# T5. 仕様反映の受領書 — 確定申告の準備

**記録日**: 2026-08-29 / **対象ブランチ**: `daishiman/確定申告` / **base**: `main`

コード変更が仕様・設計文書へ与える影響を層ごとに判定し、反映したものと、反映不要と判断した
理由を残す。判定単位は「その層が所有する契約が変わったか」であり、コードが触れたかではない。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| 製品正本 | `docs/spec-v1.1.md` | FR-11（7項目）新設、P16/P17を画面表へ、API表へ7行、§10.1を15→17画面・モバイル4→5タブ、比率契約に `businessPercent` の例外（0..100整数）、対象外に「適法性の保証」を明記、詳細仕様への導線 |
| 永続形状 | `docs/data-schema.md` | `tax_account_settings`(0027)・`receipt_source_profiles`/`receipt_source_overrides`(0028) の表定義、統合JSONの3キー、restoreのmerge規約、秘密値を持たない制約 |
| 詳細仕様（新規） | `specs/tax-preparation.md` | 不変条件 TI-1〜TI-10、緊急度の判定表、画面 P16/P17、API 7本、書き出しの形、受入12件 |
| タスク分解（新規） | `tasks/tax-preparation-tasks.md` | T01〜T18、受入証拠台帳、本番残条件 |
| 機能ノード（新規） | `features/feat-tax-preparation.md` / `.context.json` | purpose / goal / scope / acceptance 10件 |
| アーキテクチャ（新規） | `architecture/arch-tax-preparation-boundary.md` | 決定 D1〜D7（対象年の型分離、Dataset単一入口、R2を正とする完全性、切り捨てでなく分割、サーバー側最終ゲート、秘密を持てない型、取引先単位の正本） |
| グラフ投影 | `architecture/graph.json` | `arch-tax-preparation-boundary` を `origin_kind: "manual"` で登録し、projection_note に突合規約を追記 |
| 運用手順 | `README.md` | 「確定申告のときの手順」、月次手順に「領収書の残り」、緊急度の目安、文書表へ `specs/tax-preparation.md` |

## 反映不要と判断した層

### `system-spec/`（全8章 + index + spec-state.json）— 影響なし

**理由**: この `system-spec/` は汎用のシステム仕様書ではなく、
`00-requirements-definition.md` の U1「本番D1スキーマをコードの前提版へ一致させ続ける」を
本質的目的とし、G1〜G4（本番D1復旧・Migrate/Deploy分離・乖離の検知と説明・データ無損失）へ
全セルがトレースする **server-error-recovery イニシアチブ専用の仕様ハーネス成果物**である。
各章の中身は設計知識カード（Secure by Design 等）とプラットフォーム別の収集状態であり、
個別機能の要件・API・画面を持たない層になっている。

本変更は同じイニシアチブのゴールを1つも変更しない。よって章の集約状態・確定マーカー・
`serves_goals`・`spec-state.json` のマトリクスはいずれも更新対象にならない。

**判定の例外検討**: `packages/api/src/index.ts` へ追加した共通セキュリティヘッダー
（CSP / Permissions-Policy / Referrer-Policy / X-Frame-Options）は横断的な防御境界であり、
`system-spec/security.md` への追記を検討した。同章は具体的なヘッダー契約を1つも持たず
設計知識カードだけで構成されているため、ここに個別実装を書くと章の抽象度が壊れる。
代わりに `tasks/tax-preparation-tasks.md` T17（証拠: `packages/api/src/index.test.ts`）で
契約と証拠を持たせた。この層の抽象度を上げる作業は本変更の範囲外とする。

### `.dev-graph/`（plans）— 影響なし

**理由**: 既存 plan は `feature-package-feat-prod-d1-schema-recovery` の13フェーズのみで、
別イニシアチブの計画である。本機能は dev-graph の13フェーズ計画を経ずに実装されたため、
架空のノードIDや受領書を後付けで捏造しない。`architecture/graph.json` へは
`origin_kind: "manual"` として登録し、次回 projection 時に突合できる状態にした。

### Beads — 更新できず（実行していない）

**理由**: このリポジトリに beads データベースが存在しない（`bd list` → `no beads database found`)。
`issues/` は `.gitkeep` のみで、履歴上も beads の追跡データが commit されたことがない。

`bd init` を試行すると、`AGENTS.md`・`CLAUDE.md`・`.claude/settings.json`・`.agents/skills/`・
`.gitignore` を新規作成／上書きする。本リポジトリはこれらを `aidd-agent-kit/` を編集原本として
生成しており、`pnpm lint` の `sync-project-skills.mjs --check` が正本との一致を検査している。
初期化は**そのlintゲートを壊し、既存 AGENTS.md を失わせる**ため、実行しなかった。

**代替**: 本受領書と `tasks/tax-preparation-tasks.md` の受入証拠台帳を追跡の正本とする。
beads を本リポジトリで運用する場合は、`aidd-agent-kit/` との共存方針を先に決める必要がある。

## 品質ゲート再実行結果（2026-08-29）

| ゲート | 結果 |
|---|---|
| `pnpm lint`（Biome + skills同期 + 用語集 + レポートCSS） | ✅ 241ファイル、指摘0 |
| `pnpm typecheck`（core / api / web） | ✅ Done ×3 |
| `pnpm test` core | ✅ 449 passed / 6 skipped（実データ回帰は対象外） |
| `pnpm test` api | ✅ 239 passed |
| `pnpm test` web | ✅ 251 passed |
| `pnpm test` runbooks + GitHub scripts | ✅ 20 passed / 0 failed |
| `pnpm test` skills（Python） | ✅ 27 passed |
| `pnpm build`（tsc + vite + 初期JS予算 + wrangler dry-run） | ✅ 初期JS 100.51KiB / 110KiB |

## 本番反映の判定

**No-Go**（`T4-release-readiness.md` の判定を維持）。理由は次の3件が未充足であるため。

1. **D1 migration 0027 / 0028 が本番未適用。** GitHub Actions の「Migrate」を手動実行し、
   確認欄へ `APPLY` を入力し、Time Travel の復元地点を確認してから適用する。
   これを**コード配信より先に**行う（`schema-guard` が `EXPECTED_D1_MIGRATION` を
   `0028_receipt_source_profiles.sql` へ上げているため、逆順では全D1エンドポイントが503になる）。
2. 依頼者による preview での主要ジャーニー確認。
3. 本番相当での LCP / INP / CLS・3G・200%拡大の実測。

本PRは draft のため main へ自動マージされず、自動デプロイも起動しない。
上記1〜3を満たしたうえで、リポジトリ所有者が ready 化・マージすることで本番へ到達する。
