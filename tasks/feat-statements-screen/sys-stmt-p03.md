---
graph_node_id: "SYS-STMT-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "集計・保存・監査・URL の各契約の独立レビュー"
project_id: "feature-package-feat-statements-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["statements-screen", "p03", "design-review"]
file_path: "tasks/feat-statements-screen/sys-stmt-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b7b5463d81396f3733f71694ba174d935c886841941c232029b6574add8f6eb1", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-statements-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-19T12:35:04Z", "origin_kind": "system-dev-planner", "source_digest": "b7b5463d81396f3733f71694ba174d935c886841941c232029b6574add8f6eb1", "source_path": ".dev-graph/plans/feature-package-feat-statements-screen/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-19T12:35:04Z"
updated_at: '2026-09-19T12:47:42Z'
depends_on: ["SYS-STMT-P02"]
related_nodes: ["arch-statements-auth", "arch-statements-backend", "arch-statements-database", "arch-statements-frontend", "arch-statements-infrastructure", "arch-statements-maintenance-ops", "arch-statements-security", "arch-statements-ui-ux", "spec-statements-screen"]
resource_scope: ["docs/statements-screen.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-statements-screen"
feature_package_id: "feature-package/feat-statements-screen"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-statements-screen/sys-stmt-p03.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage:
  bd_issue_id: kanjo-oju.3
  linked_at: '2026-09-19T12:47:42Z'
  sync_state: synced
  github_mirror: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-19T12:22:08Z", "missing_sections": [], "status": "complete"}
---

# 集計・保存・監査・URL の各契約の独立レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-statements-screen
- owners: ["daishiman"]
- tags: ["statements-screen", "p03", "design-review"]
- related_nodes: ["arch-statements-auth", "arch-statements-backend", "arch-statements-database", "arch-statements-frontend", "arch-statements-infrastructure", "arch-statements-maintenance-ops", "arch-statements-security", "arch-statements-ui-ux", "spec-statements-screen"]
- parent_feature: feat-statements-screen
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-statements-screen/sys-stmt-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計決定を、仕様 §3 のデータ契約と §4 の下書きと §5 のセキュリティと §1.4 のページ内ナビに照らして独立にレビューし、食い違いを実装前に潰す。あわせて goal-spec の OI-02 として、system-spec/completeness-findings.json の severity=low の 6 件 (foundation_trace 1 件: I1 の『3 タブ』と G1 の『ページ内ナビ』の語の不一致、decision_guidance 1 件: 現金増減の表示が個別の決定を持たない、matrix_coverage 3 件: auth.web の主根拠の特定性・database/security/infrastructure の主根拠の共有・csv-chars-001 の basis と superseded の印、doc_freshness 1 件: react-router と vitest の記録版と依存版 v7/v4 の差) を 1 件ずつ実装への影響の有無で判定し、docs/statements-screen.md の『仕様 low findings の扱い』節に記録する。

## 背景

負債の保存は既存の authGuard・JSON Content-Type 検証・取込との直列化 (canonical-mutation-fence) を通したうえで、金額上限・本文上限・監査が加わる。監査に金額を残さないことと、下書きキーに userId を含めログアウトで消すことを設計段階で確かめないと、別利用者の下書きが同じ端末に残る。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Entry gate: staging run plan-feat-statements-screen-20260919 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- SYS-STMT-P02 の設計決定が記録されていること

## Workstream applicability

- Frontend: applicable: nav + aria-current の意味論、aria-pressed と aria-expanded の分担、URL の選択状態を確かめる
- Backend: applicable: 区分対応表 (外注工賃は販管費、期末棚卸は減算、未知科目は販管費) と前期比の定義を確かめる
- API: N/A: 本 phase は API の成果物を変更しない
- Data: N/A: 本 phase は Data の成果物を変更しない
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: applicable: PUT の zod strict・上限・bodyLimit・監査の金額非保持・CSV の数式注入対策を確かめる
- Quality: applicable: レビュー記録を docs に残す
- Documentation: applicable: 仕様 low findings 6 件の判定を docs/statements-screen.md に記録する
- Operations: N/A: 本 phase は Operations の成果物を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Deploy unit/environment: N/A: 文書のみで配信単位を持たない
- Compatibility/migration/backfill: N/A: 本 phase は migration を適用しない

## 成果物

- Produced artifacts:
- docs/statements-screen.md
- Consumed artifacts:
- specs/spec-statements-screen.md
- architecture/statements-security.md
- architecture/statements-auth.md
- system-spec/completeness-findings.json
- Write scope/touches:
- docs/statements-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-STMT-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-STMT-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-STMT-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-STMT-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (投資 CF と財務 CF の区分、区分対応表の利用者による上書き、下書きのサーバ保存、共通シェルの構造変更、既存 audit_log の action 拡張、他画面の作り直しと web 以外のプラットフォーム)
- コードとテストの変更
- system-spec/ の改訂 (low findings の修正は次の spec サイクルで任意に行い、本 phase は判定の記録だけを行う)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint
- grep -n '仕様 low findings の扱い' docs/statements-screen.md
- Required evidence:
- docs/statements-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: レビュー記録を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Feature: feat-statements-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-STMT-P02
