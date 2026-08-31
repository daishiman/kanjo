# 改善要望の収集とエージェント受け渡し — 実装要件

- Feature: `feat-improvement-request`
- Package: `feature-package/feat-improvement-request`
- Handoff target: `task-graph`
- Snapshot: `sha256:763ce8a7e2860327494190167401712679a1f2122bb842f57e380f3b0cfa5204`
- System plan: `sha256:e5aaef0b452885b06b9210c427c16a97c47e85a0a1c9716a17e183e53f08cf07`
- Readiness: **PASS**（missing sections 0）

## 目的

使っていて困ったことを、その場の画面と発生していたエラーごと開発側へ渡す手段が無い。文章だけの報告は再現条件が落ちるため、受け取った側が状況を組み立て直すところから始まる。画面の写真と、そのとき実際に起きていた技術的な失敗を要望に添えて、Claude Code や Codex がそのまま調査に入れる形で渡せるようにする。

## 到達点

どの画面からでも改善要望を送れ、送られた要望には『モーダルが写り込んでいない、押した瞬間の画面』と『上限まで切り詰め・秘匿値を除去した診断情報』が自動で付き、投稿済みの要望から Claude Code 向け / Codex 向けの指示文をコピーすると、エージェントがその指示文だけで使い捨てトークン認証つき API から画面と診断情報を取得できる。添付物は対応完了から30日で自動的に消え、要望本文と対応記録は残る。

## 実装要件

### REQ-IMPREQ-001 モーダルが写り込まない撮影順序

改善要望ボタン押下時に撮影の Promise を await し終えてからモーダルの open を true にし、撮影中はボタンを押下不可にして待機中であることを画面に出す。モーダル要素を除外リストへ入れる方式は採らない。

- 担当 task: `SYS-IMPREQ-P02`、`SYS-IMPREQ-P05`、`SYS-IMPREQ-P07`
- 受入条件: A01、A03
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-002 撮影失敗時の投稿縮退

撮影に失敗してもモーダルは開き、スクリーンショットなしの本文だけで投稿が 2xx で成立する。撮影の失敗を投稿の失敗へ伝播させない。

- 担当 task: `SYS-IMPREQ-P02`、`SYS-IMPREQ-P05`、`SYS-IMPREQ-P07`
- 受入条件: A02
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-003 送信前の縮小プレビューと添付解除

送信前にスクリーンショットの縮小プレビューを表示し、添付を外した状態でも送信できる。

- 担当 task: `SYS-IMPREQ-P05`、`SYS-IMPREQ-P07`
- 受入条件: A04
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-004 起動時から動く診断リングバッファ

アプリ起動時から上限つきリングバッファへ未捕捉例外・unhandledrejection・console error/warn・失敗した通信を常時記録し、改善要望ボタンを押す前に発生した事象を投稿へ含める。

- 担当 task: `SYS-IMPREQ-P02`、`SYS-IMPREQ-P05`、`SYS-IMPREQ-P06`、`SYS-IMPREQ-P07`
- 受入条件: A05
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-005 件数とバイトの二重上限と省略件数の可視化

診断情報に件数上限と総バイト上限を二重に課し、切り詰めが起きたときは省略件数を保存して画面にも表示する。黙って捨てない。

- 担当 task: `SYS-IMPREQ-P02`、`SYS-IMPREQ-P05`、`SYS-IMPREQ-P06`、`SYS-IMPREQ-P07`
- 受入条件: A06
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-006 サーバー受信時の二重マスク

クライアント側マスクを外した診断情報を直接 POST しても、保存後の値から Cookie / Authorization / Bearer / パスワード相当の値が除去されている。クライアント側マスクを唯一の防御にしない。

- 担当 task: `SYS-IMPREQ-P05`、`SYS-IMPREQ-P06`、`SYS-IMPREQ-P09`
- 受入条件: A07
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-007 使い捨て Bearer トークンの保存と失効

トークンは prefix つきで発行し D1 には SHA-256 ハッシュだけを保存する。TTL 24 時間と取得回数上限を課し、期限切れと回数超過を互いに区別できる拒否理由で拒否して 500 へ丸めない。トークン値をアプリケーションログへ出力しない。

- 担当 task: `SYS-IMPREQ-P02`、`SYS-IMPREQ-P05`、`SYS-IMPREQ-P06`、`SYS-IMPREQ-P09`
- 受入条件: A08、A09、A10
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-008 Worker 経由の単一配信経路

R2 のスクリーンショットに対する公開 URL・署名付き URL を一切発行せず、取得経路を Worker 経由の1本に限定する。

- 担当 task: `SYS-IMPREQ-P02`、`SYS-IMPREQ-P05`、`SYS-IMPREQ-P09`
- 受入条件: A11
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-009 エージェント向け指示文コピーと取得

