---
graph_node_id: "feat-subscriptions-merge"
artifact_kind: "feature"
artifact_subtypes: []
title: "サブスク統合の是正 (登録済みの行の統合・取り消し) と書込みの順次処理"
project_id: "kanjo"
domain: "analysis"
status: "active"
priority: "high"
start_date: null
target_date: null
iteration: null
owners: []
tags: ["analysis", "subscriptions", "feature"]
file_path: "features/feat-subscriptions-merge.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness:assign-system-spec-completeness-evaluator", "evidence_ref": "docs/evidence/subscriptions-merge/spec-evaluation-waiver.json", "evaluated_digest": "8a9ed18c1ea8d587e843aac443afc2bbb69be109dca2089b686192e178dfdee4"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "specs/spec-subscriptions-merge.md", "source_version": "0.1.11", "source_digest": "eef292e9f0e6d4182469cf93caba0459e38215c53e8e78d8a9a7741819dafbea", "imported_at": "2026-09-30T15:18:46Z"}
created_at: "2026-09-30T15:18:46Z"
updated_at: "2026-09-30T15:18:46Z"
depends_on: ["spec-subscriptions-merge"]
related_nodes: ["arch-subscriptions-merge-ui-ux", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-auth", "arch-subscriptions-merge-security", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops"]
resource_scope: ["architecture/subscriptions-merge-auth.md", "architecture/subscriptions-merge-backend.md", "architecture/subscriptions-merge-database.md", "architecture/subscriptions-merge-frontend.md", "architecture/subscriptions-merge-infrastructure.md", "architecture/subscriptions-merge-maintenance-ops.md", "architecture/subscriptions-merge-security.md", "architecture/subscriptions-merge-ui-ux.md", "design/FINAL-UI/images/09-subscriptions.png", "docs/data-schema.md", "docs/subscriptions-screen.md", "migrations/0058_subscription_merge_operations.sql", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/db/schema.ts", "packages/api/src/deletion-schema.test.ts", "packages/api/src/expense-projection.integration.test.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle-pure.test.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/index.test.ts", "packages/api/src/index.ts", "packages/api/src/routes/imports.ts", "packages/api/src/routes/settings.ts", "packages/api/src/routes/subs.ts", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/api/src/subs-merge-operations.integration.test.ts", "packages/api/src/subs-screen.integration.test.ts", "packages/api/src/subs-vendor-scope.test.ts", "packages/api/src/subscription-writes.ts", "packages/core/src/dataset.ts", "packages/core/src/expense-projection.ts", "packages/core/src/index.ts", "packages/core/src/subs-screen.ts", "packages/core/src/subs.ts", "packages/core/test/subs-contract.test.ts", "packages/core/test/subs-screen-contract.test.ts", "packages/web/src/api-client.ts", "packages/web/src/api.ts", "packages/web/src/components/Page.tsx", "packages/web/src/diagnosis-next-action-receivers.dom.test.tsx", "packages/web/src/mobile-financial-visualization.dom.test.tsx", "packages/web/src/pages/Subscriptions.tsx", "packages/web/src/pages/import/import-test-fakes.ts", "packages/web/src/pages/subscriptions", "packages/web/src/subscriptions-screen.dom.test.tsx", "packages/core/src/subscription-operation.ts", "packages/api/src/subscription-restore-barrier.ts", "packages/core/src/types.ts", "packages/web/src/components/AccessibleTabs.tsx", "packages/web/src/mobile-financial-visualization-render.test.ts", "packages/web/scripts/check-financial-visuals.mjs", "packages/api/src/import-lifecycle.test.ts", "docs/evidence/subscriptions-merge/elegant-review.md"]
purpose: "サブスク画面の統合を、登録済みの行どうしでも行えて統合元が一覧から消え、他の画面のサブスク集計も同じ名寄せを示すようにする。あわせて、統合・登録・変更・見直し判断を続けて、または複数の利用者が同時に行っても、操作が失われず「サーバー側で処理に失敗しました」で止まらないようにし、操作ごとの状態 (待機中・処理中・完了・失敗) と操作者を示し、統合を取り消して統合前へ戻せるようにする。"
goal: "/subscriptions?vendor=aquavoice のように登録済みの行を別の登録済みの行へ統合すると、統合元が一覧から消えて統合先の推定月額を統合後の明細から再計算し、各月の実支払額を保存し、他画面のサブスク集計も core の resolveVendorMerges による同じ名寄せを示し、行チェック・全選択・選択バーで複数件を統合先へまとめられ、統合の書込みは POST /api/sub-vendors/merge が操作の記録 (Idempotency-Key と revision) と subs 範囲の置き換えを 1 つの db.batch で原子的に行い、同時の 2 件目は未適用の 409 になって画面の待ち行列が自動で再試行し、5 件連続・2 件同時で 500 が 0 件、操作状態に待機中・処理中・完了・失敗と操作者が出て、取り消し (30 日) で統合前に戻り、記録は 400 日で書込みのついでに掃除され、migration 0058 と docs が揃い、pnpm verify:full と CI が緑の状態。"
scope_in: ["統合の意味の是正: 登録済みの行を別の行へ統合でき、統合元の別名・見直し判断・対象科目を統合先へ吸収し、sub_vendors.merged_into_id で統合元を一覧から消す", "一覧の行チェックと全選択 (mixed 表示)、詳細パネルの取引名チェック、選択バーで統合先 (既定は推定月額が最大の登録済み行) を選ぶ複数件統合。処理中は選択を無効にし、統合後は ?vendor= を統合先へ付け替える", "取り消しと操作履歴: POST /api/subscription-operations/{id}/undo と GET /api/subscription-operations?limit=1..20。取り消しはテナントの全利用者ができ、actor_user_id を記録して email (users に居なければ「削除された利用者」) で示す", "名寄せの共通化: core の resolveVendorMerges (連鎖を解決し、循環と自己統合は例外) を applyFreeeDeals・サブスク画面の照合・他画面の subs 集計が共有する。金額の母集団は各画面の定義を保つ", "書込みの並行制御: subscription_operations (Idempotency-Key と base_revision の一意制約)・subscription_revisions・baseRevision による 409 subscription_revision_conflict・canonical_write_busy の 409。書込みと subs 範囲の置き換えを 1 つの db.batch にまとめ、既存の書込み 9 本に baseRevision (任意) と Idempotency-Key (任意) を足す", "画面の待ち行列: TanStack Query の mutation scope で 1 件ずつ送り、409 は同じ key で最大 3 回自動再試行、revision の衝突は前提を確かめて新しい key で送り直す。「サーバー側で処理に失敗しました」と再試行ボタンは 5xx と通信の失敗のときだけ出す", "保持: 取り消しは 30 日 (過ぎたら 410 undo_expired)、記録は 400 日。掃除は新しい書込みのついでに 1 回 50 件まで行う", "migration 0058 と schema-guard の EXPECTED_D1_MIGRATION、docs/subscriptions-screen.md と docs/data-schema.md、core 契約・api 統合・web DOM テスト (AC-001〜023)"]
scope_out: ["他画面 (概要・総収支・推移など) の画面デザインの作り直し (名寄せの共通化による集計の一致だけを扱う)", "freee / マネーフォワードの取込方式の変更", "他画面の合計へのカード・銀行の未照合明細の算入", "AI による自動統合 (候補と検出理由は出すが、統合の確定は利用者の操作だけで行う)", "Web 以外の専用アプリ", "Durable Objects・Queues・新しい有料サービス・新しい夜間 job", "楽観更新 (書込みの成功後に取り直す)", "取り消しの権限を role や操作者で分けること"]
acceptance: ["O1 (G1): aquavoice 型 (登録済みの行を別の登録済みの行へ統合) で統合元の行が一覧から 0 件になり、統合先の推定月額を統合後の明細から再計算し、各月の実支払額を保存し、monthly_agg の subs 範囲と他画面のサブスク集計が同じ名寄せを示す (AC-001〜003・016)。", "O2 (G2): 5 件連続・2 件同時の操作で 500 が 0 件で、取り合いは明示的な 409 か 503 になり画面が自動で収束させ、最終の集計が最後に完了した操作と一致する。「サーバー側で処理に失敗しました」は 5xx と通信の失敗のときだけ出る (AC-004〜006・015・021)。", "O3 (G3): 行チェック・全選択・選択バー・統合先・操作状態・操作者・取り消しの DOM テストが全件緑である (AC-007〜011・022)。", "O4 (G4): テナントに無い id は 404、取り消しで統合前の一覧に戻る、古い revision からの更新は未適用の 409、取り消し 30 日と記録 400 日の期限が守られ、操作の一覧に before_json・payload_json・key が出ない (AC-012〜014・017〜020)。", "U5: pnpm verify:full と CI が緑である (AC-023)。"]
architecture_refs: ["arch-subscriptions-merge-ui-ux", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-auth", "arch-subscriptions-merge-security", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops"]
parent_feature: null
feature_package_id: null
phase_ref: null
classification_confidence: 1.0
classification_reason: "I1..I8 は同じ書込み契約 (core の resolveVendorMerges → POST /api/sub-vendors/merge と操作の記録・revision → 画面の待ち行列と操作状態 → 取り消し) と同じ保存 (migration 0058) を起点に連鎖する 1 つの価値単位で、統合の意味だけ・並行制御だけを先に入れると『統合しても消えない』か『続けて押すと 500』のどちらかが残るため 1 feature とした。"
classification_candidates: [{"artifact_kind": "feature", "confidence": 1.0, "candidate_path": "features/feat-subscriptions-merge.md"}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-c2t", "linked_at": "2026-09-30T15:51:55Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": []}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-09-30T15:18:46Z"}
serves_goals: ["G1", "G2", "G3", "G4"]
---

