---
graph_node_id: "SYS-IMPSCR-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "improvement-screen 純関数・マスクの 2 境界・migration 0053・削除と復元・夜間消去・画面分割のワークストリーム設計決定記録"
project_id: "feature-package-feat-improvement-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["improvement", "p02", "preparation"]
file_path: "tasks/feat-improvement-screen/sys-impscr-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "976a9b89b575cd1d9a781fdd04237f7188cc0c2eb04daba7784139187fb2c144", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-improvement-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-23T14:14:59Z", "origin_kind": "system-dev-planner", "source_digest": "976a9b89b575cd1d9a781fdd04237f7188cc0c2eb04daba7784139187fb2c144", "source_path": ".dev-graph/plans/feature-package-feat-improvement-screen/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-23T14:14:59Z"
updated_at: "2026-09-23T14:14:59Z"
depends_on: ["SYS-IMPSCR-P01"]
related_nodes: ["arch-improvement-screen-auth", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-frontend", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops", "arch-improvement-screen-security", "arch-improvement-screen-ui-ux", "spec-improvement-screen"]
resource_scope: ["docs/improvement-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-improvement-screen"
feature_package_id: "feature-package/feat-improvement-screen"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-improvement-screen/sys-impscr-p02.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-23T14:07:26Z", "missing_sections": [], "status": "complete"}
---

# improvement-screen 純関数・マスクの 2 境界・migration 0053・削除と復元・夜間消去・画面分割のワークストリーム設計決定記録

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-improvement-screen
- owners: ["daishiman"]
- tags: ["improvement", "p02", "preparation"]
- related_nodes: ["arch-improvement-screen-auth", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-frontend", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops", "arch-improvement-screen-security", "arch-improvement-screen-ui-ux", "spec-improvement-screen"]
- parent_feature: feat-improvement-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-improvement-screen/sys-impscr-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core の improvement-screen の関数の入出力、マスクをブラウザとサーバで同じ規則にする経路、migration 0053 の張り替え手順、削除・復元と全読取経路の除外、夜間の完全消去の枠の回し方、pages/improvement/ の部品分割を決定記録にする。

## 背景

状態・概要・IMP 番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクを core 1 か所に寄せ、API と web は写すだけにする (G3)。0053 は状態の CHECK を張り替えるため表の作り直しを伴い、既存行・R2 の画像・トークンを失わない手順が要る。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen, SYS-IMPSCR-P01
- Entry gate: staging run plan-feat-improvement-screen-20260923T1404Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: pages/improvement/ の部品分割と URL の契約を決める
- Backend: applicable: 削除・復元・全読取経路の除外と夜間消去の設計を決める
- API: applicable: 一覧・詳細・作成・状態変更・再発行・削除・復元の応答を決める
- Data: applicable: 0053 の表の作り直しと連番・履歴の表を決める
- Infrastructure: N/A: 設計の記録のみ
- Security: applicable: マスクの 2 境界と辞書の渡し方を決める
- Quality: N/A: 設計の記録のみ
- Documentation: applicable: 決定記録を docs へ置く
- Operations: N/A: 設計の記録のみ

## Architecture and deploy unit

- Architecture decisions: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/improvement-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-improvement-screen.md
- architecture/improvement-screen-auth.md
- architecture/improvement-screen-backend.md
- architecture/improvement-screen-database.md
- architecture/improvement-screen-frontend.md
- architecture/improvement-screen-infrastructure.md
- architecture/improvement-screen-maintenance-ops.md
- architecture/improvement-screen-security.md
- architecture/improvement-screen-ui-ux.md
- Write scope/touches:
- docs/improvement-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPSCR-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPSCR-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPSCR-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPSCR-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) の変更。画像の文言は期待値にしない (U7)、改善を起点にした自動修正・自動 PR 作成と、外部の課題管理サービスへの連携 (2026-09-02 サイクルの範囲外を維持)、関連する依頼の手動紐付け。自動導出だけにする (qa-imp-decision-006)、複数利用者の間での依頼の共有と権限分離。単一利用者の運用を維持する、モバイル・タブレット・デスクトップ専用アプリ。狭い幅はレスポンシブ web で扱う (qa-imp-decision-005)、新しい Cron・新しい資格情報の種類・R2 のキーの形の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 状態の遷移・概要・IMP 番号・検索・件数タブ・ページング・関連する依頼・アクティビティ・診断要約の関数の入出力が決定記録にある。
- 0053 の手順 (表の作り直し・wontfix→完了の移し替えと理由の履歴・利用者ごとの連番の採番・件名の NULL 許容・論理削除の列・履歴の表) が既存行・R2 の画像・トークンを失わない順序で記されている。
- OI-03 (ブラウザ側の辞書マスク) と OI-05 (画面名の置き場所) の結論と、audit_header_retention の読み取りを 1 本減らして夜間予算 49 を保つ設計が記されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/improvement-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-improvement-screen.md
- Architecture: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen
- Feature: feat-improvement-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPSCR-P01
