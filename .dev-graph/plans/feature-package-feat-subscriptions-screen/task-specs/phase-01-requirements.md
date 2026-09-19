# System task overlay: 要件ベースライン確定と暫定 U 項目の着手時整理

## Machine-readable registration fields

- feature_package_id: feature-package/feat-subscriptions-screen
- owners: ["daishiman"]
- tags: ["subscriptions-screen", "p01", "requirements"]
- related_nodes: ["arch-subscriptions-auth", "arch-subscriptions-backend", "arch-subscriptions-database", "arch-subscriptions-frontend", "arch-subscriptions-infrastructure", "arch-subscriptions-maintenance-ops", "arch-subscriptions-security", "arch-subscriptions-ui-ux", "spec-subscriptions-screen"]
- parent_feature: feat-subscriptions-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-subscriptions-screen/sys-subs-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

仕様 15.1 節の受入 19 項目と 15.4 節の U-1 から U-15 と設計決定 D1 から D13 を、以降 12 phase が参照する単一の要件表として docs/subscriptions-screen.md に確定する。

## 背景

サブスク画面は KPI 5 枚・カバー率・一覧・詳細パネル・推移・年換算比較・検出理由カード・選択中バーを持ち、既存画面は SubVendorsPanel と SubsCandidatesPanel と前年比較表に操作が分散している。どの要件がどの成果物へ落ちるかの対応表が無いまま実装に入ると、旧 UI の操作が抜け落ちる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Entry gate: staging run plan-feat-subscriptions-screen-20260918 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- specs/spec-subscriptions-screen.md が confirmed であること
- architecture/subscriptions-*.md の 8 本が confirmed であること

## Workstream applicability

- Frontend: N/A: 本 phase は Frontend の成果物を変更しない
- Backend: N/A: 本 phase は Backend の成果物を変更しない
- API: N/A: 本 phase は API の成果物を変更しない
- Data: N/A: 本 phase は Data の成果物を変更しない
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: N/A: 本 phase は Security の成果物を変更しない
- Quality: applicable: 受入 19 項目それぞれに検証手段を 1 つ以上割り当てる
- Documentation: applicable: docs/subscriptions-screen.md を新設し要件表を書く
- Operations: N/A: 本 phase は Operations の成果物を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Deploy unit/environment: N/A: 文書のみで配信単位を持たない
- Compatibility/migration/backfill: N/A: 本 phase は migration を適用しない

## 成果物

- Produced artifacts:
- docs/subscriptions-screen.md
- Consumed artifacts:
- specs/spec-subscriptions-screen.md
- features/feat-subscriptions-screen.md
- Write scope/touches:
- docs/subscriptions-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBS-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBS-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBS-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (ロゴ画像の取得と表示、外部サービスと生成 AI による分類と理由文、共通シェルの構造変更、他画面の中身の作り直し、行チェックによる一括操作、web 以外のプラットフォーム)
- 規則と閾値の数値確定 (P04 が境界値テストで固定する)
- コードの変更
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- test -f docs/subscriptions-screen.md
- pnpm lint
- Required evidence:
- docs/subscriptions-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/subscriptions-screen.md の追記を revert する。コードと D1 に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-subscriptions-auth, arch-subscriptions-backend, arch-subscriptions-database, arch-subscriptions-frontend, arch-subscriptions-infrastructure, arch-subscriptions-maintenance-ops, arch-subscriptions-security, arch-subscriptions-ui-ux, spec-subscriptions-screen
- Feature: feat-subscriptions-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし (本 feature の起点 phase)