# 目的

サブスク画面の統合を、登録済みの行どうしでも行えて統合元が一覧から消え、他の画面のサブスク集計も同じ名寄せを示すようにする。あわせて、統合・登録・変更・見直し判断を続けて、または複数の利用者が同時に行っても、操作が失われず「サーバー側で処理に失敗しました」で止まらないようにし、操作ごとの状態 (待機中・処理中・完了・失敗) と操作者を示し、統合を取り消して統合前へ戻せるようにする。

規範 (要件・業務規則・API 契約・確定意思決定) の正本は [spec-subscriptions-merge](../specs/spec-subscriptions-merge.md)。`system-spec/` は承認・収集の履歴と現行契約への入口を持つ。本書は実装単位の境界と依存だけを持つ。

## 到達状態

/subscriptions?vendor=aquavoice のように登録済みの行を別の登録済みの行へ統合すると、統合元が一覧から消えて統合先の推定月額を統合後の明細から再計算し、各月の実支払額を保存し、他画面のサブスク集計も core の resolveVendorMerges による同じ名寄せを示し、行チェック・全選択・選択バーで複数件を統合先へまとめられ、統合の書込みは POST /api/sub-vendors/merge が操作の記録 (Idempotency-Key と revision) と subs 範囲の置き換えを 1 つの db.batch で原子的に行い、同時の 2 件目は未適用の 409 になって画面の待ち行列が自動で再試行し、5 件連続・2 件同時で 500 が 0 件、操作状態に待機中・処理中・完了・失敗と操作者が出て、取り消し (30 日) で統合前に戻り、記録は 400 日で書込みのついでに掃除され、migration 0058 と docs が揃い、pnpm verify:full と CI が緑の状態。

