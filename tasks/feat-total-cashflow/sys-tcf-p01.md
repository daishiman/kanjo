---
graph_node_id: "SYS-TCF-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "トータル収支の要件と受入条件を機械可読な二値条件へ確定する"
project_id: "feature-package-feat-total-cashflow"
domain: "documentation"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p01"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T21:49:49Z"
depends_on: []
related_nodes: ["spec-total-cashflow-requirements","arch-total-cashflow-backend","arch-total-cashflow-database"]
resource_scope: ["specs/total-cashflow-requirements.md","features/feat-total-cashflow.md"]
purpose: "「トータルでいくらプラスマイナスか」を判断できない現状に対し、何が成立すれば解決なのかを 観測可能な二値条件として確定した状態。総支出 == 事業費 + 家計費、総収入 == 事業収入 + 家計収入 の 2 恒等式と、重複消し込みの唯一の判定規則が、後続 phase が参照できる 1 箇所に固定される。"
goal: "トータル収支の要件と受入条件を機械可読な二値条件へ確定する"
scope_in: ["specs/total-cashflow-requirements.md","features/feat-total-cashflow.md"]
scope_out: ["重複判定の実装 (P05 の責務)","freee / Money Forward への新規 API 連携の追加"]
acceptance: ["受入条件が全て「観測して真偽が決まる」文になっており、主観語 (適切・十分・使いやすい) を含む条件が 0 件である","重複判定規則が「MF 日付 == freee 発生日 かつ 金額一致」の 1 定義だけで書かれ、これと矛盾する記述が仕様内に 0 件である","収入側の分類規則 (MF の事業・副業 は事業収入、それ以外は家計収入) が明記され、要確認判定が「同じ」になったとき当該明細が家計収入から外れて freee 側 1 件だけが事業収入に残る (総収入は二重計上分だけ減る) ことが書かれている","総支出と総収入の 2 恒等式が受入条件として列挙されている","specs の O1-O6 が定める受入基準が features/feat-total-cashflow.md 側にも漏れなく写されている。とくに 9 列 (月・総収入・総支出・総収支・事業費・家計費・事業費へ寄せた件数・要確認件数・トレンド) の常時表示と、取込完了時に要確認が残っていれば画面へ警告を出すこと (qa-anomaly-notice-001) が両方に存在する"]
architecture_refs: ["arch-total-cashflow-backend","arch-total-cashflow-database"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P01"
classification_confidence: 1.0
classification_reason: "P01 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-01-requirements に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p01.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","documentation"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-05T21:49:49Z","evidence_refs":["git:d3e0b0675e5e7b0c153efefeeb39b6ca095aeb61","eval-log/tcf-p01-acceptance-verification.json","specs/total-cashflow-requirements.md","features/feat-total-cashflow.md"],"policy":"manual","reconciled_at":null,"source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-01-requirements.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: トータル収支の要件と受入条件を機械可読な二値条件へ確定する

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p01 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database
- parent_feature: feat-total-cashflow
- phase_ref: P01
- classification: confidence 1.0 / reason: P01 は 13 phase 固定スロットの phase-01-requirements に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, documentation / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

「トータルでいくらプラスマイナスか」を判断できない現状に対し、何が成立すれば解決なのかを 観測可能な二値条件として確定した状態。総支出 == 事業費 + 家計費、総収入 == 事業収入 + 家計収入 の 2 恒等式と、重複消し込みの唯一の判定規則が、後続 phase が参照できる 1 箇所に固定される。

## 背景

事業は freee、家計は Money Forward に分かれて記録されており、三井住友銀行のカード明細が 両者へ重複して入る。利用者は割合は把握できているが総額の推移が読めない。要件段階で 「同じ費用とは何か」を一意に決めないと、後続の集計実装が二重計上を静かに温存する。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database
- Entry gate: system-spec/completeness-findings.json の総合判定が PASS であり、features/feat-total-cashflow.context.json の sha256 が feature-package.json の source_feature_digest と一致する
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: なし (本 feature の起点 phase)

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: N/A: この phase は Workers 実行コードを触らない
- API: N/A: この phase は HTTP 契約を変更しない
- Data: applicable: 判定永続化に必要な項目 (突合キー・判定値・判定時刻) を要件側で列挙する
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: N/A: この phase は認証・認可の制御点を変更しない
- Quality: applicable: 各受入条件に対応する検証コマンドを 1 対 1 で割り当てる
- Documentation: applicable: specs/total-cashflow-requirements.md の受入節を二値条件へ書き下す
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: spec-total-cashflow-requirements / arch-total-cashflow-backend / arch-total-cashflow-database
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: 要件文書の更新のみで、既存データとの互換境界は P08 が扱う

## 成果物

- Produced artifacts: specs/total-cashflow-requirements.md (受入節)、features/feat-total-cashflow.md (受入 10 件)
- Consumed artifacts: system-spec/00-requirements-definition.md、system-spec/index.md
- Write scope/touches: specs/total-cashflow-requirements.md, features/feat-total-cashflow.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, documentation / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P01 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p01 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P01 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (なし (本 feature の起点 phase)) が完了済みで、write_scope (specs/total-cashflow-requirements.md, features/feat-total-cashflow.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- 重複判定の実装 (P05 の責務)
- freee / Money Forward への新規 API 連携の追加

## Verification and evidence

- Automated commands:
  - rg -n 'MF 日付 == freee 発生日' specs/total-cashflow-requirements.md
  - rg -n '総支出 == 事業費 \+ 家計費' specs/total-cashflow-requirements.md features/feat-total-cashflow.md
  - rg -c '適切|十分|使いやすい' specs/total-cashflow-requirements.md の出力が 0 であること
  - rg -c 'qa-table-columns-001' features/feat-total-cashflow.md の出力が 1 以上であること
  - rg -c 'qa-anomaly-notice-001' features/feat-total-cashflow.md の出力が 1 以上であること
- Required evidence:
  - specs/total-cashflow-requirements.md
  - eval-log/c02-import-report.md

## Rollout and rollback

- Rollout: 文書更新のみ。反映は commit で完了する
- Rollback trigger and steps: 後続 phase が受入条件の矛盾を検出した場合に当該節を戻し、P01 を再実行する — specs/total-cashflow-requirements.md と features/feat-total-cashflow.md を直前 commit の内容へ戻す

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: spec-total-cashflow-requirements / arch-total-cashflow-backend / arch-total-cashflow-database
- Feature: feat-total-cashflow
- Phase doc: P01 (phase-01-requirements)
- Dependencies: なし (本 feature の起点 phase)
