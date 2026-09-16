# System task overlay: 規則の docs 化と取消競合の runbook

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow-screen
- owners: ["daishiman"]
- tags: ["total-cashflow-screen", "p12", "documentation-operations"]
- related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
- parent_feature: feat-total-cashflow-screen
- phase_ref: P12
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-total-cashflow-screen/sys-tcscreen-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

一致度 (BR-001)・3 区分 (BR-002)・自動一致の候補 (BR-003)・前年同期比 (BR-006)・取消 (BR-008) の規則を利用者と保守者が読める docs にし、取消の 409 と 404 が出たときの確認手順を runbook にする。

## 背景

S5 は規則が docs に明記されることを求める。spec の未決事項には『前期比』と『前年同期比』の表記混在、security の適用文が 3 表のバックアップ保護に触れていない点が残っている。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Entry gate: SYS-TCSCREEN-P11 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Backend: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- API: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Data: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Infrastructure: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Security: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Quality: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Documentation: applicable: 規則 docs と runbook を作成し、表記を『前年同期比』に揃える
- Operations: applicable: 取消競合と復元後の古い id の確認手順を書く

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: GET /api/total-cashflow の既存フィールドと旧 reason body の受理を維持し、migration は追加のみとする (spec-total-cashflow-screen.md 互換性・移行・リリース節)

## 受入基準

- docs の規則の数値が packages/core/src/total-cashflow.ts の定数と一致する。
- 表記が『前年同期比』に統一され、3 表がバックアップで保護されることが明記されている。

## 成果物

- Produced artifacts:
- docs/total-cashflow-screen.md
- docs/runbooks/total-cashflow-undo-conflict.md
- Consumed artifacts:
- docs/total-cashflow-screen/evidence.md
- specs/spec-total-cashflow-screen.md
- Write scope/touches:
- docs/total-cashflow-screen.md
- docs/runbooks/total-cashflow-undo-conflict.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCSCREEN-P12 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TCSCREEN-P12 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TCSCREEN-P12 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TCSCREEN-P11) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更: 利用者指示により今回は確認のみ・照合・マトリクス・推移・診断の各タブの中身: それぞれの画面サイクルで扱う・日付と金額の一致による自動寄せの廃止: 利用者決定により自動寄せを維持する・freee / Money Forward の取込経路の追加と明細分割の仕様変更・期間選択の保存先の変更 (既存どおり localStorage で全画面共有)・mobile / tablet / desktop 向け専用アプリ: 対象は web のみ (狭幅は既存のレスポンシブ表示で扱う))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint (文書検査が緑のままであることを確認する)
- pnpm run runbooks:test
- Required evidence:
- docs/total-cashflow-screen.md
- docs/runbooks/total-cashflow-undo-conflict.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs と runbook の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Feature: feat-total-cashflow-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TCSCREEN-P11
