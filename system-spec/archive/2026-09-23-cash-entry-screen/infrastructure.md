---
status: confirmed
category: infrastructure
aggregate: 確定
spec_cells: [infrastructure.web, infrastructure.mobile, infrastructure.tablet, infrastructure.desktop-windows, infrastructure.desktop-linux, infrastructure.desktop-macos]
serves_goals: [G2]
---

# インフラ (infrastructure)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-cash-infrastructure-web-002。裏付け質疑 (`qa_refs`): `qa-cash-infrastructure-web-evidence-001`, `qa-cash-decision-008` — 本章の「確定内容 (質疑録)」へ接地根拠として併記。資するゴール: G2 |
| モバイル (mobile) | 対象外 | 理由: スマートフォン向け専用アプリを提供していたなら、infrastructure ではストア配信と、API の後方互換を保つ版の並行運用を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| タブレット (tablet) | 対象外 | 理由: タブレット向け専用アプリを提供していたなら、infrastructure ではタブレット向けビルドの配信経路を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Windows 向けデスクトップアプリを提供していたなら、infrastructure ではインストーラーと自動更新サーバーを決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Linux 向けデスクトップアプリを提供していたなら、infrastructure ではディストリビューションごとのパッケージ配信を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: macOS 向けデスクトップアプリを提供していたなら、infrastructure ではdmg の配布と Sparkle などの更新配信を決める必要があった。対象を web のみとする利用者決定 (qa-cash-target-platforms-001) によりその検討は発生しない。 |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| reliability | Google SRE | SLO/エラーバジェット・冗長性・スケーリング・監視の上流指針 | https://sre.google/books/ | 2026-07-12 | 完全消去の job を他の夜間 job と Promise.allSettled で独立させ、失敗しても他の job とバックアップを止めない形へ反映した。1 晩の上限を超えた分は翌晩に続けて消す。 |
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ | 2026-07-12 | 論理削除の完全消去を、新しい cron を足さず既存の 0 18 * * * の scheduledMaintenance に独立 job として相乗りさせ、D1 クエリ 2 本を SCHEDULED_MAINTENANCE_D1_PLAN に宣言する形へ反映した。計画の合計 49 に合わせて計画上限を 49 へ上げ、ハード上限 50 との間に 1 本の余裕を残す (qa-cash-decision-008)。 |

## 確定内容 (質疑録)

> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。

### Web (web)

- 資するゴール: G2

#### 主たる接地根拠: `qa-cash-infrastructure-web-002`

**問**

論理削除の完全消去を、夜間処理のどこでどの予算で動かすか。

**答**

既存の夜間 cron (0 18 * * *) の scheduledMaintenance に独立 job cash_soft_delete_purge を 1 本足し、deleted_at から 30 日を過ぎた行を物理削除する。job の D1 クエリ 2 本を SCHEDULED_MAINTENANCE_D1_PLAN に宣言して型で結び、計画の合計は 47 から 49 になる。これに合わせて計画上限 SCHEDULED_D1_QUERY_PLAN_MAX を 47 から 49 へ上げ、受理上限 SCHEDULED_D1_QUERY_ACCEPTED_MAX (49) の内側、ハード上限 SCHEDULED_D1_QUERY_LIMIT (50) まで 1 本の余裕を残す。既存 job の枠は変えない。新しい binding・cron・外部サービスは足さない。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 利用者の承認 (appr-foundation-cash-003、qa-cash-decision-007) と決定 qa-cash-decision-006 / 008 の範囲に収まる確定内容。経路名・定数名・現在値はリポジトリの現物 (store.ts・routes/settings.ts・routes/cash.ts・schema-guard.ts・scheduled-maintenance-budget.ts) で確認した。 / 回答時刻: 2026-09-21T22:28:41Z)

#### 裏付け質疑: `qa-cash-infrastructure-web-evidence-001`

**問**

infrastructure 章の裏付けとして、現行実装について何を観測したか。

**答**

