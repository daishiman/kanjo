# System task overlay: unit・DOM・実Chrome・build回帰を実行

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P06
- phase_ref: P06
- owners: schedulerがlease時に割当
- tags: mobile、regression、build
- related_nodes: SYS-MOBFIN-P04、SYS-MOBFIN-P05
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

P05の変更をfocused contract、packages/web全test、typecheck、build、実Chromeで検証し、既存routeと会計表示に回帰がない状態を確定する。

## 背景

focused testだけでは共通CSSやchart componentが別routeへ与える影響を検出できない。web packageの全gateを同じsource digestに対して実行する。

## 前提条件

- SYS-MOBFIN-P05がfocused testsをgreenにしている
- Google ChromeまたはCHROME_PATHが利用可能
- test dataは合成fixtureのみ

## Workstream applicability

- Frontend: 該当。全route回帰の対象。
- Backend: N/A: backend testはsource変更がないため対象外。
- API: N/A: API contractはfrontend mockとtypecheckで不変確認する。
- Data: N/A: migrationなし。
- Infrastructure: N/A: dry buildだけでdeployしない。
- Security: N/A: auth変更なし。secret-free testだけ確認する。
- Quality: 該当。全自動gateを実行する。
- Documentation: 該当。exit codeと結果をevidence化する。
- Operations: N/A: productionを操作しない。

## Architecture and deploy unit

- Architecture decisions: focused、full、type、bundle、real layoutを独立commandで実行する。
- Deploy unit/environment: packages/web local build output。
- Compatibility/migration/backfill: current Nodeとpnpm lockを使用し依存追加なし。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-06-test-results.md
- Consumed artifacts: P04 tests、P05 source diff、package scripts
- Write scope/touches: phase-06-test-results.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: test runnerは結果を記録しtracker mutationを行わない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P06をclaimする
- Parallel safety: P05 done、source digest固定、test output以外のwriteなし
- Completion projection: default branch reconciliation

## スコープ外

- failing testの削除、skip化、threshold緩和
- production API、database、real user accountへの接続

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test`
- Automated commands: `pnpm --filter @kanjo/web typecheck`
- Automated commands: `pnpm --filter @kanjo/web build`
- Required evidence: command、開始時source digest、exit code、pass count、Chrome path、失敗0件の記録

## Rollout and rollback

- Rollout: 全gate PASSだけをP07へ渡す。
- Rollback trigger and steps: 一件でもFAILならP05へ戻し、evidenceをPASS扱いにしない。

## Handoff

- Executor: local test環境を再現できるquality実行者
- Ready when: focusedとfull test、typecheck、build、実Chromeが同一digestで全PASS

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP06の実行正本
- Dependencies: SYS-MOBFIN-P05
