---
graph_node_id: "SYS-SETTINGS-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "settings-screen.ts・settings-json.ts・norm-rules.ts・10 API・migration 0051-0053・/settings 画面の最終実装"
project_id: "feature-package-feat-settings-screen"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["settings-screen", "p05", "mutation"]
file_path: "tasks/feat-settings-screen/sys-settings-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "77f7061b14dcbfea15f2ac0317596681a94f2b6b509fe6e4b94d53b7d987f5fa", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-settings-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-22T11:15:01Z", "origin_kind": "system-dev-planner", "source_digest": "77f7061b14dcbfea15f2ac0317596681a94f2b6b509fe6e4b94d53b7d987f5fa", "source_path": ".dev-graph/plans/feature-package-feat-settings-screen/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-22T11:15:01Z"
updated_at: "2026-09-22T11:15:01Z"
depends_on: ["SYS-SETTINGS-P04"]
related_nodes: ["arch-settings-auth", "arch-settings-backend", "arch-settings-database", "arch-settings-frontend", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-security", "arch-settings-ui-ux", "spec-settings-screen"]
resource_scope: ["packages/core/src/settings-screen.ts", "packages/core/src/settings-json.ts", "packages/core/src/norm-rules.ts", "packages/core/src/classify.ts", "packages/core/src/cash.ts", "packages/core/src/exports.ts", "packages/core/src/types.ts", "packages/core/src/fingerprint.ts", "packages/core/src/index.ts", "packages/api/src/routes/settings-screen.ts", "packages/api/src/routes/settings.ts", "packages/api/src/routes/backups.ts", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/store.ts", "packages/api/src/import-active.ts", "packages/api/src/import-lifecycle.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/index.ts", "migrations/0051_settings_norm_rules.sql", "migrations/0052_settings_cash_overrides.sql", "migrations/0053_settings_change_log.sql", "packages/web/src/api.ts", "packages/web/src/pages/settings/", "packages/web/src/pages/Settings.tsx", "packages/web/src/routeMetadata.ts", "packages/web/src/analysis-query-invalidation.ts"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-settings-screen"
feature_package_id: "feature-package/feat-settings-screen"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-settings-screen/sys-settings-p05.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-22T10:41:00Z", "missing_sections": [], "status": "complete"}
---

# settings-screen.ts・settings-json.ts・norm-rules.ts・10 API・migration 0051-0053・/settings 画面の最終実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-settings-screen
- owners: ["daishiman"]
- tags: ["settings-screen", "p05", "mutation"]
- related_nodes: ["arch-settings-auth", "arch-settings-backend", "arch-settings-database", "arch-settings-frontend", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-security", "arch-settings-ui-ux", "spec-settings-screen"]
- parent_feature: feat-settings-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-settings-screen/sys-settings-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストが全て緑になるまで、core (settings-screen.ts・settings-json.ts・norm-rules.ts・classify.ts・cash.ts)・10 API・migration 0051-0053・/settings 画面を実装する。P06 の検証前に、旧 Settings.tsx (457 行) の分離と routeMetadata の文言更新まで完了させる。

## 背景

設定の算出は settingsScreen 1 関数系統に寄せ、API は既存の authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の順序を維持し、書込み系 3 エンドポイント (PUT /api/settings/screen・POST /api/settings/restore・POST /api/backups/:date/restore) を変更系フェンスへ新規登録する。migration 0051-0053 は追加のみで既存 account_norm_map・cash_overrides 表を書き換えない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Entry gate: staging run plan-feat-settings-screen-20260922T1041Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: R-1 (cash_overrides の空欄 0 潰れ) は resolveCashOverride で null と 0 を区別する実装で解消し、未対処のまま complete を宣言しない。
Blocker: R-2 (account_norm_map の二重正本) は旧 PUT が新表 settings_norm_rules と同期して書く実装で解消する。
Blocker: R-3 (バックアップ日付の UTC/JST ずれ)・R-4 (保持削除の先頭 10 文字比較で pre-restore 退避が消えない) は JST の日付統一と backups/pre-restore/ の保持削除対象除外で解消する。
Blocker: R-5 (.failed.json による GET /api/backups の一覧重複) は同一日付のマージ処理で解消する。
Blocker: R-6 (toCsv の式注入無害化) は先頭が =,+,-,@ のセルへの無害化で解消し、既存 CSV テストの回帰が無いことを確認する。
Blocker: R-7 (backup-restore.dom.test.tsx と decision-010 の衝突) は同テストを『バックアップからの復元は設定だけを戻す』前提へ書き換えて緑にする。
Blocker: migration 番号 0051-0053 は予定番号であり、本 task の着手時に origin/main の最新 migration 番号を確認し、既に使われていれば繰り上げて実装する。
Open risk: Q-1 (名義の保存経路) は PUT /api/settings/screen への統合として実装し、既存 owner-labels API は家計収支画面向けに互換で残す。未決のまま進める。
Open risk: Q-2 (旧書込み経路と新表・revision の同期) は同じ意味で書き revision を進める実装とし、未決のまま進める。
Open risk: Q-3 (名義 4 欄の並び・例文)・Q-4 (現金上書きを月額と読む解釈)・Q-5 (取引先ルールの照合範囲を大項目・内容の完全一致に限定)・Q-6 (旧 NightlyBackups の全データ復元を画面から外す)・Q-7 (最新行の復元ボタンを有効にする)・Q-8 (レポート出力ボタンの文言と中身)・Q-9 (旧形式バックアップの設定部分の読み方)・Q-10 (夜間バックアップのファイル名を JST 日付にする)・Q-11 (変更履歴表示は集計ルールのみ)・Q-12 (Q-12 列挙の agent 推定値群) は、本書で具体化した値のまま実装し、いずれも confirmed 扱いにせず未決のまま進める。

## Workstream applicability

- Frontend: applicable: 本 phase の主責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: applicable: 本 phase の副次責務として扱う
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration (0051_settings_norm_rules.sql・0052_settings_cash_overrides.sql・0053_settings_change_log.sql の追加のみ)
- Compatibility/migration/backfill: migration 0051-0053 は追加のみ。既存 account_norm_map・cash_overrides・settings 表への書き換えと backfill は 0 件。番号は実装時と release 時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- packages/core/src/settings-screen.ts
- packages/core/src/settings-json.ts
- packages/core/src/norm-rules.ts
- packages/core/src/classify.ts
- packages/core/src/cash.ts
- packages/core/src/exports.ts
- packages/core/src/types.ts
- packages/core/src/fingerprint.ts
- packages/core/src/index.ts
- packages/api/src/routes/settings-screen.ts
- packages/api/src/routes/settings.ts
- packages/api/src/routes/backups.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/store.ts
- packages/api/src/import-active.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/index.ts
- migrations/0051_settings_norm_rules.sql
- migrations/0052_settings_cash_overrides.sql
- migrations/0053_settings_change_log.sql
- packages/web/src/api.ts
- packages/web/src/pages/settings/
- packages/web/src/pages/Settings.tsx
- packages/web/src/routeMetadata.ts
- packages/web/src/analysis-query-invalidation.ts
- Consumed artifacts:
- docs/settings-screen/design-decisions.md
- specs/spec-settings-screen.md
- Write scope/touches:
- packages/core/src/settings-screen.ts
- packages/core/src/settings-json.ts
- packages/core/src/norm-rules.ts
- packages/core/src/classify.ts
- packages/core/src/cash.ts
- packages/core/src/exports.ts
- packages/core/src/types.ts
- packages/core/src/fingerprint.ts
- packages/core/src/index.ts
- packages/api/src/routes/settings-screen.ts
- packages/api/src/routes/settings.ts
- packages/api/src/routes/backups.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/store.ts
- packages/api/src/import-active.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/index.ts
- migrations/0051_settings_norm_rules.sql
- migrations/0052_settings_cash_overrides.sql
- migrations/0053_settings_change_log.sql
- packages/web/src/api.ts
- packages/web/src/pages/settings/
- packages/web/src/pages/Settings.tsx
- packages/web/src/routeMetadata.ts
- packages/web/src/analysis-query-invalidation.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SETTINGS-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SETTINGS-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SETTINGS-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SETTINGS-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-settings-screen.context.json の scope_out (取引データの復元形式変更、既存の仕分けルール・ベンダー記憶の意味変更、共通シェルの作り直し、外部 LLM・外部サービスへの送信、複数テナント化・web 以外の専用アプリ、バックアップ保持期間 30 日の変更、バックアップからの全データ復元、既存 API の削除、既存表 account_norm_map・cash_overrides の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/core/src/settings-screen.ts (新設) の settingsScreen が BR-01〜BR-31 を満たし、P04 の core テストが緑である。
- packages/core/src/norm-rules.ts (新設) の取引先ルール照合・適用が 手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類 の順で動き、勘定科目ルールは取込時のみ・取引先ルールは集計時のみに適用され、保存済み明細を書き換えない。
- packages/core/src/cash.ts の resolveCashOverride が null (上書きしない) と 0 (0 円で上書き) を区別して 1 か所で解決する (R-1 の 0 潰れを解消する)。
- 10 API が既存 authGuard → mustChangePasswordFence → runtimeSchemaGuard → canonicalMutationFence の内側で動き、許可リスト外のクエリと上限超過に 400 を返す。PUT /api/settings/screen が baseSavedAt の 409 を返す。
- migration 0051〜0053 が追加のみで、runtimeSchemaGuard の EXPECTED_D1_MIGRATION に反映される。既存 account_norm_map・cash_overrides・settings 表は 1 行も書き換えない。
- /settings 画面が spec §7 の構成要素 (節ナビ 8 項目含む) を全て描画し、Settings.tsx は互換の re-export だけになる。
- Q-1 (名義の保存経路) は PUT /api/settings/screen へ統合し、既存 GET/PUT /api/settings/owner-labels は家計収支画面向けに互換で残す。Q-2 (旧書込み経路の互換) は旧 PUT /api/settings・PUT /api/settings/owner-labels・POST /api/restore が新表と変更履歴へ同じ意味で書き、revision を進める形で実装する (いずれも未決のまま Open risk として記録する)。
- R-2 (account_norm_map の二重正本) は旧 PUT が新表 settings_norm_rules と同期して書く実装で解消する。R-3/R-4 (バックアップ日付 UTC/JST・保持削除の先頭 10 文字比較) は JST の日付にそろえ、backups/pre-restore/ を保持削除の対象から除外する実装で解消する。R-5 (.failed.json の重複) は GET /api/backups の一覧生成で同一日付をマージする実装で解消する。R-6 (toCsv 無害化) は先頭が =,+,-,@ のセルにのみ無害化を適用する実装で解消する。R-7 (backup-restore.dom.test.tsx との衝突) は同テストを『バックアップからの復元は設定だけを戻す』前提に書き換えて緑にする。
- Q-3 (名義 4 欄の並び・例文)・Q-6 (旧 NightlyBackups の全データ復元を画面から外す)・Q-7 (最新行の復元ボタンを有効にする)・Q-8 (レポート出力ボタンの文言と中身)・Q-9 (旧形式バックアップの設定部分の読み方)・Q-10 (夜間バックアップのファイル名を JST 日付にする)・Q-11 (変更履歴表示は集計ルールのみ)・Q-12 (Q-12 列挙の agent 推定値群) は、本書で具体化した値のまま実装し、いずれも confirmed 扱いにせず Open risk として記録する。
- packages/web/src/routeMetadata.ts の設定の task/taskDetail 文言を更新し、既存の画像外機能 (パスワード変更・利用者管理・名義割当・仕分けルール・科目候補・手動編集・ベンダー記憶・未記帳月・HTML 版初期移行) を 1 つも削除しない。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/settings-screen.ts
- packages/core/src/settings-json.ts
- packages/core/src/norm-rules.ts
- packages/core/src/classify.ts
- packages/core/src/cash.ts
- packages/core/src/exports.ts

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。migration 0051〜0053 は追加のみの表なので既存行の書き換えは無く、表が残っても既存画面は動く。配信済みなら直前のビルドへ戻し、表の削除は行わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-settings-screen.md
- Architecture: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Feature: feat-settings-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SETTINGS-P04
