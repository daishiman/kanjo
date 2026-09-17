# System task overlay: 要件ベースライン確定と持ち越し4件の着手時整理

## Machine-readable registration fields

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p01", "requirements"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

specs/spec-expense-matrix-screen.md の確定章 (画面構成要素・集計規則・§3.5 の検算値・URL 契約・API 契約) が docs/matrix/requirements-baseline.md へ転記され、持ち越し4件が値を確定せずに一覧化され、それぞれの契約テスト確定先 task が記録された状態にする。

## 背景

specs/spec-expense-matrix-screen.md は system-spec-harness 0.1.14 の確定章を dev-graph の specification として参照する入口であり、規範本文は system-spec 側が正本である。feature 文書の持ち越し4件 (偏り度スコアの標準偏差の下限値・構成比と前年差の丸め桁・明細導線の実クエリ形・取引先名の正規化の適用範囲) はいずれも実装 task の契約テストで確定する扱いであり、P01 では値を仮置きしない。参照画像の合計欄が閉じていない事実も §3.5 の検算値を正本として明記する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 task は文書転記のみで UI コードを変更しない
- Backend: N/A: 本 task は core と API のコードを変更しない
- API: applicable: 確定済みの API 契約節を転記するのみで新規定義しない
- Data: N/A: 読み取り範囲の決定は P02 の責務
- Infrastructure: N/A: 配信構成に変更なし
- Security: N/A: セキュリティ制御に変更なし
- Quality: applicable: 文書検査が pnpm lint の対象として通ることを確認する
- Documentation: applicable: docs/matrix/requirements-baseline.md を新設する
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- docs/matrix/requirements-baseline.md
- Consumed artifacts:
- specs/spec-expense-matrix-screen.md
- system-spec/00-requirements-definition.md
- system-spec/completeness-findings.json
- Write scope/touches:
- docs/matrix/requirements-baseline.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (無し (先頭 task)) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint (既存の文書検査が緑のままであることを確認する)
- Required evidence:
- docs/matrix/requirements-baseline.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/matrix/requirements-baseline.md の追加コミットを revert する。他ファイルへの書込みがないため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: 無し (先頭 task)
