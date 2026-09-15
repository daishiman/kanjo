# System task overlay: 単一 PR での配信とクローズアウト

## Machine-readable registration fields

- feature_package_id: feature-package/feat-overview-screen
- owners: ["daishiman"]
- tags: ["overview-screen", "p13", "release-deploy"]
- related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
- parent_feature: feat-overview-screen
- phase_ref: P13
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-overview-screen/sys-overview-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

単一PRでの配信を確定し、.github/workflows/deploy.ymlのmigration自動適用経路がmigrations/0040をCREATE ONLYとして扱うことを確認したうえでクローズアウト記録を残す。goal-specの指示によりP13はCloudflare deployが存在するためN/Aにしない。

## 背景

spec-overview-screen.mdの互換性・移行・リリース節は「単一のPRで配信する。D1にrollbackは無いため、問題時はWorkerを直前のビルドへ戻し、新テーブルは残したまま無害に置く」と定める。architecture/overview-screen-infrastructure.mdのmigration自動適用制約に従う。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Entry gate: SYS-OVERVIEW-P12が完了し、docs/overview-screen.mdとrunbookが存在すること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 配信対象は既存ビルド成果物で追加のフロントエンド変更はない
- Backend: N/A: 配信対象は既存ビルド成果物で追加のバックエンド変更はない
- API: N/A: 配信対象は既存APIエンドポイントで追加のAPI変更はない
- Data: applicable: migrations/0040がdeploy.ymlのplan-auto-migration.mjs判定でCREATE ONLYとして自動適用可能であることを確認する
- Infrastructure: applicable: pnpm --filter @kanjo/web run build:artifactでCloudflare Workers配信可能な成果物を生成する
- Security: N/A: セキュリティ保証はP09で完了済み
- Quality: applicable: .github/scripts/plan-auto-migration.test.mjsを含むgithub-scripts:testが緑であることを確認する
- Documentation: applicable: docs/overview-screen/close-out.mdへrollback手順を記録する
- Operations: applicable: 単一PRでの配信手順とロールバック手順を記録する

## Architecture and deploy unit

- Architecture decisions: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Deploy unit/environment: Cloudflare Workers kanjo-console (packages/api build:artifact) + D1 kanjo-db migration 0040 の deploy.yml 自動適用経路
- Compatibility/migration/backfill: D1にrollbackは無いため、問題時はWorkerを直前のビルドへ戻し新テーブルは無害に残置する (spec-overview-screen.md互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- docs/overview-screen/close-out.md
- Consumed artifacts:
- .github/workflows/deploy.yml
- .github/scripts/plan-auto-migration.mjs
- Write scope/touches:
- docs/overview-screen/close-out.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-OVERVIEW-P13 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-OVERVIEW-P13 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-OVERVIEW-P13 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-OVERVIEW-P12) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (専用アプリ・AI/LLMによる推定・分類アルゴリズムの変更・概況以外の19画面の作り替え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/web run build:artifact
- pnpm run github-scripts:test
- Required evidence:
- docs/overview-screen/close-out.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: Workerを直前のビルドへ戻す。D1にrollbackは無いため、review_snoozesとmonthly_close_reviewsは無害なまま残置する。単一PRのため1回のWorker切り戻しで完全に戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Feature: feat-overview-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-OVERVIEW-P12
