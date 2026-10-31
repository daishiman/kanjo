# System task overlay: アクセシビリティ・マスク・入力検証・他人の依頼の拒否・撮影のブラウザ内完結・JS バンドル予算の保証確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-improvement-screen
- owners: ["daishiman"]
- tags: ["improvement", "p09", "quality-assurance"]
- related_nodes: ["arch-improvement-screen-auth", "arch-improvement-screen-backend", "arch-improvement-screen-database", "arch-improvement-screen-frontend", "arch-improvement-screen-infrastructure", "arch-improvement-screen-maintenance-ops", "arch-improvement-screen-security", "arch-improvement-screen-ui-ux", "spec-improvement-screen"]
- parent_feature: feat-improvement-screen
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-improvement-screen/sys-impscr-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

非機能の保証 (アクセシビリティ・個人情報・分離・予算) を確かめて記録する。

## 背景

撮影はブラウザ内で完結させ外部へ画面を送らない (C4)。撮影パネルと画像の拡大は初期 JS に入れず、初期 JS 予算を守る。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen, SYS-IMPSCR-P08
- Entry gate: staging run plan-feat-improvement-screen-20260923T1404Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: キーボード操作と初期 JS 予算を確かめる
- Backend: N/A: 保証確認の記録のみ
- API: N/A: 保証確認の記録のみ
- Data: N/A: 保証確認の記録のみ
- Infrastructure: N/A: 保証確認の記録のみ
- Security: applicable: マスク・他人の 404・入力の 400・撮影の外部送信 0 件を確かめる
- Quality: applicable: 保証確認を記録する
- Documentation: N/A: 保証確認の記録のみ
- Operations: N/A: 保証確認の記録のみ

## Architecture and deploy unit

- Architecture decisions: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen
- Deploy unit/environment: N/A: 保証確認の記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 保証確認の記録のみ

## 成果物

- Produced artifacts:
- docs/improvement-screen/design-decisions.md
- Consumed artifacts:
- docs/improvement-screen/design-decisions.md
- Write scope/touches:
- docs/improvement-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPSCR-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPSCR-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPSCR-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPSCR-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの文言 (取引ライン / 最終更新 / 月次クローズ / フッター) の変更。画像の文言は期待値にしない (U7)、改善を起点にした自動修正・自動 PR 作成と、外部の課題管理サービスへの連携 (2026-09-02 サイクルの範囲外を維持)、関連する依頼の手動紐付け。自動導出だけにする (qa-imp-decision-006)、複数利用者の間での依頼の共有と権限分離。単一利用者の運用を維持する、モバイル・タブレット・デスクトップ専用アプリ。狭い幅はレスポンシブ web で扱う (qa-imp-decision-005)、新しい Cron・新しい資格情報の種類・R2 のキーの形の変更)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 初期 JS 予算を超えない (build:bundle 直後に測る)。
- 他人の依頼が全経路で 404、不正な入力が 400 で、撮影の処理が外部へ通信しない。
- 件数タブ・表の選択・詳細パネル・撮影パネル・トーストがキーボードで操作でき、プライバシー確認 2 つが未チェックのとき送信できない。
- Automated commands:
- pnpm --filter @kanjo/web build:bundle
- pnpm --filter @kanjo/web check:js-budget
- Required evidence:
- docs/improvement-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-improvement-screen.md
- Architecture: arch-improvement-screen-auth, arch-improvement-screen-backend, arch-improvement-screen-database, arch-improvement-screen-frontend, arch-improvement-screen-infrastructure, arch-improvement-screen-maintenance-ops, arch-improvement-screen-security, arch-improvement-screen-ui-ux, spec-improvement-screen
- Feature: feat-improvement-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPSCR-P08
