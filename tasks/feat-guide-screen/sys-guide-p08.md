---
graph_node_id: "SYS-GUIDE-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "旧 Guide.tsx・guide-sections.ts の参照と直書き定数 (信頼度 80/60・直近3か月) の残存の読取専用監査"
project_id: "feature-package-feat-guide-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guide-screen", "p08", "audit"]
file_path: "tasks/feat-guide-screen/sys-guide-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-guide-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-23T14:06:55Z", "origin_kind": "system-dev-planner", "source_digest": "9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62", "source_path": ".dev-graph/plans/feature-package-feat-guide-screen/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-23T14:06:55Z"
updated_at: "2026-09-23T14:34:07Z"
depends_on: ["SYS-GUIDE-P07"]
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
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-guide-screen/sys-guide-p08.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-ogz.8", "linked_at": "2026-09-23T14:34:07Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-23T13:50:09Z", "missing_sections": [], "status": "complete"}
---

# 旧 Guide.tsx・guide-sections.ts の参照と直書き定数 (信頼度 80/60・直近3か月) の残存の読取専用監査

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-guide-screen
- owners: ["daishiman"]
- tags: ["guide-screen", "p08", "audit"]
- related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
- parent_feature: feat-guide-screen
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-guide-screen/sys-guide-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

旧実装への参照と、core の 1 か所へ寄せたはずの定数・導出の直書きが残っていないことを読み取り専用で監査する。

## 背景

移設後も web や api に信頼度の境界比較や『直近3か月』の直書き、ガイド本文の複製が残ると、説明と計算が再びずれる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen, SYS-GUIDE-P07
- Entry gate: staging run plan-feat-guide-screen-20260923T1350Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-GUIDE-P07 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: 診断・AI 画面の『確度』を P01 で対象外にした場合、それらの高/中/低の列挙は本監査の違反に数えない (P01 の決定を基準にする)。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Deploy unit/environment: N/A: 読取専用監査のみ
- Compatibility/migration/backfill: DB の表・列・migration を足さない (C2、qa-guide-database-web-002)。schema-guard.ts の EXPECTED_D1_MIGRATION は据え置き、既存行の書き換えと backfill は 0 件

## 成果物

- Produced artifacts:
- docs/guide-screen/design-decisions.md
- Consumed artifacts:
- docs/guide-screen/design-decisions.md
- Write scope/touches:
- docs/guide-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-GUIDE-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-GUIDE-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-GUIDE-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-GUIDE-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-guide-screen.context.json の scope_out (利用規約・プライバシーの専用ページ、ガイド本文の管理画面や DB 保存、自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更、防衛ラインの算出変更、共通ヘッダの呼称変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、DB の表・列・migration の追加、モバイル・タブレット・デスクトップ専用アプリ、税務判断)
- feature の resource_scope の外にあるファイル (scripts/check-glossary.mjs・docs/data-schema.md・migrations など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/web/src/pages/Guide.tsx が再輸出 1 行だけであり、旧実装と guide-sections.ts の現在値合成への参照が repository 内で 0 件である。
- 信頼度の境界比較 (80 / 50、および旧 60) が段階関数以外の web と api に 0 件である (Overview.tsx:209-210 を含む。P01 で据え置きと決めた場合はその記録と一致する)。
- 『直近3か月』『直近3ヶ月』『slice(-3)』の直書きが、防衛ラインの算出定数とそれを使う説明文以外に 0 件である。
- REVIEW_CONFIDENCE_THRESHOLD の値が 80 のまま、migrations と packages/api/src/db/schema.ts の差分が 0 件である。
- P06 / P07 の証跡が最終コードに対応し、既知逸脱・未実施・一部適合が PASS に含まれていない。
- Automated commands:
- rg による旧 pages/Guide.tsx 参照と直書き定数の検査
- P06 / P07 の証跡と git diff の照合
- Required evidence:
- docs/guide-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 監査記録に誤りがあれば docs の追記だけを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-guide-screen.md
- Architecture: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Feature: feat-guide-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-GUIDE-P07
