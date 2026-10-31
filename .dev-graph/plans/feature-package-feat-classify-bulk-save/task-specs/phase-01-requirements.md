# System task overlay: 一括保存の要件の棚卸し: FR・BR・AC と未決事項の担当 phase の確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-classify-bulk-save
- owners: ["daishiman"]
- tags: ["classify-bulk-save", "p01", "requirements"]
- related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
- parent_feature: feat-classify-bulk-save
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-bulk-save/sys-classify-bulk-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

spec-classify-bulk-save の FR-01〜FR-19・BR-01〜BR-15・AC-01〜AC-30 を担当 phase へ割り当て、未決事項 1〜7 の閉じ方と担当を確定し、goal-spec.json の open_items を後続 phase の resolution_owner へ引き継ぐ。

## 背景

本番の /classify で sel に 50 件を選んだ状態から『選択した項目の読み込み、取引一覧の取引設定がうまくできていない』との指摘があった。spec は値の解決・書き込みの単位・再試行・一覧の列と表示件数・一覧 API の互換を置き換え、勘定科目の対応表と『カテゴリなし』の予約の値を足す。前サイクル (feat-classify-screen) の画面骨格・KPI・絞り込み・編集パネル・分割・ルール・下書きは引き継ぐ。どの契約を置き換えどれを引き継ぐかが決まっていないと、P04 のテストの範囲と P05 の write_scope が揺れる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Entry gate: staging run plan-feat-classify-bulk-save-20261001T1245Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.16 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Entry step: 着手前に SPEC_BASE (P01 の着手前に、仕様サイクルと dev-graph 登録の成果物 — 章の markdown と archive・specs・architecture・features・tasks・.dev-graph/plans と requirements — だけを入れた commit) を作り、その commit id を docs/classify-screen/bulk-save-decisions.md に記録する。commit は利用者の指示を得てから行う。P10 は SPEC_BASE からの差分だけを本 feature の実装として調べる。
制約: specs/spec-classify-bulk-save.md と system-spec/ の章は書き換えない (check-graph-lineage が章の digest を照合する)。訂正が要る箇所は docs に記録し、次の system-spec の改訂へ回す。specs/spec-classify-bulk-save.md と system-spec/ の章が書く 0058・0059 は a63d35c 時点の予定番号で、origin/main 9b5bbf3 の最後は 0058_subscription_merge_operations.sql なので、本 package は 0059・0060 と書く。migration の名前の正本は migrations/ の実ファイル (SPEC_BASE からの差分で足した 2 本) で、文書の番号はそれに従う。
Open risk: 未決事項 2 の 3 点 (表示件数の既定 50 件・選択の key の上限 200 字・一括保存の旧形式の受け付け。OI-1) は利用者が未確認のまま章の値で実装し、P05 の PR で示す。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の副次責務として扱う
- Documentation: applicable: 本 phase の主責務として扱う
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみで、DB・API・画面の互換に影響しない

## 成果物

- Produced artifacts:
- docs/classify-screen/bulk-save-decisions.md
- Consumed artifacts:
- specs/spec-classify-bulk-save.md
- features/feat-classify-bulk-save.md
- features/feat-classify-bulk-save.context.json
- Write scope/touches:
- docs/classify-screen/bulk-save-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-BULK-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-BULK-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-BULK-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on は無く、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-classify-bulk-save.context.json の scope_out (選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更、要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更、分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更、絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作、取込 (CSV の読み込み) の仕様変更、証憑の添付と保管、モバイル・タブレット・デスクトップ専用アプリ、Workers Paid などの有料プランへの変更)
- feature の resource_scope の外にあるファイル (packages/api/wrangler.jsonc・.github/workflows/・packages/web/public/_headers・system-spec/ の章など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- FR-01〜FR-19・BR-01〜BR-15・AC-01〜AC-30 の担当表が docs/classify-screen/bulk-save-decisions.md にあり、各 id に担当 phase (SYS-CLASSIFY-BULK-P02〜P13) が付き、担当の無い id が 0 件である。
- spec の未決事項 1〜7 の閉じ方と担当が、goal-spec.json の open_items の id とともに記されている。2 (OI-1) と 7 (OI-4) は P05 が案と依頼文を feature PR に載せ P12 が利用者の判断を記録して閉じ、5 (OI-2) は P02 で案を決め P05 で実装し P12 で docs/data-schema.md と architecture 文書に書いて閉じ、6 (OI-3) は P02 で案を決め P05 で候補の作成の拒否のテストとともに閉じ、1・3・4 (OI-5) は次の system-spec の改訂へ持ち越して P12 で記録する。
- docs/classify-screen/bulk-save-decisions.md の先頭に、2 つの共有文書の節の担当表 (bulk-save-decisions.md は §1 要件の担当表と PR の単位 (P01)・§2 設計 (P02)・§3 設計の照合 (P03)・§4 実装の判断と利用者への依頼文 (P05)・§5 未決事項の閉じ方 (P12)、bulk-save-evidence.md は §1 先行テスト (P04)・§2 テストの実行 (P06)・§3 定義の削除と migration の突き合わせ (P08)・§4 品質ゲート (P09)・§5 リリース (P13)) と、feature PR の head branch の名前と PR の単位 (本 feature は前サイクル (#75) と同じく 1 本の PR (feature PR) で main へ入れる。各 task の branch は直前の task の branch の先端から作り、完了時に feature PR の head branch (P01 が決めて記録する) を本 task の branch の先端へ fast-forward する。13 task の linked_pr_merged_all は P13 の merge 1 回で同時に満たされる) が書かれている。
- docs/classify-screen/bulk-save-decisions.md に SPEC_BASE の commit id が記録され、git status で仕様サイクルと dev-graph 登録の成果物に未コミットの変更が 0 件である。
- 前サイクル (feat-classify-screen) から置き換える契約 (値の決め方・書き込みの単位・再試行・一覧の列と表示件数・一覧 API の互換) と引き継ぐ契約 (画面骨格・KPI・絞り込み・編集パネル・分割・ルール・下書き) が分けて書かれ、前サイクルの文書 (docs/classify-screen/design-decisions.md・specs/spec-classify-screen.md) を書き換えていない。
- features/feat-classify-bulk-save.context.json の scope_out 7 項目が制約として転記され、選択の上限 50 と一括保存の上限 100・要確認の閾値 80・既存の由来の信頼度 95・85・70 を変えないことが明記されている。
- Automated commands:
- pnpm lint
- git status --porcelain
- Required evidence:
- docs/classify-screen/bulk-save-decisions.md

## Rollout and rollback

- Rollout: 本 feature は前サイクル (#75) と同じく 1 本の PR (feature PR) で main へ入れる。各 task の branch は直前の task の branch の先端から作り、完了時に feature PR の head branch (P01 が決めて記録する) を本 task の branch の先端へ fast-forward する。13 task の linked_pr_merged_all は P13 の merge 1 回で同時に満たされる。
- Rollback trigger and steps: 本 task のコミットを revert する。docs/classify-screen/bulk-save-decisions.md の追記を戻すだけで、コードと DB に影響しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.16 出力)
- Screen specification: specs/spec-classify-bulk-save.md
- Architecture: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Feature: feat-classify-bulk-save
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし
