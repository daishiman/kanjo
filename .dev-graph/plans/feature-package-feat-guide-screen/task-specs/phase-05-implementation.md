# System task overlay: guide-screen.ts・信頼度の段階表示・防衛ライン算出定数・GET /api/guide・/guide 画面と check:guide-screen の最終実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-guide-screen
- owners: ["daishiman"]
- tags: ["guide-screen", "p05", "mutation"]
- related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
- parent_feature: feat-guide-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-guide-screen/sys-guide-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core の guide-screen と信頼度の段階関数・防衛ラインの算出定数・shiftedPeriod の移設、GET /api/guide、/guide 画面の作り直し、信頼度を出す画面の『段階＋%』表示、共通シェルのフッタ文言、check:guide-screen の verify:full への組み込みを実装し、P04 のテストを緑にする。

## 背景

Guide.tsx (185 行) は /summary と /diagnosis を期間なしで読み、現在値を guide-sections.ts で合成している。数値と文言を core の 1 か所から導き、API は写すだけ・web は描くだけにする。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen, SYS-GUIDE-P04
- Entry gate: staging run plan-feat-guide-screen-20260923T1350Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-GUIDE-P04 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: Overview.tsx:209-210 の confidenceClass (80/60) は P01 の決定に従って段階関数の結果へ置き換えるか据え置くかを実装する。段階の境界比較を web に残さない。
Blocker: 『直近3か月』の直書き 3 か所 (glossary.ts:45-49・guide-sections.ts:57-60・analysis.ts:1095) を core の名前付き定数へ寄せる。defenseLine の値は変えない。
Blocker: shiftedPeriod を pages/statements/view-model.ts:121 から packages/core/src/period.ts へ移し、StatementsPage.tsx と statements-view-model.test.ts の import を付け替えるか再輸出で通す。決算書の挙動は変えない。
制約: REVIEW_CONFIDENCE_THRESHOLD = 80 (classify-status.ts:43) と由来ごとの信頼度の規則は変えない。DB の表・列・migration は足さない。

## Workstream applicability

- Frontend: applicable: 本 phase の主責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Deploy unit/environment: web ビルドと Worker (単一 PR で同時に配信する。D1 migration は無い)
- Compatibility/migration/backfill: DB の表・列・migration を足さない (C2、qa-guide-database-web-002)。schema-guard.ts の EXPECTED_D1_MIGRATION は据え置き、既存行の書き換えと backfill は 0 件

## 成果物

- Produced artifacts:
- packages/core/src/guide-screen.ts
- packages/core/src/classify-status.ts
- packages/core/src/analysis.ts
- packages/core/src/period.ts
- packages/core/src/index.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/api.ts
- packages/web/src/pages/guide/
- packages/web/src/pages/Guide.tsx
- packages/web/src/guide-sections.ts
- packages/web/src/guide-sections.test.ts
- packages/web/src/guide.dom.test.tsx
- packages/web/src/glossary.ts
- packages/web/src/components/Layout.tsx
- packages/web/src/pages/statements/view-model.ts
- packages/web/src/pages/statements/StatementsPage.tsx
- packages/web/src/statements-view-model.test.ts
- packages/web/src/pages/Overview.tsx
- packages/web/src/components/OverviewReviewQueue.tsx
- packages/web/src/pages/classify/view-model.ts
- packages/web/src/pages/classify/view-model.test.ts
- packages/web/src/pages/classify/TransactionTable.tsx
- packages/web/src/pages/classify/EditPanel.tsx
- packages/web/scripts/check-financial-visuals.mjs
- packages/web/package.json
- package.json
- Consumed artifacts:
- docs/guide-screen/design-decisions.md
- specs/spec-guide-screen.md
- packages/core/src/guide-screen.test.ts
- packages/core/src/classify-status.test.ts
- packages/core/src/period-shift.test.ts
- packages/api/src/guide-screen.integration.test.ts
- packages/web/src/pages/guide/guide-screen.dom.test.tsx
- packages/web/src/pages/guide/view-model.test.ts
- Write scope/touches:
- packages/core/src/guide-screen.ts
- packages/core/src/classify-status.ts
- packages/core/src/analysis.ts
- packages/core/src/period.ts
- packages/core/src/index.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/api.ts
- packages/web/src/pages/guide/
- packages/web/src/pages/Guide.tsx
- packages/web/src/guide-sections.ts
- packages/web/src/guide-sections.test.ts
- packages/web/src/guide.dom.test.tsx
- packages/web/src/glossary.ts
- packages/web/src/components/Layout.tsx
- packages/web/src/pages/statements/view-model.ts
- packages/web/src/pages/statements/StatementsPage.tsx
- packages/web/src/statements-view-model.test.ts
- packages/web/src/pages/Overview.tsx
- packages/web/src/components/OverviewReviewQueue.tsx
- packages/web/src/pages/classify/view-model.ts
- packages/web/src/pages/classify/view-model.test.ts
- packages/web/src/pages/classify/TransactionTable.tsx
- packages/web/src/pages/classify/EditPanel.tsx
- packages/web/scripts/check-financial-visuals.mjs
- packages/web/package.json
- package.json

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-GUIDE-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-GUIDE-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-GUIDE-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-GUIDE-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-guide-screen.context.json の scope_out (利用規約・プライバシーの専用ページ、ガイド本文の管理画面や DB 保存、自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更、防衛ラインの算出変更、共通ヘッダの呼称変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、DB の表・列・migration の追加、モバイル・タブレット・デスクトップ専用アプリ、税務判断)
- feature の resource_scope の外にあるファイル (scripts/check-glossary.mjs・docs/data-schema.md・migrations など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/core/src/guide-screen.ts (新設) が節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・ガイド内検索を純関数で導き、guide-sections.ts の現在値合成が core へ移り、P04 の core テストが緑である。
- 信頼度の段階関数が core に 1 つだけあり、P01 で確定した画面 (明細仕分けの表と編集欄・概況の確認待ちを含む) が『高 92%』の形で段階を文字で示す。要確認の閾値 80 による自動判定の結果は変わらない。
- 防衛ラインの算出期間が core の名前付き定数 (値 3) になり、analysis.ts の defenseLine・用語集 (glossary.ts)・使い方画面の説明文がその定数から組まれ、defenseLine の既存テストが値を変えずに緑である。
- GET /api/guide が packages/api/src/routes/analytics.ts にあり、loadScoped の結果を core の guide-screen に渡して { screen } に写すだけで、P04 の API テストが緑である。
- /guide が packages/web/src/pages/guide/ 配下に分割され、core を import するのは view-model.ts だけ、旧 pages/Guide.tsx は再輸出 1 行で、P04 の DOM テストが緑である。
- 共通シェルのフッタ 1 文目が『取込データは外部送信しません』になり、AI 送信の補足がフッタの title・プライバシー欄・使い方画面の 3 か所にあり、ヘッダは『防衛ライン』のままで、common-shell.dom.test.tsx が緑である。
- packages/web/package.json に check:guide-screen (KANJO_VISUAL_SCOPE=guide node scripts/check-financial-visuals.mjs) が足され、ルートの package.json の verify:full に組み込まれ、check-financial-visuals.mjs が guide スコープで /api/guide の応答を用意する。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- pnpm --filter @kanjo/web run check:guide-screen
- Required evidence:
- packages/core/src/guide-screen.ts
- packages/core/src/classify-status.ts
- packages/core/src/analysis.ts
- packages/core/src/period.ts
- packages/core/src/index.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/api.ts
- packages/web/src/pages/guide/
- packages/web/src/pages/Guide.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。migration を作らないので、巻き戻しは web と api のコードを戻すだけで済む。配信済みなら直前のビルドへ戻す。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-guide-screen.md
- Architecture: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Feature: feat-guide-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-GUIDE-P04
