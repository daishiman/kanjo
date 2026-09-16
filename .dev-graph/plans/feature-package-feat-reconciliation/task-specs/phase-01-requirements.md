# System task overlay: 要件ベースライン確定と未決事項7件の着手時整理

## Machine-readable registration fields

- feature_package_id: feature-package/feat-reconciliation
- owners: ["daishiman"]
- tags: ["reconciliation", "p01", "requirements"]
- related_nodes: ["arch-reconciliation-auth", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-frontend", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops", "arch-reconciliation-security", "arch-reconciliation-ui-ux", "spec-reconciliation"]
- parent_feature: feat-reconciliation
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-reconciliation/sys-recon-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

specs/spec-reconciliation.md の FR/BR/API契約/AC/確定意思決定が docs/reconciliation/requirements-baseline.md へ転記され、未決事項7件が値を確定せずに一覧化され、それぞれの契約テスト確定先 task が記録された状態にする。

## 背景

specs/spec-reconciliation.md は system-spec-harness v0.1.14 の system-spec/backend.md 等を dev-graph の specification として参照する入口であり、規範本文は system-spec 側が正本である。goal-spec.json の open_items 7件は全て disposition が『実装 task の契約テストで確定する』であり、P01 では値を仮置きせず、確定予定の task を明示するだけにとどめる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Entry gate: staging run sdp-feat-reconciliation-20260915T1102Z のgoal-spec.jsonがreadiness_pin.status=completeであること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本taskは文書転記のみでUIコードを変更しない
- Backend: N/A: 本taskはAPI/coreコードを変更しない
- API: N/A: 契約は確定済みの spec-reconciliation.md API契約節を転記するのみで新規定義しない
- Data: N/A: D1テーブル定義には触れない (P02で決定記録する)
- Infrastructure: N/A: 配信構成に変更なし
- Security: N/A: セキュリティ制御に変更なし
- Quality: applicable: 文書検査 (check-glossary.mjs等) がpnpm lintの対象として通ることを確認する
- Documentation: applicable: docs/reconciliation/requirements-baseline.md を新設する
- Operations: N/A: 運用手順はP12/P13の責務

## Architecture and deploy unit

- Architecture decisions: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本taskはコードのマイグレーションを直接実行しない

## 成果物

- Produced artifacts:
- docs/reconciliation/requirements-baseline.md
- Consumed artifacts:
- specs/spec-reconciliation.md
- system-spec/00-requirements-definition.md
- system-spec/completeness-findings.json
- Write scope/touches:
- docs/reconciliation/requirements-baseline.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-RECON-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-RECON-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-RECON-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (無し (先頭 task)) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (総収支・マトリクス・推移・診断タブ中身の作り直し、他画面の中身の作り直し、freee/MoneyForwardへの書き戻し、外部送信、利用規約等の本文新規作成、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint (既存の check-glossary.mjs 等の文書検査が緑のままであることを確認する)
- Required evidence:
- docs/reconciliation/requirements-baseline.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/reconciliation/requirements-baseline.md の追加コミットを revert する。他ファイルへの書込みがないため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Feature: feat-reconciliation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: 無し (先頭 task)
