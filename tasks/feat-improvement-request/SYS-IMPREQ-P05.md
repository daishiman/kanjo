---
acceptance: ["改善要望ボタンの押下でモーダルを開く前に撮影が完了し、撮影された画像に、その押下で開くモーダルの DOM が含まれない", "撮影が失敗してもモーダルは開き、スクリーンショットなしの本文だけで投稿が 2xx で成立する", "アプリ起動時から動く診断リングバッファが、未捕捉例外・unhandledrejection・console error と warn・失敗した通信を記録し、件数上限と総バイト上限の双方で切り詰めて省略件数を残す", "使い捨て Bearer トークンの平文が D1 のどの列にも保存されず、SHA-256 ハッシュだけが保存される", "投稿済みの改善要望から Claude Code 向けと Codex 向けの指示文がコピーでき、その指示文が指す API がトークンだけでスクリーンショットと診断情報を返す", "撮影中は改善要望ボタンが押下不可になり、待機していることが画面に出る", "送信前にスクリーンショットの縮小プレビューが見え、添付を外して送信できる", "診断情報が上限を超えて切り詰められたとき、省略件数が画面にも出る"]
architecture_refs: ["arch-improvement-request-pipeline"]
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: {"bd_issue_id": "kanjo-88v", "github_mirror": null, "linked_at": "2026-08-30T13:04:20Z", "sync_state": "synced"}
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-improvement-request/SYS-IMPREQ-P05.md", "confidence": 1}]
classification_confidence: 1
classification_reason: "確定 feature を exact-13 の単一 phase 実行単位へ写像した task。"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "e5aaef0b452885b06b9210c427c16a97c47e85a0a1c9716a17e183e53f08cf07", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-improvement-request/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-08-30T12:47:55Z"
depends_on: ["SYS-IMPREQ-P04"]
domain: "frontend"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-improvement-request"
file_path: "tasks/feat-improvement-request/SYS-IMPREQ-P05.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
goal: "確定した契約どおりに、改善要望の画面導線・API・D1 テーブル・R2 保存・添付削除を実装する。"
graph_node_id: "SYS-IMPREQ-P05"
implementation_readiness: {"checked_at": "2026-08-30T12:30:00Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: []
parent_feature: "feat-improvement-request"
phase_ref: "P05"
priority: null
project_id: "feature-package-feat-improvement-request"
pull_request_linkages: []
purpose: "撮影・診断・受け渡し・失効の実装の完了状態と検証可能な証跡を確定する。"
related_nodes: ["arch-improvement-request-pipeline"]
resource_scope: ["migrations/0029_improvement_requests.sql", "packages/api/src/routes/improvement.ts", "packages/api/src/improvement/contract.ts", "packages/api/src/improvement/redact.ts", "packages/api/src/index.ts", "packages/api/src/store.ts", "packages/core/src/improvement.ts", "packages/core/src/index.ts", "packages/web/src/components/ImprovementRequestButton.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/diagnostics-buffer.ts", "packages/web/src/capture-screen.ts", "packages/web/src/pages/Improvement.tsx", "packages/web/src/App.tsx", "packages/web/src/api.ts", "packages/web/src/styles.css"]
scope_in: ["migrations/0029_improvement_requests.sql", "packages/api/src/routes/improvement.ts", "packages/api/src/improvement/contract.ts", "packages/api/src/improvement/redact.ts", "packages/api/src/index.ts", "packages/api/src/store.ts", "packages/core/src/improvement.ts", "packages/core/src/index.ts", "packages/web/src/components/ImprovementRequestButton.tsx", "packages/web/src/components/Layout.tsx", "packages/web/src/diagnostics-buffer.ts", "packages/web/src/capture-screen.ts", "packages/web/src/pages/Improvement.tsx", "packages/web/src/App.tsx", "packages/web/src/api.ts", "packages/web/src/styles.css"]
scope_out: ["改善要望のテーブルを packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL の列挙対象へ追加すること", "既存 nightlyBackup の実装と Cron 設定の変更、および新規 Cron トリガの追加", "R2 の公開 URL と署名付き URL の発行", "外部エラートラッキング SaaS への診断情報の送信", "Screen Capture API による画面共有ダイアログ経由の撮影", "要望本文・状態・対応記録の30日削除。削除対象は添付物のみとする", "本番 D1 への migration 適用。feat-prod-d1-schema-recovery が未完了である間は、配信判定の結果にかかわらず適用を実行しない", "commit、push、Pull Request 作成"]
source_lineage: {"imported_at": "2026-08-30T12:47:55Z", "origin_kind": "system-dev-planner", "source_digest": "e5aaef0b452885b06b9210c427c16a97c47e85a0a1c9716a17e183e53f08cf07", "source_path": ".dev-graph/plans/feature-package-feat-improvement-request/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["improvement-request", "screenshot", "diagnostics", "agent-handoff", "retention"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "撮影・診断・受け渡し・失効の実装"
tracker_binding: "beads"
updated_at: "2026-08-30T12:47:55Z"
---

# 撮影・診断・受け渡し・失効の実装

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-improvement-request/task-specs/phase-05-implementation.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる(`source_lineage.source_digest` は promotion 時点の対応を示すもので、以後の同期は保証されない)。

## 目的

確定した契約どおりに、改善要望の画面導線・API・D1 テーブル・R2 保存・添付削除を実装する。

## 背景

改善要望は現在この製品に存在せず、困りごとは文章でしか届かない。文章には、書いた人が気づいたことしか載らない。画面の裏で実際に失敗していた通信や例外は書いた人に見えていないため、受け取った側は再現条件の推測から始めることになる。押した瞬間の画面と、そのとき起きていた技術的な失敗を要望へ自動で添え、Claude Code と Codex がその指示文だけで調査に入れる形にする。

## 対応する要求 (source of truth: `features/feat-improvement-request.context.json`)

- 改善要望ボタンの押下でモーダルを開く前に撮影が完了し、撮影された画像に、その押下で開くモーダルの DOM が含まれない
- 撮影が失敗してもモーダルは開き、スクリーンショットなしの本文だけで投稿が 2xx で成立する
- アプリ起動時から動く診断リングバッファが、未捕捉例外・unhandledrejection・console error と warn・失敗した通信を記録し、件数上限と総バイト上限の双方で切り詰めて省略件数を残す
- 使い捨て Bearer トークンの平文が D1 のどの列にも保存されず、SHA-256 ハッシュだけが保存される
- 投稿済みの改善要望から Claude Code 向けと Codex 向けの指示文がコピーでき、その指示文が指す API がトークンだけでスクリーンショットと診断情報を返す
- 撮影中は改善要望ボタンが押下不可になり、待機していることが画面に出る
- 送信前にスクリーンショットの縮小プレビューが見え、添付を外して送信できる
- 診断情報が上限を超えて切り詰められたとき、省略件数が画面にも出る
- 充足状況の最新は feature `features/feat-improvement-request.md` の受入節を見る。

## 入力と前提条件

- 前提: P04 SYS-IMPREQ-P04 が完了していること
- 前提: implementation readiness は complete、missing sections は空
- 前提: repository identity は github:daishiman/kanjo、config は .dev-graph/config.json
- 前提: 実データ、data 配下、packages/api/.dev.vars を成果物や Git 対象へ含めない
- 前提: 本番 D1 のスキーマ整合が未回復のため、本番への migration 適用は feat-prod-d1-schema-recovery の完了を待つ
- 入力: `.dev-graph/plans/feature-package-feat-improvement-request/task-specs/phase-05-implementation.md`
- Consumed artifacts: system-spec/index.md、system-spec/00-requirements-definition.md、architecture/arch-improvement-request-pipeline.md、features/feat-improvement-request.md、features/feat-improvement-request.context.json
- Source digest: `sha256:e5aaef0b452885b06b9210c427c16a97c47e85a0a1c9716a17e183e53f08cf07`

## 出力と成果物

- Produced artifacts: migrations/0029_improvement_requests.sql、packages/api/src/routes/improvement.ts、packages/api/src/improvement/contract.ts、packages/api/src/improvement/redact.ts、packages/api/src/index.ts、packages/api/src/store.ts、packages/core/src/improvement.ts、packages/core/src/index.ts、packages/web/src/components/ImprovementRequestButton.tsx、packages/web/src/components/Layout.tsx、packages/web/src/diagnostics-buffer.ts、packages/web/src/capture-screen.ts、packages/web/src/pages/Improvement.tsx、packages/web/src/App.tsx、packages/web/src/api.ts、packages/web/src/styles.css

## 依存関係

- `depends_on`: `SYS-IMPREQ-P04`
- ブロッカー: 依存 task 未完了、worktree lease 競合、readiness の stale 化、高重大度 finding

## 実装対象

- Frontend: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Backend: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- API: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Data: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Infrastructure: 非該当。この phase では契約や実装を変更しない。
- Security: 該当。成果物・検証・引き継ぎの担当境界として扱う。
- Quality: 非該当。この phase では契約や実装を変更しない。
- Documentation: 非該当。この phase では契約や実装を変更しない。
- Operations: 非該当。この phase では契約や実装を変更しない。

## 設計と配備単位

- Architecture decisions: 撮影は capture の Promise を await し終えてからモーダルを開く順序で固定し、除外リスト方式は採らない。診断はアプリ起動時から件数と総バイトの二重上限つきリングバッファへ常時記録する。エージェント取得は既存 AI 分析と同型の使い捨て Bearer で、D1 には SHA-256 ハッシュだけを保存する。R2 の公開 URL と署名付き URL は発行せず配信は Worker 経由の1本に限る。添付は対応完了から30日で削除し、既存 scheduledMaintenance へ相乗りして新規 Cron を増やさない
- Deploy unit/environment: packages/web React SPA と packages/api Cloudflare Workers、および Cloudflare D1 kanjo-db・R2 kanjo-files
- Compatibility: 既存 Cookie セッション認証と既存 agentGuard の契約を変えない。改善要望のテーブルを packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL へ追加しない。既存 nightlyBackup と wrangler.jsonc の Cron 設定を変更しない

## Write scope と競合制約

- `touches`: migrations/0029_improvement_requests.sql、packages/api/src/routes/improvement.ts、packages/api/src/improvement/contract.ts、packages/api/src/improvement/redact.ts、packages/api/src/index.ts、packages/api/src/store.ts、packages/core/src/improvement.ts、packages/core/src/index.ts、packages/web/src/components/ImprovementRequestButton.tsx、packages/web/src/components/Layout.tsx、packages/web/src/diagnostics-buffer.ts、packages/web/src/capture-screen.ts、packages/web/src/pages/Improvement.tsx、packages/web/src/App.tsx、packages/web/src/api.ts、packages/web/src/styles.css
- 排他資源: `SYS-IMPREQ-P05`
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
- PR linkage requirement: PR 本文へ beads 識別子と `dev-graph: SYS-IMPREQ-P05` を記載する
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Local reconciliation: `/dev-graph sync` が authority へ収束させる

## 実行手順

1. 依存 task と requirements snapshot の digest を確認する。
2. worktree lease を取得し write scope 内だけを変更する。
3. acceptance と verification を実行し、匿名化した証跡を残す。
4. 高重大度 finding が0であることを確認し、後続 task へ handoff する。

## 受入条件

- [ ] 改善要望ボタンの押下でモーダルを開く前に撮影が完了し、撮影された画像に、その押下で開くモーダルの DOM が含まれない
- [ ] 撮影が失敗してもモーダルは開き、スクリーンショットなしの本文だけで投稿が 2xx で成立する
- [ ] アプリ起動時から動く診断リングバッファが、未捕捉例外・unhandledrejection・console error と warn・失敗した通信を記録し、件数上限と総バイト上限の双方で切り詰めて省略件数を残す
- [ ] 使い捨て Bearer トークンの平文が D1 のどの列にも保存されず、SHA-256 ハッシュだけが保存される
- [ ] 投稿済みの改善要望から Claude Code 向けと Codex 向けの指示文がコピーでき、その指示文が指す API がトークンだけでスクリーンショットと診断情報を返す
- [ ] 撮影中は改善要望ボタンが押下不可になり、待機していることが画面に出る
- [ ] 送信前にスクリーンショットの縮小プレビューが見え、添付を外して送信できる
- [ ] 診断情報が上限を超えて切り詰められたとき、省略件数が画面にも出る

## 検証方法

- 検証: pnpm lint と pnpm typecheck を実行し、新規ファイルを含めて指摘が0件であることを確認する
- 検証: 既存の pnpm test を実行し、この phase の変更によって既存検証が1件も退行していないことを確認する。受入条件に対応する新規検証の作成と実行は P06 が所有するため、この phase の write scope には検証ファイルを含めない
- 検証: packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL に改善要望のテーブル名が現れないことを確認する
- 検証: ローカルで画面を起動し、撮影中の押下不可表示・縮小プレビュー・添付解除・省略件数表示を目視で確認する
- Required evidence: P05 の受入条件、実行結果、差分対象、未解決指摘の有無を記録する
- Privacy: 画面証跡は合成または既存の匿名表示のみとし、口座明細や金額の実データを含めない

## 是正 (2026-08-30 利用者報告)

初回実装に対する4件の報告を受け、本 phase の write scope を次で拡張した。証跡は
`.dev-graph/plans/feature-package-feat-improvement-request/evidence/phase-05-implementation.json`
の `corrections` に記録している。

1. 撮影に本文が写らない — 止める規則をページ CSS より後ろへ置く (`packages/web/src/capture-screen.ts`)
2. 画面情報・記録・問題点が送信前に読めない — `一緒に送られる情報` を追加 (`ImprovementRequestButton.tsx`)、順位付けは `packages/core/src/improvement.ts` の `highlightDiagnostics` が正本
3. 画像へ書き込めない — `packages/web/src/annotate-image.ts` と `components/ScreenshotAnnotator.tsx` を追加
4. 起動導線が分かりにくい — 画面右下の固定ボタンへ移し、`data-capture-hide` で撮影対象から外す

## リスクとロールバック

- Rollout: 依存 phase の完了後に write scope 内だけを変更し、ローカルとテスト環境で確認する
- Rollback trigger and steps: write scope の変更ファイルを直前版へ戻し、追加した migration を適用前の状態へ戻す。既存の入出金・分類・AI 分析の契約には触れていないため他機能へ波及しない。

## Handoff

- Executor: dev-graph scheduler が有効な worktree lease とともに割り当てた実行者
- Ready when: 受入条件と verification が全て PASS し、高重大度の未解決指摘がなく、後続 phase が参照できる証跡がある
- 実装 route: task-graph build
- 次に利用するノード: `SYS-IMPREQ-P06`

## 参照情報

- System specification: system-spec/index.md、system-spec/00-requirements-definition.md
- Feature: features/feat-improvement-request.md
- Architecture: architecture/arch-improvement-request-pipeline.md
- Dependency: SYS-IMPREQ-P04
- Task graph: task-graph.json の P05 node
- Requirements handoff: `.dev-graph/requirements/feat-improvement-request/task-graph-handoff.json`