Worker の cron は packages/api/wrangler.jsonc:31 の "0 18 * * *" 1 本で、scheduledMaintenance (packages/api/src/index.ts:196) がバックアップの後に 6 本の独立 job を並行実行する。job と D1 のクエリ予算は packages/api/src/scheduled-maintenance-budget.ts:77 の SCHEDULED_MAINTENANCE_D1_PLAN と Record 型で結ばれ、宣言漏れは typecheck で止まる。

- (根拠の性質: コード・設定・公式文書で検証できる観測事実 / 出所: リポジトリの現物 (ファイルと行) を読んで記録した観測。answered_at は観測後に実測した時刻。 / 回答時刻: 2026-09-21T15:20:56Z)

#### 裏付け質疑: `qa-cash-decision-008`

**問**

夜間処理の D1 クエリ予算は計画 47 本に対して計画上限 SCHEDULED_D1_QUERY_PLAN_MAX も 47 本で空きが無い (受理上限 49・ハード上限 50)。現金明細の完全消去 (2 本) をどう収めるか。

**答**

計画上限を 49 へ上げる。受理上限 49 の内側に収め、ハード上限 50 まで 1 本の余裕を残す。既存 job の枠は変えず、新しい cron も足さない (C3 の範囲内)。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: AskUserQuestion / 選択肢 3 件 (計画上限を 49 へ上げる・既存 job の枠を割り直す・別の cron を足す) と推奨案を提示し、利用者が「計画上限を 49 へ上げる (推奨)」を選択。answered_at は選択時刻の上界。 / 回答時刻: 2026-09-21T22:26:35Z)

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G2**: 記録が消えない。入力途中の内容はブラウザ内に自動保存して復元でき、削除は論理削除として一覧と集計から外したうえで『元に戻す』で同じ行を復活でき、30 日後に夜間処理で完全に消える。

### 受入条件 (Delta の判定点)

| 目標 | 到達点 | 達成の観測点 (measure) |
|---|---|---|
| O2 | 下書きと論理削除で記録が欠けない。 | DOM テストで入力→再描画後に下書きが復元されること、API テストで削除→元に戻すで同じ id が一覧に戻ること、削除中の行が集計 (cashToDeal / cashToTx の入力) に 0 件であることが通る。 |

### 本章がかなえる具体的やりたいこと (U9)

- **I3**: cash_entries に owner・transit_purpose・deleted_at を足す追加のみの migration 0050 (入力経路は列を持たず交通費の区間の有無から導く) と、削除・復元・一括削除・一括復元の API、削除中の行を読まない条件を cash_entries を読む全経路 5 本 (loadCashEntries・BACKUP_SNAPSHOT_SQL・loadImportRestoreSettingsSnapshot・loadCategoryUsageContext・PUT の既存行取得) に掛けること、夜間の完全消去を実装する。 JSON 復元の『空か』判定だけは削除中の行も数え、削除中の行が残る間は現金明細を復元しない (qa-cash-decision-009)。
- **I4**: 入力途中の内容をブラウザ内に自動保存し、保存時刻を表示し、復元する。『入力をクリア』で下書きも消す。
- **I5**: 削除をインライン確認にし、削除完了トーストの『元に戻す』で同じ行を復活させる。空状態では画面内だけのサンプル表示と『はじめての明細を入力』を出す。

### 本章に効く確定意思決定

- (本章ゴールに効く確定 decision なし)

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### 本章での適用

本章へ引く card は 0 件である。配信構成 (Worker・Workers Assets・D1) と binding を変えず、完全消去を既存の夜間 cron に相乗りさせる判断は、Operations の上流指針 (doctrine) の側で記録した。

- (根拠の性質: アシスタントの推定 (利用者確認も検証可能な出典も経ていない) / 記録時刻: 2026-09-21T15:23:17Z)

- `ref-system-design-knowledge/references/resource-map.yaml` (本章へ引く card は 0 件。未着手ではなく、上の適用記述で0 件である理由を述べた上での確定である)

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| cloudflare-workers-cron-triggers | 2026-09-04 | Cloudflare (developers.cloudflare.com) | https://developers.cloudflare.com/workers/configuration/cron-triggers/ | 2026-09-21T15:25:02Z | 2026-09-21T15:25:02Z |
