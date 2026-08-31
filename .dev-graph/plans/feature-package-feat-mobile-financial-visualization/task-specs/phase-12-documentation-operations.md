# System task overlay: ローカル画面テスト手順と引継ぎを整備

## Machine-readable registration fields

- feature_package_id: feature-package/feat-mobile-financial-visualization
- parent_feature: feat-mobile-financial-visualization
- graph_node_id: SYS-MOBFIN-P12
- phase_ref: P12
- owners: schedulerがlease時に割当
- tags: mobile、documentation、handover
- related_nodes: SYS-MOBFIN-P11
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

初見の利用者がpnpmでlocalhostを起動し、anonymous sampleとlocal-only test identityでmobile figureを詳細に確認し、終了まで安全に行えるrunbookを作る。

## 背景

自動testだけでは利用者が手元の画面で検証できない。public repositoryのため、実データとcredentialをtracked fileへ置かない手順が不可欠である。

## 前提条件

- SYS-MOBFIN-P11のreproducible evidenceがPASS
- repository既存preview、seed、auth手順を確認して存在するcommandだけを書く
- local secretはpackages/api/.dev.varsなどignore対象に限定しGit操作へ含めない

## Workstream applicability

- Frontend: 該当。routeとviewportのmanual test手順を書く。
- Backend: N/A: backend変更なし。既存local startupだけ説明する。
- API: N/A: API変更なし。
- Data: N/A: anonymous samplesを利用しschema変更なし。
- Infrastructure: N/A: local processだけ。
- Security: 該当。test identityとsecretのlocal-only境界を明記する。
- Quality: 該当。期待結果とtroubleshootingを書く。
- Documentation: 該当。runbookが主成果物。
- Operations: 該当。startup、health、shutdownを説明する。

## Architecture and deploy unit

- Architecture decisions: setup、seed、login、viewport別scenario、期待結果、diagnosis、shutdownの順で書く。
- Deploy unit/environment: localhostのwebと必要なlocal APIだけ。
- Compatibility/migration/backfill: production accountとproduction dataは一切使わない。

## 成果物

- Produced artifacts: docs/runbooks/mobile-financial-visualization-test.md、phase-12-handover.md
- Consumed artifacts: P11 evidence、package scripts、既存local setup documentation
- Write scope/touches: docs/runbooks/mobile-financial-visualization-test.mdとphase-12-handover.mdだけ

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project metadata: 設定しない
- PR completion policy: linked_pr_merged_all
- Ownership boundary: documentationだけを更新しtest credential valueをGitへ保存しない

## Branch and worktree execution

- Branch: scheduler割当branch
- Worktree lease: SYS-MOBFIN-P12をclaimする
- Parallel safety: P11 doneとrunbook pathのlease非競合を確認する
- Completion projection: default branch reconciliation

## スコープ外

- production credential共有、real financial dataのseed、public fileへのpassword保存
- deploy、commit、push、PR作成

## Verification and evidence

- Automated commands: `pnpm preview:smoke`
- Automated commands: `git status --short --ignored`
- Required evidence: runbookを上から一度通した結果、localhost URL、anonymous seed、local-only identity入手法、viewport別期待、shutdown

## Rollout and rollback

- Rollout: 検証済みrunbookを利用者へhandoffしlocal serverは要求に従い稼働維持する。
- Rollback trigger and steps: commandやURLが再現しなければrunbookだけを修正し、credentialをtracked fileへ移さない。

## Handoff

- Executor: local development setupを安全に案内できるdocumentation実行者
- Ready when: fresh local flowで再現でき、test dataは匿名、credentialはlocal-only、手順に曖昧さがない

## 参照情報

- System specification: specs/mobile-financial-visualization.md
- Architecture: architecture/arch-mobile-financial-experience.md
- Feature: features/feat-mobile-financial-visualization.md
- Phase doc: 本task specがP12の実行正本
- Dependencies: SYS-MOBFIN-P11
