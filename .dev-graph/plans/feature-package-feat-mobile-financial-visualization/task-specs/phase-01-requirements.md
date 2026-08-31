# System task overlay: モバイル財務表示の要求基線とfigure inventoryを確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P01
- phase_ref: P01
- owners: schedulerがlease時に割当
- tags: mobile、financial-figure、accessibility
- related_nodes: spec-mobile-financial-visualization、arch-mobile-financial-experience、arch-mobile-financial-frontend
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

全routeの財務chart、figure、KPI、高密度表を同じ粒度で棚卸しし、desktopと狭幅の意味情報差分を実装前の要求基線として確定する。

## 背景

モバイルではgraph自体や重要な関係が見えず、利用者が変化、異常、次の確認先を判断できない。局所的なCSS修正では見落とすため、対象と受入条件をroute横断で固定する。

## 前提条件

- feature context digestはsha256:2a0504f87f87055166e5adc6e1dafb1c57783e494b5d7bfa9d7d9c4f506cfd6a
- system-spec completenessはPASSでimplementation readinessはcomplete
- repository identityはgithub:daishiman/kanjo、configは.dev-graph/config.json
- 実データ、data配下、packages/api/.dev.varsを読取証跡やGit対象へ含めない

## Workstream applicability

- Frontend: 該当。packages/webのfigureと表示routeを棚卸しする。
- Backend: N/A: server logicを変更しない。
- API: N/A: response contractを変更しない。
- Data: N/A: schema、migration、fixture形式を変更しない。
- Infrastructure: N/A: runtimeとdeploymentを変更しない。
- Security: N/A: 認証認可を変更しない。
- Quality: 該当。受入条件と回帰面をinventoryへ結ぶ。
- Documentation: 該当。phase evidenceが主成果物である。
- Operations: N/A: production operationを変更しない。

## Architecture and deploy unit

- Architecture decisions: figureの意味情報を見出し、結論、期間、単位、series、次の行動、semantic tableの七要素で監査する。
- Deploy unit/environment: packages/web React SPAのread-only inventory。deployは行わない。
- Compatibility/migration/backfill: 会計値、API、保存データは不変。migrationは不要。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-01-figure-inventory.md
- Consumed artifacts: specs/mobile-financial-visualization.md、architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md、features/feat-mobile-financial-visualization.context.json
- Write scope/touches: phase-01-figure-inventory.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases、labels、milestone: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: system-dev-plannerはintentを宣言し、起票と状態収束はdev-graphが行う

## Branch and worktree execution

- Branch: dev-graph schedulerが登録後に割当
- Worktree lease: SYS-MOBFIN-P01をclaimしてから成果物を作り、heartbeatとreleaseを行う
- Parallel safety: dependencyはなく、write scopeが他taskのactive leaseと重複しないことを確認する
- Completion projection: default branch reconciliationで正式確定する

## スコープ外

- UI実装、テストコード、API、会計計算、認証、データ、infraの変更
- 実データを用いた画面、log、screenshot

## Verification and evidence

- Automated commands: `rg -n "Chart|financial-figure|report-chart|canvas|table className" packages/web/src`
- Automated commands: `rg -n "overflow-x|chart-shell|safe-area|tabbar" packages/web/src/styles.css`
- Required evidence: route、source path、figure、七要素、狭幅risk、受入条件対応を一行ずつ持つinventory

## Rollout and rollback

- Rollout: inventoryをP02へhandoffするだけでruntime stateを変えない。
- Rollback trigger and steps: 対象漏れや誤分類があればphase evidenceだけを修正し、アプリケーションは触らない。

## Handoff

- Executor: dev-graph schedulerがlease付きで割り当てた実行者
- Ready when: 全対象routeとfigureが受入条件へtraceされ、高重大度の未分類が0件である

## 参照情報

- System specification: system-spec/index.md、system-spec/ui-ux.md、system-spec/frontend.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP01の実行正本
- Dependencies: なし
