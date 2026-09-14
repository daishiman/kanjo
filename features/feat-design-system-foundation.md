---
graph_node_id: "feat-design-system-foundation"
artifact_kind: "feature"
artifact_subtypes: []
title: "FINAL-UI デザインシステム共通化 (全体像)"
project_id: "kanjo"
domain: "design-system"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["design-system", "feature"]
file_path: "features/feat-design-system-foundation.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "c648cbc5bb47312ecb597a6416cfc4755418de9d706ffd0eb28a23752f76cb3a"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-design-system-foundation.md", "source_version": "0.1.11", "source_digest": "168dc05caa9327f54af42c4737de1e0e32cab6cbb161bff94df4e28c0c93dbf1", "imported_at": "2026-09-13T08:19:24Z"}
created_at: "2026-09-13T08:19:24Z"
updated_at: "2026-09-13T09:08:29Z"
depends_on: ["spec-design-system-foundation"]
related_nodes: ["arch-design-system-ui-ux", "arch-design-system-frontend", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-security", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
resource_scope: ["design/FINAL-UI/spec/DESIGN-SYSTEM.md", "docs/design-system.md", "package.json", "packages/api/migrations", "packages/core/src/design-tokens.ts", "packages/web/package.json", "packages/web/public/_headers", "packages/web/scripts/check-initial-js-budget.mjs", "packages/web/src/components/Layout.tsx", "packages/web/src/components/charts.ts", "packages/web/src/pages", "packages/web/src/pages/Login.tsx", "packages/web/src/styles.css", "scripts/check-design-tokens.mjs"]
purpose: "正式採用された FINAL-UI (Focus Ledger, design/FINAL-UI の 20 画面) を見た目の正本とし、色・文字・余白・角丸・影・動き・部品・共通シェル・図の見た目を単一の共通定義へ集約する。今後つくる画面・図・成果物が個別に色や寸法を決めなくても、共通定義を参照するだけで自動的に同じ見た目になり、ずれた値を持ち込めば機械的に検出される状態にする。"
goal: "design-tokens.ts を唯一の正本として styles.css と charts.ts の値がそこから導出され、20 ルートが共通シェルと共通ボタンの下で描画され、直書き色・写しのずれ・コントラスト未達が pnpm lint とテストで機械的に検出され、新しい画面や図をつくるときの参照先が規約文書 1 つに定まっている状態。"
scope_in: ["design/FINAL-UI の画像と DESIGN-SYSTEM.md からの色・構成・タイポグラフィ・寸法の抽出", "packages/core へのデザイントークン正本 (依存ゼロの TypeScript) の新設", "styles.css の :root トークンと charts.ts の COLORS をトークン正本から導出する形への置換と、写しのずれ検出 lint", "サイドバー・ヘッダー・共通フッター・固定アクションバー・ページ骨格・ボタンの共通部品化と、既存 20 画面からの参照", "チャート配色と描画規約の統一", "色の直書き検出と、文字・部品の枠・チャート系列のコントラスト検証のテスト", "トークンと共通部品の使い方を示す規約文書"]
scope_out: ["各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)", "新機能の追加", "API・データベースの変更", "ネイティブアプリ (スマートフォン・タブレット・デスクトップ)", "ダークテーマ", "Web フォントの追加 (system-ui 系の和文ゴシックと既存の IBM Plex Mono を維持し規約化する)", "会計レポート用 report-design-system (report.css / report-css.ts) の配色移行と、その 2 ファイルの変更 (次サイクル。今回はトークン正本を依存ゼロの packages/core に置くことで、レポート側から同じ値を import できる前提だけを用意する)"]
acceptance: ["S1 (G1, G4): packages/web/src の .ts/.tsx/.css において、トークン定義とその生成物以外での色の直書きが 0 件であり、lint が hex/rgb/hsl/CSS Color 構文を検査する。", "S2 (G3): charts.ts と全ての実描画consumerの系列色・軸・グリッド・文字色が design-tokens.ts 由来で、収入=青系・支出=赤系・純収支=ティール線になっている。", "S3 (G1): design-tokens.ts を唯一の実装正本とし、schema/関係不変条件と CSS/charts consumer の一致を自動検査する。", "S4 (G5): 文字用トークンのコントラストが背景と面の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色が 3:1 以上である。装飾罫線 (#D7E0E2) は 1.4.11 の対象外で、部品の枠には使われていない。", "S5 (G2): route registry由来の20ルートすべてが共通 PageShell (サイドバー 220px・ヘッダー 64px・フッター) の下で描画される。", "S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (thead / mobile-layout / financial-figure / financial-routes) が全て緑のままである。"]
architecture_refs: ["arch-design-system-ui-ux", "arch-design-system-frontend", "arch-design-system-backend", "arch-design-system-database", "arch-design-system-auth", "arch-design-system-security", "arch-design-system-infrastructure", "arch-design-system-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "FR-001..FR-005 は同じトークン正本を起点に連鎖する 1 つの価値単位で、単独では利用者に届く見た目の統一を生まないため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-design-system-foundation.md"}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-5kq", "linked_at": "2026-09-13T09:08:29Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-13T08:19:24Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---

# 目的

正式採用された FINAL-UI (Focus Ledger, design/FINAL-UI の 20 画面) を見た目の正本とし、色・文字・余白・角丸・影・動き・部品・共通シェル・図の見た目を単一の共通定義へ集約する。今後つくる画面・図・成果物が個別に色や寸法を決めなくても、共通定義を参照するだけで自動的に同じ見た目になり、ずれた値を持ち込めば機械的に検出される状態にする。

規範 (要件・判定条件・確定意思決定) の正本は `specs/spec-design-system-foundation.md` と、そこから参照する仕様章である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

design-tokens.ts を唯一の正本として styles.css と charts.ts の値がそこから導出され、20 ルートが共通シェルと共通ボタンの下で描画され、直書き色・写しのずれ・コントラスト未達が pnpm lint とテストで機械的に検出され、新しい画面や図をつくるときの参照先が規約文書 1 つに定まっている状態。

## スコープ

- スコープ内:
  - design/FINAL-UI の画像と DESIGN-SYSTEM.md からの色・構成・タイポグラフィ・寸法の抽出
  - packages/core へのデザイントークン正本 (依存ゼロの TypeScript) の新設
  - styles.css の :root トークンと charts.ts の COLORS をトークン正本から導出する形への置換と、写しのずれ検出 lint
  - サイドバー・ヘッダー・共通フッター・固定アクションバー・ページ骨格・ボタンの共通部品化と、既存 20 画面からの参照
  - チャート配色と描画規約の統一
  - 色の直書き検出と、文字・部品の枠・チャート系列のコントラスト検証のテスト
  - トークンと共通部品の使い方を示す規約文書
- スコープ外:
  - 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
  - 新機能の追加
  - API・データベースの変更
  - ネイティブアプリ (スマートフォン・タブレット・デスクトップ)
  - ダークテーマ
  - Web フォントの追加 (system-ui 系の和文ゴシックと既存の IBM Plex Mono を維持し規約化する)
  - 会計レポート用 report-design-system (report.css / report-css.ts) の配色移行と、その 2 ファイルの変更 (次サイクル。今回はトークン正本を依存ゼロの packages/core に置くことで、レポート側から同じ値を import できる前提だけを用意する)

## 受入

- [ ] S1 (G1, G4): packages/web/src の .ts/.tsx/.css において、トークン定義とその生成物以外での hex/rgb/hsl/CSS Color 構文による色の直書きが 0 件であり、lint がこれを検査する。
- [ ] S2 (G3): charts.ts と全ての実描画consumerの系列色・軸・グリッド・文字色が全て design-tokens.ts 由来で、収入=青系・支出=赤系・純収支=ティール線になっている。
- [ ] S3 (G1): design-tokens.ts を唯一の実装正本とし、schema/関係不変条件と CSS/charts consumer の一致を自動検査する。
- [ ] S4 (G5): 文字用トークンのコントラストが背景と面の双方に対し 4.5:1 以上、部品を見分ける枠のトークンとチャート系列色が 3:1 以上である。装飾罫線 (#D7E0E2) は 1.4.11 の対象外で、部品の枠には使われていない。
- [ ] S5 (G2): route registry由来の20ルートすべてが共通PageShell (サイドバー 220px・ヘッダー 64px・フッター) の下で描画される。
- [ ] S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプト (thead / mobile-layout / financial-figure / financial-routes) が全て緑のままである。

## アーキテクチャ参照

- `architecture_refs`: `arch-design-system-ui-ux`, `arch-design-system-frontend`, `arch-design-system-backend`, `arch-design-system-database`, `arch-design-system-auth`, `arch-design-system-security`, `arch-design-system-infrastructure`, `arch-design-system-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/design-system-ui-ux.md`, `architecture/design-system-frontend.md`, `architecture/design-system-backend.md`, `architecture/design-system-database.md`, `architecture/design-system-auth.md`, `architecture/design-system-security.md`, `architecture/design-system-infrastructure.md`, `architecture/design-system-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-design-system-foundation` (feature ノードへの依存は無い)
- 依存理由: 色の役割分離 (塗り/文字、装飾罫線/部品の枠) とトークン正本の置き場所 (packages/core) が確定仕様として固定されていないと、トークン名と導出方向が実装中に揺れるため。既存の全体期間 (PR #45) と 20 ルート構成は main に取り込み済みで、未完了の feature に依存しない。
- 後続: 各画面の中身を FINAL-UI どおりに作り直す feature と、report-design-system の配色移行 feature は本 feature の完了に依存する次サイクル候補であり、本サイクルでは起票しない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-design-system-foundation` が active/confirmed) のため、`/dev-graph plan --feature-id feat-design-system-foundation --feature-context features/feat-design-system-foundation.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-design-system-foundation` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了rollup: exact 13 全 done かつ P07/P10/P11 の evidence が上記受入を満たす場合だけ done にする。
