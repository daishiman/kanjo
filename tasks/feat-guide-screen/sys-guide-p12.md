---
graph_node_id: "SYS-GUIDE-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "信頼度の段階・防衛ラインの説明・/api/guide・未決事項の docs 最終同期"
project_id: "feature-package-feat-guide-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guide-screen", "p12", "documentation-sync"]
file_path: "tasks/feat-guide-screen/sys-guide-p12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-guide-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-23T14:06:55Z", "origin_kind": "system-dev-planner", "source_digest": "9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62", "source_path": ".dev-graph/plans/feature-package-feat-guide-screen/task-specs/phase-12-documentation-operations.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-23T14:06:55Z"
updated_at: "2026-09-23T14:34:13Z"
depends_on: ["SYS-GUIDE-P11"]
related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
resource_scope: ["docs/guide-screen/design-decisions.md", "docs/guide-screen/evidence.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-guide-screen"
feature_package_id: "feature-package/feat-guide-screen"
phase_ref: "P12"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-guide-screen/sys-guide-p12.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-ogz.12", "linked_at": "2026-09-23T14:34:13Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-23T13:50:09Z", "missing_sections": [], "status": "complete"}
---

# 信頼度の段階・防衛ラインの説明・/api/guide・未決事項の docs 最終同期

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-guide-screen
- owners: ["daishiman"]
- tags: ["guide-screen", "p12", "documentation-sync"]
- related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
- parent_feature: feat-guide-screen
- phase_ref: P12
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-guide-screen/sys-guide-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

実装で確定した信頼度の段階・防衛ラインの説明の組み方・/api/guide の応答・フッタ文言・未決事項の採用値を docs/guide-screen/ へ最終同期する。

## 背景

設計判断の記録先は docs/guide-screen/ (新設) であり、feature の resource_scope の外にある文書 (docs/data-schema.md など) は本 feature では書き換えない。DB を変えないので data-schema の更新は不要である。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen, SYS-GUIDE-P11
- Entry gate: staging run plan-feat-guide-screen-20260923T1350Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-GUIDE-P11 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: arch-guide-maintenance-ops の resource_scope に docs/cash-screen と scripts/check-glossary.mjs が含まれているが、feature の resource_scope の外であり、本 task は docs/guide-screen 配下だけを書く。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: applicable: 本 phase の主責務として扱う
- Operations: applicable: 本 phase の副次責務として扱う

## Architecture and deploy unit

- Architecture decisions: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: DB の表・列・migration を足さない (C2、qa-guide-database-web-002)。schema-guard.ts の EXPECTED_D1_MIGRATION は据え置き、既存行の書き換えと backfill は 0 件

## 成果物

- Produced artifacts:
- docs/guide-screen/design-decisions.md
- docs/guide-screen/evidence.md
- Consumed artifacts:
- docs/guide-screen/design-decisions.md
- specs/spec-guide-screen.md
- Write scope/touches:
- docs/guide-screen/design-decisions.md
- docs/guide-screen/evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-GUIDE-P12 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-GUIDE-P12 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-GUIDE-P12 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-GUIDE-P11) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-guide-screen.context.json の scope_out (利用規約・プライバシーの専用ページ、ガイド本文の管理画面や DB 保存、自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更、防衛ラインの算出変更、共通ヘッダの呼称変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、DB の表・列・migration の追加、モバイル・タブレット・デスクトップ専用アプリ、税務判断)
- feature の resource_scope の外にあるファイル (scripts/check-glossary.mjs・docs/data-schema.md・migrations など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- docs/guide-screen/design-decisions.md に 信頼度を出す画面の最終的な列挙と色の扱い・段階関数と定数の名前・防衛ラインの算出定数と説明文の組み方・/api/guide の応答形・トピック id と URL の扱い・フッタ文言と 3 か所の補足が記されている。
- open_items 全件の最終的な採用値または対処、および confirmed ではない旨が docs に明記されている (本 task は値を新たに決めない)。
- DB の表・列・migration を足していないことと、巻き戻しがコードの revert だけで済むことが docs に記されている。
- Automated commands:
- pnpm lint
- pnpm test
- Required evidence:
- docs/guide-screen/design-decisions.md
- docs/guide-screen/evidence.md

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
- Dependencies: SYS-GUIDE-P11
