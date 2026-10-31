# System task overlay: improvement-screen 純関数・マスクの拡張・migration 0053・削除と復元・夜間の完全消去・改善リクエスト画面の分割と撮影パネルの最終実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-improvement-screen
- owners: ["daishiman"]
- tags: ["improvement", "p05", "mutation"]
- related_nodes: ["arch-improvement-screen-auth", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-frontend", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops", "arch-improvement-screen-security", "arch-improvement-screen-ui-ux", "spec-improvement-screen"]
- parent_feature: feat-improvement-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-improvement-screen/sys-impscr-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストがすべて緑になるまで、core / API / migration / cron / web を実装する。旧 Improvement.tsx と投稿モーダルの操作をすべて新しい部品へ移し、導出の重複を除く。

## 背景

状態・概要・番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクは core の improvement-screen と improvement.ts に寄せ、API と web は写すだけにする。削除は論理削除で、同じ id と番号のまま戻る。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen, SYS-IMPSCR-P04
- Entry gate: staging run plan-feat-improvement-screen-20260923T1404Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: pages/improvement/ の部品・撮影パネル・Layout の入口を実装する
- Backend: applicable: 削除・復元・読取経路の除外・夜間消去を実装する
- API: applicable: 一覧・詳細・作成・状態変更・再発行・削除・復元を実装する
- Data: applicable: migration 0053 と schema.ts・runtimeSchemaGuard を実装する
- Infrastructure: applicable: 夜間予算の枠の入れ替えを実装する
- Security: applicable: マスクの拡張と撮影用 DOM 複製の伏字を実装する
- Quality: applicable: P04 のテストを緑にする
- Documentation: N/A: 対象外
- Operations: N/A: 対象外

## Architecture and deploy unit

- Architecture decisions: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration (0053 の表の作り直しと履歴の表の追加)
- Compatibility/migration/backfill: 0053 は状態の CHECK を張り替えるため表を作り直す。既存行は全列を写し、wontfix は完了へ移して理由を履歴に残す。件名の列は残して新規行だけ NULL にし、1000 字を超える既存の本文は読めるまま保つ

## 成果物

- Produced artifacts:
- packages/core/src/improvement-screen.ts
- packages/api/src/routes/improvement.ts
- migrations/0053_improvement_request_screen.sql
- packages/web/src/pages/improvement/
- Consumed artifacts:
- docs/improvement-screen/design-decisions.md
- packages/core/test/improvement-screen.test.ts
- packages/api/src/improvement-screen.integration.test.ts
- packages/api/src/improvement-migration-0053.test.ts
- packages/web/src/pages/improvement/improvement-screen.dom.test.tsx
- Write scope/touches:
- packages/core/src/improvement-screen.ts
- packages/core/src/improvement.ts
- packages/core/src/index.ts
- packages/api/src/routes/improvement.ts
- packages/api/src/improvement/
- packages/api/src/improvement-orphan-sweep.ts
- packages/api/src/store.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/index.ts
- packages/api/src/scheduled-maintenance-budget.ts
- packages/api/src/audit-log.ts
- migrations/0053_improvement_request_screen.sql
- packages/web/src/api.ts
- packages/web/src/capture-screen.ts
- packages/web/src/pages/Improvement.tsx
- packages/web/src/pages/improvement/
- packages/web/src/components/ImprovementRequestButton.tsx
- packages/web/src/components/Layout.tsx
- packages/web/src/AuthenticatedApp.tsx
- packages/web/src/routeMetadata.ts
- packages/web/src/styles.css
- packages/web/package.json
- packages/web/src/improvement-capture.dom.test.tsx
- packages/web/src/common-shell-routes.dom.test.tsx
- package.json

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPSCR-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPSCR-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPSCR-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPSCR-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) の変更。画像の文言は期待値にしない (U7)、改善を起点にした自動修正・自動 PR 作成と、外部の課題管理サービスへの連携 (2026-09-02 サイクルの範囲外を維持)、関連する依頼の手動紐付け。自動導出だけにする (qa-imp-decision-006)、複数利用者の間での依頼の共有と権限分離。単一利用者の運用を維持する、モバイル・タブレット・デスクトップ専用アプリ。狭い幅はレスポンシブ web で扱う (qa-imp-decision-005)、新しい Cron・新しい資格情報の種類・R2 のキーの形の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- improvement-screen 純関数とマスクの拡張が P04 の core テストの境界値をすべて満たす。
- DELETE が論理削除になり、復元で同じ id と IMP 番号のまま戻り、削除中の行が全ての読取経路から外れる。
- migration 0053 で既存の行・R2 の画像・トークンが残り、runtimeSchemaGuard の期待 head が 0053 になり、夜間の完全消去が SCHEDULED_D1_QUERY_PLAN_MAX 49 の内に収まる。
- 改善リクエスト画面が参照画像の構成要素 (共通シェルの文言を除く) をすべて描画し、選択中の依頼・タブ・検索・ページが URL から復元され、右下の『改善を送る』から撮影パネルを経て作成フォームへ移れる。
- 旧 Improvement.tsx と投稿モーダルの操作 (投稿・状態の変更・指示文のコピー・再発行) がすべて新しい構成から実行できる。
- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/improvement-screen.ts
- migrations/0053_improvement_request_screen.sql

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。0053 は表の作り直しを伴うため、巻き戻しは対称でない。旧 Worker は再確認の状態と削除中の行を知らないので、巻き戻す前に再確認と削除中の行が無いことを確かめる。表は元に戻さない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-improvement-screen.md
- Architecture: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen
- Feature: feat-improvement-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPSCR-P04
