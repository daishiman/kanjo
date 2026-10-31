---
graph_node_id: "SYS-CLASSIFY-BULK-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "core の解決関数・行の key・D1 上限の名前・対応表の API と表の名前・『カテゴリなし』の字面の設計"
project_id: "feature-package-feat-classify-bulk-save"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["classify-bulk-save", "p02", "preparation"]
file_path: "tasks/feat-classify-bulk-save/sys-classify-bulk-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "601543e1e9b218f5bfd0154e5e887113b4621fa8bd5dac9543062d77e1bde286", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-classify-bulk-save/plan-findings.json"}
source_lineage: {"imported_at": "2026-10-01T14:43:53Z", "origin_kind": "system-dev-planner", "source_digest": "601543e1e9b218f5bfd0154e5e887113b4621fa8bd5dac9543062d77e1bde286", "source_path": ".dev-graph/plans/feature-package-feat-classify-bulk-save/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-10-01T14:43:53Z"
updated_at: "2026-10-01T14:43:53Z"
depends_on: ["SYS-CLASSIFY-BULK-P01"]
related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
resource_scope: ["docs/classify-screen/bulk-save-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-classify-bulk-save"
feature_package_id: "feature-package/feat-classify-bulk-save"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-classify-bulk-save/sys-classify-bulk-p02.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-10-01T14:41:20Z", "missing_sections": [], "status": "complete"}
---

# core の解決関数・行の key・D1 上限の名前・対応表の API と表の名前・『カテゴリなし』の字面の設計

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-classify-bulk-save
- owners: ["daishiman"]
- tags: ["classify-bulk-save", "p02", "preparation"]
- related_nodes: ["arch-classify-bulk-save-auth", "arch-classify-bulk-save-backend", "arch-classify-bulk-save-database", "arch-classify-bulk-save-frontend", "arch-classify-bulk-save-infrastructure", "arch-classify-bulk-save-maintenance-ops", "arch-classify-bulk-save-security", "arch-classify-bulk-save-ui-ux", "spec-classify-bulk-save"]
- parent_feature: feat-classify-bulk-save
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-classify-bulk-save/sys-classify-bulk-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P05 が迷わず実装できるよう、core の解決関数・行の key と選べない行の判定・D1 上限の 2 つの名前・勘定科目の対応表の API と表の名前・『カテゴリなし』の字面・提案の入力の形を設計として決め、docs に記す。

## 背景

spec は契約を決めたが、名前と置き場所の一部 (未決事項 5・6) を実装時に委ねている。今は resolveBulkItem (packages/web/src/pages/classify/view-model.ts:309-327) と inputFromRow (同 :98-100) の 2 つの分岐があり、同じ値 50 が import-lifecycle.ts:305・scheduled-maintenance-budget.ts:13・routes/classify.ts:90・routes/classify-bulk.ts:44 の 4 か所に散り、classifySuggestion は 6 か所で入力を組み立てている。設計を先に 1 つに決めないと、P05 で同じ判定が複数の場所に再び生まれる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save, SYS-CLASSIFY-BULK-P01
- Entry gate: staging run plan-feat-classify-bulk-save-20261001T1245Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-CLASSIFY-BULK-P01 が完了していること
- Source pin: system-spec-harness v0.1.16 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
制約: 予約の値は packages/core/src/categories.ts の候補と衝突させない。対応表の API は既存の設定 API (routes/settings.ts・routes/settings-screen.ts) の並びに合わせ、canonical-mutation-fence を通す。D1 の上限は 1 起動の合計と batch の文の 2 つの名前に分け、値 (50) は変えない。
Open risk: 対応表の API のパスと表・列の名前 (未決事項 5。OI-2) と予約の値の字面 (未決事項 6。OI-3) は agent の案で決め、agent 推定であることを docs に区別して書く。
制約: 前サイクル (#75) が共通化した部品を使い、同じ責務の定義を新設しない。エラー本文は packages/api/src/public-validation.ts の errorBody、利用者ごとの応答の Cache-Control は PRIVATE_NO_STORE、JSON 入力の検査は publicJsonValidator を使う。取込や他の更新との競合は canonical-mutation-fence.ts の canonicalWriteBusy (409 canonical_write_busy)、D1 の混雑は index.ts の app.onError が返す 503 d1_overloaded (retryable) に任せる。
制約: bulk-save-decisions.md と bulk-save-evidence.md は P01 が置く節の担当表に従い、本 task の節だけを書く。他 phase の節は追記だけにして書き換えない (P03 が P02 の設計の節を訂正する場合を除く)。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: applicable: 本 phase の副次責務として扱う
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: applicable: 本 phase の主責務として扱う
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-classify-bulk-save-auth, arch-classify-bulk-save-backend, arch-classify-bulk-save-database, arch-classify-bulk-save-frontend, arch-classify-bulk-save-infrastructure, arch-classify-bulk-save-maintenance-ops, arch-classify-bulk-save-security, arch-classify-bulk-save-ui-ux, spec-classify-bulk-save
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみで、DB・API・画面の互換に影響しない (migration 0059・0060 の中身は設計として記すだけで、作るのは P05)

## 成果物

- Produced artifacts:
- docs/classify-screen/bulk-save-decisions.md
- Consumed artifacts:
- docs/classify-screen/bulk-save-decisions.md
- specs/spec-classify-bulk-save.md
- architecture/classify-bulk-save-backend.md
- architecture/classify-bulk-save-database.md
- architecture/classify-bulk-save-frontend.md
- Write scope/touches:
- docs/classify-screen/bulk-save-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CLASSIFY-BULK-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CLASSIFY-BULK-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CLASSIFY-BULK-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CLASSIFY-BULK-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-classify-bulk-save.context.json の scope_out (選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更、要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更、分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更、絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作、取込 (CSV の読み込み) の仕様変更、証憑の添付と保管、モバイル・タブレット・デスクトップ専用アプリ、Workers Paid などの有料プランへの変更)
- feature の resource_scope の外にあるファイル (packages/api/wrangler.jsonc・.github/workflows/・packages/web/public/_headers・system-spec/ の章など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- core の解決関数の入出力 (一括指定・下書き・提案・今の値・分類の状態から、保存する値・値の出所・外す理由を返す) と、FR-02・FR-03・FR-05 を満たす分岐が docs に書かれ、web の内訳とサーバの保存が同じ関数を呼ぶ構成になっている。
- 行の key と選べない行 (分割の内訳行・分割の設定が不正な行) の判定を core の 1 か所に置く設計が書かれ、key の接頭辞だけで判定しないこと (FR-08) が明記されている。
- packages/api/src/d1-limits.ts に置く 2 つの名前 (1 起動の合計と batch の文) と、置き換える 4 か所 (import-lifecycle.ts:305・scheduled-maintenance-budget.ts:13・routes/classify.ts:90・routes/classify-bulk.ts:44) が書かれている。
- 勘定科目の対応表の API のパスと表・列の名前、migration 0059 (表と既存の持ち主への初期の 5 行) と 0060 (設定の変更履歴の対象に対応表を足す作り直し) の中身が、未決事項 5 の案として書かれ、spec の 0058・0059 との対応が注記されている。
- 新しい route (選択の読み出し・対応表) と書き換える route (一括保存・一覧) のエラー本文・Cache-Control・入力の検査・競合・D1 の混雑の扱いが、public-validation.ts の errorBody・PRIVATE_NO_STORE・publicJsonValidator、canonicalWriteBusy、index.ts の app.onError の 503 d1_overloaded を使う形で書かれ、新しく定義する同種の関数が 0 件である。一括保存は json_each で束ねた 1 回の batch で書くので、index.ts の『未適用と保証できるのは 1 batch の route だけ』の注記に一括保存を足すことも書かれている。
- 『カテゴリなし』の予約の値の字面と、未分類と同じ扱いに通す箇所 (家計の集計・総収支の内訳・説明可能率・分類の状態・候補の検査・履歴・バックアップ。FR-18) の一覧が、未決事項 6 の案として書かれている。
- classifySuggestion の 6 か所 (overview.ts:254・:339、classify-row.ts:52・:151、routes/classify-bulk.ts:155、routes/classify.ts:514) の入力を 1 つの組み立て関数にまとめる形、legacyBasisLabel (overview.ts:265) の削除、RecommendationBasis を SuggestionBasis の別名にすることが書かれている。
- Automated commands:
- pnpm lint
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
- Dependencies: SYS-CLASSIFY-BULK-P01
