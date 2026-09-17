# System task overlay: 単一 PR での配信と close-out

## Machine-readable registration fields

- feature_package_id: feature-package/feat-trends-screen
- owners: ["daishiman"]
- tags: ["trends-screen", "p13", "release"]
- related_nodes: ["arch-trends-screen-auth", "arch-trends-screen-backend", "arch-trends-screen-database", "arch-trends-screen-frontend", "arch-trends-screen-infrastructure", "arch-trends-screen-maintenance-ops", "arch-trends-screen-security", "arch-trends-screen-ui-ux", "spec-trends-screen"]
- parent_feature: feat-trends-screen
- phase_ref: P13
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-trends-screen/sys-trends-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

pnpm verify:full を通したうえで単一の PR を作り、merge 後に本番の /analysis/trends を確認して close-out を記録する。

## 背景

リリースは既存の deploy.yml の経路で、migration は無い。ロールバックは Worker を前の版へ戻すだけである。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Entry gate: SYS-TRENDS-P12 が完了し、その成果物が default branch に取り込まれていること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 task はこの層のコードを変更しない
- Backend: N/A: 本 task はこの層のコードを変更しない
- API: N/A: 本 task はこの層のコードを変更しない
- Data: N/A: 本 task はこの層のコードを変更しない
- Infrastructure: applicable: deploy.yml の経路で配信され、migration の適用が無いことを確認する
- Security: N/A: 本 task はこの層のコードを変更しない
- Quality: applicable: pnpm verify:full を実行する
- Documentation: applicable: docs/trends-screen/close-out.md を新設する
- Operations: applicable: 本番の /analysis/trends と /classify の絞込を確認する

## Architecture and deploy unit

- Architecture decisions: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Deploy unit/environment: Cloudflare Workers kanjo-console (既存の deploy.yml の経路)。migration を伴わない。
- Compatibility/migration/backfill: migration を伴わない。GET /api/trends は追加だけで、旧 /trends からの転送を維持する。

## 受入基準

- pnpm verify:full が緑である。
- PR 本文に graph_node_id と受入 S1〜S6 の証跡索引が書かれている。
- merge 後の本番で /analysis/trends が表示され、close-out.md に確認日時が記録されている。

## 成果物

- Produced artifacts:
- docs/trends-screen/close-out.md
- Consumed artifacts:
- docs/trends-screen/evidence.md
- docs/trends-screen.md
- Write scope/touches:
- docs/trends-screen/close-out.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRENDS-P13 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRENDS-P13 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRENDS-P13 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRENDS-P12) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (収入・支出・純収支以外の指標 (件数・口座別残高など) の実装: 登録制の型だけ用意し、指標の追加は後続で行う (利用者の選択による)・取引先の名寄せ規則: 明細の内容をそのまま取引先として集計する (利用者の選択による)・AI による説明文の生成と利用者のメモ入力: 規則による自動生成だけにする (利用者の選択による)・共通シェル (サイドバー・ヘッダー・フッター・月次クローズの進捗) の変更: 既存の共通シェルをそのまま使う・照合・総収支・マトリクス・診断の各タブの中身: それぞれの画面サイクルで扱う・web 以外の platform (専用アプリ))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm verify:full
- Required evidence:
- docs/trends-screen/close-out.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: Cloudflare Workers の前の版へ戻す。D1 を変えていないため、データの巻き戻しは要らない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)、specs/spec-trends-screen.md
- Architecture: arch-trends-screen-auth, arch-trends-screen-backend, arch-trends-screen-database, arch-trends-screen-frontend, arch-trends-screen-infrastructure, arch-trends-screen-maintenance-ops, arch-trends-screen-security, arch-trends-screen-ui-ux, spec-trends-screen
- Feature: feat-trends-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRENDS-P12
