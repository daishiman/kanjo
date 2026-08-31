# System task overlay: モバイルfigureの意味情報と操作性を受入確認

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P07
- phase_ref: P07
- owners: schedulerがlease時に割当
- tags: mobile、acceptance、ux
- related_nodes: spec-mobile-financial-visualization、SYS-MOBFIN-P06
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

利用者視点で五つのfeature acceptanceを匿名画面と機械証跡へtraceし、狭幅でも変化、異常、次の確認先を判断できることを確定する。

## 背景

test suiteがPASSしても、結論から詳細への情報階層や片手操作の認知負荷は実画面で確認が必要である。viewport別に同じシナリオを確認する。

## 前提条件

- SYS-MOBFIN-P06の全gateがPASS
- localhostはanonymous sampleだけを表示する
- 360、375、390、768、1280幅と200%相当を確認できるChromeがある

## Workstream applicability

- Frontend: 該当。全対象routeの表示と操作を確認する。
- Backend: N/A: backend変更なし。
- API: N/A: API変更なし。
- Data: N/A: anonymous sampleだけを使う。
- Infrastructure: N/A: localhostだけを使う。
- Security: N/A: local-only test identity以外を使わない。
- Quality: 該当。purpose-derived acceptanceを判定する。
- Documentation: 該当。viewport別結果を記録する。
- Operations: N/A: productionへ接続しない。

## Architecture and deploy unit

- Architecture decisions: Overview、分析、決算書、家計、固定費、AI図表を共通シナリオで比較する。
- Deploy unit/environment: localhostのpackages/web React SPA。
- Compatibility/migration/backfill: desktopにある意味情報をmobileでも失わない。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-07-acceptance.md
- Consumed artifacts: P06 test results、feature acceptance、anonymous sample
- Write scope/touches: phase-07-acceptance.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: acceptance判定を記録し、正式doneはdev-graph policyに委ねる

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P07をclaimする
- Parallel safety: P06 done後、local server portとevidence pathの競合を避ける
- Completion projection: default branch reconciliation

## スコープ外

- production loginとreal financial data
- acceptance基準の緩和、目視だけで自動gateを置換すること

## Verification and evidence

- Automated commands: `pnpm preview`
- Required evidence: 各routeと各viewportのfigure数、non-zero寸法、document overflow、七要素、44px、focus、色以外の状態、結果PASS
- Required evidence: 200%相当で結論、表、操作が欠けないこと

## Rollout and rollback

- Rollout: 五項目すべてPASSしたacceptance matrixをP08とP10へ渡す。
- Rollback trigger and steps: FAIL項目を責任phaseへ戻し、このtaskを完了扱いにしない。

## Handoff

- Executor: mobile browserとaccessible UIを評価できるacceptance実行者
- Ready when: 全route、全viewport、全五項目PASSで実データ露出0件

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-experience.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP07の実行正本
- Dependencies: SYS-MOBFIN-P06
