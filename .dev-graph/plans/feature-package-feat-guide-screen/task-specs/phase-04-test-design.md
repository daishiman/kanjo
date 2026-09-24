# System task overlay: core 不変条件・/api/guide 契約・DOM・共通シェル文言の失敗テスト先行作成

## Machine-readable registration fields

- feature_package_id: feature-package/feat-guide-screen
- owners: ["daishiman"]
- tags: ["guide-screen", "p04", "test-design"]
- related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
- parent_feature: feat-guide-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-guide-screen/sys-guide-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core 不変条件・GET /api/guide の契約・/guide の DOM・共通シェル文言の失敗テストを先行作成し、現行実装で確実に失敗する状態を作る。

## 背景

実装 (P05) より先にテストを書くことで、信頼度の境界 49/50/79/80・防衛ラインの説明と算出定数の一致・guide-screen の構成・API の利用者分離・フッタ文言を実行可能な形で固定する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen, SYS-GUIDE-P03
- Entry gate: staging run plan-feat-guide-screen-20260923T1350Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-GUIDE-P03 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: common-shell.dom.test.tsx:182-185 は『アプリからは自動送信しません』と『AI実行時は確認した集計データを選択したAIへ渡します』を期待しており、qa-guide-decision-011 に合わせて『取込データは外部送信しません』と 3 か所の補足の期待へ書き換える。ヘッダの期待 (:154『防衛ライン：正常』) は変えない。書き換え後のテストが緑になるのは P05 とする。
Blocker: shiftedPeriod の既存テスト statements-view-model.test.ts:93-100 は core へ移すか再輸出で通す。core 側の失敗テストを packages/core/src/period-shift.test.ts に先行作成する。
Open risk: DOM テストのファイル名 guide-screen.dom.test.tsx は agent 推定・利用者未確認である。

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

- Architecture decisions: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: DB の表・列・migration を足さない (C2、qa-guide-database-web-002)。schema-guard.ts の EXPECTED_D1_MIGRATION は据え置き、既存行の書き換えと backfill は 0 件

## 成果物

- Produced artifacts:
- packages/core/src/guide-screen.test.ts
- packages/core/src/classify-status.test.ts
- packages/core/src/period-shift.test.ts
- packages/api/src/guide-screen.integration.test.ts
- packages/web/src/pages/guide/guide-screen.dom.test.tsx
- packages/web/src/pages/guide/view-model.test.ts
- packages/web/src/guide.dom.test.tsx
- packages/web/src/guide-sections.test.ts
- packages/web/src/common-shell.dom.test.tsx
- packages/web/src/statements-view-model.test.ts
- packages/web/src/pages/classify/view-model.test.ts
- packages/web/src/glossary.test.tsx
- Consumed artifacts:
- docs/guide-screen/design-decisions.md
- specs/spec-guide-screen.md
- Write scope/touches:
- packages/core/src/guide-screen.test.ts
- packages/core/src/classify-status.test.ts
- packages/core/src/period-shift.test.ts
- packages/api/src/guide-screen.integration.test.ts
- packages/web/src/pages/guide/guide-screen.dom.test.tsx
- packages/web/src/pages/guide/view-model.test.ts
- packages/web/src/guide.dom.test.tsx
- packages/web/src/guide-sections.test.ts
- packages/web/src/common-shell.dom.test.tsx
- packages/web/src/statements-view-model.test.ts
- packages/web/src/pages/classify/view-model.test.ts
- packages/web/src/glossary.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-GUIDE-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-GUIDE-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-GUIDE-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-GUIDE-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-guide-screen.context.json の scope_out (利用規約・プライバシーの専用ページ、ガイド本文の管理画面や DB 保存、自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更、防衛ラインの算出変更、共通ヘッダの呼称変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、DB の表・列・migration の追加、モバイル・タブレット・デスクトップ専用アプリ、税務判断)
- feature の resource_scope の外にあるファイル (scripts/check-glossary.mjs・docs/data-schema.md・migrations など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 信頼度の段階の失敗テストが packages/core/src/classify-status.test.ts にあり、49 が低・50 が中・79 が中・80 が高、0 と 100、範囲外 (-1・101・NaN) を検査し、REVIEW_CONFIDENCE_THRESHOLD と高の下限がともに 80 であることを固定する。
- packages/core/src/guide-screen.test.ts が 節 7 つの順・ステップ 4 つと行き先・よくある疑問 5 行・期間の表 4 行・このページの数値 4 項目・関連ページ 5 件を toEqual で固定し、検索 (振替・重複・信頼度・予算、0 件、全角半角と大小の同一視、100 字の切り詰め)・期間の定義文 (1 か月・1 年・全期間)・防衛ラインの説明文が算出定数から組まれることを検査し、現行実装 (guide-screen.ts が存在しない) で失敗する。
- packages/core/src/period-shift.test.ts が core の shiftedPeriod の前後移動・全期間で null・範囲の端で null を検査する。
- packages/api/src/guide-screen.integration.test.ts が GET /api/guide の Contract tests (期間つき・期間なし・壊れた期間で 200、totals が総収支画面の同じ期間の値と一致、振替が totals に入らない、取込 0 件で 0 と null、他の利用者のセッションで数値を返さない、未認証 401、一時パスワード 403、応答に防衛ラインの値が無い) を持ち、現行実装で失敗する。
- packages/web/src/pages/guide/guide-screen.dom.test.tsx が 19-guide.png の構成要素・URL の topic / q の復元・未知 topic の月次の流れへの倒れ・読込 / 失敗 / 検索 0 件・信頼度を出す画面 (P01 で確定した列挙) の『段階＋%』を検査し、現行実装で失敗する。
- common-shell.dom.test.tsx:182-185 が新しいフッタ 1 文目と 3 か所の補足の期待へ書き換えられ、現行実装で失敗する。glossary.test.tsx が防衛ラインの説明と算出定数の一致を検査する。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- Required evidence:
- packages/core/src/guide-screen.test.ts
- packages/core/src/classify-status.test.ts
- packages/core/src/period-shift.test.ts
- packages/api/src/guide-screen.integration.test.ts
- packages/web/src/pages/guide/guide-screen.dom.test.tsx
- packages/web/src/pages/guide/view-model.test.ts
- packages/web/src/guide.dom.test.tsx
- packages/web/src/guide-sections.test.ts
- packages/web/src/common-shell.dom.test.tsx
- packages/web/src/statements-view-model.test.ts
- packages/web/src/pages/classify/view-model.test.ts
- packages/web/src/glossary.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: テストの追加と書き換えを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-guide-screen.md
- Architecture: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Feature: feat-guide-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-GUIDE-P03