投稿済みの改善要望から Claude Code 向け / Codex 向けの指示文をコピーでき、その指示文が指す API をコピーしたトークンだけで実行するとスクリーンショットと診断情報が取得できる。体裁は既存 AI 分析と同型にする。

- 担当 task: `SYS-IMPREQ-P05`、`SYS-IMPREQ-P07`
- 受入条件: A12
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-010 対応完了から30日での添付削除

status=done かつ完了から30日を超えた要望のスクリーンショット R2 オブジェクトと診断情報列を削除し、本文・状態・対応記録は参照できる状態で残す。

- 担当 task: `SYS-IMPREQ-P05`、`SYS-IMPREQ-P08`、`SYS-IMPREQ-P09`
- 受入条件: A13
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-011 バックアップ対象への非追加の固定

改善要望のテーブル名が packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL に1つも現れないことをテストで固定する。追加すると30日削除が複製側で骨抜きになる。

- 担当 task: `SYS-IMPREQ-P06`、`SYS-IMPREQ-P08`、`SYS-IMPREQ-P09`
- 受入条件: A14
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

### REQ-IMPREQ-012 既存 scheduledMaintenance への相乗り

削除ジョブは既存 scheduledMaintenance の Promise.allSettled 配下で他ジョブと独立に成否を記録し、新規 Cron トリガを wrangler.jsonc へ増やさない。

- 担当 task: `SYS-IMPREQ-P08`、`SYS-IMPREQ-P09`、`SYS-IMPREQ-P13`
- 受入条件: A15
- Source: `features/feat-improvement-request.context.json`、`architecture/arch-improvement-request-pipeline.md`

## 受入条件の対応表

| # | 受入条件 | 要件 |
|---|---|---|
| A01 | 改善要望ボタン押下で撮影された画像に、その押下で開くモーダルの DOM が含まれない | `REQ-IMPREQ-001` |
| A02 | 撮影が失敗してもモーダルは開き、スクリーンショットなしの本文だけで投稿が 2xx で成立する | `REQ-IMPREQ-002` |
| A03 | 撮影中はボタンが押下不可で、待機していることが画面に出る | `REQ-IMPREQ-001` |
| A04 | 送信前にスクリーンショットの縮小プレビューが見え、添付を外して送信できる | `REQ-IMPREQ-003` |
| A05 | 改善要望ボタンを押す前に発生した未捕捉例外・unhandledrejection・console error/warn・失敗した通信が、投稿された診断情報に含まれる | `REQ-IMPREQ-004` |
| A06 | 診断情報が件数上限または総バイト上限を超えたとき、切り詰められたうえで省略件数が保存され画面にも出る | `REQ-IMPREQ-005` |
| A07 | クライアント側マスクを外した診断情報を直接 POST しても、保存後の値から Cookie / Authorization / Bearer / パスワード相当の値が除去されている | `REQ-IMPREQ-006` |
| A08 | 発行した Bearer トークンの平文が D1 のどの列にも保存されておらず、SHA-256 ハッシュだけが保存されている | `REQ-IMPREQ-007` |
| A09 | TTL 超過のトークンと取得回数上限超過のトークンが、互いに区別できる拒否理由で拒否され、いずれも 500 にならない | `REQ-IMPREQ-007` |
| A10 | トークン値がアプリケーションログのどこにも出力されない | `REQ-IMPREQ-007` |
| A11 | R2 のスクリーンショットに対する公開 URL・署名付き URL が発行されず、取得経路が Worker 経由の1本だけである | `REQ-IMPREQ-008` |
| A12 | 投稿済みの改善要望から Claude Code 向け / Codex 向けの指示文がコピーでき、その指示文が指す API をコピーしたトークンだけで実行するとスクリーンショットと診断情報が取得できる | `REQ-IMPREQ-009` |
| A13 | status=done かつ完了から30日を超えた要望の、スクリーンショット R2 オブジェクトと診断情報列が削除され、本文・状態・対応記録は参照できる | `REQ-IMPREQ-010` |
| A14 | 改善要望のテーブル名が packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL に1つも現れないことをテストが固定している | `REQ-IMPREQ-011` |
| A15 | 削除ジョブが既存 scheduledMaintenance の Promise.allSettled 配下で他ジョブと独立に成否を記録し、新規 Cron トリガが wrangler.jsonc に増えていない | `REQ-IMPREQ-012` |

## 実装境界

本文書は要件の確定までを担い、実装コードを生成しない。実装は exact-13 package の P05 以降が所有する。

## 前提と保留

- 本機能の migration は本番 D1 のスキーマ整合が回復するまで本番へ配信できない。`feat-prod-d1-schema-recovery` が先行する。ローカル・テストでの完成は妨げない。
- 確定 task spec の `tasks/feat-improvement-request/SYS-IMPREQ-PNN.md` への投影は後続の `node` verb が所有する。
