# System task overlay: figure共通化と互換性境界を整理

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P08
- phase_ref: P08
- owners: schedulerがlease時に割当
- tags: mobile、refactoring、compatibility
- related_nodes: SYS-MOBFIN-P05、SYS-MOBFIN-P07
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

P05で生じたfigure contractの重複を安全に整理し、route固有の文脈と会計値を保ったまま保守可能な共通境界へ収束させる。

## 背景

P08は省略できないrequired nodeである。data migrationは不要だが、その判断とcompatibilityを証拠化し、拙速な共通化による情報欠落を防ぐ。

## 前提条件

- SYS-MOBFIN-P07が五acceptanceをPASS
- working implementationを小さなrefactor単位で維持する
- APIとdata schemaは変更しない

## Workstream applicability

- Frontend: 該当。共通componentとpure modelの重複を整理する。
- Backend: N/A: backend変更なし。
- API: N/A: API変更なし。
- Data: N/A: schemaとmigrationは不要であることを記録する。
- Infrastructure: N/A: infra変更なし。
- Security: N/A: auth変更なし。
- Quality: 該当。refactorごとにtestを再実行する。
- Documentation: 該当。migration N/Aとcompatibilityを記録する。
- Operations: N/A: rollout操作なし。

## Architecture and deploy unit

- Architecture decisions: responsive shell、semantic summary、table adapterの重複だけを共通化し、route copyはcontextとして残す。
- Deploy unit/environment: packages/web React SPA。
- Compatibility/migration/backfill: data migration N/A。既存URL、API、会計値、desktop表示を維持する。

## 成果物

- Produced artifacts: FinancialFigure.tsx、financial-figure-model.ts、必要最小限のFinancialCharts.tsxとReportChart.tsx整理、phase-08 evidence
- Consumed artifacts: P05 source、P06 tests、P07 acceptance
- Write scope/touches: packages/web/src/components/FinancialFigure.tsx、financial-figure-model.ts、FinancialCharts.tsx、ReportChart.tsx、phase-08-refactoring-migration.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: source refactorだけを所有しtracker mutationはdev-graphへ委ねる

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P08をclaimする
- Parallel safety: P07 doneとcomponent pathのactive lease非競合が必要
- Completion projection: default branch reconciliation

## スコープ外

- 新機能追加、API抽象化、data migration、別featureのcleanup
- testを削除して共通化を通すこと

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test`
- Automated commands: `pnpm --filter @kanjo/web build`
- Required evidence: 重複除去理由、残したroute差異、migration N/A理由、before-after acceptance不変

## Rollout and rollback

- Rollout: 小単位でrefactorし各単位後にfocused testを実行する。
- Rollback trigger and steps: 意味情報またはroute固有contextが失われたらP08変更だけを戻してP05状態を維持する。

## Handoff

- Executor: React component boundaryとfinancial semanticsを理解する実行者
- Ready when: 重複が意図的な境界へ収束し、全testとacceptanceが不変

## 参照情報

- System specification: system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP08の実行正本
- Dependencies: SYS-MOBFIN-P07
