# System task overlay: core の解決関数と『カテゴリなし』・一括保存と選択の読み出しと一覧 API・勘定科目の対応表と migration 2 本・取引一覧と一括操作バーと設定画面・check:classify-screen の実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-bulk-save
- owners: ["daishiman"]
- tags: ["classify-bulk-save", "p05", "mutation"]
- related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
- parent_feature: feat-classify-bulk-save
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-bulk-save/sys-classify-bulk-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 のテストを緑にする実装を行う。値の解決を core の 1 つの関数に寄せ、サーバが明細を引き直して 1 回の batch で書き、選択を表示に左右されずに保ち、取込直後でも『MF の分類』の提案が付き、勘定科目の対応表を設定画面で編集でき、取引一覧が 1264px でも 6 列で崩れない状態にする。新しい名前と関数を足し、実装の呼び出し元をすべてそこへ移す。参照の消えた旧い定義の削除は P08 が行う。

## 背景

本番の /classify で sel に 50 件を選んだ状態で、選択した明細の読み込みと取引一覧の設定がうまくいかないとの指摘があった。今は一覧の応答が絞り込み後の全件を返し、選択の中身を表示中のページからしか引けない。値の解決が web の 2 か所 (resolveBulkItem と inputFromRow) で食い違い、提案の無い明細は一括保存で値を決められない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save, SYS-CLASSIFY-BULK-P04
- Entry gate: staging run plan-feat-classify-bulk-save-20261001T1245Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-CLASSIFY-BULK-P04 が完了していること
- Source pin: system-spec-harness v0.1.16 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Entry step: 着手時に origin/main を取り込み、migrations/ の最後の番号・EXPECTED_D1_MIGRATION・本 task spec の行番号参照を取り直す (OI-6)。specs/spec-classify-bulk-save.md と system-spec/ の章が書く 0058・0059 は a63d35c 時点の予定番号で、origin/main 9b5bbf3 の最後は 0058_subscription_merge_operations.sql なので、本 package は 0059・0060 と書く。migration の名前の正本は migrations/ の実ファイル (SPEC_BASE からの差分で足した 2 本) で、文書の番号はそれに従う。 取り直した値が本 package と違えば、違いを docs/classify-screen/bulk-save-decisions.md に記録し、テストの固定値は P04 へ差し戻して直させてから実装する (次の制約)。
制約: migration の番号を振り直す場合は、番号と名前を固定値で持つテスト 4 本 (packages/api/src/deletion-schema.test.ts・packages/api/src/schema-guard.test.ts・packages/api/test/tax-account-map-migration.integration.test.ts・.github/scripts/plan-auto-migration.test.mjs) の番号と名前の行だけを直す。P05 の着手時に分かった場合は P04 へ差し戻して P04 が直し、P08 と P13 の突き合わせで分かった場合は P08 が直す。ほかのテストは書き換えない。
Blocker: 0060 (設定の変更履歴の作り直し) は破壊的な migration なので、.github/migration-approvals.json に sha256 を足すまで pnpm lint が exit 1 になる。承認は feature PR の merge で行う。
Open risk: 未決事項 2 の 3 点 (OI-1) と未決事項 7 (新しい持ち主へ初期の 5 行を入れる時機。OI-4) の案を feature PR で利用者に示す。判断は本 task の完了後に届く。値を変える判断なら P12 が本 task へ差し戻し、同じ PR の中で直す。判断の記録と閉じるのは P12。
制約: 選択の上限 50 と一括保存の上限 100、要確認の閾値 80、既存の由来の信頼度 95・85・70 は変えない。packages/web/src に色の hex を直書きせず、design-tokens と共通部品を使う。初期 JS 予算 110KiB を超えない。
制約: migrations/ には本 feature の 2 本だけを足し、既存の migration と過去の承認は書き換えない。対応表をバックアップと復元に足すときは、#75 の統合の情報 (import-lifecycle.ts の RestoreSubVendorMetadata.mergedIntoName など) を落とさない。
制約: エラー本文は packages/api/src/public-validation.ts の errorBody、利用者ごとの応答の Cache-Control は PRIVATE_NO_STORE、JSON 入力の検査は publicJsonValidator を使う。取込や他の更新との競合は canonical-mutation-fence.ts の canonicalWriteBusy (409 canonical_write_busy)、D1 の混雑は index.ts の app.onError が返す 503 d1_overloaded (retryable) に任せる。
制約: bulk-save-decisions.md と bulk-save-evidence.md は P01 が置く節の担当表に従い、本 task の節だけを書く。他 phase の節は追記だけにして書き換えない (P03 が P02 の設計の節を訂正する場合を除く)。

## Workstream applicability

