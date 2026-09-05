---
graph_node_id: "SYS-TCF-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "消し込み・合算・トレンド・一覧表を実装して赤いテストを緑にする"
project_id: "feature-package-feat-total-cashflow"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p05"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-05-implementation.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T13:53:35Z"
depends_on: ["SYS-TCF-P03","SYS-TCF-P04"]
related_nodes: ["spec-total-cashflow-requirements","arch-total-cashflow-backend","arch-total-cashflow-database","arch-total-cashflow-frontend","arch-total-cashflow-ui-ux","arch-total-cashflow-security"]
resource_scope: ["packages/core/src","packages/api/src","packages/web/src","migrations"]
purpose: "P04 で赤にしたテストが全て緑になった状態。月次のトータル収入・トータル支出・トータル収支と 事業側/家計側の内訳、事業へ寄せた金額と件数、要確認キューが web の一覧表に出る。"
goal: "消し込み・合算・トレンド・一覧表を実装して赤いテストを緑にする"
scope_in: ["packages/core/src","packages/api/src","packages/web/src","migrations"]
scope_out: ["mobile / tablet / desktop 向け実装 (対象は web のみ)","freee / Money Forward への新規 API 連携取込経路の追加","税務申告書類の生成"]
acceptance: ["月次一覧表に トータル収入 / トータル支出 / トータル収支 の 3 列が表示され、全表示月で 2 恒等式が成立する","MF 日付 == freee 発生日 かつ 金額一致 の支出は freee 側 1 件だけが事業費に計上され、同額の MF 明細が家計費に残らない","事業側へ寄せた金額と件数が一覧表に表示され、消し込み対象明細の実数と一致する","自動で寄せられなかった重複候補が理由付きで列挙され、0 件のときは 0 件と明示される","一覧表が 9 列 (月・総収入・総支出・総収支・事業費・家計費・事業費へ寄せた件数・要確認件数・トレンド) を 常時表示し、小画面でも列が落ちない (qa-table-columns-001)","CSV 取込完了時に要確認が残っていれば、その場で画面に警告が出る (qa-anomaly-notice-001)。メール・push・外部監視は追加しない","P04 で追加した全テストが緑である"]
architecture_refs: ["arch-total-cashflow-backend","arch-total-cashflow-database","arch-total-cashflow-frontend","arch-total-cashflow-ui-ux","arch-total-cashflow-security"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P05"
classification_confidence: 1.0
classification_reason: "P05 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-05-implementation に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p05.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","backend"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-05-implementation.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: 消し込み・合算・トレンド・一覧表を実装して赤いテストを緑にする

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p05 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database, arch-total-cashflow-frontend, arch-total-cashflow-ui-ux, arch-total-cashflow-security
- parent_feature: feat-total-cashflow
- phase_ref: P05
- classification: confidence 1.0 / reason: P05 は 13 phase 固定スロットの phase-05-implementation に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, backend / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

P04 で赤にしたテストが全て緑になった状態。月次のトータル収入・トータル支出・トータル収支と 事業側/家計側の内訳、事業へ寄せた金額と件数、要確認キューが web の一覧表に出る。

## 背景

既存の取込パイプライン (packages/api/src/import-pipeline.ts) が入力元であり、新規の外部連携は増やさない。消し込みは取込済みデータに対する解析として実装する。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database, arch-total-cashflow-frontend, arch-total-cashflow-ui-ux, arch-total-cashflow-security
- Entry gate: P04 のテストが存在し、実装前に赤であることが eval-log に記録されている
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P03, SYS-TCF-P04

## Workstream applicability

- Frontend: applicable: packages/web に月次一覧表と要確認キューの画面を追加する
- Backend: applicable: packages/core に消し込みと合算の純関数を追加し、trend.ts をトータル支出へ適用する
- API: applicable: 集計取得と判定登録のエンドポイントを packages/api/src/routes に追加する
- Data: applicable: 判定永続化テーブルの migration を migrations 配下へ追加する
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: applicable: 判定登録を既存の認証と canonical-mutation-fence の内側に置く
- Quality: applicable: P04 のテストを緑にする
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-backend / arch-total-cashflow-database / arch-total-cashflow-frontend / arch-total-cashflow-ui-ux / arch-total-cashflow-security
- Deploy unit/environment: kanjo-console (Cloudflare Workers) + D1 kanjo-db
- Compatibility/migration/backfill: 既存の取込済みデータをそのまま入力とし、再取込を必須にしない。新テーブルは追加のみで既存テーブルの列を変更しない

## 成果物

- Produced artifacts: packages/core/src の消し込み・合算モジュール、packages/api/src/routes の集計と判定登録、packages/web/src の一覧表、migrations の新規マイグレーション
- Consumed artifacts: packages/core/src/trend.ts、packages/core/src/dataset.ts、packages/core/src/period.ts、packages/api/src/import-pipeline.ts
- Write scope/touches: packages/core/src, packages/api/src, packages/web/src, migrations

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, backend / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P05 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p05 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P05 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P03, SYS-TCF-P04) が完了済みで、write_scope (packages/core/src, packages/api/src, packages/web/src, migrations) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- mobile / tablet / desktop 向け実装 (対象は web のみ)
- freee / Money Forward への新規 API 連携取込経路の追加
- 税務申告書類の生成

## Verification and evidence

- Automated commands:
  - pnpm test の exit code が 0 であること
  - pnpm test -- -t qa-table-columns-001 が 1 件以上を実行し exit code 0 であること
  - pnpm test -- -t qa-anomaly-notice-001 が 1 件以上を実行し exit code 0 であること
  - pnpm -w typecheck
  - pnpm -w lint
- Required evidence:
  - eval-log/tcf-green-run.txt

## Rollout and rollback

- Rollout: migration 適用後にコードを配備する。集計は既存データに対する読み取りで、取込結果を書き換えない
- Rollback trigger and steps: P06 のテスト実行で恒等式が崩れた場合、または本番で集計値が内訳合計と一致しない場合 — 追加 migration を down 方向へ戻し、コードを直前タグへ戻す。既存テーブルへの破壊的変更を行っていないため取込済みデータは影響を受けない

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-backend / arch-total-cashflow-database / arch-total-cashflow-frontend / arch-total-cashflow-ui-ux / arch-total-cashflow-security
- Feature: feat-total-cashflow
- Phase doc: P05 (phase-05-implementation)
- Dependencies: SYS-TCF-P03, SYS-TCF-P04
