---
graph_node_id: "SYS-GUIDE-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "core 1 か所導出・API 写像・利用者分離・フッタ文言の独立設計レビュー"
project_id: "feature-package-feat-guide-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guide-screen", "p03", "design-review"]
file_path: "tasks/feat-guide-screen/sys-guide-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-guide-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-23T14:06:55Z", "origin_kind": "system-dev-planner", "source_digest": "9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62", "source_path": ".dev-graph/plans/feature-package-feat-guide-screen/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-23T14:06:55Z"
updated_at: "2026-09-23T14:33:58Z"
depends_on: ["SYS-GUIDE-P02"]
related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
resource_scope: ["docs/guide-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-guide-screen"
feature_package_id: "feature-package/feat-guide-screen"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-guide-screen/sys-guide-p03.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-ogz.3", "linked_at": "2026-09-23T14:33:58Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-23T13:50:09Z", "missing_sections": [], "status": "complete"}
---

# core 1 か所導出・API 写像・利用者分離・フッタ文言の独立設計レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-guide-screen
- owners: ["daishiman"]
- tags: ["guide-screen", "p03", "design-review"]
- related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
- parent_feature: feat-guide-screen
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-guide-screen/sys-guide-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計決定を、core 1 か所導出 (O3)・API の写像のみ・利用者分離 (O5)・既存画面の値不変の観点で独立にレビューし、指摘を解消または理由付きで持ち越す。

## 背景

使い方画面は既存の総収支・防衛ライン・信頼度の表示を読み替える画面であり、説明と計算がずれると判断ミスを招く。実装前に、新しい集計規則を足していないこと、防衛ラインと要確認の閾値の値が変わらないことを確かめる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen, SYS-GUIDE-P02
- Entry gate: staging run plan-feat-guide-screen-20260923T1350Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-GUIDE-P02 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: 総収支の 3 枚にどの既存関数を呼ぶかは agent 推定 (spec のビジネスルール『総収支』) であり、総収支画面の同じ期間の値と一致することをレビューで確認する。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: DB の表・列・migration を足さない (C2、qa-guide-database-web-002)。schema-guard.ts の EXPECTED_D1_MIGRATION は据え置き、既存行の書き換えと backfill は 0 件

## 成果物

- Produced artifacts:
- docs/guide-screen/design-decisions.md
- Consumed artifacts:
- docs/guide-screen/design-decisions.md
- specs/spec-guide-screen.md
- Write scope/touches:
- docs/guide-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-GUIDE-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-GUIDE-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-GUIDE-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-GUIDE-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-guide-screen.context.json の scope_out (利用規約・プライバシーの専用ページ、ガイド本文の管理画面や DB 保存、自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更、防衛ラインの算出変更、共通ヘッダの呼称変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、DB の表・列・migration の追加、モバイル・タブレット・デスクトップ専用アプリ、税務判断)
- feature の resource_scope の外にあるファイル (scripts/check-glossary.mjs・docs/data-schema.md・migrations など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- レビュー指摘が docs に列挙され、全件が解消済みか理由付きで持ち越されている。
- GET /api/guide が /api/* の authGuard と mustChangePasswordFence の内側にあり、loadScoped が c.get('userId') で絞った Dataset だけを読むことが確認されている。
- 総収支の 3 枚が振替除外の既存集計をそのまま使い、新しい集計規則を足していないことが確認されている。
- /summary・/diagnosis・/defense-line・/statements の応答と、防衛ラインを使う概況・予算・トレードオフ・ヘッダの値が変わらない設計であることが確認されている。
- 信頼度の段階の境界比較 (80 / 50) が段階関数以外に置かれない設計であり、Overview.tsx:209-210 の扱いが P01 の決定と一致していることが確認されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/guide-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-guide-screen.md
- Architecture: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Feature: feat-guide-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-GUIDE-P02
