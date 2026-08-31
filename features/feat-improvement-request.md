---
graph_node_id: "feat-improvement-request"
artifact_kind: "feature"
artifact_subtypes: []
title: "改善要望の投稿とエージェントへの受け渡し"
project_id: "kanjo"
domain: "improvement-feedback"
status: "draft"
owners: []
tags: ["improvement-request", "screenshot", "diagnostics", "agent-handoff", "retention"]
priority: "high"
start_date: null
target_date: null
iteration: null
created_at: "2026-08-30T00:00:00Z"
updated_at: "2026-08-30T00:00:00Z"
depends_on: []
related_nodes: ["arch-improvement-request-pipeline"]
resource_scope: ["packages/web/src", "packages/api/src", "packages/core/src", "migrations", "docs"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-improvement-request.md"
template_id: "feature"
template_version: "1.0.1"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluator": "system-spec-harness/assign-system-spec-completeness-evaluator", "evidence_ref": "system-spec/spec-state.json", "evaluated_digest": "ddf9d13227fd61d9c67241acdb03fc62595ddb7dd848ab229ae949cb5bbff1ee"}
source_lineage: {"origin_kind": "generated", "source_plugin": "dev-graph", "source_path": "system-spec/index.md", "source_version": "0.1.9", "source_digest": "ddf9d13227fd61d9c67241acdb03fc62595ddb7dd848ab229ae949cb5bbff1ee", "imported_at": "2026-08-30T00:00:00Z"}
classification_confidence: 0.98
classification_reason: "画面導線・API・D1テーブル・R2オブジェクト・定期実行を1つの利用者価値 (困りごとを送るとエージェントが直せる) へ束ねる機能単位であるため feature 層。単一 phase task ではない。"
classification_candidates: []
github_publication: {"mode": "local_only", "project_aliases": [], "labels": [], "milestone": null}
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"policy": "manual", "status": "open", "source": null, "completed_at": null, "reconciled_at": null, "evidence_refs": ["system-spec/index.md"]}
implementation_readiness: {"status": "complete", "missing_sections": [], "checked_at": "2026-08-30T00:00:00Z"}
purpose: "使っていて困ったことを、その場の画面と発生していたエラーごと開発側へ渡す手段が無い。文章だけの報告は再現条件が落ちるため、受け取った側が状況を組み立て直すところから始まる。画面の写真と、そのとき実際に起きていた技術的な失敗を要望に添えて、Claude Code や Codex がそのまま調査に入れる形で渡せるようにする。"
goal: "どの画面からでも改善要望を送れ、送られた要望には『モーダルが写り込んでいない、押した瞬間の画面』と『上限まで切り詰め・秘匿値を除去した診断情報』が自動で付き、投稿済みの要望から Claude Code 向け / Codex 向けの指示文をコピーすると、エージェントがその指示文だけで使い捨てトークン認証つき API から画面と診断情報を取得できる。添付物は対応完了から30日で自動的に消え、要望本文と対応記録は残る。"
scope_in: ["全画面共通の改善要望ボタンと投稿モーダル", "モーダルを開く前に撮影を完了させるスクリーンショット自動添付", "撮影失敗時にスクリーンショットなしで投稿を成立させる縮退", "送信前の縮小プレビューと添付解除", "アプリ起動時から動く上限つき診断リングバッファ", "件数上限と総バイト上限の二重切り詰めと省略件数の記録", "収集時とサーバー受信時の二重マスク", "Cookie 認証の画面用 API (投稿・一覧・詳細・状態更新・コピー記録)", "使い捨て Bearer トークンの発行・ハッシュ保存・TTL・取得回数上限", "Bearer 認証のエージェント用取得 API (診断情報・スクリーンショット)", "既存 AI 分析と同体裁の Claude Code / Codex 向け指示文コピー UI", "改善要望テーブル群の migration", "対応完了から30日での添付自動削除を既存 scheduledMaintenance へ相乗り", "R2 孤児オブジェクトの突合"]
scope_out: ["改善要望テーブルを BACKUP_SNAPSHOT_SQL の列挙対象へ追加すること", "既存 nightlyBackup の実装と Cron 設定の変更", "新規 Cron トリガの追加", "R2 の公開 URL・署名付き URL の発行", "外部エラートラッキング SaaS への送信", "Screen Capture API による画面共有ダイアログ経由の撮影", "要望本文・状態・対応記録の30日削除 (削除対象は添付物のみ)", "本番 D1 への migration 適用 (feat-prod-d1-schema-recovery の完了が前提)"]
acceptance: ["改善要望ボタン押下で撮影された画像に、その押下で開くモーダルの DOM が含まれない", "撮影が失敗してもモーダルは開き、スクリーンショットなしの本文だけで投稿が 2xx で成立する", "撮影中はボタンが押下不可で、待機していることが画面に出る", "送信前にスクリーンショットの縮小プレビューが見え、添付を外して送信できる", "改善要望ボタンを押す前に発生した未捕捉例外・unhandledrejection・console error/warn・失敗した通信が、投稿された診断情報に含まれる", "診断情報が件数上限または総バイト上限を超えたとき、切り詰められたうえで省略件数が保存され画面にも出る", "クライアント側マスクを外した診断情報を直接 POST しても、保存後の値から Cookie / Authorization / Bearer / パスワード相当の値が除去されている", "発行した Bearer トークンの平文が D1 のどの列にも保存されておらず、SHA-256 ハッシュだけが保存されている", "TTL 超過のトークンと取得回数上限超過のトークンが、互いに区別できる拒否理由で拒否され、いずれも 500 にならない", "トークン値がアプリケーションログのどこにも出力されない", "R2 のスクリーンショットに対する公開 URL・署名付き URL が発行されず、取得経路が Worker 経由の1本だけである", "投稿済みの改善要望から Claude Code 向け / Codex 向けの指示文がコピーでき、その指示文が指す API をコピーしたトークンだけで実行するとスクリーンショットと診断情報が取得できる", "status=done かつ完了から30日を超えた要望の、スクリーンショット R2 オブジェクトと診断情報列が削除され、本文・状態・対応記録は参照できる", "改善要望のテーブル名が packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL に1つも現れないことをテストが固定している", "削除ジョブが既存 scheduledMaintenance の Promise.allSettled 配下で他ジョブと独立に成否を記録し、新規 Cron トリガが wrangler.jsonc に増えていない", "撮影された画像に、そのとき見えていた本文が写っており、止める規則がページ CSS より後ろに置かれている", "送信前に、発生した画面・表示サイズ・取得時刻・ブラウザと、診断情報の1件ずつ (種類と要約) がモーダルで読める", "先に見るべき数件 (最大3件) が全件の折りたたみより前に出て、同じ数件が指示文にも載る", "スクリーンショットへドラッグで枠を書き込め、その枠が送信される画像へ焼き込まれる", "起動導線が画面右下に固定され、撮影対象には写らない"]
architecture_refs: ["arch-improvement-request-pipeline"]
---

