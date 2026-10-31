---
graph_node_id: "SYS-SUBSMERGE-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "名寄せ・統合と取り消し・並行制御・選択と待ち行列の失敗テストの先行作成"
project_id: "feature-package-feat-subscriptions-merge"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["subscriptions-merge", "p04", "test-design"]
file_path: "tasks/feat-subscriptions-merge/sys-subsmerge-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "c7490d24a113ff369d24716501692dc5364f49a8b5d6aa7179e368a49d1a36d8", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-subscriptions-merge/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-30T15:37:43Z", "origin_kind": "system-dev-planner", "source_digest": "c7490d24a113ff369d24716501692dc5364f49a8b5d6aa7179e368a49d1a36d8", "source_path": ".dev-graph/plans/feature-package-feat-subscriptions-merge/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-30T15:37:43Z"
updated_at: "2026-09-30T15:37:43Z"
depends_on: ["SYS-SUBSMERGE-P03"]
related_nodes: ["arch-subscriptions-merge-auth", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops", "arch-subscriptions-merge-security", "arch-subscriptions-merge-ui-ux", "spec-subscriptions-merge"]
resource_scope: ["packages/core/test/subs-contract.test.ts", "packages/core/test/subs-screen-contract.test.ts", "packages/api/src/subs-screen.integration.test.ts", "packages/api/src/subs-merge-operations.integration.test.ts", "packages/api/src/subs-vendor-scope.test.ts", "packages/api/src/expense-projection.integration.test.ts", "packages/web/src/subscriptions-screen.dom.test.tsx", "docs/subscriptions-screen.md", "packages/core/src/subscription-operation.ts", "packages/api/src/subscription-restore-barrier.ts", "packages/core/src/types.ts"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-subscriptions-merge"
feature_package_id: "feature-package/feat-subscriptions-merge"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-subscriptions-merge/sys-subsmerge-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-c2t.4", "linked_at": "2026-09-30T15:51:55Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-30T15:19:39Z", "missing_sections": [], "status": "complete"}
---

# 名寄せ・統合と取り消し・並行制御・選択と待ち行列の失敗テストの先行作成

## Machine-readable registration fields

本 task の frontmatter が登録情報・依存・担当範囲・完了状態の唯一の正本。本文へ値を複製しない。frontmatter の resource_scope にある旧設計の候補パスは実装ファイルの存在を保証しない。現行の配置は spec「確定した実装契約」を参照する。

## 目的

AC-001〜023 をテストへ落とし、旧実装で失敗することを確かめる。

## 背景

前サイクルのテストは統合元が一覧に残る状態と 8 列の表を期待している。期待を先に書き換え、実装が要件を満たしたかをテストで判定できるようにする。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge, SYS-SUBSMERGE-P03
- Entry gate: staging run plan-feat-subscriptions-merge-20260930T1525Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-SUBSMERGE-P03 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json と利用者の例外承認 docs/evidence/subscriptions-merge/spec-evaluation-waiver.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: 前サイクルの DOM テストの列の期待 (8 列) を、先頭の行チェック列を含む形へ置き換える。
制約: デバッグ用のテストはリポジトリに置かない。空の test ファイルを作らない。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: N/A: 本 phase の責務に含まれない
- Data: applicable: 本 phase の副次責務として扱う
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: テストだけを足す。表と本体のコードは変えない

## 成果物

- Produced artifacts:
- packages/core/test/subs-contract.test.ts
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/api/src/subs-merge-operations.integration.test.ts
- packages/api/src/subs-vendor-scope.test.ts
- packages/api/src/expense-projection.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx
- docs/subscriptions-screen.md
- Consumed artifacts:
- docs/subscriptions-screen.md
- specs/spec-subscriptions-merge.md
- Write scope/touches:
- packages/core/test/subs-contract.test.ts
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/api/src/subs-merge-operations.integration.test.ts
- packages/api/src/subs-vendor-scope.test.ts
- packages/api/src/expense-projection.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx
- docs/subscriptions-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBSMERGE-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBSMERGE-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBSMERGE-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBSMERGE-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-subscriptions-merge.context.json の scope_out (他画面のデザインの作り直し、取込方式の変更、未照合明細の算入、AI による自動統合、Web 以外の専用アプリ、DO・Queues・新しい有料サービス・新しい夜間 job、楽観更新、取り消しの権限の分割)
- feature の resource_scope の外にあるファイル (package.json・packages/web/package.json・scripts 配下など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- core 契約テストが resolveVendorMerges (連鎖・循環・自己統合・参照先の無い id)・defaultMergeTarget・照合順 (科目で先に絞る) を検査し、旧実装で失敗する。
- api 統合テストが aquavoice 型の統合 (統合元が一覧から消え、月額が統合後の明細から再推定され、monthly_agg の subs 範囲が一致)・Idempotency-Key の再送・revision の衝突・同時 2 件で 500 が 0 件・取り消しの判定順・掃除・既存 9 本の revision を検査し、旧実装で失敗する。
- web DOM テストが行チェックと全選択 (mixed)・選択バー・統合先の既定・処理中の無効化・?vendor= の付け替え・操作状態の表示と文言・再試行ボタンを検査し、旧実装で失敗する。
- 旧実装で失敗した件数と代表の失敗メッセージが docs/subscriptions-screen.md に記録されている。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/subs-contract.test.ts
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/api/src/subs-merge-operations.integration.test.ts
- packages/api/src/subs-vendor-scope.test.ts
- packages/api/src/expense-projection.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加と書き換えを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-subscriptions-merge.md
- Architecture: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Feature: feat-subscriptions-merge
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SUBSMERGE-P03
