# System task overlay: 解決関数・一括保存・選択の読み出し・一覧・対応表・migration・画面のテストを先に書き、旧実装で落ちることを確かめる

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-bulk-save
- owners: ["daishiman"]
- tags: ["classify-bulk-save", "p04", "test-design"]
- related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
- parent_feature: feat-classify-bulk-save
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-bulk-save/sys-classify-bulk-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

AC-01〜AC-29 を自動テストに落とし、新しい契約のテストが旧実装で落ちることを確かめてから P05 に渡す。一覧 API の応答から transactions を外す前に、それを読む既存の 8 本を rows へ移す。

## 背景

一覧の応答の transactions は既存の 8 本のテストが読んでいる。先に外すと関係の無いテストが一斉に落ち、原因が見えなくなる。テストが新しい契約を表していないと、旧実装のまま緑になる (0 件の違反と 0 件しか調べていないことの区別がつかない)。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save, SYS-CLASSIFY-BULK-P03
- Entry gate: staging run plan-feat-classify-bulk-save-20261001T1245Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-CLASSIFY-BULK-P03 が完了していること
- Source pin: system-spec-harness v0.1.16 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
制約: 移し替えた 8 本は P04 の時点で旧実装に対して緑にする。新しい契約のテストは旧実装で落ちることを確かめ、落ちた件数と名前を記録する。デバッグ用のテストを repository に置かない (空の test ファイルでも vitest は失敗する)。
制約: 画面のテストは pointer: none の環境 (CI の headless Chrome) に頼らない書き方にし、ローカルと CI の jsdom の版の違い (PointerEvent の有無) で結果が変わらないようにする。
制約: resolveBulkItem・inputFromRow・legacyBasisLabel と D1 上限の旧い定数 (D1_FREE_QUERY_LIMIT・SCHEDULED_D1_QUERY_LIMIT・CLASSIFY_BATCH_STATEMENTS・MAX_BATCH_STATEMENTS) を参照する既存のテストは、本 task で P02 が決めた新しい名前と core の解決関数へ書き換える。P05 は実装の呼び出し元だけを移し、P08 は参照の消えた定義だけを消すので、どちらもテストを書き換えない (migration の番号を振り直す場合だけ、次の制約のとおり、分かった時点に応じて P04 か P08 が固定値の行を直す)。
制約: migration の番号を振り直す場合は、番号と名前を固定値で持つテスト 4 本 (packages/api/src/deletion-schema.test.ts・packages/api/src/schema-guard.test.ts・packages/api/test/tax-account-map-migration.integration.test.ts・.github/scripts/plan-auto-migration.test.mjs) の番号と名前の行だけを直す。P05 の着手時に分かった場合は P04 へ差し戻して P04 が直し、P08 と P13 の突き合わせで分かった場合は P08 が直す。ほかのテストは書き換えない。
制約: packages/api/src/d1-limits.test.ts は feature の resource_scope の外なので書き換えない。旧い定数を使っておらず、P08 で旧い定義を消しても壊れない。D1 上限の 2 つの名前の検査は scheduled-maintenance-budget.test.ts に置く。
制約: bulk-save-decisions.md と bulk-save-evidence.md は P01 が置く節の担当表に従い、本 task の節だけを書く。他 phase の節は追記だけにして書き換えない (P03 が P02 の設計の節を訂正する場合を除く)。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: N/A: テストの追加と移し替えのみで、DB・API・画面の互換に影響しない

## 成果物

