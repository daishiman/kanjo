---
graph_node_id: "SYS-CLASSIFY-BULK-P06"
artifact_kind: "task"
artifact_subtypes: []
title: "全テストと verify:full の実行: 緑の確認と、落ちたときの原因の切り分け"
project_id: "feature-package-feat-classify-bulk-save"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["classify-bulk-save", "p06", "test-run"]
file_path: "tasks/feat-classify-bulk-save/sys-classify-bulk-p06.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "601543e1e9b218f5bfd0154e5e887113b4621fa8bd5dac9543062d77e1bde286", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-classify-bulk-save/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T14:43:53Z", "origin_kind": "system-dev-planner", "source_digest": "601543e1e9b218f5bfd0154e5e887113b4621fa8bd5dac9543062d77e1bde286", "source_path": ".dev-graph/plans/feature-package-feat-classify-bulk-save/task-specs/phase-06-test-run.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T14:43:53Z"
updated_at: "2026-10-01T14:43:53Z"
depends_on: ["SYS-CLASSIFY-BULK-P05"]
related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
resource_scope: ["docs/classify-screen/bulk-save-evidence.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-classify-bulk-save"
feature_package_id: "feature-package/feat-classify-bulk-save"
phase_ref: "P06"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-classify-bulk-save/sys-classify-bulk-p06.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T14:41:20Z", "missing_sections": [], "status": "complete"}
---

# 全テストと verify:full の実行: 緑の確認と、落ちたときの原因の切り分け

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-classify-bulk-save
- owners: ["daishiman"]
- tags: ["classify-bulk-save", "p06", "test-run"]
- related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
- parent_feature: feat-classify-bulk-save
- phase_ref: P06
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-bulk-save/sys-classify-bulk-p06.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P05 の後で全体のテスト・型検査・lint・verify:full を手元で走らせ、緑であることを記録する。落ちたら原因を切り分け、緑にするために契約を緩めない。

## 背景

明細仕分けの画面検査は手元の verify:full で走り、CI では走らない (今の ci.yml は画面検査を走らせない)。verify:full は 4175 の vite を前提にし、api のテストは CI でランナーのばらつきにより cancelled になることがある。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save, SYS-CLASSIFY-BULK-P05
- Entry gate: staging run plan-feat-classify-bulk-save-20261001T1245Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-CLASSIFY-BULK-P05 が完了していること
- Source pin: system-spec-harness v0.1.16 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
制約: 4175 の vite を起動してから verify:full を走らせる。api のテストが cancelled になったら同じ commit で再実行し、再発したら timeout を上げずにテストを分割する。skip や契約の緩和で緑にしない。
制約: 落ちた原因が実装かテストにあれば本 task の中では直さず、原因と担当 phase (P04 か P05) を記録してその task を差し戻し、直った後に本 task をやり直す。
制約: bulk-save-decisions.md と bulk-save-evidence.md は P01 が置く節の担当表に従い、本 task の節だけを書く。他 phase の節は追記だけにして書き換えない (P03 が P02 の設計の節を訂正する場合を除く)。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Deploy unit/environment: N/A: 実行記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 実行記録のみで、DB・API・画面の互換に影響しない

## 成果物

- Produced artifacts:
- docs/classify-screen/bulk-save-evidence.md
- Consumed artifacts:
- docs/classify-screen/bulk-save-evidence.md
- package.json
- packages/web/scripts/check-financial-visuals.mjs
- packages/core/test/classify-bulk-resolve.test.ts
- packages/core/test/no-category-contract.test.ts
- packages/api/test/classify-bulk-save.integration.test.ts
- packages/api/test/classify-selected.integration.test.ts
- packages/api/test/tax-account-map.integration.test.ts
- packages/api/test/tax-account-map-migration.integration.test.ts
- Write scope/touches:
- docs/classify-screen/bulk-save-evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-BULK-P06 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-BULK-P06 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-BULK-P06 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-BULK-P05) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-classify-bulk-save.context.json の scope_out (選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更、要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更、分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更、絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作、取込 (CSV の読み込み) の仕様変更、証憑の添付と保管、モバイル・タブレット・デスクトップ専用アプリ、Workers Paid などの有料プランへの変更)
- feature の resource_scope の外にあるファイル (packages/api/wrangler.jsonc・.github/workflows/・packages/web/public/_headers・system-spec/ の章など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- pnpm test・pnpm typecheck・pnpm lint・pnpm run verify:full が手元で exit 0 で、各コマンドの実行日時と exit code が docs/classify-screen/bulk-save-evidence.md に記録されている。
- verify:full の中で check:classify-screen が走り、1264px と 1280px の結果が記録されている。
- 途中で落ちたテストがあれば原因と差し戻した phase が記録され、skip・only・契約の緩和で緑にしたものが 0 件である。
- CI が明細仕分けの画面検査を走らせないこと (OI-7) と、ci.yml へ足すことを別 feature の候補として返すことが docs/classify-screen/bulk-save-evidence.md に記録され、AC-22 は手元の verify:full の結果で確かめたと書かれている。
- Automated commands:
- pnpm test
- pnpm typecheck
- pnpm lint
- pnpm run verify:full
- Required evidence:
- docs/classify-screen/bulk-save-evidence.md

## Rollout and rollback

- Rollout: 本 feature は前サイクル (#75) と同じく 1 本の PR (feature PR) で main へ入れる。各 task の branch は直前の task の branch の先端から作り、完了時に feature PR の head branch (P01 が決めて記録する) を本 task の branch の先端へ fast-forward する。13 task の linked_pr_merged_all は P13 の merge 1 回で同時に満たされる。
- Rollback trigger and steps: 本 task のコミットを revert する。docs/classify-screen/bulk-save-evidence.md の追記を戻すだけで、コードと DB に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.16 出力)
- Screen specification: specs/spec-classify-bulk-save.md
- Architecture: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Feature: feat-classify-bulk-save
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-BULK-P05
