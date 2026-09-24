---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G4]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-settings-infrastructure-web-003。裏付け質疑 (`qa_refs`): `qa-settings-infrastructure-web-evidence-001`, `qa-settings-infrastructure-web-002`, `qa-settings-infrastructure-web-004`, `qa-settings-decision-007` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G4 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、infrastructure ではスマートフォン向け専用アプリの配布経路 (ストア・署名・更新) と、端末側のバックアップの取り方を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、infrastructure ではタブレット向け専用アプリの配布経路 (ストア・署名・更新) と、端末側のバックアップの取り方を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、infrastructure ではWindows 向けデスクトップアプリの配布経路 (ストア・署名・更新) と、端末側のバックアップの取り方を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、infrastructure ではLinux 向けデスクトップアプリの配布経路 (ストア・署名・更新) と、端末側のバックアップの取り方を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、infrastructure ではmacOS 向けデスクトップアプリの配布経路 (ストア・署名・更新) と、端末側のバックアップの取り方を決める必要があった。対象を web のみとする利用者決定 (qa-settings-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 設定画面のインフラでは、失敗した回も失敗マーカーとして残し、復元前の自動退避を別プレフィックスへ置いて保持 30 日で消す形へ反映した。R2 の list は 1000 件ごとに cursor で続きを取る前提で書く。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 設定画面のインフラでは、夜間バックアップを JST 2:00 (UTC 17:00) の cron へ移し、各回の成否・メモ・要約を R2 の customMetadata に残して、ログを見なくても画面から運用状態を確かめられる形へ反映した。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G4

#### 主たる接地根拠: `qa-settings-infrastructure-web-003`

**問**

web の設定画面の infrastructure 要件のうち、利用者の決定・承認に遡れるものは何か。

**答**

web の設定画面のインフラ要件 (決定 007・C5・U7 に基づく): 夜間バックアップを毎日 JST 2:00 に実行し、各回に 状態 (成功 / 失敗)・メモ・設定部分の要約 を持たせ、失敗した回も一覧に出す (決定 007)。バックアップの中身は従来どおり全データ (決定 007)。cron の変更は wrangler.jsonc の 1 行で、保持 30 日は据え置く (C5・U7 対象外)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が決めた・承認したものだけから書き起こした要件。出所は 画像 design/FINAL-UI/images/18-settings.png (利用者が正本と指示)、U1-U9 (appr-foundation-settings-001)、決定 qa-settings-decision-001〜010 と qa-settings-target-platforms-001。仕組みの選択 (パス・保存先の形・部品名・具体値) は同じ章の -002 と -004 (agent-inference) に分けた。 / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-infrastructure-web-evidence-001`

**問**

web の設定画面の infrastructure について、既存コードで何が観測できるか。

**答**

packages/api/wrangler.jsonc: R2 は FILES → kanjo-files、D1 は DB、cron は "0 18 * * *" (JST 03:00)。nightlyBackup (index.ts:171-196) は loadBackupPayload を R2 backups/YYYY-MM-DD.json に put し 30 日より古いものを削除。scheduled は :390-393。失敗はログのみ (:239-249)。R2 list は 1000 件のページングを考慮していない (30 件保持なので実害なし)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: 既存コードの読解 (HEAD 0ed2d8c、Explore 調査) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-infrastructure-web-002`

**問**

web の設定画面の infrastructure で、利用者が決めていない具体値は何か。

**答**

具体値の推定: 失敗マーカーは backups/YYYY-MM-DD.failed.json (本文は理由コードのみ)。要約は集計ルール件数・名義の設定有無・統計の月数・現金上書きの件数。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者確認も検証可能な出典も経ていない具体値。実装時に確かめる) / 回答時刻: 2026-09-22T08:39:27Z)

#### 裏付け質疑: `qa-settings-infrastructure-web-004`

**問**

web の設定画面の infrastructure で、利用者が選んでいない仕組みの選択は何か。

**答**

仕組みの選択の推定 (infrastructure): cron 式は UTC 評価なので "0 17 * * *"。状態・メモ・要約・形式の版は R2 オブジェクトの customMetadata に置く。失敗した回は backups/YYYY-MM-DD.failed.json の小さなマーカー (本文は理由コードのみ) を残す。復元前の自動退避は別プレフィックス backups/pre-restore/ に置き、同じ保持規則で消す。新しいバインディングは足さない。R2 の list は 1000 件ごとに cursor で続きを取る。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントの推定 (利用者が選んでいない仕組みの選択。実装時に確かめる) / 回答時刻: 2026-09-22T09:45:25Z)

