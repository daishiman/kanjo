# System task overlay: 参照の消えた旧い定義の削除と migration の突き合わせ: 番号・承認の sha256・EXPECTED_D1_MIGRATION の一致

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-bulk-save
- owners: ["daishiman"]
- tags: ["classify-bulk-save", "p08", "refactoring-migration"]
- related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
- parent_feature: feat-classify-bulk-save
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-bulk-save/sys-classify-bulk-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P05 が呼び出し元を移した後に定義だけが残る resolveBulkItem・inputFromRow・legacyBasisLabel と D1 上限の旧い定数 (D1_FREE_QUERY_LIMIT・SCHEDULED_D1_QUERY_LIMIT・CLASSIFY_BATCH_STATEMENTS・MAX_BATCH_STATEMENTS) を消して grep で 0 件にし、migration の番号と承認と EXPECTED_D1_MIGRATION を origin/main と突き合わせる。新しい名前と関数の追加、呼び出し元とテストの移し替えは P04・P05 が担い、本 task は行わない (例外は番号を振り直す場合の固定値の行だけで、制約に書く)。

## 背景

同じ判定が 2 か所に残ると、片方だけ直した日に画面とサーバの値がずれる。migration の番号は並行するサイクルと衝突しうるが、git の衝突には出ない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save, SYS-CLASSIFY-BULK-P07
- Entry gate: staging run plan-feat-classify-bulk-save-20261001T1245Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-CLASSIFY-BULK-P07 が完了していること
- Source pin: system-spec-harness v0.1.16 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
制約: main へ merge 済み (本番に適用済み) の migration は振り直さない。凍結済みの migration と過去の承認は書き換えない。番号の突き合わせは本 feature の PR を merge する前に行う。
制約: migration の番号を振り直す場合は、番号と名前を固定値で持つテスト 4 本 (packages/api/src/deletion-schema.test.ts・packages/api/src/schema-guard.test.ts・packages/api/test/tax-account-map-migration.integration.test.ts・.github/scripts/plan-auto-migration.test.mjs) の番号と名前の行だけを直す。P05 の着手時に分かった場合は P04 へ差し戻して P04 が直し、P08 と P13 の突き合わせで分かった場合は P08 が直す。ほかのテストは書き換えない。
制約: bulk-save-decisions.md と bulk-save-evidence.md は P01 が置く節の担当表に従い、本 task の節だけを書く。他 phase の節は追記だけにして書き換えない (P03 が P02 の設計の節を訂正する場合を除く)。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: applicable: 本 phase の副次責務として扱う
- API: N/A: 本 phase の責務に含まれない
- Data: applicable: 本 phase の主責務として扱う
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Deploy unit/environment: web ビルドと Worker と D1 migration 2 本 (P05 と同じ配信単位。merge は P13 で行う)
- Compatibility/migration/backfill: 番号を振り直す場合は 0059・0060 のファイル名・承認の sha256・EXPECTED_D1_MIGRATION (schema-guard.ts と deletion-schema.test.ts の固定値)・migration のテストを同時に直す。既存の行の写し直しの内容は変えない

## 成果物

- Produced artifacts:
- migrations/0059_tax_account_map.sql
- migrations/0060_settings_change_log_target.sql
- .github/migration-approvals.json
- Consumed artifacts:
- docs/classify-screen/bulk-save-decisions.md
- migrations/0059_tax_account_map.sql
- migrations/0060_settings_change_log_target.sql
- Write scope/touches:
- migrations/
- .github/migration-approvals.json
- packages/api/src/schema-guard.ts
- packages/api/src/schema-guard.test.ts
- packages/api/src/deletion-schema.test.ts
- packages/core/src/overview.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/scheduled-maintenance-budget.ts
- packages/api/src/routes/classify.ts
- packages/api/src/routes/classify-bulk.ts
- packages/web/src/pages/classify/view-model.ts
- packages/api/test/tax-account-map-migration.integration.test.ts
- .github/scripts/plan-auto-migration.test.mjs
- docs/classify-screen/bulk-save-evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-BULK-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-BULK-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-BULK-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-BULK-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-classify-bulk-save.context.json の scope_out (選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更、要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更、分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更、絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作、取込 (CSV の読み込み) の仕様変更、証憑の添付と保管、モバイル・タブレット・デスクトップ専用アプリ、Workers Paid などの有料プランへの変更)
- feature の resource_scope の外にあるファイル (packages/api/wrangler.jsonc・.github/workflows/・packages/web/public/_headers・system-spec/ の章など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- resolveBulkItem・inputFromRow・legacyBasisLabel と D1 上限の旧い定数 (D1_FREE_QUERY_LIMIT・SCHEDULED_D1_QUERY_LIMIT・CLASSIFY_BATCH_STATEMENTS・MAX_BATCH_STATEMENTS) の定義が消え、packages/ の grep (コメントを含む) で 0 件で、pnpm typecheck が exit 0 である。
- migration 0059・0060 の番号が origin/main と衝突せず (OI-6)、.github/migration-approvals.json の sha256 が実ファイルの実測と一致し、schema-guard.ts の EXPECTED_D1_MIGRATION と deletion-schema.test.ts の固定値が migrations/ の最後と一致する。
- packages/api/test/tax-account-map-migration.integration.test.ts・.github/scripts/plan-auto-migration.test.mjs・schema-guard.test.ts・deletion-schema.test.ts が緑である。
- 番号・承認の sha256・EXPECTED_D1_MIGRATION のどれかを変えた場合は、変更前後の値と、変えた後に走らせ直した pnpm run verify:full と migration のテストの結果が docs/classify-screen/bulk-save-evidence.md に記録され、P06 の記録より新しい結果として読める。変えなかった場合は、突き合わせた origin/main の commit と『変更なし』が記録されている。
- Automated commands:
- pnpm typecheck
- pnpm lint
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm run github-scripts:test
- Required evidence:
- migrations/0059_tax_account_map.sql
- migrations/0060_settings_change_log_target.sql
- .github/migration-approvals.json
- packages/api/src/schema-guard.ts
- packages/api/src/deletion-schema.test.ts
- docs/classify-screen/bulk-save-evidence.md

## Rollout and rollback

- Rollout: 本 feature は前サイクル (#75) と同じく 1 本の PR (feature PR) で main へ入れる。各 task の branch は直前の task の branch の先端から作り、完了時に feature PR の head branch (P01 が決めて記録する) を本 task の branch の先端へ fast-forward する。13 task の linked_pr_merged_all は P13 の merge 1 回で同時に満たされる。
- Rollback trigger and steps: 本 task のコミットを revert する。番号を振り直した場合は振り直す前の名前に戻り、本番へは未適用なので DB に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.16 出力)
- Screen specification: specs/spec-classify-bulk-save.md
- Architecture: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Feature: feat-classify-bulk-save
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-BULK-P07
