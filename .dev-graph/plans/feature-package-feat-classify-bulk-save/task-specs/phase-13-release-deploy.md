# System task overlay: リリース: merge 前の最終確認、deploy.yml での migration の適用、本番の /classify での確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-bulk-save
- owners: ["daishiman"]
- tags: ["classify-bulk-save", "p13", "release"]
- related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
- parent_feature: feat-classify-bulk-save
- phase_ref: P13
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-bulk-save/sys-classify-bulk-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

利用者の承認を得て PR を main へ merge し、deploy.yml が web・Worker・migration 2 本を本番へ配信したことと、本番の /classify で指摘の場面が解消したことを確かめる。

## 背景

破壊的な migration は PR の merge を承認とし、main への merge で deploy.yml が本番へ届ける。CI は画面検査を走らせないので、merge の前に手元で verify:full を通す必要がある。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save, SYS-CLASSIFY-BULK-P12
- Entry gate: staging run plan-feat-classify-bulk-save-20261001T1245Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-CLASSIFY-BULK-P12 が完了していること
- Source pin: system-spec-harness v0.1.16 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: merge には利用者の承認が要る。PR の作成と merge は外部への操作なので、内容を示して確認を得てから行う。
制約: merge の前に origin/main を取り込み直し、migration の番号を突き合わせ直す (P08 の手順)。衝突していたら本 task では直さず P08 を差し戻し、P08 の後の P09〜P12 の記録を取り直してから本 task をやり直す。
制約: docs/classify-screen/bulk-save-evidence.md §5 には merge の前に確かめた事項 (verify:full などの exit code と OI-6 の突き合わせ) だけを書き、feature PR に含めて merge する。merge の後の事項は repository に書かない。
制約: bulk-save-decisions.md と bulk-save-evidence.md は P01 が置く節の担当表に従い、本 task の節だけを書く。他 phase の節は追記だけにして書き換えない (P03 が P02 の設計の節を訂正する場合を除く)。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: applicable: 本 phase の副次責務として扱う
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: applicable: 本 phase の主責務として扱う

## Architecture and deploy unit

- Architecture decisions: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Deploy unit/environment: web ビルドと Worker と D1 migration 2 本 (本番。main への merge で deploy.yml が配信する)
- Compatibility/migration/backfill: deploy.yml が migration を適用してから Worker を配信し、schema-guard が EXPECTED_D1_MIGRATION と適用済みの番号を照合する

## 成果物

- Produced artifacts:
- docs/classify-screen/bulk-save-evidence.md
- Consumed artifacts:
- docs/classify-screen/bulk-save-evidence.md
- docs/classify-screen/bulk-save-acceptance.md
- docs/classify-screen/bulk-save-review.md
- .github/migration-approvals.json
- Write scope/touches:
- docs/classify-screen/bulk-save-evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-BULK-P13 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-BULK-P13 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-BULK-P13 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-BULK-P12) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-classify-bulk-save.context.json の scope_out (選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更、要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更、分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更、絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作、取込 (CSV の読み込み) の仕様変更、証憑の添付と保管、モバイル・タブレット・デスクトップ専用アプリ、Workers Paid などの有料プランへの変更)
- feature の resource_scope の外にあるファイル (packages/api/wrangler.jsonc・.github/workflows/・packages/web/public/_headers・system-spec/ の章など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- merge の前に pnpm run verify:full・pnpm test・pnpm typecheck が手元で exit 0 である。
- merge の直前に origin/main を取り込み直し、migrations/ の最後と本 feature の 2 本の番号が衝突しないこと (OI-6) を突き合わせた commit とともに docs/classify-screen/bulk-save-evidence.md に記録し、feature PR を ready にして merge している。
- main への merge の後、deploy.yml で migration 0059・0060 が本番の D1 に適用され、schema-guard が通り、配信が成功している。
- 本番の /classify で sel に 50 件を選んだ状態を開き、選択一覧に全件が出て、一括指定で保存でき、取引一覧が 6 列で崩れないことを確かめている。
- merge 後の 2 点 (deploy.yml の実行結果と本番の /classify の確認) は、merge 済みの feature PR の最後のコメントに記録している (repository には書かず、docs だけの追従 PR は作らない。コメントも外部への操作なので、内容を示して確認を得てから書く。実データの値は載せない)。
- merge 後の 2 点は本 task の done の条件ではなく (done は default branch への merge で確定する)、done の後に行う確認として記録している。確認が失敗したら Rollback の手順で戻し、直しは別の feature として起こす (本 package の task を開き直さない)。
- Automated commands:
- pnpm run verify:full
- pnpm test
- pnpm typecheck
- Required evidence:
- docs/classify-screen/bulk-save-evidence.md

## Rollout and rollback

- Rollout: 本 feature は前サイクル (#75) と同じく 1 本の PR (feature PR) で main へ入れる。各 task の branch は直前の task の branch の先端から作り、完了時に feature PR の head branch (P01 が決めて記録する) を本 task の branch の先端へ fast-forward する。13 task の linked_pr_merged_all は P13 の merge 1 回で同時に満たされる。merge の直前に origin/main と突き合わせ直し、feature PR を ready にして merge する。merge 後の deploy と本番の確認は feature PR のコメントに記録する。
- Rollback trigger and steps: 本 task のコミットを revert してコードを戻す。適用済みの migration は残してよい (schema-guard は適用済みのほうが新しくても通る)。0060 を戻すときだけ deploy.yml の Time Travel の復元地点を使う。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.16 出力)
- Screen specification: specs/spec-classify-bulk-save.md
- Architecture: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Feature: feat-classify-bulk-save
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-BULK-P12
