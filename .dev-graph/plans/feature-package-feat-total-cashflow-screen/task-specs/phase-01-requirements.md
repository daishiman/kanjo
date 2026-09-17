# System task overlay: 要件ベースライン確定と未決事項の着手時確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow-screen
- owners: ["daishiman"]
- tags: ["total-cashflow-screen", "p01", "requirements"]
- related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
- parent_feature: feat-total-cashflow-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-total-cashflow-screen/sys-tcscreen-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

specs/spec-total-cashflow-screen.md の FR-001..FR-008・BR-001..BR-009・AC-001..AC-006 と確定意思決定 qa-total-cashflow-decision-001..018 を要件ベースラインとして 1 文書に固定し、未決事項 (low) の着手時点の扱いを決める。

## 背景

総収支タブは packages/web/src/pages/analysis/TotalCashflow.tsx にあり、9 列月次表・重複候補・freee 除外を既に持つ。本 feature は 05-total-cashflow.png の構成へ作り替え、判定作業と操作履歴を足す。先行する feat-total-cashflow (消し込みの不変条件の正本)・feat-design-system-foundation・feat-analysis-hub・feat-overview-screen は取込み済みである。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Entry gate: SYS-TCSCREEN 系の先行 task は無い。features/feat-total-cashflow-screen.md が confirmed かつ evaluation pass であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Backend: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- API: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Data: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Infrastructure: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Security: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Quality: applicable: 原文との転記差分 0 件を確認する
- Documentation: applicable: 要件ベースライン文書を作成する
- Operations: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: GET /api/total-cashflow の既存フィールドと旧 reason body の受理を維持し、migration は追加のみとする (spec-total-cashflow-screen.md 互換性・移行・リリース節)

## 受入基準

- FR-001..FR-008・BR-001..BR-009・AC-001..AC-006・qa-total-cashflow-decision-001..018 を requirements-baseline.md へ転記し、spec 原文との差分が 0 件である。
- spec の未決事項 8 件それぞれに、着手時点の扱い (どの phase で解消するか、または利用者確認が要るか) を記録している。
- migration 番号 0041 が取込み時点の main の最新 +1 であることを git fetch 後に確認し、結果を記録している。

## 成果物

- Produced artifacts:
- docs/total-cashflow-screen/requirements-baseline.md
- Consumed artifacts:
- system-spec/00-requirements-definition.md
- specs/spec-total-cashflow-screen.md
- features/feat-total-cashflow-screen.md
- system-spec/completeness-findings.json
- Write scope/touches:
- docs/total-cashflow-screen/requirements-baseline.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCSCREEN-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TCSCREEN-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TCSCREEN-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし (package の先頭 task)) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更: 利用者指示により今回は確認のみ・照合・マトリクス・推移・診断の各タブの中身: それぞれの画面サイクルで扱う・日付と金額の一致による自動寄せの廃止: 利用者決定により自動寄せを維持する・freee / Money Forward の取込経路の追加と明細分割の仕様変更・期間選択の保存先の変更 (既存どおり localStorage で全画面共有)・mobile / tablet / desktop 向け専用アプリ: 対象は web のみ (狭幅は既存のレスポンシブ表示で扱う))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint (既存の文書検査が緑のままであることを確認する)
- Required evidence:
- docs/total-cashflow-screen/requirements-baseline.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/total-cashflow-screen/requirements-baseline.md の追加コミットを revert する。他ファイルへの書込みが無いため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Feature: feat-total-cashflow-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし (package の先頭 task)
