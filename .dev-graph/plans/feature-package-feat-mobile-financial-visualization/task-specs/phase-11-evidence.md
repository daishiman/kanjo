# System task overlay: 匿名で再現可能な検証証跡を固定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P11
- phase_ref: P11
- owners: schedulerがlease時に割当
- tags: mobile、evidence、reproducibility
- related_nodes: SYS-MOBFIN-P06、SYS-MOBFIN-P07、SYS-MOBFIN-P10
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

第三者が同じcommand、anonymous fixture、viewportで同じPASSを再現できる証跡bundleをsource digestへpinして固定する。

## 背景

口頭の確認や一時的なterminal outputでは、後からどのversionを何で検証したか判断できない。機械可読結果と人間向け再現手順を対で残す。

## 前提条件

- SYS-MOBFIN-P10が独立PASS
- testとacceptanceは同一source digestに対する結果
- 実データ、secret、token、個人を識別できるscreenshotは禁止

## Workstream applicability

- Frontend: 該当。viewportとrouteの結果を記録する。
- Backend: N/A: backend変更なし。
- API: N/A: API変更なし。
- Data: N/A: anonymous fixtureのみ。
- Infrastructure: N/A: local実行のみ。
- Security: 該当。evidenceのprivacyを検査する。
- Quality: 該当。commandとexit codeを固定する。
- Documentation: 該当。再現手順を作る。
- Operations: N/A: remote storageへuploadしない。

## Architecture and deploy unit

- Architecture decisions: human-readable Markdownとmachine-readable JSONを同一source digestで結ぶ。
- Deploy unit/environment: repository-local evidence bundle。
- Compatibility/migration/backfill: 既存evidenceを上書きせずcurrent run pathへ保存する。

## 成果物

- Produced artifacts: phase-11-reproducible-evidence.md、mobile-viewport-results.json
- Consumed artifacts: P06 test results、P07 acceptance、P10 final review
- Write scope/touches: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-11-reproducible-evidence.mdとmobile-viewport-results.json

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: evidence producerはtracker stateを直接変更しない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P11をclaimする
- Parallel safety: P10 digest固定後にevidence pathだけへwriteする
- Completion projection: default branch reconciliation

## スコープ外

- raw production logs、real account screenshot、secret valueの保存
- 実行していないcommandをPASSとして記録すること

## Verification and evidence

- Automated commands: `pnpm --filter @kanjo/web test && pnpm --filter @kanjo/web build`
- Automated commands: `rg -n "data/|dev.vars|token|secret" .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence`
- Required evidence: source digest、environment、Chrome path、viewport、route、expected、actual、exit code、timestamp

## Rollout and rollback

- Rollout: verified bundleをP12とP13へhandoffする。
- Rollback trigger and steps: digest不一致やprivacy riskがあればbundleをauthorityから外し、current digestで再生成する。

## Handoff

- Executor: reproducible test evidenceを扱えるquality実行者
- Ready when: 記載commandの再実行がPASSし、machine結果とMarkdownが一致しprivacy violationが0件

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP11の実行正本
- Dependencies: SYS-MOBFIN-P10
