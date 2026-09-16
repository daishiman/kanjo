---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G3]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-infrastructure-web-rc-observed-001。裏付け質疑 (`qa_refs`): `qa-database-web-rc-decision-008`, `qa-infrastructure-web-rc-inference-002` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G3 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリ (iOS/Android)を提供していたなら、本カテゴリではストア配信とアプリ更新の経路、および照合 API の旧版クライアントを並行して受け付ける期間を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリ (iPadOS/Android)を提供していたなら、本カテゴリではストア配信とアプリ更新の経路、および照合 API の旧版クライアントを並行して受け付ける期間を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows デスクトップアプリを提供していたなら、本カテゴリではストア配信とアプリ更新の経路、および照合 API の旧版クライアントを並行して受け付ける期間を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux デスクトップアプリを提供していたなら、本カテゴリではストア配信とアプリ更新の経路、および照合 API の旧版クライアントを並行して受け付ける期間を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS デスクトップアプリを提供していたなら、本カテゴリではストア配信とアプリ更新の経路、および照合 API の旧版クライアントを並行して受け付ける期間を決める必要があった。狭幅は既存 web のアイコンレールと下部タブのレスポンシブ表示 (3 カラムの縦積み) の中で扱う。対象を web のみとする利用者決定 (qa-target-platforms-rc-001 / appr-foundation-reconciliation-001、2026-09-15) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | Google SRE の容量計画を、GET /api/reconciliation の 1 リクエストの D1 読取り本数を /total-cashflow と同程度に保ち、一括操作を 200 件で打ち切る確定内容に反映した。単独利用のため SLO は定義しない。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | Google SRE の『運用対象を増やさない』を、Worker・binding・cron の本数を変えず、履歴の 90 日削除を既存の夜間 cron の処理に足すだけにする確定内容に反映した。追加だけの migration は deploy.yml が自動適用し、手動の migrate.yml 手順は発生しない。 |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G3

#### 主たる接地根拠: `qa-infrastructure-web-rc-observed-001`

**問**

照合改善の配信とインフラ構成は現行どうなっていて、変更は要るか。

**答**

packages/api/wrangler.jsonc の Worker が SPA を Workers Assets (binding ASSETS) で配信し、D1 (DB)・R2 (FILES)・cron (0 18 * * *) を持つ。GitHub Actions は ci.yml・deploy.yml (追加だけの D1 migration を自動適用)・migrate.yml (破壊的 migration の手動承認)。照合改善は既存 Worker に route を足し、追加だけの migration と SPA 画面の更新を行うだけで、binding・Worker・デプロイ経路の変更は無い。GET /api/reconciliation は loadDataset と freee 系テーブル・MF 除外・直前の操作を 1 リクエストで読むため、既存 /total-cashflow と同程度の D1 読取りになる (d1-limits.ts の制限内)。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: アシスタントが 2026-09-15 にリポジトリ (HEAD cc0d5e3) の該当ファイルを読んで確認した観測事実。answered_at は確認直後に date -u で実測した時刻。 対象: packages/api/wrangler.jsonc, .github/workflows/{ci,deploy,migrate}.yml, packages/api/src/d1-limits.ts。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-database-web-rc-decision-008`

**問**

『元に戻す』の範囲をどうするか。選択肢: (A) 直前の操作 1 件+履歴は保存: 画面には直前の操作 1 件 (一括なら一括単位) を出し、元に戻すで操作前の判断状態へ戻す。履歴表には全操作を 90 日保存し、取消済みの操作は再取消できない。中間の操作を戻すには各行の判断を解除する (推奨) / (B) 履歴から任意の操作を戻す / (C) 画面内の直前 1 件のみで履歴を保存しない。

**答**

(A) 直前の操作 1 件+履歴は保存 を選択した。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者が 2026-09-15 に AskUserQuestion で推奨案を選択した。answered_at は回答直後に date -u で実測した時刻で、実際の選択時刻の上限値である。 / 回答時刻: 2026-09-15T08:59:56Z)

#### 裏付け質疑: `qa-infrastructure-web-rc-inference-002`

**問**

照合操作の履歴 90 日保存をどう運用するか。

**答**

既存の夜間 cron (0 18 * * *) の処理に、reconciliation_actions の created_at が 90 日より古い行の削除を足す。新しい cron・binding・Worker は足さない。migration は追加のみ (新表 3 つと duplicate_verdicts への列追加なし) なので deploy.yml の自動適用経路に乗り、migrate.yml の手動承認は不要。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 出所: アシスタントが 2026-09-15 に観測事実と利用者決定から導いた推定。単独では確定の根拠にせず、観測事実 (主根拠) の補足として qa_refs に載せる。answered_at は記録直前に date -u で実測した時刻。 前提: qa-database-web-rc-decision-008 (履歴 90 日)、packages/api/wrangler.jsonc の crons、deploy.yml 冒頭の自動適用方針。 / 回答時刻: 2026-09-15T08:59:56Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G3**: 照合操作を保存し元に戻せるようにする。既存の duplicate_verdicts と freee 除外表を再利用し、照合画面用の API (一覧・KPI・キューを返す GET と、照合 / 別取引 / 除外 / 一括照合の POST)、verdict 取消 API、MF 側除外、照合操作の履歴表 (直前の操作と元に戻すに使う) を migration 付きで追加する。一括は最大 200 件で部分成功を返す。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O3 | 照合操作 API・取消・MF 除外・操作履歴を migration 付きで追加する。 | API 統合テストが認証付きで照合 / 別取引 / 除外 / 一括 (201 件で 400、部分成功の内訳) / 取消 / 直前の操作の取得を検証し、migration が既存 D1 に冪等に適用され、元に戻すと KPI とキューが操作前の値に戻る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I4**: 照合画面用 API と verdict 取消・MF 除外・操作履歴を migration 付きで足し、同じ取引として照合 / 別の取引として処理 / 除外 / 一括照合 / 元に戻すを web から呼ぶ。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。配信構成 (Worker・Workers Assets・D1・R2・cron) と binding を変えず、追加だけの migration を既存の deploy.yml 自動適用に乗せるサイクルで、infrastructure 固有に適用すべき設計知識が無いことを確認した上での確定である。本章に効く制約は D1 のクエリ上限と batch の原子性で、GET /api/reconciliation の読取り本数を /total-cashflow と同程度に保ち、取消を 1 回の batch にすることで満たす。履歴の 90 日削除は既存の夜間 cron に足す。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-15T08:59:56Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-d1-limits | 2026-04-21 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/d1/platform/limits/ | 2026-09-15T09:06:26Z | 2026-09-15T09:06:26Z |
