---
graph_node_id: "SYS-SETTINGS-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "受入基準 S1 から S5（AT-01〜AT-22）の検証"
project_id: "feature-package-feat-settings-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["settings-screen", "p07", "acceptance"]
file_path: "tasks/feat-settings-screen/sys-settings-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "77f7061b14dcbfea15f2ac0317596681a94f2b6b509fe6e4b94d53b7d987f5fa", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-settings-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-22T11:15:01Z", "origin_kind": "system-dev-planner", "source_digest": "77f7061b14dcbfea15f2ac0317596681a94f2b6b509fe6e4b94d53b7d987f5fa", "source_path": ".dev-graph/plans/feature-package-feat-settings-screen/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-22T11:15:01Z"
updated_at: "2026-09-22T11:15:01Z"
depends_on: ["SYS-SETTINGS-P06"]
related_nodes: ["arch-settings-auth", "arch-settings-backend", "arch-settings-database", "arch-settings-frontend", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-security", "arch-settings-ui-ux", "spec-settings-screen"]
resource_scope: ["docs/settings-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-settings-screen"
feature_package_id: "feature-package/feat-settings-screen"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-settings-screen/sys-settings-p07.md", "confidence": 0.95}]
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

# 受入基準 S1 から S5（AT-01〜AT-22）の検証

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-settings-screen
- owners: ["daishiman"]
- tags: ["settings-screen", "p07", "acceptance"]
- related_nodes: ["arch-settings-auth", "arch-settings-backend", "arch-settings-database", "arch-settings-frontend", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-security", "arch-settings-ui-ux", "spec-settings-screen"]
- parent_feature: feat-settings-screen
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-settings-screen/sys-settings-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

受入基準 S1 から S5（AT-01〜AT-22）を検証する。

## 背景

/settings の描画・core 算出の一致・保存と 409・JSON 書き出し復元・夜間バックアップ・migration 追加のみ・外部送信 0 件を実測で確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Entry gate: staging run plan-feat-settings-screen-20260922T1041Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: Q-1〜Q-12 は受入項目の PASS 判定に影響しない agent 推定値であることを確認し、受入 PASS の可否は S1〜S5 の実測結果のみで判断する。
Blocker: R-1〜R-7 の対処 (P05) が全て実装済みであることを本 phase の前提として確認する。未対処が残る場合は受入 PASS にしない。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Deploy unit/environment: N/A: 検証記録のみで配布物を持たない
- Compatibility/migration/backfill: migration 0051-0053 は追加のみ。既存 account_norm_map・cash_overrides・settings 表への書き換えと backfill は 0 件。番号は実装時と release 時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- docs/settings-screen/design-decisions.md
- Consumed artifacts:
- docs/settings-screen/design-decisions.md
- specs/spec-settings-screen.md
- Write scope/touches:
- docs/settings-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SETTINGS-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SETTINGS-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SETTINGS-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SETTINGS-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-settings-screen.context.json の scope_out (取引データの復元形式変更、既存の仕分けルール・ベンダー記憶の意味変更、共通シェルの作り直し、外部 LLM・外部サービスへの送信、複数テナント化・web 以外の専用アプリ、バックアップ保持期間 30 日の変更、バックアップからの全データ復元、既存 API の削除、既存表 account_norm_map・cash_overrides の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S5・AT-01〜AT-22 の各項目に合否と証跡の所在が記録されている。
- S2 (取引先ルールの優先順位・現金上書きの空欄/0/全期間/月指定・既存の勘定科目正規化の回帰 0 件) が実測値で確認されている。
- S3 (baseSavedAt の 409・変更履歴の追記のみ・元に戻すが直前保存値へ戻す) が実測値で確認されている。
- S4 (JSON 書き出し→復元の一致・取引件数不変・不正 JSON の拒否・夜間バックアップの状態つき一覧・比較・設定だけの復元) が実測値で確認されている。
- AT-22 (外部送信 0 件) が fetch の監視で確認されている。既知の逸脱・未実施・一部適合が 1 件でも残る受入項目は PASS にしない。
- Automated commands:
- pnpm test
- pnpm --filter @kanjo/web lint
- Required evidence:
- docs/settings-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-settings-screen.md
- Architecture: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Feature: feat-settings-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SETTINGS-P06
