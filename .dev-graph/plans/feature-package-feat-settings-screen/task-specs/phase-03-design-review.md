# System task overlay: 算出契約・API 契約・migration 契約・変更フェンス整合の独立レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-settings-screen
- owners: ["daishiman"]
- tags: ["settings-screen", "p03", "design-review"]
- related_nodes: ["arch-settings-auth", "arch-settings-backend", "arch-settings-database", "arch-settings-frontend", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-security", "arch-settings-ui-ux", "spec-settings-screen"]
- parent_feature: feat-settings-screen
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-settings-screen/sys-settings-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

算出契約・API 契約・migration 契約・変更フェンス整合を独立レビューし、未決事項の持ち越し方針を確定する。

## 背景

P02 の設計が spec の BR-01〜BR-31・API 契約・migration 契約と矛盾しないかを、実装着手前に第三者視点で検証する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Entry gate: staging run plan-feat-settings-screen-20260922T1041Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: Q-1・Q-2 は未決のまま実装へ渡され、agent 推定値として実装し DOM/API テストで表現を変えられる前提であることをレビュー結果として明記する。
Blocker: R-1・R-2・R-6 の 3 件は実装 (P05) での具体的対処が必須であることをレビューで確認し、対処方針が設計 (P02) に含まれているかを検証する。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: applicable: 本 phase の副次責務として扱う
- API: N/A: 本 phase の責務に含まれない
- Data: applicable: 本 phase の副次責務として扱う
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: migration 0051-0053 は追加のみ。既存 account_norm_map・cash_overrides・settings 表への書き換えと backfill は 0 件。番号は実装時と release 時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- docs/settings-screen/design-decisions.md
- Consumed artifacts:
- docs/settings-screen/design-decisions.md
- specs/spec-settings-screen.md
- Write scope/touches:
- docs/settings-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SETTINGS-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SETTINGS-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SETTINGS-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SETTINGS-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-settings-screen.context.json の scope_out (取引データの復元形式変更、既存の仕分けルール・ベンダー記憶の意味変更、共通シェルの作り直し、外部 LLM・外部サービスへの送信、複数テナント化・web 以外の専用アプリ、バックアップ保持期間 30 日の変更、バックアップからの全データ復元、既存 API の削除、既存表 account_norm_map・cash_overrides の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- レビュー指摘が docs に列挙され、全件が解消済みか理由付きで持ち越されている。
- PUT /api/settings/screen・POST /api/settings/restore・POST /api/backups/:date/restore が canonicalMutationFence の内側にあり、GET/preview 系がフェンス対象外であることが確認されている。
- Q-1 (名義 API を PUT /api/settings/screen の 1 回の保存へ統合するか既存 owner-labels API と分離するか)・Q-2 (旧 PUT の互換維持と新表・revision の同期方式) が未決のまま実装へ渡され、agent 推定 (本書は 1 回保存へ統合し、旧経路は互換のため残す) の値として実装する前提であることがレビュー結果として明記されている。
- R-1 (cash_overrides の空欄 0 潰れ)・R-2 (account_norm_map の二重正本)・R-6 (toCsv の式注入無害化が既存 CSV テストに与える影響) の 3 件について、実装 (P05) で具体的な対処が必須である Blocker として引き継がれている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/settings-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-settings-screen.md
- Architecture: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Feature: feat-settings-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SETTINGS-P02
