# System task overlay: settingsScreen・取引先ルール照合/適用・現金上書き解決・10 API・migration 0051-0053 のワークストリーム設計決定記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-settings-screen
- owners: ["daishiman"]
- tags: ["settings-screen", "p02", "preparation"]
- related_nodes: ["arch-settings-auth", "arch-settings-backend", "arch-settings-database", "arch-settings-frontend", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-security", "arch-settings-ui-ux", "spec-settings-screen"]
- parent_feature: feat-settings-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-settings-screen/sys-settings-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

settingsScreen・取引先ルール照合/適用・現金上書き解決・10 API・migration 0051-0053 のワークストリーム設計を決定し docs に記録する。

## 背景

core に settingsScreen (画面の算出)・norm-rules (取引先ルールの照合と適用)・cash (現金上書きの解決)・settings-json (設定 JSON の検証と差分) を新設し、設定系の新しい書込み API を変更系フェンスへ登録する設計を固める。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Entry gate: staging run plan-feat-settings-screen-20260922T1041Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: Q-1 (名義の保存経路を PUT /api/settings/screen へ 1 回で統合するか、既存 owner-labels API と分離するか) は agent 推定 (統合) で設計するが未決のまま進める。
Open risk: Q-2 (旧 PUT /api/settings・PUT /api/settings/owner-labels・POST /api/restore と新表・revision の同期方式) は agent 推定 (同じ意味で書き revision を進める) で設計するが未決のまま進める。
Blocker: R-2 (account_norm_map の二重正本) の解消方式を本 phase で設計として固め、実装 (P05) で対処する。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: applicable: 本 phase の副次責務として扱う
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: applicable: 本 phase の主責務として扱う
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
- PR body contract: dev-graph graph_node_id SYS-SETTINGS-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SETTINGS-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SETTINGS-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SETTINGS-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-settings-screen.context.json の scope_out (取引データの復元形式変更、既存の仕分けルール・ベンダー記憶の意味変更、共通シェルの作り直し、外部 LLM・外部サービスへの送信、複数テナント化・web 以外の専用アプリ、バックアップ保持期間 30 日の変更、バックアップからの全データ復元、既存 API の削除、既存表 account_norm_map・cash_overrides の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/core/src/settings-screen.ts (新設) の settingsScreen の入出力と BR-01〜BR-31 の算出規則、norm-rules.ts (新設) の取引先ルール照合キー (NFKC→lowercase→trim) と適用順 (手動編集 > 仕分けルール > 集計ルール(取引先) > 自動分類)、cash.ts の現金上書き解決 (resolveCashOverride: null=上書きしない/0=0円で上書き) が docs に書かれている。
- 10 API (GET/PUT /api/settings/screen, GET /api/settings/history, GET /api/settings/export, POST /api/settings/restore/preview, POST /api/settings/restore, GET /api/backups, GET /api/backups/:date/compare, POST /api/backups/:date/restore/preview, POST /api/backups/:date/restore) の応答形・zod 許可リストが spec の API 契約と一致している。
- migration 0051_settings_norm_rules.sql・0052_settings_cash_overrides.sql・0053_settings_change_log.sql (いずれも追加のみ) の設計と、番号が予定番号であり着手時に origin/main と突き合わせる旨が docs に明記されている。
- 既存 account_norm_map・cash_overrides 表を初回の写しの元として読むだけに留め、削除・書き換えをしない設計 (Q-2/Q-4/R-1/R-2 関連) が docs に明記されている。
- 変更履歴 (append-only) と revision = max(changed_at) の算出規則、baseSavedAt による 409 判定 (BR-22) の設計が docs に明記されている。
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
- Dependencies: SYS-SETTINGS-P01
