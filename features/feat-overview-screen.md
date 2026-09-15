---
graph_node_id: "feat-overview-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "FINAL-UI 02 概況画面 月次クローズ起点化 (全体像)"
project_id: "kanjo"
domain: "overview-screen"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["overview-screen", "feature"]
file_path: "features/feat-overview-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/archive/2026-09-14-overview-screen/completeness-findings.json", "evaluated_digest": "b59f1176e7a0d23474e8d9f4ea1b067eaf9c94d6eaaf0906c48de0de5fc33181"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-overview-screen.md", "source_version": "0.1.11", "source_digest": "11b3406e9debf54cb98c97364eabfb08a1f30ff586e33680f74760b6d66c912f", "imported_at": "2026-09-14T13:28:17Z"}
created_at: "2026-09-14T13:28:17Z"
updated_at: "2026-09-14T13:28:17Z"
depends_on: ["spec-overview-screen"]
related_nodes: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-backend", "arch-overview-database", "arch-overview-auth", "arch-overview-security", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
resource_scope: ["design/FINAL-UI/images/02-overview.png", "migrations", "packages/api/src", "packages/core/src", "packages/web/public/_headers", "packages/web/scripts/check-financial-visuals.mjs", "packages/web/src/components/Layout.tsx", "packages/web/src/pages/Overview.tsx", ".github/workflows/deploy.yml"]
purpose: "概況を「数字を眺める分析画面」から月次クローズの作業起点に変える。開いた瞬間に直近 12 か月の収支の結論と「次に直すこと」が分かり、未処理 0 まで概況から迷わず進める状態にする。現行の概況は GET /api/summary から core の overview() を呼び、事業だけを表示している。"
goal: "総合/事業/家計の KPI・推移・年次比較・支出内訳が単一の定義で検算一致し、仕分け・照合・取込の確認が全期間で 1 つの未処理キューに集約されてバッジ・カード・アクションバーの件数が一致し、「後で確認」と月次レビューが D1 に保存されてバックアップと復元でも保たれ、02 のレイアウトが共通シェル・トークン・部品で 8 幅すべてで描画される状態。"
scope_in: ["packages/web/src/pages/Overview.tsx の作り替え", "概況用 API (概況集計と未処理キュー、保留と月次レビューの書込)", "core 集計 (直近 12 か月 vs 前 12 か月、支出内訳の上位 5 + その他、未処理キュー、推奨の信頼度、月次クローズ判定)", "D1 migration (保留 review_snoozes と月次レビュー monthly_close_reviews)", "サイドバーの未処理バッジ", "新テーブルのバックアップ・復元対象への追加"]
scope_out: ["専用アプリ (スマートフォン・タブレット・デスクトップ)", "AI/LLM による推定", "分類アルゴリズムの変更", "概況以外の 19 画面の作り替え"]
acceptance: ["AC-001 O1 (G1): 同一 fixture で KPI・推移・年次比較・支出内訳の総額差が 0 である (core 単体テスト、FR-001)。", "AC-002 O2 (G2): バッジ・カード・アクションバーの件数が一致し、「後で確認」で同時に減り、期間 1年→3年で不変である (DOM テスト、FR-002、FR-007)。", "AC-003 O2 (G2): 内容指紋が変わった明細が再び未処理に数えられる (core 単体テスト、FR-003)。", "AC-004 O3 (G3): 保留と月次レビューがバックアップ→全消去→復元の往復で保たれ、月次クローズ 4 ステップが判定表どおりになる (API テストと core 単体テスト、FR-004)。", "AC-005 O4 (G4, G5): check-financial-visuals.mjs の Overview を 8 幅で描画して exit 0 になる (FR-006)。", "AC-006 O5 (G2): 同じ入力から同じ信頼度が出て、根拠が無い明細は推奨なしになる (core 単体テスト、FR-005)。", "AC-007 S1 (G1-G5): 上記の検査と既存の pnpm test / typecheck / lint、check-initial-js-budget、index.test の CSP 差分検査が CI で緑である。"]
architecture_refs: ["arch-overview-ui-ux", "arch-overview-frontend", "arch-overview-backend", "arch-overview-database", "arch-overview-auth", "arch-overview-security", "arch-overview-infrastructure", "arch-overview-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "FR-001..FR-007 は O2 (3 か所の件数一致) が D1 の保留テーブル・未処理キュー API・画面の 3 層を同じ受入で貫くため、分割すると 1 つの受入が複数 feature にまたがる。利用者に届く価値 (概況から月次クローズを終える) も単独では成立しないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-overview-screen.md"}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-8c2", "linked_at": "2026-09-14T14:18:42Z", "sync_state": "synced"}
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-14T13:28:17Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

