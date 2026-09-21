# System task overlay: アクセシビリティ・入力検証・変更系フェンス・外部送信ゼロ・JS バンドル予算の保証確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-screen
- owners: ["daishiman"]
- tags: ["classify-screen", "p09", "quality-assurance"]
- related_nodes: ["arch-classify-auth", "arch-classify-backend", "arch-classify-database", "arch-classify-frontend", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-security", "arch-classify-ui-ux", "spec-classify-screen"]
- parent_feature: feat-classify-screen
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-screen/sys-classify-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

非機能要件（性能・コスト・初期 JS 予算・決定論・外部送信ゼロ・アクセシビリティ・レスポンシブ）が満たされていることを保証する。

## 背景

/classify は lazy route として初期 JS バンドルに含めない契約があり、js-budget の予算判定は build:bundle 直後に行う必要がある（既存の運用メモに合わせる）。新設の変更系ルートは canonicalMutationFence への登録漏れが既知のリスクである。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Entry gate: staging run run-feat-classify-screen-20260919T142500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Constraint: js-budget の判定は build:artifact 実行前の build:bundle 直後に行う。build:artifact は manifest を消すため、その後に判定すると誤判定になる。

## Workstream applicability

- Frontend: applicable: アクセシビリティ・レスポンシブ・JS バンドル予算を検証する
- Backend: N/A: 本 task の対象外
- API: applicable: 変更系フェンス登録を検証する
- Data: N/A: 本 task の対象外
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: 入力検証上限と外部送信ゼロを検証する
- Quality: applicable: 非機能要件の保証結果を記録する
- Documentation: N/A: docs の最終同期は P12
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Deploy unit/environment: N/A: 保証確認の記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 保証確認のみ

## 成果物

- Produced artifacts:
- docs/classify-screen/design-decisions.md
- Consumed artifacts:
- packages/web/src/pages/classify/
- packages/api/src/canonical-mutation-fence.ts
- Write scope/touches:
- docs/classify-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (証憑の再導入、外部 LLM 呼び出し、共通シェルの作り直し、照合画面の変更、専用アプリ、画像ヘッダーの文言変更、AI分析/改善リクエスト項目の追加)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- build:bundle 直後の js-budget が予算内である（/classify は lazy route で初期 JS に含まれない）。
- メモ 200 字・フィルタ名 1〜40 字・キーワード検索 100 字・保存フィルタ条件 JSON 2000 字・一括保存 1〜100 件・保存フィルタ 20 件までの境界が 400 で拒否される（BR-14）。
- 新設の変更系ルートが canonicalMutationFence に登録され、フェンス違反が 409 になる。
- 外部への送信が 0 件である（AT-21）。
- 信頼度と分類ステータスが色だけで区別されず、数値と文言が併記され、画面に『AI』の文字列が無い（AT-18）。
- Automated commands:
- pnpm --filter @kanjo/web build:bundle
- pnpm --filter @kanjo/web js-budget
- Required evidence:
- docs/classify-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-classify-screen.md
- Architecture: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Feature: feat-classify-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-P08
