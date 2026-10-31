---
graph_node_id: "SYS-SETTINGS-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "要件ベースライン確定と未決事項 19 件の着手時整理"
project_id: "feature-package-feat-settings-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["settings-screen", "p01", "preparation"]
file_path: "tasks/feat-settings-screen/sys-settings-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "77f7061b14dcbfea15f2ac0317596681a94f2b6b509fe6e4b94d53b7d987f5fa", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-settings-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-22T11:15:01Z", "origin_kind": "system-dev-planner", "source_digest": "77f7061b14dcbfea15f2ac0317596681a94f2b6b509fe6e4b94d53b7d987f5fa", "source_path": ".dev-graph/plans/feature-package-feat-settings-screen/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-22T11:15:01Z"
updated_at: "2026-09-22T11:15:01Z"
depends_on: []
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
phase_ref: "P01"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-settings-screen/sys-settings-p01.md", "confidence": 0.95}]
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

# 要件ベースライン確定と未決事項 19 件の着手時整理

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-settings-screen
- owners: ["daishiman"]
- tags: ["settings-screen", "p01", "preparation"]
- related_nodes: ["arch-settings-auth", "arch-settings-backend", "arch-settings-database", "arch-settings-frontend", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-security", "arch-settings-ui-ux", "spec-settings-screen"]
- parent_feature: feat-settings-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-settings-screen/sys-settings-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

settings 画面の要件ベースラインを確定し、goal-spec.json の open_items 19 件 (Q-1〜Q-12・R-1〜R-7) を着手時に整理して、後続 phase の resolution_owner を明確にする。

## 背景

/settings は 18-settings.png の全構成要素と節ナビ 8 項目を core の settingsScreen 1 か所から導く画面であり、集計ルールの適用順・現金上書きの意味・設定 JSON の形式を core の純関数に固定する必要がある。specs/spec-settings-screen.md の未決事項・実装時に要確認は本書を正本として実装時に解決する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Entry gate: staging run plan-feat-settings-screen-20260922T1041Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: Q-1〜Q-12 (名義 API の統合可否、旧書込み経路との同期、名義 4 欄の並び・例文、現金上書きの月額解釈、取引先ルールの照合範囲、旧 NightlyBackups の全データ復元の扱い、最新行の復元ボタンの有効化、レポート出力文言、旧形式バックアップの読み方、夜間バックアップの JST 日付化、変更履歴の表示場所、その他の agent 推定値群) は agent 推定・利用者未確認のまま docs へ転記し、resolution_owner task へ引き継ぐ。
Blocker: R-1〜R-7 (cash_overrides の空欄 0 潰れ、account_norm_map の二重正本、バックアップ日付の UTC/JST ずれ、保持削除の先頭 10 文字比較、.failed.json の一覧重複、toCsv の式注入無害化、backup-restore.dom.test.tsx と decision-010 の衝突) は実装 (SYS-SETTINGS-P05) で具体的な対処が必須であることを docs に明記する。
migration 番号 0051〜0053 は予定番号であり、着手時に origin/main の最新番号と突き合わせる旨を docs に明記する。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: applicable: 本 phase の主責務として扱う
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
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
- PR body contract: dev-graph graph_node_id SYS-SETTINGS-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SETTINGS-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SETTINGS-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし (先頭 phase)) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-settings-screen.context.json の scope_out (取引データの復元形式変更、既存の仕分けルール・ベンダー記憶の意味変更、共通シェルの作り直し、外部 LLM・外部サービスへの送信、複数テナント化・web 以外の専用アプリ、バックアップ保持期間 30 日の変更、バックアップからの全データ復元、既存 API の削除、既存表 account_norm_map・cash_overrides の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S5 と AT-01〜AT-22 が検証可能な文として docs に列挙され、各文に対応する spec の節番号が付いている。
- goal-spec.json の open_items 19 件 (Q-1〜Q-12・R-1〜R-7) が docs に原文の意味を保って転記され、それぞれの resolution_owner task (主に SYS-SETTINGS-P02〜P05、migration 番号は SYS-SETTINGS-P05 と SYS-SETTINGS-P13) が明記されている。Q 系は Open risk (agent 推定・利用者未確認)、R 系は Blocker (既存実装との具体的な食い違い) として区分されている。
- スコープ外 (取引データの復元形式変更、仕分けルール/ベンダー記憶の意味変更、共通シェルの作り直し、外部 LLM・外部送信、複数テナント化・専用アプリ、バックアップ保持期間変更、バックアップからの全データ復元、既存 API の削除、既存表 account_norm_map・cash_overrides の削除・書き換え) が docs に明記されている。
- readiness_pin.source_pin.source_digest と specs/spec-settings-screen.md の source_lineage.source_digest の測定時点差異 (agent 未再計算) が事実として docs に記録され、fail-closed の対象にしていない。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/settings-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-settings-screen.md
- Architecture: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Feature: feat-settings-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし (先頭 phase)
