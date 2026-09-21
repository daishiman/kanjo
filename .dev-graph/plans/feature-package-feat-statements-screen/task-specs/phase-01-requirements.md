# System task overlay: 要件ベースライン確定と受入 O1-O5・S1-S5 の対応表

## Machine-readable registration fields

- feature_package_id: feature-package/feat-statements-screen
- owners: ["daishiman"]
- tags: ["statements-screen", "p01", "requirements"]
- related_nodes: ["arch-statements-auth", "arch-statements-backend", "arch-statements-database", "arch-statements-frontend", "arch-statements-infrastructure", "arch-statements-maintenance-ops", "arch-statements-security", "arch-statements-ui-ux", "spec-statements-screen"]
- parent_feature: feat-statements-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-statements-screen/sys-stmt-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

仕様 §7 の受入 (DOM・core・API・既存テスト・docs) と feature の S1-S5、§8 の画像との意図的な差 6 件を、以降 12 phase が参照する単一の要件表として docs/statements-screen.md に確定する。

## 背景

決算書画面は KPI 4 枚・ページ内ナビ・PL カードと詳細パネル・月別推移・月次 PL 表・CF・BS と負債入力・未保存バーを持ち、現行 Statements.tsx は PL/CF/BS を別々の算出で描いている。どの受入がどの成果物と検証手段へ落ちるかを先に決めないと、負債の 3 状態や CF 不能の原因件数のような境界の要件が実装から漏れる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Entry gate: staging run plan-feat-statements-screen-20260919 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- specs/spec-statements-screen.md が confirmed であること
- architecture/statements-*.md の 8 本が confirmed であること

## Workstream applicability

- Frontend: N/A: 本 phase は Frontend の成果物を変更しない
- Backend: N/A: 本 phase は Backend の成果物を変更しない
- API: N/A: 本 phase は API の成果物を変更しない
- Data: N/A: 本 phase は Data の成果物を変更しない
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: N/A: 本 phase は Security の成果物を変更しない
- Quality: applicable: 受入の各項目に検証手段 (core 契約テスト・API テスト・DOM テスト・実画面) を 1 つ以上割り当てる
- Documentation: applicable: docs/statements-screen.md を新設し要件表を書く
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
- features/feat-statements-screen.md
- Write scope/touches:
- docs/statements-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-STMT-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-STMT-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-STMT-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (投資 CF と財務 CF の区分、区分対応表の利用者による上書き、下書きのサーバ保存、共通シェルの構造変更、既存 audit_log の action 拡張、他画面の作り直しと web 以外のプラットフォーム)
- 数値の確定 (仕様 §6 の検算済みフィクスチャを P04 がテストで固定する)
- コードの変更
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- test -f docs/statements-screen.md
- pnpm lint
- Required evidence:
- docs/statements-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/statements-screen.md の追記を revert する。コードと D1 に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Feature: feat-statements-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし (本 feature の起点 phase)
