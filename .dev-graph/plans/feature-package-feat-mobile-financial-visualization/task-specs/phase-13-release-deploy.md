# System task overlay: 非deploy close-outとrollback確認を記録

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P13
- phase_ref: P13
- owners: schedulerがlease時に割当
- tags: mobile、close-out、rollback
- related_nodes: SYS-MOBFIN-P10、SYS-MOBFIN-P11、SYS-MOBFIN-P12
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

production deployを実行しないN/A判断、local implementation結果、rollback境界、正式completionの残存条件をclose-out receiptとして確定する。

## 背景

P13はrequired nodeだが、ユーザーはcommit、push、PR、deployを明示的に除外した。remote stateを変えず、何がlocalで完了し何がpolicy上未完了かを正確に残す。

## 前提条件

- SYS-MOBFIN-P12までの全task成果物が揃う
- P10 final reviewとP11 evidenceがPASS
- production、Git remote、GitHub、Beads completionをこのtaskから変更しない

## Workstream applicability

- Frontend: N/A: source implementationはP05とP08で完了。
- Backend: N/A:変更なし。
- API: N/A:変更なし。
- Data: N/A:変更なし。
- Infrastructure: N/A: user scopeによりdeployを実行しない。
- Security: 該当。secretと実データ非露出を最終確認する。
- Quality: 該当。all-gate summaryを確認する。
- Documentation: 該当。close-out receiptを作る。
- Operations: 該当。N/A deploy判断、rollback、local server状態を記録する。

## Architecture and deploy unit

- Architecture decisions: release actionはN/A、close-out evidenceはrequiredとする。
- Deploy unit/environment: N/A: production deployment is explicitly excluded by user scope。
- Compatibility/migration/backfill: migrationなし、remote state不変、local diffはrollback可能。

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-mobile-financial-visualization/evidence/phase-13-close-out.md
- Consumed artifacts: P10 review、P11 evidence、P12 runbook、git status
- Write scope/touches: phase-13-close-out.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: local close-outを記録するだけでBeadsを正式doneへ偽装しない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P13をclaimする
- Parallel safety: P12 done後、close-out evidenceだけへwriteする
- Completion projection: linked PR merge後のdefault branch reconciliationが正式authority

## スコープ外

- commit、push、PR作成、production deploy、remote tracker close
- userの明示許可なしにlocalhostを停止すること

## Verification and evidence

- Automated commands: `git status --short`
- Automated commands: `git diff --check`
- Required evidence: local完成範囲、全gate、未解決0件または残存条件、N/A deploy理由、rollback file list、正式completion policy

## Rollout and rollback

- Rollout: N/A。production deployは実施しない。localhost handoffだけをユーザーへ返す。
- Rollback trigger and steps: local UI regression時はP05とP08のwrite scope内変更だけを戻し、specとevidenceを再評価する。

## Handoff

- Executor: release authorityを持たずlocal close-outだけを記録する実行者
- Ready when: P01からP12が完了し、remote mutationなし、rollback可能、local resultが再現可能

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-experience.md、architecture/arch-mobile-financial-frontend.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP13の実行正本
- Dependencies: SYS-MOBFIN-P12
