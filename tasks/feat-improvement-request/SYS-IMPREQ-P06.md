---
acceptance: ["受入条件15件に対応する検証がすべて実行され、失敗が0件である", "既存の検証が1件も退行していない", "実行結果が証跡として記録され、実行日時と対象コミット相当の識別子が残っている"]
architecture_refs: ["arch-improvement-request-pipeline"]
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: {"bd_issue_id": "kanjo-1fa", "github_mirror": null, "linked_at": "2026-08-30T13:04:20Z", "sync_state": "synced"}
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-improvement-request/SYS-IMPREQ-P06.md", "confidence": 1}]
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "e5aaef0b452885b06b9210c427c16a97c47e85a0a1c9716a17e183e53f08cf07", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-improvement-request/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-08-30T12:47:55Z"
depends_on: ["SYS-IMPREQ-P05"]
domain: "quality"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-improvement-request"
file_path: "tasks/feat-improvement-request/SYS-IMPREQ-P06.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
goal: "P04 が設計した検証を実際に走らせ、受入条件に紐づく失敗を残らず解消する。"
graph_node_id: "SYS-IMPREQ-P06"
implementation_readiness: {"checked_at": "2026-08-30T12:30:00Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: []
parent_feature: "feat-improvement-request"
phase_ref: "P06"
priority: null
project_id: "feature-package-feat-improvement-request"
pull_request_linkages: []
purpose: "検証の実行と失敗の解消の完了状態と検証可能な証跡を確定する。"
related_nodes: ["arch-improvement-request-pipeline"]
resource_scope: ["packages/web/src/improvement-capture.dom.test.tsx", "packages/web/src/diagnostics-buffer.test.ts", "packages/api/src/improvement-lifecycle.test.ts", "packages/api/src/improvement-redaction.test.ts", "packages/api/src/improvement-backup-exclusion.test.ts"]
scope_in: ["packages/web/src/improvement-capture.dom.test.tsx", "packages/web/src/diagnostics-buffer.test.ts", "packages/api/src/improvement-lifecycle.test.ts", "packages/api/src/improvement-redaction.test.ts", "packages/api/src/improvement-backup-exclusion.test.ts"]
scope_out: ["改善要望のテーブルを packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL の列挙対象へ追加すること", "既存 nightlyBackup の実装と Cron 設定の変更、および新規 Cron トリガの追加", "R2 の公開 URL と署名付き URL の発行", "外部エラートラッキング SaaS への診断情報の送信", "Screen Capture API による画面共有ダイアログ経由の撮影", "要望本文・状態・対応記録の30日削除。削除対象は添付物のみとする", "本番 D1 への migration 適用。feat-prod-d1-schema-recovery が未完了である間は、配信判定の結果にかかわらず適用を実行しない", "commit、push、Pull Request 作成"]
source_lineage: {"imported_at": "2026-08-30T12:47:55Z", "origin_kind": "system-dev-planner", "source_digest": "e5aaef0b452885b06b9210c427c16a97c47e85a0a1c9716a17e183e53f08cf07", "source_path": ".dev-graph/plans/feature-package-feat-improvement-request/task-specs/phase-06-test-run.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["improvement-request", "screenshot", "diagnostics", "agent-handoff", "retention"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "検証の実行と失敗の解消"
tracker_binding: "beads"
updated_at: "2026-08-30T12:47:55Z"
---

# 検証の実行と失敗の解消

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-improvement-request/task-specs/phase-06-test-run.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる(`source_lineage.source_digest` は promotion 時点の対応を示すもので、以後の同期は保証されない)。

## 目的

P04 が設計した検証を実際に走らせ、受入条件に紐づく失敗を残らず解消する。

## 背景

改善要望は現在この製品に存在せず、困りごとは文章でしか届かない。文章には、書いた人が気づいたことしか載らない。画面の裏で実際に失敗していた通信や例外は書いた人に見えていないため、受け取った側は再現条件の推測から始めることになる。押した瞬間の画面と、そのとき起きていた技術的な失敗を要望へ自動で添え、Claude Code と Codex がその指示文だけで調査に入れる形にする。

## 対応する要求 (source of truth: `features/feat-improvement-request.context.json`)

- 受入条件15件に対応する検証がすべて実行され、失敗が0件である
- 既存の検証が1件も退行していない
- 実行結果が証跡として記録され、実行日時と対象コミット相当の識別子が残っている
- 充足状況の最新は feature `features/feat-improvement-request.md` の受入節を見る。

## 入力と前提条件

- 前提: P05 SYS-IMPREQ-P05 が完了していること
- 前提: implementation readiness は complete、missing sections は空
- 前提: repository identity は github:daishiman/kanjo、config は .dev-graph/config.json
- 前提: 実データ、data 配下、packages/api/.dev.vars を成果物や Git 対象へ含めない
- 前提: 本番 D1 のスキーマ整合が未回復のため、本番への migration 適用は feat-prod-d1-schema-recovery の完了を待つ
- 入力: `.dev-graph/plans/feature-package-feat-improvement-request/task-specs/phase-06-test-run.md`
- Consumed artifacts: system-spec/index.md、system-spec/00-requirements-definition.md、architecture/arch-improvement-request-pipeline.md、features/feat-improvement-request.md、features/feat-improvement-request.context.json
- Source digest: `sha256:e5aaef0b452885b06b9210c427c16a97c47e85a0a1c9716a17e183e53f08cf07`

## 出力と成果物

- Produced artifacts: packages/web/src/improvement-capture.dom.test.tsx、packages/web/src/diagnostics-buffer.test.ts、packages/api/src/improvement-lifecycle.test.ts、packages/api/src/improvement-redaction.test.ts、packages/api/src/improvement-backup-exclusion.test.ts

## 依存関係

- `depends_on`: `SYS-IMPREQ-P05`
- ブロッカー: 依存 task 未完了、worktree lease 競合、readiness の stale 化、高重大度 finding

## 実装対象

- Frontend: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Backend: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- API: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Data: 非該当。この phase では契約や実装を変更しない。
- Infrastructure: 非該当。この phase では契約や実装を変更しない。
- Security: 非該当。この phase では契約や実装を変更しない。
- Quality: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Documentation: 非該当。この phase では契約や実装を変更しない。
- Operations: 非該当。この phase では契約や実装を変更しない。

## 設計と配備単位

- Architecture decisions: 撮影は capture の Promise を await し終えてからモーダルを開く順序で固定し、除外リスト方式は採らない。診断はアプリ起動時から件数と総バイトの二重上限つきリングバッファへ常時記録する。エージェント取得は既存 AI 分析と同型の使い捨て Bearer で、D1 には SHA-256 ハッシュだけを保存する。R2 の公開 URL と署名付き URL は発行せず配信は Worker 経由の1本に限る。添付は対応完了から30日で削除し、既存 scheduledMaintenance へ相乗りして新規 Cron を増やさない
- Deploy unit/environment: packages/web React SPA と packages/api Cloudflare Workers、および Cloudflare D1 kanjo-db・R2 kanjo-files
- Compatibility: 既存 Cookie セッション認証と既存 agentGuard の契約を変えない。改善要望のテーブルを packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL へ追加しない。既存 nightlyBackup と wrangler.jsonc の Cron 設定を変更しない

## Write scope と競合制約

- `touches`: packages/web/src/improvement-capture.dom.test.tsx、packages/web/src/diagnostics-buffer.test.ts、packages/api/src/improvement-lifecycle.test.ts、packages/api/src/improvement-redaction.test.ts、packages/api/src/improvement-backup-exclusion.test.ts
- 排他資源: `SYS-IMPREQ-P06`
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

## GitHub publication

- Tracker binding intent: beads
- Publication mode: local_only
- GitHub project、labels、milestone: beads が authority のため設定しない
- PR completion policy: linked_pr_merged_all
- 起票・状態収束は dev-graph が所有し、この task spec は intent と完了条件だけを宣言する
- PR linkage requirement: PR 本文へ beads 識別子と `dev-graph: SYS-IMPREQ-P06` を記載する
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Local reconciliation: `/dev-graph sync` が authority へ収束させる

## 実行手順

1. 依存 task と requirements snapshot の digest を確認する。
2. worktree lease を取得し write scope 内だけを変更する。
3. acceptance と verification を実行し、匿名化した証跡を残す。
4. 高重大度 finding が0であることを確認し、後続 task へ handoff する。

## 受入条件

- [ ] 受入条件15件に対応する検証がすべて実行され、失敗が0件である
- [ ] 既存の検証が1件も退行していない
- [ ] 実行結果が証跡として記録され、実行日時と対象コミット相当の識別子が残っている

## 検証方法

- 検証: pnpm test をリポジトリ全体で実行し、失敗が0件であることを確認する
- 検証: 実行前後の検証件数を比較し、既存検証の欠落が0件であることを確認する
- Required evidence: P06 の受入条件、実行結果、差分対象、未解決指摘の有無を記録する
- Privacy: 画面証跡は合成または既存の匿名表示のみとし、口座明細や金額の実データを含めない

## リスクとロールバック

- Rollout: 依存 phase の完了後に write scope 内だけを変更し、ローカルとテスト環境で確認する
- Rollback trigger and steps: 検証ファイルの追加のみのため、追加した検証ファイルを削除すれば元に戻る。

## Handoff

- Executor: dev-graph scheduler が有効な worktree lease とともに割り当てた実行者
- Ready when: 受入条件と verification が全て PASS し、高重大度の未解決指摘がなく、後続 phase が参照できる証跡がある
- 実装 route: task-graph build
- 次に利用するノード: `SYS-IMPREQ-P07`

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md
- Feature: features/feat-improvement-request.md
- Architecture: architecture/arch-improvement-request-pipeline.md
- Dependency: SYS-IMPREQ-P05
- Task graph: task-graph.json の P06 node
- Requirements handoff: `.dev-graph/requirements/feat-improvement-request/task-graph-handoff.json`
