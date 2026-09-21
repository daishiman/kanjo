# System task overlay: 分類ステータス契約・API 契約・migration 契約・URL 契約の独立レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-screen
- owners: ["daishiman"]
- tags: ["classify-screen", "p03", "design-review"]
- related_nodes: ["arch-classify-auth", "arch-classify-backend", "arch-classify-database", "arch-classify-frontend", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-security", "arch-classify-ui-ux", "spec-classify-screen"]
- parent_feature: feat-classify-screen
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-screen/sys-classify-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計決定を、実装着手前に独立した観点でレビューし、指摘事項と持ち越し事項を記録する。

## 背景

classifyStatus の 3 区分排他規則と Q-1（vendor_memory 分岐）は、実装を確定する前に契約として固まっている必要がある。canonicalMutationFence への新規ルート登録漏れは既知のリスク（architecture/classify-security.md）であり、レビューで確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Entry gate: staging run run-feat-classify-screen-20260919T142500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: Q-1（BR-01(d) の vendor_memory 由来の手当てを完了とするか手動変更とするか）が未解決のままレビューへ進む。レビューはこの分岐を『未確定のまま実装へ進めない』前提で扱う。

## Workstream applicability

- Frontend: N/A: レビューのみ
- Backend: applicable: classifyStatus・6 API の契約をレビューする
- API: applicable: 6 API の zod 許可リストと応答形をレビューする
- Data: N/A: migration の SQL は P05 で作成するためレビュー対象は方針のみ
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: canonicalMutationFence 登録対象ルートをレビューする
- Quality: applicable: レビュー指摘の解消状況を記録する
- Documentation: applicable: レビュー結果を docs へ記録する
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/classify-screen/design-decisions.md
- Consumed artifacts:
- docs/classify-screen/design-decisions.md
- specs/spec-classify-screen.md
- Write scope/touches:
- docs/classify-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (証憑の再導入、外部 LLM 呼び出し、共通シェルの作り直し、照合画面の変更、専用アプリ、画像ヘッダーの文言変更、AI分析/改善リクエスト項目の追加)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- レビュー指摘が docs に列挙され、全件が解消済みか理由付きで持ち越されている。
- Q-1 の未解決分岐が実装へ進めないブロッカーとしてレビュー結果に明記されている。
- POST /api/transactions/bulk・POST /api/rules/:id/apply・POST / DELETE /api/saved-filters が canonicalMutationFence の内側にあることが確認され、POST /api/rules/preview は読取りのみでフェンス登録しないことが確認されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/classify-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-classify-screen.md
- Architecture: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Feature: feat-classify-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-P02
