# System task overlay: 全財務figureと高密度表のモバイル体験を実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P05
- phase_ref: P05
- owners: schedulerがlease時に割当
- tags: mobile、frontend、financial-figure
- related_nodes: spec-mobile-financial-visualization、arch-mobile-financial-experience、arch-mobile-financial-frontend
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

packages/webの全財務figureを、狭幅でも消えず、結論から正確な表へ低認知負荷で進めるresponsive experienceへ変更する。

## 背景

モバイルではgraph関係が表示されない、canvasが十分な寸法を得ない、高密度表がpage全体を押し広げる問題がある。見た目だけでなく意味情報と操作を同じview-modelから提供する。

## 前提条件

- SYS-MOBFIN-P04のred contractが固定済み
- P02 architectureとP03 reviewがPASS
- 既存未コミット変更を保持し、write scope外を変更しない
- API、認証、会計計算、data、Cloudflare構成は不変

## Workstream applicability

- Frontend: 該当。figure component、route adapter、CSSを実装する。
- Backend: N/A: server logic変更なし。
- API: N/A: response shape変更なし。
- Data: N/A: schemaとmigration変更なし。
- Infrastructure: N/A: deployment変更なし。
- Security: N/A: auth変更なし。匿名fixture境界は維持する。
- Quality: 該当。P04 contractをgreenにする。
- Documentation: N/A:利用手順はP12が所有する。
- Operations: N/A: production rolloutはP13でも実行しない。

## Architecture and deploy unit

- Architecture decisions: 七要素を単一view-modelから派生し、canvasはnon-zero responsive shell、semantic tableは同じ値を使う。
- Deploy unit/environment: packages/web React SPA。
- Compatibility/migration/backfill: route、API type、会計値、desktop semanticsを維持し、migration不要。

## 成果物

- Produced artifacts: packages/web/src/components/FinancialFigure.tsx、packages/web/src/components/financial-figure-model.ts、FinancialCharts.tsx、ReportChart.tsx、対象route adapter、styles.css
- Consumed artifacts: P02 contract、P04 tests、既存format.tsとchart tooltip utilities
- Write scope/touches: packages/web/src/components/FinancialFigure.tsx、packages/web/src/components/financial-figure-model.ts、packages/web/src/components/FinancialCharts.tsx、packages/web/src/components/ReportChart.tsx、packages/web/src/pages/Overview.tsx、Household.tsx、Subscriptions.tsx、analysis/Trends.tsx、analysis/Matrix.tsx、Statements.tsx、packages/web/src/styles.css

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: implementationはfilesだけを更新し、Beads状態収束はdev-graphが行う

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P05 claim後に実装し、長時間test中もheartbeatする
- Parallel safety: P04 doneとwrite scopeにactive leaseがないことを確認する
- Completion projection: default branch reconciliation

## スコープ外

- accounting calculation、API、auth、D1、R2、Cloudflare、native mobileの変更
- production deploy、commit、push、PR作成
- 実データを用いるfixture、log、screenshot

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test -- mobile-financial-visualization.dom.test.tsx mobile-financial-layout.test.ts`
- Automated commands: `pnpm --filter @kanjo/web build`
- Required evidence: desktopと各viewportのfigure count、container寸法、document overflow、touch target、semantic contentの結果

## Rollout and rollback

- Rollout: P04 focused testsをgreenにし、P06 full regression前までlocal変更として保持する。
- Rollback trigger and steps: route消失、会計値差分、API回帰、横overflow再発時はP05 write scope内の変更だけを戻す。

## Handoff

- Executor: React、Chart.js、responsive CSS、accessible data visualizationを扱えるfrontend実行者
- Ready when: P04全testがPASSし、五acceptanceとscope不変を実装差分で説明できる

## 参照情報

- System specification: system-spec/ui-ux.md、system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP05の実行正本
- Dependencies: SYS-MOBFIN-P04
