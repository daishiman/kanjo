# System task overlay: 分類ステータス・信頼度・ルール適用の規則と Q-1〜Q-5・保存フィルタ / 履歴のバックアップ方針の docs 最終同期

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-screen
- owners: ["daishiman"]
- tags: ["classify-screen", "p12", "documentation-sync"]
- related_nodes: ["arch-classify-auth", "arch-classify-backend", "arch-classify-database", "arch-classify-frontend", "arch-classify-infrastructure", "arch-classify-maintenance-ops", "arch-classify-security", "arch-classify-ui-ux", "spec-classify-screen"]
- parent_feature: feat-classify-screen
- phase_ref: P12
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-screen/sys-classify-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

docs/data-schema.md・docs/ui-decisions.md を最終状態に同期し、未決事項 Q-1〜Q-5 とバッジ集合・バックアップ方針の未決を明記する。

## 背景

Q-1〜Q-5 は本 task で解決するものではなく、未決のまま利用者の決定を待つ事項として記録する。本 task が値を決めることはない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Entry gate: staging run run-feat-classify-screen-20260919T142500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Constraint: 本 task は Q-1（vendor_memory 分岐）・Q-3（ルール適用プレビュー対象範囲）・Q-4（下書きを利用者で区切らない前提）・Q-5（agent 推定・利用者未確認の値の一覧）を未決のまま転記するに留め、いずれの値も確定しない。

## Workstream applicability

- Frontend: N/A: docs 同期のみ
- Backend: N/A: docs 同期のみ
- API: N/A: docs 同期のみ
- Data: applicable: data-schema.md の 2 表 5 列を同期する
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: docs 同期のみ
- Quality: applicable: docs と最終コードの一致を確認する
- Documentation: applicable: docs を最終同期する
- Operations: applicable: 運用向けの整合ガイダンスを記載する

## Architecture and deploy unit

- Architecture decisions: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/classify-screen/design-decisions.md
- docs/data-schema.md
- docs/ui-decisions.md
- Consumed artifacts:
- migrations/0046_classify_workbench.sql
- packages/core/src/classify-status.ts
- Write scope/touches:
- docs/classify-screen/design-decisions.md
- docs/data-schema.md
- docs/ui-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-P12 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-P12 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-P12 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-P11) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (証憑の再導入、外部 LLM 呼び出し、共通シェルの作り直し、照合画面の変更、専用アプリ、画像ヘッダーの文言変更、AI分析/改善リクエスト項目の追加)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- docs/data-schema.md に saved_filters・tx_history の 2 表と、rules・tx_edits への 5 列の追加、分類ステータスの規則（BR-01〜BR-03）と信頼度（BR-04・BR-05）が記されている。
- docs/ui-decisions.md に画面の文言・状態遷移・分割ルールの表示規則が記されている。
- Q-1・Q-3・Q-4・Q-5 が docs に転記され、未決のまま明記される。
- バッジで数える集合（BR-06）と月次クローズで数える集合（BR-07）の違い、saved_filters・tx_history をバックアップ／全削除の対象に含めるかが未決である旨が docs に明記されている。
- Automated commands:
- pnpm lint
- pnpm test
- Required evidence:
- docs/data-schema.md
- docs/ui-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-classify-screen.md
- Architecture: arch-classify-auth, arch-classify-backend, arch-classify-database, arch-classify-frontend, arch-classify-infrastructure, arch-classify-maintenance-ops, arch-classify-security, arch-classify-ui-ux, spec-classify-screen
- Feature: feat-classify-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-P11
