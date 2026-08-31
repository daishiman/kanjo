---
graph_node_id: SYS-MOBFIN-P04
artifact_kind: task
artifact_subtypes: []
title: figure parityと実Chrome回帰をテストファースト設計
project_id: feature-package-feat-mobile-financial-visualization
domain: quality
status: active
owners: []
tags:
- mobile
- test-first
- chrome
priority: null
start_date: null
target_date: null
iteration: null
created_at: '2026-08-30T10:09:51Z'
updated_at: '2026-08-30T12:06:09Z'
depends_on:
- SYS-MOBFIN-P03
related_nodes:
- spec-mobile-financial-visualization
- arch-mobile-financial-frontend
resource_scope:
- packages/web/src/mobile-financial-visualization.dom.test.tsx
- packages/web/src/mobile-financial-layout.test.ts
- packages/web/scripts/check-mobile-financial-layout.mjs
parent_feature: feat-mobile-financial-visualization
feature_package_id: feature-package/feat-mobile-financial-visualization
phase_ref: P04
file_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p04.md
template_id: task
template_version: 1.0.0
confirmation_status: confirmed
evaluation_status: pass
confirmation_evidence:
  evaluator: system-dev-plan-evaluator
  evidence_ref: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/plan-findings.json
  evaluated_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
source_lineage:
  origin_kind: system-dev-planner
  source_plugin: system-dev-planner
  source_path: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-04-test-design.md
  source_version: 0.1.0
  source_digest: e4745a1c30c978feee27da5d14e3bcd1bd0dfbbca3f55483b63524009796ceda
  imported_at: '2026-08-30T10:09:51Z'
classification_confidence: 1
classification_reason: 実装前に意味情報、寸法、overflow、操作領域の失敗を再現する自動契約を作る作業。
classification_candidates:
- artifact_kind: task
  confidence: 1
  candidate_path: tasks/feat-mobile-financial-visualization/sys-mobfin-p04.md
github_publication:
  mode: local_only
  project_aliases: []
  labels: []
  milestone: null
issue_linkage: null
tracker_binding: beads
beads_linkage:
  bd_issue_id: kanjo-dy9.4
  linked_at: '2026-08-30T12:06:09Z'
  sync_state: synced
  github_mirror: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence:
  policy: linked_pr_merged_all
  status: in_progress
  source: null
  completed_at: null
  reconciled_at: null
  evidence_refs: []
implementation_readiness:
  status: complete
  missing_sections: []
  checked_at: '2026-08-30T09:44:51Z'
purpose: 意味情報parity、canvas非0寸法、document overflow、局所scroll、44px操作、200% zoomを実装前に失敗として再現するunit、DOM、実Chrome契約を作る。
goal: figure parityと実Chrome回帰をテストファースト設計を、受入条件と検証可能な証跡を満たした状態で完了する。
scope_in:
- packages/web/src/mobile-financial-visualization.dom.test.tsx
- packages/web/src/mobile-financial-layout.test.ts
- packages/web/scripts/check-mobile-financial-layout.mjs
scope_out:
- production API、D1、login、real transaction dataへの接続
- P05実装をtest作成と同時に行うこと
acceptance:
- 'Automated commands: `pnpm --filter @kanjo/web test -- mobile-financial-visualization.dom.test.tsx
  mobile-financial-layout.test.ts`'
- 'Required evidence: P05前に対象assertionが期待理由でFAILするred output、viewport 360、375、390、768、1280と200%相当の検査表'
architecture_refs:
- arch-mobile-financial-frontend
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-mobile-financial-visualization/task-specs/phase-04-test-design.md` は promotion 時点の staging snapshot です。promotion 後の更新は本書へ記録します。

# System task overlay: figure parityと実Chrome回帰をテストファースト設計

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P04
- phase_ref: P04
- owners: schedulerがlease時に割当
- tags: mobile、test-first、chrome
- related_nodes: spec-mobile-financial-visualization、arch-mobile-financial-frontend
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

意味情報parity、canvas非0寸法、document overflow、局所scroll、44px操作、200% zoomを実装前に失敗として再現するunit、DOM、実Chrome契約を作る。

## 背景

jsdomはlayoutを計算できず、CSS文字列検査だけでは実際の0寸法と横あふれを検出できない。純関数、DOM semantics、headless Chrome実測を組み合わせる。

## 前提条件

- SYS-MOBFIN-P03がPASSである
- packages/web既存Vitestとpackages/web/scripts/headless-chrome.mjsを再利用する
- 合成された匿名fixtureだけを使う

## Workstream applicability

- Frontend: 該当。DOMとCSS実測のfixtureを作る。
- Backend: N/A: backendは起動しない。
- API: N/A: network contractはmockする。
- Data: N/A: persisted dataは使わない。
- Infrastructure: N/A: CI変更は行わない。
- Security: N/A: secret不要のfixtureに限定する。
- Quality: 該当。失敗先行の自動contractが主成果物。
- Documentation: 該当。red結果と期待値を記録する。
- Operations: N/A: local headless Chromeだけを使う。

## Architecture and deploy unit

- Architecture decisions: pure model test、React DOM contract、real layout measurementの三層を分離する。
- Deploy unit/environment: packages/web Vitestとlocal Google Chrome。
- Compatibility/migration/backfill: 既存mobile-layout-render patternを壊さず新しい財務figure検査を追加する。

## 成果物

- Produced artifacts: packages/web/src/mobile-financial-visualization.dom.test.tsx、packages/web/src/mobile-financial-layout.test.ts、packages/web/scripts/check-mobile-financial-layout.mjs、phase-04 red evidence
- Consumed artifacts: phase-02-figure-contract.md、phase-03-design-review.md、packages/web/scripts/headless-chrome.mjs
- Write scope/touches: 上記新規test二件とscript一件、phase evidenceだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: test producerはtrackerを直接更新しない

## Branch and worktree execution

- Branch: schedulerが登録後に割当
- Worktree lease: SYS-MOBFIN-P04をclaimする
- Parallel safety: P03完了と新規pathのlease非競合を確認する
- Completion projection: default branch reconciliation

## スコープ外

- production API、D1、login、real transaction dataへの接続
- P05実装をtest作成と同時に行うこと

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test -- mobile-financial-visualization.dom.test.tsx mobile-financial-layout.test.ts`
- Required evidence: P05前に対象assertionが期待理由でFAILするred output、viewport 360、375、390、768、1280と200%相当の検査表

## Rollout and rollback

- Rollout: red contractを固定してP05へ引き渡す。
- Rollback trigger and steps: 不安定なclock、network、実データ依存があれば該当testだけを作り直す。

## Handoff

- Executor: Vitest、React Testing Library、Chrome DevTools Protocolを扱える実行者
- Ready when: 全acceptance failureがP05前に再現され、fixtureは匿名、testは決定論的である

## 参照情報

- System specification: system-spec/ui-ux.md、system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP04の実行正本
- Dependencies: SYS-MOBFIN-P03