- Frontend: applicable: 本 phase の主責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: applicable: 本 phase の副次責務として扱う
- Infrastructure: applicable: 本 phase の副次責務として扱う
- Security: applicable: 本 phase の副次責務として扱う
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Deploy unit/environment: web ビルドと Worker と D1 migration 2 本 (単一 PR で同時に配信する)
- Compatibility/migration/backfill: 0059 は表と既存の持ち主への初期の 5 行。0060 は破壊的な作り直しで承認を足し、既存の行は写し直す。EXPECTED_D1_MIGRATION を上げる。設定の JSON は版 2、版 1 と旧いバックアップも読める。一覧 API の応答から transactions を外すので、web と api を同じ PR で配信する

## 成果物

- Produced artifacts:
- migrations/0059_tax_account_map.sql
- migrations/0060_settings_change_log_target.sql
- packages/api/src/routes/tax-account-map.ts
- packages/core/src/classify.ts
- packages/web/src/pages/classify/
- packages/web/src/pages/settings/
- Consumed artifacts:
- docs/classify-screen/bulk-save-decisions.md
- specs/spec-classify-bulk-save.md
- packages/core/test/classify-bulk-resolve.test.ts
- packages/core/test/no-category-contract.test.ts
- packages/api/test/classify-bulk-save.integration.test.ts
- packages/api/test/classify-selected.integration.test.ts
- packages/api/test/tax-account-map.integration.test.ts
- packages/api/test/tax-account-map-migration.integration.test.ts
- Write scope/touches:
- packages/core/src/cash.ts
- packages/core/src/categories.ts
- packages/core/src/classify-status.ts
- packages/core/src/classify.ts
- packages/core/src/design-tokens.ts
- packages/core/src/index.ts
- packages/core/src/overview.ts
- packages/core/src/settings-json.ts
- packages/core/src/settings-screen.ts
- packages/core/src/tax-accounts.ts
- packages/api/src/routes/admin-users.ts
- packages/api/src/routes/analytics.ts
- packages/api/src/routes/backups.ts
- packages/api/src/routes/cash.ts
- packages/api/src/routes/classify-bulk.ts
- packages/api/src/routes/classify.ts
- packages/api/src/routes/imports.ts
- packages/api/src/routes/settings-screen.ts
- packages/api/src/routes/settings.ts
- packages/api/src/routes/tax-account-map.ts
- packages/api/src/routes/vendor-memory.ts
- packages/api/src/store.ts
- packages/api/src/classify-row.ts
- packages/api/src/classify-history.ts
- packages/api/src/d1-limits.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/scheduled-maintenance-budget.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/import-active.ts
- packages/api/src/schema-guard.ts
- packages/api/src/deletion-lifecycle.ts
- packages/api/src/import-diff.ts
- packages/api/src/users.ts
- packages/api/src/index.ts
- packages/api/src/migration-test-support.ts
- packages/api/src/db/schema.ts
- migrations/
- .github/migration-approvals.json
- packages/web/src/api.ts
- packages/web/src/api-client.ts
- packages/web/src/components/Button.tsx
- packages/web/src/components/CategoryPicker.tsx
- packages/web/src/components/SelectionCheckbox.tsx
- packages/web/src/components/classification-invalidate.ts
- packages/web/src/pages/classify/
- packages/web/src/pages/settings/
- packages/web/scripts/check-financial-visuals.mjs
- packages/web/scripts/viewports.mjs
- packages/web/package.json
- package.json
- scripts/seed-admin.mjs
- docs/classify-screen/bulk-save-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-BULK-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-BULK-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-BULK-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-BULK-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-classify-bulk-save.context.json の scope_out (選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更、要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更、分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更、絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作、取込 (CSV の読み込み) の仕様変更、証憑の添付と保管、モバイル・タブレット・デスクトップ専用アプリ、Workers Paid などの有料プランへの変更)
- feature の resource_scope の外にあるファイル (packages/api/wrangler.jsonc・.github/workflows/・packages/web/public/_headers・system-spec/ の章など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- core の解決関数が FR-02・FR-03・FR-05 を満たし、web の内訳 (pages/classify/view-model.ts) とサーバの一括保存 (routes/classify-bulk.ts) が同じ関数を呼び、resolveBulkItem と inputFromRow を呼ぶ実装 (ClassifyPage.tsx・EditPanel.tsx・view-model.ts の中の呼び出し) が 0 件で、AC-02〜AC-04 のテストが緑である。
- POST /api/transactions/bulk がサーバで明細と対応表を引き直し、予算を測り、json_each で束ねた 1 回の batch で書き、AC-06・AC-07・AC-23〜AC-29 (50 件と 100 件で D1 のクエリ 49 本以内) のテストが緑である。
- GET /api/transactions/selected が新設され、GET /api/transactions の応答に transactions が無く rows・total・page・limit (25・50・100、既定 50) を返し、AC-18・AC-21 のテストが緑である。
- 提案の最後の由来『MF の分類』『MF の分類 (対応表)』が信頼度 60 で付き、classifySuggestion の入力が 1 つの組み立て関数から渡され、legacyBasisLabel の呼び出しが 0 件で、AC-11〜AC-15 のテストが緑である。
- 勘定科目の対応表の表・migration 0059 と 0060・API (routes/tax-account-map.ts)・設定画面・設定の変更履歴・設定の JSON (版 2) とバックアップが揃い、AC-16・AC-17 のテストが緑である。バックアップの復元で #75 の統合の情報が残ること (import-lifecycle-pure.test.ts の既存の検査) も緑である。
- 新しい route と書き換えた route のエラー本文が errorBody を通り、利用者ごとの応答が PRIVATE_NO_STORE を付け、git diff の本 feature の追加行に直書きの『error: { code』が 0 件である。index.ts の 1 batch の route の注記に一括保存が足されている。
- 『カテゴリなし』の予約の値が core の 1 か所にあり、未分類と同じ扱いに通り、一括指定と編集の値・同名の候補の作成が 400 になり、AC-05・AC-23 のテスト (no-category-contract.test.ts と、classify-bulk-save・settings-screen の API テスト) が緑である。
- 一括操作バーの一括指定欄と保存前の内訳、選べない行の理由、見出しの全選択の 50 件での停止、再試行の範囲 (write_failed と要求全体の失敗)、6 列の取引一覧と表示件数の選択、編集パネルの可変幅が実装され、AC-01・AC-08〜AC-10・AC-19・AC-20 の DOM テストが緑である。
- packages/web/package.json に check:classify-screen (KANJO_VISUAL_SCOPE=classify) が足され、ルートの verify:full に組み込まれ、1264px と 1280px で AC-22 の画面検査が通る。
- D1 の上限が d1-limits.ts の 2 つの名前だけから読まれ、旧い定数 (D1_FREE_QUERY_LIMIT・SCHEDULED_D1_QUERY_LIMIT・CLASSIFY_BATCH_STATEMENTS・MAX_BATCH_STATEMENTS) の出現が各自の定義行だけになっている (deletion-lifecycle.ts・import-diff.ts・routes/cash.ts・routes/vendor-memory.ts の import と、import-lifecycle.ts:326・scheduled-maintenance-budget.ts:14・:80・routes/classify.ts:113・:1070・routes/classify-bulk.ts:177・:191 の参照を移した。定義行の削除は P08)。
- 未決事項 2 の 3 点 (OI-1) と未決事項 7 (OI-4) の案と、PR 本文に載せる利用者への判断の依頼文が docs/classify-screen/bulk-save-decisions.md にある (本 task の完了時点で判断は未着でよい。値を変える判断による差し戻しは P12 が行う)。予約の値 (OI-3) は候補の作成の拒否のテストが緑で閉じ、一括保存の D1 のクエリ 49 本以内 (OI-8) は本数の数え上げのテストが緑で閉じている。
- 本 task の完了時に feature PR を draft で作り (外部への操作なので、内容を示して利用者の確認を得てから作る)、本文に OI-1・OI-4 の依頼文と 13 task の graph_node_id を載せている。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- pnpm lint
- pnpm --filter @kanjo/web run check:classify-screen
- Required evidence:
- migrations/0059_tax_account_map.sql
- migrations/0060_settings_change_log_target.sql
- packages/api/src/routes/tax-account-map.ts
- packages/core/src/classify.ts
- packages/web/src/pages/classify/
- packages/web/package.json

## Rollout and rollback

- Rollout: 本 feature は前サイクル (#75) と同じく 1 本の PR (feature PR) で main へ入れる。各 task の branch は直前の task の branch の先端から作り、完了時に feature PR の head branch (P01 が決めて記録する) を本 task の branch の先端へ fast-forward する。13 task の linked_pr_merged_all は P13 の merge 1 回で同時に満たされる。本 task の完了時に feature PR を draft で作る (内容を示して利用者の確認を得てから)。
- Rollback trigger and steps: 本 task のコミットを revert してコードを戻す。適用済みの migration は残してよい (schema-guard は適用済みのほうが新しくても通る)。0060 を戻すときだけ deploy.yml の Time Travel の復元地点を使う。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.16 出力)
- Screen specification: specs/spec-classify-bulk-save.md
- Architecture: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Feature: feat-classify-bulk-save
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-BULK-P04
