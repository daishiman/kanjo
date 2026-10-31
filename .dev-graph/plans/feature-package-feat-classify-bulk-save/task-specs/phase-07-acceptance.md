# System task overlay: 受入の確認: AC-01〜AC-30 の根拠の表と、sel に 50 件を選んだ状態の再現

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-bulk-save
- owners: ["daishiman"]
- tags: ["classify-bulk-save", "p07", "acceptance"]
- related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
- parent_feature: feat-classify-bulk-save
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-bulk-save/sys-classify-bulk-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

利用者の指摘 (選択した項目の読み込みと取引一覧の取引設定) が解消したことを、AC-01〜AC-30 の根拠と画面の再現で確かめる。

## 背景

指摘は本番の /classify で sel に 50 件を選んだ状態の画像から出た。テストが緑でも、指摘の場面を再現して解消を見ないと、本質的な解決かどうかは分からない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save, SYS-CLASSIFY-BULK-P06
- Entry gate: staging run plan-feat-classify-bulk-save-20261001T1245Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-CLASSIFY-BULK-P06 が完了していること
- Source pin: system-spec-harness v0.1.16 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
制約: 再現には samples/ の匿名化済みデータだけを使い、data/ の実データを記録に載せない。samples/ は読むだけにする (samples/*.csv は scripts/seed-local.mjs の生成物で、直接の編集は次の生成で上書きされる)。画面検査の画像は既定の KANJO_VISUAL_OUTPUT_DIR (tmpdir) に置き、repository に置かない。
制約: 再現の手順。web の vite は /api を http://localhost:8787 へ中継し、scripts/seed-local.mjs の送信先 (KANJO_BASE_URL) も既定は 8787 なので、8787 で本 worktree の api (pnpm --filter @kanjo/api dev) が動いていることを確かめてから seed を既定のシナリオで走らせる。8787 を別の worktree が使っていれば止めずに利用者に確認する。seed は samples/*.csv を書き直すので、走らせた後に git status samples/ で差分が無いことを確かめ、差分が出たら git checkout -- samples/ で戻す。
Blocker: wrangler dev がメモリ逼迫などで起動できないときは再試行を重ねず、利用者に起動を依頼する。再現できるまで本 task を完了しない (テストの緑だけで指摘の解消を判断しない)。
制約: 落ちた原因が実装かテストにあれば本 task の中では直さず、原因と担当 phase (P04 か P05) を記録してその task を差し戻し、直った後に本 task をやり直す。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Deploy unit/environment: N/A: 検証記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 検証記録のみで、DB・API・画面の互換に影響しない

## 成果物

- Produced artifacts:
- docs/classify-screen/bulk-save-acceptance.md
- Consumed artifacts:
- specs/spec-classify-bulk-save.md
- docs/classify-screen/bulk-save-evidence.md
- samples/
- Write scope/touches:
- docs/classify-screen/bulk-save-acceptance.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-BULK-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-BULK-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-BULK-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-BULK-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-classify-bulk-save.context.json の scope_out (選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更、要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更、分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更、絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作、取込 (CSV の読み込み) の仕様変更、証憑の添付と保管、モバイル・タブレット・デスクトップ専用アプリ、Workers Paid などの有料プランへの変更)
- feature の resource_scope の外にあるファイル (packages/api/wrangler.jsonc・.github/workflows/・packages/web/public/_headers・system-spec/ の章など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- AC-01〜AC-30 の各行に根拠 (テスト名・画面検査の結果・コマンドの exit code) が付いた表が docs/classify-screen/bulk-save-acceptance.md にあり、根拠の無い行が 0 件である。
- 1264px と 1280px の画面検査 (AC-22) で、6 列が最小幅以上、本体の横はみ出しが 0、編集パネルを閉じると一覧が広がることが記録されている。
- samples/ のデータで sel に 50 件を選んだ状態を再現し、表示外の明細を含む選択一覧が全件出ること、提案の無い明細も一括指定で保存できること、保存前の内訳の式 (選択 = 保存 + 外す + 見つからない) が成り立つことが記録されている。
- Automated commands:
- pnpm --filter @kanjo/web run check:classify-screen
- pnpm --filter @kanjo/web test
- Required evidence:
- docs/classify-screen/bulk-save-acceptance.md

## Rollout and rollback

- Rollout: 本 feature は前サイクル (#75) と同じく 1 本の PR (feature PR) で main へ入れる。各 task の branch は直前の task の branch の先端から作り、完了時に feature PR の head branch (P01 が決めて記録する) を本 task の branch の先端へ fast-forward する。13 task の linked_pr_merged_all は P13 の merge 1 回で同時に満たされる。
- Rollback trigger and steps: 本 task のコミットを revert する。docs/classify-screen/bulk-save-acceptance.md の追記を戻すだけで、コードと DB に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.16 出力)
- Screen specification: specs/spec-classify-bulk-save.md
- Architecture: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Feature: feat-classify-bulk-save
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CLASSIFY-BULK-P06
