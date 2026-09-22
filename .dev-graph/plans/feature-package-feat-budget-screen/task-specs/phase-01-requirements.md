# System task overlay: 要件ベースライン確定と未決事項 7 件の着手時整理

## Machine-readable registration fields

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p01", "preparation"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

spec-budget-screen と feature の受入 S1〜S5・AT-01〜AT-22 を、実装着手時点の要件ベースラインとして 1 枚に固定し、goal-spec の未決事項 7 件の解決担当 phase を割り当てる。

## 背景

予算画面は core の budgetScreen / applyBudgetInputs / monthlyBudgetsAt 1 か所から数値を出し、収入の行 (売上高・その他収入) を予算対象に含める。Q-7 (PUT の batch 文数と D1 の 1 呼び出しあたりのクエリ上限)・収入行の差額の色・年額の下限・snapshot consumer とバックアップ write-set の整合・その他収入 (manualOnly) の行の扱い・Q-5 (増減率と季節性補正の読み)・migration 0048 の予定番号は利用者未確認のため、要件ベースラインの段階で推測せず、後続 phase への明示的な持ち越しとして記録する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: Q-7（PUT /api/budget-plans の 1 回の保存で最大 200 行を扱うとき、batch の文数が D1 の 1 呼び出しあたりのクエリ上限を超えないか）は保存 API を実装する SYS-BUDGET-P05 の前提条件とし、本 task では解決しない。
Open risk: 収入行 (売上高・その他収入) の差額の色規則・年額の下限・その他収入 (manualOnly) の行の扱いは specs/spec-budget-screen.md の未決事項 (Q-3・Q-4・Q-6 相当) と arch-budget-ui-ux / arch-budget-security の Risks を正本とし、本 task では値を決めない。
Open risk: budget_plans を JSON snapshot の consumer とバックアップ・復元の write-set の両方に揃って登録するかどうかの整合は SYS-BUDGET-P02〜P05 の持ち越しとし、本 task では決定しない。
Open risk: Q-5 (増減率と季節性補正の読み) は agent 推定値として実装される前提を明記するだけに留め、本 task では値を決めない。
Open risk: migration 番号 0048 は予定番号であり、着手時に origin/main の最新番号と突き合わせることを本 task の docs に明記する。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 対象事項を検証可能な文に分解する
- Documentation: applicable: docs へ記録する
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/budget-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-budget-screen.md
- features/feat-budget-screen.md
- features/feat-budget-screen.context.json
- system-spec/00-requirements-definition.md
- Write scope/touches:
- docs/budget-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S5 と AT-01〜AT-22 が検証可能な文として docs に列挙され、各文に対応する spec の節番号が付いている。
- goal-spec.json の open_items 7 件 (Q-7 保存 batch の文数と D1 上限、収入行の差額の色、年額の下限、snapshot consumer とバックアップ write-set の整合、その他収入の manualOnly 行の扱い、Q-5 増減率・季節性補正の読み、migration 0048 の予定番号) が docs に転記され、それぞれの resolution_owner task (主に SYS-BUDGET-P05、migration 番号は SYS-BUDGET-P05 と SYS-BUDGET-P13) が明記されている。
- スコープ外 (予算の版管理、外部 LLM・外部データ、個人(家計)の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API の削除、既存 budgets 表の削除・書き換え) が docs に明記されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/budget-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-budget-screen.md
- Architecture: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Feature: feat-budget-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし
