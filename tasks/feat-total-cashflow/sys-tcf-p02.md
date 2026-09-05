---
graph_node_id: "SYS-TCF-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "消し込み・合算・トレンドの層分担と判定永続化のデータモデルを決める"
project_id: "feature-package-feat-total-cashflow"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p02"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-02-architecture.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T13:53:35Z"
depends_on: ["SYS-TCF-P01"]
related_nodes: ["spec-total-cashflow-requirements","arch-total-cashflow-backend","arch-total-cashflow-database","arch-total-cashflow-frontend","arch-total-cashflow-ui-ux"]
resource_scope: ["architecture/total-cashflow-backend.md","architecture/total-cashflow-database.md","architecture/total-cashflow-frontend.md"]
purpose: "どの層が何を担うかが一意に決まった状態。消し込みと合算は packages/core の純関数、利用者判定の永続化は D1、表示と期間切替は packages/web、という境界と、判定テーブルの列・一意キー・冪等条件が確定する。"
goal: "消し込み・合算・トレンドの層分担と判定永続化のデータモデルを決める"
scope_in: ["architecture/total-cashflow-backend.md","architecture/total-cashflow-database.md","architecture/total-cashflow-frontend.md"]
scope_out: ["実装コードの記述 (P05 の責務)","明細分割 (transaction-splits) の仕様変更"]
acceptance: ["消し込み・合算・トレンド判定の 3 処理それぞれについて、担当する層とファイル位置が 1 箇所ずつ定まっている","判定永続化テーブルの一意キーが定義され、同じ入力を再取込しても行が増えないことが設計として述べられている","トレンド判定が既存 trend.ts の Mann-Kendall / Theil-Sen をそのまま呼ぶ経路として設計されている","期間切替が Dataset を切る既存方式で行われ、分析関数へ期間引数を追加しない方針が明記されている"]
architecture_refs: ["arch-total-cashflow-backend","arch-total-cashflow-database","arch-total-cashflow-frontend","arch-total-cashflow-ui-ux"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P02"
classification_confidence: 1.0
classification_reason: "P02 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-02-architecture に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p02.md","confidence":1.0}]
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

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-02-architecture.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: 消し込み・合算・トレンドの層分担と判定永続化のデータモデルを決める

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p02 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database, arch-total-cashflow-frontend, arch-total-cashflow-ui-ux
- parent_feature: feat-total-cashflow
- phase_ref: P02
- classification: confidence 1.0 / reason: P02 は 13 phase 固定スロットの phase-02-architecture に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, backend / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

どの層が何を担うかが一意に決まった状態。消し込みと合算は packages/core の純関数、利用者判定の永続化は D1、表示と期間切替は packages/web、という境界と、判定テーブルの列・一意キー・冪等条件が確定する。

## 背景

既存の packages/core には analysis.ts / trend.ts / expense-projection.ts / period.ts / dataset.ts が あり、期間の切り出しは Dataset を切る方針が既に採られている。新機能をこの分担へ載せないと、分析関数に引数を配る設計へ退行し、期間絞り込みのたびに設定が落ちる。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database, arch-total-cashflow-frontend, arch-total-cashflow-ui-ux
- Entry gate: P01 の受入条件が specs へ反映済みで、architecture ノード 8 件が graph 上で confirmed である
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P01

## Workstream applicability

- Frontend: applicable: 一覧表が受け取る集計結果の形と、期間切替時の再計算経路を定義する
- Backend: applicable: 消し込みと合算を副作用のない関数として packages/core に置く境界を定義する
- API: applicable: 一覧表と判定登録の HTTP 契約の形を決める。実装は P05
- Data: applicable: 判定永続化テーブルの列・一意キー・冪等 upsert 条件を定義する
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: applicable: 判定登録が既存の canonical-mutation-fence の内側に入ることを明記する
- Quality: N/A: この phase は自動テストとゲートを追加しない
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-backend / arch-total-cashflow-database / arch-total-cashflow-frontend / arch-total-cashflow-ui-ux
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: 既存 Dataset と period.ts の期間切り出しを入力として受け、新しい期間引数を分析関数へ配らない

## 成果物

- Produced artifacts: architecture/total-cashflow-backend.md、architecture/total-cashflow-database.md、architecture/total-cashflow-frontend.md の設計判断節
- Consumed artifacts: specs/total-cashflow-requirements.md、packages/core/src/dataset.ts、packages/core/src/period.ts
- Write scope/touches: architecture/total-cashflow-backend.md, architecture/total-cashflow-database.md, architecture/total-cashflow-frontend.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, backend / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P02 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p02 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P02 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P01) が完了済みで、write_scope (architecture/total-cashflow-backend.md, architecture/total-cashflow-database.md, architecture/total-cashflow-frontend.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- 実装コードの記述 (P05 の責務)
- 明細分割 (transaction-splits) の仕様変更

## Verification and evidence

- Automated commands:
  - rg -n 'Mann-Kendall|Theil-Sen' architecture/total-cashflow-backend.md packages/core/src/trend.ts
  - rg -n '一意キー|UNIQUE' architecture/total-cashflow-database.md
  - rg -n 'Dataset' architecture/total-cashflow-backend.md packages/core/src/dataset.ts
- Required evidence:
  - architecture/total-cashflow-backend.md
  - architecture/total-cashflow-database.md

## Rollout and rollback

- Rollout: 設計文書の更新のみ
- Rollback trigger and steps: P03 の設計レビューが層分担の矛盾を指摘した場合 — architecture/total-cashflow-*.md を直前 commit へ戻す

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-backend / arch-total-cashflow-database / arch-total-cashflow-frontend / arch-total-cashflow-ui-ux
- Feature: feat-total-cashflow
- Phase doc: P02 (phase-02-architecture)
- Dependencies: SYS-TCF-P01
