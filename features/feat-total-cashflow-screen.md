---
graph_node_id: "feat-total-cashflow-screen"
artifact_kind: "feature"
artifact_subtypes: []
title: "総収支画面 (05-total-cashflow) の判定ワークベンチ化と操作履歴"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["total-cashflow-screen", "feature"]
file_path: "features/feat-total-cashflow-screen.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/completeness-findings.json", "evaluated_digest": "fb279c1721e0f5401985f101fd3a947fce86c605e7417d1dcb5de135eddc4f36"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-total-cashflow-screen.md", "source_version": "0.1.11", "source_digest": "5a33622f5f473d22ed399ba2d8fbcd1920e95b2080be0016c63bebdcb09a0b37", "imported_at": "2026-09-15T15:13:39Z"}
created_at: "2026-09-15T15:13:39Z"
updated_at: "2026-09-15T15:41:00Z"
depends_on: ["spec-total-cashflow-screen"]
related_nodes: ["arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
resource_scope: [".github/workflows", "design/FINAL-UI/images/05-total-cashflow.png", "design/FINAL-UI/spec/AUDIT.md", "docs", "migrations", "package.json", "packages/api/src/auth.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/d1-limits.ts", "packages/api/src/db/schema.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/index.ts", "packages/api/src/routes/analytics.ts", "packages/api/src/routes/duplicate-verdict-bindings.ts", "packages/api/src/routes/imports.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/api/test/total-cashflow-verdict.integration.test.ts", "packages/api/wrangler.jsonc", "packages/core/src/analysis-hub.ts", "packages/core/src/design-tokens.ts", "packages/core/src/period.ts", "packages/core/src/total-cashflow.ts", "packages/core/test/total-cashflow-contract.test.ts", "packages/web/package.json", "packages/web/src/AuthenticatedApp.tsx", "packages/web/src/analysis-tabs.dom.test.tsx", "packages/web/src/common-shell.dom.test.tsx", "packages/web/src/components/Button.tsx", "packages/web/src/components/DataTable.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/components/Page.tsx", "packages/web/src/components/charts.ts", "packages/web/src/pages/analysis/TotalCashflow.tsx", "packages/web/src/period.tsx", "packages/web/src/routeMetadata.ts", "packages/web/test/total-cashflow-table.dom.test.tsx"]
purpose: "家計と事業を合わせた本当の収支を、重複と除外の判断ごと 1 画面で確かめて月次クローズの『照合→総収支』を終えられるようにする。利用者が総収支を開いた時点で、期間の総収入・総支出・純収支と前期比、月ごとの推移が総合/事業/家計で読め、その数字に効いている重複候補・freee 除外・要確認を同じ画面の判定作業で片付け、誤った判断はその画面を開いてから行った操作を新しい順に遡って元に戻せる状態にする。"
goal: "/analysis/total-cashflow が 05-total-cashflow.png の全構成要素をトークンと共通 Button/PageShell で描画し、総合/事業/家計の KPI・前期比・月次チャートが core の値と一致して総合=事業+家計が成り立ち、3 ペインの判定作業で単票・一括の同じ/別/除外が feat-total-cashflow の不変条件を保ったまま行え、freee 除外の理由区分とメモ・操作履歴が D1 に残って画面を開いてから行った操作を新しい順に 1 回分ずつ取り消せ、判定・除外・操作履歴の 3 表がバックアップと復元で戻り、一致度・区分・自動一致の規則が docs と境界値テストで固定され、サイドバーの支出分析 > 総収支 の現在地と照合バッジが確認され、既存の test / typecheck / lint / check 系が緑のままの状態。"
scope_in: ["総収支タブ (05-total-cashflow.png) の画面構成の作り直し: 見出し・セグメント・期間表示・KPI・チャート・3 ペイン判定作業・freee 除外一覧・自動一致の候補・進捗通知・下部選択バー、既存 9 列月次表の開閉化", "packages/core の総収支集計の拡張 (セグメント別期間合計・前期比較・月次系列・判定作業 3 区分・一致度・自動一致の候補)", "packages/api の総収支 API 拡張 (集計の返却、一括判定、除外の理由区分とメモ、操作履歴の取得と取消)", "D1 migration: freee 除外の理由区分とメモ列、判定・除外の操作履歴テーブル、既存理由の移行、判定・除外・操作履歴の 3 表をバックアップと復元の対象に加えること", "一致度・区分・自動一致の規則の docs 記載とテスト", "共通ヘッダー/フッター文言の画像への揃え (防衛ライン・毎朝バックアップ等)", "サイドバーの支出分析 > 総収支 の現在地と照合バッジの表示確認 (確認のみ)"]
scope_out: ["サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更: 利用者指示により今回は確認のみ", "照合・マトリクス・推移・診断の各タブの中身: それぞれの画面サイクルで扱う", "日付と金額の一致による自動寄せの廃止: 利用者決定により自動寄せを維持する", "freee / Money Forward の取込経路の追加と明細分割の仕様変更", "期間選択の保存先の変更 (既存どおり localStorage で全画面共有)", "mobile / tablet / desktop 向け専用アプリ: 対象は web のみ (狭幅は既存のレスポンシブ表示で扱う)"]
acceptance: ["S1 (G1): /analysis/total-cashflow で 05-total-cashflow.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で、直書き色の lint が 0 件である。", "S2 (G1, G3): 総合/事業/家計それぞれで総収入・総支出・純収支と前期比 (額・率) が core の値と一致し、総合の値が事業と家計の和に一致する。", "S3 (G2): 判定作業で単票・複数選択の『同じ取引/別の取引/集計から除外』が行え、判定後の総額が feat-total-cashflow の不変条件を満たす。", "S4 (G4): 画面を開いてから行った操作を元に戻すと総収入・総支出・判定件数が操作前と一致し、同じ取消を 2 回送っても 1 回分しか戻らない。再読込後は取消の導線が出ない。既存の除外理由は migration 後もメモとして読め、バックアップから復元しても判定・除外・操作履歴が戻る。", "S5 (G5): 一致度・区分・自動一致の規則が docs に明記され、境界値付きテストで固定される。サイドバーの支出分析 > 総収支 が現在地になり照合の件数バッジが要確認件数と一致する。", "S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプトが全て緑のままである。"]
architecture_refs: ["arch-total-cashflow-screen-ui-ux", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "S3 (一括判定後の総額不変) と S4 (取消で操作前と一致・3 表の復元) は、core の集計・API の判定/取消・D1 の操作履歴と 3 表のバックアップ・画面の 3 ペインと取消導線を同じ受入で貫くため、層ごとに分割すると 1 つの受入が複数 feature にまたがり、どれも単独では利用者に届く『総収支を 1 画面で確かめて月次クローズの照合→総収支を終える』を生まない。前例 feat-overview-screen (D1 migration + API + 画面を 1 feature) と同じ判断で 1 feature とした。既存 feat-total-cashflow は消し込みの不変条件の正本として残し、本 feature はその上に画面と操作履歴を足す別の価値単位である。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-total-cashflow-screen.md"}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-15T15:13:39Z"}
serves_goals: ["G1", "G2", "G3", "G4", "G5"]
---
# 目的

家計と事業を合わせた本当の収支を、重複と除外の判断ごと 1 画面で確かめて月次クローズの『照合→総収支』を終えられるようにする。利用者が総収支を開いた時点で、期間の総収入・総支出・純収支と前期比、月ごとの推移が総合/事業/家計で読め、その数字に効いている重複候補・freee 除外・要確認を同じ画面の判定作業で片付け、誤った判断はその画面を開いてから行った操作を新しい順に遡って元に戻せる状態にする。

規範 (要件・判定条件・確定意思決定) の正本は `specs/spec-total-cashflow-screen.md` と、そこから参照する仕様章 (`system-spec/`) である。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/analysis/total-cashflow が 05-total-cashflow.png の全構成要素をトークンと共通 Button/PageShell で描画し、総合/事業/家計の KPI・前期比・月次チャートが core の値と一致して総合=事業+家計が成り立ち、3 ペインの判定作業で単票・一括の同じ/別/除外が feat-total-cashflow の不変条件を保ったまま行え、freee 除外の理由区分とメモ・操作履歴が D1 に残って画面を開いてから行った操作を新しい順に 1 回分ずつ取り消せ、判定・除外・操作履歴の 3 表がバックアップと復元で戻り、一致度・区分・自動一致の規則が docs と境界値テストで固定され、サイドバーの支出分析 > 総収支 の現在地と照合バッジが確認され、既存の test / typecheck / lint / check 系が緑のままの状態。

## スコープ

- スコープ内:
  - 総収支タブ (05-total-cashflow.png) の画面構成の作り直し: 見出し・セグメント・期間表示・KPI・チャート・3 ペイン判定作業・freee 除外一覧・自動一致の候補・進捗通知・下部選択バー、既存 9 列月次表の開閉化
  - packages/core の総収支集計の拡張 (セグメント別期間合計・前期比較・月次系列・判定作業 3 区分・一致度・自動一致の候補)
  - packages/api の総収支 API 拡張 (集計の返却、一括判定、除外の理由区分とメモ、操作履歴の取得と取消)
  - D1 migration: freee 除外の理由区分とメモ列、判定・除外の操作履歴テーブル、既存理由の移行、判定・除外・操作履歴の 3 表をバックアップと復元の対象に加えること
  - 一致度・区分・自動一致の規則の docs 記載とテスト
  - 共通ヘッダー/フッター文言の画像への揃え (防衛ライン・毎朝バックアップ等)
  - サイドバーの支出分析 > 総収支 の現在地と照合バッジの表示確認 (確認のみ)
- スコープ外:
  - サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更: 利用者指示により今回は確認のみ
  - 照合・マトリクス・推移・診断の各タブの中身: それぞれの画面サイクルで扱う
  - 日付と金額の一致による自動寄せの廃止: 利用者決定により自動寄せを維持する
  - freee / Money Forward の取込経路の追加と明細分割の仕様変更
  - 期間選択の保存先の変更 (既存どおり localStorage で全画面共有)
  - mobile / tablet / desktop 向け専用アプリ: 対象は web のみ (狭幅は既存のレスポンシブ表示で扱う)

## 受入

- [ ] S1 (G1): /analysis/total-cashflow で 05-total-cashflow.png の構成要素がすべて描画され、色・余白・部品はトークンと共通 Button/PageShell 経由で、直書き色の lint が 0 件である。
- [ ] S2 (G1, G3): 総合/事業/家計それぞれで総収入・総支出・純収支と前期比 (額・率) が core の値と一致し、総合の値が事業と家計の和に一致する。
- [ ] S3 (G2): 判定作業で単票・複数選択の『同じ取引/別の取引/集計から除外』が行え、判定後の総額が feat-total-cashflow の不変条件を満たす。
- [ ] S4 (G4): 画面を開いてから行った操作を元に戻すと総収入・総支出・判定件数が操作前と一致し、同じ取消を 2 回送っても 1 回分しか戻らない。再読込後は取消の導線が出ない。既存の除外理由は migration 後もメモとして読め、バックアップから復元しても判定・除外・操作履歴が戻る。
- [ ] S5 (G5): 一致度・区分・自動一致の規則が docs に明記され、境界値付きテストで固定される。サイドバーの支出分析 > 総収支 が現在地になり照合の件数バッジが要確認件数と一致する。
- [ ] S6 (G1-G5): 既存の pnpm test / typecheck / lint と packages/web の check 系スクリプトが全て緑のままである。

## アーキテクチャ参照

- `architecture_refs`: `arch-total-cashflow-screen-ui-ux`, `arch-total-cashflow-screen-frontend`, `arch-total-cashflow-screen-backend`, `arch-total-cashflow-screen-database`, `arch-total-cashflow-screen-auth`, `arch-total-cashflow-screen-security`, `arch-total-cashflow-screen-infrastructure`, `arch-total-cashflow-screen-maintenance-ops`
- 領域別の制約は各ノードの本文 (`architecture/total-cashflow-screen-ui-ux.md`, `architecture/total-cashflow-screen-frontend.md`, `architecture/total-cashflow-screen-backend.md`, `architecture/total-cashflow-screen-database.md`, `architecture/total-cashflow-screen-auth.md`, `architecture/total-cashflow-screen-security.md`, `architecture/total-cashflow-screen-infrastructure.md`, `architecture/total-cashflow-screen-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-total-cashflow-screen` (feature ノードへの依存は無い)
- 依存理由: 一致度・判定作業の 3 区分・自動一致の扱い、前期 (前年の同じ期間) の定義、取消の条件 (より新しい未取消の操作が無いこと・同じ取消の再送で 1 回分しか戻らないこと)、操作履歴を含む 3 表のバックアップと復元の規則が確定仕様として固定されていないと、core の型・API 応答・migration の形が実装中に揺れるため。
- 前提 (依存辺にしない): 消し込みの不変条件は `feat-total-cashflow`、canonical-mutation-fence と 0040 migration の前例は `feat-overview-screen` (PR #51)、ハブ要約の invalidation は `feat-analysis-hub` (PR #50)、トークン・共通 Button・PageShell は `feat-design-system-foundation` (PR #49) で、いずれも main に取り込み済みのため未完了の feature への依存にはならない。`related_nodes` で参照する。
- 後続: 照合・マトリクス・推移・診断の各タブを FINAL-UI どおりに作り直す feature は各画面のサイクル候補であり、本サイクルでは起票しない。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-total-cashflow-screen` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-total-cashflow-screen --feature-context features/feat-total-cashflow-screen.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-total-cashflow-screen` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- 完了rollup: exact 13 全 done かつ受入 S1〜S6 の evidence が揃う場合だけ done にする。
- 計画時に拾う low 所見 (completeness-findings.json): canonical write busy (409) と取消列の扱いの整合、別タブ復元後の 404 の画面表示、`db/schema.ts` と `import-lifecycle-pure.test.ts` の routeSources への総収支 route 追加、3 表のバックアップ保護の security 記述、migration 番号 0041 の sync 前の再確認。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
