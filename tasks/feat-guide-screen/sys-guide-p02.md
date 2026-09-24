---
graph_node_id: "SYS-GUIDE-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "guide-screen・信頼度の段階関数・防衛ライン算出定数・shiftedPeriod の core 移設・GET /api/guide・フッタ文言のワークストリーム設計決定記録"
project_id: "feature-package-feat-guide-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["guide-screen", "p02", "preparation"]
file_path: "tasks/feat-guide-screen/sys-guide-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-guide-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-23T14:06:55Z", "origin_kind": "system-dev-planner", "source_digest": "9273432a11546de4cff49f065afa909d75d22b2eabad97f7dceb15abf2258f62", "source_path": ".dev-graph/plans/feature-package-feat-guide-screen/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-23T14:06:55Z"
updated_at: "2026-09-23T14:33:57Z"
depends_on: ["SYS-GUIDE-P01"]
related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
resource_scope: ["docs/guide-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-guide-screen"
feature_package_id: "feature-package/feat-guide-screen"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-guide-screen/sys-guide-p02.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-ogz.2", "linked_at": "2026-09-23T14:33:57Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-23T13:50:09Z", "missing_sections": [], "status": "complete"}
---

# guide-screen・信頼度の段階関数・防衛ライン算出定数・shiftedPeriod の core 移設・GET /api/guide・フッタ文言のワークストリーム設計決定記録

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-guide-screen
- owners: ["daishiman"]
- tags: ["guide-screen", "p02", "preparation"]
- related_nodes: ["arch-guide-auth", "arch-guide-backend", "arch-guide-database", "arch-guide-frontend", "arch-guide-infrastructure", "arch-guide-maintenance-ops", "arch-guide-security", "arch-guide-ui-ux", "spec-guide-screen"]
- parent_feature: feat-guide-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-guide-screen/sys-guide-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core の guide-screen・信頼度の段階関数・防衛ラインの算出期間の定数・shiftedPeriod の core 移設・GET /api/guide の応答形・web の分割構成・共通シェルのフッタ文言を、実装前に 1 つの設計決定記録へ固定する。

## 背景

『直近3か月』は glossary.ts:45-49 (用語集の説明文)・guide-sections.ts:57-60 (現在値の合成)・analysis.ts:1095 (pMonths.slice(-3)) に直書きされ、説明と算出がずれうる。shiftedPeriod は pages/statements/view-model.ts:121 にあり、使い方画面と共有できない。これらを core の 1 か所に寄せる経路を P04 のテストより先に決める。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen, SYS-GUIDE-P01
- Entry gate: staging run plan-feat-guide-screen-20260923T1350Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-GUIDE-P01 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: 防衛ラインの算出期間 3 は analysis.ts:1095 の直書きであり、core の名前付き定数へ置き換えて公開する (値は変えない)。glossary.ts:45-49 と guide-sections.ts:57-60 の説明文はその定数から組む。check-glossary (scripts/check-glossary.mjs) が GLOSSARY の本文を文字列として読むため、説明文を定数から組む書き方が check-glossary を通るかを設計で確かめる (scripts/check-glossary.mjs 自体は本 feature の scope 外で書き換えない)。
Blocker: shiftedPeriod の移設先は packages/core/src/period.ts とし、呼出元 pages/statements/StatementsPage.tsx:20,32-33 と statements-view-model.test.ts:93-100 の扱い (core から再輸出するか import を付け替えるか) を決める。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: applicable: 本 phase の副次責務として扱う
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 本 phase の副次責務として扱う
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: applicable: 本 phase の主責務として扱う
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: DB の表・列・migration を足さない (C2、qa-guide-database-web-002)。schema-guard.ts の EXPECTED_D1_MIGRATION は据え置き、既存行の書き換えと backfill は 0 件

## 成果物

- Produced artifacts:
- docs/guide-screen/design-decisions.md
- Consumed artifacts:
- docs/guide-screen/design-decisions.md
- specs/spec-guide-screen.md
- architecture/guide-backend.md
- architecture/guide-frontend.md
- Write scope/touches:
- docs/guide-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-GUIDE-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-GUIDE-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-GUIDE-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-GUIDE-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-guide-screen.context.json の scope_out (利用規約・プライバシーの専用ページ、ガイド本文の管理画面や DB 保存、自動判定 (要確認の閾値 REVIEW_CONFIDENCE_THRESHOLD = 80・由来ごとの信頼度) の規則変更、防衛ラインの算出変更、共通ヘッダの呼称変更、サイドバーの並び・バッジ・月次クローズ進捗の変更、DB の表・列・migration の追加、モバイル・タブレット・デスクトップ専用アプリ、税務判断)
- feature の resource_scope の外にあるファイル (scripts/check-glossary.mjs・docs/data-schema.md・migrations など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- packages/core/src/guide-screen.ts (新設) の入出力 (GuideScreen の period・totals・dataUpdatedAt・sources・closeStatus)、節 7 つ・ステップ 4 つ・よくある疑問 5 行・期間の表 4 行・このページの数値 4 項目・関連ページ 5 件・ガイド内検索の純関数の分け方が docs に記されている。
- 信頼度の段階関数と境界定数 (80 / 50) の置き場所が決まり、REVIEW_CONFIDENCE_THRESHOLD = 80 と別の定数にするか共有するか、どちらでも単体テストで両者が 80 であることを固定する方針が記されている。
- 防衛ラインの算出期間の名前付き定数 (値 3) の置き場所と、それを使う説明文の組み方 (glossary.ts:45-49・guide-sections.ts:57-60 の置き換え、analysis.ts:1095 の置き換え) が記されている。
- GET /api/guide を packages/api/src/routes/analytics.ts の analyticsRoute に置き、loadScoped の 1 回の loadDataset と loadCloseStatus (analytics.ts:199) だけで作り、防衛ラインの値を返さない構成が記されている。index.ts の CSP と authGuard・mustChangePasswordFence は変えない。
- web の分割 (packages/web/src/pages/guide/ 配下、core を import するのは view-model.ts だけ、旧 pages/Guide.tsx は再輸出 1 行) と URL の topic / q の扱いが記されている。
- 共通シェルのフッタ 1 文目を『取込データは外部送信しません』にし、AI 送信の補足をフッタの title・プライバシー欄・使い方画面の 3 か所に置き、ヘッダの『防衛ライン』は変えない配置が記されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/guide-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-guide-screen.md
- Architecture: arch-guide-auth, arch-guide-backend, arch-guide-database, arch-guide-frontend, arch-guide-infrastructure, arch-guide-maintenance-ops, arch-guide-security, arch-guide-ui-ux, spec-guide-screen
- Feature: feat-guide-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-GUIDE-P01