概況を「数字を眺める分析画面」から月次クローズの作業起点に変える。開いた瞬間に直近 12 か月の収支の結論と「次に直すこと」が分かり、未処理 0 まで概況から迷わず進める状態にする。見た目の正本は `design/FINAL-UI/images/02-overview.png` である。

規範 (要件・判定条件・確定意思決定) の正本は `specs/spec-overview-screen.md` と、そこから参照する仕様章である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

総合/事業/家計の KPI・推移・年次比較・支出内訳が単一の定義で検算一致し、仕分け・照合・取込の確認が全期間で 1 つの未処理キューに集約されてバッジ・カード・アクションバーの件数が一致し、「後で確認」と月次レビューが D1 に保存されてバックアップと復元でも保たれ、02 のレイアウトが共通シェル・トークン・部品で 8 幅すべてで描画される状態。防衛予測は注意・警告の見込みがあるときだけ KPI の上に出し、未決済と科目別年比較は「詳しく見る」に畳む。

## スコープ

- スコープ内:
  - packages/web/src/pages/Overview.tsx の作り替え
  - 概況用 API (概況集計と未処理キュー、保留と月次レビューの書込)
  - core 集計 (直近 12 か月 vs 前 12 か月、支出内訳の上位 5 + その他、未処理キュー、推奨の信頼度、月次クローズ判定)
  - D1 migration (保留 review_snoozes と月次レビュー monthly_close_reviews)
  - サイドバーの未処理バッジ
  - 新テーブルのバックアップ・復元対象への追加
- スコープ外:
  - 専用アプリ (スマートフォン・タブレット・デスクトップ)
  - AI/LLM による推定
  - 分類アルゴリズムの変更
  - 概況以外の 19 画面の作り替え

## 受入

- [ ] AC-001 O1 (G1): 同一 fixture で KPI・推移・年次比較・支出内訳の総額差が 0 である (core 単体テスト、FR-001)。
- [ ] AC-002 O2 (G2): バッジ・カード・アクションバーの件数が一致し、「後で確認」で同時に減り、期間 1年→3年で不変である (DOM テスト、FR-002、FR-007)。
- [ ] AC-003 O2 (G2): 内容指紋が変わった明細が再び未処理に数えられる (core 単体テスト、FR-003)。
- [ ] AC-004 O3 (G3): 保留と月次レビューがバックアップ→全消去→復元の往復で保たれ、月次クローズ 4 ステップが判定表どおりになる (API テストと core 単体テスト、FR-004)。
- [ ] AC-005 O4 (G4, G5): check-financial-visuals.mjs の Overview を 8 幅で描画して exit 0 になる (FR-006)。
- [ ] AC-006 O5 (G2): 同じ入力から同じ信頼度が出て、根拠が無い明細は推奨なしになる (core 単体テスト、FR-005)。
- [ ] AC-007 S1 (G1-G5): 上記の検査と既存の pnpm test / typecheck / lint、check-initial-js-budget、index.test の CSP 差分検査が CI で緑である。

## アーキテクチャ参照

- `architecture_refs`: `arch-overview-ui-ux`, `arch-overview-frontend`, `arch-overview-backend`, `arch-overview-database`, `arch-overview-auth`, `arch-overview-security`, `arch-overview-infrastructure`, `arch-overview-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/overview-screen-ui-ux.md`, `architecture/overview-screen-frontend.md`, `architecture/overview-screen-backend.md`, `architecture/overview-screen-database.md`, `architecture/overview-screen-auth.md`, `architecture/overview-screen-security.md`, `architecture/overview-screen-infrastructure.md`, `architecture/overview-screen-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-overview-screen` (feature ノードへの依存は無い)
- 依存理由: 未処理件数を全期間で数えること、保留を内容指紋付きで D1 に置くこと、防衛予測の置き場所が確定仕様として固定されていないと、API の応答型とテストの期待値が実装中に揺れるため。デザインシステム基盤 (feat-design-system-foundation、PR #49) は main に取り込み済みで、共通シェル・トークン・Button をそのまま使うため未完了の feature に依存しない。
- 後続: 概況以外の画面を FINAL-UI どおりに作り直す feature は本サイクルでは起票しない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-overview-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-overview-screen --feature-context features/feat-overview-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-overview-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了rollup: exact 13 全 done かつ P07/P10/P11 の evidence が上記受入を満たす場合だけ done にする。
- plan 着手時の確認: 仕様の未決事項 `low-u4-measure-numbering` と `low-reference-recheck` を P01 で扱う。
