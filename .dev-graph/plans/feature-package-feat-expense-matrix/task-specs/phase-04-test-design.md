# System task overlay: core 境界値・API 契約・DOM の失敗テスト先行作成 (持ち越し4件を契約テストで固定)

## Machine-readable registration fields

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p04", "test-design"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

実装前に落ちるテストが存在し、集計・階級・順位・API 契約・URL 復元・詳細パネルの各規則が厳密一致で固定された状態にする。持ち越し4件はここで契約テストとして値を確定する。

## 背景

テストが旧実装に対して落ちることを確かめない限り、緑は何も証明しない。maintenance-ops 章は合計と平均と階級と順位の三点を同時に固定することを求めており、§3.5 の検算値 (仕入高 367.4 と 30.6、人件費 214.8 と 17.9、家賃と地代 144.0 と 12.0、広告宣伝費 110.6 と 9.2、外注費 115.9 と 9.7、通信費 28.7 と 2.4、その他 81.2 と 6.8、総計 1,062.6 と平均 88.5) をフィクスチャの正本とする。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: DOM テストで画面の構成要素と URL 復元を固定する
- Backend: applicable: core の境界値テストで集計規則を固定する
- API: applicable: クエリ検証と応答形の契約テストを置く
- Data: applicable: 未記帳月とデータ欠測の扱いをテストで固定する
- Infrastructure: N/A: 配信構成に変更なし
- Security: applicable: 許可リスト外の入力と未認証要求の期待応答を固定する
- Quality: applicable: 旧実装に対して落ちることを確認する
- Documentation: applicable: 確定した持ち越し事項を requirements-baseline.md へ反映する
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: N/A: テストコードは配布物に含まれない
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- packages/core/test/matrix-contract.test.ts
- packages/api/test/matrix-routes.test.ts
- packages/web/src/matrix-cell.dom.test.tsx
- Consumed artifacts:
- docs/matrix/design-decisions.md
- docs/matrix/requirements-baseline.md
- specs/spec-expense-matrix-screen.md
- Write scope/touches:
- packages/core/test/matrix-contract.test.ts
- packages/api/test/matrix-routes.test.ts
- packages/web/src/matrix-visual.dom.test.tsx
- packages/web/src/matrix-legend.dom.test.tsx
- packages/web/src/matrix-cell.dom.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-MATRIX-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test (新規の境界値テストが実装前に落ちることを確認する)
- pnpm --filter @kanjo/api test (新規の API テストが実装前に落ちることを確認する)
- pnpm --filter @kanjo/web test (新規の DOM テストが実装前に落ちることを確認する)
- Required evidence:
- packages/core/test/matrix-contract.test.ts
- packages/api/test/matrix-routes.test.ts
- packages/web/src/matrix-cell.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 追加および更新したテストファイルのコミットを revert する。製品コードへ未反映のため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-MATRIX-P03
