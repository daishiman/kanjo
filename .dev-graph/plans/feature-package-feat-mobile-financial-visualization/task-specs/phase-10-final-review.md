# System task overlay: 最終コード・UX・scopeを独立レビュー

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P10
- phase_ref: P10
- owners: P05実装者とは異なるreviewerをschedulerが割当
- tags: mobile、final-review、scope
- related_nodes: SYS-MOBFIN-P07、SYS-MOBFIN-P09
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

変更中の全fileをtaskとacceptanceへ逆引きし、コード、UX、test、evidence、scopeの矛盾と対象外変更を独立contextで0件にする。

## 背景

最終確認はP05実装者から分離し、見た目の改善だけでなく未コミット変更全体が13 task契約どおりかを判定する必要がある。

## 前提条件

- SYS-MOBFIN-P09がPASS
- reviewerはP05 producerと分離する
- git statusにある全変更を既存user changeも含めて識別し、勝手に戻さない

## Workstream applicability

- Frontend: 該当。source diffとUXをレビューする。
- Backend: N/A: backend diffがあればscope violationとしてFAIL。
- API: N/A: API diffがあればscope violationとしてFAIL。
- Data: N/A: dataとmigration diffがあればFAIL。
- Infrastructure: N/A: infra diffがあればFAIL。
- Security: 該当。privacy境界とsecret非露出を再確認する。
- Quality: 該当。全gateとacceptance traceを監査する。
- Documentation: 該当。最終findingを記録する。
- Operations: N/A: remote stateを変更しない。

## Architecture and deploy unit

- Architecture decisions: P02contractからP09evidenceまで一方向にtraceし、implementationがarchitectureを再定義していないことを確認する。
- Deploy unit/environment: repository-local diff。deployなし。
- Compatibility/migration/backfill: route、API、accounting、auth、data、infraの不変を確認する。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-10-final-review.md
- Consumed artifacts: P01からP09の全成果物、git diff、test results
- Write scope/touches: phase-10-final-review.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: reviewerはverdictだけを発行しtrackerを直接closeしない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P10をclaimする
- Parallel safety: source digest固定後にread-only reviewし実装fileを編集しない
- Completion projection: default branch reconciliation

## スコープ外

- review中のsilent fix、対象外fileのcleanup、commit、push、PR
- 高重大度findingを後続文書だけで回避すること

## Verification and evidence

- Automated commands: `git status --short`
- Automated commands: `git diff --stat && git diff --check`
- Required evidence: changed file全件のtask mapping、acceptance五項目、P09 gates、scope-out、重大度別finding、独立reviewer記録

## Rollout and rollback

- Rollout: PASS verdictだけをP11へ渡す。
- Rollback trigger and steps: findingが一件でも重大または高なら責任phaseへ戻し、review verdictをFAILに保つ。

## Handoff

- Executor: P05と独立したcodeとUX reviewer
- Ready when: changed file全件がin-scope、重大・高finding0、全acceptanceとgateにevidenceがある

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP10の実行正本
- Dependencies: SYS-MOBFIN-P09