#### 裏付け質疑: `qa-settings-decision-007`

**問**

自動バックアップをどうするか。画像は『毎日 午前2:00』・ステータス (最新 / 成功)・メモ・比較・復元。現状は毎日 3:00 (JST) に全データを R2 へ保存、30 日保持、失敗はログのみ。

**答**

2:00 に変更＋状態・メモ・比較を足す (推奨)。cron を JST 2:00 に変え、各バックアップに状態 (成功 / 失敗)・メモ・設定部分の要約を持たせ、失敗も一覧に出す。『比較』はその日の設定と現在の設定の差分を表示する。中身は従来どおり全データ。

> **訂正あり** — 直上の答は凍結された記録であり、後から次の訂正が入っている。
> 本文中の記述と食い違う場合は、訂正側が正である。
>
> - `2026-09-22T09:56:07Z` — 提示時の問いと選択肢の原文 (逐語。セッション履歴の AskUserQuestion 入力 toolu_017h7b4GCCbCPCw944pbShTE の questions[2]、提示 2026-09-22T08:25:32Z から復元。本文の question は要約だったため、中立性の検証用に原文をここへ残す): 【問い】自動バックアップをどうしますか？ 画像は『毎日 午前2:00』・ステータス（最新/成功）・メモ・比較・復元。現状は毎日 3:00(JST) に全データを R2 へ保存、30日保持、失敗はログのみです。 【選択肢】(1)『2:00に変更＋状態・メモ・比較を足す (推奨)』— cron を JST 2:00 に変え、各バックアップに状態（成功/失敗）・メモ・設定部分の要約を持たせる。失敗も一覧に出す。『比較』はその日の設定と現在の設定の差分を表示。中身は従来どおり全データ。 (2)『3:00のまま、表示を実際に合わせる』— 実行時刻は変えず、説明文を『午前3:00』にする。状態・メモ・比較は足す。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢と推奨案・説明提示あり / 回答時刻: 2026-09-22T08:26:39Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G4**: 設定を持ち出し・戻せるようにする。設定のエクスポートは集計ルール・名義・統計・現金上書きだけを版番号つき JSON で出し、復元は同じ形だけを受ける (厳密な形の検証・サイズ上限・差分プレビューと確認・復元直前に現在の設定を自動退避)。取引は消えない。マトリクス CSV・取引 CSV・レポート HTML は選択中の期間で出す。自動バックアップは毎日 JST 2:00 に実行し、各回に 状態 (成功 / 失敗)・メモ・設定部分の要約 を持たせて失敗も一覧に出し、『比較』でその日の設定と現在の設定の差分を見てから『復元』できる。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O4 | 設定の書き出し・復元・バックアップが安全に往復する。 | 書き出した JSON を復元すると設定が一致し取引件数は不変、形の違う JSON・上限超過・版違いは 4xx で拒否され何も変わらない。復元前の自動退避が 1 件増える。scheduled のテストで 2:00 の実行が状態つきで保存され、失敗も一覧に出る。比較が差分を返す。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I2**: core に設定画面の算出 (仮称 settingsScreen) と、集計ルールの照合・適用 (勘定科目 / 取引先)・現金上書きの解決・設定 JSON の検証と差分を新設する。
- **I5**: 設定のみの JSON 書き出し・復元 API (版番号・厳密検証・サイズ上限・差分プレビュー・復元前退避) と、出力 3 種の期間連動を作る。
- **I6**: 夜間バックアップを JST 2:00 にし、R2 の customMetadata に状態・メモ・設定要約を持たせ、失敗も記録する。一覧 API に状態・メモ、比較 API に差分を足す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章に引かれる deep knowledge card は無い (resource-map の read_when に infrastructure を含む card が無い)。そのため card の適用は主張せず、上流指針 (Google SRE の operations・reliability) の反映を doctrine の節にだけ記録した。本章の確定内容 (JST 2:00・状態とメモ・失敗の一覧化・保持 30 日据え置き) は決定 007 と C5 から直接来ている。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-22T09:45:25Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-cron-triggers | 2026-09-04 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/configuration/cron-triggers/ | 2026-09-22T08:43:18Z | 2026-09-22T08:43:18Z |
| cloudflare-r2-workers-api | 2026-07-31 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ | 2026-09-22T08:43:18Z | 2026-09-22T08:43:18Z |
