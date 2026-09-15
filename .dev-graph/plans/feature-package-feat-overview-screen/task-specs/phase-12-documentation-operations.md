# System task overlay: docs/runbooks への切り分け手順とAPI文書の同期

## Machine-readable registration fields

- feature_package_id: feature-package/feat-overview-screen
- owners: ["daishiman"]
- tags: ["overview-screen", "p12", "documentation-operations"]
- related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
- parent_feature: feat-overview-screen
- phase_ref: P12
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-overview-screen/sys-overview-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

件数ずれ等の切り分け手順と概況機能のドキュメントを、既存のdocs/runbooks構成に合わせて同期する。

## 背景

spec-overview-screen.mdの非機能要件 (Maintainability) は「検査はcore/DOM/API/描画の4系統に置き、件数ずれの切り分け手順をdocsに残す」ことを要求する。既存のdocs/runbooks/account-login-operations.mdと同型の運用文書を新設する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Entry gate: SYS-OVERVIEW-P11が完了し、evidence.mdの索引が確定していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: フロントエンドコードは変更しない
- Backend: N/A: バックエンドコードは変更しない
- API: N/A: APIコードは変更しない
- Data: N/A: データモデルは変更しない
- Infrastructure: N/A: 配信構成は変更しない
- Security: N/A: セキュリティ制御は変更しない
- Quality: applicable: pnpm lintの文書検査対象に新規文書を含める
- Documentation: applicable: docs/overview-screen.mdとdocs/runbooks/overview-review-queue-mismatch.mdを新設する
- Operations: applicable: 未処理件数がバッジ・カード・アクションバーでずれた場合の切り分け手順を記録する

## Architecture and deploy unit

- Architecture decisions: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 既存文書は変更せず新規文書を追加するのみ

## 成果物

- Produced artifacts:
- docs/overview-screen.md
- docs/runbooks/overview-review-queue-mismatch.md
- Consumed artifacts:
- docs/overview-screen/evidence.md
- docs/runbooks/account-login-operations.md
- Write scope/touches:
- docs/overview-screen.md
- docs/runbooks/overview-review-queue-mismatch.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-OVERVIEW-P12 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-OVERVIEW-P12 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-OVERVIEW-P12 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-OVERVIEW-P11) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (専用アプリ・AI/LLMによる推定・分類アルゴリズムの変更・概況以外の19画面の作り替え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint (check-glossary.mjs 等の文書検査が緑のままであることを確認する)
- Required evidence:
- docs/overview-screen.md
- docs/runbooks/overview-review-queue-mismatch.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/overview-screen.mdとdocs/runbooks/overview-review-queue-mismatch.mdの追加コミットをrevertする。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Feature: feat-overview-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-OVERVIEW-P11