## スコープ

実装単位は名寄せの共通化、操作の原子的な保存、画面の選択と待ち行列、取り消しと履歴、復元の保護、migrationと検証を一つのfeatureとして扱う。具体的な業務規則・API・保持期限は [spec のスコープ](../specs/spec-subscriptions-merge.md#スコープ) と「確定した実装契約」を参照し、本書に複製しない。

作業可能なpathはfrontmatterの `resource_scope`。依存・実装配置の最終確認は各taskとarchitectureを参照する。

## 受入

- [ ] O1 (G1): aquavoice 型 (登録済みの行を別の登録済みの行へ統合) で統合元の行が一覧から 0 件になり、統合先の推定月額を統合後の明細から再計算し、各月の実支払額を保存し、monthly_agg の subs 範囲と他画面のサブスク集計が同じ名寄せを示す (AC-001〜003・016)。
- [ ] O2 (G2): 5 件連続・2 件同時の操作で 500 が 0 件で、取り合いは明示的な 409 か 503 になり画面が自動で収束させ、最終の集計が最後に完了した操作と一致する。「サーバー側で処理に失敗しました」は 5xx と通信の失敗のときだけ出る (AC-004〜006・015・021)。
- [ ] O3 (G3): 行チェック・全選択・選択バー・統合先・操作状態・操作者・取り消しの DOM テストが全件緑である (AC-007〜011・022)。
- [ ] O4 (G4): テナントに無い id は 404、取り消しで統合前の一覧に戻る、古い revision からの更新は未適用の 409、取り消し 30 日と記録 400 日の期限が守られ、操作の一覧に before_json・payload_json・key が出ない (AC-012〜014・017〜020)。
- [ ] U5: pnpm verify:full と CI が緑である (AC-023)。

## アーキテクチャ参照

- `architecture_refs`: `arch-subscriptions-merge-ui-ux`, `arch-subscriptions-merge-frontend`, `arch-subscriptions-merge-backend`, `arch-subscriptions-merge-database`, `arch-subscriptions-merge-auth`, `arch-subscriptions-merge-security`, `arch-subscriptions-merge-infrastructure`, `arch-subscriptions-merge-maintenance-ops`
- 領域別の制約と既存実装の是正点は各ノードの本文 (`architecture/subscriptions-merge-ui-ux.md`, `architecture/subscriptions-merge-frontend.md`, `architecture/subscriptions-merge-backend.md`, `architecture/subscriptions-merge-database.md`, `architecture/subscriptions-merge-auth.md`, `architecture/subscriptions-merge-security.md`, `architecture/subscriptions-merge-infrastructure.md`, `architecture/subscriptions-merge-maintenance-ops.md`) を参照し、本書へ複製しない。

## 機能間依存

- `depends_on`: `spec-subscriptions-merge` (feature ノードへの依存は無い)
- 依存理由: 統合の意味 (登録済みの行も統合元にでき、統合元は一覧から消える)・操作の記録と revision・409 と自動再試行の境界・取り消しと保持の期限・migration 0058 の表と一意制約が確定していないと、core の返り値型・API 応答・migration・テストの期待値が実装中に揺れるため。
- 前サイクルとの関係: `feat-subscriptions-screen` (PR #60 のサブスク画面の作り直し、#61 の取引履歴と統合先の登録) は main に取り込み済みで、本 feature はその画面構成・文言・fixture・migration 0043 を正本のまま引き継ぐ。未完了の feature には依存しない。
- 重複の不在: `feat-subscriptions-screen` の scope_out に「一覧の行チェックによる一括操作 (チェックだけ置く)」が明記されており、本 feature はその一括操作と、統合の意味の是正・書込みの並行制御を扱う。

## Handoff

- per-feature planning: 本 feature は ready (依存先 `spec-subscriptions-merge` が active/confirmed/pass) のため、`/dev-graph plan --feature-id feat-subscriptions-merge --feature-context features/feat-subscriptions-merge.context.json` で system-dev-planner (run-system-dev-plan) を起動する。手動 `/system-dev-plan` の結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs と 13-node intra-feature DAG。
- 登録先: 全 task を同一 `parent_feature=feat-subscriptions-merge` / `feature_package_id` で C02 `register-package` 経由 atomic 登録する (expected/applied=13)。
- `resource_scope` は spec の変更範囲に、architecture 8 文書と、export の呼び出し元・型で結ばれた宣言・本体を import するだけのファイル (テストを含む) を足した。
- 完了 rollup: exact 13 全 done かつ受入 O1〜O4・U5 の evidence が揃う場合だけ done にする。
- 実装の着手時に現物で確かめる事項 (migration 番号 0058 の空き・mutation scope の型・統合 1 回の D1 問い合わせ数・照合順序のそろえ方で既存画面の数値が変わる範囲) は `specs/spec-subscriptions-merge.md` の非機能要件と API 契約の値を正本とし、該当 task の契約テストで確かめる。
- tracker 投影: `tracker_binding=beads` の bd issue 作成は後段の `/dev-graph sync` で行い、本 decompose では外部 write をしない (`beads_linkage=null`)。
