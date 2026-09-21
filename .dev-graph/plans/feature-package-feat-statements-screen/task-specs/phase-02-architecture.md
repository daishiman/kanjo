# System task overlay: statementsScreen・API 2 経路・migration 0045・部品分割の設計決定の記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-statements-screen
- owners: ["daishiman"]
- tags: ["statements-screen", "p02", "architecture"]
- related_nodes: ["arch-statements-auth", "arch-statements-backend", "arch-statements-database", "arch-statements-frontend", "arch-statements-infrastructure", "arch-statements-maintenance-ops", "arch-statements-security", "arch-statements-ui-ux", "spec-statements-screen"]
- parent_feature: feat-statements-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-statements-screen/sys-stmt-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core statementsScreen の入出力型と区分の固定対応表、GET /api/statements の screen 追加と ref の丸め、PUT /api/balances/liabilities の項目単位 upsert、migration 0045 の列と表、pages/statements/ の部品分割と下書きフックの置き場を実装可能な粒度で記録する。

## 背景

数値・CF 不能の原因件数・BS の完了判定を core の純関数 1 か所で算出し、API はそれを返すだけ、画面は描くだけにする。現行 PUT は月の手入力負債を全削除して挿入しており、1 項目だけ直すと他項目が消える。この境界と upsert の意味を先に文書へ固定する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Entry gate: staging run plan-feat-statements-screen-20260919 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- SYS-STMT-P01 の要件表が確定していること

## Workstream applicability

- Frontend: applicable: pages/statements/ の部品分割、URL (?tab・?row・?ref) と usePeriod の引継ぎ、下書きフックを決める
- Backend: applicable: statementsScreen(input) の返り値型・固定対応表・恒等式・CF 不能判定・BS 3 状態を決める
- API: applicable: GET の screen と ref、PUT の本文形・上限・応答 bs・監査 1 件・invalidate 対象を決める
- Data: applicable: balance_entries.status と liability_audit_log の列、削除 / 全消去の対象表への追加を決める
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: N/A: 本 phase は Security の成果物を変更しない
- Quality: N/A: 本 phase は Quality の成果物を変更しない
- Documentation: N/A: 本 phase は Documentation の成果物を変更しない
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
- architecture/statements-backend.md
- architecture/statements-frontend.md
- architecture/statements-database.md
- Write scope/touches:
- docs/statements-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-STMT-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-STMT-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-STMT-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-STMT-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (投資 CF と財務 CF の区分、区分対応表の利用者による上書き、下書きのサーバ保存、共通シェルの構造変更、既存 audit_log の action 拡張、他画面の作り直しと web 以外のプラットフォーム)
- コードの変更 (P05 が行う)
- 設計の独立レビュー (P03 が行う)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint
- Required evidence:
- docs/statements-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/statements-screen.md の設計節を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Feature: feat-statements-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-STMT-P01
