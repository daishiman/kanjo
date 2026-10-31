# System task overlay: アクセシビリティ・ファイル名の無害化・xlsx 展開のメモリ・JS バンドル予算の保証確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-import-screen
- owners: ["daishiman"]
- tags: ["import-screen", "p09", "quality-assurance"]
- related_nodes: ["arch-import-screen-auth", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-frontend", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops", "arch-import-screen-security", "arch-import-screen-ui-ux", "spec-import-screen"]
- parent_feature: feat-import-screen
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-import-screen/sys-import-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

ドロップ領域・一覧・履歴のアクセシビリティ、ファイル名に含めた HTML がテキストとして描画されること、xlsx 展開時のメモリの実測、初期 JS 予算を確認する。

## 背景

pages/import/ への分割で初期 JS が増えないこと、25MB の xlsx と展開後 60MB 近いファイルで Worker の 128MB に収まることを保証として確かめる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen, SYS-IMPORT-P08
- Entry gate: staging run run-import-screen-20260921T2311Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: アクセシビリティとファイル名の描画を確かめる
- Backend: N/A: 本 phase では扱わない
- API: N/A: 本 phase では扱わない
- Data: N/A: 本 phase では扱わない
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: ファイル名の無害化と外部送信 0 件を確かめる
- Quality: applicable: JS 予算とメモリの実測を確かめる
- Documentation: N/A: docs は P12
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Deploy unit/environment: N/A: 保証確認の記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 記録のみ

## 成果物

- Produced artifacts:
- docs/import-screen/design-decisions.md
- Consumed artifacts:
- packages/core/src/import-screen.ts
- packages/core/src/index.ts
- packages/api/src/routes/imports.ts
- packages/api/src/import-pipeline.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/import-active.ts
- packages/api/src/import-diff.ts
- packages/api/src/import-history-discard.ts
- packages/api/src/import-rate-limit.ts
- packages/api/src/scheduled-maintenance-budget.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/index.ts
- migrations/0050_import_inspections.sql
- packages/web/src/api.ts
- packages/web/src/pages/Import.tsx
- packages/web/src/pages/import/
- packages/web/src/components/ImportDiff.tsx
- packages/web/src/components/ImportDeletion.tsx
- packages/web/src/import-retry.ts
- packages/web/src/pages/Import.dom.test.tsx
- packages/web/src/pages/Import.diff.test.tsx
- packages/web/src/pages/Import.discard.test.tsx
- packages/web/src/pages/Import.deletion.test.tsx
- Write scope/touches:
- docs/import-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPORT-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPORT-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPORT-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPORT-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (銀行・クレジットカードの明細ファイルの取り込みと、その対応サービスの案内、共通シェル、freee / マネーフォワードの API との自動連携、既存の取込形式、既存の imports と明細の行の書き換え、取消・破棄・差分プレビュー・手当ての継続再適用の規則そのものの変更、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 初期 JS 予算を超えない (build:bundle 直後に測る)。
- xlsx 展開時のメモリの実測値が記録され、128MB に収まる。
- ドロップ領域と選択ボタンがキーボードで操作できる。
- Automated commands:
- pnpm --filter @kanjo/web build:bundle
- pnpm --filter @kanjo/web check:js-budget
- Required evidence:
- docs/import-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-import-screen.md
- Architecture: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Feature: feat-import-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPORT-P08