# 目的

`purpose` のとおり。補足すると、この機能が無い状態では改善要望は「文章」でしか届かない。
文章は、書いた人が気づいたことしか含まない。実際に画面の裏で何が失敗していたかは、
書いた人には見えていないので、当然書かれない。

その結果、受け取った側は再現条件を推測するところから始めることになる。
画面の写真と、そのとき実際に起きていた技術的な失敗を一緒に渡せば、この推測が要らなくなる。

# 到達状態

`goal` のとおり。

# スコープ

`scope_in` / `scope_out` のとおり。**特に重要な除外**は次の2つ。

1. **改善要望テーブルをバックアップ対象へ入れない。**
   入れると、30日で消したはずの添付物が複製側に最大30日残り、最小保持が形骸化する。
2. **R2 の署名付き URL を発行しない。**
   指示文はコピーされて出回る文字列なので、期限内無制限に再利用でき個別失効もできない
   認証情報を載せてはならない。

# 受入

`acceptance` の20件 (うち A16..A19 は利用者報告 2026-08-30 による是正)。

# 前提

本番 D1 のスキーマ版数が `0005_sub_vendors.sql` に留まっており、
`BACKUP_SNAPSHOT_SQL` が参照する後続 migration のテーブルが存在しないため、
夜間バックアップは本番で毎晩失敗している (`system-spec/spec-state.json` qa-019)。

本機能の migration を本番へ配信するには、先に `feat-prod-d1-schema-recovery` 系の
作業でスキーマ整合を回復する必要がある。ローカルおよびテスト環境での完成は妨げない。

# 参照

- architecture: `arch-improvement-request-pipeline`
- 仕様: `system-spec/index.md` / `system-spec/00-requirements-definition.md`
- 決定: D5 (撮影方式) / D6 (保持期間) / D7 (バックアップ頻度) / D8 (診断収集タイミング) / D9 (取得認証)
