# System task overlay: core 不変条件・API 契約・migration・DOM の失敗テスト先行作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-settings-screen
- owners: ["daishiman"]
- tags: ["settings-screen", "p04", "test-design"]
- related_nodes: ["arch-settings-auth", "arch-settings-backend", "arch-settings-database", "arch-settings-frontend", "arch-settings-infrastructure", "arch-settings-maintenance-ops", "arch-settings-security", "arch-settings-ui-ux", "spec-settings-screen"]
- parent_feature: feat-settings-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-settings-screen/sys-settings-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core 不変条件・API 契約・migration・DOM の失敗テストを先行作成し、現行実装で確実に失敗する状態を作る。

## 背景

実装 (P05) より先にテストを書くことで、BR-01〜BR-31・10 API・migration 0051-0053・DOM 状態遷移の仕様を実行可能な形で固定する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Entry gate: staging run plan-feat-settings-screen-20260922T1041Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: R-6 (toCsv の式注入無害化) は既存の集計マトリクス CSV・取引 CSV のテストへの影響を同一テスト内で検査する失敗テストとして先行作成する。
Blocker: R-7 (backup-restore.dom.test.tsx と decision-010 の衝突) は同テストを書き換える対象として本 phase で失敗させ、緑化は P05 で行う。
Open risk: Q-1〜Q-12 は値そのものを固定するテストではなく、agent 推定値が実装に反映されていることを確認するテストとして設計する。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: migration 0051-0053 は追加のみ。既存 account_norm_map・cash_overrides・settings 表への書き換えと backfill は 0 件。番号は実装時と release 時に origin/main を fetch して確定する

## 成果物

- Produced artifacts:
- packages/core/test/settings-screen.test.ts
- packages/core/test/settings-json.test.ts
- packages/api/src/routes/settings-screen.test.ts
- packages/web/src/pages/settings/settings.dom.test.tsx
- packages/web/src/pages/settings/view-model.test.ts
- Consumed artifacts:
- docs/settings-screen/design-decisions.md
- specs/spec-settings-screen.md
- Write scope/touches:
- packages/core/test/settings-screen.test.ts
- packages/core/test/settings-json.test.ts
- packages/api/src/routes/settings-screen.test.ts
- packages/web/src/pages/settings/settings.dom.test.tsx
- packages/web/src/pages/settings/view-model.test.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SETTINGS-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SETTINGS-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SETTINGS-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SETTINGS-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-settings-screen.context.json の scope_out (取引データの復元形式変更、既存の仕分けルール・ベンダー記憶の意味変更、共通シェルの作り直し、外部 LLM・外部サービスへの送信、複数テナント化・web 以外の専用アプリ、バックアップ保持期間 30 日の変更、バックアップからの全データ復元、既存 API の削除、既存表 account_norm_map・cash_overrides の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- core 不変条件 (settingsScreen の算出、取引先ルールの適用順 手動編集>仕分けルール>集計ルール(取引先)>自動分類、resolveCashOverride の null/0 区別、validateOwnerLabels 共有、統計最小月数 3〜24・既定 6、diffSettings、validateSettingsJson) の失敗テストが packages/core/test/settings-screen.test.ts・settings-json.test.ts にあり、現行実装 (settings-screen.ts/settings-json.ts/norm-rules.ts が存在しない) で失敗する。
- 10 API の統合テストが packages/api/src/routes/settings-screen.test.ts にあり、401・fence の 409 (baseSavedAt 不一致)・不正値の 400・未知キー拒否・migration 未適用の 503 を検査し、現行実装で失敗する。
- DOM テスト packages/web/src/pages/settings/settings.dom.test.tsx が節ナビ 8 項目・読込/空/失敗の各状態・保存バー・未保存件数を検査し、現行実装で失敗する。
- R-6 (toCsv の式注入無害化) を先行して失敗テスト化し、既存の集計マトリクス CSV・取引 CSV のテスト (負数の文字列表記を含む) が無害化後も期待どおりであることを同一テスト内で確認する構成にする。
- R-7 (既存 backup-restore.dom.test.tsx が POST /api/restore への合流を固定している) について、qa-settings-decision-010 (設定だけ戻す) に合わせて書き換える対象として失敗させるところまでを本 task で行い、書き換え後のテストが緑になるのは P05 とする。
- migration 0051〜0053 が既存 account_norm_map・cash_overrides・settings 関連行を書き換えないことを検査する migration テストがある。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/test/settings-screen.test.ts
- packages/core/test/settings-json.test.ts
- packages/api/src/routes/settings-screen.test.ts
- packages/web/src/pages/settings/settings.dom.test.tsx
- packages/web/src/pages/settings/view-model.test.ts

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-settings-screen.md
- Architecture: arch-settings-auth, arch-settings-backend, arch-settings-database, arch-settings-frontend, arch-settings-infrastructure, arch-settings-maintenance-ops, arch-settings-security, arch-settings-ui-ux, spec-settings-screen
- Feature: feat-settings-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SETTINGS-P03
