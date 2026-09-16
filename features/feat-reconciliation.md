---
graph_node_id: "feat-reconciliation"
artifact_kind: "feature"
artifact_subtypes: []
title: "照合画面 (04-reconciliation) の作り直しと照合専用 API・共通シェル・アイコン"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "reconciliation", "feature"]
file_path: "features/feat-reconciliation.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-16-reconciliation/completeness-findings.json", "evaluated_digest": "25823f116de8be6463b9e511362b16bee70f1882ce96cb1be996d098052d2d62"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-reconciliation.md", "source_version": "0.1.11", "source_digest": "a14c275ce48dc122165fd3cb2269b89976e17a1dc364df13eec78865ee0a93d7", "imported_at": "2026-09-15T10:56:57Z"}
created_at: "2026-09-15T10:56:57Z"
updated_at: "2026-09-15T10:56:57Z"
depends_on: ["spec-reconciliation"]
related_nodes: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
resource_scope: [".github/workflows/ci.yml", ".github/workflows/deploy.yml", ".github/workflows/migrate.yml", "design/FINAL-UI/images/04-reconciliation.png", "design/FINAL-UI/spec/AUDIT.md", "design/FINAL-UI/spec/DESIGN-SYSTEM.md", "design/FINAL-UI/spec/FUNCTION-MATRIX.md", "docs/data-schema.md", "docs/design-system.md", "docs/ui-decisions.md", "migrations/0036_duplicate_verdicts.sql", "migrations/0037_freee_pairing_and_exclusions.sql", "migrations/0039_account_login.sql", "package.json", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/d1-limits.ts", "packages/api/src/db/schema.ts", "packages/api/src/index.ts", "packages/api/src/routes/analysis-hub.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/duplicate-verdict-bindings.ts", "packages/api/src/routes/improvement.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/scheduled-maintenance-budget.ts", "packages/api/src/store.ts", "packages/api/test/total-cashflow-verdict.integration.test.ts", "packages/api/wrangler.jsonc", "packages/core/src/analysis-hub.ts", "packages/core/src/design-tokens.ts", "packages/core/src/expense-projection.ts", "packages/core/src/total-cashflow.ts", "packages/core/test/expense-projection.test.ts", "packages/web/package.json", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/scripts/check-mobile-layout.mjs", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/ConfirmDialog.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/RouteIcon.tsx", "packages/web/src/pages/Analysis.tsx", "packages/web/src/pages/analysis/Reconciliation.tsx", "packages/web/src/pages/analysis/TotalCashflow.tsx", "packages/web/src/reconciliation.dom.test.tsx", "packages/web/src/route-icon-distinct.test.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/styles.css"]
purpose: "照合画面を、帳簿 (freee の仕訳) と口座 (MoneyForward の取引) の差異を『どこから解消するか』判断し、一件ずつ確認・照合・別取引として処理・除外・元に戻すまでを 1 画面で完結できる作業場にする。月次クローズで利用者が差異の総量を掴み、対応キューから優先度の高い差異を選び、判定根拠 (一致度と一致の理由) を見て迷わず決め、誤操作をすぐ戻せ、照合の完了が月次クローズ進捗に反映される状態にする。"
goal: "/analysis/reconciliation が 04-reconciliation.png の全構成要素 (KPI 4 枚・絞り込みと対応キュー・照合候補一覧・取引の詳細パネル・下段 2 表・選択中バー) をトークンと共通部品で描画し、一致度・一致の理由・ステータス・対応キュー・KPI の規則が core の境界値テストと docs で固定されて照合画面・ハブのバッジ・総収支の要確認件数が一致し、照合 / 別取引 / 除外 / 一括 / 元に戻すが照合専用 API と追加 migration で永続化され、共通シェル (サイドバー文言と件数バッジ・月次クローズ 3/4・ヘッダー・フッター・改善を送る) と画像の全アイコンが揃い、既存の test / typecheck / lint / check 系が緑のままの状態。"
scope_in: ["照合画面 (04-reconciliation.png の全構成要素と読込・空・失敗・部分成功・確認の各状態) の作り直し。支出分析ハブで改善した問いの見出し・トークン・共通 Button/PageShell・狭幅の縦積みを踏襲する", "packages/core の照合判定純関数 (一致度・文字 bigram の Dice 係数による内容類似と 0.5 しきい値・一致の理由・ステータス・対応キュー 4 分類・KPI・解消率・月次クローズ判定) と、buildExpenseProjection・ハブのバッジへの判断と除外の反映", "packages/api の照合専用 API (GET /api/reconciliation、POST /api/reconciliation/actions、POST /api/reconciliation/actions/:id/undo) と月次レビュー完了 API、書込系の canonicalMutationFence 対象化", "D1 の追加 migration (MF 側除外表・照合操作の履歴表・月次レビュー完了表) と、履歴の 90 日削除を既存の夜間 cron へ追加", "共通シェル: サイドバーのグループと文言・件数バッジ・ページ見出しとコマンドパレットのラベル追随、月次クローズ進捗 3/4、ヘッダーのアイコンボタン、フッター、改善を送るボタン", "画像で使われるアイコンの一覧の docs 記載と、RouteIcon への lucide-static 由来 SVG の追加登録と各表示箇所での表示", "判定規則の docs 記載 (docs/data-schema.md の古い候補条件の修正を含む) と境界値テスト・API 統合テスト・DOM テスト・check 系の対象追加"]
scope_out: ["総収支・マトリクス・推移・診断の各タブ画面の中身の作り直し (ラベルと共通シェルの変更は追随させる)", "データ取込・明細仕分け・サブスクなど他画面の中身の作り直し (件数バッジの算出と導線リンクだけを扱う)", "freee / MoneyForward への書き戻し (仕訳の作成・取引の修正)。取込データを外部送信しない方針を維持する", "利用規約・プライバシー・データ出典の本文の新規作成 (既存の内容へのリンク配置だけを扱う)", "スマートフォン・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)"]
acceptance: ["S1 (G1): /analysis/reconciliation で 04-reconciliation.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で直書き色の lint が 0 件である。", "S2 (G2): 一致度・キュー分類・ステータスの規則が docs に明記され境界値テスト (内容類似 1.0 / 0 / 0.67 / 0.33、ちょうど 0.5 と未満、日付差 3 日と 4 日、金額一致と不一致) で固定され、照合画面・ハブのバッジ・総収支の要確認件数が同じデータで一致する。", "S3 (G3): 照合 / 別取引 / 除外 / 一括照合 (最大 200 件・部分成功) の結果が再読込後も保持され、元に戻すで操作前の状態に戻り、KPI とキューが操作前の値に戻る。", "S4 (G4): サイドバー文言と件数バッジ、月次クローズ 3/4、ヘッダーとフッターが画像どおりで、既存ルートと旧 URL のテストが緑である。", "S5 (G5): 画像のアイコンが全て表示され、docs のアイコン一覧と RouteIcon の登録名が一致し、絵柄の重複検査 (route-icon-distinct) が緑である。", "S6 (G1-G5): pnpm test / typecheck / lint と packages/web の check 系 (thead / mobile-layout / financial-figure / financial-routes) が全て緑で、狭幅 (アイコンレール・下部タブ) でも 3 カラムが縦積みになり横スクロールしない。"]
architecture_refs: ["arch-reconciliation-ui-ux", "arch-reconciliation-frontend", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-auth", "arch-reconciliation-security", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "FR-001..FR-007 は同じ照合判定 (core 純関数→照合専用 API と migration→照合画面・共通シェルのバッジと月次クローズ) を起点に連鎖する 1 つの価値単位で、API だけ・画面だけ・シェルだけでは『差異を 1 画面で解消し件数が全画面で一致する』状態を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-reconciliation.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T10:56:57Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

照合画面を、帳簿 (freee の仕訳) と口座 (MoneyForward の取引) の差異を『どこから解消するか』判断し、一件ずつ確認・照合・別取引として処理・除外・元に戻すまでを 1 画面で完結できる作業場にする。月次クローズで利用者が差異の総量を掴み、対応キューから優先度の高い差異を選び、判定根拠 (一致度と一致の理由) を見て迷わず決め、誤操作をすぐ戻せ、照合の完了が月次クローズ進捗に反映される状態にする。

規範 (要件・判定条件・確定意思決定) の正本は `specs/spec-reconciliation.md` と、そこから参照する仕様章である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/analysis/reconciliation が 04-reconciliation.png の全構成要素 (KPI 4 枚・絞り込みと対応キュー・照合候補一覧・取引の詳細パネル・下段 2 表・選択中バー) をトークンと共通部品で描画し、一致度・一致の理由・ステータス・対応キュー・KPI の規則が core の境界値テストと docs で固定されて照合画面・ハブのバッジ・総収支の要確認件数が一致し、照合 / 別取引 / 除外 / 一括 / 元に戻すが照合専用 API と追加 migration で永続化され、共通シェル (サイドバー文言と件数バッジ・月次クローズ 3/4・ヘッダー・フッター・改善を送る) と画像の全アイコンが揃い、既存の test / typecheck / lint / check 系が緑のままの状態。

## スコープ

- スコープ内:
  - 照合画面 (04-reconciliation.png の全構成要素と読込・空・失敗・部分成功・確認の各状態) の作り直し。支出分析ハブで改善した問いの見出し・トークン・共通 Button/PageShell・狭幅の縦積みを踏襲する
  - packages/core の照合判定純関数 (一致度・文字 bigram の Dice 係数による内容類似と 0.5 しきい値・一致の理由・ステータス・対応キュー 4 分類・KPI・解消率・月次クローズ判定) と、buildExpenseProjection・ハブのバッジへの判断と除外の反映
  - packages/api の照合専用 API (GET /api/reconciliation、POST /api/reconciliation/actions、POST /api/reconciliation/actions/:id/undo) と月次レビュー完了 API、書込系の canonicalMutationFence 対象化
  - D1 の追加 migration (MF 側除外表・照合操作の履歴表・月次レビュー完了表) と、履歴の 90 日削除を既存の夜間 cron へ追加
  - 共通シェル: サイドバーのグループと文言・件数バッジ・ページ見出しとコマンドパレットのラベル追随、月次クローズ進捗 3/4、ヘッダーのアイコンボタン、フッター、改善を送るボタン
  - 画像で使われるアイコンの一覧の docs 記載と、RouteIcon への lucide-static 由来 SVG の追加登録と各表示箇所での表示
  - 判定規則の docs 記載 (docs/data-schema.md の古い候補条件の修正を含む) と境界値テスト・API 統合テスト・DOM テスト・check 系の対象追加
- スコープ外:
  - 総収支・マトリクス・推移・診断の各タブ画面の中身の作り直し (ラベルと共通シェルの変更は追随させる)
  - データ取込・明細仕分け・サブスクなど他画面の中身の作り直し (件数バッジの算出と導線リンクだけを扱う)
  - freee / MoneyForward への書き戻し (仕訳の作成・取引の修正)。取込データを外部送信しない方針を維持する
  - 利用規約・プライバシー・データ出典の本文の新規作成 (既存の内容へのリンク配置だけを扱う)
  - スマートフォン・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)

## 受入

- [ ] S1 (G1): /analysis/reconciliation で 04-reconciliation.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で直書き色の lint が 0 件である。
- [ ] S2 (G2): 一致度・キュー分類・ステータスの規則が docs に明記され境界値テスト (内容類似 1.0 / 0 / 0.67 / 0.33、ちょうど 0.5 と未満、日付差 3 日と 4 日、金額一致と不一致) で固定され、照合画面・ハブのバッジ・総収支の要確認件数が同じデータで一致する。
- [ ] S3 (G3): 照合 / 別取引 / 除外 / 一括照合 (最大 200 件・部分成功) の結果が再読込後も保持され、元に戻すで操作前の状態に戻り、KPI とキューが操作前の値に戻る。
- [ ] S4 (G4): サイドバー文言と件数バッジ、月次クローズ 3/4、ヘッダーとフッターが画像どおりで、既存ルートと旧 URL のテストが緑である。
- [ ] S5 (G5): 画像のアイコンが全て表示され、docs のアイコン一覧と RouteIcon の登録名が一致し、絵柄の重複検査 (route-icon-distinct) が緑である。
- [ ] S6 (G1-G5): pnpm test / typecheck / lint と packages/web の check 系 (thead / mobile-layout / financial-figure / financial-routes) が全て緑で、狭幅 (アイコンレール・下部タブ) でも 3 カラムが縦積みになり横スクロールしない。

## アーキテクチャ参照

- `architecture_refs`: `arch-reconciliation-ui-ux`, `arch-reconciliation-frontend`, `arch-reconciliation-backend`, `arch-reconciliation-database`, `arch-reconciliation-auth`, `arch-reconciliation-security`, `arch-reconciliation-infrastructure`, `arch-reconciliation-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/reconciliation-ui-ux.md`, `architecture/reconciliation-frontend.md`, `architecture/reconciliation-backend.md`, `architecture/reconciliation-database.md`, `architecture/reconciliation-auth.md`, `architecture/reconciliation-security.md`, `architecture/reconciliation-infrastructure.md`, `architecture/reconciliation-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-reconciliation` (feature ノードへの依存は無い)
- 依存理由: 一致度・内容類似 (Dice 0.5 以上)・キュー 4 分類・ステータス・解消率 (除外を分母から外す)・月次クローズ判定の規則と、照合専用 API・取消 (直前の操作 1 件)・書込排他の契約が確定仕様として固定されていないと、core の型・API 応答・migration の形が実装中に揺れるため。支出分析ハブ (PR #50) とデザインシステム基盤 (PR #49) は main に取り込み済みで、未完了の feature に依存しない。
- 後続: 総収支・マトリクス・推移・診断の各タブ画面を FINAL-UI どおりに作り直す feature は次サイクル候補であり、本サイクルでは起票しない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-reconciliation` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-reconciliation --feature-context features/feat-reconciliation.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-reconciliation` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了rollup: exact 13 全 done かつ受入 S1〜S6 の evidence が揃う場合だけ done にする。
- 実装時決定として持ち越す事項 (一致度の丸め規則・Dice の重複 bigram の数え方・0.5 ちょうどの比較方法・月次レビュー API の path と応答形) は `specs/spec-reconciliation.md` の未決事項を正本とし、該当 task の契約テストで確定する。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
