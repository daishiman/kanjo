# System task overlay: 受入条件15件の判定

> **正本ではない。** 本書は system-dev-planner が生成した staging snapshot で、promotion 済みの正本は tasks/feat-improvement-request/SYS-IMPREQ-P07.md である。内容の更新はそちらへ入れる。

## Machine-readable registration fields

- feature_package_id: feature-package/feat-improvement-request
- parent_feature: feat-improvement-request
- graph_node_id: SYS-IMPREQ-P07
- phase_ref: P07
- owners: 未割当。scheduler が lease とともに実行者を確定する
- tags: improvement-request、screenshot、diagnostics、agent-handoff、retention
- related_nodes: arch-improvement-request-pipeline
- tracker_binding_intent: beads
- github_publication: local_only
- pr_completion_policy: linked_pr_merged_all

## 目的

実装と検証の結果を受入条件へ突き合わせ、機能として成立しているかを判定する。

## 背景

改善要望は現在この製品に存在せず、困りごとは文章でしか届かない。文章には、書いた人が気づいたことしか載らない。画面の裏で実際に失敗していた通信や例外は書いた人に見えていないため、受け取った側は再現条件の推測から始めることになる。押した瞬間の画面と、そのとき起きていた技術的な失敗を要望へ自動で添え、Claude Code と Codex がその指示文だけで調査に入れる形にする。

## 前提条件

- P06 SYS-IMPREQ-P06 が完了していること
- implementation readiness は complete、missing sections は空
- repository identity は github:daishiman/kanjo、config は .dev-graph/config.json
- 実データ、data 配下、packages/api/.dev.vars を成果物や Git 対象へ含めない
- 本番 D1 のスキーマ整合が未回復のため、本番への migration 適用は feat-prod-d1-schema-recovery の完了を待つ

## Workstream applicability

- Frontend: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Backend: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- API: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Data: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Infrastructure: 非該当。この phase では契約や実装を変更しない。
- Security: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Quality: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Documentation: 非該当。この phase では契約や実装を変更しない。
- Operations: 非該当。この phase では契約や実装を変更しない。

## Architecture and deploy unit

- Architecture decisions: 撮影は capture の Promise を await し終えてからモーダルを開く順序で固定し、除外リスト方式は採らない。診断はアプリ起動時から件数と総バイトの二重上限つきリングバッファへ常時記録する。エージェント取得は既存 AI 分析と同型の使い捨て Bearer で、D1 には SHA-256 ハッシュだけを保存する。R2 の公開 URL と署名付き URL は発行せず配信は Worker 経由の1本に限る。添付は対応完了から30日で削除し、既存 scheduledMaintenance へ相乗りして新規 Cron を増やさない
- Deploy unit/environment: packages/web React SPA と packages/api Cloudflare Workers、および Cloudflare D1 kanjo-db・R2 kanjo-files
- Compatibility: 既存 Cookie セッション認証と既存 agentGuard の契約を変えない。改善要望のテーブルを packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL へ追加しない。既存 nightlyBackup と wrangler.jsonc の Cron 設定を変更しない

## 成果物

- Produced artifacts: .dev-graph/plans/feature-package-feat-improvement-request/evidence/phase-07-acceptance.json
- Consumed artifacts: system-spec/index.md、system-spec/00-requirements-definition.md、architecture/arch-improvement-request-pipeline.md、features/feat-improvement-request.md、features/feat-improvement-request.context.json
- Write scope: .dev-graph/plans/feature-package-feat-improvement-request/evidence/phase-07-acceptance.json

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

- 改善要望のテーブルを packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL の列挙対象へ追加すること
- 既存 nightlyBackup の実装と Cron 設定の変更、および新規 Cron トリガの追加
- R2 の公開 URL と署名付き URL の発行
- 外部エラートラッキング SaaS への診断情報の送信
- Screen Capture API による画面共有ダイアログ経由の撮影
- 要望本文・状態・対応記録の30日削除。削除対象は添付物のみとする
- 本番 D1 への migration 適用。feat-prod-d1-schema-recovery が未完了である間は、配信判定の結果にかかわらず適用を実行しない
- commit、push、Pull Request 作成

## Verification and evidence

- Automated commands: 受入条件15件の判定表を作り、根拠が空の行が0件であることを確認する / ローカルで画面を起動し、改善要望の投稿から指示文コピーまでを通しで実行して結果を記録する
- Required evidence: P07 の受入条件、実行結果、差分対象、未解決指摘の有無を記録する
- Privacy: 画面証跡は合成または既存の匿名表示のみとし、口座明細や金額の実データを含めない

## Rollout and rollback

- Rollout: 依存 phase の完了後に write scope 内だけを変更し、ローカルとテスト環境で確認する
- Rollback trigger and steps: 判定記録のみの変更のため、証跡ファイルを削除すれば元に戻る。

## Handoff

- Executor: dev-graph scheduler が有効な worktree lease とともに割り当てた実行者
- Ready when: 受入条件と verification が全て PASS し、高重大度の未解決指摘がなく、後続 phase が参照できる証跡がある

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md
- Feature: features/feat-improvement-request.md
- Architecture: architecture/arch-improvement-request-pipeline.md
- Dependency: SYS-IMPREQ-P06
- Task graph: task-graph.json の P07 node

### 受入条件

- 受入条件15件それぞれに、判定結果と根拠となる検証名または観測結果が対応づいている
- 未達の受入条件が0件である
- 画面での手動確認の手順と結果が、実データを含まない形で記録されている