- Produced artifacts:
- packages/core/test/classify-bulk-resolve.test.ts
- packages/core/test/no-category-contract.test.ts
- packages/api/test/classify-bulk-save.integration.test.ts
- packages/api/test/classify-selected.integration.test.ts
- packages/api/test/tax-account-map.integration.test.ts
- packages/api/test/tax-account-map-migration.integration.test.ts
- docs/classify-screen/bulk-save-evidence.md
- Consumed artifacts:
- docs/classify-screen/bulk-save-decisions.md
- specs/spec-classify-bulk-save.md
- Write scope/touches:
- packages/core/test/classify-bulk-resolve.test.ts
- packages/core/test/no-category-contract.test.ts
- packages/core/src/classify-status.test.ts
- packages/core/test/settings-json.test.ts
- packages/api/test/classify-bulk-save.integration.test.ts
- packages/api/test/classify-selected.integration.test.ts
- packages/api/test/tax-account-map.integration.test.ts
- packages/api/test/tax-account-map-migration.integration.test.ts
- packages/api/test/settings-backups.integration.test.ts
- packages/api/test/settings-screen.integration.test.ts
- packages/api/src/classify-bulk.integration.test.ts
- packages/api/src/split-lifecycle.test.ts
- packages/api/src/import-diff.test.ts
- packages/api/src/cash-lifecycle.test.ts
- packages/api/src/vendor-memory.test.ts
- packages/api/src/row-transfer-lifecycle.test.ts
- packages/api/src/classify-transactions-shape.test.ts
- packages/api/src/classify-list-paging.integration.test.ts
- packages/api/test/total-cashflow-verdict.integration.test.ts
- packages/api/src/schema-guard.test.ts
- packages/api/src/deletion-schema.test.ts
- packages/api/src/scheduled-maintenance-budget.test.ts
- packages/api/src/import-lifecycle-pure.test.ts
- packages/web/src/pages/classify/classify.dom.test.tsx
- packages/web/src/pages/classify/view-model.test.ts
- packages/web/src/pages/settings/settings.dom.test.tsx
- packages/web/src/pages/settings/view-model.test.ts
- packages/web/test/import-multifile.dom.test.tsx
- .github/scripts/plan-auto-migration.test.mjs
- docs/classify-screen/bulk-save-evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-BULK-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-BULK-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-BULK-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-BULK-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-classify-bulk-save.context.json の scope_out (選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更、要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更、分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更、絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作、取込 (CSV の読み込み) の仕様変更、証憑の添付と保管、モバイル・タブレット・デスクトップ専用アプリ、Workers Paid などの有料プランへの変更)
- feature の resource_scope の外にあるファイル (packages/api/wrangler.jsonc・.github/workflows/・packages/web/public/_headers・system-spec/ の章など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/core/test/classify-bulk-resolve.test.ts が AC-02〜AC-04 (未整理は 下書き→提案、確定済みは 下書き→今の値、区分だけの指定で組が無ければ『カテゴリなし』、外す行と理由) を表し、web の resolveBulkItem と inputFromRow が食い違う例 (状態を見ずに提案を使う) を含む。
- packages/core/test/no-category-contract.test.ts が AC-05 と FR-18 を表す。『カテゴリなし』の明細を家計の集計・総収支の内訳・説明可能率 (analysis.ts)・分類の状態・候補の検査・バックアップ (設定の JSON) に通すと、未分類の明細と同じ結果 (未分類・説明できない側・手動) になることを 1 つの表で確かめる。
- packages/api/test/classify-bulk-save.integration.test.ts と packages/api/src/classify-bulk.integration.test.ts が AC-06・AC-07・AC-23〜AC-29 (write_failed の範囲・401/403/400・256KB の 413・他の利用者の秘匿・source=bulk の履歴・50 件と 100 件で D1 のクエリ 49 本以内・予算超過の 413・2 回送っても同じ結果) と、予約の値を一括指定と編集の値として送ると 400 になること (BR-04) を表す。
- packages/api/test/settings-screen.integration.test.ts が、予約の値と同じ名前のカテゴリの候補の作成 (POST /api/settings/category-options) が 400 になることを表す (BR-04、未決事項 6 の閉じ条件)。
- packages/api/test/classify-selected.integration.test.ts が AC-21 (表示外の明細を引き直せる・key の上限 200 字・51 件と重複の 400) と AC-25 (他の利用者の key は見つからない扱いにして存在を明かさない) と、50 件の key の読み出しで各文の bound parameter が 100 (D1_MAX_BOUND_PARAMS) 以内であることを、一覧のテストが limit 25・50・100 (既定 50) と応答に transactions が無いことを表す。
- packages/api/test/tax-account-map.integration.test.ts・tax-account-map-migration.integration.test.ts・packages/core/test/settings-json.test.ts・packages/api/test/settings-backups.integration.test.ts・settings-screen.integration.test.ts が AC-11〜AC-17 (MF の分類の提案・対応表の提案・付けない明細・集計ルール・既存の由来の不変・初期の 5 行と変更履歴・版 1 と旧いバックアップの読み込み) と AC-25 (他の利用者の対応表の行は見つからない扱い) を表す。
- 一覧の応答の transactions を読む既存の 8 本 (split-lifecycle・import-diff・cash-lifecycle・vendor-memory・row-transfer-lifecycle・classify-transactions-shape・classify-list-paging・total-cashflow-verdict) が rows を読むよう移され、P04 の時点で旧実装に対して緑である。
- pages/classify/classify.dom.test.tsx・view-model.test.ts・pages/settings/settings.dom.test.tsx・view-model.test.ts が AC-01・AC-03・AC-04・AC-08〜AC-10・AC-18〜AC-20 (一括指定欄・保存前の内訳・要求全体の失敗の文言と再試行・ページをまたぐ選択・選べない行の理由・全選択の 50 件での停止) と設定画面の対応表の追加と削除を表し、pointer: none に頼らない。
- scheduled-maintenance-budget.test.ts と import-lifecycle-pure.test.ts が旧い定数をやめて d1-limits.ts の 2 つの名前を import し、値 (どちらも 50) と大小関係 (1 起動の合計は 50 未満で受け付け、batch の文は 50 以下) を直接 expect する。import-multifile.dom.test.tsx のコメントの旧い名前も新しい名前へ直す。
- schema-guard.test.ts と .github/scripts/plan-auto-migration.test.mjs が、EXPECTED_D1_MIGRATION の更新と 0060 の破壊的な migration の承認の扱いを表す。
- packages/api/src/deletion-schema.test.ts の :63 の EXPECTED_D1_MIGRATION の固定値が新しい最後の migration (0060_settings_change_log_target.sql) に直され、:62 の『migrations/ の最後と一致する』検査は定数を参照したまま残っている。
- 本 task の後、packages/ のテストに resolveBulkItem・inputFromRow・legacyBasisLabel と D1 上限の旧い定数 (D1_FREE_QUERY_LIMIT・SCHEDULED_D1_QUERY_LIMIT・CLASSIFY_BATCH_STATEMENTS・MAX_BATCH_STATEMENTS) の出現が grep で 0 件である (view-model.test.ts の resolveBulkItem・inputFromRow の検査は core の解決関数の検査へ移っている)。
- 新しい契約のテストを旧実装に対して走らせ、落ちた件数と名前が docs/classify-screen/bulk-save-evidence.md に記録されている (0 件しか調べていないテストを緑と数えない)。AC-22 (1264px・1280px の画面検査) は check:classify-screen を P05 で新設するので先行テストの対象外とし、その理由と確かめる phase (P06・P07) も記録されている。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm run github-scripts:test
- Required evidence:
- docs/classify-screen/bulk-save-evidence.md
- packages/core/test/classify-bulk-resolve.test.ts
- packages/core/test/no-category-contract.test.ts
- packages/api/test/classify-bulk-save.integration.test.ts
- packages/api/test/classify-selected.integration.test.ts
- packages/api/test/tax-account-map.integration.test.ts
- packages/api/test/tax-account-map-migration.integration.test.ts

## Rollout and rollback

- Rollout: 本 feature は前サイクル (#75) と同じく 1 本の PR (feature PR) で main へ入れる。各 task の branch は直前の task の branch の先端から作り、完了時に feature PR の head branch (P01 が決めて記録する) を本 task の branch の先端へ fast-forward する。13 task の linked_pr_merged_all は P13 の merge 1 回で同時に満たされる。P04 の旧実装で落ちるテストは途中の commit にだけ存在し、P05 で緑になる。feature PR はまだ作らない。
- Rollback trigger and steps: 本 task のコミットを revert する。テストの追加と移し替えを戻すだけで、配布物と DB に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.16 出力)
- Screen specification: specs/spec-classify-bulk-save.md
- Architecture: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Feature: feat-classify-bulk-save
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-BULK-P03
