# System task overlay: 再現可能な検証証跡の集約

> **正本ではない。** 本書は`system-dev-planner`が生成したstaging snapshotで、promotion済みの正本は`tasks/feat-ui-navigation-cognitive-load/SYS-UINAV-P11.md`。内容の更新はそちらへ入れる。本書は生成時点の記録として保持し、正本との差分は意図的なもの(promotion後の追記)を含む。

## Machine-readable registration fields

- feature_package_id: feature-package/feat-ui-navigation-cognitive-load
- parent_feature: feat-ui-navigation-cognitive-load
- graph_node_id: SYS-UINAV-P11
- phase_ref: P11
- owners: 未割当。scheduler が lease とともに実行者を確定する
- tags: ui-navigation、cognitive-load、accessibility
- related_nodes: spec-ui-navigation-cognitive-load、arch-ui-navigation-experience、arch-ui-navigation-frontend
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

コマンド結果、画面確認、受入判定を機密情報なしで追跡可能な索引にまとめる。

## 背景

申告サイドバーで親子ルートが同時に active となり、現在地が曖昧になっている。全ページでも情報密度、操作の優先順位、編集時の安全性を共通規則で整え、初見の利用者が説明を読み込まずに次の操作を判断できる状態が必要である。

## 前提条件

- P10 SYS-UINAV-P10 が完了していること
- implementation readiness は complete、missing sections は空
- repository identity は github:daishiman/kanjo、config は .dev-graph/config.json
- 実データ、data 配下、packages/api/.dev.vars を成果物や Git 対象へ含めない

## Workstream applicability

- Frontend: 非該当。この phase では契約や実装を変更しない。
- Backend: 非該当。この phase では契約や実装を変更しない。
- API: 非該当。この phase では契約や実装を変更しない。
- Data: 非該当。この phase では契約や実装を変更しない。
- Infrastructure: 非該当。この phase では契約や実装を変更しない。
- Security: 非該当。この phase では契約や実装を変更しない。
- Quality: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Documentation: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Operations: 非該当。この phase では契約や実装を変更しない。

## Architecture and deploy unit

- Architecture decisions: active は最長前方一致ではなく route 契約に基づく単一選択とする。アイコンは意味を補助し、文字ラベルを置換しない。主要操作を先に、詳細と編集は要求時に開示する
- Deploy unit/environment: packages/web React SPA。API・データ形式・認証契約は変更しない
- Compatibility: デスクトップ、モバイル drawer、bottom tab、キーボード、200%相当、reduced motion を維持する

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/evidence/phase-11-evidence-index.md
- Consumed artifacts: system-spec/index.md、system-spec/00-requirements-definition.md、specs/ui-navigation-cognitive-load.md、architecture/arch-ui-navigation-experience.md、architecture/arch-ui-navigation-frontend.md、features/feat-ui-navigation-cognitive-load.md、features/feat-ui-navigation-cognitive-load.context.json
- Write scope: .dev-graph/plans/feature-package-feat-ui-navigation-cognitive-load/evidence/phase-11-evidence-index.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- GitHub project、labels、milestone: beads が authority のため設定しない
- PR completion policy: linked_pr_merged_all
- 起票・状態収束は dev-graph が所有し、この task spec は intent と完了条件だけを宣言する

## Branch and worktree execution

- Branch: scheduler が graph_node_id から割り当てる
- Worktree lease: 実装開始時に claim し、作業中に heartbeat、完了時に release する
- Parallel safety: depends_on 完了と resource scope 非競合を確認する
- Completion projection: 既定ブランチとの reconciliation で確定する

## スコープ外

- API、会計計算、保存データ、認証方式の変更
- commit、push、Pull Request 作成
- 実データや秘密情報を使う画面例・証跡

## Verification and evidence

- Automated commands: task の成果物を feature 受入条件と照合する / 依存 phase の証跡と write scope を確認する
- Required evidence: P11 の受入条件、実行結果、差分対象、未解決指摘の有無を記録する
- Privacy: 画面証跡は合成または既存の匿名表示のみとし、口座明細や金額の実データを含めない

## Rollout and rollback

- Rollout: 依存 phase の完了後に write scope 内だけを変更し、共通 Web build で確認する
- Rollback trigger and steps: 当該 phase の文書または証跡だけを直前版へ戻す。アプリケーション状態と実データは変更しない。

## Handoff

- Executor: dev-graph scheduler が有効な worktree lease とともに割り当てた実行者
- Ready when: 受入条件と verification が全て PASS し、高重大度の未解決指摘がなく、後続 phase が参照できる証跡がある

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md
- Feature: features/feat-ui-navigation-cognitive-load.md
- Architecture: architecture/arch-ui-navigation-experience.md、architecture/arch-ui-navigation-frontend.md
- Dependency: SYS-UINAV-P10
- Task graph: task-graph.json の P11 node

